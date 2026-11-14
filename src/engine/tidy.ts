// Tidy: the same video exported more than once and lessons that say the same thing, grouped so the
// user keeps one; and the files the studio can make again (old previews, earlier renders, stale
// caches), listed with their size and cleared in one confirmed step. Finals, starred videos and
// videos rated good, transcripts and voice-overs (paid for), the user's own clips and anything
// outside the project's export folder and workspace are never listed.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {ROOT} from './config.js';
import {dbPath} from './brain/db.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';

const workspace=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace');
const DAY=86400000;
const inside=(root:string,f:string)=>{const r=path.relative(root,f);return !!r&&!r.startsWith('..')&&!path.isAbsolute(r);};

// ---------- the same video, more than once ----------
const printsFile=()=>path.join(path.dirname(dbPath()),'find-prints.json');
let prints:Record<string,{sha:string;frames:number[]}>|null=null;
const readPrints=()=>{if(prints)return prints;try{prints=JSON.parse(fs.readFileSync(printsFile(),'utf8'));}catch{prints={};}return prints!;};
const tiny=(file:string,at:number)=>new Promise<Buffer>(resolve=>{const c=spawn(ffmpeg,['-v','error','-ss',at.toFixed(2),'-i',file,'-frames:v','1','-vf','scale=8:8,format=gray','-f','rawvideo','-'],{windowsHide:true});
 const out:Buffer[]=[];c.stdout.on('data',d=>out.push(d));c.on('error',()=>resolve(Buffer.alloc(0)));c.on('close',()=>resolve(Buffer.concat(out)));});
/** A video's fingerprint: its first megabyte's hash (identical files) and eight tiny grey frames
 *  (the same picture, encoded again or in another size). Remembered per file version. */
async function fingerprint(file:string,seconds:number){
 const st=fs.statSync(file),key=createHash('sha1').update(`${file}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0,16),memo=readPrints();
 if(memo[key])return memo[key]!;
 const fd=fs.openSync(file,'r'),buf=Buffer.alloc(Math.min(st.size,1<<20));fs.readSync(fd,buf,0,buf.length,0);fs.closeSync(fd);
 const sha=createHash('sha256').update(buf).update(String(st.size)).digest('hex').slice(0,24);
 const frames=[...(await Promise.all(Array.from({length:8},(_,i)=>tiny(file,seconds*(i+.5)/8)))).map(b=>[...b].concat(Array(64-b.length).fill(0)).slice(0,64))].flat();
 memo[key]={sha,frames};return memo[key]!;
}
const apart=(a:number[],b:number[])=>{let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]!-(b[i]??0));return d/a.length;};
type VideoGroup={kind:'videos';keep:string;why:string;items:{id:string;title:string;file:string;bytes:number;made:string;same:'identical'|'near';canDelete:boolean;starred:boolean;rating:string|null}[];saves:number};
/** Videos that are the same: the identical file in two places, or the same picture exported again. */
export async function duplicateVideos(){
 const G=await import('./gallery.js'),items=(await G.gallery({hidden:true})).items.filter(i=>i.seconds&&i.seconds>0);
 const fp=new Map<string,{sha:string;frames:number[]}>();
 for(const i of items){try{fp.set(i.id,await fingerprint(path.resolve(ROOT,i.file),i.seconds!));}catch{/* unreadable */}}
 try{fs.mkdirSync(path.dirname(printsFile()),{recursive:true});fs.writeFileSync(printsFile(),JSON.stringify(readPrints()));}catch{/* a cache */}
 const seen=new Set<string>(),groups:VideoGroup[]=[];
 for(const a of items){if(seen.has(a.id)||!fp.has(a.id))continue;const fa=fp.get(a.id)!;
  const same=items.filter(b=>b.id!==a.id&&!seen.has(b.id)&&fp.has(b.id)&&Math.abs(b.seconds!-a.seconds!)<=Math.max(.15,a.seconds!*.01)
   &&(fp.get(b.id)!.sha===fa.sha||apart(fp.get(b.id)!.frames,fa.frames)<6));
  if(!same.length)continue;
  const all=[a,...same];for(const x of all)seen.add(x.id);
  // Which to keep: starred, then rated good, then a final, then one a studio job knows, then the newest.
  const rank=(x:typeof a)=>(x.starred?16:0)+(x.rating==='good'?8:0)+(x.kind==='final'?4:0)+(x.job||x.brainJob?2:0);
  // Then the sharpest (most pixels, then the larger file: the better encode), then the newest.
  const px=(x:typeof a)=>(x.width??0)*(x.height??0);
  const keep=[...all].sort((x,y)=>rank(y)-rank(x)||px(y)-px(x)||y.bytes-x.bytes||y.made.localeCompare(x.made))[0]!;
  const top=all.filter(x=>x!==keep&&rank(x)===rank(keep));
  const why=keep.starred?'starred':keep.rating==='good'?'rated good':keep.kind==='final'?'the final':keep.job?'its studio job knows it':top.some(x=>px(x)<px(keep))?'the sharpest':top.some(x=>x.bytes<keep.bytes)?'the better encode':'the newest';
  groups.push({kind:'videos',keep:keep.id,why:`Keep ${keep.name}: ${why}.`,saves:all.filter(x=>x.id!==keep.id&&x.canDelete).reduce((t,x)=>t+x.bytes,0),
   items:all.map(x=>({id:x.id,title:x.title,file:x.file,bytes:x.bytes,made:x.made,same:fp.get(x.id)!.sha===fp.get(keep.id)!.sha?'identical':'near',canDelete:x.canDelete,starred:x.starred,rating:x.rating}))});}
 return groups;
}

// ---------- lessons that say the same thing ----------
const STOP=new Set('the and for with that this are was you your from into about make have has not but its their then than when each every over under more most very use uses using used video videos should always never keep avoid dont'.split(' '));
const lstem=(w:string)=>w.replace(/(ing|ed|es|s)$/,'');
const ltokens=(s:string)=>new Set(s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2&&!STOP.has(w)).map(lstem));
const negative=(k:{kind:string;title:string;body:string})=>k.kind==='avoid'||/^(avoid|never|do not|don't|no )\b/i.test(k.title)||/^(avoid|never|do not|don't)\b/i.test(k.body);
type LessonGroup={kind:'lessons';keep:string;why:string;items:{id:string;title:string;body:string;status:string;wins:number;losses:number;similarity:number}[]};
/** Lessons that say nearly the same thing (shared rare words, the same domain, both a do or both a
 *  don't). The one to keep: approved over proven over trial, then the one that worked most. */
export async function duplicateLessons(o:{threshold?:number}={}){
 const {allKnowledge}=await import('./brain/db.js'),{alike}=await import('./teach/teach.js');
 const ks=allKnowledge().filter(k=>!['tool'].includes(k.kind)&&!['rejected','retired'].includes(k.status)&&!k.id.startsWith('teach-pattern-'));
 const df=new Map<string,number>(),sets=new Map<string,Set<string>>();
 for(const k of ks){const t=ltokens(k.title+' '+k.body);sets.set(k.id,t);for(const w of t)df.set(w,(df.get(w)??0)+1);}
 const idf=(w:string)=>Math.log(1+(ks.length+1)/(1+(df.get(w)??0))),limit=o.threshold??.72,seen=new Set<string>(),groups:LessonGroup[]=[];
 const STATUS={approved:3,proven:2,trial:1} as Record<string,number>;
 for(const a of ks){if(seen.has(a.id))continue;
  const same=ks.filter(b=>b.id!==a.id&&!seen.has(b.id)&&(a.domain===b.domain||a.domain==='both'||b.domain==='both')&&negative(a)===negative(b))
   .map(b=>({b,s:alike(sets.get(a.id)!,sets.get(b.id)!,idf)})).filter(x=>x.s>=limit);
  if(!same.length)continue;
  const all=[{b:a,s:1},...same];for(const x of all)seen.add(x.b.id);
  const keep=[...all].sort((x,y)=>(STATUS[y.b.status]??0)-(STATUS[x.b.status]??0)||(y.b.wins-y.b.losses)-(x.b.wins-x.b.losses)||y.b.uses-x.b.uses||x.b.created.localeCompare(y.b.created))[0]!.b;
  groups.push({kind:'lessons',keep:keep.id,why:`Keep "${keep.title.slice(0,80)}": ${keep.status}${keep.wins?`, worked ${keep.wins} time${keep.wins>1?'s':''}`:''}.`,
   items:all.map(x=>({id:x.b.id,title:x.b.title,body:x.b.body,status:x.b.status,wins:x.b.wins,losses:x.b.losses,similarity:+x.s.toFixed(2)}))});}
 return groups;
}
export async function duplicates(){return {videos:await duplicateVideos(),lessons:await duplicateLessons()};}

/** Keeps one of a group. The other lessons are retired (with Undo on the History page); the other
 *  videos are deleted when they are in the export folder or workspace, otherwise hidden. */
export async function keepOne(group:'videos'|'lessons',keep:string,others:string[]){
 if(!others.length||others.includes(keep))throw new Error('Name the one to keep and the others');
 if(group==='lessons'){
  const {getKnowledge}=await import('./brain/db.js'),{setStatus}=await import('./brain/brain.js'),{change}=await import('./history.js');
  const k=getKnowledge(keep);if(!k)throw new Error('No lesson '+keep);
  for(const id of others)if(!getKnowledge(id))throw new Error('No lesson '+id);
  return change({kind:'lessons',title:`Kept one of ${others.length+1} lessons that say the same: ${k.title.slice(0,80)}`},()=>({kept:keep,retired:others.map(id=>setStatus(id,'retired',`Says the same as ${keep}`).id)}));
 }
 const G=await import('./gallery.js'),g=await G.gallery({hidden:true});if(!g.items.some(i=>i.id===keep))throw new Error('No such video in the gallery');
 const deleted:string[]=[],hidden:string[]=[];
 for(const id of others){const i=g.items.find(x=>x.id===id);if(!i)continue;if(i.starred||i.rating==='good')throw new Error(`${i.name} is ${i.starred?'starred':'rated good'}: keep it, or unstar it first`);
  if(i.canDelete){await G.deleteVideo(id);deleted.push(i.file);}else{G.hide(id,true);hidden.push(i.file);}}
 return {kept:keep,deleted,hidden};
}

// ---------- storage ----------
export type Item={id:string;path:string;bytes:number;kind:'preview'|'earlier-render'|'render-cache'|'work-cache'|'broll-copies';why:string;when:string};
async function size(p:string):Promise<number>{const st=await fsp.lstat(p).catch(()=>null);if(!st)return 0;if(!st.isDirectory())return st.size;
 let t=0;for(const n of await fsp.readdir(p).catch(()=>[] as string[]))t+=await size(path.join(p,n));return t;}
async function newest(p:string):Promise<number>{const st=await fsp.lstat(p).catch(()=>null);if(!st)return 0;if(!st.isDirectory())return st.mtimeMs;
 let t=st.mtimeMs;for(const n of await fsp.readdir(p).catch(()=>[] as string[]))t=Math.max(t,await newest(path.join(p,n)));return t;}
const idOf=(p:string)=>createHash('sha1').update(p).digest('hex').slice(0,12);
const rel=(f:string)=>path.relative(ROOT,f).split(path.sep).join('/');
/** What can go, with its size and why; nothing is removed here. */
export async function storagePlan(o:{previewDays?:number;now?:number}={}){
 const now=o.now??Date.now(),items:Item[]=[],ws=workspace(),G=await import('./gallery.js'),out=G.outputRoot();
 const add=async(p:string,kind:Item['kind'],why:string)=>{const bytes=await size(p);if(bytes>0)items.push({id:idOf(p),path:p,bytes,kind,why,when:new Date(await newest(p)).toISOString()});};
 // Previews of jobs that have moved on: older than a week, not starred, not rated good.
 const g=await G.gallery({hidden:true}),finals=new Set(g.items.filter(i=>i.kind==='final').map(i=>i.job));
 for(const i of g.items)if(i.kind==='preview'&&i.canDelete&&!i.starred&&i.rating!=='good'&&now-Date.parse(i.made)>(o.previewDays??7)*DAY)
  await add(path.resolve(ROOT,i.file),'preview',i.job&&finals.has(i.job)?'A preview of a video that has its final.':`A preview from ${Math.round((now-Date.parse(i.made))/DAY)} days ago.`);
 // Motion projects: renders before the latest, and caches for versions that changed since.
 const projects=path.join(ws,'projects');
 for(const id of await fsp.readdir(projects).catch(()=>[] as string[])){const dir=path.join(projects,id);
  let latest:{file?:string;fingerprint?:string}={};try{latest=JSON.parse(await fsp.readFile(path.join(dir,'latest-render.json'),'utf8'));}catch{/* never rendered */}
  const latestDir=latest.file?path.dirname(path.resolve(latest.file)):null;
  for(const r of await fsp.readdir(path.join(dir,'renders')).catch(()=>[] as string[])){const p=path.join(dir,'renders',r);if(p===latestDir)continue;
   let state='';try{state=JSON.parse(await fsp.readFile(path.join(p,'status.json'),'utf8')).state;}catch{/* none */}
   if(state==='rendering'&&now-(await newest(p))<DAY)continue; // may still be running
   await add(p,'earlier-render',state==='failed'?`A render of ${id} that failed.`:`An earlier render of ${id} (its video was exported; the latest render is kept).`);}
  const fp=latest.fingerprint??'';
  for(const c of await fsp.readdir(path.join(dir,'render-cache')).catch(()=>[] as string[])){const p=path.join(dir,'render-cache',c);
   if(c==='scenes'){for(const s of await fsp.readdir(p).catch(()=>[] as string[]))if(!fp||!s.startsWith(fp.slice(0,32)))if(now-(await newest(path.join(p,s)))>DAY)await add(path.join(p,s),'render-cache',`Scenes of an earlier version of ${id}; made again if needed.`);continue;}
   if(fp&&c.startsWith(fp))continue;await add(p,'render-cache',`A cached render of an earlier version of ${id}; made again if needed.`);}}
 // Work files: the editor's step-by-step files and temporary files, once a day old.
 for(const [sub,days] of [['cache/editor',2],['cache/temp',1]] as const){const base=path.join(ws,sub);
  for(const n of await fsp.readdir(base).catch(()=>[] as string[])){const p=path.join(base,n);if(now-(await newest(p))>days*DAY)await add(p,'work-cache',sub==='cache/editor'?'Steps of edits that finished; an edit run again makes them again.':'A temporary file.');}}
 // B-roll shots cut for edits by text: cut again from your clips when the edit is made again.
 const edits=path.join(ws,'edits','text');
 for(const d of await fsp.readdir(edits).catch(()=>[] as string[])){const p=path.join(edits,d,'broll');if(now-(await newest(p))>30*DAY)await add(p,'broll-copies','B-roll shots cut for an edit a month ago; cut again from your clips if needed.');}
 // Only inside the workspace or the export folder, ever.
 const safe=items.filter(i=>inside(ws,i.path)||inside(out,i.path)).sort((a,b)=>b.bytes-a.bytes);
 const token=createHash('sha1').update(safe.map(i=>`${i.id}:${i.bytes}`).sort().join('|')).digest('hex').slice(0,16);
 const by=(k:Item['kind'])=>{const x=safe.filter(i=>i.kind===k);return {count:x.length,bytes:x.reduce((t,i)=>t+i.bytes,0)};};
 return {items:safe.map(i=>({...i,path:rel(i.path)})),bytes:safe.reduce((t,i)=>t+i.bytes,0),token,
  kinds:{preview:by('preview'),'earlier-render':by('earlier-render'),'render-cache':by('render-cache'),'work-cache':by('work-cache'),'broll-copies':by('broll-copies')},
  never:'Finals, starred videos, videos rated good, transcripts, voice-overs, your own clips and anything outside the export folder and workspace are never listed.'};
}
/** Clears what the plan listed, in one step. The token is the plan's: if anything changed since it
 *  was shown (a file added, a size changed), nothing is removed and a new plan is needed. */
export async function clearStorage(token:string,o:{only?:string[]}={}){
 const plan=await storagePlan();if(plan.token!==token)throw new Error('What can be cleared changed since it was listed. Look at the list again, then clear.');
 const pick=o.only?.length?plan.items.filter(i=>o.only!.includes(i.id)):plan.items,ws=workspace(),{outputRoot}=await import('./gallery.js'),out=outputRoot();
 let bytes=0;const removed:string[]=[];
 for(const i of pick){const abs=path.resolve(ROOT,i.path);if(!(inside(ws,abs)||inside(out,abs)))continue;await fsp.rm(abs,{recursive:true,force:true});bytes+=i.bytes;removed.push(i.path);}
 return {removed:removed.length,bytes,files:removed};
}
