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
  if(this.tab==='audio')body=`<div class="ed-sub">Sound effects</div><div class="ed-chips ed-sfx">${ED_SFX.map(([k,l])=>`<button type="button" data-sfx="${k}" title="Add at the playhead">${I.add} ${l}</button>`).join('')}</div>`+body;
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
  el.querySelectorAll('[data-sfx]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await this.addSfx(b.dataset.sfx);}finally{b.disabled=false;}});
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
   const joins=t.kind==='video'||t.kind==='audio'?cl.slice(1).filter((c,i)=>Math.abs(cl[i].start+cl[i].dur-c.start)<.05).map(c=>`<button type="button" class="ed-join${c.trans?' on':''}${this.junction===c.id?' sel':''}" data-join="${c.id}" style="left:${c.start*z}px" aria-label="Transition" title="${c.trans?[...ED_TRANS,...ED_ATRANS].find(x=>x[0]===c.trans.type)?.[1]||'Transition':t.kind==='audio'?'Add a crossfade':'Add a transition'}">${c.trans?I.trans:''}</button>`).join(''):'';
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
