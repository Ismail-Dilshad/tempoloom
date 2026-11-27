'use strict';
// Editor, the engine: projects, tracks and clips, playback, drawing each frame, and export. The panels,
// the timeline and the projects screen are in editor-ui.js. Files are kept in this browser; nothing is
// uploaded, except to this computer's own server to make an MP4 or to read the speech for captions.
const ED_RATIOS={'16:9':[1280,720],'9:16':[720,1280],'1:1':[1080,1080],'4:5':[1080,1350]};
const ED_KINDS={video:{label:'Video',icon:'film'},sticker:{label:'Sticker',icon:'star'},text:{label:'Text',icon:'text'},audio:{label:'Audio',icon:'music'}};
const ED_VISUAL=new Set(['video','sticker','text']);
const ED_TEXTS=[['Title',72,800,false],['Subtitle',44,600,false],['Body text',32,500,false],['Caption',34,700,true]];
/** Transitions for sound at a cut between two audio clips. */
const ED_ATRANS=[['crossfade','Crossfade']];
const ED_TRANS=[['dissolve','Dissolve'],['fade','Fade to black'],['white','Fade to white'],['slide','Slide'],['push','Push up'],['zoom','Zoom'],['zoomblur','Zoom blur'],['wipe','Wipe'],['iris','Circle'],['blur','Blur'],['whip','Whip pan'],['spin','Spin'],['flash','Flash'],['glitch','Glitch'],['shake','Shake'],['wipeup','Wipe up'],['pushright','Push right'],['dipwarm','Dip to warm light']];
const ED_ADJ=[['brightness','Brightness',-100,100],['contrast','Contrast',-100,100],['saturation','Saturation',-100,100],['hue','Hue',-180,180],['temperature','Temperature',-100,100],['vignette','Vignette',0,100],['blur','Blur',0,30]];
const ED_FILTERS=[['none','Original',{}],['vivid','Vivid',{saturation:35,contrast:15}],['warm','Warm',{temperature:40,saturation:10}],['cool','Cool',{temperature:-40,saturation:5}],['bw','Black & white',{saturation:-100,contrast:15}],
 ['vintage','Vintage',{saturation:-30,temperature:30,contrast:-10,vignette:45}],['faded','Faded',{contrast:-25,brightness:8,saturation:-15}],['drama','Dramatic',{contrast:35,saturation:-10,vignette:55,brightness:-5}],
 ['daylight','Daylight balance',{brightness:7,contrast:6,saturation:6,temperature:-8}],['interview','Soft interview',{brightness:10,contrast:-9,saturation:-6,temperature:10}],
 ['product','Product pop',{brightness:8,contrast:18,saturation:15}],['golden','Golden hour',{temperature:32,contrast:11,saturation:12,vignette:15}],
 ['urban','Overcast street',{temperature:-18,contrast:19,saturation:-24}],['night','Night street',{brightness:-8,contrast:22,temperature:-31,saturation:-12,vignette:36}],
 ['mono','Soft monochrome',{saturation:-100,contrast:-14,brightness:9}],['punchmono','High-contrast mono',{saturation:-100,contrast:32,vignette:22}]];
const ED_FONTS=[['Tempoloom UI','Sans'],['Fredoka','Rounded'],['Vazirmatn','Kurdish & Arabic'],['Georgia','Serif'],['Impact','Impact'],['Courier New','Mono']];
const ED_ANIMS=[['none','None'],['fade','Fade'],['pop','Pop'],['slide','Slide'],['zoom','Zoom'],['blur','Blur'],['type','Typewriter'],['words','Word by word']];
/** In and out animations for video and photo clips (as CapCut's): text keeps its own list above. */
const ED_CLIP_ANIMS=[['none','None'],['fade','Fade'],['zoom','Zoom in'],['zoomout','Zoom out'],['pop','Pop'],['bounce','Bounce'],['left','Slide left'],['right','Slide right'],['slide','Slide up'],['down','Slide down'],['spin','Spin'],['swing','Swing'],['blur','Blur'],['shake','Shake']];
/** Style effects for a clip (one at a time, with an amount), drawn on its layer. */
const ED_STYLES=[['none','None'],['rgb','RGB split'],['glitch','Glitch'],['vhs','VHS'],['leak','Light leak'],['burn','Film burn'],['flash','Flash'],['mirror','Mirror'],['kaleido','Kaleidoscope'],['pixel','Pixelate'],['zoomblur','Zoom blur'],['motion','Motion blur'],['invert','Invert']];
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
const ED_SHAPES=[['rect','Square'],['round','Rounded'],['circle','Circle'],['triangle','Triangle'],['star','Star'],['arrow','Arrow'],['line','Line'],['heart','Heart'],['cuboid','3D box']];
const ED_TRACKS0=()=>[{id:'text',kind:'text'},{id:'video',kind:'video',main:true},{id:'audio',kind:'audio'}];
const edClamp=(v,a,b)=>Math.min(b,Math.max(a,v));
/** Every clip of a list, the clips inside nested clips too (for media in use, project files, proxies). */
const edAll=cl=>(cl||[]).flatMap(c=>c.nest?[c,...edAll(c.nest.clips)]:[c]);
const edEase=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
/** How a keyframe moves to the next one. Smooth is the default (and what older projects had). */
const ED_EASES=[['smooth','Smooth'],['linear','Linear'],['in','Ease in'],['out','Ease out'],['hold','Hold']];
const edEaseFn={smooth:edEase,linear:u=>u,in:u=>u*u*u,out:u=>1-Math.pow(1-u,3),hold:()=>0};
/** The named easings drawn as cubic Béziers (as in CSS), where the keyframe curve editor starts from. */
const ED_EASE_BZ={smooth:[.65,0,.35,1],linear:[0,0,1,1],in:[.32,0,.67,0],out:[.33,1,.68,1]};
/** A cubic Bézier easing from (0,0) to (1,1) with control points (x1,y1), (x2,y2): y at x (x found by halving). */
function edBezier(x1,y1,x2,y2){const B=(a,b,t)=>3*a*(1-t)*(1-t)*t+3*b*(1-t)*t*t+t*t*t;
 return u=>{if(u<=0)return 0;if(u>=1)return 1;let lo=0,hi=1,t=u;for(let i=0;i<32;i++){t=(lo+hi)/2;if(B(x1,x2,t)<u)lo=t;else hi=t;}return B(y1,y2,t);};}
/** A keyframe's easing: a name, or a custom curve [x1,y1,x2,y2] from the curve editor. */
const edEaseOf=e=>Array.isArray(e)&&e.length===4?edBezier(...e):(edEaseFn[e]||edEase);
const edKeyframeNear=(frame,clip,time)=>frame.t>=0&&frame.t<=clip.dur&&Math.abs(frame.t-(time-clip.start))<1/60;
/** Text templates: the style of a text clip, saved to use again. These come with the editor; yours are kept in this browser. */
const ED_TSTYLE=['font','size','weight','color','box','boxColor','align','stroke','strokeColor','shadow','spacing','lineH','upper','x','y','animIn','animOut','animDur','dur'];
const ED_TTPL=[
 {name:'Lower third',text:'Name Surname',style:{size:40,weight:700,box:true,boxColor:'#000000',align:'left',shadow:false,x:-.2,y:.34,animIn:'slide',animOut:'fade',dur:4}},
 {name:'Headline',text:'Big news',style:{size:96,weight:900,stroke:6,strokeColor:'#000000',shadow:true,upper:true,animIn:'pop'}},
 {name:'Subscribe',text:'Subscribe',style:{size:48,weight:800,box:true,boxColor:'#e5252a',shadow:false,y:.3,animIn:'pop',animOut:'pop'}},
 {name:'Quote',text:'"A short quote here"',style:{size:44,weight:500,lineH:1.5,animIn:'type',dur:5}},
 {name:'Intro hook',text:'Here is what changed',style:{size:68,weight:850,stroke:4,strokeColor:'#0d1420',y:-.25,animIn:'pop',dur:3}},
 {name:'Step badge',text:'STEP 01',style:{size:42,weight:850,box:true,boxColor:'#1645a8',shadow:false,x:-.25,y:-.28,animIn:'slide',dur:4}},
 {name:'Price tag',text:'$29.00',style:{size:58,weight:850,color:'#102320',box:true,boxColor:'#84f0c3',shadow:false,x:.22,y:.22,animIn:'pop',dur:4}},
 {name:'Location credit',text:'Location • Day 01',style:{size:34,weight:650,box:true,boxColor:'#1b2640',shadow:false,x:-.22,y:.32,animIn:'fade',dur:4}},
 {name:'Tutorial note',text:'Tip: Start here',style:{size:42,weight:700,color:'#101c34',box:true,boxColor:'#e7eeff',shadow:false,y:.31,animIn:'slide',dur:5}},
 {name:'Chapter heading',text:'Chapter 01',style:{size:76,weight:650,spacing:2,shadow:true,animIn:'fade',dur:4}}];
/** Caption looks: how a caption shows its words (phrase, karaoke, one word, build up) plus its text style. */
const ED_CAPS=[['clean','Clean'],['karaoke','Karaoke'],['word','Word by word'],['build','Build up'],['boxed','Boxed'],['documentary','Documentary'],['interview','Interview'],['highlight','Spotlight']];
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
/** Label colours for clips, markers and tracks (as in Premiere and Resolve). */
const ED_LABELS=[['red','Red','#e5484d'],['orange','Orange','#f76b15'],['yellow','Yellow','#ffc53d'],['green','Green','#30a46c'],['teal','Teal','#12a594'],['blue','Blue','#3e63dd'],['purple','Purple','#8e4ec6'],['pink','Pink','#d6409f']];
const edLabel=id=>ED_LABELS.find(l=>l[0]===id)?.[2];
const edMt=m=>typeof m==='number'?m:m.t;
const ED_BLENDS=[['normal','Normal'],['multiply','Multiply'],['screen','Screen'],['overlay','Overlay'],['darken','Darken'],['lighten','Lighten'],['color-dodge','Colour dodge'],['color-burn','Colour burn'],
 ['hard-light','Hard light'],['soft-light','Soft light'],['difference','Difference'],['exclusion','Exclusion'],['hue','Hue'],['saturation','Saturation'],['color','Colour'],['luminosity','Luminosity']];
const ED_MASKS=[['none','None'],['rect','Rectangle'],['circle','Ellipse'],['linear','Linear'],['band','Mirror band'],['heart','Heart'],['star','Star']];
const ED_MEDIA_DEFAULTS={speed:1,volume:1,scale:1,x:0,y:0,rotate:0,opacity:1,fadeIn:0,fadeOut:0};
const ED_POSITION_KEYS=new Set(['x','y','scale','rotate','tiltX','tiltY','depth3d']);
const Ed={
 p:null,media:[],urls:{},els:{},imgs:{},time:0,playing:false,sel:null,sels:new Set(),junction:null,zoom:40,snap:true,tab:'media',ptab:null,
 past:[],future:[],dom:{},ready:null,exporting:null,clipboard:null,guides:false,recording:null,previewVolume:1,previewMuted:false,
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
 create(from,coverImage){const id=this.uid(),p={...this.blank(),...(from||{}),id};p.updated=new Date().toISOString();
  this.writeProject(p);this.setList([this.entry(p,null,coverImage),...this.list()]);return id;},
 entry(p,thumb,coverImage){const end=(p.clips||[]).reduce((a,c)=>Math.max(a,c.start+c.dur),0);return {id:p.id,name:p.name,ratio:p.ratio,updated:p.updated||new Date().toISOString(),dur:end,clips:(p.clips||[]).length,thumb,coverImage};},
 cover(){const cv=this.dom.canvas;if(!cv||!this.p.clips.length||this.exporting)return null;try{const [W,H]=this.size(),s=Math.min(320/W,320/H),c=document.createElement('canvas');c.width=Math.round(W*s);c.height=Math.round(H*s);c.getContext('2d').drawImage(cv,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.7);}catch{return null;}},
 save(){const R=this.root();if(!R?.id)return;R.updated=new Date().toISOString();clearTimeout(this.st);this.st=setTimeout(()=>this.flush(),300);this.saved(false);},
 flush(){const R=this.root();if(!R?.id)return Promise.resolve(true);clearTimeout(this.st);this.st=null;this.relink();
  const id=R.id,s=JSON.stringify(R),H=this.stack?.[0]||this;this.pjson.set(id,s);
  const old=this.list().find(x=>x.id===id),e=this.entry(R,this.cover()??old?.thumb??null,old?.coverImage);this.plist=[e,...this.list().filter(x=>x.id!==id)];
  return this.persist([['projects',id,s],['history',id,{past:H.past.slice(-50),future:H.future.slice(-50)}],['meta','list',this.plist],['meta','media',this.media]])
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
  this.plist=(await this.read('meta','list'))||[];this.media=(await this.read('meta','media'))||[];this.tpls=(await this.read('meta','textTemplates'))||[];
  await this.fromLocal();
  this.plist=this.plist.filter(x=>this.pjson.has(x.id));
  const kept=[];for(const m of this.media){const b=await this.get(m.id).catch(()=>null);if(b){this.urls[m.id]=URL.createObjectURL(b);kept.push(m);
   if(m.proxy){const pb=await this.get(m.id+':proxy').catch(()=>null);if(pb)this.urls[m.id+':proxy']=URL.createObjectURL(pb);else delete m.proxy;}}}
  this.media=kept;
  document.fonts?.load('40px Vazirmatn').catch(()=>{});document.fonts?.load('40px Fredoka').catch(()=>{});
 })());},
 /** Older projects: three fixed tracks, no markers. They open as they were. */
 migrate(p){
  if(!ED_RATIOS[p.ratio])p.ratio='16:9';
  if(!Array.isArray(p.tracks)||!p.tracks.length)p.tracks=ED_TRACKS0();
  if(!p.tracks.some(t=>t.main&&t.kind==='video'))(p.tracks.find(t=>t.kind==='video')||p.tracks[p.tracks.push({id:'video',kind:'video'})-1]).main=true;
  const ids=new Set(this.media.map(m=>m.id));
  const keep=c=>c.text!==undefined||c.sticker||c.title||c.adjustment||(c.nest&&Array.isArray(c.nest.clips))||ids.has(c.media);
  const fix=cl=>(cl||[]).filter(keep).map(c=>{if(c.nest){c.nest.clips=fix(c.nest.clips);if(!Array.isArray(c.nest.tracks))c.nest.tracks=ED_TRACKS0();}return c;});
  p.clips=fix(p.clips);
  for(const c of p.clips)if(!p.tracks.some(t=>t.id===c.track)){const kind=c.text!==undefined||c.title?'text':c.sticker?'sticker':this.media.find(m=>m.id===c.media)?.type==='audio'||c.asAudio?'audio':'video';c.track=(p.tracks.find(t=>t.kind===kind)||this.addTrackTo(p,kind)).id;}
  if(Array.isArray(p.rangeNotes))p.rangeNotes=p.rangeNotes.filter(n=>n&&Number.isFinite(n.s)&&Number.isFinite(n.e)&&n.s>=0&&n.e>n.s&&typeof n.text==='string')
   .map(({s,e,text})=>({s,e,text:text.slice(0,300)}));
  else delete p.rangeNotes;
  if(p.magnet===undefined)p.magnet=true;p.markers=(p.markers||[]).map(m=>typeof m==='number'?{t:m}:m);p.bgMode=p.bgMode||'color';p.v=3;return p;
 },
 open(id){
  if(this.p?.id===id)return true;
  if(this.p)this.flush();
  const p=this.readProject(id);if(!p)return false;
  if(this.p)this.pause();for(const el of Object.values(this.els))el.pause?.();this.els={};this.playing=false;
  this.stack=[];this.p=this.migrate(p);this.time=0;this.sel=null;this.sels.clear();this.junction=null;this.past=[];this.future=[];
  // Undo keeps working after a reload: the last steps are saved with the project.
  this.read('history',id).then(h=>{if(h&&this.p?.id===id&&!this.past.length&&!this.future.length){this.past=h.past||[];this.future=h.future||[];}}).catch(()=>{});
  return true;
 },
 // ---------- tracks and clips ----------
 uid:()=>Math.random().toString(36).slice(2,10),
 mediaOf(c){return this.media.find(m=>m.id===c.media);},
 trackOf(c){return this.p.tracks.find(t=>t.id===c.track);},
 kindOf(c){return this.trackOf(c)?.kind||(c.text!==undefined||c.title?'text':c.sticker?'sticker':'video');},
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
 place(kind,start,dur,prefer,except,{overlay=false,visible=false}={}){
  const tracks=overlay?this.p.tracks.slice(0,this.p.tracks.indexOf(this.main())):this.p.tracks;
  const ok=t=>t&&t.kind===kind&&!t.locked&&(!visible||!t.hidden)&&this.fits(t.id,start,dur,except);
  const want=tracks.find(t=>t.id===prefer);if(ok(want))return want.id;
  const free=tracks.find(t=>ok(t)&&!t.main);if(free)return free.id;
  return this.addTrack(kind).id;
 },
 pack(){if(!this.p.magnet)return;const m=this.main();if(!m)return;let at=0;for(const c of this.p.clips.filter(c=>c.track===m.id).sort((a,b)=>a.start-b.start)){c.start=at;at+=c.dur;}},
 tidy(){const used=new Set(this.p.clips.map(c=>c.track)),tr=this.p.tracks,keep=t=>t.main||used.has(t.id)||t.locked||t.hidden||t.muted||t.syncLock||t.name||t.color;
  this.p.tracks=tr.filter(t=>keep(t)||((t.kind==='text'||t.kind==='audio')&&!tr.some(o=>o.kind===t.kind&&keep(o))&&t===tr.find(o=>o.kind===t.kind)));
  if(!this.p.tracks.some(t=>t.kind==='text'))this.addTrack('text','top');if(!this.p.tracks.some(t=>t.kind==='audio'))this.addTrack('audio','bottom');},
 snapshot(){this.past.push(JSON.stringify(this.p));if(this.past.length>100)this.past.shift();this.future=[];},
 undo(){if(!this.past.length)return;this.future.push(JSON.stringify(this.p));this.p=JSON.parse(this.past.pop());this.after(true,false);this.fit();},
 redo(){if(!this.future.length)return;this.past.push(JSON.stringify(this.p));this.p=JSON.parse(this.future.pop());this.after(true,false);this.fit();},
 /** Players of clips that are gone (deleted, nested, broken apart, undone) stop and are let go. */
 prune(){const keep=new Set(),walk=(cl,pre)=>{for(const c of cl){keep.add(pre+c.id);keep.add(pre+c.id+'#b');if(c.nest)walk(c.nest.clips,pre+c.id+'/');}};walk(this.p?.clips||[],'');
  for(const k of Object.keys(this.els))if(!keep.has(k)){this.els[k].pause?.();delete this.els[k];}},
 after(all,arrange=true){this._dk=null;if(arrange){this.pack();this.tidy();}this.prune();for(const id of [...this.sels])if(!this.clip(id))this.sels.delete(id);if(this.sel&&!this.clip(this.sel))this.sel=[...this.sels].pop()||null;if(this.junction&&!this.clip(this.junction))this.junction=null;
  this.save();this.drawTimeline();if(all)this.drawProps();if(this.tab==='filters'||this.tab==='trans')this.drawLib();this.sync();this.draw();this.drawTime();},
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
  const used=edAll(this.p.clips).filter(c=>c.media===id).length;
  if(!await ask('Remove this file?',used?`It is also taken off the timeline (${used} clip${used>1?'s':''}).`:'It leaves this editor. The file on your computer stays.','Remove',true,{file:{name:m.name}}))return;
  const drop=cl=>cl.filter(c=>c.media!==id).map(c=>{if(c.nest)c.nest.clips=drop(c.nest.clips);return c;});
  if(used){this.snapshot();this.p.clips=drop(this.p.clips);}
  this.media=this.media.filter(x=>x.id!==id);this.del(id).catch(()=>{});
  for(const k of Object.keys(this.els))if(!this.clip(k)){this.els[k].pause?.();delete this.els[k];}
  this.drawLib();this.after(true);
 },
 // ---------- adding to the timeline ----------
 add(mid,at,trackId,options){
  return this.addMediaClips([mid],at,trackId,options)[0];
 },
 addMediaClips(ids,at,trackId,{overlay=false}={}){
  const media=ids.map(id=>this.media.find(item=>item.id===id)).filter(Boolean);
  const ready=media.filter(item=>item.type!=='video'||item.dur>0);
  if(ready.length!==media.length)toast('Still reading video. Try again in a moment.');
  if(!ready.length)return [];
  const main=this.main(),target=this.p.tracks.find(t=>t.id===trackId);
  const playhead=this.time;
  this.snapshot();
  const clips=ready.map(item=>{
   const kind=item.type==='audio'?'audio':'video',dur=item.dur||5;
   const requested=target?.kind===kind&&!target.locked?target:null;
   const asOverlay=kind==='video'&&(overlay||(!requested&&item.type==='image'&&this.trackEnd(main.id)>0));
   const prefer=asOverlay?(requested&&!requested.main?requested.id:undefined):(requested?.id||(kind==='video'?main.id:undefined));
   let start=Math.max(0,at??playhead),track;
   if(!asOverlay&&prefer===main.id&&!main.locked&&(at===undefined||requested?.main&&this.p.magnet)){
    track=main.id;
    if(at===undefined)start=this.trackEnd(main.id);
   }else track=this.place(kind,start,dur,prefer,undefined,{overlay:asOverlay});
   const clip={id:this.uid(),track,media:item.id,start,in:0,dur,...ED_MEDIA_DEFAULTS};
   if(kind==='video'&&(track!==main.id||item.type==='image')){
    const limit=track!==main.id ? .55 : 1,[width,height]=this.base();
    const fit=Math.min(width/item.w,height/item.h);
    clip.scale=Number.isFinite(fit)&&fit>0?Math.min(limit,1/fit):limit;
    if(clip.scale!==1)clip.initialScale=clip.scale;
   }
   this.p.clips.push(clip);
   return clip;
  });
  this.pick(clips.at(-1).id);this.after(true);
  return clips;
 },
 textClip(i,at,text){
  const [label,size,weight,box]=ED_TEXTS[i];
  return {id:this.uid(),text:text??(label==='Body text'?'Your text here':label),start:at??this.time,dur:3,size,weight,color:'#ffffff',box,boxColor:'#000000',align:'center',font:'Tempoloom UI',stroke:0,strokeColor:'#000000',shadow:!box,spacing:0,
   x:0,y:label==='Caption'?.32:0,opacity:1,scale:1,rotate:0,animIn:'none',animOut:'none',animDur:.5};
 },
 addText(i){this.snapshot();const c=this.textClip(i);c.track=this.place('text',c.start,c.dur,this.p.tracks.find(t=>t.kind==='text')?.id,undefined,{visible:true});this.p.clips.push(c);this.pick(c.id);this.after(true);return c;},
 tplStyle(c){const s={};for(const k of ED_TSTYLE)if(c[k]!==undefined)s[k]=c[k];return s;},
 addTemplate(tp){this.snapshot();const c=Object.assign(this.textClip(0),{text:tp.text},JSON.parse(JSON.stringify(tp.style||{})));
  c.track=this.place('text',c.start,c.dur,this.p.tracks.find(t=>t.kind==='text')?.id,undefined,{visible:true});this.p.clips.push(c);this.pick(c.id);this.after(true);return c;},
 async saveTemplate(c,name){const tp={id:this.uid(),name,text:c.text||'',style:this.tplStyle(c)};this.tpls=[tp,...(this.tpls||[])].slice(0,60);
  try{await this.write([['meta','textTemplates',this.tpls]]);}catch{}toast(`Template saved: ${name} (Text, Templates)`);return tp;},
 async dropTemplate(id){this.tpls=(this.tpls||[]).filter(t=>t.id!==id);try{await this.write([['meta','textTemplates',this.tpls]]);}catch{}},
 addSticker(s){this.snapshot();const scale=.75,c={id:this.uid(),sticker:s,start:this.time,dur:3,...(s.type==='shape'?{color:'#ffd23f'}:{}),scale,initialScale:scale,x:0,y:0,rotate:0,opacity:1,animIn:'pop',animOut:'none',animDur:.4};
  if(s.type==='mesh'){c.color='#71A7F4';c.depth3d=1;}
  c.track=this.place('sticker',c.start,c.dur,this.p.tracks.find(t=>t.kind==='sticker')?.id,undefined,{visible:true});this.p.clips.push(c);this.pick(c.id);this.after(true);return c;},
 // ---------- selecting ----------
 pick(id,add){this.junction=null;if(!id){this.sels.clear();this.sel=null;return;}
  const c=this.clip(id),mates=c?.group&&!this.solo?this.p.clips.filter(o=>o.group===c.group).map(o=>o.id):[id];
  if(add){if(this.sels.has(id)){for(const m of mates)this.sels.delete(m);this.sel=[...this.sels].pop()||null;}else{for(const m of mates)this.sels.add(m);this.sel=id;}}else{this.sels=new Set(mates);this.sel=id;}},
 group(){const list=this.picked();if(list.length<2)return toast('Select two or more clips to group them.');this.snapshot();const g=this.uid();for(const c of list)c.group=g;this.after(true);toast(`Grouped ${list.length} clips`);},
 ungroup(){const list=this.picked().filter(c=>c.group);if(!list.length)return toast('Nothing selected is grouped.');this.snapshot();for(const c of list)delete c.group;this.after(true);toast('Ungrouped');},
 /** New copies get new group ids, so they do not join the group of what they were copied from. */
 regroup(list){const map={};for(const c of list)if(c.group)c.group=map[c.group]||(map[c.group]=this.uid());},
 select(id,add){this.pick(id,add);this.drawTimeline();this.drawProps();if(this.tab==='filters'||this.tab==='trans')this.drawLib();this.draw();},
 togglePositionLock(c){
  if(!c||this.clip(c.id)!==c||this.kindOf(c)==='audio'||c.adjustment||this.trackOf(c)?.locked||this.exporting)return;
  this.snapshot();if(c.positionLocked)delete c.positionLocked;else c.positionLocked=true;
  this.save();this.drawTimeline();this.drawProps();this.draw();
 },
 selectJoin(id){this.sels.clear();this.sel=null;this.junction=id;this.libraryTransitionScope='cut';this.drawTimeline();this.drawProps();if(this.tab==='filters'||this.tab==='trans')this.drawLib();this.draw();},
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
 splitClip(c,t){const first=t-c.start,b={...c,id:this.uid(),start:t,in:this.srcAt(c,t),dur:c.dur-first};delete b.trans;if(c.nest)b.nest=this.renest(c.nest);
  if(c.ramp){const [r1,r2]=edRampSplit(c.ramp,first/c.dur);c.ramp=r1;b.ramp=r2;}
  if(c.kf){b.kf={};c.kf=Object.fromEntries(Object.entries(c.kf).map(([k,f])=>{b.kf[k]=f.filter(x=>x.t>=first).map(x=>({...x,t:x.t-first}));return [k,f.filter(x=>x.t<=first)];}));}
  c.dur=first;c.fadeOut=0;b.fadeIn=0;this.p.clips.push(b);return b;},
 /** Moves every clip on a track that starts at or after `from` by d seconds (negative = left). */
 shiftTrack(trackId,from,d,except){for(const o of this.p.clips)if(o.track===trackId&&o.start>=from-.001&&o!==except)o.start=Math.max(0,o.start+d);},
 /** Plan the moves on opted-in tracks. A ripple stops if it would cut through a clip there. */
 syncRipplePlan(edits,baseline){
  const sources=new Set(edits.map(edit=>edit.track));
  const followers=new Set(this.p.tracks.filter(track=>track.syncLock&&!track.locked&&!sources.has(track.id)).map(track=>track.id));
  const moves=new Map();
  if(!followers.size)return moves;
  const intervals=[];
  for(const {at,delta} of edits){
   if(Math.abs(delta)<1e-6||intervals.some(edit=>Math.abs(edit.at-at)<1e-6&&Math.abs(edit.delta-delta)<1e-6))continue;
   intervals.push({at,delta,end:at+Math.max(0,-delta)});
  }
  intervals.sort((a,b)=>a.at-b.at);
  if(intervals.some((edit,i)=>i>0&&(intervals[i-1].end>edit.at+1e-6||Math.abs(intervals[i-1].at-edit.at)<1e-6)))return null;
  for(const clip of this.p.clips){
   if(!followers.has(clip.track))continue;
   const start=baseline?.get(clip)??clip.start;
   let offset=0;
   for(const edit of intervals){
    if(start>=edit.end-1e-6)offset+=edit.delta;
    else if(start+clip.dur>edit.at+1e-6)return null;
   }
   moves.set(clip,Math.max(0,start+offset));
  }
  return moves;
 },
 /** The clips the playhead tools act on: the selected ones under the playhead, else the main track's clip there, else any. */
 underHead(){const t=this.time,inside=x=>t>x.start+.02&&t<x.start+x.dur-.02&&!this.trackOf(x)?.locked;
  const s=this.picked().filter(inside);if(s.length)return s;const c=this.p.clips.find(x=>x.track===this.main()?.id&&inside(x))||this.p.clips.find(inside);return c?[c]:[];},
 /** Ripple delete: the selection goes and what comes after it on the same track moves left to close the space. */
 rippleRemove(){
  const list=this.picked().filter(c=>!this.trackOf(c)?.locked);if(!list.length)return toast('Select a clip to ripple delete.');
  const gone=new Set(list.map(c=>c.id));
  const cuts=list.map(c=>({track:c.track,at:c.start,end:c.start+c.dur,delta:-c.dur}))
   .filter(cut=>!this.p.clips.some(c=>!gone.has(c.id)&&c.track===cut.track&&c.start<cut.end-.001&&c.start+c.dur>cut.at+.001));
  const moves=this.syncRipplePlan(cuts);
  if(!moves)return toast('Ripple blocked by a clip on a sync-locked track.');
  this.snapshot();this.p.clips=this.p.clips.filter(x=>!gone.has(x.id));
  for(const id of gone){this.els[id]?.pause?.();delete this.els[id];}
  // Work right to left so each cut still uses its original time.
  for(const cut of cuts.sort((a,b)=>b.at-a.at))this.shiftTrack(cut.track,cut.end,cut.delta);
  for(const [clip,start] of moves)clip.start=start;
  this.pick(null);this.after(true);toast(list.length>1?`Ripple deleted ${list.length} clips`:'Ripple deleted');
 },
 /** The empty space at time t on a track, between the clip before it and the clip after it. */
 gapAt(trackId,t){const cl=this.p.clips.filter(c=>c.track===trackId).sort((a,b)=>a.start-b.start);if(cl.some(c=>t>=c.start&&t<c.start+c.dur))return null;
  const next=cl.find(c=>c.start>t);if(!next)return null;const prev=[...cl].reverse().find(c=>c.start+c.dur<=t+.001);const s=prev?prev.start+prev.dur:0;return next.start-s>.01?{s,e:next.start}:null;},
 closeGap(trackId,t){const tr=this.p.tracks.find(x=>x.id===trackId);if(!tr||tr.locked)return;const g=this.gapAt(trackId,t);if(!g)return;
  const moves=this.syncRipplePlan([{track:trackId,at:g.s,delta:g.s-g.e}]);
  if(!moves)return toast('Ripple blocked by a clip on a sync-locked track.');
  this.snapshot();this.shiftTrack(trackId,g.e,g.s-g.e);
  for(const [clip,start] of moves)clip.start=start;
  this.after(true);toast('Gap closed');},
 /** Trim to the playhead and close the space (Q: the part before it goes; W: the part after it goes). */
 trimTo(side){
  const t=this.time,list=this.underHead();if(!list.length)return toast('Move the playhead over a clip.');
  const moves=this.syncRipplePlan(list.map(c=>({track:c.track,at:side==='start'?c.start:t,delta:side==='start'?c.start-t:t-c.start-c.dur})));
  if(!moves)return toast('Ripple blocked by a clip on a sync-locked track.');
  this.snapshot();let back=null;
  for(const c of list){const sp=c.speed||1,end=c.start+c.dur;
   if(side==='start'){const d=t-c.start;if(c.media||c.nest)c.in=this.srcAt(c,t);if(c.ramp)c.ramp=edRampSplit(c.ramp,d/c.dur)[1];c.dur-=d;delete c.trans;
    if(c.kf)for(const k of Object.keys(c.kf)){const f=c.kf[k];const v0=this.val({...c,dur:c.dur+d,kf:{[k]:f}},k,t);c.kf[k]=[{t:0,v:v0},...f.filter(x=>x.t>d).map(x=>({...x,t:x.t-d}))];}
    this.shiftTrack(c.track,end,-d,c);back=back??c.start;}
   else{const d=end-t;if(c.ramp)c.ramp=edRampSplit(c.ramp,(c.dur-d)/c.dur)[0];c.dur-=d;this.shiftTrack(c.track,end,-d,c);}
   c.fadeIn=Math.min(c.fadeIn||0,c.dur/2);c.fadeOut=Math.min(c.fadeOut||0,c.dur/2);}
  for(const [clip,start] of moves)clip.start=start;
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
 setRange(which){const fps=this.fps(),t=Math.round(this.time*fps)/fps;this.snapshot();const r={...(this.p.range||{})};r[which]=t;
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
  const made=[];for(const c of list){const start=c.start+c.dur,d={...JSON.parse(JSON.stringify(c)),id:this.uid(),start};if(d.nest)d.nest=this.renest(d.nest);d.track=this.place(this.kindOf(c),start,c.dur,c.track);this.p.clips.push(d);made.push(d);this.sels.add(d.id);this.sel=d.id;}this.regroup(made);this.after(true);},
 copy(cut){const list=this.picked();if(!list.length)return;this.clipboard=JSON.parse(JSON.stringify(list.map(c=>({...c,kind:this.kindOf(c)}))));toast(cut?`Cut ${list.length}`:`Copied ${list.length}`);if(cut)this.remove();},
 // ---------- transitions: on the clip that comes after the cut ----------
 prevOf(c){return this.p.clips.find(o=>o.track===c.track&&o.id!==c.id&&Math.abs(o.start+o.dur-c.start)<.05);},
 setTrans(c,type,dur){if(!c)return;this.snapshot();if(type==='none')delete c.trans;else c.trans={type,dur:dur??c.trans?.dur??.6};this.after(true);},
 transAll(type,dur,kind='video'){
  const remove=type==='none';
  const clips=this.p.clips.filter(c=>this.kindOf(c)===kind&&!this.trackOf(c)?.locked&&(remove?c.trans:this.prevOf(c)));
  if(!clips.length)return 0;
  this.snapshot();
  for(const clip of clips){if(remove)delete clip.trans;else clip.trans={type,dur};}
  this.after(true);
  return clips.length;
 },
 // ---------- keyframes: per property, at times from the clip's start ----------
 val(c,k,t=this.time){const d={scale:1,opacity:1,volume:1,tiltX:-18,tiltY:28,depth3d:.58}[k]??0,f=c.kf?.[k];if(!f?.length)return c[k]??d;const lt=edClamp(t-c.start,0,c.dur);
  if(lt<=f[0].t)return f[0].v;const last=f[f.length-1];if(lt>=last.t)return last.v;const i=f.findIndex(x=>x.t>lt),a=f[i-1],b=f[i];return a.v+(b.v-a.v)*edEaseOf(a.e)((lt-a.t)/(b.t-a.t||1));},
 /** The easing of the keyframes at the playhead (all properties of the clip), or null. */
 kfEaseAt(c){let e=null;for(const f of Object.values(c.kf||{})){const x=f.find(x=>edKeyframeNear(x,c,this.time));if(x){e=x.e||'smooth';break;}}return e;},
 setKfEase(c,e){this.snapshot();for(const f of Object.values(c.kf||{}))for(const x of f)if(edKeyframeNear(x,c,this.time)){if(e==='smooth')delete x.e;else x.e=e;}this.after(true);},
 /** The curve editor: a custom easing on the keyframes at the playhead (no undo step: the drag made one). */
 setKfCurve(c,bz){for(const f of Object.values(c.kf||{}))for(const x of f)if(edKeyframeNear(x,c,this.time))x.e=[...bz];},
 kfAt(c,k){return (c.kf?.[k]||[]).findIndex(x=>edKeyframeNear(x,c,this.time));},
 toggleKf(c,k){if(c.positionLocked&&ED_POSITION_KEYS.has(k))return;
  const lt=edClamp(this.time-c.start,0,c.dur);this.snapshot();c.kf=c.kf||{};const f=c.kf[k]=c.kf[k]||[];const i=this.kfAt(c,k);
  if(i>=0)f.splice(i,1);else{f.push({t:lt,v:this.val(c,k)});f.sort((a,b)=>a.t-b.t);}if(!f.length)delete c.kf[k];this.after(true);},
 /** Setting a value: with keyframes, it goes into the keyframe at the playhead (made if there is none). */
 setVal(c,k,v){if(c.positionLocked&&ED_POSITION_KEYS.has(k))return;
  const f=c.kf?.[k];if(f?.length){const lt=edClamp(this.time-c.start,0,c.dur),i=this.kfAt(c,k);if(i>=0)f[i].v=v;else{f.push({t:lt,v});f.sort((a,b)=>a.t-b.t);}}else c[k]=v;},
 // ---------- playback ----------
 element(c,extra=''){
  const key=(this._nk||'')+c.id+extra;let el=this.els[key];const m=this.mediaOf(c);
  if(!el&&m&&m.type!=='image'){
   el=document.createElement(c.asAudio?'audio':m.type);el.src=m.type==='video'&&!c.asAudio?this.proxySrc(m):this.urls[m.id];el.preload='auto';el.playsInline=true;el.crossOrigin='anonymous';
   el.addEventListener('seeked',()=>{if(!this.playing)this.draw();});el.addEventListener('loadeddata',()=>{if(!this.playing)this.draw();});
   this.els[key]=el;if(extra)el.muted=true;else if(this.ac)this.route(el);
  }
  return el;
 },
 image(m){let im=this.imgs[m.id];if(!im){im=new Image();im.onload=()=>{if(!this.playing)this.draw();};im.src=this.urls[m.id];this.imgs[m.id]=im;}return im;},
 previewLevel(){return this.previewMuted?0:this.previewVolume;},
 updatePreviewAudio(){if(this.monitorGain)this.monitorGain.gain.value=this.previewLevel();if(this.p)this.sync();},
 // Send the project mix directly to the recorder. The monitor controls only the speakers.
 audio(){if(this.ac)return;try{const ac=this.ac=new AudioContext();this.rec=ac.createMediaStreamDestination();this.master=ac.createGain();
  this.monitorGain=ac.createGain();this.monitorGain.gain.value=this.previewLevel();this.master.connect(this.monitorGain).connect(ac.destination);this.master.connect(this.rec);
  const sp=ac.createChannelSplitter(2);this.monitorGain.connect(sp);this.meters=[0,1].map(i=>{const a=ac.createAnalyser();a.fftSize=1024;sp.connect(a,i);return a;});
  for(const el of Object.values(this.els))this.route(el);
  edPitchModule(ac).then(ok=>{if(ok&&!this.playing)this.sync();});}catch{this.ac=null;}},
 route(el){if(el._routed||!this.ac)return;try{const s=this.ac.createMediaElementSource(el),fx=edFxChain(this.ac),g=this.ac.createGain(),p=this.ac.createStereoPanner();s.connect(fx.input);fx.output.connect(g);g.connect(p);p.connect(this.master);el._fx=fx;el._gain=g;el._pan=p;el._routed=true;}catch{}},
 /** The clip after c on its track, touching it (where a transition would be), or undefined. */
 nextOf(c){return this.p.clips.find(o=>o.track===c.track&&o.id!==c.id&&Math.abs(c.start+c.dur-o.start)<.05);},
 /** Where a clip's sound plays: an audio clip with a crossfade starts early and ends late (as far as its file allows). */
 sndSpan(c){let s=c.start,e=c.start+c.dur;if(this.kindOf(c)!=='audio'||c.ramp||(c.speed&&c.speed!==1))return [s,e];const m=this.mediaOf(c);
  if(c.trans)s=Math.max(c.start-c.trans.dur/2,c.start-(c.in||0));const nx=this.nextOf(c);if(nx?.trans&&m?.dur)e=c.start+c.dur+Math.max(0,Math.min(nx.trans.dur/2,m.dur-(c.in||0)-c.dur));return [s,e];},
 fade(c,t){const tt=edClamp(t,c.start,c.start+c.dur);let v=1;
  if(this.kindOf(c)==='audio'){if(c.trans){const d=c.trans.dur,p=(t-(c.start-d/2))/d;if(p<1)v*=Math.sin(Math.PI/2*edClamp(p,0,1));}
   const nx=this.nextOf(c);if(nx?.trans){const d=nx.trans.dur,p=(t-(c.start+c.dur-d/2))/d;if(p>0)v*=Math.cos(Math.PI/2*edClamp(p,0,1));}}const local=tt-c.start;if(c.fadeIn&&local<c.fadeIn)v*=Math.max(0,local/c.fadeIn);if(c.fadeOut&&c.start+c.dur-tt<c.fadeOut)v*=Math.max(0,(c.start+c.dur-tt)/c.fadeOut);return v;},
 /** A clip's loudness at t: volume (keyframes), fades, loudness match (gainDb) and ducking. Playback and export both use it. */
 vol(c,t){const tr=this.trackOf(c);if(c.muted||tr?.muted||(c.detached&&!c.asAudio))return 0;if(this._mcA&&tr&&tr.id!==this._mcA)return 0;
  if(this.p.tracks.some(x=>x.solo)&&!tr?.solo)return 0;
  return edClamp(this.val(c,'volume',t)*this.fade(c,t)*edDb(c.gainDb||0)*(tr?.vol??1)*(c.duck?this.duckAt(t,c):1)*(this._vm??1),0,8);},
 // ---------- drawing the frame ----------
 base(){return ED_RATIOS[this.p.ratio];},
 size(){const b=this.base(),k=this.exporting?.scale||1;return [Math.round(b[0]*k/2)*2,Math.round(b[1]*k/2)*2];},
 k(){return this.size()[0]/this.base()[0];},
 src(c){if(c.adjustment||c.nest){const [W,H]=this.size();return {sx:0,sy:0,sw:W,sh:H};}const m=this.mediaOf(c),w=m?.w||1,h=m?.h||1,cr=c.crop||{},l=cr.l||0,t=cr.t||0,r=cr.r||0,b=cr.b||0;return {sx:l*w,sy:t*h,sw:Math.max(1,w*(1-l-r)),sh:Math.max(1,h*(1-t-b))};},
 rect(c,W,H,t=this.time){
  if(c.title){const s=this.val(c,'scale',t);return {w:W*s,h:H*s,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H};}
  if(c.sticker&&!c.nest){const s=220*this.k()*this.val(c,'scale',t),line=c.sticker.type==='shape'&&(c.sticker.shape??c.sticker.id)==='line';return {w:line?s*1.4:s,h:line?s*.2:s,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H};}
  const s=this.src(c),fit=Math.min(W/s.sw,H/s.sh)*this.val(c,'scale',t);return {w:s.sw*fit,h:s.sh*fit,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H};},
 box(g,c,W,H,t=this.time){return c.text!==undefined?this.textBox(g,c,W,H,t):c.title?this.titleBox(g,c,W,H,t):this.rect(c,W,H,t);},
 visible(t){const active=new Map(),out=[];
  for(const c of this.p.clips){
   if(!(t>=c.start&&t<c.start+c.dur))continue;
   if(!active.has(c.track))active.set(c.track,[]);
   active.get(c.track).push(c);
  }
  for(let i=this.p.tracks.length-1;i>=0;i--){const tr=this.p.tracks[i],clips=active.get(tr.id);
   if(clips&&ED_VISUAL.has(tr.kind)&&!tr.hidden)for(const c of clips.sort((a,b)=>a.start-b.start))out.push(c);}
  return out;},
 filterOf(c,extra){const a=c.adj||{},k=this.k(),f=[];
  if(a.brightness)f.push(`brightness(${1+a.brightness/100})`);if(a.contrast)f.push(`contrast(${1+a.contrast/100})`);if(a.saturation)f.push(`saturate(${1+a.saturation/100})`);if(a.hue)f.push(`hue-rotate(${a.hue}deg)`);
  const bl=(a.blur||0)+(extra||0);if(bl)f.push(`blur(${bl*k}px)`);return f.join(' ')||'none';},
 /** One picture, sticker or text at time t, with what a transition adds (alpha, offset, zoom, wipe, blur). */
 /** Does this clip need its own layer (blend mode, green screen or mask)? */
 layered(c){return !!(c.fx&&(c.fx.glow||c.fx.sharpen||c.fx.grain||(c.fx.style&&c.fx.style!=='none')))||(c.blend&&c.blend!=='normal')||c.key?.on||(c.mask&&c.mask.shape&&c.mask.shape!=='none')||edGraded(c.grade);},
 /** Draws the clip alone on a layer, keys out its colour, cuts it with its mask, then blends the layer onto the frame. */
 drawLayered(g,c,t,o){
  const [W,H]=this.size(),L=this._layer||(this._layer=document.createElement('canvas'));if(L.width!==W||L.height!==H){L.width=W;L.height=H;}
  if(c.adjustment){const S=this._adjSnap||(this._adjSnap=document.createElement('canvas'));if(S.width!==W||S.height!==H){S.width=W;S.height=H;}const sg=S.getContext('2d');sg.clearRect(0,0,W,H);sg.drawImage(g.canvas,0,0);this._adjFrame=S;}
  const lg=L.getContext('2d',{willReadFrequently:true});lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='source-over';lg.globalAlpha=1;lg.filter='none';lg.clearRect(0,0,W,H);
  this.drawClip(lg,c,t,{...o,flat:true});
  const b=this.box(lg,c,W,H,t),rot=this.val(c,'rotate',t)*Math.PI/180,k=(o.k||1),cx=b.cx+(o.dx||0),cy=b.cy+(o.dy||0);
  if(c.key?.on&&!this.picking){const hw=(Math.abs(Math.cos(rot))*b.w+Math.abs(Math.sin(rot))*b.h)*k/2,hh=(Math.abs(Math.sin(rot))*b.w+Math.abs(Math.cos(rot))*b.h)*k/2;
   const x0=Math.max(0,Math.floor(cx-hw)),y0=Math.max(0,Math.floor(cy-hh)),x1=Math.min(W,Math.ceil(cx+hw)),y1=Math.min(H,Math.ceil(cy+hh));
   if(x1>x0&&y1>y0){const im=lg.getImageData(x0,y0,x1-x0,y1-y0);edKey(im.data,c.key);lg.putImageData(im,x0,y0);}}
  if(c.adjustment)this._adjFrame=this._adjFrame;// (the frame was kept before the layer was cleared)
  if(edGraded(c.grade)){const lut=this.gradeLut(c.grade);if(lut){const out=EdGL.apply(L,lut);if(out){lg.save();lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='copy';lg.drawImage(out,0,0);lg.restore();}}}
  if(c.fx&&(c.fx.glow||c.fx.sharpen||c.fx.grain||(c.fx.style&&c.fx.style!=='none')))edLayerFx(L,lg,c.fx,t,this.k());
  const mk=c.mask;
  if(mk&&mk.shape&&mk.shape!=='none'){lg.save();lg.globalCompositeOperation=mk.invert?'destination-out':'destination-in';lg.translate(cx,cy);lg.rotate(rot);lg.scale(k,k);
   const mw=b.w*(mk.w??.8),mh=b.h*(mk.h??.8),mx=b.w*(mk.x||0),my=b.h*(mk.y||0),fe=(mk.feather||0)*this.k();
   if(mk.shape==='linear'){const a=(mk.angle||0)*Math.PI/180,R=Math.hypot(b.w,b.h),dx=Math.sin(a),dy=-Math.cos(a),half=Math.max(.5,fe);
    const gr=lg.createLinearGradient(mx-dx*half,my-dy*half,mx+dx*half,my+dy*half);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,1)');lg.fillStyle=gr;lg.fillRect(-R,-R,2*R,2*R);}
   else{if(fe)lg.filter=`blur(${fe}px)`;lg.fillStyle='#000';lg.beginPath();
    if(mk.shape==='circle')lg.ellipse(mx,my,mw/2,mh/2,0,0,Math.PI*2);
    else if(mk.shape==='band'){const R=Math.hypot(b.w,b.h);lg.save();lg.translate(mx,my);lg.rotate((mk.angle||0)*Math.PI/180);lg.rect(-R,-mh/2,2*R,mh);lg.restore();}
    else if(mk.shape==='heart'){const x0=mx,y0=my-mh*.2;lg.moveTo(x0,y0);lg.bezierCurveTo(x0,y0-mh*.3,x0-mw*.5,y0-mh*.3,x0-mw*.5,y0+mh*.02);lg.bezierCurveTo(x0-mw*.5,y0+mh*.35,x0,y0+mh*.55,x0,y0+mh*.7);lg.bezierCurveTo(x0,y0+mh*.55,x0+mw*.5,y0+mh*.35,x0+mw*.5,y0+mh*.02);lg.bezierCurveTo(x0+mw*.5,y0-mh*.3,x0,y0-mh*.3,x0,y0);}
    else if(mk.shape==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?.4:1;lg.lineTo(mx+Math.cos(a)*mw/2*rr,my+Math.sin(a)*mh/2*rr);}lg.closePath();}
    else lg.roundRect(mx-mw/2,my-mh/2,mw,mh,Math.min(mw,mh)/2*(mk.round||0));lg.fill();}
   lg.restore();}
  g.save();g.globalCompositeOperation=c.blend&&c.blend!=='normal'?c.blend:'source-over';g.drawImage(L,0,0);g.restore();
 },
 drawClip(g,c,t,o={}){
  if(!o.flat&&this.layered(c))return this.drawLayered(g,c,t,o);
  const [W,H]=this.size();
  if(c.text!==undefined)return this.drawText(g,c,W,H,t,o);
  if(c.title)return c._hide?undefined:this.drawTitle(g,c,W,H,t,o);
  if(c.sticker)return this.drawSticker(g,c,W,H,t,o);
  // an adjustment layer's picture is everything drawn under it so far
  if(c.adjustment&&!o.flat){const S=this._adjSnap||(this._adjSnap=document.createElement('canvas'));if(S.width!==W||S.height!==H){S.width=W;S.height=H;}const sg=S.getContext('2d');sg.clearRect(0,0,W,H);sg.drawImage(g.canvas,0,0);this._adjFrame=S;}
  const m=this.mediaOf(c);if(!m&&!c.adjustment&&!c.nest)return;const src=c.nest?this.nestFrame(c,t):c.adjustment?this._adjFrame:m.type==='image'?this.image(m):this.element(c);
  if(!src||(m&&m.type==='video'&&src.readyState<2)||(m&&m.type==='image'&&!src.complete))return;
  const an=(c.animIn&&c.animIn!=='none')||(c.animOut&&c.animOut!=='none')?this.animApply(c,t):null;
  if(an){o={...o,dx:(o.dx||0)+an.dx*W,dy:(o.dy||0)+an.dy*H,k:(o.k||1)*an.k,alpha:(o.alpha??1)*an.alpha,rot:(o.rot||0)+an.rot,blur:Math.max(o.blur||0,an.blur)};}
  const r=this.rect(c,W,H,t),s=this.src(c),a=this.val(c,'opacity',t)*this.fade(c,t)*(o.alpha??1);if(a<=0)return;
  const fx=c.fx||{},sh=edShake(fx,t,W),rad=(fx.radius||0)/100*Math.min(r.w,r.h)/2,kk=this.k();
  g.save();if(o.clipX!=null){g.beginPath();g.rect(0,0,o.clipX,H);g.clip();}if(o.clipR!=null){g.beginPath();g.arc(W/2,H/2,Math.max(.1,o.clipR),0,Math.PI*2);g.clip();}
  g.globalAlpha=edClamp(a,0,1);g.translate(r.cx+(o.dx||0)+sh[0],r.cy+(o.dy||0)+sh[1]);g.rotate((this.val(c,'rotate',t)+(o.rot||0))*Math.PI/180+sh[2]);g.scale((c.flipH?-1:1)*(o.k||1),(c.flipV?-1:1)*(o.k||1));
  // shadow: under a rounded box, or (no rounding) following the picture's own outline, so a cut-out casts its shape
  if(fx.shadow&&rad){g.save();g.shadowColor=`rgba(0,0,0,${.25+fx.shadow/200})`;g.shadowBlur=fx.shadow/100*40*kk;g.shadowOffsetY=fx.shadow/100*14*kk;g.fillStyle='#000';g.beginPath();g.roundRect(-r.w/2,-r.h/2,r.w,r.h,rad);g.fill();g.restore();}
  if(rad){g.beginPath();g.roundRect(-r.w/2,-r.h/2,r.w,r.h,rad);g.clip();}
  if(fx.shadow&&!rad){g.shadowColor=`rgba(0,0,0,${.25+fx.shadow/200})`;g.shadowBlur=fx.shadow/100*40*kk;g.shadowOffsetY=fx.shadow/100*14*kk;}
  const kq=m&&m.type==='video'&&src.videoWidth&&m.w?src.videoWidth/m.w:1;// a proxy is smaller than the original: the same part of it
  g.filter=this.filterOf(c,o.blur);g.drawImage(src,s.sx*kq,s.sy*kq,s.sw*kq,s.sh*kq,-r.w/2,-r.h/2,r.w,r.h);
  // smooth slow motion: the next frame mixed in by how far between the two this moment is
  if(c.frameBlend&&m?.type==='video'&&!c.asAudio){const e2=this.els[(this._nk||'')+c.id+'#b'];if(e2?.readyState>=2){const fr=(this.srcAt(c,t)*30)%1;if(fr>.02){const ga=g.globalAlpha;g.globalAlpha=ga*fr;g.drawImage(e2,s.sx*kq,s.sy*kq,s.sw*kq,s.sh*kq,-r.w/2,-r.h/2,r.w,r.h);g.globalAlpha=ga;}}}
  g.filter='none';g.shadowColor='transparent';
  if(fx.border){g.lineWidth=fx.border*kk*2;g.strokeStyle=fx.borderColor||'#ffffff';g.beginPath();g.roundRect(-r.w/2,-r.h/2,r.w,r.h,rad);g.stroke();}
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
  else if(type==='pushright'){const e=edEase(p);d(A,{dx:e*W});d(B,{dx:(e-1)*W});}
  else if(type==='zoom'){d(A,{k:1+p*.5,alpha:1-p});d(B,{k:.85+.15*p,alpha:p});}
  else if(type==='wipe'){d(A,{});d(B,{clipX:edEase(p)*W});}
  else if(type==='wipeup'){const h=edEase(p)*H;d(A,{});g.save();g.beginPath();g.rect(0,H-h,W,h);g.clip();d(B,{});g.restore();}
  else if(type==='blur'){d(A,{blur:p*30});d(B,{blur:(1-p)*30,alpha:edEase(p)});}
  else if(type==='white'||type==='dipwarm'){if(p<.5)d(A,{});else d(B,{});g.save();g.globalAlpha=1-Math.abs(p*2-1);g.fillStyle=type==='white'?'#fff':'#ffbc84';g.fillRect(0,0,W,H);g.restore();}
  else if(type==='zoomblur'){if(p<.5)d(A,{k:1+p*1.2,blur:p*40});else d(B,{k:1.6-(p-.5)*1.2,blur:(1-p)*40});}
  else if(type==='iris'){d(A,{});d(B,{clipR:edEase(p)*Math.hypot(W,H)/2});}
  else if(type==='whip'){const e=edEase(p);d(A,{dx:-e*W,blur:Math.sin(p*Math.PI)*40});d(B,{dx:(1-e)*W,blur:Math.sin(p*Math.PI)*40});}
  else if(type==='spin'){if(p<.5)d(A,{rot:p*360,k:1-p*.8,alpha:1-p});else d(B,{rot:(p-1)*360,k:.2+(p-.5)*1.6,alpha:p});}
  else if(type==='flash'){if(p<.5)d(A,{});else d(B,{});g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.max(0,1-Math.abs(p-.5)*4);g.fillStyle='#fff';g.fillRect(0,0,W,H);g.restore();}
  else if(type==='glitch'){const s=Math.sin(t*97)*W*.04*(1-Math.abs(p*2-1)),X=p<.5?A:B;d(X,{dx:s});g.save();g.globalCompositeOperation='lighter';d(X,{dx:-s*1.5,alpha:.35});g.restore();}
  else if(type==='shake'){const s=(1-Math.abs(p*2-1))*W*.03;d(A,{dx:Math.sin(t*71)*s,dy:Math.cos(t*53)*s});d(B,{dx:Math.sin(t*67)*s,dy:Math.cos(t*59)*s,alpha:p});}
  else{d(A,{});d(B,{alpha:p});}
 },
 draw(overlays=true,t=this.time){if(overlays&&this.scopesOn&&!this.exporting)requestAnimationFrame(()=>this.drawScopes?.());
  const cv=this.dom.canvas;if(!cv||!this.p)return;const [W,H]=this.size();if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  const g=cv.getContext('2d');g.save();g.fillStyle=this.p.bg||'#000';g.fillRect(0,0,W,H);
  // A blurred, enlarged copy of the main picture fills the frame behind it (for a horizontal clip in a vertical video).
  if(this.p.bgMode==='gradient'){const gr=g.createLinearGradient(0,0,W,H);gr.addColorStop(0,this.p.bg||'#000000');gr.addColorStop(1,this.p.bg2||'#3a1c71');g.fillStyle=gr;g.fillRect(0,0,W,H);}
  if(this.p.bgMode==='image'){const m=this.media.find(x=>x.id===this.p.bgImage&&x.type==='image'),im=m&&this.image(m);if(im?.complete&&im.naturalWidth){const f=Math.max(W/im.naturalWidth,H/im.naturalHeight);g.drawImage(im,(W-im.naturalWidth*f)/2,(H-im.naturalHeight*f)/2,im.naturalWidth*f,im.naturalHeight*f);}}
  if(this.p.bgMode==='blur'){const mc=this.p.clips.find(c=>c.track===this.main()?.id&&t>=c.start&&t<c.start+c.dur);const m=mc&&this.mediaOf(mc);
   const src=m&&(m.type==='image'?this.image(m):this.element(mc));if(src&&(m.type!=='video'||src.readyState>=2)){const s=this.src(mc),f=Math.max(W/s.sw,H/s.sh)*1.1;g.save();g.filter=`blur(${40*this.k()}px) brightness(.7)`;g.drawImage(src,s.sx,s.sy,s.sw,s.sh,(W-s.sw*f)/2,(H-s.sh*f)/2,s.sw*f,s.sh*f);g.restore();}}
  this.paint(g,t);
  if(overlays&&!this.exporting&&this.sel&&this.clip(this.sel)?.nest?.multi)this.drawAngles();
  if(overlays&&!this.exporting)for(const s of this.picked()){if(!(t>=s.start&&t<s.start+s.dur)||this.kindOf(s)==='audio'||this.trackOf(s)?.hidden)continue;const b=this.box(g,s,W,H,t);
   g.save();g.translate(b.cx,b.cy);g.rotate(this.val(s,'rotate',t)*Math.PI/180);g.strokeStyle=s.positionLocked?'#a3adc2':this.dom.selectionColor||'#fff';g.lineWidth=Math.max(2,W/400);g.setLineDash([W/80,W/120]);g.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
   // one selected: corners to resize, the knob above to rotate
   if(this.sels.size===1&&!s.positionLocked&&!this.trackOf(s)?.locked&&!s.adjustment){const hs=edBoxHandleSize(W,b),a=this.val(s,'rotate',t)*Math.PI/180;
    const [kx,ky]=edVisibleHandle(b,a,0,-b.h/2-edKnob(W),W,H);
    g.setLineDash([]);g.fillStyle='#fff';g.beginPath();g.moveTo(0,-b.h/2);g.lineTo(kx,ky);g.stroke();
    for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const [hx,hy]=edVisibleHandle(b,a,x*b.w/2,y*b.h/2,W,H);g.fillRect(hx-hs/2,hy-hs/2,hs,hs);g.strokeRect(hx-hs/2,hy-hs/2,hs,hs);}
    g.beginPath();g.arc(kx,ky,hs*.6,0,Math.PI*2);g.fill();g.stroke();}
   g.restore();}
  g.restore();
 },
 /** The tracks at t, bottom to top (with transitions), onto g. The timeline, or a nested clip's own (see withNest). */
 paint(g,t){
  for(const tr of [...this.p.tracks].reverse()){
   if(!ED_VISUAL.has(tr.kind)||tr.hidden)continue;
   const cl=this.p.clips.filter(c=>c.track===tr.id).sort((a,b)=>a.start-b.start),done=new Set();
   cl.forEach((c,i)=>{if(done.has(c.id))return;const nx=cl[i+1];
    if(tr.kind==='video'&&nx?.trans&&Math.abs(c.start+c.dur-nx.start)<.05){const d=Math.min(nx.trans.dur,c.dur,nx.dur),a0=nx.start-d/2;if(t>=a0&&t<a0+d){this.drawTrans(g,c,nx,nx.trans.type,(t-a0)/d,t);done.add(nx.id);return;}}
    if(t>=c.start&&t<c.start+c.dur)this.drawClip(g,c,t);});
  }
 },
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
 toggleMarker(){
  const fps=this.fps(),frame=Math.round(this.time*fps),markers=this.p.markers;
  const index=markers.findIndex(marker=>Math.round(edMt(marker)*fps)===frame);
  this.snapshot();
  if(index>=0)markers.splice(index,1);
  else{markers.push({t:frame/fps});markers.sort((a,b)=>edMt(a)-edMt(b));}
  this.after(false);
 },
 setMarker(i,patch){const m=this.p.markers[i];if(!m)return;this.snapshot();if(patch===null)this.p.markers.splice(i,1);else this.p.markers[i]={...(typeof m==='number'?{t:m}:m),...patch};this.after(true);},
 // ---------- tracks: name, colour, height, and the mixer (volume, pan, solo) ----------
 setTrackProp(id,patch){const t=this.p.tracks.find(x=>x.id===id);if(!t)return;Object.assign(t,patch);for(const [k,v] of Object.entries(patch))if(v===undefined||v===null||v==='')delete t[k];this.save();},
 /** Rolls a cut: the end of one clip and the start of the next move together (as Premiere's rolling edit). */
 roll(a,b,d,oa,ob){const sa=oa.speed||1,sb=ob.speed||1,ma=this.mediaOf(a),mb=this.mediaOf(b);
  let lo=Math.max(-(oa.dur-.1),-(ob.media?(ob.in||0)/sb:Infinity)),hi=Math.min(ob.dur-.1,ma&&ma.type!=='image'?(ma.dur-(oa.in||0))/sa-oa.dur:Infinity);d=edClamp(d,lo,hi);
  a.dur=oa.dur+d;b.start=ob.start+d;b.dur=ob.dur-d;if(b.media||b.nest)b.in=(ob.in||0)+d*sb;void mb;return d;},
};
const edTimecode=(time,fps)=>{
 const frames=Math.floor(Math.max(0,time)*fps+1e-7),seconds=Math.floor(frames/fps);
 return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60,frames%fps].map(n=>String(n).padStart(2,'0')).join(':');
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
