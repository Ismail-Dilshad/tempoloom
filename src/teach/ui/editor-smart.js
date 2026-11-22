'use strict';
// Editor, smart tools: stabilise, remove background, reframe, clean voice, beats, reverse, motion tracking (jobs on this computer), proxies, source-monitor edits.
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 // ---------- smart tools: stabilise, remove background, auto reframe (jobs on this computer) ----------
 toolJobs:{},
 async runTool(c,kind,o={}){const m=o.media||this.mediaOf(c);if(!m||this.toolJobs[c.id])return;
  const label={stabilize:'Stabilising',cutout:'Removing the background',reframe:'Finding the face',voice:'Cleaning the voice',beats:'Finding the beats',reverse:'Reversing',track:'Following the motion'}[kind];
  if(kind==='cutout'&&m.type==='video'){const frames=Math.round((m.dur||c.dur)*30),min=Math.ceil(frames*6.5/60);
   if(!await ask('Remove the background of this video?',`It works frame by frame on this computer's processor: about ${min} minute${min>1?'s':''} for ${frames} frames. Photos take a few seconds.`,'Start'))return;}
  const blob=await this.get(m.id);if(!blob)return toast('The file is not in this browser any more.',true);
  this.toolJobs[c.id]={kind,label,progress:null,note:''};this.drawProps();
  try{const r=await fetch(withKey(`/api/editor/tool?kind=${kind}&name=${encodeURIComponent(m.name)}${kind==='reframe'?'&aspect='+encodeURIComponent(this.p.ratio):''}${o.query?'&'+new URLSearchParams(o.query):''}`),{method:'POST',body:blob});
   let st=await r.json().catch(()=>({}));if(!r.ok)throw new Error(st.error||'Could not start');
   while(st.state==='running'){await new Promise(res=>setTimeout(res,1500));const q=await fetch(withKey('/api/editor/tool/'+st.id));st=await q.json();this.toolJobs[c.id]={...this.toolJobs[c.id],progress:st.progress,note:st.note||''};if(this.sel===c.id)this.drawProps();}
   if(st.state==='error')throw new Error(st.error||'The tool stopped');
   const clip=this.clip(c.id);if(!clip)return;
   if(kind==='reframe')this.applyReframe(clip,st.result.track);
   else if(kind==='track'){const v=this.clip(o.video?.id);if(v)this.applyTrack(clip,v,st.result.points);}
   else if(kind==='reverse'){const f=await fetch(withKey('/api/editor/tool/'+st.id+'/file'));if(!f.ok)throw new Error('Could not get the result');const out=await f.blob();
    const [nm]=await this.importFiles([new File([out],m.name.replace(/\.[a-z0-9]{2,5}$/i,'')+' (reversed).mp4',{type:'video/mp4'})]);
    if(nm){this.snapshot();clip.media=nm.id;clip.in=0;delete clip.ramp;delete clip.rampName;this.els[clip.id]?.pause?.();delete this.els[clip.id];this.after(true);toast('Reversed');}}
   else if(kind==='beats'){this.snapshot();let n=0;const have=new Set(this.p.markers.map(x=>Math.round(edMt(x)*100)));
    for(const b of st.result.beats){if(b<(clip.in||0)||b>this.srcSpan(clip)+(clip.in||0))continue;const t=Math.round(this.tlAt(clip,b)*1000)/1000,bar=st.result.bars.some(x=>Math.abs(x-b)<.01);
     if(have.has(Math.round(t*100)))continue;this.p.markers.push({t,...(bar?{color:'orange',name:'Bar'}:{color:'yellow'})});n++;}
    this.p.markers.sort((a,b)=>edMt(a)-edMt(b));this.after(true);toast(`${n} beat markers${st.note?' · '+st.note:''} · snapping follows them`);}
   else{const f=await fetch(withKey('/api/editor/tool/'+st.id+'/file'));if(!f.ok)throw new Error('Could not get the result');const out=await f.blob();
    const base=m.name.replace(/\.[a-z0-9]{2,5}$/i,''),ext=out.type.includes('png')?'png':out.type.includes('webm')?'webm':out.type.startsWith('audio/')?(out.type.split('/')[1].replace('mpeg','mp3')):'mp4';
    const [nm]=await this.importFiles([new File([out],`${base} (${kind==='stabilize'?'steady':kind==='voice'?'clean voice':'cut out'}).${ext}`,{type:out.type})]);
    if(nm){this.snapshot();clip.media=nm.id;this.els[clip.id]?.pause?.();delete this.els[clip.id];this.after(true);}
    toast(kind==='stabilize'?`Stabilised${st.note?' · '+st.note:''}`:kind==='voice'?`Voice cleaned${st.note?' · '+st.note:''}`:'Background removed');}
   fetch(withKey('/api/editor/tool/'+st.id),{method:'DELETE'}).catch(()=>{});
  }catch(e){toast(e.message,true);}
  finally{delete this.toolJobs[c.id];this.drawProps();}},
 /** Reverse: the clip's own part of the file, played backwards (a new file; the original stays). */
 reverseClip(c){const sp=this.srcSpan(c);return this.runTool(c,'reverse',{query:{ss:(c.in||0).toFixed(3),t:sp.toFixed(3)}});},
 /** The video under an overlay (text, sticker, picture) at its middle: what motion tracking follows. */
 videoUnder(c){const t=c.start+c.dur/2,order=this.p.tracks.map(x=>x.id),me=order.indexOf(c.track);
  return this.p.clips.filter(v=>v.id!==c.id&&!v.asAudio&&this.mediaOf(v)?.type==='video'&&t>=v.start&&t<v.start+v.dur&&order.indexOf(v.track)>me).sort((a,b)=>order.indexOf(a.track)-order.indexOf(b.track))[0];},
 /** Motion tracking: what is under this clip in the video below is followed, and the clip moves with it. */
 trackMotion(c){const v=this.videoUnder(c);if(!v)return toast('Put this over a video first: tracking follows what is under it.');const mv=this.mediaOf(v);
  const [W,H]=this.base(),g=this.dom.canvas.getContext('2d'),b=this.box(g,c,...this.size(),c.start),k=this.k(),r=this.rect(v,W,H,c.start),s=this.src(v);
  const toSrc=(x,y)=>[((x/k-(r.cx-r.w/2))/r.w*s.sw+s.sx)/(mv.w||1),((y/k-(r.cy-r.h/2))/r.h*s.sh+s.sy)/(mv.h||1)];
  const [x0,y0]=toSrc(b.cx-b.w/2,b.cy-b.h/2),[x1,y1]=toSrc(b.cx+b.w/2,b.cy+b.h/2);
  const cl=v=>edClamp(v,0,1),bx=[cl(x0),cl(y0),Math.max(.03,cl(x1)-cl(x0)),Math.max(.03,cl(y1)-cl(y0))];
  return this.runTool(c,'track',{media:mv,video:v,query:{box:bx.map(x=>x.toFixed(4)).join(','),start:this.srcAt(v,c.start).toFixed(3),end:this.srcAt(v,c.start+c.dur).toFixed(3)}});},
 applyTrack(c,v,points){const mv=this.mediaOf(v),[W,H]=this.base(),r0=this.rect(v,W,H,c.start),s=this.src(v);if(!points?.length)return;
  const p0=points[0],ox=this.val(c,'x',c.start),oy=this.val(c,'y',c.start);
  const toCanvas=(p,t)=>{const r=this.rect(v,W,H,t);return [(r.cx-r.w/2)+((p.x*(mv.w||1))-s.sx)/s.sw*r.w,(r.cy-r.h/2)+((p.y*(mv.h||1))-s.sy)/s.sh*r.h];};
  const [ax,ay]=toCanvas(p0,c.start),xs=[],ys=[];let last=-1;void r0;
  for(const p of points){if(!p.ok)continue;const tl=this.tlAt(v,p.time),lt=tl-c.start;if(lt<0||lt>c.dur||lt-last<.19)continue;last=lt;const [px,py]=toCanvas(p,tl);
   xs.push({t:Math.round(lt*1000)/1000,v:Math.round((ox+(px-ax)/W)*10000)/10000,e:'linear'});ys.push({t:Math.round(lt*1000)/1000,v:Math.round((oy+(py-ay)/H)*10000)/10000,e:'linear'});}
  if(xs.length<2)return toast('Nothing was followed in this part of the video.');
  this.snapshot();c.kf={...(c.kf||{}),x:xs,y:ys};this.after(true);toast(`Tracked: ${xs.length} positions`);},
 // ---------- proxies: a 720p copy of big videos for smooth editing; the originals are always used for export ----------
 proxySrc(m){return !this.exporting&&!this.originals&&this.p?.useProxy!==false&&m.proxy&&this.urls[m.id+':proxy']?this.urls[m.id+':proxy']:this.urls[m.id];},
 /** Recreates the video elements (after switching between proxies and originals). */
 resetElements(){for(const el of Object.values(this.els))el.pause?.();this.els={};},
 async makeProxies(){const used=new Set(this.p.clips.map(c=>c.media)),big=this.media.filter(m=>used.has(m.id)&&m.type==='video'&&!m.proxy&&Math.max(m.w||0,m.h||0)>1280);if(!big.length)return toast('No video here is bigger than 720p.');
  for(const m of big){toast(`Making a proxy for ${m.name}…`);try{const blob=await this.get(m.id);const r=await fetch(withKey(`/api/editor/tool?kind=proxy&name=${encodeURIComponent(m.name)}`),{method:'POST',body:blob});let st=await r.json();
   while(st.state==='running'){await new Promise(res=>setTimeout(res,1500));st=await (await fetch(withKey('/api/editor/tool/'+st.id))).json();}
   if(st.state!=='done')throw new Error(st.error||'The proxy failed');const out=await (await fetch(withKey('/api/editor/tool/'+st.id+'/file'))).blob();
   await this.put(m.id+':proxy',out);this.urls[m.id+':proxy']=URL.createObjectURL(out);m.proxy=true;fetch(withKey('/api/editor/tool/'+st.id),{method:'DELETE'}).catch(()=>{});}
   catch(e){toast(m.name+': '+e.message,true);}}
  this.resetElements();this.save();this.sync();this.draw();this.drawProps();toast('Proxies ready: playback uses them, export uses the originals');},
 /** Source monitor edits (3-point editing): a range of a file onto the main track at the playhead.
  *  insert: everything after the playhead moves right; overwrite: it replaces what is there. */
 sourceEdit(mid,a,b,mode){const m=this.media.find(x=>x.id===mid);if(!m)return;const audio=m.type==='audio',tr=audio?(this.p.tracks.find(t=>t.kind==='audio')||this.addTrack('audio')):this.main(),t=this.time,d=Math.max(.1,b-a);
  this.snapshot();const on=this.p.clips.filter(x=>x.track===tr.id);
  if(mode==='insert'){const hit=on.find(x=>t>x.start+.02&&t<x.start+x.dur-.02);if(hit)this.splitClip(hit,t);for(const x of this.p.clips)if(x.track===tr.id&&x.start>=t-.001)x.start+=d;}
  else{for(const x of [...on]){const e=x.start+x.dur;if(e<=t+.001||x.start>=t+d-.001)continue;
    if(x.start<t&&e>t+d){const tail=this.splitClip(x,t+d);void tail;x.dur=t-x.start;}else if(x.start<t)x.dur=t-x.start;else if(e>t+d){const cut=t+d-x.start;x.in=this.srcAt(x,t+d);x.start=t+d;x.dur-=cut;}else this.p.clips=this.p.clips.filter(y=>y!==x);}}
  const c={id:this.uid(),track:tr.id,media:mid,start:t,in:a,dur:d,speed:1,volume:1,scale:1,x:0,y:0,rotate:0,opacity:1,fadeIn:0,fadeOut:0};
  this.p.clips.push(c);const magnet=this.p.magnet;if(mode==='overwrite')this.p.magnet=false;this.pick(c.id);this.after(true);this.p.magnet=magnet;this.seek(t+d);},
 /** Auto reframe: the clip fills the frame and follows the face (x, and y when there is room), with smooth keyframes every half second. */
 applyReframe(c,track){const m=this.mediaOf(c),[W,H]=this.base(),s=this.src(c),fit=Math.min(W/s.sw,H/s.sh),cover=Math.max(W/s.sw,H/s.sh),Dw=s.sw*cover,Dh=s.sh*cover;
  const maxX=Math.max(0,(Dw-W)/(2*W)),maxY=Math.max(0,(Dh-H)/(2*H)),pts=(track||[]).filter(p=>p.face&&p.x!=null);if(!pts.length)return toast('No face was found to follow.');
  // face position in the cropped picture (0..1), averaged over 1.5 s around each moment
  const at=src=>{const near=pts.filter(p=>Math.abs(p.time-src)<=.75),use=near.length?near:[pts.reduce((a,b)=>Math.abs(b.time-src)<Math.abs(a.time-src)?b:a)];
   const fx=use.reduce((a,p)=>a+p.x,0)/use.length,fy=use.reduce((a,p)=>a+(p.y??.5),0)/use.length;return [((fx*(m.w||1))-s.sx)/s.sw,((fy*(m.h||1))-s.sy)/s.sh];};
  this.snapshot();c.scale=cover/fit;if(c.kf){delete c.kf.scale;delete c.kf.x;delete c.kf.y;}
  const xs=[],ys=[];for(let t=0;t<=c.dur+1e-6;t+=.5){const [fx,fy]=at(this.srcAt(c,c.start+Math.min(t,c.dur)));xs.push({t:Math.min(t,c.dur),v:Math.round(edClamp(-(fx-.5)*Dw/W,-maxX,maxX)*1000)/1000});ys.push({t:Math.min(t,c.dur),v:Math.round(edClamp(-(fy-.5)*Dh/H,-maxY,maxY)*1000)/1000});}
  const thin=f=>f.filter((k,i)=>i===0||i===f.length-1||Math.abs(k.v-f[i-1].v)>.004||Math.abs(k.v-f[i+1].v)>.004);
  c.kf=c.kf||{};const fx=thin(xs);if(fx.length>1)c.kf.x=fx;else{delete c.kf.x;c.x=fx[0]?.v||0;}
  if(maxY>0.001){const fy=thin(ys);if(fy.length>1)c.kf.y=fy;else{delete c.kf.y;c.y=fy[0]?.v||0;}}else{delete c.kf.y;c.y=0;}
  if(!Object.keys(c.kf).length)delete c.kf;this.after(true);toast('Reframed: the picture follows the face');},
 /** An adjustment layer: applies its adjustments, grade, mask and effects to everything under it. */
 addAdjustment(){this.snapshot();const c={id:this.uid(),adjustment:true,start:this.time,dur:5,opacity:1,scale:1,x:0,y:0,rotate:0,fadeIn:0,fadeOut:0,adj:{contrast:15,saturation:10}};
  c.track=this.place('video',c.start,c.dur);this.p.clips.push(c);this.pick(c.id);this.ptab='adjust';this.after(true);toast('Adjustment layer added: it changes everything under it');},
 /** Paste attributes (as in Premiere): the copied clip's settings, by group, onto every selected clip of a kind that has them. */
 pasteAttributes(groups){const src=this.clipboard?.[0];if(!src)return toast('Copy a clip first (Ctrl+C).');const list=this.picked().filter(c=>c.id!==src.id);if(!list.length)return toast('Select the clips to paste onto.');
  this.snapshot();const cp=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));let n=0;
  for(const c of list){const visual=this.kindOf(c)!=='audio';
   const set=(keys)=>{for(const k of keys){if(src[k]===undefined)delete c[k];else c[k]=cp(src[k]);}};
   if(groups.transform&&visual)set(['scale','x','y','rotate','flipH','flipV','crop']);
   if(groups.opacity&&visual)set(['opacity','blend']);
   if(groups.colour&&visual&&c.text===undefined&&!c.sticker)set(['adj','grade']);
   if(groups.effects&&visual)set(['key','mask']);
   if(groups.speed&&c.media&&src.media){const S=this.srcSpan(c);c.speed=src.speed||1;if(src.ramp){c.ramp=cp(src.ramp);c.rampName=src.rampName;}else{delete c.ramp;delete c.rampName;}c.dur=Math.max(.1,S/(c.speed*(c.ramp?edRampAvg(c.ramp):1)));}
   if(groups.audio&&c.media)set(['volume','gainDb','duck','fadeIn','fadeOut']);
   if(groups.text&&c.text!==undefined&&src.text!==undefined)set(['font','size','weight','color','stroke','strokeColor','shadow','box','boxColor','align','spacing','animIn','animOut','animDur','capLook','capStyle','hl','upper']);
   if(groups.keyframes&&src.kf){const ok=new Set([...(visual?['x','y','scale','rotate','opacity']:[]),...(c.media?['volume']:[])]);c.kf={};
    for(const [k,f] of Object.entries(src.kf))if(ok.has(k))c.kf[k]=f.filter(x=>x.t<=c.dur).map(x=>({...x}));if(!Object.keys(c.kf).length)delete c.kf;}
   c.fadeIn=Math.min(c.fadeIn||0,c.dur/2);c.fadeOut=Math.min(c.fadeOut||0,c.dur/2);n++;}
  this.after(true);toast(`Pasted onto ${n} clip${n>1?'s':''}`);},
 paste(){const cb=this.clipboard;if(!cb?.length)return;this.snapshot();const min=Math.min(...cb.map(c=>c.start)),off=this.time-min;this.sels.clear();
  const made=[];for(const c0 of cb){const {kind,...c}=c0;const d={...JSON.parse(JSON.stringify(c)),id:this.uid(),start:c.start+off};d.track=this.place(kind,d.start,d.dur,this.p.tracks.some(t=>t.id===c.track)?c.track:undefined);this.p.clips.push(d);made.push(d);this.sels.add(d.id);this.sel=d.id;}this.regroup(made);
  this.after(true);},
 selectAll(){this.junction=null;this.sels=new Set(this.p.clips.filter(c=>!this.trackOf(c)?.locked).map(c=>c.id));this.sel=[...this.sels].pop()||null;this.drawTimeline();this.drawProps();this.draw();},
 async detach(c){
  const m=this.mediaOf(c);if(!m||m.type!=='video'||c.detached)return;
  this.snapshot();
  const g=c.group||this.uid();c.group=g;
  const a={id:this.uid(),media:m.id,asAudio:true,start:c.start,in:c.in||0,dur:c.dur,speed:c.speed||1,volume:c.volume??1,fadeIn:0,fadeOut:0,group:g,...(c.ramp?{ramp:c.ramp.map(x=>[...x])}:{})};
  a.track=this.place('audio',a.start,a.dur);c.detached=true;this.p.clips.push(a);this.after(true);toast('The sound is on its own track now');
  if(!m.peaks){const b=await this.get(m.id).catch(()=>null);if(b){m.peaks=await edPeaks(b).catch(()=>null);this.save();this.drawTimeline();}}
 },
 setTrack(id,key){const t=this.p.tracks.find(x=>x.id===id);if(!t)return;this.snapshot();t[key]=!t[key];if(key==='locked')for(const c of this.p.clips)if(c.track===id)this.sels.delete(c.id);this.after(true);},
 async removeTrack(id){const t=this.p.tracks.find(x=>x.id===id);if(!t||t.main)return;const n=this.p.clips.filter(c=>c.track===id).length;
  if(n&&!await ask('Delete this track?',`Its ${n} clip${n>1?'s go':' goes'} too.`,'Delete track',true))return;
  this.snapshot();this.p.clips=this.p.clips.filter(c=>c.track!==id);this.p.tracks=this.p.tracks.filter(x=>x.id!==id);this.after(true);},
});
