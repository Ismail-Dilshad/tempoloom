import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {ROOT} from '../engine/config.js';
import {loadKeys,readSettings} from '../engine/models/settings.js';
import {editorModelRun,proposeEditorEdit} from './editor-agent.js';
import {editProject,EditorProjectError,projectId,sharedProjectHead,withSharedProjectDatabase as database} from './shared-projects.js';

type State='queued'|'running'|'done'|'failed'|'cancelled';
type Job={id:string;projectId:string;base:number;request:string;state:State;heartbeat:number;created:number;resultRevision:number|null;message:string|null};
const lease=30_000;

function expire(db:DatabaseSync){
 const now=Date.now();
 db.prepare("UPDATE editor_model_job SET state='failed', message='The model worker stopped',request='',heartbeat=? WHERE state IN ('queued','running') AND heartbeat<?").run(now,now-lease);
}
function row(db:DatabaseSync,id:string){
 const job=db.prepare('SELECT * FROM editor_model_job WHERE id=?').get(projectId.parse(id)) as Job|undefined;
 if(!job)throw new EditorProjectError(404,'Editor model job not found');
 return job;
}
function info({id,projectId,base,state,created,heartbeat,resultRevision,message}:Job){
 return {id,projectId,base,state,createdAt:new Date(created).toISOString(),updatedAt:new Date(heartbeat).toISOString(),resultRevision,message};
}
export function getEditorModelJob(id:string){
 return database(db=>{expire(db);return info(row(db,id));});
}
export function listEditorModelJobs(project:string){
 return database(db=>{
  expire(db);
  return (db.prepare('SELECT * FROM editor_model_job WHERE projectId=? ORDER BY created DESC,rowid DESC LIMIT 10')
   .all(projectId.parse(project)) as Job[]).map(info);
 });
}
export function cancelEditorModelJob(id:string){
 return database(db=>{
  expire(db);row(db,id);
  db.prepare("UPDATE editor_model_job SET state='cancelled', message='Cancelled', request='',heartbeat=? WHERE id=? AND state IN ('queued','running')").run(Date.now(),id);
  return info(row(db,id));
 });
}
function failJob(id:string,message:string){
 database(db=>db.prepare("UPDATE editor_model_job SET state='failed',message=?,request='',heartbeat=? WHERE id=? AND state IN ('queued','running')")
  .run(message,Date.now(),id));
}
export function startEditorModelJob(input:unknown){
 const request=editorModelRun.parse(input),head=sharedProjectHead(request.projectId);
 if(head.revision!==request.base)throw new EditorProjectError(409,'Project revision changed. Refresh before running the editor model.');
 if(readSettings().share==='local'&&!request.provider.startsWith('local-'))throw new EditorProjectError(403,'Settings allow only local model servers');
 const id=randomUUID(),now=Date.now();
 const job=database(db=>{
  expire(db);
  const inserted=db.prepare(`INSERT INTO editor_model_job(id,projectId,base,request,state,heartbeat,created)
   SELECT ?,?,?,?,'queued',?,? WHERE NOT EXISTS (
    SELECT 1 FROM editor_model_job WHERE projectId=? AND state IN ('queued','running')
   )`).run(id,request.projectId,request.base,JSON.stringify(request),now,now,request.projectId);
  if(!inserted.changes)throw new EditorProjectError(409,'A model job is already active for this project');
  return info(row(db,id));
 });
 try{
  const worker=spawn(process.execPath,['--import','tsx',path.join(ROOT,'src','editor','editor-model-worker.ts'),id],
   {cwd:ROOT,stdio:'ignore',windowsHide:true,detached:true});
  worker.once('error',()=>failJob(id,'Could not launch the model worker'));
  worker.unref();
 }catch{failJob(id,'Could not launch the model worker');return getEditorModelJob(id);}
 return job;
}

export async function runEditorModelWorker(id:string){
 const job=database(db=>{
  expire(db);
  const claimed=db.prepare("UPDATE editor_model_job SET state='running',heartbeat=? WHERE id=? AND state='queued'").run(Date.now(),projectId.parse(id));
  return claimed.changes?row(db,id):undefined;
 });
 if(!job)return;
 const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(60_000)]);
 let active=true;
 const heartbeat=setInterval(()=>{
  try{
   const updated=database(db=>db.prepare("UPDATE editor_model_job SET heartbeat=? WHERE id=? AND state='running'").run(Date.now(),id));
   active=Boolean(updated.changes);
   if(!active)controller.abort();
  }catch{controller.abort();}
 },1000);
 try{
  const {projectId,base,...request}=editorModelRun.parse(JSON.parse(job.request));
  await loadKeys();
  if(sharedProjectHead(projectId).revision!==base)throw new EditorProjectError(409,'Project revision changed');
  const proposal=await proposeEditorEdit(projectId,request,{signal});
  signal.throwIfAborted();
  if(proposal.base!==base)throw new EditorProjectError(409,'Project revision changed');
  editProject(projectId,base,proposal.edits,(db,next)=>{
   const completed=db.prepare("UPDATE editor_model_job SET state='done',resultRevision=?,message=?,request='',heartbeat=? WHERE id=? AND state='running'")
    .run(next,'Validated edits applied',Date.now(),id);
   if(!completed.changes)throw new EditorProjectError(409,'Model job is no longer active');
  });
 }catch(error){
  if(!active)return;
  failJob(id,signal.aborted?'The model run timed out or was interrupted':
   error instanceof EditorProjectError&&error.status===409?'The project revision changed or the job is no longer active':'The model could not produce a usable edit batch');
 }finally{clearInterval(heartbeat);}
}
