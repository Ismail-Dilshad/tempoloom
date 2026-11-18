'use strict';
// Create: the home page. Your newest projects in the middle, ideas to start from, and the prompt box
// pinned at the bottom: + adds files, the pill picks the kind of video, Rules and Settings open in the
// right panel, Send starts the job. It writes the same brief the studio has always taken (Studio.N).
const KINDS=[
 {id:'motion',label:'Motion graphics',icon:'spark',about:'From a script, a prompt, a topic or only a link',placeholder:'Describe your video, paste a script or a link…'},
 {id:'edit',label:'Edit my footage',icon:'film',about:'Your talking-head or any video, cut and finished',placeholder:'Say what the edit should do, or leave it to the studio…'},
 {id:'art',label:'Painting or drawing',icon:'brush',about:'Pencil, ink, watercolour or oil, with a timelapse',placeholder:'Describe the subject, the mood and the light…'}];
const kindOf=id=>KINDS.find(k=>k.id===id)||KINDS[0];
/** What a brief file is, for its chip and the picker. */
const FILE_KINDS=[
 {id:'footage',label:'Footage to edit',icon:'film',accept:'video/*,audio/*,.mkv,.mov',multiple:true,modes:['edit']},
 {id:'reference',label:'Reference',icon:'eye',accept:'video/*,image/*',multiple:true,modes:['motion','edit','art'],about:'A video or picture to study, never copied'},
 {id:'logo',label:'Logo',icon:'logo',accept:'image/*,.svg',multiple:false,modes:['motion','edit']},
 {id:'asset',label:'Other files',icon:'folder',accept:'image/*,video/*,audio/*,.pdf,.txt,.md',multiple:true,modes:['motion','edit']}];

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
 load:async()=>{const [S,live]=await Promise.all([Studio.load(),api('/api/studio/live').catch(()=>({jobs:[]}))]);S.liveList=live.jobs||[];return S;},
 hold:()=>!!Studio.busy||Studio.sending,
 render(el){
  const S=this.data,jobs=S.jobs.filter(j=>!j.archived),queued=S.requests.filter(r=>r.status==='waiting');
  const live=j=>(S.liveList||[]).find(x=>x.job===j.job&&x.active);
  const ideas=[...PRESETS.map((p,i)=>({label:p.name,about:p.notes.split(':')[0],icon:p.mode==='edit'?'film':'spark',run:`usePreset(${i})`})),
   {label:'Recreate a style',about:'Same design, your content: add a reference',icon:'eye',run:"Picker.open('reference')"},
   {label:'Trend watch',about:'Formats getting popular for your topics',icon:'trend',href:'#/tools/trends'},
   {label:'Learn a channel',about:'Save a creator\'s style as a look',icon:'channel',run:"openTool('look-channel')"}];
  const ideaHtml=ideas.map(x=>x.href?`<a class="idea" href="${x.href}"><span class="art">${I[x.icon]}</span><span>${esc(x.label)}<small>${esc(x.about)}</small></span></a>`
   :`<button type="button" class="idea" onclick="${x.run}"><span class="art">${I[x.icon]}</span><span>${esc(x.label)}<small>${esc(x.about)}</small></span></button>`).join('');
  const strip=`<section class="idea-strip" aria-label="Start from an idea"><h3>Start from an idea</h3><div class="idea-row">${ideaHtml}</div></section>`;
  if(!jobs.length&&!queued.length){
   el.innerHTML=`<div class="no-head create-page"><div class="hero-empty"><img src="/mark.svg?v=10" alt="Tempoloom" width="112" height="112"><h2>Start creating or drop media</h2><p>Describe a video below, paste a script or a link, or drop your footage anywhere on this page.</p></div>${strip}</div>`;return;}
  el.innerHTML=`<div class="no-head create-page">
   ${App.home.you.length?`<div class="banner you" style="margin-bottom:24px"><b>Waiting for you:</b> ${App.home.you.map(j=>`<a href="#/projects/${encodeURIComponent(j.job)}">${esc(j.title)}</a>`).join(', ')}</div>`:''}
   <div class="create-projects"><div class="section-head"><h3>Your projects</h3><a href="#/projects">See all ${jobs.length+queued.length}</a></div>
   <div class="card-grid">${queued.map(r=>queuedCard(r)).join('')}${jobs.slice(0,8-Math.min(queued.length,4)).map(j=>{const now=live(j);return projectCard(j,{working:!!now,face:now?.face});}).join('')}</div></div>
   ${strip}</div>`;
 }});
function queuedCard(r){
 return `<div class="pcard-wrap" style="position:relative"><div class="pcard"><span class="thumb">${I[r.input?.mode==='edit'?'film':r.input?.mode==='art'?'brush':'spark']}<span class="badge">Sent, not started</span></span>
  <b dir="auto">${esc((r.input?.text||r.summary||'New video').split('\n')[0].slice(0,90))}</b><span class="meta"><span>${esc(kindOf(r.input?.mode).label)}</span><span>${ago(r.created)}</span></span></div>
  <button class="iconbtn sm more" aria-label="More for this queued video" aria-haspopup="menu" aria-expanded="false" onclick="queuedMenu(this,'${r.id}')">${I.more}</button></div>`;
}
window.queuedMenu=(btn,id)=>Pop.open(btn,`<button class="pop-item" data-close onclick="editQueued('${id}')">${I.rules}<span>Edit brief</span></button><button class="pop-item danger" data-close onclick="deleteQueued('${id}')">${I.trash}<span>Delete</span></button>`,{align:'end',label:'Queued video'});
window.usePreset=i=>{const {name,...p}=PRESETS[i];Object.assign(Studio.N,p);Studio.save();dockRefresh();toast(`Starting from “${name}”. Describe your video and send it.`);Dock.focus();};

// ---------- the dock on Create ----------
const fileChip=f=>`<span class="file-chip" title="${esc(f.name)}">${I[(FILE_KINDS.find(k=>k.id===f.kind)||FILE_KINDS[3]).icon]}<span dir="auto">${esc(f.name)}</span><small>${esc((FILE_KINDS.find(k=>k.id===f.kind)||{}).label||f.kind)}</small><button type="button" class="iconbtn" aria-label="Remove ${esc(f.name)}" onclick="briefRemove('${esc(f.name)}')">${I.x}</button></span>`;
Dock.kinds.create={
 html(){
  const N=Studio.N,k=kindOf(N.mode);
  return `<div class="dock" id="dock" aria-label="Prompt">
   <div class="dock-files" id="dock-files" ${N.files.length?'':'hidden'}>${N.files.map(fileChip).join('')}</div>
   <div class="dock-text"><textarea id="dock-text" rows="1" dir="auto" maxlength="12000" aria-label="What do you want to make?" placeholder="${esc(k.placeholder)}">${esc(N.text)}</textarea>
    <button type="button" class="iconbtn sm" id="dock-expand" aria-label="Make the box bigger" aria-pressed="false">${I.expand}</button></div>
   <div class="dock-busy" id="dock-busy" ${Studio.busy?'':'hidden'}><span class="spin"></span><span>${esc(Studio.busy?.text||'')}</span></div>
   <div class="dock-tools">
    <button type="button" class="iconbtn" id="dock-add" aria-label="Add files" onclick="Picker.open()">${I.add}</button>
    <button type="button" class="kind-pill" id="dock-kind" aria-haspopup="menu" aria-expanded="false" onclick="kindMenu(this)">${I[k.icon]}<span>${esc(k.label)}</span>${I.chevron}</button>
    <span class="grow"></span>
    <button type="button" class="iconbtn" aria-label="Rules for this video" aria-pressed="${Panel.id==='rules'}" onclick="rulesPanel()">${I.rules}</button>
    <button type="button" class="iconbtn" aria-label="Settings for this video" aria-pressed="${Panel.id==='brief-settings'}" onclick="settingsPanel()">${I.sliders}</button>
    <button type="button" class="iconbtn primary" id="dock-send" aria-label="Send to the studio" ${Studio.sending||Studio.busy?'disabled':''}>${I.send}</button>
   </div></div>`;
 },
 wire(el){
  const t=$('#dock-text',el),N=Studio.N;autoGrow(t);
  t.oninput=()=>{N.text=t.value;Studio.save();autoGrow(t);};
  t.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();createSend();}
   else if(e.key==='/'&&!t.value){e.preventDefault();Cmd.open();}};
  $('#dock-send',el).onclick=createSend;
  $('#dock-expand',el).onclick=e=>{const on=$('#dock',el).classList.toggle('expanded');e.currentTarget.setAttribute('aria-pressed',on);autoGrow(t);t.focus();};
  const dock=$('#dock',el);
  for(const ev of ['dragenter','dragover'])dock.addEventListener(ev,e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dock.classList.add('drop-over');}});
  dock.addEventListener('dragleave',()=>dock.classList.remove('drop-over'));
  dock.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();dock.classList.remove('drop-over');dropFiles([...e.dataTransfer.files]);});
 },
 refresh(el){
  const N=Studio.N,files=$('#dock-files',el);if(!files)return;
  files.innerHTML=N.files.map(fileChip).join('');files.hidden=!N.files.length;
  const b=$('#dock-busy',el);b.hidden=!Studio.busy;b.lastElementChild.textContent=Studio.busy?.text||'';
  $('#dock-send',el).disabled=!!(Studio.sending||Studio.busy);
  const k=kindOf(N.mode),pill=$('#dock-kind',el);pill.innerHTML=`${I[k.icon]}<span>${esc(k.label)}</span>${I.chevron}`;$('#dock-text',el).placeholder=k.placeholder;
  const t=$('#dock-text',el);if(document.activeElement!==t&&t.value!==N.text){t.value=N.text;autoGrow(t);}
 }};
const dockRefresh=()=>{if(Dock.mode==='create'&&Dock.el)Dock.kinds.create.refresh(Dock.el);};
window.kindMenu=btn=>{
 const N=Studio.N;
 Pop.open(btn,`<div class="pop-head">What are you making?</div>${KINDS.map(k=>`<button class="pop-item" role="menuitemradio" aria-checked="${N.mode===k.id}" data-close onclick="setKind('${k.id}')">${I[k.icon]}<span>${esc(k.label)}<small>${esc(k.about)}</small></span></button>`).join('')}
  ${PRESETS.some(p=>p.mode===N.mode)?`<hr><div class="pop-head">Start from</div>${PRESETS.map((p,i)=>p.mode===N.mode?`<button class="pop-item" data-close onclick="usePreset(${i})">${I.spark}<span>${esc(p.name)}</span></button>`:'').join('')}`:''}`,{up:true,label:'Kind of video'});
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
window.briefRemove=name=>act(async()=>{const N=Studio.N;const r=await api(`/api/studio/requests/${N.id}/files?name=${encodeURIComponent(name)}`,{method:'DELETE'});N.files=r.files;Studio.save();dockRefresh();});
document.addEventListener('dragover',e=>{if(App.route==='create'&&e.dataTransfer?.types.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(App.route==='create'&&e.dataTransfer?.files.length&&!e.target.closest('.dock,.overlay')){e.preventDefault();dropFiles([...e.dataTransfer.files]);}});
/** A link written alone or inside the text becomes the brief's link (read for facts and brand). */
function createSend(){
 const N=Studio.N;
 if(N.mode==='motion'&&!N.link){const m=/https?:\/\/\S+/.exec(N.text);if(m){N.link=m[0].replace(/[),.]+$/,'');N.text=N.text.replace(m[0],'').trim();Studio.save();}}
 sendBrief().then(()=>{dockRefresh();});
}

// ---------- Rules and Settings panels ----------
window.rulesPanel=()=>{
 if(Panel.id==='rules'){Panel.close();dockRefresh();return;}
 const N=Studio.N,S=Studio.S,rules=S?.scores?.rules||[];
 Panel.open({id:'rules',title:'Rules for this video',sub:'Anything the studio should keep to. Your taste and the rules it learned apply to every video.',
  body:`<label class="field-label" for="rule-notes">For this video</label>
   <textarea id="rule-notes" dir="auto" maxlength="2000" style="min-height:140px" placeholder="Audience, mood, must-haves. For example: for busy parents, warm and calm, always show the price.">${esc(N.notes)}</textarea>
   ${N.mode==='motion'?`<label class="radio-card" style="margin-top:12px"><input type="checkbox" id="rule-script" ${N.script?'checked':''}><span><b>Use my text word for word</b><small>It is my finished script: the studio keeps every word.</small></span></label><div id="sd-live"></div>`:''}
   <h3 class="field-label">Rules the studio already follows</h3>
   ${rules.length?rules.map(r=>`<div class="list-row"><div><span dir="auto">${esc(r)}</span></div></div>`).join(''):'<p class="muted small">None yet. When you tell the studio something about a video, it becomes a rule here.</p>'}
   <p class="small"><a href="#/brain/taste">Your taste</a> · <a href="#/brain/lessons">Lessons</a></p>`,
  foot:`<button class="btn primary" onclick="Panel.close();dockRefresh()">Done</button>`});
 $('#rule-notes').oninput=e=>{N.notes=e.target.value;Studio.save();};
 if($('#rule-script'))$('#rule-script').onchange=e=>{N.script=e.target.checked;Studio.save();if(typeof sdLive==='function'){SD.last='';sdLive();}};
 if(typeof sdLive==='function'){SD.last='';sdLive();}
 dockRefresh();
};
const SHAPES=[['','Auto',''],['horizontal','16:9','width:18px;height:10px'],['vertical','9:16','width:10px;height:18px'],['square','1:1','width:14px;height:14px']];
const LENGTHS=[['','Auto'],['15','15 s'],['30','30 s'],['45','45 s'],['60','1 min'],['90','1.5 min'],['120','2 min']];
window.settingsPanel=()=>{
 const N=Studio.N,S=Studio.S||{profiles:[],taught:[],looks:[]},m=N.mode==='motion',art=N.mode==='art';
 const sel=(id,opts,val,label)=>`<label class="field-label" for="${id}">${label}</label><select id="${id}">${opts.map(([v,l])=>`<option value="${esc(v)}"${String(val)===String(v)?' selected':''}>${esc(l)}</option>`).join('')}</select>`;
 const seg=(name,opts,val)=>`<div class="seg-tiles ${name==='seconds'?'compact':''}" role="group" aria-label="${name==='shape'?'Shape':'Length'}">${opts.map(([v,l,box])=>`<button type="button" aria-pressed="${String(val||'')===v}" data-seg="${name}" data-v="${v}">${box!==undefined?(box?`<i class="shape" style="${box}"></i>`:I.spark):''}<span>${esc(l)}</span></button>`).join('')}</div>`;
 const toggle=(id,on,title,about)=>`<label class="radio-card"><input type="checkbox" id="${id}" ${on?'checked':''}><span><b>${esc(title)}</b>${about?`<small>${esc(about)}</small>`:''}</span></label>`;
 const styles=[['','Choose a style'],...(S.looks||[]).map(l=>[l.name,l.name+(l.summary?' ('+l.summary+')':'')]),...(S.taught||[]).map(v=>[v.id,'Taught: '+v.title.slice(0,50)])];
 Panel.open({id:'brief-settings',title:'Settings for this video',sub:'Saved as you change them; the next video starts from these.',
  body:`<span class="field-label">Shape</span>${seg('shape',SHAPES,N.shape)}
   ${art?sel('medium',[['','Studio chooses'],['watercolor','Watercolour'],['oil','Oil'],['acrylic','Acrylic'],['gouache','Gouache'],['pencil','Pencil'],['charcoal','Charcoal'],['ink','Ink'],['pastel','Pastel'],['mixed','Mixed media']],N.medium||'','Medium')
    :`<span class="field-label">Length</span>${seg('seconds',LENGTHS,N.seconds)}${sel('language',LANGS,N.language,'Language')}`}
   ${art?'':`<div style="margin-top:16px">${m?toggle('voice',N.voice,'Add a voice-over','Uses your ElevenLabs account.'):toggle('captions',N.captions,'Captions','')}</div>`}
   <details class="more-opts" ${store.get('more-opts',false)?'open':''} ontoggle="store.set('more-opts',this.open)"><summary>More options</summary>
   ${(S.profiles||[]).length>1?sel('profile',S.profiles.map(p=>[p.id==='main'?'':p.id,p.name]),N.profile,'Taste profile'):''}
   ${m?toggle('pick',N.pick,'Show me two looks and let me pick','The studio waits for your choice before it builds.'):''}
   ${N.mode==='edit'?toggle('visuals',N.visuals,'Designed visuals over the footage','Where they help.'):''}
   ${toggle('second',N.second!==false,'A second opinion','Another reviewer with a different taste checks it.')}
   ${N.second!==false?sel('secondProfile',[['','A general viewer'],...(S.profiles||[]).filter(p=>p.id!==(N.profile||'main')).map(p=>[p.id,p.name])],N.secondProfile||'','Their taste'):''}
   ${art?'':`${toggle('useColors',N.useColors,'Use these colours for this video','')}
    <div class="row" style="gap:12px;margin:4px 0 0 12px" ${N.useColors?'':'hidden'}>${[['primary','Main'],['accent','Accent'],['background','Background']].map(([k,l])=>`<label class="row small" style="gap:6px"><input type="color" id="c-${k}" value="${esc(N[k])}"> ${l}</label>`).join('')}</div>`}
   ${m&&S.taught?.length?sel('like',[['','None'],...S.taught.map(v=>[v.id,v.title.slice(0,60)])],N.like,'In the spirit of a video you taught'):''}
   ${m&&styles.length>2?`${toggle('useMix',N.useMix,'Mix two styles I taught','')}
    <div ${N.useMix?'':'hidden'}>${sel('mixA',styles,N.mixA||'','Style A')}${sel('mixB',styles,N.mixB||'','Style B')}
    <label class="field-label" for="mixWeight">How much of each: <b id="mixLabel">${N.mixWeight??70}% A, ${100-(N.mixWeight??70)}% B</b></label><input type="range" id="mixWeight" min="0" max="100" step="5" value="${N.mixWeight??70}" style="width:100%"></div>`:''}
   </details>`,
  foot:`<button class="btn primary" onclick="Panel.close();dockRefresh()">Done</button>`});
 const B=Panel.body(),redraw=()=>{const y=B.scrollTop;settingsPanel();Panel.body().scrollTop=y;};
 B.querySelectorAll('[data-seg]').forEach(b=>b.onclick=()=>{N[b.dataset.seg]=b.dataset.v;Studio.save();redraw();});
 for(const id of ['medium','language','profile','secondProfile','like','mixA','mixB'])if($('#'+id,B))$('#'+id,B).onchange=e=>{N[id]=e.target.value;Studio.save();};
 for(const id of ['pick','voice','captions','visuals'])if($('#'+id,B))$('#'+id,B).onchange=e=>{N[id]=e.target.checked;Studio.save();};
 for(const id of ['second','useColors','useMix'])if($('#'+id,B))$('#'+id,B).onchange=e=>{N[id]=e.target.checked;Studio.save();redraw();};
 for(const k of ['primary','accent','background'])if($('#c-'+k,B))$('#c-'+k,B).oninput=e=>{N[k]=e.target.value;Studio.save();};
 if($('#mixWeight',B))$('#mixWeight',B).oninput=e=>{N.mixWeight=Number(e.target.value);$('#mixLabel').textContent=`${N.mixWeight}% A, ${100-N.mixWeight}% B`;Studio.save();};
 dockRefresh();
};

// ---------- the picker: files for this video, or from your library ----------
const Picker={
 tab:'footage',chosen:new Set(),lib:null,q:'',
 open(tab){
  const N=Studio.N,kinds=FILE_KINDS.filter(k=>k.modes.includes(N.mode));
  this.tab=tab&&(tab==='library'||kinds.some(k=>k.id===tab))?tab:(kinds[0]?.id||'reference');this.chosen=new Set();this.q='';
  Overlay.open(`<div class="picker"><div class="picker-head"><b style="padding:0 8px">Add files</b><form class="tb-search" onsubmit="event.preventDefault()">${I.search}<input type="search" id="pick-q" placeholder="Search your library" aria-label="Search your library" autocomplete="off"></form><button class="iconbtn sm" aria-label="Close" onclick="Overlay.close()">${I.x}</button></div>
   <nav class="picker-side" id="pick-side" aria-label="Kinds of file"></nav><div class="picker-main" id="pick-main"></div>
   <div class="picker-foot"><label class="btn ghost" style="cursor:pointer">${I.upload} Upload<input type="file" id="pick-file" hidden multiple></label><span class="grow muted small" id="pick-note"></span><button class="btn primary" id="pick-use" hidden>Use selected</button></div></div>`,{label:'Add files',onclose:dockRefresh});
  $('#pick-q').oninput=e=>{this.q=e.target.value.toLowerCase();if(this.tab!=='library'){this.tab='library';}this.draw();};
  $('#pick-file').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(this.tab==='library'){await libraryUpload(files);this.lib=null;}else await briefUpload(this.tab,files);this.draw();dockRefresh();};
  $('#pick-use').onclick=()=>this.useLibrary();
  this.draw();
 },
 async draw(){
  const N=Studio.N,kinds=FILE_KINDS.filter(k=>k.modes.includes(N.mode)),side=$('#pick-side'),main=$('#pick-main');if(!side)return;
  side.innerHTML=`<div class="pop-head">For this video</div>${kinds.map(k=>`<button class="navlink" ${this.tab===k.id?'aria-current="page"':''} onclick="Picker.tab='${k.id}';Picker.draw()">${I[k.icon]}<span class="lbl">${esc(k.label)}</span>${N.files.filter(f=>f.kind===k.id).length?`<span class="n">${N.files.filter(f=>f.kind===k.id).length}</span>`:''}</button>`).join('')}
   <div class="pop-head">From your library</div><button class="navlink" ${this.tab==='library'?'aria-current="page"':''} onclick="Picker.tab='library';Picker.draw()">${I.folder}<span class="lbl">Your media</span></button>`;
  const fk=FILE_KINDS.find(k=>k.id===this.tab);$('#pick-file').accept=fk?fk.accept:'image/*,video/*,audio/*';$('#pick-file').multiple=fk?fk.multiple:true;
  $('#pick-use').hidden=this.tab!=='library';$('#pick-use').disabled=!this.chosen.size;$('#pick-use').textContent=this.chosen.size?`Use ${this.chosen.size} selected`:'Use selected';
  if(this.tab!=='library'){
   const mine=N.files.filter(f=>f.kind===this.tab);$('#pick-note').textContent=fk.about||'Files stay on this computer.';
   main.innerHTML=Studio.busy?`<p class="muted"><span class="spin"></span> ${esc(Studio.busy.text)}</p>`:mine.length?`<div class="pick-grid">${mine.map(f=>`<div class="pick"><span class="thumb">${I[fk.icon]}</span><span dir="auto">${esc(f.name)}</span><small>${mb(f.bytes)}</small><button class="btn small ghost" onclick="briefRemove('${esc(f.name)}').then(()=>Picker.draw())">Remove</button></div>`).join('')}</div>`
    :`<div class="empty"><div class="empty-art">${I[fk.icon]}</div><h3>No ${esc(fk.label.toLowerCase())} yet</h3><p>Upload ${fk.multiple?'files':'a file'} below, or drop ${fk.multiple?'them':'it'} on the prompt box.</p></div>`;
   return;}
  $('#pick-note').textContent='Your logos, pictures, music and clips. A copy goes with this video.';
  if(!this.lib){main.innerHTML='<p class="muted"><span class="spin"></span> Opening your library</p>';this.lib=(await api('/api/library').catch(()=>({entries:[]}))).entries;}
  const list=this.lib.filter(e=>!this.q||(e.name+' '+e.description+' '+e.tags.join(' ')+' '+e.kind).toLowerCase().includes(this.q));
  main.innerHTML=list.length?`<div class="pick-grid">${list.map(e=>`<button type="button" class="pick" aria-pressed="${this.chosen.has(e.id)}" onclick="Picker.toggle('${esc(e.id)}')"><span class="thumb">${libThumb(e)}</span><span dir="auto">${esc(e.name)}</span><small>${esc(LIB_LABEL[e.kind]||e.kind)}</small></button>`).join('')}</div>`
   :`<div class="empty"><div class="empty-art">${I.folder}</div><h3>${this.lib.length?'Nothing matches':'Your library is empty'}</h3><p>${this.lib.length?'Try another word.':'Upload logos, music, pictures and clips once, and use them in every video.'}</p></div>`;
 },
 toggle(id){this.chosen.has(id)?this.chosen.delete(id):this.chosen.add(id);this.draw();},
 async useLibrary(){
  const picked=this.lib.filter(e=>this.chosen.has(e.id));if(!picked.length)return;
  for(const e of picked){const blob=await fetch(withKey('/api/library/'+e.id+'/file')).then(r=>r.blob());await briefUpload(e.kind==='logo'?'logo':'asset',[new File([blob],e.name,{type:blob.type})]);}
  Overlay.close();toast(`Added ${picked.length} from your library`);
 }};
const LIB_LABEL={logo:'Logo',image:'Picture',music:'Music',sound:'Sound',clip:'Clip'};
const libThumb=e=>e.kind==='logo'||e.kind==='image'?`<img loading="lazy" alt="" src="${withKey('/api/library/'+e.id+'/file')}">`:I[e.kind==='music'?'music':e.kind==='sound'?'sound':'clip'];
