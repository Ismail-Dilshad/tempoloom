'use strict';
// The places that are new with the redesign (Projects as a grid, Looks, Scenes, your Library, Tools,
// Trash, Appearance), and the prompt box inside a project. The screens that already existed keep
// drawing themselves; their places add tabs around them (core.js).

// ---------- Projects: a grid with filters; one project opens its workspace ----------
const PF={get filter(){return store.get('projects-filter','all');},set filter(v){store.set('projects-filter',v);}};
(()=>{
 const scr=App.screens['studio/videos'],render=scr.render,actions=scr.actions,head=scr.head;
 scr.title=a=>{const j=a&&Studio.S?.jobs.find(x=>x.job===a);return j?jobTitle(j):'Projects';};
 scr.head=a=>a?head(a):{title:'Projects',text:'Every video the studio is making or has made. Open one to follow its steps, versions and scenes.'};
 scr.actions=a=>{const j=a&&Studio.S?.jobs.find(x=>x.job===a);
  return j?`<a class="btn small ghost" href="#/projects">${I.back} All projects</a><button class="btn small" onclick="openProjectTools('${esc(j.job)}')">${I.tools} Tools</button><button class="btn small ghost" onclick="archiveJob('${esc(j.job)}',${!j.archived})">${j.archived?I.restore+' Restore':I.trash+' Move to trash'}</button>`
   :`<button class="btn primary" onclick="Dock.focus()">${I.add} New video</button>`;};
 scr.render=function(el,arg,changed){
  if(arg)return render.call(this,el,arg,changed);
  const S=this.data,live=j=>(S.liveList||[]).find(x=>x.job===j.job&&x.active);
  const queued=S.requests.filter(r=>r.status==='waiting'),jobs=S.jobs.filter(j=>!j.archived);
  if(!queued.length&&!jobs.length){el.innerHTML=`<div class="empty"><h2>No projects yet</h2><p>Make a video from an idea, a link or your own footage. It shows up here while it is made.</p><button class="btn primary" onclick="Dock.focus()">New video</button></div>`;return;}
  const key=j=>jobState(j,!!live(j)).key,f=PF.filter,count=k=>jobs.filter(j=>key(j)===k).length;
  const shown=jobs.filter(j=>f==='all'||key(j)===f);
  el.innerHTML=`${queued.length?`<div class="banner" style="margin-bottom:16px">${AGENT_LINE}</div>`:''}
   <div class="row" role="group" aria-label="Show" style="margin-bottom:20px">${[['all','All',jobs.length+queued.length],['making','Making',count('making')],['you','Waiting for you',count('you')],['done','Done',count('done')]].map(([k,l,n])=>`<button class="chip" aria-pressed="${f===k}" onclick="PF.filter='${k}';App.show(false)">${l} <span class="muted">${n}</span></button>`).join('')}</div>
   ${shown.length||f==='all'&&queued.length?`<div class="card-grid">${f==='all'?queued.map(queuedCard).join(''):''}${shown.map(j=>{const now=live(j);return projectCard(j,{working:!!now,face:now?.face});}).join('')}</div>`
    :`<div class="empty"><h3>Nothing here</h3><p>No project is ${f==='done'?'done':f==='you'?'waiting for you':'being made'} right now.</p></div>`}`;
 };
})();
window.openProjectTools=job=>Tools.panel(job);

// The prompt box inside a project: tell the studio what to change; it becomes a rule and the steps it touches are redone.
Dock.kinds.change={
 html(job){const j=Studio.S?.jobs.find(x=>x.job===job);
  return `<div class="dock" id="dock" aria-label="Change this video"><div class="dock-text"><textarea id="dock-text" rows="1" dir="auto" maxlength="800" aria-label="Change something in this video" placeholder="${j?.finished?'Change something, for example: make scene 2 shorter':'Tell the studio something about this video…'}"></textarea></div>
   <div class="dock-tools"><label class="chip" style="cursor:pointer"><input type="checkbox" id="dock-praise" style="margin:0"> This is praise</label><span class="grow"></span>
   <button type="button" class="iconbtn" aria-label="Tools for this video" onclick="openProjectTools('${esc(job)}')">${I.tools}</button>
   <button type="button" class="iconbtn primary" id="dock-send" aria-label="Send to the studio">${I.send}</button></div></div>`;},
 wire(el,job){const t=$('#dock-text',el);autoGrow(t);t.oninput=()=>autoGrow(t);
  const send=async()=>{const said=t.value.trim();if(!said)return t.focus();$('#dock-send',el).disabled=true;
   try{const r=await api(`/api/studio/jobs/${job}/feedback`,{method:'POST',body:JSON.stringify({said,praise:$('#dock-praise',el).checked})});t.value='';autoGrow(t);
    toast(`Saved as a rule for ${r.goesTo.join(', ')}${r.reopened.length?`. Redoing: ${r.reopened.join(', ')}`:''}`);await App.refresh(true);}
   catch(e){toast(e.message,true);}$('#dock-send',el).disabled=false;};
  t.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}};$('#dock-send',el).onclick=send;}};

// ---------- Looks ----------
App.register('looks',{
 title:()=>'Looks',load:()=>Studio.load(),
 head:()=>({title:'Looks',text:'Styles the studio can make your videos in: looks it learned from a video or a channel, and videos you taught.'}),
 actions:()=>`<button class="btn" onclick="openTool('looks')">${I.eye} Learn a look</button><button class="btn" onclick="openTool('look-channel')">${I.channel} Learn a channel</button>`,
 render(el){
  const S=this.data,looks=S.looks||[],taught=S.taught||[];
  if(!looks.length&&!taught.length){el.innerHTML=`<div class="empty"><h2>No looks yet</h2><p>Teach a video you like, or learn a look from a video or a whole channel. Then mix two of them into a style of your own.</p><div class="row" style="justify-content:center"><a class="btn primary" href="#/library/teach">Teach a video</a><button class="btn" onclick="openTool('look-channel')">Learn a channel</button></div></div>`;return;}
  const card=(name,about,icon,actions)=>`<div class="scene-card"><div class="row" style="gap:12px;flex-wrap:nowrap"><span class="empty-art" style="width:40px;height:40px;border-radius:8px;flex:none">${I[icon]}</span><div style="min-width:0"><b dir="auto" style="font:var(--type-title-3)">${esc(name)}</b>${about?`<p class="muted small" dir="auto" style="margin:2px 0 0">${esc(about)}</p>`:''}</div></div><div class="row">${actions}</div></div>`;
  el.innerHTML=`${looks.length?`<div class="section-head"><h3>Learned looks</h3><span class="muted small">${looks.length}</span></div>
   <div class="card-grid">${looks.map(l=>card(l.name,l.summary,l.name.startsWith('channel-')?'channel':'palette',`<button class="btn small" onclick="useLook('${esc(l.name)}')">Use in a new video</button>`)).join('')}</div>`:''}
   ${taught.length?`<div class="section-head"><h3>Videos you taught</h3><span class="muted small">${taught.length}</span></div>
   <div class="card-grid">${taught.map(v=>card(v.title,'',`eye`,`<button class="btn small" onclick="useTaught('${esc(v.id)}')">Make one in this spirit</button>`)).join('')}</div>`:''}`;
 }});
window.useLook=name=>{store.set('more-opts',true);const N=Studio.N;N.mode='motion';N.useMix=true;N.mixA=name;if(N.mixB===name)N.mixB='';Studio.save();location.hash='#/create';setTimeout(()=>{settingsPanel();toast('Choose a second style to mix with, or set the share to 100% A.');},150);};
window.useTaught=id=>{const N=Studio.N;N.mode='motion';N.like=id;Studio.save();location.hash='#/create';setTimeout(()=>{Dock.focus();toast('The next video follows the spirit of that video. Describe it below.');},150);};

// ---------- Scenes ----------
const SC={get only(){return store.get('scenes-only','all');},set only(v){store.set('scenes-only',v);}};
App.register('scenes',{
 title:()=>'Scenes',load:()=>api('/api/scenes'),
 head:()=>({title:'Scenes',text:'Every scene from every project. A locked scene stays exactly as it is when the studio redoes the rest.'}),
 render(el){
  const all=this.data.scenes,list=SC.only==='locked'?all.filter(s=>s.locked):all;
  if(!all.length){el.innerHTML=`<div class="empty"><h2>No scenes yet</h2><p>Scenes appear here once a motion video has been built. Lock the ones you like from a project's page.</p><a class="btn" href="#/projects">Open Projects</a></div>`;return;}
  const groups=[...new Map(list.map(s=>[s.job,s.title])).entries()];
  el.innerHTML=`<div class="row" role="group" aria-label="Show" style="margin-bottom:20px">${[['all','All',all.length],['locked','Locked',all.filter(s=>s.locked).length]].map(([k,l,n])=>`<button class="chip" aria-pressed="${SC.only===k}" onclick="SC.only='${k}';App.show(false)">${l} <span class="muted">${n}</span></button>`).join('')}</div>
   ${groups.length?groups.map(([job,title])=>`<div class="section-head"><h3 dir="auto">${esc(title)}</h3><a href="#/projects/${encodeURIComponent(job)}">Open project</a></div>
    <div class="card-grid">${list.filter(s=>s.job===job).map(s=>`<a class="scene-card ${s.locked?'locked':''}" href="#/projects/${encodeURIComponent(job)}"><span class="meta"><span class="badge st">Scene ${s.n}</span>${s.locked?`<span class="badge wait">${I.lock} Locked</span>`:''}<span>${fmtS(s.start)}, ${s.seconds.toFixed(1)} s</span></span><p dir="auto">${esc(s.label||'(no words)')}</p></a>`).join('')}</div>`).join('')
    :`<div class="empty"><h3>No locked scenes</h3><p>Open a project and lock a scene you want kept exactly as it is.</p></div>`}`;
 }});

// ---------- your Library ----------
const LB={get kind(){return store.get('library-kind','all');},set kind(v){store.set('library-kind',v);},busy:null};
function libraryUploadAsk(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='image/*,video/*,audio/*,.svg';i.onchange=()=>res([...i.files]);i.click();});}
window.libraryAdd=async()=>{const files=await libraryUploadAsk();if(files.length){await libraryUpload(files);if(App.route!=='library')location.hash='#/library';else App.refresh(true);}};
async function libraryUpload(files){
 let added=0;
 for(const f of files){
  LB.busy=`Adding ${f.name}`;if(App.route==='library')App.show(false);
  try{const r=await new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('POST','/api/library/upload?name='+encodeURIComponent(f.name));x.setRequestHeader('x-teach-key',KEY);
   x.upload.onprogress=e=>{if(e.lengthComputable){LB.busy=`Adding ${f.name} ${Math.round(e.loaded/e.total*100)}%`;const b=$('#lib-busy');if(b)b.textContent=LB.busy;}};
   x.onload=()=>{let j={};try{j=JSON.parse(x.responseText);}catch{}x.status===200?res(j):rej(new Error(j.error||'The upload failed'));};x.onerror=()=>rej(new Error('The upload failed. Is the terminal still open?'));x.send(f);});
   added+=r.added.length;}catch(e){toast(`${f.name}: ${e.message}`,true);}
 }
 LB.busy=null;if(added)toast(`Added ${added} to your library`);await App.refresh(true);
}
App.register('library',{
 title:()=>'Library',load:()=>api('/api/library'),hold:()=>!!LB.busy,
 head:()=>({title:'Your library',text:'Logos, pictures, music, sounds and clips you use again and again. Each is described so the studio can find it by what it shows.'}),
 actions:()=>`<button class="btn primary" onclick="libraryAdd()">${I.upload} Add files</button>`,
 render(el){
  const d=this.data,k=LB.kind,list=d.entries.filter(e=>k==='all'||e.kind===k);
  const busy=LB.busy?`<p class="muted"><span class="spin"></span> <span id="lib-busy">${esc(LB.busy)}</span></p>`:'';
  if(!d.entries.length){el.innerHTML=`${busy}<div class="empty"><h2>Your library is empty</h2><p>Add your logo, product photos, music and clips once. Every video can use them, and search finds them by what they show.</p><button class="btn primary" onclick="libraryAdd()">Add files</button></div>`;return;}
  el.innerHTML=`${busy}<div class="row" role="group" aria-label="Show" style="margin-bottom:20px">${[['all','Everything',d.entries.length],...d.kinds.map(x=>[x,{logo:'Logos',image:'Pictures',music:'Music',sound:'Sounds',clip:'Clips'}[x]||x,d.entries.filter(e=>e.kind===x).length])].filter(([x,,n])=>x==='all'||n).map(([x,l,n])=>`<button class="chip" aria-pressed="${k===x}" onclick="LB.kind='${x}';App.show(false)">${l} <span class="muted">${n}</span></button>`).join('')}</div>
   <div class="card-grid">${list.map(e=>`<div class="pcard-wrap" style="position:relative"><div class="pcard"><span class="thumb" style="aspect-ratio:1">${libThumb(e)}</span><b dir="auto">${esc(e.name)}</b>
    <span class="meta"><span>${LIB_LABEL[e.kind]||e.kind}</span>${e.width?`<span>${e.width}×${e.height}</span>`:''}${e.seconds?`<span>${fmtS(e.seconds)}</span>`:''}${e.bpm?`<span>${e.bpm} bpm</span>`:''}<span>used ${e.uses}×</span></span>${e.description&&e.description!==e.name?`<span class="meta" dir="auto">${esc(e.description.slice(0,90))}</span>`:''}</div>
    <button class="iconbtn sm more" aria-label="More for ${esc(e.name)}" aria-haspopup="menu" aria-expanded="false" onclick="libraryMenu(this,'${esc(e.id)}')">${I.more}</button></div>`).join('')}</div>`;
  wireUploadPreviews(el);
 }});
window.libraryMenu=(btn,id)=>Pop.open(btn,`<a class="pop-item" href="${withKey('/api/library/'+id+'/file')}&dl=1" download>${I.down}<span>Download</span></a><button class="pop-item danger" data-close onclick="libraryRemove('${esc(id)}')">${I.trash}<span>Remove from the library</span></button>`,{align:'end'});
window.libraryRemove=async id=>{if(await ask('Remove from your library?','The library copy is removed. Your own file, wherever you added it from, stays.','Remove',true))act(()=>api('/api/library/'+encodeURIComponent(id),{method:'DELETE'}));};

// ---------- Tools: one list from the registry ----------
const Tools={
 async panel(job){
  const tools=await Cmd.loadTools();
  Panel.open({id:'tools',title:job?'Tools for this video':'Tools',
   body:tools.map(t=>`<button class="pop-item" onclick="openTool('${esc(t.id)}',${job?`'${esc(job)}'`:'null'})">${I[t.icon]||I.tools}<span>${esc(t.name)}<small>${esc(t.about)}</small></span></button>`).join('')});
 }};
window.openTool=async(id,job)=>{
 const t=(await Cmd.loadTools()).find(x=>x.id===id);if(!t)return toast('That tool is not available',true);
 const say=`${job?`For the studio job ${job}: `:''}${t.name.toLowerCase()}`;
 Panel.open({id:'tool-'+id,title:t.name,back:job?()=>Tools.panel(job):null,
  body:`<p dir="auto">${esc(t.description)}</p><h3 class="field-label">When to use it</h3><p class="muted" dir="auto" style="margin:0">${esc(t.whenToUse)}</p>
   ${t.inputs.length?`<h3 class="field-label">Inputs</h3><ul class="small" style="margin:0;padding-inline-start:18px">${t.inputs.map(x=>`<li dir="auto">${esc(x)}</li>`).join('')}</ul>`:''}
   <h3 class="field-label">${t.open?'Or ask your agent':'Ask your agent'}</h3><p class="muted small" style="margin:0 0 8px">${esc(say)}</p>
   <div class="cmdline"><code>${esc(t.command)}</code><button class="iconbtn sm" aria-label="Copy the command" onclick="copyText(${esc(JSON.stringify(t.command))})">${I.copy}</button></div>`,
  foot:t.open?`<a class="btn primary" href="${esc(t.open)}" onclick="Panel.close(true)">Open ${esc(t.name)}</a>`:`<button class="btn primary" onclick="copyText(${esc(JSON.stringify(say))});toast('Copied. Paste it to your agent.')">Copy request</button>`});
};
App.register('tools',{
 title:()=>'Tools',load:()=>Cmd.loadTools().then(tools=>({tools})),
 head:()=>({title:'Tools',text:'Everything the studio can do to a video beyond making it: sound, picture, words, style, art and export. Open one to run it or ask your agent.'}),
 render(el){
  const groups=[...new Set(this.data.tools.map(t=>t.group))];
  el.innerHTML=groups.map(g=>`<div class="section-head"><h3>${esc(g)}</h3></div><div class="card-grid">${this.data.tools.filter(t=>t.group===g).map(t=>`<button type="button" class="tool-card" onclick="openTool('${esc(t.id)}')"><span class="art">${I[t.icon]||I.tools}</span><span><b>${esc(t.name)}</b><small>${esc(t.about)}</small></span></button>`).join('')}</div>`).join('');
 }});

// ---------- Trash: projects moved out of the way; nothing is deleted until you say so ----------
let emptyingTrash=false;
async function emptyTrash(){
 if(emptyingTrash)return;
 const data=App.screens.trash.data;
 const projects=data.jobs.filter(job=>job.archived).map(job=>job.job);
 const uploads=(data.trashedUploads??[]).map(({request,trashId})=>({request,trashId}));
 const count=projects.length+uploads.length;
 if(!count||!await ask('Empty Trash?',`Delete ${count} ${count===1?'item':'items'} from Trash? Uploaded files are permanently deleted. Saved project files, exports and lessons are kept.`,'Empty Trash',true))return;
 emptyingTrash=true;App.show(false);
 try{
  const result=await api('/api/studio/trash/empty',{method:'POST',body:JSON.stringify({projects,uploads})});
  if(result.failed)toast(`${result.failed} ${result.failed===1?'item':'items'} could not be removed.`,true);
 }catch(error){toast(error.message,true);}
 finally{emptyingTrash=false;await App.refresh(true);}
}
App.register('trash',{
 title:()=>'Trash',load:()=>Studio.load(),
 head:()=>({title:'Trash',text:'Restore projects and uploaded files from here.'}),
 actions(){return this.data.jobs.some(job=>job.archived)||this.data.trashedUploads?.length?`<button type="button" class="btn danger-text" onclick="emptyTrash()" ${emptyingTrash?'disabled':''}>${I.trash} ${emptyingTrash?'Emptying Trash…':'Empty Trash'}</button>`:'';},
 hold:()=>emptyingTrash,
 render(el){
  const gone=this.data.jobs.filter(j=>j.archived),uploads=this.data.trashedUploads??[];
  el.innerHTML=gone.length||uploads.length?`${gone.length?`<section><div class="section-head"><h3>Projects</h3></div><div class="card-grid">${gone.map(j=>projectCard(j)).join('')}</div></section>`:''}
   ${uploads.length?`<section class="trash-uploads"><div class="section-head"><h3>Uploaded files</h3></div><div class="card-grid upload-grid">${uploads.map(f=>uploadCard(f,f.request,true)).join('')}</div></section>`:''}`
   :`<div class="empty"><h2>The trash is empty</h2><p>Projects and uploaded files you move to Trash appear here.</p></div>`;
  wireUploadCards(el);
 }});

// ---------- Appearance ----------
App.register('appearance',{
 title:()=>'Settings',
 head:()=>({title:'Sidebar'}),
 render(el){
  const collapsed=$('#app').dataset.rail==='collapsed';
  el.innerHTML=`<section class="card" style="max-width:640px"><label class="radio-card"><input type="checkbox" ${collapsed?'checked':''} onchange="App.collapse();App.show(false)"><span><b>Show the sidebar as icons</b><small>Press [ anywhere to switch.</small></span></label></section>`;
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

