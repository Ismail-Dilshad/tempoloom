'use strict';
// Editor, pointer and keys: dragging on the timeline (move, trims, box select, ruler scrub), the player (move, resize, rotate, pick a colour), and every shortcut.
// Loaded after editor-ui.js (see index.html).
function edTimelineDrag(scroll,event,update,finish=()=>{}){
 const pointerId=event.pointerId;
 let pointer=event,applied=event,frame=0,lastTime=0;
 const tick=now=>{
  frame=0;
  if(!scroll.isConnected){stop(pointer);return;}
  const bounds=scroll.getBoundingClientRect(),zone=Math.min(48,scroll.clientWidth/4);
  const x=pointer.clientX-bounds.left-scroll.clientLeft;
  const pressure=x<zone?(x-zone)/zone:x>scroll.clientWidth-zone?(x-scroll.clientWidth+zone)/zone:0;
  const previous=scroll.scrollLeft;
  if(zone&&pressure&&pointer.clientY>=bounds.top&&pointer.clientY<=bounds.bottom){
   scroll.scrollLeft+=edClamp(pressure,-1,1)*Math.min(32,lastTime?now-lastTime:16)*.75;
  }
  const scrolled=scroll.scrollLeft!==previous;
  if(pointer!==applied||scrolled){applied=pointer;update(pointer);}
  lastTime=scrolled?now:0;
  if(scrolled)frame=requestAnimationFrame(tick);
 };
 const move=next=>{
  if(next.pointerId!==pointerId)return;
  pointer=next;
  if(!frame)frame=requestAnimationFrame(tick);
 };
 const stop=next=>{
  if(next.pointerId!==pointerId)return;
  cancelAnimationFrame(frame);
  window.removeEventListener('pointermove',move);
  window.removeEventListener('pointerup',stop);
  window.removeEventListener('pointercancel',stop);
  window.removeEventListener('blur',blur);
  if(scroll.isConnected){
   if(pointer!==applied)update(pointer);
   finish();
  }
 };
 const blur=()=>stop(pointer);
 window.addEventListener('pointermove',move);
 window.addEventListener('pointerup',stop);
 window.addEventListener('pointercancel',stop);
 window.addEventListener('blur',blur);
}

function edWireTimeline(){
 const sc=Ed.dom.scroll,inner=Ed.dom.inner;
 const guide=inner.querySelector('.ed-snap-guide'),readout=inner.querySelector('.ed-drag-time');
 const showTime=(event,time,label)=>{
  readout.textContent=`${label} ${edTimecode(time,Ed.fps())}`;
  readout.hidden=false;
  const bounds=sc.getBoundingClientRect();
  readout.style.left=edClamp(event.clientX-bounds.left+12,4,Math.max(4,sc.clientWidth-readout.offsetWidth-4))+sc.scrollLeft+'px';
  readout.style.top=edClamp(event.clientY-bounds.top+12,4,Math.max(4,sc.clientHeight-readout.offsetHeight-4))+sc.scrollTop+'px';
 };
 const clearFeedback=()=>{guide.hidden=true;readout.hidden=true;};
 const frameTime=time=>Ed.snap&&Ed.timelineShowsFrames()?Math.round(time*Ed.fps())/Ed.fps():time;
 // double-click a nested clip to open it
 Ed.dom.tracks.addEventListener('dblclick',e=>{const n=e.target.closest('.ed-clip'),c=n&&Ed.clip(n.dataset.cid);if(c?.nest)Ed.enterNest(c);else if(c?.title)edTitleEditor(c);});
 const timeAt=x=>Math.max(0,(x-inner.getBoundingClientRect().left)/Ed.zoom);
 const laneAt=y=>[...Ed.dom.tracks.children].find(l=>{const r=l.getBoundingClientRect();return y>=r.top&&y<r.bottom;});
 const pointerDown=e=>{
  if(Ed.exporting||e.button!==0||e.target.closest('[data-join]'))return;
  const armed=sc.edNextTrim;
  sc.edNextTrim=null;
  const grabbingHead=e.target.closest('.ed-playhead');
  if(grabbingHead||e.target.closest('.ed-ruler')){
   e.preventDefault();
   const grabOffset=grabbingHead?timeAt(e.clientX)-Ed.time:0;
   const scrollStart=sc.scrollLeft;
   let moved=false;
   if(grabbingHead&&Ed.playing)Ed.pause();
   if(!grabbingHead)Ed.seek(frameTime(timeAt(e.clientX)));
   const move=event=>{
    if(grabbingHead&&!moved&&Math.abs(event.clientX-e.clientX+sc.scrollLeft-scrollStart)<2)return;
    moved=true;
    Ed.seek(frameTime(timeAt(event.clientX)-grabOffset));
    if(!grabbingHead)Ed.scrub();
    showTime(event,Ed.time,'Playhead');
   };
   edTimelineDrag(sc,e,move,clearFeedback);
   return;
  }
  const clip=e.target.closest('.ed-clip');
  if(!clip){
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
  const chosenTrim=armed?.id===c.id?armed.tool:null;
  const proTrim=e.altKey||((e.ctrlKey||e.metaKey)&&e.target.dataset.h)||chosenTrim;
  if((e.shiftKey||e.ctrlKey||e.metaKey)&&!proTrim){Ed.select(c.id,true);Ed.solo=false;return;}
  if(!Ed.sels.has(c.id)||(e.altKey&&Ed.sels.size>1))Ed.select(c.id);else{Ed.sel=c.id;Ed.drawProps();}Ed.solo=false;
  if(e.target.dataset.fh){const key=e.target.dataset.fh==='in'?'fadeIn':'fadeOut',left=clip.getBoundingClientRect().left;let snapped=false;
   const mv=ev=>{if(!snapped){Ed.snapshot();snapped=true;}const x=(ev.clientX-left)/Ed.zoom;c[key]=Math.round(edClamp(key==='fadeIn'?x:c.dur-x,0,Math.min(5,c.dur/2))*10)/10;Ed.drawTimeline();Ed.sync();Ed.draw();};
   const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);if(snapped)Ed.after(true);};
   window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);return;}
  const mode=e.target.dataset.h||'move',x0=e.clientX,scrollStart=sc.scrollLeft,group=mode==='move'&&!chosenTrim&&Ed.sels.size>1?Ed.picked():[c],orig=new Map(group.map(g=>[g.id,{...g}])),o=orig.get(c.id),m=Ed.mediaOf(c),srcDur=c.nest?c.nest.dur:m&&m.type!=='image'&&!c.sticker?m.dur:Infinity,kind=Ed.kindOf(c);
  const ids=new Set(group.map(g=>g.id)),edges=Ed.p.clips.filter(x=>!ids.has(x.id)).flatMap(x=>[x.start,x.start+x.dur]).concat([0,Ed.time,...Ed.p.markers.map(edMt)]);
  const snapT=t=>{
   if(!Ed.snap)return {time:t,guide:null};
   let guide=null,distance=8/Ed.zoom;
   for(const edge of edges){const delta=Math.abs(edge-t);if(delta<distance){distance=delta;guide=edge;}}
   return {time:guide??frameTime(t),guide};
  };
  let moved=false,newLane=null;
  // Pro trims: Alt + edge = ripple trim; Ctrl + edge = roll; Alt + body = slip; Ctrl + Alt + body = slide.
 const pro=chosenTrim||(mode==='move'?(e.altKey&&(e.ctrlKey||e.metaKey)?'slide':e.altKey?'slip':null):e.altKey?'ripple':(e.ctrlKey||e.metaKey)?'roll':null);
  const touching=(edge,which)=>Ed.p.clips.find(x=>x.track===c.track&&x.id!==c.id&&Math.abs((which==='prev'?x.start+x.dur:x.start)-edge)<.05);
 const usesNeighbors=pro==='roll'||pro==='slide';
 const prev=usesNeighbors?touching(o.start,'prev'):null,next=usesNeighbors?touching(o.start+o.dur,'next'):null,oP=prev&&{...prev},oN=next&&{...next};
 const after=pro==='ripple'?Ed.p.clips.filter(x=>x.track===c.track&&x.id!==c.id&&x.start>=o.start+o.dur-.001).map(x=>[x,x.start]):[];
 const touched=[...group,...[prev,next].filter(Boolean),...after.map(([clip])=>clip)];
  if(chosenTrim&&((mode==='move')!==(pro==='slip'||pro==='slide'))){
   sc.edNextTrim=armed;
   toast(mode==='move'?'Drag a trim edge for this tool.':'Drag the body of the clip for this tool.');
   return;
  }
  if(pro==='roll'&&!(mode==='r'?next:prev))return toast('Roll trim needs clips touching at the cut.');
  if(pro&&kind!=='audio'&&!c.media&&!c.nest&&(pro==='slip'))return;
  const baseline=pro==='ripple'?new Map(Ed.p.clips.map(clip=>[clip,clip.start])):null;
  const mv=ev=>{
   const dx=ev.clientX-x0+sc.scrollLeft-scrollStart,dt=dx/Ed.zoom;
   if(!moved&&Math.abs(dx)<3&&Math.abs(ev.clientY-e.clientY)<3)return;
   let target,trimAt,linked;
   if(mode!=='move'&&pro!=='roll'){
    const speed=o.speed||1,end=o.start+o.dur;
    target=snapT((mode==='l'?o.start:end)+dt);
    if(mode==='l'){
     const earliest=c.media||c.nest?(o.ramp?o.start:o.start-(o.in||0)/speed):0;
     trimAt=edClamp(Math.max(target.time,earliest),0,end-.1);
    }else trimAt=Math.max(o.start+.1,Math.min(target.time,o.ramp?end:o.start+(srcDur-(o.in||0))/speed));
    if(pro==='ripple'){
     const cut=mode==='l'?o.start:end,delta=mode==='l'?cut-trimAt:trimAt-cut;
     const at=mode==='l'?cut:Math.min(cut,trimAt);
     linked=Ed.syncRipplePlan([{track:c.track,at,delta}],baseline);
     if(!linked){
      guide.hidden=true;
      showTime(ev,trimAt,'Sync Lock blocked');
      return;
     }
    }
   }
   if(!moved){Ed.snapshot();moved=true;}
   let snapped=null;
   if(pro==='slip'&&(c.media||c.nest)){const sp=o.speed||1,span=Ed.srcSpan(o),max=Math.max(0,(srcDur===Infinity?(o.in||0):srcDur-span));c.in=edClamp(frameTime((o.in||0)-dt*sp),0,max);Ed.seek(edClamp(Ed.time,c.start,c.start+c.dur-.01));}
   else if(pro==='slide'){let d=frameTime(o.start+dt)-o.start;if(oP){d=Math.max(d,-(oP.dur-.1));const mp=Ed.mediaOf(oP);if(mp&&mp.type!=='image'&&mp.dur)d=Math.min(d,(mp.dur-(oP.in||0))/(oP.speed||1)-oP.dur);}if(oN){const sn=oN.speed||1;d=Math.min(d,oN.dur-.1);d=Math.max(d,-(oN.in||0)/sn);}if(!oP)d=Math.max(d,-o.start);
    c.start=o.start+d;if(prev)prev.dur=oP.dur+d;if(next){const sn=oN.speed||1;next.start=oN.start+d;next.dur=oN.dur-d;if(next.media||next.nest)next.in=(oN.in||0)+d*sn;}}
   else if(pro==='roll'){
    const cut=mode==='r'?o.start+o.dur:o.start,d=frameTime(cut+dt)-cut;
    if(mode==='r')Ed.roll(c,next,d,o,oN);else Ed.roll(prev,c,d,oP,o);
   }
   else if(mode==='move'){
    const min=Math.min(...group.map(g=>orig.get(g.id).start));let d=Math.max(-min,dt);
    const start=o.start+d,end=start+o.dur,a=snapT(start),b=snapT(end);
    const useStart=a.guide!==null&&(b.guide===null||Math.abs(a.time-start)<=Math.abs(b.time-end));
    const target=useStart?a:b.guide!==null?b:a,edge=target===b?end:start;
    const offset=d+target.time-edge;
    d=Math.max(-min,offset);
    if(d===offset)snapped=target.guide;
    for(const g of group)g.start=orig.get(g.id).start+d;
    if(group.length===1){const lane=laneAt(ev.clientY);Ed.dom.tracks.querySelectorAll('.ed-lane-new').forEach(n=>n.classList.remove('on'));newLane=null;
     if(lane?.classList.contains('ed-lane-new')){lane.classList.add('on');newLane=lane.dataset.new;}
     else if(lane&&lane.dataset.kind===kind&&!lane.classList.contains('locked')&&lane.dataset.track!==c.track){c.track=lane.dataset.track;const node=Ed.dom.tracks.querySelector(`[data-cid="${c.id}"]`);if(node)lane.append(node);}}
   }
   else if(mode==='l'){const s=trimAt,sp=o.speed||1;if(s===target.time&&pro!=='ripple')snapped=target.guide;const d=s-o.start;c.start=s;c.dur=o.dur-d;
    if(o.ramp){c.in=Ed.srcAt(o,s);c.ramp=d>.001?edRampSplit(o.ramp,d/o.dur)[1]:o.ramp;}else if(c.media||c.nest)c.in=(o.in||0)+d*sp;
    if(c.kf)for(const f of Object.values(c.kf))for(const x of f)x.t=Math.max(0,x.t-(d-(c._kfd||0)));c._kfd=d;}
   else{c.dur=trimAt-o.start;if(Math.abs(c.start+c.dur-target.time)<1e-6)snapped=target.guide;if(o.ramp)c.ramp=c.dur<o.dur-.001?edRampSplit(o.ramp,c.dur/o.dur)[0]:o.ramp;}
   // ripple: what follows on the track moves with the trimmed edge (a trimmed start keeps the clip where it was)
   if(pro==='ripple'){if(mode==='l'){const d=c.start-o.start;c.start=o.start;for(const [x,s0] of after)x.start=Math.max(0,s0-d);}else{const d=c.dur-o.dur;for(const [x,s0] of after)x.start=Math.max(0,s0+d);}}
   if(linked)for(const [clip,start] of linked)clip.start=start;
   for(const clip of linked?new Set([...touched,...linked.keys()]):touched){const node=Ed.dom.tracks.querySelector(`[data-cid="${clip.id}"]`);if(node){node.style.left=clip.start*Ed.zoom+'px';node.style.width=clip.dur*Ed.zoom+'px';}}
   guide.hidden=snapped===null;
   if(snapped!==null)guide.style.left=snapped*Ed.zoom+'px';
   const time=pro==='slip'?(c.in||0):mode==='r'?c.start+c.dur:c.start;
   showTime(ev,time,pro==='slip'?'Source in':mode==='r'?'Out':'In');
   Ed.sync();Ed.draw();Ed.drawTime();};
  const up=()=>{clearFeedback();delete c._kfd;
   if(moved){
    if(newLane){const t=Ed.addTrack(kind,kind==='video'?undefined:newLane);c.track=t.id;}
    for(const g of group){const tr=Ed.trackOf(g);if(!tr?.main&&!Ed.fits(g.track,g.start,g.dur,ids))g.track=Ed.place(Ed.kindOf(g),g.start,g.dur,undefined,ids);}
    if(c.fadeIn>c.dur/2)c.fadeIn=c.dur/2;if(c.fadeOut>c.dur/2)c.fadeOut=c.dur/2;Ed.after(true);}};
  edTimelineDrag(sc,e,mv,up);
 };
 sc.onpointerdown=pointerDown;
 Ed.dom.head.onpointerdown=pointerDown;
}
/** Handle sizes in the player, in frame pixels (they grow with the frame, so they look the same at any size). */
const edHandleSize=W=>Math.max(8,W/90),edKnob=W=>Math.max(24,W/30);
const edBoxHandleSize=(W,b)=>Math.min(edHandleSize(W),Math.max(2,Math.min(b.w,b.h)/5));
function edPreviewHit(c,g,W,H,px,py){
 const box=Ed.box(g,c,W,H),angle=Ed.val(c,'rotate')*Math.PI/180,dx=px-box.cx,dy=py-box.cy;
 const x=dx*Math.cos(angle)+dy*Math.sin(angle),y=dy*Math.cos(angle)-dx*Math.sin(angle);
 if(box.regions?.length){const u=x+box.w/2,v=y+box.h/2;return box.regions.some(r=>u>=r.x0&&u<=r.x1&&v>=r.y0&&v<=r.y1);}
 return Math.abs(x)<=Math.max(8,box.w/2)&&Math.abs(y)<=Math.max(8,box.h/2);
}
function edVisibleHandle(box,angle,x,y,W,H){
 const cos=Math.cos(angle),sin=Math.sin(angle),pad=edHandleSize(W);
 const dx=edClamp(box.cx+x*cos-y*sin,pad,W-pad)-box.cx;
 const dy=edClamp(box.cy+x*sin+y*cos,pad,H-pad)-box.cy;
 return [dx*cos+dy*sin,-dx*sin+dy*cos];
}
/** Which handle of the selected clip is at (px, py): 'scale' (a corner) or 'rotate' (the knob above), or null. */
function edHandleAt(c,g,W,H,px,py){
 const t=Ed.time,tr=c&&Ed.trackOf(c);if(!c||c.positionLocked||tr?.locked||tr?.hidden||Ed.kindOf(c)==='audio'||c.adjustment||t<c.start||t>=c.start+c.dur)return null;
 const b=Ed.box(g,c,W,H),a=-Ed.val(c,'rotate')*Math.PI/180,dx=px-b.cx,dy=py-b.cy,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a),hs=edBoxHandleSize(W,b)*1.6;
 const distance=(x,y)=>{const [hx,hy]=edVisibleHandle(b,-a,x,y,W,H);return Math.hypot(lx-hx,ly-hy);};
 if(distance(0,-b.h/2-edKnob(W))<hs)return 'rotate';
 return [[-1,-1],[1,-1],[1,1],[-1,1]].some(([x,y])=>distance(x*b.w/2,y*b.h/2)<hs)?'scale':null;
}
function edWirePreview(){
 const cv=Ed.dom.canvas;
 // the pointer shows what a drag would do
 cv.addEventListener('pointermove',e=>{if(e.buttons||Ed.picking)return;const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),one=Ed.sel&&Ed.clip(Ed.sel);
  const g=cv.getContext('2d'),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
  const h=Ed.sels.size===1&&edHandleAt(one,g,W,H,x,y);
  const track=one&&Ed.trackOf(one),t=Ed.time;
  const movable=one&&!one.adjustment&&!one.positionLocked&&!track?.locked&&!track?.hidden&&t>=one.start&&t<one.start+one.dur&&Ed.kindOf(one)!=='audio'&&edPreviewHit(one,g,W,H,x,y);
  cv.style.cursor=h==='scale'?'nwse-resize':h==='rotate'||movable?'grab':'';});
 cv.onpointerdown=e=>{
  if(e.button!==0||Ed.exporting||cv.onpointerup)return;
  if(Ed.picking){const c=Ed.clip(Ed.picking);const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),px=Math.floor((e.clientX-r.left)*W/r.width),py=Math.floor((e.clientY-r.top)*H/r.height);
   Ed.draw();const d=cv.getContext('2d').getImageData(px,py,1,1).data,hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
   Ed.picking=null;Ed.dom.frame?.classList.remove('picking');if(c){Ed.snapshot();c.key={sim:25,smooth:10,spill:50,...(c.key||{}),on:true,color:hex};Ed.after(true);toast('Colour picked: '+hex);}return;}
  const [W,H]=Ed.size(),r=cv.getBoundingClientRect(),sx=W/r.width,sy=H/r.height,px=(e.clientX-r.left)*sx,py=(e.clientY-r.top)*sy,g=cv.getContext('2d');
  const one=Ed.sel&&Ed.clip(Ed.sel),grab=!e.altKey&&Ed.sels.size===1&&edHandleAt(one,g,W,H,px,py);
  if(grab){const b=Ed.box(g,one,W,H),cx=b.pivotX??b.cx,cy=b.pivotY??b.cy,s0=Ed.val(one,'scale'),r0=Ed.val(one,'rotate'),d0=Math.hypot(px-cx,py-cy)||1,a0=Math.atan2(py-cy,px-cx);let moved=false;cv.setPointerCapture(e.pointerId);
   cv.onpointermove=ev=>{if(ev.pointerId!==e.pointerId)return;if(!moved){Ed.snapshot();moved=true;}const qx=(ev.clientX-r.left)*sx-cx,qy=(ev.clientY-r.top)*sy-cy;
    if(grab==='scale')Ed.setVal(one,'scale',Math.round(edClamp(s0*Math.hypot(qx,qy)/d0,Math.min(.01,s0),5)*1000)/1000);
    else{let deg=r0+(Math.atan2(qy,qx)-a0)*180/Math.PI;deg=((deg+180)%360+360)%360-180;const cardinal=Math.round(deg/90)*90;
     if(ev.shiftKey)deg=Math.round(deg/15)*15;
     else if(!ev.altKey&&Math.abs(deg-cardinal)<=3)deg=cardinal;
     deg=Math.round(deg*10)/10;
     Ed.setVal(one,'rotate',deg);
     const readout=Ed.dom.root.querySelector('.ed-rotation-readout');
     readout.textContent=deg+'°';readout.hidden=false;}
    Ed.draw();};
   cv.onpointerup=cv.onpointercancel=cv.onlostpointercapture=ev=>{if(ev.pointerId!==e.pointerId)return;cv.onpointermove=cv.onpointerup=cv.onpointercancel=cv.onlostpointercapture=null;Ed.dom.root.querySelector('.ed-rotation-readout').hidden=true;if(moved){Ed.save();Ed.drawProps();Ed.drawTimeline();}};return;}
  const hits=Ed.visible(Ed.time).reverse().filter(c=>!c.adjustment&&!Ed.trackOf(c)?.locked&&edPreviewHit(c,g,W,H,px,py));
  if(!hits.length){if(Ed.sels.size)Ed.select(null);return;}
  if(e.altKey){Ed.select(hits[(hits.indexOf(one)+1)%hits.length].id);return;}
  const top=hits.find(c=>!c.positionLocked)||hits[0];
  // A click picks the front layer. A drag on the selected clip moves that clip, even under another layer.
  const target=one&&hits.includes(one)?one:top;
  const x0=Ed.val(target,'x'),y0=Ed.val(target,'y');let moved=false;cv.setPointerCapture(e.pointerId);
  cv.onpointermove=ev=>{if(ev.pointerId!==e.pointerId||target.positionLocked)return;
   const dx=ev.clientX-e.clientX,dy=ev.clientY-e.clientY;
   if(!moved){if(Math.hypot(dx,dy)<3)return;Ed.select(target.id);Ed.snapshot();moved=true;cv.style.cursor='grabbing';}
   let x=Math.round((x0+dx*sx/W)*1000)/1000,y=Math.round((y0+dy*sy/H)*1000)/1000;
   if(Math.abs(x)<.015)x=0;if(Math.abs(y)<.015)y=0;Ed.setVal(target,'x',x);Ed.setVal(target,'y',y);Ed.draw();};
  cv.onpointerup=cv.onpointercancel=cv.onlostpointercapture=ev=>{
   if(ev.pointerId!==e.pointerId)return;
   cv.onpointermove=cv.onpointerup=cv.onpointercancel=cv.onlostpointercapture=null;cv.style.cursor='';
   if(moved){Ed.save();Ed.drawProps();Ed.drawTimeline();}
   else if(ev.type==='pointerup'&&Math.hypot(ev.clientX-e.clientX,ev.clientY-e.clientY)<3&&Ed.sel!==top.id)Ed.select(top.id);
  };
 };
}
window.addEventListener('keydown',e=>{
 if(App.route!=='editor'||!Ed.p||!Ed.dom.root?.isConnected||e.isComposing||Ed.exporting||Pop.el)return;
 if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable||e.target.closest?.('[role="combobox"], [role="listbox"]')||$('#modal')?.innerHTML)return;
 if((e.key==='Home'||e.key==='End')&&e.target.closest?.('.ed-cats [role="tab"]'))return;
 if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&e.target.closest?.('.ed-ptabs [role="tab"]')&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey)return;
 if(e.key==='Escape'&&e.target.closest?.('.ed-player-menu[open]'))return;
 const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;let done=true;
 if(k===' '&&mod&&e.shiftKey)Ed.playRange();
 else if(k===' '&&!mod){
  if(e.target.closest?.('button, summary'))return;
  if(!e.repeat)Ed.play();
 }
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
 else if(mod&&k==='f')edFindTimeline(Ed.dom.root.querySelector('[data-timeline-find]'));
 else if(!mod&&!e.altKey&&!e.shiftKey&&(k==='arrowup'||k==='arrowdown')&&!e.target.closest?.('[role="tablist"],[role="menu"],summary,button'))Ed.jumpToCut(k==='arrowup'?-1:1);
 else if(k==='arrowleft')Ed.seek(Ed.time-(e.shiftKey?1:1/Ed.fps()));
 else if(k==='arrowright')Ed.seek(Ed.time+(e.shiftKey?1:1/Ed.fps()));
 else if(k==='home')Ed.seek(0);
 else if(k==='end')Ed.seek(Ed.end());
 else if(k==='escape'&&Ed.dom.scroll?.edNextTrim)Ed.dom.scroll.edNextTrim=null;
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
