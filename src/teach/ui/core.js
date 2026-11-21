'use strict';
// The app's shell: sections, the agent's status, messages, dialogs, and one poll that
// keeps every screen fresh without re-drawing under the user's hands.
const KEY=new URLSearchParams(location.search).get('k')||'';
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const withKey=u=>u+(u.includes('?')?'&':'?')+'k='+KEY;
async function api(path,opt={}){
 const r=await fetch(path,{...opt,headers:{'x-teach-key':KEY,...(opt.body?{'content-type':'application/json'}:{}),...(opt.headers||{})}});
 const j=await r.json().catch(()=>({error:'The server did not answer'}));
 if(!r.ok)throw new Error(j.error||'Something went wrong');return j;
}
const fmtT=t=>{t=Math.max(0,t||0);const m=Math.floor(t/60),s=t-m*60;return m+':'+s.toFixed(2).padStart(5,'0');};
const fmtS=t=>{t=Math.max(0,t||0);const m=Math.floor(t/60),s=Math.floor(t-m*60);return m+':'+String(s).padStart(2,'0');};
const mb=b=>b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const ago=iso=>{const s=(Date.now()-new Date(iso).getTime())/1000;return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':s<604800?Math.floor(s/86400)+' d ago':new Date(iso).toLocaleDateString();};
const store={get(k,d){try{const v=localStorage.getItem('tl-'+k);return v===null?d:JSON.parse(v);}catch{return d;}},set(k,v){try{localStorage.setItem('tl-'+k,JSON.stringify(v));}catch{/* private window */}}};
const ICON=(d,o='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${o}>${d}</svg>`;
const I={home:ICON('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),add:ICON('<path d="M12 5v14M5 12h14"/>'),lib:ICON('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/>'),
 lesson:ICON('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.800 1-2.500A6 6 0 0 0 12 3z"/>'),pattern:ICON('<path d="M3 17l5-6 4 4 4-7 5 9"/>'),
 film:ICON('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4"/>'),chart:ICON('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
 sun:ICON('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M2 12h2M20 12h2M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400"/>'),moon:ICON('<path d="M21 12.800A9 9 0 1 1 11.200 3a7 7 0 0 0 9.800 9.800z"/>'),
 menu:ICON('<path d="M4 6h16M4 12h16M4 18h16"/>'),copy:ICON('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),search:ICON('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.300-4.300"/>'),
 heart:ICON('<path d="M12 20s-7-4.500-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.500-9 9-9 9z"/>'),eye:ICON('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
 gallery:ICON('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>'),star:ICON('<path d="M12 3l2.700 5.600 6.100.900-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.900z"/>'),play:ICON('<path d="M8 5l11 7-11 7z"/>'),
 x:ICON('<path d="M6 6l12 12M18 6L6 18"/>'),down:ICON('<path d="M12 4v12M6 11l6 6 6-6M4 21h16"/>')};

/** What each of the mascot's faces means, in plain words. */
const FACE_LABEL={idle:'Waiting',listening:'Reading',thinking:'Thinking',planning:'Planning',creating:'Making',rendering:'Rendering',done:'Done',excited:'Happy',confused:'Unsure',error:'Stuck','needs-approval':'Needs you',sleeping:'Asleep'};
/** Notifications in the style of Sileo (sileo.aaryan.design, MIT): a small pill with a badge and a
 *  title springs open into a rounded body with the message, the two joined by an SVG "gooey" filter.
 *  It opens a moment after it appears, closes again before it leaves, opens while you hover or focus
 *  it (its timer waits), and Escape dismisses it. Newest on top. */
let toastSerial=0;
const TOAST_H=40,TOAST_BLUR=8,TOAST_R=16;
function toastLayout(t){
 const W=t.offsetWidth,open=t.dataset.open==='true',head=t.querySelector('.toast-head'),inner=t.querySelector('.toast-head-inner');
 const pw=Math.min(W,Math.max(TOAST_H,Math.ceil(inner.scrollWidth)+16)),px=(W-pw)/2;
 const desc=t.querySelector('.toast-desc'),full=Math.max(TOAST_H*2.25,TOAST_H+desc.scrollHeight),h=open?full:TOAST_H;
 t.style.setProperty('--h',h+'px');t.style.setProperty('--pw',pw+'px');t.style.setProperty('--px',px+'px');
 const svg=t.querySelector('svg'),pill=svg.querySelector('.pill'),body=svg.querySelector('.body'),f=svg.querySelector('filter');
 svg.setAttribute('width',W);svg.setAttribute('height',full);svg.setAttribute('viewBox',`0 0 ${W} ${full}`);
 f.setAttribute('width',W+TOAST_BLUR*4);f.setAttribute('height',full+TOAST_BLUR*4);
 Object.assign(pill.style,{x:px+'px',width:pw+'px',height:(open?TOAST_H+TOAST_BLUR*3:TOAST_H)+'px'});
 Object.assign(body.style,{height:(open?full-TOAST_H:0)+'px'});
 head.style.maxWidth=pw+'px';
}
function toast(msg,bad){
 const stack=$('#toasts');
 if([...stack.children].some(el=>el.dataset.message===msg&&el.dataset.leaving!=='true'))return;
 const id='toast-goo-'+(++toastSerial),state=bad?'error':'success',life=bad?9000:6000,closeAt=life-2000;
 const t=document.createElement('div');t.className='toast';t.dataset.state=state;t.dataset.message=msg;t.tabIndex=0;
 t.setAttribute('role',bad?'alert':'status');
 const icon=(bad?I.error:I.check)||ICON(bad?'<path d="M12 7v6M12 17h.01"/>':'<path d="m7 12 3 3 7-7"/>');
 t.innerHTML=`<svg class="toast-shape" aria-hidden="true"><defs><filter id="${id}" filterUnits="userSpaceOnUse" x="${-TOAST_BLUR*2}" y="${-TOAST_BLUR*2}" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${TOAST_BLUR}" result="blur"/><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="goo"/><feComposite in="SourceGraphic" in2="goo" operator="atop"/></filter></defs>
  <g filter="url(#${id})"><rect class="pill" x="0" y="0" width="${TOAST_H}" height="${TOAST_H}" rx="${TOAST_R}" ry="${TOAST_R}"/><rect class="body" x="0" y="${TOAST_H}" width="100%" height="0" rx="${TOAST_R}" ry="${TOAST_R}"/></g></svg>
  <div class="toast-head"><span class="toast-head-inner" style="display:inline-flex;align-items:center;gap:8px"><span class="toast-badge">${icon}</span><strong class="toast-title">${bad?'Something went wrong':'Done'}</strong></span></div>
  <div class="toast-desc"><p dir="auto">${esc(msg)}</p></div>`;
 stack.prepend(t);
 let timer=null,openTimer=null,closeTimer=null,started=0,remaining=life,held=false,leaving=false;
 const setOpen=on=>{t.dataset.open=String(on);toastLayout(t);};
 const dismiss=()=>{if(leaving)return;leaving=true;[timer,openTimer,closeTimer].forEach(clearTimeout);setOpen(false);t.dataset.leaving='true';
  t.style.marginBottom=-(TOAST_H+12)+'px';setTimeout(()=>t.remove(),matchMedia('(prefers-reduced-motion: reduce)').matches?0:600);};
 const run=()=>{if(leaving||held)return;started=performance.now();timer=setTimeout(dismiss,remaining);
  const toClose=remaining-(life-closeAt);if(toClose>0)closeTimer=setTimeout(()=>setOpen(false),toClose);};
 const hold=()=>{if(held||leaving)return;held=true;clearTimeout(timer);clearTimeout(closeTimer);clearTimeout(openTimer);remaining=Math.max(1500,remaining-(performance.now()-started));setOpen(true);};
 const release=()=>{if(!held||t.matches(':hover')||t.contains(document.activeElement))return;held=false;setOpen(false);run();};
 t.onpointerenter=e=>{if(e.pointerType!=='touch')hold();};t.onpointerleave=()=>release();
 t.onfocusin=()=>hold();t.onfocusout=e=>{if(!t.contains(e.relatedTarget))queueMicrotask(release);};
 t.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();dismiss();}};
 t.onclick=()=>{if(t.dataset.open!=='true')hold();};
 t.dismiss=dismiss;
 toastLayout(t);
 requestAnimationFrame(()=>{t.dataset.ready='true';openTimer=setTimeout(()=>{if(!leaving)setOpen(true);},150);run();});
}
window.addEventListener('resize',()=>document.querySelectorAll('.toast').forEach(toastLayout));
/** Routine changes are visible in the refreshed screen; reserve notifications for errors. */
async function act(fn,done){try{await fn();}catch(e){toast(e.message,true);}await App.refresh(true);}
/** A question with two answers; resolves true for yes. */
// A danger question (delete, remove) gets one soft card everywhere: a trash badge, the question, a
// short line, the thing it acts on when given (file: {name, meta, thumb}), and two equal buttons.
function ask(title,text,yes='Yes',danger=false,{file}={}){return new Promise(res=>{
 const body=danger?`<div class="confirm">
   <span class="confirm-badge" aria-hidden="true">${typeof I!=='undefined'&&I.trash||''}</span>
   <h2 class="confirm-title">${esc(title)}</h2><p class="confirm-text">${esc(text)}</p>
   ${file?`<div class="confirm-file">${file.thumb?`<img src="${esc(file.thumb)}" alt="" onerror="this.remove()">`:''}<span class="confirm-file-name" dir="auto">${esc(file.name)}</span>${file.meta?`<span class="confirm-file-meta">${esc(file.meta)}</span>`:''}</div>`:''}
   <div class="confirm-actions"><button class="btn ghost" data-no>Cancel</button><button class="btn confirm-danger" data-yes>${esc(yes)}</button></div></div>`
  :`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes>${esc(yes)}</button></div>`;
 dialog(body,{onclose:()=>res(false)});
 if(danger)$('#modal .dialog')?.classList.add('dialog-confirm');
 $('#modal [data-yes]').onclick=()=>{closeDialog(true);res(true);};$('#modal [data-no]').onclick=()=>closeDialog();$('#modal [data-'+(danger?'no':'yes')+']').focus();});}
let dialogClose=null,lastFocus=null;
function dialog(html,o={}){lastFocus=document.activeElement;dialogClose=o.onclose||null;
 $('#modal').innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="dialog ${o.wide?'wide':''}">${html}</div></div>`;
 const surface=$('#modal .modal'),heading=$('h2',surface);
 if(heading){heading.id='dialog-title';surface.setAttribute('aria-labelledby',heading.id);}
 surface.onkeydown=e=>{
  if(e.key!=='Tab')return;
  const controls=[...surface.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),video[controls],a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 };
 surface.querySelector('input:not(:disabled),textarea,button')?.focus();
 $('#modal .modal').onmousedown=e=>{if(e.target.classList.contains('modal'))closeDialog();};}
function closeDialog(silent){const f=dialogClose;dialogClose=null;$('#modal').innerHTML='';if(!silent&&f)f();lastFocus?.focus?.();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modal').innerHTML)closeDialog();});
async function copyText(t){try{await navigator.clipboard.writeText(t);}catch{toast('Copy it by hand: '+t,true);}}
function download(name,text,type='text/markdown'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}

// Progressive custom select: the original select remains the form's source of truth.
const Controls={
 open:null,serial:0,numberSyncs:new WeakMap(),numberHold:null,
 mount(root=document){
  this.mountNumbers(root);
  root.querySelectorAll('input[type=range]:not(.studio-slider)').forEach(slider=>{
   slider.classList.add('studio-slider');
   const update=()=>{
    const min=Number(slider.min||0),max=Number(slider.max||100);
    const percent=(slider.valueAsNumber-min)/Math.max(max-min,Number.EPSILON)*100;
    slider.style.setProperty('--slider-fill',Math.min(100,Math.max(0,percent))+'%');
   };
   slider.addEventListener('input',update);
   slider.addEventListener('change',update);
   update();
  });
  root.querySelectorAll('select:not([multiple])').forEach(select=>{
   if(select.dataset.enhanced)return;
   select.dataset.enhanced='true';select.hidden=true;
   const wrap=document.createElement('div');wrap.className='select-control';
   select.before(wrap);wrap.append(select);
   const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';
   trigger.id='select-control-'+(++this.serial);trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
   const labels=[...select.labels];labels.forEach(label=>label.htmlFor=trigger.id);
   const label=select.getAttribute('aria-label')||labels.map(l=>l.textContent.trim()).join(' ')||'Choose an option';
   const sync=()=>{trigger.innerHTML=`<span>${esc(select.selectedOptions[0]?.textContent||'Choose an option')}</span>${I.chevron||ICON('<path d="m7 10 5 5 5-5"/>')}`;trigger.disabled=select.disabled;trigger.setAttribute('aria-label',label+': '+(select.selectedOptions[0]?.textContent||''));};
   wrap.append(trigger);sync();select.addEventListener('change',sync);
   trigger.onclick=()=>this.open?.trigger===trigger?this.close():this.show(select,trigger);
   trigger.onkeydown=e=>{
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(this.open?.trigger!==trigger)this.show(select,trigger);else this.move(e.key);}
   };
  });
 },
 mountNumbers(root){
  root.querySelectorAll('input[type=number]').forEach(input=>{
   const existing=this.numberSyncs.get(input);
   if(existing){existing();return;}
   if(!input.id)input.id='number-control-'+(++this.serial);
   const labels=[...input.labels];
   const name=input.getAttribute('aria-label')||labels.map(label=>label.textContent.trim()).join(' ')||input.placeholder||'value';
   if(!labels.length&&!input.hasAttribute('aria-label'))input.setAttribute('aria-label',name);
   const implicit=input.closest('label');
   if(implicit){
    const field=document.createElement('div');field.className='number-field';
    implicit.before(field);field.append(implicit);implicit.htmlFor=input.id;
   }
   const wrap=document.createElement('div');wrap.className='number-control';
   if(input.style.width)wrap.style.width=input.style.width;
   if(implicit)implicit.after(wrap);else input.before(wrap);
   wrap.append(input);input.style.width='100%';
   const minus=document.createElement('button'),plus=document.createElement('button');
   for(const [button,direction] of [[minus,-1],[plus,1]]){
    button.type='button';button.className='number-step '+(direction<0?'decrease':'increase');
    button.setAttribute('aria-label',(direction<0?'Decrease ':'Increase ')+name);
    button.title=(direction<0?'Decrease ':'Increase ')+name+' · Shift for 10 steps';
    button.innerHTML=(direction<0?I.remove:I.add)||ICON(direction<0?'<path d="M5 12h14"/>':'<path d="M5 12h14M12 5v14"/>');
    button.onpointerdown=e=>{
     if(e.button!==0||button.disabled)return;
     e.preventDefault();button.focus();
     this.startNumberHold(button,input,()=>step(direction*(e.shiftKey?10:1),false),e);
    };
    button.onpointerleave=()=>{if(this.numberHold?.button===button&&this.numberHold.mode==='pointer')this.numberHold.stop();};
    button.onpointermove=e=>{
     if(this.numberHold?.button!==button||this.numberHold.mode!=='pointer')return;
     const r=button.getBoundingClientRect();
     if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.numberHold.stop();
    };
    button.onkeydown=e=>{
     if(e.key!==' '&&e.key!=='Enter')return;
     e.preventDefault();
     if(!e.repeat)this.startNumberHold(button,input,()=>step(direction*(e.shiftKey?10:1),false),e);
    };
    button.onclick=e=>{if(e.detail===0&&!e.pointerType){this.numberHold?.stop();step(direction*(e.shiftKey?10:1));}};
    button.oncontextmenu=e=>e.preventDefault();
    wrap.append(button);
   }
   const sync=()=>{
    const value=input.valueAsNumber,blocked=input.disabled||input.readOnly;
    for(const [button,atLimit] of [[minus,input.min!==''&&value<=Number(input.min)],[plus,input.max!==''&&value>=Number(input.max)]]){
     const disabled=blocked||atLimit;
     if(button.disabled!==disabled)button.disabled=disabled;
    }
    wrap.classList.toggle('disabled',input.disabled);
   };
   const step=(amount,commit=true)=>{
    if(input.disabled||input.readOnly)return false;
    const before=input.value;
    if(input.step==='any'){
     const value=Number.isFinite(input.valueAsNumber)?input.valueAsNumber:0;
     const next=Number((value+amount).toPrecision(15));
     const lower=Number(input.min),upper=Number(input.max);
     const min=input.min!==''&&Number.isFinite(lower)?lower:-Infinity;
     const max=input.max!==''&&Number.isFinite(upper)?upper:Infinity;
     input.value=String(Math.max(min,Math.min(max,next)));
    }else input.stepUp(amount);
    if(input.value!==before){
     input.dispatchEvent(new Event('input',{bubbles:true}));
     if(commit)input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    sync();return input.value!==before;
   };
   input.addEventListener('input',sync);input.addEventListener('change',sync);
   input.addEventListener('keydown',e=>{
    if(e.shiftKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();step(e.key==='ArrowUp'?10:-10);}
   });
   this.numberSyncs.set(input,sync);sync();
  });
 },
 startNumberHold(button,input,change,event){
  this.numberHold?.stop();
  const controller=new AbortController(),mode=event.type==='pointerdown'?'pointer':'keyboard';
  const initial=input.value;
  let timer,stopped=false;
  const stop=()=>{
   if(stopped)return;stopped=true;
   clearTimeout(timer);controller.abort();
   if(this.numberHold===hold){button.classList.remove('holding');this.numberHold=null;}
   if(input.isConnected&&input.value!==initial)input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const repeat=()=>{
   if(this.numberHold!==hold)return;
   if(document.hidden||!button.isConnected||button.disabled||!change())return stop();
   if(this.numberHold!==hold)return;
   if(!button.isConnected||button.disabled)return stop();
   timer=setTimeout(repeat,80);
  };
  const hold={button,mode,stop};
  this.numberHold=hold;button.classList.add('holding');
  if(!change()||!button.isConnected||button.disabled){stop();return;}
  timer=setTimeout(repeat,320);
  const options={signal:controller.signal};
  button.addEventListener('blur',stop,options);
  window.addEventListener('blur',stop,options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},options);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')stop();},{...options,capture:true});
  if(mode==='pointer'){
   const released=e=>{if(e.pointerId===event.pointerId)stop();};
   document.addEventListener('pointerup',released,options);
   document.addEventListener('pointercancel',released,options);
  }else document.addEventListener('keyup',e=>{if(e.key===event.key)stop();},options);
 },
 close(focus=false){
  const o=this.open;if(!o)return;this.open=null;
  o.trigger.setAttribute('aria-expanded','false');o.trigger.removeAttribute('aria-controls');o.trigger.removeAttribute('aria-activedescendant');
  o.menu.setAttribute('aria-hidden','true');o.menu.inert=true;o.menu.style.pointerEvents='none';
  o.menu.removeAttribute('id');o.menu.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)o.menu.remove();
  else{
   const style=getComputedStyle(o.menu),from={opacity:style.opacity,transform:style.transform};
   o.animation?.cancel();
   const animation=o.menu.animate([from,{opacity:0,transform:'translateY('+o.direction*5+'px) scale(.98)'}],{duration:160,easing:'ease-in',fill:'forwards'});
   animation.finished.then(()=>o.menu.remove(),()=>o.menu.remove());
   setTimeout(()=>o.menu.remove(),220);
  }
  if(focus&&o.trigger.isConnected)o.trigger.focus();
 },
 show(select,trigger){
  this.close();if(select.disabled)return;
  const options=[...select.options],enabled=options.map((o,i)=>!o.disabled&&!o.parentElement.disabled?i:-1).filter(i=>i>=0);
  if(!enabled.length)return;
  const menu=document.createElement('div');menu.className='select-menu';if(trigger.closest('.video-settings'))menu.classList.add('video-select-menu');menu.id=trigger.id+'-list';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',trigger.getAttribute('aria-label'));
  menu.innerHTML=options.map((o,i)=>`<div id="${menu.id}-${i}" class="select-option" role="option" aria-label="${esc(o.textContent)}" aria-selected="${o.selected}" aria-disabled="${!enabled.includes(i)}" data-index="${i}">${esc(o.textContent)}</div>`).join('');
  document.body.append(menu);const r=trigger.getBoundingClientRect();const height=Math.min(280,menu.scrollHeight,innerHeight-24),below=innerHeight-r.bottom-8;
  menu.style.width=Math.min(Math.max(r.width,180),innerWidth-16)+'px';menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';
  menu.style.maxHeight=height+'px';menu.style.top=(below>=height?r.bottom+5:Math.max(8,r.top-height-5))+'px';
  this.open={select,trigger,menu,options,enabled,direction:below>=height?-1:1,animation:null,index:enabled.includes(select.selectedIndex)?select.selectedIndex:enabled[0],query:'',typed:0};
  trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',menu.id);this.highlight();
  menu.style.transformOrigin=below>=height?'top center':'bottom center';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   this.open.animation=menu.animate([{opacity:0,transform:'translateY('+this.open.direction*6+'px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  menu.onmousedown=e=>e.preventDefault();
  menu.onclick=e=>{const row=e.target.closest('[data-index]');if(row)this.choose(Number(row.dataset.index));};
 },
 highlight(){const o=this.open;if(!o)return;o.menu.querySelectorAll('[data-index]').forEach(row=>row.classList.toggle('active',Number(row.dataset.index)===o.index));const active=document.getElementById(o.menu.id+'-'+o.index);o.trigger.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});},
 move(key){const o=this.open;if(!o)return;const p=o.enabled.indexOf(o.index);o.index=key==='Home'?o.enabled[0]:key==='End'?o.enabled.at(-1):o.enabled[(p+(key==='ArrowUp'?-1:1)+o.enabled.length)%o.enabled.length];this.highlight();},
 choose(index){const o=this.open;if(!o||!o.enabled.includes(index))return;const changed=o.select.selectedIndex!==index;o.select.selectedIndex=index;this.close(true);if(changed){o.select.dispatchEvent(new Event('input',{bubbles:true}));o.select.dispatchEvent(new Event('change',{bubbles:true}));}},
 start(){
  new MutationObserver(()=>{if(this.open&&!this.open.trigger.isConnected)this.close();if(this.numberHold&&(!this.numberHold.button.isConnected||this.numberHold.button.disabled))this.numberHold.stop();this.mount();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','min','max','step']});
  document.addEventListener('pointerdown',e=>{if(this.open&&!this.open.menu.contains(e.target)&&!this.open.trigger.contains(e.target))this.close();});
  document.addEventListener('keydown',e=>{const o=this.open;if(!o)return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close(true);}
   else if(e.key==='Tab')this.close();
   else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){if(e.target===o.trigger)return;e.preventDefault();this.move(e.key);}
   else if(e.key==='Enter'||e.key===' '){e.preventDefault();this.choose(o.index);}
   else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();const now=Date.now();o.query=(now-o.typed>700?'':o.query)+e.key.toLowerCase();o.typed=now;const found=o.enabled.find(i=>o.options[i].textContent.trim().toLowerCase().startsWith(o.query));if(found!==undefined){o.index=found;this.highlight();}}
  },true);
  window.addEventListener('resize',()=>this.close());document.addEventListener('scroll',e=>{if(this.open&&!this.open.menu.contains(e.target))this.close();},true);
  this.mount();
 }
};

const Tooltips={
 target:null,timer:null,tip:null,
 mount(){
  document.querySelectorAll('[title],.iconbtn[aria-label]').forEach(el=>{
   const text=el.getAttribute('title')||el.getAttribute('aria-label');
   if(text)el.dataset.tooltip=text;
   if(el.hasAttribute('title'))el.removeAttribute('title');
  });
  if(this.target&&!this.target.isConnected)this.hide();
 },
 hide(){
  clearTimeout(this.timer);
  if(this.target){
   const ids=(this.target.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='dashboard-tooltip');
   if(ids.length)this.target.setAttribute('aria-describedby',ids.join(' '));else this.target.removeAttribute('aria-describedby');
  }
  this.target=null;this.tip.classList.remove('visible');
 },
 show(target,delay){
  if(target===this.target)return;
  this.hide();this.target=target;
  this.timer=setTimeout(()=>{
   if(!target.isConnected)return this.hide();
   this.tip.textContent=target.dataset.tooltip;
   this.tip.dir='auto';
   const rect=target.getBoundingClientRect(),width=this.tip.offsetWidth,height=this.tip.offsetHeight;
   if(target.closest('#side') && $('#app').dataset.rail==='collapsed' && matchMedia('(min-width:768px)').matches){
    const rail=$('#side').getBoundingClientRect();
    const left=rail.right+width+9<=innerWidth?rail.right+9:rail.left-width-9;
    this.tip.style.left=Math.max(8,left)+'px';
    this.tip.style.top=Math.max(8,Math.min(innerHeight-height-8,rect.top+(rect.height-height)/2))+'px';
   }else{
   const below=rect.top<height+18;
   this.tip.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left+(rect.width-width)/2))+'px';
   this.tip.style.top=Math.max(8,Math.min(innerHeight-height-8,below?rect.bottom+9:rect.top-height-9))+'px';
   }
   const ids=new Set((target.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));
   ids.add(this.tip.id);target.setAttribute('aria-describedby',[...ids].join(' '));
   this.tip.classList.add('visible');
  },delay);
 },
 start(){
  this.tip=document.createElement('div');this.tip.id='dashboard-tooltip';this.tip.className='soft-tooltip';this.tip.setAttribute('role','tooltip');document.body.append(this.tip);
  this.mount();
  new MutationObserver(()=>this.mount()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['title']});
  document.addEventListener('pointermove',e=>{
   if(e.pointerType==='touch'||e.buttons)return;
   const target=e.target.closest('[data-tooltip]');
   if(target)this.show(target,300);
   else if(this.target)this.hide();
  });
  document.addEventListener('pointerout',e=>{
   if(this.target&&!this.target.contains(e.relatedTarget))this.hide();
  });
  document.addEventListener('panel',()=>this.hide());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.target){e.preventDefault();e.stopImmediatePropagation();this.hide();}},true);
  document.addEventListener('pointerdown',()=>this.hide());
  document.addEventListener('scroll',()=>this.hide(),true);
  window.addEventListener('resize',()=>this.hide());
 }
};

/** The three ways of teaching as tiles, the same ones the Teach page uses, with a count on each. */
function groupTiles(groups,selected,count,noun,handler){
 const icon={motion:'pattern',edit:'film',story:'lesson'};
 const tile=(id,name,about,ic)=>`<button type="button" class="teach-mode" aria-pressed="${selected===id}" onclick="${handler}('${id}')"><span class="teach-mode-icon">${I[ic]}</span><span><b>${name}</b><small>${count(id)} ${noun}${about?', '+about.toLowerCase():''}</small></span></button>`;
 return `<div class="teach-modes group-tiles" role="group" aria-label="Category">${tile('all','Everything','','gallery')}${groups.map(g=>tile(g.id,g.label,g.about,icon[g.id]||'lib')).join('')}</div>`;
}
/** A video that can show where TikTok, Reels and Shorts draw their own buttons and captions (only
 *  when it turns out to be vertical). One switch for the whole app, remembered. */
function safeVideo(videoHtml){return `<div class="safe-wrap"><div class="safe-frame">${videoHtml}<div class="safe-zones" aria-hidden="true"></div></div><button type="button" class="safe-toggle" onclick="safeToggle()" aria-pressed="false">Show the platforms' buttons</button></div>`;}
function safeApply(root=document){
 const s=App.home?.safe,mode=store.get('safe-show','');if(!s)return;
 const order=['',...s.chosen],label=mode?s.platforms[mode]?.label:'';
 root.querySelectorAll('.safe-wrap').forEach(w=>{const z=w.querySelector('.safe-zones'),b=w.querySelector('.safe-toggle'),p=mode&&s.platforms[mode];
  b.setAttribute('aria-pressed',String(!!p));const nxt=order[(order.indexOf(mode)+1)%order.length];b.textContent=p?(nxt?`Showing ${label}: show ${s.platforms[nxt].label}`:`Showing ${label}: hide`):`Show the platforms' buttons`;
  z.innerHTML=p?`<i style="top:0;left:0;right:0;height:${p.top*100}%"></i><i style="bottom:0;left:0;right:0;height:${p.bottom*100}%"><span>${esc(label)}: caption and buttons</span></i><i style="top:${p.top*100}%;bottom:${p.bottom*100}%;left:0;width:${p.left*100}%"></i><i style="top:${p.top*100}%;bottom:${p.bottom*100}%;right:0;width:${p.right*100}%"></i>`:'';});
}
window.safeToggle=()=>{const s=App.home?.safe;if(!s)return;const order=['',...s.chosen],mode=store.get('safe-show','');store.set('safe-show',order[(order.indexOf(mode)+1)%order.length]);safeApply();};
document.addEventListener('loadedmetadata',e=>{const v=e.target;if(v.tagName!=='VIDEO')return;const w=v.closest('.safe-wrap');if(w)w.classList.toggle('vertical',v.videoHeight/v.videoWidth>=1.5);},true);

// ---------- places, routes and the shell ----------
/** The rail: five places in Flow's order, with dividers around Library. */
const PLACES=[
 {id:'create',label:'Studio',icon:'spark',count:h=>[h.studio.jobs,h.studio.waitingForYou]},// Create holds the projects too (the Projects place was merged into it)
 '-',// Library was folded in: looks are cards on Studio, locked scenes live in their project, Tidy is in Tools
 {id:'brain',label:'Brain',icon:'brain',count:h=>[h.teach.lessons,0]}];
/** Public address -> the screen that draws it. Longer addresses first. */
const ROUTES=[['create','create'],['learn','teach/library'],// Learn: what the studio learned from, beside Create
 ['projects','studio/videos'],['videos','made-video'],// projects/NAME: one project; the list is on Create
 ['brain/taste','taste'],['brain/worked','studio/scores'],['brain','brain-home'],
 ['settings/history','history'],['settings/backup','backup'],['settings/appearance','appearance'],['settings','settings'],['trash','trash']];
/** Old addresses keep working: each opens its new place. */
const REDIRECTS=[['tools','create'],['home','create'],['studio/new','create'],['studio/ideas','create'],['studio/live','create'],['studio/videos','projects'],['studio/gallery','create'],['projects/finished','create'],
 ['studio/scores','brain/worked'],['studio/text','create'],['taste','brain/taste'],['learn/new','learn'],['teach/add','learn'],['teach/library','learn'],['library/references','learn'],['library/teach','learn'],
 ['brain/lessons','brain'],['teach/lessons','brain'],['teach/patterns','brain'],['brain/patterns','brain'],['brain/teach','learn'],['library/looks','create'],['library/scenes','create'],['library/tidy','create'],['settings/tidy','create'],['looks','create'],['scenes','create'],['find','create'],['history','settings/history'],['backup','settings/backup']];
/** Tabs inside a place. */
const TABS={
 settings:[['settings','Models and keys'],['settings/appearance','Sidebar'],['settings/history','History'],['settings/backup','Backup and move']]};
const longest=list=>[...list].sort((a,b)=>b[0].length-a[0].length);
function resolveRoute(h){
 if(h==='library')return {redirect:'create'};// Library was folded into Studio
 for(const [old,now] of longest(REDIRECTS))if(h===old||h.startsWith(old+'/'))return {redirect:now+h.slice(old.length)};
 for(const [pub,view] of longest(ROUTES))if(h===pub||h.startsWith(pub+'/')){const rest=h.slice(pub.length+1);return {path:pub,view,arg:rest?decodeURIComponent(rest):null};}
 return {path:'create',view:'create',arg:null};
}
/** The public address that shows a screen (the shortest one). */
const publicOf=view=>ROUTES.filter(r=>r[1]===view).sort((a,b)=>a[0].length-b[0].length)[0]?.[0]??view;

const App={
 refreshId:0,appliedRefresh:0,home:null,route:'create',arg:null,path:'create',screens:{},nav:[],
 register(route,screen){this.screens[route]=screen;},
 go(route,arg){location.hash='#/'+(this.screens[route]?publicOf(route):route)+(arg?'/'+encodeURIComponent(arg):'');},
 get place(){return this.path.split('/')[0];},
 parse(){
  let h=location.hash.replace(/^#\/?/,'');
  if(!h&&location.pathname==='/studio')h='create';
  let r=resolveRoute(h);
  if(r.redirect){h=r.redirect;history.replaceState(null,'',location.pathname+location.search+'#/'+h);r=resolveRoute(h);}
  if(!this.screens[r.view])r={path:'create',view:'create',arg:null};
  this.route=r.view;this.path=r.path;this.arg=r.arg;
 },
 async start(){
  Controls.start();Tooltips.start();Shell.start();
  $('#app').dataset.rail=store.get('rail','');
  $('#menu').innerHTML=I.menu;$('#menu').onclick=()=>{if(matchMedia('(max-width:767px)').matches)$('#app').classList.toggle('open');else this.collapse();this.side();};$('#scrim').onclick=()=>{$('#app').classList.remove('open');this.side();$('#menu').focus();};
  matchMedia('(max-width:767px)').addEventListener('change',()=>this.side());
  // On a phone, tapping a place closes the sidebar, also when it is the page already open.
  $('#side').addEventListener('click',e=>{if(e.target.closest('a.navlink,a.agent-chip')&&$('#app').classList.contains('open')){$('#app').classList.remove('open');this.side();}});
  window.addEventListener('hashchange',()=>{const before=this.path,previousArg=this.arg;this.parse();$('#app').classList.remove('open');if(before!==this.path||previousArg!==this.arg)Panel.close(true);Overlay.close(true);Pop.close();this.changed=true;const s=this.screens[this.route];if(s.load&&s.loadedArg!==this.arg)s.data=null;if(!s.load||s.data)this.show();else $('#view').replaceChildren();this.refresh(!!s.load&&!s.data);window.scrollTo(0,0);$('#view').focus({preventScroll:true});});
  this.parse();await this.refresh(true);
  setInterval(()=>{if(!document.hidden)this.refresh(false);},2500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.refresh(false);});
 },
 /** Loads the home summary and the current screen's data; re-draws only when something changed and the user is not typing or watching. */
 async refresh(force){
  const s=this.screens[this.route],path=this.path,arg=this.arg,id=++this.refreshId;
  const stale=()=>path!==this.path||arg!==this.arg||id<this.appliedRefresh;
  try{
   const [h,d]=await Promise.all([api('/api/home'),s.load?s.load():null]);
   if(stale())return;
   this.appliedRefresh=id;
   s.loadedArg=arg;
   const changed=JSON.stringify(h)!==JSON.stringify(this.home)||(s.load&&JSON.stringify(d)!==JSON.stringify(s.data));
   this.home=h;if(s.load)s.data=d;this.offline=false;
   const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''),playing=[...document.querySelectorAll('video,audio')].some(m=>!m.paused),busy=$('#modal').innerHTML||Controls.open||Shell.busy();
   this.side();
   if(force||(changed&&!typing&&!playing&&!busy&&!(s.hold&&s.hold())))this.show(false);
  }catch(e){if(!stale()&&!this.offline){this.offline=true;toast(e.message==='Failed to fetch'?'The page lost the server. Is the terminal still open? Start it again with: pnpm tempoloom studio open':e.message,true);}}
 },
 show(routeChanged){
  const s=this.screens[this.route];if(!s||!this.home)return;
  if(s.load&&!s.data)return;
  routeChanged=routeChanged||this.changed;this.changed=false;
  const y=window.scrollY,place=PLACES.find(p=>p.id===(['projects','videos','learn'].includes(this.place)?'create':this.place)),inside=!!this.arg&&['projects','videos'].includes(this.place)||this.place==='learn';
  const title=inside||!place?s.title(this.arg):place.label;
  document.title=(this.home.you.length?`(${this.home.you.length}) `:'')+title+' · Tempoloom';
  this.side();const view=$('#view');
  // Learn's grid sits in Create's frame (same padding, backdrop and cursors), so switching between them moves nothing.
  view.dataset.screen=(this.route==='teach/library'&&!this.arg)||this.route==='brain-home'?'create':this.route;s.render(view,this.arg,routeChanged);
  // Every page: tabs of its place, then a title, a line of explanation and its actions.
  const lone=view.children.length===1&&view.firstElementChild.classList.contains('empty'),own=!!view.querySelector('.teach-workspace,.teach-upload,.no-head');
  const head=!lone&&!own&&s.head?s.head(this.arg):null,actions=s.actions?s.actions(this.arg):'';
  if(head){const w=document.createElement('div');w.className='teach-workspace';
   w.innerHTML=`<header class="teach-workspace-head"><div><h2 dir="auto">${esc(head.title)}</h2>${head.text?`<p class="muted">${esc(head.text)}</p>`:''}</div>${actions?`<div class="row head-actions">${actions}</div>`:''}</header>`;
   while(view.firstChild)w.append(view.firstChild);view.append(w);}
  const tabs=TABS[this.place];
  if(tabs&&!(this.arg&&['projects','projects/finished'].includes(this.path))){const nav=document.createElement('nav');nav.className='tabs';nav.setAttribute('aria-label',(place?.label||'')+' sections');
   nav.innerHTML=tabs.map(([p,l])=>`<a href="#/${p}" ${this.path===p||(p==='brain/taste'&&this.path==='brain')?'aria-current="page"':''}>${esc(l)}</a>`).join('');view.prepend(nav);}
  // Taste and What worked are parts of the Brain page: each has a way back to it.
  if(this.place==='brain'&&this.path!=='brain'){const back=document.createElement('nav');back.className='tool-back';back.innerHTML=`<a class="btn small ghost" href="#/brain">${I.back} Brain</a>`;view.prepend(back);}
  // There is no top bar: a page's actions sit at the top of the page itself.
  if(!head&&!lone&&actions){const bar=document.createElement('div');bar.className='row page-actions';bar.innerHTML=actions;const tabsNav=view.querySelector(':scope>.tabs');if(tabsNav)tabsNav.after(bar);else view.prepend(bar);}
  const emptyIcon=this.route==='studio/scores'?I.chart:this.route==='teach/lessons'?I.lesson:this.route==='teach/patterns'?I.pattern:this.route==='teach/library'?I.lib:I.film;
  view.querySelectorAll('.empty').forEach(el=>{
   if(!el.querySelector('.empty-art'))el.insertAdjacentHTML('afterbegin',`<div class="empty-art" aria-hidden="true"><div>${emptyIcon}</div></div>`);
  });
  Dock.mount(this.route,this.arg);
  safeApply(view);
  if(!routeChanged)window.scrollTo(0,y);
 },
 /** The rail and the top bar's icons, from the home summary. */
 side(){
  const h=this.home;if(!h)return;
  const mobile=matchMedia('(max-width:767px)').matches;
  const collapsed=$('#app').dataset.rail==='collapsed';
  // The markup is the same open or collapsed (so nothing is rebuilt and the change animates);
  // what differs (tooltips, the Collapse button's name) is set in place below.
  const railTip=()=>'';
  const links=PLACES.map(p=>{if(p==='-')return '<hr>';const c=p.count?p.count(h):null,here=this.place===p.id||(p.id==='create'&&['projects','videos','learn'].includes(this.place));
   return `<a class="navlink" href="#/${p.id}" ${here?'aria-current="page"':''} aria-label="${esc(p.label)}" ${railTip(p.label)}>${I[p.icon]}<span class="lbl">${p.label}</span>${c&&c[1]?`<span class="n hot" title="${c[1]} waiting for you">${c[1]}</span>`:''}${p.plus?`<span class="plus" role="button" tabindex="0" aria-label="${esc(p.plus.label)}" data-tooltip="${esc(p.plus.label)}" onclick="event.preventDefault();event.stopPropagation();${p.plus.run}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();${p.plus.run}}">${I.add}</span>`:''}</a>`;}).join('');
  const navScroll=$('.rail-body')?.scrollTop||0,m=h.mascot;
  const markup=`<header class="rail-head side-header"><a class="logo" href="#/create" aria-label="Tempoloom, Studio" ${railTip('Studio')}><img class="business-mark" src="/mark.svg?v=10" alt="" width="48" height="48"><span class="brand-copy"><img class="logo-mark" src="/logo.svg?v=10" alt="Tempoloom" width="106" height="21"></span></a></header>
   <nav class="rail-body side-body" aria-label="Places">${links}</nav>
   <footer class="rail-foot side-footer">
    ${m?`<a class="agent-chip" href="${m.job?'#/projects/'+encodeURIComponent(m.job):'#/projects'}" title="${esc((m.who||'Your agent')+': '+(m.detail||FACE_LABEL[m.face]||''))}"><img src="/mascot/${esc(m.face)}.svg" alt="${esc(FACE_LABEL[m.face]||'')}" width="36" height="28"><span><b>${esc(m.who||'Your agent')}</b><small dir="auto">${esc(m.detail||FACE_LABEL[m.face]||'')}</small></span></a>`:''}
    <a class="navlink" href="#/trash" aria-label="Trash" ${railTip('Trash')} ${this.place==='trash'?'aria-current="page"':''}>${I.trash}<span class="lbl">Trash</span></a>
    <button type="button" class="navlink bell" id="rail-bell" aria-haspopup="menu" aria-expanded="false" ${railTip('Notifications')} onclick="Shell.bell(this)">${I.bell}<span class="lbl">Notifications</span><span class="n hot" hidden></span><span class="dot" hidden></span></button>
    <a class="navlink" id="rail-settings" href="#/settings" aria-label="Settings" ${railTip('Settings')} ${this.place==='settings'?'aria-current="page"':''}>${I.gear}<span class="lbl">Settings</span></a>
    <button type="button" class="navlink collapse-btn" id="rail-collapse" aria-controls="side" onclick="App.collapse()">${I.collapse}<span class="lbl">Collapse</span></button>
    </footer>`;
  if(markup!==this.railMarkup){
   $('#side').innerHTML=markup;
   this.railMarkup=markup;
   $('.rail-head').insertAdjacentHTML('beforeend',`<button class="iconbtn rail-close" aria-label="Close the menu" onclick="document.querySelector('#app').classList.remove('open');App.side();document.querySelector('#menu').focus()">${I.x}</button>`);
  }
  $('#menu').setAttribute('aria-label',mobile?'Open the menu':collapsed?'Expand':'Collapse');
  $('#menu').setAttribute('aria-controls','side');
  $('#menu').setAttribute('aria-expanded',String(mobile?$('#app').classList.contains('open'):!collapsed));
  $('.rail-body').scrollTop=navScroll;
  // Collapsed on a computer: each place shows its name as a tooltip; the last button says Expand.
  const tips=collapsed&&!mobile;
  $('#side').querySelectorAll('.navlink[aria-label],.logo[aria-label]').forEach(el=>{if(el.id==='rail-bell')return;const name=el.id==='rail-collapse'?(collapsed?'Expand':'Collapse'):el.classList.contains('logo')?'Create':el.getAttribute('aria-label');if(tips)el.dataset.tooltip=name;else delete el.dataset.tooltip;});
  const cb=$('#rail-collapse');if(cb){cb.setAttribute('aria-label',collapsed?'Expand':'Collapse');cb.setAttribute('aria-expanded',String(!collapsed));if(tips)cb.dataset.tooltip=collapsed?'Expand':'Collapse';}
  Shell.icons(h);
 },
 collapse(){const on=$('#app').dataset.rail!=='collapsed',focus=document.activeElement?.id==='rail-collapse';$('#app').dataset.rail=on?'collapsed':'';store.set('rail',on?'collapsed':'');this.side();if(focus)$('#rail-collapse')?.focus();},
};
