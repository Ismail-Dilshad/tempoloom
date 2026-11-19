'use strict';
// The Create page offers visual entry points into the Studio brief.
const KINDS=[
 {id:'motion',label:'Motion graphics',icon:'spark',about:'From a script, a prompt, a topic or only a link',placeholder:'Describe your video, paste a script or a link…'},
 {id:'edit',label:'Edit my footage',icon:'film',about:'Your talking-head or any video, cut and finished',placeholder:'Say what the edit should do, or leave it to the studio…'},
 {id:'art',label:'Painting or drawing',icon:'brush',about:'Pencil, ink, watercolour or oil, with a timelapse',placeholder:'Describe the subject, the mood and the light…'}];
const kindOf=id=>KINDS.find(k=>k.id===id)||KINDS[0];
const VIDEO_KINDS=KINDS.filter(kind=>kind.id!=='art');
/** What a brief file is, for its chip and the picker. */
const FILE_KINDS=[
 {id:'footage',label:'Footage',icon:'film',accept:'.mp4,.mov,.mkv,.webm,.avi,.m4v,.mp3,.wav,.m4a',multiple:true,modes:['edit']},
 {id:'reference',label:'Reference',icon:'eye',accept:'.mp4,.mov,.mkv,.webm,.m4v,.png,.jpg,.jpeg,.webp',multiple:true,modes:['motion','edit','art']},
 {id:'logo',label:'Logo',icon:'logo',accept:'.png,.svg,.jpg,.jpeg,.webp',multiple:false,modes:['motion','edit']},
 {id:'asset',label:'Other files',icon:'folder',accept:'.png,.svg,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.mp3,.wav,.m4a,.pdf,.txt,.md',multiple:true,modes:['motion','edit']}];

// ---------- project cards, shared with Projects and Trash ----------
const jobThumb=j=>{
 for(let i=j.tasks?.length-1;i>=0;i--){const t=j.tasks[i];if(t.gate||!t.show)continue;const img=t.show.find(s=>s.type==='image');if(img)return `<img loading="lazy" alt="" src="${withKey(`/studio-file/job/${j.job}/${t.index}/show-${img.k}`)}">`;
  const vid=t.show.find(s=>s.type==='video');if(vid)return `<video muted preload="metadata" playsinline src="${withKey(`/studio-file/job/${j.job}/${t.index}/show-${vid.k}`)}#t=0.5" aria-hidden="true"></video>`;}
 return I[j.mode==='edit'?'film':j.mode==='art'?'brush':'spark'];
};
function jobState(j,working){
 if(j.finished)return {key:'done',badge:`<span class="badge good">${I.check} Done</span>`};
 if(j.waitingFor==='you')return {key:'you',badge:'<span class="badge you">Waiting for you</span>'};
 return {key:'making',badge:`<span class="badge wait">${working?'<span class="live-pulse"></span> ':''}Making</span>`};
}
function projectCard(j,o={}){
 const st=jobState(j,o.working),pct=Math.round(j.done/Math.max(1,j.of)*100),kind=kindOf(j.mode).label;
 return `<div class="pcard-wrap" style="position:relative"><a class="pcard" href="#/projects/${encodeURIComponent(j.job)}">
  <span class="thumb">${jobThumb(j)}${st.badge}${!j.finished?`<span class="progress" role="progressbar" aria-label="Steps done" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></span>`:''}${o.face?`<img class="face" src="/mascot/${esc(o.face)}.svg" alt="${esc(FACE_LABEL[o.face]||'Working')}">`:''}</span>
  <b dir="auto">${esc(jobTitle(j))}</b><span class="meta"><span>${esc(kind)}</span><span>${j.done} of ${j.of} steps</span><span>${ago(j.created)}</span></span></a>
  ${o.menu===false?'':`<button class="iconbtn sm more" aria-label="More for ${esc(jobTitle(j))}" aria-haspopup="menu" aria-expanded="false" onclick="projectMenu(this,'${esc(j.job)}')">${I.more}</button>`}</div>`;
}
window.projectMenu=(btn,job)=>{
 const j=Studio.S?.jobs.find(x=>x.job===job);if(!j)return;
 Pop.open(btn,j.archived?`<button class="pop-item" data-close onclick="archiveJob('${esc(job)}',false)">${I.restore}<span>Restore</span></button>
   <button class="pop-item danger" data-close onclick="deleteStudioJob('${esc(job)}')">${I.trash}<span>Delete forever</span></button>`
  :`<a class="pop-item" href="#/projects/${encodeURIComponent(job)}">${I.film}<span>Open</span></a>
   <button class="pop-item" data-close onclick="tellStudio('${esc(job)}')">${I.rules}<span>Tell the studio something</span></button>
   <hr><button class="pop-item danger" data-close onclick="archiveJob('${esc(job)}',true)">${I.trash}<span>Move to trash</span></button>`,{align:'end',label:'Project'});
};

// ---------- the Create screen ----------
App.register('create',{
 title:()=>'Create',
 load:Studio.load,
 hold:()=>!!Studio.busy||Studio.sending||!!$('#view [data-upload-editing]'),
 render(el){
  const draft=Studio.N,uploads=draft.files.filter(f=>!draft.instructionFiles?.includes(f.name));
  el.innerHTML=uploads.length?`<section class="no-head create-uploads card-grid upload-grid" aria-label="Uploaded files">
   ${uploads.map(f=>uploadCard(f,draft.id)).join('')}
  </section>`:`<div class="no-head create-page"><div class="create-welcome">
   <div class="create-emblem"><img src="/mark.svg?v=10" alt="Tempoloom" width="84" height="84"></div>
   <h2>Start creating or drop media</h2>
   <div class="create-paths" role="group" aria-label="Ways to start">
    <button type="button" class="create-path" data-create-path="motion">
     <span class="create-preview create-preview-motion" aria-hidden="true"><b>Make it<br><em>move.</em></b><i class="create-preview-art"></i></span>
     <span class="create-path-label">Animate an idea ${I.chevron}</span>
    </button>
    <button type="button" class="create-path" data-create-path="edit">
     <span class="create-preview create-preview-edit" aria-hidden="true"><span class="create-timeline"><i></i><i></i><i></i></span><i class="create-preview-art"></i></span>
     <span class="create-path-label">Edit footage ${I.chevron}</span>
    </button>
    <button type="button" class="create-path" data-create-path="reference">
     <span class="create-preview create-preview-reference" aria-hidden="true"><span class="create-reference-stack">${I.image}</span><i class="create-preview-art"></i></span>
     <span class="create-path-label">Use a reference ${I.chevron}</span>
    </button>
   </div>
  </div></div>`;
  wireUploadCards(el);
  el.querySelectorAll('[data-create-path]').forEach(button=>button.onclick=()=>{
   const path=button.dataset.createPath;
   setKind(path==='edit'?'edit':'motion');
   if(path==='reference'){Picker.open('reference');return;}
   Dock.focus();
  });
 }});
function uploadPreview(file,request,trashed=false){
 const kind=FILE_KINDS.find(k=>k.id===file.kind);
 const image=/\.(png|jpe?g|webp|svg)$/i.test(file.name),video=/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name);
 const url=withKey(`/studio-file/upload/${encodeURIComponent(request)}/${trashed?'trash':file.kind}/${encodeURIComponent(trashed?file.trashId:file.name)}`);
 return `${I[image?'image':video?'film':kind?.icon||'folder']}${image||video?`<img class="upload-preview" loading="lazy" alt="" src="${esc(url)}">`:''}`;
}
function uploadCard(file,request,trashed=false){
 return `<article class="upload-card" data-request="${esc(request)}" data-kind="${esc(file.kind)}" data-name="${esc(file.name)}" data-trash-id="${esc(file.trashId||'')}">
  ${uploadPreview(file,request,trashed)}
  ${trashed?'':`<button type="button" class="upload-select" aria-pressed="${!file.detached}" aria-label="Use ${esc(file.name)} in prompt"><span aria-hidden="true">${file.detached?I.add:I.check}</span></button>`}
  <span class="upload-name" dir="auto">${esc(file.name)}</span>
  <button type="button" class="iconbtn sm upload-action" ${trashed?'data-upload-restore':'data-upload-menu aria-haspopup="menu" aria-expanded="false"'} aria-label="${trashed?'Restore':'More options for'} ${esc(file.name)}">${trashed?I.restore:I.more}</button></article>`;
}
function wireUploadPreviews(root){
 root.querySelectorAll('.upload-preview').forEach(img=>{
  img.onerror=()=>img.remove();
  if(img.complete&&!img.naturalWidth)img.remove();
 });
}
function wireUploadCards(root){
 wireUploadPreviews(root);
 root.querySelectorAll('.upload-card').forEach(card=>{
  const button=$('[data-upload-menu]',card);
  if(button){
   const name=$('.upload-name',card);
   const fitName=()=>name.toggleAttribute('data-overflow',name.scrollWidth>name.clientWidth);
   fitName();card.onpointerenter=fitName;card.onfocusin=fitName;
   button.onclick=()=>uploadMenu(button,card.dataset);
   const select=$('.upload-select',card);
   select.onclick=async()=>{
    const attached=select.getAttribute('aria-pressed')!=='true';
    if(await selectPromptFile(card.dataset,attached)){
     findUploadTile(card.dataset)?.querySelector('.upload-select')?.focus();
    }
   };
  }
  const restore=$('[data-upload-restore]',card);
  if(restore)restore.onclick=()=>restoreUpload(restore,card.dataset);
 });
}
function findUploadTile(file){
 return [...document.querySelectorAll('.create-uploads .upload-card')].find(tile=>tile.dataset.kind===file.kind&&tile.dataset.name===file.name);
}
function uploadMenu(button,file){
 if(Pop.anchor===button){Pop.close(true);return;}
 const menu=Pop.open(button,`<button type="button" class="pop-item" role="menuitem" data-rename>${I.rules}<span>Rename</span></button>
 <button type="button" class="pop-item danger" role="menuitem" data-trash>${I.trash}<span>Move to Trash</span></button>`,{align:'end',label:'File options'});
 $('[data-rename]',menu).onclick=()=>{Pop.close(true);renameUpload(button,file);};
 $('[data-trash]',menu).onclick=()=>{Pop.close(true);changeUpload(file,'trash').catch(e=>toast(e.message,true));};
}
function renameUpload(button,file){
 const card=button.closest('.upload-card'),ext=file.name.slice(file.name.lastIndexOf('.'));
 if(card.hasAttribute('data-upload-editing'))return;
 card.setAttribute('data-upload-editing','');
 card.insertAdjacentHTML('beforeend',`<form class="upload-rename">
  <input type="text" dir="auto" aria-label="File name" value="${esc(file.name)}" maxlength="90" required>
  <button class="iconbtn sm" type="submit" aria-label="Save file name">${I.check}</button>
  <button class="iconbtn sm" type="button" aria-label="Cancel rename">${I.x}</button></form>`);
 const form=$('.upload-rename',card),input=$('input',form),save=$('[type=submit]',form),cancel=$('[type=button]',form);
 const close=()=>{form.remove();card.removeAttribute('data-upload-editing');button.focus();};
 input.focus();input.setSelectionRange(0,file.name.length-ext.length);
 cancel.onclick=close;
 form.onkeydown=e=>{if(e.key==='Escape'&&!save.disabled){e.preventDefault();e.stopPropagation();close();}};
 form.onsubmit=async e=>{
  e.preventDefault();
  const value=input.value.trim(),label=value.toLowerCase().endsWith(ext.toLowerCase())?value.slice(0,-ext.length):value;
  save.disabled=cancel.disabled=input.readOnly=true;
  try{
   await changeUpload(file,'rename',{label});
   findUploadTile({...file,name:label.normalize('NFKC').trim()+ext})?.querySelector('[data-upload-menu]')?.focus();
  }catch(error){toast(error.message,true);save.disabled=cancel.disabled=input.readOnly=false;input.focus();}
 };
}
async function changeUpload(file,action,details={}){
 const draft=Studio.N;
 if(Studio.busy||Studio.sending||draft.id!==file.request)throw new Error('Wait for the current file operation to finish.');
 Studio.busy={kind:file.kind,text:{trash:'Moving to Trash',rename:'Renaming file',attach:'Updating prompt'}[action]};
 try{
  const r=await api(`/api/studio/requests/${draft.id}/files`,{method:'PATCH',body:JSON.stringify({action,kind:file.kind,name:file.name,...details})});
  if(draft===Studio.N){draft.files=r.files;Studio.save();}
  if(action==='trash')toast('Moved to Trash');
 }finally{Studio.busy=null;}
 if(App.route==='create')App.show(false);
}
async function selectPromptFile(file,attached){
 try{await changeUpload(file,'attach',{attached});return true;}
 catch(error){toast(error.message,true);return false;}
}
async function restoreUpload(button,file){
 if(Studio.busy||Studio.sending)return;
 button.disabled=true;
 Studio.busy={kind:file.kind,text:'Restoring file'};
 try{
  const draft=Studio.N,destination=await ensureRequest();
  const r=await api(`/api/studio/requests/${file.request}/trashed-files/${file.trashId}`,{method:'POST',body:JSON.stringify({destination})});
  if(draft===Studio.N){draft.files=r.files;Studio.save();}
  toast('Restored to Create');
 }catch(e){toast(e.message,true);}
 finally{Studio.busy=null;button.disabled=false;await App.refresh(true);}
}
function queuedCard(r){
 return `<div class="pcard-wrap" style="position:relative"><div class="pcard"><span class="thumb">${I[r.input?.mode==='edit'?'film':r.input?.mode==='art'?'brush':'spark']}<span class="badge">Sent, not started</span></span>
  <b dir="auto">${esc((r.input?.text||r.summary||'New video').split('\n')[0].slice(0,90))}</b><span class="meta"><span>${esc(kindOf(r.input?.mode).label)}</span><span>${ago(r.created)}</span></span></div>
  <button class="iconbtn sm more" aria-label="More for this queued video" aria-haspopup="menu" aria-expanded="false" onclick="queuedMenu(this,'${r.id}')">${I.more}</button></div>`;
}
window.queuedMenu=(btn,id)=>Pop.open(btn,`<button class="pop-item" data-close onclick="editQueued('${id}')">${I.rules}<span>Edit brief</span></button><button class="pop-item danger" data-close onclick="deleteQueued('${id}')">${I.trash}<span>Delete</span></button>`,{align:'end',label:'Queued video'});

// ---------- the dock on Create ----------
const dockAttachment=(file,id)=>`<span class="dock-attachment">${uploadPreview(file,id)}<button type="button" class="iconbtn sm" aria-label="Remove ${esc(file.name)} from prompt" data-request="${esc(id)}" data-kind="${esc(file.kind)}" data-name="${esc(file.name)}" onclick="detachPromptFile(this)">${I.x}</button></span>`;
window.detachPromptFile=async button=>{if(await selectPromptFile(button.dataset,false))$('#dock-text')?.focus();};
Dock.kinds.create={
 html(){
  const N=Studio.N,k=kindOf(N.mode);
  return `<div class="dock" id="dock" aria-label="Prompt">
   <div class="dock-content">
    <div class="dock-files" id="dock-files" hidden></div>
    <div class="dock-text"><textarea id="dock-text" rows="1" dir="auto" maxlength="12000" aria-label="What do you want to make?" placeholder="${esc(k.placeholder)}">${esc(N.text)}</textarea></div>
    <div class="dock-prompt-actions">
     <button type="button" class="iconbtn sm" id="dock-clear" aria-label="Clear prompt" ${N.text?'':'hidden'}>${I.x}</button>
     <button type="button" class="iconbtn sm" id="dock-expand" aria-label="Expand prompt" aria-expanded="false" aria-controls="panel">${I.expand}</button>
    </div>
   </div>
   <div class="dock-busy" id="dock-busy" ${Studio.busy?'':'hidden'}><span class="spin"></span><span>${esc(Studio.busy?.text||'')}</span></div>
   <div class="dock-tools">
    <button type="button" class="iconbtn" id="dock-add" aria-label="Add files" onclick="Picker.open()">${I.add}</button>
    <button type="button" class="kind-pill" id="dock-kind" aria-haspopup="menu" aria-expanded="false" onclick="kindMenu(this)">${I[k.icon]}<span>${esc(k.label)}</span>${I.chevron}</button>
    <span class="grow"></span>
    <button type="button" class="iconbtn" id="dock-instructions" aria-label="Rules for this video" aria-expanded="${Panel.id==='rules'}" aria-controls="panel" onclick="rulesPanel()">${I.rules}</button>
    <button type="button" class="iconbtn" aria-label="Settings for this video" aria-pressed="${Panel.id==='brief-settings'}" onclick="settingsPanel()">${I.sliders}</button>
    <button type="button" class="iconbtn primary" id="dock-send" aria-label="Send to the studio" ${Studio.sending||Studio.busy?'disabled':''}>${I.send}</button>
   </div></div>`;
 },
 wire(el){
  const t=$('#dock-text',el),clear=$('#dock-clear',el);
  this.refresh(el);autoGrow(t);
  t.oninput=()=>{const N=Studio.N;N.text=t.value;clear.hidden=!N.text;Studio.save();autoGrow(t);};
  clear.onclick=()=>{Studio.N.link='';t.value='';t.oninput();t.focus();};
  t.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();createSend();}
   else if(e.key==='/'&&!t.value){e.preventDefault();Cmd.open();}};
  $('#dock-send',el).onclick=createSend;
  $('#dock-expand',el).onclick=()=>Dock.expand();
  readInstructions().then(cards=>{
   setInstructionIndicator(el,cards?activeInstructions(cards).length>0:!!Studio.N.notes.trim());
  }).catch(()=>setInstructionIndicator(el,!!Studio.N.notes.trim()));
  const dock=$('#dock',el);
  for(const ev of ['dragenter','dragover'])dock.addEventListener(ev,e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dock.classList.add('drop-over');}});
  dock.addEventListener('dragleave',()=>dock.classList.remove('drop-over'));
  dock.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();dock.classList.remove('drop-over');dropFiles([...e.dataTransfer.files]);});
 },
 refresh(el){
  const N=Studio.N,files=$('#dock-files',el);if(!files)return;
  if(files.uploads!==N.files){
   files.uploads=N.files;
   const attached=N.files.filter(file=>!file.detached);
   files.innerHTML=attached.map(file=>dockAttachment(file,N.id)).join('');files.hidden=!attached.length;
   wireUploadPreviews(files);
  }
  $('#dock-clear',el).hidden=!N.text;
  const b=$('#dock-busy',el);b.hidden=!Studio.busy;b.lastElementChild.textContent=Studio.busy?.text||'';
  $('#dock-send',el).disabled=!!(Studio.sending||Studio.busy);
  const k=kindOf(N.mode),pill=$('#dock-kind',el);pill.innerHTML=`${I[k.icon]}<span>${esc(k.label)}</span>${I.chevron}`;$('#dock-text',el).placeholder=k.placeholder;
  el.closest('#panel')?.querySelectorAll('[data-prompt-kind]').forEach(button=>{
   button.setAttribute('aria-pressed',String(button.dataset.promptKind===N.mode));
  });
  const t=$('#dock-text',el);if(document.activeElement!==t&&t.value!==N.text){t.value=N.text;autoGrow(t);}
 }};
const dockRefresh=()=>{if(Dock.mode==='create'&&Dock.el)Dock.kinds.create.refresh(Dock.el);};
document.addEventListener('panel',e=>{
 Dock.el?.querySelector('#dock-instructions')?.setAttribute('aria-expanded',String(e.detail==='rules'));
});
window.kindMenu=btn=>{
 const N=Studio.N;
 Pop.open(btn,`<div class="pop-head">What are you making?</div>${VIDEO_KINDS.map(k=>`<button class="pop-item" role="menuitemradio" aria-checked="${N.mode===k.id}" data-close onclick="setKind('${k.id}')">${I[k.icon]}<span>${esc(k.label)}<small>${esc(k.about)}</small></span></button>`).join('')}`,{up:true,label:'Kind of video'});
};
window.setKind=id=>{Studio.N.mode=id;Studio.save();dockRefresh();if(Panel.id==='brief-settings')settingsPanel();};
/** Adds dropped or picked files to the brief, each as the kind its type suggests. */
async function dropFiles(files){
 const N=Studio.N;if(!files.length)return;
 const video=files.filter(f=>/^(video|audio)\//.test(f.type)||/\.(mkv|mov|mp4|webm|m4a|wav|mp3)$/i.test(f.name)),rest=files.filter(f=>!video.includes(f));
 if(video.length&&N.mode==='motion'&&!N.text.trim()){N.mode='edit';Studio.save();toast('Switched to Edit my footage for your video. Change it with the pill if you meant a reference.');}
 if(video.length)await briefUpload(N.mode==='edit'?'footage':'reference',video);
 const images=rest.filter(f=>/^image\//.test(f.type)),others=rest.filter(f=>!images.includes(f));
 if(images.length)await briefUpload(N.mode==='art'?'reference':'asset',images);
 if(others.length&&N.mode!=='art')await briefUpload('asset',others);
 dockRefresh();
}
window.briefRemove=button=>changeUpload({...button.dataset,request:Studio.N.id},'trash').catch(e=>toast(e.message,true));
document.addEventListener('dragover',e=>{if(App.route==='create'&&e.dataTransfer?.types.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(App.route==='create'&&e.dataTransfer?.files.length&&!e.target.closest('.dock,.overlay')){e.preventDefault();dropFiles([...e.dataTransfer.files]);}});
/** A link written alone or inside the text becomes the brief's link (read for facts and brand). */
function createSend(){
 const N=Studio.N;
 if(N.mode==='motion'&&!N.link){const m=/https?:\/\/\S+/.exec(N.text);if(m){N.link=m[0].replace(/[),.]+$/,'');N.text=N.text.replace(m[0],'').trim();Studio.save();}}
 sendBrief().then(()=>{dockRefresh();});
}

// ---------- Rules and Settings panels ----------
// Keep reference files with the saved cards without putting media into localStorage.
function instructionStore(mode,write){
 return new Promise((resolve,reject)=>{
  const open=indexedDB.open('tempoloom-instructions',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('draft');
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction('draft',mode);
   const req=write(tx.objectStore('draft'));
   tx.oncomplete=()=>{db.close();resolve(req.result);};
   tx.onabort=()=>{db.close();reject(tx.error||new Error('Instruction storage is unavailable'));};
  };
 });
}
const readInstructions=()=>instructionStore('readonly',store=>store.get('cards'));
const instructionId=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),byte=>byte.toString(16).padStart(2,'0')).join('');
const blankInstruction=(text='')=>({id:instructionId(),enabled:true,title:'',text,reference:null});
const hasInstructionContent=card=>card.title.trim()||card.text.trim()||card.reference;
const activeInstructions=cards=>cards.filter(card=>card.enabled&&hasInstructionContent(card));
function setInstructionIndicator(dock,active){
 const button=dock?.querySelector('#dock-instructions');
 if(!button)return;
 button.toggleAttribute('data-instructions-active',active);
 button.setAttribute('aria-description',active?'Instructions are active':'No active instructions');
}
function instructionNotes(cards){
 return activeInstructions(cards).map(card=>[
  card.title.trim(),card.text.trim(),card.reference?`Reference: ${instructionFileName(card)}`:''
 ].filter(Boolean).join('\n')).join('\n\n');
}
function instructionFileName(card){
 const ext=card.reference.name.slice(card.reference.name.lastIndexOf('.')).toLowerCase();
 return `instruction-${card.id}${ext}`;
}
window.rulesPanel=async()=>{
 if(Panel.id==='rules'){Panel.close();dockRefresh();return;}
 const draft=Studio.N,route=App.route,otherPanel=Panel.id;
 let cards;
 try{cards=(await readInstructions()??[blankInstruction(draft.notes)]).filter(hasInstructionContent);}
 catch{toast('Could not open saved instructions.',true);return;}
 if(draft!==Studio.N||route!==App.route||otherPanel!==Panel.id)return;
 Panel.open({id:'rules',title:'Instructions',
  body:`<div class="instruction-list"></div><button type="button" class="btn instruction-add">${I.add} Add instruction</button>`,
  foot:`<button class="btn primary" id="save-video-instructions">Save</button>`});
 const list=$('.instruction-list',Panel.body()),save=$('#save-video-instructions');
 const draw=()=>{
  list.innerHTML=cards.map((card,n)=>`<section class="instruction-card video-setting" aria-label="Instruction ${n+1}">
   <div class="instruction-head">
    <input data-enabled type="checkbox" role="switch" aria-label="Enable instruction ${n+1}" ${card.enabled?'checked':''}>
    <input data-title type="text" aria-label="Instruction title" maxlength="100" placeholder="Instruction title" value="${esc(card.title)}" dir="auto">
    <button type="button" class="iconbtn sm" data-remove aria-label="Remove instruction ${n+1}">${I.trash}</button>
   </div>
   <div class="instruction-body">
    <div class="instruction-reference">
     <button type="button" data-reference class="btn" aria-label="${card.reference?'Replace':'Add'} reference for instruction ${n+1}">
      ${card.reference?'':I.add}<span>${esc(card.reference?.name||'Reference')}</span>
     </button>
     <input data-file type="file" hidden accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm">
     ${card.reference?`<button type="button" class="iconbtn sm" data-detach aria-label="Remove reference from instruction ${n+1}">${I.x}</button>`:''}
    </div>
    <textarea data-guideline dir="auto" maxlength="2000" aria-label="Guideline" placeholder="Create a guideline for your agent">${esc(card.text)}</textarea>
   </div>
  </section>`).join('');
  [...list.children].forEach((el,index)=>{
   const card=cards[index],file=$('[data-file]',el);
   $('[data-title]',el).oninput=e=>{card.title=e.target.value;};
   $('[data-guideline]',el).oninput=e=>{card.text=e.target.value;};
   $('[data-enabled]',el).onchange=e=>{card.enabled=e.target.checked;};
   $('[data-remove]',el).onclick=()=>{cards.splice(index,1);draw();$('.instruction-add',Panel.body()).focus();};
   $('[data-reference]',el).onclick=()=>file.click();
   file.onchange=()=>{
    const reference=file.files[0];if(!reference)return;
    if(!/\.(png|jpe?g|webp|mp4|mov|webm)$/i.test(reference.name))return toast('Choose an image or video reference.',true);
    if(reference.size>(Studio.S?.can?.maxMB??100)*1048576)return toast('This reference is too large.',true);
    card.id=instructionId();card.reference=reference;draw();
   };
   const detach=$('[data-detach]',el);
   if(detach)detach.onclick=()=>{card.reference=null;draw();$('[data-reference]',list.children[index]).focus();};
  });
 };
 $('.instruction-add',Panel.body()).onclick=()=>{cards.push(blankInstruction());draw();$('[data-title]',list.lastElementChild).focus();};
 save.onclick=async()=>{
  if(instructionNotes(cards).length>2000)return toast('Keep enabled instructions under 2,000 characters.',true);
  save.disabled=true;
  try{
   await instructionStore('readwrite',store=>store.put(cards.filter(hasInstructionContent),'cards'));
   draft.notes='';
   Studio.save();
   setInstructionIndicator(Dock.el,activeInstructions(cards).length>0);
   if(save.isConnected)Panel.close();
   dockRefresh();
  }catch{toast('Could not save the instructions on this device.',true);}
  finally{save.disabled=false;}
 };
 draw();
 dockRefresh();
};
const SHAPES=[['','Auto',''],['horizontal','16:9','width:18px;height:10px'],['vertical','9:16','width:10px;height:18px'],['square','1:1','width:14px;height:14px']];
window.settingsPanel=()=>{
 const N={...Studio.N},S=Studio.S||{profiles:[],taught:[],looks:[]},m=N.mode==='motion',art=N.mode==='art';
 const sel=(id,opts,val,label)=>`<div class="video-setting-field"><label class="field-label" for="${id}">${label}</label><select id="${id}">${opts.map(([v,l])=>`<option value="${esc(v)}"${String(val)===String(v)?' selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
 const shapes=`<div class="seg-tiles" role="group" aria-label="Shape">${SHAPES.map(([v,l,box])=>`<button type="button" aria-pressed="${(N.shape||'')===v}" data-shape="${v}">${box?`<i class="shape" style="${box}"></i>`:I.spark}<span>${esc(l)}</span></button>`).join('')}</div>`;
 const toggle=(id,on,title,icon)=>`<label class="video-setting"><span class="video-setting-icon" aria-hidden="true">${I[icon]}</span><b>${esc(title)}</b><input type="checkbox" role="switch" id="${id}" ${on?'checked':''}></label>`;
 const styles=[['','Choose a style'],...(S.looks||[]).map(l=>[l.name,l.name]),...(S.taught||[]).map(v=>[v.id,v.title])];
 Panel.open({id:'brief-settings',title:'Settings for this video',
  body:`<div class="video-settings"><section class="video-settings-section"><h3 class="field-label">Shape</h3>${shapes}</section>
   <section class="video-settings-section"><h3 class="field-label">Production</h3><div class="video-settings-grid">
   ${art?sel('medium',[['','Studio chooses'],['watercolor','Watercolour'],['oil','Oil'],['acrylic','Acrylic'],['gouache','Gouache'],['pencil','Pencil'],['charcoal','Charcoal'],['ink','Ink'],['pastel','Pastel'],['mixed','Mixed media']],N.medium||'','Medium')
    :m?toggle('voice',N.voice,'Voice-over','sound'):toggle('captions',N.captions,'Captions','captions')}
   ${N.mode==='edit'?`<div class="video-settings-full">${toggle('visuals',N.visuals,'Designed visuals','spark')}</div>`:''}
   </div></section>
   ${m&&(S.taught?.length||styles.length>2)?`<section class="video-settings-section"><h3 class="field-label">Style</h3><div class="video-settings-grid">
   ${m&&S.taught?.length?sel('like',[['','None'],...S.taught.map(v=>[v.id,v.title])],N.like,'Reference style'):''}
   ${m&&styles.length>2?`<div class="video-mix-toggle">${toggle('useMix',N.useMix,'Blend two styles','spark')}</div>
    <div class="video-settings-grid video-mix-options" data-mix-options ${N.useMix?'':'hidden'}>${sel('mixA',styles,N.mixA||'','Style A')}${sel('mixB',styles,N.mixB||'','Style B')}
    <div class="video-mix-weight"><label class="field-label" for="mixWeight">Style blend <b id="mixLabel">${N.mixWeight??70}% A, ${100-(N.mixWeight??70)}% B</b></label><input type="range" id="mixWeight" min="0" max="100" step="5" value="${N.mixWeight??70}" style="width:100%"></div></div>`:''}
   </div></section>`:''}
   <section class="video-settings-section"><h3 class="field-label">Review</h3><div class="video-settings-grid">
   ${(S.profiles||[]).length>1?sel('profile',S.profiles.map(p=>[p.id==='main'?'':p.id,p.name]),N.profile,'Taste profile'):''}
   ${toggle('second',N.second!==false,'Second opinion','eye')}
   </div></section></div>`,
  foot:`<button class="btn primary" id="save-video-settings">Save</button>`});
 const B=Panel.body();
 $('#save-video-settings').onclick=()=>{
  for(const key of VIDEO_SETTINGS_KEYS)Studio.N[key]=N[key];
  Studio.save();
  Panel.close();
  dockRefresh();
 };
 B.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{N.shape=b.dataset.shape;B.querySelectorAll('[data-shape]').forEach(option=>option.setAttribute('aria-pressed',String(option===b)));});
 for(const id of ['medium','profile','mixA','mixB'])if($('#'+id,B))$('#'+id,B).onchange=e=>{N[id]=e.target.value;};
 for(const id of ['voice','captions','visuals'])if($('#'+id,B))$('#'+id,B).onchange=e=>{N[id]=e.target.checked;};
 if($('#second',B))$('#second',B).onchange=e=>{N.second=e.target.checked;};
 const referenceStyle=$('#like',B),blend=$('#useMix',B);
 const showBlend=()=>{$('[data-mix-options]',B).hidden=!N.useMix;};
 if(referenceStyle)referenceStyle.onchange=()=>{
  N.like=referenceStyle.value;
  if(N.like){
   N.same=false;
   N.useMix=false;
   if(blend){blend.checked=false;showBlend();}
  }
 };
 if(blend)blend.onchange=()=>{
  N.useMix=blend.checked;
  if(N.useMix){
   N.same=false;
   N.like='';
   if(referenceStyle&&referenceStyle.value){
    referenceStyle.value='';
    referenceStyle.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }
  showBlend();
 };
 if($('#mixWeight',B))$('#mixWeight',B).oninput=e=>{N.mixWeight=Number(e.target.value);$('#mixLabel').textContent=`${N.mixWeight}% A, ${100-N.mixWeight}% B`;};
 dockRefresh();
};

// ---------- the picker: files for this video, or from your library ----------
const Picker={
 tab:'footage',chosen:new Set(),lib:null,busy:false,
 get kinds(){return FILE_KINDS.filter(kind=>kind.modes.includes(Studio.N.mode));},
 remaining(kind){
  const limit=Studio.S?.can?.fileLimits?.[kind.id]??(kind.multiple?Infinity:1);
  return Math.max(0,limit-Studio.N.files.filter(file=>file.kind===kind.id).length);
 },
 accepts(kind,name){return kind.accept.split(',').includes(name.slice(name.lastIndexOf('.')).toLowerCase());},
 libraryKind(entry){
  const mode=Studio.N.mode;
  if(entry.available===false||entry.bytes>(Studio.S?.can?.maxMB??Infinity)*1048576)return;
  if(mode==='art'&&!['image','logo','clip'].includes(entry.kind))return;
  const id=mode==='art'?'reference':entry.kind==='logo'?'logo':entry.kind==='clip'?(mode==='edit'?'footage':'reference'):'asset';
  return this.kinds.find(kind=>kind.id===id&&this.accepts(kind,entry.name));
 },
 open(tab){
  if(this.busy||Studio.busy||Studio.sending)return;
  const kinds=this.kinds;
  this.tab=tab&&(tab==='library'||kinds.some(k=>k.id===tab))?tab:(kinds[0]?.id||'reference');this.chosen.clear();this.lib=null;
  Overlay.open(`<div class="picker"><header class="picker-head"><h2 tabindex="-1" autofocus>Add files</h2><button type="button" class="iconbtn sm" aria-label="Close" onclick="Overlay.close()">${I.x}</button></header>
   <nav class="picker-side" id="pick-side" aria-label="Kinds of file"></nav><div class="picker-main" id="pick-main"></div>
   <footer class="picker-foot"><button type="button" class="btn picker-upload" id="pick-upload">${I.upload} Upload files</button><input type="file" id="pick-file" hidden><button type="button" class="btn primary" id="pick-use" hidden>Add selected</button></footer></div>`,{label:'Add files',onclose:dockRefresh});
  $('#pick-upload').onclick=()=>$('#pick-file').click();
  $('#pick-file').onchange=e=>{const files=[...e.target.files];e.target.value='';this.upload(files);};
  $('#pick-use').onclick=()=>this.useLibrary();
  this.draw();
 },
 async upload(files){
  const kind=this.kinds.find(k=>k.id===this.tab);
  if(!kind||this.busy||Studio.busy||Studio.sending||!files.length)return;
  const sizeLimit=(Studio.S?.can?.maxMB??Infinity)*1048576;
  const eligible=files.filter(file=>this.accepts(kind,file.name)&&file.size>0&&file.size<=sizeLimit).slice(0,this.remaining(kind));
  if(eligible.length<files.length)toast('Some files are unsupported, empty, too large, or exceed the limit for this category.',true);
  if(!eligible.length)return;
  this.busy=true;this.draw();
  try{await briefUpload(kind.id,eligible,{replaceLogo:false});}
  finally{this.busy=false;this.draw();dockRefresh();}
 },
 async draw(){
  const N=Studio.N,side=$('#pick-side'),main=$('#pick-main');if(!side)return;
  const kind=this.kinds.find(k=>k.id===this.tab),input=$('#pick-file'),upload=$('#pick-upload'),use=$('#pick-use');
  side.innerHTML=[...this.kinds,{id:'library',icon:'folder',label:'Library'}].map(k=>`<button type="button" class="navlink" data-pick-tab="${k.id}" ${this.tab===k.id?'aria-current="page"':''} ${this.busy?'disabled':''}>${I[k.icon]}<span class="lbl">${k.label}</span></button>`).join('');
  side.querySelectorAll('[data-pick-tab]').forEach(button=>button.onclick=()=>{this.tab=button.dataset.pickTab;this.chosen.clear();this.draw();$(`[data-pick-tab="${this.tab}"]`,side)?.focus();});
  upload.hidden=!kind;upload.disabled=this.busy||!kind||!this.remaining(kind);
  use.hidden=!!kind;use.disabled=this.busy||!this.chosen.size;
  if(kind){input.accept=kind.accept;input.multiple=kind.multiple;}
  if(this.busy){main.innerHTML='<p class="muted" role="status"><span class="spin"></span> Adding files…</p>';return;}
  if(kind){
   const mine=N.files.filter(file=>file.kind===kind.id);
   main.innerHTML=mine.length?`<div class="pick-grid">${mine.map(file=>`<div class="pick"><span class="thumb">${uploadPreview(file,N.id)}</span><span dir="auto">${esc(file.name)}</span><button type="button" class="iconbtn sm pick-remove" aria-label="Move ${esc(file.name)} to Trash" data-kind="${esc(file.kind)}" data-name="${esc(file.name)}" onclick="briefRemove(this).then(()=>Picker.draw())">${I.x}</button></div>`).join('')}</div>`
    :`<div class="picker-empty"><h3>No ${kind.label.toLowerCase()} yet</h3></div>`;
  }else{
   if(!this.lib){
    main.innerHTML='<p class="muted" role="status"><span class="spin"></span> Opening your library</p>';
    try{const {entries}=await api('/api/library');if($('#pick-main')!==main||this.tab!=='library')return;this.lib=entries;}
    catch{if($('#pick-main')===main&&this.tab==='library')main.textContent='Could not open the library.';return;}
   }
   const selected=this.lib.filter(entry=>this.chosen.has(entry.id));
   main.innerHTML=this.lib.length?`<div class="pick-grid">${this.lib.map((entry,index)=>{
    const kind=this.libraryKind(entry),active=this.chosen.has(entry.id);
    const disabled=!active&&(!kind||selected.filter(e=>this.libraryKind(e)?.id===kind.id).length>=this.remaining(kind));
    return `<button type="button" class="pick" aria-pressed="${active}" data-library-index="${index}" ${disabled?'disabled':''}><span class="thumb">${libThumb(entry)}</span><span dir="auto">${esc(entry.name)}</span></button>`;
   }).join('')}</div>`:'<div class="picker-empty"><h3>Your library is empty</h3></div>';
   main.querySelectorAll('[data-library-index]').forEach(button=>button.onclick=()=>{
    const index=button.dataset.libraryIndex,id=this.lib[Number(index)].id;
    if(this.chosen.has(id))this.chosen.delete(id);else this.chosen.add(id);
    this.draw();$(`[data-library-index="${index}"]`,main)?.focus();
   });
  }
  wireUploadPreviews(main);
 },
 async useLibrary(){
  const picked=this.lib?.filter(entry=>this.chosen.has(entry.id));
  if(!picked?.length||this.busy||Studio.busy||Studio.sending)return;
  const draft=Studio.N;let lastKind;
  this.busy=true;this.draw();
  try{
   for(const entry of picked){
    if(Studio.N!==draft)break;
    const kind=this.libraryKind(entry);if(!kind||!this.remaining(kind))continue;
    try{
     const response=await fetch(withKey(`/api/library/${encodeURIComponent(entry.id)}/file`));
     if(!response.ok)throw new Error(`Could not open ${entry.name}.`);
     const blob=await response.blob();if(Studio.N!==draft)break;
     if(await briefUpload(kind.id,[new File([blob],entry.name,{type:blob.type})],{replaceLogo:false})){lastKind=kind.id;this.chosen.delete(entry.id);}
    }catch(error){toast(error.message,true);}
   }
  }finally{if(lastKind){this.tab=lastKind;this.chosen.clear();}this.busy=false;this.draw();dockRefresh();}
 }};
const LIB_LABEL={logo:'Logo',image:'Picture',music:'Music',sound:'Sound',clip:'Clip'};
const libThumb=e=>['logo','image','clip'].includes(e.kind)?`${I[e.kind==='clip'?'film':'image']}<img class="upload-preview" loading="lazy" alt="" src="${esc(withKey(`/api/library/${encodeURIComponent(e.id)}/file?preview=1`))}">`:I[e.kind==='music'?'music':'sound'];
