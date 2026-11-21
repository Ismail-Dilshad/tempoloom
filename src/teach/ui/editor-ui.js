'use strict';
// Editor, the page: the library (media, audio, text, stickers, effects, transitions), the properties
// panel, the player, the timeline with its tracks, and the projects screen. The engine is in editor.js.
const ED_H={video:52,main:60,text:40,sticker:40,audio:48};
const ED_LIB=[['media','Media','film'],['audio','Audio','music'],['text','Text','text'],['stickers','Stickers','shapes'],['effects','Effects','wand'],['trans','Transitions','trans']];
Object.assign(Ed,{
 drawLib(){
  const el=this.dom.lib;if(!el)return;
  const items=this.media.filter(m=>this.tab==='audio'?m.type==='audio':m.type!=='audio');
  const tile=m=>`<div class="ed-media" draggable="true" data-mid="${m.id}" title="${esc(m.name)}">
    <div class="ed-media-thumb">${m.type==='audio'?`<span class="ed-media-wave">${I.music}</span>`:m.thumbs?.[0]?`<img src="${m.thumbs[Math.min(2,m.thumbs.length-1)]}" alt="">`:`<span class="ed-media-wave">${I[m.type==='image'?'image':'film']}</span>`}
     ${m.type!=='image'&&m.dur?`<span class="ed-media-dur">${edFmt(m.dur).slice(0,5)}</span>`:''}
     ${this.p.clips.some(c=>c.media===m.id)?'<span class="ed-media-used">Added</span>':''}
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
   <div class="ed-text-presets">${ED_TEXTS.map(([l,size,weight,box],i)=>`<button type="button" class="ed-text-preset${box?' box':''}" data-text="${i}"><span style="font-size:${Math.round(size/2.4)}px;font-weight:${weight}">${l}</span><i>${I.add}</i></button>`).join('')}</div>`;}
  else if(this.tab==='stickers')body=`<div class="ed-sub">Shapes</div><div class="ed-stickers">${ED_SHAPES.map(([s,l])=>`<button type="button" class="ed-sticker" data-shape="${s}" aria-label="${l}" title="${l}"><svg viewBox="0 0 40 40">${edShapeSvg(s)}</svg></button>`).join('')}</div>
   <div class="ed-sub">Emoji</div><div class="ed-stickers">${ED_EMOJI.map(e=>`<button type="button" class="ed-sticker emoji" data-emoji="${e}">${e}</button>`).join('')}</div>`;
  else if(this.tab==='effects')body=`<div class="ed-sub">${visual?'Filters for the selected clip':'Select a video or photo, then choose a filter'}</div><div class="ed-filters">${ED_FILTERS.map(([id,l,a])=>`<button type="button" class="ed-filter" data-filter="${id}" ${visual?'':'disabled'} aria-pressed="${visual?JSON.stringify(sel.adj||{})===JSON.stringify(a):false}"><span class="ed-filter-swatch" style="filter:${edCssFilter(a)}"></span><span>${l}</span></button>`).join('')}</div>`;
  else if(this.tab==='trans')body=`<div class="ed-sub">Click the ◆ between two clips on a track, then choose one. Or set one for every cut:</div>
   <div class="ed-filters">${ED_TRANS.map(([id,l])=>`<button type="button" class="ed-filter" data-trans-all="${id}"><span class="ed-trans-swatch t-${id}"></span><span>${l}</span></button>`).join('')}</div>
   <button type="button" class="btn small ghost ed-wide" data-trans-all="none">${I.x} Remove all transitions</button>`;
  else body=`${this.tab==='audio'?(this.recording?`<button type="button" class="btn small ed-wide ed-rec on" data-voice><i class="ed-rec-dot"></i> Stop recording <span data-rec-time>00:00</span></button>`:`<button type="button" class="btn small ed-wide" data-voice>${I.mic} Record voice-over</button>`):''}
   ${items.length?`<div class="ed-lib-bar"><button type="button" class="btn small" data-import>${I.add} Import</button><span class="ed-sub">${items.length} ${this.tab==='audio'?'audio':'item'}${items.length>1&&this.tab!=='audio'?'s':''}</span></div>
      <div class="ed-media-grid${this.tab==='audio'?' list':''}">${items.map(tile).join('')}</div>`:drop}`;
  el.innerHTML=`<nav class="ed-cats" role="tablist" aria-label="Library">${ED_LIB.map(([id,l,ic])=>`<button type="button" role="tab" aria-selected="${this.tab===id}" data-tab="${id}">${I[ic]}<span>${l}</span></button>`).join('')}</nav><div class="ed-lib-body">${body}</div>`;
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{this.tab=b.dataset.tab;this.drawLib();});
  el.querySelectorAll('[data-import]').forEach(b=>b.onclick=e=>{e.preventDefault();this.dom.file.click();});
  el.querySelectorAll('[data-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.add(b.dataset.add);});
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.removeMedia(b.dataset.del);});
  el.querySelectorAll('[data-text]').forEach(b=>b.onclick=()=>this.addText(+b.dataset.text));
  el.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>this.addSticker({type:'shape',shape:b.dataset.shape}));
  el.querySelectorAll('[data-emoji]').forEach(b=>b.onclick=()=>this.addSticker({type:'emoji',emoji:b.dataset.emoji}));
  el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{const c=this.sel&&this.clip(this.sel);if(!c)return;this.snapshot();const a=ED_FILTERS.find(f=>f[0]===b.dataset.filter)[2];if(Object.keys(a).length)c.adj={...a};else delete c.adj;this.after(true);this.drawLib();});
  el.querySelectorAll('[data-trans-all]').forEach(b=>b.onclick=()=>{const t=b.dataset.transAll;this.transAll(t,.6);toast(t==='none'?'Transitions removed':'Transition set on every cut');});
  const cap=$('[data-captions]',el);if(cap)cap.onclick=()=>this.captions();
  const cl=$('[data-cap-lang]',el);if(cl)cl.onchange=()=>{this.p.capLang=cl.value;this.save();};
  const ck=$('[data-cap-look]',el);if(ck)ck.onchange=()=>{this.p.capLook=ck.value;this.save();};
  const ce=$('[data-cap-engine]',el);if(ce){ce.onchange=()=>{this.p.capEngine=ce.value;this.save();this.drawLib();};if(!this.stt)this.loadStt().then(()=>{if(this.tab==='text')this.drawLib();});else this.drawStt();}
  const cs=$('[data-cap-sorani]',el);if(cs)cs.onchange=()=>{this.p.capSorani=cs.checked;this.save();};
  const fx=$('[data-fixes]',el);if(fx)fx.onclick=()=>edFixesDialog();
  const so=$('[data-srt-out]',el);if(so)so.onclick=()=>{const list=this.p.clips.filter(c=>c.text!==undefined&&(c.cap||c.words)).sort((a,b)=>a.start-b.start);if(!list.length)return toast('There are no captions yet.');
   edSaveFile(new Blob(['\uFEFF'+edSrt(list)],{type:'application/x-subrip;charset=utf-8'}),this.p.name+'.srt');toast(`Saved ${list.length} caption${list.length>1?'s':''} as .srt`);};
  const sf=$('[data-srt-file]',el),si=$('[data-srt-in]',el);if(si&&sf){si.onclick=()=>sf.click();
   sf.onchange=async()=>{const file=sf.files[0];sf.value='';if(!file)return;const cues=edParseSubs(await file.text());if(!cues.length)return toast('No captions were found in that file.',true);
    const lines=cues.map(q=>{const ws=edWords(q.text),d=(q.e-q.s)/Math.max(1,ws.length);return {s:q.s,e:q.e,words:ws.map((w,i)=>({t:w,s:q.s+i*d,e:q.s+(i+1)*d}))};});
    const lang=this.p.capLang&&this.p.capLang!=='auto'?this.p.capLang:'auto',n=this.addCaptions(lines,lang,this.p.capLook||'clean');toast(`Imported ${n} caption${n>1?'s':''}`);};}
  const vo=$('[data-voice]',el);if(vo)vo.onclick=()=>this.recordVoice();
  el.querySelectorAll('.ed-media').forEach(t=>{t.ondragstart=e=>{e.dataTransfer.setData('text/x-ed-media',t.dataset.mid);e.dataTransfer.effectAllowed='copy';};t.ondblclick=()=>this.add(t.dataset.mid);});
 },
 drawTime(){const t=this.dom.time;if(t)t.innerHTML=`<b>${edFmt(this.time)}</b> / ${edFmt(this.end())}${this.playing&&this.rate!==1?` <span class="ed-rate">${this.rate<0?'◀ ':''}${Math.abs(this.rate)}×</span>`:''}`;const p=this.dom.play;if(p){p.innerHTML=this.playing?I.pause:I.play;p.setAttribute('aria-label',this.playing?'Pause':'Play');}},
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
 drawHead(){const h=this.dom.head;if(h)h.style.transform=`translateX(${this.time*this.zoom}px)`;
  const sc=this.dom.scroll;if(this.playing&&sc){const x=this.time*this.zoom;if(x>sc.scrollLeft+sc.clientWidth-80)sc.scrollLeft=x-80;}},
 drawExport(msg){const o=this.dom.exportOverlay;if(!o)return;o.hidden=!this.exporting;const b=o.querySelector('b');if(b&&msg)b.textContent=msg;},
 laneH(t){return t.main?ED_H.main:ED_H[t.kind]||44;},
 drawTimeline(){
  const el=this.dom.tracks;if(!el)return;const z=this.zoom,len=Math.max(this.end()+10,(this.dom.scroll?.clientWidth||900)/z);
  this.dom.inner.style.width=len*z+'px';
  const step=z>=120?1:z>=60?2:z>=30?5:z>=12?10:30;
  this.dom.ruler.innerHTML=Array.from({length:Math.ceil(len/step)+1},(_,i)=>`<span style="left:${i*step*z}px">${edFmt(i*step).slice(0,5)}</span>`).join('')+
   this.p.markers.map(m=>`<i class="ed-marker" style="left:${m*z}px" title="Marker ${edFmt(m)}"></i>`).join('')+
   (()=>{const r=this.p.range;if(!r||(r.in==null&&r.out==null))return '';const a=r.in??0,b=r.out??Math.max(this.end(),a);
    return `<i class="ed-range" style="left:${a*z}px;width:${Math.max(2,(b-a)*z)}px" title="In ${edFmt(a)} · Out ${edFmt(b)}">${r.in!=null?'<b class="ed-rmark ed-rmark-in"></b>':''}${r.out!=null?'<b class="ed-rmark ed-rmark-out"></b>':''}</i>`;})();
  const tr=this.p.tracks;
  el.innerHTML=`<div class="ed-lane-new" data-new="top"></div>${tr.map(t=>{const cl=this.p.clips.filter(c=>c.track===t.id).sort((a,b)=>a.start-b.start);
   const joins=t.kind==='video'?cl.slice(1).filter((c,i)=>Math.abs(cl[i].start+cl[i].dur-c.start)<.05).map(c=>`<button type="button" class="ed-join${c.trans?' on':''}${this.junction===c.id?' sel':''}" data-join="${c.id}" style="left:${c.start*z}px" aria-label="Transition" title="${c.trans?ED_TRANS.find(x=>x[0]===c.trans.type)?.[1]:'Add a transition'}">${c.trans?I.trans:''}</button>`).join(''):'';
   return `<div class="ed-lane${t.main?' main':''}${t.locked?' locked':''}${t.hidden?' hidden':''}" data-track="${t.id}" data-kind="${t.kind}" style="height:${this.laneH(t)}px">${cl.map(c=>this.clipHtml(c)).join('')}${joins}${t.main&&!this.p.clips.length?`<span class="ed-lane-hint">${I.film} Drag media here and start creating</span>`:''}</div>`;}).join('')}<div class="ed-lane-new" data-new="bottom"></div>`;
  this.dom.heads.innerHTML=`<div class="ed-head-gap"></div>${tr.map(t=>{const vis=t.kind!=='audio',snd=t.kind==='video'||t.kind==='audio';
   return `<div class="ed-head${t.main?' main':''}" style="height:${this.laneH(t)}px" data-track="${t.id}"><span class="ed-head-name">${I[ED_KINDS[t.kind].icon]}${t.main?'Main':ED_KINDS[t.kind].label}</span>
    <span class="ed-head-tools"><button type="button" data-tk="locked" aria-pressed="${!!t.locked}" aria-label="${t.locked?'Unlock':'Lock'} track">${t.locked?I.lock:I.unlock}</button>
    ${vis?`<button type="button" data-tk="hidden" aria-pressed="${!!t.hidden}" aria-label="${t.hidden?'Show':'Hide'} track">${t.hidden?I.eyeOff:I.eye}</button>`:''}
    ${snd?`<button type="button" data-tk="muted" aria-pressed="${!!t.muted}" aria-label="${t.muted?'Unmute':'Mute'} track">${t.muted?I.mute:I.sound}</button>`:''}
    ${t.main?'':`<button type="button" data-tk="remove" aria-label="Delete track">${I.x}</button>`}</span></div>`;}).join('')}<div class="ed-head-gap"></div>`;
  this.dom.heads.querySelectorAll('[data-tk]').forEach(b=>b.onclick=()=>{const id=b.closest('[data-track]').dataset.track;b.dataset.tk==='remove'?this.removeTrack(id):this.setTrack(id,b.dataset.tk);});
  el.querySelectorAll('[data-join]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.selectJoin(b.dataset.join);});
  const mg=this.dom.root?.querySelector('[data-magnet]');if(mg)mg.setAttribute('aria-pressed',String(!!this.p.magnet));
  this.drawHead();
 },
 clipHtml(c){
  const m=this.mediaOf(c),w=c.dur*this.zoom,sel=this.sels.has(c.id),kind=this.kindOf(c);
  let inner='';
  if(c.text!==undefined)inner=`${c.words?.some(w=>w.alt)?`<b class="ed-tocheck" title="Words to check">${I.flag}</b>`:''}<span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${I.text}${esc(c.text||'Text')}</span>`;
  else if(c.sticker)inner=`<span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${c.sticker.type==='emoji'?c.sticker.emoji:I.shapes}${esc(c.sticker.type==='emoji'?'Sticker':ED_SHAPES.find(s=>s[0]===c.sticker.shape)?.[1]||'Shape')}</span>`;
  else if(kind==='audio'){const pk=m?.peaks||[],from=(c.in||0)/(m?.dur||1),to=((c.in||0)+c.dur*(c.speed||1))/(m?.dur||1),part=pk.slice(Math.floor(from*pk.length),Math.ceil(to*pk.length)),v=edClamp(c.volume??1,0,2);
   inner=`<svg class="ed-wave" viewBox="0 0 ${Math.max(1,part.length)} 100" preserveAspectRatio="none">${part.map((x,i)=>`<rect x="${i}" y="${50-x*46*Math.min(1,v)}" width=".6" height="${Math.max(2,x*92*Math.min(1,v))}"/>`).join('')}</svg>
    <i class="ed-vol" style="top:${16+(1-v/2)*(this.laneH({kind:'audio'})-20)}px" title="Volume ${Math.round(v*100)}%"></i><span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${I.music}${esc(m?.name||'')}${c.speed&&c.speed!==1?` · ${c.speed}×`:''}</span>`;}
  else if(m){const th=m.thumbs||[],n=Math.max(1,Math.ceil(w/56));inner=`<div class="ed-strip">${Array.from({length:n},(_,i)=>{const src=th.length?th[Math.min(th.length-1,Math.floor(((c.in||0)+(i+.5)/n*c.dur*(c.speed||1))/(m.dur||c.dur)*th.length))]:'';return src?`<img src="${src}" alt="" style="filter:${edCssFilter(c.adj||{})}">`:'<i></i>';}).join('')}</div>
   <span class="ed-clip-label">${c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:''}${c.detached?I.mute:''}${esc(m.name)}${c.speed&&c.speed!==1?` · ${c.speed}×`:''}</span>`;}
  const kts=sel&&c.kf?[...new Set(Object.values(c.kf).flat().map(x=>Math.round(x.t*100)/100))]:[];
  const fi=(c.fadeIn||0)*this.zoom,fo=(c.fadeOut||0)*this.zoom,fades=c.media&&w>40?`${fi?`<i class="ed-fz l" style="width:${fi}px"></i>`:''}${fo?`<i class="ed-fz r" style="width:${fo}px"></i>`:''}<i class="ed-fh" data-fh="in" style="left:${Math.max(10,fi)}px" title="Fade in ${(c.fadeIn||0).toFixed(1)} s: drag"></i><i class="ed-fh" data-fh="out" style="left:${Math.min(w-10,w-fo)}px" title="Fade out ${(c.fadeOut||0).toFixed(1)} s: drag"></i>`:'';
  return `<div class="ed-clip ${kind}${sel?' sel':''}" data-cid="${c.id}" style="left:${c.start*this.zoom}px;width:${w}px">${inner}${fades}${kts.map(t=>`<i class="ed-kf" style="left:${t*this.zoom}px"></i>`).join('')}<i class="ed-h l" data-h="l"></i><i class="ed-h r" data-h="r"></i></div>`;
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
  const kind=!c?'':c.text!==undefined?'text':c.sticker?'sticker':this.kindOf(c)==='audio'?'audio':m?.type||'video';
  const tabs=!c?[['details','Details']]:kind==='text'?[['text','Text'],['anim','Animation'],['basic','Basic']]:kind==='sticker'?[['sticker','Sticker'],['anim','Animation'],['basic','Basic']]:kind==='audio'?[['audio','Audio'],['speed','Speed']]:kind==='image'?[['basic','Basic'],['adjust','Adjust'],['mask','Mask']]:[['basic','Basic'],['adjust','Adjust'],['mask','Mask'],['audio','Audio'],['speed','Speed']];
  if(!tabs.some(([id])=>id===this.ptab))this.ptab=tabs[0][0];
  const t=this.ptab,locked=c&&this.trackOf(c)?.locked;let body='';
  const fades=()=>sec('Fade',`${row('fadeIn','Fade in',c.fadeIn||0,{min:0,max:Math.min(5,+(c.dur/2).toFixed(1)),step:.1,suffix:'s'})}${row('fadeOut','Fade out',c.fadeOut||0,{min:0,max:Math.min(5,+(c.dur/2).toFixed(1)),step:.1,suffix:'s'})}`);
  if(!c)body=`<dl class="ed-details"><dt>Name</dt><dd dir="auto">${esc(this.p.name)}</dd><dt>Shape</dt><dd>${seg('ratio',Object.keys(ED_RATIOS).map(r=>[r,r]),this.p.ratio)}</dd>
    <dt>Resolution</dt><dd>${W} × ${H}</dd><dt>Length</dt><dd>${edFmt(this.end())}</dd><dt>Clips</dt><dd>${this.p.clips.length} on ${this.p.tracks.length} tracks</dd>
    <dt>Background</dt><dd>${seg('bgmode',[['color','Colour'],['blur','Blur']],this.p.bgMode)}</dd>${this.p.bgMode==='color'?`<dt></dt><dd><input type="color" data-bg value="${esc(this.p.bg||'#000000')}" aria-label="Background colour"></dd>`:''}
    <dt>Markers</dt><dd>${this.p.markers.length?`${this.p.markers.length} · <button type="button" class="ed-link" data-clear-markers>Clear</button>`:'Press M to add one'}</dd></dl>`;
  else if(t==='text')body=(c.words?sec('Caption',`<div class="ed-seg wrap">${ED_CAPS.map(([v,l])=>`<button type="button" data-caplook="${v}" aria-pressed="${(c.capLook||'clean')===v}">${l}</button>`).join('')}</div>
     ${c.capStyle==='karaoke'||c.capStyle==='build'?`<div class="ed-row"><label>Highlight</label><div class="ed-ctl"><input type="color" data-k="hl" value="${esc(c.hl||'#FFD400')}" aria-label="Highlight colour"></div></div>`:''}
     ${c.words.some(w=>w.alt)?`<div class="ed-checks"><b>${I.flag} Check these words</b>${c.words.map((w,i)=>w.alt?`<div class="ed-check"><span class="ed-check-words"><bdi>${esc(c.words.slice(i,i+(w.altSpan||1)).map(x=>x.t).join(' '))}</bdi><i>other model heard</i><bdi>${esc(w.alt)}</bdi></span><span class="ed-check-btns"><button type="button" class="btn small" data-alt="${i}">Use</button><button type="button" class="btn small ghost" data-keep="${i}">Keep</button></span></div>`:'').join('')}</div>`:''}
     <div class="ed-row"><label>Capitals</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="upper" ${c.upper?'checked':''} aria-label="Capitals"></div></div>
     <div class="ed-row"><label>Language</label><div class="ed-ctl"><span class="ed-val" dir="auto">${esc(edLangName(c.lang||'auto'))}</span></div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-cap-all>${I.layers} Use this look on every caption</button></div></div>`):'')+sec('Text',`<textarea data-k="text" rows="3" dir="auto" aria-label="Text">${esc(c.text||'')}</textarea>`)+
    sec('Style',`<div class="ed-row"><label>Font</label><div class="ed-ctl"><select data-k="font" aria-label="Font">${ED_FONTS.map(([f,l])=>`<option value="${esc(f)}" ${c.font===f?'selected':''}>${l}</option>`).join('')}</select></div></div>
     ${row('size','Size',c.size||40,{min:12,max:200})}${row('weight','Weight',c.weight||600,{min:300,max:900,step:100})}${row('spacing','Spacing',c.spacing||0,{min:-5,max:30})}
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
    sec('Opacity and blend',row('opacity','Opacity',cur('opacity'),{min:0,max:100,unit:'pct',suffix:'%'})+`<div class="ed-row"><label for="ed-blend">Blend</label><div class="ed-ctl"><select id="ed-blend" data-k="blend" aria-label="Blend mode">${ED_BLENDS.map(([v,l])=>`<option value="${v}" ${(c.blend||'normal')===v?'selected':''}>${l}</option>`).join('')}</select></div></div>`)+(media?fades():'')+
    `<p class="ed-hint">${I.diamond} Keyframes: move the playhead, press the diamond, change the value. It animates between them.</p>`;}
  else if(t==='adjust'){const a=c.adj||{};body=sec('Filter',`<div class="ed-filters small">${ED_FILTERS.map(([id,l,f])=>`<button type="button" class="ed-filter" data-filter="${id}" aria-pressed="${JSON.stringify(a)===JSON.stringify(f)}"><span class="ed-filter-swatch" style="filter:${edCssFilter(f)}"></span><span>${l}</span></button>`).join('')}</div>`)+
    sec('Adjust',ED_ADJ.map(([k,l,mn,mx])=>row('adj_'+k,l,a[k]||0,{min:mn,max:mx})).join(''),'adjust')+
    sec('Green screen',`<div class="ed-row"><label>Remove a colour</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="key_on" ${c.key?.on?'checked':''} aria-label="Green screen"><button type="button" class="ed-tool" data-key-pick aria-pressed="${this.picking===c.id}">${I.wand} ${this.picking===c.id?'Click the picture…':'Pick from picture'}</button></div></div>
     ${c.key?.on?`<div class="ed-row"><label>Colour</label><div class="ed-ctl"><input type="color" data-k="key_color" value="${esc(c.key.color||'#00b140')}" aria-label="Key colour"></div></div>
      ${row('key_sim','Similarity',c.key.sim??25,{min:0,max:100})}${row('key_smooth','Smoothness',c.key.smooth??10,{min:0,max:100})}${row('key_spill','Spill',c.key.spill??50,{min:0,max:100})}`:''}`);}
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
   body=(kind==='video'?sec('Sound',c.detached?`<div class="ed-note">${I.detach} The sound is on its own audio track.</div>`:`${row('volume','Volume',cur('volume'),{min:0,max:200,unit:'pct',suffix:'%'})}<div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-detach>${I.detach} Detach audio</button></div></div>`)
    :sec('Volume',row('volume','Volume',cur('volume'),{min:0,max:200,unit:'pct',suffix:'%'})))+(snd?loud:'')+duck+(kind==='audio'?fades():'');}
  else if(t==='speed')body=sec('Speed',`${row('speed','Speed',c.speed||1,{min:.25,max:4,step:.05,suffix:'×'})}<div class="ed-chips">${[.5,1,1.5,2,3].map(s=>`<button type="button" data-speed="${s}" aria-pressed="${(c.speed||1)===s}">${s}×</button>`).join('')}</div>
     <div class="ed-row"><label>Length</label><div class="ed-ctl"><span class="ed-val">${edFmt(c.dur)}</span></div></div>`,'speed')+
    sec('Speed curve',`<div class="ed-seg wrap">${[['none','None'],...ED_RAMPS.map(r=>[r[0],r[1]]),...(c.rampName==='custom'?[['custom','Custom']]:[])].map(([id,l])=>`<button type="button" data-ramp="${id}" aria-pressed="${(c.ramp?(c.rampName||'custom'):'none')===id}">${l}</button>`).join('')}</div>
     ${c.ramp?`<div class="ed-curve">${edCurveSvg(c.ramp)}</div><p class="ed-hint">Drag a point up for faster, down for slower. Click the line to add a point; double-click one to remove it.</p>`:'<p class="ed-hint">A curve changes the speed within the clip: fast, then slow motion, then fast. The sound keeps its pitch.</p>'}`);
  const ke=c&&(t==='basic'||t==='audio')&&c.kf?this.kfEaseAt(c):null;
  if(ke)body=sec('Keyframe at the playhead',`<div class="ed-row"><label>To the next</label><div class="ed-ctl"><div class="ed-seg wrap">${ED_EASES.map(([v,l])=>`<button type="button" data-ease="${v}" aria-pressed="${ke===v}">${l}</button>`).join('')}</div></div></div>`)+body;
  el.innerHTML=`<nav class="ed-ptabs" role="tablist">${tabs.map(([id,l])=>`<button type="button" role="tab" aria-selected="${t===id}" data-ptab="${id}">${l}</button>`).join('')}
    ${c?`<span class="grow"></span><button type="button" class="iconbtn sm" data-remove aria-label="Delete clip" data-tooltip="Delete">${I.trash}</button>`:''}</nav><div class="ed-pbody${locked?' locked':''}">${locked?`<div class="ed-note">${I.lock} This track is locked.</div>`:''}${body}</div>`;
  el.querySelectorAll('[data-ptab]').forEach(b=>b.onclick=()=>{this.ptab=b.dataset.ptab;this.drawProps();});
  if(!c){
   el.querySelectorAll('[data-ratio]').forEach(b=>b.onclick=()=>{this.snapshot();this.p.ratio=b.dataset.ratio;this.save();this.drawProps();this.fit();this.draw();const lb=this.dom.root?.querySelector('.ed-ratio');if(lb)lb.textContent=this.p.ratio;});
   el.querySelectorAll('[data-bgmode]').forEach(b=>b.onclick=()=>{this.snapshot();this.p.bgMode=b.dataset.bgmode;this.save();this.drawProps();this.draw();});
   const bg=$('[data-bg]',el);if(bg){bg.onfocus=()=>this.snapshot();bg.oninput=()=>{this.p.bg=bg.value;this.save();this.draw();};}
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
    if(k==='text'&&c.words?.length){c.text=v;this.retime(c,v);}else if(k==='speed')setSpeed(v);else if(k==='duckdb'){c.duck={db:-edClamp(v,3,30)};this._dk=null;}
    else if(k.startsWith('key_'))c.key={color:'#00b140',sim:25,smooth:10,spill:50,...(c.key||{}),[k.slice(4)]:v};
    else if(k.startsWith('mask_'))c.mask={...(c.mask||{shape:'rect'}),[k.slice(5)]:v};else if(k.startsWith('crop'))c.crop={...(c.crop||{}),[k.slice(4)]:edClamp(v,0,.45)};else if(k.startsWith('adj_'))c.adj={...(c.adj||{}),[k.slice(4)]:v};
    else if(ED_KFKEYS.has(k))this.setVal(c,k,v);else c[k]=v;
    el.querySelectorAll(`[data-k="${k}"]`).forEach(o=>{if(o!==inp&&o.type!=='checkbox')o.value=conv[u][0](v);});
    if(k==='speed'||k==='text'){this.drawTimeline();this.drawTime();}
    this.sync();this.draw();});
  });
  const segs={align:'align',animIn:'animIn',animOut:'animOut'};
  for(const [attr,key] of Object.entries(segs))el.querySelectorAll(`[data-${attr}]`).forEach(b=>b.onclick=()=>{this.snapshot();c[key]=b.dataset[attr];this.save();this.drawProps();this.draw();});
  el.querySelectorAll('[data-flip]').forEach(b=>b.onclick=()=>{this.snapshot();c[b.dataset.flip]=!c[b.dataset.flip];this.save();this.drawProps();this.draw();});
  el.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{this.snapshot();setSpeed(Number(b.dataset.speed));this.after(true);});
  el.querySelectorAll('[data-ramp]').forEach(b=>b.onclick=()=>{const id=b.dataset.ramp;if(id==='custom')return;const r=ED_RAMPS.find(x=>x[0]===id);this.setRamp(c,r?r[2].map(x=>[...x]):null);if(r)c.rampName=id;else delete c.rampName;this.save();this.drawProps();});
  const cs=$('.ed-curve svg',el);if(cs)edCurveWire(cs,c);
  el.querySelectorAll('[data-kf]').forEach(b=>b.onclick=()=>{const k=b.dataset.kf;if(k==='x'){this.toggleKf(c,'x');this.toggleKf(c,'y');this.past.splice(-1,1);}else this.toggleKf(c,k);});
  el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{this.snapshot();const a=ED_FILTERS.find(f=>f[0]===b.dataset.filter)[2];if(Object.keys(a).length)c.adj={...a};else delete c.adj;this.after(true);});
  el.querySelectorAll('[data-reshape]').forEach(b=>b.onclick=()=>{this.snapshot();c.sticker={...c.sticker,shape:b.dataset.reshape};this.after(true);});
  el.querySelectorAll('[data-reemoji]').forEach(b=>b.onclick=()=>{this.snapshot();c.sticker={...c.sticker,emoji:b.dataset.reemoji};this.after(true);});
  el.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{this.snapshot();const r=b.dataset.reset;
   if(r==='transform'){Object.assign(c,{scale:1,x:0,y:0,rotate:0,flipH:false,flipV:false});if(c.kf){for(const k of ['scale','x','y','rotate'])delete c.kf[k];}}else if(r==='crop')delete c.crop;else if(r==='mask')delete c.mask;else if(r==='adjust')delete c.adj;else setSpeed(1);this.after(true);});
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
  el.querySelectorAll('[data-mask]').forEach(b=>b.onclick=()=>{this.snapshot();const v=b.dataset.mask;if(v==='none')delete c.mask;else c.mask={w:.8,h:.8,x:0,y:0,feather:0,...(c.mask||{}),shape:v};this.after(true);});
  el.querySelectorAll('[data-ease]').forEach(b=>b.onclick=()=>this.setKfEase(c,b.dataset.ease));
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
function edProjects(el){
 if(Ed.p)Ed.flush();
 const list=Ed.list().sort((a,b)=>String(b.updated).localeCompare(String(a.updated)));
 el.innerHTML=`<div class="no-head ed-projects">
  <header class="trash-bar"><h1>Editor${list.length?` <span>${list.length}</span>`:''}</h1>
   <span class="ed-proj-actions"><button type="button" class="btn small" data-import-project>${I.upload} Open project file</button>${list.length?`<button type="button" class="btn small primary" data-new>${I.add} New project</button>`:''}</span>
   <input type="file" accept=".zip,application/zip" data-project-file hidden></header>
  ${list.length?`<div class="ed-project-grid">${list.map(x=>`<article class="ed-project" data-open="${esc(x.id)}" tabindex="0" role="link" aria-label="Open ${esc(x.name)}">
    <div class="ed-project-thumb">${x.thumb?`<img src="${x.thumb}" alt="">`:`<span>${I.cut}</span>`}<span class="ed-project-ratio">${esc(x.ratio)}</span></div>
    <div class="ed-project-text"><b dir="auto">${esc(x.name)}</b><small>${x.clips?`${edFmt(x.dur).slice(0,5)} · `:''}${esc(edAgo(x.updated))}</small></div>
    <button type="button" class="iconbtn sm ed-project-more" data-more="${esc(x.id)}" aria-label="More for ${esc(x.name)}" aria-haspopup="menu">${I.more}</button></article>`).join('')}</div>`
   :`<div class="trash-empty"><span class="trash-empty-icon" aria-hidden="true">${I.cut}</span><h2>No projects yet</h2><button type="button" class="btn primary" data-new>${I.add} New project</button></div>`}
 </div>`;
 el.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>App.go('editor',Ed.create()));
 const pf=el.querySelector('[data-project-file]'),pb=el.querySelector('[data-import-project]');
 pb.onclick=()=>pf.click();
 pf.onchange=async()=>{const file=pf.files[0];pf.value='';if(!file)return;pb.disabled=true;pb.innerHTML='<span class="spin"></span> Opening…';
  try{const id=await Ed.importProjectFile(file);toast('Project opened');App.go('editor',id);}catch(e){toast(e.message,true);edProjects(el);}};
 el.querySelectorAll('[data-open]').forEach(c=>{const go=()=>App.go('editor',c.dataset.open);c.onclick=e=>{if(!e.target.closest('[data-more]'))go();};c.onkeydown=e=>{if(e.key==='Enter')go();};});
 el.querySelectorAll('[data-more]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.more,x=Ed.list().find(p=>p.id===id);if(!x)return;
  const pop=Pop.open(b,`<button class="pop-item" data-act="open">${I.cut}<span>Open</span></button><button class="pop-item" data-act="rename">${I.text}<span>Rename</span></button><button class="pop-item" data-act="dup">${I.copy}<span>Duplicate</span></button><button class="pop-item" data-act="file">${I.export}<span>Export project file</span></button><hr><button class="pop-item danger" data-act="del">${I.trash}<span>Delete</span></button>`,{align:'end',label:'Project'});
  if(!pop)return;
  pop.querySelector('[data-act=open]').onclick=()=>{Pop.close();App.go('editor',id);};
  pop.querySelector('[data-act=rename]').onclick=()=>{Pop.close();edRename(b,id);};
  pop.querySelector('[data-act=dup]').onclick=()=>{Pop.close();const p=Ed.readProject(id);if(p){const nid=Ed.create({...p,name:p.name+' copy'});const l=Ed.list(),e2=l.find(q=>q.id===nid);if(e2){e2.thumb=x.thumb;e2.dur=x.dur;e2.clips=x.clips;Ed.setList(l);}}edProjects(el);};
  pop.querySelector('[data-act=del]').onclick=async()=>{Pop.close();if(!await ask('Delete this project?','The edit is deleted. Your imported files stay in Media.','Delete',true,{file:{name:x.name}}))return;
   await Ed.deleteProject(id);edProjects(el);toast('Deleted');};
  pop.querySelector('[data-act=file]').onclick=()=>{Pop.close();edExportProject(id,x.name);};
 });
}
/** Saves a project and the media it uses as one .zip, to keep it safe or open it in another browser. */
async function edExportProject(id,name){
 toast('Packing the project…');
 try{edSaveFile(await Ed.packProject(id),(name||'Project')+'.zip');toast('Project file saved');}catch(e){toast(e.message,true);}
}
/** What the captions learned from your corrections: each fix, with how often you made it; remove one or all. */
async function edFixesDialog(){
 const r=await fetch(withKey('/api/editor/caption-fixes'));const j=await r.json().catch(()=>({fixes:[]}));const fx=j.fixes||[];
 dialog(`<div class="ed-keys ed-fixes"><h2>Learned from your corrections</h2>
  <p class="ed-xnote">When you change a caption, the changed words are remembered for that language and fixed in the next captions. Your corrected captions are also kept with their audio (${j.clips||0} so far) in <code>${esc(j.dataset||'')}</code>, to train a model on later. Nothing leaves this computer.</p>
  ${fx.length?`<table><thead><tr><th>Language</th><th>Heard</th><th>Written</th><th>Times</th><th></th></tr></thead><tbody>${fx.map((f,i)=>`<tr><td>${esc(edLangName(f.lang))}</td><td dir="auto">${esc(f.from)}</td><td dir="auto">${esc(f.to)}</td><td>${f.n}</td><td><button type="button" class="iconbtn sm" data-rm="${i}" aria-label="Forget">${I.x}</button></td></tr>`).join('')}</tbody></table>`:'<p>Nothing yet. Change a word in a caption made from speech and it is learned.</p>'}
  <div class="ed-xactions">${fx.length?'<button type="button" class="btn ghost danger-text" data-clear>Forget all</button>':''}<button type="button" class="btn primary" data-no>Done</button></div></div>`);
 const box=$('.ed-fixes');box.querySelector('[data-no]').onclick=()=>closeDialog();
 box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{const f=fx[Number(b.dataset.rm)];await fetch(withKey('/api/editor/caption-fixes/remove'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lang:f.lang,from:f.from})});closeDialog();await Ed.loadStt();Ed.drawLib();edFixesDialog();});
 const cl=box.querySelector('[data-clear]');if(cl)cl.onclick=async()=>{if(!await ask('Forget every learned fix?','The training clips stay.','Forget all',true))return;await fetch(withKey('/api/editor/caption-fixes/clear'),{method:'POST'});closeDialog();await Ed.loadStt();Ed.drawLib();};
}
function edRename(btn,id){
 const x=Ed.list().find(p=>p.id===id);if(!x)return;
 const el=Pop.open(btn,`<form class="refine-pop"><label class="field-label" for="ed-rn">Name</label><input id="ed-rn" maxlength="80" value="${esc(x.name)}" dir="auto"><div class="refine-actions"><button type="button" class="btn small ghost" data-cancel>Cancel</button><button class="btn small primary">Save</button></div></form>`,{role:'dialog',label:'Rename',align:'end',focus:false});
 if(!el)return;const i=$('#ed-rn',el);i.focus();i.select();$('[data-cancel]',el).onclick=()=>Pop.close(true);
 $('form',el).onsubmit=e=>{e.preventDefault();const name=i.value.trim()||'Untitled project';const p=Ed.readProject(id);if(p){p.name=name;Ed.writeProject(p);}if(Ed.p?.id===id)Ed.p.name=name;
  Ed.setList(Ed.list().map(q=>q.id===id?{...q,name}:q));Pop.close();edProjects($('#view'));};
}
/** Export: name, resolution, frame rate and format. MP4 is made by ffmpeg on this computer. */
function edExportDialog(){
 if(!Ed.p.clips.length)return toast('Add something to the timeline first.');
 const short=Math.min(...Ed.base()),res=[[720,'720p'],[1080,'1080p'],[1440,'2K'],[2160,'4K']];
 dialog(`<form class="ed-export-form"><h2>Export</h2>
  <label class="ed-xrow"><span>Name</span><input id="ex-name" value="${esc(Ed.p.name)}" maxlength="80" dir="auto"></label>
  <div class="ed-xrow"><span>Resolution</span><div class="ed-seg">${res.map(([h,l])=>`<button type="button" data-res="${h}" aria-pressed="${h===1080}">${l}</button>`).join('')}</div></div>
  <div class="ed-xrow"><span>Frame rate</span><div class="ed-seg">${[24,30,60].map(f=>`<button type="button" data-fps="${f}" aria-pressed="${f===30}">${f} fps</button>`).join('')}</div></div>
  <div class="ed-xrow"><span>Format</span><div class="ed-seg"><button type="button" data-fmt="mp4" aria-pressed="true">MP4</button><button type="button" data-fmt="webm" aria-pressed="false">WebM</button></div></div>
  ${Ed.rangeSpan()?`<div class="ed-xrow"><span>Range</span><div class="ed-seg"><button type="button" data-span="range" aria-pressed="true">In to out</button><button type="button" data-span="all" aria-pressed="false">Whole video</button></div></div>`:''}
  ${typeof VideoEncoder!=='undefined'?`<div class="ed-xrow"><span>Frames</span><div class="ed-seg"><button type="button" data-mode="exact" aria-pressed="true">Exact</button><button type="button" data-mode="live" aria-pressed="false">Real time</button></div></div>`:''}
  <label class="ed-xrow ed-xcheck"><span>Studio</span><span class="ed-xopt"><input type="checkbox" role="switch" id="ex-studio" checked> Also save it to Studio</span></label>
  <p class="ed-xnote" id="ex-note"></p>
  <div class="ed-xactions"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn primary" type="submit">${I.down} Export</button></div></form>`);
 const f=$('.ed-export-form'),st={res:1080,fps:30,fmt:'mp4',mode:typeof VideoEncoder!=='undefined'?'exact':'live',span:Ed.rangeSpan()?'range':'all'};
 const note=()=>{const [w,h]=Ed.base(),k=st.res/short,sp=st.span==='range'&&Ed.rangeSpan();$('#ex-note').textContent=`${Math.round(w*k/2)*2} × ${Math.round(h*k/2)*2} · ${edFmt(sp?sp.e-sp.s:Ed.end()).slice(0,5)} · ${st.mode==='exact'?'every frame is drawn exactly; footage with few keyframes can take longer than the video.':'it plays through once while it records; a busy computer can skip frames.'}`;};note();
 f.querySelectorAll('[data-res],[data-fps],[data-fmt],[data-mode],[data-span]').forEach(b=>b.onclick=()=>{const key=b.dataset.res?'res':b.dataset.fps?'fps':b.dataset.fmt?'fmt':b.dataset.mode?'mode':'span';st[key]=key==='res'||key==='fps'?Number(b.dataset[key]):b.dataset[key];
  b.parentElement.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));note();});
 f.querySelector('[data-no]').onclick=()=>closeDialog();
 f.onsubmit=e=>{e.preventDefault();const name=$('#ex-name').value.trim()||Ed.p.name,studio=$('#ex-studio').checked;closeDialog(true);Ed.exportVideo({name,height:st.res,fps:st.fps,format:st.fmt,studio,live:st.mode==='live',range:st.span==='range'?Ed.rangeSpan():null});};
}
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
   <header class="ed-ph"><span>Player</span><span class="ed-ratio">${esc(p.ratio)}</span></header>
   <div class="ed-stage"><div class="ed-frame"><canvas aria-label="Preview"></canvas><div class="ed-guides" aria-hidden="true"><i class="g-top"></i><i class="g-right"></i><i class="g-bottom"></i></div></div>
    <div class="ed-export" hidden><span class="spin"></span><b>Recording…</b><span>Keep this tab open.</span><button type="button" class="btn small" data-cancel-export>Cancel</button></div></div>
   <div class="ed-controls"><span class="ed-time"></span><button type="button" class="ed-play" data-play></button>
    <span class="ed-ctl-right"><canvas class="ed-meter" width="72" height="14" role="img" aria-label="Sound level"></canvas><button type="button" class="iconbtn sm" data-frame aria-label="Save frame" data-tooltip="Save this frame as a picture · Shift+E">${I.image}</button><button type="button" class="iconbtn sm" data-guides aria-pressed="${Ed.guides}" aria-label="Safe areas" data-tooltip="Safe areas for TikTok and Reels">${I.safe}</button><button type="button" class="iconbtn sm" data-full aria-label="Full screen" data-tooltip="Full screen">${I.expand}</button></span></div>
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
 Object.assign(Ed.dom,{saved:q('.ed-saved'),root:R,lib:q('.ed-lib'),props:q('.ed-props'),canvas:q('canvas'),stage:q('.ed-stage'),frame:q('.ed-frame'),time:q('.ed-time'),play:q('[data-play]'),
  tracks:q('.ed-lanes'),heads:q('.ed-heads'),ruler:q('.ed-ruler'),inner:q('.ed-inner'),scroll:q('.ed-scroll'),head:q('.ed-playhead'),marquee:q('.ed-marquee'),file:q('input[type=file]'),exportOverlay:q('.ed-export'),meter:q('.ed-meter')});
 Ed.dom.file.onchange=()=>{Ed.importFiles(Ed.dom.file.files);Ed.dom.file.value='';};
 const name=q('.ed-name');name.oninput=()=>{Ed.p.name=name.value||'Untitled project';Ed.save();document.title=`${Ed.p.name} · Tempoloom`;};
 q('[data-export]').onclick=()=>edExportDialog();q('[data-cancel-export]').onclick=()=>Ed.cancelExport();
 q('[data-play]').onclick=()=>Ed.play();
 q('[data-undo]').onclick=()=>Ed.undo();q('[data-redo]').onclick=()=>Ed.redo();q('[data-split]').onclick=()=>Ed.split();q('[data-dup]').onclick=()=>Ed.duplicate();q('[data-del]').onclick=()=>Ed.remove();
 R.querySelectorAll('[data-trim]').forEach(b=>b.onclick=()=>Ed.trimTo(b.dataset.trim));q('[data-freeze]').onclick=()=>Ed.freeze();
 q('[data-marker]').onclick=()=>Ed.toggleMarker();q('[data-voice-tl]').onclick=()=>{Ed.tab='audio';Ed.recordVoice();};
 q('[data-snap]').onclick=e=>{Ed.snap=!Ed.snap;e.currentTarget.setAttribute('aria-pressed',String(Ed.snap));};
 q('[data-magnet]').onclick=()=>{Ed.snapshot();Ed.p.magnet=!Ed.p.magnet;Ed.after(false);toast(Ed.p.magnet?'Main track magnet on: no gaps':'Main track magnet off');};
 q('[data-track-add]').onclick=e=>{const b=e.currentTarget,pop=Pop.open(b,Object.entries(ED_KINDS).map(([k,v])=>`<button class="pop-item" data-k="${k}">${I[v.icon]}<span>${k==='video'?'Overlay video track':v.label+' track'}</span></button>`).join(''),{label:'Add a track'});
  if(pop)pop.querySelectorAll('[data-k]').forEach(x=>x.onclick=()=>{Pop.close();Ed.snapshot();Ed.addTrack(x.dataset.k);Ed.drawTimeline();});};
 q('[data-frame]').onclick=()=>Ed.saveFrame();
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
 const timeAt=x=>Math.max(0,(x-inner.getBoundingClientRect().left)/Ed.zoom);
 const laneAt=y=>[...Ed.dom.tracks.children].find(l=>{const r=l.getBoundingClientRect();return y>=r.top&&y<r.bottom;});
 sc.onpointerdown=e=>{
  if(e.button!==0||e.target.closest('[data-join]'))return;
  const clip=e.target.closest('.ed-clip');
  if(!clip){
   if(e.target.closest('.ed-ruler')){Ed.seek(timeAt(e.clientX));sc.setPointerCapture(e.pointerId);const mv=ev=>Ed.seek(timeAt(ev.clientX)),up=()=>{sc.removeEventListener('pointermove',mv);sc.removeEventListener('pointerup',up);};sc.addEventListener('pointermove',mv);sc.addEventListener('pointerup',up);return;}
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
  if(e.shiftKey||e.ctrlKey||e.metaKey){Ed.select(c.id,true);Ed.solo=false;return;}
  if(!Ed.sels.has(c.id)||(e.altKey&&Ed.sels.size>1))Ed.select(c.id);else{Ed.sel=c.id;Ed.drawProps();}Ed.solo=false;
  if(e.target.dataset.fh){const key=e.target.dataset.fh==='in'?'fadeIn':'fadeOut',left=clip.getBoundingClientRect().left;let snapped=false;
   const mv=ev=>{if(!snapped){Ed.snapshot();snapped=true;}const x=(ev.clientX-left)/Ed.zoom;c[key]=Math.round(edClamp(key==='fadeIn'?x:c.dur-x,0,Math.min(5,c.dur/2))*10)/10;Ed.drawTimeline();Ed.sync();Ed.draw();};
   const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);if(snapped)Ed.after(true);};
   window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);return;}
  const mode=e.target.dataset.h||'move',x0=e.clientX,group=mode==='move'&&Ed.sels.size>1?Ed.picked():[c],orig=new Map(group.map(g=>[g.id,{...g}])),o=orig.get(c.id),m=Ed.mediaOf(c),srcDur=m&&m.type!=='image'&&!c.sticker?m.dur:Infinity,kind=Ed.kindOf(c);
  const ids=new Set(group.map(g=>g.id)),edges=Ed.p.clips.filter(x=>!ids.has(x.id)).flatMap(x=>[x.start,x.start+x.dur]).concat([0,Ed.time,...Ed.p.markers]);
  const snapT=t=>{if(!Ed.snap)return t;const tol=8/Ed.zoom;let best=t,d=tol;for(const s of edges){if(Math.abs(s-t)<d){d=Math.abs(s-t);best=s;}}return best;};
  let moved=false,newLane=null;
  const mv=ev=>{
   const dt=(ev.clientX-x0)/Ed.zoom;if(!moved&&Math.abs(ev.clientX-x0)<3&&Math.abs(ev.clientY-e.clientY)<3)return;if(!moved){Ed.snapshot();moved=true;}
   if(mode==='move'){
    const min=Math.min(...group.map(g=>orig.get(g.id).start));let d=Math.max(-min,dt);
    const s=o.start+d,a=snapT(s)-s,b=snapT(s+o.dur)-(s+o.dur);d+=Math.abs(a)<=Math.abs(b)?a:b;d=Math.max(-min,d);
    for(const g of group)g.start=orig.get(g.id).start+d;
    if(group.length===1){const lane=laneAt(ev.clientY);Ed.dom.tracks.querySelectorAll('.ed-lane-new').forEach(n=>n.classList.remove('on'));newLane=null;
     if(lane?.classList.contains('ed-lane-new')){lane.classList.add('on');newLane=lane.dataset.new;}
     else if(lane&&lane.dataset.kind===kind&&!lane.classList.contains('locked')&&lane.dataset.track!==c.track){c.track=lane.dataset.track;const node=Ed.dom.tracks.querySelector(`[data-cid="${c.id}"]`);if(node)lane.append(node);}}
   }
   else if(mode==='l'){let s=snapT(o.start+dt);const sp=o.speed||1;if(c.media)s=Math.max(s,o.ramp?o.start:o.start-(o.in||0)/sp);s=Math.max(0,Math.min(s,o.start+o.dur-.1));const d=s-o.start;c.start=s;c.dur=o.dur-d;
    if(o.ramp){c.in=Ed.srcAt(o,s);c.ramp=d>.001?edRampSplit(o.ramp,d/o.dur)[1]:o.ramp;}else if(c.media)c.in=(o.in||0)+d*sp;
    if(c.kf)for(const f of Object.values(c.kf))for(const x of f)x.t=Math.max(0,x.t-(d-(c._kfd||0)));c._kfd=d;}
   else{let e2=snapT(o.start+o.dur+dt);const sp=o.speed||1;e2=Math.min(e2,o.ramp?o.start+o.dur:o.start+(srcDur-(o.in||0))/sp);c.dur=Math.max(.1,e2-o.start);if(o.ramp)c.ramp=c.dur<o.dur-.001?edRampSplit(o.ramp,c.dur/o.dur)[0]:o.ramp;}
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
function edWirePreview(){
 const cv=Ed.dom.canvas;
 cv.onpointerdown=e=>{
  if(Ed.picking){const c=Ed.clip(Ed.picking);const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),px=Math.floor((e.clientX-r.left)*W/r.width),py=Math.floor((e.clientY-r.top)*H/r.height);
   Ed.draw();const d=cv.getContext('2d').getImageData(px,py,1,1).data,hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
   Ed.picking=null;Ed.dom.frame?.classList.remove('picking');if(c){Ed.snapshot();c.key={sim:25,smooth:10,spill:50,...(c.key||{}),on:true,color:hex};Ed.after(true);toast('Colour picked: '+hex);}return;}
  const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),sx=W/r.width,sy=H/r.height,px=(e.clientX-r.left)*sx,py=(e.clientY-r.top)*sy,g=cv.getContext('2d');
  const hit=[...Ed.visible(Ed.time)].reverse().find(c=>{if(Ed.trackOf(c)?.locked)return false;const b=Ed.box(g,c,W,H);return Math.abs(px-b.cx)<=b.w/2&&Math.abs(py-b.cy)<=b.h/2;});
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
 if(k===' '&&!mod)Ed.play();
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
 else done=false;
 if(done){e.preventDefault();e.stopPropagation();}
},true);

// ---------- right-click menus ----------
/** A menu at the pointer: [label, icon, action, disabled, danger] rows, or '-' for a line. */
function edMenu(x,y,items){
 Pop.close?.(true);const a=document.createElement('span');a.className='ed-menu-anchor';a.style.left=x+'px';a.style.top=y+'px';document.body.append(a);
 const pop=Pop.open(a,items.map(it=>it==='-'?'<hr>':`<button type="button" class="pop-item${it[4]?' danger':''}" ${it[3]?'disabled':''}>${I[it[1]]||''}<span>${it[0]}</span>${it[5]?`<kbd>${it[5]}</kbd>`:''}</button>`).join(''),{label:'Clip',align:'start'});
 const gone=()=>{if(!document.body.contains(pop||a))return;};if(!pop){a.remove();return;}
 const rows=items.filter(it=>it!=='-');pop.querySelectorAll('.pop-item').forEach((b,i)=>b.onclick=()=>{Pop.close(true);a.remove();rows[i][2]();});
 const mo=new MutationObserver(()=>{if(!pop.isConnected){a.remove();mo.disconnect();}});mo.observe(document.body,{childList:true,subtree:true});gone();
}
function edClipMenu(x,y,c){
 const m=Ed.mediaOf(c),many=Ed.sels.size>1,video=m?.type==='video'&&!c.asAudio,visual=Ed.kindOf(c)!=='audio';
 edMenu(x,y,[['Split at playhead','split',()=>Ed.split(),false,false,'Ctrl+B'],['Copy','copy',()=>Ed.copy(),false,false,'Ctrl+C'],['Cut','cut',()=>Ed.copy(true),false,false,'Ctrl+X'],
  [`Paste${Ed.clipboard?.length?` (${Ed.clipboard.length})`:''}`,'copy',()=>Ed.paste(),!Ed.clipboard?.length,false,'Ctrl+V'],['Duplicate','layers',()=>Ed.duplicate(),false,false,'Ctrl+D'],
  ...(many?[['Group','link',()=>Ed.group(),false,false,'Ctrl+G']]:[]),...(Ed.picked().some(x=>x.group)?[['Ungroup','link',()=>Ed.ungroup(),false,false,'Ctrl+Shift+G']]:[]),'-',
  ...(video&&!many?[[c.detached?'Audio is detached':'Detach audio','detach',()=>Ed.detach(c),!!c.detached]]:[]),
  ...(!many&&c.media&&m?.type!=='image'?[['Speed 0.5×','sliders',()=>edSpeed(c,.5)],['Speed 1×','sliders',()=>edSpeed(c,1)],['Speed 2×','sliders',()=>edSpeed(c,2)]]:[]),
  ...(!many&&video?[['Freeze frame','freeze',()=>{Ed.seek(edClamp(Ed.time,c.start,c.start+c.dur-.04));Ed.freeze();},false,false,'Shift+F']]:[]),
  ...(!many&&c.media?[['Replace with…','refresh',()=>edReplace(x,y,c)]]:[]),
  ...(!many&&visual?[['Reset position and size','refresh',()=>{Ed.snapshot();Object.assign(c,{scale:1,x:0,y:0,rotate:0,flipH:false,flipV:false});if(c.kf)for(const k of ['scale','x','y','rotate'])delete c.kf[k];Ed.after(true);}]]:[]),
  '-',['Ripple delete','trash',()=>Ed.rippleRemove(),false,false,'Shift+Del'],[many?`Delete ${Ed.sels.size} clips`:'Delete','trash',()=>Ed.remove(),false,true,'Del']]);
}
/** Replace: pick other media of the same kind from Media, or import a file for it. */
function edReplace(x,y,c){
 const audio=Ed.kindOf(c)==='audio',ok=m=>m.id!==c.media&&(audio?(m.type==='audio'||m.type==='video'):(m.type==='video'||m.type==='image')),list=Ed.media.filter(ok).slice(0,12);
 const pick=()=>{const inp=document.createElement('input');inp.type='file';inp.accept=audio?'audio/*,video/*':'video/*,image/*';
  inp.onchange=async()=>{const [m]=await Ed.importFiles(inp.files);if(m)Ed.replaceClip(Ed.clip(c.id),m.id);};inp.click();};
 setTimeout(()=>edMenu(x,y,[...list.map(m=>[esc(m.name),m.type==='image'?'image':m.type==='audio'?'music':'film',()=>Ed.replaceClip(Ed.clip(c.id),m.id)]),...(list.length?['-']:[]),['Import a file…','upload',pick]]),0);
}
// ---------- the speed curve editor: position across, speed up and down (0.1x to 10x, log scale) ----------
const ED_CW=260,ED_CH=120,edCy=v=>6+(1-(Math.log10(v)+1)/2)*(ED_CH-12),edCv=y=>Math.pow(10,(1-(y-6)/(ED_CH-12))*2-1);
function edCurveSvg(r){
 const grid=[.25,.5,1,2,4,8].map(v=>`<line x1="0" x2="${ED_CW}" y1="${edCy(v)}" y2="${edCy(v)}" class="${v===1?'one':''}"/><text x="3" y="${edCy(v)-2}">${v}×</text>`).join('');
 const pts=r.map(([p,v])=>`${p*ED_CW},${edCy(v)}`).join(' ');
 return `<svg viewBox="0 0 ${ED_CW} ${ED_CH}" class="ed-curve-svg" role="img" aria-label="Speed curve">${grid}<polyline points="${pts}"/>${r.map(([p,v],i)=>`<circle data-pt="${i}" cx="${p*ED_CW}" cy="${edCy(v)}" r="5"><title>${v.toFixed(2)}×</title></circle>`).join('')}</svg>`;
}
function edCurveWire(svg,c){
 const at=e=>{const b=svg.getBoundingClientRect();return [edClamp((e.clientX-b.left)/b.width,0,1),edClamp(edCv((e.clientY-b.top)/b.height*ED_CH),.1,10)];};
 const redraw=()=>{svg.outerHTML=edCurveSvg(c.ramp);const n=Ed.dom.props?.querySelector('.ed-curve svg');if(n)edCurveWire(n,c);Ed.drawTimeline();Ed.sync();Ed.draw();};
 svg.onpointerdown=e=>{e.preventDefault();const pt=e.target.closest('[data-pt]');Ed.snapshot();
  let i=pt?Number(pt.dataset.pt):-1;const pts=c.ramp.map(x=>[...x]);
  if(i<0){const [p,v]=at(e);i=pts.findIndex(x=>x[0]>p);if(i<=0)return;pts.splice(i,0,[p,v]);}
  c.rampName='custom';
  const mv=ev=>{const [p,v]=at(ev);const lo=i>0?pts[i-1][0]+.02:0,hi=i<pts.length-1?pts[i+1][0]-.02:1;pts[i]=[i===0?0:i===pts.length-1?1:edClamp(p,lo,hi),Math.round(v*100)/100];Ed.setRamp(c,pts,true);redraw();};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);Ed.setRamp(c,pts,true);Ed.after(true);};
  if(!pt){Ed.setRamp(c,pts,true);redraw();}
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);};
 svg.ondblclick=e=>{const pt=e.target.closest('[data-pt]');if(!pt)return;const i=Number(pt.dataset.pt);if(i===0||i===c.ramp.length-1)return;
  const pts=c.ramp.filter((_,j)=>j!==i);c.rampName='custom';Ed.setRamp(c,pts);};
}
function edSpeed(c,v){Ed.snapshot();const m=Ed.mediaOf(c),max=m?.dur?((m.dur-(c.in||0))/(v*(c.ramp?edRampAvg(c.ramp):1))):Infinity;c.dur=Math.max(.1,Math.min(c.dur*(c.speed||1)/v,max));c.speed=v;Ed.after(true);}
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
// ---------- the shortcuts sheet ----------
function edKeys(){
 const rows=[['Space','Play or pause'],['Ctrl+B or S','Split at the playhead'],['Delete','Delete the selection'],['Ctrl+G / Ctrl+Shift+G','Group / ungroup'],['Alt + click','One clip of a group'],['Shift+E','Save the frame as a picture'],['Shift+Delete','Ripple delete: close the space'],['Q / W','Delete left / right of the playhead'],['J / K / L','Play back, stop, play forward (again: faster)'],['I / O','Mark in / out'],['Shift+I / Shift+O','Go to in / out'],['Alt+X','Clear in and out'],['Shift+F','Freeze frame'],['Ctrl+Z / Ctrl+Shift+Z','Undo / redo'],['Ctrl+C / X / V','Copy, cut, paste at the playhead'],['Ctrl+D','Duplicate'],['Ctrl+A','Select every clip'],
  ['Shift or Ctrl + click','Add a clip to the selection'],['Drag on empty space','Select with a box'],['M','Add or remove a marker'],['← / →','One frame back / forward'],['Shift + ← / →','One second back / forward'],['Home / End','Start / end'],['Ctrl + wheel','Zoom the timeline'],['Right-click','Clip menu'],['Esc','Clear the selection'],['?','This sheet']];
 dialog(`<div class="ed-keys"><h2>Keyboard shortcuts</h2><dl>${rows.map(([k,d])=>`<dt>${k.split(' / ').map(x=>`<kbd>${esc(x)}</kbd>`).join(' / ')}</dt><dd>${esc(d)}</dd>`).join('')}</dl><div class="ed-xactions"><button type="button" class="btn primary" data-no>Done</button></div></div>`);
 $('.ed-keys [data-no]').onclick=()=>closeDialog();
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
