// Speech to text on this computer, for captions: Meta's Omnilingual ASR (1,600+ languages, Central Kurdish
// (Sorani), Northern Kurdish and Arabic-script Kurdish among them; Apache 2.0), run by sherpa-onnx (Apache 2.0).
// No key and no upload. The model is downloaded once (`captions setup`). The model listens to at most 40 s at a
// time, so longer audio is cut at pauses; word times come from the timestamps of the model's tokens.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {ROOT} from './config-root.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';

const run=promisify(execFile);
const RELEASES='https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/';
export const LOCAL_MODELS={
 '1b':{name:'sherpa-onnx-omnilingual-asr-1600-languages-1B-ctc-v2-int8-2026-02-05',mb:751,label:'Omnilingual ASR 1B v2 (more accurate)'},
 '300m':{name:'sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-v2-int8-2026-02-05',mb:279,label:'Omnilingual ASR 300M v2 (lighter)'},
} as const;
export type LocalModel=keyof typeof LOCAL_MODELS;
export const DEFAULT_LOCAL_MODEL:LocalModel='1b';
const SR=16000,MAX_CHUNK=28,MIN_CHUNK=8;

/** Models live with the other speech models: VIDEO_MODEL_DIR, else workspace/cache/audio-models. */
export const modelRoot=()=>path.resolve(process.env.VIDEO_MODEL_DIR||path.join(ROOT,'workspace','cache','audio-models'),'omnilingual-asr');
const dirOf=(m:LocalModel)=>path.join(modelRoot(),LOCAL_MODELS[m].name);
function modelFiles(m:LocalModel):{model:string;tokens:string}|null{
 const d=dirOf(m);let list:string[];try{list=fs.readdirSync(d);}catch{return null;}
 const onnx=list.find(f=>/\.int8\.onnx$/.test(f))??list.find(f=>f.endsWith('.onnx'));
 return onnx&&list.includes('tokens.txt')?{model:path.join(d,onnx),tokens:path.join(d,'tokens.txt')}:null;}
export const installed=(m?:LocalModel)=>m?!!modelFiles(m):(Object.keys(LOCAL_MODELS) as LocalModel[]).some(x=>!!modelFiles(x));
/** The model to use: the one asked for, else the more accurate one that is installed. */
export const pick=(m?:LocalModel):LocalModel|null=>m?(installed(m)?m:null):installed('1b')?'1b':installed('300m')?'300m':null;
// The part of sherpa-onnx-node used here (the package ships JavaScript without type declarations).
type Stream={acceptWaveform(o:{samples:Float32Array;sampleRate:number}):void};
type Recognizer={createStream():Stream;decodeAsync(s:Stream):Promise<void>;getResult(s:Stream):unknown};
type Sherpa={OfflineRecognizer:{createAsync(config:unknown):Promise<Recognizer>}};
function runtime():Sherpa|null{try{return createRequire(import.meta.url)('sherpa-onnx-node') as Sherpa;}catch{return null;}}

// ---------- setup: download and unpack once ----------
type Progress={model:LocalModel;state:'downloading'|'unpacking'|'done'|'error';bytes:number;total:number;error?:string};
let progress:Progress|null=null;
export function status(){return {runtime:!!runtime(),root:modelRoot(),progress,
 models:(Object.entries(LOCAL_MODELS) as [LocalModel,typeof LOCAL_MODELS[LocalModel]][]).map(([id,m])=>({id,label:m.label,mb:m.mb,installed:installed(id)})),default:DEFAULT_LOCAL_MODEL};}
/** Downloads (about 751 MB for 1B, 279 MB for 300M) and unpacks the model. Safe to call again: it stops at once if installed. */
export async function setup(m:LocalModel=DEFAULT_LOCAL_MODEL,o:{fetcher?:typeof fetch;onProgress?:(p:Progress)=>void}={}){
 if(installed(m))return status();
 if(progress&&(progress.state==='downloading'||progress.state==='unpacking'))throw new Error('A model is already being set up');
 const {name}=LOCAL_MODELS[m],root=modelRoot(),archive=path.join(root,name+'.tar.bz2'),part=archive+'.part';
 await fsp.mkdir(root,{recursive:true});
 progress={model:m,state:'downloading',bytes:0,total:LOCAL_MODELS[m].mb*1048576};const tell=()=>o.onProgress?.(progress!);
 try{
  const res=await (o.fetcher??fetch)(RELEASES+name+'.tar.bz2',{redirect:'follow'});
  if(!res.ok||!res.body)throw new Error(`Download failed (${res.status})`);
  progress.total=Number(res.headers.get('content-length'))||progress.total;
  const out=fs.createWriteStream(part);let last=0;
  for await(const chunk of res.body as unknown as AsyncIterable<Uint8Array>){progress.bytes+=chunk.length;if(!out.write(chunk))await new Promise<void>(r=>out.once('drain',()=>r()));if(progress.bytes-last>8<<20){last=progress.bytes;tell();}}
  await new Promise<void>((res2,rej)=>out.end((e?:Error|null)=>e?rej(e):res2()));
  const size=(await fsp.stat(part)).size;if(res.headers.get('content-length')&&size!==Number(res.headers.get('content-length')))throw new Error('The download was incomplete; try again');
  await fsp.rename(part,archive);
  progress.state='unpacking';tell();
  // bzip2 tar: Windows 10+ ships bsdtar in System32 (it reads .tar.bz2); elsewhere the system tar does.
  const tar=process.platform==='win32'&&process.env.SystemRoot?path.join(process.env.SystemRoot,'System32','tar.exe'):'tar';
  await run(tar,['-xjf',archive,'-C',root],{windowsHide:true,maxBuffer:1<<24});
  await fsp.rm(archive,{force:true});
  if(!installed(m))throw new Error('The model files were not found after unpacking');
  progress.state='done';tell();return status();
 }catch(e){progress={...progress!,state:'error',error:(e as Error).message};tell();await fsp.rm(part,{force:true}).catch(()=>{});throw e;}
}

// ---------- transcription ----------
export type LocalWord={text:string;start:number;end:number};
const recognizers=new Map<LocalModel,Promise<Recognizer>>();
function recognizer(m:LocalModel):Promise<Recognizer>{
 const have=recognizers.get(m);if(have)return have;
 const S=runtime();if(!S)throw new Error('The speech runtime (sherpa-onnx-node) is not installed; run pnpm install');
 const f=modelFiles(m);if(!f)throw new Error('The captions model is not set up yet (one download, about '+LOCAL_MODELS[m].mb+' MB)');
 const r=S.OfflineRecognizer.createAsync({featConfig:{sampleRate:SR,featureDim:80},
  modelConfig:{omnilingual:{model:f.model},tokens:f.tokens,numThreads:Math.max(1,Math.min(8,os.cpus().length-1)),provider:'cpu',debug:0}});
 recognizers.set(m,r);r.catch(()=>recognizers.delete(m));return r;}

/** Mono 16 kHz samples of any audio or video file (ffmpeg). */
export async function decode(file:string):Promise<Float32Array>{
 const {stdout}=await run(ffmpeg,['-v','error','-i',file,'-vn','-ac','1','-ar',String(SR),'-f','f32le','pipe:1'],{encoding:'buffer',maxBuffer:2**31-1,windowsHide:true});
 const b=stdout as unknown as Buffer;return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.length-(b.length%4)));}

/** Where to cut: pieces of at most MAX_CHUNK seconds, each cut at the quietest 0.2 s between MIN_CHUNK and MAX_CHUNK. */
export function cutAtPauses(x:Float32Array,sr=SR,max=MAX_CHUNK,min=MIN_CHUNK):[number,number][]{
 const hop=Math.round(sr*.01),n=Math.ceil(x.length/hop),e=new Float32Array(n);
 for(let i=0;i<n;i++){let z=0;const a=i*hop,b=Math.min(x.length,a+hop);for(let j=a;j<b;j++)z+=x[j]!*x[j]!;e[i]=z/Math.max(1,b-a);}
 const sm=new Float32Array(n);let acc=0;for(let i=0;i<n;i++){acc+=e[i]!;if(i>=20)acc-=e[i-20]!;sm[i]=acc;}// energy over the last 0.2 s
 const out:[number,number][]=[];let s=0;const total=x.length/sr;
 while(s<total-.05){if(total-s<=max){out.push([s,total]);break;}
  const a=Math.floor((s+min)*100),b=Math.floor((s+max)*100);let best=b,bv=Infinity;for(let i=a;i<=b&&i<n;i++)if(sm[i]!<bv){bv=sm[i]!;best=i;}
  const cut=Math.max(s+min,best/100-.1);out.push([s,cut]);s=cut;}
 return out;}
const rms=(x:Float32Array)=>{let z=0;for(let i=0;i<x.length;i++)z+=x[i]!*x[i]!;return Math.sqrt(z/Math.max(1,x.length));};

/** Scripts written without spaces between words: each character is its own timed unit there. */
const NO_SPACE=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u;
/** Words with times from tokens. Omnilingual's tokens are characters with a space token between words; other
 *  models use SentencePiece pieces where "▁" starts a word. Both work. A word ends where the space after it is. */
export function wordsFromTokens(tokens:string[],stamps:number[],offset:number,end:number):LocalWord[]{
 const out:LocalWord[]=[];let cur:{text:string;start:number;last:number}|null=null;
 const close=(at:number)=>{if(cur&&cur.text.trim())out.push({text:cur.text,start:cur.start,end:Math.max(cur.start+.08,Math.min(at,end))});cur=null;};
 tokens.forEach((t,i)=>{const s=offset+(stamps[i]??0);
  if(!t.trim()){close(s);return;}
  if(t.startsWith('▁'))close(s);
  const txt=t.replace(/▁/g,'');if(!txt)return;
  if(NO_SPACE.test(txt)){close(s);out.push({text:txt,start:s,end:Math.min(end,offset+(stamps[i+1]??(stamps[i]!+.25)))});return;}
  if(!cur)cur={text:'',start:s,last:s};cur.text+=txt;cur.last=s;});
 if(cur)close((cur as {last:number}).last+.25);
 // a no-space character that was followed by a space-script word ends where that word starts
 return out.map((w,i)=>({...w,end:Math.max(w.start+.05,Math.min(w.end,out[i+1]?.start??w.end))}));}

/** A guess at the language code from the script and its letters (the model itself does not say). */
export function guessCode(text:string):string|null{
 if(/[ەڕێۆڵ]/.test(text))return 'ckb';
 if(/\p{Script=Arabic}/u.test(text))return /[پچژگک‌ی]/.test(text)&&!/[ةىي]/.test(text)?'fa':'ar';
 return null;}

/** Transcribes a file on this computer. Any spoken language; the language is found by the model. */
export async function transcribeLocal(file:string,o:{model?:LocalModel;onProgress?:(done:number,total:number)=>void}={}){
 const m=pick(o.model);if(!m)throw new Error('Captions on this computer need a one-time setup: the speech model is not downloaded yet');
 const rec=await recognizer(m),x=await decode(file),chunks=cutAtPauses(x),words:LocalWord[]=[];let text='';
 for(let k=0;k<chunks.length;k++){const [a,b]=chunks[k]!,seg=x.subarray(Math.floor(a*SR),Math.floor(b*SR));o.onProgress?.(k,chunks.length);
  if(rms(seg)<.003)continue;// silence
  const stream=rec.createStream();stream.acceptWaveform({samples:seg,sampleRate:SR});await rec.decodeAsync(stream);
  const r=rec.getResult(stream) as {text?:string;tokens?:string[];timestamps?:number[]};const t=(r.text??'').trim();if(!t)continue;
  text+=(text?' ':'')+t;
  if(r.tokens?.length&&r.timestamps?.length===r.tokens.length)words.push(...wordsFromTokens(r.tokens,r.timestamps,a,b));
  else{const ws=t.split(/\s+/),d=(b-a)/ws.length;ws.forEach((w,i)=>words.push({text:w,start:a+i*d,end:a+(i+1)*d}));}}
 o.onProgress?.(chunks.length,chunks.length);
 return {engine:'omnilingual' as const,model:m,code:guessCode(text),text,words,seconds:x.length/SR};}

// ---------- Kurdish Sorani: a second model, and the two combined ----------
// The project's Sorani-trained Whisper (rzgar/whisper-large-v3-sorani-kurdish-ckb-v2, set up by `audio:setup`)
// makes different mistakes from Omnilingual and writes punctuation. Both run; where they agree the word stays,
// where they differ Whisper's version is taken only when it is confident.
const audioModels=()=>path.resolve(process.env.VIDEO_MODEL_DIR||path.join(ROOT,'workspace','cache','audio-models'));
export function soraniAvailable(){try{return fs.readdirSync(path.join(audioModels(),'installed')).some(f=>/sorani.*-ct2\.json$/i.test(f));}catch{return false;}}
export type ConfWord=LocalWord&{confidence?:number};
/** Writes mono 16 kHz samples as a 16-bit WAV. */
export async function writeWav(file:string,x:Float32Array,sr=SR){
 const b=Buffer.alloc(44+x.length*2);b.write('RIFF',0);b.writeUInt32LE(36+x.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(x.length*2,40);
 for(let i=0;i<x.length;i++)b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(x[i]!*32767))),44+i*2);await fsp.writeFile(file,b);}
/** The Sorani Whisper on a 16 kHz WAV: on the graphics card when it fits (int8/float16), else the processor. */
export async function transcribeSorani(wav:string,o:{hotwords?:string}={}):Promise<{words:ConfWord[];device:string}>{
 const {runAudioPython}=await import('./audio-analysis.js'),out=wav.replace(/\.wav$/i,'')+'-whisper.json';
 const base=['transcribe','--audio',wav,'--output',out,'--cache',audioModels(),...(o.hotwords?['--hotwords',o.hotwords]:[])];
 let res:unknown;try{res=await runAudioPython([...base,'--device','cuda','--compute-type','int8_float16'],30*60*1000);}catch{res=await runAudioPython([...base,'--device','cpu'],60*60*1000);}
 const j=JSON.parse(await fsp.readFile(out,'utf8')) as {words:ConfWord[];backend:{device:string}};await fsp.rm(out,{force:true});void res;
 return {words:j.words.filter(w=>w.text&&Number.isFinite(w.start)&&Number.isFinite(w.end)),device:j.backend.device};}

/** A word for comparing: no punctuation, the same Kurdish/Arabic letter forms, no joiners or vowel marks. */
export const normWord=(s:string)=>s.normalize('NFC').replace(/[\p{P}\p{S}]/gu,'').replace(/[ىي]/g,'ی').replace(/ك/g,'ک').replace(/ة/g,'ە').replace(/[\u200c\u200d\u064B-\u065F\u0670]/g,'').toLowerCase();
function lcs(a:string[],b:string[]):[number,number][]{
 const n=a.length,m=b.length,d=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)d[i]![j]=a[i]===b[j]?d[i+1]![j+1]!+1:Math.max(d[i+1]![j]!,d[i]![j+1]!);
 const out:[number,number][]=[];let i=0,j=0;while(i<n&&j<m){if(a[i]===b[j]){out.push([i,j]);i++;j++;}else if(d[i+1]![j]!>=d[i]![j+1]!)i++;else j++;}return out;}
/** A second opinion: Omnilingual's words, with the places where the Sorani Whisper heard something else marked.
 *  Measured on 8 AsoSoft Sorani sentences, letting Whisper's confidence decide made the text worse (Whisper is often
 *  sure and wrong), so nothing is changed: a disagreement puts `alt` (Whisper's words) on the first word of the
 *  span and `altSpan` (how many words it would replace) for the person to check. */
export function secondOpinion(om:LocalWord[],wh:ConfWord[]):{words:(LocalWord&{alt?:string;altSpan?:number})[];flags:number}{
 const out:(LocalWord&{alt?:string;altSpan?:number})[]=om.map(w=>({...w}));if(!wh.length)return {words:out,flags:0};let flags=0,jw=0;
 for(let s=0;s<om.length;){
  const e=Math.min(om.length,s+300),cut=e<om.length?om[e-1]!.end:Infinity;
  let jb=jw;while(jb<wh.length&&(wh[jb]!.start+wh[jb]!.end)/2<cut)jb++;
  const A=om.slice(s,e),B=wh.slice(jw,jb),pairs=lcs(A.map(w=>normWord(w.text)),B.map(w=>normWord(w.text)));
  let i0=0,j0=0;
  const mark=(i1:number,j1:number)=>{if(i1>i0&&j1>j0){const alt=B.slice(j0,j1).map(w=>w.text).join(' ');const w=out[s+i0]!;w.alt=alt.replace(/[.،,؟?!]+$/,'');w.altSpan=i1-i0;flags++;}};
  for(const [i,j] of pairs){mark(i,j);i0=i+1;j0=j+1;}mark(A.length,B.length);
  s=e;jw=jb;}
 return {words:out,flags};}

/** Captions on this computer: Omnilingual for every language. For Kurdish Sorani the Sorani Whisper also listens
 *  (unless `sorani` is false or it is not set up) and marks the words it heard differently. engine "whisper" uses the
 *  Sorani Whisper alone. `keepWav` keeps the 16 kHz audio (for learning from corrections). */
export async function transcribeBest(file:string,o:{sorani?:boolean;engine?:'omnilingual'|'whisper';hotwords?:string;keepWav?:string;model?:LocalModel}={}){
 const x=await decode(file),wav=o.keepWav??path.join(os.tmpdir(),'tl-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.wav');
 const needWav=o.engine==='whisper'||!!o.keepWav||(o.sorani!==false&&soraniAvailable());if(needWav)await writeWav(wav,x);
 try{
  if(o.engine==='whisper'){if(!soraniAvailable())throw new Error('The Sorani Whisper model is not set up (pnpm audio:setup)');
   const w=await transcribeSorani(wav,{hotwords:o.hotwords});return {engine:'whisper' as const,code:'ckb',text:w.words.map(v=>v.text).join(' '),words:w.words.map(({text,start,end})=>({text,start,end})),seconds:x.length/SR,engines:['sorani-whisper:'+w.device],flags:0};}
  const r=await transcribeLocal(file,{model:o.model});
  if(!(o.sorani!==false&&r.code==='ckb'&&soraniAvailable()))return {...r,engines:['omnilingual'],flags:0};
  const w=await transcribeSorani(wav,{hotwords:o.hotwords}),c=secondOpinion(r.words,w.words);
  return {...r,words:c.words,engines:['omnilingual','sorani-whisper:'+w.device],flags:c.flags};
 }finally{if(!o.keepWav&&needWav)await fsp.rm(wav,{force:true}).catch(()=>{});}}
