import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import type {Page} from 'playwright';
import {ROOT} from '../engine/config.js';
import {EditorProjectError,projectId,revision,sharedProjectHead} from './shared-projects.js';

const exportFormat=z.enum(['mp4','webm','gif','mp3','wav']);
export const exportRequest=z.strictObject({
 projectId,revision,format:exportFormat.default('mp4'),
 height:z.union([z.literal(240),z.literal(360),z.literal(480),z.literal(720),z.literal(1080)]).default(720),
 fps:z.union([z.literal(24),z.literal(25),z.literal(30),z.literal(60)]).default(30),
 quality:z.enum(['standard','high','best']).default('high'),
});
export type ExportRequest=z.infer<typeof exportRequest>;
type State='running'|'done'|'failed'|'cancelled';
type Row={id:string;projectId:string;revision:number;format:string;state:State;message:string;heartbeat:number;created:number};
type Render=(input:ExportRequest,file:string,signal:AbortSignal,progress:(message:string)=>void)=>Promise<void>;
const directory=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','editor-agent','exports');
const lease=30_000;

function database<T>(change:(db:DatabaseSync)=>T){
 const dir=directory();
 fs.mkdirSync(dir,{recursive:true});
 const db=new DatabaseSync(path.join(dir,'jobs.sqlite'));
 try{
  db.exec(`PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS editor_export (
    id TEXT PRIMARY KEY, projectId TEXT NOT NULL, revision INTEGER NOT NULL, format TEXT NOT NULL,
    state TEXT NOT NULL, message TEXT NOT NULL, heartbeat INTEGER NOT NULL
   );
   CREATE TABLE IF NOT EXISTS editor_export_created (id TEXT PRIMARY KEY, at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS editor_export_worker (id TEXT PRIMARY KEY);`);
  return change(db);
 }finally{db.close();}
}
function row(db:DatabaseSync,id:string){
 const result=db.prepare(`SELECT e.*,COALESCE(c.at,e.heartbeat) AS created
  FROM editor_export e LEFT JOIN editor_export_created c ON e.id=c.id WHERE e.id=?`).get(projectId.parse(id)) as Row|undefined;
 if(!result)throw new EditorProjectError(404,'Editor export not found');
 return result;
}
function recover(db:DatabaseSync){
 db.prepare("UPDATE editor_export SET state='failed',message='The render process stopped' WHERE state='running' AND heartbeat<?").run(Date.now()-lease);
}
function artifact(job:Pick<Row,'id'|'format'>){
 return path.join(directory(),job.id+'.'+exportFormat.parse(job.format));
}
function info({heartbeat,created,...job}:Row){
 return {...job,createdAt:new Date(created).toISOString(),updatedAt:new Date(heartbeat).toISOString(),
  ...(job.state==='done'?{file:artifact(job)}:{})};
}
export const getEditorExport=(id:string)=>database(db=>{recover(db);return info(row(db,id));});
export function listEditorExports(project:string){
 return database(db=>{
  recover(db);
  return (db.prepare(`SELECT e.*,COALESCE(c.at,e.heartbeat) AS created
   FROM editor_export e LEFT JOIN editor_export_created c ON e.id=c.id WHERE e.projectId=? ORDER BY e.rowid DESC LIMIT 10`)
   .all(projectId.parse(project)) as Row[]).map(info);
 });
}
export function cancelEditorExport(id:string){
 return database(db=>{
  recover(db);row(db,id);
  db.prepare("UPDATE editor_export SET state='cancelled',message='Cancelled',heartbeat=? WHERE id=? AND state='running'").run(Date.now(),id);
  return info(row(db,id));
 });
}

export function startEditorExport(input:unknown,render?:Render){
 const request=exportRequest.parse(input),head=sharedProjectHead(request.projectId);
 if(request.revision>head.revision)throw new EditorProjectError(404,'Editor revision not found');
 const id=randomUUID();
 const job=database(db=>{
  recover(db);
  const now=Date.now();
  const started=db.prepare(`INSERT INTO editor_export (id,projectId,revision,format,state,message,heartbeat)
    SELECT ?,?,?,?,'running','Preparing the timeline',?
    WHERE NOT EXISTS (SELECT 1 FROM editor_export WHERE state='running')`).run(id,request.projectId,request.revision,request.format,now);
  if(!started.changes)throw new EditorProjectError(409,'An editor export is already running');
  db.prepare('INSERT INTO editor_export_created VALUES (?,?)').run(id,now);
  return row(db,id);
 });
 if(render)void run(job,request,render);
 else{
  const processWorker=spawn(process.execPath,['--import','tsx',path.join(ROOT,'src','editor','shared-export-worker.ts'),id,JSON.stringify(request)],
   {cwd:ROOT,stdio:'ignore',windowsHide:true,detached:true});
  processWorker.on('error',error=>{
   database(db=>db.prepare("UPDATE editor_export SET state='failed',message=?,heartbeat=? WHERE id=? AND state='running'")
    .run(error.message.slice(0,300),Date.now(),id));
  });
  processWorker.unref();
 }
 return info(job);
}

export async function runEditorExportWorker(id:string,input:unknown){
 const request=exportRequest.parse(input);
 const job=database(db=>{
  const value=row(db,id);
  if(value.state!=='running'||value.projectId!==request.projectId||value.revision!==request.revision||value.format!==request.format)return;
  return db.prepare('INSERT OR IGNORE INTO editor_export_worker VALUES (?)').run(id).changes?value:undefined;
 });
 if(job)await run(job,request,renderEditor);
}

async function run(job:Row,request:ExportRequest,render:Render){
 const controller=new AbortController(),target=artifact(job),partial=target+'.part';
 const update=(state:State,message:string)=>database(db=>db.prepare(
  "UPDATE editor_export SET state=?,message=?,heartbeat=? WHERE id=? AND state='running'",
 ).run(state,message.slice(0,300),Date.now(),job.id).changes);
 const heartbeat=setInterval(()=>{
  try{
   const active=database(db=>db.prepare("UPDATE editor_export SET heartbeat=? WHERE id=? AND state='running'").run(Date.now(),job.id).changes);
   if(!active)controller.abort();
  }catch{controller.abort();}
 },1000);
 try{
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20*60_000)]);
  await render(request,partial,signal,message=>update('running',message));
  signal.throwIfAborted();
  if(!fs.statSync(partial).size)throw new Error('The export produced an empty file');
  database(db=>{
   db.exec('BEGIN IMMEDIATE');
   try{
    if(row(db,job.id).state==='running'){
     fs.copyFileSync(partial,target,fs.constants.COPYFILE_EXCL);
     db.prepare("UPDATE editor_export SET state='done',message='Export ready',heartbeat=? WHERE id=?").run(Date.now(),job.id);
    }
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
  });
 }catch(error){
  update('failed',(error as Error).message);
 }finally{
  clearInterval(heartbeat);
  fs.rmSync(partial,{force:true});
 }
}

type PageEditor={
 open(id:string):boolean;
 load():Promise<void>;
 importProjectFile(file:Blob):Promise<string>;
 exportVideo(options:{name:string;format:string;fps:number;height:number;quality:string;strict:true;progress:(message:string)=>void}):Promise<boolean>;
 end():number;
 fps():number;
 exportReady():Promise<void>;
 seekExact(at:number):Promise<void>;
 draw(overlays:boolean,at:number):void;
 dom:{canvas:HTMLCanvasElement};
};
declare const Ed:PageEditor;
declare function edBuild(element:Element):void;
declare function edCoverImage(source:HTMLCanvasElement,width:number,height:number):string;

async function renderEditor(input:ExportRequest,target:string,signal:AbortSignal,progress:(message:string)=>void){
 await withRenderPage(input,signal,async page=>{
  await page.exposeFunction('reportEditorExport',(message:unknown)=>{
   if(typeof message==='string'&&!signal.aborted)progress(message);
  });
  const download=page.waitForEvent('download',{timeout:0});
  void download.catch(()=>{});
  const rendered=await page.evaluate(input=>{
   if(Ed.end()<=0)throw new Error('The timeline is empty');
   const report=(globalThis as unknown as {reportEditorExport:(text:string)=>Promise<void>}).reportEditorExport;
   return Ed.exportVideo({...input,name:'export',strict:true,progress:report});
  },input);
  if(!rendered)throw new Error('The editor did not complete the export');
  await (await download).saveAs(target);
 });
}

export function captureSharedFrame(input:Pick<ExportRequest,'projectId'|'revision'>,at:number){
 return withRenderPage(input,AbortSignal.timeout(30_000),page=>page.evaluate(async time=>{
  const end=Ed.end();
  if(time>end||end<=0)throw new Error('Cover time is outside the timeline');
  const at=time===end?Math.max(0,end-1/Ed.fps()):time;
  await Ed.exportReady();
  await Ed.seekExact(at);Ed.draw(false,at);
  const canvas=Ed.dom.canvas;
  return edCoverImage(canvas,canvas.width,canvas.height);
 },at));
}

async function withRenderPage<T>(input:Pick<ExportRequest,'projectId'|'revision'>,signal:AbortSignal,render:(page:Page)=>Promise<T>){
 const {chromium}=await import('playwright');
 const {chromiumExecutable}=await import('../renderer/browser-path.js');
 const {serve}=await import('../teach/server.js');
 signal.throwIfAborted();
 const server=await serve({port:0,renderOnly:true});
 try{
  const origin=new URL(server.url).origin;
  const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable(),args:[
   '--disable-background-networking','--disable-component-update','--no-proxy-server',
   '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
  ]});
  const stop=()=>{void browser.close().catch(()=>{});};
  signal.addEventListener('abort',stop,{once:true});
  try{
   signal.throwIfAborted();
   const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
   const archive='/api/editor/shared/'+input.projectId+'/archive';
   await context.route('**/*',route=>{
    const url=new URL(route.request().url()),name=url.pathname;
    const allowed=url.origin===origin&&(name==='/'||name===archive||name==='/api/editor/mux'||name==='/api/editor/audio'||
     /^\/[\w-]+\.(js|css|svg|ttf)$/.test(name)||/^\/mascot\/[\w-]+\.svg$/.test(name));
    return allowed?route.continue():route.abort('blockedbyclient');
   });
   const page=await context.newPage();
   await page.goto(server.url+'#/editor');
   await page.waitForFunction(()=>typeof Ed!=='undefined'&&typeof edBuild==='function');
   await page.evaluate(async({archive,input,key})=>{
    await Ed.load();
    const response=await fetch(archive+'?revision='+input.revision,{headers:{'x-teach-key':key}});
    if(!response.ok)throw new Error('Could not open the requested revision');
    const id=await Ed.importProjectFile(await response.blob());
    if(!Ed.open(id))throw new Error('Could not open the shared timeline');
    edBuild(document.getElementById('view')!);
   },{archive,input,key:server.key});
   return await render(page);
  }finally{signal.removeEventListener('abort',stop);await browser.close();}
 }finally{await server.close();}
}
