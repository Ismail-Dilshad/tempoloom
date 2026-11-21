'use strict';
// Editor, the engine: projects, tracks and clips, playback, drawing each frame, and export. The panels,
// the timeline and the projects screen are in editor-ui.js. Files are kept in this browser; nothing is
// uploaded, except to this computer's own server to make an MP4 or to read the speech for captions.
const ED_RATIOS={'16:9':[1280,720],'9:16':[720,1280],'1:1':[1080,1080],'4:5':[1080,1350]};
const ED_KINDS={video:{label:'Video',icon:'film'},sticker:{label:'Sticker',icon:'star'},text:{label:'Text',icon:'text'},audio:{label:'Audio',icon:'music'}};
const ED_VISUAL=new Set(['video','sticker','text']);
const ED_TEXTS=[['Title',72,800,false],['Subtitle',44,600,false],['Body text',32,500,false],['Caption',34,700,true]];
const ED_TRANS=[['dissolve','Dissolve'],['fade','Fade to black'],['slide','Slide'],['push','Push up'],['zoom','Zoom'],['wipe','Wipe'],['blur','Blur']];
const ED_ADJ=[['brightness','Brightness',-100,100],['contrast','Contrast',-100,100],['saturation','Saturation',-100,100],['hue','Hue',-180,180],['temperature','Temperature',-100,100],['vignette','Vignette',0,100],['blur','Blur',0,30]];
const ED_FILTERS=[['none','Original',{}],['vivid','Vivid',{saturation:35,contrast:15}],['warm','Warm',{temperature:40,saturation:10}],['cool','Cool',{temperature:-40,saturation:5}],['bw','Black & white',{saturation:-100,contrast:15}],
 ['vintage','Vintage',{saturation:-30,temperature:30,contrast:-10,vignette:45}],['faded','Faded',{contrast:-25,brightness:8,saturation:-15}],['drama','Dramatic',{contrast:35,saturation:-10,vignette:55,brightness:-5}]];
const ED_FONTS=[['Tempoloom UI','Sans'],['Fredoka','Rounded'],['Vazirmatn','Kurdish & Arabic'],['Georgia','Serif'],['Impact','Impact'],['Courier New','Mono']];
const ED_ANIMS=[['none','None'],['fade','Fade'],['pop','Pop'],['slide','Slide'],['type','Typewriter']];
const ED_SHAPES=[['rect','Square'],['round','Rounded'],['circle','Circle'],['triangle','Triangle'],['star','Star'],['arrow','Arrow'],['line','Line'],['heart','Heart']];
const ED_EMOJI=['😀','😂','😍','🔥','👍','🎉','⭐','❤️','✅','❌','👉','💡','🚀','💯','👀','🎵'];
const ED_TRACKS0=()=>[{id:'text',kind:'text'},{id:'video',kind:'video',main:true},{id:'audio',kind:'audio'}];
const edClamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const edEase=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
const Ed={
 p:null,media:[],urls:{},els:{},imgs:{},time:0,playing:false,sel:null,sels:new Set(),junction:null,zoom:40,snap:true,tab:'media',ptab:null,
 past:[],future:[],dom:{},ready:null,exporting:null,clipboard:null,guides:false,recording:null,
 // ---------- saving: each project in localStorage, the files in IndexedDB ----------
 blank:()=>({v:3,name:'Untitled project',ratio:'16:9',bg:'#000000',bgMode:'color',magnet:true,markers:[],tracks:ED_TRACKS0(),clips:[]}),
 list(){try{return JSON.parse(localStorage.getItem('editor-projects')||'[]');}catch{return [];}},
 setList(l){try{localStorage.setItem('editor-projects',JSON.stringify(l));}catch{}},
 readProject(id){try{return JSON.parse(localStorage.getItem('editor-p:'+id)||'null');}catch{return null;}},
 create(from){const id=this.uid(),p={...this.blank(),...(from||{}),id};p.updated=new Date().toISOString();
  try{localStorage.setItem('editor-p:'+id,JSON.stringify(p));}catch{}this.setList([this.entry(p,null),...this.list()]);return id;},
 entry(p,thumb){const end=(p.clips||[]).reduce((a,c)=>Math.max(a,c.start+c.dur),0);return {id:p.id,name:p.name,ratio:p.ratio,updated:p.updated||new Date().toISOString(),dur:end,clips:(p.clips||[]).length,thumb};},
 cover(){const cv=this.dom.canvas;if(!cv||!this.p.clips.length||this.exporting)return null;try{const [W,H]=this.size(),s=Math.min(320/W,320/H),c=document.createElement('canvas');c.width=Math.round(W*s);c.height=Math.round(H*s);c.getContext('2d').drawImage(cv,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.7);}catch{return null;}},
 save(){if(!this.p?.id)return;this.p.updated=new Date().toISOString();clearTimeout(this.st);this.st=setTimeout(()=>this.flush(),300);this.saved(false);},
 flush(){if(!this.p?.id)return;clearTimeout(this.st);try{localStorage.setItem('editor-p:'+this.p.id,JSON.stringify(this.p));localStorage.setItem('editor-media',JSON.stringify(this.media));
  try{localStorage.setItem('editor-h:'+this.p.id,JSON.stringify({past:this.past.slice(-20),future:this.future.slice(-20)}));}catch{localStorage.removeItem('editor-h:'+this.p.id);}
  const old=this.list().find(x=>x.id===this.p.id),e=this.entry(this.p,this.cover()??old?.thumb??null);this.setList([e,...this.list().filter(x=>x.id!==this.p.id)]);this.saved(true);}catch{toast('This browser is out of room to save the project.',true);}},
 saved(done){const el=this.dom.saved;if(el)el.textContent=done?'Saved':'Saving…';},
 db(){return this.dbp||(this.dbp=new Promise((res,rej)=>{const r=indexedDB.open('tempoloom-editor',1);r.onupgradeneeded=()=>r.result.createObjectStore('media');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));},
 async put(id,blob){const d=await this.db();await new Promise((res,rej)=>{const t=d.transaction('media','readwrite');t.objectStore('media').put(blob,id);t.oncomplete=res;t.onerror=()=>rej(t.error);});},
 async get(id){const d=await this.db();return new Promise(res=>{const q=d.transaction('media').objectStore('media').get(id);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);});},
 async del(id){const d=await this.db();d.transaction('media','readwrite').objectStore('media').delete(id);},
 load(){return this.ready||(this.ready=(async()=>{
  try{this.media=JSON.parse(localStorage.getItem('editor-media')||'[]');}catch{}
  try{const old=JSON.parse(localStorage.getItem('editor-project')||'null');if(old&&!this.list().length&&old.clips?.length)this.create(old);localStorage.removeItem('editor-project');}catch{}
  const kept=[];for(const m of this.media){const b=await this.get(m.id).catch(()=>null);if(b){this.urls[m.id]=URL.createObjectURL(b);kept.push(m);}}
  this.media=kept;
  document.fonts?.load('40px Vazirmatn').catch(()=>{});document.fonts?.load('40px Fredoka').catch(()=>{});
 })());},
 /** Older projects: three fixed tracks, no markers. They open as they were. */
 migrate(p){
  if(!ED_RATIOS[p.ratio])p.ratio='16:9';
  if(!Array.isArray(p.tracks)||!p.tracks.length)p.tracks=ED_TRACKS0();
  if(!p.tracks.some(t=>t.main&&t.kind==='video'))(p.tracks.find(t=>t.kind==='video')||p.tracks[p.tracks.push({id:'video',kind:'video'})-1]).main=true;
  const ids=new Set(this.media.map(m=>m.id));
  p.clips=(p.clips||[]).filter(c=>c.text!==undefined||c.sticker||ids.has(c.media));
  for(const c of p.clips)if(!p.tracks.some(t=>t.id===c.track)){const kind=c.text!==undefined?'text':c.sticker?'sticker':this.media.find(m=>m.id===c.media)?.type==='audio'||c.asAudio?'audio':'video';c.track=(p.tracks.find(t=>t.kind===kind)||this.addTrackTo(p,kind)).id;}
  if(p.magnet===undefined)p.magnet=true;p.markers=p.markers||[];p.bgMode=p.bgMode||'color';p.v=3;return p;
 },
 open(id){
  if(this.p?.id===id)return true;
  if(this.p)this.flush();
  const p=this.readProject(id);if(!p)return false;
  if(this.p)this.pause();for(const el of Object.values(this.els))el.pause?.();this.els={};this.playing=false;
  this.p=this.migrate(p);this.time=0;this.sel=null;this.sels.clear();this.junction=null;this.past=[];this.future=[];
  // Undo keeps working after a reload: the last steps are saved with the project.
  try{const h=JSON.parse(localStorage.getItem('editor-h:'+id)||'null');if(h){this.past=h.past||[];this.future=h.future||[];}}catch{}
  return true;
 },
 // ---------- tracks and clips ----------
 uid:()=>Math.random().toString(36).slice(2,10),
 mediaOf(c){return this.media.find(m=>m.id===c.media);},
 trackOf(c){return this.p.tracks.find(t=>t.id===c.track);},
 kindOf(c){return this.trackOf(c)?.kind||(c.text!==undefined?'text':c.sticker?'sticker':'video');},
 main(){return this.p.tracks.find(t=>t.main);},
 end(){return this.p.clips.reduce((a,c)=>Math.max(a,c.start+c.dur),0);},
 trackEnd(id){return this.p.clips.filter(c=>c.track===id).reduce((a,c)=>Math.max(a,c.start+c.dur),0);},
 clip(id){return this.p.clips.find(c=>c.id===id);},
 picked(){return [...this.sels].map(id=>this.clip(id)).filter(Boolean);},
 fits(trackId,start,dur,except=new Set()){return !this.p.clips.some(o=>o.track===trackId&&!except.has(o.id)&&o.start<start+dur-.001&&o.start+o.dur>start+.001);},
 /** A new track: overlays go just above the main track, text and stickers on top, audio at the bottom. */
 addTrackTo(p,kind,where){
  const t={id:this.uid(),kind},tr=p.tracks;
  if(where==='top')tr.unshift(t);else if(where==='bottom')tr.push(t);
  else if(kind==='audio')tr.push(t);
  else if(kind==='text'||kind==='sticker')tr.splice(Math.max(0,tr.findIndex(x=>x.kind==='video')),0,t);
  else tr.splice(tr.findIndex(x=>x.main),0,t);
  return t;
 },
 addTrack(kind,where){return this.addTrackTo(this.p,kind,where);},
 place(kind,start,dur,prefer,except){
  const ok=t=>t&&t.kind===kind&&!t.locked&&this.fits(t.id,start,dur,except);
  const want=this.p.tracks.find(t=>t.id===prefer);if(ok(want))return want.id;
  const free=this.p.tracks.find(t=>ok(t)&&!t.main);if(free)return free.id;
  return this.addTrack(kind).id;
 },
 pack(){if(!this.p.magnet)return;const m=this.main();if(!m)return;let at=0;for(const c of this.p.clips.filter(c=>c.track===m.id).sort((a,b)=>a.start-b.start)){c.start=at;at+=c.dur;}},
 tidy(){const used=new Set(this.p.clips.map(c=>c.track)),tr=this.p.tracks,keep=t=>t.main||used.has(t.id)||t.locked||t.hidden||t.muted;
  this.p.tracks=tr.filter(t=>keep(t)||((t.kind==='text'||t.kind==='audio')&&!tr.some(o=>o.kind===t.kind&&keep(o))&&t===tr.find(o=>o.kind===t.kind)));
  if(!this.p.tracks.some(t=>t.kind==='text'))this.addTrack('text','top');if(!this.p.tracks.some(t=>t.kind==='audio'))this.addTrack('audio','bottom');},
 snapshot(){this.past.push(JSON.stringify(this.p));if(this.past.length>100)this.past.shift();this.future=[];},
 undo(){if(!this.past.length)return;this.future.push(JSON.stringify(this.p));this.p=JSON.parse(this.past.pop());this.after(true);this.fit();},
 redo(){if(!this.future.length)return;this.past.push(JSON.stringify(this.p));this.p=JSON.parse(this.future.pop());this.after(true);this.fit();},
 after(all){this.pack();this.tidy();for(const id of [...this.sels])if(!this.clip(id))this.sels.delete(id);if(this.sel&&!this.clip(this.sel))this.sel=[...this.sels].pop()||null;if(this.junction&&!this.clip(this.junction))this.junction=null;
  this.save();this.drawTimeline();if(all)this.drawProps();this.sync();this.draw();this.drawTime();},
 // ---------- importing ----------
 async importFiles(files){
  const list=[...files].filter(f=>/^(video|image|audio)\//.test(f.type));
  if(!list.length){toast('Choose videos, photos or audio.',true);return [];}
  const made=[];
  for(const f of list){
   const id=this.uid(),type=f.type.split('/')[0],url=URL.createObjectURL(f);this.urls[id]=url;
   const m={id,name:f.name,type,dur:type==='image'?5:0,w:0,h:0,thumbs:[],peaks:null};
   this.media.unshift(m);made.push(m);this.drawLib();
   try{await this.put(id,f);}catch{toast('This browser could not keep '+f.name+'; it works until you reload.',true);}
   try{
    if(type==='image'){const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});m.w=im.naturalWidth;m.h=im.naturalHeight;m.thumbs=[edThumb(im,m.w,m.h)];}
    else if(type==='video'){Object.assign(m,await edVideoInfo(url));}
    else{m.dur=await edMediaDur(url,'audio');m.peaks=await edPeaks(f).catch(()=>null);}
   }catch{toast('Could not read '+f.name,true);}
   this.drawLib();this.save();
  }
  return made;
 },
 async removeMedia(id){
  const m=this.media.find(x=>x.id===id);if(!m)return;
  const used=this.p.clips.filter(c=>c.media===id).length;
  if(!await ask('Remove this file?',used?`It is also taken off the timeline (${used} clip${used>1?'s':''}).`:'It leaves this editor. The file on your computer stays.','Remove',true,{file:{name:m.name}}))return;
  if(used){this.snapshot();this.p.clips=this.p.clips.filter(c=>c.media!==id);}
  this.media=this.media.filter(x=>x.id!==id);this.del(id).catch(()=>{});
  for(const k of Object.keys(this.els))if(!this.clip(k)){this.els[k].pause?.();delete this.els[k];}
  this.drawLib();this.after(true);
 },
 // ---------- adding to the timeline ----------
 add(mid,at,trackId){
  const m=this.media.find(x=>x.id===mid);if(!m)return;
  if(m.type==='video'&&!m.dur)return toast('Still reading this video. Try again in a moment.');
  const kind=m.type==='audio'?'audio':'video',dur=m.dur||5,main=this.main();
  this.snapshot();
  let start=at,track=trackId;
  if(kind==='video'&&(!trackId||trackId===main.id)&&at===undefined){track=main.id;start=this.trackEnd(main.id);}
  else{start=at??this.time;track=this.place(kind,start,dur,trackId||(kind==='video'?main.id:undefined));}
  const c={id:this.uid(),track,media:mid,start,in:0,dur,speed:1,volume:1,scale:1,x:0,y:0,rotate:0,opacity:1,fadeIn:0,fadeOut:0};
  this.p.clips.push(c);this.pick(c.id);this.after(true);return c;
 },
 textClip(i,at,text){
  const [label,size,weight,box]=ED_TEXTS[i];
  return {id:this.uid(),text:text??(label==='Body text'?'Your text here':label),start:at??this.time,dur:3,size,weight,color:'#ffffff',box,boxColor:'#000000',align:'center',font:'Tempoloom UI',stroke:0,strokeColor:'#000000',shadow:!box,spacing:0,
   x:0,y:label==='Caption'?.32:0,opacity:1,scale:1,rotate:0,animIn:'none',animOut:'none',animDur:.5};
 },
 addText(i){this.snapshot();const c=this.textClip(i);c.track=this.place('text',c.start,c.dur,this.p.tracks.find(t=>t.kind==='text')?.id);this.p.clips.push(c);this.pick(c.id);this.after(true);},
 addSticker(s){this.snapshot();const c={id:this.uid(),sticker:s,start:this.time,dur:3,color:'#ffd23f',scale:1,x:0,y:0,rotate:0,opacity:1,animIn:'pop',animOut:'none',animDur:.4};
  c.track=this.place('sticker',c.start,c.dur,this.p.tracks.find(t=>t.kind==='sticker')?.id);this.p.clips.push(c);this.pick(c.id);this.after(true);},
 // ---------- selecting ----------
 pick(id,add){this.junction=null;if(!id){this.sels.clear();this.sel=null;return;}if(add){if(this.sels.has(id)){this.sels.delete(id);this.sel=[...this.sels].pop()||null;}else{this.sels.add(id);this.sel=id;}}else{this.sels=new Set([id]);this.sel=id;}},
 select(id,add){this.pick(id,add);this.drawTimeline();this.drawProps();this.draw();},
 selectJoin(id){this.sels.clear();this.sel=null;this.junction=id;this.drawTimeline();this.drawProps();this.draw();},
 // ---------- editing ----------
 split(){
  const t=this.time,inside=x=>t>x.start+.05&&t<x.start+x.dur-.05&&!this.trackOf(x)?.locked;
  let list=this.picked().filter(inside);
  if(!list.length){const c=this.p.clips.find(x=>x.track===this.main()?.id&&inside(x))||this.p.clips.find(inside);if(c)list=[c];}
  if(!list.length)return toast('Move the playhead over a clip to split it.');
  this.snapshot();let last=null;
  for(const c of list){const first=t-c.start,b={...c,id:this.uid(),start:t,in:(c.in||0)+first*(c.speed||1),dur:c.dur-first};delete b.trans;
   if(c.kf){b.kf={};c.kf=Object.fromEntries(Object.entries(c.kf).map(([k,f])=>{b.kf[k]=f.filter(x=>x.t>=first).map(x=>({t:x.t-first,v:x.v}));return [k,f.filter(x=>x.t<=first)];}));}
   c.dur=first;c.fadeOut=0;b.fadeIn=0;this.p.clips.push(b);last=b.id;}
  this.pick(last);this.after(true);
 },
 remove(){
  if(this.junction){const c=this.clip(this.junction);if(c?.trans){this.snapshot();delete c.trans;this.junction=null;this.after(true);}return;}
  const list=this.picked().filter(c=>!this.trackOf(c)?.locked);if(!list.length)return;this.snapshot();const gone=new Set(list.map(c=>c.id));
  this.p.clips=this.p.clips.filter(x=>!gone.has(x.id));for(const id of gone){this.els[id]?.pause?.();delete this.els[id];}this.pick(null);this.after(true);},
 duplicate(){const list=this.picked();if(!list.length)return;this.snapshot();this.sels.clear();
  for(const c of list){const start=c.start+c.dur,d={...JSON.parse(JSON.stringify(c)),id:this.uid(),start};d.track=this.place(this.kindOf(c),start,c.dur,c.track);this.p.clips.push(d);this.sels.add(d.id);this.sel=d.id;}this.after(true);},
 copy(cut){const list=this.picked();if(!list.length)return;this.clipboard=JSON.parse(JSON.stringify(list.map(c=>({...c,kind:this.kindOf(c)}))));toast(cut?`Cut ${list.length}`:`Copied ${list.length}`);if(cut)this.remove();},
 paste(){const cb=this.clipboard;if(!cb?.length)return;this.snapshot();const min=Math.min(...cb.map(c=>c.start)),off=this.time-min;this.sels.clear();
  for(const c0 of cb){const {kind,...c}=c0;const d={...JSON.parse(JSON.stringify(c)),id:this.uid(),start:c.start+off};d.track=this.place(kind,d.start,d.dur,this.p.tracks.some(t=>t.id===c.track)?c.track:undefined);this.p.clips.push(d);this.sels.add(d.id);this.sel=d.id;}
  this.after(true);},
 selectAll(){this.junction=null;this.sels=new Set(this.p.clips.filter(c=>!this.trackOf(c)?.locked).map(c=>c.id));this.sel=[...this.sels].pop()||null;this.drawTimeline();this.drawProps();this.draw();},
 async detach(c){
  const m=this.mediaOf(c);if(!m||m.type!=='video'||c.detached)return;
  this.snapshot();
  const a={id:this.uid(),media:m.id,asAudio:true,start:c.start,in:c.in||0,dur:c.dur,speed:c.speed||1,volume:c.volume??1,fadeIn:0,fadeOut:0};
  a.track=this.place('audio',a.start,a.dur);c.detached=true;this.p.clips.push(a);this.after(true);toast('The sound is on its own track now');
  if(!m.peaks){const b=await this.get(m.id).catch(()=>null);if(b){m.peaks=await edPeaks(b).catch(()=>null);this.save();this.drawTimeline();}}
 },
 setTrack(id,key){const t=this.p.tracks.find(x=>x.id===id);if(!t)return;this.snapshot();t[key]=!t[key];if(key==='locked')for(const c of this.p.clips)if(c.track===id)this.sels.delete(c.id);this.after(true);},
 async removeTrack(id){const t=this.p.tracks.find(x=>x.id===id);if(!t||t.main)return;const n=this.p.clips.filter(c=>c.track===id).length;
  if(n&&!await ask('Delete this track?',`Its ${n} clip${n>1?'s go':' goes'} too.`,'Delete track',true))return;
  this.snapshot();this.p.clips=this.p.clips.filter(c=>c.track!==id);this.p.tracks=this.p.tracks.filter(x=>x.id!==id);this.after(true);},
 // ---------- transitions: on the clip that comes after the cut ----------
 prevOf(c){return this.p.clips.find(o=>o.track===c.track&&o.id!==c.id&&Math.abs(o.start+o.dur-c.start)<.05);},
 setTrans(c,type,dur){if(!c)return;this.snapshot();if(type==='none')delete c.trans;else c.trans={type,dur:dur??c.trans?.dur??.6};this.after(true);},
 transAll(type,dur){this.snapshot();for(const c of this.p.clips.filter(c=>this.kindOf(c)==='video'))if(this.prevOf(c)){if(type==='none')delete c.trans;else c.trans={type,dur};}this.after(true);},
 // ---------- keyframes: per property, at times from the clip's start ----------
 val(c,k,t=this.time){const d={scale:1,opacity:1,volume:1}[k]??0,f=c.kf?.[k];if(!f?.length)return c[k]??d;const lt=edClamp(t-c.start,0,c.dur);
  if(lt<=f[0].t)return f[0].v;const last=f[f.length-1];if(lt>=last.t)return last.v;const i=f.findIndex(x=>x.t>lt),a=f[i-1],b=f[i];return a.v+(b.v-a.v)*edEase((lt-a.t)/(b.t-a.t||1));},
 kfAt(c,k){const lt=this.time-c.start;return (c.kf?.[k]||[]).findIndex(x=>Math.abs(x.t-lt)<1/60);},
 toggleKf(c,k){const lt=edClamp(this.time-c.start,0,c.dur);this.snapshot();c.kf=c.kf||{};const f=c.kf[k]=c.kf[k]||[];const i=this.kfAt(c,k);
  if(i>=0)f.splice(i,1);else{f.push({t:lt,v:this.val(c,k)});f.sort((a,b)=>a.t-b.t);}if(!f.length)delete c.kf[k];this.after(true);},
 /** Setting a value: with keyframes, it goes into the keyframe at the playhead (made if there is none). */
 setVal(c,k,v){const f=c.kf?.[k];if(f?.length){const lt=edClamp(this.time-c.start,0,c.dur),i=this.kfAt(c,k);if(i>=0)f[i].v=v;else{f.push({t:lt,v});f.sort((a,b)=>a.t-b.t);}}else c[k]=v;},
 // ---------- playback ----------
 element(c){
  let el=this.els[c.id];const m=this.mediaOf(c);
  if(!el&&m&&m.type!=='image'){
   el=document.createElement(c.asAudio?'audio':m.type);el.src=this.urls[m.id];el.preload='auto';el.playsInline=true;el.crossOrigin='anonymous';
   el.addEventListener('seeked',()=>{if(!this.playing)this.draw();});el.addEventListener('loadeddata',()=>{if(!this.playing)this.draw();});
   this.els[c.id]=el;if(this.ac)this.route(el);
  }
  return el;
 },
 image(m){let im=this.imgs[m.id];if(!im){im=new Image();im.onload=()=>{if(!this.playing)this.draw();};im.src=this.urls[m.id];this.imgs[m.id]=im;}return im;},
 audio(){if(this.ac)return;try{this.ac=new AudioContext();this.rec=this.ac.createMediaStreamDestination();for(const el of Object.values(this.els))this.route(el);}catch{this.ac=null;}},
 route(el){if(el._routed||!this.ac)return;try{const s=this.ac.createMediaElementSource(el);s.connect(this.ac.destination);s.connect(this.rec);el._routed=true;}catch{}},
 fade(c,t){const tt=edClamp(t,c.start,c.start+c.dur);let v=1;const local=tt-c.start;if(c.fadeIn&&local<c.fadeIn)v*=Math.max(0,local/c.fadeIn);if(c.fadeOut&&c.start+c.dur-tt<c.fadeOut)v*=Math.max(0,(c.start+c.dur-tt)/c.fadeOut);return v;},
 vol(c,t){const tr=this.trackOf(c);if(tr?.muted||(c.detached&&!c.asAudio))return 0;return edClamp(this.val(c,'volume',t)*this.fade(c,t),0,1);},
 sync(){
  const t=this.time;
  for(const c of this.p.clips){
   if(c.text!==undefined||c.sticker)continue;const m=this.mediaOf(c);if(!m||m.type==='image')continue;
   const el=this.element(c);if(!el)continue;
   const on=t>=c.start&&t<c.start+c.dur,want=(c.in||0)+(t-c.start)*(c.speed||1);
   if(on){
    el.playbackRate=c.speed||1;el.volume=this.vol(c,t);
    if(this.playing){if(el.paused){try{el.currentTime=want;}catch{}el.play().catch(()=>{});}else if(Math.abs(el.currentTime-want)>.3)el.currentTime=want;}
    else{if(!el.paused)el.pause();if(Math.abs(el.currentTime-want)>.03){try{el.currentTime=want;}catch{}}}
   }else{if(!el.paused)el.pause();
    // Just before or after its turn, a clip waits on its first or last frame (for transitions).
    const pre=c.start-t>0&&c.start-t<1.5,post=t-(c.start+c.dur)>=0&&t-(c.start+c.dur)<1.5;
    if(pre||post){const w=pre?(c.in||0):(c.in||0)+c.dur*(c.speed||1)-.05;if(Math.abs(el.currentTime-w)>.06){try{el.currentTime=Math.max(0,w);}catch{}}}}
  }
 },
 play(){
  if(this.playing)return this.pause();
  if(!this.p.clips.length)return;
  this.audio();this.ac?.resume?.();
  if(this.time>=this.end()-.05)this.time=0;
  this.playing=true;this.t0=this.time;this.p0=performance.now();this.drawTime();
  const tick=now=>{
   if(!this.playing)return;
   if(!document.contains(this.dom.canvas)){this.pause();return;}
   this.time=this.t0+(now-this.p0)/1000;
   const end=this.end();if(this.time>=end){this.time=end;this.pause();if(this.exporting)this.finishExport();return;}
   this.sync();this.draw();this.drawHead();this.drawTime();
   requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
 },
 pause(){this.playing=false;for(const el of Object.values(this.els))el.pause?.();if(this.p){this.sync();this.draw();this.drawTime();}},
 seek(t){this.time=Math.max(0,Math.min(t,Math.max(this.end(),0)));if(this.playing){this.t0=this.time;this.p0=performance.now();}this.sync();this.draw();this.drawHead();this.drawTime();if(!this.playing&&this.sel&&this.clip(this.sel)?.kf)this.drawProps();},
 // ---------- drawing the frame ----------
 base(){return ED_RATIOS[this.p.ratio];},
 size(){const b=this.base(),k=this.exporting?.scale||1;return [Math.round(b[0]*k/2)*2,Math.round(b[1]*k/2)*2];},
 k(){return this.size()[0]/this.base()[0];},
 src(c){const m=this.mediaOf(c),w=m?.w||1,h=m?.h||1,cr=c.crop||{},l=cr.l||0,t=cr.t||0,r=cr.r||0,b=cr.b||0;return {sx:l*w,sy:t*h,sw:Math.max(1,w*(1-l-r)),sh:Math.max(1,h*(1-t-b))};},
 rect(c,W,H,t=this.time){
  if(c.sticker){const s=220*this.k()*this.val(c,'scale',t),line=c.sticker.type==='shape'&&c.sticker.shape==='line';return {w:line?s*1.4:s,h:line?s*.2:s,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H};}
  const s=this.src(c),fit=Math.min(W/s.sw,H/s.sh)*this.val(c,'scale',t);return {w:s.sw*fit,h:s.sh*fit,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H};},
 box(g,c,W,H,t=this.time){return c.text!==undefined?this.textBox(g,c,W,H,t):this.rect(c,W,H,t);},
 visible(t){const on=c=>t>=c.start&&t<c.start+c.dur;const out=[];
  for(const tr of [...this.p.tracks].reverse()){if(!ED_VISUAL.has(tr.kind)||tr.hidden)continue;for(const c of this.p.clips.filter(c=>c.track===tr.id&&on(c)).sort((a,b)=>a.start-b.start))out.push(c);}
  return out;},
 filterOf(c,extra){const a=c.adj||{},k=this.k(),f=[];
  if(a.brightness)f.push(`brightness(${1+a.brightness/100})`);if(a.contrast)f.push(`contrast(${1+a.contrast/100})`);if(a.saturation)f.push(`saturate(${1+a.saturation/100})`);if(a.hue)f.push(`hue-rotate(${a.hue}deg)`);
  const bl=(a.blur||0)+(extra||0);if(bl)f.push(`blur(${bl*k}px)`);return f.join(' ')||'none';},
 /** One picture, sticker or text at time t, with what a transition adds (alpha, offset, zoom, wipe, blur). */
 drawClip(g,c,t,o={}){
  const [W,H]=this.size();
  if(c.text!==undefined)return this.drawText(g,c,W,H,t,o);
  if(c.sticker)return this.drawSticker(g,c,W,H,t,o);
  const m=this.mediaOf(c);if(!m)return;const src=m.type==='image'?this.image(m):this.element(c);
  if(!src||(m.type==='video'&&src.readyState<2)||(m.type==='image'&&!src.complete))return;
  const r=this.rect(c,W,H,t),s=this.src(c),a=this.val(c,'opacity',t)*this.fade(c,t)*(o.alpha??1);if(a<=0)return;
  g.save();if(o.clipX!=null){g.beginPath();g.rect(0,0,o.clipX,H);g.clip();}
  g.globalAlpha=edClamp(a,0,1);g.translate(r.cx+(o.dx||0),r.cy+(o.dy||0));g.rotate(this.val(c,'rotate',t)*Math.PI/180);g.scale((c.flipH?-1:1)*(o.k||1),(c.flipV?-1:1)*(o.k||1));
  g.filter=this.filterOf(c,o.blur);g.drawImage(src,s.sx,s.sy,s.sw,s.sh,-r.w/2,-r.h/2,r.w,r.h);g.filter='none';
  const adj=c.adj||{};
  if(adj.temperature){g.globalCompositeOperation='soft-light';g.fillStyle=adj.temperature>0?`rgba(255,140,30,${adj.temperature/100*.7})`:`rgba(30,130,255,${-adj.temperature/100*.7})`;g.fillRect(-r.w/2,-r.h/2,r.w,r.h);g.globalCompositeOperation='source-over';}
  if(adj.vignette){const gr=g.createRadialGradient(0,0,Math.min(r.w,r.h)*.3,0,0,Math.hypot(r.w,r.h)/2);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,`rgba(0,0,0,${adj.vignette/100*.85})`);g.fillStyle=gr;g.fillRect(-r.w/2,-r.h/2,r.w,r.h);}
  g.restore();
 },
 drawTrans(g,A,B,type,p,t){
  const [W,H]=this.size(),d=(c,o)=>this.drawClip(g,c,t,o);
  if(type==='fade'){if(p<.5)d(A,{alpha:1-2*p});else d(B,{alpha:2*p-1});}
  else if(type==='slide'){d(A,{dx:-edEase(p)*W});d(B,{dx:(1-edEase(p))*W});}
  else if(type==='push'){d(A,{dy:-edEase(p)*H});d(B,{dy:(1-edEase(p))*H});}
  else if(type==='zoom'){d(A,{k:1+p*.5,alpha:1-p});d(B,{k:.85+.15*p,alpha:p});}
  else if(type==='wipe'){d(A,{});d(B,{clipX:edEase(p)*W});}
  else if(type==='blur'){d(A,{blur:p*30});d(B,{blur:(1-p)*30,alpha:edEase(p)});}
  else{d(A,{});d(B,{alpha:p});}
 },
 draw(){
  const cv=this.dom.canvas;if(!cv||!this.p)return;const [W,H]=this.size();if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  const g=cv.getContext('2d'),t=this.time;g.save();g.fillStyle=this.p.bg||'#000';g.fillRect(0,0,W,H);
  // A blurred, enlarged copy of the main picture fills the frame behind it (for a horizontal clip in a vertical video).
  if(this.p.bgMode==='blur'){const mc=this.p.clips.find(c=>c.track===this.main()?.id&&t>=c.start&&t<c.start+c.dur);const m=mc&&this.mediaOf(mc);
   const src=m&&(m.type==='image'?this.image(m):this.element(mc));if(src&&(m.type!=='video'||src.readyState>=2)){const s=this.src(mc),f=Math.max(W/s.sw,H/s.sh)*1.1;g.save();g.filter=`blur(${40*this.k()}px) brightness(.7)`;g.drawImage(src,s.sx,s.sy,s.sw,s.sh,(W-s.sw*f)/2,(H-s.sh*f)/2,s.sw*f,s.sh*f);g.restore();}}
  for(const tr of [...this.p.tracks].reverse()){
   if(!ED_VISUAL.has(tr.kind)||tr.hidden)continue;
   const cl=this.p.clips.filter(c=>c.track===tr.id).sort((a,b)=>a.start-b.start),done=new Set();
   cl.forEach((c,i)=>{if(done.has(c.id))return;const nx=cl[i+1];
    if(tr.kind==='video'&&nx?.trans&&Math.abs(c.start+c.dur-nx.start)<.05){const d=Math.min(nx.trans.dur,c.dur,nx.dur),a0=nx.start-d/2;if(t>=a0&&t<a0+d){this.drawTrans(g,c,nx,nx.trans.type,(t-a0)/d,t);done.add(nx.id);return;}}
    if(t>=c.start&&t<c.start+c.dur)this.drawClip(g,c,t);});
  }
  if(!this.exporting)for(const s of this.picked()){if(!(t>=s.start&&t<s.start+s.dur)||this.kindOf(s)==='audio')continue;const b=this.box(g,s,W,H,t);
   g.save();g.translate(b.cx,b.cy);g.rotate(this.val(s,'rotate',t)*Math.PI/180);g.strokeStyle='rgba(80,150,255,.95)';g.lineWidth=Math.max(2,W/400);g.setLineDash([W/80,W/120]);g.strokeRect(-b.w/2,-b.h/2,b.w,b.h);g.restore();}
  g.restore();
 },
 /** How far a clip's in or out animation is (0 to 1, 1 = fully shown). */
 anim(c,t){const d=Math.max(.1,c.animDur||.5),lt=t-c.start,rt=c.start+c.dur-t;return {i:c.animIn&&c.animIn!=='none'?edClamp(lt/d,0,1):1,o:c.animOut&&c.animOut!=='none'?edClamp(rt/d,0,1):1};},
 animApply(c,t){const {i,o}=this.anim(c,t),r={alpha:1,k:1,dy:0,chars:1};
  const one=(type,p)=>{if(p>=1)return;const e=edEase(p);if(type==='fade')r.alpha*=e;else if(type==='pop'){const b=1-Math.pow(1-p,3);r.k*=.5+.5*b+Math.sin(p*Math.PI)*.12;r.alpha*=Math.min(1,p*3);}else if(type==='slide'){r.dy+=(1-e)*.08;r.alpha*=e;}else if(type==='type')r.chars=Math.min(r.chars,p);};
  one(c.animIn,i);one(c.animOut,o);return r;},
 lines(g,c,W){const words=String(c.text||'').split(/\s+/);const out=[];let line='';for(const w of words){const next=line?line+' '+w:w;if(g.measureText(next).width>W*.86&&line){out.push(line);line=w;}else line=next;}if(line)out.push(line);return out.length?out:[''];},
 font(c,t){return `${c.weight||600} ${Math.round((c.size||40)*this.val(c,'scale',t)*this.k())}px "${c.font||'Tempoloom UI'}", "Tempoloom UI", system-ui, sans-serif`;},
 textBox(g,c,W,H,t=this.time){g.save();g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;const ls=this.lines(g,c,W),lh=(c.size||40)*this.val(c,'scale',t)*this.k()*1.25,w=Math.max(...ls.map(l=>g.measureText(l).width))+lh*.6,h=ls.length*lh+lh*.3;g.restore();
  return {w,h,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H,ls,lh};},
 drawText(g,c,W,H,t=this.time,o={}){
  const b=this.textBox(g,c,W,H,t),an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha;if(a<=0)return;
  g.save();g.globalAlpha=a;g.translate(b.cx+(o.dx||0),b.cy+(o.dy||0)+an.dy*H);g.rotate(this.val(c,'rotate',t)*Math.PI/180);g.scale(an.k,an.k);g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;g.textBaseline='middle';
  if(c.box){g.fillStyle=c.boxColor||'#000';g.globalAlpha=a*.72;g.beginPath();g.roundRect(-b.w/2,-b.h/2,b.w,b.h,b.lh*.25);g.fill();g.globalAlpha=a;}
  g.textAlign=c.align||'center';const x=c.align==='left'?-b.w/2+b.lh*.3:c.align==='right'?b.w/2-b.lh*.3:0;
  let ls=b.ls;if(an.chars<1){let n=Math.round(ls.join(' ').length*an.chars);ls=ls.map(l=>{const s=l.slice(0,Math.max(0,n));n-=l.length+1;return s;});}
  ls.forEach((l,i)=>{const y=-b.h/2+b.lh*.15+b.lh*(i+.5);
   if(c.shadow&&!c.box){g.shadowColor='rgba(0,0,0,.5)';g.shadowBlur=b.lh*.25;g.shadowOffsetY=b.lh*.05;}
   if(c.stroke){g.lineJoin='round';g.lineWidth=c.stroke*this.k()*2;g.strokeStyle=c.strokeColor||'#000';g.strokeText(l,x,y);g.shadowColor='transparent';}
   g.fillStyle=c.color||'#fff';g.fillText(l,x,y);});
  g.restore();
 },
 drawSticker(g,c,W,H,t=this.time,o={}){
  const r=this.rect(c,W,H,t),an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha;if(a<=0)return;
  g.save();g.globalAlpha=a;g.translate(r.cx+(o.dx||0),r.cy+(o.dy||0)+an.dy*H);g.rotate(this.val(c,'rotate',t)*Math.PI/180);g.scale(an.k,an.k);
  const s=c.sticker,w=r.w,h=r.h;
  if(s.type==='emoji'){g.font=`${Math.round(w*.85)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(s.emoji,0,w*.04);}
  else{g.fillStyle=c.color||'#ffd23f';g.beginPath();const R=w/2;
   if(s.shape==='rect')g.rect(-R,-R,w,w);else if(s.shape==='round')g.roundRect(-R,-R,w,w,w*.2);else if(s.shape==='circle')g.arc(0,0,R,0,Math.PI*2);
   else if(s.shape==='triangle'){g.moveTo(0,-R);g.lineTo(R,R*.8);g.lineTo(-R,R*.8);g.closePath();}
   else if(s.shape==='star'){for(let i=0;i<10;i++){const rr=i%2?R*.45:R,a2=-Math.PI/2+i*Math.PI/5;g.lineTo(Math.cos(a2)*rr,Math.sin(a2)*rr);}g.closePath();}
   else if(s.shape==='arrow'){g.moveTo(-R,-R*.22);g.lineTo(R*.2,-R*.22);g.lineTo(R*.2,-R*.6);g.lineTo(R,0);g.lineTo(R*.2,R*.6);g.lineTo(R*.2,R*.22);g.lineTo(-R,R*.22);g.closePath();}
   else if(s.shape==='line')g.roundRect(-w/2,-h/2,w,h,h/2);
   else if(s.shape==='heart'){g.moveTo(0,R*.75);g.bezierCurveTo(-R*1.3,-R*.1,-R*.5,-R*1.05,0,-R*.4);g.bezierCurveTo(R*.5,-R*1.05,R*1.3,-R*.1,0,R*.75);}
   g.fill();}
  g.restore();
 },
 // ---------- exporting: the frame and the sound, recorded while it plays; MP4 is made by ffmpeg here ----------
 async exportVideo(o){
  if(typeof MediaRecorder==='undefined')return toast('This browser cannot record video.',true);
  this.audio();await this.ac?.resume?.();
  const scale=o.height/Math.min(...this.base()),fps=o.fps;
  this.exporting={scale,format:o.format,fps,name:o.name,studio:!!o.studio};this.pick(null);this.drawTimeline();this.drawProps();this.fit();this.draw();
  const v=this.dom.canvas.captureStream(fps),tracks=[...v.getVideoTracks(),...(this.rec?this.rec.stream.getAudioTracks():[])];
  const type=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  const [W,H]=this.size(),bits=Math.round(W*H*fps*.15);
  const rec=new MediaRecorder(new MediaStream(tracks),{mimeType:type,videoBitsPerSecond:Math.min(60e6,Math.max(4e6,bits))});const parts=[];
  rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};
  rec.onstop=async()=>{const ex=this.exporting;const ok=ex&&!ex.cancelled;
   if(ok&&ex.format==='mp4'){this.drawExport('Making the MP4…');
    try{const r=await fetch(withKey('/api/editor/mp4?fps='+fps),{method:'POST',body:new Blob(parts,{type:'video/webm'})});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Could not make the MP4');const out=await r.blob();edSaveFile(out,ex.name+'.mp4');toast('Exported');if(ex.studio)this.toStudio(out,ex.name+'.mp4');}
    catch(e){toast(e.message+'. Saved as WebM instead.',true);edSaveFile(new Blob(parts,{type:'video/webm'}),ex.name+'.webm');}}
   else if(ok){const out=new Blob(parts,{type:'video/webm'});edSaveFile(out,ex.name+'.webm');toast('Exported');if(ex.studio)this.toStudio(out,ex.name+'.webm');}
   this.exporting=null;this.drawExport();this.fit();this.draw();};
  this.drawExport('Recording…');this.pause();this.seek(0);
  setTimeout(()=>{rec.start(250);this.exporting.rec=rec;this.play();},400);
 },
 toStudio(blob,name){edSaveToStudio(blob,name).then(()=>toast('Saved to Studio')).catch(e=>toast(e.message,true));},
 finishExport(){const e=this.exporting;if(e?.rec&&e.rec.state!=='inactive')setTimeout(()=>e.rec.stop(),200);},
 cancelExport(){const e=this.exporting;if(!e)return;e.cancelled=true;this.pause();if(e.rec&&e.rec.state!=='inactive')e.rec.stop();else{this.exporting=null;this.drawExport();this.fit();this.draw();}},
 // ---------- voice-over: the microphone, recorded onto an audio track from the playhead ----------
 async recordVoice(){
  if(this.recording){this.recording.rec.stop();return;}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch{return toast('The microphone is not available. Allow it for this page and try again.',true);}
  const rec=new MediaRecorder(stream),parts=[],at=this.time;rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};
  this.recording={rec,at,started:performance.now()};this.drawLib();
  const tick=setInterval(()=>{if(!this.recording)return clearInterval(tick);const el=this.dom.lib?.querySelector('[data-rec-time]');if(el)el.textContent=edFmt((performance.now()-this.recording.started)/1000).slice(0,5);},250);
  rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());clearInterval(tick);this.recording=null;
   const n=this.media.filter(m=>/^Voice-over/.test(m.name)).length+1,f=new File(parts,`Voice-over ${n}.webm`,{type:'audio/webm'});
   this.tab='audio';const [m]=await this.importFiles([f]);if(m){const c=this.add(m.id,at);if(c)toast('Voice-over added');}};
  rec.start(250);
 },
 toggleMarker(){const t=Math.round(this.time*30)/30,ms=this.p.markers,i=ms.findIndex(x=>Math.abs(x-t)<.05);this.snapshot();if(i>=0)ms.splice(i,1);else{ms.push(t);ms.sort((a,b)=>a-b);}this.after(false);},
 // ---------- auto captions: the speech in each clip with sound, as caption text clips ----------
 async captions(){
  const src=this.p.clips.filter(c=>{const m=this.mediaOf(c);return m&&(m.type==='audio'||m.type==='video')&&!this.trackOf(c)?.muted&&!(c.detached&&!c.asAudio);});
  if(!src.length)return toast('Add a video or sound with speech first.');
  const busy=this.dom.lib?.querySelector('[data-captions]');if(busy){busy.disabled=true;busy.innerHTML='<span class="spin"></span> Reading the speech…';}
  try{
   const words={};
   for(const id of new Set(src.map(c=>c.media))){const m=this.media.find(x=>x.id===id),blob=await this.get(id);if(!blob)continue;
    const r=await fetch(withKey('/api/editor/captions?name='+encodeURIComponent(m.name)),{method:'POST',body:blob});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not read the speech');words[id]=j.words||[];}
   const lines=[];
   for(const c of src){const ws=(words[c.media]||[]).filter(w=>w.start>=(c.in||0)&&w.end<=(c.in||0)+c.dur*(c.speed||1)+.05).map(w=>({text:w.text.trim(),s:c.start+(w.start-(c.in||0))/(c.speed||1),e:c.start+(w.end-(c.in||0))/(c.speed||1)})).filter(w=>w.text);
    let cur=null;for(const w of ws){if(cur&&(cur.words.length>=6||w.s-cur.e>.6||cur.e-cur.s>2.6||/[.!?،؟]$/.test(cur.words.at(-1)))){lines.push(cur);cur=null;}if(!cur)cur={s:w.s,e:w.e,words:[]};cur.words.push(w.text);cur.e=w.e;}if(cur)lines.push(cur);}
   if(!lines.length)return toast('No speech was found.');
   this.snapshot();const tr=this.addTrack('text');
   for(const l of lines){const c=this.textClip(3,l.s,l.words.join(' '));c.dur=Math.max(.4,l.e-l.s);c.track=tr.id;this.p.clips.push(c);}
   this.after(true);toast(`Added ${lines.length} caption${lines.length>1?'s':''}`);
  }catch(e){toast(e.message,true);}
  finally{this.drawLib();}
 },
};
const edFmt=t=>{t=Math.max(0,t||0);const m=Math.floor(t/60),s=Math.floor(t%60),f=Math.floor((t%1)*30);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;};
function edSaveFile(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name.replace(/[\\/:*?"<>|]+/g,'').trim()||'video';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),6000);}
function edThumb(src,w,h,tw=160,th=90){const c=document.createElement('canvas');c.width=tw;c.height=th;const g=c.getContext('2d'),s=Math.max(tw/w,th/h);g.drawImage(src,(tw-w*s)/2,(th-h*s)/2,w*s,h*s);return c.toDataURL('image/jpeg',.7);}
async function edLength(e){if(isFinite(e.duration)&&e.duration>0)return e.duration;
 await new Promise(res=>{const done=()=>{if(isFinite(e.duration)){e.removeEventListener('durationchange',done);res();}};e.addEventListener('durationchange',done);e.currentTime=1e7;setTimeout(res,4000);});
 const d=isFinite(e.duration)?e.duration:0;e.currentTime=0;return d;}
function edMediaDur(url,type){return new Promise((res,rej)=>{const e=document.createElement(type);e.preload='metadata';e.onloadedmetadata=()=>edLength(e).then(res);e.onerror=rej;e.src=url;});}
async function edVideoInfo(url){
 const v=document.createElement('video');v.muted=true;v.preload='auto';v.playsInline=true;v.src=url;
 await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=rej;});
 const dur=await edLength(v),w=v.videoWidth,h=v.videoHeight,thumbs=[];
 for(let k=0;k<6;k++){v.currentTime=Math.min(dur-.05,dur*(k+.5)/6);await Promise.race([new Promise(r=>v.addEventListener('seeked',r,{once:true})),new Promise(r=>setTimeout(r,1500))]);try{thumbs.push(edThumb(v,w,h));}catch{}}
 v.removeAttribute('src');v.load();
 return {dur,w,h,thumbs};
}
async function edPeaks(file){const ac=new AudioContext();try{const buf=await ac.decodeAudioData(await file.arrayBuffer());const d=buf.getChannelData(0),n=160,step=Math.floor(d.length/n)||1,out=[];for(let i=0;i<n;i++){let m=0;for(let j=i*step;j<(i+1)*step&&j<d.length;j+=8)m=Math.max(m,Math.abs(d[j]));out.push(Math.round(m*100)/100);}return out;}finally{ac.close();}}
