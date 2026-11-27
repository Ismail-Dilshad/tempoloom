// Talking to a model with tools: one shape for every service. OpenRouter, OpenAI, Gemini, xAI,
// Mistral, DeepSeek, Groq and local servers speak the OpenAI chat API; Claude has its own. Each call
// says what it cost, from the service (OpenRouter tells) or from the model's price per million tokens.
import {keyOf,readSettings,cachedModels,localKeyName} from './settings.js';
import {providerById} from './providers.js';

export type Part={type:'text';text:string}|{type:'image';mime:string;data:string};
export type Msg={role:'system'|'user'|'assistant'|'tool';content:string|Part[];toolCalls?:Call[];toolId?:string};
export type Call={id:string;name:string;args:Record<string,unknown>};
export type Tool={name:string;description:string;parameters:Record<string,unknown>};
export type Reply={text:string;calls:Call[];tokensIn:number;tokensOut:number;usd:number|null;stop:string};
export type Pick={provider:string;model:string};

const BASE:Record<string,string>={openrouter:'https://openrouter.ai/api/v1',openai:'https://api.openai.com/v1',google:'https://generativelanguage.googleapis.com/v1beta/openai',
 xai:'https://api.x.ai/v1',mistral:'https://api.mistral.ai/v1',deepseek:'https://api.deepseek.com/v1',groq:'https://api.groq.com/openai/v1'};
/** Where a service is, its key, and the model's price per million tokens (null when unknown). */
export function endpoint(p:Pick){
 if(p.provider.startsWith('local-')){const l=readSettings().local.find(x=>x.id===p.provider);if(!l)throw new Error('That model server is not in Settings any more');
  return {kind:'openai' as const,url:l.baseURL.replace(/\/$/,''),key:keyOf(localKeyName(p.provider))||'',price:{in:0,out:0},local:true};}
 const prov=providerById(p.provider);
 const env=process.env[`TEMPOLOOM_${p.provider.toUpperCase()}_URL`]; // tests and proxies only
 const price=cachedModels(p.provider)?.models.find(m=>m.id===p.model)?.price??null,key=keyOf(prov.env);
 if(!key)throw new Error(`Add your ${prov.name} key in Settings first`);
 if(p.provider==='anthropic')return {kind:'anthropic' as const,url:env??'https://api.anthropic.com/v1',key,price,local:false};
 const url=env??BASE[p.provider];if(!url)throw new Error(`${prov.name} cannot run the studio's agents`);
 return {kind:'openai' as const,url,key,price,local:false};
}

const toOpenAI=(m:Msg)=>{
 if(m.role==='tool')return {role:'tool',tool_call_id:m.toolId,content:typeof m.content==='string'?m.content:m.content.map(p=>p.type==='text'?p.text:'').join('\n')};
 const content=typeof m.content==='string'?m.content:m.content.map(p=>p.type==='text'?{type:'text',text:p.text}:{type:'image_url',image_url:{url:`data:${p.mime};base64,${p.data}`}});
 return {role:m.role,content,...(m.toolCalls?.length?{tool_calls:m.toolCalls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:JSON.stringify(c.args)}}))}:{})};};
function anthropicBody(model:string,msgs:Msg[],tools:Tool[],max:number){
 const system=msgs.filter(m=>m.role==='system').map(m=>typeof m.content==='string'?m.content:'').join('\n\n'),out:Record<string,unknown>[]=[];
 const parts=(c:Msg['content'])=>typeof c==='string'?[{type:'text',text:c}]:c.map(p=>p.type==='text'?{type:'text',text:p.text}:{type:'image',source:{type:'base64',media_type:p.mime,data:p.data}});
 for(const m of msgs.filter(x=>x.role!=='system')){
  if(m.role==='tool'){const block={type:'tool_result',tool_use_id:m.toolId,content:parts(m.content)},last=out.at(-1);
   if(last&&last.role==='user'&&Array.isArray(last.content)&&(last.content as {type:string}[]).every(b=>b.type==='tool_result'))(last.content as unknown[]).push(block);else out.push({role:'user',content:[block]});continue;}
  if(m.role==='assistant'){out.push({role:'assistant',content:[...(typeof m.content==='string'&&m.content?[{type:'text',text:m.content}]:[]),...(m.toolCalls??[]).map(c=>({type:'tool_use',id:c.id,name:c.name,input:c.args}))]});continue;}
  out.push({role:'user',content:parts(m.content)});}
 return {model,max_tokens:max,system,messages:out,...(tools.length?{tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters}))}:{})};
}
/** One turn: the model answers or asks for tools. Throws with the service's own words on failure. */
export async function chat(p:Pick,msgs:Msg[],tools:Tool[],o:{max?:number;signal?:AbortSignal;fetch?:typeof fetch}={}):Promise<Reply>{
 const e=endpoint(p),f=o.fetch??fetch,max=o.max??4096;
 const call=async(url:string,headers:Record<string,string>,body:unknown)=>{
  let last:Error|null=null;
  for(let attempt=0;attempt<3;attempt++){
   const r=await f(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:o.signal??null});
   const text=await r.text();if(r.ok)return JSON.parse(text) as Record<string,any>;
   last=new Error(`${providerName(p)} said ${r.status}: ${text.replace(/\s+/g,' ').slice(0,300)}`);
   if(r.status!==429&&r.status<500)throw last;await new Promise(s=>setTimeout(s,1500*(attempt+1)));}
  throw last!;};
 if(e.kind==='anthropic'){
  const j=await call(e.url+'/messages',{'x-api-key':e.key,'anthropic-version':'2023-06-01'},anthropicBody(p.model,msgs,tools,max));
  const blocks=(j.content??[]) as {type:string;text?:string;id?:string;name?:string;input?:Record<string,unknown>}[];
  const tin=Number(j.usage?.input_tokens??0),tout=Number(j.usage?.output_tokens??0);
  return {text:blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n'),calls:blocks.filter(b=>b.type==='tool_use').map(b=>({id:b.id!,name:b.name!,args:b.input??{}})),
   tokensIn:tin,tokensOut:tout,usd:e.price?(tin*e.price.in+tout*e.price.out)/1e6:null,stop:String(j.stop_reason??'')};}
 const j=await call(e.url+'/chat/completions',{...(e.key?{authorization:'Bearer '+e.key}:{}),...(p.provider==='openrouter'?{'x-title':'Tempoloom'}:{})},
  {model:p.model,messages:msgs.map(toOpenAI),...(tools.length?{tools:tools.map(t=>({type:'function',function:t}))}:{}),max_tokens:max,...(p.provider==='openrouter'?{usage:{include:true}}:{})});
 const c=j.choices?.[0]?.message??{},tin=Number(j.usage?.prompt_tokens??0),tout=Number(j.usage?.completion_tokens??0);
 const calls=((c.tool_calls??[]) as {id:string;function:{name:string;arguments:string}}[]).map(t=>{let args:Record<string,unknown>={};try{args=JSON.parse(t.function.arguments||'{}');}catch{args={_unreadable:t.function.arguments};}return {id:t.id,name:t.function.name,args};});
 const usd=typeof j.usage?.cost==='number'?j.usage.cost:e.local?0:e.price?(tin*e.price.in+tout*e.price.out)/1e6:null;
 return {text:typeof c.content==='string'?c.content:'',calls,tokensIn:tin,tokensOut:tout,usd,stop:String(j.choices?.[0]?.finish_reason??'')};
}
export const providerName=(p:Pick)=>p.provider.startsWith('local-')?(readSettings().local.find(x=>x.id===p.provider)?.name??'Your model server'):providerById(p.provider).name;
/** What a call could cost at most, before it is made (the words sent, and the longest answer). */
export function estimate(p:Pick,msgs:Msg[],max=4096){
 const e=endpoint(p);if(e.local)return 0;if(!e.price)return null;
 const chars=msgs.reduce((t,m)=>t+(typeof m.content==='string'?m.content.length:m.content.reduce((a,x)=>a+(x.type==='text'?x.text.length:4000),0))+JSON.stringify(m.toolCalls??[]).length,0);
 return (chars/3.5*e.price.in+max*e.price.out)/1e6;
}
