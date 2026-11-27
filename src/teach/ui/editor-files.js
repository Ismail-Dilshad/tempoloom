'use strict';
// Editor, project files: one .zip with project.json, its media and looks, to keep or open elsewhere (stored zip, CRC-32).
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 // ---------- project files: one .zip with project.json and the media it uses, to keep or open elsewhere ----------
 async packProject(id){
  if(this.p?.id===id)await this.flush();
  const p=this.readProject(id);if(!p)throw new Error('That project is gone');
  const used=new Set(edAll(p.clips).map(c=>c.media).filter(Boolean)),files=[],media=[];
  for(const m of this.media.filter(m=>used.has(m.id))){const b=await this.get(m.id);if(!b)continue;files.push(['media/'+m.id+edExt(m.name),b]);media.push({...m,mime:b.type||''});}
  const lutIds=new Set(edAll(p.clips).map(c=>c.grade?.lut?.id).filter(Boolean)),luts=[];await this.loadLuts();
  for(const id of lutIds){const t=this.lutText.get(id);if(t){files.push(['luts/'+id+'.cube',new Blob([t])]);luts.push(this.lutList.find(l=>l.id===id)||{id,name:id});}}
  const coverImage=this.list().find(entry=>entry.id===id)?.coverImage;
  files.unshift(['project.json',new Blob([JSON.stringify({app:'tempoloom-editor',v:1,project:p,media,luts,coverImage})],{type:'application/json'})]);
  return edZip(files);
 },
 /** Opens a project file as a new project and reuses matching local media. */
 async importProjectFile(file){
  const {project,coverImage}=await this.readProjectArchive(file);
  const id=this.create(project,coverImage);await this.wq;return id;
 },
 async readProjectArchive(file){
  const z=await edUnzip(file),pj=z.get('project.json');if(!pj)throw new Error('This is not an editor project file');
  let j;try{j=JSON.parse(await pj.text());}catch{throw new Error('The project file is damaged');}
  if(j?.app!=='tempoloom-editor'||!j.project||!Array.isArray(j.project.clips))throw new Error('This is not an editor project file');
  const map={};
  for(const m of Array.isArray(j.media)?j.media:[]){
   const name=[...z.keys()].find(k=>k.startsWith('media/'+m.id+'.')||k==='media/'+m.id),part=name&&z.get(name);if(!part||!m.id)continue;
   const here=this.media.find(x=>x.id===m.id),hb=here&&await this.get(here.id);
   if(hb&&hb.type===m.mime&&await edSameMedia(hb,part)){map[m.id]=here.id;continue;}
   const blob=new Blob([part],{type:m.mime||''}),id=this.uid(),{mime,...meta}=m;
   await this.put(id,blob);this.urls[id]=URL.createObjectURL(blob);this.media.unshift({...meta,id});map[m.id]=id;
  }
  await this.persist([['meta','media',this.media]]);
  for(const l of Array.isArray(j.luts)?j.luts:[]){const part=z.get('luts/'+l.id+'.cube');if(!part||!/^lut-[a-z0-9]+$/.test(l.id))continue;const text=await part.text();
   if(!(await this.read('meta','lut:'+l.id))){await this.write([['meta','lut:'+l.id,{name:l.name,text}]]);const list=(await this.read('meta','luts'))||[];list.unshift({id:l.id,name:l.name,size:edParseCube(text)?.n||0});await this.write([['meta','luts',list]]);}}
  this.luts.clear();await this.loadLuts();
  const p=j.project;for(const c of edAll(p.clips))if(c.media)c.media=map[c.media]||c.media;
  return {project:this.migrate({...p,name:String(p.name||'Imported project').slice(0,80)}),coverImage:edCoverData(j.coverImage)};
 },
 async installSharedTimeline(id,{project}){
  this.pause();this.snapshot();
  this.resetElements();
  this.p={...project,id};
  this.time=Math.min(this.time,this.end());
  this.after(true,false);this.fit();this.drawLib();
  const name=this.dom.root?.querySelector('.ed-name');
  if(name)name.value=this.p.name;
  document.title=this.p.name+' · Tempoloom';
  const snapshot=edSharedSnapshot(this.p);
  await this.flush();
  return snapshot;
 },
});

const edSharedLinkKey=id=>'editor-shared-link:'+id;
const edSharedLink=id=>store.get(edSharedLinkKey(id),null);
function edSharedSnapshot(project){
 if(!project)return '';
 const {updated,...timeline}=project;
 return JSON.stringify(timeline);
}
async function edSharedHash(snapshot){
 if(!crypto.subtle||!snapshot)return null;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(snapshot));
 return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function edRememberShared(id,result,snapshot,stillCurrent=()=>true){
 const hash=await edSharedHash(snapshot);
 if(stillCurrent())store.set(edSharedLinkKey(id),{id:result.id,revision:result.revision,hash});
}

function edWatchShared(root,localId,status){
 let timer,compiledSnapshot,compiledHash,pointer=false,stopped=false;
 const controller=new AbortController(),config={signal:controller.signal};
 const show=text=>{if(status.textContent!==text)status.textContent=text;status.hidden=!text;};
 const down=()=>{pointer=true;},up=()=>{pointer=false;};
 const stop=()=>{
  stopped=true;clearTimeout(timer);controller.abort();
  root.removeEventListener('pointerdown',down,true);
  for(const event of ['pointerup','pointercancel','blur','dragend'])window.removeEventListener(event,up,true);
  window.removeEventListener('hashchange',stop);
 };
 root.addEventListener('pointerdown',down,true);
 for(const event of ['pointerup','pointercancel','blur','dragend'])window.addEventListener(event,up,true);
 window.addEventListener('hashchange',stop,{once:true});
 const ready=()=>!stopped&&root.isConnected&&Ed.p?.id===localId&&!document.hidden&&!Ed.stack.length&&
  !Ed.playing&&!Ed.exporting&&!Ed.recording&&!Ed.st&&!pointer&&!document.querySelector('#modal .modal')&&
  !document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
 const current=link=>{
  const saved=edSharedLink(localId);
  return saved?.id===link.id&&saved.revision===link.revision&&saved.hash===link.hash;
 };
 const tick=async()=>{
  if(!root.isConnected){stop();return;}
  const link=edSharedLink(localId);
  try{
   if(!link){show('');return;}
   if(!ready())return;
   const before=edSharedSnapshot(Ed.p);
   if(before!==compiledSnapshot){compiledSnapshot=before;compiledHash=await edSharedHash(before);}
   if(!link.hash){show('Open latest copy to sync');return;}
   if(compiledHash!==link.hash){show('Sync paused · local changes');return;}
   const path='/api/editor/shared/'+link.id;
   const head=await api(path+'/head',config);
   if(!ready()||!current(link)||before!==edSharedSnapshot(Ed.p))return;
   if(head.revision<=link.revision){show('Synced · revision '+link.revision);return;}
   show('Loading shared revision '+head.revision);
   const response=await fetch(withKey(path+'/archive?revision='+head.revision),config);
   if(!response.ok)throw new Error('Could not load shared revision');
   const file=await response.blob();
   if(!ready()||!current(link)||before!==edSharedSnapshot(Ed.p))return;
   const archive=await Ed.readProjectArchive(file);
   if(!ready()||!current(link)||before!==edSharedSnapshot(Ed.p))return;
   const snapshot=await Ed.installSharedTimeline(localId,archive);
   await edRememberShared(localId,head,snapshot,()=>current(link));
   show('Synced · revision '+head.revision);
  }catch{
   if(!stopped)show('Live sync unavailable · retrying');
  }finally{
   if(!stopped)timer=setTimeout(tick,3000);
  }
 };
 timer=setTimeout(tick,1000);
}
// ---------- project file helpers: a plain .zip (stored, not compressed: the media are compressed already) ----------
const edCrcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function edCrc(u8,crc){let c=~crc;for(let i=0;i<u8.length;i++)c=edCrcT[(c^u8[i])&255]^(c>>>8);return (~c)>>>0;}
const edExt=name=>(/\.[a-z0-9]{1,5}$/i.exec(name||'')||[''])[0].toLowerCase();
async function edSameMedia(a,b){
 if(a.size!==b.size)return false;
 const size=1024*1024;
 for(let start=0;start<a.size;start+=size){
  const [left,right]=await Promise.all([a.slice(start,start+size).arrayBuffer(),b.slice(start,start+size).arrayBuffer()]);
  const bytes=new Uint8Array(right);
  if(!new Uint8Array(left).every((byte,index)=>byte===bytes[index]))return false;
 }
 return true;
}
function edCoverData(value){return typeof value==='string'&&value.length<=1000000&&(value.length-23)%4===0&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:undefined;}
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
