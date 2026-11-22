'use strict';
// Editor, editing tools: split every track, swap, nudge, select forward, fit to fill, dynamic zoom, split screen, remove silences; and their helpers (pauses, colour match, multicam envelopes, sound effects).
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 /** Split every track at the playhead (the razor across all tracks); locked tracks are left alone. */
 /** Swap the selected clip with its neighbour on the track (Ctrl+Alt+← / →): they trade places, the gap between them stays. */
 swap(dir){const c=this.sel&&this.clip(this.sel);if(!c||this.trackOf(c)?.locked)return false;
  const cl=this.p.clips.filter(x=>x.track===c.track).sort((a,b)=>a.start-b.start),o=cl[cl.indexOf(c)+dir];
  if(!o){toast(dir<0?'Nothing before this clip to swap with.':'Nothing after this clip to swap with.');return true;}
  this.snapshot();const [a,b]=dir<0?[o,c]:[c,o],gap=b.start-(a.start+a.dur),s=a.start;b.start=s;a.start=Math.round((s+b.dur+gap)*1000)/1000;
  this.after(true);toast('Swapped');return true;},
 /** Fit to fill: change the clip's speed so it ends where the next clip on its track starts (the gap fills). */
 fitFill(c){if(!c?.media||this.mediaOf(c)?.type==='image')return toast('Fit to fill works on video and audio clips.');if(c.ramp)return toast('This clip has a speed curve; remove it first.');
  const nx=this.p.clips.filter(o=>o.track===c.track&&o.start>=c.start+c.dur-.001).sort((a,b)=>a.start-b.start)[0];
  if(!nx||nx.start-(c.start+c.dur)<1/60)return toast('There is no gap after this clip to fill.');
  const target=nx.start-c.start,sp=Math.round(c.dur*(c.speed||1)/target*1000)/1000;if(sp<.1)return toast('The gap is too long: that would be slower than 0.1×.');
  this.snapshot();c.speed=sp;c.dur=target;this.after(true);toast(`Fit to fill: ${sp}×`);},
 /** Dynamic zoom: a slow push in (or pull out) across the clip, as two scale keyframes. */
 dynZoom(c,dir){if(!c||this.kindOf(c)==='audio')return;this.snapshot();const s=this.val(c,'scale',c.start),a={t:0,v:s},b={t:c.dur,v:Math.round(s*1.2*100)/100};
  c.kf={...(c.kf||{}),scale:dir<0?[{t:0,v:b.v},{t:c.dur,v:s}]:[a,b]};this.after(true);toast(dir<0?'Dynamic zoom: out':'Dynamic zoom: in');},
 /** Remove pauses from the selected clips with sound: cut out what is quieter than thrDb for at least minLen seconds
  *  (keeping pad seconds around speech) and close the gaps on their tracks. */
 async removeSilences(o={}){const thr=o.thr??-38,minLen=o.min??.6,pad=o.pad??.12;
  const list=this.picked().filter(c=>c.media&&this.mediaOf(c)?.type!=='image'&&!c.ramp&&!this.trackOf(c)?.locked);if(!list.length)return toast('Select a clip with speech or sound first.'),0;
  const plan=[];for(const c of list){const m=this.mediaOf(c),blob=await this.get(m.id).catch(()=>null);let buf=null;try{buf=blob?await edDecode(blob):null;}catch{buf=null;}if(!buf){toast(`No sound found in ${m.name}.`,true);continue;}
   const sp=c.speed||1,env=edSyncEnv(buf,c.in||0,c.dur*sp,100);plan.push([c,edSilences(env,100,thr,minLen,pad).map(([a,b])=>[c.start+a/sp,c.start+b/sp])]);}
  if(!plan.length||!plan.every(([c])=>this.p.clips.includes(c)))return 0;
  const n=plan.reduce((s,[,g])=>s+g.length,0),secs=plan.reduce((s,[,g])=>s+g.reduce((x,[a,b])=>x+b-a,0),0);if(!n){toast('No pauses found at this level. Try a higher (less strict) level.');return 0;}
  this.snapshot();
  for(const [c,gaps] of plan){for(const [a,b] of [...gaps].reverse()){if(b-a<.04||a<=c.start+.01&&b>=c.start+c.dur-.01)continue;
   const end=c.start+c.dur,tr=c.track;
   if(b<end-.01)this.splitClip(c,b);const mid=a>c.start+.01?this.splitClip(c,a):c;
   // the pause goes (at the very start of the clip, that is what is left of the clip itself), and what follows closes up
   this.p.clips=this.p.clips.filter(x=>x!==mid);this.shiftTrack(tr,b,-(b-a));}}
  this.after(true);toast(`Removed ${n} pause${n===1?'':'s'} (${secs.toFixed(1)} s)`);return n;},
 /** Split screen: the selected pictures (2 to 4) fill the cells of a layout, each cropped to its cell (as CapCut's layouts). */
 layout(kind){const list=this.picked().filter(c=>c.media&&this.mediaOf(c)?.type!=='audio'&&!c.asAudio&&!this.trackOf(c)?.locked).sort((a,b)=>this.p.tracks.findIndex(t=>t.id===a.track)-this.p.tracks.findIndex(t=>t.id===b.track));
  const cells={'2h':[[0,0,.5,1],[.5,0,.5,1]],'2v':[[0,0,1,.5],[0,.5,1,.5]],'3':[[0,0,.5,1],[.5,0,.5,.5],[.5,.5,.5,.5]],'3v':[[0,0,1,.5],[0,.5,.5,.5],[.5,.5,.5,.5]],'4':[[0,0,.5,.5],[.5,0,.5,.5],[0,.5,.5,.5],[.5,.5,.5,.5]]}[kind];
  if(!cells)return;if(list.length<2)return toast('Select two to four videos or photos that play at the same time.');const [W,H]=this.size();this.snapshot();
  list.slice(0,cells.length).forEach((c,i)=>{const [x0,y0,cw,ch]=cells[i],m=this.mediaOf(c),A=cw*W/(ch*H),S=(m.w||16)/(m.h||9),cr={l:0,r:0,t:0,b:0};
   if(S>A){cr.l=cr.r=(1-A/S)/2;}else{cr.t=cr.b=(1-S/A)/2;}c.crop=cr;const sw=(m.w||16)*(1-cr.l-cr.r),sh=(m.h||9)*(1-cr.t-cr.b),fit=Math.min(W/sw,H/sh);
   c.scale=Math.round(cw*W/(sw*fit)*1000)/1000;c.x=Math.round((x0+cw/2-.5)*1000)/1000;c.y=Math.round((y0+ch/2-.5)*1000)/1000;c.rotate=0;if(c.kf)for(const k of ['scale','x','y','rotate'])delete c.kf[k];});
  this.after(true);toast(`Split screen: ${Math.min(list.length,cells.length)} pictures`);},
 splitAll(){const t=this.time,list=this.p.clips.filter(x=>t>x.start+.05&&t<x.start+x.dur-.05&&!this.trackOf(x)?.locked);
  if(!list.length)return toast('Nothing under the playhead to split.');this.snapshot();const parts=list.map(c=>this.splitClip(c,t));this.regroup(parts);this.pick(null);this.after(true);toast(`Split ${list.length} clip${list.length>1?'s':''} on every track`);},
 /** Move the selected clips by whole frames (Alt + arrows); stops at the start and at other clips. */
 nudge(frames){const list=this.picked().filter(c=>!this.trackOf(c)?.locked);if(!list.length)return false;const d=frames/30,ids=new Set(list.map(c=>c.id));
  if(list.some(c=>c.start+d<-1e-6||!this.fits(c.track,c.start+d,c.dur,ids))){toast('No room to move there.');return true;}
  this.snapshot();for(const c of list)c.start=Math.round((c.start+d)*1000)/1000;this.after(true);return true;},
 /** Select every clip from the playhead forward (or back), on all tracks: to move the rest of the edit at once. */
 selectFrom(dir){const t=this.time;this.junction=null;
  this.sels=new Set(this.p.clips.filter(c=>!this.trackOf(c)?.locked&&(dir>0?c.start+c.dur>t+.001:c.start<t-.001)).map(c=>c.id));this.sel=[...this.sels].pop()||null;
  this.drawTimeline();this.drawProps();this.draw();toast(`${this.sels.size} clip${this.sels.size===1?'':'s'} selected ${dir>0?'from the playhead on':'before the playhead'}`);},
});
/** Loudness envelope of a sound (all channels), `rate` values a second, from `from` for `dur` seconds: what multicam lines angles up with. */
function edSyncEnv(buf,from,dur,rate=100){const sr=buf.sampleRate,ch=Array.from({length:buf.numberOfChannels},(_,i)=>buf.getChannelData(i)),hop=Math.max(1,Math.round(sr/rate)),s0=Math.round(from*sr),n=Math.max(0,Math.min(Math.floor(dur*rate),Math.floor((ch[0].length-s0)/hop))),out=new Float32Array(n);
 for(let k=0;k<n;k++){let a=0;const i0=s0+k*hop;for(let i=i0;i<i0+hop;i++){let v=0;for(const c of ch)v+=c[i];a+=v*v;}out[k]=Math.sqrt(a/hop);}return out;}
/** Where sound B starts in sound A's time (seconds), from the best match of their envelopes (normalised, overlapping at least
 *  `minOv` seconds); null when nothing matches well (another place, or no sound). */
function edSyncOffset(A,B,rate=100,minOv=1){const z=x=>{const m=x.reduce((s,v)=>s+v,0)/(x.length||1);return Float32Array.from(x,v=>v-m);},a=z(A),b=z(B),mo=Math.round(minOv*rate);let best=-Infinity,lag=0;
 for(let L=-(b.length-mo);L<=a.length-mo;L++){const i0=Math.max(0,L),i1=Math.min(a.length,L+b.length);if(i1-i0<mo)continue;let s=0,ea=0,eb=0;for(let i=i0;i<i1;i++){const x=a[i],y=b[i-L];s+=x*y;ea+=x*x;eb+=y*y;}
  const r=s/Math.sqrt(ea*eb||1);if(r>best){best=r;lag=L;}}
 return best>.3?lag/rate:null;}
/** Pauses in a sound: from its envelope (`rate` a second), the parts quieter than thrDb (dBFS) for at least minLen seconds,
 *  each shrunk by pad seconds at both ends so speech keeps its breath. Seconds from the envelope's start. */
function edSilences(env,rate,thrDb,minLen,pad){const out=[],lim=Math.pow(10,thrDb/20);let a=-1;
 for(let i=0;i<=env.length;i++){const q=i<env.length&&env[i]<lim;if(q&&a<0)a=i;else if(!q&&a>=0){const s=a/rate+(a>0?pad:0),e=i/rate-(i<env.length?pad:0);if(i-a>=minLen*rate&&e-s>.05)out.push([s,e]);a=-1;}}
 return out;}
/** Colour match: per channel, curve points taking the target's shadows, middle and highlights (2, 25, 50, 75, 98%) to the reference's. */
function edMatchCurves(A,B){const pct=(d,ch)=>{const h=new Uint32Array(256);let n=0;for(let i=ch;i<d.length;i+=4){if(d[i-ch+3]<8)continue;h[d[i]]++;n++;}const q=p=>{let s=0;for(let v=0;v<256;v++){s+=h[v];if(s>=p*n)return v/255;}return 1;};return [.02,.25,.5,.75,.98].map(q);};
 return [0,1,2].map(ch=>{const a=pct(A,ch),b=pct(B,ch),pts=[[0,0]];a.forEach((x,i)=>{if(x>pts.at(-1)[0]+.02&&x<.98)pts.push([Math.round(x*1000)/1000,Math.round(Math.max(pts.at(-1)[1],b[i])*1000)/1000]);});pts.push([1,1]);return pts;});}
/** Built-in sound effects, made here from oscillators and noise (no files to download, no licences). */
const ED_SFX=[['whoosh','Whoosh'],['pop','Pop'],['click','Click'],['ding','Ding'],['riser','Riser'],['boom','Boom'],['shutter','Camera'],['notify','Notification'],['swipe','Swipe'],['glitch','Glitch']];
async function edMakeSfx(kind){const sr=48000,dur={whoosh:.9,pop:.25,click:.08,ding:1.6,riser:2.5,boom:1.8,shutter:.35,notify:.7,swipe:.5,glitch:.6}[kind]||1,ac=new OfflineAudioContext(2,Math.round(sr*dur),sr);
 const noise=()=>{const b=ac.createBuffer(1,Math.round(sr*dur),sr),d=b.getChannelData(0);let s=7;for(let i=0;i<d.length;i++){s=(s*16807)%2147483647;d[i]=s/2147483647*2-1;}const n=ac.createBufferSource();n.buffer=b;return n;};
 const env=(g,a,peak,hold,rel)=>{g.gain.setValueAtTime(0,0);g.gain.linearRampToValueAtTime(peak,a);g.gain.setValueAtTime(peak,a+hold);g.gain.exponentialRampToValueAtTime(.0001,a+hold+rel);};
 const tone=(type,f0,f1,a,peak,hold,rel,t0=0)=>{const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t0);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t0+a+hold+rel);env(g,a,peak,hold,rel);if(t0){g.gain.cancelScheduledValues(0);g.gain.setValueAtTime(0,0);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(peak,t0+a);g.gain.exponentialRampToValueAtTime(.0001,t0+a+hold+rel);}o.connect(g).connect(ac.destination);o.start(t0);o.stop(dur);};
 const swept=(f0,f1,q,a,peak,hold,rel)=>{const n=noise(),f=ac.createBiquadFilter(),g=ac.createGain();f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(f0,0);f.frequency.exponentialRampToValueAtTime(f1,dur*.95);env(g,a,peak,hold,rel);n.connect(f).connect(g).connect(ac.destination);n.start();};
 if(kind==='whoosh')swept(300,3500,1.2,.35,.9,.05,.45);
 else if(kind==='swipe')swept(1800,500,2,.06,.8,.02,.35);
 else if(kind==='pop')tone('sine',900,140,.003,.9,.01,.2);
 else if(kind==='click'){const n=noise(),f=ac.createBiquadFilter(),g=ac.createGain();f.type='highpass';f.frequency.value=2500;env(g,.001,.9,.004,.05);n.connect(f).connect(g).connect(ac.destination);n.start();}
 else if(kind==='ding'){tone('sine',1320,0,.004,.5,.02,1.5);tone('sine',2640,0,.004,.18,.01,.9);}
 else if(kind==='riser'){swept(200,6000,3,2.2,.6,.05,.2);tone('sawtooth',110,880,2.2,.08,.05,.2);}
 else if(kind==='boom'){tone('sine',110,32,.005,1,.05,1.6);swept(400,60,.7,.005,.6,.02,.6);}
 else if(kind==='shutter'){const n=noise(),f=ac.createBiquadFilter(),g=ac.createGain();f.type='bandpass';f.frequency.value=3000;g.gain.setValueAtTime(0,0);for(const t of [0,.12]){g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.07);}n.connect(f).connect(g).connect(ac.destination);n.start();}
 else if(kind==='notify'){tone('sine',880,0,.005,.45,.05,.25);tone('sine',1320,0,.005,.45,.05,.35,.16);}
 else if(kind==='glitch'){for(let i=0;i<8;i++){const t0=i*.07,o=ac.createOscillator(),g=ac.createGain();o.type='square';o.frequency.value=200+((i*7919)%1600);g.gain.setValueAtTime(0,0);g.gain.setValueAtTime(.18,t0);g.gain.setValueAtTime(0,t0+.04);o.connect(g).connect(ac.destination);o.start(0);o.stop(dur);}}
 return ac.startRendering();}
