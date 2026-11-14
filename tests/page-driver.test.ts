// The page drives a job: a model (here a stand-in model server that answers the way a model does,
// with tool calls) runs the studio's steps through Tempoloom's own commands, stops at the user's
// approvals, asks before spending past the "ask me" amount, and never does what only the user does.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-drive-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups'),VIDEO_OUTPUT:path.join(tmp,'out'),
 TEMPOLOOM_ENV_FILE:path.join(tmp,'.env'),TEMPOLOOM_KEYCHAIN:'off'},before={...process.env};
type Body={messages:{role:string;content:unknown;tool_calls?:unknown[]}[];model:string};
let server:http.Server,port=0,cost=0;const seen:Body[]=[];
/** A stand-in model: for any task it starts it, writes the output the playbook names, finishes it. */
function answer(b:Body){
 const user=String(b.messages.find(m=>m.role==='user')?.content??''),job=/JOB is "([^"]+)"/.exec(user)?.[1],task=/TASK is "([^"]+)"/.exec(user)?.[1];
 const mine=b.messages.filter(m=>m.role==='assistant').length,tools=b.messages.filter(m=>m.role==='tool').map(m=>String(m.content));
 const call=(name:string,args:unknown)=>({choices:[{message:{role:'assistant',content:'',tool_calls:[{id:'c'+mine,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:900,completion_tokens:60,...(cost?{cost}:{})}});
 const writeTo=/"writeTo":\s*"([^"]+)"/.exec(tools[0]??'')?.[1];
 if(mine===0)return call('tempoloom',{args:['studio','start',job,task]});
 if(mine===1)return call('say',{text:`Working on ${task}`,face:'planning'});
 if(mine===2)return call('tempoloom',{args:['studio','approve',job,'brief-ok']}); // not allowed: only the user approves
 if(mine===3)return call('write_file',{path:writeTo,content:`# ${task}\n\nWritten for the test.\n`});
 if(mine===4)return call('tempoloom',{args:['studio','done',job,task,'--output',writeTo,'--applied','none','--note','test']});
 return {choices:[{message:{role:'assistant',content:'Finished.'},finish_reason:'stop'}],usage:{prompt_tokens:900,completion_tokens:5,...(cost?{cost}:{})}};
}
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});
 (await import('../src/engine/brain/brain.js')).sync();
 server=http.createServer((req,res)=>{if(req.method==='GET'){res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{id:'stand-in-1',object:'model'}]}));return;}let d='';req.on('data',c=>d+=c);req.on('end',()=>{const b=JSON.parse(d) as Body;seen.push(b);res.setHeader('content-type','application/json');res.end(JSON.stringify(answer(b)));});});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',()=>r()));port=(server.address() as {port:number}).port;
});
afterAll(async()=>{server.close();(await import('../src/engine/brain/db.js')).closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});
const until=async(f:()=>boolean,ms=120000)=>{const t=Date.now();while(!f()){if(Date.now()-t>ms)throw new Error('timed out');await new Promise(r=>setTimeout(r,200));}};

describe('what the page\'s agents may do',()=>{
 it('runs Tempoloom\'s own commands, never what only the user decides',async()=>{
  const D=await import('../src/engine/driver.js');
  expect(D.allowed(['studio','start','j','t'],{voice:false})).toBeNull();
  expect(D.allowed(['media','frames','a.mp4'],{voice:false})).toBeNull();
  for(const a of [['studio','approve','j','g'],['studio','pick','j','t','A'],['studio','rate','j','t'],['tidy','clear','--token','x'],['backup','restore','f'],['history','undo','1'],['find','listen','--go'],['studio','done','j','t','--anyway']])
   expect(D.allowed(a,{voice:false})).toMatch(/Not allowed/);
  expect(D.allowed(['media','voiceover','--text','hi'],{voice:false})).toMatch(/did not ask for a voice-over/);
  expect(D.allowed(['media','voiceover','--text','hi'],{voice:true})).toBeNull();
  expect(D.allowed(['rm','-rf','/'],{voice:false})).toMatch(/not a Tempoloom command/);
 });
});

describe('a job the page drives',()=>{
 it('runs each ready step with the chosen model, says what it does, and stops at the user\'s approval',async()=>{
  const S=await import('../src/engine/models/settings.js'),st=await import('../src/engine/studio.js'),D=await import('../src/engine/driver.js'),E=await import('../src/engine/studio-events.js');
  const l=S.addLocal('Stand-in',`http://127.0.0.1:${port}/v1`);await S.test(l.id);S.update({model:{provider:l.id,model:'stand-in-1'},driver:'browser'});
  const job=st.plan('A 20 second video about green tea, for TikTok.',{type:'script-to-motion',job:'tea-drive'}).job;
  await D.drive(job);await until(()=>!D.isRunning(job));
  const s=D.driveState(job)!,p=st.readPlan(job);
  expect(p.tasks.find(t=>t.id==='intake')!.status).toBe('done');expect(p.tasks.find(t=>t.id==='brief')!.status).toBe('done');
  expect(s.state).toBe('waiting');expect(s.why).toMatch(/Waiting for you/);expect(s.spent).toBe(0); // a model on this computer costs nothing
  expect(p.tasks.find(t=>t.gate&&t.status==='done')).toBeUndefined(); // it asked to approve, and was refused
  const refused=seen.flatMap(b=>b.messages.filter(m=>m.role==='tool').map(m=>String(m.content))).find(c=>/Not allowed/.test(c));expect(refused).toMatch(/only the user approves/);
  expect(fs.readFileSync(path.join(st.jobDir(job),'events.jsonl'),'utf8')).toMatch(/Working on intake/);
 },180000);
 it('asks before a job spends past the "ask me" amount, then goes on when the user says so; stops at the job budget',async()=>{
  const S=await import('../src/engine/models/settings.js'),st=await import('../src/engine/studio.js'),D=await import('../src/engine/driver.js'),Sp=await import('../src/engine/models/spend.js');
  process.env.OPENROUTER_API_KEY='test-key';process.env.TEMPOLOOM_OPENROUTER_URL=`http://127.0.0.1:${port}/v1`;
  fs.mkdirSync(path.join(env.TEMPOLOOM_SETTINGS_DIR,'models'),{recursive:true});
  fs.writeFileSync(path.join(env.TEMPOLOOM_SETTINGS_DIR,'models','openrouter.json'),JSON.stringify({at:new Date().toISOString(),models:[{id:'paid/model',can:{agents:true},price:{in:1,out:2}}]}));
  S.update({model:{provider:'openrouter',model:'paid/model'}});cost=.2;
  const job=st.plan('A 20 second video about coffee.',{type:'script-to-motion',job:'coffee-drive'}).job;
  await D.drive(job);await until(()=>!D.isRunning(job));
  let s=D.driveState(job)!;expect(s.state).toBe('asking');expect(Sp.spent({job})).toBeGreaterThan(.3);expect(Sp.spent({job})).toBeLessThanOrEqual(.6);
  await D.drive(job,{approveSpend:true});await until(()=>!D.isRunning(job));
  s=D.driveState(job)!;expect(s.state).toBe('stopped');expect(s.why).toMatch(/budget is \$2/); // $0.20 a turn reaches the $2 a job
  expect(Sp.spent({job})).toBeLessThanOrEqual(2);
  delete process.env.OPENROUTER_API_KEY;delete process.env.TEMPOLOOM_OPENROUTER_URL;cost=0;
 },180000);
 it('is on the page: run, stop, go ahead; a new video starts at once when Settings say the page works on it',async()=>{
  const {serve}=await import('../src/teach/server.js'),S=await import('../src/engine/models/settings.js'),st=await import('../src/engine/studio.js');
  const l=S.readSettings().local[0]!;S.update({model:{provider:l.id,model:'stand-in-1'},driver:'browser'});
  const s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key,'content-type':'application/json'};
   const r=await (await fetch(base+'/api/studio/requests',{method:'POST',headers:h})).json() as {id:string};
   const sent=await (await fetch(`${base}/api/studio/requests/${r.id}/submit`,{method:'POST',headers:h,body:JSON.stringify({mode:'motion',text:'A short video about mint tea for TikTok.',script:false,link:'',voice:false,captions:true,visuals:false,pick:false,colors:{},notes:'',second:false})})).json() as {driving:boolean;job:string};
   expect(sent.driving).toBe(true);
   const D=await import('../src/engine/driver.js');await until(()=>!D.isRunning(sent.job));
   const state=await (await fetch(`${base}/api/studio/state`,{headers:h})).json() as {jobs:{job:string;drive:{state:string}}[]};
   expect(state.jobs.find(j=>j.job===sent.job)!.drive.state).toBe('waiting');
   expect(st.readPlan(sent.job).tasks.find(t=>t.id==='intake')!.status).toBe('done');
   expect((await fetch(`${base}/api/studio/jobs/${sent.job}/drive`,{method:'POST',headers:h,body:JSON.stringify({action:'stop'})})).status).toBe(200);
  }finally{await s.close();}
 },180000);
});

describe('talking to Claude',()=>{
 it('sends tools and their results in Claude\'s own format, and counts what it cost',async()=>{
  const C=await import('../src/engine/models/chat.js');process.env.ANTHROPIC_API_KEY='k';
  fs.mkdirSync(path.join(env.TEMPOLOOM_SETTINGS_DIR,'models'),{recursive:true});
  fs.writeFileSync(path.join(env.TEMPOLOOM_SETTINGS_DIR,'models','anthropic.json'),JSON.stringify({at:'x',models:[{id:'claude-x',can:{agents:true,vision:true},price:{in:3,out:15}}]}));
  let sent:Record<string,any>={};
  const fake=(async(_u:string,i:{body:string})=>{sent=JSON.parse(i.body);return new Response(JSON.stringify({content:[{type:'text',text:'Looking.'},{type:'tool_use',id:'t2',name:'look_at',input:{path:'a.png'}}],usage:{input_tokens:1000,output_tokens:100},stop_reason:'tool_use'}));}) as unknown as typeof fetch;
  const r=await C.chat({provider:'anthropic',model:'claude-x'},[{role:'system',content:'S'},{role:'user',content:'Go'},{role:'assistant',content:'',toolCalls:[{id:'t1',name:'read_file',args:{path:'x'}}]},
   {role:'tool',toolId:'t1',content:[{type:'text',text:'f.png'},{type:'image',mime:'image/png',data:'AAAA'}]}],[{name:'read_file',description:'d',parameters:{type:'object'}}],{fetch:fake});
  expect(sent.system).toBe('S');expect(sent.messages[1].content[0]).toMatchObject({type:'tool_use',id:'t1',name:'read_file'});
  expect(sent.messages[2].content[0]).toMatchObject({type:'tool_result',tool_use_id:'t1'});expect(sent.messages[2].content[0].content[1]).toMatchObject({type:'image',source:{type:'base64',media_type:'image/png'}});
  expect(r.calls).toEqual([{id:'t2',name:'look_at',args:{path:'a.png'}}]);expect(r.usd).toBeCloseTo((1000*3+100*15)/1e6,8);
  delete process.env.ANTHROPIC_API_KEY;
 });
});

