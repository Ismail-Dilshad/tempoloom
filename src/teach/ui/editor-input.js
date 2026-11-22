'use strict';
// Editor, pointer and keys: dragging on the timeline (move, trims, box select, ruler scrub), the player (move, resize, rotate, pick a colour), and every shortcut.
// Loaded after editor-ui.js (see index.html).
function edWireTimeline(){
 const sc=Ed.dom.scroll,inner=Ed.dom.inner;
 // double-click a nested clip to open it
 Ed.dom.tracks.addEventListener('dblclick',e=>{const n=e.target.closest('.ed-clip'),c=n&&Ed.clip(n.dataset.cid);if(c?.nest)Ed.enterNest(c);});
 const timeAt=x=>Math.max(0,(x-inner.getBoundingClientRect().left)/Ed.zoom);
 const laneAt=y=>[...Ed.dom.tracks.children].find(l=>{const r=l.getBoundingClientRect();return y>=r.top&&y<r.bottom;});
 sc.onpointerdown=e=>{
  if(e.button!==0||e.target.closest('[data-join]'))return;
  const clip=e.target.closest('.ed-clip');
  if(!clip){
   if(e.target.closest('.ed-ruler')){Ed.seek(timeAt(e.clientX));sc.setPointerCapture(e.pointerId);const mv=ev=>{Ed.seek(timeAt(ev.clientX));Ed.scrub();},up=()=>{sc.removeEventListener('pointermove',mv);sc.removeEventListener('pointerup',up);};sc.addEventListener('pointermove',mv);sc.addEventListener('pointerup',up);return;}
   const ir=inner.getBoundingClientRect(),x0=e.clientX-ir.left,y0=e.clientY-ir.top,box=Ed.dom.marquee,add=e.shiftKey||e.ctrlKey||e.metaKey,before=new Set(Ed.sels);let dragging=false;
   const mv=ev=>{const x1=ev.clientX-ir.left,y1=ev.clientY-ir.top;if(!dragging&&Math.hypot(x1-x0,y1-y0)<4)return;dragging=true;box.hidden=false;
    const L=Math.min(x0,x1),T=Math.min(y0,y1),Wd=Math.abs(x1-x0),Hd=Math.abs(y1-y0);Object.assign(box.style,{left:L+'px',top:T+'px',width:Wd+'px',height:Hd+'px'});
    const hit=new Set(add?before:[]);Ed.dom.tracks.querySelectorAll('.ed-clip').forEach(n=>{const r=n.getBoundingClientRect(),cl=Ed.clip(n.dataset.cid);if(cl&&!Ed.trackOf(cl)?.locked&&r.right-ir.left>L&&r.left-ir.left<L+Wd&&r.bottom-ir.top>T&&r.top-ir.top<T+Hd)hit.add(n.dataset.cid);});
    Ed.sels=hit;Ed.sel=[...hit].pop()||null;Ed.junction=null;Ed.dom.tracks.querySelectorAll('.ed-clip').forEach(n=>n.classList.toggle('sel',hit.has(n.dataset.cid)));};
   const up=ev=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);box.hidden=true;
    if(!dragging){if(!add)Ed.pick(null);Ed.seek(timeAt(ev.clientX));}Ed.drawTimeline();Ed.drawProps();Ed.draw();};
   window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);return;}
  const c=Ed.clip(clip.dataset.cid);if(!c)return;e.preventDefault();
  if(Ed.trackOf(c)?.locked)return toast('This track is locked.');
  Ed.solo=e.altKey;
  const proTrim=e.altKey||((e.ctrlKey||e.metaKey)&&e.target.dataset.h);
  if((e.shiftKey||e.ctrlKey||e.metaKey)&&!proTrim){Ed.select(c.id,true);Ed.solo=false;return;}
  if(!Ed.sels.has(c.id)||(e.altKey&&Ed.sels.size>1))Ed.select(c.id);else{Ed.sel=c.id;Ed.drawProps();}Ed.solo=false;
  if(e.target.dataset.fh){const key=e.target.dataset.fh==='in'?'fadeIn':'fadeOut',left=clip.getBoundingClientRect().left;let snapped=false;
   const mv=ev=>{if(!snapped){Ed.snapshot();snapped=true;}const x=(ev.clientX-left)/Ed.zoom;c[key]=Math.round(edClamp(key==='fadeIn'?x:c.dur-x,0,Math.min(5,c.dur/2))*10)/10;Ed.drawTimeline();Ed.sync();Ed.draw();};
   const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);if(snapped)Ed.after(true);};
   window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);return;}
  const mode=e.target.dataset.h||'move',x0=e.clientX,group=mode==='move'&&Ed.sels.size>1?Ed.picked():[c],orig=new Map(group.map(g=>[g.id,{...g}])),o=orig.get(c.id),m=Ed.mediaOf(c),srcDur=c.nest?c.nest.dur:m&&m.type!=='image'&&!c.sticker?m.dur:Infinity,kind=Ed.kindOf(c);
  const ids=new Set(group.map(g=>g.id)),edges=Ed.p.clips.filter(x=>!ids.has(x.id)).flatMap(x=>[x.start,x.start+x.dur]).concat([0,Ed.time,...Ed.p.markers.map(edMt)]);
  const snapT=t=>{if(!Ed.snap)return t;const tol=8/Ed.zoom;let best=t,d=tol;for(const s of edges){if(Math.abs(s-t)<d){d=Math.abs(s-t);best=s;}}return best;};
  let moved=false,newLane=null;
  // Pro trims: Alt + edge = ripple trim; Ctrl + edge = roll; Alt + body = slip; Ctrl + Alt + body = slide.
  const touching=(edge,which)=>Ed.p.clips.find(x=>x.track===c.track&&x.id!==c.id&&Math.abs((which==='prev'?x.start+x.dur:x.start)-edge)<.05);
  const prev=touching(o.start,'prev'),next=touching(o.start+o.dur,'next'),oP=prev&&{...prev},oN=next&&{...next};
  const after=Ed.p.clips.filter(x=>x.track===c.track&&x.id!==c.id&&x.start>=o.start+o.dur-.001).map(x=>[x,x.start]);
  const pro=mode==='move'?(e.altKey&&(e.ctrlKey||e.metaKey)?'slide':e.altKey?'slip':null):e.altKey?'ripple':(e.ctrlKey||e.metaKey)?'roll':null;
  if(pro&&kind!=='audio'&&!c.media&&!c.nest&&(pro==='slip'))return;
  const mv=ev=>{
   const dt=(ev.clientX-x0)/Ed.zoom;if(!moved&&Math.abs(ev.clientX-x0)<3&&Math.abs(ev.clientY-e.clientY)<3)return;if(!moved){Ed.snapshot();moved=true;}
   if(pro==='slip'&&(c.media||c.nest)){const sp=o.speed||1,span=Ed.srcSpan(o),max=Math.max(0,(srcDur===Infinity?(o.in||0):srcDur-span));c.in=edClamp((o.in||0)-dt*sp,0,max);Ed.seek(edClamp(Ed.time,c.start,c.start+c.dur-.01));}
   else if(pro==='slide'){let d=dt;if(oP){d=Math.max(d,-(oP.dur-.1));const mp=Ed.mediaOf(oP);if(mp&&mp.type!=='image'&&mp.dur)d=Math.min(d,(mp.dur-(oP.in||0))/(oP.speed||1)-oP.dur);}if(oN){const sn=oN.speed||1;d=Math.min(d,oN.dur-.1);d=Math.max(d,-(oN.in||0)/sn);}if(!oP)d=Math.max(d,-o.start);
    c.start=o.start+d;if(prev)prev.dur=oP.dur+d;if(next){const sn=oN.speed||1;next.start=oN.start+d;next.dur=oN.dur-d;if(next.media||next.nest)next.in=(oN.in||0)+d*sn;}}
   else if(pro==='roll'&&(mode==='r'?next:prev)){if(mode==='r')Ed.roll(c,next,dt,o,oN);else Ed.roll(prev,c,dt,oP,o);}
   else if(mode==='move'){
    const min=Math.min(...group.map(g=>orig.get(g.id).start));let d=Math.max(-min,dt);
    const s=o.start+d,a=snapT(s)-s,b=snapT(s+o.dur)-(s+o.dur);d+=Math.abs(a)<=Math.abs(b)?a:b;d=Math.max(-min,d);
    for(const g of group)g.start=orig.get(g.id).start+d;
    if(group.length===1){const lane=laneAt(ev.clientY);Ed.dom.tracks.querySelectorAll('.ed-lane-new').forEach(n=>n.classList.remove('on'));newLane=null;
     if(lane?.classList.contains('ed-lane-new')){lane.classList.add('on');newLane=lane.dataset.new;}
     else if(lane&&lane.dataset.kind===kind&&!lane.classList.contains('locked')&&lane.dataset.track!==c.track){c.track=lane.dataset.track;const node=Ed.dom.tracks.querySelector(`[data-cid="${c.id}"]`);if(node)lane.append(node);}}
   }
   else if(mode==='l'){let s=snapT(o.start+dt);const sp=o.speed||1;if(c.media||c.nest)s=Math.max(s,o.ramp?o.start:o.start-(o.in||0)/sp);s=Math.max(0,Math.min(s,o.start+o.dur-.1));const d=s-o.start;c.start=s;c.dur=o.dur-d;
    if(o.ramp){c.in=Ed.srcAt(o,s);c.ramp=d>.001?edRampSplit(o.ramp,d/o.dur)[1]:o.ramp;}else if(c.media||c.nest)c.in=(o.in||0)+d*sp;
    if(c.kf)for(const f of Object.values(c.kf))for(const x of f)x.t=Math.max(0,x.t-(d-(c._kfd||0)));c._kfd=d;}
   else{let e2=snapT(o.start+o.dur+dt);const sp=o.speed||1;e2=Math.min(e2,o.ramp?o.start+o.dur:o.start+(srcDur-(o.in||0))/sp);c.dur=Math.max(.1,e2-o.start);if(o.ramp)c.ramp=c.dur<o.dur-.001?edRampSplit(o.ramp,c.dur/o.dur)[0]:o.ramp;}
   // ripple: what follows on the track moves with the trimmed edge (a trimmed start keeps the clip where it was)
   if(pro==='ripple'){if(mode==='l'){const d=c.start-o.start;c.start=o.start;for(const [x,s0] of after)x.start=Math.max(0,s0-d);}else{const d=c.dur-o.dur;for(const [x,s0] of after)x.start=Math.max(0,s0+d);}}
   for(const x of [prev,next,...after.map(a=>a[0])]){if(!x)continue;const node=Ed.dom.tracks.querySelector(`[data-cid="${x.id}"]`);if(node){node.style.left=x.start*Ed.zoom+'px';node.style.width=x.dur*Ed.zoom+'px';}}
   for(const g of group){const node=Ed.dom.tracks.querySelector(`[data-cid="${g.id}"]`);if(node){node.style.left=g.start*Ed.zoom+'px';node.style.width=g.dur*Ed.zoom+'px';}}
   Ed.sync();Ed.draw();Ed.drawTime();};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);delete c._kfd;
   if(moved){
    if(newLane){const t=Ed.addTrack(kind,kind==='video'?undefined:newLane);c.track=t.id;}
    for(const g of group){const tr=Ed.trackOf(g);if(!tr?.main&&!Ed.fits(g.track,g.start,g.dur,ids))g.track=Ed.place(Ed.kindOf(g),g.start,g.dur,undefined,ids);}
    if(c.fadeIn>c.dur/2)c.fadeIn=c.dur/2;if(c.fadeOut>c.dur/2)c.fadeOut=c.dur/2;Ed.after(true);}};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);
 };
 sc.onwheel=e=>{if(e.ctrlKey){e.preventDefault();const z=Ed.zoom*(e.deltaY<0?1.15:.87);Ed.zoom=Math.max(10,Math.min(300,z));$('.ed-zoom').value=Ed.zoom;Ed.drawTimeline();}};
}
/** Handle sizes in the player, in frame pixels (they grow with the frame, so they look the same at any size). */
const edHandleSize=W=>Math.max(8,W/90),edKnob=W=>Math.max(24,W/30);
/** Which handle of the selected clip is at (px, py): 'scale' (a corner) or 'rotate' (the knob above), or null. */
function edHandleAt(c,g,W,H,px,py){
 const t=Ed.time;if(!c||Ed.trackOf(c)?.locked||Ed.kindOf(c)==='audio'||c.adjustment||t<c.start||t>=c.start+c.dur)return null;
 const b=Ed.box(g,c,W,H),a=-Ed.val(c,'rotate')*Math.PI/180,dx=px-b.cx,dy=py-b.cy,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a),hs=edHandleSize(W)*1.8;
 if(Math.hypot(lx,ly+b.h/2+edKnob(W))<hs)return 'rotate';
 if(Math.abs(Math.abs(lx)-b.w/2)<hs&&Math.abs(Math.abs(ly)-b.h/2)<hs)return 'scale';return null;
}
function edWirePreview(){
 const cv=Ed.dom.canvas;
 // the pointer shows what a drag would do
 cv.addEventListener('pointermove',e=>{if(e.buttons||Ed.picking)return;const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),one=Ed.picked().length===1?Ed.picked()[0]:null;
  const h=one&&edHandleAt(one,cv.getContext('2d'),W,H,(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height);cv.style.cursor=h==='scale'?'nwse-resize':h==='rotate'?'grab':'';});
 cv.onpointerdown=e=>{
  if(Ed.picking){const c=Ed.clip(Ed.picking);const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),px=Math.floor((e.clientX-r.left)*W/r.width),py=Math.floor((e.clientY-r.top)*H/r.height);
   Ed.draw();const d=cv.getContext('2d').getImageData(px,py,1,1).data,hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
   Ed.picking=null;Ed.dom.frame?.classList.remove('picking');if(c){Ed.snapshot();c.key={sim:25,smooth:10,spill:50,...(c.key||{}),on:true,color:hex};Ed.after(true);toast('Colour picked: '+hex);}return;}
  const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),sx=W/r.width,sy=H/r.height,px=(e.clientX-r.left)*sx,py=(e.clientY-r.top)*sy,g=cv.getContext('2d');
  const one=Ed.picked().length===1?Ed.picked()[0]:null,grab=one&&edHandleAt(one,g,W,H,px,py);
  if(grab){const b=Ed.box(g,one,W,H),s0=Ed.val(one,'scale'),r0=Ed.val(one,'rotate'),d0=Math.hypot(px-b.cx,py-b.cy)||1,a0=Math.atan2(py-b.cy,px-b.cx);let moved=false;cv.setPointerCapture(e.pointerId);
   cv.onpointermove=ev=>{if(!moved){Ed.snapshot();moved=true;}const qx=(ev.clientX-r.left)*sx-b.cx,qy=(ev.clientY-r.top)*sy-b.cy;
    if(grab==='scale')Ed.setVal(one,'scale',Math.round(edClamp(s0*Math.hypot(qx,qy)/d0,.05,10)*100)/100);
    else{let deg=r0+(Math.atan2(qy,qx)-a0)*180/Math.PI;deg=((deg+180)%360+360)%360-180;if(ev.shiftKey)deg=Math.round(deg/15)*15;Ed.setVal(one,'rotate',Math.round(deg*10)/10);}
    Ed.draw();};
   cv.onpointerup=()=>{cv.onpointermove=cv.onpointerup=null;if(moved){Ed.save();Ed.drawProps();Ed.drawTimeline();}};return;}
  const hit=[...Ed.visible(Ed.time)].reverse().find(c=>{if(Ed.trackOf(c)?.locked||c.adjustment)return false;const b=Ed.box(g,c,W,H);return Math.abs(px-b.cx)<=b.w/2&&Math.abs(py-b.cy)<=b.h/2;});
  if(!hit){if(Ed.sels.size)Ed.select(null);return;}
  if(!Ed.sels.has(hit.id)||Ed.sels.size>1)Ed.select(hit.id);
  const x0=Ed.val(hit,'x'),y0=Ed.val(hit,'y');let moved=false;cv.setPointerCapture(e.pointerId);
  cv.onpointermove=ev=>{if(!moved){Ed.snapshot();moved=true;}let x=Math.round((x0+(ev.clientX-e.clientX)*sx/W)*1000)/1000,y=Math.round((y0+(ev.clientY-e.clientY)*sy/H)*1000)/1000;
   if(Math.abs(x)<.015)x=0;if(Math.abs(y)<.015)y=0;Ed.setVal(hit,'x',x);Ed.setVal(hit,'y',y);Ed.draw();};
  cv.onpointerup=()=>{cv.onpointermove=cv.onpointerup=null;if(moved){Ed.save();Ed.drawProps();Ed.drawTimeline();}};
 };
}
window.addEventListener('keydown',e=>{
 if(App.route!=='editor'||!Ed.p||!Ed.dom.root?.isConnected||e.isComposing||Ed.exporting)return;
 if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable||$('#modal')?.innerHTML)return;
 const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;let done=true;
 if(k===' '&&mod&&e.shiftKey)Ed.playRange();
 else if(k===' '&&!mod)Ed.play();
 else if(!mod&&!e.altKey&&k==='l'&&e.shiftKey)Ed.toggleLoop();
 else if(mod&&k==='b'&&e.shiftKey||!mod&&!e.altKey&&k==='s'&&e.shiftKey)Ed.splitAll();
 else if(!mod&&!e.altKey&&k==='a')Ed.selectFrom(e.shiftKey?-1:1);
 else if(!mod&&!e.altKey&&!e.shiftKey&&/^[1-9]$/.test(e.key)&&Ed.p.clips.some(x=>x.nest?.multi)){if(!Ed.switchAngle(Number(e.key)-1))done=false;}
 else if(e.altKey&&!mod&&e.code==='KeyN'){const c=Ed.sel&&Ed.clip(Ed.sel);if(c?.nest&&Ed.sels.size===1)Ed.unnest(c);else Ed.nest();}
 else if(e.altKey&&mod&&(k==='arrowleft'||k==='arrowright')){if(!Ed.swap(k==='arrowleft'?-1:1))done=false;}
 else if(e.altKey&&!mod&&(k==='arrowleft'||k==='arrowright')){if(!Ed.nudge((k==='arrowleft'?-1:1)*(e.shiftKey?5:1)))done=false;}
 else if((k==='delete'||k==='backspace')&&!mod&&e.shiftKey)Ed.rippleRemove();
 else if((k==='delete'||k==='backspace')&&!mod)Ed.remove();
 else if(!mod&&!e.altKey&&k==='q')Ed.trimTo('start');
 else if(!mod&&!e.altKey&&k==='w')Ed.trimTo('end');
 else if(!mod&&!e.altKey&&k==='j')Ed.shuttle(-1);
 else if(!mod&&!e.altKey&&k==='k')Ed.shuttle(0);
 else if(!mod&&!e.altKey&&k==='l')Ed.shuttle(1);
 else if(!mod&&!e.altKey&&k==='i'&&e.shiftKey){const r=Ed.p.range;if(r?.in!=null)Ed.seek(r.in);}
 else if(!mod&&!e.altKey&&k==='o'&&e.shiftKey){const r=Ed.p.range;if(r?.out!=null)Ed.seek(r.out);}
 else if(!mod&&!e.altKey&&k==='i')Ed.setRange('in');
 else if(!mod&&!e.altKey&&k==='o')Ed.setRange('out');
 else if(e.altKey&&!mod&&e.code==='KeyX')Ed.clearRange();
 else if(!mod&&!e.altKey&&k==='f'&&e.shiftKey)Ed.freeze();
 else if(mod&&k==='z'&&e.shiftKey||mod&&k==='y')Ed.redo();
 else if(mod&&k==='z')Ed.undo();
 else if(mod&&k==='b'||!mod&&k==='s')Ed.split();
 else if(mod&&k==='d')Ed.duplicate();
 else if(mod&&k==='c')Ed.copy();
 else if(mod&&k==='x')Ed.copy(true);
 else if(mod&&e.altKey&&k==='v')edPasteAttrs();
 else if(mod&&k==='v')Ed.paste();
 else if(mod&&k==='a')Ed.selectAll();
 else if(mod&&k==='g'&&e.shiftKey)Ed.ungroup();
 else if(mod&&k==='g')Ed.group();
 else if(!mod&&!e.altKey&&k==='e'&&e.shiftKey)Ed.saveFrame();
 else if(!mod&&k==='m')Ed.toggleMarker();
 else if(e.key==='?')edKeys();
 else if(k==='arrowleft')Ed.seek(Ed.time-(e.shiftKey?1:1/30));
 else if(k==='arrowright')Ed.seek(Ed.time+(e.shiftKey?1:1/30));
 else if(k==='home')Ed.seek(0);
 else if(k==='end')Ed.seek(Ed.end());
 else if(k==='escape'&&(Ed.sels.size||Ed.junction))Ed.select(null);
 else if(k==='escape'&&Ed.stack?.length)Ed.exitNest();
 else done=false;
 if(done){e.preventDefault();e.stopPropagation();}
},true);

/** A menu at the pointer: [label, icon, action, disabled, danger] rows, or '-' for a line. */
/** Replace: pick other media of the same kind from Media, or import a file for it. */
/** Paste attributes: which groups of the copied clip's settings go onto the selected clips. */
/** A marker's name, colour and note (double-click a marker on the ruler or in the list). */
/** The mixer: every track with sound, its volume (0-200%), pan (left-right), mute and solo. Changes play at once. */
/** Source monitor (Premiere/Resolve): watch a file, mark in and out (I, O), then insert or overwrite it at the playhead. */
