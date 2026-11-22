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
/** Loudness envelope of a sound (all channels), `rate` values a second, from `from` for `dur` seconds: what multicam lines angles up with. */
function edSyncEnv(buf,from,dur,rate=100){const sr=buf.sampleRate,ch=Array.from({length:buf.numberOfChannels},(_,i)=>buf.getChannelData(i)),hop=Math.max(1,Math.round(sr/rate)),s0=Math.round(from*sr),n=Math.max(0,Math.min(Math.floor(dur*rate),Math.floor((ch[0].length-s0)/hop))),out=new Float32Array(n);
 for(let k=0;k<n;k++){let a=0;const i0=s0+k*hop;for(let i=i0;i<i0+hop;i++){let v=0;for(const c of ch)v+=c[i];a+=v*v;}out[k]=Math.sqrt(a/hop);}return out;}
/** Where sound B starts in sound A's time (seconds), from the best match of their envelopes (normalised, overlapping at least
 *  `minOv` seconds); null when nothing matches well (another place, or no sound). */
function edSyncOffset(A,B,rate=100,minOv=1){const z=x=>{const m=x.reduce((s,v)=>s+v,0)/(x.length||1);return Float32Array.from(x,v=>v-m);},a=z(A),b=z(B),mo=Math.round(minOv*rate);let best=-Infinity,lag=0;
 for(let L=-(b.length-mo);L<=a.length-mo;L++){const i0=Math.max(0,L),i1=Math.min(a.length,L+b.length);if(i1-i0<mo)continue;let s=0,ea=0,eb=0;for(let i=i0;i<i1;i++){const x=a[i],y=b[i-L];s+=x*y;ea+=x*x;eb+=y*y;}
  const r=s/Math.sqrt(ea*eb||1);if(r>best){best=r;lag=L;}}
 return best>.3?lag/rate:null;}
/** Pauses in a sound: from its envelope (`rate` a second), the parts quieter than thrDb (dBFS) for at least minLen seconds,
 *  each shrunk by pad seconds at both ends so speech keeps its breath. Seconds from the envelope's start. */
function edSilences(env,rate,thrDb,minLen,pad){const out=[],lim=Math.pow(10,thrDb/20);let a=-1;
 for(let i=0;i<=env.length;i++){const q=i<env.length&&env[i]<lim;if(q&&a<0)a=i;else if(!q&&a>=0){const s=a/rate+(a>0?pad:0),e=i/rate-(i<env.length?pad:0);if(i-a>=minLen*rate&&e-s>.05)out.push([s,e]);a=-1;}}
 return out;}
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
/** Text templates: the style of a text clip, saved to use again. These come with the editor; yours are kept in this browser. */
const ED_TSTYLE=['font','size','weight','color','box','boxColor','align','stroke','strokeColor','shadow','spacing','lineH','upper','x','y','animIn','animOut','animDur','dur'];
const ED_TTPL=[
 {name:'Lower third',text:'Name Surname',style:{size:40,weight:700,box:true,boxColor:'#000000',align:'left',shadow:false,x:-.2,y:.34,animIn:'slide',animOut:'fade',dur:4}},
 {name:'Headline',text:'Big news',style:{size:96,weight:900,stroke:6,strokeColor:'#000000',shadow:true,upper:true,animIn:'pop'}},
 {name:'Subscribe',text:'Subscribe',style:{size:48,weight:800,box:true,boxColor:'#e5252a',shadow:false,y:.3,animIn:'pop',animOut:'pop'}},
 {name:'Quote',text:'“A short quote here”',style:{size:44,weight:500,lineH:1.5,animIn:'type',dur:5}}];
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
/** Label colours for clips, markers and tracks (as in Premiere and Resolve). */
const ED_LABELS=[['red','Red','#e5484d'],['orange','Orange','#f76b15'],['yellow','Yellow','#ffc53d'],['green','Green','#30a46c'],['teal','Teal','#12a594'],['blue','Blue','#3e63dd'],['purple','Purple','#8e4ec6'],['pink','Pink','#d6409f']];
const edLabel=id=>ED_LABELS.find(l=>l[0]===id)?.[2];
const edMt=m=>typeof m==='number'?m:m.t;
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
 save(){const R=this.root();if(!R?.id)return;R.updated=new Date().toISOString();clearTimeout(this.st);this.st=setTimeout(()=>this.flush(),300);this.saved(false);},
 flush(){const R=this.root();if(!R?.id)return Promise.resolve(true);clearTimeout(this.st);this.st=null;this.relink();
  const id=R.id,s=JSON.stringify(R),H=this.stack?.[0]||this;this.pjson.set(id,s);
  const old=this.list().find(x=>x.id===id),e=this.entry(R,this.cover()??old?.thumb??null);this.plist=[e,...this.list().filter(x=>x.id!==id)];
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
  const keep=c=>c.text!==undefined||c.sticker||c.adjustment||(c.nest&&Array.isArray(c.nest.clips))||ids.has(c.media);
  const fix=cl=>(cl||[]).filter(keep).map(c=>{if(c.nest){c.nest.clips=fix(c.nest.clips);if(!Array.isArray(c.nest.tracks))c.nest.tracks=ED_TRACKS0();}return c;});
  p.clips=fix(p.clips);
  for(const c of p.clips)if(!p.tracks.some(t=>t.id===c.track)){const kind=c.text!==undefined?'text':c.sticker?'sticker':this.media.find(m=>m.id===c.media)?.type==='audio'||c.asAudio?'audio':'video';c.track=(p.tracks.find(t=>t.kind===kind)||this.addTrackTo(p,kind)).id;}
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
 /** Players of clips that are gone (deleted, nested, broken apart, undone) stop and are let go. */
 prune(){const keep=new Set(),walk=(cl,pre)=>{for(const c of cl){keep.add(pre+c.id);if(c.nest)walk(c.nest.clips,pre+c.id+'/');}};walk(this.p?.clips||[],'');
  for(const k of Object.keys(this.els))if(!keep.has(k)){this.els[k].pause?.();delete this.els[k];}},
 after(all){this._dk=null;this.pack();this.tidy();this.prune();for(const id of [...this.sels])if(!this.clip(id))this.sels.delete(id);if(this.sel&&!this.clip(this.sel))this.sel=[...this.sels].pop()||null;if(this.junction&&!this.clip(this.junction))this.junction=null;
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
  const used=edAll(this.p.clips).filter(c=>c.media===id).length;
  if(!await ask('Remove this file?',used?`It is also taken off the timeline (${used} clip${used>1?'s':''}).`:'It leaves this editor. The file on your computer stays.','Remove',true,{file:{name:m.name}}))return;
  const drop=cl=>cl.filter(c=>c.media!==id).map(c=>{if(c.nest)c.nest.clips=drop(c.nest.clips);return c;});
  if(used){this.snapshot();this.p.clips=drop(this.p.clips);}
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
 tplStyle(c){const s={};for(const k of ED_TSTYLE)if(c[k]!==undefined)s[k]=c[k];return s;},
 addTemplate(tp){this.snapshot();const c=Object.assign(this.textClip(0),{text:tp.text},JSON.parse(JSON.stringify(tp.style||{})));
  c.track=this.place('text',c.start,c.dur,this.p.tracks.find(t=>t.kind==='text')?.id);this.p.clips.push(c);this.pick(c.id);this.after(true);return c;},
 async saveTemplate(c,name){const tp={id:this.uid(),name,text:c.text||'',style:this.tplStyle(c)};this.tpls=[tp,...(this.tpls||[])].slice(0,60);
  try{await this.write([['meta','textTemplates',this.tpls]]);}catch{}toast(`Template saved: ${name} (Text, Templates)`);return tp;},
 async dropTemplate(id){this.tpls=(this.tpls||[]).filter(t=>t.id!==id);try{await this.write([['meta','textTemplates',this.tpls]]);}catch{}},
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
 splitClip(c,t){const first=t-c.start,b={...c,id:this.uid(),start:t,in:this.srcAt(c,t),dur:c.dur-first};delete b.trans;if(c.nest)b.nest=this.renest(c.nest);
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
   if(side==='start'){const d=t-c.start;if(c.media||c.nest)c.in=this.srcAt(c,t);if(c.ramp)c.ramp=edRampSplit(c.ramp,d/c.dur)[1];c.dur-=d;delete c.trans;
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
 /** Split every track at the playhead (the razor across all tracks); locked tracks are left alone. */
 /** Swap the selected clip with its neighbour on the track (Ctrl+Alt+← / →): they trade places, the gap between them stays. */
 swap(dir){const c=this.sel&&this.clip(this.sel);if(!c||this.trackOf(c)?.locked)return false;
  const cl=this.p.clips.filter(x=>x.track===c.track).sort((a,b)=>a.start-b.start),o=cl[cl.indexOf(c)+dir];
  if(!o){toast(dir<0?'Nothing before this clip to swap with.':'Nothing after this clip to swap with.');return true;}
  this.snapshot();const [a,b]=dir<0?[o,c]:[c,o],gap=b.start-(a.start+a.dur),s=a.start;b.start=s;a.start=Math.round((s+b.dur+gap)*1000)/1000;
  this.after(true);toast('Swapped');return true;},
 /** Fit to fill: change the clip's speed so it ends where the next clip on its track starts (the gap fills). */
 fitFill(c){if(!c?.media||this.mediaOf(c)?.type==='image')return toast('Fit to fill works on video and audio clips.');if(c.ramp)return toast('This clip has a speed curve; remove it first.');
  const nx=this.p.clips.filter(o=>o.track===c.track&&o.start>=c.start+c.dur-.001).sort((a,b)=>a.start-b.start)[0];
  if(!nx||nx.start-(c.start+c.dur)<1/60)return toast('There is no gap after this clip to fill.');
  const target=nx.start-c.start,sp=Math.round(c.dur*(c.speed||1)/target*1000)/1000;if(sp<.1)return toast('The gap is too long: that would be slower than 0.1×.');
  this.snapshot();c.speed=sp;c.dur=target;this.after(true);toast(`Fit to fill: ${sp}×`);},
 /** Dynamic zoom: a slow push in (or pull out) across the clip, as two scale keyframes. */
 dynZoom(c,dir){if(!c||this.kindOf(c)==='audio')return;this.snapshot();const s=this.val(c,'scale',c.start),a={t:0,v:s},b={t:c.dur,v:Math.round(s*1.2*100)/100};
  c.kf={...(c.kf||{}),scale:dir<0?[{t:0,v:b.v},{t:c.dur,v:s}]:[a,b]};this.after(true);toast(dir<0?'Dynamic zoom: out':'Dynamic zoom: in');},
 /** Remove pauses from the selected clips with sound: cut out what is quieter than thrDb for at least minLen seconds
  *  (keeping pad seconds around speech) and close the gaps on their tracks. */
 async removeSilences(o={}){const thr=o.thr??-38,minLen=o.min??.6,pad=o.pad??.12;
  const list=this.picked().filter(c=>c.media&&this.mediaOf(c)?.type!=='image'&&!c.ramp&&!this.trackOf(c)?.locked);if(!list.length)return toast('Select a clip with speech or sound first.'),0;
  const plan=[];for(const c of list){const m=this.mediaOf(c),blob=await this.get(m.id).catch(()=>null);let buf=null;try{buf=blob?await edDecode(blob):null;}catch{buf=null;}if(!buf){toast(`No sound found in ${m.name}.`,true);continue;}
   const sp=c.speed||1,env=edSyncEnv(buf,c.in||0,c.dur*sp,100);plan.push([c,edSilences(env,100,thr,minLen,pad).map(([a,b])=>[c.start+a/sp,c.start+b/sp])]);}
  if(!plan.length||!plan.every(([c])=>this.p.clips.includes(c)))return 0;
  const n=plan.reduce((s,[,g])=>s+g.length,0),secs=plan.reduce((s,[,g])=>s+g.reduce((x,[a,b])=>x+b-a,0),0);if(!n){toast('No pauses found at this level. Try a higher (less strict) level.');return 0;}
  this.snapshot();
  for(const [c,gaps] of plan){for(const [a,b] of [...gaps].reverse()){if(b-a<.04||a<=c.start+.01&&b>=c.start+c.dur-.01)continue;
   const end=c.start+c.dur,tr=c.track;
   if(b<end-.01)this.splitClip(c,b);const mid=a>c.start+.01?this.splitClip(c,a):c;
   // the pause goes (at the very start of the clip, that is what is left of the clip itself), and what follows closes up
   this.p.clips=this.p.clips.filter(x=>x!==mid);this.shiftTrack(tr,b,-(b-a));}}
  this.after(true);toast(`Removed ${n} pause${n===1?'':'s'} (${secs.toFixed(1)} s)`);return n;},
 splitAll(){const t=this.time,list=this.p.clips.filter(x=>t>x.start+.05&&t<x.start+x.dur-.05&&!this.trackOf(x)?.locked);
  if(!list.length)return toast('Nothing under the playhead to split.');this.snapshot();const parts=list.map(c=>this.splitClip(c,t));this.regroup(parts);this.pick(null);this.after(true);toast(`Split ${list.length} clip${list.length>1?'s':''} on every track`);},
 /** Move the selected clips by whole frames (Alt + arrows); stops at the start and at other clips. */
 nudge(frames){const list=this.picked().filter(c=>!this.trackOf(c)?.locked);if(!list.length)return false;const d=frames/30,ids=new Set(list.map(c=>c.id));
  if(list.some(c=>c.start+d<-1e-6||!this.fits(c.track,c.start+d,c.dur,ids))){toast('No room to move there.');return true;}
  this.snapshot();for(const c of list)c.start=Math.round((c.start+d)*1000)/1000;this.after(true);return true;},
 /** Select every clip from the playhead forward (or back), on all tracks: to move the rest of the edit at once. */
 selectFrom(dir){const t=this.time;this.junction=null;
  this.sels=new Set(this.p.clips.filter(c=>!this.trackOf(c)?.locked&&(dir>0?c.start+c.dur>t+.001:c.start<t-.001)).map(c=>c.id));this.sel=[...this.sels].pop()||null;
  this.drawTimeline();this.drawProps();this.draw();toast(`${this.sels.size} clip${this.sels.size===1?'':'s'} selected ${dir>0?'from the playhead on':'before the playhead'}`);},
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
  const made=[];for(const c of list){const start=c.start+c.dur,d={...JSON.parse(JSON.stringify(c)),id:this.uid(),start};if(d.nest)d.nest=this.renest(d.nest);d.track=this.place(this.kindOf(c),start,c.dur,c.track);this.p.clips.push(d);made.push(d);this.sels.add(d.id);this.sel=d.id;}this.regroup(made);this.after(true);},
 copy(cut){const list=this.picked();if(!list.length)return;this.clipboard=JSON.parse(JSON.stringify(list.map(c=>({...c,kind:this.kindOf(c)}))));toast(cut?`Cut ${list.length}`:`Copied ${list.length}`);if(cut)this.remove();},
 // ---------- transitions: on the clip that comes after the cut ----------
 prevOf(c){return this.p.clips.find(o=>o.track===c.track&&o.id!==c.id&&Math.abs(o.start+o.dur-c.start)<.05);},
 setTrans(c,type,dur){if(!c)return;this.snapshot();if(type==='none')delete c.trans;else c.trans={type,dur:dur??c.trans?.dur??.6};this.after(true);},
 transAll(type,dur,kind='video'){this.snapshot();for(const c of this.p.clips.filter(c=>this.kindOf(c)===kind))if(this.prevOf(c)){if(type==='none')delete c.trans;else c.trans={type,dur};}this.after(true);},
 // ---------- keyframes: per property, at times from the clip's start ----------
 val(c,k,t=this.time){const d={scale:1,opacity:1,volume:1}[k]??0,f=c.kf?.[k];if(!f?.length)return c[k]??d;const lt=edClamp(t-c.start,0,c.dur);
  if(lt<=f[0].t)return f[0].v;const last=f[f.length-1];if(lt>=last.t)return last.v;const i=f.findIndex(x=>x.t>lt),a=f[i-1],b=f[i];return a.v+(b.v-a.v)*edEaseOf(a.e)((lt-a.t)/(b.t-a.t||1));},
 /** The easing of the keyframes at the playhead (all properties of the clip), or null. */
 kfEaseAt(c){let e=null;for(const f of Object.values(c.kf||{})){const x=f.find(x=>Math.abs(x.t-(this.time-c.start))<1/60);if(x){e=x.e||'smooth';break;}}return e;},
 setKfEase(c,e){this.snapshot();for(const f of Object.values(c.kf||{}))for(const x of f)if(Math.abs(x.t-(this.time-c.start))<1/60){if(e==='smooth')delete x.e;else x.e=e;}this.after(true);},
 /** The curve editor: a custom easing on the keyframes at the playhead (no undo step: the drag made one). */
 setKfCurve(c,bz){for(const f of Object.values(c.kf||{}))for(const x of f)if(Math.abs(x.t-(this.time-c.start))<1/60)x.e=[...bz];},
 kfAt(c,k){const lt=this.time-c.start;return (c.kf?.[k]||[]).findIndex(x=>Math.abs(x.t-lt)<1/60);},
 toggleKf(c,k){const lt=edClamp(this.time-c.start,0,c.dur);this.snapshot();c.kf=c.kf||{};const f=c.kf[k]=c.kf[k]||[];const i=this.kfAt(c,k);
  if(i>=0)f.splice(i,1);else{f.push({t:lt,v:this.val(c,k)});f.sort((a,b)=>a.t-b.t);}if(!f.length)delete c.kf[k];this.after(true);},
 /** Setting a value: with keyframes, it goes into the keyframe at the playhead (made if there is none). */
 setVal(c,k,v){const f=c.kf?.[k];if(f?.length){const lt=edClamp(this.time-c.start,0,c.dur),i=this.kfAt(c,k);if(i>=0)f[i].v=v;else{f.push({t:lt,v});f.sort((a,b)=>a.t-b.t);}}else c[k]=v;},
 // ---------- playback ----------
 element(c){
  const key=(this._nk||'')+c.id;let el=this.els[key];const m=this.mediaOf(c);
  if(!el&&m&&m.type!=='image'){
   el=document.createElement(c.asAudio?'audio':m.type);el.src=m.type==='video'&&!c.asAudio?this.proxySrc(m):this.urls[m.id];el.preload='auto';el.playsInline=true;el.crossOrigin='anonymous';
   el.addEventListener('seeked',()=>{if(!this.playing)this.draw();});el.addEventListener('loadeddata',()=>{if(!this.playing)this.draw();});
   this.els[key]=el;if(this.ac)this.route(el);
  }
  return el;
 },
 image(m){let im=this.imgs[m.id];if(!im){im=new Image();im.onload=()=>{if(!this.playing)this.draw();};im.src=this.urls[m.id];this.imgs[m.id]=im;}return im;},
 // Sound: every element -> its own gain (so a clip can go above 100%) -> master -> speakers, the recorder and the meter.
 audio(){if(this.ac)return;try{const ac=this.ac=new AudioContext();this.rec=ac.createMediaStreamDestination();this.master=ac.createGain();this.master.connect(ac.destination);this.master.connect(this.rec);
  const sp=ac.createChannelSplitter(2);this.master.connect(sp);this.meters=[0,1].map(i=>{const a=ac.createAnalyser();a.fftSize=1024;sp.connect(a,i);return a;});
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
 vol(c,t){const tr=this.trackOf(c);if(tr?.muted||(c.detached&&!c.asAudio))return 0;if(this._mcA&&tr&&tr.id!==this._mcA)return 0;
  if(this.p.tracks.some(x=>x.solo)&&!tr?.solo)return 0;
  return edClamp(this.val(c,'volume',t)*this.fade(c,t)*edDb(c.gainDb||0)*(tr?.vol??1)*(c.duck?this.duckAt(t,c):1)*(this._vm??1),0,8);},
 // ---------- drawing the frame ----------
 base(){return ED_RATIOS[this.p.ratio];},
 size(){const b=this.base(),k=this.exporting?.scale||1;return [Math.round(b[0]*k/2)*2,Math.round(b[1]*k/2)*2];},
 k(){return this.size()[0]/this.base()[0];},
 src(c){if(c.adjustment||c.nest){const [W,H]=this.size();return {sx:0,sy:0,sw:W,sh:H};}const m=this.mediaOf(c),w=m?.w||1,h=m?.h||1,cr=c.crop||{},l=cr.l||0,t=cr.t||0,r=cr.r||0,b=cr.b||0;return {sx:l*w,sy:t*h,sw:Math.max(1,w*(1-l-r)),sh:Math.max(1,h*(1-t-b))};},
 rect(c,W,H,t=this.time){
  if(c.sticker&&!c.nest){const s=220*this.k()*this.val(c,'scale',t),line=c.sticker.type==='shape'&&c.sticker.shape==='line';return {w:line?s*1.4:s,h:line?s*.2:s,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H};}
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
 layered(c){return !!(c.fx&&(c.fx.glow||c.fx.sharpen||c.fx.grain))||(c.blend&&c.blend!=='normal')||c.key?.on||(c.mask&&c.mask.shape&&c.mask.shape!=='none')||edGraded(c.grade);},
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
  if(c.fx&&(c.fx.glow||c.fx.sharpen||c.fx.grain))edLayerFx(L,lg,c.fx,t,this.k());
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
  // an adjustment layer's picture is everything drawn under it so far
  if(c.adjustment&&!o.flat){const S=this._adjSnap||(this._adjSnap=document.createElement('canvas'));if(S.width!==W||S.height!==H){S.width=W;S.height=H;}const sg=S.getContext('2d');sg.clearRect(0,0,W,H);sg.drawImage(g.canvas,0,0);this._adjFrame=S;}
  const m=this.mediaOf(c);if(!m&&!c.adjustment&&!c.nest)return;const src=c.nest?this.nestFrame(c,t):c.adjustment?this._adjFrame:m.type==='image'?this.image(m):this.element(c);
  if(!src||(m&&m.type==='video'&&src.readyState<2)||(m&&m.type==='image'&&!src.complete))return;
  const r=this.rect(c,W,H,t),s=this.src(c),a=this.val(c,'opacity',t)*this.fade(c,t)*(o.alpha??1);if(a<=0)return;
  const fx=c.fx||{},sh=edShake(fx,t,W),rad=(fx.radius||0)/100*Math.min(r.w,r.h)/2,kk=this.k();
  g.save();if(o.clipX!=null){g.beginPath();g.rect(0,0,o.clipX,H);g.clip();}
  g.globalAlpha=edClamp(a,0,1);g.translate(r.cx+(o.dx||0)+sh[0],r.cy+(o.dy||0)+sh[1]);g.rotate(this.val(c,'rotate',t)*Math.PI/180+sh[2]);g.scale((c.flipH?-1:1)*(o.k||1),(c.flipV?-1:1)*(o.k||1));
  // shadow: under a rounded box, or (no rounding) following the picture's own outline, so a cut-out casts its shape
  if(fx.shadow&&rad){g.save();g.shadowColor=`rgba(0,0,0,${.25+fx.shadow/200})`;g.shadowBlur=fx.shadow/100*40*kk;g.shadowOffsetY=fx.shadow/100*14*kk;g.fillStyle='#000';g.beginPath();g.roundRect(-r.w/2,-r.h/2,r.w,r.h,rad);g.fill();g.restore();}
  if(rad){g.beginPath();g.roundRect(-r.w/2,-r.h/2,r.w,r.h,rad);g.clip();}
  if(fx.shadow&&!rad){g.shadowColor=`rgba(0,0,0,${.25+fx.shadow/200})`;g.shadowBlur=fx.shadow/100*40*kk;g.shadowOffsetY=fx.shadow/100*14*kk;}
  const kq=m&&m.type==='video'&&src.videoWidth&&m.w?src.videoWidth/m.w:1;// a proxy is smaller than the original: the same part of it
  g.filter=this.filterOf(c,o.blur);g.drawImage(src,s.sx*kq,s.sy*kq,s.sw*kq,s.sh*kq,-r.w/2,-r.h/2,r.w,r.h);g.filter='none';g.shadowColor='transparent';
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
  else if(type==='zoom'){d(A,{k:1+p*.5,alpha:1-p});d(B,{k:.85+.15*p,alpha:p});}
  else if(type==='wipe'){d(A,{});d(B,{clipX:edEase(p)*W});}
  else if(type==='blur'){d(A,{blur:p*30});d(B,{blur:(1-p)*30,alpha:edEase(p)});}
  else{d(A,{});d(B,{alpha:p});}
 },
 draw(){if(this.scopesOn&&!this.exporting)requestAnimationFrame(()=>this.drawScopes?.());
  const cv=this.dom.canvas;if(!cv||!this.p)return;const [W,H]=this.size();if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  const g=cv.getContext('2d'),t=this.time;g.save();g.fillStyle=this.p.bg||'#000';g.fillRect(0,0,W,H);
  // A blurred, enlarged copy of the main picture fills the frame behind it (for a horizontal clip in a vertical video).
  if(this.p.bgMode==='blur'){const mc=this.p.clips.find(c=>c.track===this.main()?.id&&t>=c.start&&t<c.start+c.dur);const m=mc&&this.mediaOf(mc);
   const src=m&&(m.type==='image'?this.image(m):this.element(mc));if(src&&(m.type!=='video'||src.readyState>=2)){const s=this.src(mc),f=Math.max(W/s.sw,H/s.sh)*1.1;g.save();g.filter=`blur(${40*this.k()}px) brightness(.7)`;g.drawImage(src,s.sx,s.sy,s.sw,s.sh,(W-s.sw*f)/2,(H-s.sh*f)/2,s.sw*f,s.sh*f);g.restore();}}
  this.paint(g,t);
  if(!this.exporting&&this.sel&&this.clip(this.sel)?.nest?.multi)this.drawAngles();
  if(!this.exporting)for(const s of this.picked()){if(!(t>=s.start&&t<s.start+s.dur)||this.kindOf(s)==='audio')continue;const b=this.box(g,s,W,H,t);
   g.save();g.translate(b.cx,b.cy);g.rotate(this.val(s,'rotate',t)*Math.PI/180);g.strokeStyle='rgba(80,150,255,.95)';g.lineWidth=Math.max(2,W/400);g.setLineDash([W/80,W/120]);g.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
   // one selected: corners to resize, the knob above to rotate
   if(this.picked().length===1&&!this.trackOf(s)?.locked&&!s.adjustment){const hs=edHandleSize(W),kn=edKnob(W);g.setLineDash([]);g.fillStyle='#fff';g.beginPath();g.moveTo(0,-b.h/2);g.lineTo(0,-b.h/2-kn);g.stroke();
    for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){g.fillRect(x*b.w/2-hs/2,y*b.h/2-hs/2,hs,hs);g.strokeRect(x*b.w/2-hs/2,y*b.h/2-hs/2,hs,hs);}
    g.beginPath();g.arc(0,-b.h/2-kn,hs*.6,0,Math.PI*2);g.fill();g.stroke();}
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
 // ---------- nested clips (compound clips): clips inside one clip, with their own tracks ----------
 /** Run fn with the nested clip's tracks and clips standing in for the timeline's (synchronously only). */
 withNest(c,fn){const P=this.p,K=this._nk,A=this._mcA;this.p={...P,tracks:c.nest.tracks,clips:c.nest.clips,markers:[],range:null};this._nk=(K||'')+c.id+'/';this._mcA=c.nest.multi?c.nest.audio:undefined;
  try{return fn();}finally{this.p=P;this._nk=K;this._mcA=A;}},
 // ---------- multicam: angles of the same moment, lined up by their sound; one shows at a time ----------
 /** The angle (index among the video tracks) a multicam clip shows at its own time lt. */
 angleAt(c,lt){let a=0;for(const x of c.nest?.cuts||[])if(x.t<=lt+1e-6)a=x.a;return a;},
 /** Make a multicam clip from the selected clips: their sound lines them up; each becomes an angle (sound-only clips can be the sound). */
 async multicam(){const list=this.picked().filter(c=>c.media&&this.mediaOf(c)?.type!=='image'&&!this.trackOf(c)?.locked);
  if(list.length<2)return toast('Select two or more clips of the same moment, each with its sound, to make a multicam clip.');
  if(list.some(c=>c.ramp||(c.speed&&c.speed!==1)))return toast('Multicam needs clips at normal speed.');
  if(!list.some(c=>this.mediaOf(c).type==='video'&&!c.asAudio))return toast('Multicam needs at least one video.');
  toast('Lining up the angles by their sound…');const env=[];
  for(const c of list){const m=this.mediaOf(c),blob=await this.get(m.id).catch(()=>null);let buf=null;try{buf=blob?await edDecode(blob):null;}catch{buf=null;}env.push(buf?edSyncEnv(buf,c.in||0,Math.min(c.dur,90)):null);}
  const off=[0],miss=[];for(let i=1;i<list.length;i++){const o=env[0]?.length&&env[i]?.length?edSyncOffset(env[0],env[i]):null;if(o==null)miss.push(this.mediaOf(list[i]).name);off.push(o??(list[i].start-list[0].start));}
  if(!list.every(c=>this.p.clips.includes(c)))return;// the timeline changed while listening
  const min=Math.min(...off),ids=new Set(list.map(c=>c.id));this.snapshot();
  const tracks=list.map((c,i)=>({id:'mc'+i,kind:this.mediaOf(c).type==='video'&&!c.asAudio?'video':'audio',name:this.mediaOf(c).name.replace(/\.[^.]+$/,'').slice(0,30)}));
  const clips=list.map((c,i)=>{const x={...JSON.parse(JSON.stringify(c)),id:this.uid(),track:'mc'+i,start:Math.round((off[i]-min)*1000)/1000};delete x.group;delete x.trans;delete x.detached;return x;});
  const dur=Math.round(Math.max(...clips.map(x=>x.start+x.dur))*1000)/1000,audio=(tracks.find(t=>t.kind==='audio')||tracks[0]).id,start=Math.max(0,list[0].start+min);
  const n=this.p.clips.filter(c=>c.nest?.multi).length+1,vt=this.trackOf(list.find(c=>tracks[list.indexOf(c)].kind==='video'));
  this.p.clips=this.p.clips.filter(c=>!ids.has(c.id));
  const c={id:this.uid(),nest:{name:`Multicam ${n}`,multi:true,tracks,clips,dur,audio,cuts:[{t:0,a:0}]},start,dur,in:0,scale:1,x:0,y:0,rotate:0,opacity:1};
  c.track=vt&&vt.kind==='video'&&this.fits(vt.id,start,dur)?vt.id:this.place('video',start,dur,vt?.id);this.p.clips.push(c);this.pick(c.id);this.after(true);
  toast(miss.length?`Multicam made, but ${miss.join(', ')} could not be matched by sound: it stays where it was.`:`Multicam: ${tracks.filter(t=>t.kind==='video').length} angles lined up. Press 1–9 to switch (also while playing).`,!!miss.length);return c;},
 /** Switch a multicam clip (the selected one, or the one under the playhead) to angle n from the playhead on; while playing, a live cut. */
 switchAngle(n){const t=this.time,sel=this.sel&&this.clip(this.sel),c=sel?.nest?.multi&&t>=sel.start&&t<sel.start+sel.dur?sel:this.p.clips.find(x=>x.nest?.multi&&t>=x.start&&t<x.start+x.dur);if(!c)return false;
  const vt=c.nest.tracks.filter(x=>x.kind==='video');if(n<0||n>=vt.length)return true;const lt=Math.round((t-c.start+(c.in||0))*1000)/1000;
  if(!this.playing||!this._mcSnap){this.snapshot();this._mcSnap=this.playing;}
  let cu=(c.nest.cuts||[]).filter(x=>Math.abs(x.t-lt)>1/60);cu.push({t:lt,a:n});cu.sort((a,b)=>a.t-b.t);if(cu[0].t>0)cu.unshift({t:0,a:0});cu=cu.filter((x,i)=>i===0||x.a!==cu[i-1].a);c.nest.cuts=cu;
  this.save();this.drawTimeline();if(!this.playing){this.draw();this.drawProps();}return true;},
 /** The nested clip's picture at timeline time t: its own tracks painted on a clear frame (its layers kept apart from ours). */
 nestFrame(c,t){const [W,H]=this.size(),all=this._nests||(this._nests=new Map()),key=(this._nk||'')+c.id;let n=all.get(key);if(!n)all.set(key,n={cv:document.createElement('canvas')});
  if(n.cv.width!==W||n.cv.height!==H){n.cv.width=W;n.cv.height=H;}const g=n.cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.filter='none';g.clearRect(0,0,W,H);
  if((this._depth||0)>4)return n.cv;
  const keep=[this._layer,this._adjSnap,this._adjFrame];this._layer=n.layer;this._adjSnap=n.adj;this._depth=(this._depth||0)+1;
  try{this.withNest(c,()=>{const lt=t-c.start+(c.in||0);if(!c.nest.multi)return this.paint(g,lt);const T=this.p.tracks,v=T.filter(x=>x.kind==='video'),a=v[this.angleAt(c,lt)];this.p.tracks=a?[a]:[];try{this.paint(g,lt);}finally{this.p.tracks=T;}});}finally{n.layer=this._layer;n.adj=this._adjSnap;[this._layer,this._adjSnap,this._adjFrame]=keep;this._depth--;}
  return n.cv;},
 /** The whole project: the timeline, also while editing inside a nested clip (then this.p is the nested clip's own). */
 root(){return this.stack?.[0]?.P||this.p;},
 /** Edits inside a nested clip go back into it (its tracks and clips, and how long its contents are), level by level. */
 relink(){const S=this.stack||[];for(let i=S.length-1;i>=0;i--){const child=i===S.length-1?this.p:S[i+1].P,c=S[i].P.clips.find(x=>x.id===S[i].cid);if(!c?.nest)continue;
  c.nest.tracks=child.tracks;c.nest.clips=child.clips;c.nest.dur=Math.round(Math.max(.1,...child.clips.map(x=>x.start+x.dur))*1000)/1000;}},
 /** Open a nested clip: the timeline shows what is inside it, to edit in place (Back or Esc to return). */
 enterNest(c){if(!c?.nest||this.exporting)return;if(this.playing)this.pause();this.relink();const P=this.p;this.stack=this.stack||[];
  this.stack.push({P,cid:c.id,past:this.past,future:this.future,pre:JSON.stringify(P),time:this.time,name:c.nest.name||'Nested'});
  this.p={...P,tracks:c.nest.tracks,clips:c.nest.clips,markers:[],range:null};this.past=[];this.future=[];
  this.time=Math.max(0,this.time-c.start+(c.in||0));this.sels.clear();this.sel=null;this.junction=null;this.after(true);this.fit?.();this.drawCrumb();
  toast(`Inside “${c.nest.name||'Nested'}”: edit as usual, then Back (or Esc)`);},
 /** Back out of a nested clip; everything done inside is one undo step outside. */
 exitNest(){const e=this.stack?.at(-1);if(!e)return;if(this.playing)this.pause();this.relink();this.stack.pop();const c=e.P.clips.find(x=>x.id===e.cid),lt=this.time;
  this.p=e.P;this.past=e.past;this.future=e.future;if(JSON.stringify(this.p)!==e.pre){this.past.push(e.pre);this.future=[];}
  this.time=c?edClamp(c.start+lt-(c.in||0),c.start,c.start+c.dur):e.time;this.sels.clear();this.sel=null;if(c)this.pick(c.id);this.after(true);this.fit?.();this.drawCrumb();},
 drawCrumb(){const el=this.dom.root?.querySelector('[data-crumb]');if(!el)return;const S=this.stack||[];el.hidden=!S.length;
  el.innerHTML=S.length?`${I.layers}<span>${S.map(x=>esc(x.name)).join(' › ')}</span><button type="button" class="ed-link" data-crumb-back>Back</button>`:'';
  const b=el.querySelector('[data-crumb-back]');if(b)b.onclick=()=>this.exitNest();},
 /** A deep copy of a nested clip's contents with new clip ids (for a split, a copy or a paste). */
 renest(n){const x=JSON.parse(JSON.stringify(n));const re=cl=>{for(const c of cl){c.id=this.uid();if(c.nest)re(c.nest.clips);}};re(x.clips);return x;},
 /** Nest: the selected clips become one clip (on the top video track they used); their tracks come along inside it. */
 nest(){const list=this.picked().filter(c=>!this.trackOf(c)?.locked);if(!list.length)return toast('Select the clips to nest.');
  const s=Math.min(...list.map(c=>c.start)),e=Math.max(...list.map(c=>c.start+c.dur)),ids=new Set(list.map(c=>c.id));
  const used=new Set(list.map(c=>c.track)),tracks=this.p.tracks.filter(t=>used.has(t.id)).map(t=>({...JSON.parse(JSON.stringify(t)),main:undefined,locked:undefined,hidden:undefined,muted:undefined,solo:undefined}));
  const vt=this.p.tracks.find(t=>used.has(t.id)&&t.kind==='video');this.snapshot();
  const inner=list.map(c=>({...JSON.parse(JSON.stringify(c)),start:Math.round((c.start-s)*1000)/1000}));for(const c of inner)delete c.group;
  this.p.clips=this.p.clips.filter(c=>!ids.has(c.id));
  const n=this.p.clips.filter(c=>c.nest).length+1,c={id:this.uid(),nest:{name:`Nested ${n}`,tracks,clips:inner,dur:Math.round((e-s)*1000)/1000},start:s,dur:Math.round((e-s)*1000)/1000,in:0,scale:1,x:0,y:0,rotate:0,opacity:1};
  c.track=vt&&this.fits(vt.id,s,c.dur)?vt.id:this.place('video',s,c.dur,vt?.id);this.p.clips.push(c);this.pick(c.id);this.after(true);toast(`Nested ${list.length} clip${list.length>1?'s':''}: right-click it to break it apart`);return c;},
 /** Break apart: the clips inside come back to the timeline where they play now (the nested clip's own look is not kept). */
 unnest(c){if(!c?.nest)return;this.snapshot();const off=c.start-(c.in||0),A=c.start,B=c.start+c.dur,back=[],T=c.nest.tracks,jobs=[];
  // a copy of an inner clip for the part [a, b] of the timeline, or null
  const cut=(x0,a,b)=>{const x=JSON.parse(JSON.stringify(x0));let st=x.start+off,en=st+x.dur;if(en<=a+1e-3||st>=b-1e-3)return null;
   if(st<a){const d=a-st;if(x.media||x.nest)x.in=(x.in||0)+d*(x.speed||1);if(x.kf)for(const k in x.kf)x.kf[k]=x.kf[k].map(f=>({...f,t:f.t-d})).filter(f=>f.t>=-1e-6);st=a;}
   if(en>b)en=b;x.start=Math.round(st*1000)/1000;x.dur=Math.round((en-st)*1000)/1000;x.id=this.uid();delete x.trans;return x;};
  if(c.nest.multi){const vt=T.filter(t=>t.kind==='video'),cu=c.nest.cuts?.length?c.nest.cuts:[{t:0,a:0}];
   cu.forEach((k,i)=>{const a=Math.max(A,off+k.t),b=Math.min(B,i+1<cu.length?off+cu[i+1].t:B),tr=vt[k.a];if(b-a<1e-3||!tr)return;
    for(const x of c.nest.clips.filter(x=>x.track===tr.id)){const y=cut(x,a,b);if(y){y.detached=true;delete y.asAudio;jobs.push([y,'video',c.track]);}}});
   for(const x of c.nest.clips.filter(x=>x.track===c.nest.audio)){const y=cut(x,A,B);if(y){delete y.detached;if(this.mediaOf(y)?.type==='video')y.asAudio=true;jobs.push([y,'audio']);}}}
  else for(const x of c.nest.clips){const y=cut(x,A,B);if(y)jobs.push([y,T.find(t=>t.id===x.track)?.kind||this.kindOf(x),x.track]);}
  this.p.clips=this.p.clips.filter(o=>o.id!==c.id);
  for(const [y,kind,pref] of jobs){const same=this.p.tracks.find(t=>t.id===pref&&t.kind===kind);y.track=same&&this.fits(same.id,y.start,y.dur)?same.id:this.place(kind,y.start,y.dur,kind==='video'?c.track:undefined);this.p.clips.push(y);back.push(y.id);}
  this.sels=new Set(back);this.sel=back.at(-1)||null;this.after(true);toast(c.nest.multi?`Multicam flattened: ${back.length} clips`:`Broke apart: ${back.length} clip${back.length===1?'':'s'}`);},
 /** How far a clip's in or out animation is (0 to 1, 1 = fully shown). */
 anim(c,t){const d=Math.max(.1,c.animDur||.5),lt=t-c.start,rt=c.start+c.dur-t;return {i:c.animIn&&c.animIn!=='none'?edClamp(lt/d,0,1):1,o:c.animOut&&c.animOut!=='none'?edClamp(rt/d,0,1):1};},
 animApply(c,t){const {i,o}=this.anim(c,t),r={alpha:1,k:1,dy:0,chars:1,blur:0,words:1};
  const one=(type,p)=>{if(p>=1)return;const e=edEase(p);if(type==='fade')r.alpha*=e;else if(type==='pop'){const b=1-Math.pow(1-p,3);r.k*=.5+.5*b+Math.sin(p*Math.PI)*.12;r.alpha*=Math.min(1,p*3);}else if(type==='slide'){r.dy+=(1-e)*.08;r.alpha*=e;}else if(type==='type')r.chars=Math.min(r.chars,p);
   else if(type==='zoom'){r.k*=1+(1-e)*.6;r.alpha*=e;}else if(type==='blur'){r.blur=Math.max(r.blur||0,(1-e)*24);r.alpha*=e;}else if(type==='words')r.words=p;};
  one(c.animIn,i);one(c.animOut,o);return r;},
 lines(g,c,W){const tx=String(c.text||'');if(edNoSpace(tx))return edPack(g,edWords(tx,c.lang),'',W*.86).map(l=>l.join(''));const words=tx.split(/\s+/);const out=[];let line='';for(const w of words){const next=line?line+' '+w:w;if(g.measureText(next).width>W*.86&&line){out.push(line);line=w;}else line=next;}if(line)out.push(line);return out.length?out:[''];},
 font(c,t){return `${c.weight||600} ${Math.round((c.size||40)*this.val(c,'scale',t)*this.k())}px "${c.font||'Tempoloom UI'}", "Tempoloom UI", system-ui, sans-serif`;},
 textBox(g,c,W,H,t=this.time){if(c.words?.length)return this.capBox(g,c,W,H,t);g.save();g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;const ls=this.lines(g,c,W),lh=(c.size||40)*this.val(c,'scale',t)*this.k()*(c.lineH||1.25),w=Math.max(...ls.map(l=>g.measureText(l).width))+lh*.6,h=ls.length*lh+lh*.3;g.restore();
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
 toggleMarker(){const t=Math.round(this.time*30)/30,ms=this.p.markers,i=ms.findIndex(x=>Math.abs(edMt(x)-t)<.05);this.snapshot();if(i>=0)ms.splice(i,1);else{ms.push({t});ms.sort((a,b)=>edMt(a)-edMt(b));}this.after(false);},
 setMarker(i,patch){const m=this.p.markers[i];if(!m)return;this.snapshot();if(patch===null)this.p.markers.splice(i,1);else this.p.markers[i]={...(typeof m==='number'?{t:m}:m),...patch};this.after(true);},
 // ---------- tracks: name, colour, height, and the mixer (volume, pan, solo) ----------
 setTrackProp(id,patch){const t=this.p.tracks.find(x=>x.id===id);if(!t)return;Object.assign(t,patch);for(const [k,v] of Object.entries(patch))if(v===undefined||v===null||v==='')delete t[k];this.save();},
 /** Rolls a cut: the end of one clip and the start of the next move together (as Premiere's rolling edit). */
 roll(a,b,d,oa,ob){const sa=oa.speed||1,sb=ob.speed||1,ma=this.mediaOf(a),mb=this.mediaOf(b);
  let lo=Math.max(-(oa.dur-.1),-(ob.media?(ob.in||0)/sb:Infinity)),hi=Math.min(ob.dur-.1,ma&&ma.type!=='image'?(ma.dur-(oa.in||0))/sa-oa.dur:Infinity);d=edClamp(d,lo,hi);
  a.dur=oa.dur+d;b.start=ob.start+d;b.dur=ob.dur-d;if(b.media||b.nest)b.in=(ob.in||0)+d*sb;void mb;return d;},
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