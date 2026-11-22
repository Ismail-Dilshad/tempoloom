'use strict';
// Editor, sound: ducking under speech, loudness matching (BS.1770), and the per-clip effects chain (equaliser, compressor, reverb); the sound helpers.
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 // ---------- ducking: music goes down while someone speaks ----------
 /** Clips that count as speech: every clip with sound that is not itself ducked. */
 voices(){return this.p.clips.filter(c=>c.media&&!c.duck&&!this.trackOf(c)?.muted&&!(c.detached&&!c.asAudio)&&this.mediaOf(c)?.type!=='image');},
 /** 0..1 at 20 per second: how far ducked clips are pulled down. Speech holds it, it eases in 0.15 s early and out over 0.5 s. */
 duckCurve(){if(this._dk)return this._dk;const R=20,n=Math.ceil(this.end()*R)+2,on=new Float32Array(n);
  for(const c of this.voices()){const m=this.mediaOf(c);if(!m.env){this.loadEnv(m);continue;}const sp=c.speed||1;
   for(let i=Math.ceil(c.start*R);i<=Math.floor((c.start+c.dur)*R)&&i<n;i++){const e=m.env[Math.floor(((c.in||0)+(i/R-c.start)*sp)*R)]||0;if(e>.02)on[i]=1;}}
  const d=new Float32Array(n),hold=Math.round(.3*R);let last=-1e9;
  for(let i=0;i<n;i++){if(on[i])last=i;d[i]=i-last<=hold?1:Math.max(0,(i>0?d[i-1]:0)-1/(.5*R));}
  for(let i=n-2;i>=0;i--)d[i]=Math.max(d[i],d[i+1]-1/(.15*R));
  return this._dk=d;},
 duckAt(t,c){const d=this.duckCurve(),x=t*20,i=Math.floor(x),a=d[i]||0,b=d[i+1]||0;return edDb((c.duck.db??-12)*(a+(b-a)*(x-i)));},
 /** The loudness over time of a file (RMS, 20 per second), read once and kept with the file. */
 envp:new Map(),
 loadEnv(m){if(m.env)return;if(this.envp.has(m.id))return this.envp.get(m.id);
  const p=(async()=>{try{const b=await this.get(m.id);const buf=b&&await edDecode(b);m.env=buf?edEnvelope(buf,20):[];}catch{m.env=[];}
   this._dk=null;this.save();if(!this.playing)this.sync();})();this.envp.set(m.id,p);return p;},
 async ensureEnvs(){if(!this.p.clips.some(c=>c.duck))return;await Promise.all(this.voices().map(c=>this.loadEnv(this.mediaOf(c))));this._dk=null;},
 setDuck(c,on,db){this.snapshot();if(on)c.duck={db:db??c.duck?.db??-12};else delete c.duck;this.after(true);if(on)this.ensureEnvs().then(()=>{this.sync();});},
 // ---------- loudness: match a clip to a target (EBU R128 / BS.1770 integrated loudness) ----------
 async loudnessOf(m){if(typeof m.lufs==='number'||m.lufs===null)return m.lufs;const b=await this.get(m.id);const buf=b&&await edDecode(b).catch(()=>null);m.lufs=buf?await edLufs(buf):null;this.save();return m.lufs;},
 async matchLoudness(list,target=-14){
  const done=[],none=[];const want=list.filter(c=>c.media&&this.mediaOf(c)?.type!=='image');if(!want.length)return toast('Choose a clip with sound.');
  for(const c of want){const m=this.mediaOf(c),l=await this.loudnessOf(m);if(l==null||!isFinite(l))none.push(m.name);else done.push([c,edClamp(target-l,-20,20)]);}
  if(done.length){this.snapshot();for(const [c,g] of done)c.gainDb=Math.round(g*10)/10;this.after(true);}
  toast(done.length?`Loudness matched to ${target} LUFS${done.length>1?` on ${done.length} clips`:''}${none.length?`; no sound in ${none.join(', ')}`:''}`:'No sound was found to measure.');
 },
 sync(t=this.time){
  for(const c of this.p.clips){
   if(c.nest){if((this._depth||0)>4)continue;const on=t>=c.start&&t<c.start+c.dur,vm=on?this.vol(c,t):0,K=this._vm;this._vm=(K??1)*vm;this._depth=(this._depth||0)+1;
    try{this.withNest(c,()=>this.sync(on?t-c.start+(c.in||0):-100));}finally{this._vm=K;this._depth--;}continue;}
   if(c.text!==undefined||c.sticker)continue;const m=this.mediaOf(c);if(!m||m.type==='image')continue;
   const el=this.element(c);if(!el)continue;
   const on=t>=c.start&&t<c.start+c.dur,want=this.srcAt(c,t);
   if(on){
    const fwd=this.playing&&this.rate>0;
    el.playbackRate=edClamp(this.rateAt(c,t)*(fwd?this.rate:1),.0625,16);const v=this.vol(c,t);if(el._gain){el.volume=1;el._gain.gain.value=v;if(el._pan)el._pan.pan.value=edClamp(this.trackOf(c)?.pan||0,-1,1);if(el._fx)el._fx.set(c.afx);}else el.volume=Math.min(1,v);
    if(fwd){if(el.paused){try{el.currentTime=want;}catch{}el.play().catch(()=>{});}else if(Math.abs(el.currentTime-want)>.3*Math.max(1,this.rate))el.currentTime=want;}
    else{if(!el.paused)el.pause();if(Math.abs(el.currentTime-want)>.03){try{el.currentTime=want;}catch{}}}
   }else{if(!el.paused)el.pause();
    // Just before or after its turn, a clip waits on its first or last frame (for transitions).
    const pre=c.start-t>0&&c.start-t<1.5,post=t-(c.start+c.dur)>=0&&t-(c.start+c.dur)<1.5;
    if(pre||post){const w=pre?(c.in||0):this.srcAt(c,c.start+c.dur)-.05;if(Math.abs(el.currentTime-w)>.06){try{el.currentTime=Math.max(0,w);}catch{}}}}
  }
 },
 rate:1,
 play(){
  if(this.playing)return this.pause();
  this.rate=1;this.start();
 },
 start(){
  if(!this.p.clips.length)return;
  this.audio();this.ac?.resume?.();
  if(this.rate>0&&this.time>=this.end()-.05)this.time=0;
  if(this.rate<0&&this.time<=.05)this.time=this.end();
  this.playing=true;this.t0=this.time;this.p0=performance.now();this.drawTime();
  const tick=now=>{
   if(!this.playing)return;
   if(!document.contains(this.dom.canvas)){this.pause();return;}
   this.time=this.t0+(now-this.p0)/1000*this.rate;
   if(this.time<=0&&this.rate<0){this.time=0;this.pause();return;}
   const end=this.exporting?.until??this.span?.e??this.end();
   if(this.time>=end){
    // Loop: back to the start of what is playing (the in-out part, or the whole timeline) and keep going.
    if(this.loop&&!this.exporting&&this.rate>0){this.time=this.t0=this.span?.s??0;this.p0=now;this.sync();}
    else{this.time=end;this.pause();if(this.exporting)this.finishExport();return;}}
   this.sync();this.draw();this.drawHead();this.drawTime();this.drawMeter?.();
   requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
 },
 pause(){this.playing=false;this.span=null;this._mcSnap=false;for(const el of Object.values(this.els))el.pause?.();if(this.p){this.sync();this.draw();this.drawTime();this.drawMeter?.();}},
 /** Play only between the in and out marks (Ctrl+Shift+Space); with loop on, round and round. */
 playRange(){const r=this.rangeSpan();if(!r)return toast('Mark an in and an out first (I, O).');if(this.playing)this.pause();this.span=r;this.time=r.s;this.rate=1;this.start();},
 toggleLoop(){this.loop=!this.loop;this.drawTime();toast(this.loop?'Loop on':'Loop off');},
 /** Scrubbing: while the playhead is dragged, a short burst of the sound under it (as in Resolve and Premiere). */
 scrub(){if(this.playing||!this.p?.clips.length)return;this.audio();this.ac?.resume?.();const t=this.time;
  const go=(t,d)=>{for(const c of this.p.clips){if(t<c.start||t>=c.start+c.dur||!this.vol(c,t))continue;
   if(c.nest){if(d<4)this.withNest(c,()=>go(t-c.start+(c.in||0),d+1));continue;}const el=this.els[(this._nk||'')+c.id];if(el?.play&&el.paused)el.play().catch(()=>{});}};go(t,0);
  clearTimeout(this._scrubT);this._scrubT=setTimeout(()=>{if(!this.playing)for(const el of Object.values(this.els))el.pause?.();},90);},
 seek(t){this.time=Math.max(0,Math.min(t,Math.max(this.end(),0)));if(this.playing){this.t0=this.time;this.p0=performance.now();}this.sync();this.draw();this.drawHead();this.drawTime();if(!this.playing&&this.sel&&this.clip(this.sel)?.kf)this.drawProps();},
});
// ---------- sound effects: equaliser (low, mid, high), compressor, reverb ----------
/** One clip's chain: low shelf (120 Hz), mid bell (1.2 kHz), high shelf (6 kHz), a compressor, and a reverb
 *  (a made-up room, mixed in). set(afx) applies {low,mid,high in dB, comp 0-100, reverb 0-100}. Works in an
 *  AudioContext (the player) and an OfflineAudioContext (the export) alike. */
/** Voices for the voice changer: a pitch (semitones) and a colour (filters, ring modulation, echo). */
const ED_VOICES=[['','None'],['deep','Deep',{pitch:-5}],['high','High',{pitch:5}],['chipmunk','Chipmunk',{pitch:10}],['robot','Robot',{ring:55}],
 ['radio','Radio',{hp:450,lp:3200}],['phone','Phone',{hp:320,lp:3000,pitch:0}],['megaphone','Megaphone',{hp:700,lp:2600,drive:true}],['echo','Echo',{echo:.28}],['monster','Monster',{pitch:-9,ring:30}]];
/** Load the pitch worklet into a context once (the player's and each export's); false if this browser cannot. */
function edPitchModule(ac){if(!ac?.audioWorklet)return Promise.resolve(false);return ac._pitchP||(ac._pitchP=ac.audioWorklet.addModule(withKey('/editor-pitch.js')).then(()=>(ac._pitch=true)).catch(()=>false));}
function edFxChain(ac){
 const input=ac.createGain(),lo=ac.createBiquadFilter(),mid=ac.createBiquadFilter(),hi=ac.createBiquadFilter(),comp=ac.createDynamicsCompressor(),dry=ac.createGain(),wet=ac.createGain(),rev=ac.createConvolver(),output=ac.createGain();
 lo.type='lowshelf';lo.frequency.value=120;mid.type='peaking';mid.frequency.value=1200;mid.Q.value=.9;hi.type='highshelf';hi.frequency.value=6000;
 const len=Math.round(ac.sampleRate*1.8),ir=ac.createBuffer(2,len,ac.sampleRate);let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647*2-1;};
 for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=rnd()*Math.pow(1-i/len,3.2);}rev.buffer=ir;
 // voice changer: band (high-pass, low-pass), drive, ring modulation (robot), echo; and the pitch worklet when used
 const hp=ac.createBiquadFilter(),lp=ac.createBiquadFilter(),sh=ac.createWaveShaper(),rm=ac.createGain(),osc=ac.createOscillator(),og=ac.createGain(),dl=ac.createDelay(1),fb=ac.createGain(),ew=ac.createGain();
 hp.type='highpass';hp.frequency.value=10;lp.type='lowpass';lp.frequency.value=22000;osc.frequency.value=55;og.gain.value=0;osc.connect(og);og.connect(rm.gain);osc.start();
 dl.delayTime.value=.28;fb.gain.value=0;ew.gain.value=0;
 const curve=k=>{const n=1024,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=k?Math.tanh(x*k)/Math.tanh(k):x;}return c;};
 input.connect(lo);lo.connect(mid);mid.connect(hi);hi.connect(hp);hp.connect(lp);lp.connect(sh);sh.connect(rm);rm.connect(comp);comp.connect(dry);comp.connect(rev);rev.connect(wet);dry.connect(output);wet.connect(output);
 comp.connect(dl);dl.connect(fb);fb.connect(dl);dl.connect(ew);ew.connect(output);
 let pn=null;
 const pitch=semis=>{if(!semis&&!pn)return;if(!pn){if(!ac._pitch)return false;try{pn=new AudioWorkletNode(ac,'ed-pitch',{outputChannelCount:[2]});input.disconnect();input.connect(pn);pn.connect(lo);}catch{pn=null;return false;}}
  pn.parameters.get('ratio').value=Math.pow(2,(semis||0)/12);};
 let last='';
 const set=a=>{const k=JSON.stringify(a||{})+!!ac._pitch;if(k===last)return;last=k;a=a||{};
  const v=ED_VOICES.find(x=>x[0]===a.voice)?.[2]||{};
  hp.frequency.value=v.hp||10;lp.frequency.value=v.lp||22000;sh.curve=curve(v.drive?4:0);
  rm.gain.value=v.ring?0:1;og.gain.value=v.ring?1:0;osc.frequency.value=v.ring||55;
  fb.gain.value=v.echo?.35:0;ew.gain.value=v.echo?.5:0;dl.delayTime.value=v.echo||.28;
  if(pitch((a.pitch||0)+(v.pitch||0))===false)last='';lo.gain.value=a.low||0;mid.gain.value=a.mid||0;hi.gain.value=a.high||0;
  const c=(a.comp||0)/100;comp.threshold.value=-50*c;comp.ratio.value=1+11*c;comp.knee.value=c?12:0;comp.attack.value=.005;comp.release.value=.2;
  const r=(a.reverb||0)/100;wet.gain.value=r*.6;dry.gain.value=1-r*.25;};
 set({});return {input,output,set};}
// ---------- sound helpers ----------
const edDb=db=>Math.pow(10,db/20);
async function edDecode(blob){const ac=new OfflineAudioContext(1,1,48000);return ac.decodeAudioData(await blob.arrayBuffer());}
/** RMS of all channels, `rate` values per second, rounded (kept with the file). */
function edEnvelope(buf,rate){const N=Math.max(1,Math.round(buf.sampleRate/rate)),n=Math.ceil(buf.length/N),ch=[],out=new Array(n);for(let k=0;k<buf.numberOfChannels;k++)ch.push(buf.getChannelData(k));
 for(let i=0;i<n;i++){let z=0,c=0;for(const d of ch)for(let j=i*N;j<Math.min(d.length,(i+1)*N);j+=2){z+=d[j]*d[j];c++;}out[i]=Math.round(Math.sqrt(z/(c||1))*1000)/1000;}return out;}
/** Integrated loudness in LUFS (ITU-R BS.1770: K-weighting, 400 ms blocks with 75% overlap, -70 LUFS and -10 LU gates). */
async function edLufs(buf){
 const oc=new OfflineAudioContext(buf.numberOfChannels,buf.length,buf.sampleRate),s=oc.createBufferSource(),hs=oc.createBiquadFilter(),hp=oc.createBiquadFilter();
 s.buffer=buf;hs.type='highshelf';hs.frequency.value=1681;hs.gain.value=4;hp.type='highpass';hp.frequency.value=38;hp.Q.value=.5;s.connect(hs).connect(hp).connect(oc.destination);s.start();
 const r=await oc.startRendering(),sr=r.sampleRate,q=Math.round(.1*sr),nq=Math.floor(r.length/q),sub=new Float64Array(nq);
 for(let k=0;k<r.numberOfChannels;k++){const d=r.getChannelData(k);for(let i=0;i<nq;i++){let z=0;for(let j=i*q;j<(i+1)*q;j++)z+=d[j]*d[j];sub[i]+=z;}}
 const blocks=[];for(let i=0;i+4<=nq;i++)blocks.push((sub[i]+sub[i+1]+sub[i+2]+sub[i+3])/(4*q));
 const L=z=>-0.691+10*Math.log10(z),mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 const abs=blocks.filter(z=>z>0&&L(z)>-70);if(!abs.length)return null;const rel=L(mean(abs))-10,keep=abs.filter(z=>L(z)>rel);
 return Math.round(L(mean(keep.length?keep:abs))*10)/10;
}
async function edPeaks(file){const ac=new AudioContext();try{const buf=await ac.decodeAudioData(await file.arrayBuffer());const d=buf.getChannelData(0),n=160,step=Math.floor(d.length/n)||1,out=[];for(let i=0;i<n;i++){let m=0;for(let j=i*step;j<(i+1)*step&&j<d.length;j+=8)m=Math.max(m,Math.abs(d[j]));out.push(Math.round(m*100)/100);}return out;}finally{ac.close();}}

