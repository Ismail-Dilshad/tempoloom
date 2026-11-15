// Renders caption overlays with Chromium so right-to-left scripts are shaped by the
// browser (HarfBuzz), exactly like the motion renderer. Each cue becomes a transparent
// full-frame PNG that FFmpeg overlays during the cue's time range.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,type Browser} from 'playwright';
import {ROOT,LATIN_FALLBACK} from '../engine/config.js';
import {resolveLanguage,htmlLanguage,isRtl} from '../engine/languages.js';
import {defaultFontPath,resolveFontPreset} from '../engine/font-catalog.js';
import {fontCoverage} from '../engine/text-shaper.js';
import {chromiumExecutable} from '../renderer/browser-path.js';
import type {Cue,Operation} from './edl.js';

type CaptionStyle=Extract<Operation,{op:'captions'}>;

async function launch():Promise<Browser>{
 let executablePath:string|undefined;try{executablePath=chromiumExecutable();}catch{executablePath=undefined;}
 return chromium.launch({headless:true,executablePath});
}
const fontUrl=async(file:string)=>'data:font/'+(file.endsWith('.otf')?'otf':'ttf')+';base64,'+(await fs.readFile(path.resolve(ROOT,file))).toString('base64');
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/** Picks the caption font following the language policy, and checks glyph coverage. */
export async function captionFont(style:CaptionStyle,cues:Cue[]){
 const text=cues.map(c=>c.text).join('\n');
 const language=resolveLanguage(style.language,text);
 const font=style.fontPreset?await resolveFontPreset(style.fontPreset):await defaultFontPath(language,text);
 const fonts=[font,LATIN_FALLBACK].map(f=>fontCoverage(path.resolve(ROOT,f)));
 const missing=[...new Set([...text].filter(ch=>!/[\s\p{Cf}]/u.test(ch)&&!fonts.some(has=>has(ch.codePointAt(0)!))))];
 if(missing.length)throw new Error('Caption font cannot show: '+missing.join(' ')+'. Choose another allowed font with fontPreset.');
 return {language,font};
}

export async function renderCaptionImages(cues:Cue[],style:CaptionStyle,size:{width:number;height:number},dir:string){
 const {language,font}=await captionFont(style,cues);
 const [primary,latin]=await Promise.all([fontUrl(font),fontUrl(LATIN_FALLBACK)]);
 const px=Math.round(style.size*size.height);
 const vertical=style.position==='bottom'?`bottom:${style.margin*100}%`:style.position==='top'?`top:${style.margin*100}%`:'top:50%;transform:translateY(-50%)';
 const box=style.background?`background:${style.background};padding:.18em .45em;border-radius:.25em;`:'';
 const stroke=style.strokeWidth>0?`-webkit-text-stroke:${(style.strokeWidth*px/2).toFixed(1)}px ${style.stroke};paint-order:stroke fill;`:'';
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1});
  const files:string[]=[];
  for(const [i,cue] of cues.entries()){
   const rtl=isRtl(language,cue.text);
   await page.setContent(`<!doctype html><html lang="${htmlLanguage(language,cue.text)}"><head><meta charset="utf-8"><style>
@font-face{font-family:Cap;src:url(${primary})}@font-face{font-family:CapLatin;src:url(${latin})}
html,body{margin:0;width:${size.width}px;height:${size.height}px;background:transparent;overflow:hidden}
#c{position:absolute;left:0;right:0;${vertical};display:flex;justify-content:center}
#t{max-width:${style.maxWidth*100}%;font:${style.weight} ${px}px/1.35 Cap,CapLatin,sans-serif;color:${style.color};${stroke}${box}
text-align:center;white-space:pre-wrap;overflow-wrap:break-word;unicode-bidi:plaintext}
</style></head><body><div id="c"><div id="t" dir="${rtl?'rtl':'auto'}">${esc(cue.text)}</div></div></body></html>`);
   await page.evaluate(()=>document.fonts.ready);
   const ok=await page.evaluate(()=>document.fonts.check('32px Cap'));
   if(!ok)throw new Error('Caption font failed to load: '+font);
   const file=path.join(dir,`caption-${String(i).padStart(4,'0')}.png`);
   await page.screenshot({path:file,omitBackground:true});
   files.push(file);
  }
  return {files,font,language};
 }finally{await browser.close();}
}

// ---------- styled captions: words that follow the speech, a key word lit, a way of coming in ----------
const STOP=new Set(['the','and','for','with','that','this','you','your','are','was','were','have','has','from','into','about','they','them','then','than','just','very','really','what','when','will','would','could','should']);
/** The key word of a caption: a number, else its longest meaningful word. */
export function keyWord(tokens:string[]){
 const clean=tokens.map(t=>t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu,''));
 const num=clean.findIndex(t=>/\p{N}/u.test(t));if(num>=0)return num;
 let best=-1,len=3;clean.forEach((t,i)=>{if(!STOP.has(t.toLowerCase())&&[...t].length>len){best=i;len=[...t].length;}});return best;
}
type State={from:number;to:number;lit:number[];shown:number;only?:number;intro:'all'|number|null;speak?:number;grow?:number;shake?:number};
/** Renders styled captions as one picture track (PNG frames with their durations, for FFmpeg's
 *  concat reader): each cue in states that follow its words, with a few frames for the way it comes in. */
/** How strongly each word of each cue is said (0 calm, 1 stressed, 1.5 shouted), from the sound:
 *  its loudness and how long it is held against the other words. */
export async function wordEmphasis(file:string,cues:Cue[]):Promise<number[][]>{
 const {decodeMono}=await import('./pcm.js'),R=8000,x=await decodeMono(file,R);
 const wordsOf=(c:Cue)=>{const toks=c.text.split(/\s+/).filter(Boolean);if(c.words&&c.words.length===toks.length)return c.words.map((w,i)=>({t:toks[i]!,start:w.start,end:w.end}));
  const total=toks.reduce((s,t)=>s+t.length+1,0);let t0=c.start;return toks.map(t=>{const d=(c.end-c.start)*(t.length+1)/total,w={t,start:t0,end:t0+d};t0+=d;return w;});};
 const all=cues.map(wordsOf),flat=all.flat();
 const db=(a:number,b:number)=>{const i=Math.max(0,Math.floor(a*R)),j=Math.min(x.length,Math.max(i+1,Math.floor(b*R)));let s=0,pk=0;for(let k=i;k<j;k++){s+=x[k]!*x[k]!;}
  // the word's loud part: the top of its 20 ms frames
  const fr:number[]=[];for(let k=i;k+160<=j;k+=160){let e=0;for(let q=k;q<k+160;q++)e+=x[q]!*x[q]!;fr.push(10*Math.log10(e/160+1e-12));}fr.sort((m,n)=>n-m);pk=fr.length?fr.slice(0,Math.max(1,Math.ceil(fr.length/3))).reduce((m,v)=>m+v,0)/Math.max(1,Math.ceil(fr.length/3)):10*Math.log10(s/Math.max(1,j-i)+1e-12);return pk;};
 const loud=flat.map(w=>db(w.start,w.end)),hold=flat.map(w=>(w.end-w.start)/Math.max(2,[...w.t.replace(/[^\p{L}\p{N}]/gu,'')].length));
 const z=(v:number[])=>{const m=[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)]??0,d=[...v.map(q=>Math.abs(q-m))].sort((a,b)=>a-b)[Math.floor(v.length/2)]||1;return v.map(q=>(q-m)/(d*1.4826));};
 const zl=z(loud),zh=z(hold);let k=0;
 return all.map(ws=>ws.map(()=>{const e=Math.max(0,Math.min(1.5,(0.7*zl[k]!+0.3*zh[k]!)/2));k++;return Math.round(e*100)/100;}));
}

export async function renderCaptionTrack(cues:Cue[],style:CaptionStyle,size:{width:number;height:number},dir:string,fps:number,duration:number,o:{emphasis?:number[][]}={}){
 const {language,font}=await captionFont(style,cues);
 const [primary,latin]=await Promise.all([fontUrl(font),fontUrl(LATIN_FALLBACK)]);
 const px=Math.round(style.size*size.height);
 const vertical=style.position==='bottom'?`bottom:${style.margin*100}%`:style.position==='top'?`top:${style.margin*100}%`:'top:50%;margin-top:-.7em';
 const box=style.background?`background:${style.background};padding:.18em .45em;border-radius:.25em;`:'';
 const stroke=style.strokeWidth>0?`-webkit-text-stroke:${(style.strokeWidth*px/2).toFixed(1)}px ${style.stroke};paint-order:stroke fill;`:'';
 const K=style.reveal==='none'?0:Math.max(2,Math.round(.18*fps));
 const browser=await launch(),list:{file:string;dur:number}[]=[];let n=0,at=0;
 try{
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1});
  await page.setContent(`<!doctype html><html lang="${htmlLanguage(language,cues.map(c=>c.text).join(' '))}"><head><meta charset="utf-8"><style>
@font-face{font-family:Cap;src:url(${primary})}@font-face{font-family:CapLatin;src:url(${latin})}
html,body{margin:0;width:${size.width}px;height:${size.height}px;background:transparent;overflow:hidden}
#c{position:absolute;left:0;right:0;${vertical};display:flex;justify-content:center}
#t{max-width:${style.maxWidth*100}%;font:${style.weight} ${px}px/1.35 Cap,CapLatin,sans-serif;color:${style.color};${stroke}${box}
text-align:center;white-space:pre-wrap;overflow-wrap:break-word;unicode-bidi:plaintext;${style.upper?'text-transform:uppercase;':''}transform-origin:50% 60%}
.w{display:inline-block;transform-origin:50% 70%}.w.hide{visibility:hidden}.w.lit{color:${style.highlight}}
</style></head><body><div id="c"><div id="t"></div></div></body></html>`);
  await page.evaluate(async()=>{await document.fonts.load('32px Cap');await document.fonts.load('32px CapLatin');await document.fonts.ready;});
  if(!await page.evaluate(()=>document.fonts.check('32px Cap')))throw new Error('Caption font failed to load: '+font);
  const blank=path.join(dir,'blank.png');await page.evaluate(()=>{document.getElementById('t')!.innerHTML='';});await page.screenshot({path:blank,omitBackground:true});
  const push=(file:string,dur:number)=>{if(dur<=1e-4)return;const last=list.at(-1);if(last&&last.file===file)last.dur+=dur;else list.push({file,dur});at+=dur;};
  const order=cues.map((c,i)=>({c,i})).sort((a,b)=>a.c.start-b.c.start);
  for(const {c,i:cueIndex} of order){
   if(c.start>at)push(blank,c.start-at);
   const start=Math.max(c.start,at),end=Math.max(start+.04,c.end);
   const tokens=c.text.split(/(\s+)/).filter(x=>x!=='');const idx:number[]=[];tokens.forEach((t,i)=>{if(!/^\s+$/.test(t))idx.push(i);});
   // The words' times: from the speech when they match the cue, else spread over it by length.
   let times=c.words&&c.words.length===idx.length?c.words.map(w=>({start:w.start,end:w.end})):null;
   if(!times){const total=idx.reduce((s,i)=>s+tokens[i]!.length+1,0);let t0=start;times=idx.map(i=>{const d=(end-start)*(tokens[i]!.length+1)/total,w={start:t0,end:t0+d};t0+=d;return w;});}
   const rtl=isRtl(language,c.text),key=style.keyword?keyWord(idx.map(i=>tokens[i]!)):-1;
   await page.evaluate(({tokens,idx,rtl})=>{const t=document.getElementById('t')!;t.dir=rtl?'rtl':'auto';
    t.innerHTML=tokens.map((x,i)=>idx.includes(i)?`<span class="w" data-k="${idx.indexOf(i)}">${x.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`:x.includes('\n')?'<br>':' ').join('');},{tokens,idx,rtl});
   const states:State[]=[];const W=idx.length,bound=(k:number)=>Math.min(end,Math.max(start,k<W-1?times![k+1]!.start:end));
   const emph=o.emphasis?.[cueIndex]??null;
   if(style.style==='phrase'&&!emph)states.push({from:start,to:end,lit:key>=0?[key]:[],shown:W,intro:'all'});
   else if(style.style==='phrase')for(let k=0;k<W;k++){const from=k===0?start:Math.max(start,times[k]!.start),to=bound(k);if(to<=from)continue;states.push({from,to,lit:key>=0?[key]:[],shown:W,intro:k===0?'all':null,speak:k});}
   else for(let k=0;k<W;k++){const from=k===0?start:Math.max(start,times[k]!.start),to=bound(k);if(to<=from)continue;
    if(style.style==='karaoke')states.push({from,to,lit:[k],shown:W,intro:k===0?'all':null,speak:k});
    else if(style.style==='build')states.push({from,to,lit:key>=0&&key<=k?[key]:[],shown:k+1,intro:k,speak:k});
    else states.push({from,to,lit:key===k?[k]:[],shown:W,only:k,intro:'all',speak:k});}
   // Reacting to the voice: the word being said grows with its emphasis; a stressed word takes the
   // highlight; a shouted one shakes.
   if(emph)for(const st of states){const k=st.speak;if(k===undefined)continue;const e=emph[k]??0;st.grow=1+style.react*0.45*Math.min(1,e);if(e>=1&&!st.lit.includes(k))st.lit=[...st.lit,k];if(e>=1.3)st.shake=style.react;}
   for(const st of states){
    if(st.from>at)push(list.at(-1)?.file??blank,st.from-at);
    const shot=async(p:number,jit=0)=>{const file=path.join(dir,`cap-${String(n++).padStart(5,'0')}.png`);
     await page.evaluate(({st,p,reveal,jit})=>{const t=document.getElementById('t')!,spans=[...t.querySelectorAll<HTMLElement>('.w')];
      spans.forEach((s,k)=>{s.classList.toggle('lit',st.lit.includes(k));s.classList.toggle('hide',st.only!==undefined?k!==st.only:k>=st.shown);s.style.transform='';s.style.opacity='';});
      if(st.only!==undefined){t.querySelectorAll('br').forEach(b=>(b as HTMLElement).style.display='none');spans.forEach((s,k)=>{s.style.display=k===st.only?'inline-block':'none';});}
      else{t.querySelectorAll('br').forEach(b=>(b as HTMLElement).style.display='');spans.forEach(s=>{s.style.display='';});}
      const target=st.intro===null?null:st.intro==='all'?t:spans[st.intro as number]!;t.style.transform='';t.style.opacity='';
      if(target&&p<1){const e=1-Math.pow(1-p,3),c=1.70158,b=1+(c+1)*Math.pow(p-1,3)+c*Math.pow(p-1,2);
       target.style.opacity=String(reveal==='pop'?Math.min(1,p*2):e);
       target.style.transform=reveal==='pop'?`scale(${(.55+.45*b).toFixed(3)})`:reveal==='rise'?`translateY(${((1-e)*.45).toFixed(3)}em)`:reveal==='slide'?`translateY(${((1-e)*1.1).toFixed(3)}em)`:'';}
      if(st.speak!==undefined&&st.grow){const w=spans[st.speak];if(w){const sh=st.shake?`translate(${(Math.sin(jit*2.7)*.04*st.shake).toFixed(3)}em,${(Math.cos(jit*3.3)*.03*st.shake).toFixed(3)}em) rotate(${(Math.sin(jit*1.9)*3*st.shake).toFixed(2)}deg) `:'';w.style.transform=sh+`scale(${st.grow.toFixed(3)})`;}}},{st,p,reveal:style.reveal,jit});
     await page.screenshot({path:file,omitBackground:true});return file;};
    const frames=st.intro!==null&&K?Math.min(K,Math.floor((st.to-st.from)*fps)-1):0;
    for(let f=0;f<frames;f++)push(await shot((f+1)/(K+1)),1/fps);
    if(st.shake){const steps=Math.max(1,Math.min(12,Math.floor((st.to-at)*fps/2)));for(let f=0;f<steps-1;f++)push(await shot(1,f+1),2/fps);}
    push(await shot(1,99),Math.max(0,st.to-at));
   }
  }
  if(duration>at)push(blank,duration-at);
  const file=path.join(dir,'captions.txt');
  // FFmpeg's concat reader: each picture and how long it shows; the last is named again to end the track.
  await fs.writeFile(file,list.map(x=>`file '${x.file.replace(/'/g,"'\\''")}'\nduration ${x.dur.toFixed(4)}`).join('\n')+`\nfile '${list.at(-1)!.file.replace(/'/g,"'\\''")}'\n`);
  return {list:file,pictures:n,font,language};
 }finally{await browser.close();}
}
