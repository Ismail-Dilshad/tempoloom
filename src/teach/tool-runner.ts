// Tools from the page, without a terminal: each tool's form (what it needs, its options) and a
// runner that starts the same command the agent would (`tempoloom …`, never a shell), keeps its
// output to show as it runs, and lists the files it made so the page can show them.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {ROOT} from '../engine/config.js';
import {mainCheckout} from '../engine/config-root.js';
import {PICTURE_STYLES} from '../art/schema.js';

export type Field={key:string;label:string;kind:'file'|'files'|'text'|'url'|'textarea'|'number'|'select'|'toggle';
 required?:boolean;help?:string;placeholder?:string;accept?:string;options?:[string,string][];min?:number;max?:number;step?:number;value?:string|number|boolean;advanced?:boolean};
type Values=Record<string,unknown>;
type Form={fields:Field[];args:(v:Values,text:(name:string,body:string)=>Promise<string>)=>Promise<string[]>|string[]};

const s=(v:unknown)=>typeof v==='string'?v.trim():'';
const n=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()&&Number.isFinite(Number(v))?Number(v):null;
const on=(v:unknown)=>v===true||v==='true'||v==='on';
const flag=(name:string,v:unknown)=>{const x=typeof v==='number'?String(v):s(v);return x?[name,x]:[];};
const need=(label:string,v:string)=>{if(!v)throw new Error(`Add ${label}`);return v;};
const media='video/*,audio/*,.mp4,.mov,.mkv,.webm,.m4a,.mp3,.wav';

/** The forms of the tools that run from their own page (Edit by text, Trend watch and Tidy have pages of their own). */
export const FORMS:Record<string,Form>={
 'media-voice':{fields:[
   {key:'file',label:'Recording',kind:'file',required:true,accept:media,help:'A video or audio file with a voice.'},
   {key:'strength',label:'Strength',kind:'select',options:[['','Standard'],['light','Light'],['strong','Strong']],help:'Hum and echo are found by themselves.'},
   {key:'plan',label:'Only measure (do not change anything)',kind:'toggle',advanced:true},
   {key:'denoise',label:'Noise reduction',kind:'number',min:0,max:1,step:.1,help:'0 to 1. Empty: from the strength above.',advanced:true},
   {key:'hum',label:'Mains hum',kind:'select',options:[['','Find it'],['50','50 Hz'],['60','60 Hz']],advanced:true},
   {key:'echo',label:'Room echo',kind:'number',min:0,max:1,step:.1,advanced:true}],
  args:v=>['media','voice',need('a recording',s(v.file)),...(on(v.plan)?['--plan']:[]),...flag('--denoise',n(v.denoise)??{light:.35,strong:.85}[s(v.strength)]??''),...flag('--hum',v.hum),...flag('--echo',n(v.echo)??'')]},
 'media-speakers':{fields:[
   {key:'file',label:'Recording',kind:'file',required:true,accept:media,help:'An interview, a podcast or any talk.'},
   {key:'names',label:'Their names',kind:'text',placeholder:'Sara, Omar'},
   {key:'roles',label:'Their roles',kind:'text',placeholder:'Host, Guest',advanced:true},
   {key:'count',label:'How many speak',kind:'number',min:1,max:8,step:1,advanced:true},
   {key:'bars',label:'Name bars on screen',kind:'toggle'}],
  args:v=>['media','speakers',need('a recording',s(v.file)),...flag('--names',v.names),...flag('--roles',v.roles),...flag('--count',n(v.count)??''),...(on(v.bars)?['--bars']:[])]},
 'media-match':{fields:[
   {key:'files',label:'Clips to match',kind:'files',required:true,accept:'video/*,.mp4,.mov,.mkv,.webm',help:'Two or more clips from different cameras or phones.'},
   {key:'to',label:'Match them to',kind:'file',accept:'video/*,image/*',help:'Optional: a clip or picture with the colour you want.'},
   {key:'strength',label:'Strength',kind:'select',options:[['','Standard'],['.5','Gentle'],['1','Full']]},
   {key:'plan',label:'Only measure (do not change anything)',kind:'toggle',advanced:true}],
  args:v=>{const clips=Array.isArray(v.files)?v.files.map(s).filter(Boolean):[];if(clips.length<1)throw new Error('Add the clips to match');
   return ['media','match',...clips,...flag('--to',v.to),...flag('--strength',s(v.strength)),...(on(v.plan)?['--plan']:[])];}},
 'captions-generate':{fields:[
   {key:'file',label:'Video or audio',kind:'file',required:true,accept:media},
   {key:'language',label:'Language',kind:'text',placeholder:'Found by itself (or: en, ar, ku)'},
   {key:'script',label:'The script, if you have it',kind:'textarea',placeholder:'Paste the words that are said, for exact spelling.',advanced:true}],
  args:async(v,text)=>['media','captions',need('a video or audio file',s(v.file)),...flag('--language',v.language),...(s(v.script)?['--script',await text('script.txt',s(v.script))]:[])]},
 'brand-scan':{fields:[
   {key:'url',label:'Website',kind:'url',required:true,placeholder:'https://yourbrand.com'},
   {key:'download',label:'Save its logo and pictures',kind:'toggle',value:true}],
  args:v=>['media','brand-scan',need('a website',s(v.url)),...(on(v.download)?['--download']:[])]},
 'make-chart':{fields:[
   {key:'script',label:'What the video says',kind:'textarea',required:true,placeholder:'Sales grew every quarter this year, and most of it came from the app.'},
   {key:'data',label:'The numbers',kind:'textarea',required:true,placeholder:'Q1, 120\nQ2, 180\nQ3, 260\nQ4, 340',help:'One label and one number per line.'},
   {key:'kind',label:'Chart',kind:'select',options:[['','Chosen for you'],['bar','Bars'],['line','Line'],['count','Counting number'],['compare','Comparison']]},
   {key:'title',label:'Chart title',kind:'text',advanced:true},
   {key:'highlight',label:'Highlight',kind:'text',placeholder:'Q4',advanced:true}],
  args:async(v,text)=>['make',await text('script.txt',need('what the video says',s(v.script))),'--chart',await text('data.txt',need('the numbers',s(v.data))),...flag('--chart-kind',v.kind),...flag('--chart-title',v.title),...flag('--highlight',v.highlight)]},
 'paint-from':{fields:[
   {key:'file',label:'Photo',kind:'file',required:true,accept:'image/*'},
   {key:'style',label:'Style',kind:'select',options:PICTURE_STYLES.map(x=>[x,x.charAt(0).toUpperCase()+x.slice(1)] as [string,string]),value:'oil'},
   {key:'timelapse',label:'Make a timelapse video too',kind:'toggle',value:true},
   {key:'detail',label:'Detail',kind:'select',options:[['','Normal'],['.7','Loose'],['1.4','Fine']]}],
  args:v=>['paint','from',need('a photo',s(v.file)),'--style',s(v.style)||'oil',...(on(v.timelapse)?['--timelapse']:[]),...flag('--detail',s(v.detail))]},
 'paint-check':{fields:[
   {key:'folder',label:'Painting folder',kind:'text',required:true,placeholder:'workspace/art/my-painting',help:'The folder a painting was made in.'},
   {key:'reference',label:'The photo it was painted from',kind:'file',accept:'image/*',advanced:true}],
  args:v=>['paint','check',need('the painting folder',s(v.folder)),...flag('--reference',v.reference)]},
 'edit-export-timeline':{fields:[
   {key:'edit',label:'Edit',kind:'text',required:true,placeholder:'The id of an edit by text, or EDIT.json',help:'From Edit by text, or an edit file.'},
   {key:'to',label:'For',kind:'select',options:[['','Every editor'],['premiere','Premiere'],['resolve','Resolve'],['fcp','Final Cut'],['edl','EDL'],['capcut','CapCut']]}],
  args:v=>['edit','export',need('an edit',s(v.edit)),...flag('--to',v.to)]},
 'looks':{fields:[
   {key:'source',label:'Video link or file',kind:'url',required:true,placeholder:'https://…  (or upload below)'},
   {key:'file',label:'Or a video file',kind:'file',accept:'video/*'},
   {key:'name',label:'Name the look',kind:'text',required:true,placeholder:'soft-product'}],
  args:v=>['look','learn',s(v.file)||need('a video link or file',s(v.source)),'--name',need('a name',s(v.name)),'--confirm']},
 'look-mix':{fields:[
   {key:'a',label:'Style A',kind:'text',required:true,placeholder:'A look name or a taught video id'},
   {key:'b',label:'Style B',kind:'text',required:true},
   {key:'weight',label:'Share of A',kind:'number',min:0,max:1,step:.05,value:.7},
   {key:'name',label:'Name the mix',kind:'text',advanced:true}],
  args:v=>['look','mix',need('style A',s(v.a)),need('style B',s(v.b)),...flag('--weight',n(v.weight)??''),...flag('--name',v.name)]},
 'look-channel':{fields:[
   {key:'url',label:'Channel link',kind:'url',required:true,placeholder:'https://www.youtube.com/@channel'},
   {key:'name',label:'Name the look',kind:'text',required:true},
   {key:'count',label:'Videos to watch',kind:'number',min:3,max:40,step:1,value:20,advanced:true}],
  args:v=>['look','channel',need('a channel link',s(v.url)),'--name',need('a name',s(v.name)),...flag('--count',n(v.count)??''),'--confirm']},
};
export const forms=()=>Object.fromEntries(Object.entries(FORMS).map(([id,f])=>[id,f.fields]));

const inputsDir=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','tools','inputs');
/** A file sent from the page, kept for the tool to read. */
export async function saveInput(name:string,req:NodeJS.ReadableStream,maxBytes:number){
 const safe=path.basename(name).replace(/[^\p{L}\p{N}._ -]/gu,'_').slice(0,100)||'file';
 const dir=inputsDir();await fsp.mkdir(dir,{recursive:true});
 const f=path.join(dir,randomBytes(4).toString('hex')+'-'+safe);
 let n=0;const out=fs.createWriteStream(f);
 try{for await(const c of req){n+=(c as Buffer).length;if(n>maxBytes)throw new Error('The file is too large');if(!out.write(c))await new Promise<void>(r=>out.once('drain',()=>r()));}}
 catch(e){out.destroy();await fsp.rm(f,{force:true});throw e;}
 await new Promise<void>((res,rej)=>out.end((e?:Error|null)=>e?rej(e):res()));
 if(!n){await fsp.rm(f,{force:true});throw new Error('The file is empty');}
 return {path:path.relative(ROOT,f).split(path.sep).join('/'),name:safe,bytes:n};
}

type Run={id:string;tool:string;status:'running'|'done'|'failed'|'stopped';started:string;ended:string|null;log:string;result:unknown;files:{path:string;name:string;kind:string}[];input:string|null;child?:ChildProcess};
const runs=new Map<string,Run>();
const KINDS:[RegExp,string][]=[[/\.(mp4|mov|webm|mkv)$/i,'video'],[/\.(m4a|mp3|wav|aac|flac)$/i,'audio'],[/\.(png|jpe?g|webp|gif|svg)$/i,'image'],[/\.(srt|vtt|txt|md|json|xml|edl|csv)$/i,'text']];
/** Inside the project (or, from a worktree, the main checkout, where the studio's videos may be). */
const inProject=(abs:string)=>{const main=mainCheckout();return [ROOT,...(main?[main]:[])].some(r=>abs.startsWith(path.resolve(r)+path.sep));};
/** Files the tool made: every path in its answer that is a file inside the project. */
function filesIn(result:unknown,given:Set<string>){
 const found=new Set<string>();
 const walk=(x:unknown)=>{if(typeof x==='string'){if(x.length<400&&/\.[a-z0-9]{2,5}$/i.test(x)){const abs=path.resolve(ROOT,x);if(inProject(abs)&&fs.existsSync(abs)&&fs.statSync(abs).isFile()&&!given.has(abs))found.add(abs);}}
  else if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object')Object.values(x).forEach(walk);};
 walk(result);
 return [...found].slice(0,40).map(f=>({path:path.relative(ROOT,f).split(path.sep).join('/'),name:path.basename(f),kind:KINDS.find(([re])=>re.test(f))?.[1]??'file'}));
}
/** Files picked from Studio come as "gallery:ID" or "library:ID": the tool gets their place on disk. */
async function resolveRefs(values:Values){
 const one=async(x:unknown)=>{
  if(typeof x!=='string')return x;
  const g=/^gallery:([a-f0-9]{16})$/.exec(x);if(g){const G=await import('../engine/gallery.js');return G.galleryFile(g[1]!);}
  const l=/^library:([\w-]+)$/.exec(x);if(l){const L=await import('../engine/my-library.js');const e=L.libraryEntries().find(e=>e.id===l[1]);if(!e)throw new Error('That library file is gone');return e.file;}
  return x;};
 const out:Values={};for(const [k,v] of Object.entries(values))out[k]=Array.isArray(v)?await Promise.all(v.map(one)):await one(v);
 return out;
}
/** What the tools made, kept between visits (Studio shows them as cards). */
type Result={id:string;tool:string;ended:string;input:string|null;files:{path:string;name:string;kind:string}[]};
const resultsFile=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','tools','results.json');
export function results():Result[]{try{return (JSON.parse(fs.readFileSync(resultsFile(),'utf8')) as Result[]).filter(r=>r.files.some(f=>fs.existsSync(path.resolve(ROOT,f.path))));}catch{return [];}}
function keepResult(r:Result){const all=[r,...results().filter(x=>x.id!==r.id)].slice(0,200);fs.mkdirSync(path.dirname(resultsFile()),{recursive:true});fs.writeFileSync(resultsFile(),JSON.stringify(all,null,1)+'\n');}
/** Deletes what a tool made (only its own files), on your say-so. */
export async function deleteResult(id:string){
 const all=results(),r=all.find(x=>x.id===id);if(!r)throw new Error('No such result');
 for(const f of r.files)await fsp.rm(path.resolve(ROOT,f.path),{force:true});
 fs.writeFileSync(resultsFile(),JSON.stringify(all.filter(x=>x.id!==id),null,1)+'\n');
 return {deleted:r.files.map(f=>f.name)};
}
/** Starts a tool with the page's values; it runs on its own and its output is kept to show. */
export async function startRun(tool:string,values:Values){
 const form=FORMS[tool];if(!form)throw new Error('This tool runs from its own page');
 const text=async(name:string,body:string)=>{const dir=inputsDir();await fsp.mkdir(dir,{recursive:true});const f=path.join(dir,randomBytes(4).toString('hex')+'-'+name);await fsp.writeFile(f,body+'\n');return path.relative(ROOT,f).split(path.sep).join('/');};
 const argv=await form.args(await resolveRefs(values),text);
 // What you gave it is not what it made.
 const given=new Set(argv.filter(a=>!a.startsWith('-')).map(a=>path.resolve(ROOT,a)));
 const rel=(f:string)=>path.relative(ROOT,f).split(path.sep).join('/');
 // The first media file it was given, to compare the result with.
 const media0=[...given].find(f=>KINDS.slice(0,3).some(([re])=>re.test(f))),firstMedia=media0?rel(media0):null;
 const r:Run={id:randomBytes(6).toString('hex'),tool,status:'running',started:new Date().toISOString(),ended:null,log:'',result:null,files:[],input:firstMedia};
 runs.set(r.id,r);
 const child=spawn(process.execPath,[path.join(ROOT,'bin','tempoloom.mjs'),...argv],{cwd:ROOT,windowsHide:true,env:{...process.env,FORCE_COLOR:'0'}});
 r.child=child;let out='';
 const add=(b:Buffer)=>{r.log=(r.log+b.toString('utf8')).slice(-200_000);};
 child.stdout.on('data',(b:Buffer)=>{out+=b.toString('utf8');add(b);});child.stderr.on('data',add);
 child.on('close',code=>{
  r.ended=new Date().toISOString();delete r.child;
  try{const i=out.indexOf('{'),j=out.lastIndexOf('}');r.result=i>=0&&j>i?JSON.parse(out.slice(i,j+1)):null;}catch{r.result=null;}
  r.files=filesIn(r.result,given);if(r.status==='running')r.status=code===0?'done':'failed';
  if(r.status==='done'&&r.files.length)try{keepResult({id:r.id,tool:r.tool,ended:r.ended,input:r.input,files:r.files});}catch{/* shown here anyway */}
 });
 child.on('error',e=>{r.status='failed';r.log+=`\n${e.message}`;});
 return view(r);
}
const view=(r:Run)=>({id:r.id,tool:r.tool,status:r.status,started:r.started,ended:r.ended,log:r.log.slice(-20_000),result:r.result,files:r.files,input:r.input});
/** Every run still working (the page tells you when one finishes, wherever you are). */
export const activeRuns=()=>[...runs.values()].filter(r=>r.status==='running').map(r=>({id:r.id,tool:r.tool}));
export function getRun(id:string){const r=runs.get(id);if(!r)throw new Error('No such run');return view(r);}
export function stopRun(id:string){const r=runs.get(id);if(!r)throw new Error('No such run');if(r.child){r.status='stopped';r.child.kill();}return view(r);}
export const recentRuns=(tool:string)=>results().filter(r=>r.tool===tool).slice(0,8);
/** A file a tool made (or was given), to show or download: only inside the project. */
export function runFile(p:string){const abs=path.resolve(ROOT,p);if(!inProject(abs)||!fs.existsSync(abs))throw new Error('Not found');return abs;}
