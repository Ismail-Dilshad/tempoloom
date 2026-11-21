// The Teach page's local server. It listens on this computer only (127.0.0.1), needs the key in
// the link it prints, and never sends a video anywhere. Uploads are kept in the workspace; a video
// uploaded to teach is kept in .tempoloom/teach-originals/ after its study files are removed.
import http from 'node:http';
import {z} from 'zod';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';
import {ROOT} from '../engine/config.js';
import * as T from '../engine/teach/teach.js';
import {hasApiKey} from '../engine/transcribe.js';
import * as R from '../engine/studio-requests.js';
import {deleteJob,readPlan,rate,pick,approve,archive,feedback as jobFeedback} from '../engine/studio.js';
import {carryOn} from '../engine/driver.js';
import {home} from '../engine/home.js';
import * as Taste from '../engine/taste.js';
import * as G from '../engine/gallery.js';
import {live,liveJobs} from '../engine/studio-live.js';
import {events,FACES} from '../engine/studio-events.js';
import * as Settings from '../engine/models/settings.js';
import {providerById,LOCAL_PRESETS} from '../engine/models/providers.js';
import * as Backup from '../engine/backup.js';
import {doctor} from '../engine/script-doctor.js';
import * as Trends from '../engine/trends.js';
import * as V from '../engine/studio-versions.js';
import * as H from '../engine/history.js';
import * as TE from '../editor/text-edit.js';
import * as BR from '../editor/broll.js';
import {languageSchema,type Language} from '../engine/languages.js';
const LANGS=languageSchema.options;

const here=path.dirname(fileURLToPath(import.meta.url));
const MAX_MB=Number(process.env.TEACH_MAX_MB||'2048');
const runCover=promisify(execFile);
const uploadKind=z.enum(R.FILE_KINDS);
const uploadName=z.string().min(1).max(160);
const UI=new Set(['tokens.css','shell.css','shell.js','create.js','learn.js','brain.js','editor.js','editor-ui.js','places.js','icons.js','app.css','core.js','taste.js','teach.js','learned.js','studio.js','gallery.js','live.js','settings.js','backup.js','script.js','ideas.js','history.js','text.js','find.js']);
const TYPES:Record<string,string>={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mp4':'video/mp4','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json; charset=utf-8',
 '.png':'image/png','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.webm':'video/webm','.mov':'video/quicktime','.m4v':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4'};
class HttpError extends Error{constructor(public status:number,message:string){super(message);}}

export async function serve(o:{port?:number;fetcher?:typeof fetch;trendSearch?:Trends.Search}={}){
 const key=randomBytes(12).toString('hex');
 const cropping=new Set<string>();
 const published=new Map<string,{folder:string;files:Set<string>}>();
 const linkPreviews=new Map<string,{url:string;expires:number;busy:boolean;choices:{id:string;item:number}[]}>();
 const linkInput=z.object({url:z.string().url(),confirm:z.boolean().default(false),previewToken:z.string().optional(),selection:z.object({id:z.string().min(1),item:z.number().int().positive()}).optional()}).strict();
 // A video left "measuring" by a server that stopped is marked failed, so it can be sent again or removed.
 T.recover();
 await Settings.loadKeys().catch(()=>0);
 const fetcher=o.fetcher??fetch;
 const uploads=new Map<string,{bytes:Uint8Array;expires:number}>();
 let busy=Promise.resolve();
 const queue=(job:()=>Promise<unknown>)=>{busy=busy.then(job).then(()=>undefined,()=>undefined);};

 const json=(res:http.ServerResponse,body:unknown,status=200)=>{const b=JSON.stringify(body);res.writeHead(status,{'content-type':TYPES['.json']!,'cache-control':'no-store'});res.end(b);};
 const body=async(req:http.IncomingMessage)=>{const chunks:Buffer[]=[];let n=0;for await(const c of req){n+=(c as Buffer).length;if(n>200_000)throw new HttpError(413,'Too much data');chunks.push(c as Buffer);}
  try{return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>:{};}catch{throw new HttpError(400,'Not JSON');}};
 const file=async(req:http.IncomingMessage,res:http.ServerResponse,f:string,cache='no-store')=>{
  let st;try{st=await fsp.stat(f);}catch{throw new HttpError(404,'Not found');}
  if(new URL(req.url??'/','http://x').searchParams.get('dl')==='1')res.setHeader('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(f))}`);
  const type=TYPES[path.extname(f).toLowerCase()]??'application/octet-stream',range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range??'');
  if(range&&(range[1]||range[2])){
   const start=range[1]?Number(range[1]):Math.max(0,st.size-Number(range[2])),end=range[1]&&range[2]?Math.min(Number(range[2]),st.size-1):st.size-1;
   if(start>end||start>=st.size){res.writeHead(416,{'content-range':`bytes */${st.size}`});return void res.end();}
   res.writeHead(206,{'content-type':type,'content-range':`bytes ${start}-${end}/${st.size}`,'accept-ranges':'bytes','content-length':end-start+1,'cache-control':cache});
   return void await pipeline(fs.createReadStream(f,{start,end}),res).catch(()=>undefined);
  }
  res.writeHead(200,{'content-type':type,'content-length':st.size,'accept-ranges':'bytes','cache-control':cache});
  await pipeline(fs.createReadStream(f),res).catch(()=>undefined);
 };
 const videoCover=async(res:http.ServerResponse,source:string,cache='no-store')=>{
  const {stdout}=await runCover(ffmpeg,['-v','error','-i',source,'-map','0:v:0','-frames:v','1','-vf',"scale='min(480,iw)':'min(480,ih)':force_original_aspect_ratio=decrease",'-f','image2pipe','-vcodec','mjpeg','pipe:1'],{encoding:'buffer',timeout:10000,windowsHide:true})
   .catch(()=>{throw new HttpError(422,'Could not preview this video');});
  if(!stdout.length)throw new HttpError(422,'Could not preview this video');
  res.writeHead(200,{'content-type':'image/jpeg','cache-control':cache});res.end(stdout);
 };

 const server=http.createServer(async(req,res)=>{
  try{
   const address=server.address() as {port:number},url=new URL(req.url??'/',`http://127.0.0.1:${address.port}`),p=url.pathname,m=req.method??'GET';
   // Only this computer's own page may talk to the server.
   const host=(req.headers.host??'').toLowerCase();
   if(host!==`127.0.0.1:${address.port}`&&host!==`localhost:${address.port}`)throw new HttpError(403,'Open the Teach page with the link from the terminal');
   const origin=req.headers.origin;if(origin&&origin!==`http://${host}`)throw new HttpError(403,'Wrong origin');
// The fonts and the logo are the project's own public files; everything else needs the key.
   if(m==='GET'&&UI.has(p.slice(1)))return await file(req,res,path.join(here,'ui',p.slice(1)));
   if(m==='GET'&&p==='/font.ttf')return await file(req,res,path.join(ROOT,'assets/fonts/open/Fredoka-Variable.ttf'),'max-age=86400');
   if(m==='GET'&&p==='/font-ui.ttf')return await file(req,res,path.join(ROOT,'assets/fonts/open/Inter-Variable.ttf'),'max-age=86400');
   if(m==='GET'&&p==='/font-ui-ar.ttf')return await file(req,res,path.join(ROOT,'assets/fonts/open/NotoSansArabic-Variable.ttf'),'max-age=86400');
   if(m==='GET'&&p==='/favicon.svg')return await file(req,res,path.join(ROOT,'assets/brand/web/favicon.svg'),'no-cache');
   if(m==='GET'&&p==='/mark.svg')return await file(req,res,path.join(ROOT,'assets/brand/logo/svg/tempoloom-mascot.svg'),'no-cache');
   if(m==='GET'&&p==='/font-ar.ttf')return await file(req,res,path.join(ROOT,'assets/fonts/open/Vazirmatn-Variable.ttf'),'max-age=86400');
   const face=/^\/mascot\/([a-z-]+)\.svg$/.exec(p);
   if(m==='GET'&&face&&(FACES as readonly string[]).includes(face[1]!))return await file(req,res,path.join(ROOT,'assets/brand/expressions/svg',`mascot-${face[1]}.svg`),'no-cache');
   if(m==='GET'&&p==='/logo.svg')return await file(req,res,path.join(ROOT,'assets/brand/logo/svg/tempoloom-wordmark-for-dark.svg'),'no-cache');
      const given=Buffer.from(String(req.headers['x-teach-key']??url.searchParams.get('k')??'')),want=Buffer.from(key);
   if(given.length!==want.length||!timingSafeEqual(given,want))throw new HttpError(403,'Open the Teach page with the link from the terminal (pnpm tempoloom teach open)');
   res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');

   if(m==='GET'&&p==='/'){res.setHeader('content-security-policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; frame-src https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com https://player.vimeo.com; frame-ancestors 'none'");return await file(req,res,path.join(here,'ui','index.html'));}
   if(m==='GET'&&p==='/api/home')return json(res,home());
   // ---------- the page's places: tools from the registry, your library, scenes across projects ----------
   if(m==='GET'&&p==='/api/tools'){const {readRegistry}=await import('../cli/tools-registry.js'),TR=await import('./tool-runner.js'),fm=TR.forms();return json(res,{tools:(await readRegistry()).tools.filter(t=>t.page&&t.status==='ready').map(t=>({id:t.id,command:t.command,description:t.description,whenToUse:t.whenToUse,inputs:t.inputs,...t.page,form:fm[t.id]??null}))});}
   // ---------- tools from the page, without a terminal ----------
   if(m==='POST'&&p==='/api/tools/input'){const TR=await import('./tool-runner.js');try{return json(res,await TR.saveInput(url.searchParams.get('name')||'file',req,MAX_MB*1048576));}catch(e){throw new HttpError(400,(e as Error).message);}}
   const toolRun=/^\/api\/tools\/([a-z0-9-]+)\/(run|runs)$/.exec(p);
   if(toolRun){const TR=await import('./tool-runner.js');
    if(m==='POST'&&toolRun[2]==='run'){try{return json(res,await TR.startRun(toolRun[1]!,(await body(req)).values as Record<string,unknown>??{}));}catch(e){throw new HttpError(400,(e as Error).message);}}
    if(m==='GET'&&toolRun[2]==='runs')return json(res,{runs:TR.recentRuns(toolRun[1]!)});}
   const rr=/^\/api\/tool-runs\/([a-f0-9]{12})(\/stop)?$/.exec(p);
   if(rr){const TR=await import('./tool-runner.js');try{return json(res,m==='POST'&&rr[2]?TR.stopRun(rr[1]!):TR.getRun(rr[1]!));}catch(e){throw new HttpError(404,(e as Error).message);}}
   // The editor's auto captions: the words said in a video or sound file, with their times (ElevenLabs).
   // Which speech-to-text the editor can use: on this computer (Omnilingual ASR, once set up) and ElevenLabs (with a key).
   if(m==='GET'&&p==='/api/editor/stt'){const L=await import('../engine/local-stt.js'),CL=await import('../engine/caption-learning.js');
    return json(res,{local:L.status(),sorani:L.soraniAvailable(),elevenlabs:hasApiKey(),learning:{fixes:CL.list().length,clips:CL.clipCount()}});}
   // Captions that learn: GET lists the remembered fixes; POST learns from one edit (and keeps it as a training clip).
   if(p==='/api/editor/caption-fixes'){const CL=await import('../engine/caption-learning.js');
    if(m==='GET')return json(res,{fixes:CL.list(),clips:CL.clipCount(),file:CL.fixesFile(),dataset:CL.datasetDir()});
    if(m==='POST'){const b=await body(req),lang=typeof b.lang==='string'?b.lang:null,from=String(b.from??''),to=String(b.to??'');
     if(!from.trim()||!to.trim()||from.length>2000||to.length>2000)throw new HttpError(400,'from and to are the old and new caption text');
     const learned=CL.learn(lang,from,to);const a=b.audio as {id?:unknown;s?:unknown;e?:unknown}|undefined;
     const clip=a&&typeof a.id==='string'&&Number.isFinite(Number(a.s))&&Number.isFinite(Number(a.e))?await CL.saveClip(lang,{id:a.id,s:Number(a.s),e:Number(a.e)},to,from).catch(()=>null):null;
     return json(res,{learned,clip,fixes:CL.list().length,clips:CL.clipCount()});}}
   if(m==='POST'&&p==='/api/editor/caption-fixes/remove'){const CL=await import('../engine/caption-learning.js'),b=await body(req);return json(res,{fixes:CL.remove(String(b.lang??''),String(b.from??''))});}
   if(m==='POST'&&p==='/api/editor/caption-fixes/clear'){const CL=await import('../engine/caption-learning.js');return json(res,{fixes:CL.clear()});}
   // Sets up captions on this computer: downloads the model once, in the background; GET /api/editor/stt shows progress.
   if(m==='POST'&&p==='/api/editor/stt/setup'){const L=await import('../engine/local-stt.js'),mdl=url.searchParams.get('model')==='300m'?'300m':'1b';
    if(!L.status().runtime)throw new HttpError(400,'The speech runtime is missing; run pnpm install');
    if(!L.installed(mdl)){const pr=L.status().progress;if(!(pr&&(pr.state==='downloading'||pr.state==='unpacking')))void L.setup(mdl).catch(()=>{});}
    return json(res,{local:L.status(),elevenlabs:hasApiKey()});}
   // The editor's auto captions: the words said in a video or sound file, with their times. engine: local (this computer),
   // elevenlabs, or auto (this computer when set up, else ElevenLabs when there is a key).
   if(m==='POST'&&p==='/api/editor/captions'){
    const L=await import('../engine/local-stt.js'),want=url.searchParams.get('engine')||'auto';
    const soraniOnly=url.searchParams.get('model')==='whisper'&&L.soraniAvailable();
    const engine=want==='local'||(want==='auto'&&(L.installed()||soraniOnly))?'local':want==='elevenlabs'||hasApiKey()?'elevenlabs':null;
    if(!engine)throw new HttpError(400,'Auto captions need a speech model: set up captions on this computer (one free download) or add an ElevenLabs key in Settings.');
    if(engine==='local'&&!L.installed()&&!soraniOnly)throw new HttpError(400,'Captions on this computer are not set up yet: press Set up in the Captions box (one download).');
    if(engine==='elevenlabs'&&!hasApiKey())throw new HttpError(400,'Auto captions with ElevenLabs need your key: add it in Settings, Models and keys.');
    const ext=(/\.[a-z0-9]{2,5}$/i.exec(url.searchParams.get('name')||'')?.[0]||'.webm').toLowerCase();
    const dir=path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','editor-captions',randomUUID());await fsp.mkdir(dir,{recursive:true});
    const src=path.join(dir,'source'+ext);let size=0;
    const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The file is over ${MAX_MB} MB`)):cb(null,c);}});
    try{await pipeline(req,limit,fs.createWriteStream(src));if(!size)throw new HttpError(400,'The upload was empty');
     // lang: "auto" (detect), one of the studio's languages (en, ar, fa, ckb, kmr, badini), or any ISO 639 code.
     const lang=(url.searchParams.get('lang')||'auto').toLowerCase(),{transcribe}=await import('../engine/transcribe.js'),{languageSchema}=await import('../engine/languages.js');
     if(lang!=='auto'&&!/^[a-z]{2,3}$/.test(lang))throw new HttpError(400,'The language is a code like en, ar, ckb or ja');
     const CL=await import('../engine/caption-learning.js'),audioId=await CL.keepAudio(await L.decode(src));
     if(engine==='local'){
      // model=whisper: the Sorani Whisper alone; else Omnilingual, with the Sorani Whisper's second opinion on Sorani (sorani=0 turns it off)
      const r=await L.transcribeBest(src,{engine:url.searchParams.get('model')==='whisper'?'whisper':'omnilingual',sorani:url.searchParams.get('sorani')!=='0',hotwords:CL.hotwords(lang!=='auto'?lang:'ckb')});
      const code=lang!=='auto'?lang:r.code,f=CL.applyFixes(code,r.words.map(w=>({...w,text:L.tidyLetters(w.text,code),...('alt' in w&&w.alt?{alt:L.tidyLetters(String(w.alt),code)}:{})})));
      return json(res,{engine:'local',engines:r.engines,language:null,code,words:f.words,fixed:f.fixed,flags:f.words.filter(w=>(w as {alt?:string}).alt).length,audioId});}
     const known=languageSchema.safeParse(lang);const t=await transcribe(src,known.success?{language:known.data}:lang==='auto'?{}:{providerCode:lang});
     const code=t.providerLanguage??null,lc=lang!=='auto'?lang:code==='kur'?'ckb':code,ew=t.words.filter(w=>w.type==='word'&&w.start!=null&&w.end!=null).map(w=>({text:L.tidyLetters(w.text,lc),start:w.start!,end:w.end!})),f=CL.applyFixes(lc,ew);
     return json(res,{engine:'elevenlabs',language:t.language,code,words:f.words,fixed:f.fixed,flags:0,audioId});}
    catch(e){throw e instanceof HttpError?e:new HttpError(500,'Could not read the speech: '+(e as Error).message.slice(0,200));}
    finally{await fsp.rm(dir,{recursive:true,force:true}).catch(()=>{});}
   }
   // The editor records its video in the page (WebM); this turns it into an MP4 with ffmpeg and sends it back.
   if(m==='POST'&&p==='/api/editor/mp4'){
    const fps=Math.min(60,Math.max(12,Number(url.searchParams.get('fps'))||30));
    const dir=path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','editor-export',randomUUID());await fsp.mkdir(dir,{recursive:true});
    const src=path.join(dir,'in.webm'),out=path.join(dir,'out.mp4');let size=0;
    const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The video is over ${MAX_MB} MB`)):cb(null,c);}});
    try{
     await pipeline(req,limit,fs.createWriteStream(src));if(!size)throw new HttpError(400,'The upload was empty');
     await promisify(execFile)(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',src,'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-r',String(fps),'-c:a','aac','-b:a','192k','-movflags','+faststart',out],{maxBuffer:1<<24,windowsHide:true});
     const st=await fsp.stat(out);res.writeHead(200,{'content-type':'video/mp4','content-length':String(st.size),'cache-control':'no-store'});
     await pipeline(fs.createReadStream(out),res);
    }catch(e){if(!res.headersSent)throw e instanceof HttpError?e:new HttpError(500,'Could not make the MP4: '+(e as Error).message.slice(0,200));}
    finally{await fsp.rm(dir,{recursive:true,force:true}).catch(()=>{});}
    return;
   }
   // The editor draws every frame itself and encodes it (VP8/VP9 in IVF), then mixes the sound (WAV). Both come
   // in one upload, the video first (`v` bytes); ffmpeg puts them together as an MP4 (H.264/AAC) or a WebM.
   if(m==='POST'&&p==='/api/editor/mux'){
    const fps=Math.min(60,Math.max(5,Number(url.searchParams.get('fps'))||30)),fq=url.searchParams.get('format'),format=fq==='webm'?'webm':fq==='gif'?'gif':'mp4',crf=String(Math.min(30,Math.max(14,Number(url.searchParams.get('crf'))||19)));
    const vBytes=Number(url.searchParams.get('v'));if(!Number.isSafeInteger(vBytes)||vBytes<=32)throw new HttpError(400,'The video part is missing');
    const dir=path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','editor-export',randomUUID());await fsp.mkdir(dir,{recursive:true});
    const both=path.join(dir,'in.bin'),vid=path.join(dir,'in.ivf'),wav=path.join(dir,'in.wav'),out=path.join(dir,'out.'+format);let size=0;
    const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The video is over ${MAX_MB} MB`)):cb(null,c);}});
    try{
     await pipeline(req,limit,fs.createWriteStream(both));if(size<=vBytes+44)throw new HttpError(400,'The upload is incomplete');
     await pipeline(fs.createReadStream(both,{start:0,end:vBytes-1}),fs.createWriteStream(vid));
     await pipeline(fs.createReadStream(both,{start:vBytes}),fs.createWriteStream(wav));await fsp.rm(both,{force:true});
     // GIF: one palette made for this video (better colours than the web palette), looping, no sound
     if(format==='gif')await promisify(execFile)(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',vid,'-vf',`fps=${fps},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,'-loop','0',out],{maxBuffer:1<<24,windowsHide:true});
     else{const codec=format==='mp4'?['-c:v','libx264','-preset','veryfast','-crf',crf,'-pix_fmt','yuv420p','-r',String(fps),'-c:a','aac','-b:a','192k','-movflags','+faststart']:['-c:v','copy','-c:a','libopus','-b:a','160k'];
      await promisify(execFile)(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',vid,'-i',wav,'-map','0:v:0','-map','1:a:0',...codec,out],{maxBuffer:1<<24,windowsHide:true});}
     const st=await fsp.stat(out);res.writeHead(200,{'content-type':format==='mp4'?'video/mp4':format==='gif'?'image/gif':'video/webm','content-length':String(st.size),'cache-control':'no-store'});
     await pipeline(fs.createReadStream(out),res);
    }catch(e){if(!res.headersSent)throw e instanceof HttpError?e:new HttpError(500,'Could not make the video: '+(e as Error).message.slice(0,200));}
    finally{await fsp.rm(dir,{recursive:true,force:true}).catch(()=>{});}
    return;
   }
   // Sound-only export: the editor's WAV mix as an MP3 (ffmpeg, LAME, high VBR quality).
   if(m==='POST'&&p==='/api/editor/audio'){
    const dir=path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','editor-export',randomUUID());await fsp.mkdir(dir,{recursive:true});
    const src=path.join(dir,'in.wav'),out=path.join(dir,'out.mp3');let size=0;
    const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The sound is over ${MAX_MB} MB`)):cb(null,c);}});
    try{await pipeline(req,limit,fs.createWriteStream(src));if(size<=44)throw new HttpError(400,'The upload was empty');
     await promisify(execFile)(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',src,'-c:a','libmp3lame','-q:a','2',out],{maxBuffer:1<<24,windowsHide:true});
     const st=await fsp.stat(out);res.writeHead(200,{'content-type':'audio/mpeg','content-length':String(st.size),'cache-control':'no-store'});await pipeline(fs.createReadStream(out),res);}
    catch(e){if(!res.headersSent)throw e instanceof HttpError?e:new HttpError(500,'Could not make the MP3: '+(e as Error).message.slice(0,200));}
    finally{await fsp.rm(dir,{recursive:true,force:true}).catch(()=>{});}
    return;}
   // The Editor's smart tools (stabilise, remove background, auto reframe) as background jobs on this computer.
   if(m==='POST'&&p==='/api/editor/tool'){const T=await import('../engine/editor-tools.js'),kind=url.searchParams.get('kind');
    if(kind!=='stabilize'&&kind!=='cutout'&&kind!=='reframe')throw new HttpError(400,'kind is stabilize, cutout or reframe');
    const ext=(/\.[a-z0-9]{2,5}$/i.exec(url.searchParams.get('name')||'')?.[0]||'.mp4').toLowerCase(),dir=await T.newDir(),src=path.join(dir,'source'+ext);let size=0;
    const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The file is over ${MAX_MB} MB`)):cb(null,c);}});
    await pipeline(req,limit,fs.createWriteStream(src));if(!size)throw new HttpError(400,'The upload was empty');
    const aspect=url.searchParams.get('aspect');return json(res,T.status(T.start(kind,src,dir,{...(aspect&&/^(9:16|16:9|1:1|4:5)$/.test(aspect)?{aspect}:{})}).id));}
   const tj=/^\/api\/editor\/tool\/([a-f0-9-]{36})(\/file)?$/.exec(p);
   if(tj){const T=await import('../engine/editor-tools.js'),id=tj[1]!;
    if(m==='GET'&&!tj[2]){const st=T.status(id);if(!st)throw new HttpError(404,'No such job');return json(res,st);}
    if(m==='GET'&&tj[2]){const f=T.jobFile(id);if(!f)throw new HttpError(404,'Not ready');const st=await fsp.stat(f.file);res.writeHead(200,{'content-type':f.mime,'content-length':String(st.size),'cache-control':'no-store'});await pipeline(fs.createReadStream(f.file),res);return;}
    if(m==='DELETE'){await T.forget(id);return json(res,{ok:true});}}
   if(m==='GET'&&p==='/api/tool-results'){const TR=await import('./tool-runner.js');return json(res,{results:TR.results(),active:TR.activeRuns()});}
   const tres=/^\/api\/tool-results\/([a-f0-9]{12})$/.exec(p);
   if(m==='DELETE'&&tres){const TR=await import('./tool-runner.js');try{return json(res,await TR.deleteResult(tres[1]!));}catch(e){throw new HttpError(404,(e as Error).message);}}
   if(m==='GET'&&p==='/api/tool-file'){const TR=await import('./tool-runner.js');let f:string;try{f=TR.runFile(url.searchParams.get('p')||'');}catch{throw new HttpError(404,'Not found');}return await file(req,res,f);}
   if(m==='GET'&&p==='/api/library'){const L=await import('../engine/my-library.js');return json(res,{entries:L.libraryEntries().map(e=>({id:e.id,kind:e.kind,name:e.name,added:e.added,bytes:e.bytes,description:e.description,tags:e.tags,width:e.width,height:e.height,seconds:e.seconds,bpm:e.bpm??null,energy:e.energy,colours:e.colours??[],uses:e.uses.length,available:fs.existsSync(e.file)})),kinds:L.LIB_KINDS});}
   if(m==='POST'&&p==='/api/library/upload'){
    const L=await import('../engine/my-library.js'),name=path.basename(url.searchParams.get('name')||'file').replace(/[^\p{L}\p{N}._ -]/gu,'_').slice(0,120)||'file';
    const length=Number(req.headers['content-length']??0);if(length>MAX_MB*1048576)throw new HttpError(413,`The file is over ${MAX_MB} MB`);
    // Received inside the library folder (not the system's temporary folder), then added to the library for good.
    await fsp.mkdir(path.join(L.libraryRoot(),'_incoming'),{recursive:true});
    const dir=await fsp.mkdtemp(path.join(L.libraryRoot(),'_incoming','up-'));let size=0;
    const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The file is over ${MAX_MB} MB`)):cb(null,c);}});
    try{await pipeline(req,limit,fs.createWriteStream(path.join(dir,name)));if(!size)throw new HttpError(400,'The upload was empty');const r=await L.addToLibrary([path.join(dir,name)],{copyClips:true});if(!r.added.length)throw new HttpError(400,r.skipped[0]||'This file cannot go in the library');return json(res,{added:r.added.map(a=>a.id)});}
    catch(e){throw e instanceof HttpError?e:new HttpError(400,(e as Error).message);}
    finally{await fsp.rm(dir,{recursive:true,force:true});}
   }
   const libItem=/^\/api\/library\/([a-z0-9-]{1,120})(\/file)?$/.exec(p);
   if(libItem){const L=await import('../engine/my-library.js');let e;try{e=L.libraryEntry(libItem[1]!);}catch{throw new HttpError(404,'Not in your library');}
    if(m==='GET'&&libItem[2]){
     if(url.searchParams.get('preview')==='1'&&e.kind==='clip'){
      if(!fs.existsSync(e.file)&&e.sheet)return await file(req,res,e.sheet,'private, max-age=3600');
      return await videoCover(res,e.file,'private, max-age=3600');
     }
     if(url.searchParams.get('preview')==='1'&&e.kind==='image'&&e.sheet&&/\.bmp$/i.test(e.file))return await file(req,res,e.sheet,'private, max-age=3600');
     if(e.file.toLowerCase().endsWith('.svg'))res.setHeader('content-security-policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox");
     return await file(req,res,e.file,'max-age=3600');
    }
    if(m==='DELETE'&&!libItem[2]){await L.removeEntry(e.id);return json(res,{removed:e.id});}}
   if(m==='GET'&&p==='/api/scenes'){
    const S=await import('../engine/studio.js'),V=await import('../engine/studio-versions.js'),out:{job:string;title:string;n:number;label:string;start:number;seconds:number;locked:boolean}[]=[];
    for(const j of R.overview().jobs){let plan;try{plan=S.readPlan(j.job);}catch{continue;}
     const scenes=V.projectScenes((plan as {videoJob?:string}).videoJob)??[],locked=new Set((plan.locked??[]).map(l=>l.id));
     scenes.forEach((sc,i)=>out.push({job:j.job,title:String((j as {request?:string}).request??j.job).split('\n')[0]!.slice(0,90),n:i+1,label:sc.text.slice(0,140),start:sc.start,seconds:sc.duration,locked:locked.has(sc.id)}));}
    return json(res,{scenes:out});
   }
   // ---------- find and tidy: one search over everything, the same thing kept once, space ----------
   if(m==='GET'&&p==='/api/find'){const F=await import('../engine/find.js'),ks=(url.searchParams.get('kinds')||'').split(',').filter((k):k is import('../engine/find.js').FindKind=>F.kinds.includes(k as never));
    return json(res,await F.find(url.searchParams.get('q')||'',{kinds:ks,limit:60}));}
   if(m==='GET'&&p==='/api/find/unseen-count'){const G=await import('../engine/gallery.js');return json(res,{count:(await G.gallery()).items.filter(i=>!i.shows).length});}
   if(m==='GET'&&p==='/api/find/listen')return json(res,await (await import('../engine/find.js')).listen({}));
   if(m==='POST'&&p==='/api/find/listen'){const b=await body(req);try{return json(res,await (await import('../engine/find.js')).listen({go:true,approved:b.approved===true}));}catch(e){throw new HttpError(409,(e as Error).message);}}
   const gs=/^\/api\/gallery\/([a-f0-9]{16})\/shows$/.exec(p);
   if(m==='POST'&&gs){const b=await body(req);try{return json(res,await (await import('../engine/find.js')).describe(gs[1]!,String(b.text??''),'you'));}catch(e){throw new HttpError(400,(e as Error).message);}}
   if(m==='GET'&&p==='/api/tidy/duplicates')return json(res,await (await import('../engine/tidy.js')).duplicates());
   if(m==='GET'&&p==='/api/tidy/storage')return json(res,await (await import('../engine/tidy.js')).storagePlan());
   if(m==='POST'&&(p==='/api/tidy/keep'||p==='/api/tidy/clear')){const b=await body(req),T=await import('../engine/tidy.js');
    try{if(p==='/api/tidy/keep'){const g=String(b.group);if(g!=='videos'&&g!=='lessons')throw new Error('Say videos or lessons');
      return json(res,await T.keepOne(g,String(b.keep??''),Array.isArray(b.others)?b.others.map(String):[]));}
     return json(res,await T.clearStorage(String(b.token??''),{only:Array.isArray(b.only)?b.only.map(String):undefined}));}
    catch(e){throw new HttpError(/changed since|No such|No lesson|Name the|Say videos|starred|rated good/.test((e as Error).message)?409:400,(e as Error).message);}}
   // ---------- the gallery: every video the agent made ----------
   if(m==='GET'&&p==='/api/gallery')return json(res,await G.gallery({hidden:url.searchParams.get('hidden')==='1'}));
   const gt=/^\/api\/gallery\/([a-f0-9]{16})\/teach$/.exec(p);
   if(m==='POST'&&gt){let f:string;try{f=await G.galleryFile(gt[1]!);}catch{throw new HttpError(404,'Not found');}return json(res,await T.draftFromFile(f));}
   const gf=/^\/gallery\/(file|thumb)\/([a-f0-9]{16})$/.exec(p);
   if(m==='GET'&&gf){let f:string;try{f=gf[1]==='thumb'?await G.galleryThumb(gf[2]!):await G.galleryFile(gf[2]!);}catch{throw new HttpError(404,'Not found');}return await file(req,res,f,gf[1]==='thumb'?'max-age=3600':'no-store');}
   // ---------- the publish kit: covers to choose from and a post package, beside the video ----------
   const gp=/^\/api\/gallery\/([a-f0-9]{16})\/(covers|package|check)$/.exec(p);
   if(m==='POST'&&gp){const b=await body(req),P=await import('../editor/publish.js'),[,gid,what]=gp;let f:string;try{f=await G.galleryFile(gid!);}catch{throw new HttpError(404,'Not found');}
    const strs=(k:string)=>Array.isArray(b[k])?(b[k] as unknown[]).map(x=>String(x).trim()).filter(Boolean):[];
    const platforms=strs('platforms').filter((x):x is import('../editor/publish.js').Platform=>P.platformNames.includes(x as never));
    const words={title:String(b.title??'').trim()||undefined,caption:String(b.caption??'').trim()||undefined,tags:strs('tags').map(t=>t.replace(/^#/,''))};
    if(what==='check'){const seconds=Number(b.seconds);return json(res,(platforms.length?platforms:P.platformNames).map(x=>P.checkPost(x,{...words,...(Number.isFinite(seconds)?{seconds}:{})})));}
    const keep=(folder:string,files:string[])=>{const key=randomUUID().slice(0,12);published.set(key,{folder,files:new Set(files.map(x=>path.basename(x)))});return key;};
    if(what==='covers'){const r=await P.thumbnailSet(f,{titles:strs('titles').slice(0,4),count:Math.max(1,Math.min(6,Number(b.count)||3))});
     const key=keep(r.folder,[r.sheet,...r.covers.map(c=>c.jpg)]);return json(res,{folder:r.folder,key,sheet:path.basename(r.sheet),covers:r.covers.map(c=>({name:c.name,file:path.basename(c.jpg),title:c.title,layout:c.layout,at:c.at})),note:r.note});}
    const r=await P.postPackage(f,{platforms,...words});
    const key=keep(r.folder,[...Object.values(r.videos),...Object.values(r.covers),r.post,...(r.captions?[r.captions]:[])]);
    return json(res,{folder:r.folder,key,files:[...published.get(key)!.files],checks:r.checks,ready:r.ready});}
   const pf=/^\/publish-file\/([a-f0-9-]{12})\/([^/]{1,120})$/.exec(p);
   if(m==='GET'&&pf){const set=published.get(pf[1]!),name=decodeURIComponent(pf[2]!);if(!set||!set.files.has(name))throw new HttpError(404,'Not found');
    if(url.searchParams.get('dl')==='1')res.setHeader('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(name)}`);return await file(req,res,path.join(set.folder,name));}
   const ga=/^\/api\/gallery\/([a-f0-9]{16})\/(star|hide|teach|rate)$/.exec(p);
   const gd=/^\/api\/gallery\/([a-f0-9]{16})$/.exec(p);
   if(m==='DELETE'&&gd){try{return json(res,await G.deleteVideo(gd[1]!));}catch(e){throw new HttpError(/No such video/.test((e as Error).message)?404:400,(e as Error).message);}}
   if(m==='POST'&&ga){const b=await body(req),[,gid,action]=ga;
    if(action==='star')return json(res,G.star(gid!,b.on!==false));
    if(action==='hide')return json(res,G.hide(gid!,b.on!==false));
    if(action==='rate'){if(b.rating===null)return json(res,G.clearRating(gid!));try{return json(res,await G.rateVideo(gid!,String(b.rating) as 'good',String(b.note??'')));}catch(e){throw new HttpError(/No such video/.test((e as Error).message)?404:400,(e as Error).message);}}
    // Teach from your own video: it becomes a draft on the Teach page, like any upload.
    let f:string;try{f=await G.galleryFile(gid!);}catch{throw new HttpError(404,'Not found');}
    return json(res,await T.draftFromFile(f));}
   if(m==='GET'&&p==='/api/taste')return json(res,Taste.build(url.searchParams.get('profile')||'main'));
   if(m==='POST'&&p==='/api/taste'){const b=await body(req),pid=String(b.profile??'main'),str=(k:string)=>String(b[k]??'');
    switch(String(b.action)){
     case 'create':return json(res,Taste.create(str('name'),{videos:Array.isArray(b.videos)?b.videos.map(String):null}));
     case 'remove':return json(res,Taste.remove(pid));
     case 'rename':return json(res,Taste.rename(pid,str('name')));
     case 'videos':return json(res,Taste.setVideos(pid,Array.isArray(b.videos)?b.videos.map(String):null));
     case 'line':return json(res,Taste.setLine(pid,str('ref'),b.on===true));
     case 'add':{const topic=str('topic');if(!(T.TEACH_TOPICS as readonly string[]).includes(topic))throw new HttpError(400,'Choose a topic');return json(res,Taste.addLine(pid,topic as T.Topic,str('text')));}
     case 'drop':return json(res,Taste.dropLine(pid,str('id')));
     case 'target':{if(b.lo===null||b.lo===undefined)return json(res,Taste.setTarget(pid,str('metric'),null));const lo=Number(b.lo),hi=Number(b.hi);if(!Number.isFinite(lo)||!Number.isFinite(hi))throw new HttpError(400,'Give two numbers');return json(res,Taste.setTarget(pid,str('metric'),{lo,hi}));}
     case 'notes':return json(res,Taste.setNotes(pid,str('notes').slice(0,2000)));
    }
    throw new HttpError(400,'Unknown action');}
   if(m==='POST'&&p==='/api/lessons'){const b=await body(req);return json(res,T.addLesson({text:String(b.text??''),topics:Array.isArray(b.topics)?b.topics.map(String):[],avoid:b.avoid===true}));}
   if(m==='GET'&&p==='/api/state')return json(res,{...T.overview(),can:{speech:hasApiKey(),maxMB:MAX_MB}});

   const media=/^\/media\/([a-z0-9-]+)\/(crop-[a-f0-9]{16}\.mp4|playback\.mp4|preview\.mp4|thumb\.jpg|sheets\/[a-z0-9-]+\.jpg)$/.exec(p);
   if(m==='GET'&&media){const [,id,name]=media;return await file(req,res,name==='playback.mp4'?T.playbackFile(id!):name==='thumb.jpg'?T.thumbFile(id!):path.join(T.studyDir(id!),name!));}

   if(m==='POST'&&p==='/api/upload'){
    const name=path.basename(url.searchParams.get('name')||'video.mp4').slice(0,120),ext=(path.extname(name).toLowerCase().match(/^\.[a-z0-9]{2,5}$/)?.[0])??'.mp4';
    const length=Number(req.headers['content-length']??0);if(length>MAX_MB*1048576)throw new HttpError(413,`The video is over ${MAX_MB} MB. Trim it first, or raise TEACH_MAX_MB.`);
    const id=T.newId(name),dir=T.studyDir(id);await fsp.mkdir(dir,{recursive:true});let size=0;
    const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The video is over ${MAX_MB} MB`)):cb(null,c);}});
    try{await pipeline(req,limit,fs.createWriteStream(path.join(dir,'source'+ext)));if(!size)throw new HttpError(400,'The upload was empty');return json(res,await T.draft(id,{kind:'upload',name}));}
    catch(e){await fsp.rm(dir,{recursive:true,force:true});throw e instanceof HttpError?e:new HttpError(400,(e as Error).message);}
   }
   if(m==='POST'&&p==='/api/link'){
    const input=linkInput.parse(await body(req));
    if(!input.confirm){
     const result=await T.draftFromLink(input.url,false);
     if(result.status!=='needs-confirmation')throw new HttpError(400,'Preview unavailable');
     for(const [token,v] of linkPreviews)if(v.expires<Date.now())linkPreviews.delete(token);
     if(linkPreviews.size>=64)linkPreviews.delete(linkPreviews.keys().next().value!);
     const token=randomBytes(16).toString('hex');
     linkPreviews.set(token,{url:input.url,expires:Date.now()+20*60*1000,busy:false,choices:result.info.choices.map(v=>({id:v.id,item:v.item}))});
     return json(res,{...result,previewToken:token});
    }
    const preview=linkPreviews.get(input.previewToken??'');
    if(!preview||preview.expires<Date.now()||preview.url!==input.url)throw new HttpError(400,'Preview the link again before downloading');
    const selected=preview.choices.find(v=>v.id===input.selection?.id&&v.item===input.selection.item);
    if(!selected)throw new HttpError(400,'Choose a video from the preview');
    if(preview.busy)throw new HttpError(409,'This video is already downloading');
    preview.busy=true;
    try{const result=await T.draftFromLink(input.url,true,selected);linkPreviews.delete(input.previewToken!);return json(res,result);}
    catch(e){preview.busy=false;throw e;}
   }

   // Better names for taught videos, written by the main model. With none set, the page asks your terminal agent.
   if(m==='POST'&&p==='/api/videos/names'){
    const b=await body(req),ids=(Array.isArray(b.ids)?b.ids:[]).map(String).slice(0,40);if(!ids.length)throw new HttpError(400,'Choose videos to name');
    const {readSettings}=await import('../engine/models/settings.js'),pick=readSettings().model;const names:Record<string,string>={};
    if(!pick)return json(res,{by:'agent',renamed:[]});
    {
     const {chat}=await import('../engine/models/chat.js'),{record}=await import('../engine/models/spend.js');
     const about=ids.map(id=>{const v=T.show(id);return {id,now:v.title,lessons:v.lessons.slice(0,4).map(l=>l.title),looks:(v as {style?:string[]}).style??[]};});
     try{const r=await chat(pick,[{role:'system',content:'You name reference videos in a motion design library. Give each a short, clear name (2 to 6 words) that says what it teaches or how it looks. Plain words, no quotes, no emoji, no hashtags. Answer only JSON: {"names":{"ID":"Name"}}.'},{role:'user',content:JSON.stringify(about)}],[],{max:600});
      if(r.usd)record({usd:r.usd,what:'Better names for taught videos',service:pick.provider});
      const j=JSON.parse(r.text.slice(r.text.indexOf('{'),r.text.lastIndexOf('}')+1)) as {names?:Record<string,unknown>};
      for(const [id,n] of Object.entries(j.names??{}))if(ids.includes(id)&&typeof n==='string'&&n.trim())names[id]=n.trim().slice(0,120);}
     catch(e){throw new HttpError(502,'The model could not name them: '+(e as Error).message);}
    }
    const done:{id:string;title:string}[]=[];for(const [id,title] of Object.entries(names)){try{done.push({id,...T.renameVideo(id,title)});}catch{/* not learned yet */}}
    return json(res,{by:'model',renamed:done});
   }
   const one=/^\/api\/videos\/([a-z0-9-]+)(\/teach|\/finish|\/crop|\/again|\/refine)?$/.exec(p);
   if(one){const [,id,action]=one;
    if(cropping.has(id!))throw new HttpError(409,'A crop is being prepared for this video. Wait a moment.');
    if(m==='POST'&&action==='/crop'){
     const input=T.cropInput.parse(await body(req));
     if(cropping.has(id!))throw new HttpError(409,'A crop is already being prepared');
     cropping.add(id!);
     try{return json(res,await T.previewCrop(id!,input));}finally{cropping.delete(id!);}
    }
    if(m==='PATCH'&&!action)return json(res,T.renameVideo(id!,(await body(req)).title));
    if(m==='POST'&&action==='/teach'){const input=T.teachInput.safeParse(await body(req));if(!input.success)throw new HttpError(400,input.error.issues[0]?.message??'Check the form');
     if(cropping.has(id!))throw new HttpError(409,'Wait for the crop to finish');
     const v=T.video(id!);if(!['draft','failed'].includes(v.status))throw new HttpError(409,'This video was already sent');
     queue(()=>T.teach(id!,input.data,o.fetcher?{fetcher:o.fetcher}:{}));return json(res,{ok:true});}
    if(m==='POST'&&action==='/finish')return json(res,await T.finish(id!));
    if(m==='POST'&&action==='/again')return json(res,await T.again(id!));
    if(m==='POST'&&action==='/refine')return json(res,T.refine(id!,(await body(req)).prompt));
    if(m==='DELETE'&&!action){const v=T.video(id!);return json(res,v.status==='learned'?await T.forget(id!,{keepLessons:url.searchParams.get('keep')==='lessons'}):await T.discard(id!));}
   }
   const lesson=/^\/api\/lessons\/([\w.:-]+)$/.exec(p);
   if(m==='POST'&&lesson){const b=await body(req),action=String(b.action);if(!['keep','remove','edit','both'].includes(action))throw new HttpError(400,'Unknown action');
    return json(res,T.review(lesson[1]!,action as 'keep',{...(typeof b.title==='string'?{title:b.title}:{}),...(typeof b.body==='string'?{body:b.body}:{})}));}
   // ---------- the Studio page ----------
   if(m==='GET'&&p==='/studio'){res.setHeader('content-security-policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; frame-src https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com https://player.vimeo.com; frame-ancestors 'none'");return await file(req,res,path.join(here,'ui','index.html'));}
   if(m==='GET'&&p==='/api/studio/state')return json(res,{...R.overview(),taught:T.videos().filter(v=>v.status==='learned').map(v=>({id:v.id,title:v.title,palette:(v.measured?.color?.palette??[]).slice(0,4).map(c=>c.hex)})),looks:(await (await import('../engine/looks.js')).listLooks()).map(l=>({name:l.name,summary:l.summary.slice(0,2).join(', '),colors:{bgHue:l.measured.backgroundHue,bgSat:l.measured.backgroundSaturation,light:l.measured.brightness,accentHue:l.measured.accentHue}})),profiles:Taste.profiles(),can:{maxMB:MAX_MB,fileLimits:R.fileLimits}});
   if(m==='POST'&&p==='/api/studio/trash/empty'){
    const input=z.object({projects:z.array(z.string().regex(/^[a-z0-9-]+$/)),uploads:z.array(z.object({request:z.string().regex(/^r-[a-f0-9]{8}$/),trashId:z.string().regex(/^[a-f0-9]{24}$/)}))}).strict().parse(await body(req));
    let removed=0,failed=0;
    for(const job of new Set(input.projects)){
     try{if(readPlan(job).archived){deleteJob(job);removed++;}}catch{failed++;}
    }
    for(const file of input.uploads){
     try{if(R.purgeTrashedFile(file.request,file.trashId))removed++;}catch{failed++;}
    }
    return json(res,{removed,failed});
   }
   if(m==='POST'&&p==='/api/studio/requests')return json(res,R.newRequest());
   const trashed=/^\/api\/studio\/requests\/(r-[a-f0-9]{8})\/trashed-files\/([a-f0-9]{24})$/.exec(p);
   if(trashed&&m==='POST'){
    const input=z.object({destination:z.string().regex(/^r-[a-f0-9]{8}$/)}).parse(await body(req));
    return json(res,R.restoreFile(trashed[1]!,trashed[2]!,input.destination));
   }
   const rq=/^\/api\/studio\/requests\/(r-[a-f0-9]{8})(\/files|\/submit)?$/.exec(p);
   if(rq){const [,id,action]=rq;
    if(m==='POST'&&action==='/files'){
     const kind=String(url.searchParams.get('kind')) as R.FileKind,name=url.searchParams.get('name')||'file';
     if(Number(req.headers['content-length']??0)>MAX_MB*1048576)throw new HttpError(413,`The file is over ${MAX_MB} MB`);
     const target=R.filePath(id!,kind,name);let size=0;
     const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The file is over ${MAX_MB} MB`)):cb(null,c);}});
     try{await pipeline(req,limit,fs.createWriteStream(target));if(!size)throw new HttpError(400,'The upload was empty');return json(res,R.addFile(id!,kind,target));}
     catch(e){await fsp.rm(target,{force:true});throw e instanceof HttpError?e:new HttpError(400,(e as Error).message);}
    }
    if(m==='DELETE'&&action==='/files')return json(res,await R.removeFile(id!,url.searchParams.get('name')??''));
    if(m==='PATCH'&&action==='/files'){
     const input=z.discriminatedUnion('action',[
      z.object({action:z.literal('rename'),kind:uploadKind,name:uploadName,label:uploadName}),
      z.object({action:z.literal('trash'),kind:uploadKind,name:uploadName}),
      z.object({action:z.literal('attach'),kind:uploadKind,name:uploadName,attached:z.boolean()})
     ]).parse(await body(req));
     if(input.action==='attach')return json(res,R.setFileAttachment(id!,input.kind,input.name,input.attached));
     return json(res,input.action==='rename'?R.renameFile(id!,input.kind,input.name,input.label):R.trashFile(id!,input.kind,input.name));
    }
    if(m==='POST'&&action==='/submit'){const raw=await body(req),input=R.requestInput.safeParse(raw);if(!input.success)throw new HttpError(400,input.error.issues[0]?.message??'Check the form');
     const r=R.submit(id!,input.data),{readSettings}=await import('../engine/models/settings.js'),st=readSettings();
     // The page works on it at once when Settings say so (or the user chose it for this video).
     if(st.model&&(st.driver==='browser'||(st.driver==='ask'&&raw.drive==='page'))){const t=R.take(id!);const D=await import('../engine/driver.js');await D.drive(t.job);return json(res,{...r,job:t.job,driving:true});}
     return json(res,r);}
    // Whether a sent request has become a job yet (the Edit prompt drawer follows it).
    if(m==='GET'&&!action){const r=R.request(id!);return json(res,{id:r.id,status:r.status,job:r.job??null});}
    if(m==='PATCH'&&!action)return json(res,R.editBrief(id!,(await body(req)).text));
    if(m==='DELETE'&&!action)return json(res,await R.discard(id!));
   }
   // Every version of a step, a video's scenes, and comments on its moments.
   const vf=/^\/studio-file\/version\/([a-z0-9-]+)\/([a-z][a-z-]{1,30})\/(\d+)\/((?:show|choice)-\d+|output)$/.exec(p);
   if(m==='GET'&&vf){let f:string;try{f=V.versionFile(vf[1]!,vf[2]!,Number(vf[3]),vf[4]!);}catch{throw new HttpError(404,'Not found');}
    if(f.toLowerCase().endsWith('.svg'))res.setHeader('content-security-policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return await file(req,res,f);}
   const vs=/^\/api\/studio\/jobs\/([a-z0-9-]+)\/versions\/([a-z][a-z-]{1,30})(?:\/(\d+)\/bring-back)?$/.exec(p);
   if(vs&&m==='GET'&&!vs[3])return json(res,V.versionsView(vs[1]!,vs[2]!));
   if(vs&&m==='POST'&&vs[3])return json(res,V.bringBack(vs[1]!,vs[2]!,Number(vs[3])));
   const tl=/^\/api\/studio\/jobs\/([a-z0-9-]+)\/timeline\/(\d+)\/(show-\d+)$/.exec(p);
   if(m==='GET'&&tl)return json(res,await V.timeline(tl[1]!,Number(tl[2]),tl[3]!));
   const lk=/^\/api\/studio\/jobs\/([a-z0-9-]+)\/lock$/.exec(p);
   if(m==='POST'&&lk){const b=await body(req);const scenes=(Array.isArray(b.scenes)?b.scenes:[b.scene]).map(Number);return json(res,V.lock(lk[1]!,scenes,b.on!==false));}
   const cm=/^\/api\/studio\/jobs\/([a-z0-9-]+)\/comments\/([a-z][a-z-]{1,30})$/.exec(p);
   if(m==='POST'&&cm){const b=await body(req);if(!Array.isArray(b.comments))throw new HttpError(400,'Send the comments');
    return json(res,await V.comment(cm[1]!,cm[2]!,(b.comments as Record<string,unknown>[]).map(c=>({slot:String(c.slot??''),time:Number(c.time),text:String(c.text??'')}))));}
   // ---------- Edit by text: footage as its words; b-roll from the user's own clips ----------
   const upload=async(dir:string,name:string)=>{
    const base=path.basename(name).normalize('NFKC').replace(/[^\p{L}\p{N}._ -]+/gu,'-').slice(0,90)||'video.mp4';
    if(!/\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(base))throw new HttpError(400,'Choose a video file');
    if(Number(req.headers['content-length']??0)>MAX_MB*1048576)throw new HttpError(413,`The file is over ${MAX_MB} MB`);
    await fsp.mkdir(dir,{recursive:true});let target=path.join(dir,base);for(let k=2;fs.existsSync(target);k++)target=path.join(dir,`${path.basename(base,path.extname(base))}-${k}${path.extname(base)}`);
    let size=0;const limit=new Transform({transform(c:Buffer,_e,cb){size+=c.length;size>MAX_MB*1048576?cb(new HttpError(413,`The file is over ${MAX_MB} MB`)):cb(null,c);}});
    try{await pipeline(req,limit,fs.createWriteStream(target));if(!size)throw new HttpError(400,'The upload was empty');return target;}
    catch(e){await fsp.rm(target,{force:true});throw e instanceof HttpError?e:new HttpError(400,(e as Error).message);}};
   if(m==='GET'&&p==='/api/text')return json(res,{edits:TE.docs().map(d=>({id:d.id,title:d.title,updated:d.updated,duration:d.duration,job:d.job??null,renders:d.renders.length,working:d.render?.state==='working'})),
    footage:R.requests().flatMap(r=>r.files.filter(f=>f.kind==='footage'&&/\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(f.name)).map(f=>({request:r.id,name:f.name,job:r.job??null,bytes:f.bytes}))),
    library:BR.library().map(c=>({id:c.id,name:c.name,shots:c.shots.map(x=>({n:x.n,start:x.start,end:x.end,description:x.description,by:x.by}))})),can:{speech:hasApiKey(),maxMB:MAX_MB}});
   if(m==='POST'&&p==='/api/text/upload'){if(!hasApiKey())throw new HttpError(400,'Reading the speech needs your ElevenLabs key (Models and keys).');
    const f=await upload(path.join(TE.textRoot(),'_footage'),url.searchParams.get('name')||'video.mp4');
    try{return json(res,TE.docView((await TE.createDoc(f)).id));}catch(e){await fsp.rm(f,{force:true});throw e;}}
   if(m==='POST'&&p==='/api/text/from-request'){const b=await body(req);if(!hasApiKey())throw new HttpError(400,'Reading the speech needs your ElevenLabs key (Models and keys).');
    const r=R.request(String(b.request??'')),f=r.files.find(x=>x.kind==='footage'&&x.name===String(b.name??''));if(!f)throw new HttpError(404,'No such footage');
    return json(res,TE.docView((await TE.createDoc(f.file,{...(r.job?{job:r.job}:{})})).id));}
   const tx=/^\/api\/text\/([a-z0-9][a-z0-9-]{0,60})$/.exec(p);
   if(tx&&m==='GET')return json(res,TE.docView(tx[1]!));
   if(tx&&m==='DELETE')return json(res,TE.removeDoc(tx[1]!));
   if(tx&&m==='POST'){const id=tx[1]!,b=await body(req),n=(k:string)=>{const x=Number(b[k]);if(!Number.isFinite(x))throw new HttpError(400,'Give '+k);return x;};
    switch(String(b.action)){
     case 'cut':return json(res,TE.cutSentence(id,n('sentence'),b.on!==false));
     case 'words':return json(res,TE.cutWords(id,n('from'),n('to')));
     case 'toggle':return json(res,TE.toggle(id,String(b.id??''),b.on===true));
     case 'all':return json(res,TE.toggleKind(id,String(b.kind) as TE.Kind,b.on===true));
     case 'take':return json(res,TE.pickTake(id,String(b.group??''),n('sentence')));
     case 'hook':return json(res,TE.setHook(id,b.rank===null?null:n('rank'),b.move===true));
     case 'shape':return json(res,await TE.setShape(id,b.aspect?String(b.aspect) as TE.Aspect:null));
     case 'broll':return json(res,TE.setBroll(id,n('sentence'),b.on===true));
     case 'refresh-broll':return json(res,TE.refreshBroll(id));
     case 'captions':return json(res,TE.setCaptions(id,b.on===true));
     case 'sounds':return json(res,TE.setSounds(id,b.on===true));
     case 'steady':return json(res,await TE.setSteady(id,b.on===true));
     case 'blur':return json(res,TE.setBlur(id,{faces:b.faces===true,plates:b.plates===true,phones:b.phones===true,allFaces:b.allFaces===true}));
     case 'caption-style':return json(res,TE.setCaptionStyle(id,b.name?String(b.name):null));
     case 'save-style':{const {saveStyle}=await import('../editor/caption-styles.js');const d=TE.readDoc(id);
      const st=saveStyle(String(b.label??''),{from:d.captionStyle??(await import('../editor/caption-styles.js')).captionStyles().default,fields:(b.fields??{}) as Record<string,unknown>,makeDefault:b.default===true});
      return json(res,TE.setCaptionStyle(id,st.name));}
     case 'export':{const {targets}=await import('../editor/timeline-export.js'),to=(Array.isArray(b.to)?b.to:[]).map(String).filter((t):t is typeof targets[number]=>(targets as readonly string[]).includes(t));
      if(!to.length)throw new HttpError(400,'Choose an editor: '+targets.join(', '));const r=await TE.exportDoc(id,to);return json(res,{...TE.docView(id),exported:{files:Object.keys(r.files),notes:r.notes}});}
     case 'render':{const d=TE.readDoc(id);if(d.render?.state==='working')throw new HttpError(409,'The edit is already being made');
      queue(()=>TE.render(id));await new Promise(r=>setTimeout(r,50));return json(res,{started:true});}
    }
    throw new HttpError(400,'Unknown action');}
   const tlf=/^\/text-file\/([a-z0-9][a-z0-9-]{0,60})\/timeline\/([^/]{1,120})$/.exec(p);
   if(m==='GET'&&tlf){let f:string;try{f=TE.timelineFile(tlf[1]!,decodeURIComponent(tlf[2]!));}catch{throw new HttpError(404,'Not found');}res.setHeader('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(f))}`);return await file(req,res,f);}
   const tf=/^\/text-file\/([a-z0-9][a-z0-9-]{0,60})\/(source|out-\d+)$/.exec(p);
   if(m==='GET'&&tf){let f:string;try{f=tf[2]==='source'?TE.readDoc(tf[1]!).input:TE.outputFile(tf[1]!,Number(tf[2]!.slice(4)));}catch{throw new HttpError(404,'Not found');}return await file(req,res,f);}
   if(m==='POST'&&p==='/api/broll/upload'){const f=await upload(path.join(BR.brollRoot(),'files'),url.searchParams.get('name')||'clip.mp4');
    try{return json(res,await BR.addClips([f]));}catch(e){await fsp.rm(f,{force:true});throw new HttpError(400,(e as Error).message);}}
   const bs=/^\/api\/broll\/(clip-[a-f0-9]{10})(?:\/(\d+))?$/.exec(p);
   if(bs&&m==='POST'&&bs[2]){const b=await body(req);return json(res,BR.describe(bs[1]!,Number(bs[2]),String(b.description??'')));}
   if(bs&&m==='DELETE'&&!bs[2])return json(res,BR.removeClip(bs[1]!));
   const sh=/^\/broll-sheet\/(clip-[a-f0-9]{10})\/(\d+)$/.exec(p);
   if(m==='GET'&&sh){let f:string;try{f=BR.sheetFile(sh[1]!,Number(sh[2]));}catch{throw new HttpError(404,'Not found');}return await file(req,res,f,'max-age=600');}
   // ---------- the change history: every change to lessons, taste and ratings, with Undo ----------
   if(m==='GET'&&p==='/api/history'){const kind=url.searchParams.get('kind'),job=url.searchParams.get('job');
    return json(res,H.history({...(kind&&(H.KINDS as string[]).includes(kind)?{kind:kind as H.Kind}:{}),...(job?{job}:{}),limit:Number(url.searchParams.get('limit'))||200}));}
   const hu=/^\/api\/history\/(h-[a-z0-9]+)\/undo$/.exec(p);
   if(m==='POST'&&hu)return json(res,await H.undo(hu[1]!));
   const uploadPreview=/^\/studio-file\/upload\/(r-[a-f0-9]{8})\/(logo|footage|reference|asset|trash)\/([^/]+)$/.exec(p);
   if(m==='GET'&&uploadPreview){
    const [,id,kind,name]=uploadPreview;
    let source:string;
    try{source=kind==='trash'?R.trashedUpload(id!,name!):R.uploadFile(id!,uploadKind.parse(kind),decodeURIComponent(name!));}
    catch{throw new HttpError(404,'No such upload');}
    if(/\.(png|jpe?g|webp|svg)$/i.test(source)){
     res.setHeader('content-security-policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox");
     return await file(req,res,source);
    }
    if(!/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(source))throw new HttpError(404,'No preview');
    return await videoCover(res,source);
   }
   const sf=/^\/studio-file\/(?:request\/(r-[a-f0-9]{8})\/([^/]+)|job\/([a-z0-9-]+)\/(\d+)\/((?:show|choice)-\d+))$/.exec(p);
   if(m==='GET'&&sf){let f:string;try{f=sf[1]?R.requestFile(sf[1],decodeURIComponent(sf[2]!)):R.shownFile(sf[3]!,Number(sf[4]),sf[5]!);}catch{throw new HttpError(404,'Not found');}
    // An SVG is shown as a picture only (never as a page that could run scripts).
    if(f.toLowerCase().endsWith('.svg'))res.setHeader('content-security-policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return await file(req,res,f);}
   // ---------- Settings: services, keys, models, budgets. Keys come in, never go out. ----------
   if(m==='GET'&&p==='/api/settings')return json(res,{...Settings.overview(),presets:LOCAL_PRESETS});
   if(m==='PATCH'&&p==='/api/settings')return json(res,Settings.update(await body(req)));
   if(m==='GET'&&p==='/api/settings/models'){const can=String(url.searchParams.get('can')??'agents');if(!['agents','vision','images','video','speech'].includes(can))throw new HttpError(400,'Unknown ability');return json(res,{models:Settings.modelsFor(can as 'agents')});}
   const sk=/^\/api\/settings\/(keys|test|local)\/([a-z0-9-]+)$/.exec(p);
   if(sk){const [,what,id]=sk;
    const envName=()=>{const l=Settings.readSettings().local.find(x=>x.id===id);return l?id!.toUpperCase().replace(/-/g,'_')+'_API_KEY':providerById(id!).env;};
    if(what==='keys'&&m==='POST'){const b=await body(req);const saved=await Settings.saveKey(envName(),String(b.key??''));return json(res,{stored:saved.stored,test:await Settings.test(id!,fetcher)});}
    if(what==='keys'&&m==='DELETE')return json(res,await Settings.removeKey(envName()));
    if(what==='test'&&m==='POST')return json(res,await Settings.test(id!,fetcher));
    if(what==='local'&&m==='DELETE')return json(res,Settings.removeLocal(id!));
   }
   if(m==='POST'&&p==='/api/settings/local'){const b=await body(req);const l=Settings.addLocal(String(b.name??''),String(b.baseURL??''));return json(res,{added:l,test:await Settings.test(l.id,fetcher)});}
   // ---------- Backup and move: everything the studio learned, in one file ----------
   if(m==='GET'&&p==='/api/backups')return json(res,{folder:Backup.backupDir(),backups:Backup.listBackups()});
   if(m==='POST'&&p==='/api/backups')return json(res,Backup.createBackup());
   if(m==='GET'&&p==='/api/backups/download'){const {zip}=Backup.backupBytes();
    res.writeHead(200,{'content-type':'application/zip','content-length':zip.length,'cache-control':'no-store','content-disposition':`attachment; filename="tempoloom-backup-${new Date().toISOString().slice(0,10)}.zip"`});return void res.end(Buffer.from(zip));}
   const bf=/^\/api\/backups\/file\/(tempoloom-[a-z-]+-[\d-]+\.zip)$/.exec(p);
   if(m==='GET'&&bf){const f=Backup.listBackups().find(x=>x.name===bf[1]);if(!f)throw new HttpError(404,'No such backup');res.setHeader('content-disposition',`attachment; filename="${f.name}"`);return await file(req,res,f.file);}
   if(m==='POST'&&p==='/api/backups/check'){
    const chunks:Buffer[]=[];let n=0;for await(const c of req){n+=(c as Buffer).length;if(n>600*1048576)throw new HttpError(413,'That file is too big to be a Tempoloom backup');chunks.push(c as Buffer);}
    const bytes=new Uint8Array(Buffer.concat(chunks)),mode=url.searchParams.get('mode')==='replace'?'replace':'merge';
    const preview=Backup.previewRestore(bytes,mode);for(const [t,u] of uploads)if(u.expires<Date.now())uploads.delete(t);
    const token=randomBytes(12).toString('hex');uploads.set(token,{bytes,expires:Date.now()+30*60_000});return json(res,{...preview,token});}
   if(m==='POST'&&p==='/api/backups/restore'){const b=await body(req),u=uploads.get(String(b.token??''));if(!u||u.expires<Date.now())throw new HttpError(400,'Choose the backup file again');
    const mode=b.mode==='replace'?'replace':'merge';const r=Backup.restoreBackup(u.bytes,mode);uploads.delete(String(b.token));return json(res,r);}
   // ---------- the Live studio: a job as a team at work, and its events as they happen ----------
   if(m==='GET'&&p==='/api/studio/live')return json(res,{jobs:liveJobs()});
   const lv=/^\/api\/studio\/live\/([a-z0-9-]+)(\/stream)?$/.exec(p);
   if(m==='GET'&&lv&&!lv[2])return json(res,live(lv[1]!));
   if(m==='GET'&&lv&&lv[2]){
    const job=lv[1]!;live(job);let after=Math.max(0,Number(url.searchParams.get('after'))||0);
    res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','connection':'keep-alive','x-accel-buffering':'no'});
    const push=()=>{for(const e of events(job,after)){res.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);after=e.seq;}};
    res.write('retry: 2000\n\n');push();
    const tick=setInterval(push,600),beat=setInterval(()=>res.write(': still here\n\n'),15000);
    req.on('close',()=>{clearInterval(tick);clearInterval(beat);});
    return;
   }
   const deleteMatch=/^\/api\/studio\/jobs\/([a-z0-9-]+)$/.exec(p);
   if(m==='DELETE'&&deleteMatch)return json(res,deleteJob(deleteMatch[1]!));
   // ---------- Trend watch ----------
   if(m==='GET'&&p==='/api/trends')return json(res,Trends.overview());
   if(m==='POST'&&p==='/api/trends'){const b=await body(req),topic=String(b.topic??'');return json(res,b.action==='remove'?Trends.removeTopic(topic):Trends.addTopic(topic));}
   if(m==='POST'&&p==='/api/trends/check'){const b=await body(req);return json(res,await Trends.check({...(b.topic?{topic:String(b.topic)}:{}),...(o.trendSearch?{search:o.trendSearch}:{})}));}
   const tr=/^\/api\/trends\/(trend-[\w-]+)\/(accept|ignore)$/.exec(p);
   if(m==='POST'&&tr)return json(res,tr[2]==='accept'?Trends.accept(tr[1]!):Trends.ignore(tr[1]!));
   // ---------- the script doctor: a script checked line by line before anything is made ----------
   if(m==='POST'&&p==='/api/script/doctor'){const b=await body(req),text=String(b.text??'').slice(0,12000);if(!text.trim())throw new HttpError(400,'Write the script first');
    const seconds=Number(b.seconds)||undefined,lang=String(b.language??'');return json(res,doctor(text,{...(seconds&&seconds>=5&&seconds<=600?{seconds}:{}),...(lang&&(LANGS as readonly string[]).includes(lang)?{language:lang as Language}:{})}));}
   const sc=/^\/api\/studio\/jobs\/([a-z0-9-]+)\/script\/(keep|decline)$/.exec(p);
   if(m==='POST'&&sc){const b=await body(req);return json(res,R.scriptChoice(sc[1]!,String(b.id??''),sc[2]==='keep'));}
   // ---------- the page drives a job (Settings: who works on new videos) ----------
   const dv=/^\/api\/studio\/jobs\/([a-z0-9-]+)\/drive$/.exec(p);
   if(m==='POST'&&dv){const b=await body(req),job=dv[1]!,D=await import('../engine/driver.js'),pk=b.model&&typeof b.model==='object'?b.model as {provider:string;model:string}:undefined;
    try{if(b.action==='stop')return json(res,D.stopDrive(job));
     return json(res,await D.drive(job,{...(pk?{model:{provider:String(pk.provider),model:String(pk.model)}}:{}),approveSpend:b.action==='go-ahead'}));}
    catch(e){throw new HttpError(409,(e as Error).message);}}
   const jb=/^\/api\/studio\/jobs\/([a-z0-9-]+)\/(rate|pick|approve|final|feedback|archive)(?:\/([a-z-]+))?$/.exec(p);
   if(m==='POST'&&jb){const [,job,action,task]=jb,b=await body(req);
    const input={rating:String(b.rating) as 'good',reasons:Array.isArray(b.reasons)?b.reasons.map(String):[],note:typeof b.note==='string'?b.note:'',
     parts:Array.isArray(b.parts)?(b.parts as Record<string,unknown>[]).map(x=>({part:String(x.part??''),rating:x.rating==='good'?'good' as const:'bad' as const,note:String(x.note??'')})):[]};
    if(action==='rate'&&task)return json(res,await rate(job!,task,input));
    if(action==='final')return json(res,await R.finalRating(job!,input));
    if(action==='pick'&&task){const r=pick(job!,task,String(b.label??''));void carryOn(job!).catch(()=>{});return json(res,r);}
    if(action==='approve'&&task){const r=approve(job!,task);void carryOn(job!).catch(()=>{});return json(res,r);}
    if(action==='archive')return json(res,archive(job!,b.on!==false));
    if(action==='feedback'){const said=String(b.said??'').trim();if(said.length<4)throw new HttpError(400,'Say what should change');return json(res,await jobFeedback(job!,said,{verdict:b.praise===true?'approve':'revise'}));}
   }
   throw new HttpError(404,'Not found');
  }catch(e){
   const status=e instanceof HttpError?e.status:/^No (taught video|lesson|request|studio job|taste profile|text edit)/.test((e as Error).message)?404:400;
   if(!res.headersSent)json(res,{error:(e as Error).message},status);else res.end();
  }
 });
 server.requestTimeout=0;server.headersTimeout=60_000;
 const port=await new Promise<number>((resolve,reject)=>{
  const tryPort=(n:number,left:number)=>{server.once('error',(e:NodeJS.ErrnoException)=>e.code==='EADDRINUSE'&&left>0&&!o.port?tryPort(n+1,left-1):reject(e.code==='EADDRINUSE'?new Error(`Port ${n} is in use; choose another with --port`):e));
   server.listen(n,'127.0.0.1',()=>{server.removeAllListeners('error');resolve((server.address() as {port:number}).port);});};
  tryPort(o.port??4747,20);
 });
 // A weekly backup of what the studio learned, made quietly when the app opens (the four newest are kept).
 setTimeout(()=>{try{Backup.autoBackup();}catch{/* never stops the app */}},4000).unref();
 return {url:`http://127.0.0.1:${port}/?k=${key}`,port,key,idle:()=>busy,close:()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r());})};
}
