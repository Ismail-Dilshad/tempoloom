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
 // Create also lists every video the studio made (the gallery), to play, rate and delete.
 load:async()=>{const [s,g,lib,sc]=await Promise.all([Studio.load(),api('/api/gallery').catch(()=>({items:[]})),api('/api/library').catch(()=>({entries:[]})),api('/api/scenes').catch(()=>({scenes:[]}))]);s.gallery=g;s.library=lib.entries||[];s.scenes=sc.scenes||[];return s;},
 hold:()=>!!Studio.busy||Studio.sending||!!$('.rename-pop'),
 render(el){
  // Create holds everything in one grid, with one card for all of it: your uploads first (they
  // belong to your next video), then your projects and what the studio made, newest first.
  const S=this.data||{},draft=Studio.N,files=draft.files.filter(f=>!draft.instructionFiles?.includes(f.name));
  // A copy of something the studio made (added by selecting it) shows as that item, not as an upload too.
  // A copy of a library file shows as its library card, not as an upload too.
  const libNames=new Set((S.library||[]).map(e=>e.name));
  const uploads=files.filter(f=>!f.name.startsWith('made-')&&!libNames.has(f.name));
  const videos=S.gallery?.items||[],pictures=studioOutputs(S).filter(o=>o.type==='image');
  const queued=(S.requests||[]).filter(r=>r.status==='waiting'),jobs=(S.jobs||[]).filter(j=>!j.archived);
  const group=(html,g)=>html.replace(/^<(\w+) /,`<$1 data-group="${g}" `);
  const rest=[...queued.map(r=>({at:r.created,html:queuedTile(r)})),...jobs.map(j=>({at:j.updated||j.created,html:projectTile(j)})),
   ...videos.map(v=>({at:v.made,html:videoCard(v)})),...(S.looks||[]).map(l=>({at:'',html:lookCard(l)})),...(S.taught||[]).map(v=>({at:'',html:taughtStyleCard(v)})),
   ...(S.library||[]).map(e=>({at:e.added||'',html:libraryCard(e,draft)})),...(S.scenes||[]).filter(x=>x.locked).map(x=>({at:'',html:sceneCard(x)})),...pictures.map(o=>({at:o.at||'',html:outputCard(o)}))].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const cards=[...uploads.map(f=>group(uploadCard(f,draft.id),'uploads')),...rest.map(x=>x.html)];
  el.innerHTML=cards.length?`${CreateFind.bar()}
   <section class="no-head create-section" data-section="all" aria-label="Your uploads, projects and what the studio made"><div class="card-grid upload-grid create-uploads" data-uploads>${cards.join('')}</div></section>
   ${CreateFind.emptyHtml()}`:`<div class="no-head create-page"><div class="create-welcome">
   <div class="create-emblem"><span class="create-halo" aria-hidden="true"></span><img src="/mark.svg?v=10" alt="Tempoloom" width="84" height="84"></div>
   <h2>What will you <em>make</em> today?</h2>
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
  wireUploadCards(el);wireLookCards(el);wireLibraryCards(el);wireMarquee(el);CreateFind.wire(el);DrawerWork.reopen();
  el.querySelectorAll('[data-create-path]').forEach(button=>button.onclick=()=>{
   const path=button.dataset.createPath;
   setKind(path==='edit'?'edit':'motion');
   if(path==='reference'){Picker.open('reference');return;}
   Dock.focus();
  });
 }});
// ---------- one search and one filter over everything on Create ----------
// The search finds uploads, projects and what the studio made by name; Ctrl+K jumps to it on Create.
// The filter shows one kind at a time. Both only hide cards: nothing is reloaded while you type.
const CreateFind={
 q:'',searchLabel:'Search uploads, projects and what the studio made',
 KINDS:[['all','All'],['uploads','Uploads'],['projects','Projects'],['made','Made by the studio'],['looks','Looks'],['library','Library'],['scenes','Locked scenes']],
 get kind(){return store.get('create-filter','all');},set kind(v){store.set('create-filter',v);},
 bar(){
  const picked=this.selectionBar?.();if(picked)return picked;
  const k=this.kind,label=this.KINDS.find(x=>x[0]===k)?.[1]||'All';
  return `<div class="create-find no-head" role="search">
   <label class="create-find-box">${I.search}<input type="search" id="create-search" placeholder="Search" aria-label="${esc(this.searchLabel)}" aria-keyshortcuts="Control+K" autocomplete="off" value="${esc(this.q)}"><kbd aria-hidden="true">Ctrl K</kbd></label>
   <button type="button" class="iconbtn find-filter" id="create-filter" aria-haspopup="menu" aria-expanded="false" aria-label="Show: ${esc(label)}" data-tooltip="Show: ${esc(label)}" ${k!=='all'?'data-active':''}>${I.filter}</button>
  </div>`;
 },
 wire(el){
  const input=$('#create-search',el);if(!input)return;
  input.oninput=()=>{this.q=input.value;this.apply(el);};
  input.onkeydown=e=>{if(e.key==='Escape'&&input.value){e.preventDefault();e.stopPropagation();input.value='';this.q='';this.apply(el);}};
  $('#create-filter',el).onclick=e=>this.menu(e.currentTarget);
  this.apply(el);
 },
 menu(btn){
  const m=Pop.open(btn,`<div class="pop-head">Show</div>${this.KINDS.map(([k,l])=>`<button type="button" class="pop-item" role="menuitemradio" aria-checked="${this.kind===k}" data-kind="${k}" data-close>${esc(l)}</button>`).join('')}`,{align:'end',label:'Show'});
  m?.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{this.kind=b.dataset.kind;Pop.close();App.show(false);$('#create-filter')?.focus();});
 },
 apply(el){
  const q=this.q.trim().toLowerCase(),kind=this.kind;let n=0;
  el.querySelectorAll('[data-section] [data-uploads]>*').forEach(card=>{
   const hit=(kind==='all'||String(card.dataset.group||'').split(' ').includes(kind))&&(!q||String(card.dataset.find||card.dataset.name||card.textContent).toLowerCase().includes(q));
   card.hidden=!hit;if(hit)n++;
  });
  el.querySelectorAll('[data-section]').forEach(sec=>{sec.hidden=!n;});
  const none=el.querySelector('.create-none');if(!none)return;
  none.hidden=!!n;if(n)return;
  // Nothing to show: say why, softly, with the one thing that brings the cards back.
  const label=(this.KINDS.find(x=>x[0]===kind)?.[1]||'').toLowerCase();
  $('.create-none-title',none).textContent=q?`No results for “${this.q.trim()}”`:`No ${label} yet`;
  $('.create-none-text',none).textContent=q?'Check the spelling or try another word.':'They show up here once there are some.';
  const btn=$('.create-none-reset',none);btn.textContent=q?'Clear search':'Show all';btn.hidden=!q&&kind==='all';
  btn.onclick=()=>{if(q){this.q='';const i=$('#create-search');if(i)i.value='';}else this.kind='all';if(q&&kind==='all')this.apply(el);else App.show(false);$('#create-search')?.focus();};
 },
 emptyHtml(){
  return `<div class="no-head create-none" role="status" hidden>
   <span class="create-none-icon" aria-hidden="true">${I.search}</span>
   <h2 class="create-none-title"></h2><p class="create-none-text"></p>
   <button type="button" class="btn create-none-reset"></button></div>`;
 },
 focus(){const i=$('#create-search');if(!i)return false;i.focus();i.select();return true;}
};
// Learn uses the same search and filter over what the studio learned from (teach.js draws it).
const LearnFind={__proto__:CreateFind,q:'',searchLabel:'Search what the studio learned from',
 get KINDS(){return [['all','All'],['good','Good examples'],['bad','Bad examples'],...(Teach.S?.groups||[]).map(g=>[g.id,g.label]),['waiting','Not studied yet']];},
 get kind(){return store.get('learn-filter','all');},set kind(v){store.set('learn-filter',v);}};
/** Lets the search find a card by words that are not on it (a project's kind and state). */
const findable=(html,text)=>html.replace(/^<(\w+) /,`<$1 data-find="${esc(text)}" `);

/** What the studio made: the pictures and videos its steps showed, newest video and last step first. */
function studioOutputs(S){
 const out=[];
 const jobs=[...(S?.jobs||[])].filter(j=>!j.archived).sort((a,b)=>String(b.updated).localeCompare(String(a.updated)));
 for(const j of jobs){
  const title=String(j.brief?.text||j.request||j.kind||j.job).split('\n')[0].slice(0,80);
  for(const t of [...(j.tasks||[])].reverse()){
   if(t.gate||!t.show?.length||!['done','redo'].includes(t.status))continue;
   for(const s of t.show)if(s.type==='image'||s.type==='video')out.push({job:j.job,title,step:t.title,index:t.index,k:s.k,type:s.type,name:s.name,at:j.updated});
  }
 }
 return out.slice(0,48);
}
// ---------- what the studio made, on Create: the same card as your uploads ----------
// A still and the name on hover, with a ••• menu in its corner: a video opens on its own page (to
// play, rate and delete it), downloads, or is deleted; a picture opens the project that made it.
const RATINGS=[['good','Good'],['ok','Not bad'],['bad','Bad']];
const madeVideos=()=>App.screens.create?.data?.gallery?.items||App.screens['made-video']?.data?.items||[];
const madeVideo=id=>madeVideos().find(v=>v.id===id);
// Something the studio made is selected like an upload: selecting it adds a copy named made-<id> to
// the prompt as a reference (that copy does not show as a separate upload card).
const madeName=(id,file)=>`made-${String(id).replace(/[^a-z0-9-]/gi,'-')}${(/\.[a-z0-9]{2,5}$/i.exec(file)||['.mp4'])[0].toLowerCase()}`;
const madeInPrompt=name=>Studio.N.files.some(f=>f.name===name&&!f.detached);
const madeSelect=(name,label)=>{const on=madeInPrompt(name);return `<button type="button" class="upload-select" aria-pressed="${on}" aria-label="${on?'Remove':'Add'} ${esc(label)} ${on?'from':'to'} prompt"><span aria-hidden="true">${on?I.check:I.add}</span></button>`;};
/** Puts something the studio made in the prompt (uploading a copy the first time), or takes it out. */
async function toggleMade(card,on){
 const name=card.dataset.madeName,draft=Studio.N,have=draft.files.find(f=>f.name===name);
 if(have)return setPromptFiles([{request:draft.id,kind:have.kind,name,attached:on}]);
 if(!on)return;
 try{
  const blob=await (await fetch(card.dataset.madeSrc)).blob();
  await briefUpload(Studio.N.mode==='edit'&&/^video\//.test(blob.type)?'footage':'reference',[new File([blob],name,{type:blob.type})]);
 }catch(e){toast(e.message,true);showSelected(card,false);}
}
function videoCard(v){
 const name=madeName(v.id,v.name);
 return `<article class="upload-card output-card video-card" data-group="made" data-video="${esc(v.id)}" data-name="${esc(v.title)}" data-made-name="${esc(name)}" data-made-src="${esc(withKey('/gallery/file/'+v.id))}" data-find="${esc(`${v.title} ${v.name} ${v.kind} ${v.rating||''}`)}">
  ${I.film}<img class="upload-preview" loading="lazy" alt="" src="${esc(withKey('/gallery/thumb/'+v.id))}">
  ${madeSelect(name,v.title)}
  <span class="upload-name" dir="auto">${esc(v.title)}</span>
  <button type="button" class="iconbtn sm upload-action" aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${esc(v.title)}" onclick="madeVideoMenu(this,'${esc(v.id)}')">${I.more}</button></article>`;
}
window.madeVideoMenu=(btn,id)=>{
 const v=madeVideo(id);if(!v)return;
 const menu=Pop.open(btn,`<button type="button" class="pop-item" role="menuitem" data-open>${I.play||I.film}<span>Open</span></button>
  <button type="button" class="pop-item" role="menuitem" data-edit>${I.cut}<span>Edit in Editor</span></button>
  <a class="pop-item" role="menuitem" href="${esc(withKey('/gallery/file/'+v.id))}&dl=1" download>${I.down}<span>Download</span></a>
  <button type="button" class="pop-item danger" role="menuitem" data-delete>${I.trash}<span>Delete</span></button>`,{align:'end',label:'Video options'});
 if(!menu)return;
 $('[data-open]',menu).onclick=()=>{Pop.close(true);location.hash='#/videos/'+encodeURIComponent(v.id);};
 $('[data-edit]',menu).onclick=()=>{Pop.close(true);openInEditor(withKey('/gallery/file/'+v.id),v.title||v.name);};
 $('[data-delete]',menu).onclick=()=>{Pop.close(true);deleteMadeVideo(v.id);};
};
/** Deletes a video from your computer for good, wherever it is, and from everywhere it shows:
 *  the list, its own page, and the prompt (a copy added by selecting it goes too). */
async function deleteMadeVideo(id,after){
 const v=madeVideo(id);if(!v)return;
 if(!await ask('Delete this video?','It is deleted from your computer and from everywhere here. This cannot be undone.','Delete',true,{file:{name:v.title||v.name,meta:[v.seconds?fmtS(v.seconds):'',mb(v.bytes),v.file].filter(Boolean).join(' · '),thumb:withKey('/gallery/thumb/'+v.id)}}))return;
 try{await api('/api/gallery/'+v.id,{method:'DELETE'});}catch(e){return toast(e.message,true);}
 const name=madeName(v.id,v.name),draft=Studio.N;
 if(draft.id&&draft.files.some(f=>f.name===name))try{draft.files=(await api(`/api/studio/requests/${draft.id}/files?name=${encodeURIComponent(name)}`,{method:'DELETE'})).files;Studio.save();}catch{/* the file itself is gone already */}
 toast('Deleted from your computer');
 if(after)after();else App.refresh(true);
}

// ---------- a video the studio made, on its own page: play it, rate it, delete it ----------
App.register('made-video',{
 title:a=>madeVideo(a)?.title||'Video',
 load:()=>api('/api/gallery'),
 render(el,arg){
  const v=(this.data?.items||[]).find(x=>x.id===arg);
  if(!v){el.innerHTML=`<div class="empty"><h2>This video is not here any more</h2><a class="btn" href="#/create">Back to Create</a></div>`;return;}
  const src=withKey('/gallery/file/'+v.id),kind={final:'Final video',preview:'Preview',export:'Export'}[v.kind]||'Video';
  // One flat page, no boxes: a bar to go back and act on it, the video filling the space between at
  // its own shape, and what it is with how you rate it underneath. It fits the screen at any size.
  const facts=[kind,v.seconds?fmtS(v.seconds):'',v.width&&v.height?`${v.width}×${v.height}`:'',mb(v.bytes)].filter(Boolean);
  el.innerHTML=`<div class="no-head video-page">
   <div class="video-bar">
    <a class="video-back" href="#/create">${I.back}<span>Create</span></a>
    <div class="video-actions">
     ${v.job?`<a class="video-act" aria-label="Open project" href="#/projects/${encodeURIComponent(v.job)}">${I.folder}<span>Open project</span></a>`:''}
     <a class="video-act" aria-label="Download" href="${esc(src)}&dl=1" download>${I.down}<span>Download</span></a>
     <button type="button" class="video-act danger" id="vp-delete" aria-label="Delete">${I.trash}<span>Delete</span></button>
    </div>
   </div>
   <div class="video-frame"><video class="video-player" src="${esc(src)}" controls playsinline autoplay
     style="${v.width&&v.height?`aspect-ratio:${v.width}/${v.height}`:''}"></video></div>
   <div class="video-info">
    <div class="video-about"><h1 class="video-title" dir="auto" title="${esc(v.title)}">${esc(v.title)}</h1>
     <p class="video-facts">${facts.map(f=>`<span>${esc(f)}</span>`).join('')}</p></div>
    <div class="video-rate-wrap"><span class="video-rate-label">How is it?</span>
     <div class="video-rate" role="group" aria-label="Rate this video">${RATINGS.map(([r,l])=>`<button type="button" data-rate="${r}" aria-pressed="${v.rating===r}">${l}</button>`).join('')}</div>
     <div class="video-note" id="vp-note" role="dialog" aria-label="Why is it bad?" hidden>
      <label class="video-note-label" for="vp-why">What is wrong with it?</label>
      <textarea id="vp-why" dir="auto" maxlength="600" rows="3" placeholder="For example: the cuts are too slow."></textarea>
      <div class="video-note-actions"><button type="button" class="video-note-cancel" id="vp-cancel">Cancel</button><button type="button" class="video-note-send" id="vp-bad">Rate it bad</button></div>
     </div></div>
   </div>
  </div>`;
  const rate=async(rating,note='')=>{
   try{await api(`/api/gallery/${v.id}/rate`,{method:'POST',body:JSON.stringify({rating,note})});}catch(e){return toast(e.message,true);}
   v.rating=rating;el.querySelectorAll('[data-rate]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rate===rating)));
   toast(rating==='bad'?'Rated bad. The reason is remembered.':rating==='good'?'Rated good':'Rated not bad');
  };
  // Bad asks why in a small card floating over the page, so nothing on the page moves.
  const note=$('#vp-note',el),why=$('#vp-why',el);
  const closeNote=()=>{if(note.hidden)return;note.hidden=true;document.removeEventListener('pointerdown',outside,true);};
  const outside=e=>{if(!note.contains(e.target)&&!e.target.closest('[data-rate=bad]'))closeNote();};
  const openNote=()=>{note.hidden=false;why.focus();document.addEventListener('pointerdown',outside,true);};
  el.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{if(b.dataset.rate==='bad'){note.hidden?openNote():closeNote();return;}closeNote();rate(b.dataset.rate);});
  const send=()=>{const t=why.value.trim();if(t.length<4)return toast('Say what is wrong with it.',true);closeNote();rate('bad',t);};
  $('#vp-bad',el).onclick=send;$('#vp-cancel',el).onclick=()=>{closeNote();$('[data-rate=bad]',el).focus();};
  note.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();closeNote();$('[data-rate=bad]',el).focus();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))send();};
  $('#vp-delete',el).onclick=()=>deleteMadeVideo(v.id,()=>{location.hash='#/create';});
 },
 // Re-drawing while the video plays would restart it: the page only changes when you act on it.
 hold:()=>true
});

function outputCard(o){
 const url=withKey(`/studio-file/job/${encodeURIComponent(o.job)}/${o.index}/show-${o.k}`),name=madeName(`${o.job}-${o.index}-${o.k}`,o.name);
 return `<article class="upload-card output-card" data-group="made" data-name="${esc(o.step)}" data-made-name="${esc(name)}" data-made-src="${esc(url)}" data-find="${esc(`${o.step} ${o.title} ${o.name}`)}">
  ${I[o.type==='video'?'film':'image']}${o.type==='video'?`<video class="upload-preview" muted loop preload="metadata" playsinline src="${esc(url)}#t=0.5"></video>`:`<img class="upload-preview" loading="lazy" alt="" draggable="false" src="${esc(url)}">`}
  ${madeSelect(name,o.step)}
  <span class="upload-name" dir="auto">${esc(o.step)}</span>
  <button type="button" class="iconbtn sm upload-action" aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${esc(o.name)}" onclick="madePictureMenu(this,'${esc(o.job)}')">${I.more}</button></article>`;
}
/** A project, as the same card: its newest picture, its state, the name, and a ••• menu. */
function projectTile(j){
 const st=jobState(j).key,state={done:'Done',you:'Waiting for you',making:'Making'}[st],title=jobTitle(j);
 const thumb=jobThumb(j).replace(/^<(img|video) /,'<$1 class="upload-preview" ');
 // Its latest picture or video can be selected into the prompt, like anything the studio made.
 const src=/src="([^"]+)"/.exec(thumb)?.[1]?.replace(/#t=[\d.]+$/,'').replace(/&amp;/g,'&'),name=src?madeName('project-'+j.job,/show-/.test(src)&&/<video/.test(thumb)?'x.mp4':'x.png'):'';
  return `<article class="upload-card output-card project-tile" data-group="projects" data-name="${esc(title)}" data-job="${esc(j.job)}" ${src?`data-made-name="${esc(name)}" data-made-src="${esc(src)}"`:''} data-find="${esc(`${title} ${kindOf(j.mode).label} ${state}`)}">
  ${I[j.mode==='edit'?'film':j.mode==='art'?'brush':'spark']}${thumb.startsWith('<svg')?'':thumb}${src?madeSelect(name,title):''}
  <span class="tile-state" data-state="${st}">${esc(state)}</span>
  ${j.locked?.length?`<span class="tile-locks" title="${j.locked.length} locked scene${j.locked.length>1?'s':''}: open the project to see or unlock them">${I.lock}${j.locked.length}</span>`:''}
  <span class="upload-name" dir="auto">${esc(title)}</span>
  <button type="button" class="iconbtn sm upload-action" aria-haspopup="menu" aria-expanded="false" aria-label="More for ${esc(title)}" onclick="projectMenu(this,'${esc(j.job)}')">${I.more}</button></article>`;
}
/** A video sent to the studio that no one has started yet, as the same card. */
function queuedTile(r){
 const title=(r.input?.text||r.summary||'New video').split('\n')[0].slice(0,90);
 return `<article class="upload-card output-card project-tile" data-group="projects" data-name="${esc(title)}" data-find="${esc(`${title} sent not started`)}">
  ${I[r.input?.mode==='edit'?'film':r.input?.mode==='art'?'brush':'spark']}
  <span class="tile-state" data-state="sent">Sent, not started</span>
  <span class="upload-name" dir="auto">${esc(title)}</span>
  <button type="button" class="iconbtn sm upload-action" aria-haspopup="menu" aria-expanded="false" aria-label="More for this queued video" onclick="queuedMenu(this,'${r.id}')">${I.more}</button></article>`;
}
window.madePictureMenu=(btn,job)=>{
 const menu=Pop.open(btn,`<a class="pop-item" role="menuitem" href="#/projects/${encodeURIComponent(job)}">${I.film}<span>Open project</span></a>`,{align:'end',label:'Picture options'});
 menu?.querySelector('a')?.addEventListener('click',()=>Pop.close(true));
};
function uploadPreview(file,request,trashed=false){
 const kind=FILE_KINDS.find(k=>k.id===file.kind);
 const image=/\.(png|jpe?g|webp|svg)$/i.test(file.name),video=/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name);
 const url=withKey(`/studio-file/upload/${encodeURIComponent(request)}/${trashed?'trash':file.kind}/${encodeURIComponent(trashed?file.trashId:file.name)}`);
 return `${I[image?'image':video?'film':kind?.icon||'folder']}${image||video?`<img class="upload-preview" loading="lazy" alt="" src="${esc(url)}">`:''}`;
}
function uploadCard(file,request,trashed=false){
 return `<article class="upload-card" data-request="${esc(request)}" data-kind="${esc(file.kind)}" data-name="${esc(file.name)}" data-trash-id="${esc(file.trashId||'')}">
  ${uploadPreview(file,request,trashed)}
  ${trashed?'':`<button type="button" class="upload-select" aria-pressed="${!file.detached}" aria-label="${file.detached?'Add':'Remove'} ${esc(file.name)} ${file.detached?'to':'from'} prompt"><span aria-hidden="true">${file.detached?I.add:I.check}</span></button>`}
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
 // A video the studio made plays while the pointer is on it.
 root.querySelectorAll('.output-card video').forEach(v=>{const c=v.closest('.output-card');
  c.onpointerenter=()=>v.play().catch(()=>{});c.onpointerleave=()=>{v.pause();};});
 root.querySelectorAll('.upload-card').forEach(card=>{
  const button=$('[data-upload-menu]',card);
  if(button){
   const name=$('.upload-name',card);
   const fitName=()=>name.toggleAttribute('data-overflow',name.scrollWidth>name.clientWidth);
   fitName();card.onpointerenter=fitName;card.onfocusin=fitName;
   button.onclick=()=>uploadMenu(button,card.dataset);
   const select=$('.upload-select',card);
   wireCardDrag(card,select);
   select.onclick=async()=>{
    if(select.dragged){select.dragged=false;return;}// the end of a drag is not a click
    if(Studio.busy||Studio.sending)return;
    const attached=select.getAttribute('aria-pressed')!=='true';
    showSelected(card,attached);// at once, so the change animates; the refresh after keeps it
    if(await selectPromptFile(card.dataset,attached)){
     findUploadTile(card.dataset)?.querySelector('.upload-select')?.focus();
    }else showSelected(card,!attached);
   };
  }
  // Something the studio made: selected, dragged onto the prompt and boxed like an upload.
  if(card.dataset.madeName){
   const select=$('.upload-select',card);
   if(select){
    wireCardDrag(card,select);
    select.onclick=async()=>{
     if(select.dragged){select.dragged=false;return;}
     if(Studio.busy||Studio.sending)return;
     const on=select.getAttribute('aria-pressed')!=='true';
     showSelected(card,on);
     await toggleMade(card,on);
    };
   }
  }
  const restore=$('[data-upload-restore]',card);
  if(restore)restore.onclick=()=>restoreUpload(restore,card.dataset);
 });
}
// ---------- drag a card onto the prompt to add it ----------
// Press a card and move: a small copy of it follows the pointer and the prompt box says "Add
// reference" (or "Add to prompt"); let go over the box and the file goes in the prompt. Let go
// anywhere else and nothing changes.
function wireCardDrag(card,select){
 select.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.pointerType==='touch'||Studio.busy||Studio.sending)return;// a finger scrolls the page
  const x0=e.clientX,y0=e.clientY,dock=$('#dock');if(!dock)return;
  const inPrompt=()=>select.getAttribute('aria-pressed')==='true';
  let ghost=null,over=false;
  const label=card.dataset.madeName?'Add reference':card.dataset.kind==='reference'?'Add reference':card.dataset.kind==='footage'?'Add footage':card.dataset.kind==='logo'?'Add logo':'Add to prompt';
  const move=ev=>{
   if(!ghost){
    if(Math.hypot(ev.clientX-x0,ev.clientY-y0)<6)return;
    ghost=document.createElement('div');ghost.className='drag-ghost';ghost.setAttribute('aria-hidden','true');
    const img=card.querySelector('.upload-preview');ghost.innerHTML=img?`<img alt="" src="${esc(img.src)}">`:(card.querySelector('svg')?.outerHTML||'');
    document.body.append(ghost);document.body.classList.add('card-dragging');
    dock.dataset.dropLabel=inPrompt()?'Already in the prompt':label;dock.classList.add('card-drag');
    card.classList.add('drag-source');
   }
   ghost.style.transform=`translate(${ev.clientX-36}px,${ev.clientY-112}px) rotate(-4deg)`;// held just above the pointer
   const r=dock.getBoundingClientRect();over=ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom;
   dock.classList.toggle('drop-over',over);
  };
  const end=ev=>{
   window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);
   if(!ghost)return;
   select.dragged=true;setTimeout(()=>{select.dragged=false;},0);// swallow the click that follows
   ghost.remove();document.body.classList.remove('card-dragging');card.classList.remove('drag-source');
   dock.classList.remove('card-drag','drop-over');delete dock.dataset.dropLabel;
   if(over&&ev.type==='pointerup'&&!inPrompt()){showSelected(card,true);if(card.dataset.madeName)toggleMade(card,true);else setPromptFiles([{...card.dataset,attached:true}]);}
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
 });
}
/** Shows a card as selected or not before the server answers. */
function showSelected(card,on){
 const b=card.querySelector('.upload-select');if(!b)return;
 b.setAttribute('aria-pressed',String(on));
 b.setAttribute('aria-label',`${on?'Remove':'Add'} ${card.dataset.name} ${on?'from':'to'} prompt`);
 b.firstElementChild.innerHTML=on?I.check:I.add;
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
 const ext=file.name.slice(file.name.lastIndexOf('.'));
 renamePop(button,{value:file.name,label:'File name',max:90,select:file.name.length-ext.length,save:async value=>{
  const label=value.toLowerCase().endsWith(ext.toLowerCase())?value.slice(0,-ext.length):value;
  await changeUpload(file,'rename',{label});
  findUploadTile({...file,name:label.normalize('NFKC').trim()+ext})?.querySelector('[data-upload-menu]')?.focus();
 }});
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
 if(action==='attach')await settle();
 if(App.route==='create')App.show(false);
}
/** Lets a card finish easing into its new look before the page is drawn again. */
const settle=()=>new Promise(r=>setTimeout(r,matchMedia('(prefers-reduced-motion: reduce)').matches?0:300));
async function selectPromptFile(file,attached){
 try{await changeUpload(file,'attach',{attached});return true;}
 catch(error){toast(error.message,true);return false;}
}
/** Puts several uploads in or out of the prompt at once (one page refresh at the end). */
async function setPromptFiles(changes){
 const draft=Studio.N;changes=changes.filter(c=>c.request===draft.id);
 if(!changes.length||Studio.busy||Studio.sending)return;
 Studio.busy={kind:changes[0].kind,text:'Updating prompt'};
 try{
  for(const c of changes){
   const r=await api(`/api/studio/requests/${draft.id}/files`,{method:'PATCH',body:JSON.stringify({action:'attach',kind:c.kind,name:c.name,attached:c.attached})});
   if(draft===Studio.N)draft.files=r.files;
  }
  Studio.save();
 }catch(error){toast(error.message,true);}
 finally{Studio.busy=null;}
 await settle();
 if(App.route==='create')App.show(false);
}
// ---------- drag a box over the uploads to select them, like on a computer's desktop ----------
// Press on empty space and drag: only the cards the box touches change. If they are all selected
// already they are unselected, otherwise they are all selected; cards outside the box keep their
// state. A click on empty space changes nothing.
function wireMarquee(view){
 if(view.marqueeWired)return;view.marqueeWired=true;
 view.addEventListener('pointerdown',e=>{
  const learn=App.route==='teach/library'&&!App.arg;
  if(e.button!==0||!(App.route==='create'||learn)||Studio.busy||Studio.sending)return;
  const grid=view.querySelector('[data-uploads]');if(!grid)return;// only your uploads can be selected
  if(e.target.closest('.upload-card,button,a,input,textarea,select,label,.dock,.pop,[contenteditable]'))return;
  const cards=[...grid.querySelectorAll('.upload-card')].filter(c=>c.querySelector('.upload-select'));if(!cards.length)return;
  const x0=e.clientX,y0=e.clientY;
  const was=new Map(cards.map(c=>[c,c.querySelector('.upload-select').getAttribute('aria-pressed')==='true']));
  let box=null,hit=new Set(),unselect=false;
  const want=c=>hit.has(c)?!unselect:was.get(c);
  const move=ev=>{
   const x1=ev.clientX,y1=ev.clientY;
   if(!box){if(Math.hypot(x1-x0,y1-y0)<5)return;box=document.createElement('div');box.className='marquee';document.body.append(box);document.body.classList.add('marquee-on');}
   const l=Math.min(x0,x1),t=Math.min(y0,y1),r=Math.max(x0,x1),b=Math.max(y0,y1);
   Object.assign(box.style,{left:l+'px',top:t+'px',width:r-l+'px',height:b-t+'px'});
   hit=new Set(cards.filter(c=>{const q=c.getBoundingClientRect();return q.left<r&&q.right>l&&q.top<b&&q.bottom>t;}));
   unselect=hit.size>0&&[...hit].every(c=>was.get(c));
   for(const c of cards)c.toggleAttribute('data-marquee',want(c));
  };
  const up=()=>{
   view.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);
   if(!box)return;// a plain click on empty space: the selection stays as it is
   box.remove();document.body.classList.remove('marquee-on');
   const changed=cards.filter(c=>want(c)!==was.get(c));
   for(const c of cards){c.removeAttribute('data-marquee');if(changed.includes(c))showSelected(c,want(c));}
   if(learn){Learn.pick(changed.map(c=>c.dataset.taught),null,changed.map(c=>want(c)));return;}
   // Uploads change together; something the studio made is added (or taken out) one by one.
   const looks=changed.filter(c=>c.dataset.look),libs=changed.filter(c=>c.dataset.lib),made=changed.filter(c=>c.dataset.madeName),files=changed.filter(c=>!c.dataset.look&&!c.dataset.lib&&!c.dataset.madeName);
   if(looks.length){const picks=lookPicks().filter(n=>!looks.some(c=>c.dataset.look===n&&!want(c)));setLooks([...picks,...looks.filter(want).map(c=>c.dataset.look)]);}
   (async()=>{if(files.length)await setPromptFiles(files.map(c=>({...c.dataset,attached:want(c)})));for(const c of made)await toggleMade(c,want(c));for(const c of libs)await libraryToggle(c,want(c));})();
  };
  view.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
  e.preventDefault();
 });
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

// ---------- the Edit prompt drawer: what to make, or the work on what you just sent ----------
// A brief sent from Create stays on Create: the drawer opens by itself and follows it, first
// "waiting for your agent", then the team at work and what happens as it happens. "New video" goes
// back to choosing what to make. On other pages the drawer only offers the choice.
const DrawerWork={
 timer:null,last:'',opened:false,
 get watch(){return store.get('studio-watch',null);},
 set watch(v){store.set('studio-watch',v);},
 startHtml(){
  return `<h3>What would you like to create?</h3>
   <div class="prompt-modes" role="group" aria-label="Video type">
    ${VIDEO_KINDS.map(({id,icon,label})=>`<button type="button" class="prompt-mode" data-prompt-kind="${id}" aria-pressed="${Studio.N.mode===id}"><span class="prompt-mode-icon">${I[icon]}</span><span>${esc(label)}</span></button>`).join('')}
   </div>`;
 },
 workHtml(w,L){
  const working=L?.driver?.state==='working';
  return `<div class="drawer-work">
   <header class="drawer-work-head"><div class="drawer-work-title"><small>${w.job?(working?'<span class="live-pulse"></span> Working on':'Your video'):'Sent to the studio'}</small><b dir="auto">${esc(w.title)}</b></div>
    <div class="row">${w.job?`<a class="btn small ghost" href="#/studio/videos/${encodeURIComponent(w.job)}">Open project</a>`:''}<button type="button" class="btn small" data-new-video>${I.add} New video</button></div></header>
   ${w.job?(L&&typeof liveHtml==='function'?liveHtml(L):'<p class="muted small">Loading the team…</p>')
    :`<div class="drawer-waiting"><img class="mascot" src="/mascot/listening.svg" alt="Waiting for your agent" width="72" height="56"><p class="small">${AGENT_LINE}</p></div>`}
  </div>`;
 },
 async render(panel=$('#panel')){
  const box=panel?.querySelector('#drawer-start');if(!box)return;
  if(!box.firstChild)this.last='';
  const w=App.route==='create'?this.watch:null;
  if(!w){
   if(this.last!=='start'){box.innerHTML=this.startHtml();this.last='start';box.querySelectorAll('[data-prompt-kind]').forEach(b=>b.onclick=()=>setKind(b.dataset.promptKind));}
   this.stop();return;
  }
  this.loop();
  let L=null;
  try{
   if(!w.job){const r=await api('/api/studio/requests/'+encodeURIComponent(w.request));if(r.job){w.job=r.job;this.watch=w;}}
   if(w.job)L=await api('/api/studio/live/'+encodeURIComponent(w.job));
  }catch(e){if(/No request|No studio job/.test(e.message)){this.watch=null;this.last='';return this.render(panel);}}
  if(Panel.id!=='prompt-editor'||!box.isConnected)return;
  const html=this.workHtml(w,L);
  if(html!==this.last){
   const old=$('#live-feed',box),end=!old||old.scrollHeight-old.scrollTop-old.clientHeight<40;
   box.innerHTML=html;this.last=html;
   const feed=$('#live-feed',box);if(feed&&end)feed.scrollTop=feed.scrollHeight;
   $('[data-new-video]',box).onclick=()=>{this.watch=null;this.last='';if(typeof Live!=='undefined')Live.close();this.render();Dock.focus();};
  }
  if(w.job&&L&&typeof Live!=='undefined')Live.stream(w.job,L.lastSeq??0);
 },
 loop(){if(!this.timer)this.timer=setInterval(()=>{if(Panel.id!=='prompt-editor')return this.stop();if(!document.hidden)this.render();},3000);},
 stop(){clearInterval(this.timer);this.timer=null;},
 /** Follows what was just sent, in the drawer (opened if it is not). */
 follow(request,job,title){
  this.watch={request,job:job||null,title:title||'New video'};this.last='';this.opened=true;
  this.open();
 },
 /** Opens the drawer, trying again for a moment if the page was being drawn again (that cancels it). */
 open(tries=10){
  if(Panel.id==='prompt-editor')return this.render();
  if(App.route!=='create'||Panel.id)return;
  Promise.resolve(Dock.expand()).finally(()=>{if(Panel.id!=='prompt-editor'&&tries>0)setTimeout(()=>this.open(tries-1),250);});
 },
 /** Coming back to Create while something is followed: the drawer opens once by itself. */
 reopen(){if(this.opened||!this.watch||App.route!=='create'||Panel.id)return;this.opened=true;setTimeout(()=>this.open(),0);}
};

// ---------- the dock on Create ----------
const dockAttachment=(file,id)=>`<span class="dock-attachment">${uploadPreview(file,id)}<button type="button" class="iconbtn sm" aria-label="Remove ${esc(file.name)} from prompt" data-request="${esc(id)}" data-kind="${esc(file.kind)}" data-name="${esc(file.name)}" onclick="detachPromptFile(this)">${I.x}</button></span>`;
window.detachPromptFile=async button=>{if(await selectPromptFile(button.dataset,false))$('#dock-text')?.focus();};
Dock.kinds.create={
 html(){
  const N=Studio.N,k=kindOf(N.mode);
  return `${dockSwitch('create')}<div class="dock" id="dock" aria-label="Prompt">
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
  const looksKey=lookPicks().join('|');
  if(files.uploads!==N.files||files.looks!==looksKey){
   files.uploads=N.files;files.looks=looksKey;
   const attached=N.files.filter(file=>!file.detached),looks=lookPicks().map(name=>(Studio.S?.looks||[]).find(l=>l.name===name)||{name,title:(Studio.S?.taught||[]).find(v=>v.id===name)?.title});
   files.innerHTML=attached.map(file=>dockAttachment(file,N.id)).join('')+looks.map(lookChip).join('');files.hidden=!attached.length&&!looks.length;
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
// ---------- Create or Learn: one switch above the prompt, like two tabs ----------
// The pill starts where it was (the page you came from) and slides to the page you are on.
const SWITCH=[['create','Create','spark'],['learn','Learn','lesson']];
let switchWas=null;
const dockSwitch=on=>{
 const from=switchWas??on;switchWas=on;
 if(from!==on)setTimeout(()=>{const n=$('.dock-switch');if(n){void n.offsetWidth;n.dataset.on=on;}},20);
 return `<nav class="dock-switch" data-on="${from}" aria-label="Create or learn"><i class="dock-switch-pill" aria-hidden="true"></i>${SWITCH.map(([id,l,icon])=>`<a href="#/${id}" data-id="${id}" ${on===id?'aria-current="page"':''}>${I[icon]}<span>${l}</span></a>`).join('')}</nav>`;
};
// ---------- looks: styles the studio learned, picked on Create for the next video ----------
// One look becomes the style of the next video; two are blended (the blend in its settings).
// A look card is selected like an upload, and shows in the prompt as a chip with ✕.
const hsl=(h,s,l)=>`hsl(${Math.round(h??220)} ${Math.round((s??.25)*100)}% ${Math.round((l??.3)*100)}%)`;
function lookCover(l){
 const c=l.colors||{},bg=hsl(c.bgHue,c.bgSat,Math.min(.85,Math.max(.12,c.light??.3))),accent=hsl(c.accentHue??c.bgHue,.7,.55),light=(c.light??.3)>.6;
 return `<div class="taught-cover look-cover ${light?'light':''}" style="background:radial-gradient(120% 90% at 80% 10%,${accent},transparent 60%),${bg}" aria-hidden="true"><span class="look-cover-tag">${I.palette} Look</span><b dir="auto">${esc(l.name)}</b></div>`;
}
const styleIds=()=>[...(Studio.S?.looks||[]).map(l=>l.name),...(Studio.S?.taught||[]).map(v=>v.id)];
const lookPicks=()=>{const N=Studio.N,ids=styleIds();const list=N.useMix&&N.mixA&&N.mixB?[N.mixA,N.mixB]:N.look?[N.look]:N.like?[N.like]:[];return list.filter(n=>ids.includes(n));};
const isTaught=id=>(Studio.S?.taught||[]).some(v=>v.id===id);
/** A video you taught, as a style: the same card as a look, in its own colours. */
function taughtStyleCard(v){
 const on=lookPicks().includes(v.id),pal=(v.palette||[]).filter(h=>/^#[0-9a-f]{3,8}$/i.test(h)),bg=pal[0]||'var(--surface-3)',mid=pal[1]||bg,end=pal[3]||pal[2]||mid;
 const lum=h=>{if(!/^#/.test(h))return 0;h=h.slice(1);if(h.length<6)h=h.split('').map(c=>c+c).join('');const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);return .2126*r+.7152*g+.0722*b;},light=lum(end)>.55;
 return `<article class="upload-card output-card look-card" data-group="looks" data-look="${esc(v.id)}" data-name="${esc(v.title)}" data-find="${esc(`${v.title} taught style`)}">
  ${I.lesson}<div class="taught-cover look-cover ${light?'light':''}" style="background:linear-gradient(150deg,${bg},${mid} 55%,${end})" aria-hidden="true"><span class="look-cover-tag">${I.lesson} Taught</span><b dir="auto">${esc(v.title)}</b></div>
  <button type="button" class="upload-select" aria-pressed="${on}" aria-label="${on?'Stop using':'Use'} the style of ${esc(v.title)}"><span aria-hidden="true">${on?I.check:I.add}</span></button>
  <span class="upload-name" dir="auto">${esc(v.title)}</span>
  <button type="button" class="iconbtn sm upload-action" aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${esc(v.title)}" onclick="lookMenu(this,'${esc(v.id)}')">${I.more}</button></article>`;
}
function lookCard(l){
 const on=lookPicks().includes(l.name);
 return `<article class="upload-card output-card look-card" data-group="looks" data-look="${esc(l.name)}" data-name="${esc(l.name)}" data-find="${esc(`${l.name} ${l.summary||''} look style`)}">
  ${I.palette}${lookCover(l)}
  <button type="button" class="upload-select" aria-pressed="${on}" aria-label="${on?'Stop using':'Use'} the look ${esc(l.name)}"><span aria-hidden="true">${on?I.check:I.add}</span></button>
  <span class="upload-name" dir="auto">${esc(l.name)}</span>
  <button type="button" class="iconbtn sm upload-action" aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${esc(l.name)}" onclick="lookMenu(this,'${esc(l.name)}')">${I.more}</button></article>`;
}
const taughtSwatch=id=>{const pal=((Studio.S?.taught||[]).find(v=>v.id===id)?.palette||[]).filter(h=>/^#[0-9a-f]{3,8}$/i.test(h));return pal.length?`<div class="taught-cover look-cover" style="background:linear-gradient(150deg,${pal.join(',')})" aria-hidden="true"></div>`:I.lesson;};
const lookChip=l=>`<span class="dock-attachment look-chip" title="Style: ${esc(l.title||l.name)}">${l.colors?lookCover(l):l.title?taughtSwatch(l.name):I.palette}<button type="button" class="iconbtn sm" aria-label="Stop using the style ${esc(l.title||l.name)}" onclick="toggleLook('${esc(l.name)}')">${I.x}</button></span>`;
/** Sets the looks for the next video: none, one, or two (blended). Picking a third drops the oldest. */
function setLooks(list){
 const N=Studio.N;list=[...new Set(list)].slice(-2);
 const one=list.length===1?list[0]:'';N.look=one&&!isTaught(one)?one:'';N.like=one&&isTaught(one)?one:'';N.useMix=list.length===2;
 if(list.length===2){N.mixA=list[0];N.mixB=list[1];N.mixWeight=N.mixWeight??50;}
 if(list.length){N.same=false;if(N.mode!=='motion')N.mode='motion';}
 Studio.save();dockRefresh();
 document.querySelectorAll('.look-card').forEach(card=>{const on=list.includes(card.dataset.look),b=$('.upload-select',card);
  b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',`${on?'Stop using':'Use'} the style ${card.dataset.name}`);b.firstElementChild.innerHTML=on?I.check:I.add;});
}
window.toggleLook=name=>{const l=lookPicks();setLooks(l.includes(name)?l.filter(x=>x!==name):[...l,name]);};
function wireLookCards(root){root.querySelectorAll('.look-card').forEach(card=>{
 const b=$('.upload-select',card),id=card.dataset.look;b.onclick=()=>toggleLook(id);
 // A video you taught opens on its own page with a double click.
 if(isTaught(id))b.ondblclick=e=>{e.preventDefault();location.hash='#/learn/'+encodeURIComponent(id);};
});}
window.lookMenu=(btn,name)=>{
 const on=lookPicks().includes(name),taught=(Studio.S?.taught||[]).find(v=>v.id===name);
 const item=(key,icon,label,cls='')=>`<button type="button" class="pop-item ${cls}" role="menuitem" data-${key}>${I[icon]}<span>${label}</span></button>`;
 const menu=Pop.open(btn,item('toggle',on?'x':'check',on?'Stop using it':'Use for the next video')
  +(taught?`<a class="pop-item" role="menuitem" href="#/learn/${encodeURIComponent(name)}" data-close>${I.play}<span>Open</span></a>${item('rename','text','Rename')}${item('names','spark','Better name')}<hr>${item('remove','trash','Remove','danger')}`:''),
  {align:'end',label:taught?'Taught video options':'Look options'});
 if(!menu)return;
 const on_=(key,fn)=>menu.querySelector(`[data-${key}]`)?.addEventListener('click',()=>{Pop.close(true);fn();});
 on_('toggle',()=>toggleLook(name));
 if(!taught)return;
 on_('rename',()=>renamePop(btn,{value:taught.title,label:'Video name',save:async title=>{await api('/api/videos/'+name,{method:'PATCH',body:JSON.stringify({title})});await App.refresh(true);}}));
 on_('names',()=>taughtBetterName(taught));
 on_('remove',()=>taughtRemove(btn,taught));
};
/** Better name for a taught video: the page's model writes it, or the job is copied for your agent. */
async function taughtBetterName(v){
 try{const r=await api('/api/videos/names',{method:'POST',body:JSON.stringify({ids:[v.id]})});
  if(r.by==='agent'){await copyText(`Give this taught video a better name: 2 to 6 plain words that say what it teaches or how it looks (read it with: pnpm tempoloom teach show ${v.id}). Rename it with: pnpm tempoloom teach rename ${v.id} "New name"\n- ${v.id}: ${v.title}`);toast('Copied for your agent. Paste it in your terminal agent to rename it.');}
  else toast('Renamed');}
 catch(e){toast(e.message,true);}finally{App.refresh(true);}
}
/** Remove a taught video: keep its lessons in the Brain, or forget them with it. */
function taughtRemove(anchor,v){
 const menu=Pop.open(anchor,`<div class="pop-head">Remove this video</div>
  <button type="button" class="pop-item" role="menuitem" data-keep>${I.brain}<span>Keep its rules<small>They stay in the Brain and keep shaping new videos</small></span></button>
  <button type="button" class="pop-item danger" role="menuitem" data-forget>${I.trash}<span>Forget its rules too<small>Rules from no other source go with it</small></span></button>`,{align:'end',label:'Remove'});
 const run=async keep=>{Pop.close();
  if(!keep&&!await ask('Forget this video?','It leaves Studio and Learn, with any rules only it taught that were never applied. Undo is in History.','Forget',true,{file:{name:v.title}}))return;
  try{await api('/api/videos/'+v.id+(keep?'?keep=lessons':''),{method:'DELETE'});if(lookPicks().includes(v.id))toggleLook(v.id);toast(keep?'Removed. Its rules stay in the Brain.':'Forgotten');}catch(e){toast(e.message,true);}
  App.refresh(true);};
 menu?.querySelector('[data-keep]')?.addEventListener('click',()=>run(true));
 menu?.querySelector('[data-forget]')?.addEventListener('click',()=>run(false));
}
// ---------- your library files on Studio: select one to put a copy in the prompt ----------
const libFileName=e=>e.name;
function libraryCard(e,draft){
 const on=draft.files.some(f=>f.name===libFileName(e)&&!f.detached);
 return `<article class="upload-card output-card library-card" data-group="library" data-lib="${esc(e.id)}" data-name="${esc(e.name)}" data-find="${esc(`${e.name} ${LIB_LABEL[e.kind]||e.kind} ${(e.tags||[]).join(' ')} ${e.about||''}`)}">
  ${libThumb(e)}
  <button type="button" class="upload-select" aria-pressed="${on}" aria-label="${on?'Remove':'Add'} ${esc(e.name)} ${on?'from':'to'} prompt"><span aria-hidden="true">${on?I.check:I.add}</span></button>
  <span class="tile-state">${esc(LIB_LABEL[e.kind]||e.kind)}</span>
  <span class="upload-name" dir="auto">${esc(e.name)}</span>
  <button type="button" class="iconbtn sm upload-action" aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${esc(e.name)}" onclick="libraryCardMenu(this,'${esc(e.id)}')">${I.more}</button></article>`;
}
function wireLibraryCards(root){root.querySelectorAll('.library-card').forEach(card=>{$('.upload-select',card).onclick=()=>libraryToggle(card);});}
/** Puts a library file in the prompt (a copy, the first time), or takes it out; `on` forces either. */
async function libraryToggle(card,on){
  const e=(App.screens.create.data?.library||[]).find(x=>x.id===card.dataset.lib),draft=Studio.N;if(!e||Studio.busy||Studio.sending)return;
  const have=draft.files.find(f=>f.name===libFileName(e)),now=!!have&&!have.detached,want=on??!now;if(want===now)return;
  if(have)return setPromptFiles([{request:draft.id,kind:have.kind,name:have.name,attached:want}]);
  const kind=Picker.libraryKind(e);if(!kind)return toast('This file cannot be used for this kind of video.',true);
  showSelected(card,true);
  try{const r=await fetch(withKey(`/api/library/${encodeURIComponent(e.id)}/file`));if(!r.ok)throw new Error(`Could not open ${e.name}.`);const blob=await r.blob();
   await briefUpload(kind.id,[new File([blob],libFileName(e),{type:blob.type})],{replaceLogo:false});}
  catch(err){toast(err.message,true);showSelected(card,false);}
}
window.libraryCardMenu=(btn,id)=>{
 const e=(App.screens.create.data?.library||[]).find(x=>x.id===id);if(!e)return;
 const menu=Pop.open(btn,`<a class="pop-item" role="menuitem" href="${esc(withKey('/api/library/'+id+'/file'))}&dl=1" download data-close>${I.down}<span>Download</span></a>
  <hr><button type="button" class="pop-item danger" role="menuitem" data-remove>${I.trash}<span>Remove from library</span></button>`,{align:'end',label:'Library file'});
 menu?.querySelector('[data-remove]')?.addEventListener('click',async()=>{Pop.close(true);
  if(!await ask('Remove from your library?','The library copy is removed. Your own file, wherever you added it from, stays.','Remove',true,{file:{name:e.name,meta:LIB_LABEL[e.kind]||e.kind}}))return;
  try{await api('/api/library/'+encodeURIComponent(id),{method:'DELETE'});toast('Removed from your library');}catch(err){toast(err.message,true);}
  App.refresh(true);});
};
// ---------- locked scenes on Studio: each opens its project ----------
function sceneCard(x){
 return `<a class="upload-card output-card scene-tile" data-group="scenes" href="#/projects/${encodeURIComponent(x.job)}" data-name="${esc(x.label)}" data-find="${esc(`${x.label} ${x.title} scene locked`)}" aria-label="Locked scene ${x.n} of ${esc(x.title)}">
  <div class="taught-cover scene-cover" aria-hidden="true"><span class="look-cover-tag">${I.lock} Scene ${x.n}</span><b dir="auto">${esc(x.label||'Scene '+x.n)}</b><small dir="auto">${esc(x.title)}</small></div></a>`;
}
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
document.addEventListener('dragover',e=>{if(App.route==='teach/library'&&!App.arg&&e.dataTransfer?.types.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(App.route==='teach/library'&&!App.arg&&e.dataTransfer?.files.length&&!e.target.closest('.dock,.overlay')){e.preventDefault();window.learnFiles?.([...e.dataTransfer.files]);}});
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
/** Create's instructions are saved as 'cards'; Learn's as 'learn-cards'. */
const instructionKey=scope=>scope==='learn'?'learn-cards':'cards';
const readInstructions=(scope='create')=>instructionStore('readonly',store=>store.get(instructionKey(scope)));
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
window.rulesPanel=async(scope=Dock.mode==='learn'?'learn':'create')=>{
 const learn=scope==='learn',refresh=()=>learn?Learn.refreshDock():dockRefresh();
 if(Panel.id==='rules'){Panel.close();refresh();return;}
 const draft=Studio.N,route=App.route,otherPanel=Panel.id;
 let cards;
 try{cards=(await readInstructions(scope)??[blankInstruction(learn?'':draft.notes)]).filter(hasInstructionContent);}
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
   await instructionStore('readwrite',store=>store.put(cards.filter(hasInstructionContent),instructionKey(scope)));
   if(!learn){draft.notes='';Studio.save();}
   setInstructionIndicator(Dock.el,activeInstructions(cards).length>0);
   if(save.isConnected)Panel.close();
   refresh();
  }catch{toast('Could not save the instructions on this device.',true);}
  finally{save.disabled=false;}
 };
 draw();
 refresh();
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
  this.place();
  $('#pick-upload').onclick=()=>$('#pick-file').click();
  $('#pick-file').onchange=e=>{const files=[...e.target.files];e.target.value='';this.upload(files);};
  $('#pick-use').onclick=()=>this.useLibrary();
  this.draw();
 },
 /** Opens as a popup attached just above the prompt box (no dark backdrop); without a prompt box on
  *  the page it stays a centred window. Follows the box when the window is resized. */
 place(){
  const overlay=Overlay.el,box=overlay?.querySelector('.picker'),dock=$('#dock');
  if(!box)return;
  const r=dock?.getBoundingClientRect();
  if(!r||!r.width||r.top<240){overlay.classList.remove('picker-pop');box.style.cssText='';return;}
  overlay.classList.add('picker-pop');
  // Centred on the prompt box and kept inside the page area (never over the sidebar).
  const area=$('#canvas')?.getBoundingClientRect()||{left:0,right:innerWidth,width:innerWidth};
  const w=Math.min(820,Math.round(area.width-32)),left=Math.max(area.left+16,Math.min(r.left+r.width/2-w/2,area.right-w-16));
  Object.assign(box.style,{width:w+'px',left:left+'px',bottom:Math.round(innerHeight-r.top+12)+'px',height:Math.min(520,Math.round(r.top-28))+'px'});
  if(!this.onResize){this.onResize=()=>{if(Overlay.el?.querySelector('.picker'))this.place();else{removeEventListener('resize',this.onResize);this.onResize=null;}};addEventListener('resize',this.onResize);}
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
