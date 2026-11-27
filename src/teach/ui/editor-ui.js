'use strict';
// Editor route and workspace shell. Each panel owns its content and controls.
const ED_KFKEYS=new Set(['x','y','scale','rotate','opacity','volume','tiltX','tiltY','depth3d']);
function edCssFilter(a){const f=[];if(a.brightness)f.push(`brightness(${1+a.brightness/100})`);if(a.contrast)f.push(`contrast(${1+a.contrast/100})`);if(a.saturation)f.push(`saturate(${1+a.saturation/100})`);if(a.hue)f.push(`hue-rotate(${a.hue}deg)`);
 if(a.temperature)f.push(a.temperature>0?`sepia(${a.temperature/200})`:`hue-rotate(${a.temperature/5}deg)`);return f.join(' ')||'none';}
function edShapeSvg(s){return {rect:'<rect x="8" y="8" width="24" height="24"/>',round:'<rect x="8" y="8" width="24" height="24" rx="6"/>',circle:'<circle cx="20" cy="20" r="12"/>',triangle:'<path d="M20 7 33 31H7z"/>',
 star:'<path d="m20 6 4 9 10 1-7.5 7 2 10L20 28l-8.5 5 2-10L6 16l10-1z"/>',arrow:'<path d="M6 17h16v-6l12 9-12 9v-6H6z"/>',line:'<rect x="6" y="18" width="28" height="4" rx="2"/>',heart:'<path d="M20 33C8 24 6 17 10 12s9-3 10 1c1-4 6-6 10-1s2 12-10 21z"/>',
 cuboid:'<path d="M7 13 20 6l13 7-13 7z"/><path opacity=".75" d="M7 15l12 7v12L7 27z"/><path opacity=".5" d="M33 15l-12 7v12l12-7z"/>'}[s]||'';}

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

function edWorkspaceHeader(){
 return `<header class="ed-top"><div class="ed-top-group">
   <a class="ed-back" href="#/editor" aria-label="Back to all editor projects">${I.back}<span>Tempoloom</span></a>
   <span class="ed-saved" role="status">Saved</span><span class="ed-saved" data-shared-sync role="status" hidden></span></div>
   <input class="ed-name" value="${esc(Ed.p.name)}" aria-label="Project name" maxlength="80" dir="auto">
   <div class="ed-top-group ed-top-actions">
   <button type="button" class="btn small" data-editor-agent>Agent</button>
   <button type="button" class="btn small primary" data-export>${I.upload} Export</button></div></header>`;
}

function edBuild(el){
 el.innerHTML=`<div class="no-head editor">
  ${edWorkspaceHeader()}
  <div class="ed-workspace">
   ${edMediaPanel()}
   ${edPlayerPanel()}
   ${edDetailsPanel()}
   ${edTimelinePanel()}
   <i class="ed-rz v" data-rz="c1" aria-hidden="true"></i>
   <i class="ed-rz v" data-rz="c2" aria-hidden="true"></i>
   <i class="ed-rz h" data-rz="tl" aria-hidden="true"></i>
  </div>
  <input type="file" accept="video/*,image/*,audio/*" multiple hidden>
 </div>`;
 const R=el.querySelector('.editor'),q=s=>R.querySelector(s);
 Object.assign(Ed.dom,{saved:q('.ed-saved'),root:R,lib:q('.ed-lib'),props:q('.ed-props'),canvas:q('.ed-preview-canvas'),stage:q('.ed-stage'),frame:q('.ed-frame'),time:q('.ed-time'),play:q('[data-play]'),loop:q('[data-loop]'),
  tracks:q('.ed-lanes'),heads:q('.ed-heads'),cover:q('.ed-cover'),ruler:q('.ed-ruler'),inner:q('.ed-inner'),scroll:q('.ed-scroll'),head:q('.ed-playhead'),marquee:q('.ed-marquee'),file:q(':scope > input[type=file]'),exportOverlay:q('.ed-export'),meter:q('.ed-meter'),selectionColor:getComputedStyle(R).getPropertyValue('--accent').trim()});
 Ed.dom.file.onchange=()=>{Ed.importFiles(Ed.dom.file.files);Ed.dom.file.value='';};
 const name=q('.ed-name');name.oninput=()=>{Ed.p.name=name.value||'Untitled project';Ed.save();document.title=`${Ed.p.name} · Tempoloom`;};
 q('[data-export]').onclick=()=>edExportDialog();
 q('[data-editor-agent]').onclick=()=>edAgentDialog(Ed.p.id);
 edWatchShared(R,Ed.p.id,q('[data-shared-sync]'));
 edBindPlayer(q('.ed-view'));
 edBindTimeline(q('.ed-tl'));
 const workspace=q('.ed-workspace'),placePanels=edLayout(workspace);
 let dropLane;
 const showDrop=lane=>{
  if(lane===dropLane)return;
  dropLane?.removeAttribute('data-media-drop');
  dropLane=lane;
  dropLane?.setAttribute('data-media-drop','');
 };
 R.ondragover=e=>{
  const types=[...e.dataTransfer.types],files=types.includes('Files');
  if(!files&&!types.includes('text/x-ed-media'))return;
  e.preventDefault();
  const timeline=Ed.dom.scroll.contains(e.target);
  R.classList.toggle('ed-dropping',files&&!timeline);
  showDrop(timeline?e.target.closest('.ed-lane, .ed-lane-new'):null);
 };
 R.ondragleave=e=>{if(!R.contains(e.relatedTarget)){R.classList.remove('ed-dropping');showDrop(null);}};
 R.ondrop=async e=>{e.preventDefault();R.classList.remove('ed-dropping');showDrop(null);
  const mid=e.dataTransfer.getData('text/x-ed-media');
  const files=[...e.dataTransfer.files];
  if((mid||files.length)&&Ed.dom.scroll.contains(e.target)){
   const bounds=Ed.dom.inner.getBoundingClientRect(),at=Math.max(0,(e.clientX-bounds.left)/Ed.zoom);
   const lane=e.target.closest('.ed-lane'),track=lane?.dataset.track;
   const overlay=!!e.target.closest('[data-new=top]')||!!lane&&lane.dataset.kind!=='video';
   const project=Ed.p;
   const ids=mid?[mid]:(await Ed.importFiles(files)).map(media=>media.id);
   if(Ed.p!==project||!R.isConnected)return;
   const clip=Ed.addMediaClips(ids,at,track,{overlay}).at(-1);
   if(clip)Ed.revealTimeline(clip.start,clip.track);
   return;
  }
  if(mid)return Ed.add(mid);
  if(files.length)Ed.importFiles(files);
 };
 Ed.drawLib();Ed.drawProps();Ed.drawTimeline();Ed.fit();Ed.sync();Ed.draw();Ed.drawTime();
 const observer=new ResizeObserver(entries=>{
  if(!R.isConnected){observer.disconnect();return;}
  if(entries.some(({target})=>target===workspace))placePanels();
  if(entries.some(({target})=>target===Ed.dom.stage))Ed.fit();
  if(!Ed.playing&&entries.some(({target})=>target===Ed.dom.scroll))Ed.drawTimeline();
 });
 observer.observe(workspace);
 observer.observe(Ed.dom.stage);
 observer.observe(Ed.dom.scroll);
}
window.addEventListener('beforeunload',()=>{try{Ed.flush();}catch{}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&Ed.st)try{Ed.flush();}catch{}});
window.addEventListener('hashchange',()=>{if(Ed.p&&!(App.route==='editor'&&App.arg===Ed.p.id)){Ed.pause();Ed.flush();if(Ed.recording)Ed.recording.rec.stop();}});

// The two side panels and the timeline can be adjusted independently.
function edLayout(workspace){
 const storageKey='editor-workspace-layout';
 let sizes={};
 try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&typeof saved==='object')sizes=saved;}catch{}
 const remember=()=>{try{localStorage.setItem(storageKey,JSON.stringify(sizes));}catch{}};
 const library=workspace.querySelector('.ed-lib'),inspector=workspace.querySelector('.ed-props'),timeline=workspace.querySelector('.ed-tl');
 const panels={c1:library,c2:inspector,tl:timeline};
 const handles=workspace.querySelectorAll('[data-rz]');
 const place=()=>{
  const root=workspace.getBoundingClientRect(),left=library.getBoundingClientRect(),right=inspector.getBoundingClientRect(),bottom=timeline.getBoundingClientRect();
  const [leftHandle,rightHandle,timelineHandle]=handles;
  Object.assign(leftHandle.style,{left:(left.right-root.left)+'px',top:(left.top-root.top)+'px',height:left.height+'px'});
  Object.assign(rightHandle.style,{left:(right.left-root.left-8)+'px',top:(right.top-root.top)+'px',height:right.height+'px'});
  Object.assign(timelineHandle.style,{top:(bottom.top-root.top-8)+'px',left:(bottom.left-root.left)+'px',width:bottom.width+'px'});
 };
 for(const key of Object.keys(panels))if(Number.isFinite(sizes[key]))workspace.style.setProperty('--ed-'+key,sizes[key]+'px');
 for(const handle of handles){
  const key=handle.dataset.rz,vertical=key==='tl',panel=panels[key];
  handle.onpointerdown=e=>{
   e.preventDefault();
   handle.setPointerCapture(e.pointerId);
   handle.classList.add('on');
   const start=vertical?e.clientY:e.clientX,size=vertical?panel.offsetHeight:panel.offsetWidth;
   handle.onpointermove=event=>{
    const position=vertical?event.clientY:event.clientX;
    workspace.style.setProperty('--ed-'+key,(size+(position-start)*(key==='c1'?1:-1))+'px');
    place();
    Ed.fit();
   };
   handle.onpointerup=handle.onpointercancel=()=>{
    handle.onpointermove=handle.onpointerup=handle.onpointercancel=null;
    handle.classList.remove('on');
    sizes[key]=vertical?panel.offsetHeight:panel.offsetWidth;
    workspace.style.setProperty('--ed-'+key,sizes[key]+'px');
    remember();
    Ed.drawTimeline();
   };
  };
  handle.ondblclick=()=>{
   delete sizes[key];
   workspace.style.removeProperty('--ed-'+key);
   remember();
   place();
   Ed.fit();
  };
 }
 place();
 return place;
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
