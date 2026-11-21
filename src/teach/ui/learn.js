'use strict';
// Learn, in one place: add a video in the + popup (a file, a link, or one the studio made); it shows there,
// shows in the prompt, a drawer beside the page says what to learn from it, and Send teaches it.
// No separate pages: the videos it learned from are the cards above (teach.js draws them).
const Learn={
 /** The video selected into the prompt (one of your uploaded videos, not yet taught), if any. */
 get cur(){return store.get('learn-cur',null);},set cur(id){store.set('learn-cur',id||null);},
 busy:null,// {text} while a video comes in or is sent
 text:'',
 gone:new Set(),// taken out with ✕: hidden at once, while the server removes them
 get drafts(){return (Teach.S?.videos||[]).filter(v=>v.status==='draft'&&!this.gone.has(v.id));},
 get draft(){const all=this.drafts;return all.find(v=>v.id===this.cur)||null;},
 /** The setup of a video: what to learn and how, kept until it is sent. */
 setup(v){
  const mode=teachMode(store.get('teach-mode','motion'));
  return Teach.D[v.id]??={id:v.id,sourceTitle:v.title,mode:mode.id,autoTitle:true,title:'',verdict:'good',
   topics:new Set(mode.topics.filter(t=>t!=='audio'||v.media.audio)),marks:[],start:0,end:v.media.seconds,seconds:v.media.seconds,
   audio:v.media.audio,sound:v.media.audio&&mode.topics.includes('audio'),speech:false,keepPlayback:v.source!=='link',crop:null,aspect:'full',autoName:true};
 },
 title(d){return d.autoTitle?automaticTitle(d):d.title;},
 refreshDock(){if(Dock.mode==='learn'&&Dock.el)Dock.kinds.learn.refresh(Dock.el);},
 setBusy(text){this.busy=text?{text}:null;this.refreshDock();LearnPicker.redraw();},
 /** A video file comes in: it uploads with its progress in the prompt, then waits there to be taught. */
 async upload(file){
  if(this.busy)return;
  const S=Teach.S;if(S&&file.size>S.can.maxMB*1048576)return toast(`${file.name} is over ${S.can.maxMB} MB.`,true);
  try{
   this.setBusy('Adding '+file.name);
   const v=await new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('POST','/api/upload?name='+encodeURIComponent(file.name));x.setRequestHeader('x-teach-key',KEY);
    x.upload.onprogress=e=>{if(e.lengthComputable){const p=Math.round(e.loaded/e.total*100);this.setBusy(p<100?`Adding ${file.name} · ${p}%`:'Preparing the preview');}};
    x.onload=()=>{let j={};try{j=JSON.parse(x.responseText);}catch{}x.status===200?res(j):rej(new Error(j.error||'The upload failed'));};
    x.onerror=()=>rej(new Error('The upload failed. Is the terminal still open?'));x.send(file);});
   await this.arrived(v.id);
  }catch(e){toast(e.message,true);}finally{this.setBusy(null);}
 },
 /** A link: the video is found and brought in (the first one, when a post holds several). */
 async link(url){
  if(this.busy)return;
  try{
   this.setBusy('Finding your video');
   let r=await api('/api/link',{method:'POST',body:JSON.stringify({url,confirm:false})});
   if(r.status==='needs-confirmation'){
    this.busy=null;
    const pick=r.info.choices.length>1?await this.choose(r.info):(r.info.choices.find(c=>c.item===r.info.item)||r.info.choices[0]);
    if(!pick)return;
    this.setBusy('Bringing in the video');
    r=await api('/api/link',{method:'POST',body:JSON.stringify({url,confirm:true,previewToken:r.previewToken,selection:{id:pick.id,item:pick.item}})});
   }
   this.text='';await this.arrived(r.video.id);
  }catch(e){toast(/yt-dlp failed|NEED_LOGIN|empty media|HTTP Error 4\d\d/i.test(e.message)?'The site would not share this video. Check it opens in your browser; or save the video and add it with +.':e.message,true);}finally{this.setBusy(null);}
 },
 /** A post with several videos: a short list above the prompt to pick one (Escape cancels). */
 choose(info){
  const https=u=>typeof u==='string'&&u.startsWith('https://')?u:'';
  // In the + popup the choice shows there; otherwise as a short list above the prompt.
  const main=$('#learn-pick #pick-main');
  if(main)return new Promise(res=>{
   main.innerHTML=`<h3 class="field-label">This post has ${info.choices.length} videos. Which one?</h3><div class="pick-grid">${info.choices.map(c=>`<button type="button" class="pick learn-choice" role="menuitem" data-item="${c.item}"><span class="thumb">${https(c.thumbnail)?`<img class="upload-preview" alt="" src="${esc(https(c.thumbnail))}" referrerpolicy="no-referrer">`:I.film}</span><span dir="auto">${esc(c.title||'Video '+c.item)}</span></button>`).join('')}</div>`;
   $('#pick-foot').innerHTML=`<button type="button" class="btn ghost" id="pick-cancel-choice">Cancel</button>`;
   main.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>res(info.choices.find(x=>String(x.item)===b.dataset.item)));
   $('#pick-cancel-choice').onclick=()=>{res(null);LearnPicker.redraw();};
  });
  return new Promise(res=>{
   const anchor=$('#dock-send');let done=false;const end=v=>{if(done)return;done=true;res(v);};
   const https=u=>typeof u==='string'&&u.startsWith('https://')?u:'';
   const menu=Pop.open(anchor,`<div class="pop-head">Which video?</div>${info.choices.map(c=>`<button type="button" class="pop-item learn-choice" role="menuitem" data-item="${c.item}">${https(c.thumbnail)?`<img alt="" src="${esc(https(c.thumbnail))}" referrerpolicy="no-referrer">`:I.film}<span dir="auto">${esc(c.title||'Video '+c.item)}</span></button>`).join('')}`,
    {up:true,align:'end',label:'Which video?',onclose:()=>end(null)});
   if(!menu)return end(null);
   menu.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const c=info.choices.find(x=>String(x.item)===b.dataset.item);end(c);Pop.close();});
  });
 },
 /** Selects an uploaded video into the prompt, or unselects (null). Uploaded videos stay either way. */
 select(id){this.cur=id;if(!id&&Panel.id==='learn-setup')Panel.close();this.refreshDock();LearnPicker.redraw();},
 async arrived(id){this.cur=id;await App.refresh(true);
  const from=this.refineFrom,draft=this.draft;this.refineFrom=null;
  if(from&&draft){const d=this.setup(draft),m=teachMode(from.group);Object.assign(d,{mode:m.id,verdict:from.verdict,topics:new Set(from.topics.filter(t=>t!=='audio'||d.audio)),autoTitle:false,title:from.title});this.text=from.prompt||'';this.refreshDock();}if(LearnPicker.isOpen())LearnPicker.redraw();else if(this.draft)this.drawer();},
 /** Send: the video is taught with what the drawer says and, if any, the words in the prompt. */
 async teach(){
  const v=this.draft;if(!v||this.busy)return;
  const d=this.setup(v),words=this.text.trim();
  if(!d.topics.size){this.drawer();return toast('Choose at least one thing to learn.',true);}
  const whole=d.start<=.01&&d.end>=d.seconds-.01;
  const body={keepPlayback:d.keepPlayback,title:this.title(d).trim()||v.title,verdict:d.verdict,prompt:[words||automaticPrompt(d),await readInstructions('learn').then(c=>instructionNotes(c||[])).catch(()=>'')].filter(Boolean).join('\n\n').slice(0,2000),topics:[...d.topics],marks:[],
   segment:whole?null:{start:Math.round(d.start*1000)/1000,end:Math.round(d.end*1000)/1000},crop:d.crop||null,sound:d.audio&&d.sound,speech:d.audio&&d.sound&&d.speech,autoName:d.autoName!==false};
  try{
   this.setBusy('Sending it to learn');
   await api('/api/videos/'+v.id+'/teach',{method:'POST',body:JSON.stringify(body)});
   store.set('teach-topics',[...d.topics]);delete Teach.D[v.id];this.cur=null;this.text='';
   if(Panel.id==='learn-setup')Panel.close();
   toast('Learning from it now');
  }catch(e){toast(e.message,true);}finally{this.setBusy(null);await App.refresh(true);}
 },
 /** ✕ takes the video out of the prompt at once, like Create's files; the server removes it after. */
 async remove(id){
  this.gone.add(id);delete Teach.D[id];if(this.cur===id)this.cur=null;
  if(Panel.id==='learn-setup')Panel.close();
  this.refreshDock();
  try{await api('/api/videos/'+id,{method:'DELETE'});}catch(e){this.gone.delete(id);toast(e.message,true);}
  await App.refresh(true);
 },
 /** The drawer beside the page: the video, and what to learn from it. */
 /** What to learn from a video: the same form in the side drawer and in the expanded prompt. */
 setupHtml(v){
  const d=this.setup(v),S=Teach.S,W=v.media.width||16,H=v.media.height||9,crops=LEARN_CROPS;
  const seg=(name,list,on)=>`<div class="seg-tiles compact" role="group" aria-label="${esc(name)}">${list.map(([id,label,icon])=>`<button type="button" data-${name.toLowerCase().replace(/\W+/g,'-')}="${id}" aria-pressed="${on===id}">${icon?I[icon]:''}<span>${esc(label)}</span></button>`).join('')}</div>`;
  const toggle=(id,on,title,icon,off)=>`<label class="video-setting${off?' is-off':''}"><span class="video-setting-icon" aria-hidden="true">${I[icon]}</span><b>${esc(title)}</b><input type="checkbox" role="switch" id="${id}" ${on?'checked':''} ${off?'disabled':''}></label>`;
  return `<div class="video-settings learn-setup">
    <div class="learn-stage"><video class="learn-preview" src="${esc(withKey('/media/'+v.id+'/preview.mp4'))}" muted playsinline preload="metadata"></video>
     <div class="learn-crop-box" hidden aria-label="Crop frame: drag to move, drag a corner to resize">${['nw','ne','sw','se'].map(h=>`<i data-h="${h}"></i>`).join('')}</div></div>
    <div class="learn-controls"><button type="button" class="iconbtn sm" id="learn-play" aria-label="Play">${I.play}</button><span class="learn-time" id="learn-time">0:00 / ${fmtS(d.seconds)}</span>${v.media.audio?`<button type="button" class="iconbtn sm" id="learn-mute" aria-label="Turn sound on">${I.sound}</button>`:''}</div>
    <section class="video-settings-section"><label class="field-label" for="learn-name">Name</label><div class="learn-name"><input type="text" id="learn-name" dir="auto" maxlength="120" value="${esc(this.title(d))}"><button type="button" class="learn-name-auto" id="learn-auto-name" aria-pressed="${d.autoName!==false}" title="After learning, your agent gives it a clear name from what it taught">${I.spark}<span>Name it after learning</span></button></div></section>
    <section class="video-settings-section"><h3 class="field-label">What to learn</h3><div class="prompt-modes" role="group" aria-label="What to learn">${TEACH_MODES.map(m=>`<button type="button" class="prompt-mode" data-mode="${m.id}" aria-pressed="${d.mode===m.id}"><span class="prompt-mode-icon">${I[m.icon]}</span><span>${esc(m.name)}</span></button>`).join('')}</div></section>
    <section class="video-settings-section"><h3 class="field-label">Use it as</h3>${seg('Verdict',[['good','A good example'],['bad','What to avoid']],d.verdict)}</section>
    <section class="video-settings-section"><h3 class="field-label">Focus</h3><div class="learn-focus" role="group" aria-label="Focus">${S.topics.filter(t=>t.id!=='audio').map(t=>`<button type="button" data-topic="${t.id}" aria-pressed="${d.topics.has(t.id)}">${esc(t.label)}</button>`).join('')}</div></section>
    <section class="video-settings-section"><h3 class="field-label">Trim</h3>
     <div class="learn-range" id="learn-range"><div class="learn-range-fill"></div><i class="learn-range-head"></i>
      <input type="range" id="learn-in" min="0" max="${d.seconds}" step="0.01" value="${d.start}" aria-label="Start">
      <input type="range" id="learn-out" min="0" max="${d.seconds}" step="0.01" value="${d.end}" aria-label="End"></div>
     <p class="learn-trim-note" id="learn-trim-note"></p></section>
    <section class="video-settings-section"><h3 class="field-label">Crop</h3>${seg('Crop',crops.map(([id,label])=>[id,label]),d.aspect||'full')}
     <div class="learn-crop-actions" id="learn-crop-actions"></div></section>
    <section class="video-settings-section"><h3 class="field-label">Sound</h3>${toggle('learn-sound',d.audio&&d.sound,d.audio?'Study the soundtrack':'This video has no sound','sound',!d.audio)}${d.audio?toggle('learn-speech',d.speech,'Write down what is said','captions',!d.sound):''}</section>
   </div>`;
 },
 wireSetup(B,v){
  const d=this.setup(v);
  const pressed=(sel,el)=>B.querySelectorAll(sel).forEach(b=>b.setAttribute('aria-pressed',String(b===el)));
  const name=$('#learn-name',B),retitle=()=>{if(d.autoTitle)name.value=this.title(d);};
  name.oninput=()=>{d.title=name.value;d.autoTitle=!name.value.trim();};
  const auto=$('#learn-auto-name',B);auto.onclick=()=>{d.autoName=d.autoName===false;auto.setAttribute('aria-pressed',String(d.autoName));};
  B.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{const m=teachMode(b.dataset.mode);d.mode=m.id;store.set('teach-mode',m.id);
   d.topics=new Set(m.topics.filter(t=>t!=='audio'||d.audio));d.sound=d.audio&&m.topics.includes('audio');pressed('[data-mode]',b);
   B.querySelectorAll('[data-topic]').forEach(t=>t.setAttribute('aria-pressed',String(d.topics.has(t.dataset.topic))));
   const s=$('#learn-sound',B);if(s){s.checked=d.sound;const sp=$('#learn-speech',B);if(sp){sp.disabled=!d.sound;if(!d.sound)sp.checked=d.speech=false;}}
   retitle();this.refreshDock();});
  B.querySelectorAll('[data-verdict]').forEach(b=>b.onclick=()=>{d.verdict=b.dataset.verdict;pressed('[data-verdict]',b);});
  B.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{const t=b.dataset.topic,on=!d.topics.has(t);on?d.topics.add(t):d.topics.delete(t);b.setAttribute('aria-pressed',String(on));});
  // Play, time and sound for the preview (plays only the trimmed part, again and again).
  const vid=$('.learn-preview',B),play=$('#learn-play',B),time=$('#learn-time',B),mute=$('#learn-mute',B);
  const playing=()=>{const on=!vid.paused;play.innerHTML=on?I.pause:I.play;play.setAttribute('aria-label',on?'Pause':'Play');};
  play.onclick=()=>{if(vid.paused){if(vid.currentTime<d.start||vid.currentTime>=d.end-.05)vid.currentTime=d.start;vid.play().catch(()=>{});}else vid.pause();};
  vid.onplay=vid.onpause=playing;
  if(mute)mute.onclick=()=>{vid.muted=!vid.muted;mute.setAttribute('aria-label',vid.muted?'Turn sound on':'Turn sound off');mute.style.color=vid.muted?'':'var(--accent)';};
  // Trim: drag the two handles; the preview jumps to the handle you move.
  const range=$('#learn-range',B),inp=$('#learn-in',B),out=$('#learn-out',B),note=$('#learn-trim-note',B),frac=t=>(t/d.seconds).toFixed(4),sec=t=>fmtS(Math.round(t));
  const show=()=>{range.style.setProperty('--a',frac(d.start));range.style.setProperty('--b',frac(d.end));range.style.setProperty('--t',frac(vid.currentTime||0));
   time.textContent=`${sec(vid.currentTime||0)} / ${sec(d.seconds)}`;
   note.textContent=d.start<=.01&&d.end>=d.seconds-.01?`Whole clip · ${sec(d.seconds)}`:`${sec(d.start)} – ${sec(d.end)} · ${sec(d.end-d.start)} of ${sec(d.seconds)}`;};
  const trim=(a,b,seek)=>{d.start=Math.max(0,Math.min(a,d.seconds-.5));d.end=Math.min(d.seconds,Math.max(b,d.start+.5));inp.value=d.start;out.value=d.end;if(seek!=null)vid.currentTime=seek;show();retitle();};
  inp.oninput=()=>trim(Math.min(Number(inp.value),d.end-.5),d.end,Number(inp.value));
  out.oninput=()=>trim(d.start,Math.max(Number(out.value),d.start+.5),Number(out.value));
  vid.ontimeupdate=()=>{if(!vid.paused&&(vid.currentTime>=d.end||vid.currentTime<d.start-.05))vid.currentTime=d.start;show();};
  trim(d.start,d.end);
  // Crop: choose Free or a shape, place the frame (drag to move, corners to resize), then Apply.
  // Applied, the preview shows only the cropped part, at its new size; Change or Remove undo it.
  const box=$('.learn-crop-box',B),stage=$('.learn-stage',B),actions=$('#learn-crop-actions',B),W=v.media.width||16,H=v.media.height||9;
  let edit=null;// the frame being placed (not yet applied)
  const ratio=()=>LEARN_CROPS.find(c=>c[0]===d.aspect)?.[2]||0;// width / height in pixels, 0 for free
  const round=c=>({x:+c.x.toFixed(4),y:+c.y.toFixed(4),w:+c.w.toFixed(4),h:+c.h.toFixed(4)});
  const put=c=>{edit=round(c);box.style.cssText=cropStyle(edit);};
  const view=()=>{
   const c=edit?null:d.crop,ar=c?(c.w*W)/(c.h*H):W/H;
   stage.style.aspectRatio=String(ar);stage.style.width=`min(100%, calc(260px * ${ar}))`;
   vid.style.cssText=c?`position:absolute;width:${100/c.w}%;height:${100/c.h}%;left:${-c.x/c.w*100}%;top:${-c.y/c.h*100}%`:'';
   box.hidden=!edit;if(edit)box.style.cssText=cropStyle(edit);
   const label=LEARN_CROPS.find(x=>x[0]===d.aspect)?.[1]||'Free';
   actions.innerHTML=edit?`<button type="button" class="btn small ghost" data-crop-act="cancel">Cancel</button><button type="button" class="btn small primary" data-crop-act="apply">${I.check} Apply crop</button>`
    :d.crop?`<span class="learn-crop-note">${I.check} Cropped${d.aspect==='free'?'':' to '+esc(label)}</span><button type="button" class="btn small ghost" data-crop-act="change">Change</button><button type="button" class="btn small ghost" data-crop-act="remove">Remove</button>`:'';
   actions.hidden=!edit&&!d.crop;
   actions.querySelectorAll('[data-crop-act]').forEach(b=>b.onclick=()=>{const act=b.dataset.cropAct;
    if(act==='apply'){d.crop=edit;edit=null;}
    else if(act==='cancel'){edit=null;if(!d.crop){d.aspect='full';pressed('[data-crop]',$('[data-crop="full"]',B));}}
    else if(act==='change'){edit={...d.crop};}
    else{d.crop=null;edit=null;d.aspect='full';pressed('[data-crop]',$('[data-crop="full"]',B));}
    view();});
  };
  B.querySelectorAll('[data-crop]').forEach(b=>b.onclick=()=>{
   d.aspect=b.dataset.crop;pressed('[data-crop]',b);
   if(d.aspect==='full'){d.crop=null;edit=null;return view();}
   const a=ratio();edit=round(a?centredCrop(W/H,a):d.crop||{x:.1,y:.1,w:.8,h:.8});view();});
  box.onpointerdown=e=>{
   e.preventDefault();box.setPointerCapture(e.pointerId);
   const r=stage.getBoundingClientRect(),c0={...edit},x0=e.clientX,y0=e.clientY,h=e.target.dataset.h,a=ratio(),min=.1;
   box.onpointermove=ev=>{
    const dx=(ev.clientX-x0)/r.width,dy=(ev.clientY-y0)/r.height;
    if(!h){put({...c0,x:Math.max(0,Math.min(1-c0.w,c0.x+dx)),y:Math.max(0,Math.min(1-c0.h,c0.y+dy))});return;}
    // Resize from the dragged corner; the opposite corner stays where it is.
    const right=h.includes('e'),bottom=h.includes('s'),ax=right?c0.x:c0.x+c0.w,ay=bottom?c0.y:c0.y+c0.h;
    let w=Math.max(min,Math.min(right?1-ax:ax,c0.w+(right?dx:-dx))),hh=Math.max(min,Math.min(bottom?1-ay:ay,c0.h+(bottom?dy:-dy)));
    if(a){hh=w*W/(a*H);const maxH=bottom?1-ay:ay;if(hh>maxH){hh=maxH;w=hh*a*H/W;}if(hh<min){hh=min;w=hh*a*H/W;}}
    put({x:right?ax:ax-w,y:bottom?ay:ay-hh,w,h:hh});
   };
   box.onpointerup=box.onpointercancel=()=>{box.onpointermove=null;};
  };
  view();
  const sound=$('#learn-sound',B),speech=$('#learn-speech',B);
  if(sound&&d.audio)sound.onchange=()=>{d.sound=sound.checked;sound.checked?d.topics.add('audio'):d.topics.delete('audio');if(speech){speech.disabled=!d.sound;if(!d.sound)speech.checked=d.speech=false;}};
  if(speech)speech.onchange=()=>{d.speech=speech.checked;};
 },
 drawer(){
  const v=this.draft;if(!v)return;
  if(Panel.id==='prompt-editor')return LearnWork.render();// the expanded prompt shows it instead
  Panel.open({id:'learn-setup',title:'Learn from this video',focus:false,body:this.setupHtml(v),
   foot:`<button type="button" class="btn ghost danger-text" id="learn-remove">${I.trash} Remove video</button><span class="grow"></span><button type="button" class="btn primary" id="learn-teach">${I.send} Teach it</button>`});
  this.wireSetup(Panel.body(),v);
  $('#learn-remove').onclick=async()=>{if(await ask('Remove this video?','It leaves Learn without being taught.','Remove',true))this.remove(v.id);};
  $('#learn-teach').onclick=()=>this.teach();
 }
};
window.Learn=Learn;
/** Learn's expanded prompt (the Edit prompt drawer, as on Create): what to learn from the video in
 *  the prompt, and the videos being learned now with where each one is. */
/** Crop shapes (width / height); a centred frame of that shape is studied. */
const LEARN_CROPS=[['full','Off',0],['free','Free',0],['9:16','9:16',9/16],['1:1','1:1',1],['4:5','4:5',4/5],['16:9','16:9',16/9]];
const centredCrop=(src,a)=>{const r=v=>Math.round(v*10000)/10000;if(src>a){const w=a/src;return {x:r((1-w)/2),y:0,w:r(w),h:1};}const h=src/a;return {x:0,y:r((1-h)/2),w:1,h:r(h)};};
const cropStyle=c=>`left:${c.x*100}%;top:${c.y*100}%;width:${c.w*100}%;height:${c.h*100}%`;
const LearnWork={
 render(panel=$('#panel')){
  const box=panel?.querySelector('#drawer-start');if(!box||Dock.mode!=='learn')return;
  const v=Learn.draft,now=(Teach.S?.videos||[]).filter(x=>['measuring','waiting','failed'].includes(x.status));
  const key=JSON.stringify([v?.id,now.map(x=>[x.id,x.status,x.step,x.error])]);if(box.dataset.key===key)return;box.dataset.key=key;
  const state=x=>x.status==='measuring'?`<span class="spin"></span>${esc(x.step||'Measuring')}`:x.status==='waiting'?'Waiting for your agent':`<span class="bad">${esc(x.error||'Failed')}</span>`;
  const list=now.length?`<section class="learn-now"><h3>Learning now</h3><ul>${now.map(x=>`<li><a href="#/learn/${encodeURIComponent(x.id)}" dir="auto">${esc(x.title)}</a><span>${state(x)}</span></li>`).join('')}</ul></section>`:'';
  // Nothing in the prompt and nothing learning: the question alone, as on Create.
  box.innerHTML=v||now.length?`<div class="drawer-work learn-work">${v?Learn.setupHtml(v):''}${list}</div>`:'<h3>What should the studio learn?</h3>';
  if(v)Learn.wireSetup(box,v);
 }
};
window.LearnWork=LearnWork;

// ---------- Learn's prompt ----------
// The selected video shows in the prompt as the same chip as Create's files: click it for what to
// learn, ✕ to unselect it (it stays in your uploaded videos, in the + popup).
const learnChip=v=>`<span class="dock-attachment" role="button" tabindex="0" aria-label="What to learn from ${esc(v.title)}" onclick="if(!event.target.closest('.iconbtn'))Learn.drawer()">${I.film}<video class="upload-preview" muted preload="metadata" playsinline draggable="false" src="${esc(withKey('/media/'+v.id+'/preview.mp4'))}#t=0.5"></video><button type="button" class="iconbtn sm" aria-label="Remove ${esc(v.title)} from prompt" onclick="Learn.select(null)">${I.x}</button></span>`;
Dock.kinds.learn={
 html(){
  return `${dockSwitch('learn')}<div class="dock learn-dock" id="dock" aria-label="Learn from a video">
   <div class="dock-content">
    <div class="dock-files" id="dock-files" hidden></div>
    <div class="dock-text"><textarea id="dock-text" rows="1" dir="auto" maxlength="2000" aria-label="Learn from a video"></textarea></div>
    <div class="dock-prompt-actions"><button type="button" class="iconbtn sm" id="dock-clear" aria-label="Clear" hidden>${I.x}</button><button type="button" class="iconbtn sm" id="dock-expand" aria-label="Expand prompt" aria-expanded="false" aria-controls="panel">${I.expand}</button></div>
   </div>
   <div class="dock-busy" id="dock-busy" hidden><span class="spin"></span><span></span></div>
   <div class="dock-tools">
    <button type="button" class="iconbtn" id="dock-add" aria-label="Add a video to learn from">${I.add}</button>
    <button type="button" class="kind-pill" id="learn-mode" aria-haspopup="menu" aria-expanded="false"></button>
    <span class="grow"></span>
    <button type="button" class="iconbtn" id="dock-instructions" aria-label="Instructions for learning" aria-expanded="${Panel.id==='rules'}" aria-controls="panel">${I.rules}</button>
    <button type="button" class="iconbtn" id="learn-setup" aria-label="What to learn" aria-controls="panel">${I.sliders}</button>
    <button type="button" class="iconbtn primary" id="dock-send"></button>
   </div>
   <input type="file" id="learn-file" accept="video/*,.mkv,.mov,.avi,.webm,.m4v" hidden></div>`;
 },
 wire(el){
  const t=$('#dock-text',el),clear=$('#dock-clear',el),file=$('#learn-file',el);
  t.value=Learn.text;this.refresh(el);autoGrow(t);
  t.oninput=()=>{Learn.text=t.value;clear.hidden=!t.value;autoGrow(t);};
  clear.onclick=()=>{t.value='';t.oninput();t.focus();};
  // Pasting a link brings the video in at once.
  // The box takes only what to learn; the video comes in through + (Send with no video opens it).
  const send=()=>Learn.draft?Learn.teach():LearnPicker.open();
  t.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}};
  $('#dock-send',el).onclick=send;
  $('#dock-add',el).onclick=()=>LearnPicker.open();
  $('#dock-instructions',el).onclick=()=>rulesPanel('learn');
  readInstructions('learn').then(c=>setInstructionIndicator(el,activeInstructions(c||[]).length>0)).catch(()=>{});
  file.onchange=()=>{const f=file.files[0];file.value='';if(f)Learn.upload(f);};
  $('#dock-expand',el).onclick=()=>Dock.expand();
  $('#learn-setup',el).onclick=()=>Panel.id==='learn-setup'?Panel.close():Learn.drawer();
  $('#learn-mode',el).onclick=e=>{
   const v=Learn.draft,cur=v?Learn.setup(v).mode:teachMode(store.get('teach-mode','motion')).id;
   Pop.open(e.currentTarget,`<div class="pop-head">What should it learn?</div>${TEACH_MODES.map(x=>`<button class="pop-item" role="menuitemradio" aria-checked="${cur===x.id}" data-close onclick="setLearnMode('${x.id}')">${I[x.icon]}<span>${esc(x.name)}<small>${esc(x.description)}</small></span></button>`).join('')}`,{up:true,label:'What to learn'});
  };
  const dock=$('#dock',el);
  for(const ev of ['dragenter','dragover'])dock.addEventListener(ev,e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dock.classList.add('drop-over');}});
  dock.addEventListener('dragleave',()=>dock.classList.remove('drop-over'));
  dock.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();dock.classList.remove('drop-over');learnFiles([...e.dataTransfer.files]);});
 },
 refresh(el){
  const draft=Learn.draft,files=$('#dock-files',el),t=$('#dock-text',el);
  const key=draft?draft.id:'';if(files.dataset.key!==key){files.dataset.key=key;files.innerHTML=draft?learnChip(draft):'';}files.hidden=!draft;
  t.placeholder=draft?`What should it learn from ${draft.title.slice(0,40)}? (optional)`:'Say what to learn. Add the video with +';
  if(document.activeElement!==t&&t.value!==Learn.text){t.value=Learn.text;autoGrow(t);}
  $('#dock-clear',el).hidden=!Learn.text;
  const m=teachMode(draft?Learn.setup(draft).mode:store.get('teach-mode','motion'));
  $('#learn-mode',el).innerHTML=`${I[m.icon]}<span>${esc(m.name)}</span>${I.chevron}`;
  $('#learn-setup',el).hidden=!draft;
  const send=$('#dock-send',el);send.innerHTML=I.send;send.setAttribute('aria-label',draft?'Teach this video':'Add a video');send.disabled=!!Learn.busy;
  const b=$('#dock-busy',el);b.hidden=!Learn.busy;b.lastElementChild.textContent=Learn.busy?.text||'';
  if(!draft&&Panel.id==='learn-setup')Panel.close();
  if(Panel.id==='prompt-editor')LearnWork.render();
  if(Learn.openDrawer&&draft){Learn.openDrawer=false;setTimeout(()=>Learn.drawer());}
 }
};
window.setLearnMode=id=>{
 const m=teachMode(id);store.set('teach-mode',m.id);
 const v=Learn.draft;if(v){const d=Learn.setup(v);d.mode=m.id;d.topics=new Set(m.topics.filter(t=>t!=='audio'||d.audio));d.sound=d.audio&&m.topics.includes('audio');if(Panel.id==='learn-setup')Learn.drawer();}
 Learn.refreshDock();
};
/** Video files dropped or chosen: the first one comes in to be taught. */
function learnFiles(files){
 const video=files.find(f=>/^video\//.test(f.type)||/\.(mkv|mov|mp4|webm|avi|m4v)$/i.test(f.name));
 if(!video)return toast('Add a video file to learn from.');
 Learn.upload(video);
}
window.learnFiles=learnFiles;

// ---------- picking videos on Learn, and what to do with them ----------
// A click picks a card (like Create's), a drag box picks several, a double click opens one.
// While any are picked, the search row becomes a bar: use them in Create, learn one again, give
// them better names, or remove them (keeping their lessons in the Brain, or not).
Object.assign(Learn,{
 picked:new Set(),
 pickedVideos(){const all=Teach.S?.videos||[];for(const id of this.picked)if(!all.some(v=>v.id===id))this.picked.delete(id);return all.filter(v=>this.picked.has(v.id));},
 pick(ids,on,values){ids.forEach((id,i)=>{const want=values?values[i]:on??!this.picked.has(id);want?this.picked.add(id):this.picked.delete(id);});this.paint();},
 clear(){if(!this.picked.size)return;this.picked.clear();this.paint();},
 /** Shows the picks in place (each card's mark, and the search row or the bar), so they animate. */
 paint(){
  const el=$('#view');if(App.route!=='teach/library'||App.arg||!el)return;
  el.querySelectorAll('.taught-card').forEach(card=>{const b=$('.upload-select',card),on=this.picked.has(card.dataset.taught);
   if(b.getAttribute('aria-pressed')===String(on))return;b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',`${on?'Unselect':'Select'} ${card.dataset.name}`);b.firstElementChild.innerHTML=on?I.check:I.add;});
  const row=$('.create-find',el),bar=LearnFind.bar(),had=!!row?.classList.contains('learn-selbar'),has=bar.includes('learn-selbar');
  if(row&&(had!==has||has)){const t=document.createElement('div');t.innerHTML=bar.trim();row.replaceWith(t.firstElementChild);if(has)this.wireBar(el);else LearnFind.wire(el);}
 },
 wireCards(el){
  el.querySelectorAll('.taught-card').forEach(card=>{
   const id=card.dataset.taught,select=$('.upload-select',card);
   select.onclick=()=>this.pick([id]);
   select.ondblclick=e=>{e.preventDefault();location.hash='#/learn/'+encodeURIComponent(id);};
   select.onkeydown=e=>{if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();location.hash='#/learn/'+encodeURIComponent(id);}};
  });
  wireMarquee(el);
  if($('.learn-selbar',el))this.wireBar(el);
 },
 wireBar(el){
  const bar=$('.learn-selbar',el);if(!bar)return;
  LearnFind.apply(el);
  const ids=()=>this.pickedVideos().map(v=>v.id);
  $('[data-sel=clear]',bar).onclick=()=>this.clear();
  $('[data-sel=create]',bar)?.addEventListener('click',()=>this.useInCreate(ids()));
  $('[data-sel=again]',bar)?.addEventListener('click',()=>this.again(ids()[0]));
  $('[data-sel=names]',bar)?.addEventListener('click',()=>this.betterNames(ids()));
  $('[data-sel=remove]',bar).onclick=e=>this.removeMenu(e.currentTarget,ids());
 },
 bar(){
  const vs=this.pickedVideos(),learned=vs.filter(v=>v.status==='learned'),one=vs.length===1?vs[0]:null;
  const act=(id,icon,label,ok,why)=>`<button type="button" class="learn-sel-act" data-sel="${id}" ${ok?'':`disabled title="${esc(why)}"`}>${I[icon]}<span>${label}</span></button>`;
  return `<div class="create-find no-head learn-selbar" role="toolbar" aria-label="Picked videos">
   <button type="button" class="learn-sel-clear" data-sel="clear" aria-label="Unpick all">${I.x}</button><span class="learn-sel-count">${vs.length} picked</span>
   <span class="grow"></span>
   ${act('create','spark','Use in Create',learned.length&&learned.length<=2&&learned.length===vs.length,'Pick one or two learned videos')}
   ${act('again','refresh','Learn again',one&&(one.canAgain||one.link),'Pick one video that still has its source')}
   ${act('names','text','Better names',learned.length>0,'Pick learned videos')}
   <button type="button" class="learn-sel-act danger" data-sel="remove" aria-haspopup="menu">${I.trash}<span>Remove</span></button>
  </div>`;
 },
 /** One or two learned videos become the style of the next video on Create (two are blended). */
 useInCreate(ids){
  const vs=(Teach.S?.videos||[]).filter(v=>ids.includes(v.id)&&v.status==='learned');
  if(!vs.length||vs.length>2)return toast('Pick one or two learned videos.');
  const N=Studio.N;
  if(vs.length===1){N.like=vs[0].id;N.useMix=false;}else{N.like='';N.useMix=true;N.mixA=vs[0].id;N.mixB=vs[1].id;N.mixWeight=N.mixWeight??50;}
  if(N.mode!=='motion')N.mode='motion';
  Studio.save();this.picked.clear();
  toast(vs.length===1?'Your next video takes its style from it':'Your next video blends their two styles');
  location.hash='#/create';
 },
 /** Learn again: the kept video (or its link) comes back into the prompt, to teach with new choices. */
 /** Refine: say what it should learn better. With the video kept it comes back into the prompt with
  *  its settings; without it, your agent rewrites its rules from its measurements and lessons. */
 refine(anchor,id){
  const v=(Teach.S?.videos||[]).find(x=>x.id===id);if(!v)return;
  const kept=v.canAgain||v.link;
  const el=Pop.open(anchor,`<form class="refine-pop"><label class="field-label" for="refine-why">What should it learn better?</label>
   <textarea id="refine-why" dir="auto" maxlength="2000" rows="4" placeholder="For example: focus on how the text enters, and drop the rule about colour.">${esc(v.prompt||'')}</textarea>
   <p class="muted small">${kept?'The video comes back into Learn with what it was taught with, to adjust and send.':'Its video is not kept: your agent rewrites its rules from its measurements and what it already learned.'}</p>
   <div class="refine-actions"><button type="button" class="btn small ghost" data-cancel>Cancel</button><button type="submit" class="btn small primary">${I.send} Refine</button></div></form>`,{role:'dialog',label:'Refine',align:'end',focus:false});
  if(!el)return;
  const t=$('#refine-why',el);t.focus();t.setSelectionRange(t.value.length,t.value.length);
  el.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();Pop.close(true);}};
  $('[data-cancel]',el).onclick=()=>Pop.close(true);
  $('form',el).onsubmit=async e=>{e.preventDefault();const why=t.value.trim();if(why.length<3)return toast('Say what to refine.');Pop.close();
   if(kept){this.text=why;await this.again(id,{refine:true});this.text=why;this.refreshDock();return;}
   try{await api('/api/videos/'+id+'/refine',{method:'POST',body:JSON.stringify({prompt:why})});toast('Sent. Tell your agent: study the videos I taught.');}catch(err){toast(err.message,true);}
   App.refresh(true);};
 },
 /** Learn again brings the kept video back to teach afresh; Refine brings it back with what it
  *  was taught with (mode, good or bad, focus, direction), to adjust and send again. */
 async again(id,{refine=false}={}){
  const v=(Teach.S?.videos||[]).find(x=>x.id===id);if(!v)return;
  if(!v.canAgain&&!v.link)return toast('Nothing of this video is kept to learn from again. Add it again with + on Learn.');
  this.refineFrom=refine?v:null;
  this.picked.clear();if(App.route!=='teach/library'||App.arg)location.hash='#/learn';
  if(v.link&&!v.canAgain)return this.link(v.link);
  try{this.setBusy('Bringing it back');const d=await api('/api/videos/'+id+'/again',{method:'POST'});await this.arrived(d.id);}
  catch(e){toast(e.message,true);}finally{this.setBusy(null);}
 },
 /** Better names: the page's model writes them when one is set (Settings); otherwise the job is
  *  copied for your terminal agent, which renames them with `teach rename`. */
 async betterNames(ids){
  const vs=(Teach.S?.videos||[]).filter(v=>ids.includes(v.id)&&v.status==='learned');if(!vs.length)return;
  try{
   this.setBusy('Finding better names');
   const r=await api('/api/videos/names',{method:'POST',body:JSON.stringify({ids:vs.map(v=>v.id)})});
   this.picked.clear();
   if(r.by==='agent'){
    await copyText(`Give ${vs.length>1?'these taught videos':'this taught video'} a better name: 2 to 6 plain words that say what it teaches or how it looks (read each with: pnpm tempoloom teach show ID). Rename each with: pnpm tempoloom teach rename ID "New name"\n${vs.map(v=>`- ${v.id}: ${v.title}`).join('\n')}`);
    toast('Copied for your agent. Paste it in your terminal agent to rename them.');
   }else toast(`Renamed ${r.renamed.length} video${r.renamed.length===1?'':'s'}`);
  }catch(e){toast(e.message,true);}finally{this.setBusy(null);await App.refresh(true);}
 },
 /** Remove: keep the lessons in the Brain (the video leaves Learn), or forget them with it. */
 removeMenu(anchor,ids){
  const vs=(Teach.S?.videos||[]).filter(v=>ids.includes(v.id));if(!vs.length)return;
  const n=vs.length,them=n>1?`these ${n} videos`:'this video';
  const menu=Pop.open(anchor,`<div class="pop-head">Remove ${them}</div>
   <button type="button" class="pop-item" role="menuitem" data-keep>${I.brain}<span>Keep its rules<small>They stay in the Brain and keep shaping new videos</small></span></button>
   <button type="button" class="pop-item danger" role="menuitem" data-forget>${I.trash}<span>Forget its rules too<small>Rules from no other source go with it</small></span></button>`,{align:'end',label:'Remove'});
  const run=async keep=>{
   Pop.close();
   if(!keep&&!await ask(`Forget ${them}?`,'The videos leave Learn, with any rules only they taught that were never applied. Undo is in History.','Forget',true))return;
   let done=0;for(const v of vs){try{await api('/api/videos/'+v.id+(keep&&v.status==='learned'?'?keep=lessons':''),{method:'DELETE'});done++;this.picked.delete(v.id);}catch(e){toast(e.message,true);}}
   if(App.arg&&vs.some(v=>v.id===App.arg))location.hash='#/learn';
   if(done)toast(keep?`Removed ${done}. Its rules stay in the Brain.`:`Forgot ${done}`);
   await App.refresh(true);
  };
  menu?.querySelector('[data-keep]')?.addEventListener('click',()=>run(true));
  menu?.querySelector('[data-forget]')?.addEventListener('click',()=>run(false));
 }
});
LearnFind.selectionBar=()=>Learn.picked.size&&Learn.pickedVideos().length?Learn.bar():null;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&App.route==='teach/library'&&!App.arg&&Learn.picked.size&&!Pop.el&&!$('#modal').innerHTML&&!/^(INPUT|TEXTAREA)$/.test(e.target.tagName))Learn.clear();});

// ---------- Learn's + popup: the same popup as Create's, with what Learn takes ----------
// A video file, a link, or a video the studio made. Each comes into the prompt to be taught.
const LearnPicker={
 tab:'upload',
 TABS:[['upload','film','Video file'],['link','globe','Link'],['made','spark','Made by the studio']],
 isOpen(){return !!$('#learn-pick');},
 redraw(){if(this.isOpen())this.draw(true);},
 open(tab){
  this.tab=tab||this.tab;
  Overlay.open(`<div class="picker" id="learn-pick"><header class="picker-head"><h2 tabindex="-1" autofocus>Add a video to learn from</h2><button type="button" class="iconbtn sm" aria-label="Close" onclick="Overlay.close()">${I.x}</button></header>
   <nav class="picker-side" id="pick-side" aria-label="Where the video comes from"></nav><div class="picker-main" id="pick-main"></div>
   <footer class="picker-foot" id="pick-foot"></footer></div>`);
  Picker.place();
  this.draw();
 },
 /** On top: what is coming in, then every uploaded video (selected into the prompt or not). */
 current(){
  const busy=Learn.busy,all=Learn.drafts,cur=Learn.cur;
  const status=busy?`<p class="learn-pick-status" role="status"><span class="spin"></span> ${esc(busy.text)}</p>`:'';
  if(!all.length)return status;
  return status+`<section class="learn-pick-current" aria-label="Your uploaded videos"><h3 class="field-label">Your uploaded videos</h3><div class="pick-grid">${all.map(v=>`<div class="pick learn-pick-item">
    <button type="button" class="learn-pick-select" data-pick-select="${esc(v.id)}" aria-pressed="${v.id===cur}" aria-label="${v.id===cur?'Selected':'Select'}: ${esc(v.title)}"><span class="thumb">${I.film}<video class="upload-preview" muted preload="metadata" playsinline draggable="false" src="${esc(withKey('/media/'+v.id+'/preview.mp4'))}#t=0.5"></video>${v.id===cur?`<span class="learn-pick-check">${I.check}</span>`:''}</span><span dir="auto">${esc(v.title)}</span></button>
    <button type="button" class="iconbtn sm pick-remove" data-pick-remove="${esc(v.id)}" aria-label="Delete ${esc(v.title)}">${I.trash}</button></div>`).join('')}</div><p class="muted small">Click one to put it in the prompt. Only the selected one is taught.</p></section>`;
 },
 async draw(keepTab){
  const side=$('#pick-side'),main=$('#pick-main'),foot=$('#pick-foot');if(!side)return;
  const v=Learn.draft,locked=!!Learn.busy;
  side.innerHTML=this.TABS.map(([id,icon,label])=>`<button type="button" class="navlink" data-pick-tab="${id}" ${this.tab===id?'aria-current="page"':''}>${I[icon]}<span class="lbl">${label}</span></button>`).join('');
  side.querySelectorAll('[data-pick-tab]').forEach(b=>b.onclick=()=>{this.tab=b.dataset.pickTab;this.draw();$(`[data-pick-tab="${this.tab}"]`,side)?.focus();});
  const top=this.current(),next=v?`<button type="button" class="btn primary" id="pick-setup">${I.sliders} What to learn</button>`:'';
  if(this.tab==='upload'){
   main.innerHTML=top+(locked?'':`<div class="picker-empty"><h3>Add a video file</h3><p class="muted small">MP4, MOV, WebM or MKV, up to ${Teach.S?.can?.maxMB??2048} MB. You can also drop it on the page.</p></div>`);
   foot.innerHTML=`<button type="button" class="btn picker-upload" id="pick-upload" ${locked?'disabled':''}>${I.upload} Upload video</button><input type="file" id="pick-file" hidden accept="video/*,.mkv,.mov,.avi,.webm,.m4v">${next}`;
   $('#pick-upload').onclick=()=>$('#pick-file').click();
   $('#pick-file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)Learn.upload(f);};
  }else if(this.tab==='link'){
   const was=$('#pick-link')?.value||'';
   main.innerHTML=top+(locked?'':`<form class="learn-pick-link" id="pick-link-form"><label class="field-label" for="pick-link">Link to a video</label><input type="url" id="pick-link" placeholder="https://" autocomplete="off" required value="${esc(was)}"><p class="muted small">YouTube, TikTok, Instagram, X, Vimeo and more. It is downloaded for study only.</p></form>`);
   foot.innerHTML=(locked?'':`<button type="submit" form="pick-link-form" class="btn primary" id="pick-go">${I.down} Bring it in</button>`)+next;
   const form=$('#pick-link-form');
   if(form){if(!keepTab)$('#pick-link').focus();form.onsubmit=e=>{e.preventDefault();const url=$('#pick-link').value.trim();if(!/^https?:\/\/\S+$/i.test(url))return toast('Paste a link that starts with https://');Learn.link(url);};}
  }else{
   foot.innerHTML=next;
   if(locked){main.innerHTML=top;}
   else{
    main.innerHTML='<p class="learn-pick-status" role="status"><span class="spin"></span> Opening what the studio made</p>';
    let items=[];try{items=(await api('/api/gallery')).items;}catch{if(this.tab==='made'&&$('#pick-main'))main.textContent='Could not open the videos the studio made.';return;}
    if(this.tab!=='made'||!$('#pick-main')||Learn.draft||Learn.busy)return;
    main.innerHTML=items.length?`<div class="pick-grid">${items.map(x=>`<button type="button" class="pick" data-made="${esc(x.id)}"><span class="thumb">${I.film}<img class="upload-preview" loading="lazy" alt="" draggable="false" src="${esc(withKey('/gallery/thumb/'+x.id))}"></span><span dir="auto">${esc(x.title)}</span></button>`).join('')}</div>`
     :'<div class="picker-empty"><h3>The studio has not made a video yet</h3></div>';
    main.querySelectorAll('[data-made]').forEach(b=>b.onclick=async()=>{
     try{Learn.setBusy('Bringing it in');const d=await api(`/api/gallery/${b.dataset.made}/teach`,{method:'POST',body:'{}'});await Learn.arrived(d.id);}
     catch(e){toast(e.message,true);}finally{Learn.setBusy(null);}
    });
   }
  }
  main.querySelectorAll('[data-pick-select]').forEach(b=>b.onclick=()=>Learn.select(b.dataset.pickSelect===Learn.cur?null:b.dataset.pickSelect));
  main.querySelectorAll('[data-pick-remove]').forEach(b=>b.onclick=async()=>{if(await ask('Delete this uploaded video?','It is removed from your computer without being taught.','Delete',true))Learn.remove(b.dataset.pickRemove).then(()=>this.redraw());});
  $('#pick-setup')?.addEventListener('click',()=>{Overlay.close();Learn.drawer();});
 }
};
window.LearnPicker=LearnPicker;
