import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {expect,it} from 'vitest';

it('pulls a new shared revision only while the linked timeline stays clean',async()=>{
 const timers=new Map<number,()=>Promise<void>>();
 const storage=new Map<string,unknown>();
 const requests:string[]=[];
 const root=Object.assign(new EventTarget(),{isConnected:true});
 const browserEvents=new EventTarget();
 const status={hidden:true,textContent:''};
 let nextTimer=0,revision=1,editDuringArchive=false,installs=0;
 const editor={
  p:{id:'local',name:'Original',updated:'day 1'},stack:[],
  async readProjectArchive(){
   if(editDuringArchive)editor.p.name='Local edit';
   return {project:{id:'current',name:'Shared '+revision}};
  },
  async installSharedTimeline(id:string,archive:{project:{name:string}}){
   installs++;
   editor.p={id,name:archive.project.name,updated:'day 2'};
   return JSON.stringify({id,name:archive.project.name});
  },
 };
 const context=vm.createContext({
  Ed:editor,root,status,window:browserEvents,crypto:webcrypto,TextEncoder,AbortController,
  document:{hidden:false,activeElement:null,querySelector:()=>null},
  store:{get:(key:string,fallback:unknown)=>storage.get(key)??fallback,set:(key:string,value:unknown)=>storage.set(key,value)},
  async api(path:string){requests.push(path);return {id:'shared',revision};},
  async fetch(path:string){requests.push(path);return {ok:true,blob:async()=>new Blob()};},
  withKey:(path:string)=>path,
  setTimeout(fn:()=>Promise<void>){timers.set(++nextTimer,fn);return nextTimer;},
  clearTimeout(id:number){timers.delete(id);},
 });
 const mockedArchive=editor.readProjectArchive,mockedInstall=editor.installSharedTimeline;
 vm.runInContext(fs.readFileSync('src/teach/ui/editor-files.js','utf8'),context);
 Object.assign(editor,{readProjectArchive:mockedArchive,installSharedTimeline:mockedInstall});
 const run=(source:string)=>vm.runInContext(source,context);
 const tick=async()=>{
  const first=timers.entries().next().value;
  if(!first)throw new Error('No sync check was scheduled');
  timers.delete(first[0]);
  await first[1]();
 };
 await run("edRememberShared('local',{id:'shared',revision:0},edSharedSnapshot(Ed.p))");
 run("edWatchShared(root,'local',status)");
 await tick();
 expect(requests).toEqual(['/api/editor/shared/shared/head','/api/editor/shared/shared/archive?revision=1']);
 expect(editor.p.name).toBe('Shared 1');
 expect(installs).toBe(1);
 expect(status.textContent).toBe('Synced · revision 1');

 editor.p.updated='new autosave';
 revision=2;editDuringArchive=true;
 await tick();
 expect(editor.p.name).toBe('Local edit');
 expect(installs).toBe(1);
 const checked=requests.length;
 await tick();
 expect(status.textContent).toBe('Sync paused · local changes');
 expect(requests).toHaveLength(checked);

 editDuringArchive=false;
 editor.p.name='Shared 1';
 root.dispatchEvent(new Event('pointerdown'));
 await tick();
 expect(requests).toHaveLength(checked);
 browserEvents.dispatchEvent(new Event('pointerup'));
 await tick();
 expect(editor.p.name).toBe('Shared 2');
 expect(installs).toBe(2);
 browserEvents.dispatchEvent(new Event('hashchange'));
 expect(timers.size).toBe(0);
});
