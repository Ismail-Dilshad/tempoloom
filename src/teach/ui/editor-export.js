'use strict';
// Editor, export: every frame drawn at its exact time and encoded (WebCodecs), the sound mixed offline, GIF and sound-only files; and the encoders' helpers (IVF, WAV, pitch-keeping stretch).
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 // ---------- exporting: every frame drawn at its exact time and encoded (WebCodecs), the sound mixed offline;
 // ffmpeg on this computer puts them together. Browsers without WebCodecs record while it plays (exportLive). ----------
 /** Sound only: the mix of the whole video (or in to out) as WAV, or MP3 made by ffmpeg here. */
 async exportSound(o){
  if(this.exporting)return;const span=o.range||{s:0,e:this.end()};this.pause();this.exporting={offline:true,format:o.format,name:o.name};this.drawExport('Mixing the sound…');
  try{await this.ensureEnvs();let out=edWav(await this.mixAudio(span.s,span.e-span.s));
   if(o.format==='mp3'){this.drawExport('Making the MP3…');const r=await fetch(withKey('/api/editor/audio?format=mp3'),{method:'POST',body:out});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Could not make the MP3');out=await r.blob();}
   edSaveFile(out,o.name+'.'+o.format);toast('Sound exported');}
  catch(e){toast('Export stopped: '+(e?.message||e),true);}finally{this.exporting=null;this.drawExport();}},
 async exportVideo(o){
  if(this.exporting)return;while(this.stack?.length)this.exitNest();// the export is of the whole timeline
  if(o.format==='mp3'||o.format==='wav')return this.exportSound(o);
  if(o.live&&o.format!=='gif')return this.exportLive(o);
  // GIF: at most 15 frames a second and 480 on the short side, so the file stays a sensible size
  if(o.format==='gif'){o={...o,fps:Math.min(o.fps,15),height:Math.min(o.height,480)};}
  const quality={standard:.08,high:.12,best:.2}[o.quality||'high']||.12,crf={standard:23,high:19,best:16}[o.quality||'high']||19;
  const scale=o.height/Math.min(...this.base()),fps=o.fps,t0=this.time;
  this.pause();
  this.exporting={scale,format:o.format,fps,name:o.name,studio:!!o.studio,offline:true};if(this.media.some(m=>m.proxy))this.resetElements();
  const ex=this.exporting,[W,H]=this.size(),cfg=await edVideoConfig(W,H,fps,Math.min(80e6,Math.max(4e6,Math.round(W*H*fps*quality))));
  if(!cfg){this.exporting=null;if(o.format==='gif')return toast('This browser cannot make a GIF (no WebCodecs).',true);return this.exportLive(o);}
  this.pick(null);this.drawTimeline();this.drawProps();this.fit();this.drawExport('Getting ready…');
  const span=o.range||{s:0,e:this.end()},frames=Math.max(1,Math.ceil((span.e-span.s)*fps-1e-6)),chunks=[];let err=null;
  try{
   await this.exportReady();
   this.drawExport('Mixing the sound…');
   await this.ensureEnvs();const wav=edWav(await this.mixAudio(span.s,frames/fps));if(ex.cancelled)return;
   const enc=ex.enc=new VideoEncoder({output:ch=>{const b=new Uint8Array(ch.byteLength);ch.copyTo(b);chunks.push({b,pts:Math.round(ch.timestamp*fps/1e6)});},error:e=>{err=e;}});
   enc.configure(cfg);
   for(let i=0;i<frames&&!ex.cancelled;i++){
    if(err)throw err;
    const t=span.s+i/fps;this.time=t;await this.seekExact(t);if(ex.cancelled)break;this.time=t;this.draw();
    const f=new VideoFrame(this.dom.canvas,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});
    enc.encode(f,{keyFrame:i%(fps*2)===0});f.close();
    while(enc.encodeQueueSize>4&&!err)await new Promise(r=>setTimeout(r,2));
    if(i%4===0){this.drawExport(`Exporting… ${Math.floor(i/frames*90)}%`);this.drawHead();this.drawTime();}
   }
   if(ex.cancelled)return;
   await enc.flush();if(err)throw err;enc.close();
   const ivf=edIvf(chunks,W,H,fps,cfg.codec.startsWith('vp09')?'VP90':'VP80');chunks.length=0;
   this.drawExport(ex.format==='mp4'?'Making the MP4…':'Making the WebM…');
   const r=await fetch(withKey(`/api/editor/mux?fps=${fps}&format=${ex.format}&crf=${crf}&v=${ivf.size}`),{method:'POST',body:new Blob([ivf,wav])});
   if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Could not make the video');
   if(ex.cancelled)return;
   const out=await r.blob(),name=ex.name+'.'+ex.format;edSaveFile(out,name);toast(`Exported (${frames} frames)`);if(ex.studio)this.toStudio(out,name);
  }catch(e){if(!ex.cancelled)toast('Export stopped: '+(e?.message||e),true);}
  finally{try{if(ex.enc&&ex.enc.state!=='closed')ex.enc.close();}catch{}
   this.exporting=null;if(this.media.some(m=>m.proxy))this.resetElements();this.drawExport();this.fit();this.time=Math.min(t0,this.end());this.sync();this.draw();this.drawHead();this.drawTime();}
 },
 /** Before the first frame: the fonts of every text, every picture decoded, every video able to show a frame. */
});
// ---------- export helpers ----------
/** A WebCodecs encoder setting this browser supports: VP9, else VP8 (both go in IVF, which ffmpeg reads). */
async function edVideoConfig(W,H,fps,bitrate){
 if(typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined'||typeof OfflineAudioContext==='undefined')return null;
 for(const codec of ['vp09.00.51.08','vp09.00.41.08','vp8']){const cfg={codec,width:W,height:H,bitrate,framerate:fps,latencyMode:'quality'};
  try{if((await VideoEncoder.isConfigSupported(cfg)).supported)return cfg;}catch{}}
 return null;
}
function edWaitFor(el,ev,ms,msg){return new Promise((res,rej)=>{const to=setTimeout(()=>{el.removeEventListener(ev,ok);rej(new Error(msg));},ms),ok=()=>{clearTimeout(to);res();};el.addEventListener(ev,ok,{once:true});});}
/** Resolves once the video can show a frame (it may be loading or in the middle of a seek). */
function edReady(el,name){if(el.readyState>=2&&!el.seeking)return Promise.resolve();
 return new Promise((res,rej)=>{const evs=['loadeddata','canplay','seeked'],done=()=>{if(el.readyState<2||el.seeking)return;clear();res();},clear=()=>{clearTimeout(to);evs.forEach(v=>el.removeEventListener(v,done));};
  const to=setTimeout(()=>{clear();rej(new Error('The video '+name+' did not load'));},20000);evs.forEach(v=>el.addEventListener(v,done));});}
function edSeek(el,t,name){const p=edWaitFor(el,'seeked',15000,'The video '+name+' did not show its frame in time');try{el.currentTime=t;}catch{}return p;}
/** Encoded frames in an IVF file: a 32-byte header, then each frame with its size and time (in frames). */
function edIvf(chunks,W,H,fps,fourcc){
 const h=new DataView(new ArrayBuffer(32)),ascii=(o,s)=>{for(let i=0;i<s.length;i++)h.setUint8(o+i,s.charCodeAt(i));};
 ascii(0,'DKIF');h.setUint16(4,0,true);h.setUint16(6,32,true);ascii(8,fourcc);h.setUint16(12,W,true);h.setUint16(14,H,true);h.setUint32(16,fps,true);h.setUint32(20,1,true);h.setUint32(24,chunks.length,true);
 const parts=[h.buffer];for(const c of chunks){const f=new DataView(new ArrayBuffer(12));f.setUint32(0,c.b.length,true);f.setUint32(4,c.pts,true);f.setUint32(8,0,true);parts.push(f.buffer,c.b);}
 return new Blob(parts);
}
/** 16-bit PCM WAV of an AudioBuffer. */
function edWav(b){
 const ch=b.numberOfChannels,n=b.length,bytes=n*ch*2,d=new DataView(new ArrayBuffer(44+bytes)),s=(o,t)=>{for(let i=0;i<t.length;i++)d.setUint8(o+i,t.charCodeAt(i));};
 s(0,'RIFF');d.setUint32(4,36+bytes,true);s(8,'WAVE');s(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,ch,true);d.setUint32(24,b.sampleRate,true);d.setUint32(28,b.sampleRate*ch*2,true);d.setUint16(32,ch*2,true);d.setUint16(34,16,true);s(36,'data');d.setUint32(40,bytes,true);
 const cs=[];for(let k=0;k<ch;k++)cs.push(b.getChannelData(k));let o=44;
 for(let i=0;i<n;i++)for(let k=0;k<ch;k++){const v=Math.max(-1,Math.min(1,cs[k][i]));d.setInt16(o,v<0?v*32768:v*32767,true);o+=2;}
 return new Blob([d.buffer],{type:'audio/wav'});
}
/** Plays srcDur seconds from inT at `rate` without changing the pitch (WSOLA: overlapping windows, each placed where it
 * best continues the last one). `map` gives the file position (seconds after inT) for each output second, so a
 *  constant speed and a speed curve both work. This is what the player does for a faster or slower clip. */
function edStretch(oc,buf,inT,outDur,map){
 const sr=buf.sampleRate,ch=buf.numberOfChannels,a0=Math.min(buf.length-1,Math.max(0,Math.floor(inT*sr))),n=Math.max(1,Math.min(buf.length-a0,Math.ceil(map(outDur)*sr)+2048));
 const outN=Math.max(1,Math.round(outDur*sr)),out=oc.createBuffer(ch,outN,sr),N=2048,Hs=N/2,tol=512,win=new Float32Array(N);
 for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/N);
 const ins=[],outs=[];for(let k=0;k<ch;k++){ins.push(buf.getChannelData(k).subarray(a0,a0+n));outs.push(out.getChannelData(k));}
 const mono=ins[0];let prev=-1;
 for(let o=0,j=0;o<outN;o+=Hs,j++){
  const nominal=Math.min(Math.max(0,n-N),Math.round(map(o/sr)*sr));let best=nominal;
  if(prev>=0){const target=prev+Hs;let bc=-Infinity;
   for(let s=Math.max(0,nominal-tol);s<=Math.min(Math.max(0,n-N),nominal+tol);s+=8){let cc=0;for(let i=0;i<Hs;i+=4)cc+=mono[s+i]*(mono[target+i]||0);if(cc>bc){bc=cc;best=s;}}}
  for(let k=0;k<ch;k++){const I=ins[k],O=outs[k];for(let i=0;i<N&&o+i<outN;i++)O[o+i]+=(I[best+i]||0)*win[i];}
  prev=best;
 }
 return out;
}
