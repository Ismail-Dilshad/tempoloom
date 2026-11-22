'use strict';
// Editor, pitch: an AudioWorklet that raises or lowers the pitch without changing the speed (the voice changer).
// Two reading points slide through a short delay line and cross-fade, so the sound keeps its length; used by
// the player (AudioContext) and the export (OfflineAudioContext) alike. Loaded with audioWorklet.addModule.
class EdPitch extends AudioWorkletProcessor{
 static get parameterDescriptors(){return [{name:'ratio',defaultValue:1,minValue:.25,maxValue:4,automationRate:'k-rate'}];}
 constructor(){super();this.win=Math.round(sampleRate*.06);this.len=this.win*4;this.bufs=[];this.w=0;this.ph=0;}
 process(inputs,outputs,params){
  const inp=inputs[0],out=outputs[0],r=params.ratio[0];
  if(!inp?.length){for(const o of out)o.fill(0);return true;}
  const n=inp[0].length,N=this.win,L=this.len;
  while(this.bufs.length<inp.length)this.bufs.push(new Float32Array(L));
  let w=this.w,ph=this.ph;const step=(1-r)/N;
  for(let i=0;i<n;i++){
   const a=ph,b=(ph+.5)%1,ga=Math.sin(Math.PI*a),gb=Math.sin(Math.PI*b);
   for(let ch=0;ch<out.length;ch++){
    const src=inp[Math.min(ch,inp.length-1)],buf=this.bufs[Math.min(ch,inp.length-1)];
    if(ch<inp.length)buf[w]=src[i];
    if(Math.abs(r-1)<1e-4){out[ch][i]=src[i];continue;}
    const read=d=>{const p=(w-d+L)%L,i0=Math.floor(p),f=p-i0;return buf[i0]*(1-f)+buf[(i0+1)%L]*f;};
    out[ch][i]=(read(a*N+1)*ga+read(b*N+1)*gb)/Math.max(1,ga+gb)*1.2;
   }
   w=(w+1)%L;ph=((ph+step)%1+1)%1;
  }
  this.w=w;this.ph=ph;return true;
 }
}
registerProcessor('ed-pitch',EdPitch);
