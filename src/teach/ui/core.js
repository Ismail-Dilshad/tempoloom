'use strict';
// The app's shell: sections, the agent's status, messages, dialogs, the theme, and one poll that
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
function arrangeToasts(change=()=>{}){
 const stack=$('#toasts');change();
 const items=[...stack.children],expanded=stack.matches(':hover,:focus-within');
 if(items[0])items[0].dataset.stacked='false';
 stack.style.setProperty('--toast-front-height',(items[0]?.offsetHeight||0)+'px');
 let y=0,height=0;
 items.forEach((el,index)=>{
  const top=expanded?y:index*12;
  el.style.setProperty('--toast-y',top+'px');
  el.style.setProperty('--toast-scale',expanded?1:1-Math.min(index,2)*.04);
  el.style.zIndex=String(items.length-index);
  el.dataset.covered=String(!expanded&&index>=3);el.inert=!expanded&&index>=3;
  el.dataset.stacked=String(!expanded&&index>0);
  if(expanded||index<3)height=Math.max(height,top+el.offsetHeight);
  y+=el.offsetHeight+10;
 });
 stack.style.height=height+'px';
 stack.onpointerenter=()=>arrangeToasts();stack.onpointerleave=()=>arrangeToasts();
 stack.onfocusin=()=>arrangeToasts();stack.onfocusout=()=>queueMicrotask(()=>arrangeToasts());
}
function toast(msg,bad){
 if([...$('#toasts').children].some(el=>el.dataset.message===msg&&!el.classList.contains('leaving')))return;
 const t=document.createElement('div');t.className='toast'+(bad?' bad':'');
 t.dataset.message=msg;t.tabIndex=0;
 const symbol=(bad?I.error:I.check)||ICON(bad?'<path d="M12 7v6M12 17h.01"/>':'<path d="m7 12 3 3 7-7"/>');
 t.innerHTML=`<div class="toast-heading"><div class="toast-symbol">${symbol}</div><strong>${bad?'Something went wrong':'Done'}</strong></div><div class="toast-reveal"><div><p dir="auto">${esc(msg)}</p></div></div>`;
 let closing=false,timer=null,remaining=bad?9000:3500,started=0,hovered=false,focused=false;
 const resume=()=>{
  if(closing||hovered||focused||timer!==null)return;
  started=performance.now();timer=setTimeout(dismiss,remaining);
 };
 const pause=()=>{
  if(timer===null)return;
  clearTimeout(timer);timer=null;
  remaining=Math.max(0,remaining-(performance.now()-started));
 };
 const dismiss=()=>{
  if(closing)return;
  closing=true;clearTimeout(timer);
  const remove=()=>{observer.disconnect();if(t.isConnected)arrangeToasts(()=>t.remove());};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){remove();return;}
  const appearance=getComputedStyle(t);
  t.style.setProperty('--toast-exit-width',t.offsetWidth+'px');
  t.style.setProperty('--toast-exit-transform',appearance.transform);
  t.style.setProperty('--toast-exit-opacity',appearance.opacity);
  t.classList.add('leaving');
  t.addEventListener('animationend',e=>{if(e.target===t&&e.animationName==='toast-collapse')remove();});
  setTimeout(remove,850);
 };
 t.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();dismiss();}};
 t.onpointerenter=e=>{if(e.pointerType==='touch')return;hovered=true;pause();};
 t.onpointerleave=()=>{hovered=false;resume();};
 t.onfocusin=()=>{focused=true;pause();};
 t.onfocusout=e=>{if(t.contains(e.relatedTarget))return;focused=false;resume();};
 const observer=new ResizeObserver(()=>{if(t.isConnected)arrangeToasts();else observer.disconnect();});
 observer.observe(t);
 arrangeToasts(()=>$('#toasts').prepend(t));
 resume();
}
/** Routine changes are visible in the refreshed screen; reserve notifications for errors. */
async function act(fn,done){try{await fn();}catch(e){toast(e.message,true);}await App.refresh(true);}
/** A question with two answers; resolves true for yes. */
function ask(title,text,yes='Yes',danger=false){return new Promise(res=>{
 dialog(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" data-no>Cancel</button><button class="btn ${danger?'':'primary'}" data-yes style="${danger?'background:var(--bad);border-color:var(--bad);color:var(--on-bad)':''}">${esc(yes)}</button></div>`,{onclose:()=>res(false)});
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
  const menu=document.createElement('div');menu.className='select-menu';menu.id=trigger.id+'-list';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',trigger.getAttribute('aria-label'));
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
   const below=rect.top<height+18;
   this.tip.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left+(rect.width-width)/2))+'px';
   this.tip.style.top=Math.max(8,Math.min(innerHeight-height-8,below?rect.bottom+9:rect.top-height-9))+'px';
   const ids=new Set((target.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));
   ids.add(this.tip.id);target.setAttribute('aria-describedby',[...ids].join(' '));
   this.tip.classList.add('visible');
  },delay);
 },
 start(){
  this.tip=document.createElement('div');this.tip.id='dashboard-tooltip';this.tip.className='soft-tooltip';this.tip.setAttribute('role','tooltip');document.body.append(this.tip);
  this.mount();
  new MutationObserver(()=>this.mount()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['title']});
  document.addEventListener('pointerover',e=>{
   if(e.pointerType==='touch')return;
   if(this.tip.contains(e.target)){clearTimeout(this.timer);return;}
   const target=e.target.closest('[data-tooltip]');
   if(target)this.show(target,300);
  });
  document.addEventListener('pointerout',e=>{
   if(!this.target)return;
   if(this.target.contains(e.relatedTarget)||this.tip.contains(e.relatedTarget))return;
   if(this.target.contains(document.activeElement))return;
   clearTimeout(this.timer);this.timer=setTimeout(()=>this.hide(),100);
  });
  document.addEventListener('focusin',e=>{const target=e.target.closest('[data-tooltip]');if(target)this.show(target,100);});
  document.addEventListener('focusout',e=>{if(this.target?.contains(e.target))this.hide();});
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
/** The rail: seven places in Flow's order, with dividers after Scenes and Library. */
const PLACES=[
 {id:'create',label:'Create',icon:'spark'},
 {id:'projects',label:'Projects',icon:'film',count:h=>[h.studio.jobs,h.studio.waitingForYou]},
 {id:'looks',label:'Looks',icon:'palette'},
 {id:'scenes',label:'Scenes',icon:'scenes'},
 '-',
 {id:'library',label:'Library',icon:'folder',plus:{label:'Add to your library',run:'libraryAdd()'}},
 '-',
 {id:'tools',label:'Tools',icon:'tools'},
 {id:'brain',label:'Brain',icon:'brain',count:h=>[h.teach.lessons,0]}];
/** Public address -> the screen that draws it. Longer addresses first. */
const ROUTES=[['create','create'],['projects/finished','studio/gallery'],['projects','studio/videos'],['looks','looks'],['scenes','scenes'],
 ['library/references','teach/library'],['library/tidy','find'],['library','library'],
 ['tools/text','studio/text'],['tools/trends','studio/ideas'],['tools','tools'],
 ['brain/taste','taste'],['brain/lessons','teach/lessons'],['brain/patterns','teach/patterns'],['brain/worked','studio/scores'],['brain/teach','teach/add'],['brain','taste'],
 ['settings/history','history'],['settings/backup','backup'],['settings/appearance','appearance'],['settings','settings'],['trash','trash']];
/** Old addresses keep working: each opens its new place. */
const REDIRECTS=[['home','create'],['studio/new','create'],['studio/ideas','tools/trends'],['studio/live','projects'],['studio/videos','projects'],['studio/gallery','projects/finished'],
 ['studio/scores','brain/worked'],['studio/text','tools/text'],['taste','brain/taste'],['teach/add','brain/teach'],['teach/library','library/references'],
 ['teach/lessons','brain/lessons'],['teach/patterns','brain/patterns'],['find','library/tidy'],['history','settings/history'],['backup','settings/backup']];
/** Tabs inside a place. */
const TABS={projects:[['projects','All projects'],['projects/finished','Finished videos']],
 library:[['library','Your media'],['library/references','Taught videos'],['library/tidy','Find and tidy']],
 tools:[['tools','All tools'],['tools/text','Edit by text'],['tools/trends','Trend watch']],
 brain:[['brain/taste','Taste'],['brain/lessons','Lessons'],['brain/patterns','Patterns'],['brain/worked','What worked'],['brain/teach','Teach a video']],
 settings:[['settings','Models and keys'],['settings/appearance','Appearance'],['settings/history','History'],['settings/backup','Backup and move']]};
const longest=list=>[...list].sort((a,b)=>b[0].length-a[0].length);
function resolveRoute(h){
 for(const [old,now] of longest(REDIRECTS))if(h===old||h.startsWith(old+'/'))return {redirect:now+h.slice(old.length)};
 for(const [pub,view] of longest(ROUTES))if(h===pub||h.startsWith(pub+'/')){const rest=h.slice(pub.length+1);return {path:pub,view,arg:rest?decodeURIComponent(rest):null};}
 return {path:'create',view:'create',arg:null};
}
/** The public address that shows a screen (the shortest one). */
const publicOf=view=>ROUTES.filter(r=>r[1]===view).sort((a,b)=>a[0].length-b[0].length)[0]?.[0]??view;

const App={
 home:null,route:'create',arg:null,path:'create',screens:{},nav:[],
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
  $('#menu').innerHTML=I.menu;$('#menu').onclick=()=>$('#app').classList.toggle('open');$('#scrim').onclick=()=>$('#app').classList.remove('open');
  $('#search-icon').outerHTML=I.search;
  window.addEventListener('hashchange',()=>{const before=this.route;this.parse();$('#app').classList.remove('open');if(before!==this.route)Panel.close(true);Overlay.close(true);Pop.close();this.changed=true;const s=this.screens[this.route];if(!s.load||s.data)this.show();this.refresh(!!s.load&&!s.data);window.scrollTo(0,0);$('#view').focus({preventScroll:true});});
  this.parse();await this.refresh(true);
  setInterval(()=>{if(!document.hidden)this.refresh(false);},2500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.refresh(false);});
 },
 /** Loads the home summary and the current screen's data; re-draws only when something changed and the user is not typing or watching. */
 async refresh(force){
  const s=this.screens[this.route];
  try{
   const [h,d]=await Promise.all([api('/api/home'),s.load?s.load():null]);
   const changed=JSON.stringify(h)!==JSON.stringify(this.home)||(s.load&&JSON.stringify(d)!==JSON.stringify(s.data));
   this.home=h;if(s.load)s.data=d;this.offline=false;
   const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''),playing=[...document.querySelectorAll('video,audio')].some(m=>!m.paused),busy=$('#modal').innerHTML||Controls.open||Shell.busy();
   this.side();
   if(force||(changed&&!typing&&!playing&&!busy&&!(s.hold&&s.hold())))this.show(false);
  }catch(e){if(!this.offline){this.offline=true;toast(e.message==='Failed to fetch'?'The page lost the server. Is the terminal still open? Start it again with: pnpm tempoloom studio open':e.message,true);}}
 },
 show(routeChanged){
  const s=this.screens[this.route];if(!s||!this.home)return;
  if(s.load&&!s.data)return;
  routeChanged=routeChanged||this.changed;this.changed=false;
  const y=window.scrollY,place=PLACES.find(p=>p.id===this.place),inside=!!this.arg&&this.place==='projects';
  const title=inside||!place?s.title(this.arg):place.label;
  $('#title').textContent=title;
  document.title=(this.home.you.length?`(${this.home.you.length}) `:'')+title+' · Tempoloom';
  this.side();const view=$('#view');view.dataset.screen=this.route;s.render(view,this.arg,routeChanged);
  // Every page: tabs of its place, then a title, a line of explanation and its actions.
  const lone=view.children.length===1&&view.firstElementChild.classList.contains('empty'),own=!!view.querySelector('.teach-workspace,.teach-upload,.no-head');
  const head=!lone&&!own&&s.head?s.head(this.arg):null,actions=s.actions?s.actions(this.arg):'';
  if(head){const w=document.createElement('div');w.className='teach-workspace';
   w.innerHTML=`<header class="teach-workspace-head"><div><h2 dir="auto">${esc(head.title)}</h2><p class="muted">${esc(head.text)}</p></div>${actions?`<div class="row head-actions">${actions}</div>`:''}</header>`;
   while(view.firstChild)w.append(view.firstChild);view.append(w);}
  const tabs=TABS[this.place];
  if(tabs&&!(this.arg&&['projects','projects/finished'].includes(this.path))){const nav=document.createElement('nav');nav.className='tabs';nav.setAttribute('aria-label',(place?.label||'')+' sections');
   nav.innerHTML=tabs.map(([p,l])=>`<a href="#/${p}" ${this.path===p||(p==='brain/taste'&&this.path==='brain')?'aria-current="page"':''}>${esc(l)}</a>`).join('');view.prepend(nav);}
  $('#actions').innerHTML=head||lone?'':actions;
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
  const light=document.documentElement.dataset.theme==='light';
  const links=PLACES.map(p=>{if(p==='-')return '<hr>';const c=p.count?p.count(h):null,here=this.place===p.id;
   return `<a class="navlink" href="#/${p.id}" ${here?'aria-current="page"':''} data-tooltip-rail="${esc(p.label)}">${I[p.icon]}<span class="lbl">${p.label}</span>${c&&c[1]?`<span class="n hot" title="${c[1]} waiting for you">${c[1]}</span>`:''}${p.plus?`<span class="plus" role="button" tabindex="0" aria-label="${esc(p.plus.label)}" onclick="event.preventDefault();event.stopPropagation();${p.plus.run}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();${p.plus.run}}">${I.add}</span>`:''}</a>`;}).join('');
  const navScroll=$('.rail-body')?.scrollTop||0,m=h.mascot,collapsed=$('#app').dataset.rail==='collapsed';
  $('#side').innerHTML=`<header class="rail-head side-header"><a class="logo" href="#/create" aria-label="Tempoloom, Create"><img class="logo-mark" src="/logo${light?'-light':''}.svg?v=10" alt="Tempoloom" width="146" height="31"><img class="logo-small" src="/mark.svg?v=10" alt="" width="32" height="32"></a></header>
   <nav class="rail-body side-body" aria-label="Places">${links}</nav>
   <footer class="rail-foot side-footer">
    ${m?`<a class="agent-chip" href="${m.job?'#/projects/'+encodeURIComponent(m.job):'#/projects'}" title="${esc((m.who||'Your agent')+': '+(m.detail||FACE_LABEL[m.face]||''))}"><img src="/mascot/${esc(m.face)}.svg" alt="${esc(FACE_LABEL[m.face]||'')}" width="36" height="28"><span><b>${esc(m.who||'Your agent')}</b><small dir="auto">${esc(m.detail||FACE_LABEL[m.face]||'')}</small></span></a>`:''}
    <a class="navlink" href="#/trash" ${this.place==='trash'?'aria-current="page"':''}>${I.trash}<span class="lbl">Trash</span></a>
    <button class="navlink collapse-btn" onclick="App.collapse()" aria-pressed="${collapsed}">${I.collapse}<span class="lbl">${collapsed?'Expand':'Collapse'}</span></button></footer>`;
  $('.rail-body').scrollTop=navScroll;
  Shell.icons(h);
 },
 collapse(){const on=$('#app').dataset.rail!=='collapsed';$('#app').dataset.rail=on?'collapsed':'';store.set('rail',on?'collapsed':'');this.side();},
 /** Dark, light or the system's choice; remembered. */
 theme(choice){
  if(!choice)choice=document.documentElement.dataset.theme==='light'?'dark':'light';
  const t=choice==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):choice;
  document.documentElement.dataset.theme=t;document.documentElement.dataset.themeChoice=choice;
  try{localStorage.setItem('tl-theme',choice);}catch{/* private window */}this.side();
 },
};
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if(document.documentElement.dataset.themeChoice==='system')App.theme('system');});
