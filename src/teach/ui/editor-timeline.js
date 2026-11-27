'use strict';
// Track lanes, ruler, and timeline editing controls.
const ED_H={video:52,main:60,text:40,sticker:40,audio:48};
const ED_RULER_STEPS=[1,2,5,10,15,30,60,120,300,600,900,1800,3600];
function edTimelinePanel(){
 return `<section class="ed-panel ed-tl" aria-label="Timeline">
  <header class="ed-tools">
   <h2>Timeline</h2>
   <div class="ed-timeline-tools" role="group" aria-label="History">
    <button type="button" class="iconbtn sm" data-undo aria-label="Undo" data-tooltip="Undo (Ctrl+Z)">${I.undo}</button>
    <button type="button" class="iconbtn sm" data-redo aria-label="Redo" data-tooltip="Redo (Ctrl+Shift+Z)">${I.redo}</button>
   </div>
   <div class="ed-timeline-tools" role="group" aria-label="Clip edits">
    <button type="button" class="iconbtn sm" data-split aria-label="Split" data-tooltip="Split (Ctrl+B)">${I.split}</button>
    <button type="button" class="iconbtn sm" data-dup aria-label="Duplicate" data-tooltip="Duplicate (Ctrl+D)">${I.copy}</button>
    <button type="button" class="iconbtn sm" data-combine aria-label="Combine selected clips" data-tooltip="Group clips or create a compound clip" aria-haspopup="menu" disabled>${I.layers}</button>
    <button type="button" class="iconbtn sm" data-del aria-label="Delete" data-tooltip="Delete (Del)">${I.trash}</button>
    <button type="button" class="iconbtn sm" data-ripple-delete aria-label="Ripple delete" data-tooltip="Ripple delete and close gap (Shift+Del)" disabled>${I.cut}</button>
    <button type="button" class="iconbtn sm" data-trim="start" aria-label="Delete left" data-tooltip="Delete left of the playhead (Q)">${I.trimL}</button>
    <button type="button" class="iconbtn sm" data-trim="end" aria-label="Delete right" data-tooltip="Delete right of the playhead (W)">${I.trimR}</button>
    <button type="button" class="iconbtn sm" data-freeze aria-label="Freeze frame" data-tooltip="Freeze frame (Shift+F)">${I.freeze}</button>
   </div>
   <div class="ed-timeline-tools" role="group" aria-label="Audio and markers">
    <button type="button" class="iconbtn sm" data-clip-audio aria-label="Clip audio" data-tooltip="Clip volume and mute" aria-haspopup="dialog" aria-expanded="false" disabled>${I.sound}</button>
    <button type="button" class="iconbtn sm" data-detach-tl aria-label="Detach audio" data-tooltip="Detach audio to its own track" disabled>${I.detach}</button>
    <button type="button" class="iconbtn sm" data-mixer aria-label="Mixer" data-tooltip="Mixer: volume, pan, solo per track">${I.sliders}</button>
    <button type="button" class="iconbtn sm" data-marker aria-label="Marker" data-tooltip="Marker at the playhead (M)">${I.flag}</button>
    <button type="button" class="iconbtn sm" data-voice-tl aria-label="Record voice-over" data-tooltip="Record voice-over">${I.mic}</button>
   </div>
   <div class="ed-timeline-tools ed-timeline-snap" role="group" aria-label="Snapping">
    <button type="button" class="iconbtn sm" data-magnet aria-pressed="${!!Ed.p.magnet}" aria-label="Main track magnet" data-tooltip="Main track magnet: no gaps on the main track">${I.link}</button>
    <button type="button" class="iconbtn sm" data-snap aria-pressed="${Ed.snap}" aria-label="Snap" data-tooltip="Snap to edges and markers">${I.magnet}</button>
   </div>
   <div class="ed-timeline-tools" role="group" aria-label="Timeline zoom">
    <button type="button" class="iconbtn sm" data-zoom="-1" aria-label="Zoom out">${I.zoomOut}</button>
    <input type="range" class="ed-zoom" min="10" max="300" step="any" value="${Ed.zoom}" aria-label="Zoom">
    <button type="button" class="iconbtn sm" data-zoom="1" aria-label="Zoom in">${I.zoomIn}</button>
    <button type="button" class="iconbtn sm" data-zoom-fit aria-label="Fit timeline" data-tooltip="Fit timeline">${I.expand}</button>
    <button type="button" class="iconbtn sm" data-zoom-selection aria-label="Zoom to selection" data-tooltip="Zoom to selection">${I.safe}</button>
    <button type="button" class="iconbtn sm" data-fit-tracks aria-pressed="false" aria-label="Fit tracks" data-tooltip="Fit tracks vertically">${I.layers}</button>
    <button type="button" class="iconbtn sm" data-timeline-find aria-haspopup="dialog" aria-label="Find in timeline" data-tooltip="Find in timeline (Ctrl+F)">${I.search}</button>
    <button type="button" class="iconbtn sm" data-range-tools aria-haspopup="menu" aria-label="Range and review tools" data-tooltip="Range and review tools">${I.sliders}</button>
   </div>
  </header>
  <section class="ed-review-panel" aria-label="Timeline review" hidden></section>
  <div class="ed-tl-body">
   <aside class="ed-heads-wrap" aria-label="Tracks">
    <div class="ed-heads-corner"><h3>Tracks</h3></div>
    <div class="ed-heads-viewport"><div class="ed-heads"></div></div>
   </aside>
   <section class="ed-cover-strip" aria-labelledby="ed-cover-title">
    <h3 class="ed-cover-heading" id="ed-cover-title">Cover</h3>
    <div class="ed-cover-viewport">
     <div class="ed-cover" hidden>
      <button type="button" class="ed-cover-button" data-cover aria-haspopup="menu"></button>
      <input type="file" accept="image/*" data-cover-file hidden>
     </div>
    </div>
   </section>
   <div class="ed-scroll"><div class="ed-inner"><div class="ed-ruler"></div><div class="ed-lanes"></div><div class="ed-marquee" hidden></div>
    <div class="ed-snap-guide" aria-hidden="true" hidden></div><div class="ed-drag-time" aria-hidden="true" hidden></div></div></div>
   <div class="ed-playhead" aria-hidden="true"><i></i></div>
  </div>
 </section>`;
}

function edBindTimeline(panel){
 const q=selector=>panel.querySelector(selector);
 q('[data-undo]').onclick=()=>Ed.undo();q('[data-redo]').onclick=()=>Ed.redo();q('[data-split]').onclick=()=>Ed.split();q('[data-dup]').onclick=()=>Ed.duplicate();q('[data-del]').onclick=()=>Ed.remove();
 q('[data-ripple-delete]').onclick=()=>Ed.rippleRemove();
 q('[data-detach-tl]').onclick=()=>{const clip=Ed.clip(Ed.sel);if(clip)Ed.detach(clip);};
 q('[data-clip-audio]').onclick=e=>{
  const clip=Ed.clip(Ed.sel),id=clip?.id;
  if(!clip)return;
  const edit=callback=>{
   if(Ed.sel!==id||Ed.clip(id)!==clip||Ed.trackOf(clip)?.locked){Pop.close();return;}
   Ed.snapshot();callback();Ed.after(true);
  };
  edAudioPopover(e.currentTarget,{label:'Clip audio',max:200,volume:()=>Ed.val(clip,'volume'),muted:()=>!!clip.muted,target:'clip',
   setVolume:value=>{if(Math.round(Ed.val(clip,'volume')*100)!==Math.round(value*100))edit(()=>Ed.setVal(clip,'volume',value));},
   toggleMute:()=>edit(()=>{if(clip.muted)delete clip.muted;else clip.muted=true;})});
 };
 panel.querySelectorAll('[data-trim]').forEach(b=>b.onclick=()=>Ed.trimTo(b.dataset.trim));q('[data-freeze]').onclick=()=>Ed.freeze();
 q('[data-marker]').onclick=()=>Ed.toggleMarker();q('[data-mixer]').onclick=()=>edMixer();q('[data-voice-tl]').onclick=()=>{Ed.tab='audio';Ed.recordVoice();};
 q('[data-snap]').onclick=e=>{Ed.snap=!Ed.snap;e.currentTarget.setAttribute('aria-pressed',String(Ed.snap));};
 q('[data-magnet]').onclick=()=>{Ed.snapshot();Ed.p.magnet=!Ed.p.magnet;Ed.after(false);toast(Ed.p.magnet?'Main track magnet on: no gaps':'Main track magnet off');};
 q('[data-combine]').onclick=e=>{
  const selected=Ed.picked(),nested=selected.length===1&&selected[0].nest;
  const items=nested?[['open','Open compound clip'],['break','Break apart']]:[['nest','Create compound clip']];
  if(selected.length>1)items.unshift(['group','Group clips']);
  if(selected.some(clip=>clip.group))items.push(['ungroup','Ungroup']);
  const pop=Pop.open(e.currentTarget,items.map(([action,label])=>`<button type="button" class="pop-item" data-combine-action="${action}">${label}</button>`).join(''),{label:'Combine selected clips'});
  const actions={open:()=>Ed.enterNest(selected[0]),break:()=>Ed.unnest(selected[0]),group:()=>Ed.group(),nest:()=>Ed.nest(),ungroup:()=>Ed.ungroup()};
  pop?.querySelectorAll('[data-combine-action]').forEach(button=>button.onclick=()=>{
   Pop.close();
   if(selected.some(clip=>Ed.clip(clip.id)!==clip||Ed.trackOf(clip)?.locked))return;
   actions[button.dataset.combineAction]();
  });
 };
 const zoom=q('.ed-zoom'),sc=Ed.dom.scroll;
 const setZoom=value=>{
  const center=(sc.scrollLeft+sc.clientWidth/2)/Ed.zoom;
  Ed.zoom=edClamp(value,Number(zoom.min),Number(zoom.max));
  Ed.drawTimeline();
  sc.scrollLeft=center*Ed.zoom-sc.clientWidth/2;
 };
 zoom.oninput=()=>setZoom(Number(zoom.value));
 panel.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>setZoom(Ed.zoom*(b.dataset.zoom>0?1.25:.8)));
 q('[data-zoom-fit]').onclick=()=>{Ed.zoom=Ed.timelineFitZoom();Ed.drawTimeline();sc.scrollLeft=0;};
 q('[data-zoom-selection]').onclick=()=>Ed.zoomToSelection();
 const fitTracks=q('[data-fit-tracks]');
 fitTracks.onclick=()=>{sc.edFitTracks=!sc.edFitTracks;Ed.drawTimeline();if(sc.edFitTracks)sc.scrollTop=0;};
 q('[data-timeline-find]').onclick=e=>edFindTimeline(e.currentTarget);
 q('[data-range-tools]').onclick=e=>{
  const range=Ed.rangeSpan();
  const pop=Pop.open(e.currentTarget,`<button type="button" class="pop-item" data-range-edit ${range?'':'disabled'}>Edit marked range</button>
    <button type="button" class="pop-item" data-range-note ${range?'':'disabled'}>Add range note</button>
    <button type="button" class="pop-item" data-notes>Range notes</button>
    <button type="button" class="pop-item" data-check>Check timeline</button>`,{label:'Range and review tools',align:'end'});
  const actions={'range-edit':()=>edSilenceDialog(range),'range-note':()=>edRangeNote(range),notes:()=>edRangeNotes(),check:()=>edTimelineCheck(range)};
  for(const [name,action] of Object.entries(actions)){
   const button=pop?.querySelector(`[data-${name}]`);
   if(button)button.onclick=()=>{Pop.close();action();};
  }
 };
 sc.onwheel=e=>{if(e.ctrlKey){e.preventDefault();setZoom(Ed.zoom*(e.deltaY<0?1.15:.87));}};
 Ed.dom.scroll.addEventListener('contextmenu',e=>{e.preventDefault();const n=e.target.closest('.ed-clip');
  if(n){const c=Ed.clip(n.dataset.cid);if(!c)return;if(!Ed.sels.has(c.id))Ed.select(c.id);if(e.target.dataset.h)edTrimToolMenu(e.clientX,e.clientY,c,e.target.dataset.h);else edClipMenu(e.clientX,e.clientY,c);}
  else{const r=Ed.dom.inner.getBoundingClientRect(),at=Math.max(0,(e.clientX-r.left)/Ed.zoom),lane=e.target.closest('.ed-lane[data-track]'),gap=lane&&Ed.gapAt(lane.dataset.track,at);Ed.seek(at);
   edMenu(e.clientX,e.clientY,[...(gap?[['Delete gap','trash',()=>Ed.closeGap(lane.dataset.track,at)],'-']:[]),[`Paste${Ed.clipboard?.length?` (${Ed.clipboard.length})`:''}`,'copy',()=>Ed.paste(),!Ed.clipboard?.length],['Add a marker','flag',()=>Ed.toggleMarker()],
    ['Previous cut','trimL',()=>Ed.jumpToCut(-1),false,false,'Up'],['Next cut','trimR',()=>Ed.jumpToCut(1),false,false,'Down'],
    '-',['Mark in','trimL',()=>Ed.setRange('in'),false,false,'I'],['Mark out','trimR',()=>Ed.setRange('out'),false,false,'O'],['Clear in and out','x',()=>Ed.clearRange(),!Ed.p.range,false,'Alt+X'],'-',['Select all','layers',()=>Ed.selectAll()]]);}});
 Ed.dom.scroll.addEventListener('scroll',()=>{
  const transform=`translateY(${-Ed.dom.scroll.scrollTop}px)`;
  Ed.dom.heads.style.transform=transform;
  Ed.dom.cover.style.transform=transform;
  Ed.positionTimelineHead();
 });
 edWireTimeline();
 edBindCover(panel);
}

function edFindTimeline(anchor){
 const pop=Pop.open(anchor,`<div class="ed-timeline-search">
  <input type="search" aria-label="Clip name" placeholder="Find clips…" autocomplete="off">
  <div class="ed-timeline-results"></div>
 </div>`,{role:'dialog',label:'Find in timeline',align:'end',focus:false});
 if(!pop)return;
 const input=pop.querySelector('input'),list=pop.querySelector('.ed-timeline-results');
 let results=[],index=-1;
 const locate=position=>{
  const match=results[position],clip=match&&Ed.clip(match.id);
  if(!clip)return;
  if(Ed.playing)Ed.pause();
  index=position;
  Ed.select(clip.id);Ed.seek(clip.start);Ed.revealTimeline(clip.start,clip.track);
  [...list.querySelectorAll('button')].forEach((button,i)=>button.setAttribute('aria-current',i===index?'true':'false'));
  list.children[index]?.scrollIntoView({block:'nearest'});
 };
 const render=()=>{
  const query=input.value.trim().toLocaleLowerCase();
  results=query?Ed.p.clips.map(clip=>({id:clip.id,time:clip.start,name:Ed.timelineClipName(clip),track:Ed.trackOf(clip)?.name||''}))
   .filter(result=>result.name.toLocaleLowerCase().includes(query)).sort((a,b)=>a.time-b.time):[];
  index=-1;
  list.innerHTML=results.length?results.map((result,i)=>`<button type="button" class="pop-item" data-result="${i}">
   <span dir="auto">${esc(result.name)}<small>${esc(result.track)}</small></span><time>${edTimecode(result.time,Ed.fps())}</time></button>`).join(''):
   query?'<div class="pop-empty">No matching clips</div>':'';
 };
 input.oninput=render;
 input.onkeydown=event=>{
  if(!['Enter','ArrowDown','ArrowUp'].includes(event.key)||!results.length)return;
  event.preventDefault();event.stopPropagation();
  const direction=event.key==='ArrowUp'||event.shiftKey?-1:1;
  locate(index<0?(direction>0?0:results.length-1):(index+direction+results.length)%results.length);
 };
 list.onclick=event=>{const button=event.target.closest('[data-result]');if(button)locate(Number(button.dataset.result));};
 input.focus();
}

function edBindCover(panel){
 const button=panel.querySelector('[data-cover]'),fileInput=panel.querySelector('[data-cover-file]');
 const id=Ed.root().id,current=()=>Ed.list().find(entry=>entry.id===id);
 const active=()=>panel.isConnected&&Ed.root()?.id===id;
 const refresh=()=>{
  const image=edCoverData(current()?.coverImage),label=image?'Edit cover':'Add cover';
  button.setAttribute('aria-label',label);button.title=label;
  button.innerHTML=image?`<img src="${image}" alt="" draggable="false">`:`${I.image}<span>Cover</span>`;
 };
 const change=async makeImage=>{
  if(button.disabled)return;
  button.disabled=true;
  try{
   const image=await makeImage();
   if(image===null||!active()||!current())return;
   const saved=Ed.setList(Ed.list().map(entry=>entry.id===id?{...entry,coverImage:image}:entry));
   refresh();
   if(await saved&&active())toast(image?'Cover saved':'Cover removed');
  }catch(e){if(active())toast(e.message,true);}
  finally{button.disabled=false;}
 };
 button.onclick=()=>{
  const image=edCoverData(current()?.coverImage),canCapture=Ed.p.clips.length&&!Ed.stack?.length&&!Ed.exporting;
  const pop=Pop.open(button,`<button type="button" class="pop-item" data-cover-frame ${canCapture?'':'disabled'}>${I.film}<span>Use current frame</span></button>
   <button type="button" class="pop-item" data-cover-upload>${I.upload}<span>Upload image</span></button>
   ${image?`<hr><button type="button" class="pop-item" data-cover-download>${I.down}<span>Download cover</span></button>
    <button type="button" class="pop-item danger" data-cover-remove>${I.trash}<span>Remove cover</span></button>`:''}`,{label:'Video cover'});
  if(!pop)return;
  pop.querySelector('[data-cover-frame]').onclick=()=>{Pop.close(true);change(async()=>{
   const project=Ed.p,end=Ed.end(),time=Ed.time>=end?Math.max(0,end-1/Ed.fps()):Ed.time;
   Ed.pause();
   await Ed.exportReady();
   if(!active()||Ed.p!==project||Ed.exporting)return null;
   try{
    await Ed.seekExact(time);
    if(!active()||Ed.p!==project||Ed.exporting)return null;
    Ed.draw(false,time);
    const canvas=Ed.dom.canvas;
    return edCoverImage(canvas,canvas.width,canvas.height);
   }finally{if(active()&&Ed.p===project&&!Ed.exporting){Ed.sync();Ed.draw();}}
  });};
  pop.querySelector('[data-cover-upload]').onclick=()=>{Pop.close(true);fileInput.click();};
  if(image){
   pop.querySelector('[data-cover-download]').onclick=()=>{
    Pop.close(true);
    const bytes=Uint8Array.from(atob(image.split(',')[1]),char=>char.charCodeAt(0));
    edSaveFile(new Blob([bytes],{type:'image/jpeg'}),`${Ed.root().name} - cover.jpg`);
   };
   pop.querySelector('[data-cover-remove]').onclick=()=>{Pop.close(true);change(()=>undefined);};
  }
 };
 fileInput.onchange=()=>{
  const file=fileInput.files[0];fileInput.value='';if(!file)return;
  change(async()=>{
   const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('Could not open this cover image. Try a JPG, PNG, or WebP.');});
   try{return edCoverImage(bitmap,bitmap.width,bitmap.height);}finally{bitmap.close();}
  });
 };
 refresh();
}

function edCoverImage(source,width,height){
 const scale=Math.min(1,960/Math.max(width,height)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0,canvas.width,canvas.height);
 const image=edCoverData(canvas.toDataURL('image/jpeg',.86));
 if(!image)throw new Error('Could not create the cover image.');
 return image;
}

Object.assign(Ed,{
 positionTimelineHead(){
  const {head,scroll,inner}=this.dom;
  if(!head||!scroll||!inner)return;
  const left=inner.getBoundingClientRect().left+this.time*this.zoom;
  const x=left-scroll.getBoundingClientRect().left-scroll.clientLeft;
  head.hidden=x<0||x>scroll.clientWidth;
  if(head.hidden)return;
  head.style.transform=`translateX(${left-head.parentElement.getBoundingClientRect().left}px)`;
  head.style.bottom=`${scroll.offsetHeight-scroll.clientHeight}px`;
 },
 drawHead(){
  const sc=this.dom.scroll,x=this.time*this.zoom;
  if(this.playing&&sc&&x>sc.scrollLeft+sc.clientWidth-80)sc.scrollLeft=x-80;
  this.positionTimelineHead();
 },
 timelineFitZoom(){const end=this.end();return end?Math.min(300,Math.max(1,this.dom.scroll.clientWidth-16)/end):40;},
 revealTimeline(time,track){
  const sc=this.dom.scroll,x=time*this.zoom;
  if(x<sc.scrollLeft||x>sc.scrollLeft+sc.clientWidth-24)sc.scrollLeft=x-sc.clientWidth/2;
  const lane=[...this.dom.tracks.children].find(el=>el.dataset.track===track);
  if(!lane)return;
  const bounds=lane.getBoundingClientRect(),viewport=sc.getBoundingClientRect(),ruler=this.dom.ruler.offsetHeight;
  if(bounds.top<viewport.top+ruler)sc.scrollTop+=bounds.top-viewport.top-ruler;
  else if(bounds.bottom>viewport.bottom)sc.scrollTop+=bounds.bottom-viewport.bottom;
 },
 zoomToSelection(){
  const clips=this.picked();
  if(!clips.length)return;
  const start=Math.min(...clips.map(c=>c.start)),end=Math.max(...clips.map(c=>c.start+c.dur)),sc=this.dom.scroll;
  const width=Math.max(1,sc.clientWidth-32);
  this.zoom=Math.min(300,width/Math.max(.001,end-start));
  this.drawTimeline();
  sc.scrollLeft=Math.max(0,(start+end)*this.zoom/2-sc.clientWidth/2);
  const selected=this.clip(this.sel)||clips[0];
  const left=sc.scrollLeft;
  this.revealTimeline((start+end)/2,selected.track);
  sc.scrollLeft=left;
 },
 jumpToCut(direction){
  const track=this.clip(this.sel)?.track||this.main()?.id;
  const clips=this.p.clips.filter(c=>c.track===track),edges=clips.flatMap(c=>[c.start,c.start+c.dur]);
  const next=edges.filter(t=>(t-this.time)*direction>1e-5).sort((a,b)=>(a-b)*direction)[0];
  if(next===undefined)return;
  if(this.playing)this.pause();
  this.seek(next);this.revealTimeline(next,track);
 },
 timelineShowsFrames(){return this.zoom>=this.fps()*5;},
 timelineClipName(clip){
  if(clip.adjustment)return clip.adjustmentName||'Adjustment layer';
  if(clip.text!==undefined)return clip.text||'Text';
  if(clip.title)return clip.title.name||'Title';
  if(clip.nest)return clip.nest.name||'Nested clip';
  if(clip.sticker){const sticker=clip.sticker;
   if(sticker.type==='mesh')return sticker.name||'3D model';
   return (sticker.type==='shape'?ED_SHAPES.find(([id])=>id===(sticker.shape??sticker.id))?.[1]:ED_GRAPHICS[sticker.id]?.[0]||sticker.emoji)||'Sticker';
  }
  return this.mediaOf(clip)?.name||'Clip';
 },
 laneH(t){return this.dom.scroll?.edTrackHeights?.get(t.id)??(t.h||(t.main?ED_H.main:!this.p.clips.length?32:ED_H[t.kind]||44));},
 drawTimeline(){
  const el=this.dom.tracks;if(!el)return;const z=this.zoom,len=Math.max(this.end()+10,(this.dom.scroll?.clientWidth||900)/z);
  this.dom.inner.style.width=len*z+'px';
  const slider=this.dom.root.querySelector('.ed-zoom');
  slider.min=Math.min(10,z,this.timelineFitZoom());
  slider.value=z;
  Controls.syncValue(slider);
  const preferred=84/z;
  const step=ED_RULER_STEPS.find(value=>value>=preferred)??Math.ceil(preferred/3600)*3600;
  const fps=this.fps(),frames=this.timelineShowsFrames();
  this.dom.ruler.toggleAttribute('data-frames',frames);
  this.dom.ruler.style.setProperty('--ed-tick',(frames?z/fps:step*z/5)+'px');
   this.dom.ruler.innerHTML=Array.from({length:Math.floor(len/step)+1},(_,i)=>`<span style="left:${i*step*z}px">${edTimecode(i*step,fps).slice(0,frames?11:8)}</span>`).join('')+
   (this.p.rangeNotes||[]).map((note,index)=>`<button type="button" class="ed-range-note" data-note="${index}" style="left:${note.s*z}px;width:${Math.max(4,(note.e-note.s)*z)}px" title="${esc(note.text)}" aria-label="${esc('Range note: '+note.text)}"></button>`).join('')+
   this.p.markers.map((m,i)=>`<i class="ed-marker${m.name?' named':''}" data-mk="${i}" style="left:${edMt(m)*z}px;${m.color?`--mc:${edLabel(m.color)}`:''}" title="${esc(m.name||'Marker')} · ${edFmt(edMt(m))}${m.note?'\n'+esc(m.note):''} (double-click to edit)">${m.name?`<span>${esc(m.name)}</span>`:''}</i>`).join('')+
   (()=>{const r=this.p.range;if(!r||(r.in==null&&r.out==null))return '';const a=r.in??0,b=r.out??Math.max(this.end(),a);
    return `<i class="ed-range" style="left:${a*z}px;width:${Math.max(2,(b-a)*z)}px" title="In ${edFmt(a)} · Out ${edFmt(b)}">${r.in!=null?'<b class="ed-rmark ed-rmark-in"></b>':''}${r.out!=null?'<b class="ed-rmark ed-rmark-out"></b>':''}</i>`;})();
  const clipsByTrack=new Map();
  for(const clip of this.p.clips){if(!clipsByTrack.has(clip.track))clipsByTrack.set(clip.track,[]);clipsByTrack.get(clip.track).push(clip);}
  const tr=this.p.tracks.filter(track=>track.main||clipsByTrack.has(track.id)||track.name||track.color||track.syncLock||track.locked||track.muted||track.hidden);
  const sc=this.dom.scroll;
  const lanesStyle=getComputedStyle(el),lead=parseFloat(lanesStyle.getPropertyValue('--ed-track-lead'))||0;
  const gap=parseFloat(lanesStyle.rowGap)||0;
  const bottomDrop=el.querySelector('[data-new=bottom]')?.offsetHeight??10;
  const room=sc.clientHeight-this.dom.ruler.offsetHeight;
  const gutters=lead+bottomDrop+gap*(tr.length+1)+(parseFloat(lanesStyle.paddingBottom)||0);
  sc.edTrackHeights=null;
  if(sc.edFitTracks&&tr.length){
   const total=tr.reduce((sum,t)=>sum+this.laneH(t)-32,0);
   const scale=total?edClamp((room-gutters-32*tr.length)/total,0,1):0;
   sc.edTrackHeights=new Map(tr.map(t=>[t.id,32+Math.floor((this.laneH(t)-32)*scale)]));
  }
  const mainIndex=tr.findIndex(track=>track.main);
  const trackSpace=tr.reduce((height,track)=>height+this.laneH(track),gutters);
  const mainCenter=mainIndex<0?room/2:tr.slice(0,mainIndex).reduce((height,track)=>height+this.laneH(track)+gap,lead+gap)+this.laneH(tr[mainIndex])/2;
  const centerOffset=edClamp(room/2-mainCenter,0,Math.max(0,room-trackSpace));
  sc.closest('.ed-tl-body').style.setProperty('--ed-track-center-offset',centerOffset+'px');
  this.dom.root.querySelector('[data-fit-tracks]').setAttribute('aria-pressed',String(!!sc.edFitTracks));
  this.dom.root.querySelector('[data-zoom-selection]').disabled=!this.sels.size;
  const selected=this.picked();
  const primary=this.clip(this.sel),primaryMedia=primary&&this.mediaOf(primary),canEdit=primary&&!this.trackOf(primary)?.locked;
  const clipAudio=this.dom.root.querySelector('[data-clip-audio]');
  clipAudio.disabled=!(canEdit&&(primary.nest||((primaryMedia?.type==='video'||primaryMedia?.type==='audio')&&(!primary.detached||primary.asAudio))));
  const audioIcon=primary?.muted?I.mute:I.sound;if(clipAudio.innerHTML!==audioIcon)clipAudio.innerHTML=audioIcon;
  this.dom.root.querySelector('[data-detach-tl]').disabled=!(canEdit&&selected.length===1&&primaryMedia?.type==='video'&&!primary.asAudio&&!primary.detached);
  this.dom.root.querySelector('[data-ripple-delete]').disabled=!selected.some(clip=>!this.trackOf(clip)?.locked);
  this.dom.root.querySelector('[data-combine]').disabled=!selected.length||selected.some(clip=>this.trackOf(clip)?.locked);
  el.innerHTML=`<div class="ed-lane-new" data-new="top"></div>${tr.map(t=>{const cl=(clipsByTrack.get(t.id)||[]).sort((a,b)=>a.start-b.start);
   const joins=t.kind==='video'||t.kind==='audio'?cl.slice(1).filter((c,i)=>Math.abs(cl[i].start+cl[i].dur-c.start)<.05).map(c=>`<button type="button" class="ed-join${c.trans?' on':''}${this.junction===c.id?' sel':''}" data-join="${c.id}" style="left:${c.start*z}px" aria-label="Transition" title="${c.trans?[...ED_TRANS,...ED_ATRANS].find(x=>x[0]===c.trans.type)?.[1]||'Transition':t.kind==='audio'?'Add a crossfade':'Add a transition'}">${c.trans?I.trans:''}</button>`).join(''):'';
   return `<div class="ed-lane${t.main?' main':''}${t.locked?' locked':''}${t.hidden?' hidden':''}" data-track="${t.id}" data-kind="${t.kind}" style="height:${this.laneH(t)}px">${cl.map(c=>this.clipHtml(c)).join('')}${joins}${t.main&&!this.p.clips.length?`<span class="ed-lane-hint">${I.film} Drag media here and start creating</span>`:''}</div>`;}).join('')}<div class="ed-lane-new" data-new="bottom"></div>`;
  this.dom.heads.innerHTML=`<div class="ed-head-gap"></div>${tr.map(t=>{const vis=t.kind!=='audio',snd=t.kind==='video'||t.kind==='audio';
   return `<div class="ed-head${t.main?' main':''}" style="height:${this.laneH(t)}px" data-track="${t.id}"><i class="ed-head-rz" data-hrz title="Drag to resize"></i>${t.color?`<i class="ed-head-color" style="background:${edLabel(t.color)}"></i>`:''}<span class="ed-head-name" title="Double-click to rename">${I[ED_KINDS[t.kind].icon]}<span class="ed-track-label" dir="auto">${t.name?esc(t.name):t.main?'Main':ED_KINDS[t.kind].label}</span></span>
    <span class="ed-head-tools"><button type="button" data-tk="locked" aria-pressed="${!!t.locked}" aria-label="${t.locked?'Unlock':'Lock'} track">${t.locked?I.lock:I.unlock}</button>
    ${vis?`<button type="button" data-tk="hidden" aria-pressed="${!!t.hidden}" aria-label="${t.hidden?'Show':'Hide'} track">${t.hidden?I.eyeOff:I.eye}</button>`:''}
    ${snd?`<button type="button" data-tk="muted" aria-pressed="${!!t.muted}" aria-label="${t.muted?'Unmute':'Mute'} track">${t.muted?I.mute:I.sound}</button>`:''}
    <button type="button" data-tk="syncLock" aria-pressed="${!!t.syncLock}" aria-label="Sync Lock for ${esc(t.name||ED_KINDS[t.kind]?.label||'track')}" title="Sync Lock: move this track with ripple edits" ${t.locked?'disabled':''}>${I.link}</button>
    ${t.main?'':`<button type="button" data-tk="remove" aria-label="Delete track">${I.x}</button>`}</span></div>`;}).join('')}<div class="ed-head-gap"></div>`;
  const mainHead=this.dom.heads.querySelector('.ed-head.main'),cover=this.dom.cover;
  cover.hidden=!mainHead;
  if(mainHead){cover.style.top=mainHead.offsetTop+'px';cover.style.height=mainHead.offsetHeight+'px';}
  this.dom.heads.querySelectorAll('.ed-head').forEach(h=>{const id=h.dataset.track,t=this.p.tracks.find(x=>x.id===id);if(!t)return;
   h.querySelector('.ed-head-name').ondblclick=()=>{const n=prompt('Track name',t.name||'');if(n===null)return;this.snapshot();this.setTrackProp(id,{name:n.trim().slice(0,30)||undefined});this.drawTimeline();};
   h.oncontextmenu=e=>{e.preventDefault();edMenu(e.clientX,e.clientY,[['Rename…','text',()=>h.querySelector('.ed-head-name').ondblclick()],...ED_LABELS.map(([v,l])=>[`<i class="ed-swatch" style="background:${edLabel(v)}"></i>${l}`,'',()=>{this.snapshot();this.setTrackProp(id,{color:v});this.drawTimeline();}]),['No colour','x',()=>{this.snapshot();this.setTrackProp(id,{color:undefined});this.drawTimeline();},!t.color],'-',['Mixer…','sound',()=>edMixer()]]);};
   const rz=h.querySelector('[data-hrz]');rz.onpointerdown=e=>{e.preventDefault();e.stopPropagation();
    if(sc.edFitTracks){sc.edFitTracks=false;this.drawTimeline();}
    const y0=e.clientY,h0=this.laneH(t);this.snapshot();
    const mv=ev=>{t.h=Math.round(edClamp(h0+ev.clientY-y0,32,180));this.drawTimeline();},up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);this.save();};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);};});
  this.dom.ruler.querySelectorAll('[data-mk]').forEach(n=>{n.onpointerdown=e=>e.stopPropagation();n.onclick=()=>this.seek(edMt(this.p.markers[Number(n.dataset.mk)]));n.ondblclick=e=>edMarkerEdit(e.currentTarget,Number(n.dataset.mk));});
  this.dom.ruler.querySelectorAll('[data-note]').forEach(button=>{
   button.onpointerdown=e=>e.stopPropagation();
   button.onclick=()=>edRangeNote(this.p.rangeNotes[Number(button.dataset.note)],Number(button.dataset.note));
  });
  this.dom.heads.querySelectorAll('[data-tk]').forEach(b=>b.onclick=()=>{const id=b.closest('[data-track]').dataset.track;b.dataset.tk==='remove'?this.removeTrack(id):this.setTrack(id,b.dataset.tk);});
  el.querySelectorAll('[data-join]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.selectJoin(b.dataset.join);});
  const mg=this.dom.root?.querySelector('[data-magnet]');if(mg)mg.setAttribute('aria-pressed',String(!!this.p.magnet));this.drawCrumb?.();
  this.dom.inner.querySelector('.ed-review-marks')?.edRefresh?.();
  this.drawHead();
 },
 clipHtml(c){
  const m=this.mediaOf(c),w=c.dur*this.zoom,sel=this.sels.has(c.id),kind=this.kindOf(c);
  const linked=c.group?`<b class="ed-linked" title="Grouped">${I.link}</b>`:'';
  const label=(name,icon='')=>`<span class="ed-clip-label" title="${esc(name)}${c.muted?' (audio muted)':''}${c.positionLocked?' (position locked)':''}">${linked}${c.positionLocked?I.lock:''}${c.muted?I.mute:icon}<span class="ed-clip-name" dir="auto">${esc(name)}</span></span>`;
  const speed=c.speed&&c.speed!==1?` · ${c.speed}x`:'';
  let inner='';
  if(c.adjustment)inner=label(this.timelineClipName(c),I.layers);
  else if(c.text!==undefined)inner=`${c.words?.some(w=>w.alt)?`<b class="ed-tocheck" title="Words to check">${I.flag}</b>`:''}${label(c.text||'Text',I.text)}`;
  else if(c.title)inner=label(c.title.name||'Title',I.text);
  else if(c.sticker)inner=label(this.timelineClipName(c),I.shapes);
  else if(kind==='audio'){const pk=m?.peaks||[],from=(c.in||0)/(m?.dur||1),to=((c.in||0)+c.dur*(c.speed||1))/(m?.dur||1),part=pk.slice(Math.floor(from*pk.length),Math.ceil(to*pk.length)),v=edClamp(c.volume??1,0,2);
   inner=`<svg class="ed-wave" viewBox="0 0 ${Math.max(1,part.length)} 100" preserveAspectRatio="none">${part.map((x,i)=>`<rect x="${i}" y="${50-x*46*Math.min(1,v)}" width=".6" height="${Math.max(2,x*92*Math.min(1,v))}"/>`).join('')}</svg>
    <i class="ed-vol" style="top:${16+(1-v/2)*(this.laneH(this.trackOf(c)||{kind:'audio'})-20)}px" title="Volume ${Math.round(v*100)}%"></i>${label((m?.name||'')+speed,I.music)}`;}
  else if(c.nest){const count=c.nest.multi?`${c.nest.tracks.filter(t=>t.kind==='video').length} angles`:`${c.nest.clips.length} clip${c.nest.clips.length===1?'':'s'}`;
   inner=`${label((c.nest.name||'Nested')+' · '+count,I.layers)}${c.nest.multi?(c.nest.cuts||[]).map(k=>{const x=(k.t-(c.in||0))*this.zoom;return x>0&&x<w?`<i class="ed-cut" style="left:${x}px" title="Angle ${k.a+1}"></i>`:'';}).join(''):''}`;}
  else if(m){
   const peaks=m.type==='video'&&!c.detached?m.peaks:null;
   if(m.type==='video'&&!c.detached&&peaks==null)this.loadVideoPeaks(m);
   const bars=peaks?.some(Boolean)?Array.from({length:Math.max(1,Math.min(160,Math.ceil(w/3)))},(_,i)=>i):[];
   const wave=bars.map(i=>{const t=c.start+c.dur*(i+.5)/bars.length,source=this.srcAt(c,t),peak=peaks[Math.min(peaks.length-1,Math.floor(source/(m.dur||1)*peaks.length))]||0;
    return peak?`<rect x="${i}" y="${50-peak*50}" width=".7" height="${peak*100}"/>`:'';}).join('');
   const th=m.thumbs||[],n=Math.max(1,Math.ceil(w/56));inner=`<div class="ed-strip">${Array.from({length:n},(_,i)=>{const src=th.length?th[Math.min(th.length-1,Math.floor(((c.in||0)+(i+.5)/n*c.dur*(c.speed||1))/(m.dur||c.dur)*th.length))]:'';return src?`<img src="${src}" alt="" style="filter:${edCssFilter(c.adj||{})}">`:'<i></i>';}).join('')}</div>${wave?`<svg class="ed-video-wave" viewBox="0 0 ${bars.length} 100" preserveAspectRatio="none" aria-hidden="true">${wave}</svg>`:''}
   ${label(m.name+speed,c.detached?I.mute:'')}`;}
  const kts=sel&&c.kf?[...new Set(Object.values(c.kf).flat().filter(x=>x.t>=0&&x.t<=c.dur).map(x=>Math.round(x.t*100)/100))]:[];
  const fi=(c.fadeIn||0)*this.zoom,fo=(c.fadeOut||0)*this.zoom,fades=c.media&&w>40?`${fi?`<i class="ed-fz l" style="width:${fi}px"></i>`:''}${fo?`<i class="ed-fz r" style="width:${fo}px"></i>`:''}<i class="ed-fh" data-fh="in" style="left:${Math.max(10,fi)}px" title="Fade in ${(c.fadeIn||0).toFixed(1)} s: drag"></i><i class="ed-fh" data-fh="out" style="left:${Math.min(w-10,w-fo)}px" title="Fade out ${(c.fadeOut||0).toFixed(1)} s: drag"></i>`:'';
  return `<div class="ed-clip ${kind}${c.nest?' nest':''}${sel?' sel':''}${c.label?' labelled':''}" data-cid="${c.id}" style="left:${c.start*this.zoom}px;width:${w}px;${c.label?`--lc:${edLabel(c.label)}`:''}">${inner}${fades}${kts.map(t=>`<i class="ed-kf" style="left:${t*this.zoom}px"></i>`).join('')}<i class="ed-h l" data-h="l"></i><i class="ed-h r" data-h="r"></i></div>`;
 },
});
