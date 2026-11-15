// Edit it the same way: the editing style of a video the user likes, measured (how often it cuts,
// its punch-in zooms, its captions' place, size, colours and rhythm, its colour grade, whether music
// plays under the voice) and applied to the user's own footage by the automatic edit. Only the style
// is taken: the user's footage, words and sound are what the edit is made of.
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';
import {readFrames,palette,colorDistance} from '../engine/blueprint.js';

const r2=(n:number)=>Math.round(n*100)/100,r3=(n:number)=>Math.round(n*1000)/1000;
const median=(a:number[])=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]!;};
function grab(file:string,t:number,w:number,h:number){return new Promise<Buffer>(resolve=>{const c=spawn(ffmpeg,['-v','error','-ss',Math.max(0,t).toFixed(3),'-i',file,'-frames:v','1','-vf',`scale=${w}:${h}:flags=area`,'-f','rawvideo','-pix_fmt','rgb24','-'],{windowsHide:true});
 const out:Buffer[]=[];c.stdout.on('data',d=>out.push(d));c.on('error',()=>resolve(Buffer.alloc(0)));c.on('close',()=>resolve(Buffer.concat(out)));});}
const grayOf=(f:Buffer)=>{const g=new Float32Array(f.length/3);for(let i=0;i<g.length;i++)g[i]=.299*f[i*3]!+.587*f[i*3+1]!+.114*f[i*3+2]!;return g;};
/** The middle of a frame, enlarged by `s` (bilinear), as it would look after a punch-in. */
function enlarge(g:Float32Array,w:number,h:number,s:number){const out=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=(x-w/2)/s+w/2,sy=(y-h/2)/s+h/2,x0=Math.max(0,Math.min(w-2,Math.floor(sx))),y0=Math.max(0,Math.min(h-2,Math.floor(sy))),fx=sx-x0,fy=sy-y0;
  out[y*w+x]=g[y0*w+x0]!*(1-fx)*(1-fy)+g[y0*w+x0+1]!*fx*(1-fy)+g[(y0+1)*w+x0]!*(1-fx)*fy+g[(y0+1)*w+x0+1]!*fx*fy;}return out;}
const ncc=(a:Float32Array,b:Float32Array,w:number,h:number)=>{const m=Math.round(w*.12),n=Math.round(h*.12);let sa=0,sb=0,c=0;
 for(let y=n;y<h-n;y++)for(let x=m;x<w-m;x++){sa+=a[y*w+x]!;sb+=b[y*w+x]!;c++;}const ma=sa/c,mb=sb/c;let num=0,da=0,db=0;
 for(let y=n;y<h-n;y++)for(let x=m;x<w-m;x++){const p=a[y*w+x]!-ma,q=b[y*w+x]!-mb;num+=p*q;da+=p*p;db+=q*q;}return da&&db?num/Math.sqrt(da*db):0;};
/** Whether the picture after a cut is the one before, enlarged (a punch-in) or reduced (out), and by how much. */
async function punchAt(file:string,t:number){const w=160,h=90,A=grayOf(await grab(file,t-.07,w,h)),B=grayOf(await grab(file,t+.07,w,h));
 if(A.length!==w*h||B.length!==w*h)return null;let best={s:1,dir:'in' as 'in'|'out',score:ncc(A,B,w,h)};
 for(let s=1.04;s<=1.6;s+=.02){const i=ncc(enlarge(A,w,h,s),B,w,h),o=ncc(A,enlarge(B,w,h,s),w,h);if(i>best.score)best={s,dir:'in',score:i};if(o>best.score)best={s,dir:'out',score:o};}
 return best.score>=.85&&best.s>1.03?{scale:r2(best.s),dir:best.dir}:null;}

export type EditStyle={source:string;seconds:number;pace:{cutsPerMinute:number;shotMedian:number};
 punch:{count:number;perMinute:number;scale:number;hold:number}|null;
 captions:{found:boolean;read:boolean;position:'bottom'|'center'|'top';margin:number;size:number;wordsAtOnce:number;style:'word'|'phrase';upper:boolean;color:string;highlight:string|null;background:string|null}|null;
 grade:{brightness:number;contrast:number;saturation:number;warmth:number};music:boolean;notes:string[]};
/** The colour of a picture in four numbers: how bright, how contrasted, how colourful, how warm. */
export async function gradeOf(file:string){
 const {inspect}=await import('../engine/teach/measure.js'),m=await inspect(file),fr=await readFrames(file,{fps:Math.min(4,24/Math.max(1,m.seconds)),width:64,height:36});
 let n=0,L=0,L2=0,S=0,W=0;for(const f of fr)for(let i=0;i<f.length;i+=3){const r=f[i]!,g=f[i+1]!,b=f[i+2]!,y=(.299*r+.587*g+.114*b)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);L+=y;L2+=y*y;S+=mx?(mx-mn)/mx:0;W+=(r-b)/255;n++;}
 if(!n)throw new Error('No frames could be read: '+file);const mean=L/n;
 return {brightness:r3(mean),contrast:r3(Math.sqrt(Math.max(0,L2/n-mean*mean))),saturation:r3(S/n),warmth:r3(W/n)};
}
/** The editing style of a video the user likes. */
export async function studyEdit(file:string):Promise<EditStyle>{
 const src=path.resolve(file),{measure}=await import('../engine/teach/measure.js'),m=await measure(src),notes:string[]=[];
 // Punch-ins: at each cut, the same picture enlarged.
 const cuts=m.pacing.cutTimes.slice(0,120),zooms:{scale:number;dir:'in'|'out'}[]=[];
 for(const t of cuts){const z=await punchAt(src,t);if(z)zooms.push(z);}
 // A punch-in and the cut back out of it are one punch: count the ins (or the outs when it only zooms out).
 const ins=zooms.filter(z=>z.dir==='in').length||zooms.length;
 // How long it holds a punch-in: from the cut in to the cut back out.
 const zt=cuts.map((t,i)=>({t,z:null as null|{dir:string}})),holds:number[]=[];
 {let k=0;for(const t of cuts){const z=await punchAt(src,t);zt[k++]!.z=z;}}
 for(let i=0;i<zt.length;i++)if(zt[i]!.z?.dir==='in'){const back=zt.slice(i+1).find(x=>x.z?.dir==='out');if(back)holds.push(back.t-zt[i]!.t);}
 const punch=zooms.length?{count:ins,perMinute:r2(ins/m.media.seconds*60),scale:r2(median(zooms.map(z=>z.scale))),hold:r2(holds.length?median(holds):2)}:null;
 // Captions: text that sits in the same band for much of the video, its size, colours and rhythm.
 let captions:EditStyle['captions']=null;
 try{const {runPythonModule}=await import('../engine/audio-analysis.js');
  const found=await runPythonModule('media_tools.cli',['private',src,'--no-faces','--step','0.5'],{label:'Reading the captions',env:{FFMPEG_PATH:ffmpeg}}) as {text:boolean;width:number;height:number;samples:{time:number;texts:{box:[number,number,number,number];text:string}[]}[]};
  if(!found.text)notes.push('Captions need the media tools\' text reader (pnpm tempoloom media setup); they were left as the edit\'s own.');
  else{const lower=found.samples.map(s=>({time:s.time,t:s.texts.filter(x=>x.box[1]+x.box[3]/2>.25)})).filter(s=>s.t.length);
   if(lower.length>=Math.max(2,found.samples.length*.3)){
    const cy=median(lower.map(s=>{const b=s.t.reduce((a,x)=>x.box[3]>a.box[3]?x:a).box;return b[1]+b[3]/2;})),h=median(lower.flatMap(s=>s.t.map(x=>x.box[3])));
    const words=median(lower.map(s=>s.t.reduce((n,x)=>n+x.text.trim().split(/\s+/).filter(Boolean).length,0)));
    const letters=lower.flatMap(s=>s.t.map(x=>x.text)).join('').replace(/[^\p{L}]/gu,''),upper=letters.length>0&&letters.replace(/[^\p{Lu}]/gu,'').length/letters.length>.7;
    // Colours inside the caption boxes: the box's own background when it has one, the letters, and a
    // second letter colour when one word is lit.
    const W=found.width>found.height?320:180,H=Math.round(W*found.height/found.width),cols:string[]=[],backs:string[]=[];
    for(const s of lower.filter((_,i)=>i%Math.max(1,Math.floor(lower.length/8))===0).slice(0,8)){const f=await grab(src,s.time,W,H);if(f.length!==W*H*3)continue;
     for(const x of s.t){const [bx,by,bw,bh]=x.box,px:number[]=[];for(let y=Math.floor(by*H);y<Math.min(H,Math.ceil((by+bh)*H));y++)for(let xx=Math.floor(bx*W);xx<Math.min(W,Math.ceil((bx+bw)*W));xx++){const i=(y*W+xx)*3;px.push(f[i]!,f[i+1]!,f[i+2]!);}
      if(px.length<30)continue;const p=palette(Buffer.from(px),3);if(p[0])backs.push(p[0].hex);for(const c of p.slice(1))if(c.share>.08)cols.push(c.hex);}}
    const common=(a:string[])=>{const g:{hex:string;n:number}[]=[];for(const c of a){const e=g.find(x=>colorDistance(x.hex,c)<50);if(e)e.n++;else g.push({hex:c,n:1});}return g.sort((x,y)=>y.n-x.n);};
    const bgs=common(backs),letters2=common(cols.filter(c=>!bgs[0]||colorDistance(c,bgs[0].hex)>60));
    // A box behind the words: the same plain colour behind every caption (not the changing picture).
    const boxed=!!bgs[0]&&bgs[0].n>=backs.length*.7&&backs.length>=3;
    const light=(h:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));return (.299*r!+.587*g!+.114*b!)/255;};
    // A lit word is a second clear letter colour, not the soft edge between the letters and the box.
    const ink=letters2[0]?.hex??'#FFFFFF',lit=letters2.slice(1).find(c=>c.n>=2&&colorDistance(c.hex,ink)>90&&(!bgs[0]||colorDistance(c.hex,bgs[0].hex)>110)&&Math.abs(light(c.hex)-light(bgs[0]?.hex??'#000000'))>=Math.abs(light(ink)-light(bgs[0]?.hex??'#000000'))*.6)?.hex??null;
    captions={found:true,read:true,position:cy<.4?'top':cy<.62?'center':'bottom',margin:r3(cy<.4?Math.max(.02,cy-h/2-h*.3):Math.max(.02,1-cy-h/2-h*.3)),size:r3(Math.min(.2,Math.max(.02,h*1.05))),wordsAtOnce:words,style:words<=2?'word':'phrase',upper,
     color:ink,highlight:lit,background:boxed?bgs[0]!.hex:null};}
   else captions={found:false,read:true,position:'bottom',margin:.16,size:.055,wordsAtOnce:0,style:'phrase',upper:false,color:'#FFFFFF',highlight:null,background:null};}}
 catch{notes.push('Captions were not read (the media tools are not set up); the edit keeps its own captions.');}
 const grade=await gradeOf(src),music=!!m.sound&&m.sound.tempoConfidence>=.3;
 return {source:src,seconds:m.media.seconds,pace:{cutsPerMinute:m.pacing.cutsPerMinute,shotMedian:m.pacing.shotMedian},punch,captions,grade,music,notes};
}
/** The grade that takes one picture's colour toward another's (within gentle limits). */
export function gradeToward(to:EditStyle['grade'],from:EditStyle['grade']){
 const clamp=(v:number,a:number,b:number)=>+Math.min(b,Math.max(a,v)).toFixed(3);
 return {brightness:clamp(to.brightness-from.brightness,-.25,.25),contrast:clamp(from.contrast?to.contrast/from.contrast:1,.7,1.45),saturation:clamp(from.saturation?to.saturation/from.saturation:1,.4,1.9),warmth:clamp(to.warmth-from.warmth,-.25,.25)};
}
/** The automatic edit's settings for a style: pauses kept as short as its cutting, punch-ins as often
 *  and as big, its captions, its grade, music when it has music. */
export function editSettings(style:EditStyle,mine:EditStyle['grade']){
 const pause=style.pace.shotMedian<=1.6?.25:style.pace.shotMedian<=3?.4:.6;
 return {maxPause:pause,music:style.music?'auto' as const:'off' as const,
  punch:style.punch?{scale:Math.min(1.5,Math.max(1.05,style.punch.scale)),perMinute:style.punch.perMinute,hold:style.punch.hold}:null,
  captions:style.captions?(style.captions.found?{position:style.captions.position,margin:style.captions.margin,size:style.captions.size,style:style.captions.style,upper:style.captions.upper,color:style.captions.color,
   ...(style.captions.highlight?{highlight:style.captions.highlight}:{}),background:style.captions.background,...(style.captions.background?{strokeWidth:0}:{}),safeArea:false}:false):null,
  grade:gradeToward(style.grade,mine)};
}
/** Edits the user's footage in the style of a reference, then says how close it came. */
export async function editLike(reference:string,footage:string,o:{transcript?:string;plan?:boolean;out?:string;onStep?:(s:string)=>void}={}){
 const step=o.onStep??(()=>{});step('Studying how the reference is edited');
 const style=await studyEdit(reference),mine=await gradeOf(path.resolve(footage)),s=editSettings(style,mine);
 const {autoEdit}=await import('./auto-edit.js');
 const r=await autoEdit(footage,{...(o.transcript?{transcript:o.transcript}:{}),...(o.out?{out:o.out}:{}),plan:o.plan,onStep:step,visuals:false,maxPause:s.maxPause,music:s.music,
  zooms:!!s.punch,captions:s.captions!==false,match:{punch:s.punch,captions:s.captions?s.captions as Record<string,unknown>:null,grade:s.grade}});
 let close:Record<string,{reference:number|string;yours:number|string}>|null=null;
 if(r.status==='done'){const after=await gradeOf(r.output!),{measure}=await import('../engine/teach/measure.js'),m=await measure(r.output!,{sound:false});
  close={cutsPerMinute:{reference:style.pace.cutsPerMinute,yours:m.pacing.cutsPerMinute},brightness:{reference:style.grade.brightness,yours:after.brightness},saturation:{reference:style.grade.saturation,yours:after.saturation},
   warmth:{reference:style.grade.warmth,yours:after.warmth},contrast:{reference:style.grade.contrast,yours:after.contrast}};}
 return {...r,style,settings:s,close};
}
