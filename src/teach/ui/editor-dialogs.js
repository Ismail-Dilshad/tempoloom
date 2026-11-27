'use strict';
// Editor, dialogs and menus: the projects screen, export (presets), project files, right-click menus, paste attributes, markers, the mixer, the source monitor, the shortcuts sheet.
// Loaded after editor-ui.js (see index.html).
function edProjects(el){
 if(Ed.p)Ed.flush();
 const list=Ed.list().sort((a,b)=>String(b.updated).localeCompare(String(a.updated)));
 el.innerHTML=`<div class="no-head ed-projects">
  <header class="trash-bar"><h1>Editor${list.length?` <span>${list.length}</span>`:''}</h1>
   <span class="ed-proj-actions"><button type="button" class="btn small" data-editor-agent>Shared with agents</button><button type="button" class="btn small" data-import-project>${I.upload} Open project file</button>${list.length?`<button type="button" class="btn small primary" data-new>${I.add} New project</button>`:''}</span>
   <input type="file" accept=".zip,application/zip" data-project-file hidden></header>
  ${list.length?`<div class="ed-project-grid">${list.map(x=>`<article class="ed-project" data-open="${esc(x.id)}" tabindex="0" role="link" aria-label="Open ${esc(x.name)}">
    <div class="ed-project-thumb">${x.coverImage||x.thumb?`<img src="${esc(x.coverImage||x.thumb)}" alt="">`:`<span>${I.cut}</span>`}<span class="ed-project-ratio">${esc(x.ratio)}</span></div>
    <div class="ed-project-text"><b dir="auto">${esc(x.name)}</b><small>${x.clips?`${edFmt(x.dur).slice(0,5)} · `:''}${esc(edAgo(x.updated))}</small></div>
    <button type="button" class="iconbtn sm ed-project-more" data-more="${esc(x.id)}" aria-label="More for ${esc(x.name)}" aria-haspopup="menu">${I.more}</button></article>`).join('')}</div>`
   :`<div class="trash-empty"><span class="trash-empty-icon" aria-hidden="true">${I.cut}</span><h2>No projects yet</h2><button type="button" class="btn primary" data-new>${I.add} New project</button></div>`}
 </div>`;
 el.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>App.go('editor',Ed.create()));
 el.querySelector('[data-editor-agent]').onclick=()=>edAgentDialog();
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
  pop.querySelector('[data-act=dup]').onclick=()=>{Pop.close();const p=Ed.readProject(id);if(p){const nid=Ed.create({...p,name:p.name+' copy'},x.coverImage);const l=Ed.list(),e2=l.find(q=>q.id===nid);if(e2){e2.thumb=x.thumb;e2.dur=x.dur;e2.clips=x.clips;Ed.setList(l);}}edProjects(el);};
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
function edExportDialog(saved){
 if(!Ed.p.clips.length)return toast('Add something to the timeline first.');
 const short=Math.min(...Ed.base()),res=[[480,'480p'],[720,'720p'],[1080,'1080p'],[1440,'2K'],[2160,'4K']],wc=typeof VideoEncoder!=='undefined';
 const seg=(attr,list,val)=>`<div class="ed-seg" data-seg="${attr}">${list.map(([v,l])=>`<button type="button" data-${attr}="${v}" aria-pressed="${val===v}">${l}</button>`).join('')}</div>`;
 dialog(`<form class="ed-export-form"><h2>Export</h2>
  <label class="ed-xrow"><span>Name</span><input id="ex-name" value="${esc(saved?.name??Ed.p.name)}" maxlength="80" dir="auto"></label>
  <label class="ed-xrow"><span>Preset</span><select id="ex-preset" aria-label="Preset">${ED_PRESETS.map(([id,l])=>`<option value="${id}">${l}</option>`).join('')}</select></label>
  <div class="ed-xrow" data-row="fmt"><span>Format</span>${seg('fmt',[['mp4','MP4'],['webm','WebM'],['gif','GIF'],['mp3','MP3'],['wav','WAV']],'mp4')}</div>
  <div class="ed-xrow" data-row="res"><span>Resolution</span>${seg('res',res,1080)}</div>
  <div class="ed-xrow" data-row="fps"><span>Frame rate</span>${seg('fps',[[15,'15'],[24,'24'],[25,'25'],[30,'30'],[60,'60']],Ed.fps())}</div>
  <div class="ed-xrow" data-row="quality"><span>Quality</span>${seg('quality',[['standard','Smaller file'],['high','High'],['best','Best']],'high')}</div>
  ${Ed.rangeSpan()?`<div class="ed-xrow"><span>Range</span>${seg('span',[['range','In to out'],['all','Whole video']],'range')}</div>`:''}
  ${wc?`<div class="ed-xrow" data-row="mode"><span>Frames</span>${seg('mode',[['exact','Exact'],['live','Real time']],'exact')}</div>`:''}
  <label class="ed-xrow ed-xcheck" data-row="studio"><span>Studio</span><span class="ed-xopt"><input type="checkbox" role="switch" id="ex-studio" ${saved?.studio===false?'':'checked'}> Also save it to Studio</span></label>
  <p class="ed-xnote" id="ex-warn" hidden></p><p class="ed-xnote" id="ex-note"></p>
  <div class="ed-xactions"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn" data-preflight>Check timeline</button><button class="btn primary" type="submit">${I.down} Export</button></div></form>`);
 const f=$('.ed-export-form'),st={preset:'custom',res:1080,fps:Ed.fps(),fmt:'mp4',quality:'high',mode:wc?'exact':'live',span:Ed.rangeSpan()?'range':'all',ratio:null,...saved?.options};
 const press=()=>f.querySelectorAll('[data-seg]').forEach(g=>{const k=g.dataset.seg;g.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(String(st[k])===b.dataset[k])));});
 const sync=()=>{const sound=st.fmt==='mp3'||st.fmt==='wav',gif=st.fmt==='gif';
  for(const r of ['res','fps','quality','mode','studio'])f.querySelector(`[data-row="${r}"]`)?.toggleAttribute('hidden',sound||(gif&&(r==='mode'||r==='studio')));
  if(gif){st.fps=Math.min(st.fps,15);st.res=Math.min(st.res,480);st.mode='exact';}press();
  const [w,h]=Ed.base(),k=st.res/short,sp=st.span==='range'&&Ed.rangeSpan(),len=edFmt(sp?sp.e-sp.s:Ed.end()).slice(0,5);
  $('#ex-note').textContent=sound?`Sound only · ${len} · the same mix you hear, with volumes, fades and ducking.`:`${Math.round(w*k/2)*2} × ${Math.round(h*k/2)*2} · ${st.fps} fps · ${len} · ${gif?'loops, no sound; at most 15 fps and 480p to keep it small.':st.mode==='exact'?'every frame is drawn exactly; footage with few keyframes can take longer than the video.':'it plays through once while it records; a busy computer can skip frames.'}`;
  const warn=$('#ex-warn');warn.hidden=!(st.ratio&&st.ratio!==Ed.p.ratio);if(!warn.hidden)warn.textContent=`This preset is ${st.ratio}; your video is ${Ed.p.ratio}. Change it under Details → Shape, or export anyway.`;};
 f.querySelectorAll('[data-seg] button').forEach(b=>b.onclick=()=>{const k=b.closest('[data-seg]').dataset.seg,v=b.dataset[k];st[k]=k==='res'||k==='fps'?Number(v):v;st.preset='custom';st.ratio=null;$('#ex-preset').value='custom';sync();});
 $('#ex-preset').onchange=e=>{const p=ED_PRESETS.find(x=>x[0]===e.target.value);st.preset=p[0];st.ratio=p[2]?.ratio||null;if(p[2])Object.assign(st,{res:p[2].res??st.res,fps:p[2].fps??st.fps,fmt:p[2].fmt??st.fmt,quality:p[2].quality??st.quality});sync();};
 $('#ex-preset').value=st.preset;sync();
 f.querySelector('[data-preflight]').onclick=()=>{
  const state={options:{...st},name:$('#ex-name').value,studio:$('#ex-studio').checked};
  closeDialog();edTimelineCheck(st.span==='range'?Ed.rangeSpan():null,()=>edExportDialog(state));
 };
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
function edTrimToolMenu(x,y,clip,edge){
 const locked=!!Ed.trackOf(clip)?.locked;
 const arm=(tool,gesture)=>{
  Ed.dom.scroll.edNextTrim={id:clip.id,tool};
  toast(gesture+' Press Esc to cancel.');
 };
 const source=!!(clip.media||clip.nest);
 const canRoll=edge==='l'?Ed.prevOf(clip):edge==='r'?Ed.nextOf(clip):Ed.prevOf(clip)||Ed.nextOf(clip);
 const edges=[
  ['Ripple trim','trimL',()=>arm('ripple','Drag a trim edge of this clip.'),locked,false,'Alt + edge'],
  ['Roll trim','split',()=>arm('roll','Drag the seam between two clips.'),locked||!canRoll,false,'Ctrl + edge']
 ];
 const body=[
  ['Slip clip','sliders',()=>arm('slip','Drag the clip body to shift its source.'),locked||!source,false,'Alt + clip'],
  ['Slide clip','move',()=>arm('slide','Drag the clip body to adjust the neighboring cuts.'),locked||(!Ed.prevOf(clip)&&!Ed.nextOf(clip)),false,'Ctrl + Alt + clip']
 ];
 edMenu(x,y,edge?edges:[...edges,'-',...body]);
}
function edTimelineKeyframes(x,y,clip){
 const media=Ed.mediaOf(clip),visual=Ed.kindOf(clip)!=='audio';
 const controls=[...(visual?[...(clip.positionLocked?[]:[['scale','Scale'],['rotate','Rotation']]),['opacity','Opacity']]:[]),
  ...(media&&media.type!=='image'?[['volume','Volume']]:[])];
 edMenu(x,y,controls.map(([key,label])=>[
  `${Ed.kfAt(clip,key)>=0?'Remove':'Add'} ${label.toLowerCase()} keyframe`,'diamond',
  ()=>{
   if(Ed.clip(clip.id)!==clip||Ed.trackOf(clip)?.locked||Ed.time<clip.start||Ed.time>clip.start+clip.dur)
    return toast('Put the playhead on an unlocked clip to set a keyframe.');
   Ed.toggleKf(clip,key);
  }
 ]));
}
function edClipMenu(x,y,c){
 const m=Ed.mediaOf(c),selected=Ed.picked(),many=selected.length>1,visual=Ed.kindOf(c)!=='audio';
 const editable=!many&&!Ed.trackOf(c)?.locked,hasSound=(m?.type==='video'||m?.type==='audio')&&(!c.detached||c.asAudio);
 const unlocked=selected.filter(clip=>!Ed.trackOf(clip)?.locked),canEditSelection=unlocked.length>0;
 const mediaClips=unlocked.filter(clip=>Ed.mediaOf(clip));
 const pictures=mediaClips.filter(clip=>Ed.kindOf(clip)!=='audio');
 const angles=mediaClips.filter(clip=>Ed.mediaOf(clip).type!=='image');
 const canMulticam=angles.length>1&&angles.some(clip=>Ed.mediaOf(clip).type==='video'&&!clip.asAudio)&&angles.every(clip=>!clip.ramp&&(!clip.speed||clip.speed===1));
 const other=selected.length===2?selected.find(clip=>clip.id!==c.id):null;
 const copied=Ed.clipboard?.[0];
 edMenu(x,y,[
  ['Copy','copy',()=>Ed.copy(),false,false,'Ctrl+C'],
  ...(canEditSelection&&unlocked.length===selected.length?[['Cut','cut',()=>Ed.copy(true),false,false,'Ctrl+X']]:[]),
  ...(copied?[['Paste','copy',()=>Ed.paste(),false,false,'Ctrl+V'],
   ...(unlocked.length===selected.length&&unlocked.some(clip=>clip.id!==copied.id)?[['Paste attributes…','sliders',()=>edPasteAttrs(),false,false,'Ctrl+Alt+V']]:[])]:[]),
  ...(canEditSelection?['-']:[]),
  ...(editable?[
   ['Trim tools…','trimL',()=>edTrimToolMenu(x,y,c,null)],
   ...(visual&&!c.adjustment?[[c.positionLocked?'Unlock position':'Lock position',c.positionLocked?'unlock':'lock',()=>Ed.togglePositionLock(c)]]:[]),
   ...(visual||hasSound?[['Keyframes…','diamond',()=>edTimelineKeyframes(x,y,c)]]:[]),
   ...(c.title?[['Edit title…','text',()=>edTitleEditor(c)]]:[]),
   ...(m?[['Replace media…','refresh',()=>edReplace(x,y,c)]]:[]),
   ...(m&&m.type!=='image'&&!c.ramp&&Ed.gapToNext(c)>=1/60?[['Fit to fill','sliders',()=>Ed.fitFill(c)]]:[]),
   ...(m?.type==='video'&&!c.asAudio?[['Review scene cuts','split',()=>Ed.detectScenes(c,.3,true)]]:[]),
   ...(visual&&m&&!c.positionLocked?[['Dynamic zoom…','zoomIn',()=>edMenu(x,y,[['Zoom in','zoomIn',()=>Ed.dynZoom(c,1)],['Zoom out','zoomOut',()=>Ed.dynZoom(c,-1)]])]]:[]),
  ]:[]),
  ...(angles.some(clip=>!clip.detached||clip.asAudio)?[['Remove silences…','sound',()=>edSilenceDialog()]]:[]),
  ...(canMulticam?[['Make multicam','film',()=>Ed.multicam()]]:[]),
  ...(pictures.length>1?[['Split screen…','layers',()=>edMenu(x,y,[['Side by side','',()=>Ed.layout('2h')],['Top and bottom','',()=>Ed.layout('2v')],['One big, two small','',()=>Ed.layout('3')],['One wide, two below','',()=>Ed.layout('3v')],['Four in a grid','',()=>Ed.layout('4')]])]]:[]),
  ...(other&&pictures.includes(c)&&Ed.mediaOf(other)&&Ed.kindOf(other)!=='audio'?[['Colour match to the other clip','sliders',()=>Ed.colorMatch(c,other)]]:[]),
  ...(canEditSelection?[['Label colour…','flag',()=>{
   const setLabel=value=>{Ed.snapshot();for(const clip of unlocked){if(value)clip.label=value;else delete clip.label;}Ed.after(true);};
   edMenu(x,y,[...ED_LABELS.map(([v,l])=>[`<i class="ed-swatch" style="background:${edLabel(v)}"></i>${l}`,'',()=>setLabel(v)]),['None','x',()=>setLabel(null)]]);
  }]]:[])]);
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
  <div class="ed-xactions"><button type="button" class="btn primary" data-no>Done</button></div></div>`,{onclose:()=>Ed.after(true)});
 const box=$('.ed-mixer');box.querySelector('[data-no]').onclick=()=>closeDialog();
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
/** Remove silences: how quiet is a pause, how long, and how much air to keep around speech. */
function edSilenceDialog(range=null){
 const project=Ed.p;
 const tracks=Ed.p.tracks.filter(t=>!t.locked&&Ed.p.clips.some(c=>c.track===t.id&&(!range||c.start<range.e&&c.start+c.dur>range.s)));
 const selection=Ed.picked();
 if(!range&&!selection.length)return toast('Select a clip with sound first.');
 if(range&&!tracks.length)return toast('There are no unlocked clips in this range.');
 dialog(`<form class="ed-export-form"><h2>${range?'Edit marked range':'Remove silences'}</h2>
  ${range?`<p class="ed-xnote">${edTimecode(range.s,Ed.fps())} to ${edTimecode(range.e,Ed.fps())}</p>
   <fieldset><legend>Tracks to scan</legend>${tracks.map((t,i)=>`<label class="ed-review-track"><input type="checkbox" name="track" value="${i}" checked> ${esc(t.name||ED_KINDS[t.kind]?.label||'Track')}</label>`).join('')}</fieldset>`:''}
  <label class="ed-xrow"><span>Quiet threshold</span><input type="range" name="thr" min="-60" max="-20" value="-38"><b data-v="thr">-38 dB</b></label>
  <label class="ed-xrow"><span>Minimum pause</span><input type="range" name="min" min=".2" max="2" step=".1" value=".6"><b data-v="min">0.6 s</b></label>
  <label class="ed-xrow"><span>Keep around speech</span><input type="range" name="pad" min="0" max=".4" step=".02" value=".12"><b data-v="pad">0.12 s</b></label>
  <div class="ed-xactions"><button type="button" class="btn" data-no>Cancel</button>${range?'<button type="submit" class="btn" value="split">Review boundary splits</button>':''}<button type="submit" class="btn primary">Review silence cuts</button></div></form>`);
 const form=$('#modal form');
 form.querySelectorAll('input[type=range]').forEach(input=>input.oninput=()=>{form.querySelector(`[data-v="${input.name}"]`).textContent=input.name==='thr'?`${input.value} dB`:`${Number(input.value).toFixed(input.name==='pad'?2:1)} s`;});
 form.querySelector('[data-no]').onclick=()=>closeDialog();
 form.onsubmit=async event=>{
  event.preventDefault();
  const chosen=new Set(new FormData(form).getAll('track').map(index=>tracks[Number(index)]?.id));
  if(range&&!chosen.size)return toast('Choose at least one track.');
  const clips=range?project.clips.filter(c=>chosen.has(c.track)):selection;
  if(range&&event.submitter?.value==='split'){
   const cuts=clips.flatMap(clip=>[range.s,range.e].filter(a=>a>clip.start+.01&&a<clip.start+clip.dur-.01)
    .map(a=>({clip,source:JSON.stringify(clip),a,b:a,kind:'split',label:Ed.timelineClipName(clip)})));
   if(!cuts.length)return toast('No clips cross the range boundaries.');
   closeDialog();edReviewCuts({project,cuts,range});return;
  }
  const options={thr:Number(form.elements.thr.value),minLen:Number(form.elements.min.value),pad:Number(form.elements.pad.value),range,clips};
  closeDialog();toast('Listening for pauses.');
  const plan=await Ed.planSilences(options);
  if(Ed.p!==project)return;
  if(!plan)return toast('The timeline changed during the scan. Try again.');
  if(!plan.cuts.length)return toast('No cuts found. Try a higher quiet threshold or a shorter minimum pause.');
  edReviewCuts({...plan,range});
 };
}

function edTimelineReview(title,body){
 const panel=Ed.dom.root.querySelector('.ed-review-panel');
 panel.edClose?.();
 panel.hidden=false;
 panel.innerHTML=`<header><h3>${title}</h3><button type="button" class="iconbtn sm" data-review-close aria-label="Close timeline review">${I.x}</button></header>${body}`;
 panel.edClose=()=>{panel.hidden=true;panel.replaceChildren();panel.edClose=null;};
 panel.querySelector('[data-review-close]').onclick=()=>panel.edClose();
 return panel;
}

function edReviewCuts(plan){
 const cuts=[...plan.cuts].sort((a,b)=>a.a-b.a).map(cut=>({...cut,approved:false}));
 if(!cuts.length)return;
 const panel=edTimelineReview('Review cuts',`<div class="ed-review-actions">
  <button type="button" class="btn small" data-select-cuts>Select all</button>
  <button type="button" class="btn small primary" data-apply-cuts disabled>Apply selected</button>
  ${cuts.some(c=>c.kind==='ripple')?'<button type="button" class="btn small" data-ai-cuts>Ask AI to suggest cuts</button>':''}
 </div><div class="ed-review-list"></div><p class="ed-review-status" role="status"></p>`);
 const inner=Ed.dom.inner,layer=document.createElement('div'),list=panel.querySelector('.ed-review-list');
 const status=panel.querySelector('.ed-review-status'),apply=panel.querySelector('[data-apply-cuts]');
 inner.append(layer);layer.className='ed-review-marks';layer.setAttribute('aria-hidden','true');
 const close=panel.edClose;
 const controller=new AbortController();
 panel.edClose=()=>{controller.abort();layer.remove();close();};
 const update=()=>{
  apply.disabled=!cuts.some(c=>c.approved);
  panel.querySelector('[data-select-cuts]').textContent=cuts.every(c=>c.approved)?'Clear selection':'Select all';
  layer.innerHTML=cuts.map(c=>`<i class="${c.approved?'approved':''}" style="left:${c.a*Ed.zoom}px;width:${Math.max(2,(c.b-c.a)*Ed.zoom)}px"></i>`).join('');
 };
 layer.edRefresh=update;
 const render=()=>{
  list.innerHTML=cuts.map((cut,i)=>`<div class="ed-review-cut" data-cut="${i}">
   <label><input type="checkbox" aria-label="Approve cut ${i+1}" ${cut.approved?'checked':''}> <span dir="auto">${esc(cut.label)}</span></label>
   <button type="button" class="btn small" data-preview>Preview ${edTimecode(cut.a,Ed.fps())}</button>
   ${cut.kind==='ripple'?`<label>Start <input type="number" step=".001" min="${Math.max(cut.clip.start,plan.range?.s??0)}" max="${cut.b-.04}" value="${cut.a.toFixed(3)}" data-edge="a"></label>
   <label>End <input type="number" step=".001" min="${cut.a+.04}" max="${Math.min(cut.clip.start+cut.clip.dur,plan.range?.e??Infinity)}" value="${cut.b.toFixed(3)}" data-edge="b"></label>`:''}
   ${cut.reason?`<small>${esc(cut.reason)}</small>`:''}
  </div>`).join('');
  list.querySelectorAll('[data-cut]').forEach(row=>{
   const cut=cuts[Number(row.dataset.cut)];
   row.querySelector('input[type=checkbox]').onchange=event=>{cut.approved=event.currentTarget.checked;update();};
   row.querySelector('[data-preview]').onclick=()=>{
    if(Ed.p!==plan.project||!Ed.p.clips.includes(cut.clip))return toast('Scan the current timeline again.');
    Ed.pause();
    const start=Math.max(0,cut.a-.3),end=Math.min(Ed.end(),Math.max(cut.b,cut.a+.3)+.3);
    Ed.seek(start);Ed.revealTimeline(cut.a,cut.clip.track);
    if(end>start){Ed.rate=1;Ed.span={s:start,e:end,once:true};Ed.start();}
   };
   row.querySelectorAll('[data-edge]').forEach(field=>field.onchange=()=>{
    const edge=field.dataset.edge,value=field.valueAsNumber;
    if(!Number.isFinite(value)||value<Number(field.min)-.0005||value>Number(field.max)+.0005){field.value=cut[edge].toFixed(3);return;}
    cut[edge]=edClamp(value,Number(field.min),Number(field.max));
    row.querySelector('[data-edge=a]').max=cut.b-.04;
    row.querySelector('[data-edge=b]').min=cut.a+.04;
    row.querySelector('[data-preview]').textContent='Preview '+edTimecode(cut.a,Ed.fps());
    update();
   });
  });
  update();
 };
 panel.querySelector('[data-select-cuts]').onclick=()=>{const all=cuts.every(c=>c.approved);cuts.forEach(c=>{c.approved=!all;});render();};
 apply.onclick=()=>{if(Ed.applyReviewCuts(plan,cuts.filter(c=>c.approved)))panel.edClose();};
 const ai=panel.querySelector('[data-ai-cuts]');
 if(ai)ai.onclick=()=>edAskForCuts(plan,cuts,panel,controller.signal,render);
 render();
}

function edAskForCuts(plan,cuts,panel,signal,render){
 const captions=plan.project.clips.filter(c=>c.cap||c.words);
 const candidates=cuts.slice(0,100).map((c,id)=>({id,start:c.a,end:c.b,clip:c.label.slice(0,120),
  context:captions.filter(line=>line.start<c.b+2&&line.start+line.dur>c.a-2)
   .map(line=>`[${line.start.toFixed(2)}–${(line.start+line.dur).toFixed(2)} s] ${line.text||''}`).join(' ').slice(0,300)}));
 dialog(`<form class="ed-export-form"><h2>Suggest cuts with AI</h2>
  <label class="field-label" for="ed-review-request">Editing instructions</label>
  <textarea id="ed-review-request" rows="3" maxlength="600" required placeholder="Tighten the dialogue and keep pauses after questions"></textarea>
  <p class="ed-xnote">Your instructions, cut times, clip names, nearby captions, and overlapping range notes are sent to your configured model. Media stays on this computer.</p>
  <div class="ed-xactions"><button type="submit" class="btn primary">Get suggestions</button></div></form>`);
 const form=$('#modal form');
 form.onsubmit=async event=>{
  event.preventDefault();
  const instruction=form.querySelector('textarea').value.trim();
  if(!instruction||Ed.p!==plan.project||signal.aborted)return;
  closeDialog();
  const button=panel.querySelector('[data-ai-cuts]'),status=panel.querySelector('.ed-review-status');
  button.disabled=true;
  status.textContent='Reviewing cut candidates…';
  const span=plan.range||{s:Math.min(...candidates.map(c=>c.start)),e:Math.max(...candidates.map(c=>c.end))};
  const notes=(Ed.p.rangeNotes||[]).filter(note=>note.e>span.s&&note.s<span.e).slice(0,25);
  try{
   const response=await fetch(withKey('/api/editor/suggest-cuts'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({instruction,candidates,notes}),signal});
   const result=await response.json();
   if(signal.aborted||!panel.isConnected||Ed.p!==plan.project)return;
   if(!response.ok)throw new Error(result.error||'Suggestions unavailable.');
   const choices=new Map(result.cuts.map(c=>[c.id,c.reason]));
   cuts.forEach((cut,i)=>{cut.reason=choices.get(i)||'';});
   status.textContent=choices.size?`${choices.size} AI suggestions. Approve each cut you want to apply.`:'The model found no cuts to suggest.';
   render();
  }catch(error){if(!signal.aborted)status.textContent=error.message;}
  finally{if(!signal.aborted)button.disabled=false;}
 };
}

function edRangeNote(range,index){
 if(!range)return;
 const existing=index!==undefined;
 dialog(`<form class="ed-export-form"><h2>${existing?'Edit range note':'Add range note'}</h2>
  <p class="ed-xnote">${edTimecode(range.s,Ed.fps())} to ${edTimecode(range.e,Ed.fps())}</p>
  <label class="field-label" for="ed-note-text">Note</label>
  <textarea id="ed-note-text" rows="3" maxlength="300" required>${esc(range.text||'')}</textarea>
  <div class="ed-xactions">${existing?'<button type="button" class="btn small danger" data-remove-note>Delete note</button>':''}<button type="submit" class="btn primary">Save note</button></div></form>`);
 const form=$('#modal form'),save=text=>{
  Ed.snapshot();
  const notes=Ed.p.rangeNotes??=[];
  if(existing){if(text)notes[index]={...range,text};else notes.splice(index,1);}
  else notes.push({s:range.s,e:range.e,text});
  closeDialog();Ed.save();Ed.drawTimeline();
  if(existing&&Ed.dom.root.querySelector('.ed-range-list'))edRangeNotes();
 };
 form.onsubmit=event=>{event.preventDefault();const text=form.querySelector('textarea').value.trim();if(text)save(text);};
 const remove=form.querySelector('[data-remove-note]');
 if(remove)remove.onclick=()=>save('');
}

function edRangeNotes(){
 const notes=Ed.p.rangeNotes||[];
 const panel=edTimelineReview('Range notes',`<div class="ed-review-list ed-range-list">${notes.length?notes.map((note,i)=>`<div class="ed-review-cut">
  <span dir="auto">${esc(note.text)}</span><button type="button" class="btn small" data-note-jump="${i}">${edTimecode(note.s,Ed.fps())}</button>
  <button type="button" class="btn small" data-note-edit="${i}">Edit</button></div>`).join(''):'<p>Mark a range with I and O, then add a note.</p>'}</div>`);
 panel.querySelectorAll('[data-note-jump]').forEach(b=>b.onclick=()=>{const note=notes[Number(b.dataset.noteJump)];Ed.pause();Ed.seek(note.s);Ed.revealTimeline(note.s);});
 panel.querySelectorAll('[data-note-edit]').forEach(b=>b.onclick=()=>edRangeNote(notes[Number(b.dataset.noteEdit)],Number(b.dataset.noteEdit)));
}

const edDismissedTimelineIssues=new WeakMap();
async function edTimelineCheck(range,onDone){
 const project=Ed.p,span=range||{s:0,e:Ed.end()};
 const panel=edTimelineReview('Check timeline','<p class="ed-review-status" role="status">Checking…</p>');
 const signal=panel.edClose;
 const issues=[];
 const add=(text,time,track)=>issues.push({text,time,track});
 const main=Ed.main()?.id,visual=project.clips.filter(c=>c.track===main).sort((a,b)=>a.start-b.start);
 let covered=span.s;
 for(const clip of visual){
  if(clip.start>=span.e)break;
  if(clip.start+clip.dur<=span.s)continue;
  if(clip.start-covered>1/Ed.fps())add(`Main track gap (${(clip.start-covered).toFixed(2)} s)`,covered,main);
  covered=Math.max(covered,clip.start+clip.dur);
 }
 if(span.e-covered>1/Ed.fps())add(`Main track gap (${(span.e-covered).toFixed(2)} s)`,covered,main);
 const missing=new Map();
 for(const clip of project.clips){
  if(range&&(clip.cap||clip.words)&&(clip.start<span.s-.001||clip.start+clip.dur>span.e+.001))
   add('Caption extends outside the export range',clip.start,clip.track);
  if(clip.start>=span.e||clip.start+clip.dur<=span.s)continue;
  for(const item of edAll([clip])){
   if(!item.media)continue;
   if(!missing.has(item.media))missing.set(item.media,!await Ed.get(item.media).catch(()=>null));
   if(panel.edClose!==signal||Ed.p!==project)return;
   if(missing.get(item.media)){add(`Missing media: ${Ed.mediaOf(item)?.name||item.media}`,clip.start,clip.track);break;}
  }
 }
 if(panel.edClose!==signal||Ed.p!==project)return;
 const dismissed=edDismissedTimelineIssues.get(project)||new Set();
 edDismissedTimelineIssues.set(project,dismissed);
 const render=()=>{
  const open=issues.filter(issue=>!dismissed.has(JSON.stringify(issue)));
  panel.querySelector('.ed-review-status').textContent=open.length?`${open.length} issue${open.length===1?'':'s'} to check`:'No issues to review.';
  panel.querySelector('.ed-review-list')?.remove();
  const list=document.createElement('div');list.className='ed-review-list';
  list.innerHTML=open.map((issue,i)=>`<div class="ed-review-cut"><span dir="auto">${esc(issue.text)}</span>
   <button type="button" class="btn small" data-jump="${i}">${edTimecode(issue.time,Ed.fps())}</button>
   <button type="button" class="btn small" data-dismiss="${i}">Dismiss</button></div>`).join('');
  panel.append(list);
  list.querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=>{const issue=open[Number(button.dataset.jump)];Ed.pause();Ed.seek(issue.time);Ed.revealTimeline(issue.time,issue.track);});
  list.querySelectorAll('[data-dismiss]').forEach(button=>button.onclick=()=>{dismissed.add(JSON.stringify(open[Number(button.dataset.dismiss)]));render();});
 };
 if(onDone){const back=document.createElement('button');back.type='button';back.className='btn small';back.textContent='Back to export';back.onclick=()=>{panel.edClose();onDone();};panel.append(back);}
 render();
}

async function edAgentDialog(localId){
 const cancelled=new AbortController();
 dialog(`<div class="ed-keys">
  <header data-dialog-header><h2>Editor Agent</h2></header>
  <p data-agent-status role="status">Loading shared projects.</p>
  <div data-agent-body></div>
 </div>`,{onclose:()=>cancelled.abort()});
 const status=document.querySelector('[data-agent-status]'),panel=document.querySelector('[data-agent-body]');
 const sharePath='/api/editor/shared';
 const options={signal:cancelled.signal};
 const post=(path,data)=>api(path,{...options,method:'POST',body:JSON.stringify(data)});
 const archive=async(path,data)=>{
  const r=await fetch(withKey(path),data?{...options,method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}:options);
  if(!r.ok)throw new Error((await r.json()).error||'Could not open the project');
  return r.blob();
 };
 let linked=localId?edSharedLink(localId):null;
 let selection=linked?.id||'',proposal=null;
 const localBaselines=new Map();
 function message(value){if(panel.isConnected)status.textContent=value;}
 function handle(action){return async e=>{
  const button=e.currentTarget;button.disabled=true;
  try{await action();}catch(error){if(!cancelled.signal.aborted)message(error.message);}
  finally{button.disabled=false;}
 };}
 try{
  const [listed,configured]=await Promise.all([api(sharePath,options),api('/api/settings/models?can=agents',options)]);
  if(!panel.isConnected)return;
  let projects=listed.projects;
  const templates=localId?[...ED_TTPL.map((template,index)=>({...template,id:'builtin-'+(index+1)})),
   ...(Ed.tpls||[]),...ED_TITLES.map((template,index)=>({...template,id:'title-'+(index+1)}))]:[];
  panel.innerHTML=`<div class="ed-agent-form">
   ${localId?'<div class="ed-agent-actions"><button type="button" class="btn small" data-share>Share current project copy</button><button type="button" class="btn small" data-publish hidden>Publish timeline changes</button></div>':''}
   <label>Shared project<select data-project aria-label="Shared project"></select></label>
   <div class="ed-agent-actions">
    <button type="button" class="btn small" data-open>Open latest copy</button>
    <button type="button" class="btn small" data-load-local hidden>Load into current timeline</button>
    <button type="button" class="btn small" data-undo>Restore previous revision</button>
   </div>
   ${localId?`<label>Media to share<select data-library-media aria-label="Media to share"><option value="">Choose a file from your Library</option>${Ed.media.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}<optgroup label="Built-in sound effects">${ED_SFX.map(([id,name])=>`<option value="sfx:${esc(id)}">${esc(name)}</option>`).join('')}</optgroup></select></label>
   <button type="button" class="btn small" data-register-media disabled>Share selected media</button>`:''}
   ${templates.length?`<label>Text template to share<select data-library-template aria-label="Text template to share"><option value="">Choose a template</option>${templates.map(template=>`<option value="${esc(template.id)}">${esc(template.name)}</option>`).join('')}</select></label>
   <button type="button" class="btn small" data-register-template disabled>Share text template</button>`:''}
   <section class="ed-agent-form" data-exports hidden>
    <label>Export format<select data-shared-format aria-label="Export format">
     <option value="mp4">MP4</option><option value="webm">WebM</option><option value="gif">GIF</option><option value="mp3">MP3</option><option value="wav">WAV</option>
    </select></label>
    <button type="button" class="btn small" data-export-shared>Export shared revision</button>
    <div data-export-jobs></div>
   </section>
   <details data-caption-plan hidden>
    <summary>On-device captions</summary>
    <div class="ed-agent-form">
     <label>Clip to caption<select data-caption-clip aria-label="Clip to caption"><option value="">Choose a clip</option></select></label>
     <button type="button" class="btn small" data-plan-captions>Plan captions</button>
    </div>
   </details>
   <label>Model<select data-model aria-label="Model"><option value="">Choose a model</option>${configured.models.map((m,i)=>`<option value="${i}">${esc(m.name)} · ${esc(m.provider)}</option>`).join('')}</select></label>
   <details data-motion-presets hidden>
    <summary>Editable motion presets</summary>
    <div class="ed-agent-form">
     <label>Preset<select data-motion-preset><option value="product-reveal">Product reveal</option><option value="device-mockup">Device mockup</option><option value="route-map">Route map</option><option value="kinetic-titles">Kinetic titles</option></select></label>
     <label data-preset-visual>Shared visual<select data-preset-media><option value="">Choose an image or video</option></select></label>
     <div class="ed-agent-form" data-product-fields>
      <label>Product title<input data-product-title maxlength="80" placeholder="Enter a title"></label>
      <label>Motion<select data-product-move><option value="rise">Rise and settle</option><option value="push">Slow push in</option></select></label>
     </div>
     <div class="ed-agent-form" data-device-fields hidden>
      <label>Device<select data-mockup-device><option value="phone">Phone</option><option value="tablet">Tablet</option><option value="laptop">Laptop</option></select></label>
      <label>Motion<select data-mockup-move><option value="slide">Slide in</option><option value="float">Gentle float</option></select></label>
      <label>Screen fit<select data-mockup-fit><option value="contain">Show whole frame</option><option value="cover">Fill screen</option></select></label>
     </div>
     <label data-map-fields hidden>Places in route order<textarea data-map-places rows="3" maxlength="545" placeholder="One place per line, or Name@latitude,longitude"></textarea></label>
     <label data-kinetic-fields hidden>Phrases in order<textarea data-kinetic-phrases rows="3" maxlength="967" dir="auto" placeholder="One phrase per line"></textarea></label>
     <label>Timeline start (seconds)<input type="number" data-preset-start min="0" max="86400" step="any" value="0"></label>
     <label>Duration (seconds)<input type="number" data-preset-seconds min="1" max="20" step="any" value="5"></label>
     <button type="button" class="btn small" data-plan-preset disabled>Plan product reveal</button>
    </div>
   </details>
   <button type="button" class="btn small" data-probe-model>Check model capabilities</button>
   <label>Editing instruction<textarea rows="3" maxlength="4000" placeholder="Add an animated title at the start" data-prompt></textarea></label>
   <div class="ed-agent-actions">
    <button type="button" class="btn small primary" data-propose>Propose edits</button>
    <button type="button" class="btn small" data-run-model>Run and apply</button>
    <button type="button" class="btn small" data-plan-motion>Plan script as motion</button>
   </div>
   <div data-model-jobs hidden aria-label="Model jobs"></div>
   <div data-agent-result hidden>
    <p data-summary></p><ul data-operations></ul>
    <div class="ed-agent-actions">
     <button type="button" class="btn small" data-preview>Open preview copy</button>
     <button type="button" class="btn small primary" data-apply>Apply to shared project</button>
    </div>
   </div>
  </div>`;
  const q=s=>panel.querySelector(`[data-${s}]`),setProposal=value=>{
   proposal=value;q('agent-result').hidden=!value;
   if(!value)return;
   q('summary').textContent=value.summary;
   q('operations').replaceChildren(...value.edits.map(edit=>{
    const item=document.createElement('li');
    item.textContent=[edit.type,edit.text||edit.name,edit.cues?.length?`${edit.cues.length} cues`:undefined,
     edit.start!==undefined?`${edit.start}s`:undefined,edit.clipId||edit.mediaId].filter(Boolean).join(' · ');
    return item;
   }));
  };
  const refresh=()=>{
   q('project').innerHTML='<option value="">Choose a shared project</option>'+projects.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · revision ${x.revision}</option>`).join('');
   q('project').value=selection;
   q('open').disabled=!selection;q('undo').disabled=!selection;
   q('exports').hidden=!selection;
   q('caption-plan').hidden=!selection;
   q('motion-presets').hidden=!selection;
   q('load-local').hidden=!localBaselines.has(selection);
   if(q('publish'))q('publish').hidden=!linked||linked.id!==selection;
   if(q('register-media'))q('register-media').disabled=!selection||!q('library-media').value;
   if(q('register-template'))q('register-template').disabled=!selection||!q('library-template').value;
  };
  const selected=()=>{if(!selection)throw new Error('Choose a shared project');return sharePath+'/'+selection;};
  const open=async(blob,sharedVersion)=>{
   const id=await Ed.importProjectFile(blob);
   if(sharedVersion){
    await edRememberShared(id,sharedVersion,edSharedSnapshot(Ed.readProject(id)));
    closeDialog();App.go('editor',id);
   }
   else{
    const link=document.createElement('a');link.href='#/editor/'+id;link.target='_blank';link.rel='noopener';link.textContent='Open the preview in a new tab';
    status.replaceChildren(link);
   }
  };
  const localArchive=async()=>{
   if(Ed.p?.id!==localId||Ed.stack.length)throw new Error('Return to the main timeline first');
   const bundle=await Ed.packProject(localId),entries=await edUnzip(bundle);
   const baseline=JSON.stringify(JSON.parse(await entries.get('project.json').text()).project);
   return {bundle,baseline};
  };
  const upload=(path,bundle)=>api(path,{...options,method:'POST',headers:{'content-type':'application/zip'},body:bundle});
  const remember=async(result,baseline)=>{
   localBaselines.set(result.id,baseline);
   await edRememberShared(localId,result,edSharedSnapshot(JSON.parse(baseline)));
   linked=edSharedLink(localId);
  };
  const exportPath='/api/editor/exports';
  let jobsRequest=0;
  const loadExports=async()=>{
   const target=selection,request=++jobsRequest;
   if(!target||!panel.isConnected)return;
   try{
    const {jobs}=await api(exportPath+'?projectId='+encodeURIComponent(target),options);
    if(request!==jobsRequest||selection!==target||!panel.isConnected)return;
    const nodes=jobs.map(job=>{
     const line=document.createElement('p');
     line.textContent='Revision '+job.revision+' · '+job.message;
     if(job.state==='done'){
      const link=document.createElement('a');link.href=withKey(exportPath+'/'+job.id+'/file?dl=1');
      link.textContent='Download '+job.format.toUpperCase();line.append(' ',link);
     }else if(job.state==='running'){
      const cancel=document.createElement('button');cancel.type='button';cancel.className='btn small';
      cancel.textContent='Cancel export';cancel.onclick=handle(async()=>{await post(exportPath+'/'+job.id+'/cancel',{});await loadExports();});
      line.append(' ',cancel);
     }
     return line;
    });
    q('export-jobs').replaceChildren(...nodes);
   }catch{if(request===jobsRequest&&panel.isConnected)q('export-jobs').textContent='Could not load export jobs';}
  };
  const modelJobsPath='/api/editor/model-jobs';
  let modelJobsRequest=0;
  const loadModelJobs=async()=>{
   const target=selection,request=++modelJobsRequest,container=q('model-jobs');
   if(!target||!panel.isConnected){container.hidden=true;return;}
   try{
    const {jobs}=await api(modelJobsPath+'?projectId='+encodeURIComponent(target),options);
    if(request!==modelJobsRequest||selection!==target||!panel.isConnected)return;
    container.hidden=!jobs.length;
    const nodes=jobs.map(job=>{
     const line=document.createElement('p'),active=job.state==='queued'||job.state==='running';
     line.textContent='Model job · revision '+job.base+' · '+(job.resultRevision===null?(job.message||job.state):'Applied as revision '+job.resultRevision);
     if(active){
      const cancel=document.createElement('button');
      cancel.type='button';cancel.className='btn small';cancel.textContent='Cancel model job';
      cancel.onclick=handle(async()=>{await post(modelJobsPath+'/'+job.id+'/cancel',{});await loadModelJobs();});
      line.append(' ',cancel);
     }
     return line;
    });
    container.replaceChildren(...nodes);
   }catch{if(request===modelJobsRequest&&panel.isConnected){container.hidden=false;container.textContent='Could not load model jobs';}}
  };
  const pollExports=setInterval(()=>{
   if(!panel.isConnected)clearInterval(pollExports);
   else{void loadExports();void loadModelJobs();}
  },2500);
  cancelled.signal.addEventListener('abort',()=>clearInterval(pollExports),{once:true});
  q('export-shared').onclick=handle(async()=>{
   const path=selected(),projectId=selection,format=q('shared-format').value,{revision}=await api(path+'/head',options);
   if(selection!==projectId)return;
   await post(exportPath,{projectId,revision,format});
   message('Started export of shared revision '+revision+'.');await loadExports();
  });
  const loadCaptionClips=async()=>{
   const select=q('caption-clip'),target=selection;
   select.replaceChildren(new Option('Choose a clip',''));
   if(!target||!q('caption-plan').open)return;
   try{
    const shared=await api(selected(),options);
    if(target!==selection||!panel.isConnected)return;
    const media=new Map(shared.media.map(item=>[item.id,item]));
    for(const clip of shared.project.clips){
     const source=media.get(clip.media);
     if(source&&(source.type==='audio'||source.type==='video')&&!clip.reverse)
      select.add(new Option(source.name+' · '+edFmt(clip.start),clip.id));
    }
   }catch{if(target===selection&&panel.isConnected)message('Could not load clips for captions');}
  };
  q('caption-plan').ontoggle=()=>{if(q('caption-plan').open)void loadCaptionClips();};
  let presetMediaRequest=0;
  const loadPresetMedia=async()=>{
   const select=q('preset-media'),projectId=selection,request=++presetMediaRequest;
   select.replaceChildren(new Option('Choose an image or video',''));
   updatePresetControls();
   if(!projectId||!q('motion-presets').open||q('preset-visual').hidden)return;
   try{
    const {media}=await api(selected(),options);
    if(request!==presetMediaRequest||selection!==projectId||!panel.isConnected)return;
    for(const asset of media.filter(item=>item.type==='image'||item.type==='video'))select.add(new Option(asset.name,asset.id));
    if(select.options.length===1)select.options[0].text='Share an image or video first';
   }catch{if(request===presetMediaRequest&&selection===projectId&&panel.isConnected)message('Could not load shared media');}
  };
  const updatePresetControls=()=>{
   const preset=q('motion-preset').value,mockup=preset==='device-mockup',map=preset==='route-map',kinetic=preset==='kinetic-titles';
   q('product-fields').hidden=preset!=='product-reveal';q('device-fields').hidden=!mockup;
   q('map-fields').hidden=!map;q('kinetic-fields').hidden=!kinetic;q('preset-visual').hidden=map||kinetic;
   q('plan-preset').textContent=kinetic?'Plan kinetic titles':map?'Plan route map':mockup?'Plan device mockup':'Plan product reveal';
   q('plan-preset').disabled=!selection||(!q('preset-visual').hidden&&!q('preset-media').value);
  };
  q('motion-presets').ontoggle=()=>{if(q('motion-presets').open)void loadPresetMedia();};
  q('preset-media').onchange=updatePresetControls;
  q('motion-preset').onchange=()=>{
   updatePresetControls();
   if(!q('preset-visual').hidden&&q('preset-media').options.length===1)void loadPresetMedia();
  };
  q('plan-preset').onclick=handle(async()=>{
   const path=selected(),projectId=selection,mediaId=q('preset-media').value,preset=q('motion-preset').value;
   const seconds=q('preset-seconds').valueAsNumber,start=q('preset-start').valueAsNumber,mockup=preset==='device-mockup',map=preset==='route-map',kinetic=preset==='kinetic-titles';
   const lines=key=>q(key).value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
   const parameters=kinetic?{phrases:lines('kinetic-phrases')}:map?{places:lines('map-places')}
    :mockup?{mediaId,device:q('mockup-device').value,move:q('mockup-move').value,fit:q('mockup-fit').value}
    :{mediaId,title:q('product-title').value.trim(),move:q('product-move').value};
   if(map&&(parameters.places.length<2||parameters.places.length>6))throw new Error('Enter 2 to 6 places, one per line');
   if(kinetic&&(parameters.phrases.length<1||parameters.phrases.length>8))throw new Error('Enter 1 to 8 phrases, one per line');
   if(!q('preset-visual').hidden&&!mediaId)throw new Error('Choose a shared visual');
   if(preset==='product-reveal'&&!parameters.title)throw new Error('Enter a product title');
   if(!Number.isFinite(seconds)||seconds<1||seconds>20)throw new Error('Set a duration between 1 and 20 seconds');
   if(!Number.isFinite(start)||start<0||start+seconds>86400)throw new Error('Set a valid timeline start');
   const {revision}=await api(path+'/head',options);
   if(selection!==projectId||q('motion-preset').value!==preset)return;
   setProposal(null);
   const result=await post('/api/editor/'+preset,{projectId,revision,start,seconds,...parameters});
   if(selection!==projectId||q('motion-preset').value!==preset||cancelled.signal.aborted)return;
   setProposal({...result,summary:kinetic?`${result.scenes} editable kinetic title${result.scenes===1?'':'s'}.`:map?'Editable route map with separate route, markers and labels.'
    :mockup?'Editable device mockup with separate frame, screen and backdrop layers.'
    :'Editable product reveal with separate title, visual and backdrop layers.'});
   message('Preview the composition or apply it to the shared timeline.');
  });
  q('plan-captions').onclick=handle(async()=>{
   const projectId=selection,path=selected(),clipId=q('caption-clip').value;
   if(!clipId)throw new Error('Choose a clip with speech');
   const {revision}=await api(path+'/head',options);
   if(selection!==projectId)return;
   setProposal(null);message('Transcribing on this computer.');
   const result=await post('/api/editor/captions-plan',{projectId,revision,clipId});
   if(selection!==projectId||cancelled.signal.aborted)return;
   setProposal({...result,summary:result.cues+' caption cue'+(result.cues===1?'':'s')});
   message('Review the caption track before applying.');
  });
  q('project').onchange=()=>{
   selection=q('project').value;setProposal(null);refresh();
   q('export-jobs').replaceChildren();q('model-jobs').hidden=true;
   void loadExports();void loadModelJobs();void loadCaptionClips();void loadPresetMedia();
  };
  if(q('library-media'))q('library-media').onchange=refresh;
  if(q('library-template'))q('library-template').onchange=refresh;
  if(q('register-template'))q('register-template').onclick=handle(async()=>{
   const path=selected(),projectId=selection,template=templates.find(item=>item.id===q('library-template').value);
   if(!template)throw new Error('Choose a template');
   const {revision:base}=await api(path+'/head',options);
   const result=await post('/api/editor/share-template',{projectId,base,template});
   if(linked?.id===projectId&&linked.revision===base){
    linked={...linked,revision:result.revision};
    store.set(edSharedLinkKey(localId),linked);
   }
   projects=projects.map(item=>item.id===projectId?{...item,revision:result.revision}:item);
   if(selection===projectId)setProposal(null);
   refresh();message('Text template shared with agents.');
  });
  if(q('register-media'))q('register-media').onclick=handle(async()=>{
   const path=selected(),target=selection,value=q('library-media').value;
   const effect=ED_SFX.find(([id])=>value==='sfx:'+id);
   let media=Ed.media.find(item=>item.id===value),file;
   if(effect){
    const audio=await edMakeSfx(effect[0]);
    media={id:'sfx-'+effect[0],name:effect[1]+'.wav',type:'audio',dur:audio.duration,thumbs:[]};
    file=edWav(audio);
   }else if(media)file=await Ed.get(media.id);
   if(!media)throw new Error('Choose a file from the Library');
   const current=await api(path,options);
   if(!file)throw new Error('Could not find the media file');
   const archive=await edZip([
    ['project.json',new Blob([JSON.stringify({...media,mime:file.type})],{type:'application/json'})],
    ['media/'+media.id+edExt(media.name),file],
   ]);
   const result=await upload(path+'/media?base='+current.revision,archive);
   if(linked?.id===target&&linked.revision===current.revision){
    linked={...linked,revision:result.revision};
    store.set(edSharedLinkKey(localId),linked);
   }
   projects=projects.map(item=>item.id===target?{...item,revision:result.revision}:item);
   if(selection===target){setProposal(null);void loadPresetMedia();}
   refresh();message('Media shared with agents. The timeline stayed the same.');
  });
  if(q('share'))q('share').onclick=handle(async()=>{
   message('Sharing the project copy.');
   const {bundle,baseline}=await localArchive();
   const copied=await upload(sharePath,bundle);
   await remember(copied,baseline);
   projects.unshift(copied);selection=copied.id;setProposal(null);refresh();void loadPresetMedia();
   message('Shared with agents. The original project is available in the Editor.');
  });
  if(q('publish'))q('publish').onclick=handle(async()=>{
   const path=selected(),target=linked;
   if(target?.id!==selection)throw new Error('Open the linked timeline first');
   const {bundle,baseline}=await localArchive();
   const result=await upload(path+'/archive?base='+target.revision,bundle);
   if(linked===target)await remember(result,baseline);
   projects=projects.map(x=>x.id===target.id?{id:x.id,revision:result.revision,name:result.project.name}:x);
   if(selection===target.id){setProposal(null);void loadPresetMedia();}
   refresh();message('Timeline published to shared revision '+result.revision+'.');
  });
  q('open').onclick=handle(async()=>{
   const path=selected(),current=await api(path,options);
   const blob=await archive(path+'/archive?revision='+current.revision);
   if(!cancelled.signal.aborted&&selection===current.id)await open(blob,{id:current.id,revision:current.revision});
  });
  q('load-local').onclick=handle(async()=>{
   const path=selected(),id=selection,baseline=localBaselines.get(id);
   if(!baseline||Ed.p?.id!==localId||Ed.stack.length)throw new Error('Open the original timeline first');
   const result=await api(path,options);
   if(JSON.stringify(Ed.p)!==baseline)throw new Error('The open timeline changed since sharing. Open the latest shared copy to keep both edits.');
   const version=await Ed.readProjectArchive(await archive(path+'/archive?revision='+result.revision));
   if(cancelled.signal.aborted||selection!==id||Ed.p?.id!==localId||Ed.stack.length)return;
   if(JSON.stringify(Ed.p)!==baseline)throw new Error('The open timeline changed since sharing. Open the latest shared copy to keep both edits.');
   const snapshot=await Ed.installSharedTimeline(localId,version);
   await edRememberShared(localId,result,snapshot);
   closeDialog();toast('Shared edits loaded. Undo restores your previous timeline.');
  });
  q('undo').onclick=handle(async()=>{
   const path=selected(),id=selection,p=await api(path,options);
   if(!p.revision)throw new Error('There are no edits to undo');
   const result=await post(path+'/restore',{base:p.revision,restore:p.revision-1});
   projects=projects.map(x=>x.id===id?{...x,revision:result.revision}:x);setProposal(null);refresh();message('Previous shared revision restored.');
  });
  const chosenModel=()=>{
   const model=q('model').value;
   if(model==='')throw new Error('Choose a model in Settings first');
   const {provider,model:name}=configured.models[Number(model)];
   return {provider,model:name};
  };
  q('probe-model').onclick=handle(async()=>{
   const model=chosenModel();
   message('Checking tool calls and image understanding with synthetic inputs.');
   const result=await post('/api/editor/model-probe',model);
   const current=chosenModel();
   if(current.provider!==model.provider||current.model!==model.model)return;
   message('Tool calls: '+(result.tools.verified?'verified':'unverified')+' · Vision: '+(result.vision.verified?'verified':'unverified'));
  });
  q('propose').onclick=handle(async()=>{
   const path=selected(),id=selection;
   const prompt=q('prompt').value.trim();if(prompt.length<3)throw new Error('Describe the edit you want');
   setProposal(null);message('Requesting an edit proposal.');
   const result=await post(path+'/propose',{...chosenModel(),prompt});
   if(selection!==id||cancelled.signal.aborted)return;
   setProposal(result);message('Review the proposal before applying.');
  });
  q('run-model').onclick=handle(async()=>{
   const path=selected(),id=selection,model=chosenModel(),prompt=q('prompt').value.trim();
   if(prompt.length<3)throw new Error('Describe the edit you want');
   const {revision}=await api(path+'/head',options);
   if(selection!==id)return;
   setProposal(null);message('Running the model. Valid edits are applied to revision '+revision+' automatically.');
   await post(modelJobsPath,{projectId:id,base:revision,...model,prompt});
   if(selection===id)message('Model job queued. You can close this dialog and check its status later.');
   await loadModelJobs();
  });
  q('plan-motion').onclick=handle(async()=>{
   const path=selected(),projectId=selection,script=q('prompt').value;
   if(!script.trim())throw new Error('Enter the text to turn into motion scenes');
   const {revision}=await api(path+'/head',options);
   if(selection!==projectId)return;
   setProposal(null);
   const result=await post('/api/editor/motion-plan',{projectId,revision,script,title:'Motion composition'});
   if(selection!==projectId||cancelled.signal.aborted)return;
   setProposal({...result,summary:result.scenes+' editable motion scene'+(result.scenes===1?'':'s')});
   message('Preview the composition or apply it to the shared timeline.');
  });
  q('preview').onclick=handle(async()=>{
   const path=selected(),id=selection;
   if(!proposal)return;
   const {base,edits}=proposal,blob=await archive(path+'/preview',{base,edits});
   if(selection===id&&!cancelled.signal.aborted)await open(blob,false);
  });
  q('apply').onclick=handle(async()=>{
   const path=selected(),id=selection;
   if(!proposal)return;
   const {base,edits}=proposal,result=await post(path+'/edit',{base,edits});
   projects=projects.map(x=>x.id===id?{...x,revision:result.revision}:x);
   if(selection===id)setProposal(null);
   refresh();message('Applied. Open the latest copy to continue editing.');
  });
  refresh();
  void loadExports();
  void loadModelJobs();
  message(configured.models.length?'Share an editor project or choose an existing shared copy.':'Set up a model in Settings to ask for edits. Shared projects are available to terminal agents.');
 }catch(error){if(!cancelled.signal.aborted)message(error.message);}
}
