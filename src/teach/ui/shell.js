'use strict';
// The shell's shared parts: icons, the right panel, menus, the picker and command overlays, the
// bell (in the sidebar footer) and the keyboard. Screens use these instead of drawing their own.
Object.assign(I,{
 spark:ICON('<path d="M12 3l1.900 5.100L19 10l-5.100 1.900L12 17l-1.900-5.100L5 10l5.100-1.900z"/><path d="M19 15l.800 2.200L22 18l-2.200.800L19 21l-.800-2.200L16 18l2.200-.800z"/>'),
 palette:ICON('<path d="M12 3a9 9 0 1 0 0 18c1 0 1.700-.800 1.700-1.700 0-.500-.200-.900-.500-1.200-.300-.300-.500-.700-.500-1.200 0-.900.800-1.700 1.700-1.700H16a5 5 0 0 0 5-5c0-4-4-7.200-9-7.200z"/><circle cx="7.500" cy="11.500" r="1"/><circle cx="10.500" cy="7.500" r="1"/><circle cx="15.500" cy="7.500" r="1"/>'),
 scenes:ICON('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 5l-2 4M13 5l-2 4M18 5l-2 4"/>'),
 folder:ICON('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
 tools:ICON('<circle cx="5" cy="5" r="1.300"/><circle cx="12" cy="5" r="1.300"/><circle cx="5" cy="12" r="1.300"/><circle cx="12" cy="12" r="1.300"/><circle cx="5" cy="19" r="1.300"/><circle cx="12" cy="19" r="1.300"/><circle cx="19" cy="19" r="1.300"/><circle cx="19" cy="12" r="1.300"/><path d="M19 2.500l.700 1.800 1.800.700-1.800.700L19 7.500l-.700-1.800L16.500 5l1.800-.700z"/>'),
 brain:ICON('<path d="M9.500 4A2.500 2.500 0 0 0 7 6.500v.200A3 3 0 0 0 4.500 12 3 3 0 0 0 7 17.300V18a2.500 2.500 0 0 0 5 0V5.500A1.500 1.500 0 0 0 10.500 4z"/><path d="M14.500 4A2.500 2.500 0 0 1 17 6.500v.200A3 3 0 0 1 19.500 12 3 3 0 0 1 17 17.300V18a2.500 2.500 0 0 1-5 0"/>'),
 trash:ICON('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
 collapse:ICON('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 10l-2 2 2 2"/>'),
 bell:ICON('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.500 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
 help:ICON('<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.300-1 .800-1 1.500V14M12 17h.01"/>'),
 more:ICON('<circle cx="12" cy="5" r="1.200"/><circle cx="12" cy="12" r="1.200"/><circle cx="12" cy="19" r="1.200"/>'),
 filter:ICON('<path d="M4 6h16M7 12h10M10 18h4"/>'),
 send:ICON('<path d="M5 12h14M13 6l6 6-6 6"/>'),
 sliders:ICON('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
 rules:ICON('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
 expand:ICON('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
 back:ICON('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
 chevron:ICON('<path d="m7 10 5 5 5-5"/>'),
 upload:ICON('<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>'),
 image:ICON('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>'),
 music:ICON('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
 sound:ICON('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.500 8.500a5 5 0 0 1 0 7M18.500 5.500a9 9 0 0 1 0 13"/>'),
 clip:ICON('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'),
 logo:ICON('<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9z"/><path d="M12 12l8-4.500M12 12v9M12 12 4 7.500"/>'),
 lock:ICON('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
 wave:ICON('<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>'),
 users:ICON('<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20a6.500 6.500 0 0 1 13 0M16 4.500a3.500 3.500 0 0 1 0 7M18 14a6.500 6.500 0 0 1 3.500 6"/>'),
 captions:ICON('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/>'),
 channel:ICON('<rect x="2" y="6" width="20" height="13" rx="3"/><path d="M10 10l5 2.500-5 2.500z"/><path d="M8 2l4 4 4-4"/>'),
 mix:ICON('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>'),
 globe:ICON('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
 brush:ICON('<path d="M14 4l6 6-8.500 8.500a2 2 0 0 1-2.800 0l-3.200-3.200a2 2 0 0 1 0-2.800z"/><path d="M5.500 15.500 3 21l5.500-2.500"/>'),
 check:ICON('<path d="m5 12 5 5 9-10"/>'),
 export:ICON('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
 restore:ICON('<path d="M3 12a9 9 0 1 0 3-6.700"/><path d="M3 4v4h4"/>'),
 keyboard:ICON('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
 user:ICON('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
 monitor:ICON('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
});
I.gear=I.gear||ICON('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.200 4.200l2.100 2.100M17.700 17.700l2.100 2.100M2 12h3M19 12h3M4.200 19.800l2.100-2.100M17.700 6.300l2.100-2.100"/>');

// ---------- the right panel: one at a time ----------
const Panel={
 id:null,onclose:null,stack:[],
 /** Opens a panel: {id, title, sub, body (html), foot (html), back (a function that reopens the previous one), onclose}. */
 open(o){
  const el=$('#panel'),wasOpen=!!this.id;
  this.exit?.cancel();
  this.exit=null;
  el.inert=false;
  if(!wasOpen)this.opener=document.activeElement;
  if(this.id&&this.id!==o.id&&this.onclose)this.onclose();
  Dock.restore();
  this.id=o.id;this.onclose=o.onclose||null;
  el.innerHTML=`<header class="panel-head">${o.back?`<button class="iconbtn sm" aria-label="Back" onclick="Panel.back()">${I.back}</button>`:''}<h2 id="panel-title" dir="auto">${esc(o.title)}</h2>${o.headActions||''}<button class="iconbtn sm" aria-label="Close the panel" onclick="Panel.close()">${I.x}</button></header>
   ${o.sub?`<p class="panel-sub">${esc(o.sub)}</p>`:''}${o.tabs||''}<div class="panel-body" id="panel-body">${o.body||''}</div>${o.dock?`<div class="panel-dock">${o.dock}</div>`:''}${o.foot?`<footer class="panel-foot">${o.foot}</footer>`:''}`;
  this.backFn=o.back||null;
  // Edit prompt, Instructions and Settings are one kind of drawer: on a wide screen it sits beside
  // the page (no shade over it); on a narrower one it slides over the page.
  const docked=['prompt-editor','rules','brief-settings','learn-setup','add-rule','taste-profile'].includes(o.id)||o.id.startsWith('tool-');
  el.toggleAttribute('data-docked',docked);
  // Instructions and Settings leave the page's prompt box in place: it makes room as the drawer comes in.
  $('#app').toggleAttribute('data-drawer-open',docked);
  if(!$('.drawer-shade')){
   const shade=document.createElement('div');
   shade.className='drawer-shade';
   shade.onclick=()=>Panel.close();
   el.before(shade);
  }
  $('.drawer-shade').classList.toggle('docked-shade',docked);

  if(o.dockNode){
   $('.prompt-drawer-host',el).append(o.dockNode);
   const ex=$('#dock-expand',o.dockNode);// in the drawer the same button shrinks the prompt back
   if(ex){ex.setAttribute('aria-expanded','true');ex.setAttribute('aria-label','Shrink prompt');ex.innerHTML=I.shrink||I.expand;}
  }
  el.hidden=false;
  if(!wasOpen)this.motion(el,false);
  if(o.focus!==false)requestAnimationFrame(()=>(el.querySelector('[autofocus],textarea,input,button.primary')||el.querySelector('.panel-head button'))?.focus?.({preventScroll:true}));
  document.dispatchEvent(new CustomEvent('panel',{detail:this.id}));
  return el;
 },
 back(){const f=this.backFn;if(f)f();},
 motion(el,closing){
  el.getAnimations().forEach(animation=>animation.cancel());
  const shade=$('.drawer-shade');
  shade?.getAnimations().forEach(animation=>animation.cancel());
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
  // Soft: a longer, gentle glide with a slight settle in, and an unhurried ease out.
  const offset=getComputedStyle(el).direction==='rtl'?-56:56;
  const frames=[{opacity:0,transform:`translateX(${offset}px) scale(.985)`},{opacity:1,transform:'none'}];
  const backdrop=[{opacity:0},{opacity:1}];
  const timing=closing?{duration:300,easing:'cubic-bezier(.4,0,.7,.2)',fill:'both'}:{duration:460,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'};
  shade?.animate(closing?backdrop.reverse():backdrop,timing);
  return el.animate(closing?frames.reverse():frames,timing);
 },
 close(silent){
  const el=$('#panel');
  if(el.hidden||(!this.id&&!silent))return;
  const f=this.onclose,was=this.id,opener=this.opener;
  this.onclose=null;this.id=null;this.opener=null;
  el.inert=true;
  $('#app').removeAttribute('data-drawer-open');// the prompt box glides back as the drawer leaves
  const finish=()=>{
   Dock.restore(!silent&&was==='prompt-editor');
   el.hidden=true;el.innerHTML='';
   $('.drawer-shade')?.remove();
   el.getAnimations().forEach(animation=>animation.cancel());
   this.exit=null;
   if(!silent&&was==='prompt-editor'&&opener?.isConnected)opener.focus({preventScroll:true});
  };
  if(silent)finish();
  else{
   const exit=this.exit=this.motion(el,true);
   // A background tab does not run animations: finish anyway a moment after the exit should end.
   if(exit)Promise.race([exit.finished,new Promise(r=>setTimeout(r,450))]).then(()=>{if(this.exit===exit)finish();},()=>{});
   else finish();
   if(was!=='prompt-editor'&&opener?.isConnected)opener.focus({preventScroll:true});
   f?.();
  }
  document.dispatchEvent(new CustomEvent('panel',{detail:null,was}));
 },
 body(){return $('#panel-body');},
};

// ---------- small menus under a button ----------
const Pop={
 el:null,anchor:null,
 open(anchor,html,o={}){
  if(this.anchor===anchor){this.close(true);return null;}
  this.close();
  const el=document.createElement('div');el.className='pop';el.setAttribute('role',o.role||'menu');if(o.label)el.setAttribute('aria-label',o.label);
  el.innerHTML=html;$('#pop-slot').append(el);this.el=el;this.anchor=anchor;anchor.setAttribute('aria-expanded','true');
  const r=anchor.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight,below=innerHeight-r.bottom-8,up=o.up||below<h&&r.top>below;
  const left=o.align==='end'?r.right-w:r.left;
  el.style.left=Math.max(8,Math.min(left,innerWidth-w-8))+'px';
  el.style.top=(up?Math.max(8,r.top-h-6):Math.min(innerHeight-h-8,r.bottom+6))+'px';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{opacity:0,transform:`translateY(${up?4:-4}px)`},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.2,0,0,1)'});
  const items=()=>[...el.querySelectorAll('.pop-item:not(:disabled)')];
  el.onkeydown=e=>{const list=items(),i=list.indexOf(document.activeElement);
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();list[(i+(e.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();}
   else if(e.key==='Home'||e.key==='End'){e.preventDefault();(e.key==='Home'?list[0]:list.at(-1))?.focus();}
   else if(e.key==='Tab')this.close();};
  el.addEventListener('click',e=>{if(e.target.closest('.pop-item[data-close],a.pop-item'))this.close();});
  if(o.focus!==false)(el.querySelector('[aria-checked=true]')||items()[0])?.focus();
  this.onclose=o.onclose||null;
  return el;
 },
 close(focus){
  if(!this.el)return;const a=this.anchor;this.el.remove();this.el=null;this.anchor=null;a?.setAttribute('aria-expanded','false');
  const f=this.onclose;this.onclose=null;if(f)f();if(focus&&a?.isConnected)a.focus();
 },
};
document.addEventListener('pointerdown',e=>{if(Pop.el&&!Pop.el.contains(e.target)&&!Pop.anchor?.contains(e.target))Pop.close();});
/** Renames in a small popup by the button that asked: a box that grows with the name, save and
 *  cancel. Enter saves, Escape or a click elsewhere cancels. `save` may throw to keep it open. */
function renamePop(anchor,{value,label='Name',max=120,select,save}){
 const el=Pop.open(anchor,`<form class="rename-pop">
  <input type="text" dir="auto" aria-label="${esc(label)}" value="${esc(value)}" maxlength="${max}" required spellcheck="false">
  <button type="submit" class="iconbtn sm rename-save" aria-label="Save name">${I.check}</button>
  <button type="button" class="iconbtn sm" data-cancel aria-label="Cancel rename">${I.x}</button></form>`,{role:'dialog',label:'Rename',align:'end',focus:false});
 if(!el)return;
 const form=$('form',el),input=$('input',form),ok=$('[type=submit]',form),r=anchor.getBoundingClientRect();
 // The box grows with the name; the popup stays lined up with the button's end as it does.
 const ctx=document.createElement('canvas').getContext('2d');ctx.font=getComputedStyle(input).font;
 const fit=()=>{input.style.width=Math.max(140,Math.min(440,innerWidth-120,Math.ceil(ctx.measureText(input.value).width)+30))+'px';const w=el.offsetWidth;el.style.left=Math.max(8,Math.min(r.right-w,innerWidth-w-8))+'px';};
 fit();input.focus();input.setSelectionRange(0,select??input.value.length);
 input.oninput=()=>{fit();ok.disabled=!input.value.trim();};
 el.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();Pop.close(true);}};
 $('[data-cancel]',form).onclick=()=>Pop.close(true);
 form.onsubmit=async e=>{
  e.preventDefault();const v=input.value.trim();if(!v)return;
  if(v===value){Pop.close(true);return;}
  ok.disabled=input.readOnly=true;
  try{await save(v);if(Pop.el===el)Pop.close();}catch(err){toast(err.message,true);ok.disabled=input.readOnly=false;input.focus();}
 };
}
window.addEventListener('resize',()=>Pop.close());

// ---------- overlays: the picker and the command menu ----------
const Overlay={
 el:null,onclose:null,last:null,
 open(html,o={}){
  this.close(true);this.last=document.activeElement;
  const el=document.createElement('div');el.className='overlay';el.innerHTML=html;$('#overlay-slot').append(el);this.el=el;this.onclose=o.onclose||null;
  const box=el.firstElementChild;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');if(o.label)box.setAttribute('aria-label',o.label);
  el.onmousedown=e=>{if(e.target===el)this.close();};
  el.onkeydown=e=>{if(e.key!=='Tab')return;const c=[...box.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,a[href],[tabindex="0"]')].filter(x=>x.getClientRects().length);
   if(!c.length)return;if(e.shiftKey&&document.activeElement===c[0]){e.preventDefault();c.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===c.at(-1)){e.preventDefault();c[0].focus();}};
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)box.animate([{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.2,0,0,1)'});
  requestAnimationFrame(()=>(box.querySelector('[autofocus],input')||box.querySelector('button'))?.focus());
  return el;
 },
 close(silent){if(!this.el)return;this.el.remove();this.el=null;const f=this.onclose;this.onclose=null;if(!silent&&f)f();this.last?.focus?.();},
};

// ---------- the command menu: "/" in the prompt and Ctrl+K ----------
const Cmd={
 tools:null,index:0,list:[],
 async loadTools(){if(!this.tools)this.tools=(await api('/api/tools').catch(()=>({tools:[]}))).tools;return this.tools;},
 items(){
  const go=(label,href,icon,group,about)=>({label,icon,group,about,run:()=>{location.hash=href;}});
  const out=[];
  out.push({label:'Make a new video',icon:'spark',group:'Actions',run:()=>Dock.focus()});
  out.push({label:'Teach a video',icon:'add',group:'Actions',run:()=>{location.hash='#/learn';}});
  for(const p of PLACES)if(p!=='-')out.push(go(p.label,'#/'+p.id,p.icon,'Go to'));
  for(const [place,tabs] of Object.entries(TABS))for(const [path,l] of tabs)if(path.includes('/'))out.push(go(l,'#/'+path,PLACES.find(p=>p.id===place)?.icon||'gear','Go to',PLACES.find(p=>p.id===place)?.label||'Settings'));
  out.push(go('Trash','#/trash','trash','Go to'));
  out.push({label:$('#app').dataset.rail==='collapsed'?'Expand the rail':'Collapse the rail',icon:'collapse',group:'Navigation',run:()=>App.collapse()});
  return out;
 },
 async open(q=''){
  Overlay.open(`<div class="cmd"><div class="cmd-input">${I.search}<input type="text" id="cmd-q" autocomplete="off" spellcheck="false" placeholder="Search places and everything you made" aria-label="Search places and everything you made" aria-controls="cmd-list" value="${esc(q)}"></div><div class="cmd-list" id="cmd-list" role="listbox"></div><div class="cmd-foot"><span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span></div></div>`,{label:'Command menu'});
  const input=$('#cmd-q');input.oninput=()=>{this.index=0;this.draw();};
  input.onkeydown=e=>{
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();this.index=(this.index+(e.key==='ArrowDown'?1:-1)+this.list.length)%Math.max(1,this.list.length);this.draw();}
   else if(e.key==='Enter'){e.preventDefault();this.run(this.index);}
  };
  this.index=0;this.draw();
 },
 draw(){
  const q=($('#cmd-q')?.value||'').trim().toLowerCase(),box=$('#cmd-list');if(!box)return;
  const words=q.split(/\s+/).filter(Boolean),all=this.items().filter(x=>{const hay=(x.label+' '+(x.about||'')+' '+x.group).toLowerCase();return words.every(w=>hay.includes(w));});
  if(q)all.push({label:`Search everything for “${$('#cmd-q').value.trim()}”`,icon:'search',group:'Search',run:()=>findGo($('#cmd-q').value)});
  this.list=all;this.index=Math.min(this.index,Math.max(0,all.length-1));let g='';
  box.innerHTML=all.length?all.map((x,i)=>{const head=x.group!==g?`<div class="pop-head" role="presentation">${esc(x.group)}</div>`:'';g=x.group;
   return head+`<button type="button" class="pop-item ${i===this.index?'active':''}" role="option" aria-selected="${i===this.index}" id="cmd-${i}" onclick="Cmd.run(${i})">${I[x.icon]||I.spark}<span><span dir="auto">${esc(x.label)}</span>${x.about?`<small>${esc(x.about)}</small>`:''}</span></button>`;}).join(''):'<div class="pop-empty">Nothing matches. Try fewer words.</div>';
  $('#cmd-q')?.setAttribute('aria-activedescendant','cmd-'+this.index);
  box.querySelector('.active')?.scrollIntoView({block:'nearest'});
 },
 run(i){const x=this.list[i];if(!x)return;Overlay.close(true);x.run();},
};

// One continuous fill per tab group, including when navigation rebuilds its markup.
function startTabFills(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let previous=new Map();
 function sync(){
  const current=new Map();
  document.querySelectorAll('.tabs,.seg-tiles').forEach(group=>{
   const options=[...group.children].filter(el=>el.matches('a,button'));
   const index=options.findIndex(el=>el.matches('[aria-current="page"],[aria-selected="true"],[aria-pressed="true"]'));
   let fill=group.querySelector(':scope > .tab-fill');
   if(index<0){fill?.remove();return;}
   const label=group.closest('#panel')?'drawer':'page';
   const signature=JSON.stringify([label,group.className,options.map(el=>el.getAttribute('href')||el.textContent)]);
   const key=signature+'-'+current.size;
   const rect=options[index].getBoundingClientRect(),frame=group.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   const x=rect.left-frame.left+group.scrollLeft-group.clientLeft;
   const y=rect.top-frame.top+group.scrollTop-group.clientTop;
   const width=rect.width,height=rect.height;
   const transform=`translate(${x}px,${y}px)`;
   const old=previous.get(key);
   if(!fill){
    fill=document.createElement('span');
    fill.className='tab-fill';
    fill.setAttribute('aria-hidden','true');
    group.prepend(fill);
   }
   const start=old?.fill===fill?getComputedStyle(fill):null;
   const from=start?{transform:start.transform,width:start.width,height:start.height}:old?.geometry;
   const geometry={transform,width:width+'px',height:height+'px'};
   Object.assign(fill.style,geometry,{borderRadius:getComputedStyle(options[index]).borderRadius});
   if(old&&old.index!==index&&!reduced.matches&&from){
    fill.getAnimations().forEach(animation=>animation.cancel());
    fill.animate([from,geometry],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
   }
   current.set(key,{index,geometry,fill});
  });
  previous=current;
 }
 new MutationObserver(sync).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-current','aria-selected','aria-pressed']});
 window.addEventListener('resize',sync);
 document.fonts.ready.then(sync);
 sync();
}

// ---------- the shell: the bell, help, keyboard ----------
const Shell={
 busy(){return !!(Pop.el||Overlay.el||$('#panel').contains(document.activeElement)&&/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));},
 icons(h){
  const waiting=h.you.length+(h.agent.length?1:0);
  // The bell sits in the sidebar's footer: a count beside it, or a dot on it when the sidebar is narrow.
  const bell=$('#rail-bell');
  if(!bell)return;
  const n=bell.querySelector('.n'),dot=bell.querySelector('.dot');
  const label=waiting?`Notifications: ${waiting} waiting for you`:'Notifications';
  bell.setAttribute('aria-label',label);
  if($('#app').dataset.rail==='collapsed'&&!matchMedia('(max-width:767px)').matches)bell.dataset.tooltip=label;else delete bell.dataset.tooltip;
  n.hidden=dot.hidden=!waiting;
  if(n.textContent!==String(waiting))n.textContent=dot.textContent=String(waiting);
 },
 bell(btn){
  const h=App.home,you=h.you,agent=h.agent;
  Pop.open(btn,`<div class="pop-head">Waiting for you</div>
   ${you.length?you.map(j=>`<a class="pop-item" href="#/projects/${encodeURIComponent(j.job)}">${I.film}<span><span dir="auto">${esc(j.title)}</span><small>Needs your look or approval</small></span></a>`).join(''):'<div class="pop-empty">Nothing is waiting for you.</div>'}
   ${agent.length?`<hr><div class="pop-head">Your agent has work</div>${agent.map(x=>`<div style="padding:4px 12px 8px"><div class="small muted">${esc(x.why)}. Tell it:</div><div class="say-line"><span dir="auto">“${esc(x.say)}”</span><button class="iconbtn sm" aria-label="Copy the command ${esc(x.command)}" onclick="copyText('${esc(x.command)}')">${I.copy}</button></div></div>`).join('')}`:''}`,{align:'end',label:'Waiting for you'});
 },
 start(){
  startTabFills();
  let g=0;
  document.addEventListener('keydown',e=>{
   if(e.defaultPrevented||e.isComposing)return;
   const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable;
   // Ctrl+K: on Create it goes to the search at the top (again from the search: the command menu).
   if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();
    if(e.target.id!=='create-search'&&typeof CreateFind!=='undefined'&&(App.route==='create'?CreateFind:App.route==='teach/library'&&!App.arg?LearnFind:null)?.focus())return;
    Cmd.open();return;}
   if(e.key==='Escape'){
    if(Controls.open||$('#modal').innerHTML)return;
    if(Pop.el){e.preventDefault();Pop.close(true);return;}
    if(Overlay.el){e.preventDefault();Overlay.close();return;}
    if(!$('#panel').hidden){e.preventDefault();Panel.close();return;}
    return;}
   const altGraph=e.getModifierState('AltGraph');
   if(typing||e.metaKey||(!altGraph&&(e.ctrlKey||e.altKey)))return;
   // Another panel (rules, settings…) keeps its keys; the Edit prompt drawer holds the prompt itself.
   if(Controls.open||Pop.el||Overlay.el||$('#modal').innerHTML||(!$('#panel').hidden&&Panel.id!=='prompt-editor')||$('#app').classList.contains('open'))return;
   if(e.key==='/'&&Dock.el){e.preventDefault();Dock.focus();return;}
   if(e.key==='['){e.preventDefault();App.collapse();return;}
   const prompt=Dock.el?.querySelector('textarea');
   // Type anywhere: a letter goes into the prompt even when a card, a button or a link has focus
   // (Space and Enter still press it). Only controls that use letters themselves keep them.
   if(prompt&&!prompt.disabled&&!prompt.readOnly&&!e.target.closest?.('[role=slider],[role=listbox],[role=menu],[role=grid],[role=tree],video,audio')){
    if(e.key==='Dead'||e.key==='Process'){
     // Move focus before the browser begins composing the character.
     prompt.focus({preventScroll:true});
     return;
    }
    if([...e.key].length===1&&e.key!==' '){
     e.preventDefault();
     prompt.focus({preventScroll:true});
     const end=prompt.value.length;
     if(prompt.maxLength<0||end+e.key.length<=prompt.maxLength){
      prompt.setRangeText(e.key,end,end,'end');
      prompt.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:e.key}));
     }
     return;
    }
   }
   if(e.key==='g'){g=Date.now();return;}
   if(Date.now()-g<900){const to={c:'create',p:'create',b:'brain'}[e.key];if(to){e.preventDefault();location.hash='#/'+to;}g=0;}
  });
 },
};

// ---------- the prompt dock: on Create and inside a project ----------
const Dock={
 el:null,mode:null,
 /** Each screen that wants the dock says what it does; create.js and places.js fill these in. */
 kinds:{},
 async expand(){
  if(Panel.id==='prompt-editor'){Panel.close();return;}
  const dock=this.el;
  if(!dock||this.departure)return;
  const panelBefore=Panel.id;
  const departure=this.departure=this.compactMotion(dock,true);
  if(departure){
   // A background tab does not run animations: never wait more than a moment for this one.
   await Promise.race([departure.finished.catch(()=>{}),new Promise(r=>setTimeout(r,400))]);
   this.departure=null;
   if(this.el!==dock||!dock.isConnected||Panel.id!==panelBefore){
    departure.cancel();
    return;
   }
  }
  const panel=Panel.open({
   id:'prompt-editor',title:'Edit prompt',dockNode:this.el,
   body:'<div class="prompt-drawer-start" id="drawer-start"></div>',
   dock:'<div class="prompt-drawer-host"></div>'
  });
  departure?.cancel();
  const input=this.el.querySelector('textarea');
  autoGrow(input);
  (this.mode==='learn'?LearnWork:DrawerWork).render(panel);// Create: what to make or the work on it; Learn: what to learn and what is learning
 },
 compactMotion(dock,leaving){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
  dock.getAnimations().forEach(animation=>animation.cancel());
  const frames=[{translate:'0px',opacity:1},{translate:'-24px',opacity:0}];
  return dock.animate(leaving?frames:frames.reverse(),{
   duration:leaving?160:220,easing:'cubic-bezier(.22,1,.36,1)',fill:leaving?'forwards':'none'
  });
 },
 restore(animate=false){
  if(!this.el?.closest('.prompt-drawer-host'))return;
  $('#dock-slot').append(this.el);
  const ex=$('#dock-expand',this.el);
  if(ex){ex.setAttribute('aria-expanded','false');ex.setAttribute('aria-label','Expand prompt');ex.innerHTML=I.expand;}
  const input=this.el.querySelector('textarea');
  if(input)autoGrow(input);
  if(animate)this.compactMotion(this.el,false);
 },
 mount(route,arg){
  const want=route==='create'?'create':route==='teach/library'&&!arg?'learn':route==='studio/videos'&&arg?'change':null;
  const slot=$('#dock-slot');
  if(!want){slot.innerHTML='';this.el=null;this.mode=null;return;}
  const keep=this.mode===want&&this.el&&this.el.isConnected&&this.arg===arg;
  if(keep){this.kinds[want].refresh?.(this.el);return;}
  this.mode=want;this.arg=arg;
  slot.innerHTML=`<div class="dock-wrap" id="dock-wrap">${this.kinds[want].html(arg)}</div>`;
  this.el=$('#dock-wrap');this.kinds[want].wire(this.el,arg);
 },
 focus(){if(App.route!=='create'&&!(App.route==='teach/library'&&!App.arg)&&!(App.route==='studio/videos'&&App.arg)){location.hash='#/create';setTimeout(()=>Dock.focus(),120);return;}this.el?.querySelector('textarea')?.focus();},
};
/** Grows a textarea with its text, up to the stylesheet's limit. */
function autoGrow(t){t.style.height='auto';t.style.height=t.scrollHeight+'px';}
