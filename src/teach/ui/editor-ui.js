'use strict';
// Editor, the page: the library (media, audio, text, stickers, effects, transitions), the properties
// panel, the player, the timeline with its tracks, and the projects screen. The engine is in editor.js.
const ED_H={video:52,main:60,text:40,sticker:40,audio:48};
const ED_LIB=[['media','Media','film'],['audio','Audio','music'],['text','Text','text'],['stickers','Stickers','shapes'],['effects','Effects','wand'],['trans','Transitions','trans']];
Object.assign(Ed,{
 drawLib(){
  const el=this.dom.lib;if(!el)return;
  const all=this.media.filter(m=>this.tab==='audio'?m.type==='audio':m.type!=='audio'),folders=[...new Set(all.map(m=>m.folder).filter(Boolean))].sort();
  if(this.mfolder&&!folders.includes(this.mfolder))this.mfolder='';
  const items=all.filter(m=>!this.mfolder||m.folder===this.mfolder);
  const tile=m=>`<div class="ed-media" draggable="true" data-mid="${m.id}" title="${esc(m.name)}">
    <div class="ed-media-thumb">${m.type==='audio'?`<span class="ed-media-wave">${I.music}</span>`:m.thumbs?.[0]?`<img src="${m.thumbs[Math.min(2,m.thumbs.length-1)]}" alt="">`:`<span class="ed-media-wave">${I[m.type==='image'?'image':'film']}</span>`}
     ${m.type!=='image'&&m.dur?`<span class="ed-media-dur">${edFmt(m.dur).slice(0,5)}</span>`:''}
     ${edAll(this.p.clips).some(c=>c.media===m.id)?'<span class="ed-media-used">Added</span>':''}
     <button type="button" class="ed-media-add" data-add="${m.id}" aria-label="Add ${esc(m.name)} to the timeline">${I.add}</button>
     <button type="button" class="ed-media-del" data-del="${m.id}" aria-label="Remove ${esc(m.name)}">${I.x}</button></div>
    <span class="ed-media-name" dir="auto">${esc(m.name)}</span></div>`;
  const drop=`<label class="ed-drop" data-import><span class="ed-drop-btn">${I.add} Import</span><span>Drag and drop ${this.tab==='audio'?'music and sound files':'videos, photos and audio files'} here</span></label>`;
  const sel=this.sel&&this.clip(this.sel),visual=sel&&this.kindOf(sel)==='video'&&this.mediaOf(sel);
  let body='';
  if(this.tab==='text'){const caps=this.p.clips.filter(c=>c.cap||c.words).length;
   body=`<section class="ed-capbox"><div class="ed-sub">${I.captions} Captions</div>
    <label class="ed-caprow"><span>Spoken language</span><select data-cap-lang aria-label="Spoken language">${ED_CAP_LANGS.map(l=>`<option value="${l}" ${(this.p.capLang||'auto')===l?'selected':''} dir="auto">${esc(edLangName(l))}</option>`).join('')}</select></label>
    <label class="ed-caprow"><span>Listen with</span><select data-cap-engine aria-label="Speech recognition"><option value="local" ${this.capEngine()==='local'?'selected':''}>This computer: all languages (free)</option>${this.stt?.sorani?`<option value="whisper" ${this.capEngine()==='whisper'?'selected':''}>This computer: Kurdish Sorani model</option>`:''}<option value="elevenlabs" ${this.capEngine()==='elevenlabs'?'selected':''}>ElevenLabs (online, key)</option></select></label>
    <div class="ed-capnote" data-stt-note></div>
    ${this.stt?.sorani&&this.capEngine()==='local'?`<label class="ed-caprow check"><input type="checkbox" data-cap-sorani ${this.p.capSorani===false?'':'checked'}><span>Kurdish Sorani: a second model marks words to check</span></label>`:''}
    <div class="ed-capnote" data-learn-note>${this.stt?.learning?`${I.brain} Learns from your corrections: ${this.stt.learning.fixes} fix${this.stt.learning.fixes===1?'':'es'}, ${this.stt.learning.clips} training clip${this.stt.learning.clips===1?'':'s'} · <button type="button" class="ed-link" data-fixes>Manage</button>`:''}</div>
    <label class="ed-caprow"><span>Look</span><select data-cap-look aria-label="Caption look">${ED_CAPS.map(([v,l])=>`<option value="${v}" ${(this.p.capLook||'clean')===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <button type="button" class="btn small primary ed-wide" data-captions>${I.captions} Auto captions</button>
    <div class="ed-caprow two"><button type="button" class="btn small" data-srt-in>${I.upload} Import .srt</button><button type="button" class="btn small" data-srt-out ${caps?'':'disabled'}>${I.down} Export .srt</button></div>
    <input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" data-srt-file hidden></section>
   <div class="ed-sub">Add text</div>
   <div class="ed-text-presets">${ED_TEXTS.map(([l,size,weight,box],i)=>`<button type="button" class="ed-text-preset${box?' box':''}" data-text="${i}"><span style="font-size:${Math.round(size/2.4)}px;font-weight:${weight}">${l}</span><i>${I.add}</i></button>`).join('')}</div>
   <div class="ed-sub">Templates</div>
   <div class="ed-text-presets">${[...ED_TTPL.map((t,i)=>['builtin:'+i,t]),...(this.tpls||[]).map(t=>[t.id,t])].map(([id,t])=>`<button type="button" class="ed-text-preset${t.style?.box?' box':''}" data-tpl="${esc(id)}" title="${esc(t.name)}${id.startsWith('builtin:')?'':' (yours: right-click to delete)'}"><span style="font-size:${Math.round(Math.min(96,t.style?.size||40)/3.2)}px;font-weight:${t.style?.weight||600}">${esc(t.name)}</span><i>${I.add}</i></button>`).join('')}</div>
   <p class="ed-hint">Select a text clip and choose Save style as a template to add your own.</p>`;}
  else if(this.tab==='stickers')body=`<div class="ed-sub">Shapes</div><div class="ed-stickers">${ED_SHAPES.map(([s,l])=>`<button type="button" class="ed-sticker" data-shape="${s}" aria-label="${l}" title="${l}"><svg viewBox="0 0 40 40">${edShapeSvg(s)}</svg></button>`).join('')}</div>
   <div class="ed-sub">Emoji</div><div class="ed-stickers">${ED_EMOJI.map(e=>`<button type="button" class="ed-sticker emoji" data-emoji="${e}">${e}</button>`).join('')}</div>`;
  else if(this.tab==='effects')body=`<button type="button" class="btn small ed-wide" data-adjlayer>${I.layers} Add an adjustment layer</button><div class="ed-sub">${visual?'Filters for the selected clip':'Select a video or photo, then choose a filter'}</div><div class="ed-filters">${ED_FILTERS.map(([id,l,a])=>`<button type="button" class="ed-filter" data-filter="${id}" ${visual?'':'disabled'} aria-pressed="${visual?JSON.stringify(sel.adj||{})===JSON.stringify(a):false}"><span class="ed-filter-swatch" style="filter:${edCssFilter(a)}"></span><span>${l}</span></button>`).join('')}</div>`;
  else if(this.tab==='trans')body=`<div class="ed-sub">Click the ◆ between two clips on a track, then choose one. Or set one for every cut:</div>
   <div class="ed-filters">${ED_TRANS.map(([id,l])=>`<button type="button" class="ed-filter" data-trans-all="${id}"><span class="ed-trans-swatch t-${id}"></span><span>${l}</span></button>`).join('')}</div>
   <button type="button" class="btn small ghost ed-wide" data-trans-all="none">${I.x} Remove all transitions</button>`;
  else body=`${this.tab==='audio'?(this.recording?`<button type="button" class="btn small ed-wide ed-rec on" data-voice><i class="ed-rec-dot"></i> Stop recording <span data-rec-time>00:00</span></button>`:`<button type="button" class="btn small ed-wide" data-voice>${I.mic} Record voice-over</button>`):''}
   ${all.length?`<div class="ed-lib-bar"><button type="button" class="btn small" data-import>${I.add} Import</button><span class="ed-sub">${items.length} ${this.tab==='audio'?'audio':'item'}${items.length>1&&this.tab!=='audio'?'s':''}</span></div>
      <input type="search" class="ed-msearch" data-msearch placeholder="Search media" aria-label="Search media" value="${esc(this.mq||'')}">
      ${folders.length?`<div class="ed-chips ed-folders">${[['','All'],...folders.map(f=>[f,f])].map(([f,l])=>`<button type="button" data-folder="${esc(f)}" aria-pressed="${(this.mfolder||'')===f}">${esc(l)}</button>`).join('')}</div>`:''}
      <div class="ed-media-grid${this.tab==='audio'?' list':''}">${items.map(tile).join('')}</div>`:drop}`;
  el.innerHTML=`<nav class="ed-cats" role="tablist" aria-label="Library">${ED_LIB.map(([id,l,ic])=>`<button type="button" role="tab" aria-selected="${this.tab===id}" data-tab="${id}">${I[ic]}<span>${l}</span></button>`).join('')}</nav><div class="ed-lib-body">${body}</div>`;
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{this.tab=b.dataset.tab;this.drawLib();});
  el.querySelectorAll('[data-import]').forEach(b=>b.onclick=e=>{e.preventDefault();this.dom.file.click();});
  el.querySelectorAll('[data-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.add(b.dataset.add);});
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.removeMedia(b.dataset.del);});
  el.querySelectorAll('[data-text]').forEach(b=>b.onclick=()=>this.addText(+b.dataset.text));
  el.querySelectorAll('[data-tpl]').forEach(b=>{const id=b.dataset.tpl,t=id.startsWith('builtin:')?ED_TTPL[+id.slice(8)]:this.tpls?.find(x=>x.id===id);if(!t)return;b.onclick=()=>this.addTemplate(t);
   if(!id.startsWith('builtin:'))b.oncontextmenu=e=>{e.preventDefault();edMenu(e.clientX,e.clientY,[['Delete template','trash',async()=>{if(!await ask(`Delete the template “${t.name}”?`,'Text already made with it stays.','Delete',true))return;await this.dropTemplate(id);this.drawLib();},false,true]]);};});
  el.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>this.addSticker({type:'shape',shape:b.dataset.shape}));
  el.querySelectorAll('[data-emoji]').forEach(b=>b.onclick=()=>this.addSticker({type:'emoji',emoji:b.dataset.emoji}));
  el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{const c=this.sel&&this.clip(this.sel);if(!c)return;this.snapshot();const a=ED_FILTERS.find(f=>f[0]===b.dataset.filter)[2];if(Object.keys(a).length)c.adj={...a};else delete c.adj;this.after(true);this.drawLib();});
  el.querySelectorAll('[data-trans-all]').forEach(b=>b.onclick=()=>{const t=b.dataset.transAll;this.transAll(t,.6);toast(t==='none'?'Transitions removed':'Transition set on every cut');});
  const al=$('[data-adjlayer]',el);if(al)al.onclick=()=>this.addAdjustment();
  const cap=$('[data-captions]',el);if(cap)cap.onclick=()=>this.captions();
  const cl=$('[data-cap-lang]',el);if(cl)cl.onchange=()=>{this.p.capLang=cl.value;this.save();};
  const ck=$('[data-cap-look]',el);if(ck)ck.onchange=()=>{this.p.capLook=ck.value;this.save();};
  const ce=$('[data-cap-engine]',el);if(ce){ce.onchange=()=>{this.p.capEngine=ce.value;this.save();this.drawLib();};this.drawStt();
   // what is installed can change (a model set up, the server restarted): ask again, and redraw the box if anything differs
   if(!this._sttAsking){const key=s=>JSON.stringify(s&&[s.sorani,s.elevenlabs,s.local?.models?.map(m=>m.installed),s.learning]),before=key(this.stt);this._sttAsking=true;
    this.loadStt().then(()=>{this._sttAsking=false;if(this.tab==='text'&&key(this.stt)!==before)this.drawLib();});}}
  const cs=$('[data-cap-sorani]',el);if(cs)cs.onchange=()=>{this.p.capSorani=cs.checked;this.save();};
  const fx=$('[data-fixes]',el);if(fx)fx.onclick=()=>edFixesDialog();
  const so=$('[data-srt-out]',el);if(so)so.onclick=()=>{const list=this.p.clips.filter(c=>c.text!==undefined&&(c.cap||c.words)).sort((a,b)=>a.start-b.start);if(!list.length)return toast('There are no captions yet.');
   edSaveFile(new Blob(['\uFEFF'+edSrt(list)],{type:'application/x-subrip;charset=utf-8'}),this.p.name+'.srt');toast(`Saved ${list.length} caption${list.length>1?'s':''} as .srt`);};
  const sf=$('[data-srt-file]',el),si=$('[data-srt-in]',el);if(si&&sf){si.onclick=()=>sf.click();
   sf.onchange=async()=>{const file=sf.files[0];sf.value='';if(!file)return;const cues=edParseSubs(await file.text());if(!cues.length)return toast('No captions were found in that file.',true);
    const lines=cues.map(q=>{const ws=edWords(q.text),d=(q.e-q.s)/Math.max(1,ws.length);return {s:q.s,e:q.e,words:ws.map((w,i)=>({t:w,s:q.s+i*d,e:q.s+(i+1)*d}))};});
    const lang=this.p.capLang&&this.p.capLang!=='auto'?this.p.capLang:'auto',n=this.addCaptions(lines,lang,this.p.capLook||'clean');toast(`Imported ${n} caption${n>1?'s':''}`);};}
  const vo=$('[data-voice]',el);if(vo)vo.onclick=()=>this.recordVoice();
  const ms=el.querySelector('[data-msearch]'),filt=()=>{const q=(this.mq||'').trim().toLowerCase();el.querySelectorAll('.ed-media').forEach(t=>{const m=this.media.find(x=>x.id===t.dataset.mid);t.hidden=!!q&&!(m?.name||'').toLowerCase().includes(q);});};
  if(ms){ms.oninput=()=>{this.mq=ms.value;filt();};filt();}
  el.querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>{this.mfolder=b.dataset.folder;this.drawLib();});
  el.querySelectorAll('.ed-media').forEach(t=>t.oncontextmenu=e=>{e.preventDefault();const m=this.media.find(x=>x.id===t.dataset.mid);if(!m)return;
   const fs=[...new Set(this.media.map(x=>x.folder).filter(Boolean))].sort(),put=f=>{if(f)m.folder=f;else delete m.folder;this.write([['meta','media',this.media]]).catch(()=>{});this.drawLib();};
   edMenu(e.clientX,e.clientY,[['Add to the timeline','add',()=>this.add(m.id)],'-',...fs.filter(f=>f!==m.folder).map(f=>[`Move to “${esc(f)}”`,'layers',()=>put(f)]),
    ['New folder…','add',()=>{const n=prompt('Folder name','');if(n?.trim())put(n.trim().slice(0,40));}],...(m.folder?[['Out of the folder','x',()=>put('')]]:[]),'-',['Remove from Media','trash',()=>this.removeMedia(m.id),false,true]]);});
  el.querySelectorAll('.ed-media').forEach(t=>{t.ondragstart=e=>{e.dataTransfer.setData('text/x-ed-media',t.dataset.mid);e.dataTransfer.effectAllowed='copy';};t.ondblclick=()=>{const m=this.media.find(x=>x.id===t.dataset.mid);m&&(m.type==='video'||m.type==='audio')?edSource(m):this.add(t.dataset.mid);};});
 },
 drawTime(){const t=this.dom.time;if(t)t.innerHTML=`<b>${edFmt(this.time)}</b> / ${edFmt(this.end())}${this.playing&&this.rate!==1?` <span class="ed-rate">${this.rate<0?'◀ ':''}${Math.abs(this.rate)}×</span>`:''}`;const p=this.dom.play;if(p){p.innerHTML=this.playing?I.pause:I.play;p.setAttribute('aria-label',this.playing?'Pause':'Play');}this.dom.loop?.setAttribute('aria-pressed',String(!!this.loop));},
 /** The level meter: left and right, -60 to 0 dBFS, green, yellow from -12, red from -3, with a peak line. */
 drawMeter(){const cv=this.dom.meter;if(!cv)return;const g=cv.getContext('2d'),W=cv.width,H=cv.height,live=this.playing&&this.meters;g.clearRect(0,0,W,H);
  const lv=[0,1].map(i=>{if(!live)return 0;const a=this.meters[i],d=this._mbuf||(this._mbuf=new Float32Array(a.fftSize));a.getFloatTimeDomainData(d);let p=0;for(let j=0;j<d.length;j++){const x=Math.abs(d[j]);if(x>p)p=x;}return p;});
  const pk=this._mpk||(this._mpk=[0,0]),gr=g.createLinearGradient(0,0,W,0);gr.addColorStop(0,'#35c46a');gr.addColorStop(.8,'#35c46a');gr.addColorStop(.8,'#f2c037');gr.addColorStop(.95,'#f2c037');gr.addColorStop(.95,'#ef4444');gr.addColorStop(1,'#ef4444');
  lv.forEach((p,i)=>{const db=p>0?20*Math.log10(p):-90,x=edClamp((db+60)/60,0,1)*W,y=i*H/2+1,h=H/2-2;
   g.fillStyle='rgba(128,128,128,.22)';g.fillRect(0,y,W,h);g.fillStyle=gr;g.fillRect(0,y,x,h);
   pk[i]=live?Math.max(x,pk[i]-W*.006):0;if(pk[i]>1){g.fillStyle=pk[i]>=W*.95?'#ef4444':'rgba(255,255,255,.85)';g.fillRect(Math.min(W-2,pk[i]-1),y,2,h);}});
  const top=Math.max(...lv);cv.title=live&&top>0?`Peak ${(20*Math.log10(top)).toFixed(1)} dBFS`:'Sound level';},
 // ---------- speech recognition for captions: this computer (Omnilingual ASR) or ElevenLabs ----------
 capEngine(){const st=this.stt;return this.p.capEngine||(st&&!st.local.models.some(m=>m.installed)&&st.elevenlabs?'elevenlabs':'local');},
 async loadStt(){try{const r=await fetch(withKey('/api/editor/stt'));if(r.ok)this.stt=await r.json();}catch{}return this.stt;},
 /** The line under the engine choice: ready, set up (one download), downloading %, or add a key. */
 async drawStt(fetchFirst){
  if(fetchFirst||!this.stt)await this.loadStt();const el=this.dom.lib?.querySelector('[data-stt-note]');if(!el||!this.stt)return;
  const st=this.stt,eng=this.capEngine(),lm=st.local.models,ready=lm.find(m=>m.installed),pr=st.local.progress,busy=pr&&(pr.state==='downloading'||pr.state==='unpacking');
  const sel=this.dom.lib.querySelector('[data-cap-engine]');if(sel&&sel.value!==eng)sel.value=eng;
  if(eng==='elevenlabs')el.innerHTML=st.elevenlabs?`${I.check} Ready. Audio is sent to ElevenLabs.`:`Add your ElevenLabs key in Settings, Models and keys.`;
  else if(eng==='whisper')el.innerHTML=`${I.check} The Kurdish Sorani model (Whisper large-v3, trained on Sorani) on this computer. It writes punctuation.`;
  else if(ready)el.innerHTML=`${I.check} Ready on this computer: ${esc(ready.label)}. 1,600+ languages (Kurdish Sorani too), found automatically. Nothing is uploaded.`;
  else if(busy)el.innerHTML=`<span class="spin"></span> ${pr.state==='unpacking'?'Unpacking…':`Downloading the speech model… ${Math.floor(pr.bytes/pr.total*100)}%`}`;
  else{const d=lm.find(m=>m.id===st.local.default)||lm[0];
   el.innerHTML=`${pr?.state==='error'?`<b>The download stopped: ${esc(pr.error||'')}</b><br>`:''}Free speech recognition for 1,600+ languages (Kurdish Sorani too), offline. One download of ${d.mb} MB.
    <span class="ed-caprow two"><button type="button" class="btn small primary" data-stt-setup="${d.id}">${I.down} Set up (${d.mb} MB)</button>${lm.filter(m=>m.id!==d.id).map(m=>`<button type="button" class="btn small" data-stt-setup="${m.id}">Lighter (${m.mb} MB)</button>`).join('')}</span>`;
   el.querySelectorAll('[data-stt-setup]').forEach(b=>b.onclick=async()=>{b.disabled=true;
    try{const r=await fetch(withKey('/api/editor/stt/setup?model='+b.dataset.sttSetup),{method:'POST'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not start the download');this.stt=j;}catch(e){toast(e.message,true);}
    this.drawStt();});}
  clearTimeout(this._sttT);if(busy)this._sttT=setTimeout(()=>this.drawStt(true),1500);
 },
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
 drawHead(){const h=this.dom.head;if(h)h.style.transform=`translateX(${this.time*this.zoom}px)`;
  const sc=this.dom.scroll;if(this.playing&&sc){const x=this.time*this.zoom;if(x>sc.scrollLeft+sc.clientWidth-80)sc.scrollLeft=x-80;}},
 drawExport(msg){const o=this.dom.exportOverlay;if(!o)return;o.hidden=!this.exporting;const b=o.querySelector('b');if(b&&msg)b.textContent=msg;},
 laneH(t){return t.h||(t.main?ED_H.main:ED_H[t.kind]||44);},
 drawTimeline(){
  const el=this.dom.tracks;if(!el)return;const z=this.zoom,len=Math.max(this.end()+10,(this.dom.scroll?.clientWidth||900)/z);
  this.dom.inner.style.width=len*z+'px';
  const step=z>=120?1:z>=60?2:z>=30?5:z>=12?10:30;
  this.dom.ruler.innerHTML=Array.from({length:Math.ceil(len/step)+1},(_,i)=>`<span style="left:${i*step*z}px">${edFmt(i*step).slice(0,5)}</span>`).join('')+
   this.p.markers.map((m,i)=>`<i class="ed-marker${m.name?' named':''}" data-mk="${i}" style="left:${edMt(m)*z}px;${m.color?`--mc:${edLabel(m.color)}`:''}" title="${esc(m.name||'Marker')} · ${edFmt(edMt(m))}${m.note?'\n'+esc(m.note):''} (double-click to edit)">${m.name?`<span>${esc(m.name)}</span>`:''}</i>`).join('')+
   (()=>{const r=this.p.range;if(!r||(r.in==null&&r.out==null))return '';const a=r.in??0,b=r.out??Math.max(this.end(),a);
    return `<i class="ed-range" style="left:${a*z}px;width:${Math.max(2,(b-a)*z)}px" title="In ${edFmt(a)} · Out ${edFmt(b)}">${r.in!=null?'<b class="ed-rmark ed-rmark-in"></b>':''}${r.out!=null?'<b class="ed-rmark ed-rmark-out"></b>':''}</i>`;})();
  const tr=this.p.tracks;
  el.innerHTML=`<div class="ed-lane-new" data-new="top"></div>${tr.map(t=>{const cl=this.p.clips.filter(c=>c.track===t.id).sort((a,b)=>a.start-b.start);
   const joins=t.kind==='video'?cl.slice(1).filter((c,i)=>Math.abs(cl[i].start+cl[i].dur-c.start)<.05).map(c=>`<button type="button" class="ed-join${c.trans?' on':''}${this.junction===c.id?' sel':''}" data-join="${c.id}" style="left:${c.start*z}px" aria-label="Transition" title="${c.trans?ED_TRANS.find(x=>x[0]===c.trans.type)?.[1]:'Add a transition'}">${c.trans?I.trans:''}</button>`).join(''):'';
   return `<div class="ed-lane${t.main?' main':''}${t.locked?' locked':''}${t.hidden?' hidden':''}" data-track="${t.id}" data-kind="${t.kind}" style="height:${this.laneH(t)}px">${cl.map(c=>this.clipHtml(c)).join('')}${joins}${t.main&&!this.p.clips.length?`<span class="ed-lane-hint">${I.film} Drag media here and start creating</span>`:''}</div>`;}).join('')}<div class="ed-lane-new" data-new="bottom"></div>`;
  this.dom.heads.innerHTML=`<div class="ed-head-gap"></div>${tr.map(t=>{const vis=t.kind!=='audio',snd=t.kind==='video'||t.kind==='audio';
   return `<div class="ed-head${t.main?' main':''}" style="height:${this.laneH(t)}px" data-track="${t.id}"><i class="ed-head-rz" data-hrz title="Drag to resize"></i>${t.color?`<i class="ed-head-color" style="background:${edLabel(t.color)}"></i>`:''}<span class="ed-head-name" title="Double-click to rename">${I[ED_KINDS[t.kind].icon]}${t.name?esc(t.name):t.main?'Main':ED_KINDS[t.kind].label}</span>
    <span class="ed-head-tools"><button type="button" data-tk="locked" aria-pressed="${!!t.locked}" aria-label="${t.locked?'Unlock':'Lock'} track">${t.locked?I.lock:I.unlock}</button>
    ${vis?`<button type="button" data-tk="hidden" aria-pressed="${!!t.hidden}" aria-label="${t.hidden?'Show':'Hide'} track">${t.hidden?I.eyeOff:I.eye}</button>`:''}
    ${snd?`<button type="button" data-tk="muted" aria-pressed="${!!t.muted}" aria-label="${t.muted?'Unmute':'Mute'} track">${t.muted?I.mute:I.sound}</button>`:''}
    ${t.main?'':`<button type="button" data-tk="remove" aria-label="Delete track">${I.x}</button>`}</span></div>`;}).join('')}<div class="ed-head-gap"></div>`;
  this.dom.heads.querySelectorAll('.ed-head').forEach(h=>{const id=h.dataset.track,t=this.p.tracks.find(x=>x.id===id);if(!t)return;
   h.querySelector('.ed-head-name').ondblclick=()=>{const n=prompt('Track name',t.name||'');if(n===null)return;this.snapshot();this.setTrackProp(id,{name:n.trim().slice(0,30)||undefined});this.drawTimeline();};
   h.oncontextmenu=e=>{e.preventDefault();edMenu(e.clientX,e.clientY,[['Rename…','text',()=>h.querySelector('.ed-head-name').ondblclick()],...ED_LABELS.map(([v,l])=>[`<i class="ed-swatch" style="background:${edLabel(v)}"></i>${l}`,'',()=>{this.snapshot();this.setTrackProp(id,{color:v});this.drawTimeline();}]),['No colour','x',()=>{this.snapshot();this.setTrackProp(id,{color:undefined});this.drawTimeline();},!t.color],'-',['Mixer…','sound',()=>edMixer()]]);};
   const rz=h.querySelector('[data-hrz]');rz.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const y0=e.clientY,h0=this.laneH(t);this.snapshot();
    const mv=ev=>{t.h=Math.round(edClamp(h0+ev.clientY-y0,28,160));this.drawTimeline();},up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);this.save();};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);};});
  this.dom.ruler.querySelectorAll('[data-mk]').forEach(n=>{n.onpointerdown=e=>e.stopPropagation();n.onclick=()=>this.seek(edMt(this.p.markers[Number(n.dataset.mk)]));n.ondblclick=e=>edMarkerEdit(e.currentTarget,Number(n.dataset.mk));});
  this.dom.heads.querySelectorAll('[data-tk]').forEach(b=>b.onclick=()=>{const id=b.closest('[data-track]').dataset.track;b.dataset.tk==='remove'?this.removeTrack(id):this.setTrack(id,b.dataset.tk);});
  el.querySelectorAll('[data-join]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.selectJoin(b.dataset.join);});
  const mg=this.dom.root?.querySelector('[data-magnet]');if(mg)mg.setAttribute('aria-pressed',String(!!this.p.magnet));this.drawCrumb?.();
  this.drawHead();
 },
 clipHtml(c){
  const m=this.mediaOf(c),w=c.dur*this.zoom,sel=this.sels.has(c.id),kind=this.kindOf(c);
  let inner='';
  if(c.adjustment)inner=`<span class="ed-clip-label">${I.layers}Adjustment layer</span>`;
  else if(c.text!==undefined)inner=`${c.words?.some(w=>w.alt)?`<b class="ed-tocheck" title="Words to check">${I.flag}</b>`:''}<span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${I.text}${esc(c.text||'Text')}</span>`;
  else if(c.sticker)inner=`<span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${c.sticker.type==='emoji'?c.sticker.emoji:I.shapes}${esc(c.sticker.type==='emoji'?'Sticker':ED_SHAPES.find(s=>s[0]===c.sticker.shape)?.[1]||'Shape')}</span>`;
  else if(kind==='audio'){const pk=m?.peaks||[],from=(c.in||0)/(m?.dur||1),to=((c.in||0)+c.dur*(c.speed||1))/(m?.dur||1),part=pk.slice(Math.floor(from*pk.length),Math.ceil(to*pk.length)),v=edClamp(c.volume??1,0,2);
   inner=`<svg class="ed-wave" viewBox="0 0 ${Math.max(1,part.length)} 100" preserveAspectRatio="none">${part.map((x,i)=>`<rect x="${i}" y="${50-x*46*Math.min(1,v)}" width=".6" height="${Math.max(2,x*92*Math.min(1,v))}"/>`).join('')}</svg>
    <i class="ed-vol" style="top:${16+(1-v/2)*(this.laneH({kind:'audio'})-20)}px" title="Volume ${Math.round(v*100)}%"></i><span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${I.music}${esc(m?.name||'')}${c.speed&&c.speed!==1?` · ${c.speed}×`:''}</span>`;}
  else if(c.nest)inner=`<span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${I.layers}${esc(c.nest.name||'Nested')} · ${c.nest.multi?`${c.nest.tracks.filter(t=>t.kind==='video').length} angles`:`${c.nest.clips.length} clip${c.nest.clips.length===1?'':'s'}`}</span>${c.nest.multi?(c.nest.cuts||[]).map(k=>{const x=(k.t-(c.in||0))*this.zoom;return x>0&&x<w?`<i class="ed-cut" style="left:${x}px" title="Angle ${k.a+1}"></i>`:'';}).join(''):''}`;
  else if(m){const th=m.thumbs||[],n=Math.max(1,Math.ceil(w/56));inner=`<div class="ed-strip">${Array.from({length:n},(_,i)=>{const src=th.length?th[Math.min(th.length-1,Math.floor(((c.in||0)+(i+.5)/n*c.dur*(c.speed||1))/(m.dur||c.dur)*th.length))]:'';return src?`<img src="${src}" alt="" style="filter:${edCssFilter(c.adj||{})}">`:'<i></i>';}).join('')}</div>
   <span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${c.detached?I.mute:''}${esc(m.name)}${c.speed&&c.speed!==1?` · ${c.speed}×`:''}</span>`;}
  const kts=sel&&c.kf?[...new Set(Object.values(c.kf).flat().map(x=>Math.round(x.t*100)/100))]:[];
  const fi=(c.fadeIn||0)*this.zoom,fo=(c.fadeOut||0)*this.zoom,fades=c.media&&w>40?`${fi?`<i class="ed-fz l" style="width:${fi}px"></i>`:''}${fo?`<i class="ed-fz r" style="width:${fo}px"></i>`:''}<i class="ed-fh" data-fh="in" style="left:${Math.max(10,fi)}px" title="Fade in ${(c.fadeIn||0).toFixed(1)} s: drag"></i><i class="ed-fh" data-fh="out" style="left:${Math.min(w-10,w-fo)}px" title="Fade out ${(c.fadeOut||0).toFixed(1)} s: drag"></i>`:'';
  return `<div class="ed-clip ${kind}${c.nest?' nest':''}${sel?' sel':''}${c.label?' labelled':''}" data-cid="${c.id}" style="left:${c.start*this.zoom}px;width:${w}px;${c.label?`--lc:${edLabel(c.label)}`:''}">${inner}${fades}${kts.map(t=>`<i class="ed-kf" style="left:${t*this.zoom}px"></i>`).join('')}<i class="ed-h l" data-h="l"></i><i class="ed-h r" data-h="r"></i></div>`;
 },
 drawProps(){
  const el=this.dom.props;if(!el)return;const [W,H]=this.base(),n=this.sels.size;
  // A transition between two clips.
  if(this.junction&&this.clip(this.junction)){const c=this.clip(this.junction),tr=c.trans;
   el.innerHTML=`<nav class="ed-ptabs" role="tablist"><button type="button" role="tab" aria-selected="true">Transition</button>${tr?`<span class="grow"></span><button type="button" class="iconbtn sm" data-remove aria-label="Remove transition" data-tooltip="Remove">${I.trash}</button>`:''}</nav>
    <div class="ed-pbody"><div class="ed-filters trans">${[['none','None'],...ED_TRANS].map(([id,l])=>`<button type="button" class="ed-filter" data-tr="${id}" aria-pressed="${(tr?.type||'none')===id}"><span class="ed-trans-swatch t-${id}"></span><span>${l}</span></button>`).join('')}</div>
    ${tr?`<section class="ed-sec"><div class="ed-row"><label for="ed-trd">Length</label><div class="ed-ctl"><input type="range" id="ed-trd" min=".2" max="2" step=".1" value="${tr.dur}"><span class="ed-num"><b data-trd>${tr.dur.toFixed(1)}</b><i>s</i></span></div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-tr-all>${I.layers} Use on every cut</button></div></div></section>`:''}</div>`;
   el.querySelectorAll('[data-tr]').forEach(b=>b.onclick=()=>{this.setTrans(c,b.dataset.tr);this.selectJoin(c.id);});
   const d=$('#ed-trd',el);if(d){d.onpointerdown=d.onfocus=()=>{if(!d._s){this.snapshot();d._s=true;}};d.oninput=()=>{c.trans.dur=Number(d.value);$('[data-trd]',el).textContent=c.trans.dur.toFixed(1);this.draw();};d.onchange=()=>{d._s=false;this.save();};}
   const all=$('[data-tr-all]',el);if(all)all.onclick=()=>{this.transAll(tr.type,tr.dur);toast('Used on every cut');this.selectJoin(c.id);};
   const rm=$('[data-remove]',el);if(rm)rm.onclick=()=>{this.setTrans(c,'none');this.selectJoin(c.id);};return;}
  const c=this.sel&&this.clip(this.sel),m=c&&this.mediaOf(c);
  if(n>1){el.innerHTML=`<nav class="ed-ptabs" role="tablist"><button type="button" role="tab" aria-selected="true">${n} clips</button><span class="grow"></span><button type="button" class="iconbtn sm" data-remove aria-label="Delete clips" data-tooltip="Delete">${I.trash}</button></nav>
   <div class="ed-pbody"><div class="ed-multi"><span class="ed-multi-icon">${I.layers}</span><b>${n} clips selected</b><div class="ed-multi-actions"><button type="button" class="btn small" data-act="dup">${I.copy} Duplicate</button><button type="button" class="btn small" data-act="copy">Copy</button><button type="button" class="btn small ghost danger-text" data-act="del">${I.trash} Delete</button></div><small>Drag any of them to move them together.</small></div></div>`;
   el.querySelector('[data-remove]').onclick=el.querySelector('[data-act=del]').onclick=()=>this.remove();el.querySelector('[data-act=dup]').onclick=()=>this.duplicate();el.querySelector('[data-act=copy]').onclick=()=>this.copy();return;}
  const conv={pct:[v=>Math.round(v*100),v=>v/100],pxx:[v=>Math.round(v*W),v=>v/W],pxy:[v=>Math.round(v*H),v=>v/H],raw:[v=>Math.round(v*100)/100,v=>v]};
  const kfBtn=key=>c&&ED_KFKEYS.has(key)?`<button type="button" class="ed-kfbtn${this.kfAt(c,key)>=0?' on':''}${c.kf?.[key]?.length?' has':''}" data-kf="${key}" aria-label="Keyframe" data-tooltip="Keyframe">${I.diamond}</button>`:'';
  const cur=(key,def)=>c?(ED_KFKEYS.has(key)?this.val(c,key):(c[key]??def)):def;
  const row=(key,label,val,{min,max,step=1,unit='raw',suffix='',slider=true}={})=>{const [show]=conv[unit];
   return `<div class="ed-row"><label for="ed-${key}">${label}</label><div class="ed-ctl">${slider?`<input type="range" data-k="${key}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${show(val)}" aria-label="${label}">`:''}
    <span class="ed-num"><input type="number" id="ed-${key}" data-k="${key}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${show(val)}">${suffix?`<i>${suffix}</i>`:''}</span>${kfBtn(key)}</div></div>`;};
  const sec=(title,body,reset)=>`<section class="ed-sec"><header><h4>${title}</h4>${reset?`<button type="button" class="iconbtn sm" data-reset="${reset}" aria-label="Reset ${title}" data-tooltip="Reset">${I.refresh}</button>`:''}</header>${body}</section>`;
  const seg=(attr,list,val)=>`<div class="ed-seg">${list.map(([v,l])=>`<button type="button" data-${attr}="${v}" aria-pressed="${val===v}">${l}</button>`).join('')}</div>`;
  const kind=!c?'':c.nest?'nest':c.adjustment?'adjustment':c.text!==undefined?'text':c.sticker?'sticker':this.kindOf(c)==='audio'?'audio':m?.type||'video';
  const tabs=!c?[['details','Details']]:kind==='text'?[['text','Text'],['anim','Animation'],['basic','Basic']]:kind==='sticker'?[['sticker','Sticker'],['anim','Animation'],['basic','Basic']]:kind==='audio'?[['audio','Audio'],['speed','Speed']]:kind==='adjustment'?[['adjust','Adjust'],['colour','Colour'],['effects','Effects'],['mask','Mask'],['basic','Basic']]:kind==='nest'?[['basic','Basic'],['adjust','Adjust'],['colour','Colour'],['effects','Effects'],['mask','Mask']]:kind==='image'?[['basic','Basic'],['adjust','Adjust'],['colour','Colour'],['effects','Effects'],['mask','Mask']]:[['basic','Basic'],['adjust','Adjust'],['colour','Colour'],['effects','Effects'],['mask','Mask'],['audio','Audio'],['speed','Speed']];
  if(!tabs.some(([id])=>id===this.ptab))this.ptab=tabs[0][0];
  const t=this.ptab,locked=c&&this.trackOf(c)?.locked;let body='';
  const fades=()=>sec('Fade',`${row('fadeIn','Fade in',c.fadeIn||0,{min:0,max:Math.min(5,+(c.dur/2).toFixed(1)),step:.1,suffix:'s'})}${row('fadeOut','Fade out',c.fadeOut||0,{min:0,max:Math.min(5,+(c.dur/2).toFixed(1)),step:.1,suffix:'s'})}`);
  if(!c)body=`<dl class="ed-details"><dt>Name</dt><dd dir="auto">${esc(this.p.name)}</dd><dt>Shape</dt><dd>${seg('ratio',Object.keys(ED_RATIOS).map(r=>[r,r]),this.p.ratio)}</dd>
    <dt>Resolution</dt><dd>${W} × ${H}</dd><dt>Length</dt><dd>${edFmt(this.end())}</dd><dt>Clips</dt><dd>${this.p.clips.length} on ${this.p.tracks.length} tracks</dd>
    <dt>Background</dt><dd>${seg('bgmode',[['color','Colour'],['blur','Blur']],this.p.bgMode)}</dd>${this.p.bgMode==='color'?`<dt></dt><dd><input type="color" data-bg value="${esc(this.p.bg||'#000000')}" aria-label="Background colour"></dd>`:''}
    <dt>Proxies</dt><dd>${this.media.some(m=>m.proxy)?`<label class="ed-xopt"><input type="checkbox" data-useproxy ${this.p.useProxy===false?'':'checked'}> Play with proxies</label>`:''}${this.p.clips.some(c=>{const m=this.mediaOf(c);return m&&m.type==='video'&&!m.proxy&&Math.max(m.w||0,m.h||0)>1280;})?` <button type="button" class="ed-link" data-proxies>Make proxies for big videos</button>`:this.media.some(m=>m.proxy)?'':'None needed'}</dd>
    <dt>Markers</dt><dd>${this.p.markers.length?`${this.p.markers.length} · <button type="button" class="ed-link" data-clear-markers>Clear</button>`:'Press M to add one'}</dd></dl>
    ${this.p.markers.length?`<div class="ed-mlist">${this.p.markers.map((m,i)=>`<button type="button" class="ed-mrow" data-mgo="${i}"><i class="ed-swatch" style="background:${m.color?edLabel(m.color):'var(--warn)'}"></i><span>${edFmt(edMt(m))}</span><b dir="auto">${esc(m.name||'Marker')}</b>${m.note?`<small dir="auto">${esc(m.note)}</small>`:''}</button>`).join('')}</div>`:''}`;
  else if(t==='text')body=(c.words?sec('Caption',`<div class="ed-seg wrap">${ED_CAPS.map(([v,l])=>`<button type="button" data-caplook="${v}" aria-pressed="${(c.capLook||'clean')===v}">${l}</button>`).join('')}</div>
     ${c.capStyle==='karaoke'||c.capStyle==='build'?`<div class="ed-row"><label>Highlight</label><div class="ed-ctl"><input type="color" data-k="hl" value="${esc(c.hl||'#FFD400')}" aria-label="Highlight colour"></div></div>`:''}
     ${c.words.some(w=>w.alt)?`<div class="ed-checks"><b>${I.flag} Check these words</b>${c.words.map((w,i)=>w.alt?`<div class="ed-check"><span class="ed-check-words"><bdi>${esc(c.words.slice(i,i+(w.altSpan||1)).map(x=>x.t).join(' '))}</bdi><i>other model heard</i><bdi>${esc(w.alt)}</bdi></span><span class="ed-check-btns"><button type="button" class="btn small" data-alt="${i}">Use</button><button type="button" class="btn small ghost" data-keep="${i}">Keep</button></span></div>`:'').join('')}</div>`:''}
     <div class="ed-row"><label>Capitals</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="upper" ${c.upper?'checked':''} aria-label="Capitals"></div></div>
     <div class="ed-row"><label>Language</label><div class="ed-ctl"><span class="ed-val" dir="auto">${esc(edLangName(c.lang||'auto'))}</span></div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-cap-all>${I.layers} Use this look on every caption</button></div></div>`):'')+sec('Text',`<textarea data-k="text" rows="3" dir="auto" aria-label="Text">${esc(c.text||'')}</textarea>${c.words?'':`<div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-tpl-save>${I.add} Save style as a template</button></div></div>`}`)+
    sec('Style',`<div class="ed-row"><label>Font</label><div class="ed-ctl"><select data-k="font" aria-label="Font">${ED_FONTS.map(([f,l])=>`<option value="${esc(f)}" ${c.font===f?'selected':''}>${l}</option>`).join('')}</select></div></div>
     ${row('size','Size',c.size||40,{min:12,max:200})}${row('weight','Weight',c.weight||600,{min:300,max:900,step:100})}${row('spacing','Letter spacing',c.spacing||0,{min:-5,max:30})}${row('lineH','Line spacing',c.lineH||1.25,{min:80,max:250,step:5,unit:'pct',suffix:'%'})}
     <div class="ed-row"><label>Colour</label><div class="ed-ctl"><input type="color" data-k="color" value="${esc(c.color||'#ffffff')}" aria-label="Colour"></div></div>
     <div class="ed-row"><label>Align</label><div class="ed-ctl">${seg('align',[['left','Left'],['center','Center'],['right','Right']],c.align||'center')}</div></div>`)+
    sec('Outline and shadow',`${row('stroke','Outline',c.stroke||0,{min:0,max:12})}<div class="ed-row"><label>Outline colour</label><div class="ed-ctl"><input type="color" data-k="strokeColor" value="${esc(c.strokeColor||'#000000')}" aria-label="Outline colour"></div></div>
     <div class="ed-row"><label>Shadow</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="shadow" ${c.shadow?'checked':''} aria-label="Shadow"></div></div>
     <div class="ed-row"><label>Background</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="box" ${c.box?'checked':''} aria-label="Background box">${c.box?`<input type="color" data-k="boxColor" value="${esc(c.boxColor||'#000000')}" aria-label="Box colour">`:''}</div></div>`);
  else if(t==='sticker')body=c.sticker.type==='shape'?sec('Colour',`<div class="ed-row"><label>Fill</label><div class="ed-ctl"><input type="color" data-k="color" value="${esc(c.color||'#ffd23f')}" aria-label="Fill colour"></div></div>`)+sec('Shape',`<div class="ed-stickers small">${ED_SHAPES.map(([s,l])=>`<button type="button" class="ed-sticker" data-reshape="${s}" aria-pressed="${c.sticker.shape===s}" title="${l}"><svg viewBox="0 0 40 40">${edShapeSvg(s)}</svg></button>`).join('')}</div>`)
    :sec('Emoji',`<div class="ed-stickers small">${ED_EMOJI.map(e=>`<button type="button" class="ed-sticker emoji" data-reemoji="${e}" aria-pressed="${c.sticker.emoji===e}">${e}</button>`).join('')}</div>`);
  else if(t==='anim')body=sec('In',seg('animIn',ED_ANIMS,c.animIn||'none'))+sec('Out',seg('animOut',ED_ANIMS.filter(a=>a[0]!=='type'&&a[0]!=='words'),c.animOut||'none'))+sec('Speed',row('animDur','Length',c.animDur||.5,{min:.1,max:2,step:.1,suffix:'s'}));
  else if(t==='basic'){const cr=c.crop||{},media=kind!=='text'&&kind!=='sticker';
   body=sec('Transform',`${kind!=='text'?row('scale','Scale',cur('scale'),{min:10,max:300,unit:'pct',suffix:'%'}):row('scale','Scale',cur('scale'),{min:20,max:300,unit:'pct',suffix:'%'})}
     <div class="ed-row"><label>Position</label><div class="ed-ctl two"><span class="ed-num"><b>X</b><input type="number" data-k="x" data-u="pxx" step="1" value="${Math.round(cur('x')*W)}" aria-label="Position X"></span><span class="ed-num"><b>Y</b><input type="number" data-k="y" data-u="pxy" step="1" value="${Math.round(cur('y')*H)}" aria-label="Position Y"></span>${kfBtn('x')}</div></div>
     ${row('rotate','Rotate',cur('rotate'),{min:-180,max:180,suffix:'°',slider:false})}
     ${media?`<div class="ed-row"><label>Flip</label><div class="ed-ctl"><button type="button" class="ed-tool" data-flip="flipH" aria-pressed="${!!c.flipH}">${I.flipH} Mirror</button><button type="button" class="ed-tool" data-flip="flipV" aria-pressed="${!!c.flipV}">${I.flipV} Flip</button></div></div>`:''}`,'transform')+
    (media?sec('Crop',`${['l','t','r','b'].map(s=>row('crop'+s,{l:'Left',t:'Top',r:'Right',b:'Bottom'}[s],cr[s]||0,{min:0,max:45,unit:'pct',suffix:'%'})).join('')}`,'crop'):'')+
    (media&&c.media?sec('Smart tools',this.toolJobs[c.id]?`<div class="ed-note"><span class="spin"></span> ${esc(this.toolJobs[c.id].label)}…${this.toolJobs[c.id].progress!=null?` ${Math.round(this.toolJobs[c.id].progress*100)}%`:''}<br><small>${esc(this.toolJobs[c.id].note||'Working on this computer; you can keep editing.')}</small></div>`:
     `<div class="ed-tools-row">${m?.type==='video'?`<button type="button" class="ed-tool" data-tool="stabilize">${I.wand} Stabilise</button>`:''}<button type="button" class="ed-tool" data-tool="cutout">${I.image} Remove background</button>${m?.type==='video'?`<button type="button" class="ed-tool" data-reverse>${I.undo} Reverse</button>`:''}${this.trackOf(c)&&!this.trackOf(c).main?`<button type="button" class="ed-tool" data-trackmo>${I.flag} Track motion</button>`:''}${m?.type==='video'?`<button type="button" class="ed-tool" data-tool="reframe">${I.crop} Auto reframe</button>`:''}</div>
     <p class="ed-hint">Stabilise steadies shaky footage. Remove background cuts out the person or object. Auto reframe fills the ${esc(this.p.ratio)} frame and follows the face.</p>`):'')+
    (!c.media&&!c.adjustment?sec('Motion tracking',this.toolJobs[c.id]?`<div class="ed-note"><span class="spin"></span> ${esc(this.toolJobs[c.id].label)}…</div>`:`<div class="ed-tools-row"><button type="button" class="ed-tool" data-trackmo>${I.flag} Track motion</button></div><p class="ed-hint">Place this over the thing to follow at the clip's start, then press: it moves with it in the video below.</p>`):'')+
    sec('Opacity and blend',row('opacity','Opacity',cur('opacity'),{min:0,max:100,unit:'pct',suffix:'%'})+`<div class="ed-row"><label for="ed-blend">Blend</label><div class="ed-ctl"><select id="ed-blend" data-k="blend" aria-label="Blend mode">${ED_BLENDS.map(([v,l])=>`<option value="${v}" ${(c.blend||'normal')===v?'selected':''}>${l}</option>`).join('')}</select></div></div>`)+(media?fades():'')+
    `<p class="ed-hint">${I.diamond} Keyframes: move the playhead, press the diamond, change the value. It animates between them.</p>`;}
  else if(t==='adjust'){const a=c.adj||{};body=sec('Filter',`<div class="ed-filters small">${ED_FILTERS.map(([id,l,f])=>`<button type="button" class="ed-filter" data-filter="${id}" aria-pressed="${JSON.stringify(a)===JSON.stringify(f)}"><span class="ed-filter-swatch" style="filter:${edCssFilter(f)}"></span><span>${l}</span></button>`).join('')}</div>`)+
    sec('Adjust',ED_ADJ.map(([k,l,mn,mx])=>row('adj_'+k,l,a[k]||0,{min:mn,max:mx})).join(''),'adjust')+
    sec('Green screen',`<div class="ed-row"><label>Remove a colour</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="key_on" ${c.key?.on?'checked':''} aria-label="Green screen"><button type="button" class="ed-tool" data-key-pick aria-pressed="${this.picking===c.id}">${I.wand} ${this.picking===c.id?'Click the picture…':'Pick from picture'}</button></div></div>
     ${c.key?.on?`<div class="ed-row"><label>Colour</label><div class="ed-ctl"><input type="color" data-k="key_color" value="${esc(c.key.color||'#00b140')}" aria-label="Key colour"></div></div>
      ${row('key_sim','Similarity',c.key.sim??25,{min:0,max:100})}${row('key_smooth','Smoothness',c.key.smooth??10,{min:0,max:100})}${row('key_spill','Spill',c.key.spill??50,{min:0,max:100})}`:''}`);}
  else if(t==='effects'){const fx=c.fx||{};
   body=sec('Look',`${row('fx_sharpen','Sharpen',fx.sharpen||0,{min:0,max:100})}${row('fx_glow','Glow',fx.glow||0,{min:0,max:100})}${row('fx_grain','Film grain',fx.grain||0,{min:0,max:100})}${row('fx_shake','Camera shake',fx.shake||0,{min:0,max:100})}`,'fx')+
    (kind!=='adjustment'?sec('Frame',`${row('fx_radius','Round corners',fx.radius||0,{min:0,max:100,suffix:'%'})}${row('fx_border','Border',fx.border||0,{min:0,max:20,suffix:'px'})}
     <div class="ed-row"><label>Border colour</label><div class="ed-ctl"><input type="color" data-k="fx_borderColor" value="${esc(fx.borderColor||'#ffffff')}" aria-label="Border colour"></div></div>${row('fx_shadow','Shadow',fx.shadow||0,{min:0,max:100})}
     <p class="ed-hint">Without rounded corners, the shadow follows the picture's own outline (good on cut-outs).</p>`):'');}
  else if(t==='colour'){const g=c.grade||{},ch=this.curveCh||'m',luts=this.lutList||[];
   body=sec('Colour wheels',`<div class="ed-wheels">${[['lift','Shadows'],['gamma','Midtones'],['gain','Highlights']].map(([k,l])=>`<div class="ed-wheel" data-wheel="${k}"><b>${l}</b>${edWheelSvg(g[k])}
     <input type="range" min="-100" max="100" step="1" value="${Math.round((g[k]?.l||0)*100)}" data-wl="${k}" aria-label="${l} brightness"><button type="button" class="ed-link" data-wreset="${k}">Reset</button></div>`).join('')}</div>
     <p class="ed-hint">Drag the dot towards a colour to tint that range; the slider makes it lighter or darker. Double-click a wheel to reset it.</p>`,'grade')+
    sec('Curves',`${'<div class="ed-seg">'+[['m','All'],['r','Red'],['g','Green'],['b','Blue']].map(([v,l])=>`<button type="button" data-curvech="${v}" aria-pressed="${ch===v}">${l}</button>`).join('')+'</div>'}
     <div class="ed-curve ed-gcurve">${edGradeCurveSvg(g.curves?.[ch],ch)}</div><p class="ed-hint">Click the line to add a point, drag it, double-click to remove it.</p>`)+
    sec('Look (LUT)',`<div class="ed-row"><label>Look</label><div class="ed-ctl"><select data-lut aria-label="Look"><option value="">None</option>${luts.map(l=>`<option value="${l.id}" ${g.lut?.id===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div></div>
     ${g.lut?.id?row('lutmix','Intensity',g.lut.mix??1,{min:0,max:100,unit:'pct',suffix:'%'}):''}
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-lut-import>${I.upload} Import .cube</button><input type="file" accept=".cube" data-lut-file hidden></div></div>`);}
  else if(t==='mask'){const mk=c.mask||{shape:'none'},sh=mk.shape||'none';
   body=sec('Shape',`<div class="ed-seg wrap">${ED_MASKS.map(([v,l])=>`<button type="button" data-mask="${v}" aria-pressed="${sh===v}">${l}</button>`).join('')}</div>`,sh!=='none'?'mask':'')+
    (sh==='none'?`<p class="ed-hint">A mask shows only part of the clip: a box, an ellipse, or one side of a line. Feather softens its edge.</p>`:
     sec('Mask',`${sh!=='linear'?row('mask_w','Width',mk.w??.8,{min:1,max:200,unit:'pct',suffix:'%'})+row('mask_h','Height',mk.h??.8,{min:1,max:200,unit:'pct',suffix:'%'}):''}
      ${row('mask_x','Position X',mk.x||0,{min:-100,max:100,unit:'pct',suffix:'%'})}${row('mask_y','Position Y',mk.y||0,{min:-100,max:100,unit:'pct',suffix:'%'})}
      ${sh==='linear'?row('mask_angle','Angle',mk.angle||0,{min:-180,max:180,suffix:'°'}):''}${sh==='rect'?row('mask_round','Round corners',mk.round||0,{min:0,max:100,unit:'pct',suffix:'%'}):''}
      ${row('mask_feather','Feather',mk.feather||0,{min:0,max:200,suffix:'px'})}
      <div class="ed-row"><label>Invert</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="mask_invert" ${mk.invert?'checked':''} aria-label="Invert mask"></div></div>`));}
  else if(t==='audio'){const snd=!(kind==='video'&&c.detached),g=c.gainDb||0,lu=m?.lufs;
   const loud=sec('Loudness',`<div class="ed-row"><label>Match</label><div class="ed-ctl"><button type="button" class="ed-tool" data-loud>${I.wave} Even loudness (−14 LUFS)</button></div></div>
     <div class="ed-row"><label>Gain</label><div class="ed-ctl"><span class="ed-val">${g>0?'+':''}${g.toFixed(1)} dB${typeof lu==='number'?` · file ${lu} LUFS`:''}</span>${g?`<button type="button" class="ed-link" data-loud-reset>Reset</button>`:''}</div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-link" data-loud-all>Match every clip with sound</button></div></div>`);
   const duck=snd?sec('Ducking',`<div class="ed-row"><label>Lower under speech</label><div class="ed-ctl"><input type="checkbox" role="switch" data-duck ${c.duck?'checked':''} aria-label="Lower under speech"></div></div>
     ${c.duck?row('duckdb','Lower by',-(c.duck.db??-12),{min:3,max:30,suffix:'dB'}):''}<p class="ed-hint">${I.music} The sound goes down while someone speaks in the other clips and comes back after. Use it on music.</p>`):'';
   const af=c.afx||{};const sfx=snd?sec('Equaliser and effects',`${row('afx_low','Low (bass)',af.low||0,{min:-18,max:18,suffix:'dB'})}${row('afx_mid','Mid (voice)',af.mid||0,{min:-18,max:18,suffix:'dB'})}${row('afx_high','High (air)',af.high||0,{min:-18,max:18,suffix:'dB'})}
     ${row('afx_comp','Compressor',af.comp||0,{min:0,max:100,suffix:'%'})}${row('afx_reverb','Reverb',af.reverb||0,{min:0,max:100,suffix:'%'})}
     <div class="ed-row"><label>Voice</label><div class="ed-ctl"><div class="ed-chips">${ED_VOICES.map(([v,l])=>`<button type="button" data-voice="${v}" aria-pressed="${(af.voice||'')===v}">${l}</button>`).join('')}</div></div></div>
     ${row('afx_pitch','Pitch',af.pitch||0,{min:-12,max:12,suffix:'st'})}
     <div class="ed-row"><label>Presets</label><div class="ed-ctl"><div class="ed-chips">${[['voice','Clear voice'],['radio','Radio'],['warm','Warm'],['podcast','Podcast'],['hall','Hall'],['flat','Flat']].map(([v,l])=>`<button type="button" data-afx="${v}">${l}</button>`).join('')}</div></div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><div class="ed-tools-row"><button type="button" class="ed-tool" data-tool="voice">${I.mic} Clean voice (noise, hum)</button><button type="button" class="ed-tool" data-tool="beats">${I.flag} Beat markers</button></div></div></div>
     ${this.toolJobs[c.id]?`<div class="ed-note"><span class="spin"></span> ${esc(this.toolJobs[c.id].label)}…</div>`:''}`,'afx'):'';
   body=(kind==='video'?sec('Sound',c.detached?`<div class="ed-note">${I.detach} The sound is on its own audio track.</div>`:`${row('volume','Volume',cur('volume'),{min:0,max:200,unit:'pct',suffix:'%'})}<div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-detach>${I.detach} Detach audio</button></div></div>`)
    :sec('Volume',row('volume','Volume',cur('volume'),{min:0,max:200,unit:'pct',suffix:'%'})))+(snd?loud:'')+sfx+duck+(kind==='audio'?fades():'');}
  else if(t==='speed')body=sec('Speed',`${row('speed','Speed',c.speed||1,{min:.25,max:4,step:.05,suffix:'×'})}<div class="ed-chips">${[.5,1,1.5,2,3].map(s=>`<button type="button" data-speed="${s}" aria-pressed="${(c.speed||1)===s}">${s}×</button>`).join('')}</div>
     <div class="ed-row"><label>Length</label><div class="ed-ctl"><span class="ed-val">${edFmt(c.dur)}</span></div></div>`,'speed')+
    sec('Speed curve',`<div class="ed-seg wrap">${[['none','None'],...ED_RAMPS.map(r=>[r[0],r[1]]),...(c.rampName==='custom'?[['custom','Custom']]:[])].map(([id,l])=>`<button type="button" data-ramp="${id}" aria-pressed="${(c.ramp?(c.rampName||'custom'):'none')===id}">${l}</button>`).join('')}</div>
     ${c.ramp?`<div class="ed-curve">${edCurveSvg(c.ramp)}</div><p class="ed-hint">Drag a point up for faster, down for slower. Click the line to add a point; double-click one to remove it.</p>`:'<p class="ed-hint">A curve changes the speed within the clip: fast, then slow motion, then fast. The sound keeps its pitch.</p>'}`);
  const ke=c&&(t==='basic'||t==='audio')&&c.kf?this.kfEaseAt(c):null;
  if(c?.nest?.multi&&t==='basic'){const vt=c.nest.tracks.filter(x=>x.kind==='video'),on=this.time>=c.start&&this.time<c.start+c.dur,cur=this.angleAt(c,this.time-c.start+(c.in||0));
   body=sec('Multicam',`<div class="ed-row"><label>Angle</label><div class="ed-ctl"><div class="ed-seg wrap">${vt.map((x,i)=>`<button type="button" data-angle="${i}" aria-pressed="${on&&cur===i}" title="${esc(x.name||'')} (key ${i+1})">${i+1}${x.name?` · ${esc(x.name)}`:''}</button>`).join('')}</div></div></div>
    <div class="ed-row"><label for="ed-mca">Sound from</label><div class="ed-ctl"><select id="ed-mca" data-mc-audio>${c.nest.tracks.map(x=>`<option value="${esc(x.id)}" ${c.nest.audio===x.id?'selected':''}>${esc(x.name||x.id)}</option>`).join('')}</select></div></div>
    <p class="ed-hint">Play and press 1–9 to cut between angles as it plays; each press is a cut from the playhead on. Double-click the clip to move an angle by hand; Break apart turns it into ordinary clips.</p>`)+body;}
  if(ke)body=sec('Keyframe at the playhead',`<div class="ed-row"><label>To the next</label><div class="ed-ctl"><div class="ed-seg wrap">${[...ED_EASES,...(Array.isArray(ke)?[['custom','Custom']]:[])].map(([v,l])=>`<button type="button" data-ease="${v}" aria-pressed="${Array.isArray(ke)?v==='custom':ke===v}">${l}</button>`).join('')}</div></div></div>
   ${ke!=='hold'?`<div class="ed-ecurve">${edEaseSvg(Array.isArray(ke)?ke:ED_EASE_BZ[ke]||ED_EASE_BZ.smooth)}</div><p class="ed-hint">Drag the two handles to shape the move to the next keyframe: steep is fast, flat is slow.</p>`:''}`)+body;
  el.innerHTML=`<nav class="ed-ptabs" role="tablist">${tabs.map(([id,l])=>`<button type="button" role="tab" aria-selected="${t===id}" data-ptab="${id}">${l}</button>`).join('')}
    ${c?`<span class="grow"></span><button type="button" class="iconbtn sm" data-remove aria-label="Delete clip" data-tooltip="Delete">${I.trash}</button>`:''}</nav><div class="ed-pbody${locked?' locked':''}">${locked?`<div class="ed-note">${I.lock} This track is locked.</div>`:''}${body}</div>`;
  el.querySelectorAll('[data-ptab]').forEach(b=>b.onclick=()=>{this.ptab=b.dataset.ptab;this.drawProps();});
  if(!c){
   el.querySelectorAll('[data-ratio]').forEach(b=>b.onclick=()=>{this.snapshot();this.p.ratio=b.dataset.ratio;this.save();this.drawProps();this.fit();this.draw();const lb=this.dom.root?.querySelector('.ed-ratio');if(lb)lb.textContent=this.p.ratio;});
   el.querySelectorAll('[data-bgmode]').forEach(b=>b.onclick=()=>{this.snapshot();this.p.bgMode=b.dataset.bgmode;this.save();this.drawProps();this.draw();});
   const bg=$('[data-bg]',el);if(bg){bg.onfocus=()=>this.snapshot();bg.oninput=()=>{this.p.bg=bg.value;this.save();this.draw();};}
   el.querySelectorAll('[data-mgo]').forEach(b=>{b.onclick=()=>this.seek(edMt(this.p.markers[Number(b.dataset.mgo)]));b.ondblclick=()=>edMarkerEdit(b,Number(b.dataset.mgo));});
   const mp=$('[data-proxies]',el);if(mp)mp.onclick=()=>{mp.disabled=true;this.makeProxies();};const up=$('[data-useproxy]',el);if(up)up.onchange=()=>{this.p.useProxy=up.checked;this.resetElements();this.save();this.sync();this.draw();};
   const cm=$('[data-clear-markers]',el);if(cm)cm.onclick=()=>{this.snapshot();this.p.markers=[];this.after(true);};return;
  }
  const setSpeed=v=>{const mm=this.mediaOf(c),max=mm?.dur&&mm.type!=='image'?((mm.dur-(c.in||0))/(v*(c.ramp?edRampAvg(c.ramp):1))):Infinity;c.dur=Math.max(.1,Math.min(c.dur*(c.speed||1)/v,max));c.speed=v;};
  el.querySelectorAll('[data-k]').forEach(inp=>{
   const k=inp.dataset.k,u=inp.dataset.u||'raw';
   const snap=()=>{if(!inp._snap){this.snapshot();inp._snap=true;}};inp.addEventListener('focus',snap);inp.addEventListener('pointerdown',snap);
   inp.addEventListener('change',()=>{inp._snap=false;this.save();if(k==='text'&&c?.words?.length)this.learnFix(c);if(['speed','text','box','font'].includes(k))this.drawTimeline();if(k==='box'||k==='key_on'||k==='upper')this.drawProps();if(k==='font')document.fonts?.load(`40px "${c.font}"`).then(()=>this.draw()).catch(()=>{});this.drawTime();if(k==='speed')this.after(false);});
   inp.addEventListener('input',()=>{
    let v=inp.type==='checkbox'?inp.checked:inp.type==='range'||inp.type==='number'?Number(inp.value):inp.value;
    if(inp.type==='number'&&!Number.isFinite(v))return;
    if(u!=='raw')v=conv[u][1](v);
    if(k.startsWith('fx_')){c.fx={...(c.fx||{}),[k.slice(3)]:v};if(!Object.entries(c.fx).some(([kk,vv])=>kk!=='borderColor'&&vv))delete c.fx;}
    else if(k.startsWith('afx_')){c.afx={...(c.afx||{}),[k.slice(4)]:v};if(!Object.values(c.afx).some(Boolean))delete c.afx;}
    else if(k==='lutmix'){c.grade={...(c.grade||{}),lut:{...(c.grade?.lut||{}),mix:v}};}
    else if(k==='text'&&c.words?.length){c.text=v;this.retime(c,v);}else if(k==='speed')setSpeed(v);else if(k==='duckdb'){c.duck={db:-edClamp(v,3,30)};this._dk=null;}
    else if(k.startsWith('key_'))c.key={color:'#00b140',sim:25,smooth:10,spill:50,...(c.key||{}),[k.slice(4)]:v};
    else if(k.startsWith('mask_'))c.mask={...(c.mask||{shape:'rect'}),[k.slice(5)]:v};else if(k.startsWith('crop'))c.crop={...(c.crop||{}),[k.slice(4)]:edClamp(v,0,.45)};else if(k.startsWith('adj_'))c.adj={...(c.adj||{}),[k.slice(4)]:v};
    else if(ED_KFKEYS.has(k))this.setVal(c,k,v);else c[k]=v;
    el.querySelectorAll(`[data-k="${k}"]`).forEach(o=>{if(o!==inp&&o.type!=='checkbox')o.value=conv[u][0](v);});
    if(k==='speed'||k==='text'){this.drawTimeline();this.drawTime();}
    this.sync();this.draw();});
  });
  const segs={align:'align',animIn:'animIn',animOut:'animOut'};
  for(const [attr,key] of Object.entries(segs))el.querySelectorAll(`[data-${attr}]`).forEach(b=>b.onclick=()=>{this.snapshot();c[key]=b.dataset[attr];this.save();this.drawProps();this.draw();});
  el.querySelectorAll('[data-afx]').forEach(b=>b.onclick=()=>{this.snapshot();const p={voice:{low:-4,mid:3,high:4,comp:45},radio:{low:-14,mid:6,high:-10,comp:70},warm:{low:4,mid:-1,high:-3,comp:20},podcast:{low:2,mid:2,high:3,comp:60},hall:{reverb:45},flat:null}[b.dataset.afx];if(p)c.afx={...p,...(c.afx?.voice?{voice:c.afx.voice}:{}),...(c.afx?.pitch?{pitch:c.afx.pitch}:{})};else delete c.afx;this.after(true);});
  el.querySelectorAll('[data-voice]').forEach(b=>b.onclick=()=>{this.snapshot();const v=b.dataset.voice;c.afx={...(c.afx||{})};if(v)c.afx.voice=v;else delete c.afx.voice;if(!Object.values(c.afx).some(Boolean))delete c.afx;this.after(true);});
  const rv=$('[data-reverse]',el);if(rv)rv.onclick=()=>this.reverseClip(c);el.querySelectorAll('[data-trackmo]').forEach(b=>b.onclick=()=>this.trackMotion(c));
  el.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>this.runTool(c,b.dataset.tool));
  el.querySelectorAll('[data-flip]').forEach(b=>b.onclick=()=>{this.snapshot();c[b.dataset.flip]=!c[b.dataset.flip];this.save();this.drawProps();this.draw();});
  el.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{this.snapshot();setSpeed(Number(b.dataset.speed));this.after(true);});
  el.querySelectorAll('[data-ramp]').forEach(b=>b.onclick=()=>{const id=b.dataset.ramp;if(id==='custom')return;const r=ED_RAMPS.find(x=>x[0]===id);this.setRamp(c,r?r[2].map(x=>[...x]):null);if(r)c.rampName=id;else delete c.rampName;this.save();this.drawProps();});
  const cs=$('.ed-curve svg',el);if(cs)edCurveWire(cs,c);
  el.querySelectorAll('[data-kf]').forEach(b=>b.onclick=()=>{const k=b.dataset.kf;if(k==='x'){this.toggleKf(c,'x');this.toggleKf(c,'y');this.past.splice(-1,1);}else this.toggleKf(c,k);});
  el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{this.snapshot();const a=ED_FILTERS.find(f=>f[0]===b.dataset.filter)[2];if(Object.keys(a).length)c.adj={...a};else delete c.adj;this.after(true);});
  el.querySelectorAll('[data-reshape]').forEach(b=>b.onclick=()=>{this.snapshot();c.sticker={...c.sticker,shape:b.dataset.reshape};this.after(true);});
  el.querySelectorAll('[data-reemoji]').forEach(b=>b.onclick=()=>{this.snapshot();c.sticker={...c.sticker,emoji:b.dataset.reemoji};this.after(true);});
  el.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{this.snapshot();const r=b.dataset.reset;
   if(r==='transform'){Object.assign(c,{scale:1,x:0,y:0,rotate:0,flipH:false,flipV:false});if(c.kf){for(const k of ['scale','x','y','rotate'])delete c.kf[k];}}else if(r==='crop')delete c.crop;else if(r==='mask')delete c.mask;else if(r==='afx')delete c.afx;else if(r==='fx')delete c.fx;else if(r==='grade')delete c.grade;else if(r==='adjust')delete c.adj;else setSpeed(1);this.after(true);});
  const det=$('[data-detach]',el);if(det)det.onclick=()=>this.detach(c);
  const busy=b=>{b.disabled=true;b.innerHTML='<span class="spin"></span> Measuring…';};
  const ld=$('[data-loud]',el);if(ld)ld.onclick=()=>{busy(ld);this.matchLoudness([c]).finally(()=>this.drawProps());};
  const la=$('[data-loud-all]',el);if(la)la.onclick=()=>{busy(la);this.matchLoudness(this.p.clips.filter(x=>x.media&&!(x.detached&&!x.asAudio)&&this.mediaOf(x)?.type!=='image')).finally(()=>this.drawProps());};
  const lr=$('[data-loud-reset]',el);if(lr)lr.onclick=()=>{this.snapshot();delete c.gainDb;this.after(true);};
  const dk=$('[data-duck]',el);if(dk)dk.onchange=()=>this.setDuck(c,dk.checked);
  el.querySelectorAll('[data-caplook]').forEach(b=>b.onclick=()=>{this.snapshot();this.capLook(c,b.dataset.caplook);this.after(true);});
  el.querySelectorAll('[data-alt]').forEach(b=>b.onclick=()=>this.useAlt(c,Number(b.dataset.alt)));
  el.querySelectorAll('[data-keep]').forEach(b=>b.onclick=()=>this.keepFlag(c,Number(b.dataset.keep)));
  const ca=$('[data-cap-all]',el);if(ca)ca.onclick=()=>{this.snapshot();const keys=['capLook','capStyle','font','size','weight','color','hl','stroke','strokeColor','shadow','box','boxColor','upper','align','y','animIn','animOut','animDur','spacing'];
   const all=this.p.clips.filter(x=>x!==c&&x.words?.length);for(const x of all)for(const k of keys){if(c[k]===undefined)delete x[k];else x[k]=c[k];}
   // Arabic-script captions keep a font that has every letter
   for(const x of all)if(edArabicScript(x.text)&&!edArabicScript(c.text))x.font='Vazirmatn';this.after(true);toast(`Used on ${all.length} caption${all.length===1?'':'s'}`);};
  // colour grading
  const setG=(f,snap=true)=>{if(snap)this.snapshot();c.grade={...(c.grade||{})};f(c.grade);if(!edGraded(c.grade))delete c.grade;this.save();this.draw();};
  el.querySelectorAll('[data-wheel]').forEach(w=>{const k=w.dataset.wheel,svg=w.querySelector('svg');
   const at=e=>{const r=svg.getBoundingClientRect();let x=((e.clientX-r.left)/r.width-.5)*2,y=-((e.clientY-r.top)/r.height-.5)*2;const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}return [Math.round(x*100)/100,Math.round(y*100)/100];};
   svg.onpointerdown=e=>{e.preventDefault();this.snapshot();const mv=ev=>{const [x,y]=at(ev);setG(g=>{g[k]={...(g[k]||{}),x,y};},false);svg.outerHTML;w.querySelector('svg').innerHTML=edWheelSvg(c.grade?.[k]).replace(/^<svg[^>]*>|<\/svg>$/g,'');};
    const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);this.drawProps();};mv(e);window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);};
   svg.ondblclick=()=>setG(g=>{delete g[k];});});
  el.querySelectorAll('[data-wl]').forEach(r=>{r.onpointerdown=r.onfocus=()=>{if(!r._s){this.snapshot();r._s=true;}};r.oninput=()=>setG(g=>{g[r.dataset.wl]={...(g[r.dataset.wl]||{}),l:Number(r.value)/100};},false);r.onchange=()=>{r._s=false;};});
  el.querySelectorAll('[data-wreset]').forEach(b=>b.onclick=()=>{setG(g=>{delete g[b.dataset.wreset];});this.drawProps();});
  el.querySelectorAll('[data-curvech]').forEach(b=>b.onclick=()=>{this.curveCh=b.dataset.curvech;this.drawProps();});
  const gc=$('.ed-gcurve svg',el);if(gc)edGradeCurveWire(gc,c,this.curveCh||'m');
  const ls=$('[data-lut]',el);if(ls){if(!this.lutList)this.loadLuts().then(()=>{if(this.ptab==='colour')this.drawProps();});
   ls.onchange=()=>{setG(g=>{if(ls.value)g.lut={id:ls.value,mix:g.lut?.mix??1};else delete g.lut;});this.drawProps();};}
  const li=$('[data-lut-import]',el),lf=$('[data-lut-file]',el);if(li&&lf){li.onclick=()=>lf.click();
   lf.onchange=async()=>{const f=lf.files[0];lf.value='';if(!f)return;try{const id=await this.importLut(f);setG(g=>{g.lut={id,mix:1};});toast('Look imported');this.drawProps();}catch(e){toast(e.message,true);}};}
  el.querySelectorAll('[data-mask]').forEach(b=>b.onclick=()=>{this.snapshot();const v=b.dataset.mask;if(v==='none')delete c.mask;else c.mask={w:.8,h:.8,x:0,y:0,feather:0,...(c.mask||{}),shape:v};this.after(true);});
  el.querySelectorAll('[data-ease]').forEach(b=>b.onclick=()=>{if(b.dataset.ease!=='custom')this.setKfEase(c,b.dataset.ease);});
  const ec=el.querySelector('.ed-ecurve');if(ec)edEaseWire(ec,c);
  el.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{if(this.time<c.start||this.time>=c.start+c.dur)this.seek(c.start);this.switchAngle(+b.dataset.angle);});
  const mca=el.querySelector('[data-mc-audio]');if(mca)mca.onchange=()=>{this.snapshot();c.nest.audio=mca.value;this.after(true);};
  const ts=$('[data-tpl-save]',el);if(ts)ts.onclick=async()=>{const n=prompt('Template name',String(c.text||'Text').slice(0,30));if(!n?.trim())return;await this.saveTemplate(c,n.trim().slice(0,40));if(this.tab==='text')this.drawLib();};
  const kp=$('[data-key-pick]',el);if(kp)kp.onclick=()=>{this.picking=this.picking===c.id?null:c.id;this.dom.frame?.classList.toggle('picking',!!this.picking);this.drawProps();this.draw();};
  $('[data-remove]',el).onclick=()=>this.remove();
 },
 fit(){const st=this.dom.stage,wrap=this.dom.frame;if(!st||!wrap)return;const [W,H]=this.base(),r=st.getBoundingClientRect(),s=Math.min((r.width-16)/W,(r.height-16)/H);wrap.style.width=Math.max(10,W*s)+'px';wrap.style.height=Math.max(10,H*s)+'px';},
});
const ED_KFKEYS=new Set(['x','y','scale','rotate','opacity','volume']);
function edCssFilter(a){const f=[];if(a.brightness)f.push(`brightness(${1+a.brightness/100})`);if(a.contrast)f.push(`contrast(${1+a.contrast/100})`);if(a.saturation)f.push(`saturate(${1+a.saturation/100})`);if(a.hue)f.push(`hue-rotate(${a.hue}deg)`);
 if(a.temperature)f.push(a.temperature>0?`sepia(${a.temperature/200})`:`hue-rotate(${a.temperature/5}deg)`);return f.join(' ')||'none';}
function edShapeSvg(s){return {rect:'<rect x="8" y="8" width="24" height="24"/>',round:'<rect x="8" y="8" width="24" height="24" rx="6"/>',circle:'<circle cx="20" cy="20" r="12"/>',triangle:'<path d="M20 7 33 31H7z"/>',
 star:'<path d="m20 6 4 9 10 1-7.5 7 2 10L20 28l-8.5 5 2-10L6 16l10-1z"/>',arrow:'<path d="M6 17h16v-6l12 9-12 9v-6H6z"/>',line:'<rect x="6" y="18" width="28" height="4" rx="2"/>',heart:'<path d="M20 33C8 24 6 17 10 12s9-3 10 1c1-4 6-6 10-1s2 12-10 21z"/>'}[s]||'';}

App.register('editor',{
 title:arg=>arg?(Ed.p?.name||'Editor'):'Editor',
 hold:()=>true,
 render(el,arg){
  el.innerHTML=`<div class="no-head editor-wait"><span class="spin"></span></div>`;
  Ed.load().then(()=>{if(App.route!=='editor'||!el.isConnected)return;
   if(!arg){edProjects(el);return;}
   if(!Ed.open(arg)){toast('That project is gone.');App.go('editor');return;}
   edBuild(el);}).catch(e=>toast(e.message,true));
 }});
const edAgo=iso=>typeof ago==='function'?ago(iso):'';
/** The projects screen: every edit as a card, newest first, and New project. */
/** Saves a project and the media it uses as one .zip, to keep it safe or open it in another browser. */
/** What the captions learned from your corrections: each fix, with how often you made it; remove one or all. */
/** Export: a preset for where it goes, or name, resolution, frame rate, format and quality yourself. */
function edBuild(el){
 const p=Ed.p;
 el.innerHTML=`<div class="no-head editor">
  <header class="ed-top"><a class="iconbtn sm ed-back" href="#/editor" aria-label="All projects" data-tooltip="All projects">${I.back}</a>
   <input class="ed-name" value="${esc(p.name)}" aria-label="Project name" maxlength="80" dir="auto"><span class="ed-saved">Saved</span>
   <span class="grow"></span>
   <button type="button" class="iconbtn sm" data-keys aria-label="Keyboard shortcuts" data-tooltip="Keyboard shortcuts · ?">${I.keyboard}</button>
   <button type="button" class="btn small primary" data-export>${I.down} Export</button></header>
  <section class="ed-panel ed-lib" aria-label="Library"></section><i class="ed-rz v" data-rz="c1" aria-hidden="true"></i><i class="ed-rz v" data-rz="c2" aria-hidden="true"></i><i class="ed-rz h" data-rz="tl" aria-hidden="true"></i>
  <section class="ed-panel ed-view" aria-label="Player">
   <header class="ed-ph"><span>Player</span><span class="ed-crumb" data-crumb hidden></span><span class="ed-ratio">${esc(p.ratio)}</span></header>
   <div class="ed-stage"><div class="ed-frame"><canvas aria-label="Preview"></canvas><div class="ed-scopes" ${Ed.scopesOn?'':'hidden'}><canvas data-scope="wave" width="256" height="128" title="Waveform: brightness across the picture"></canvas><canvas data-scope="vector" width="128" height="128" title="Vectorscope: colour and saturation"></canvas><canvas data-scope="hist" width="256" height="128" title="Histogram: red, green, blue levels"></canvas></div><div class="ed-guides" aria-hidden="true"><i class="g-top"></i><i class="g-right"></i><i class="g-bottom"></i></div></div>
    <div class="ed-export" hidden><span class="spin"></span><b>Recording…</b><span>Keep this tab open.</span><button type="button" class="btn small" data-cancel-export>Cancel</button></div></div>
   <div class="ed-controls"><span class="ed-time"></span><button type="button" class="ed-play" data-play></button><button type="button" class="iconbtn sm ed-loop" data-loop aria-pressed="false" aria-label="Loop" data-tooltip="Loop (Shift+L)">${I.refresh}</button>
    <span class="ed-ctl-right"><canvas class="ed-meter" width="72" height="14" role="img" aria-label="Sound level"></canvas><button type="button" class="iconbtn sm" data-scopes aria-pressed="${!!Ed.scopesOn}" aria-label="Scopes" data-tooltip="Scopes: waveform, vectorscope, histogram">${I.chart}</button><button type="button" class="iconbtn sm" data-frame aria-label="Save frame" data-tooltip="Save this frame as a picture · Shift+E">${I.image}</button><button type="button" class="iconbtn sm" data-guides aria-pressed="${Ed.guides}" aria-label="Safe areas" data-tooltip="Safe areas for TikTok and Reels">${I.safe}</button><button type="button" class="iconbtn sm" data-full aria-label="Full screen" data-tooltip="Full screen">${I.expand}</button></span></div>
  </section>
  <section class="ed-panel ed-props" aria-label="Properties"></section>
  <section class="ed-panel ed-tl" aria-label="Timeline">
   <div class="ed-tools">
    <button type="button" class="iconbtn sm" data-undo aria-label="Undo" data-tooltip="Undo · Ctrl+Z">${I.undo}</button>
    <button type="button" class="iconbtn sm" data-redo aria-label="Redo" data-tooltip="Redo · Ctrl+Shift+Z">${I.redo}</button>
    <i class="ed-sep"></i>
    <button type="button" class="iconbtn sm" data-split aria-label="Split" data-tooltip="Split · Ctrl+B">${I.split}</button>
    <button type="button" class="iconbtn sm" data-dup aria-label="Duplicate" data-tooltip="Duplicate · Ctrl+D">${I.copy}</button>
    <button type="button" class="iconbtn sm" data-del aria-label="Delete" data-tooltip="Delete · Del">${I.trash}</button>
    <button type="button" class="iconbtn sm" data-trim="start" aria-label="Delete left" data-tooltip="Delete left of the playhead · Q">${I.trimL}</button>
    <button type="button" class="iconbtn sm" data-trim="end" aria-label="Delete right" data-tooltip="Delete right of the playhead · W">${I.trimR}</button>
    <button type="button" class="iconbtn sm" data-freeze aria-label="Freeze frame" data-tooltip="Freeze frame · Shift+F">${I.freeze}</button>
    <button type="button" class="iconbtn sm" data-track-add aria-label="Add a track" data-tooltip="Add a track" aria-haspopup="menu">${I.layers}</button>
    <button type="button" class="iconbtn sm" data-mixer aria-label="Mixer" data-tooltip="Mixer: volume, pan, solo per track">${I.sliders}</button>
    <button type="button" class="iconbtn sm" data-marker aria-label="Marker" data-tooltip="Marker at the playhead · M">${I.flag}</button>
    <button type="button" class="iconbtn sm" data-voice-tl aria-label="Record voice-over" data-tooltip="Record voice-over">${I.mic}</button>
    <span class="grow"></span>
    <button type="button" class="iconbtn sm" data-magnet aria-pressed="${!!p.magnet}" aria-label="Main track magnet" data-tooltip="Main track magnet: no gaps on the main track">${I.link}</button>
    <button type="button" class="iconbtn sm" data-snap aria-pressed="${Ed.snap}" aria-label="Snap" data-tooltip="Snap to edges and markers">${I.magnet}</button>
    <i class="ed-sep"></i>
    <button type="button" class="iconbtn sm" data-zoom="-1" aria-label="Zoom out">${I.zoomOut}</button>
    <input type="range" class="ed-zoom" min="10" max="300" step="1" value="${Ed.zoom}" aria-label="Zoom">
    <button type="button" class="iconbtn sm" data-zoom="1" aria-label="Zoom in">${I.zoomIn}</button>
   </div>
   <div class="ed-tl-body">
    <div class="ed-heads-wrap"><div class="ed-heads"></div></div>
    <div class="ed-scroll"><div class="ed-inner"><div class="ed-ruler"></div><div class="ed-lanes"></div><div class="ed-playhead"><i></i></div><div class="ed-marquee" hidden></div></div></div>
   </div>
  </section>
  <input type="file" accept="video/*,image/*,audio/*" multiple hidden>
 </div>`;
 const R=el.querySelector('.editor'),q=s=>R.querySelector(s);
 edLayout(R);q('[data-keys]').onclick=()=>edKeys();
 Object.assign(Ed.dom,{saved:q('.ed-saved'),root:R,lib:q('.ed-lib'),props:q('.ed-props'),canvas:q('canvas'),stage:q('.ed-stage'),frame:q('.ed-frame'),time:q('.ed-time'),play:q('[data-play]'),loop:q('[data-loop]'),
  tracks:q('.ed-lanes'),heads:q('.ed-heads'),ruler:q('.ed-ruler'),inner:q('.ed-inner'),scroll:q('.ed-scroll'),head:q('.ed-playhead'),marquee:q('.ed-marquee'),file:q('input[type=file]'),exportOverlay:q('.ed-export'),meter:q('.ed-meter')});
 Ed.dom.file.onchange=()=>{Ed.importFiles(Ed.dom.file.files);Ed.dom.file.value='';};
 const name=q('.ed-name');name.oninput=()=>{Ed.p.name=name.value||'Untitled project';Ed.save();document.title=`${Ed.p.name} · Tempoloom`;};
 q('[data-export]').onclick=()=>edExportDialog();q('[data-cancel-export]').onclick=()=>Ed.cancelExport();
 q('[data-play]').onclick=()=>Ed.play();q('[data-loop]').onclick=()=>Ed.toggleLoop();
 q('[data-undo]').onclick=()=>Ed.undo();q('[data-redo]').onclick=()=>Ed.redo();q('[data-split]').onclick=()=>Ed.split();q('[data-dup]').onclick=()=>Ed.duplicate();q('[data-del]').onclick=()=>Ed.remove();
 R.querySelectorAll('[data-trim]').forEach(b=>b.onclick=()=>Ed.trimTo(b.dataset.trim));q('[data-freeze]').onclick=()=>Ed.freeze();
 q('[data-marker]').onclick=()=>Ed.toggleMarker();q('[data-mixer]').onclick=()=>edMixer();q('[data-voice-tl]').onclick=()=>{Ed.tab='audio';Ed.recordVoice();};
 q('[data-snap]').onclick=e=>{Ed.snap=!Ed.snap;e.currentTarget.setAttribute('aria-pressed',String(Ed.snap));};
 q('[data-magnet]').onclick=()=>{Ed.snapshot();Ed.p.magnet=!Ed.p.magnet;Ed.after(false);toast(Ed.p.magnet?'Main track magnet on: no gaps':'Main track magnet off');};
 q('[data-track-add]').onclick=e=>{const b=e.currentTarget,pop=Pop.open(b,Object.entries(ED_KINDS).map(([k,v])=>`<button class="pop-item" data-k="${k}">${I[v.icon]}<span>${k==='video'?'Overlay video track':v.label+' track'}</span></button>`).join(''),{label:'Add a track'});
  if(pop)pop.querySelectorAll('[data-k]').forEach(x=>x.onclick=()=>{Pop.close();Ed.snapshot();Ed.addTrack(x.dataset.k);Ed.drawTimeline();});};
 q('[data-frame]').onclick=()=>Ed.saveFrame();
 q('[data-scopes]').onclick=e=>{Ed.scopesOn=!Ed.scopesOn;e.currentTarget.setAttribute('aria-pressed',String(Ed.scopesOn));q('.ed-scopes').hidden=!Ed.scopesOn;Ed.draw();};
 q('[data-guides]').onclick=e=>{Ed.guides=!Ed.guides;e.currentTarget.setAttribute('aria-pressed',String(Ed.guides));Ed.dom.frame.classList.toggle('guides',Ed.guides);};
 Ed.dom.frame.classList.toggle('guides',Ed.guides);
 q('[data-full]').onclick=()=>{const st=Ed.dom.stage;document.fullscreenElement?document.exitFullscreen():st.requestFullscreen?.().catch(()=>{});};
 const zoom=q('.ed-zoom'),setZoom=z=>{const sc=Ed.dom.scroll,mid=(sc.scrollLeft+sc.clientWidth/2)/Ed.zoom;Ed.zoom=Math.max(10,Math.min(300,z));zoom.value=Ed.zoom;Ed.drawTimeline();sc.scrollLeft=mid*Ed.zoom-sc.clientWidth/2;};
 zoom.oninput=()=>setZoom(Number(zoom.value));R.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>setZoom(Ed.zoom*(b.dataset.zoom>0?1.25:.8)));
 R.ondragover=e=>{e.preventDefault();R.classList.toggle('ed-dropping',[...e.dataTransfer.types].includes('Files'));};
 R.ondragleave=e=>{if(!R.contains(e.relatedTarget))R.classList.remove('ed-dropping');};
 R.ondrop=e=>{e.preventDefault();R.classList.remove('ed-dropping');
  const mid=e.dataTransfer.getData('text/x-ed-media');
  if(mid&&Ed.dom.scroll.contains(e.target)){const r=Ed.dom.inner.getBoundingClientRect(),lane=e.target.closest('.ed-lane'),at=Math.max(0,(e.clientX-r.left)/Ed.zoom);
   const m=Ed.media.find(x=>x.id===mid),kind=m?.type==='audio'?'audio':'video';
   if(lane&&lane.dataset.kind===kind){if(lane.classList.contains('main')&&Ed.p.magnet)Ed.add(mid,undefined,lane.dataset.track);else Ed.add(mid,at,lane.dataset.track);}
   else if(e.target.closest('.ed-lane-new')||lane){Ed.snapshot();const t=Ed.addTrack(kind,kind==='video'?undefined:e.target.closest('.ed-lane-new')?.dataset.new);Ed.past.pop();Ed.add(mid,at,t.id);}
   else Ed.add(mid,at);return;}
  if(mid)return Ed.add(mid);
  if(e.dataTransfer.files.length)Ed.importFiles(e.dataTransfer.files);};
 Ed.dom.scroll.addEventListener('contextmenu',e=>{e.preventDefault();const n=e.target.closest('.ed-clip');
  if(n){const c=Ed.clip(n.dataset.cid);if(!c)return;if(!Ed.sels.has(c.id))Ed.select(c.id);edClipMenu(e.clientX,e.clientY,c);}
  else{const r=Ed.dom.inner.getBoundingClientRect(),at=Math.max(0,(e.clientX-r.left)/Ed.zoom),lane=e.target.closest('.ed-lane[data-track]'),gap=lane&&Ed.gapAt(lane.dataset.track,at);Ed.seek(at);
   edMenu(e.clientX,e.clientY,[...(gap?[['Delete gap','trash',()=>Ed.closeGap(lane.dataset.track,at)],'-']:[]),[`Paste${Ed.clipboard?.length?` (${Ed.clipboard.length})`:''}`,'copy',()=>Ed.paste(),!Ed.clipboard?.length],['Add a marker','flag',()=>Ed.toggleMarker()],
    '-',['Mark in','trimL',()=>Ed.setRange('in'),false,false,'I'],['Mark out','trimR',()=>Ed.setRange('out'),false,false,'O'],['Clear in and out','x',()=>Ed.clearRange(),!Ed.p.range,false,'Alt+X'],'-',['Select all','layers',()=>Ed.selectAll()]]);}});
 Ed.dom.canvas.addEventListener('contextmenu',e=>{e.preventDefault();const c=Ed.sel&&Ed.clip(Ed.sel);if(c)edClipMenu(e.clientX,e.clientY,c);});
 Ed.dom.scroll.addEventListener('scroll',()=>{Ed.dom.heads.style.transform=`translateY(${-Ed.dom.scroll.scrollTop}px)`;});
 edWireTimeline();edWirePreview();
 Ed.drawLib();Ed.drawProps();Ed.drawTimeline();Ed.fit();Ed.sync();Ed.draw();Ed.drawTime();
 new ResizeObserver(()=>{Ed.fit();}).observe(Ed.dom.stage);
 new ResizeObserver(()=>{if(!Ed.playing)Ed.drawTimeline();}).observe(Ed.dom.scroll);
}
window.addEventListener('beforeunload',()=>{try{Ed.flush();}catch{}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&Ed.st)try{Ed.flush();}catch{}});
window.addEventListener('hashchange',()=>{if(Ed.p&&!(App.route==='editor'&&App.arg===Ed.p.id)){Ed.pause();Ed.flush();if(Ed.recording)Ed.recording.rec.stop();}});
function edWireTimeline(){
 const sc=Ed.dom.scroll,inner=Ed.dom.inner;
 // double-click a nested clip to open it
 Ed.dom.tracks.addEventListener('dblclick',e=>{const n=e.target.closest('.ed-clip'),c=n&&Ed.clip(n.dataset.cid);if(c?.nest)Ed.enterNest(c);});
 const timeAt=x=>Math.max(0,(x-inner.getBoundingClientRect().left)/Ed.zoom);
 const laneAt=y=>[...Ed.dom.tracks.children].find(l=>{const r=l.getBoundingClientRect();return y>=r.top&&y<r.bottom;});
 sc.onpointerdown=e=>{
  if(e.button!==0||e.target.closest('[data-join]'))return;
  const clip=e.target.closest('.ed-clip');
  if(!clip){
   if(e.target.closest('.ed-ruler')){Ed.seek(timeAt(e.clientX));sc.setPointerCapture(e.pointerId);const mv=ev=>{Ed.seek(timeAt(ev.clientX));Ed.scrub();},up=()=>{sc.removeEventListener('pointermove',mv);sc.removeEventListener('pointerup',up);};sc.addEventListener('pointermove',mv);sc.addEventListener('pointerup',up);return;}
   const ir=inner.getBoundingClientRect(),x0=e.clientX-ir.left,y0=e.clientY-ir.top,box=Ed.dom.marquee,add=e.shiftKey||e.ctrlKey||e.metaKey,before=new Set(Ed.sels);let dragging=false;
   const mv=ev=>{const x1=ev.clientX-ir.left,y1=ev.clientY-ir.top;if(!dragging&&Math.hypot(x1-x0,y1-y0)<4)return;dragging=true;box.hidden=false;
    const L=Math.min(x0,x1),T=Math.min(y0,y1),Wd=Math.abs(x1-x0),Hd=Math.abs(y1-y0);Object.assign(box.style,{left:L+'px',top:T+'px',width:Wd+'px',height:Hd+'px'});
    const hit=new Set(add?before:[]);Ed.dom.tracks.querySelectorAll('.ed-clip').forEach(n=>{const r=n.getBoundingClientRect(),cl=Ed.clip(n.dataset.cid);if(cl&&!Ed.trackOf(cl)?.locked&&r.right-ir.left>L&&r.left-ir.left<L+Wd&&r.bottom-ir.top>T&&r.top-ir.top<T+Hd)hit.add(n.dataset.cid);});
    Ed.sels=hit;Ed.sel=[...hit].pop()||null;Ed.junction=null;Ed.dom.tracks.querySelectorAll('.ed-clip').forEach(n=>n.classList.toggle('sel',hit.has(n.dataset.cid)));};
   const up=ev=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);box.hidden=true;
    if(!dragging){if(!add)Ed.pick(null);Ed.seek(timeAt(ev.clientX));}Ed.drawTimeline();Ed.drawProps();Ed.draw();};
   window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);return;}
  const c=Ed.clip(clip.dataset.cid);if(!c)return;e.preventDefault();
  if(Ed.trackOf(c)?.locked)return toast('This track is locked.');
  Ed.solo=e.altKey;
  const proTrim=e.altKey||((e.ctrlKey||e.metaKey)&&e.target.dataset.h);
  if((e.shiftKey||e.ctrlKey||e.metaKey)&&!proTrim){Ed.select(c.id,true);Ed.solo=false;return;}
  if(!Ed.sels.has(c.id)||(e.altKey&&Ed.sels.size>1))Ed.select(c.id);else{Ed.sel=c.id;Ed.drawProps();}Ed.solo=false;
  if(e.target.dataset.fh){const key=e.target.dataset.fh==='in'?'fadeIn':'fadeOut',left=clip.getBoundingClientRect().left;let snapped=false;
   const mv=ev=>{if(!snapped){Ed.snapshot();snapped=true;}const x=(ev.clientX-left)/Ed.zoom;c[key]=Math.round(edClamp(key==='fadeIn'?x:c.dur-x,0,Math.min(5,c.dur/2))*10)/10;Ed.drawTimeline();Ed.sync();Ed.draw();};
   const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);if(snapped)Ed.after(true);};
   window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);return;}
  const mode=e.target.dataset.h||'move',x0=e.clientX,group=mode==='move'&&Ed.sels.size>1?Ed.picked():[c],orig=new Map(group.map(g=>[g.id,{...g}])),o=orig.get(c.id),m=Ed.mediaOf(c),srcDur=c.nest?c.nest.dur:m&&m.type!=='image'&&!c.sticker?m.dur:Infinity,kind=Ed.kindOf(c);
  const ids=new Set(group.map(g=>g.id)),edges=Ed.p.clips.filter(x=>!ids.has(x.id)).flatMap(x=>[x.start,x.start+x.dur]).concat([0,Ed.time,...Ed.p.markers.map(edMt)]);
  const snapT=t=>{if(!Ed.snap)return t;const tol=8/Ed.zoom;let best=t,d=tol;for(const s of edges){if(Math.abs(s-t)<d){d=Math.abs(s-t);best=s;}}return best;};
  let moved=false,newLane=null;
  // Pro trims: Alt + edge = ripple trim; Ctrl + edge = roll; Alt + body = slip; Ctrl + Alt + body = slide.
  const touching=(edge,which)=>Ed.p.clips.find(x=>x.track===c.track&&x.id!==c.id&&Math.abs((which==='prev'?x.start+x.dur:x.start)-edge)<.05);
  const prev=touching(o.start,'prev'),next=touching(o.start+o.dur,'next'),oP=prev&&{...prev},oN=next&&{...next};
  const after=Ed.p.clips.filter(x=>x.track===c.track&&x.id!==c.id&&x.start>=o.start+o.dur-.001).map(x=>[x,x.start]);
  const pro=mode==='move'?(e.altKey&&(e.ctrlKey||e.metaKey)?'slide':e.altKey?'slip':null):e.altKey?'ripple':(e.ctrlKey||e.metaKey)?'roll':null;
  if(pro&&kind!=='audio'&&!c.media&&!c.nest&&(pro==='slip'))return;
  const mv=ev=>{
   const dt=(ev.clientX-x0)/Ed.zoom;if(!moved&&Math.abs(ev.clientX-x0)<3&&Math.abs(ev.clientY-e.clientY)<3)return;if(!moved){Ed.snapshot();moved=true;}
   if(pro==='slip'&&(c.media||c.nest)){const sp=o.speed||1,span=Ed.srcSpan(o),max=Math.max(0,(srcDur===Infinity?(o.in||0):srcDur-span));c.in=edClamp((o.in||0)-dt*sp,0,max);Ed.seek(edClamp(Ed.time,c.start,c.start+c.dur-.01));}
   else if(pro==='slide'){let d=dt;if(oP){d=Math.max(d,-(oP.dur-.1));const mp=Ed.mediaOf(oP);if(mp&&mp.type!=='image'&&mp.dur)d=Math.min(d,(mp.dur-(oP.in||0))/(oP.speed||1)-oP.dur);}if(oN){const sn=oN.speed||1;d=Math.min(d,oN.dur-.1);d=Math.max(d,-(oN.in||0)/sn);}if(!oP)d=Math.max(d,-o.start);
    c.start=o.start+d;if(prev)prev.dur=oP.dur+d;if(next){const sn=oN.speed||1;next.start=oN.start+d;next.dur=oN.dur-d;if(next.media||next.nest)next.in=(oN.in||0)+d*sn;}}
   else if(pro==='roll'&&(mode==='r'?next:prev)){if(mode==='r')Ed.roll(c,next,dt,o,oN);else Ed.roll(prev,c,dt,oP,o);}
   else if(mode==='move'){
    const min=Math.min(...group.map(g=>orig.get(g.id).start));let d=Math.max(-min,dt);
    const s=o.start+d,a=snapT(s)-s,b=snapT(s+o.dur)-(s+o.dur);d+=Math.abs(a)<=Math.abs(b)?a:b;d=Math.max(-min,d);
    for(const g of group)g.start=orig.get(g.id).start+d;
    if(group.length===1){const lane=laneAt(ev.clientY);Ed.dom.tracks.querySelectorAll('.ed-lane-new').forEach(n=>n.classList.remove('on'));newLane=null;
     if(lane?.classList.contains('ed-lane-new')){lane.classList.add('on');newLane=lane.dataset.new;}
     else if(lane&&lane.dataset.kind===kind&&!lane.classList.contains('locked')&&lane.dataset.track!==c.track){c.track=lane.dataset.track;const node=Ed.dom.tracks.querySelector(`[data-cid="${c.id}"]`);if(node)lane.append(node);}}
   }
   else if(mode==='l'){let s=snapT(o.start+dt);const sp=o.speed||1;if(c.media||c.nest)s=Math.max(s,o.ramp?o.start:o.start-(o.in||0)/sp);s=Math.max(0,Math.min(s,o.start+o.dur-.1));const d=s-o.start;c.start=s;c.dur=o.dur-d;
    if(o.ramp){c.in=Ed.srcAt(o,s);c.ramp=d>.001?edRampSplit(o.ramp,d/o.dur)[1]:o.ramp;}else if(c.media||c.nest)c.in=(o.in||0)+d*sp;
    if(c.kf)for(const f of Object.values(c.kf))for(const x of f)x.t=Math.max(0,x.t-(d-(c._kfd||0)));c._kfd=d;}
   else{let e2=snapT(o.start+o.dur+dt);const sp=o.speed||1;e2=Math.min(e2,o.ramp?o.start+o.dur:o.start+(srcDur-(o.in||0))/sp);c.dur=Math.max(.1,e2-o.start);if(o.ramp)c.ramp=c.dur<o.dur-.001?edRampSplit(o.ramp,c.dur/o.dur)[0]:o.ramp;}
   // ripple: what follows on the track moves with the trimmed edge (a trimmed start keeps the clip where it was)
   if(pro==='ripple'){if(mode==='l'){const d=c.start-o.start;c.start=o.start;for(const [x,s0] of after)x.start=Math.max(0,s0-d);}else{const d=c.dur-o.dur;for(const [x,s0] of after)x.start=Math.max(0,s0+d);}}
   for(const x of [prev,next,...after.map(a=>a[0])]){if(!x)continue;const node=Ed.dom.tracks.querySelector(`[data-cid="${x.id}"]`);if(node){node.style.left=x.start*Ed.zoom+'px';node.style.width=x.dur*Ed.zoom+'px';}}
   for(const g of group){const node=Ed.dom.tracks.querySelector(`[data-cid="${g.id}"]`);if(node){node.style.left=g.start*Ed.zoom+'px';node.style.width=g.dur*Ed.zoom+'px';}}
   Ed.sync();Ed.draw();Ed.drawTime();};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);delete c._kfd;
   if(moved){
    if(newLane){const t=Ed.addTrack(kind,kind==='video'?undefined:newLane);c.track=t.id;}
    for(const g of group){const tr=Ed.trackOf(g);if(!tr?.main&&!Ed.fits(g.track,g.start,g.dur,ids))g.track=Ed.place(Ed.kindOf(g),g.start,g.dur,undefined,ids);}
    if(c.fadeIn>c.dur/2)c.fadeIn=c.dur/2;if(c.fadeOut>c.dur/2)c.fadeOut=c.dur/2;Ed.after(true);}};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);
 };
 sc.onwheel=e=>{if(e.ctrlKey){e.preventDefault();const z=Ed.zoom*(e.deltaY<0?1.15:.87);Ed.zoom=Math.max(10,Math.min(300,z));$('.ed-zoom').value=Ed.zoom;Ed.drawTimeline();}};
}
/** Handle sizes in the player, in frame pixels (they grow with the frame, so they look the same at any size). */
const edHandleSize=W=>Math.max(8,W/90),edKnob=W=>Math.max(24,W/30);
/** Which handle of the selected clip is at (px, py): 'scale' (a corner) or 'rotate' (the knob above), or null. */
function edHandleAt(c,g,W,H,px,py){
 const t=Ed.time;if(!c||Ed.trackOf(c)?.locked||Ed.kindOf(c)==='audio'||c.adjustment||t<c.start||t>=c.start+c.dur)return null;
 const b=Ed.box(g,c,W,H),a=-Ed.val(c,'rotate')*Math.PI/180,dx=px-b.cx,dy=py-b.cy,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a),hs=edHandleSize(W)*1.8;
 if(Math.hypot(lx,ly+b.h/2+edKnob(W))<hs)return 'rotate';
 if(Math.abs(Math.abs(lx)-b.w/2)<hs&&Math.abs(Math.abs(ly)-b.h/2)<hs)return 'scale';return null;
}
function edWirePreview(){
 const cv=Ed.dom.canvas;
 // the pointer shows what a drag would do
 cv.addEventListener('pointermove',e=>{if(e.buttons||Ed.picking)return;const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),one=Ed.picked().length===1?Ed.picked()[0]:null;
  const h=one&&edHandleAt(one,cv.getContext('2d'),W,H,(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height);cv.style.cursor=h==='scale'?'nwse-resize':h==='rotate'?'grab':'';});
 cv.onpointerdown=e=>{
  if(Ed.picking){const c=Ed.clip(Ed.picking);const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),px=Math.floor((e.clientX-r.left)*W/r.width),py=Math.floor((e.clientY-r.top)*H/r.height);
   Ed.draw();const d=cv.getContext('2d').getImageData(px,py,1,1).data,hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
   Ed.picking=null;Ed.dom.frame?.classList.remove('picking');if(c){Ed.snapshot();c.key={sim:25,smooth:10,spill:50,...(c.key||{}),on:true,color:hex};Ed.after(true);toast('Colour picked: '+hex);}return;}
  const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),sx=W/r.width,sy=H/r.height,px=(e.clientX-r.left)*sx,py=(e.clientY-r.top)*sy,g=cv.getContext('2d');
  const one=Ed.picked().length===1?Ed.picked()[0]:null,grab=one&&edHandleAt(one,g,W,H,px,py);
  if(grab){const b=Ed.box(g,one,W,H),s0=Ed.val(one,'scale'),r0=Ed.val(one,'rotate'),d0=Math.hypot(px-b.cx,py-b.cy)||1,a0=Math.atan2(py-b.cy,px-b.cx);let moved=false;cv.setPointerCapture(e.pointerId);
   cv.onpointermove=ev=>{if(!moved){Ed.snapshot();moved=true;}const qx=(ev.clientX-r.left)*sx-b.cx,qy=(ev.clientY-r.top)*sy-b.cy;
    if(grab==='scale')Ed.setVal(one,'scale',Math.round(edClamp(s0*Math.hypot(qx,qy)/d0,.05,10)*100)/100);
    else{let deg=r0+(Math.atan2(qy,qx)-a0)*180/Math.PI;deg=((deg+180)%360+360)%360-180;if(ev.shiftKey)deg=Math.round(deg/15)*15;Ed.setVal(one,'rotate',Math.round(deg*10)/10);}
    Ed.draw();};
   cv.onpointerup=()=>{cv.onpointermove=cv.onpointerup=null;if(moved){Ed.save();Ed.drawProps();Ed.drawTimeline();}};return;}
  const hit=[...Ed.visible(Ed.time)].reverse().find(c=>{if(Ed.trackOf(c)?.locked||c.adjustment)return false;const b=Ed.box(g,c,W,H);return Math.abs(px-b.cx)<=b.w/2&&Math.abs(py-b.cy)<=b.h/2;});
  if(!hit){if(Ed.sels.size)Ed.select(null);return;}
  if(!Ed.sels.has(hit.id)||Ed.sels.size>1)Ed.select(hit.id);
  const x0=Ed.val(hit,'x'),y0=Ed.val(hit,'y');let moved=false;cv.setPointerCapture(e.pointerId);
  cv.onpointermove=ev=>{if(!moved){Ed.snapshot();moved=true;}let x=Math.round((x0+(ev.clientX-e.clientX)*sx/W)*1000)/1000,y=Math.round((y0+(ev.clientY-e.clientY)*sy/H)*1000)/1000;
   if(Math.abs(x)<.015)x=0;if(Math.abs(y)<.015)y=0;Ed.setVal(hit,'x',x);Ed.setVal(hit,'y',y);Ed.draw();};
  cv.onpointerup=()=>{cv.onpointermove=cv.onpointerup=null;if(moved){Ed.save();Ed.drawProps();Ed.drawTimeline();}};
 };
}
window.addEventListener('keydown',e=>{
 if(App.route!=='editor'||!Ed.p||!Ed.dom.root?.isConnected||e.isComposing||Ed.exporting)return;
 if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable||$('#modal')?.innerHTML)return;
 const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;let done=true;
 if(k===' '&&mod&&e.shiftKey)Ed.playRange();
 else if(k===' '&&!mod)Ed.play();
 else if(!mod&&!e.altKey&&k==='l'&&e.shiftKey)Ed.toggleLoop();
 else if(mod&&k==='b'&&e.shiftKey||!mod&&!e.altKey&&k==='s'&&e.shiftKey)Ed.splitAll();
 else if(!mod&&!e.altKey&&k==='a')Ed.selectFrom(e.shiftKey?-1:1);
 else if(!mod&&!e.altKey&&!e.shiftKey&&/^[1-9]$/.test(e.key)&&Ed.p.clips.some(x=>x.nest?.multi)){if(!Ed.switchAngle(Number(e.key)-1))done=false;}
 else if(e.altKey&&!mod&&e.code==='KeyN'){const c=Ed.sel&&Ed.clip(Ed.sel);if(c?.nest&&Ed.sels.size===1)Ed.unnest(c);else Ed.nest();}
 else if(e.altKey&&mod&&(k==='arrowleft'||k==='arrowright')){if(!Ed.swap(k==='arrowleft'?-1:1))done=false;}
 else if(e.altKey&&!mod&&(k==='arrowleft'||k==='arrowright')){if(!Ed.nudge((k==='arrowleft'?-1:1)*(e.shiftKey?5:1)))done=false;}
 else if((k==='delete'||k==='backspace')&&!mod&&e.shiftKey)Ed.rippleRemove();
 else if((k==='delete'||k==='backspace')&&!mod)Ed.remove();
 else if(!mod&&!e.altKey&&k==='q')Ed.trimTo('start');
 else if(!mod&&!e.altKey&&k==='w')Ed.trimTo('end');
 else if(!mod&&!e.altKey&&k==='j')Ed.shuttle(-1);
 else if(!mod&&!e.altKey&&k==='k')Ed.shuttle(0);
 else if(!mod&&!e.altKey&&k==='l')Ed.shuttle(1);
 else if(!mod&&!e.altKey&&k==='i'&&e.shiftKey){const r=Ed.p.range;if(r?.in!=null)Ed.seek(r.in);}
 else if(!mod&&!e.altKey&&k==='o'&&e.shiftKey){const r=Ed.p.range;if(r?.out!=null)Ed.seek(r.out);}
 else if(!mod&&!e.altKey&&k==='i')Ed.setRange('in');
 else if(!mod&&!e.altKey&&k==='o')Ed.setRange('out');
 else if(e.altKey&&!mod&&e.code==='KeyX')Ed.clearRange();
 else if(!mod&&!e.altKey&&k==='f'&&e.shiftKey)Ed.freeze();
 else if(mod&&k==='z'&&e.shiftKey||mod&&k==='y')Ed.redo();
 else if(mod&&k==='z')Ed.undo();
 else if(mod&&k==='b'||!mod&&k==='s')Ed.split();
 else if(mod&&k==='d')Ed.duplicate();
 else if(mod&&k==='c')Ed.copy();
 else if(mod&&k==='x')Ed.copy(true);
 else if(mod&&e.altKey&&k==='v')edPasteAttrs();
 else if(mod&&k==='v')Ed.paste();
 else if(mod&&k==='a')Ed.selectAll();
 else if(mod&&k==='g'&&e.shiftKey)Ed.ungroup();
 else if(mod&&k==='g')Ed.group();
 else if(!mod&&!e.altKey&&k==='e'&&e.shiftKey)Ed.saveFrame();
 else if(!mod&&k==='m')Ed.toggleMarker();
 else if(e.key==='?')edKeys();
 else if(k==='arrowleft')Ed.seek(Ed.time-(e.shiftKey?1:1/30));
 else if(k==='arrowright')Ed.seek(Ed.time+(e.shiftKey?1:1/30));
 else if(k==='home')Ed.seek(0);
 else if(k==='end')Ed.seek(Ed.end());
 else if(k==='escape'&&(Ed.sels.size||Ed.junction))Ed.select(null);
 else if(k==='escape'&&Ed.stack?.length)Ed.exitNest();
 else done=false;
 if(done){e.preventDefault();e.stopPropagation();}
},true);

/** A menu at the pointer: [label, icon, action, disabled, danger] rows, or '-' for a line. */
/** Replace: pick other media of the same kind from Media, or import a file for it. */
/** Paste attributes: which groups of the copied clip's settings go onto the selected clips. */
/** A marker's name, colour and note (double-click a marker on the ruler or in the list). */
/** The mixer: every track with sound, its volume (0-200%), pan (left-right), mute and solo. Changes play at once. */
/** Source monitor (Premiere/Resolve): watch a file, mark in and out (I, O), then insert or overwrite it at the playhead. */
// ---------- resizable panels: drag the lines between them; sizes are remembered ----------
function edLayout(R){
 let L={};try{L=JSON.parse(localStorage.getItem('editor-layout')||'{}');}catch{}
 const apply=()=>{if(L.c1)R.style.setProperty('--ed-c1',L.c1+'px');if(L.c2)R.style.setProperty('--ed-c2',L.c2+'px');if(L.tl)R.style.setProperty('--ed-tl',L.tl+'px');place();};
 const place=()=>{const rr=R.getBoundingClientRect(),lib=R.querySelector('.ed-lib').getBoundingClientRect(),pr=R.querySelector('.ed-props').getBoundingClientRect(),tl=R.querySelector('.ed-tl').getBoundingClientRect();
  const h1=R.querySelector('[data-rz=c1]'),h2=R.querySelector('[data-rz=c2]'),h3=R.querySelector('[data-rz=tl]');
  Object.assign(h1.style,{left:(lib.right-rr.left-1)+'px',top:(lib.top-rr.top)+'px',height:lib.height+'px'});
  Object.assign(h2.style,{left:(pr.right-rr.left-1)+'px',top:(pr.top-rr.top)+'px',height:pr.height+'px'});
  Object.assign(h3.style,{top:(tl.top-rr.top-5)+'px',left:'0px',width:rr.width+'px'});};
 R.querySelectorAll('[data-rz]').forEach(h=>h.onpointerdown=e=>{e.preventDefault();h.setPointerCapture(e.pointerId);h.classList.add('on');const key=h.dataset.rz,rr=R.getBoundingClientRect();
  const lib=R.querySelector('.ed-lib').getBoundingClientRect(),pr=R.querySelector('.ed-props').getBoundingClientRect();
  h.onpointermove=ev=>{if(key==='c1')L.c1=edClamp(ev.clientX-lib.left,220,rr.width*.45);else if(key==='c2')L.c2=edClamp(ev.clientX-pr.left,240,rr.width*.4);else L.tl=edClamp(rr.bottom-ev.clientY,160,rr.height*.65);apply();Ed.fit();};
  h.onpointerup=()=>{h.onpointermove=h.onpointerup=null;h.classList.remove('on');try{localStorage.setItem('editor-layout',JSON.stringify(L));}catch{}Ed.drawTimeline();};
  h.ondblclick=()=>{delete L[key];R.style.removeProperty('--ed-'+key);try{localStorage.setItem('editor-layout',JSON.stringify(L));}catch{}place();Ed.fit();};});
 apply();new ResizeObserver(place).observe(R);
}
// ---------- Studio and the editor ----------
/** Opens a video the studio made (or any file at a link on this server) in a new editor project. */
window.openInEditor=async(src,name)=>{
 try{toast('Opening in the Editor…');await Ed.load();const r=await fetch(src);if(!r.ok)throw new Error('Could not load the video');const b=await r.blob();
  const file=new File([b],(name||'Video').replace(/[\\/:*?"<>|]+/g,'')+(/\.\w{2,4}$/.test(name||'')?'':(b.type.includes('webm')?'.webm':'.mp4')),{type:b.type||'video/mp4'});
  const id=Ed.create({name:(name||'Video').replace(/\.\w{2,4}$/,'')});Ed.open(id);const [m]=await Ed.importFiles([file]);if(m)Ed.add(m.id);Ed.flush();App.go('editor',id);}
 catch(e){toast(e.message,true);}
};
/** Puts an exported video into the Studio library, so it shows on Studio with your other files. */
async function edSaveToStudio(blob,name){
 const r=await fetch(withKey('/api/library/upload?name='+encodeURIComponent(name)),{method:'POST',body:blob});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not save to Studio');return j;
}
