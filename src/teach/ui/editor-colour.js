'use strict';
// Editor, colour and effects: grading (wheels, curves, .cube looks) on the graphics card, green screen, and clip effects (shake, glow, sharpen, grain).
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 // ---------- colour grading: wheels, curves and an imported look, folded into one 3D table ----------
 luts:new Map(),lutText:new Map(),
 /** Imports a .cube look (kept in this browser; projects keep only its id and name). */
 async importLut(file){const text=await file.text(),parsed=edParseCube(text);if(!parsed)throw new Error('This is not a .cube look (LUT_3D_SIZE and its colours were not found).');
  const id='lut-'+this.uid();await this.write([['meta','lut:'+id,{name:file.name.replace(/\.cube$/i,''),text}]]);this.lutText.set(id,text);this.luts.set(id,parsed);
  const list=(await this.read('meta','luts'))||[];list.unshift({id,name:file.name.replace(/\.cube$/i,''),size:parsed.n});await this.write([['meta','luts',list]]);this.lutList=list;return id;},
 async loadLuts(){this.lutList=(await this.read('meta','luts'))||[];for(const l of this.lutList)if(!this.luts.has(l.id)){const r=await this.read('meta','lut:'+l.id);if(r?.text){this.lutText.set(l.id,r.text);const p=edParseCube(r.text);if(p)this.luts.set(l.id,p);}}return this.lutList;},
 _gl:new Map(),
 /** The 33-point table for a grade (cached by its settings). Null while its imported look is still loading. */
 gradeLut(g){const key=JSON.stringify(g);let t=this._gl.get(key);if(t)return t;
  const look=g.lut?.id?this.luts.get(g.lut.id):null;if(g.lut?.id&&!look){this.loadLuts().then(()=>{if(!this.playing)this.draw();});return null;}
  t=edBuildLut(g,look);this._gl.set(key,t);if(this._gl.size>40)this._gl.delete(this._gl.keys().next().value);return t;},
 async exportReady(){
  if(edAll(this.p.clips).some(c=>c.grade?.lut?.id))await this.loadLuts();
  await document.fonts?.ready;
  const waits=[],images=new Set(),k=this.k();
  const font=(spec,text)=>waits.push(document.fonts?.load(spec,text||'a').catch(()=>{}));
  const visit=depth=>{
   for(const c of this.p.clips){
    if(c.nest){if(depth<5)this.withNest(c,()=>visit(depth+1));continue;}
    if(c.text!==undefined){font(this.font(c,c.start),c.text);continue;}
    if(c.title){for(const layer of c.title.layers||[])if(layer.type==='text')font(edTitleFont(layer,k),layer.text);continue;}
    if(c.sticker||c.asAudio)continue;
    const m=this.mediaOf(c);if(!m)continue;
    if(m.type==='image'&&!images.has(m.id)){
     images.add(m.id);
     waits.push(this.image(m).decode().catch(()=>{throw new Error('The picture '+m.name+' could not be read');}));
    }else if(m.type==='video')waits.push(edReady(this.element(c),m.name));
   }
  };
  visit(0);
  await Promise.all(waits);
 },
 /** Every video that can be on screen at t (or held for a transition) shows exactly its frame for t. Same targets as sync(). */
 async seekExact(t){
  const waits=[];this.seekWaits(t,waits);
  await Promise.all(waits);
 },
 seekWaits(t,waits){
  for(const c of this.p.clips){
   if(c.nest){if(t>=c.start-1.5&&t<c.start+c.dur+1.5)this.withNest(c,()=>this.seekWaits(edClamp(t,c.start,c.start+c.dur-1e-3)-c.start+(c.in||0),waits));continue;}
   if(c.text!==undefined||c.sticker||c.asAudio)continue;const m=this.mediaOf(c);if(!m||m.type!=='video')continue;
   let want;
   if(t>=c.start&&t<c.start+c.dur)want=this.srcAt(c,t);
   else if(c.start-t>0&&c.start-t<1.5)want=c.in||0;
   else if(t-(c.start+c.dur)>=0&&t-(c.start+c.dur)<1.5)want=Math.max(0,this.srcAt(c,c.start+c.dur)-.05);
   else continue;
   const el=this.element(c);if(!el.paused)el.pause();
   if(Math.abs(el.currentTime-want)<.0005&&el.readyState>=2)continue;
   waits.push(edSeek(el,want,m.name).then(()=>edReady(el,m.name)));
   if(c.frameBlend){const e2=this.element(c,'#b');if(!e2.paused)e2.pause();waits.push(edSeek(e2,want+1/30,m.name).then(()=>edReady(e2,m.name)));}
  }
 },
 /** The sound of the whole video, mixed offline: the same clips, volumes, keyframes and fades as playback.
  *  Faster or slower clips keep their pitch, as in the player (edStretch). */
 async mixAudio(t0,dur){
  const sr=48000,oc=new OfflineAudioContext(2,Math.max(1,Math.round(dur*sr)),sr),bufs=new Map(),silent=new Set();
  if(edAll(this.p.clips).some(c=>c.afx?.pitch||ED_VOICES.find(v=>v[0]===c.afx?.voice)?.[2]?.pitch))await edPitchModule(oc);
  // First, every clip that sounds (nested ones too) with its loudness over time, worked out now (nothing waits while inside a nested clip).
  // off: what to add to a clip's times to get timeline times; [lo, hi]: where it can be heard; mul: the nested clips' own volume.
  const parts=[];
  const gather=(off,lo,hi,mul,depth)=>{for(const c of this.p.clips){
   const [cs,ce]=c.nest||c.text!==undefined||c.sticker?[c.start,c.start+c.dur]:this.sndSpan(c),s=Math.max(off+cs,lo),e=Math.min(off+ce,hi);if(c.muted||c.text!==undefined||c.sticker||!(c.dur>0)||e-s<.001)continue;
   if(c.nest){if(depth>4||this.trackOf(c)?.muted||(this._mcA&&this.trackOf(c)?.id!==this._mcA))continue;const P=this.p,A=this._mcA,o0=off,vol=T=>{const k=this.p,ka=this._mcA;this.p=P;this._mcA=A;try{return this.vol(c,T-o0);}finally{this.p=k;this._mcA=ka;}};
    this.withNest(c,()=>gather(off+c.start-(c.in||0),s,e,T=>mul(T)*vol(T),depth+1));continue;}
   const m=this.mediaOf(c);if(!m||m.type==='image')continue;if(this.trackOf(c)?.muted||(c.detached&&!c.asAudio)||(this._mcA&&this.trackOf(c)?.id!==this._mcA))continue;
   const len=e-s,steps=Math.max(2,Math.ceil(len*120)),curve=new Float32Array(steps);
   for(let i=0;i<steps;i++){const T=s+Math.min(len*i/(steps-1),len-1e-4);curve[i]=this.vol(c,T-off)*mul(T);}
   parts.push({c,m,s,e,skip:s-(off+c.start),curve,pan:edClamp(this.trackOf(c)?.pan||0,-1,1)});}};
  gather(0,t0,t0+dur,()=>1,0);
  for(const {c,m,s,e,skip,curve,pan:pv} of parts){
   if(!bufs.has(m.id)){const b=await this.get(m.id).catch(()=>null);let buf=null;if(b){try{buf=await oc.decodeAudioData(await b.arrayBuffer());}catch{buf=null;}}bufs.set(m.id,buf);}
   const buf=bufs.get(m.id);if(!buf){silent.add(m.name);continue;} // a video without sound, or a file the browser cannot decode
   const sp=c.speed||1,stretch=!!c.ramp||Math.abs(sp-1)>.001,n=oc.createBufferSource(),g=oc.createGain();
   n.buffer=stretch?edStretch(oc,buf,c.in||0,c.dur,x=>this.srcAt(c,c.start+x)-(c.in||0)):buf;
   // [s, e] is the part of the clip inside the export, in timeline time; `skip` is how far into the clip it starts.
   const len=e-s;
   g.gain.setValueCurveAtTime(curve,s-t0,len);
   const pan=oc.createStereoPanner(),fx=edFxChain(oc);fx.set(c.afx);pan.pan.value=pv;n.connect(fx.input);fx.output.connect(g).connect(pan).connect(oc.destination);n.start(s-t0,stretch?Math.max(0,skip):Math.max(0,(c.in||0)+skip),len);
  }
  if(silent.size)toast('No sound was found in '+[...silent].join(', ')+'. If it has sound, this browser could not read it.');
  return oc.startRendering();
 },
 async exportLive(o){
  if(this.exporting)return;
  if(typeof MediaRecorder==='undefined'||!this.dom.canvas.captureStream)return toast('This browser cannot record video.',true);
  const fps=o.fps,scale=o.height/Math.min(...this.base()),time=this.time;
  const job={scale,format:o.format,fps,name:o.name,studio:!!o.studio,until:o.range?.e,controller:new AbortController()};
  let capture,recorder,startTimer;
  const cleanup=()=>{
   clearTimeout(startTimer);
   capture?.getTracks().forEach(track=>track.stop());
   if(this.exporting!==job)return;
   this.exporting=null;
   if(this.media.some(m=>m.proxy))this.resetElements();
   this.drawExport();this.fit();this.seek(time);
  };
  job.cancel=()=>{
   this.pause();
   if(recorder&&recorder.state!=='inactive')recorder.stop();
   else cleanup();
  };
  this.pause();
  this.exporting=job;
  this.drawExport('Getting ready.');
  try{
   this.audio();
   await this.ac?.resume?.();
   if(job.cancelled)return;
   if(this.media.some(m=>m.proxy))this.resetElements();
   this.pick(null);this.drawTimeline();this.drawProps();this.fit();
   this.rate=1;this.seek(o.range?.s??0);
   capture=this.dom.canvas.captureStream(fps);
   const tracks=[...capture.getVideoTracks(),...(this.rec?this.rec.stream.getAudioTracks():[])];
   const mimeType=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
   const [width,height]=this.size(),bits=Math.round(width*height*fps*.15);
   recorder=new MediaRecorder(new MediaStream(tracks),{mimeType,videoBitsPerSecond:Math.min(60e6,Math.max(4e6,bits))});
   job.rec=recorder;
   const parts=[];
   recorder.ondataavailable=event=>{if(event.data.size)parts.push(event.data);};
   recorder.onerror=()=>{
    if(this.exporting!==job)return;
    job.cancelled=true;
    this.pause();cleanup();
    toast('The browser stopped recording the video.',true);
   };
   recorder.onstop=async()=>{
    if(this.exporting!==job)return;
    capture.getTracks().forEach(track=>track.stop());
    capture=null;
    const webm=new Blob(parts,{type:'video/webm'});
    try{
     if(job.cancelled)return;
     let output=webm,format=job.format;
     if(format==='mp4'){
      this.drawExport('Making the MP4.');
      try{
       const response=await fetch(withKey('/api/editor/mp4?fps='+fps),{method:'POST',body:webm,signal:job.controller.signal});
       if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Could not make the MP4');
       output=await response.blob();
      }catch(error){
       if(job.cancelled)return;
       toast(error.message+'. Saved as WebM instead.',true);
       format='webm';
      }
     }
     if(job.cancelled)return;
     const name=job.name+'.'+format;
     edSaveFile(output,name);
     if(format===job.format){toast('Exported');if(job.studio)this.toStudio(output,name);}
    }finally{cleanup();}
   };
   startTimer=setTimeout(()=>{
    if(this.exporting!==job||job.cancelled)return;
    try{recorder.start(250);this.drawExport('Recording.');this.start();}
    catch(error){cleanup();toast(error.message,true);}
   },400);
  }catch(error){
   if(!job.cancelled){cleanup();toast(error.message,true);}
  }
 },
 /** The frame under the playhead as a PNG, at 1080 on the short side, without selection outlines. */
 async saveFrame(){if(!this.p.clips.length||this.exporting)return;this.pause();const t=this.time;
  this.exporting={scale:1080/Math.min(...this.base()),still:true};if(this.media.some(m=>m.proxy))this.resetElements();
  try{await this.exportReady();await this.seekExact(t);this.time=t;this.draw();const blob=await new Promise(r=>this.dom.canvas.toBlob(r,'image/png'));
   if(!blob)throw new Error('Could not make the picture');edSaveFile(blob,`${this.p.name} ${edFmt(t).replace(/:/g,'.')}.png`);toast('Frame saved');}
  catch(e){toast(e.message,true);}finally{this.exporting=null;if(this.media.some(m=>m.proxy))this.resetElements();this.fit();this.draw();}},
 toStudio(blob,name){edSaveToStudio(blob,name).then(()=>toast('Saved to Studio')).catch(e=>toast(e.message,true));},
 finishExport(){
  const job=this.exporting;
  if(job?.rec?.state==='recording')setTimeout(()=>{
   if(this.exporting===job&&job.rec.state!=='inactive')job.rec.stop();
  },200);
 },
 cancelExport(){
  const job=this.exporting;if(!job||job.cancelled)return;
  job.cancelled=true;job.controller?.abort();
  this.drawExport('Stopping.');
  job.cancel?.();
 },
});
// ---------- clip effects: shake, glow, sharpen, grain ----------
/** Camera shake: a smooth, repeatable wobble (the same at the same time, so preview and export match). */
function edShake(fx,t,W){const a=(fx?.shake||0)/100;if(!a)return [0,0,0];const A=a*.025*W;
 return [A*(Math.sin(t*13.1)+.6*Math.sin(t*29.3+1.3))/1.6,A*(Math.sin(t*11.7+2.1)+.6*Math.sin(t*23.9+.4))/1.6,a*.02*Math.sin(t*9.7+.7)];}
let edNoise=null;
/** Glow (a blurred copy screened on top), sharpen (unsharp mask on the graphics card) and film grain (noise that
 *  changes 24 times a second, mixed in only where the clip is). */
function edLayerFx(L,lg,fx,t,k){const W=L.width,H=L.height;
 if(fx.style&&fx.style!=='none')edStyleFx(L,lg,fx.style,(fx.amount??60)/100,t,k);
 if(fx.sharpen){const out=EdGL.sharpen(L,fx.sharpen/100*1.5);if(out){lg.save();lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='copy';lg.drawImage(out,0,0);lg.restore();}}
 if(fx.glow){const T=edTmp(W,H),tg=T.getContext('2d');tg.clearRect(0,0,W,H);tg.filter=`blur(${Math.round(6+fx.glow/100*24)*k}px) brightness(1.2)`;tg.drawImage(L,0,0);tg.filter='none';
  lg.save();lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='screen';lg.globalAlpha=fx.glow/100*.85;lg.drawImage(T,0,0);lg.restore();}
 if(fx.grain){if(!edNoise){edNoise=document.createElement('canvas');edNoise.width=edNoise.height=256;const ng=edNoise.getContext('2d'),im=ng.createImageData(256,256);let s=12345;
   for(let i=0;i<im.data.length;i+=4){s=(s*16807)%2147483647;const v=96+(s%64);im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}ng.putImageData(im,0,0);}
  const T=edTmp(W,H),tg=T.getContext('2d'),f=Math.floor(t*24);tg.globalCompositeOperation='source-over';tg.clearRect(0,0,W,H);tg.drawImage(L,0,0);
  tg.globalCompositeOperation='overlay';tg.globalAlpha=Math.min(1,fx.grain/100*1.2);tg.fillStyle=tg.createPattern(edNoise,'repeat');tg.save();tg.translate(-((f*97)%256),-((f*61)%256));tg.fillRect(0,0,W+256,H+256);tg.restore();
  tg.globalAlpha=1;tg.globalCompositeOperation='destination-in';tg.drawImage(L,0,0);
  lg.save();lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='copy';lg.drawImage(T,0,0);lg.restore();}}
/** One style effect on a layer (amount 0 to 1): what CapCut calls video effects. The same at the same time, so the export matches. */
function edStyleFx(L,lg,st,a,t,k){const W=L.width,H=L.height,put=T=>{lg.save();lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='copy';lg.globalAlpha=1;lg.filter='none';lg.drawImage(T,0,0);lg.restore();};
 const T=edTmp2(W,H),tg=T.getContext('2d',{willReadFrequently:true});tg.setTransform(1,0,0,1,0,0);tg.globalCompositeOperation='source-over';tg.globalAlpha=1;tg.filter='none';tg.clearRect(0,0,W,H);
 const rnd=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);},f=Math.floor(t*12);
 const shift=(o,rows)=>{const im=lg.getImageData(0,0,W,H),d=im.data,out=tg.createImageData(W,H),q=out.data;
  for(let y=0;y<H;y++){const dx=Math.round(o+(rows?rows(y):0));for(let x=0;x<W;x++){const i=(y*W+x)*4,xr=Math.min(W-1,Math.max(0,x+dx)),xb=Math.min(W-1,Math.max(0,x-dx)),ir=(y*W+xr)*4,ib=(y*W+xb)*4;
   q[i]=d[ir];q[i+1]=d[i+1];q[i+2]=d[ib+2];q[i+3]=Math.max(d[i+3],d[ir+3],d[ib+3]);}}tg.putImageData(out,0,0);put(T);};
 if(st==='rgb')shift(Math.max(1,a*W*.012));
 else if(st==='glitch'){const on=rnd(f)<.35+a*.4;if(!on)return;const n=3+Math.floor(rnd(f+1)*5),cuts=Array.from({length:n},(_,i)=>[Math.floor(rnd(f+i*3)*H),Math.floor(rnd(f+i*3+1)*H*.08)+4,(rnd(f+i*3+2)-.5)*W*.1*a]);
  shift(a*W*.008,y=>{for(const [y0,h,dx] of cuts)if(y>=y0&&y<y0+h)return dx;return 0;});}
 else if(st==='vhs'){shift(Math.max(1,a*W*.004),y=>Math.sin(y*.05+t*9)*a*1.5+(rnd(f+y)<.004*a?W*.02:0));lg.save();lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='source-atop';lg.globalAlpha=.18*a;lg.fillStyle='#000';for(let y=(f%2);y<H;y+=Math.max(2,Math.round(3*k)))lg.fillRect(0,y,W,1);
  lg.globalAlpha=.08*a;lg.fillStyle='#fff';lg.fillRect(0,(t*120*k)%H,W,Math.round(14*k));lg.restore();}
 else if(st==='leak'||st==='burn'){const x=W*(.3+.4*Math.sin(t*.7)),y=H*(.3+.3*Math.cos(t*.5)),gr=lg.createRadialGradient(x,y,0,x,y,Math.max(W,H)*(st==='burn'?.55:.8));
  if(st==='burn'){gr.addColorStop(0,`rgba(255,240,200,${.9*a})`);gr.addColorStop(.35,`rgba(255,120,20,${.7*a})`);gr.addColorStop(1,'rgba(120,0,0,0)');}else{gr.addColorStop(0,`rgba(255,170,90,${.75*a})`);gr.addColorStop(.5,`rgba(255,60,120,${.35*a})`);gr.addColorStop(1,'rgba(255,0,80,0)');}
  lg.save();lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='source-atop';lg.fillStyle=gr;lg.globalCompositeOperation=st==='burn'?'source-atop':'source-atop';lg.fillRect(0,0,W,H);lg.restore();}
 else if(st==='flash'){const v=Math.pow(Math.max(0,Math.sin(t*Math.PI*2*(.5+a*2))),8)*a;lg.save();lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='source-atop';lg.globalAlpha=v;lg.fillStyle='#fff';lg.fillRect(0,0,W,H);lg.restore();}
 else if(st==='mirror'){tg.drawImage(L,0,0,W/2,H,0,0,W/2,H);tg.save();tg.translate(W,0);tg.scale(-1,1);tg.drawImage(L,0,0,W/2,H,0,0,W/2,H);tg.restore();put(T);}
 else if(st==='kaleido'){const w=W/2,h=H/2;for(const [sx,sy] of [[1,1],[-1,1],[1,-1],[-1,-1]]){tg.save();tg.translate(W/2,H/2);tg.scale(sx,sy);tg.drawImage(L,W/2-w/2,H/2-h/2,w,h,-w,-h,w,h);tg.restore();}put(T);}
 else if(st==='pixel'){const s=Math.max(2,Math.round((4+a*36)*k)),w=Math.max(1,Math.round(W/s)),h=Math.max(1,Math.round(H/s));tg.imageSmoothingEnabled=false;tg.drawImage(L,0,0,w,h);tg.drawImage(T,0,0,w,h,0,0,W,H);tg.imageSmoothingEnabled=true;put(T);}
 else if(st==='zoomblur'){tg.drawImage(L,0,0);tg.globalAlpha=.22;for(let i=1;i<=6;i++){const s=1+i*.012*a*2;tg.drawImage(L,W/2-W*s/2,H/2-H*s/2,W*s,H*s);}put(T);}
 else if(st==='motion'){tg.globalAlpha=1/7;for(let i=-3;i<=3;i++)tg.drawImage(L,i*a*W*.006,0);put(T);}
 else if(st==='invert'){tg.filter='invert(1)';tg.drawImage(L,0,0);tg.filter='none';if(a<1){tg.globalAlpha=1-a;tg.drawImage(L,0,0);}put(T);}
}
let edTmpC2=null;function edTmp2(W,H){if(!edTmpC2)edTmpC2=document.createElement('canvas');if(edTmpC2.width!==W||edTmpC2.height!==H){edTmpC2.width=W;edTmpC2.height=H;}return edTmpC2;}
let edTmpC=null;function edTmp(W,H){if(!edTmpC)edTmpC=document.createElement('canvas');if(edTmpC.width!==W||edTmpC.height!==H){edTmpC.width=W;edTmpC.height=H;}
 const g=edTmpC.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.filter='none';return edTmpC;}// a clean state for every use
// ---------- colour grading helpers ----------
/** The colours HSL works on (hue centres in degrees), as in CapCut and Resolve. */
const ED_HSL=[['red','Red',0],['orange','Orange',30],['yellow','Yellow',60],['green','Green',120],['aqua','Aqua',180],['blue','Blue',230],['purple','Purple',275],['magenta','Magenta',320]];
/** One colour's change ({band:{h: degrees, s and l: -100..100}}): each band reaches 45° around its hue, softly, and grey is left alone. */
function edHslAdjust(v,hsl){const [r,g,b]=v,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;if(d<1e-4)return v;
 const s=l>.5?d/(2-mx-mn):d/(mx+mn);let h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;
 let dh=0,ds=0,dl=0;for(const [k,,c] of ED_HSL){const x=hsl[k];if(!x)continue;let dist=Math.abs(h-c);dist=Math.min(dist,360-dist);if(dist>=45)continue;const w=(Math.cos(dist/45*Math.PI)+1)/2*Math.min(1,s*3);dh+=(x.h||0)*w;ds+=(x.s||0)/100*w;dl+=(x.l||0)/100*w;}
 if(!dh&&!ds&&!dl)return v;const H=(((h+dh)%360)+360)%360/360,S=Math.max(0,Math.min(1,s*(1+ds))),Lm=Math.max(0,Math.min(1,l+dl*.5*Math.min(1,s*2)));
 const q=Lm<.5?Lm*(1+S):Lm+S-Lm*S,p=2*Lm-q,f=t=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};return [f(H+1/3),f(H),f(H-1/3)];}
const edGraded=g=>!!(g&&(g.hsl&&Object.values(g.hsl).some(x=>x&&(x.h||x.s||x.l))||['lift','gamma','gain'].some(k=>g[k]&&(g[k].l||g[k].x||g[k].y))||['m','r','g','b'].some(k=>g.curves?.[k]?.length>2||g.curves?.[k]?.some(([x,y])=>Math.abs(x-y)>1e-3))||(g.lut?.id&&(g.lut.mix??1)>0)));
/** A smooth curve through points [[x,y],...] that never overshoots (monotone cubic, Fritsch-Carlson). */
function edCurveFn(pts){const p=[...(pts||[[0,0],[1,1]])].sort((a,b)=>a[0]-b[0]);const n=p.length;if(n<2)return x=>x;
 const d=[],m=[];for(let i=0;i<n-1;i++)d.push((p[i+1][1]-p[i][1])/((p[i+1][0]-p[i][0])||1e-6));m[0]=d[0];m[n-1]=d[n-2];
 for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
 for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=m[i+1]=0;continue;}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}}
 return x=>{if(x<=p[0][0])return p[0][1];if(x>=p[n-1][0])return p[n-1][1];let i=0;while(x>p[i+1][0])i++;const h=p[i+1][0]-p[i][0],t=(x-p[i][0])/h,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*p[i][1]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*p[i+1][1]+(t3-t2)*h*m[i+1];};}
/** A .cube file: {n, data: Float32Array of n^3 RGB, red changing fastest}. */
function edParseCube(text){let n=0,lo=[0,0,0],hi=[1,1,1];const v=[];
 for(const raw of String(text).split(/\r?\n/)){const l=raw.trim();if(!l||l[0]==='#')continue;const w=l.split(/\s+/);
  if(/^LUT_3D_SIZE$/i.test(w[0]))n=+w[1];else if(/^DOMAIN_MIN$/i.test(w[0]))lo=w.slice(1,4).map(Number);else if(/^DOMAIN_MAX$/i.test(w[0]))hi=w.slice(1,4).map(Number);
  else if(/^[-+0-9.eE]+$/.test(w[0])&&w.length>=3)v.push(+w[0],+w[1],+w[2]);}
 if(!(n>=2&&n<=129)||v.length<n*n*n*3)return null;const data=new Float32Array(n*n*n*3);for(let i=0;i<data.length;i++){const c=i%3;data[i]=(v[i]-lo[c])/((hi[c]-lo[c])||1);}return {n,data};}
function edSampleCube(L,r,g,b){const n=L.n,f=x=>Math.min(n-1,Math.max(0,x*(n-1))),R=f(r),G=f(g),B=f(b),r0=Math.floor(R),g0=Math.floor(G),b0=Math.floor(B),r1=Math.min(n-1,r0+1),g1=Math.min(n-1,g0+1),b1=Math.min(n-1,b0+1),fr=R-r0,fg=G-g0,fb=B-b0;
 const at=(i,j,k,c)=>L.data[((k*n+j)*n+i)*3+c],out=[0,0,0];
 for(let c=0;c<3;c++){const c00=at(r0,g0,b0,c)*(1-fr)+at(r1,g0,b0,c)*fr,c10=at(r0,g1,b0,c)*(1-fr)+at(r1,g1,b0,c)*fr,c01=at(r0,g0,b1,c)*(1-fr)+at(r1,g0,b1,c)*fr,c11=at(r0,g1,b1,c)*(1-fr)+at(r1,g1,b1,c)*fr;
  out[c]=(c00*(1-fg)+c10*fg)*(1-fb)+(c01*(1-fg)+c11*fg)*fb;}return out;}
/** Wheels (lift for shadows, gamma for midtones, gain for highlights: a colour push and a brightness),
 *  then the curves (master, then red, green, blue), then the imported look at its mix: one 33-point table (RGBA bytes). */
function edBuildLut(g,look){const N=33,out=new Uint8Array(N*N*N*4);
 const push=w=>{const x=w?.x||0,y=w?.y||0,s=Math.min(1,Math.hypot(x,y)),a=Math.atan2(y,x);return [0,1,2].map(c=>s*Math.cos(a-c*2*Math.PI/3));};
 const lp=push(g.lift),mp=push(g.gamma),hp=push(g.gain),ll=g.lift?.l||0,ml=g.gamma?.l||0,hl=g.gain?.l||0;
 const lift=[0,1,2].map(c=>ll*.25+lp[c]*.12),gain=[0,1,2].map(c=>1+hl*.5+hp[c]*.25),gam=[0,1,2].map(c=>1/Math.max(.2,1+ml*.8+mp[c]*.3));
 const cv=g.curves||{},M=edCurveFn(cv.m),C=[edCurveFn(cv.r),edCurveFn(cv.g),edCurveFn(cv.b)],mix=look?Math.min(1,Math.max(0,g.lut?.mix??1)):0;
 const cl=x=>x<0?0:x>1?1:x,hsl=g.hsl&&Object.values(g.hsl).some(x=>x&&(x.h||x.s||x.l))?g.hsl:null;
 for(let b=0;b<N;b++)for(let gg=0;gg<N;gg++)for(let r=0;r<N;r++){let v=[r/(N-1),gg/(N-1),b/(N-1)];
  v=v.map((x,c)=>Math.pow(cl(x*gain[c]+lift[c]*(1-x)),gam[c]));v=v.map((x,c)=>cl(C[c](cl(M(x)))));
  if(hsl)v=edHslAdjust(v,hsl);
  if(mix){const l=edSampleCube(look,v[0],v[1],v[2]);v=v.map((x,c)=>x+(l[c]-x)*mix);}
  const o=((b*N+gg)*N+r)*4;out[o]=Math.round(cl(v[0])*255);out[o+1]=Math.round(cl(v[1])*255);out[o+2]=Math.round(cl(v[2])*255);out[o+3]=255;}
 return {n:N,data:out};}
/** The table on the graphics card (WebGL): every pixel of the layer looked up, with trilinear blending. */
const EdGL={
 apply(src,lut){try{const gl=this.ctx(src.width,src.height);if(!gl)return null;
  gl.bindTexture(gl.TEXTURE_2D,this.img);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
  if(this.lutRef!==lut){gl.bindTexture(gl.TEXTURE_2D,this.lut);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,lut.n*lut.n,lut.n,0,gl.RGBA,gl.UNSIGNED_BYTE,
   // table rows: green; columns: red + blue*n (red fastest), as edBuildLut writes b,g,r -> reorder to (g)(b,r)
   this.reorder(lut));this.lutRef=lut;}
  gl.useProgram(this.prog);gl.uniform1f(this.uN,lut.n);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.img);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.lut);
  gl.viewport(0,0,src.width,src.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return this.canvas;}catch{return null;}},
 sharpen(src,amount){try{const gl=this.ctx(src.width,src.height);if(!gl)return null;
  if(!this.sp){const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return x;},p=this.sp=gl.createProgram();
   gl.attachShader(p,sh(gl.VERTEX_SHADER,'attribute vec2 a;varying vec2 uv;void main(){uv=(a+1.)/2.;gl_Position=vec4(a,0.,1.);}'));
   gl.attachShader(p,sh(gl.FRAGMENT_SHADER,`precision highp float;uniform sampler2D img;uniform vec2 px;uniform float amt;varying vec2 uv;
    void main(){vec4 c=texture2D(img,uv);vec4 b=(texture2D(img,uv+vec2(px.x,0.))+texture2D(img,uv-vec2(px.x,0.))+texture2D(img,uv+vec2(0.,px.y))+texture2D(img,uv-vec2(0.,px.y)))*.25;
     vec3 o=clamp(c.rgb+(c.rgb-b.rgb)*amt,0.,1.);gl_FragColor=vec4(o*c.a,c.a);}`));gl.linkProgram(p);this.spA=gl.getAttribLocation(p,'a');this.spPx=gl.getUniformLocation(p,'px');this.spAmt=gl.getUniformLocation(p,'amt');}
  gl.useProgram(this.sp);gl.enableVertexAttribArray(this.spA);gl.vertexAttribPointer(this.spA,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.img);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
  gl.uniform1i(gl.getUniformLocation(this.sp,'img'),0);gl.uniform2f(this.spPx,1/src.width,1/src.height);gl.uniform1f(this.spAmt,amount*3);
  gl.viewport(0,0,src.width,src.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.useProgram(this.prog);return this.canvas;}catch{return null;}},
 reorder(l){const n=l.n,o=new Uint8Array(n*n*n*4);for(let b=0;b<n;b++)for(let g=0;g<n;g++)for(let r=0;r<n;r++){const s=((b*n+g)*n+r)*4,d=(g*n*n+b*n+r)*4;o[d]=l.data[s];o[d+1]=l.data[s+1];o[d+2]=l.data[s+2];o[d+3]=255;}return o;},
 ctx(w,h){if(!this.canvas){const c=this.canvas=document.createElement('canvas');const gl=this.gl=c.getContext('webgl',{premultipliedAlpha:true,preserveDrawingBuffer:true});if(!gl)return null;
   const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return x;},p=this.prog=gl.createProgram();
   gl.attachShader(p,sh(gl.VERTEX_SHADER,'attribute vec2 a;varying vec2 uv;void main(){uv=(a+1.)/2.;gl_Position=vec4(a,0.,1.);}'));
   gl.attachShader(p,sh(gl.FRAGMENT_SHADER,`precision highp float;uniform sampler2D img;uniform sampler2D lut;uniform float N;varying vec2 uv;
    vec3 look(vec3 c){float b=c.b*(N-1.);float b0=floor(b);float b1=min(b0+1.,N-1.);float f=b-b0;float x=c.r*(N-1.)+.5;float y=(c.g*(N-1.)+.5)/N;
     return mix(texture2D(lut,vec2((x+b0*N)/(N*N),y)).rgb,texture2D(lut,vec2((x+b1*N)/(N*N),y)).rgb,f);}
    void main(){vec4 s=texture2D(img,uv);if(s.a<=0.){gl_FragColor=vec4(0.);return;}gl_FragColor=vec4(look(clamp(s.rgb,0.,1.))*s.a,s.a);}`));
   gl.linkProgram(p);gl.useProgram(p);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   const a=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   const tex=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t;};
   this.img=tex();this.lut=tex();gl.uniform1i(gl.getUniformLocation(p,'img'),0);gl.uniform1i(gl.getUniformLocation(p,'lut'),1);this.uN=gl.getUniformLocation(p,'N');}
  if(!this.gl)return null;if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}return this.gl;},
};
// ---------- green screen ----------
/** Keys out a colour (in place, RGBA): distance in the colour plane (Cb/Cr) gives transparency; spill takes the
 *  key colour's tint off the edges. Similarity, smoothness and spill are 0-100 as in the panel. */
function edKey(d,k){
 const hex=String(k.color||'#00b140'),kr=parseInt(hex.slice(1,3),16),kg=parseInt(hex.slice(3,5),16),kb=parseInt(hex.slice(5,7),16);
 const cb=(r,g,b)=>-.168736*r-.331264*g+.5*b,cr=(r,g,b)=>.5*r-.418688*g-.081312*b,kcb=cb(kr,kg,kb),kcr=cr(kr,kg,kb);
 const sim=(k.sim??25)/100*120,smooth=Math.max(1,(k.smooth??10)/100*120),spill=(k.spill??50)/100,ch=kg>=kr&&kg>=kb?1:kb>=kr?2:0;
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const r=d[i],g=d[i+1],b=d[i+2],dist=Math.hypot(cb(r,g,b)-kcb,cr(r,g,b)-kcr),a=Math.min(1,Math.max(0,(dist-sim)/smooth));
  if(a<1)d[i+3]=d[i+3]*a;
  if(spill&&a<1.0001){const o1=d[i+(ch+1)%3],o2=d[i+(ch+2)%3],lim=Math.max(o1,o2),v=d[i+ch];if(v>lim)d[i+ch]=v-(v-lim)*spill*(1-a*.5);}}
}
