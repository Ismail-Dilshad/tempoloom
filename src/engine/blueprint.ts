// Same design, your content: a reference video read scene by scene into a blueprint. Each scene's
// timing, how it comes in (a cut, a fade, a flash, a dissolve, a move), where its content and text sit
// and how big, its colour roles and how much it moves. Only measurements are kept, never the
// reference's pictures, logo or words: a recreation uses the user's own content in the same design.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ffmpeg,probe,run} from '../renderer/ffmpeg-encoder.js';

export type Box={x:number;y:number;w:number;h:number};
export type Transition='cut'|'fade'|'flash'|'dissolve'|'move'|'start';
export type Scene={n:number;start:number;end:number;duration:number;transition:Transition;
 colors:{background:string;ink:string|null;accent:string|null;palette:{hex:string;share:number}[]};
 content:Box|null;grid:number[];where:string;text:{boxes:(Box&{lines:number;chars:number})[];size:number|null;read:boolean};
 energy:number;entrance:number;keyframe:number};
export type Blueprint={version:1;source:string;width:number;height:number;fps:number;seconds:number;shape:'vertical'|'square'|'horizontal';
 scenes:Scene[];colors:{background:string;ink:string|null;accent:string|null};
 sound:{bpm:number|null;music:boolean;lufs:number|null}|null;notes:string[];folder:string;sheet:string|null};

const r2=(n:number)=>Math.round(n*100)/100,r3=(n:number)=>Math.round(n*1000)/1000;
const hex=(r:number,g:number,b:number)=>'#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('').toUpperCase();
export const rgbOf=(h:string)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)) as [number,number,number];
export const colorDistance=(a:string,b:string)=>{const x=rgbOf(a),y=rgbOf(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);};
const lum=(h:string)=>{const [r,g,b]=rgbOf(h);return (.299*r+.587*g+.114*b)/255;};
const chroma=(h:string)=>{const c=rgbOf(h);return (Math.max(...c)-Math.min(...c))/255;};

/** Small frames of a video, a few a second, as RGB. */
export function readFrames(file:string,o:{fps:number;width:number;height:number}){
 return new Promise<Buffer[]>((resolve,reject)=>{const size=o.width*o.height*3,out:Buffer[]=[];let buf=Buffer.alloc(0);
  const c=spawn(ffmpeg,['-v','error','-i',file,'-vf',`fps=${o.fps},scale=${o.width}:${o.height}:flags=area`,'-f','rawvideo','-pix_fmt','rgb24','-'],{windowsHide:true});
  c.stdout.on('data',(d:Buffer)=>{buf=Buffer.concat([buf,d]);while(buf.length>=size){out.push(buf.subarray(0,size));buf=buf.subarray(size);}});
  let err='';c.stderr.on('data',d=>err+=d);c.on('error',reject);c.on('close',code=>code===0?resolve(out):reject(new Error('Could not read the frames: '+err.slice(-300))));});
}
const gray=(f:Buffer)=>{const g=new Float32Array(f.length/3);for(let i=0;i<g.length;i++)g[i]=.299*f[i*3]!+.587*f[i*3+1]!+.114*f[i*3+2]!;return g;};
/** Colour as numbers to compare: each pixel's red, green and blue (two colours as bright as each other still differ). */
const rgb=(f:Buffer)=>{const g=new Float32Array(f.length);for(let i=0;i<f.length;i++)g[i]=f[i]!;return g;};
const diff=(a:Float32Array,b:Float32Array)=>{let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]!-b[i]!);return d/a.length;};
const meanLum=(g:Float32Array)=>g.reduce((s,v)=>s+v,0)/g.length;

/** The main colours of a frame (a few rounds of k-means), with their share. */
export function palette(f:Buffer,k=5){
 const n=f.length/3,px:[number,number,number][]=[];for(let i=0;i<n;i+=1)px.push([f[i*3]!,f[i*3+1]!,f[i*3+2]!]);
 // Start from the most common coarse colours, then refine.
 const bins=new Map<number,number>();for(const p of px){const key=(p[0]>>5)<<6|(p[1]>>5)<<3|(p[2]>>5);bins.set(key,(bins.get(key)??0)+1);}
 let cs=[...bins].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([key])=>[((key>>6)&7)*32+16,((key>>3)&7)*32+16,(key&7)*32+16] as [number,number,number]);
 let counts=new Array(cs.length).fill(0);
 for(let it=0;it<6;it++){const sum=cs.map(()=>[0,0,0]);counts=new Array(cs.length).fill(0);
  for(const p of px){let bi=0,bd=Infinity;cs.forEach((c,i)=>{const d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2;if(d<bd){bd=d;bi=i;}});counts[bi]++;sum[bi]![0]+=p[0];sum[bi]![1]+=p[1];sum[bi]![2]+=p[2];}
  cs=cs.map((c,i)=>counts[i]?[sum[i]![0]/counts[i],sum[i]![1]/counts[i],sum[i]![2]/counts[i]] as [number,number,number]:c);}
 return cs.map((c,i)=>({hex:hex(...c),share:r3(counts[i]/n)})).filter(c=>c.share>0).sort((a,b)=>b.share-a.share);
}
/** Colour roles: the background (most of the frame), the ink (what stands out most from it), the
 *  accent (the most colourful one that is neither). */
export function roles(p:{hex:string;share:number}[]){
 const bg=p[0]?.hex??'#000000',others=p.slice(1).filter(c=>c.share>=.004&&colorDistance(c.hex,bg)>60);
 const ink=[...others].sort((a,b)=>Math.abs(lum(b.hex)-lum(bg))-Math.abs(lum(a.hex)-lum(bg)))[0]?.hex??null;
 const accent=others.filter(c=>c.hex!==ink&&chroma(c.hex)>.3).sort((a,b)=>chroma(b.hex)*Math.sqrt(b.share)-chroma(a.hex)*Math.sqrt(a.share))[0]?.hex
  ??(ink&&chroma(ink)>.35?ink:null);
 return {background:bg,ink,accent};
}
/** Where the content sits: what differs from the background, as a 6x6 grid and a bounding box. */
function layout(f:Buffer,w:number,h:number,bg:string){
 const [br,bgc,bb]=rgbOf(bg),grid=new Array(36).fill(0),cnt=new Array(36).fill(0);let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*3,on=Math.hypot(f[i]!-br,f[i+1]!-bgc,f[i+2]!-bb)>48,g=Math.min(5,Math.floor(y/h*6))*6+Math.min(5,Math.floor(x/w*6));cnt[g]++;
  if(on){grid[g]++;if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;}}
 const g=grid.map((v,i)=>r2(v/(cnt[i]||1))),content=x1<0?null:{x:r3(x0/w),y:r3(y0/h),w:r3((x1-x0+1)/w),h:r3((y1-y0+1)/h)};
 const cy=content?content.y+content.h/2:.5,cx=content?content.x+content.w/2:.5;
 const where=content?`${cy<.38?'top':cy>.62?'bottom':'middle'} ${cx<.4?'left':cx>.6?'right':'centre'}, ${Math.round(content.w*100)}% wide`:'empty';
 return {grid:g,content,where};
}
/** How the scene that starts at frame b comes in, from the frames around it. */
function transitionAt(G:Float32Array[],C:Float32Array[],b:number):Transition{
 const a=Math.max(0,b-4),z=Math.min(G.length-1,b+5);if(z-a<2)return 'cut';
 const steps:number[]=[];for(let i=a+1;i<=z;i++)steps.push(diff(C[i]!,C[i-1]!));
 const total=steps.reduce((s,v)=>s+v,0)||1,biggest=Math.max(...steps);
 const L=[...Array(z-a+1).keys()].map(i=>meanLum(G[a+i]!)),ends=[L[0]!,L.at(-1)!];
 const mid=L.slice(1,-1);
 if(mid.some(v=>v<14)&&ends.every(v=>v>22))return 'fade';
 if(mid.some(v=>v>238)&&ends.every(v=>v<225))return 'flash';
 if(biggest/total>.62)return 'cut';
 // A blend of the two ends (each frame between them is A and Z mixed, the mix growing): a dissolve.
 // Otherwise something moved across: a wipe, a slide or a zoom.
 const A=C[a]!,Z=C[z]!;let dz=0;for(let j=0;j<A.length;j++)dz+=(Z[j]!-A[j]!)**2;if(!dz)return 'cut';
 let worst=0,last=-1,steady=true;
 for(let i=a+1;i<z;i++){const M=C[i]!;let dot=0;for(let j=0;j<M.length;j++)dot+=(M[j]!-A[j]!)*(Z[j]!-A[j]!);const k=Math.max(0,Math.min(1,dot/dz));
  let e=0;for(let j=0;j<M.length;j++)e+=Math.abs(M[j]!-(A[j]!+(Z[j]!-A[j]!)*k));worst=Math.max(worst,e/M.length);if(k<last-.05)steady=false;last=k;}
 return steady&&worst<diff(A,Z)*.25?'dissolve':'move';
}

/** Studies a reference: its scenes and their design. Writes the blueprint, a frame per scene and a
 *  sheet of them (for the agent to read the design; they are never used in a video). */
export async function study(file:string,o:{out?:string;scenes?:number[];text?:boolean}={}):Promise<Blueprint>{
 const src=path.resolve(file),p=await probe(src),v=(p.streams as {codec_type:string;width?:number;height?:number;avg_frame_rate?:string}[]).find(s=>s.codec_type==='video');
 if(!v)throw new Error('Not a video: '+src);
 const W=Number(v.width),H=Number(v.height),[fa,fb]=String(v.avg_frame_rate??'30/1').split('/').map(Number),fps=fb?fa!/fb:fa||30,seconds=Number(p.format?.duration)||0;
 const RATE=8,w=96,h=Math.max(2,Math.round(96*H/W/2)*2),frames=await readFrames(src,{fps:RATE,width:w,height:h}),G=frames.map(gray),C=frames.map(rgb);
 const notes:string[]=[];if(frames.length<4)throw new Error('The video is too short to study');
 // Scene changes: a lasting change between the picture before and after (not a moving element),
 // at the frame where it changes most. Or the times given.
 let starts:number[];
 if(o.scenes?.length)starts=[0,...o.scenes.map(t=>Math.round(t*RATE)).filter(b=>b>0&&b<frames.length)];
 else{const L=C.map((_,i)=>i<3||i>C.length-4?0:diff(C[i-3]!,C[i+3]!)),sorted=L.slice(3,-3).sort((a,b)=>a-b),med=sorted[Math.floor(sorted.length/2)]??0;
  const thr=Math.max(16,med*4),cand:number[]=[];
  for(let i=3;i<G.length-3;i++)if(L[i]!>=thr&&L[i]!>=L[i-1]!&&L[i]!>=L[i+1]!){let best=i,bd=-1;for(let j=i-2;j<=i+3;j++){if(j<1||j>=C.length)continue;const d=diff(C[j]!,C[j-1]!);if(d>bd){bd=d;best=j;}}cand.push(best);}
  starts=[0];for(const c of cand)if(c-starts.at(-1)!>=Math.round(RATE*.9))starts.push(c);}
 starts=[...new Set(starts)].sort((a,b)=>a-b);
 const folder=path.resolve(o.out??src.replace(/\.[^.]+$/,'')+'-blueprint');let dir=folder;for(let k=2;fs.existsSync(dir);k++)dir=`${folder}-${k}`;fs.mkdirSync(path.join(dir,'frames'),{recursive:true});
 const scenes:Scene[]=[];
 for(const [k,b] of starts.entries()){const e=starts[k+1]??frames.length,start=b/RATE,end=Math.min(seconds,e/RATE);
  // The settled look: two thirds into the scene, before it starts to leave.
  const key=Math.min(e-1,b+Math.max(1,Math.round((e-b)*.66))),f=frames[key]!,pal=palette(f),rl=roles(pal),lay=layout(f,w,h,rl.background);
  const inside:number[]=[];for(let i=b+1;i<e;i++)inside.push(diff(C[i]!,C[i-1]!));const energy=inside.length?inside.reduce((s,x)=>s+x,0)/inside.length:0;
  const early=inside.slice(0,Math.round(RATE*.75)),entrance=early.length?early.reduce((s,x)=>s+x,0)/early.length:0;
  scenes.push({n:k+1,start:r2(start),end:r2(end),duration:r2(end-start),transition:k===0?'start':transitionAt(G,C,b),colors:{...rl,palette:pal.slice(0,5)},content:lay.content,grid:lay.grid,where:lay.where,
   text:{boxes:[],size:null,read:false},energy:r2(energy),entrance:r2(entrance),keyframe:r2(key/RATE)});}
 // Text on screen: where it sits, how many lines and how big (never what it says), with the media
 // tools' text reader when it is installed; otherwise the agent reads it from the sheet.
 if(o.text!==false){try{const {runPythonModule}=await import('./audio-analysis.js');
  const found=await runPythonModule('media_tools.cli',['private',src,'--no-faces','--step','0.25'],{label:'Reading where text sits',env:{FFMPEG_PATH:ffmpeg}}) as {samples:{time:number;texts:{box:[number,number,number,number];text:string}[]}[];text:boolean};
  if(found.text){for(const s of scenes){const near=found.samples.reduce((a,x)=>Math.abs(x.time-s.keyframe)<Math.abs(a.time-s.keyframe)?x:a,found.samples[0]!);
    s.text={boxes:near.texts.map(t=>({x:t.box[0],y:t.box[1],w:t.box[2],h:t.box[3],lines:1,chars:[...t.text.replace(/\s+/g,'')].length})),size:near.texts.length?r3(Math.max(...near.texts.map(t=>t.box[3]))):null,read:true};}}
  else notes.push('Text positions need the media tools\' text reader (pnpm tempoloom media setup); read them from the sheet instead.');}
 catch{notes.push('Text positions were not read (the media tools are not set up): read them from the sheet.');}}
 // A frame per scene, and one sheet of them with the scene numbers, for the agent's eyes.
 for(const s of scenes)await run(ffmpeg,['-v','error','-y','-ss',String(s.keyframe),'-i',src,'-frames:v','1','-vf','scale=480:-2',path.join(dir,'frames',`scene-${String(s.n).padStart(2,'0')}.jpg`)]);
 let sheet:string|null=null;
 if(scenes.length){sheet=path.join(dir,'sheet.jpg');const cols=Math.min(4,scenes.length),rows=Math.ceil(scenes.length/cols);
  await run(ffmpeg,['-v','error','-y','-framerate','1','-i',path.join(dir,'frames','scene-%02d.jpg'),'-vf',`scale=360:-2,tile=${cols}x${rows}:padding=6:color=black`,'-frames:v','1',sheet]).catch(e=>{notes.push('No sheet: '+String((e as Error).message).slice(0,200));sheet=null;});}
 const {measure}=await import('./teach/measure.js');let sound:Blueprint['sound']=null;
 try{const m=await measure(src);sound=m.sound?{bpm:m.sound.bpm,music:m.sound.tempoConfidence>=.3,lufs:m.sound.lufs}:null;}catch{/* no sound */}
 const all=roles(palette(Buffer.concat(scenes.map(s=>frames[Math.round(s.keyframe*RATE)]??frames[0]!))));
 if(scenes.length===1)notes.push('One continuous scene was found. If it has scenes, give their start times (--scenes 2.1,4.5).');
 const bp:Blueprint={version:1,source:src,width:W,height:H,fps:r2(fps),seconds:r2(seconds),shape:W/H>1.15?'horizontal':W/H<.87?'vertical':'square',scenes,colors:all,sound,notes,folder:dir,sheet};
 fs.writeFileSync(path.join(dir,'blueprint.json'),JSON.stringify(bp,null,1)+'\n');fs.writeFileSync(path.join(dir,'blueprint.md'),describe(bp));
 return bp;
}
const pct=(n:number)=>Math.round(n*100)+'%';
/** The blueprint as a page to read. */
export function describe(bp:Blueprint){
 return [`# Blueprint: ${path.basename(bp.source)}`,'',`${bp.width}x${bp.height} (${bp.shape}), ${bp.seconds} s, ${bp.scenes.length} scene${bp.scenes.length>1?'s':''}. Colours: background ${bp.colors.background}, ink ${bp.colors.ink??'-'}, accent ${bp.colors.accent??'-'}.${bp.sound?` Sound: ${bp.sound.music?`music about ${Math.round(bp.sound.bpm??0)} BPM`:'no steady music'}${bp.sound.lufs!=null?`, ${bp.sound.lufs} LUFS`:''}.`:''}`,'',
  '| Scene | Time | Comes in | Content | Text | Colours (background, ink, accent) | Motion |','| --- | --- | --- | --- | --- | --- | --- |',
  ...bp.scenes.map(s=>`| ${s.n} | ${s.start}-${s.end} s (${s.duration} s) | ${s.transition} | ${s.where} | ${s.text.read?s.text.boxes.length?`${s.text.boxes.length} line${s.text.boxes.length>1?'s':''}, tallest ${pct(s.text.size??0)} of the height, at ${s.text.boxes.map(b=>`${pct(b.x)},${pct(b.y)}`).join('; ')}`:'none':'see the sheet'} | ${s.colors.background}, ${s.colors.ink??'-'}, ${s.colors.accent??'-'} | ${s.energy<1?'still':s.energy<4?'gentle':'busy'}${s.entrance>s.energy*1.5?', builds in':''} |`),
  '',...(bp.notes.length?['Notes:',...bp.notes.map(n=>`- ${n}`),'']:[]),
  'Look at sheet.jpg (the scenes in order, left to right, then down; each also in frames/) and say, for each scene, what kind of design it is (a big number, a title card, an icon grid, a chart, a product shot...): that is what the recreation keeps, with your own content.',''].join('\n');
}
export const readBlueprint=(f:string)=>JSON.parse(fs.readFileSync(fs.statSync(f).isDirectory()?path.join(f,'blueprint.json'):f,'utf8')) as Blueprint;
