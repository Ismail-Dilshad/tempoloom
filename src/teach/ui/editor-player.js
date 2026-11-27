'use strict';
// Preview, playback controls, and their overlays.
function edPlayerPanel(){
 return `<section class="ed-panel ed-view" aria-label="Player">
   <header class="ed-ph"><h2>Preview</h2><span class="ed-crumb" data-crumb hidden></span><span class="ed-ratio">${esc(Ed.p.ratio)}</span></header>
   <div class="ed-stage"><output class="ed-rotation-readout" hidden></output><div class="ed-frame"><canvas class="ed-preview-canvas" aria-label="Preview"></canvas><div class="ed-scopes" ${Ed.scopesOn?'':'hidden'}><canvas data-scope="wave" width="256" height="128" title="Waveform: brightness across the picture"></canvas><canvas data-scope="vector" width="128" height="128" title="Vectorscope: colour and saturation"></canvas><canvas data-scope="hist" width="256" height="128" title="Histogram: red, green, blue levels"></canvas></div><div class="ed-guides" aria-hidden="true"><i class="g-top"></i><i class="g-right"></i><i class="g-bottom"></i></div></div>
    <div class="ed-export" hidden><span class="spin"></span><b>Recording…</b><span>Keep this tab open.</span><button type="button" class="btn small" data-cancel-export>Cancel</button></div></div>
   <div class="ed-controls"><span class="ed-time"></span><button type="button" class="ed-play" data-play></button><button type="button" class="iconbtn sm ed-loop" data-loop aria-pressed="false" aria-label="Loop" data-tooltip="Loop (Shift+L)">${I.refresh}</button>
    <span class="ed-ctl-right"><canvas class="ed-meter" width="72" height="14" role="img" aria-label="Sound level"></canvas><button type="button" class="iconbtn sm" data-preview-audio aria-label="Preview volume" data-tooltip="Preview volume and mute" aria-haspopup="dialog" aria-expanded="false"></button><details class="ed-player-menu"><summary aria-label="Preview options" title="Preview options">${I.sliders}</summary><div class="ed-player-actions dropdown-surface" role="group" aria-label="Preview actions">
     <button type="button" class="pop-item" data-fit>${I.expand}<span>Fit preview</span></button>
     <button type="button" class="pop-item" data-scopes aria-pressed="${!!Ed.scopesOn}">${I.chart}<span>Scopes</span></button>
     <button type="button" class="pop-item" data-frame>${I.image}<span>Save frame</span></button>
     <button type="button" class="pop-item" data-guides aria-pressed="${Ed.guides}">${I.safe}<span>Safe areas</span></button>
    </div></details><button type="button" class="iconbtn sm" data-full aria-label="Full screen" data-tooltip="Full screen">${I.expand}</button></span></div>
  </section>`;
}

function edBindPlayer(panel){
 const q=selector=>panel.querySelector(selector);
 q('[data-cancel-export]').onclick=()=>Ed.cancelExport();
 q('[data-play]').onclick=()=>Ed.play();q('[data-loop]').onclick=()=>Ed.toggleLoop();
 const playerMenu=q('.ed-player-menu');
 const audio=q('[data-preview-audio]');
 const updateAudio=()=>{audio.innerHTML=Ed.previewLevel()?I.sound:I.mute;};
 updateAudio();
 audio.onclick=()=>{
  playerMenu.open=false;
  edAudioPopover(audio,{label:'Preview audio',max:100,live:true,volume:()=>Ed.previewVolume,muted:()=>Ed.previewMuted,
   setVolume:value=>{Ed.previewVolume=value;Ed.updatePreviewAudio();updateAudio();},
   toggleMute:()=>{Ed.previewMuted=!Ed.previewMuted;Ed.updatePreviewAudio();updateAudio();},target:'preview'});
 };
 playerMenu.ontoggle=()=>{if(playerMenu.open&&Pop.anchor===audio)Pop.close();};
 const closeOptions=()=>{playerMenu.open=false;playerMenu.querySelector('summary').focus();};
 playerMenu.onkeydown=e=>{if(e.key==='Escape'&&playerMenu.open){e.stopPropagation();closeOptions();}};
 q('[data-fit]').onclick=()=>{Ed.fit();closeOptions();};
 q('[data-frame]').onclick=()=>{closeOptions();Ed.saveFrame();};
 q('[data-scopes]').onclick=e=>{Ed.scopesOn=!Ed.scopesOn;e.currentTarget.setAttribute('aria-pressed',String(Ed.scopesOn));q('.ed-scopes').hidden=!Ed.scopesOn;Ed.draw();};
 q('[data-guides]').onclick=e=>{Ed.guides=!Ed.guides;e.currentTarget.setAttribute('aria-pressed',String(Ed.guides));Ed.dom.frame.classList.toggle('guides',Ed.guides);};
 Ed.dom.frame.classList.toggle('guides',Ed.guides);
 q('[data-full]').onclick=()=>{const st=Ed.dom.stage;document.fullscreenElement?document.exitFullscreen():st.requestFullscreen?.().catch(()=>{});};
 Ed.dom.canvas.addEventListener('contextmenu',e=>{e.preventDefault();const c=Ed.sel&&Ed.clip(Ed.sel);if(c)edClipMenu(e.clientX,e.clientY,c);});
 edWirePreview();
}

function edAudioPopover(anchor,{label,max,volume,muted,setVolume,toggleMute,target,live=false}){
 const pop=Pop.open(anchor,`<div class="ed-audio-pop">
  <label>Volume <output aria-hidden="true"></output><input type="range" min="0" max="${max}" aria-label="${label} volume"></label>
  <button type="button" class="pop-item" data-audio-mute></button>
 </div>`,{label,role:'dialog',align:'end',focus:false});
 if(!pop)return;
 const slider=pop.querySelector('input'),output=pop.querySelector('output'),button=pop.querySelector('[data-audio-mute]');
 const showVolume=()=>{output.textContent=`${slider.value}%`;slider.setAttribute('aria-valuetext',output.textContent);};
 const refresh=()=>{
  slider.value=Math.round(volume()*100);showVolume();
  const off=muted();button.innerHTML=`${off?I.mute:I.sound}<span>${off?'Unmute':'Mute'} ${target}</span>`;
 };
 refresh();
 slider.oninput=()=>{showVolume();if(live)setVolume(Number(slider.value)/100);};
 if(!live)slider.onchange=()=>{setVolume(Number(slider.value)/100);refresh();};
 button.onclick=()=>{toggleMute();refresh();};
 pop.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();Pop.close(true);}};
 slider.focus({preventScroll:true});
}

Object.assign(Ed,{
 drawTime(){const t=this.dom.time;if(t)t.innerHTML=`<b>${edTimecode(this.time,this.fps())}</b> / ${edTimecode(this.end(),this.fps())}${this.playing&&this.rate!==1?` <span class="ed-rate">${this.rate<0?'◀ ':''}${Math.abs(this.rate)}×</span>`:''}`;const p=this.dom.play,label=this.playing?'Pause':'Play';if(p&&p.getAttribute('aria-label')!==label){p.innerHTML=this.playing?I.pause:I.play;p.setAttribute('aria-label',label);}this.dom.loop?.setAttribute('aria-pressed',String(!!this.loop));},
 /** The level meter: left and right, -60 to 0 dBFS, green, yellow from -12, red from -3, with a peak line. */
 drawMeter(){const cv=this.dom.meter;if(!cv)return;const g=cv.getContext('2d'),W=cv.width,H=cv.height,live=this.playing&&this.meters;g.clearRect(0,0,W,H);
  const lv=[0,1].map(i=>{if(!live)return 0;const a=this.meters[i],d=this._mbuf||(this._mbuf=new Float32Array(a.fftSize));a.getFloatTimeDomainData(d);let p=0;for(let j=0;j<d.length;j++){const x=Math.abs(d[j]);if(x>p)p=x;}return p;});
  const pk=this._mpk||(this._mpk=[0,0]),gr=g.createLinearGradient(0,0,W,0);gr.addColorStop(0,'#35c46a');gr.addColorStop(.8,'#35c46a');gr.addColorStop(.8,'#f2c037');gr.addColorStop(.95,'#f2c037');gr.addColorStop(.95,'#ef4444');gr.addColorStop(1,'#ef4444');
  lv.forEach((p,i)=>{const db=p>0?20*Math.log10(p):-90,x=edClamp((db+60)/60,0,1)*W,y=i*H/2+1,h=H/2-2;
   g.fillStyle='rgba(128,128,128,.22)';g.fillRect(0,y,W,h);g.fillStyle=gr;g.fillRect(0,y,x,h);
   pk[i]=live?Math.max(x,pk[i]-W*.006):0;if(pk[i]>1){g.fillStyle=pk[i]>=W*.95?'#ef4444':'rgba(255,255,255,.85)';g.fillRect(Math.min(W-2,pk[i]-1),y,2,h);}});
  const top=Math.max(...lv);cv.title=live&&top>0?`Peak ${(20*Math.log10(top)).toFixed(1)} dBFS`:'Sound level';},
 /** Scopes of the frame in the player: luma waveform, vectorscope (Cb/Cr) and RGB histogram. */
 drawScopes(){const box=this.dom.root?.querySelector('.ed-scopes');if(!box||box.hidden||!this.dom.canvas)return;
  const S=this._scope||(this._scope=document.createElement('canvas'));S.width=256;S.height=144;const sg=S.getContext('2d',{willReadFrequently:true});sg.drawImage(this.dom.canvas,0,0,256,144);const d=sg.getImageData(0,0,256,144).data;
  const wv=box.querySelector('[data-scope=wave]').getContext('2d'),vc=box.querySelector('[data-scope=vector]').getContext('2d'),hs=box.querySelector('[data-scope=hist]').getContext('2d');
  const W=new Float32Array(256*128),V=new Float32Array(128*128),Hr=new Float32Array(256),Hg=new Float32Array(256),Hb=new Float32Array(256);
  for(let y=0;y<144;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,r=d[i],g=d[i+1],b=d[i+2],Y=.2126*r+.7152*g+.0722*b;W[(127-Math.round(Y/2))*256+x]++;
   const cb=-.1146*r-.3854*g+.5*b,cr=.5*r-.4542*g-.0458*b;V[Math.round(64-cr/2.2)*128+Math.round(64+cb/2.2)]++;Hr[r]++;Hg[g]++;Hb[b]++;}
  const paint=(ctx,w,h,A,col)=>{const im=ctx.createImageData(w,h);for(let i=0;i<w*h;i++){const v=Math.min(255,A[i]*60);im.data[i*4]=col[0]*v/255;im.data[i*4+1]=col[1]*v/255;im.data[i*4+2]=col[2]*v/255;im.data[i*4+3]=v?255:0;}ctx.clearRect(0,0,w,h);ctx.putImageData(im,0,0);};
  paint(wv,256,128,W,[120,255,160]);wv.strokeStyle='rgba(255,255,255,.18)';for(const l of [0,.25,.5,.75,1]){wv.beginPath();wv.moveTo(0,127-l*127);wv.lineTo(256,127-l*127);wv.stroke();}
  paint(vc,128,128,V,[255,255,255]);vc.strokeStyle='rgba(255,255,255,.25)';vc.beginPath();vc.arc(64,64,58,0,Math.PI*2);vc.moveTo(64,6);vc.lineTo(64,122);vc.moveTo(6,64);vc.lineTo(122,64);vc.stroke();
  // skin tone line (about 123 degrees in this view)
  vc.strokeStyle='rgba(255,180,120,.5)';vc.beginPath();vc.moveTo(64,64);vc.lineTo(64-56*Math.cos(.95),64-56*Math.sin(.95));vc.stroke();
  hs.clearRect(0,0,256,128);const mx=Math.max(1,...Hr,...Hg,...Hb);hs.globalCompositeOperation='lighter';
  for(const [A,col] of [[Hr,'rgba(255,60,60,.8)'],[Hg,'rgba(60,255,90,.8)'],[Hb,'rgba(70,120,255,.8)']]){hs.fillStyle=col;hs.beginPath();hs.moveTo(0,128);for(let i=0;i<256;i++)hs.lineTo(i,128-Math.sqrt(A[i]/mx)*126);hs.lineTo(255,128);hs.fill();}
  hs.globalCompositeOperation='source-over';},
 drawExport(msg){
  const o=this.dom.exportOverlay;if(!o)return;
  const busy=!!this.exporting;
  o.hidden=!busy;
  for(const button of [this.dom.play,this.dom.loop])if(button)button.disabled=busy;
  const b=o.querySelector('b');if(b&&msg)b.textContent=msg;
 },
 fit(){const st=this.dom.stage,wrap=this.dom.frame;if(!st||!wrap)return;const [W,H]=this.base(),r=st.getBoundingClientRect(),s=Math.min((r.width-16)/W,(r.height-16)/H);wrap.style.width=Math.max(10,W*s)+'px';wrap.style.height=Math.max(10,H*s)+'px';},
});
