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
const ED_ANIMS=[['none','None'],['fade','Fade'],['pop','Pop'],['slide','Slide'],['zoom','Zoom'],['blur','Blur'],['type','Typewriter'],['words','Word by word']];
/** Speed curves: [position in the clip 0..1, speed multiplier], straight lines between points. */
const ED_RAMPS=[['montage','Montage',[[0,2.5],[.3,2.5],[.45,.5],[.55,.5],[.7,2.5],[1,2.5]]],['hero','Hero',[[0,1.5],[.4,1.5],[.5,.3],[.6,1.5],[1,1.5]]],
 ['bullet','Bullet',[[0,2],[.35,2],[.5,.2],[.65,2],[1,2]]],['jump','Jump cut',[[0,1],[.45,1],[.5,6],[.55,1],[1,1]]],['flashin','Flash in',[[0,6],[.35,1],[1,1]]],['flashout','Flash out',[[0,1],[.65,1],[1,6]]]];
const edRampAt=(r,p)=>{if(p<=r[0][0])return r[0][1];for(let i=1;i<r.length;i++)if(p<=r[i][0]){const [a,va]=r[i-1],[b,vb]=r[i];return va+(vb-va)*((p-a)/((b-a)||1));}return r[r.length-1][1];};
/** The area under the curve from 0 to p (so source time = in + speed x length x this). */
const edRampInt=(r,p)=>{let a=0;for(let i=1;i<r.length&&r[i-1][0]<p;i++){const x0=r[i-1][0],x1=Math.min(r[i][0],p);a+=(x1-x0)*(r[i-1][1]+edRampAt(r,x1))/2;}return a;};
const edRampAvg=r=>edRampInt(r,1);
/** The curve cut at p into the part before and the part after, each stretched back to 0..1. */
const edRampSplit=(r,p)=>{p=Math.min(.999,Math.max(.001,p));const v=edRampAt(r,p);
 return [[...r.filter(x=>x[0]<p).map(([q,s])=>[q/p,s]),[1,v]],[[0,v],...r.filter(x=>x[0]>p).map(([q,s])=>[(q-p)/(1-p),s])]];};
const ED_SHAPES=[['rect','Square'],['round','Rounded'],['circle','Circle'],['triangle','Triangle'],['star','Star'],['arrow','Arrow'],['line','Line'],['heart','Heart']];
const ED_EMOJI=['😀','😂','😍','🔥','👍','🎉','⭐','❤️','✅','❌','👉','💡','🚀','💯','👀','🎵'];
const ED_TRACKS0=()=>[{id:'text',kind:'text'},{id:'video',kind:'video',main:true},{id:'audio',kind:'audio'}];
const edClamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const edEase=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
/** How a keyframe moves to the next one. Smooth is the default (and what older projects had). */
const ED_EASES=[['smooth','Smooth'],['linear','Linear'],['in','Ease in'],['out','Ease out'],['hold','Hold']];
const edEaseFn={smooth:edEase,linear:u=>u,in:u=>u*u*u,out:u=>1-Math.pow(1-u,3),hold:()=>0};
/** Caption looks: how a caption shows its words (phrase, karaoke, one word, build up) plus its text style. */
const ED_CAPS=[['clean','Clean'],['karaoke','Karaoke'],['word','Word by word'],['build','Build up'],['boxed','Boxed']];
/** Spoken languages for auto captions: auto-detect, the studio's own, then many more (ISO 639 codes; names in their own language). */
const ED_CAP_LANGS=['auto','en','ckb','kmr','badini','ar','fa','tr','de','fr','es','it','pt','nl','ru','uk','pl','cs','sk','sv','no','da','fi','el','he','hi','ur','bn','pa','gu','mr','ta','te','kn','ml','si','ne',
 'ja','ko','zh','th','vi','id','ms','tl','my','km','lo','mn','kk','uz','az','ka','hy','tg','ky','ps','sw','am','ha','yo','ig','zu','so','ro','hu','bg','sr','hr','bs','sl','mk','sq','lt','lv','et','be','ca','eu','gl','cy','ga','is','mt','lb','af'];
/** Scripts written without spaces between words: lines break between characters or dictionary words there. */
const edNoSpace=s=>/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}]/u.test(s||'');
/** Right-to-left when the first letter is Arabic, Hebrew, Syriac, Thaana or N'Ko script. */
const edRtl=s=>/^[^\p{L}]*[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u.test(s||'');
const edArabicScript=s=>/\p{Script=Arabic}/u.test(s||'');
const edLen=s=>[...(typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(s||''):String(s||''))].length;
/** Words of a text in any language: spaces where the script uses them, else dictionary words (Intl.Segmenter). */
function edWords(text,lang){const t=String(text||'').trim();if(!t)return [];
 if(!edNoSpace(t)||typeof Intl==='undefined'||!Intl.Segmenter)return t.split(/\s+/);
 try{return [...new Intl.Segmenter(lang&&lang!=='auto'?lang:undefined,{granularity:'word'}).segment(t)].map(x=>x.segment).filter(x=>x.trim());}catch{return [...t].filter(x=>x.trim());}}
const ED_BLENDS=[['normal','Normal'],['multiply','Multiply'],['screen','Screen'],['overlay','Overlay'],['darken','Darken'],['lighten','Lighten'],['color-dodge','Colour dodge'],['color-burn','Colour burn'],
 ['hard-light','Hard light'],['soft-light','Soft light'],['difference','Difference'],['exclusion','Exclusion'],['hue','Hue'],['saturation','Saturation'],['color','Colour'],['luminosity','Luminosity']];
const ED_MASKS=[['none','None'],['rect','Rectangle'],['circle','Ellipse'],['linear','Linear']];
const Ed={
 p:null,media:[],urls:{},els:{},imgs:{},time:0,playing:false,sel:null,sels:new Set(),junction:null,zoom:40,snap:true,tab:'media',ptab:null,
 past:[],future:[],dom:{},ready:null,exporting:null,clipboard:null,guides:false,recording:null,
 // ---------- saving: everything in IndexedDB (projects, undo steps, the list, the files) ----------
 // Reads are from memory (filled by load()), so the page stays simple; every write goes to IndexedDB in order,
 // and "Saved" shows only once the browser has committed it. localStorage held only ~5 MB; older projects move here once.
 pjson:new Map(),plist:[],
 blank:()=>({v:3,name:'Untitled project',ratio:'16:9',bg:'#000000',bgMode:'color',magnet:true,markers:[],tracks:ED_TRACKS0(),clips:[]}),
 list(){return this.plist;},
 setList(l){this.plist=l;return this.persist([['meta','list',l]]);},
 readProject(id){const s=this.pjson.get(id);try{return s?JSON.parse(s):null;}catch{return null;}},
 writeProject(p){const s=JSON.stringify(p);this.pjson.set(p.id,s);return this.persist([['projects',p.id,s]]);},
 deleteProject(id){this.pjson.delete(id);this.plist=this.plist.filter(q=>q.id!==id);if(this.p?.id===id){clearTimeout(this.st);this.st=null;this.p=null;}
  return this.persist([['projects',id],['history',id],['meta','list',this.plist]]);},
 create(from){const id=this.uid(),p={...this.blank(),...(from||{}),id};p.updated=new Date().toISOString();
  this.writeProject(p);this.setList([this.entry(p,null),...this.list()]);return id;},
 entry(p,thumb){const end=(p.clips||[]).reduce((a,c)=>Math.max(a,c.start+c.dur),0);return {id:p.id,name:p.name,ratio:p.ratio,updated:p.updated||new Date().toISOString(),dur:end,clips:(p.clips||[]).length,thumb};},
 cover(){const cv=this.dom.canvas;if(!cv||!this.p.clips.length||this.exporting)return null;try{const [W,H]=this.size(),s=Math.min(320/W,320/H),c=document.createElement('canvas');c.width=Math.round(W*s);c.height=Math.round(H*s);c.getContext('2d').drawImage(cv,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.7);}catch{return null;}},
 save(){if(!this.p?.id)return;this.p.updated=new Date().toISOString();clearTimeout(this.st);this.st=setTimeout(()=>this.flush(),300);this.saved(false);},
 flush(){if(!this.p?.id)return Promise.resolve(true);clearTimeout(this.st);this.st=null;
  const id=this.p.id,s=JSON.stringify(this.p);this.pjson.set(id,s);
  const old=this.list().find(x=>x.id===id),e=this.entry(this.p,this.cover()??old?.thumb??null);this.plist=[e,...this.list().filter(x=>x.id!==id)];
  return this.persist([['projects',id,s],['history',id,{past:this.past.slice(-50),future:this.future.slice(-50)}],['meta','list',this.plist],['meta','media',this.media]])
   .then(ok=>{if(ok&&this.p?.id===id&&!this.st)this.saved(true);return ok;});},
 saved(done){const el=this.dom.saved;if(el)el.textContent=done?'Saved':'Saving…';},
 /** Writes in order, one transaction per call; a write never rejects (it says what went wrong once and returns false). */
 persist(ops){return this.wq=(this.wq||Promise.resolve(true)).then(()=>this.write(ops)).then(()=>true,e=>{
  if(!this.warned||Date.now()-this.warned>8000){this.warned=Date.now();toast(e?.name==='QuotaExceededError'?'This browser is out of room for the editor. Remove some media or old projects.':'Could not save the editor: '+(e?.message||e),true);}
  this.saved(false);return false;});},
 async write(ops){const d=await this.db(),stores=[...new Set(ops.map(o=>o[0]))];
  await new Promise((res,rej)=>{const t=d.transaction(stores,'readwrite');for(const [s,k,v] of ops){const st=t.objectStore(s);if(v===undefined)st.delete(k);else st.put(v,k);}
   t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('Saving was stopped'));});},
 async read(store,key){const d=await this.db();return new Promise(res=>{const q=d.transaction(store).objectStore(store).get(key);q.onsuccess=()=>res(q.result??null);q.onerror=()=>res(null);});},
 async readAll(store){const d=await this.db();return new Promise((res,rej)=>{const t=d.transaction(store),s=t.objectStore(store),k=s.getAllKeys(),v=s.getAll();t.oncomplete=()=>res(k.result.map((x,i)=>[x,v.result[i]]));t.onerror=()=>rej(t.error);});},
 db(){return this.dbp||(this.dbp=new Promise((res,rej)=>{const r=indexedDB.open('tempoloom-editor',2);
  r.onupgradeneeded=()=>{const d=r.result;for(const s of ['media','projects','history','meta'])if(!d.objectStoreNames.contains(s))d.createObjectStore(s);};
  r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();res(r.result);};r.onerror=()=>rej(r.error);
  r.onblocked=()=>toast('The Editor is open in another tab with an older version. Close that tab to continue.',true);}));},
 put(id,blob){return this.write([['media',id,blob]]);},
 get(id){return this.read('media',id);},
 del(id){return this.write([['media',id]]);},
 /** Projects saved by earlier versions in localStorage move to IndexedDB once; the old keys go only after the move is committed. */
 async fromLocal(){
  let ls;try{ls=window.localStorage;if(!ls)return;}catch{return;}
  const keys=Object.keys(ls).filter(k=>/^editor-(p:|h:|projects$|media$|project$)/.test(k));if(!keys.length)return;
  const json=k=>{try{return JSON.parse(ls.getItem(k)||'null');}catch{return null;}};
  {// merged by id: what IndexedDB already has wins
   const ops=[],had=new Set(this.pjson.keys()),list=[...this.plist],media=[...this.media];
   for(const k of keys){const id=k.slice(9);if(had.has(id))continue;
    if(k.startsWith('editor-p:')){const v=ls.getItem(k);if(v)ops.push(['projects',id,v]);}else if(k.startsWith('editor-h:')){const h=json(k);if(h)ops.push(['history',id,h]);}}
   const moved=new Set(ops.filter(o=>o[0]==='projects').map(o=>o[1]));
   for(const e of json('editor-projects')||[])if(moved.has(e?.id)&&!list.some(x=>x.id===e.id))list.push(e);
   for(const m of json('editor-media')||[])if(m?.id&&!media.some(x=>x.id===m.id))media.push(m);
   ops.push(['meta','list',list],['meta','media',media]);
   try{await this.write(ops);}catch(e){toast('Could not move your editor projects to the new storage: '+(e?.message||e),true);return;}
   for(const [s,k,v] of ops)if(s==='projects')this.pjson.set(k,v);this.plist=list;this.media=media;
   const old=json('editor-project');if(old?.clips?.length&&!this.plist.length)this.create(old);
  }
  for(const k of keys)try{ls.removeItem(k);}catch{}
 },
 load(){return this.ready||(this.ready=(async()=>{
  try{await this.db();}catch{toast('This browser cannot keep editor projects (its storage is off). Edits last until you reload.',true);return;}
  for(const [k,v] of await this.readAll('projects'))if(typeof v==='string')this.pjson.set(k,v);
  this.plist=(await this.read('meta','list'))||[];this.media=(await this.read('meta','media'))||[];
  await this.fromLocal();
  this.plist=this.plist.filter(x=>this.pjson.has(x.id));
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
  this.read('history',id).then(h=>{if(h&&this.p?.id===id&&!this.past.length&&!this.future.length){this.past=h.past||[];this.future=h.future||[];}}).catch(()=>{});
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
 after(all){this._dk=null;this.pack();this.tidy();for(const id of [...this.sels])if(!this.clip(id))this.sels.delete(id);if(this.sel&&!this.clip(this.sel))this.sel=[...this.sels].pop()||null;if(this.junction&&!this.clip(this.junction))this.junction=null;
  this.save();this.drawTimeline();if(all)this.drawProps();this.sync();this.draw();this.drawTime();},
 // ---------- importing ----------
 async importFiles(files){
  const list=[...files].filter(f=>/^(video|image|audio)\//.test(f.type));
  if(!list.length){toast('Choose videos, photos or audio.',true);return [];}
  const made=[];navigator.storage?.persist?.().catch(()=>{});
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
 pick(id,add){this.junction=null;if(!id){this.sels.clear();this.sel=null;return;}
  const c=this.clip(id),mates=c?.group&&!this.solo?this.p.clips.filter(o=>o.group===c.group).map(o=>o.id):[id];
  if(add){if(this.sels.has(id)){for(const m of mates)this.sels.delete(m);this.sel=[...this.sels].pop()||null;}else{for(const m of mates)this.sels.add(m);this.sel=id;}}else{this.sels=new Set(mates);this.sel=id;}},
 group(){const list=this.picked();if(list.length<2)return toast('Select two or more clips to group them.');this.snapshot();const g=this.uid();for(const c of list)c.group=g;this.after(true);toast(`Grouped ${list.length} clips`);},
 ungroup(){const list=this.picked().filter(c=>c.group);if(!list.length)return toast('Nothing selected is grouped.');this.snapshot();for(const c of list)delete c.group;this.after(true);toast('Ungrouped');},
 /** New copies get new group ids, so they do not join the group of what they were copied from. */
 regroup(list){const map={};for(const c of list)if(c.group)c.group=map[c.group]||(map[c.group]=this.uid());},
 select(id,add){this.pick(id,add);this.drawTimeline();this.drawProps();this.draw();},
 selectJoin(id){this.sels.clear();this.sel=null;this.junction=id;this.drawTimeline();this.drawProps();this.draw();},
 // ---------- editing ----------
 split(){
  const t=this.time,inside=x=>t>x.start+.05&&t<x.start+x.dur-.05&&!this.trackOf(x)?.locked;
  let list=this.picked().filter(inside);
  if(!list.length){const c=this.p.clips.find(x=>x.track===this.main()?.id&&inside(x))||this.p.clips.find(inside);if(c)list=[c];}
  if(!list.length)return toast('Move the playhead over a clip to split it.');
  this.snapshot();let last=null;const parts=[];
  for(const c of list){const b=this.splitClip(c,t);parts.push(b);last=b.id;}this.regroup(parts);
  this.pick(last);this.after(true);
 },
 // ---------- time map: where in the file a clip is at timeline time t (constant speed or a speed curve) ----------
 srcAt(c,t){const lt=edClamp(t-c.start,0,c.dur),sp=c.speed||1;return (c.in||0)+(c.ramp?sp*c.dur*edRampInt(c.ramp,lt/(c.dur||1)):lt*sp);},
 rateAt(c,t){const sp=c.speed||1;return c.ramp?sp*edRampAt(c.ramp,edClamp((t-c.start)/(c.dur||1),0,1)):sp;},
 srcSpan(c){return this.srcAt(c,c.start+c.dur)-(c.in||0);},
 /** A speed curve (null = none); the clip keeps the same part of the file, so its length changes. */
 setRamp(c,pts,quiet){if(!quiet)this.snapshot();const S=this.srcSpan(c),sp=c.speed||1;
  if(pts){c.ramp=pts.map(([p,v])=>[p,edClamp(v,.1,10)]);c.dur=Math.max(.1,S/(sp*edRampAvg(c.ramp)));}else{delete c.ramp;c.dur=Math.max(.1,S/sp);}
  c.fadeIn=Math.min(c.fadeIn||0,c.dur/2);c.fadeOut=Math.min(c.fadeOut||0,c.dur/2);if(!quiet)this.after(true);},
 /** Cuts one clip in two at time t (no undo step); returns the second part. */
 splitClip(c,t){const first=t-c.start,b={...c,id:this.uid(),start:t,in:this.srcAt(c,t),dur:c.dur-first};delete b.trans;
  if(c.ramp){const [r1,r2]=edRampSplit(c.ramp,first/c.dur);c.ramp=r1;b.ramp=r2;}
  if(c.kf){b.kf={};c.kf=Object.fromEntries(Object.entries(c.kf).map(([k,f])=>{b.kf[k]=f.filter(x=>x.t>=first).map(x=>({...x,t:x.t-first}));return [k,f.filter(x=>x.t<=first)];}));}
  c.dur=first;c.fadeOut=0;b.fadeIn=0;this.p.clips.push(b);return b;},
 /** Moves every clip on a track that starts at or after `from` by d seconds (negative = left). */
 shiftTrack(trackId,from,d,except){for(const o of this.p.clips)if(o.track===trackId&&o.start>=from-.001&&o!==except)o.start=Math.max(0,o.start+d);},
 /** The clips the playhead tools act on: the selected ones under the playhead, else the main track's clip there, else any. */
 underHead(){const t=this.time,inside=x=>t>x.start+.02&&t<x.start+x.dur-.02&&!this.trackOf(x)?.locked;
  const s=this.picked().filter(inside);if(s.length)return s;const c=this.p.clips.find(x=>x.track===this.main()?.id&&inside(x))||this.p.clips.find(inside);return c?[c]:[];},
 /** Ripple delete: the selection goes and what comes after it on the same track moves left to close the space. */
 rippleRemove(){
  const list=this.picked().filter(c=>!this.trackOf(c)?.locked);if(!list.length)return toast('Select a clip to ripple delete.');
  this.snapshot();const gone=new Set(list.map(c=>c.id));this.p.clips=this.p.clips.filter(x=>!gone.has(x.id));
  for(const id of gone){this.els[id]?.pause?.();delete this.els[id];}
  const byTrack=new Map();for(const c of list){if(!byTrack.has(c.track))byTrack.set(c.track,[]);byTrack.get(c.track).push([c.start,c.start+c.dur]);}
  for(const [tr,spans] of byTrack){spans.sort((a,b)=>b[0]-a[0]);// right to left, so earlier shifts do not move later spans
   for(const [s,e] of spans){const len=e-s,free=this.p.clips.filter(o=>o.track===tr&&o.start<e-.001&&o.start+o.dur>s+.001).length===0;if(free)this.shiftTrack(tr,e,-len);}}
  this.pick(null);this.after(true);toast(list.length>1?`Ripple deleted ${list.length} clips`:'Ripple deleted');
 },
 /** The empty space at time t on a track, between the clip before it and the clip after it. */
 gapAt(trackId,t){const cl=this.p.clips.filter(c=>c.track===trackId).sort((a,b)=>a.start-b.start);if(cl.some(c=>t>=c.start&&t<c.start+c.dur))return null;
  const next=cl.find(c=>c.start>t);if(!next)return null;const prev=[...cl].reverse().find(c=>c.start+c.dur<=t+.001);const s=prev?prev.start+prev.dur:0;return next.start-s>.01?{s,e:next.start}:null;},
 closeGap(trackId,t){const tr=this.p.tracks.find(x=>x.id===trackId);if(!tr||tr.locked)return;const g=this.gapAt(trackId,t);if(!g)return;
  this.snapshot();this.shiftTrack(trackId,g.e,-(g.e-g.s));this.after(true);toast('Gap closed');},
 /** Trim to the playhead and close the space (Q: the part before it goes; W: the part after it goes). */
 trimTo(side){
  const t=this.time,list=this.underHead();if(!list.length)return toast('Move the playhead over a clip.');
  this.snapshot();let back=null;
  for(const c of list){const sp=c.speed||1,end=c.start+c.dur;
   if(side==='start'){const d=t-c.start;if(c.media)c.in=this.srcAt(c,t);if(c.ramp)c.ramp=edRampSplit(c.ramp,d/c.dur)[1];c.dur-=d;delete c.trans;
    if(c.kf)for(const k of Object.keys(c.kf)){const f=c.kf[k];const v0=this.val({...c,dur:c.dur+d,kf:{[k]:f}},k,t);c.kf[k]=[{t:0,v:v0},...f.filter(x=>x.t>d).map(x=>({...x,t:x.t-d}))];}
    this.shiftTrack(c.track,end,-d,c);back=back??c.start;}
   else{const d=end-t;if(c.ramp)c.ramp=edRampSplit(c.ramp,(c.dur-d)/c.dur)[0];c.dur-=d;this.shiftTrack(c.track,end,-d,c);}
   c.fadeIn=Math.min(c.fadeIn||0,c.dur/2);c.fadeOut=Math.min(c.fadeOut||0,c.dur/2);}
  this.after(true);if(back!==null)this.seek(back);
 },
 /** Freeze frame: the frame under the playhead held as a picture for 2 seconds; what follows moves right. */
 async freeze(){
  const t=this.time,isVid=x=>!x.asAudio&&this.mediaOf(x)?.type==='video'&&!this.trackOf(x)?.locked&&t>=x.start&&t<x.start+x.dur;
  const c=this.picked().find(isVid)||this.p.clips.find(x=>x.track===this.main()?.id&&isVid(x))||this.p.clips.find(isVid);
  if(!c)return toast('Move the playhead over a video clip to freeze its frame.');
  const m=this.mediaOf(c),el=this.element(c);this.pause();
  try{await edReady(el,m.name);await this.seekExact(t);}catch(e){return toast(e.message,true);}
  const cv=document.createElement('canvas');cv.width=m.w||el.videoWidth;cv.height=m.h||el.videoHeight;cv.getContext('2d').drawImage(el,0,0,cv.width,cv.height);
  const blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(!blob)return toast('Could not take the frame.',true);
  const [img]=await this.importFiles([new File([blob],`Freeze ${m.name.replace(/\.\w{2,5}$/,'')} ${edFmt(t).replace(/:/g,'.')}.png`,{type:'image/png'})]);if(!img)return;
  const F=2;this.snapshot();let at=t;
  if(t>c.start+.02&&t<c.start+c.dur-.02)this.splitClip(c,t);else at=t<=c.start+.02?c.start:c.start+c.dur;
  this.shiftTrack(c.track,at,F);
  const f={id:this.uid(),track:c.track,media:img.id,start:at,in:0,dur:F,speed:1,volume:1,fadeIn:0,fadeOut:0};
  for(const k of ['flipH','flipV','crop','adj'])if(c[k]!==undefined)f[k]=JSON.parse(JSON.stringify(c[k]));
  for(const k of ['scale','x','y','rotate','opacity'])f[k]=this.val(c,k,t);
  this.p.clips.push(f);this.pick(f.id);this.after(true);toast('Frame frozen for 2 seconds');
 },
 /** Replace: other media in the clip; its place, length, effects and keyframes stay. */
 replaceClip(c,mid){
  const m=this.media.find(x=>x.id===mid);if(!c||!m||c.media===mid)return;
  if(m.type==='video'&&!m.dur)return toast('Still reading this video. Try again in a moment.');
  this.snapshot();const sp=c.speed||1;c.media=mid;c.in=0;delete c.detached;this.els[c.id]?.pause?.();delete this.els[c.id];
  let short=false;if(m.type!=='image'&&m.dur){const max=m.dur/sp;if(c.dur>max+.001){c.dur=max;short=true;}}
  c.fadeIn=Math.min(c.fadeIn||0,c.dur/2);c.fadeOut=Math.min(c.fadeOut||0,c.dur/2);
  this.after(true);toast(short?'Replaced. The new file is shorter, so the clip is too.':'Replaced');
 },
 // ---------- in and out: a range of the timeline, to export only that part ----------
 setRange(which){const t=Math.round(this.time*30)/30;this.snapshot();const r={...(this.p.range||{})};r[which]=t;
  if(r.in!=null&&r.out!=null&&r.out<=r.in)delete r[which==='in'?'out':'in'];this.p.range=r;this.after(false);},
 clearRange(){if(!this.p.range)return;this.snapshot();delete this.p.range;this.after(false);},
 rangeSpan(){const r=this.p.range;if(!r||(r.in==null&&r.out==null))return null;const s=Math.max(0,r.in??0),e=Math.min(r.out??this.end(),this.end());return e-s>.05?{s,e}:null;},
 // ---------- shuttle: J back, K stop, L forward; again for 2×, 4×, 8× ----------
 shuttle(dir){
  if(!dir){if(this.playing)this.pause();this.rate=1;this.drawTime();return;}
  if(!this.p.clips.length)return;
  this.rate=this.playing&&Math.sign(this.rate)===dir?edClamp(this.rate*2,-8,8):dir;
  if(!this.playing)this.start();else{this.t0=this.time;this.p0=performance.now();this.sync();}this.drawTime();
 },
 remove(){
  if(this.junction){const c=this.clip(this.junction);if(c?.trans){this.snapshot();delete c.trans;this.junction=null;this.after(true);}return;}
  const list=this.picked().filter(c=>!this.trackOf(c)?.locked);if(!list.length)return;this.snapshot();const gone=new Set(list.map(c=>c.id));
  this.p.clips=this.p.clips.filter(x=>!gone.has(x.id));for(const id of gone){this.els[id]?.pause?.();delete this.els[id];}this.pick(null);this.after(true);},
 duplicate(){const list=this.picked();if(!list.length)return;this.snapshot();this.sels.clear();
  const made=[];for(const c of list){const start=c.start+c.dur,d={...JSON.parse(JSON.stringify(c)),id:this.uid(),start};d.track=this.place(this.kindOf(c),start,c.dur,c.track);this.p.clips.push(d);made.push(d);this.sels.add(d.id);this.sel=d.id;}this.regroup(made);this.after(true);},
 copy(cut){const list=this.picked();if(!list.length)return;this.clipboard=JSON.parse(JSON.stringify(list.map(c=>({...c,kind:this.kindOf(c)}))));toast(cut?`Cut ${list.length}`:`Copied ${list.length}`);if(cut)this.remove();},
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
 // ---------- transitions: on the clip that comes after the cut ----------
 prevOf(c){return this.p.clips.find(o=>o.track===c.track&&o.id!==c.id&&Math.abs(o.start+o.dur-c.start)<.05);},
 setTrans(c,type,dur){if(!c)return;this.snapshot();if(type==='none')delete c.trans;else c.trans={type,dur:dur??c.trans?.dur??.6};this.after(true);},
 transAll(type,dur){this.snapshot();for(const c of this.p.clips.filter(c=>this.kindOf(c)==='video'))if(this.prevOf(c)){if(type==='none')delete c.trans;else c.trans={type,dur};}this.after(true);},
 // ---------- keyframes: per property, at times from the clip's start ----------
 val(c,k,t=this.time){const d={scale:1,opacity:1,volume:1}[k]??0,f=c.kf?.[k];if(!f?.length)return c[k]??d;const lt=edClamp(t-c.start,0,c.dur);
  if(lt<=f[0].t)return f[0].v;const last=f[f.length-1];if(lt>=last.t)return last.v;const i=f.findIndex(x=>x.t>lt),a=f[i-1],b=f[i];return a.v+(b.v-a.v)*(edEaseFn[a.e]||edEase)((lt-a.t)/(b.t-a.t||1));},
 /** The easing of the keyframes at the playhead (all properties of the clip), or null. */
 kfEaseAt(c){let e=null;for(const f of Object.values(c.kf||{})){const x=f.find(x=>Math.abs(x.t-(this.time-c.start))<1/60);if(x){e=x.e||'smooth';break;}}return e;},
 setKfEase(c,e){this.snapshot();for(const f of Object.values(c.kf||{}))for(const x of f)if(Math.abs(x.t-(this.time-c.start))<1/60){if(e==='smooth')delete x.e;else x.e=e;}this.after(true);},
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
 // Sound: every element -> its own gain (so a clip can go above 100%) -> master -> speakers, the recorder and the meter.
 audio(){if(this.ac)return;try{const ac=this.ac=new AudioContext();this.rec=ac.createMediaStreamDestination();this.master=ac.createGain();this.master.connect(ac.destination);this.master.connect(this.rec);
  const sp=ac.createChannelSplitter(2);this.master.connect(sp);this.meters=[0,1].map(i=>{const a=ac.createAnalyser();a.fftSize=1024;sp.connect(a,i);return a;});
  for(const el of Object.values(this.els))this.route(el);}catch{this.ac=null;}},
 route(el){if(el._routed||!this.ac)return;try{const s=this.ac.createMediaElementSource(el),g=this.ac.createGain();s.connect(g);g.connect(this.master);el._gain=g;el._routed=true;}catch{}},
 fade(c,t){const tt=edClamp(t,c.start,c.start+c.dur);let v=1;const local=tt-c.start;if(c.fadeIn&&local<c.fadeIn)v*=Math.max(0,local/c.fadeIn);if(c.fadeOut&&c.start+c.dur-tt<c.fadeOut)v*=Math.max(0,(c.start+c.dur-tt)/c.fadeOut);return v;},
 /** A clip's loudness at t: volume (keyframes), fades, loudness match (gainDb) and ducking. Playback and export both use it. */
 vol(c,t){const tr=this.trackOf(c);if(tr?.muted||(c.detached&&!c.asAudio))return 0;
  return edClamp(this.val(c,'volume',t)*this.fade(c,t)*edDb(c.gainDb||0)*(c.duck?this.duckAt(t,c):1),0,8);},
 // ---------- ducking: music goes down while someone speaks ----------
 /** Clips that count as speech: every clip with sound that is not itself ducked. */
 voices(){return this.p.clips.filter(c=>c.media&&!c.duck&&!this.trackOf(c)?.muted&&!(c.detached&&!c.asAudio)&&this.mediaOf(c)?.type!=='image');},
 /** 0..1 at 20 per second: how far ducked clips are pulled down. Speech holds it, it eases in 0.15 s early and out over 0.5 s. */
 duckCurve(){if(this._dk)return this._dk;const R=20,n=Math.ceil(this.end()*R)+2,on=new Float32Array(n);
  for(const c of this.voices()){const m=this.mediaOf(c);if(!m.env){this.loadEnv(m);continue;}const sp=c.speed||1;
   for(let i=Math.ceil(c.start*R);i<=Math.floor((c.start+c.dur)*R)&&i<n;i++){const e=m.env[Math.floor(((c.in||0)+(i/R-c.start)*sp)*R)]||0;if(e>.02)on[i]=1;}}
  const d=new Float32Array(n),hold=Math.round(.3*R);let last=-1e9;
  for(let i=0;i<n;i++){if(on[i])last=i;d[i]=i-last<=hold?1:Math.max(0,(i>0?d[i-1]:0)-1/(.5*R));}
  for(let i=n-2;i>=0;i--)d[i]=Math.max(d[i],d[i+1]-1/(.15*R));
  return this._dk=d;},
 duckAt(t,c){const d=this.duckCurve(),x=t*20,i=Math.floor(x),a=d[i]||0,b=d[i+1]||0;return edDb((c.duck.db??-12)*(a+(b-a)*(x-i)));},
 /** The loudness over time of a file (RMS, 20 per second), read once and kept with the file. */
 envp:new Map(),
 loadEnv(m){if(m.env)return;if(this.envp.has(m.id))return this.envp.get(m.id);
  const p=(async()=>{try{const b=await this.get(m.id);const buf=b&&await edDecode(b);m.env=buf?edEnvelope(buf,20):[];}catch{m.env=[];}
   this._dk=null;this.save();if(!this.playing)this.sync();})();this.envp.set(m.id,p);return p;},
 async ensureEnvs(){if(!this.p.clips.some(c=>c.duck))return;await Promise.all(this.voices().map(c=>this.loadEnv(this.mediaOf(c))));this._dk=null;},
 setDuck(c,on,db){this.snapshot();if(on)c.duck={db:db??c.duck?.db??-12};else delete c.duck;this.after(true);if(on)this.ensureEnvs().then(()=>{this.sync();});},
 // ---------- loudness: match a clip to a target (EBU R128 / BS.1770 integrated loudness) ----------
 async loudnessOf(m){if(typeof m.lufs==='number'||m.lufs===null)return m.lufs;const b=await this.get(m.id);const buf=b&&await edDecode(b).catch(()=>null);m.lufs=buf?await edLufs(buf):null;this.save();return m.lufs;},
 async matchLoudness(list,target=-14){
  const done=[],none=[];const want=list.filter(c=>c.media&&this.mediaOf(c)?.type!=='image');if(!want.length)return toast('Choose a clip with sound.');
  for(const c of want){const m=this.mediaOf(c),l=await this.loudnessOf(m);if(l==null||!isFinite(l))none.push(m.name);else done.push([c,edClamp(target-l,-20,20)]);}
  if(done.length){this.snapshot();for(const [c,g] of done)c.gainDb=Math.round(g*10)/10;this.after(true);}
  toast(done.length?`Loudness matched to ${target} LUFS${done.length>1?` on ${done.length} clips`:''}${none.length?`; no sound in ${none.join(', ')}`:''}`:'No sound was found to measure.');
 },
 sync(){
  const t=this.time;
  for(const c of this.p.clips){
   if(c.text!==undefined||c.sticker)continue;const m=this.mediaOf(c);if(!m||m.type==='image')continue;
   const el=this.element(c);if(!el)continue;
   const on=t>=c.start&&t<c.start+c.dur,want=this.srcAt(c,t);
   if(on){
    const fwd=this.playing&&this.rate>0;
    el.playbackRate=edClamp(this.rateAt(c,t)*(fwd?this.rate:1),.0625,16);const v=this.vol(c,t);if(el._gain){el.volume=1;el._gain.gain.value=v;}else el.volume=Math.min(1,v);
    if(fwd){if(el.paused){try{el.currentTime=want;}catch{}el.play().catch(()=>{});}else if(Math.abs(el.currentTime-want)>.3*Math.max(1,this.rate))el.currentTime=want;}
    else{if(!el.paused)el.pause();if(Math.abs(el.currentTime-want)>.03){try{el.currentTime=want;}catch{}}}
   }else{if(!el.paused)el.pause();
    // Just before or after its turn, a clip waits on its first or last frame (for transitions).
    const pre=c.start-t>0&&c.start-t<1.5,post=t-(c.start+c.dur)>=0&&t-(c.start+c.dur)<1.5;
    if(pre||post){const w=pre?(c.in||0):this.srcAt(c,c.start+c.dur)-.05;if(Math.abs(el.currentTime-w)>.06){try{el.currentTime=Math.max(0,w);}catch{}}}}
  }
 },
 rate:1,
 play(){
  if(this.playing)return this.pause();
  this.rate=1;this.start();
 },
 start(){
  if(!this.p.clips.length)return;
  this.audio();this.ac?.resume?.();
  if(this.rate>0&&this.time>=this.end()-.05)this.time=0;
  if(this.rate<0&&this.time<=.05)this.time=this.end();
  this.playing=true;this.t0=this.time;this.p0=performance.now();this.drawTime();
  const tick=now=>{
   if(!this.playing)return;
   if(!document.contains(this.dom.canvas)){this.pause();return;}
   this.time=this.t0+(now-this.p0)/1000*this.rate;
   if(this.time<=0&&this.rate<0){this.time=0;this.pause();return;}
   const end=this.exporting?.until??this.end();if(this.time>=end){this.time=end;this.pause();if(this.exporting)this.finishExport();return;}
   this.sync();this.draw();this.drawHead();this.drawTime();this.drawMeter?.();
   requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
 },
 pause(){this.playing=false;for(const el of Object.values(this.els))el.pause?.();if(this.p){this.sync();this.draw();this.drawTime();this.drawMeter?.();}},
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
 /** Does this clip need its own layer (blend mode, green screen or mask)? */
 layered(c){return (c.blend&&c.blend!=='normal')||c.key?.on||(c.mask&&c.mask.shape&&c.mask.shape!=='none');},
 /** Draws the clip alone on a layer, keys out its colour, cuts it with its mask, then blends the layer onto the frame. */
 drawLayered(g,c,t,o){
  const [W,H]=this.size(),L=this._layer||(this._layer=document.createElement('canvas'));if(L.width!==W||L.height!==H){L.width=W;L.height=H;}
  const lg=L.getContext('2d',{willReadFrequently:true});lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='source-over';lg.globalAlpha=1;lg.filter='none';lg.clearRect(0,0,W,H);
  this.drawClip(lg,c,t,{...o,flat:true});
  const b=this.box(lg,c,W,H,t),rot=this.val(c,'rotate',t)*Math.PI/180,k=(o.k||1),cx=b.cx+(o.dx||0),cy=b.cy+(o.dy||0);
  if(c.key?.on&&!this.picking){const hw=(Math.abs(Math.cos(rot))*b.w+Math.abs(Math.sin(rot))*b.h)*k/2,hh=(Math.abs(Math.sin(rot))*b.w+Math.abs(Math.cos(rot))*b.h)*k/2;
   const x0=Math.max(0,Math.floor(cx-hw)),y0=Math.max(0,Math.floor(cy-hh)),x1=Math.min(W,Math.ceil(cx+hw)),y1=Math.min(H,Math.ceil(cy+hh));
   if(x1>x0&&y1>y0){const im=lg.getImageData(x0,y0,x1-x0,y1-y0);edKey(im.data,c.key);lg.putImageData(im,x0,y0);}}
  const mk=c.mask;
  if(mk&&mk.shape&&mk.shape!=='none'){lg.save();lg.globalCompositeOperation=mk.invert?'destination-out':'destination-in';lg.translate(cx,cy);lg.rotate(rot);lg.scale(k,k);
   const mw=b.w*(mk.w??.8),mh=b.h*(mk.h??.8),mx=b.w*(mk.x||0),my=b.h*(mk.y||0),fe=(mk.feather||0)*this.k();
   if(mk.shape==='linear'){const a=(mk.angle||0)*Math.PI/180,R=Math.hypot(b.w,b.h),dx=Math.sin(a),dy=-Math.cos(a),half=Math.max(.5,fe);
    const gr=lg.createLinearGradient(mx-dx*half,my-dy*half,mx+dx*half,my+dy*half);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,1)');lg.fillStyle=gr;lg.fillRect(-R,-R,2*R,2*R);}
   else{if(fe)lg.filter=`blur(${fe}px)`;lg.fillStyle='#000';lg.beginPath();
    if(mk.shape==='circle')lg.ellipse(mx,my,mw/2,mh/2,0,0,Math.PI*2);else lg.roundRect(mx-mw/2,my-mh/2,mw,mh,Math.min(mw,mh)/2*(mk.round||0));lg.fill();}
   lg.restore();}
  g.save();g.globalCompositeOperation=c.blend&&c.blend!=='normal'?c.blend:'source-over';g.drawImage(L,0,0);g.restore();
 },
 drawClip(g,c,t,o={}){
  if(!o.flat&&this.layered(c))return this.drawLayered(g,c,t,o);
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
 animApply(c,t){const {i,o}=this.anim(c,t),r={alpha:1,k:1,dy:0,chars:1,blur:0,words:1};
  const one=(type,p)=>{if(p>=1)return;const e=edEase(p);if(type==='fade')r.alpha*=e;else if(type==='pop'){const b=1-Math.pow(1-p,3);r.k*=.5+.5*b+Math.sin(p*Math.PI)*.12;r.alpha*=Math.min(1,p*3);}else if(type==='slide'){r.dy+=(1-e)*.08;r.alpha*=e;}else if(type==='type')r.chars=Math.min(r.chars,p);
   else if(type==='zoom'){r.k*=1+(1-e)*.6;r.alpha*=e;}else if(type==='blur'){r.blur=Math.max(r.blur||0,(1-e)*24);r.alpha*=e;}else if(type==='words')r.words=p;};
  one(c.animIn,i);one(c.animOut,o);return r;},
 lines(g,c,W){const tx=String(c.text||'');if(edNoSpace(tx))return edPack(g,edWords(tx,c.lang),'',W*.86).map(l=>l.join(''));const words=tx.split(/\s+/);const out=[];let line='';for(const w of words){const next=line?line+' '+w:w;if(g.measureText(next).width>W*.86&&line){out.push(line);line=w;}else line=next;}if(line)out.push(line);return out.length?out:[''];},
 font(c,t){return `${c.weight||600} ${Math.round((c.size||40)*this.val(c,'scale',t)*this.k())}px "${c.font||'Tempoloom UI'}", "Tempoloom UI", system-ui, sans-serif`;},
 textBox(g,c,W,H,t=this.time){if(c.words?.length)return this.capBox(g,c,W,H,t);g.save();g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;const ls=this.lines(g,c,W),lh=(c.size||40)*this.val(c,'scale',t)*this.k()*1.25,w=Math.max(...ls.map(l=>g.measureText(l).width))+lh*.6,h=ls.length*lh+lh*.3;g.restore();
  return {w,h,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H,ls,lh};},
 drawText(g,c,W,H,t=this.time,o={}){
  if(c.words?.length)return this.drawCaption(g,c,W,H,t,o);
  const b=this.textBox(g,c,W,H,t),an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha;if(a<=0)return;
  g.save();g.globalAlpha=a;g.translate(b.cx+(o.dx||0),b.cy+(o.dy||0)+an.dy*H);g.rotate(this.val(c,'rotate',t)*Math.PI/180);g.scale(an.k,an.k);if(an.blur)g.filter=`blur(${an.blur*this.k()}px)`;g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;g.textBaseline='middle';g.direction=edRtl(c.text)?'rtl':'ltr';
  if(c.box){g.fillStyle=c.boxColor||'#000';g.globalAlpha=a*.72;g.beginPath();g.roundRect(-b.w/2,-b.h/2,b.w,b.h,b.lh*.25);g.fill();g.globalAlpha=a;}
  g.textAlign=c.align||'center';const x=c.align==='left'?-b.w/2+b.lh*.3:c.align==='right'?b.w/2-b.lh*.3:0;
  let ls=b.ls;if(an.chars<1){let n=Math.round(ls.join(' ').length*an.chars);ls=ls.map(l=>{const s=l.slice(0,Math.max(0,n));n-=l.length+1;return s;});}
  const paint=(l,x,y)=>{
   if(c.shadow&&!c.box){g.shadowColor='rgba(0,0,0,.5)';g.shadowBlur=b.lh*.25;g.shadowOffsetY=b.lh*.05;}
   if(c.stroke){g.lineJoin='round';g.lineWidth=c.stroke*this.k()*2;g.strokeStyle=c.strokeColor||'#000';g.strokeText(l,x,y);g.shadowColor='transparent';}
   g.fillStyle=c.color||'#fff';g.fillText(l,x,y);};
  if(an.words<1){// word by word: each whole word rises in after the one before (right to left for Arabic-script text)
   const rtl=/[\u0590-\u08FF\uFB1D-\uFEFF]/.test(c.text||''),all=ls.map(l=>l.split(' ')),N=all.flat().length||1,sp=g.measureText(' ').width;let n=0;
   g.textAlign='left';
   all.forEach((ws,i)=>{const y=-b.h/2+b.lh*.15+b.lh*(i+.5),wd=ws.map(w=>g.measureText(w).width),lw=wd.reduce((a,v)=>a+v,0)+sp*(ws.length-1);
    let xs=c.align==='left'?-b.w/2+b.lh*.3:c.align==='right'?b.w/2-b.lh*.3-lw:-lw/2;const pos=[];let cur=xs;for(const v of wd){pos.push(cur);cur+=v+sp;}
    ws.forEach((w,j)=>{const at=rtl?xs+lw-(pos[j]-xs)-wd[j]:pos[j],k=n++,u=edClamp((an.words-k/N*.7)/.3,0,1),e=edEase(u);if(u<=0)return;
     g.globalAlpha=a*e;paint(w,at,y+(1-e)*b.lh*.45);});});
   g.globalAlpha=a;}
  else ls.forEach((l,i)=>paint(l,x,-b.h/2+b.lh*.15+b.lh*(i+.5)));
  g.restore();
 },
 drawSticker(g,c,W,H,t=this.time,o={}){
  const r=this.rect(c,W,H,t),an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha;if(a<=0)return;
  g.save();g.globalAlpha=a;g.translate(r.cx+(o.dx||0),r.cy+(o.dy||0)+an.dy*H);g.rotate(this.val(c,'rotate',t)*Math.PI/180);g.scale(an.k,an.k);if(an.blur)g.filter=`blur(${an.blur*this.k()}px)`;
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
 // ---------- exporting: every frame drawn at its exact time and encoded (WebCodecs), the sound mixed offline;
 // ffmpeg on this computer puts them together. Browsers without WebCodecs record while it plays (exportLive). ----------
 async exportVideo(o){
  if(this.exporting)return;
  if(o.live)return this.exportLive(o);
  const scale=o.height/Math.min(...this.base()),fps=o.fps,t0=this.time;
  this.pause();
  this.exporting={scale,format:o.format,fps,name:o.name,studio:!!o.studio,offline:true};
  const ex=this.exporting,[W,H]=this.size(),cfg=await edVideoConfig(W,H,fps,Math.min(60e6,Math.max(4e6,Math.round(W*H*fps*.12))));
  if(!cfg){this.exporting=null;return this.exportLive(o);}
  this.pick(null);this.drawTimeline();this.drawProps();this.fit();this.drawExport('Getting ready…');
  const span=o.range||{s:0,e:this.end()},frames=Math.max(1,Math.ceil((span.e-span.s)*fps-1e-6)),chunks=[];let err=null;
  try{
   await this.exportReady();
   this.drawExport('Mixing the sound…');
   await this.ensureEnvs();const wav=edWav(await this.mixAudio(span.s,frames/fps));if(ex.cancelled)return;
   const enc=ex.enc=new VideoEncoder({output:ch=>{const b=new Uint8Array(ch.byteLength);ch.copyTo(b);chunks.push({b,pts:Math.round(ch.timestamp*fps/1e6)});},error:e=>{err=e;}});
   enc.configure(cfg);
   for(let i=0;i<frames&&!ex.cancelled;i++){
    if(err)throw err;
    const t=span.s+i/fps;this.time=t;await this.seekExact(t);if(ex.cancelled)break;this.time=t;this.draw();
    const f=new VideoFrame(this.dom.canvas,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});
    enc.encode(f,{keyFrame:i%(fps*2)===0});f.close();
    while(enc.encodeQueueSize>4&&!err)await new Promise(r=>setTimeout(r,2));
    if(i%4===0){this.drawExport(`Exporting… ${Math.floor(i/frames*90)}%`);this.drawHead();this.drawTime();}
   }
   if(ex.cancelled)return;
   await enc.flush();if(err)throw err;enc.close();
   const ivf=edIvf(chunks,W,H,fps,cfg.codec.startsWith('vp09')?'VP90':'VP80');chunks.length=0;
   this.drawExport(ex.format==='mp4'?'Making the MP4…':'Making the WebM…');
   const r=await fetch(withKey(`/api/editor/mux?fps=${fps}&format=${ex.format}&v=${ivf.size}`),{method:'POST',body:new Blob([ivf,wav])});
   if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Could not make the video');
   if(ex.cancelled)return;
   const out=await r.blob(),name=ex.name+'.'+ex.format;edSaveFile(out,name);toast(`Exported (${frames} frames)`);if(ex.studio)this.toStudio(out,name);
  }catch(e){if(!ex.cancelled)toast('Export stopped: '+(e?.message||e),true);}
  finally{try{if(ex.enc&&ex.enc.state!=='closed')ex.enc.close();}catch{}
   this.exporting=null;this.drawExport();this.fit();this.time=Math.min(t0,this.end());this.sync();this.draw();this.drawHead();this.drawTime();}
 },
 /** Before the first frame: the fonts of every text, every picture decoded, every video able to show a frame. */
 async exportReady(){
  await document.fonts?.ready;
  const waits=[];
  for(const c of this.p.clips){
   if(c.text!==undefined){waits.push(document.fonts?.load(this.font(c,c.start),c.text||'a').catch(()=>{}));continue;}
   if(c.sticker||c.asAudio)continue;const m=this.mediaOf(c);if(!m)continue;
   if(m.type==='image')waits.push(this.image(m).decode().catch(()=>{throw new Error('The picture '+m.name+' could not be read');}));
   else if(m.type==='video')waits.push(edReady(this.element(c),m.name));
  }
  await Promise.all(waits);
 },
 /** Every video that can be on screen at t (or held for a transition) shows exactly its frame for t. Same targets as sync(). */
 async seekExact(t){
  const waits=[];
  for(const c of this.p.clips){
   if(c.text!==undefined||c.sticker||c.asAudio)continue;const m=this.mediaOf(c);if(!m||m.type!=='video')continue;
   let want;
   if(t>=c.start&&t<c.start+c.dur)want=this.srcAt(c,t);
   else if(c.start-t>0&&c.start-t<1.5)want=c.in||0;
   else if(t-(c.start+c.dur)>=0&&t-(c.start+c.dur)<1.5)want=Math.max(0,this.srcAt(c,c.start+c.dur)-.05);
   else continue;
   const el=this.element(c);if(!el.paused)el.pause();
   if(Math.abs(el.currentTime-want)<.0005&&el.readyState>=2)continue;
   waits.push(edSeek(el,want,m.name).then(()=>edReady(el,m.name)));
  }
  await Promise.all(waits);
 },
 /** The sound of the whole video, mixed offline: the same clips, volumes, keyframes and fades as playback.
  *  Faster or slower clips keep their pitch, as in the player (edStretch). */
 async mixAudio(t0,dur){
  const sr=48000,oc=new OfflineAudioContext(2,Math.max(1,Math.round(dur*sr)),sr),bufs=new Map(),silent=new Set();
  for(const c of this.p.clips){
   const s=Math.max(c.start,t0),e=Math.min(c.start+c.dur,t0+dur);
   if(c.text!==undefined||c.sticker||!(c.dur>0)||e-s<.001)continue;const m=this.mediaOf(c);if(!m||m.type==='image')continue;
   if(this.trackOf(c)?.muted||(c.detached&&!c.asAudio))continue;
   if(!bufs.has(m.id)){const b=await this.get(m.id).catch(()=>null);let buf=null;if(b){try{buf=await oc.decodeAudioData(await b.arrayBuffer());}catch{buf=null;}}bufs.set(m.id,buf);}
   const buf=bufs.get(m.id);if(!buf){silent.add(m.name);continue;} // a video without sound, or a file the browser cannot decode
   const sp=c.speed||1,stretch=!!c.ramp||Math.abs(sp-1)>.001,n=oc.createBufferSource(),g=oc.createGain();
   n.buffer=stretch?edStretch(oc,buf,c.in||0,c.dur,x=>this.srcAt(c,c.start+x)-(c.in||0)):buf;
   // [s, e] is the part of the clip inside the export, in timeline time; `skip` is how far into the clip it starts.
   const len=e-s,skip=s-c.start,steps=Math.max(2,Math.ceil(len*120)),curve=new Float32Array(steps);
   for(let i=0;i<steps;i++)curve[i]=this.vol(c,s+Math.min(len*i/(steps-1),len-1e-4));
   g.gain.setValueCurveAtTime(curve,s-t0,len);
   n.connect(g).connect(oc.destination);n.start(s-t0,stretch?skip:(c.in||0)+skip,len);
  }
  if(silent.size)toast('No sound was found in '+[...silent].join(', ')+'. If it has sound, this browser could not read it.');
  return oc.startRendering();
 },
 async exportLive(o){
  if(typeof MediaRecorder==='undefined')return toast('This browser cannot record video.',true);
  this.audio();await this.ac?.resume?.();
  const scale=o.height/Math.min(...this.base()),fps=o.fps;
  this.exporting={scale,format:o.format,fps,name:o.name,studio:!!o.studio,until:o.range?.e};this.pick(null);this.drawTimeline();this.drawProps();this.fit();this.draw();
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
  this.drawExport('Recording…');this.pause();this.rate=1;this.seek(o.range?.s??0);
  setTimeout(()=>{rec.start(250);this.exporting.rec=rec;this.play();},400);
 },
 /** The frame under the playhead as a PNG, at 1080 on the short side, without selection outlines. */
 async saveFrame(){if(!this.p.clips.length||this.exporting)return;this.pause();const t=this.time;
  this.exporting={scale:1080/Math.min(...this.base()),still:true};
  try{await this.exportReady();await this.seekExact(t);this.time=t;this.draw();const blob=await new Promise(r=>this.dom.canvas.toBlob(r,'image/png'));
   if(!blob)throw new Error('Could not make the picture');edSaveFile(blob,`${this.p.name} ${edFmt(t).replace(/:/g,'.')}.png`);toast('Frame saved');}
  catch(e){toast(e.message,true);}finally{this.exporting=null;this.fit();this.draw();}},
 toStudio(blob,name){edSaveToStudio(blob,name).then(()=>toast('Saved to Studio')).catch(e=>toast(e.message,true));},
 finishExport(){const e=this.exporting;if(e?.rec&&e.rec.state!=='inactive')setTimeout(()=>e.rec.stop(),200);},
 cancelExport(){const e=this.exporting;if(!e)return;e.cancelled=true;if(e.offline){this.drawExport('Stopping…');return;}this.pause();if(e.rec&&e.rec.state!=='inactive')e.rec.stop();else{this.exporting=null;this.drawExport();this.fit();this.draw();}},
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
  const busy=this.dom.lib?.querySelector('[data-captions]');if(busy){busy.disabled=true;busy.innerHTML=`<span class="spin"></span> ${this.capEngine?.()==='local'?'Listening on this computer…':'Reading the speech…'}`;}
  try{
   const words={},lang=this.p.capLang||'auto',look=this.p.capLook||'clean';let code=lang,fixed=0,flags=0;
   for(const id of new Set(src.map(c=>c.media))){const m=this.media.find(x=>x.id===id),blob=await this.get(id);if(!blob)continue;
    const r=await fetch(withKey('/api/editor/captions?name='+encodeURIComponent(m.name)+'&lang='+encodeURIComponent(lang)+'&engine='+(this.capEngine?.()==='elevenlabs'?'elevenlabs':'local')+(this.capEngine?.()==='whisper'?'&model=whisper':'')+(this.p.capSorani===false?'&sorani=0':'')),{method:'POST',body:blob});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not read the speech');
    words[id]=(j.words||[]).map(w=>({...w,aid:j.audioId}));if(lang==='auto'&&j.code)code=j.code;fixed+=j.fixed||0;flags+=j.flags||0;}
   const lines=[];
   for(const c of src){const a=c.in||0,b=this.srcAt(c,c.start+c.dur)+.05;
    const ws=(words[c.media]||[]).filter(w=>w.start>=a&&w.end<=b).map(w=>({t:w.text.trim(),s:this.tlAt(c,w.start),e:this.tlAt(c,Math.min(w.end,b)),s0:w.start,e0:w.end,aid:w.aid,...(w.alt?{alt:w.alt,altSpan:w.altSpan||1}:{})})).filter(w=>w.t);
    // A line ends at a pause, after about 3 seconds, at the end of a sentence (in any language), or when it is long.
    let cur=null;const budget=w=>edNoSpace(w)?16:42;
    for(const w of ws){const txt=cur?cur.words.map(x=>x.t).join(' '):'';
     if(cur&&(w.s-cur.e>.6||cur.e-cur.s>3.2||/[\p{Sentence_Terminal}]$/u.test(cur.words.at(-1).t)||edLen(txt+' '+w.t)>budget(txt+w.t))){lines.push(cur);cur=null;}
     if(!cur)cur={s:w.s,e:w.e,words:[]};cur.words.push(w);cur.e=w.e;}
    if(cur)lines.push(cur);}
   if(!lines.length)return toast('No speech was found.');
   // Speech models on this computer write no capitals: each caption line starts with one (in scripts that have them).
   for(const l of lines){const w=l.words[0];if(w){const loc=code&&code!=='auto'?code:undefined,f=w.t.charAt(0),F=f.toLocaleUpperCase(loc);if(F!==f)w.t=F+w.t.slice(1);}}
   const n=this.addCaptions(lines,code,look);
   toast(`Added ${n} caption${n>1?'s':''}${code&&code!=='auto'?` (${edLangName(code)})`:''}${fixed?` · ${fixed} fixed from your corrections`:''}${flags?` · ${flags} to check (marked)`:''}`);this.loadStt?.().then(()=>this.drawStt?.());
  }catch(e){toast(e.message,true);}
  finally{this.drawLib();}
 },
 // ---------- captions with word times: phrase, karaoke, one word at a time, build up ----------
 capText(c,w){return c.upper?w.toLocaleUpperCase(c.lang&&c.lang!=='auto'?c.lang:undefined):w;},
 capSep(c){return edNoSpace(c.text)?'':' ';},
 capBox(g,c,W,H,t=this.time){g.save();g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;
  const lh=(c.size||40)*this.val(c,'scale',t)*this.k()*1.25,lines=edPack(g,c.words.map(w=>this.capText(c,w.t)),this.capSep(c),W*.86),sw=g.measureText(this.capSep(c)).width;
  const w=Math.max(...lines.map(l=>l.reduce((a,x)=>a+g.measureText(x).width,0)+sw*(l.length-1)))+lh*.6,h=lines.length*lh+lh*.3;g.restore();
  return {w,h,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H,ls:lines.map(l=>l.join(this.capSep(c))),lh};},
 drawCaption(g,c,W,H,t,o={}){
  const lt=t-c.start,ws=c.words,st=c.capStyle||'phrase';let cur=-1,last=-1;for(let i=0;i<ws.length;i++){if(ws[i].s<=lt)last=i;if(lt>=ws[i].s&&lt<ws[i].e)cur=i;}
  const flagged=new Set();ws.forEach((w,i)=>{if(w.alt)for(let k=0;k<(w.altSpan||1);k++)flagged.add(i+k);});
  let show=ws.map((_,i)=>i);if(st==='word')show=[cur>=0?cur:Math.max(0,last)];else if(st==='build')show=show.filter(i=>i<=last);if(!show.length)return;
  const an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha;if(a<=0)return;
  g.save();g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;g.textBaseline='middle';const rtl=edRtl(c.text);g.direction=rtl?'rtl':'ltr';
  const sep=this.capSep(c),sw=g.measureText(sep).width,lh=(c.size||40)*this.val(c,'scale',t)*this.k()*1.25,txt=show.map(i=>this.capText(c,ws[i].t)),wd=txt.map(x=>g.measureText(x).width);
  const rows=[];{let row=[],w=0;show.forEach((i,j)=>{const add=(row.length?sw:0)+wd[j];if(row.length&&w+add>W*.86){rows.push({js:row,w});row=[];w=0;}w+=(row.length?sw:0)+wd[j];row.push(j);});if(row.length)rows.push({js:row,w});}
  const bw=Math.max(...rows.map(r=>r.w))+lh*.6,bh=rows.length*lh+lh*.3,cx=W/2+this.val(c,'x',t)*W+(o.dx||0),cy=H/2+this.val(c,'y',t)*H+(o.dy||0)+an.dy*H;
  g.globalAlpha=a;g.translate(cx,cy);g.rotate(this.val(c,'rotate',t)*Math.PI/180);g.scale(an.k,an.k);if(an.blur)g.filter=`blur(${an.blur*this.k()}px)`;
  if(c.box){g.fillStyle=c.boxColor||'#000';g.globalAlpha=a*.72;g.beginPath();g.roundRect(-bw/2,-bh/2,bw,bh,lh*.25);g.fill();g.globalAlpha=a;}
  g.textAlign='left';// words are placed one by one; each keeps its shaping and its punctuation on the right side for its direction
  rows.forEach((r,ri)=>{const y=-bh/2+lh*.15+lh*(ri+.5);let x=c.align==='left'?-bw/2+lh*.3:c.align==='right'?bw/2-lh*.3-r.w:-r.w/2;const pos=[];
   for(const j of r.js){pos.push(x);x+=wd[j]+sw;}
   r.js.forEach((j,k)=>{const at=rtl?(pos[0]+r.w)-(pos[k]-pos[0])-wd[j]:pos[k],i=show[j],on=i===cur;
    let sc=1;if(st==='word'&&on)sc=1+.18*(1-Math.min(1,(lt-ws[i].s)/.12));
    g.save();g.translate(at+wd[j]/2,y);g.scale(sc,sc);g.textAlign='center';g.direction=rtl?'rtl':'ltr';
    if(c.shadow&&!c.box){g.shadowColor='rgba(0,0,0,.5)';g.shadowBlur=lh*.25;g.shadowOffsetY=lh*.05;}
    if(c.stroke){g.lineJoin='round';g.lineWidth=c.stroke*this.k()*2;g.strokeStyle=c.strokeColor||'#000';g.strokeText(txt[j],0,0);g.shadowColor='transparent';}
    g.fillStyle=on&&(st==='karaoke'||st==='build')?(c.hl||'#FFD400'):(c.color||'#fff');g.fillText(txt[j],0,0);
    if(!this.exporting&&flagged.has(i)){g.shadowColor='transparent';g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--warn').trim()||'orange';g.lineWidth=Math.max(2,lh*.06);g.setLineDash([lh*.08,lh*.08]);g.beginPath();g.moveTo(-wd[j]/2,lh*.42);g.lineTo(wd[j]/2,lh*.42);g.stroke();g.setLineDash([]);}
    g.restore();});});
  g.restore();
 },
 /** A caption look on one clip. */
 capLook(c,name){const base={stroke:3,strokeColor:'#000000',shadow:true,box:false,animIn:'fade',animOut:'none',animDur:.15,upper:false,capStyle:'phrase',hl:c.hl||'#FFD400',weight:Math.max(700,c.weight||700)};
  const looks={clean:{},karaoke:{capStyle:'karaoke'},word:{capStyle:'word',upper:true,weight:800,size:Math.max(c.size||34,56),animIn:'none'},build:{capStyle:'build'},boxed:{box:true,boxColor:'#000000',stroke:0,shadow:false,animIn:'slide',animDur:.2}};
  Object.assign(c,base,looks[name]||{},{capLook:name});},
 /** New text in a caption: its words keep their times when the count is the same, else share the clip's length evenly. */
 retime(c,text){const ws=edWords(text,c.lang);// a reviewed caption: its "check" marks go
  if(ws.length===c.words.length){c.words=c.words.map((w,i)=>({t:ws[i],s:w.s,e:w.e}));return;}
  const d=c.dur/Math.max(1,ws.length);c.words=ws.map((w,i)=>({t:w,s:i*d,e:(i+1)*d}));},
 /** Learns from an edited caption: the changed words are remembered for this language, and the clip is kept for training. */
 async learnFix(c){if(!c?.asr||c.asr===c.text)return;const from=c.asr,to=c.text;c.asr=to;this.save();
  try{const r=await fetch(withKey('/api/editor/caption-fixes'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lang:c.lang,from,to,audio:c.src||undefined})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not learn the change');
   if(j.learned?.length)toast(`Learned: ${j.learned.map(x=>`${x.from} → ${x.to}`).slice(0,3).join(', ')}`);if(this.stt)this.stt.learning={fixes:j.fixes,clips:j.clips};this.drawStt?.();}
  catch(e){toast(e.message,true);}},
 /** Uses the second model's words for a flagged span of a caption (and learns from it). */
 useAlt(c,i){const w=c.words[i];if(!w?.alt)return;this.snapshot();const n=w.altSpan||1,alt=edWords(w.alt,c.lang),a=w.s,b=c.words[Math.min(c.words.length-1,i+n-1)].e,step=(b-a)/Math.max(1,alt.length);
  c.words.splice(i,n,...alt.map((t,k)=>({t,s:a+k*step,e:a+(k+1)*step})));c.text=c.words.map(x=>x.t).join(edNoSpace(c.text)?'':' ');this.after(true);this.learnFix(c);},
 keepFlag(c,i){const w=c.words[i];if(!w)return;this.snapshot();delete w.alt;delete w.altSpan;this.after(true);},
 /** Timeline time where a clip shows file time `src` (inverse of srcAt; works with speed curves). */
 tlAt(c,src){let lo=c.start,hi=c.start+c.dur;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(this.srcAt(c,m)<src)lo=m;else hi=m;}return (lo+hi)/2;},
 /** Makes caption clips from lines [{s,e,words:[{t,s,e}]}] on a new text track. */
 addCaptions(lines,lang,look){
  this.snapshot();const tr=this.addTrack('text');let n=0;
  for(let i=0;i<lines.length;i++){const l=lines[i],next=lines[i+1];let e=l.e;if(next&&next.s-e<.3)e=next.s;// no flicker between close lines
   const text=l.words.map(w=>w.t).join(edNoSpace(l.words.map(w=>w.t).join(''))?'':' '),c=this.textClip(3,l.s,text);
   c.dur=Math.max(.4,e-l.s);c.track=tr.id;c.lang=lang;c.cap=true;
   c.words=l.words.map((w,k)=>({t:w.t,s:Math.max(0,w.s-l.s),e:Math.max(.05,w.e-l.s),...(w.alt?{alt:w.alt,altSpan:Math.min(w.altSpan||1,l.words.length-k)}:{})}));
   // from speech: the model's text (to learn from your changes) and where it is in the audio (for a training clip)
   const f0=l.words[0],f1=l.words[l.words.length-1];if(f0?.aid&&f0.s0!=null){c.asr=text;c.src={id:f0.aid,s:f0.s0,e:f1.e0};}
   if(edArabicScript(text))c.font='Vazirmatn';this.capLook(c,look);this.p.clips.push(c);n++;}
  this.after(true);return n;},
 // ---------- project files: one .zip with project.json and the media it uses, to keep or open elsewhere ----------
 async packProject(id){
  if(this.p?.id===id)await this.flush();
  const p=this.readProject(id);if(!p)throw new Error('That project is gone');
  const used=new Set(p.clips.map(c=>c.media).filter(Boolean)),files=[],media=[];
  for(const m of this.media.filter(m=>used.has(m.id))){const b=await this.get(m.id);if(!b)continue;files.push(['media/'+m.id+edExt(m.name),b]);media.push({...m,mime:b.type||''});}
  files.unshift(['project.json',new Blob([JSON.stringify({app:'tempoloom-editor',v:1,project:p,media})],{type:'application/json'})]);
  return edZip(files);
 },
 /** Opens a project file as a new project. Files already here (same id and size) are not stored twice. */
 async importProjectFile(file){
  const z=await edUnzip(file),pj=z.get('project.json');if(!pj)throw new Error('This is not an editor project file');
  let j;try{j=JSON.parse(await pj.text());}catch{throw new Error('The project file is damaged');}
  if(j?.app!=='tempoloom-editor'||!j.project||!Array.isArray(j.project.clips))throw new Error('This is not an editor project file');
  const map={};
  for(const m of Array.isArray(j.media)?j.media:[]){
   const name=[...z.keys()].find(k=>k.startsWith('media/'+m.id+'.')||k==='media/'+m.id),part=name&&z.get(name);if(!part||!m.id)continue;
   const here=this.media.find(x=>x.id===m.id),hb=here&&await this.get(here.id);
   if(hb&&hb.size===part.size){map[m.id]=here.id;continue;}
   const blob=new Blob([part],{type:m.mime||''}),id=this.uid(),{mime,...meta}=m;
   await this.put(id,blob);this.urls[id]=URL.createObjectURL(blob);this.media.unshift({...meta,id});map[m.id]=id;
  }
  await this.persist([['meta','media',this.media]]);
  const p=j.project;for(const c of p.clips)if(c.media)c.media=map[c.media]||c.media;
  const id=this.create(this.migrate({...p,name:String(p.name||'Imported project').slice(0,80)}));await this.wq;return id;
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
// ---------- export helpers ----------
/** A WebCodecs encoder setting this browser supports: VP9, else VP8 (both go in IVF, which ffmpeg reads). */
async function edVideoConfig(W,H,fps,bitrate){
 if(typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined'||typeof OfflineAudioContext==='undefined')return null;
 for(const codec of ['vp09.00.51.08','vp09.00.41.08','vp8']){const cfg={codec,width:W,height:H,bitrate,framerate:fps,latencyMode:'quality'};
  try{if((await VideoEncoder.isConfigSupported(cfg)).supported)return cfg;}catch{}}
 return null;
}
function edWaitFor(el,ev,ms,msg){return new Promise((res,rej)=>{const to=setTimeout(()=>{el.removeEventListener(ev,ok);rej(new Error(msg));},ms),ok=()=>{clearTimeout(to);res();};el.addEventListener(ev,ok,{once:true});});}
/** Resolves once the video can show a frame (it may be loading or in the middle of a seek). */
function edReady(el,name){if(el.readyState>=2&&!el.seeking)return Promise.resolve();
 return new Promise((res,rej)=>{const evs=['loadeddata','canplay','seeked'],done=()=>{if(el.readyState<2||el.seeking)return;clear();res();},clear=()=>{clearTimeout(to);evs.forEach(v=>el.removeEventListener(v,done));};
  const to=setTimeout(()=>{clear();rej(new Error('The video '+name+' did not load'));},20000);evs.forEach(v=>el.addEventListener(v,done));});}
function edSeek(el,t,name){const p=edWaitFor(el,'seeked',15000,'The video '+name+' did not show its frame in time');try{el.currentTime=t;}catch{}return p;}
/** Encoded frames in an IVF file: a 32-byte header, then each frame with its size and time (in frames). */
function edIvf(chunks,W,H,fps,fourcc){
 const h=new DataView(new ArrayBuffer(32)),ascii=(o,s)=>{for(let i=0;i<s.length;i++)h.setUint8(o+i,s.charCodeAt(i));};
 ascii(0,'DKIF');h.setUint16(4,0,true);h.setUint16(6,32,true);ascii(8,fourcc);h.setUint16(12,W,true);h.setUint16(14,H,true);h.setUint32(16,fps,true);h.setUint32(20,1,true);h.setUint32(24,chunks.length,true);
 const parts=[h.buffer];for(const c of chunks){const f=new DataView(new ArrayBuffer(12));f.setUint32(0,c.b.length,true);f.setUint32(4,c.pts,true);f.setUint32(8,0,true);parts.push(f.buffer,c.b);}
 return new Blob(parts);
}
/** 16-bit PCM WAV of an AudioBuffer. */
function edWav(b){
 const ch=b.numberOfChannels,n=b.length,bytes=n*ch*2,d=new DataView(new ArrayBuffer(44+bytes)),s=(o,t)=>{for(let i=0;i<t.length;i++)d.setUint8(o+i,t.charCodeAt(i));};
 s(0,'RIFF');d.setUint32(4,36+bytes,true);s(8,'WAVE');s(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,ch,true);d.setUint32(24,b.sampleRate,true);d.setUint32(28,b.sampleRate*ch*2,true);d.setUint16(32,ch*2,true);d.setUint16(34,16,true);s(36,'data');d.setUint32(40,bytes,true);
 const cs=[];for(let k=0;k<ch;k++)cs.push(b.getChannelData(k));let o=44;
 for(let i=0;i<n;i++)for(let k=0;k<ch;k++){const v=Math.max(-1,Math.min(1,cs[k][i]));d.setInt16(o,v<0?v*32768:v*32767,true);o+=2;}
 return new Blob([d.buffer],{type:'audio/wav'});
}
/** Plays srcDur seconds from inT at `rate` without changing the pitch (WSOLA: overlapping windows, each placed where it
 * best continues the last one). `map` gives the file position (seconds after inT) for each output second, so a
 *  constant speed and a speed curve both work. This is what the player does for a faster or slower clip. */
function edStretch(oc,buf,inT,outDur,map){
 const sr=buf.sampleRate,ch=buf.numberOfChannels,a0=Math.min(buf.length-1,Math.max(0,Math.floor(inT*sr))),n=Math.max(1,Math.min(buf.length-a0,Math.ceil(map(outDur)*sr)+2048));
 const outN=Math.max(1,Math.round(outDur*sr)),out=oc.createBuffer(ch,outN,sr),N=2048,Hs=N/2,tol=512,win=new Float32Array(N);
 for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/N);
 const ins=[],outs=[];for(let k=0;k<ch;k++){ins.push(buf.getChannelData(k).subarray(a0,a0+n));outs.push(out.getChannelData(k));}
 const mono=ins[0];let prev=-1;
 for(let o=0,j=0;o<outN;o+=Hs,j++){
  const nominal=Math.min(Math.max(0,n-N),Math.round(map(o/sr)*sr));let best=nominal;
  if(prev>=0){const target=prev+Hs;let bc=-Infinity;
   for(let s=Math.max(0,nominal-tol);s<=Math.min(Math.max(0,n-N),nominal+tol);s+=8){let cc=0;for(let i=0;i<Hs;i+=4)cc+=mono[s+i]*(mono[target+i]||0);if(cc>bc){bc=cc;best=s;}}}
  for(let k=0;k<ch;k++){const I=ins[k],O=outs[k];for(let i=0;i<N&&o+i<outN;i++)O[o+i]+=(I[best+i]||0)*win[i];}
  prev=best;
 }
 return out;
}
// ---------- project file helpers: a plain .zip (stored, not compressed: the media are compressed already) ----------
const edCrcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function edCrc(u8,crc){let c=~crc;for(let i=0;i<u8.length;i++)c=edCrcT[(c^u8[i])&255]^(c>>>8);return (~c)>>>0;}
const edExt=name=>(/\.[a-z0-9]{1,5}$/i.exec(name||'')||[''])[0].toLowerCase();
async function edZip(files){
 const enc=new TextEncoder(),parts=[],central=[];let off=0;
 for(const [name,blob] of files){
  const nm=enc.encode(name);let crc=0;
  for(let p=0;p<blob.size;p+=8<<20)crc=edCrc(new Uint8Array(await blob.slice(p,p+(8<<20)).arrayBuffer()),crc);
  if(off+30+nm.length+blob.size>=0xFFFFFFFF)throw new Error('The project is too big for one file (over 4 GB)');
  const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,blob.size,true);h.setUint32(22,blob.size,true);h.setUint16(26,nm.length,true);
  const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);c.setUint32(20,blob.size,true);c.setUint32(24,blob.size,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
  parts.push(h.buffer,nm,blob);central.push(c.buffer,nm);off+=30+nm.length+blob.size;
 }
 const size=central.reduce((a,b)=>a+b.byteLength,0),e=new DataView(new ArrayBuffer(22));
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);
 return new Blob([...parts,...central,e.buffer],{type:'application/zip'});
}
/** The files in a .zip as Blob slices (nothing is read into memory until used). Only stored entries, as edZip writes. */
async function edUnzip(file){
 const tail=new DataView(await file.slice(Math.max(0,file.size-65557)).arrayBuffer());let e=-1;
 for(let i=tail.byteLength-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50){e=i;break;}
 if(e<0)throw new Error('This is not an editor project file');
 const n=tail.getUint16(e+10,true),size=tail.getUint32(e+12,true),at=tail.getUint32(e+16,true);
 const cd=new DataView(await file.slice(at,at+size).arrayBuffer()),dec=new TextDecoder(),out=new Map();
 for(let i=0,p=0;i<n;i++){
  if(p+46>cd.byteLength||cd.getUint32(p,true)!==0x02014b50)throw new Error('The project file is damaged');
  const method=cd.getUint16(p+10,true),cs=cd.getUint32(p+20,true),nl=cd.getUint16(p+28,true),xl=cd.getUint16(p+30,true),cl=cd.getUint16(p+32,true),lo=cd.getUint32(p+42,true);
  const name=dec.decode(new Uint8Array(cd.buffer,cd.byteOffset+p+46,nl));
  if(method!==0)throw new Error('This project file was repacked by another program. Export it again from the Editor.');
  const lh=new DataView(await file.slice(lo,lo+30).arrayBuffer());if(lh.getUint32(0,true)!==0x04034b50)throw new Error('The project file is damaged');
  const start=lo+30+lh.getUint16(26,true)+lh.getUint16(28,true);out.set(name,file.slice(start,start+cs));p+=46+nl+xl+cl;
 }
 return out;
}
// ---------- captions helpers ----------
/** Greedy lines of words no wider than maxW (sep between words: a space, or nothing for scripts without spaces). */
function edPack(g,words,sep,maxW){const out=[];let row=[],w=0;const sw=g.measureText(sep).width;
 for(const x of words){const xw=g.measureText(x).width,add=(row.length?sw:0)+xw;if(row.length&&w+add>maxW){out.push(row);row=[];w=0;}w+=(row.length?sw:0)+xw;row.push(x);}if(row.length)out.push(row);return out.length?out:[['']];}
const ED_LANG_NAMES={ckb:'کوردی (سۆرانی)',kmr:'Kurdî (Kurmancî)',badini:'Kurdî (Badînî)'};
/** A language's name in that language (Kurdish names are written out; others come from Intl.DisplayNames). */
function edLangName(code){if(code==='auto')return 'Detect automatically';if(ED_LANG_NAMES[code])return ED_LANG_NAMES[code];
 try{const n=new Intl.DisplayNames([code],{type:'language'}).of(code);return n&&n!==code?n.charAt(0).toLocaleUpperCase(code)+n.slice(1):code;}catch{return code;}}
const edSrtTime=t=>{t=Math.max(0,t);const ms=Math.round(t*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
/** SRT text from caption clips (UTF-8, numbered, HH:MM:SS,mmm). */
function edSrt(clips){return clips.map((c,i)=>`${i+1}\n${edSrtTime(c.start)} --> ${edSrtTime(c.start+c.dur)}\n${String(c.text||'').trim()}\n`).join('\n');}
/** Cues from an SRT or WebVTT file: [{s,e,text}]. */
function edParseSubs(raw){const txt=String(raw).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'),out=[];
 const tm=x=>{const m=/(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/.exec(x);return m?(+(m[1]||0))*3600+(+m[2])*60+(+m[3])+(+m[4].padEnd(3,'0'))/1000:NaN;};
 for(const block of txt.split(/\n{2,}/)){const ls=block.split('\n'),k=ls.findIndex(l=>l.includes('-->'));if(k<0)continue;const [a,b]=ls[k].split('-->'),s=tm(a),e=tm(b);
  const text=ls.slice(k+1).join(' ').replace(/<[^>]+>/g,'').replace(/\{\\[^}]*\}/g,'').trim();if(isFinite(s)&&isFinite(e)&&e>s&&text)out.push({s,e,text});}
 return out;}
// ---------- green screen ----------
/** Keys out a colour (in place, RGBA): distance in the colour plane (Cb/Cr) gives transparency; spill takes the
 *  key colour's tint off the edges. Similarity, smoothness and spill are 0-100 as in the panel. */
function edKey(d,k){
 const hex=String(k.color||'#00b140'),kr=parseInt(hex.slice(1,3),16),kg=parseInt(hex.slice(3,5),16),kb=parseInt(hex.slice(5,7),16);
 const cb=(r,g,b)=>-.168736*r-.331264*g+.5*b,cr=(r,g,b)=>.5*r-.418688*g-.081312*b,kcb=cb(kr,kg,kb),kcr=cr(kr,kg,kb);
 const sim=(k.sim??25)/100*120,smooth=Math.max(1,(k.smooth??10)/100*120),spill=(k.spill??50)/100,ch=kg>=kr&&kg>=kb?1:kb>=kr?2:0;
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const r=d[i],g=d[i+1],b=d[i+2],dist=Math.hypot(cb(r,g,b)-kcb,cr(r,g,b)-kcr),a=Math.min(1,Math.max(0,(dist-sim)/smooth));
  if(a<1)d[i+3]=d[i+3]*a;
  if(spill&&a<1.0001){const o1=d[i+(ch+1)%3],o2=d[i+(ch+2)%3],lim=Math.max(o1,o2),v=d[i+ch];if(v>lim)d[i+ch]=v-(v-lim)*spill*(1-a*.5);}}
}
// ---------- sound helpers ----------
const edDb=db=>Math.pow(10,db/20);
async function edDecode(blob){const ac=new OfflineAudioContext(1,1,48000);return ac.decodeAudioData(await blob.arrayBuffer());}
/** RMS of all channels, `rate` values per second, rounded (kept with the file). */
function edEnvelope(buf,rate){const N=Math.max(1,Math.round(buf.sampleRate/rate)),n=Math.ceil(buf.length/N),ch=[],out=new Array(n);for(let k=0;k<buf.numberOfChannels;k++)ch.push(buf.getChannelData(k));
 for(let i=0;i<n;i++){let z=0,c=0;for(const d of ch)for(let j=i*N;j<Math.min(d.length,(i+1)*N);j+=2){z+=d[j]*d[j];c++;}out[i]=Math.round(Math.sqrt(z/(c||1))*1000)/1000;}return out;}
/** Integrated loudness in LUFS (ITU-R BS.1770: K-weighting, 400 ms blocks with 75% overlap, -70 LUFS and -10 LU gates). */
async function edLufs(buf){
 const oc=new OfflineAudioContext(buf.numberOfChannels,buf.length,buf.sampleRate),s=oc.createBufferSource(),hs=oc.createBiquadFilter(),hp=oc.createBiquadFilter();
 s.buffer=buf;hs.type='highshelf';hs.frequency.value=1681;hs.gain.value=4;hp.type='highpass';hp.frequency.value=38;hp.Q.value=.5;s.connect(hs).connect(hp).connect(oc.destination);s.start();
 const r=await oc.startRendering(),sr=r.sampleRate,q=Math.round(.1*sr),nq=Math.floor(r.length/q),sub=new Float64Array(nq);
 for(let k=0;k<r.numberOfChannels;k++){const d=r.getChannelData(k);for(let i=0;i<nq;i++){let z=0;for(let j=i*q;j<(i+1)*q;j++)z+=d[j]*d[j];sub[i]+=z;}}
 const blocks=[];for(let i=0;i+4<=nq;i++)blocks.push((sub[i]+sub[i+1]+sub[i+2]+sub[i+3])/(4*q));
 const L=z=>-0.691+10*Math.log10(z),mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 const abs=blocks.filter(z=>z>0&&L(z)>-70);if(!abs.length)return null;const rel=L(mean(abs))-10,keep=abs.filter(z=>L(z)>rel);
 return Math.round(L(mean(keep.length?keep:abs))*10)/10;
}
async function edPeaks(file){const ac=new AudioContext();try{const buf=await ac.decodeAudioData(await file.arrayBuffer());const d=buf.getChannelData(0),n=160,step=Math.floor(d.length/n)||1,out=[];for(let i=0;i<n;i++){let m=0;for(let j=i*step;j<(i+1)*step&&j<d.length;j+=8)m=Math.max(m,Math.abs(d[j]));out.push(Math.round(m*100)/100);}return out;}finally{ac.close();}}
