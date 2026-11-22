'use strict';
// Editor, dialogs and menus: the projects screen, export (presets), project files, right-click menus, paste attributes, markers, the mixer, the source monitor, the shortcuts sheet.
// Loaded after editor-ui.js (see index.html).
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
async function edExportProject(id,name){
 toast('Packing the project…');
 try{edSaveFile(await Ed.packProject(id),(name||'Project')+'.zip');toast('Project file saved');}catch(e){toast(e.message,true);}
}
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
const ED_PRESETS=[['custom','Custom',null],['social','TikTok · Reels · Shorts',{ratio:'9:16',res:1080,fps:30,fmt:'mp4',quality:'high'}],['youtube','YouTube 1080p',{ratio:'16:9',res:1080,fps:30,fmt:'mp4',quality:'high'}],
 ['youtube4k','YouTube 4K',{ratio:'16:9',res:2160,fps:30,fmt:'mp4',quality:'best'}],['insta','Instagram post (4:5)',{ratio:'4:5',res:1080,fps:30,fmt:'mp4',quality:'high'}],['square','Square post (1:1)',{ratio:'1:1',res:1080,fps:30,fmt:'mp4',quality:'high'}],
 ['gif','GIF (loop, no sound)',{res:480,fps:15,fmt:'gif',quality:'high'}],['sound','Sound only (MP3)',{fmt:'mp3'}]];
function edExportDialog(){
 if(!Ed.p.clips.length)return toast('Add something to the timeline first.');
 const short=Math.min(...Ed.base()),res=[[480,'480p'],[720,'720p'],[1080,'1080p'],[1440,'2K'],[2160,'4K']],wc=typeof VideoEncoder!=='undefined';
 const seg=(attr,list,val)=>`<div class="ed-seg" data-seg="${attr}">${list.map(([v,l])=>`<button type="button" data-${attr}="${v}" aria-pressed="${val===v}">${l}</button>`).join('')}</div>`;
 dialog(`<form class="ed-export-form"><h2>Export</h2>
  <label class="ed-xrow"><span>Name</span><input id="ex-name" value="${esc(Ed.p.name)}" maxlength="80" dir="auto"></label>
  <label class="ed-xrow"><span>Preset</span><select id="ex-preset">${ED_PRESETS.map(([id,l])=>`<option value="${id}">${l}</option>`).join('')}</select></label>
  <div class="ed-xrow" data-row="fmt"><span>Format</span>${seg('fmt',[['mp4','MP4'],['webm','WebM'],['gif','GIF'],['mp3','MP3'],['wav','WAV']],'mp4')}</div>
  <div class="ed-xrow" data-row="res"><span>Resolution</span>${seg('res',res,1080)}</div>
  <div class="ed-xrow" data-row="fps"><span>Frame rate</span>${seg('fps',[[15,'15'],[24,'24'],[30,'30'],[60,'60']],30)}</div>
  <div class="ed-xrow" data-row="quality"><span>Quality</span>${seg('quality',[['standard','Smaller file'],['high','High'],['best','Best']],'high')}</div>
  ${Ed.rangeSpan()?`<div class="ed-xrow"><span>Range</span>${seg('span',[['range','In to out'],['all','Whole video']],'range')}</div>`:''}
  ${wc?`<div class="ed-xrow" data-row="mode"><span>Frames</span>${seg('mode',[['exact','Exact'],['live','Real time']],'exact')}</div>`:''}
  <label class="ed-xrow ed-xcheck" data-row="studio"><span>Studio</span><span class="ed-xopt"><input type="checkbox" role="switch" id="ex-studio" checked> Also save it to Studio</span></label>
  <p class="ed-xnote" id="ex-warn" hidden></p><p class="ed-xnote" id="ex-note"></p>
  <div class="ed-xactions"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn primary" type="submit">${I.down} Export</button></div></form>`);
 const f=$('.ed-export-form'),st={preset:'custom',res:1080,fps:30,fmt:'mp4',quality:'high',mode:wc?'exact':'live',span:Ed.rangeSpan()?'range':'all',ratio:null};
 const press=()=>f.querySelectorAll('[data-seg]').forEach(g=>{const k=g.dataset.seg;g.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(String(st[k])===b.dataset[k])));});
 const sync=()=>{const sound=st.fmt==='mp3'||st.fmt==='wav',gif=st.fmt==='gif';
  for(const r of ['res','fps','quality','mode','studio'])f.querySelector(`[data-row="${r}"]`)?.toggleAttribute('hidden',sound||(gif&&(r==='mode'||r==='studio')));
  if(gif){st.fps=Math.min(st.fps,15);st.res=Math.min(st.res,480);st.mode='exact';}press();
  const [w,h]=Ed.base(),k=st.res/short,sp=st.span==='range'&&Ed.rangeSpan(),len=edFmt(sp?sp.e-sp.s:Ed.end()).slice(0,5);
  $('#ex-note').textContent=sound?`Sound only · ${len} · the same mix you hear, with volumes, fades and ducking.`:`${Math.round(w*k/2)*2} × ${Math.round(h*k/2)*2} · ${st.fps} fps · ${len} · ${gif?'loops, no sound; at most 15 fps and 480p to keep it small.':st.mode==='exact'?'every frame is drawn exactly; footage with few keyframes can take longer than the video.':'it plays through once while it records; a busy computer can skip frames.'}`;
  const warn=$('#ex-warn');warn.hidden=!(st.ratio&&st.ratio!==Ed.p.ratio);if(!warn.hidden)warn.textContent=`This preset is ${st.ratio}; your video is ${Ed.p.ratio}. Change it under Details → Shape, or export anyway.`;};
 f.querySelectorAll('[data-seg] button').forEach(b=>b.onclick=()=>{const k=b.closest('[data-seg]').dataset.seg,v=b.dataset[k];st[k]=k==='res'||k==='fps'?Number(v):v;st.preset='custom';st.ratio=null;$('#ex-preset').value='custom';sync();});
 $('#ex-preset').onchange=e=>{const p=ED_PRESETS.find(x=>x[0]===e.target.value);st.preset=p[0];st.ratio=p[2]?.ratio||null;if(p[2])Object.assign(st,{res:p[2].res??st.res,fps:p[2].fps??st.fps,fmt:p[2].fmt??st.fmt,quality:p[2].quality??st.quality});sync();};
 sync();
 f.querySelector('[data-no]').onclick=()=>closeDialog();
 f.onsubmit=e=>{e.preventDefault();const name=$('#ex-name').value.trim()||Ed.p.name,studio=$('#ex-studio').checked&&!['mp3','wav','gif'].includes(st.fmt);closeDialog(true);
  Ed.exportVideo({name,height:st.res,fps:st.fps,format:st.fmt,quality:st.quality,studio,live:st.mode==='live',range:st.span==='range'?Ed.rangeSpan():null});};
}
// ---------- right-click menus ----------
function edMenu(x,y,items){
 Pop.close?.(true);const a=document.createElement('span');a.className='ed-menu-anchor';a.style.left=x+'px';a.style.top=y+'px';document.body.append(a);
 const pop=Pop.open(a,items.map(it=>it==='-'?'<hr>':`<button type="button" class="pop-item${it[4]?' danger':''}" ${it[3]?'disabled':''}>${I[it[1]]||''}<span>${it[0]}</span>${it[5]?`<kbd>${it[5]}</kbd>`:''}</button>`).join(''),{label:'Clip',align:'start'});
 const gone=()=>{if(!document.body.contains(pop||a))return;};if(!pop){a.remove();return;}
 const rows=items.filter(it=>it!=='-');pop.querySelectorAll('.pop-item').forEach((b,i)=>b.onclick=()=>{Pop.close(true);a.remove();rows[i][2]();});
 const mo=new MutationObserver(()=>{if(!pop.isConnected){a.remove();mo.disconnect();}});mo.observe(document.body,{childList:true,subtree:true});gone();
}
function edClipMenu(x,y,c){
 const m=Ed.mediaOf(c),many=Ed.sels.size>1,video=m?.type==='video'&&!c.asAudio,visual=Ed.kindOf(c)!=='audio';
 edMenu(x,y,[['Split at playhead','split',()=>Ed.split(),false,false,'Ctrl+B'],['Copy','copy',()=>Ed.copy(),false,false,'Ctrl+C'],['Cut','cut',()=>Ed.copy(true),false,false,'Ctrl+X'],['Paste attributes…','sliders',()=>edPasteAttrs(),!Ed.clipboard?.length,false,'Ctrl+Alt+V'],
  [`Paste${Ed.clipboard?.length?` (${Ed.clipboard.length})`:''}`,'copy',()=>Ed.paste(),!Ed.clipboard?.length,false,'Ctrl+V'],['Duplicate','layers',()=>Ed.duplicate(),false,false,'Ctrl+D'],
  ...(!many?[['Swap with previous','undo',()=>{Ed.select(c.id);Ed.swap(-1);},false,false,'Ctrl+Alt+←'],['Swap with next','redo',()=>{Ed.select(c.id);Ed.swap(1);},false,false,'Ctrl+Alt+→']]:[]),
  ...(many?[['Group','link',()=>Ed.group(),false,false,'Ctrl+G']]:[]),...(Ed.picked().some(x=>x.group)?[['Ungroup','link',()=>Ed.ungroup(),false,false,'Ctrl+Shift+G']]:[]),'-',
  ...(video&&!many?[[c.detached?'Audio is detached':'Detach audio','detach',()=>Ed.detach(c),!!c.detached]]:[]),
  ...(!many&&c.media&&m?.type!=='image'?[['Speed 0.5×','sliders',()=>edSpeed(c,.5)],['Speed 1×','sliders',()=>edSpeed(c,1)],['Speed 2×','sliders',()=>edSpeed(c,2)]]:[]),
  ...(!many&&video?[['Freeze frame','freeze',()=>{Ed.seek(edClamp(Ed.time,c.start,c.start+c.dur-.04));Ed.freeze();},false,false,'Shift+F']]:[]),
  ...(!many&&video?[['Reverse','undo',()=>Ed.reverseClip(c)],['Stabilise','wand',()=>Ed.runTool(c,'stabilize')],['Auto reframe','crop',()=>Ed.runTool(c,'reframe')]]:[]),
  ...(!many&&c.media&&m?.type!=='audio'&&!c.asAudio?[['Remove background','image',()=>Ed.runTool(c,'cutout')]]:[]),
  ['Label colour…','flag',()=>setTimeout(()=>edMenu(x,y,[...ED_LABELS.map(([v,l])=>[`<i class="ed-swatch" style="background:${edLabel(v)}"></i>${l}`,'',()=>{Ed.snapshot();for(const k of Ed.picked())k.label=v;Ed.after(true);}]),['None','x',()=>{Ed.snapshot();for(const k of Ed.picked())delete k.label;Ed.after(true);}]]),0)],
  ...(!many&&c.media?[['Replace with…','refresh',()=>edReplace(x,y,c)]]:[]),
  ...(!many&&visual?[['Reset position and size','refresh',()=>{Ed.snapshot();Object.assign(c,{scale:1,x:0,y:0,rotate:0,flipH:false,flipV:false});if(c.kf)for(const k of ['scale','x','y','rotate'])delete c.kf[k];Ed.after(true);}]]:[]),
  '-',['Ripple delete','trash',()=>Ed.rippleRemove(),false,false,'Shift+Del'],[many?`Delete ${Ed.sels.size} clips`:'Delete','trash',()=>Ed.remove(),false,true,'Del']]);
}
function edReplace(x,y,c){
 const audio=Ed.kindOf(c)==='audio',ok=m=>m.id!==c.media&&(audio?(m.type==='audio'||m.type==='video'):(m.type==='video'||m.type==='image')),list=Ed.media.filter(ok).slice(0,12);
 const pick=()=>{const inp=document.createElement('input');inp.type='file';inp.accept=audio?'audio/*,video/*':'video/*,image/*';
  inp.onchange=async()=>{const [m]=await Ed.importFiles(inp.files);if(m)Ed.replaceClip(Ed.clip(c.id),m.id);};inp.click();};
 setTimeout(()=>edMenu(x,y,[...list.map(m=>[esc(m.name),m.type==='image'?'image':m.type==='audio'?'music':'film',()=>Ed.replaceClip(Ed.clip(c.id),m.id)]),...(list.length?['-']:[]),['Import a file…','upload',pick]]),0);
}
function edPasteAttrs(){
 const src=Ed.clipboard?.[0];if(!src)return toast('Copy a clip first (Ctrl+C).');if(!Ed.picked().length)return toast('Select the clips to paste onto.');
 const groups=[['transform','Position, size, rotation, crop',src.scale!==undefined],['opacity','Opacity and blend',true],['colour','Colour (adjustments, grade, look)',!!(src.adj||src.grade)],['effects','Green screen and mask',!!(src.key||src.mask)],
  ['speed','Speed and speed curve',!!src.media],['audio','Volume, loudness, ducking, fades',!!src.media],['keyframes','Keyframes',!!src.kf],['text','Text style and caption look',src.text!==undefined]];
 dialog(`<form class="ed-export-form ed-paste"><h2>Paste attributes</h2><p class="ed-xnote">From the copied clip onto ${Ed.picked().length} selected clip${Ed.picked().length>1?'s':''}.</p>
  ${groups.map(([id,l,on])=>`<label class="ed-xrow ed-xcheck"><span></span><span class="ed-xopt"><input type="checkbox" data-g="${id}" ${on&&id!=='keyframes'?'checked':''} ${on?'':'disabled'}> ${l}</span></label>`).join('')}
  <div class="ed-xactions"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn primary">Paste</button></div></form>`);
 const f=$('.ed-paste');f.querySelector('[data-no]').onclick=()=>closeDialog();
 f.onsubmit=e=>{e.preventDefault();const g={};f.querySelectorAll('[data-g]').forEach(x=>{g[x.dataset.g]=x.checked;});closeDialog(true);Ed.pasteAttributes(g);};
}
function edMarkerEdit(anchor,i){const m=Ed.p.markers[i];if(!m)return;const mk=typeof m==='number'?{t:m}:m;
 const el=Pop.open(anchor,`<form class="refine-pop ed-mk-pop"><label class="field-label" for="ed-mkn">Marker at ${edFmt(mk.t)}</label><input id="ed-mkn" maxlength="60" value="${esc(mk.name||'')}" placeholder="Name" dir="auto">
  <textarea id="ed-mkt" rows="2" maxlength="300" placeholder="Note" dir="auto">${esc(mk.note||'')}</textarea><div class="ed-mk-colors">${ED_LABELS.map(([v,l])=>`<button type="button" class="ed-swatch big" data-mc="${v}" style="background:${edLabel(v)}" aria-label="${l}" aria-pressed="${mk.color===v}"></button>`).join('')}</div>
  <div class="refine-actions"><button type="button" class="btn small ghost danger-text" data-del>Delete</button><button type="button" class="btn small ghost" data-cancel>Cancel</button><button class="btn small primary">Save</button></div></form>`,{role:'dialog',label:'Marker',focus:false});
 if(!el)return;let color=mk.color;$('#ed-mkn',el).focus();
 el.querySelectorAll('[data-mc]').forEach(b=>b.onclick=()=>{color=color===b.dataset.mc?undefined:b.dataset.mc;el.querySelectorAll('[data-mc]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mc===color)));});
 $('[data-cancel]',el).onclick=()=>Pop.close(true);$('[data-del]',el).onclick=()=>{Pop.close(true);Ed.setMarker(i,null);};
 $('form',el).onsubmit=e=>{e.preventDefault();Pop.close(true);Ed.setMarker(i,{name:$('#ed-mkn',el).value.trim()||undefined,note:$('#ed-mkt',el).value.trim()||undefined,color});};}
function edMixer(){const tracks=Ed.p.tracks.filter(t=>t.kind==='audio'||t.kind==='video');Ed.snapshot();
 dialog(`<div class="ed-keys ed-mixer"><h2>Mixer</h2><div class="ed-mix-rows">${tracks.map(t=>`<div class="ed-mix" data-mt="${t.id}"><b dir="auto">${t.color?`<i class="ed-swatch" style="background:${edLabel(t.color)}"></i>`:''}${esc(t.name||(t.main?'Main':ED_KINDS[t.kind].label))}</b>
   <label>Volume <input type="range" min="0" max="200" value="${Math.round((t.vol??1)*100)}" data-mv><span>${Math.round((t.vol??1)*100)}%</span></label>
   <label>Pan <input type="range" min="-100" max="100" value="${Math.round((t.pan||0)*100)}" data-mp><span>${edPanLabel(t.pan||0)}</span></label>
   <span class="ed-mix-btns"><button type="button" class="btn small${t.muted?' primary':''}" data-mm>Mute</button><button type="button" class="btn small${t.solo?' primary':''}" data-ms>Solo</button></span></div>`).join('')}</div>
  <p class="ed-xnote">Volume and pan apply to every clip on the track, in the player and the export. Solo plays only the soloed tracks.</p>
  <div class="ed-xactions"><button type="button" class="btn primary" data-no>Done</button></div></div>`);
 const box=$('.ed-mixer');box.querySelector('[data-no]').onclick=()=>{closeDialog();Ed.after(true);};
 box.querySelectorAll('[data-mt]').forEach(r=>{const id=r.dataset.mt,t=Ed.p.tracks.find(x=>x.id===id);
  r.querySelector('[data-mv]').oninput=e=>{t.vol=Number(e.target.value)/100;if(t.vol===1)delete t.vol;e.target.nextElementSibling.textContent=e.target.value+'%';Ed.sync();};
  r.querySelector('[data-mp]').oninput=e=>{t.pan=Number(e.target.value)/100;if(!t.pan)delete t.pan;e.target.nextElementSibling.textContent=edPanLabel(t.pan||0);Ed.sync();};
  r.querySelector('[data-mm]').onclick=e=>{t.muted=!t.muted;e.target.classList.toggle('primary',!!t.muted);Ed.sync();Ed.drawTimeline();};
  r.querySelector('[data-ms]').onclick=e=>{t.solo=!t.solo;if(!t.solo)delete t.solo;e.target.classList.toggle('primary',!!t.solo);Ed.sync();};});}
const edPanLabel=p=>Math.abs(p)<.01?'Centre':`${Math.round(Math.abs(p)*100)}% ${p<0?'left':'right'}`;
function edSource(m){let a=0,b=m.dur||0;
 dialog(`<div class="ed-keys ed-source"><h2 dir="auto">${esc(m.name)}</h2><${m.type==='audio'?'audio':'video'} class="ed-src-player" src="${Ed.urls[m.id]}" controls preload="auto"></${m.type==='audio'?'audio':'video'}>
  <div class="ed-src-range"><button type="button" class="btn small" data-in>${I.trimL} Mark in · I</button><span data-range></span><button type="button" class="btn small" data-out>Mark out · O ${I.trimR}</button></div>
  <p class="ed-xnote">The part between in and out goes onto the ${m.type==='audio'?'audio':'main'} track at the playhead (${edFmt(Ed.time)}).</p>
  <div class="ed-xactions"><button type="button" class="btn ghost" data-no>Close</button><button type="button" class="btn" data-ow>Overwrite</button><button type="button" class="btn primary" data-ins>Insert</button></div></div>`);
 const box=$('.ed-source'),v=box.querySelector('.ed-src-player'),show=()=>{box.querySelector('[data-range]').textContent=`${edFmt(a)} → ${edFmt(b)} · ${edFmt(b-a)}`;};show();
 const mark=w=>{const t=v.currentTime;if(w==='in'){a=Math.min(t,b-.1);}else{b=Math.max(t,a+.1);}show();};
 box.querySelector('[data-in]').onclick=()=>mark('in');box.querySelector('[data-out]').onclick=()=>mark('out');
 box.onkeydown=e=>{if(e.key==='i'||e.key==='I'){mark('in');e.preventDefault();}else if(e.key==='o'||e.key==='O'){mark('out');e.preventDefault();}};box.tabIndex=-1;box.focus();
 box.querySelector('[data-no]').onclick=()=>closeDialog();
 box.querySelector('[data-ins]').onclick=()=>{closeDialog();Ed.sourceEdit(m.id,a,b,'insert');};box.querySelector('[data-ow]').onclick=()=>{closeDialog();Ed.sourceEdit(m.id,a,b,'overwrite');};}
function edSpeed(c,v){Ed.snapshot();const m=Ed.mediaOf(c),max=m?.dur?((m.dur-(c.in||0))/(v*(c.ramp?edRampAvg(c.ramp):1))):Infinity;c.dur=Math.max(.1,Math.min(c.dur*(c.speed||1)/v,max));c.speed=v;Ed.after(true);}
// ---------- the shortcuts sheet ----------
function edKeys(){
 const rows=[['Space','Play or pause'],['Ctrl+Shift+Space','Play from in to out'],['Shift+L','Loop on or off'],['Ctrl+B or S','Split at the playhead'],['Ctrl+Shift+B or Shift+S','Split every track at the playhead'],['A / Shift+A','Select every clip after / before the playhead'],['Alt + ← / →','Move the selection one frame (Shift: five)'],['Ctrl+Alt + ← / →','Swap the clip with the one before / after'],['Delete','Delete the selection'],['Alt + drag an edge','Ripple trim: what follows moves too'],['Ctrl + drag an edge','Roll: move the cut between two clips'],['Alt + drag a clip','Slip: another part of the file, same place'],['Ctrl + Alt + drag a clip','Slide: move it between its neighbours'],['Ctrl+Alt+V','Paste attributes: the copied clip\'s look onto the selection'],['Ctrl+G / Ctrl+Shift+G','Group / ungroup'],['Alt + click','One clip of a group'],['Shift+E','Save the frame as a picture'],['Shift+Delete','Ripple delete: close the space'],['Q / W','Delete left / right of the playhead'],['J / K / L','Play back, stop, play forward (again: faster)'],['I / O','Mark in / out'],['Shift+I / Shift+O','Go to in / out'],['Alt+X','Clear in and out'],['Shift+F','Freeze frame'],['Ctrl+Z / Ctrl+Shift+Z','Undo / redo'],['Ctrl+C / X / V','Copy, cut, paste at the playhead'],['Ctrl+D','Duplicate'],['Ctrl+A','Select every clip'],
  ['Shift or Ctrl + click','Add a clip to the selection'],['Drag on empty space','Select with a box'],['M','Add or remove a marker'],['← / →','One frame back / forward'],['Shift + ← / →','One second back / forward'],['Home / End','Start / end'],['Ctrl + wheel','Zoom the timeline'],['Drag the ruler','Move the playhead and hear the sound (scrub)'],['Drag a corner / the knob','In the player: resize / rotate (Shift: 15° steps)'],['Right-click','Clip menu'],['Esc','Clear the selection'],['?','This sheet']];
 dialog(`<div class="ed-keys"><h2>Keyboard shortcuts</h2><dl>${rows.map(([k,d])=>`<dt>${k.split(' / ').map(x=>`<kbd>${esc(x)}</kbd>`).join(' / ')}</dt><dd>${esc(d)}</dd>`).join('')}</dl><div class="ed-xactions"><button type="button" class="btn primary" data-no>Done</button></div></div>`);
 $('.ed-keys [data-no]').onclick=()=>closeDialog();
}
