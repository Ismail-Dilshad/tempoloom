import {CLIENT_CAPABILITIES_META_KEY,isJSONRPCResultResponse,MissingRequiredClientCapabilityError,
 ProtocolError,ProtocolErrorCode,type JSONRPCMessage,type Server,type ServerContext} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {z} from 'zod';
import {cancelEditorModelJob,getEditorModelJob} from '../editor/editor-model-jobs.js';
import {cancelEditorExport,getEditorExport} from '../editor/shared-exports.js';
import {EditorProjectError,projectId} from '../editor/shared-projects.js';

const extension='io.modelcontextprotocol/tasks';
const marker='tempoloom/durable-task';
const capabilities={extensions:{[extension]:{}}};
const params=z.object({taskId:z.string()});
type Kind='export'|'model';
const jobs={
 export:{get:getEditorExport,cancel:cancelEditorExport},
 model:{get:getEditorModelJob,cancel:cancelEditorModelJob},
};
type Job=ReturnType<typeof getEditorExport>|ReturnType<typeof getEditorModelJob>;

export function toolResult(value:unknown,isError=false){
 return {content:[{type:'text' as const,text:typeof value==='string'?value:JSON.stringify(value,null,1)??'null'}],
  ...(isError?{isError:true}:{})};
}
function supportsTasks(ctx:ServerContext){
 const envelope=ctx.mcpReq.envelope as Record<string,{extensions?:Record<string,unknown>}>|undefined;
 return Object.hasOwn(envelope?.[CLIENT_CAPABILITIES_META_KEY]?.extensions??{},extension);
}
function summary(kind:Kind,job:Job){
 const status=job.state==='cancelled'?'cancelled':job.state==='queued'||job.state==='running'?'working':'completed';
 return {taskId:kind+':'+job.id,status,createdAt:job.createdAt,lastUpdatedAt:job.updatedAt,
  ttlMs:null,pollIntervalMs:1000,...(job.message?{statusMessage:job.message}:{})};
}
export function editorTaskMeta(name:string,value:unknown,ctx:ServerContext){
 if(!supportsTasks(ctx))return {};
 const kind=name==='editor_export_start'?'export':name==='editor_model_job_start'?'model':undefined;
 if(!kind)return {};
 const id=projectId.parse((value as {id:string}).id);
 return {_meta:{[marker]:summary(kind,jobs[kind].get(id))}};
}

// SDK 2.4 validates tools/call as a standard result. Encode the extension's
// task handle on the wire after the SDK has handled negotiation and validation.
export class EditorTaskTransport extends StdioServerTransport {
 override async send(message:JSONRPCMessage){
  if(isJSONRPCResultResponse(message)&&message.result._meta?.[marker]){
   const {[marker]:task,...meta}=message.result._meta;
   return super.send({...message,result:{...(task as ReturnType<typeof summary>),resultType:'task',
    ...(Object.keys(meta).length?{_meta:meta}:{})}});
  }
  return super.send(message);
 }
}

export function registerEditorTasks(server:Server){
 server.registerCapabilities(capabilities);
 for(const action of ['get','update','cancel'] as const){
  server.setRequestHandler('tasks/'+action,{params},({taskId},ctx)=>{
   if(!supportsTasks(ctx))throw new MissingRequiredClientCapabilityError({requiredCapabilities:capabilities});
   const [kind,id,extra]=taskId.split(':');
   const parsed=projectId.safeParse(id);
   if(extra!==undefined||(kind!=='export'&&kind!=='model')||!parsed.success)
    throw new ProtocolError(ProtocolErrorCode.InvalidParams,'Unknown editor task');
   try{
    const job=action==='cancel'?jobs[kind].cancel(parsed.data):jobs[kind].get(parsed.data);
    if(action!=='get')return {};
    const task=summary(kind,job);
    return {...task,...(task.status==='completed'?{result:job.state==='failed'?toolResult(job.message,true):toolResult(job)}:{})};
   }catch(error){
    if(error instanceof EditorProjectError&&error.status===404)
     throw new ProtocolError(ProtocolErrorCode.InvalidParams,'Unknown editor task');
    throw error;
   }
  });
 }
}
