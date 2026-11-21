// Captions that learn from your corrections.
// 1. Fixes: when you change a caption's words, each changed word or short phrase (up to 4 words) is remembered
//    for that language ("موسڵمانبوونی" -> "موسڵمان بوونی"). The next captions in that language get it at once.
// 2. Hints: the words you corrected to are given to the Sorani Whisper as hotwords, so it listens for them.
// 3. Training clips: each corrected caption's audio and your text are kept in workspace/datasets/captions/<lang>/
//    (metadata.jsonl + WAV), ready for fine-tuning a model later. Nothing leaves this computer.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './config-root.js';
import {normWord,writeWav,type LocalWord} from './local-stt.js';

type Fix={to:string;n:number;last:string};
type Store={version:1;langs:Record<string,Record<string,Fix>>};
const settings=()=>path.resolve(ROOT,process.env.TEMPOLOOM_SETTINGS_DIR||'.tempoloom');
export const fixesFile=()=>path.join(settings(),'caption-fixes.json');
export const datasetDir=()=>path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace','datasets','captions');
export const audioDir=()=>path.join(datasetDir(),'audio');
const langKey=(l?:string|null)=>/^[a-z]{2,3}$/.test(l??'')?l!:'other';

function read():Store{try{const s=JSON.parse(fs.readFileSync(fixesFile(),'utf8')) as Store;return {version:1,langs:s.langs??{}};}catch{return {version:1,langs:{}};}}
function write(s:Store){fs.mkdirSync(path.dirname(fixesFile()),{recursive:true});const tmp=fixesFile()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,1)+'\n');fs.renameSync(tmp,fixesFile());}

const words=(t:string)=>t.trim().split(/\s+/).filter(Boolean);
/** The changed spans between what the model wrote and what you wrote: [model's words (normalised), your words]. */
export function diffPairs(from:string,to:string):[string,string][]{
 const a=words(from),b=words(to),A=a.map(normWord),B=b.map(normWord),n=a.length,m=b.length;
 const d=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)d[i]![j]=A[i]===B[j]?d[i+1]![j+1]!+1:Math.max(d[i+1]![j]!,d[i]![j+1]!);
 const out:[string,string][]=[];let i=0,j=0,i0=0,j0=0;
 const take=()=>{const x=A.slice(i0,i).filter(Boolean),y=b.slice(j0,j).map(w=>w.replace(/^[\p{P}]+|[\p{P}]+$/gu,'')).filter(Boolean);
  // a changed span of 1 to 4 words on each side; pure insertions and deletions are not learned
  if(x.length&&y.length&&x.length<=4&&y.length<=4&&x.join(' ')!==y.map(normWord).join(' '))out.push([x.join(' '),y.join(' ')]);};
 while(i<n&&j<m){if(A[i]===B[j]){take();i++;j++;i0=i;j0=j;}else if(d[i+1]![j]!>=d[i]![j+1]!)i++;else j++;}
 i=n;j=m;take();return out;}

/** Remembers the fixes in one edit. Returns what was learned. */
export function learn(lang:string|null|undefined,from:string,to:string){
 const pairs=diffPairs(from,to);if(!pairs.length)return [];
 const s=read(),k=langKey(lang),L=(s.langs[k]??={}),now=new Date().toISOString();
 for(const [x,y] of pairs){const f=L[x];L[x]=f&&f.to===y?{...f,n:f.n+1,last:now}:{to:y,n:1,last:now};}
 write(s);return pairs.map(([x,y])=>({from:x,to:y}));}

/** Applies the fixes for a language to recognised words (longest phrase first). Times of a replaced span are shared
 *  across its new words; a fixed word keeps the punctuation the model put after it. */
export function applyFixes<W extends LocalWord>(lang:string|null|undefined,ws:W[]):{words:LocalWord[];fixed:number}{
 const L={...read().langs.other,...read().langs[langKey(lang)]};if(!Object.keys(L).length)return {words:ws,fixed:0};
 const out:LocalWord[]=[];let fixed=0;
 for(let i=0;i<ws.length;){let done=false;
  for(let len=4;len>=1&&!done;len--){if(i+len>ws.length)continue;const span=ws.slice(i,i+len),key=span.map(w=>normWord(w.text)).join(' '),f=L[key];if(!f)continue;
   const to=words(f.to),a=span[0]!.start,b=span[len-1]!.end,step=(b-a)/to.length,tail=/[\p{P}]+$/u.exec(span[len-1]!.text)?.[0]??'';
   // fixed words are settled: no second-opinion mark stays on them
   to.forEach((t,k)=>out.push({text:t+(k===to.length-1?tail:''),start:a+k*step,end:a+(k+1)*step}));
   i+=len;fixed++;done=true;}
  if(!done){out.push(ws[i]!);i++;}}
 return {words:out,fixed};}

/** Words to listen for (hotwords): the corrected words, most used first. */
export function hotwords(lang:string|null|undefined,limit=60){
 const L=read().langs[langKey(lang)]??{};const seen=new Set<string>();
 return Object.values(L).sort((a,b)=>b.n-a.n).flatMap(f=>words(f.to)).filter(w=>!seen.has(w)&&seen.add(w)).slice(0,limit).join(' ');}

export function list(){const s=read();return Object.entries(s.langs).flatMap(([lang,L])=>Object.entries(L).map(([from,f])=>({lang,from,...f}))).sort((a,b)=>b.last.localeCompare(a.last));}
export function remove(lang:string,from:string){const s=read();if(s.langs[lang]){delete s.langs[lang]![from];write(s);}return list();}
export function clear(){write({version:1,langs:{}});return list();}

// ---------- training clips ----------
/** Keeps the 16 kHz audio of a captioned file (named by its content) so corrected captions can become training clips. */
export async function keepAudio(samples:Float32Array){
 const id=createHash('sha256').update(Buffer.from(samples.buffer,samples.byteOffset,samples.byteLength)).digest('hex').slice(0,20);
 const file=path.join(audioDir(),id+'.wav');await fsp.mkdir(audioDir(),{recursive:true});
 if(!fs.existsSync(file))await writeWav(file,samples);return id;}
/** Saves one corrected caption as a training clip: its audio (from the kept file) and the text you wrote. */
export async function saveClip(lang:string|null|undefined,audio:{id:string;s:number;e:number},text:string,original:string){
 if(!/^[a-f0-9]{20}$/.test(audio.id))throw new Error('Unknown audio');const src=path.join(audioDir(),audio.id+'.wav');
 const b=await fsp.readFile(src).catch(()=>null);if(!b)return null;
 const sr=b.readUInt32LE(24),pcm=b.subarray(44),a=Math.max(0,Math.floor((audio.s-.15)*sr)),z=Math.min(pcm.length/2,Math.ceil((audio.e+.15)*sr));if(z-a<sr*.3)return null;
 const x=new Float32Array(z-a);for(let i=0;i<x.length;i++)x[i]=pcm.readInt16LE((a+i)*2)/32768;
 const dir=path.join(datasetDir(),langKey(lang)),name=`${audio.id}-${Math.round(audio.s*1000)}.wav`;await fsp.mkdir(dir,{recursive:true});
 await writeWav(path.join(dir,name),x,sr);
 // one line per clip; a later correction of the same clip replaces it when the set is read (last line wins)
 await fsp.appendFile(path.join(dir,'metadata.jsonl'),JSON.stringify({file:name,text:text.trim(),original:original.trim(),seconds:+(x.length/sr).toFixed(2),saved:new Date().toISOString()})+'\n');
 return name;}
export function clipCount(){let n=0;try{for(const d of fs.readdirSync(datasetDir())){if(d==='audio')continue;const f=path.join(datasetDir(),d,'metadata.jsonl');
 if(fs.existsSync(f))n+=new Set(fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>{try{return (JSON.parse(l) as {file:string}).file;}catch{return '';}})).size;}}catch{/* none yet */}return n;}
