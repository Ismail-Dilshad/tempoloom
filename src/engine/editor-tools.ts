// Smart tools for the Editor, run on this computer as background jobs: stabilise a video, remove the background of a
// photo or video, and track a face for auto reframe. Each job takes the clip's file, works in its own folder, and
// gives back a new file (stabilised MP4, cut-out PNG or transparent WebM) or a face track. Inputs are never changed.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT} from './config-root.js';
import {runPythonModule} from './audio-analysis.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';

export type ToolKind='stabilize'|'cutout'|'reframe'|'voice'|'beats'|'reverse'|'track'|'proxy';
export type ToolJob={id:string;kind:ToolKind;state:'running'|'done'|'error';started:number;progress:number|null;note?:string;error?:string;
 file?:string;mime?:string;result?:Record<string,unknown>;dir:string};
const jobs=new Map<string,ToolJob>();
const workDir=()=>path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','editor-tools');
const IMAGE=/\.(png|jpe?g|webp|bmp)$/i;
const media=(args:string[],timeoutMs=4*60*60*1000)=>runPythonModule('media_tools.cli',args,{timeoutMs,label:'Media tool',env:{FFMPEG_PATH:ffmpeg}}) as Promise<Record<string,unknown>>;

/** A new job for an uploaded file (already saved at `source`). Returns at once; the work goes on in the background. */
export function start(kind:ToolKind,source:string,dir:string,o:{aspect?:string;ss?:number;t?:number;box?:string;start?:number;end?:number}={}):ToolJob{
 const job:ToolJob={id:path.basename(dir),kind,state:'running',started:Date.now(),progress:null,dir};jobs.set(job.id,job);
 const progressFile=path.join(dir,'progress.json');
 (async()=>{
  if(kind==='stabilize'){const {stabilize}=await import('../editor/steady.js');const r=await stabilize(source,{out:path.join(dir,'stabilized.mp4')});
   Object.assign(job,{file:r.output,mime:'video/mp4',note:`Shake ${r.shakeBefore} → ${r.shakeAfter}`,result:{shakeBefore:r.shakeBefore,shakeAfter:r.shakeAfter,verdict:r.verdict}});}
  else if(kind==='cutout'){
   if(IMAGE.test(source)){const r=await media(['cutout',source,'--out-dir',dir]) as {results?:{output:string;subjectCoverage:number}[]};const o=r.results?.[0];if(!o)throw new Error('Nothing was cut out');
    Object.assign(job,{file:o.output,mime:'image/png',result:{subjectCoverage:o.subjectCoverage}});}
   else{const out=path.join(dir,'cutout.webm');const r=await media(['cutout-video',source,'--out',out,'--progress',progressFile]);Object.assign(job,{file:out,mime:'video/webm',result:r});}}
  else if(kind==='reverse'||kind==='proxy'){const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const out=path.join(dir,kind+'.mp4');
   // reverse: only the clip's part of the file (ffmpeg holds it in memory to play it backwards); proxy: 720p, a keyframe every half second for quick seeking
   const args=kind==='reverse'?['-v','error','-y',...(o.ss?['-ss',String(o.ss)]:[]),...(o.t?['-t',String(o.t)]:[]),'-i',source,'-vf','reverse','-af','areverse','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',out]
    :['-v','error','-y','-i',source,'-vf','scale=-2:720','-c:v','libx264','-preset','veryfast','-crf','27','-g','15','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',out];
   await promisify(execFile)(ffmpeg,args,{windowsHide:true,maxBuffer:1<<24});Object.assign(job,{file:out,mime:'video/mp4'});}
  else if(kind==='track'){const r=await media(['track',source,'--box',o.box??'0.4,0.4,0.2,0.2','--start',String(o.start??0),...(o.end!=null?['--end',String(o.end)]:[])]) as {points?:unknown[];lostFrames?:number};
   if(!r.points?.length)throw new Error('Nothing could be followed');Object.assign(job,{note:r.lostFrames?`lost it in ${r.lostFrames} frames`:'',result:{points:r.points}});}
  else if(kind==='voice'){const {cleanVoice}=await import('../editor/voice-clean.js');const r=await cleanVoice(source,{out:path.join(dir,'clean'+path.extname(source))});
   Object.assign(job,{file:r.output,mime:/\.(wav|mp3|m4a|flac|ogg|opus)$/i.test(source)?'audio/'+(path.extname(source).slice(1)==='mp3'?'mpeg':path.extname(source).slice(1)):'video/mp4',note:(r.why||[]).slice(0,3).join('; '),result:{why:r.why}});}
  else if(kind==='beats'){const wav=path.join(dir,'beats.wav');const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
   await promisify(execFile)(ffmpeg,['-v','error','-y','-i',source,'-vn','-ac','1','-ar','22050',wav],{windowsHide:true});
   const r=await media(['beats',wav]) as {beats?:number[];barStarts?:number[];tempoBpm?:number|null};if(!r.beats?.length)throw new Error('No beat was found');
   Object.assign(job,{note:r.tempoBpm?`${Math.round(r.tempoBpm)} BPM`:'',result:{beats:r.beats,bars:r.barStarts??[],tempo:r.tempoBpm??null}});}
  else{const r=await media(['reframe',source,'--aspect',o.aspect??'9:16']) as {track?:unknown[];edlOperation?:unknown};
   if(!r.track?.length)throw new Error('No face was found to follow');Object.assign(job,{result:{track:r.track,aspect:o.aspect??'9:16'}});}
  job.state='done';job.progress=1;
 })().catch(e=>{job.state='error';job.error=String((e as Error).message||e).split('\n').filter(Boolean).slice(-2).join(' ').slice(0,300);});
 return job;}

/** A job's state; for frame-by-frame work, how far it is and an estimate of the time left. */
export function status(id:string){const j=jobs.get(id);if(!j)return null;
 if(j.state==='running'){try{const p=JSON.parse(fs.readFileSync(path.join(j.dir,'progress.json'),'utf8')) as {done:number;total:number;secondsPerFrame:number};
  if(p.total){j.progress=p.done/p.total;j.note=`${p.done} of ${p.total} frames · about ${Math.max(1,Math.round((p.total-p.done)*p.secondsPerFrame/60))} min left`;}}catch{/* not started yet */}}
 const {dir,file,...view}=j;void dir;return {...view,ready:j.state==='done'&&!!file};}
export const jobFile=(id:string)=>{const j=jobs.get(id);return j?.state==='done'&&j.file?{file:j.file,mime:j.mime??'application/octet-stream'}:null;};
/** Forgets a finished job and its folder. */
export async function forget(id:string){const j=jobs.get(id);if(!j||j.state==='running')return;jobs.delete(id);await fsp.rm(j.dir,{recursive:true,force:true}).catch(()=>{});}
export async function newDir(){const d=path.join(workDir(),randomUUID());await fsp.mkdir(d,{recursive:true});return d;}
