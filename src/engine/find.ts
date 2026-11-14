// Find: one search over everything the studio keeps: the videos it made (by their titles, what is
// said in them and how they look), the scenes of motion videos, the lessons, the taught videos (by
// their notes, what their frames show and how they look) and the user's own b-roll shots. Kurdish,
// Arabic and Persian text is matched as written (digits and letter forms evened out).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {ROOT} from './config.js';
import {dbPath} from './brain/db.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';

export const kinds=['video','scene','lesson','taught','clip'] as const;
export type FindKind=typeof kinds[number];
export const KIND_LABEL:Record<FindKind,string>={video:'Video',scene:'Scene',lesson:'Lesson',taught:'Taught video',clip:'Your clip'};
type Field={text:string;weight:number;as:'title'|'says'|'looks'|'notes'|'shows'};
export type Entry={kind:FindKind;id:string;title:string;open:string;file?:string;at?:number;fields:Field[];when:string};
export type Hit={kind:FindKind;id:string;title:string;open:string;file?:string;at?:number;score:number;why:string[];snippet:string;when:string};

// ---------- words ----------
const AR_DIGITS=/[٠-٩]/g,FA_DIGITS=/[۰-۹]/g;
/** One form for each letter and digit: case, Arabic and Persian digits, the Arabic and Kurdish
 *  forms of yeh, kaf and heh, tatweel and short vowel marks. */
export function normal(s:string){
 return s.normalize('NFKC').toLowerCase().replace(AR_DIGITS,d=>String(d.charCodeAt(0)-0x660)).replace(FA_DIGITS,d=>String(d.charCodeAt(0)-0x6f0))
  .replace(/[ىيێ]/g,'ی').replace(/ك/g,'ک').replace(/[ةۀ]/g,'ه').replace(/[أإآ]/g,'ا').replace(/ـ/g,'').replace(/[ً-ْٰ]/g,'');
}
const STOP=new Set('a an the and or of to in on at for with is are was be it this that my me i you your our we video videos clip clips one some any'.split(' '));
const stem=(w:string)=>/^[a-z]+$/.test(w)&&w.length>4?w.replace(/(ings|ing|ed|es|s|ly)$/,''):w;
export const words=(s:string)=>normal(s).split(/[^\p{L}\p{N}]+/u).filter(w=>w&&!STOP.has(w)).map(stem);

// ---------- how a video looks ----------
const COLOURS:[string,number][]=[['red',0],['orange',30],['yellow',55],['green',120],['teal',175],['blue',220],['purple',275],['pink',320],['red',360]];
/** Colour names for an RGB pixel (null when it has too little colour to name). */
function colourName(r:number,g:number,b:number){
 const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/510,s=mx===mn?0:(mx-mn)/(255-Math.abs(mx+mn-255));
 if(s<.18||mx<40)return l<.2?'black':l>.85?'white':'grey';
 let h=0;if(mx===r)h=((g-b)/(mx-mn)+6)%6*60;else if(mx===g)h=((b-r)/(mx-mn)+2)*60;else h=((r-g)/(mx-mn)+4)*60;
 let best=COLOURS[0]!;for(const c of COLOURS)if(Math.abs(c[1]-h)<Math.abs(best[1]-h))best=c;
 return l<.25&&best[0]==='orange'?'brown':best[0];
}
/** Words for how a picture looks: its main colours, dark or bright, colourful or muted. */
export function looksOf(pixels:Uint8Array|Buffer){
 const count=new Map<string,number>();let lum=0,sat=0,n=0;
 for(let i=0;i+2<pixels.length;i+=3){const r=pixels[i]!,g=pixels[i+1]!,b=pixels[i+2]!,c=colourName(r,g,b);count.set(c,(count.get(c)??0)+1);
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);lum+=(.299*r+.587*g+.114*b)/255;sat+=mx?(mx-mn)/mx:0;n++;}
 if(!n)return [] as string[];
 const main=[...count].sort((a,b)=>b[1]-a[1]).filter(([,c])=>c/n>=.12).slice(0,3).map(([k])=>k);
 return [...main,lum/n<.3?'dark':lum/n>.65?'bright':null,sat/n>.45?'colourful colorful':sat/n<.15?'muted':null].filter((x):x is string=>!!x);
}
const shapeWords=(w?:number|null,h?:number|null)=>!w||!h?[]:w>h*1.1?['wide','horizontal','landscape']:h>w*1.1?['vertical','tall','portrait']:['square'];
const lengthWords=(s?:number|null)=>s==null?[]:s<=20?['short']:s<=90?['medium']:['long'];
const looksCache=()=>path.join(path.dirname(dbPath()),'find-looks.json');
let looksMemo:Record<string,string[]>|null=null;
const readLooks=()=>{if(looksMemo)return looksMemo;try{looksMemo=JSON.parse(fs.readFileSync(looksCache(),'utf8'));}catch{looksMemo={};}return looksMemo!;};
const saveLooks=()=>{try{fs.mkdirSync(path.dirname(looksCache()),{recursive:true});fs.writeFileSync(looksCache(),JSON.stringify(looksMemo));}catch{/* a cache */}};
const grab=(file:string,at:number)=>new Promise<Buffer>((resolve)=>{const c=spawn(ffmpeg,['-v','error','-ss',at.toFixed(2),'-i',file,'-frames:v','1','-vf','scale=32:18','-f','rawvideo','-pix_fmt','rgb24','-'],{windowsHide:true});
 const out:Buffer[]=[];c.stdout.on('data',d=>out.push(d));c.on('error',()=>resolve(Buffer.alloc(0)));c.on('close',()=>resolve(Buffer.concat(out)));});
/** How a video file looks (three frames), worked out once per file version and remembered. */
export async function videoLooks(file:string,seconds:number|null){
 let st:fs.Stats;try{st=fs.statSync(file);}catch{return [];}
 const key=createHash('sha1').update(`${path.resolve(file)}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0,16),memo=readLooks();
 if(memo[key])return memo[key]!;
 const d=seconds&&seconds>0?seconds:2,frames=await Promise.all([.15,.5,.85].map(p=>grab(file,d*p)));
 const out=looksOf(Buffer.concat(frames));memo[key]=out;return out;
}

// ---------- what there is ----------
/** Everything search looks through, read fresh each time (videos' looks are remembered). */
/** What each file says, from transcripts already made and edits by text (search itself never runs
 *  speech to text; `find listen` does, when asked). */
export async function spoken(){
 const said=new Map<string,string>();
 try{const dir=path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','transcripts');
  for(const n of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))){try{const t=JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')) as {source?:string;text?:string};if(t.source&&t.text)said.set(path.resolve(t.source),t.text);}catch{/* skip */}}}catch{/* none */}
 const {docs}=await import('../editor/text-edit.js').catch(()=>({docs:()=>[] as never[]}));
 const edits=(()=>{try{return docs();}catch{return [];}})();
 for(const d of edits){const text=d.sentences.map(s=>s.text).join(' ');said.set(path.resolve(d.input),text);for(const r of d.renders)said.set(path.resolve(r.output),text);}
 return said;
}
export async function entries(o:{looks?:boolean}={}):Promise<Entry[]>{
 const out:Entry[]=[],said=await spoken(),pics=readPictures();
 // Videos the studio made.
 const G=await import('./gallery.js'),g=await G.gallery();let changed=false;
 for(const i of g.items){const abs=path.resolve(ROOT,i.file),key=Object.keys(readLooks()).length;
  const look=o.looks===false?[]:await videoLooks(abs,i.seconds);if(Object.keys(readLooks()).length!==key)changed=true;
  out.push({kind:'video',id:i.id,title:i.title,open:'#/studio/gallery/'+i.id,file:i.file,when:i.made,fields:[
   {text:i.title+' '+i.name.replace(/[-_.]+/g,' '),weight:3,as:'title'},{text:said.get(abs)??'',weight:1.5,as:'says'},
   {text:[...look,...shapeWords(i.width,i.height),...lengthWords(i.seconds),i.category,...i.tags,i.mode==='edit'?'edit footage':'motion animation',i.kind].join(' '),weight:1.2,as:'looks'},
   {text:pics[i.id]?.text??'',weight:2,as:'shows'}]});}
 if(changed)saveLooks();
 // The scenes of motion videos.
 try{const {studioRoot,readPlan}=await import('./studio.js'),{projectScenes}=await import('./studio-versions.js');
  for(const n of fs.readdirSync(studioRoot())){let p;try{p=readPlan(n);}catch{continue;}const ps=projectScenes(p.videoJob);if(!ps)continue;
   for(const [k,s] of ps.entries())out.push({kind:'scene',id:`${p.job}#${k+1}`,title:`${p.title}, scene ${k+1}`,open:'#/studio/videos/'+encodeURIComponent(p.job),at:s.start,when:p.updated,
    fields:[{text:s.text,weight:2,as:'says'},{text:p.title,weight:1,as:'title'},{text:JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k2])=>/piece|kind|type|layout|look|style|visual|motion/i.test(k2)))).replace(/[{}"[\]:,]/g,' '),weight:1,as:'looks'}]});}}catch{/* no studio yet */}
 // Lessons.
 const {allKnowledge}=await import('./brain/db.js');
 for(const k of allKnowledge().filter(k=>k.status!=='rejected'&&k.kind!=='tool'))out.push({kind:'lesson',id:k.id,title:k.title,open:'#/teach/lessons/'+encodeURIComponent(k.id),when:k.updated,
  fields:[{text:k.title,weight:3,as:'title'},{text:k.body,weight:1.5,as:'notes'},{text:k.tags.join(' ')+' '+k.domain+' '+k.kind,weight:1,as:'looks'}]});
 // Taught videos.
 try{const T=await import('./teach/teach.js');
  for(const v of T.videos()){const m=v.measured,look=m?[...new Set(m.color.palette.slice(0,4).map(p=>{const h=p.hex.replace('#','');return colourName(parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16));}))]:[];
   out.push({kind:'taught',id:v.id,title:v.title,open:'#/teach/library/'+encodeURIComponent(v.id),when:v.updated,fields:[{text:v.title+' '+v.source.name,weight:3,as:'title'},
    {text:[v.prompt,...v.marks.map(x=>x.note),v.verdict==='good'?'good example':'bad example',...v.topics].join(' '),weight:1.5,as:'notes'},
    {text:[...v.sheets.map(s=>s.shows),...look,...(m?[m.color.brightness<.3?'dark':m.color.brightness>.65?'bright':'',...shapeWords(m.media.width,m.media.height),...lengthWords(m.media.seconds),m.pacing.cutsPerMinute>30?'fast cuts':m.pacing.cutsPerMinute<8?'slow calm':'']:[])].join(' '),weight:1.2,as:'looks'}]});}}catch{/* none */}
 // The user's own clips, shot by shot.
 try{const {library}=await import('../editor/broll.js');
  for(const c of library())for(const s of c.shots)out.push({kind:'clip',id:`${c.id}#${s.n}`,title:`${c.name}, shot ${s.n}`,open:'#/studio/text',file:c.file,at:s.start,when:c.added,
   fields:[{text:s.description,weight:2,as:'looks'},{text:c.name,weight:1,as:'title'}]});}catch{/* none */}
 return out;
}

// ---------- search ----------
const snippetOf=(text:string,q:string[])=>{const t=text.replace(/\s+/g,' ').trim();if(!t)return '';const n=normal(t);let at=-1;
 for(const w of q){const i=n.indexOf(w);if(i>=0&&(at<0||i<at))at=i;}
 if(at<0)return t.slice(0,140);const from=Math.max(0,at-50);return (from?'…':'')+t.slice(from,from+150).trim()+(from+150<t.length?'…':'');};
const WHY:Record<Field['as'],string>={title:'in its title',says:'in what it says',looks:'in how it looks',notes:'in its notes',shows:'in what it shows'};
/** The best matches for what the user typed: every word counts, rare words more, a word's start
 *  matches ("cam" finds "camera"), and the whole phrase together counts most. */
export async function find(query:string,o:{kinds?:FindKind[];limit?:number;looks?:boolean}={}){
 const q=[...new Set(words(query))];if(!q.length)return {query,hits:[] as Hit[],counts:{} as Record<FindKind,number>};
 const all=(await entries({looks:o.looks})).filter(e=>!o.kinds?.length||o.kinds.includes(e.kind));
 const tok=all.map(e=>e.fields.map(f=>words(f.text)));
 const df=new Map<string,number>();for(const fs2 of tok){const seen=new Set(fs2.flat());for(const w of seen)df.set(w,(df.get(w)??0)+1);}
 const idf=(w:string)=>Math.log(1+(all.length+1)/(1+(df.get(w)??0)));
 const phrase=normal(query).replace(/\s+/g,' ').trim();
 const hits:Hit[]=[];
 all.forEach((e,i)=>{let score=0,matched=0;const why=new Set<string>();let best:Field|null=null,bestScore=0;
  for(const w of q){let wScore=0;
   e.fields.forEach((f,k)=>{const ws=tok[i]![k]!;const exact=ws.filter(x=>x===w).length,pre=w.length>=3?ws.filter(x=>x!==w&&x.startsWith(w)).length:0;
    if(!exact&&!pre)return;const s=f.weight*(Math.min(3,exact)+.6*Math.min(3,pre))*idf(w)/Math.sqrt(1+ws.length/40);
    wScore+=s;why.add(WHY[f.as]);if(f.as!=='title'&&s>bestScore){bestScore=s;best=f;}});
   if(wScore>0)matched++;score+=wScore;}
  if(!matched)return;
  // Every word should be there; a hit missing some still shows, lower.
  score*=matched/q.length;if(matched===q.length&&q.length>1)score*=1.5;
  if(phrase.length>3&&e.fields.some(f=>normal(f.text).includes(phrase)))score*=1.6;
  hits.push({kind:e.kind,id:e.id,title:e.title,open:e.open,...(e.file?{file:e.file}:{}),...(e.at!==undefined?{at:e.at}:{}),score:+score.toFixed(3),why:[...why],
   snippet:best?snippetOf((best as Field).text,q):'',when:e.when});});
 hits.sort((a,b)=>b.score-a.score||b.when.localeCompare(a.when));
 const counts=Object.fromEntries(kinds.map(k=>[k,hits.filter(h=>h.kind===k).length])) as Record<FindKind,number>;
 return {query,hits:hits.slice(0,o.limit??40),counts};
}

// ---------- what a video shows (written by the agent or the user after looking at its frames) ----------
type Picture={text:string;by:'you'|'agent';at:string;bytes:number};
const picturesFile=()=>path.join(path.dirname(dbPath()),'find-pictures.json');
export function readPictures():Record<string,Picture>{try{return JSON.parse(fs.readFileSync(picturesFile(),'utf8'));}catch{return {};}}
/** Says what a gallery video shows (people, places, objects, what happens), so search finds it. */
export async function describe(id:string,text:string,by:'you'|'agent'='you'){
 const t=text.replace(/\s+/g,' ').trim();if(t.length>1200)throw new Error('Keep it under 1200 characters');
 const G=await import('./gallery.js'),i=(await G.gallery({hidden:true})).items.find(x=>x.id===id);if(!i)throw new Error('No such video in the gallery');
 const all=readPictures();if(t)all[id]={text:t,by,at:new Date().toISOString(),bytes:i.bytes};else delete all[id];
 fs.mkdirSync(path.dirname(picturesFile()),{recursive:true});fs.writeFileSync(picturesFile(),JSON.stringify(all,null,1)+'\n');
 return {id,title:i.title,shows:t||null,by};
}
/** One sheet of six frames of a video, to look at before saying what it shows. Made once. */
export async function frameSheet(id:string){
 const G=await import('./gallery.js'),i=(await G.gallery({hidden:true})).items.find(x=>x.id===id);if(!i)throw new Error('No such video in the gallery');
 const dir=path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','cache','find-sheets');fs.mkdirSync(dir,{recursive:true});
 const f=path.join(dir,`${id}-${i.bytes}.jpg`);if(fs.existsSync(f))return f;
 const d=i.seconds&&i.seconds>0?i.seconds:6,{run}=await import('../renderer/ffmpeg-encoder.js');
 await run(ffmpeg,['-v','error','-y','-i',path.resolve(ROOT,i.file),'-vf',`fps=${(6/d).toFixed(5)},scale=360:-2,tile=3x2:padding=6:color=black`,'-frames:v','1','-q:v','4',f]);
 return f;
}
/** Videos nobody has said what they show yet, each with its frame sheet to look at. */
export async function unseen(o:{limit?:number}={}){
 const G=await import('./gallery.js'),pics=readPictures(),items=(await G.gallery()).items.filter(i=>!pics[i.id]);
 const out:{id:string;title:string;file:string;sheet:string}[]=[];
 for(const i of items.slice(0,o.limit??12))out.push({id:i.id,title:i.title,file:i.file,sheet:await frameSheet(i.id)});
 return {count:items.length,videos:out,next:'Look at each sheet, then: pnpm tempoloom find describe ID "what it shows" --agent (people, places, objects, what happens; in the video\'s language or English).'};
}

// ---------- what a video says, made when asked (speech to text costs money) ----------
export const LISTEN_USD_PER_HOUR=.2; // ElevenLabs Scribe v2, checked 2026-11-14
/** Gallery videos with sound but no words yet, what writing their words would cost, and (when
 *  `go`) writing them, within the budgets. */
export async function listen(o:{go?:boolean;approved?:boolean;limit?:number}={}){
 const G=await import('./gallery.js'),said=await spoken(),{transcribe,hasApiKey}=await import('./transcribe.js'),{inspect}=await import('./teach/measure.js');
 const todo:{id:string;title:string;file:string;seconds:number}[]=[];
 for(const i of (await G.gallery()).items){const abs=path.resolve(ROOT,i.file);if(said.has(abs))continue;
  const m=await inspect(abs).catch(()=>null);if(!m||!(m as {audio?:boolean}).audio)continue;todo.push({id:i.id,title:i.title,file:i.file,seconds:m.seconds});
  if(todo.length>=(o.limit??50))break;}
 const seconds=todo.reduce((t,x)=>t+x.seconds,0),usd=+(seconds/3600*LISTEN_USD_PER_HOUR).toFixed(4);
 const {allow,record}=await import('./models/spend.js'),verdict=allow(usd,{approved:o.approved});
 const plan={videos:todo.length,minutes:+(seconds/60).toFixed(1),usd,verdict};
 if(!o.go||!todo.length)return {...plan,done:0,next:todo.length?`Writes the words of ${todo.length} video${todo.length>1?'s':''} (${plan.minutes} min) with ElevenLabs for about $${usd.toFixed(2)}: pnpm tempoloom find listen --go`:'Every video with sound has its words already.'};
 if(!hasApiKey())throw new Error('Add your ElevenLabs key in Settings first (it writes the words).');
 if(!verdict.ok)throw new Error(verdict.why+(verdict.ask?' Run it again with --yes to go ahead.':''));
 let done=0;const failed:string[]=[];
 for(const v of todo){try{const t=await transcribe(path.resolve(ROOT,v.file));if(!t.cached)record({usd:v.seconds/3600*LISTEN_USD_PER_HOUR,what:'Words of '+v.title+' for search',service:'elevenlabs'});done++;}catch(e){failed.push(`${v.title}: ${(e as Error).message.slice(0,140)}`);}}
 return {...plan,done,failed};
}
