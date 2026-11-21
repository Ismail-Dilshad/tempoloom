'use strict';
// The places that are new with the redesign (Projects as a grid, Looks, Scenes, your Library, Tools,
// Trash, Appearance), and the prompt box inside a project. The screens that already existed keep
// drawing themselves; their places add tabs around them (core.js).

// ---------- A project's own page; the list of projects lives on Create ----------
(()=>{
 const scr=App.screens['studio/videos'],render=scr.render,head=scr.head;
 scr.title=a=>{const j=a&&Studio.S?.jobs.find(x=>x.job===a);return j?jobTitle(j):'Create';};
 scr.head=a=>a?head(a):null;
 scr.actions=a=>{const j=a&&Studio.S?.jobs.find(x=>x.job===a);
  return j?`<a class="btn small ghost" href="#/create">${I.back} All projects</a><button class="btn small ghost" onclick="archiveJob('${esc(j.job)}',${!j.archived})">${j.archived?I.restore+' Restore':I.trash+' Move to trash'}</button>`:'';};
 scr.render=function(el,arg,changed){
  if(arg)return render.call(this,el,arg,changed);
  // There is no Projects page any more: its address opens Create, where the projects are.
  location.replace('#/create');el.innerHTML='';
 };
})();

// The prompt box inside a project: tell the studio what to change; it becomes a rule and the steps it touches are redone.
Dock.kinds.change={
 html(job){const j=Studio.S?.jobs.find(x=>x.job===job);
  return `<div class="dock" id="dock" aria-label="Change this video"><div class="dock-text"><textarea id="dock-text" rows="1" dir="auto" maxlength="800" aria-label="Change something in this video" placeholder="${j?.finished?'Change something, for example: make scene 2 shorter':'Tell the studio something about this video…'}"></textarea></div>
   <div class="dock-tools"><label class="chip" style="cursor:pointer"><input type="checkbox" id="dock-praise" style="margin:0"> This is praise</label><span class="grow"></span>
   <button type="button" class="iconbtn primary" id="dock-send" aria-label="Send to the studio">${I.send}</button></div></div>`;},
 wire(el,job){const t=$('#dock-text',el);autoGrow(t);t.oninput=()=>autoGrow(t);
  const send=async()=>{const said=t.value.trim();if(!said)return t.focus();$('#dock-send',el).disabled=true;
   try{const r=await api(`/api/studio/jobs/${job}/feedback`,{method:'POST',body:JSON.stringify({said,praise:$('#dock-praise',el).checked})});t.value='';autoGrow(t);
    toast(`Saved as a rule for ${r.goesTo.join(', ')}${r.reopened.length?`. Redoing: ${r.reopened.join(', ')}`:''}`);await App.refresh(true);}
   catch(e){toast(e.message,true);}$('#dock-send',el).disabled=false;};
  t.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}};$('#dock-send',el).onclick=send;}};

// ---------- Trash: projects moved out of the way; nothing is deleted until you say so ----------
let emptyingTrash=false;
async function emptyTrash(){
 if(emptyingTrash)return;
 const data=App.screens.trash.data;
 const projects=data.jobs.filter(job=>job.archived).map(job=>job.job);
 const uploads=(data.trashedUploads??[]).map(({request,trashId})=>({request,trashId}));
 const count=projects.length+uploads.length;
 if(!count||!await ask('Empty Trash?',`Delete ${count} ${count===1?'item':'items'} from Trash? Uploaded files are permanently deleted. Saved project files, exports and rules are kept.`,'Empty Trash',true))return;
 emptyingTrash=true;App.show(false);
 try{
  const result=await api('/api/studio/trash/empty',{method:'POST',body:JSON.stringify({projects,uploads})});
  if(result.failed)toast(`${result.failed} ${result.failed===1?'item':'items'} could not be removed.`,true);
 }catch(error){toast(error.message,true);}
 finally{emptyingTrash=false;await App.refresh(true);}
}
App.register('trash',{
 title:()=>'Trash',load:()=>Studio.load(),
 hold:()=>emptyingTrash,
 render(el){
  const gone=this.data.jobs.filter(j=>j.archived),uploads=this.data.trashedUploads??[],total=gone.length+uploads.length;
  el.innerHTML=`<div class="no-head trash">
   <header class="trash-bar"><h1>Trash${total?` <span>${total}</span>`:''}</h1>
    ${total?`<button type="button" class="btn small ghost danger-text" onclick="emptyTrash()" ${emptyingTrash?'disabled':''}>${I.trash} ${emptyingTrash?'Emptying…':'Empty Trash'}</button>`:''}</header>
   ${total?`<div class="card-grid upload-grid create-uploads trash-grid">${gone.map(j=>projectTile(j)).join('')}${uploads.map(f=>uploadCard(f,f.request,true)).join('')}</div>`
    :`<div class="trash-empty"><span class="trash-empty-icon" aria-hidden="true">${I.trash}</span><h2>Trash is empty</h2></div>`}</div>`;
  wireUploadCards(el);
 }});

// ---------- Appearance ----------
App.register('appearance',{
 title:()=>'Settings',
 head:()=>({title:'Sidebar'}),
 render(el){
  const collapsed=$('#app').dataset.rail==='collapsed';
  el.innerHTML=`<section class="card teach-settings" style="max-width:640px"><label class="teach-setting"><span><b>Show the sidebar as icons</b><small class="muted">Shortcut: [</small></span><input type="checkbox" role="switch" ${collapsed?'checked':''} onchange="App.collapse();App.show(false)"></label></section>`;
 }});

// ---------- Brain, Lessons: lessons and the patterns your good examples share, on one page ----------
(()=>{
 const les=App.screens['teach/lessons'],pat=App.screens['teach/patterns'];if(!les||!pat)return;const render=les.render;
 les.render=function(el,...rest){
  render.call(this,el,...rest);
  const sec=document.createElement('section');sec.className='lessons-patterns';
  sec.innerHTML=`<div class="section-head" style="margin-top:40px"><h3>Patterns your good examples share</h3></div><div></div>`;
  pat.render.call({data:this.data},sec.lastElementChild);
  el.append(sec);
 };
})();

