// The page drives a job: when Settings say "this page" (or the user presses Run here on a job), the
// studio's steps run here with the user's chosen model, the way a terminal agent runs them: `studio
// start` gives the role's playbook and lessons, the role works with Tempoloom's own commands, and
// `studio done` records the work. It stops at every approval and choice (those are the user's), asks
// before a job spends past the "ask me" amount, and stops at the job and day budgets.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT} from './config.js';
import {jobDir,next,prompt,readPlan,roleOf} from './studio.js';
import {emit} from './studio-events.js';

export type DriveState={job:string;state:'running'|'asking'|'waiting'|'stopped'|'failed'|'finished';model:{provider:string;model:string}|null;
 task:string|null;why:string;spent:number;approvedSpend:boolean;started:string;updated:string;turns:number};
const stateFile=(job:string)=>path.join(jobDir(job),'driver.json');
export function driveState(job:string):DriveState|null{try{return JSON.parse(fs.readFileSync(stateFile(job),'utf8')) as DriveState;}catch{return null;}}
const save=(s:DriveState)=>{s.updated=new Date().toISOString();fs.writeFileSync(stateFile(s.job),JSON.stringify(s,null,1)+'\n');return s;};
const running=new Map<string,AbortController>();
export const isRunning=(job:string)=>running.has(job);

// ---------- what the model may do ----------
/** Commands the page's agents may run: Tempoloom's own, never what only the user decides (approving,
 *  choosing, rating, deleting, restoring, forgetting, spending outside the budgets). */
const BLOCKED:[RegExp,string][]=[
 [/^studio (approve|pick|rate|archive|delete|take|open|feedback|final|verdict|drive)\b/,'only the user approves, chooses, rates and deletes'],
 [/^tidy (clear|keep)\b/,'only the user clears space or removes duplicates'],[/^backup restore\b/,'only the user restores a backup'],
 [/^teach (forget|discard)\b/,'only the user forgets what was taught'],[/^history undo\b/,'only the user undoes changes'],
 [/^(settings|models|keys)\b/,'settings and keys are the user\'s'],[/^find listen\b.*--go/,'writing words costs money: only the user starts it'],
 [/^(studio )?open\b|^teach (open|serve)\b/,'the page is already open'],[/--yes\b|--anyway\b/,'that skips a check the user relies on'],
];
const COMMANDS=()=>{try{return [...fs.readFileSync(path.join(ROOT,'bin','tempoloom.mjs'),'utf8').matchAll(/^ ([a-z][a-z0-9-]*): \{/gm)].map(m=>m[1]!);}catch{return [] as string[];}};
export function allowed(args:string[],o:{voice:boolean}):string|null{
 if(!args.length)return 'Give the command after "tempoloom"';
 if(!COMMANDS().includes(args[0]!))return `"${args[0]}" is not a Tempoloom command. Commands: ${COMMANDS().join(', ')}`;
 const line=args.join(' ');for(const [re,why] of BLOCKED)if(re.test(line))return `Not allowed here: ${why}.`;
 if(/^media voiceover\b/.test(line)&&!o.voice)return 'The user did not ask for a voice-over (ElevenLabs is used only when asked).';
 return null;
}
const inside=(root:string,f:string)=>{const r=path.relative(root,f);return r===''||(!r.startsWith('..')&&!path.isAbsolute(r));};
const SECRET=/(^|[\\/])(\.env[^\\/]*|keys?\.json|.*\.pem|.*\.key|keychain[^\\/]*)$/i;
const ws=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace');
const outRoot=()=>path.resolve(ROOT,process.env.VIDEO_OUTPUT||'mp2');
function readable(f:string){const abs=path.resolve(ROOT,f);if(SECRET.test(abs))throw new Error('Keys and secrets are never read');
 if(![ROOT,ws(),outRoot()].some(r=>inside(r,abs)))throw new Error('Only files in the project, its workspace and its export folder');return abs;}
function writable(job:string,f:string){const abs=path.resolve(jobDir(job),f);if(SECRET.test(abs))throw new Error('Not a place for this');
 if(!inside(jobDir(job),abs)&&!inside(path.join(ws(),'projects'),abs))throw new Error(`Write inside the job's folder (${jobDir(job)}) or a motion project`);return abs;}

const TOOLS=[
 {name:'tempoloom',description:'Run a Tempoloom command (the words after "pnpm tempoloom"), e.g. ["studio","start","JOB","TASK"]. Returns what it printed.',parameters:{type:'object',properties:{args:{type:'array',items:{type:'string'}}},required:['args']}},
 {name:'read_file',description:'Read a text file in the project, its workspace or export folder.',parameters:{type:'object',properties:{path:{type:'string'},from:{type:'integer',description:'First character, for long files'}},required:['path']}},
 {name:'look_at',description:'Look at a picture (a frame, a sheet of frames, a storyboard frame): PNG, JPEG or WebP.',parameters:{type:'object',properties:{path:{type:'string'}},required:['path']}},
 {name:'write_file',description:'Write a text file inside the job\'s folder (or a motion project). Overwrites a file of the same name.',parameters:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content']}},
 {name:'list_files',description:'List a folder in the project, its workspace or export folder.',parameters:{type:'object',properties:{path:{type:'string'}},required:['path']}},
 {name:'say',description:'One line for the user\'s live page about what you are doing now.',parameters:{type:'object',properties:{text:{type:'string'},face:{type:'string',enum:['listening','thinking','planning','creating','rendering','confused','error']}},required:['text']}},
];
const clip=(s:string,n=14000)=>s.length<=n?s:s.slice(0,3000)+`\n[... ${s.length-n} characters cut ...]\n`+s.slice(-(n-3000));
function runCommand(args:string[],signal:AbortSignal){
 return new Promise<string>(resolve=>{const c=spawn(process.execPath,[path.join(ROOT,'bin','tempoloom.mjs'),...args],{cwd:ROOT,env:process.env,windowsHide:true});
  let out='';const add=(d:Buffer)=>{out+=d.toString();if(out.length>400000)out=out.slice(-200000);};c.stdout.on('data',add);c.stderr.on('data',add);
  const kill=()=>c.kill('SIGTERM');signal.addEventListener('abort',kill,{once:true});const timer=setTimeout(kill,40*60000);
  c.on('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',kill);resolve(`${clip(out.trim())}\n(exit ${code})`);});c.on('error',e=>resolve('Could not run it: '+e.message));});
}

// ---------- one step ----------
const SYSTEM=`You are a specialist of the Tempoloom studio, working through tools on the user's own computer. You do one task of a job, the way its playbook says.
1. Call tempoloom ["studio","start",JOB,TASK] first: it returns your role, its steps, guides, commands and checks, the inputs from earlier tasks, the lessons the studio learned for your role and the user's feedback.
2. Read the inputs and guides with read_file. Apply every lesson marked "always"; use the others where they fit.
3. Do the task with the role's commands (the tempoloom tool). Write the output to the "writeTo" path. Look at pictures you make with look_at before you finish.
4. Check the work against the role's checks. Fix what fails.
5. Finish with tempoloom ["studio","done",JOB,TASK,"--output",FILE,"--applied","ID,ID"] (or "--applied","none"), "--note" one line for the next role, and "--show",FILE for every picture or video the user should see.
Work alone: never approve, choose, rate or delete (only the user does). Use say to tell the live page what you are doing when the work changes. Keep answers short; act through tools.`;
type Msg=import('./models/chat.js').Msg;
async function runStep(s:DriveState,task:string,signal:AbortSignal):Promise<'done'|'stop'>{
 const {chat,estimate}=await import('./models/chat.js'),{allow,record,spent}=await import('./models/spend.js'),{readSettings}=await import('./models/settings.js');
 const p=readPlan(s.job),t=p.tasks.find(x=>x.id===task)!,settings=readSettings();
 const pick=settings.roleModels[t.role!]??s.model!;
 const {providerById}=await import('./models/providers.js'),{cachedModels}=await import('./models/settings.js');
 if(settings.share==='local'&&!pick.provider.startsWith('local-')){s.state='stopped';s.why='Settings say nothing may leave this computer: choose a local model, or change "What may leave this computer".';save(s);return 'stop';}
 const vision=pick.provider.startsWith('local-')?false:(cachedModels(pick.provider)?.models.find(m=>m.id===pick.model)?.can.vision??providerById(pick.provider).can.vision??false);
 const voice=p.options.includes('voice');
 const msgs:Msg[]=[{role:'system',content:SYSTEM},{role:'user',content:prompt(s.job,task)+`\n\nJOB is "${s.job}", TASK is "${task}". Start now.`}];
 let nudged=false;
 for(let turn=0;turn<80;turn++){
  if(signal.aborted){s.state='stopped';s.why='Stopped from the page.';save(s);return 'stop';}
  // Money first: the call's most it could cost, against what this job and today have spent.
  const est=estimate(pick,msgs);
  if(est===null){s.state='stopped';s.why=`The price of ${pick.model} is not known, so its cost cannot be kept within your budgets. Test the service in Settings to load its prices, or choose an OpenRouter or local model.`;save(s);return 'stop';}
  const hard=allow(est,{job:s.job,approved:true});if(!hard.ok){s.state='stopped';s.why=hard.why;save(s);emit(s.job,{type:'agent.say',task,role:t.role!,face:'needs-approval',text:'Stopped at the budget: '+hard.why});return 'stop';}
  const askAt=settings.budget.askAbove;
  if(!s.approvedSpend&&spent({job:s.job})+est>askAt){s.state='asking';s.task=task;s.why=`This job has spent $${spent({job:s.job}).toFixed(2)}; going on may pass the $${askAt.toFixed(2)} you are asked about first.`;save(s);
   emit(s.job,{type:'agent.say',task,role:t.role!,face:'needs-approval',text:'Waiting for your OK to spend more on this job.'});return 'stop';}
  let r;try{r=await chat(pick,msgs,TOOLS,{signal});}catch(e){if(signal.aborted){s.state='stopped';s.why='Stopped from the page.';save(s);return 'stop';}s.state='failed';s.why=(e as Error).message;save(s);return 'stop';}
  const usd=r.usd??est;if(usd>0)record({usd,what:`${t.title} (${pick.model})`,service:pick.provider,job:s.job});
  s.spent=spent({job:s.job});s.turns++;save(s);
  msgs.push({role:'assistant',content:r.text,toolCalls:r.calls});
  if(!r.calls.length){
   if(readPlan(s.job).tasks.find(x=>x.id===task)!.status==='done')return 'done';
   if(nudged){s.state='stopped';s.why=`The ${roleOf(t.role!).title} stopped without finishing "${t.title}": ${r.text.slice(0,300)||'it gave no reason.'}`;save(s);return 'stop';}
   nudged=true;msgs.push({role:'user',content:'Carry on with the tools until the task is finished with studio done. If something blocks you, say exactly what in one sentence.'});continue;}
  for(const c of r.calls){let out:string|Msg['content'];
   try{
    if(c.name==='tempoloom'){const args=(Array.isArray(c.args.args)?c.args.args:[]).map(String),no=allowed(args,{voice});
     if(no)out=no;else{emit(s.job,{type:'tool',task,role:t.role!,text:'tempoloom '+args.join(' ').slice(0,200)});out=await runCommand(args,signal);}}
    else if(c.name==='read_file'){const f=readable(String(c.args.path));const txt=fs.readFileSync(f,'utf8'),from=Number(c.args.from)||0;out=clip(txt.slice(from,from+60000),60000)+(txt.length>from+60000?`\n[more: read again with from=${from+60000}]`:'');}
    else if(c.name==='look_at'){const f=readable(String(c.args.path)),ext=path.extname(f).toLowerCase(),mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':/\.jpe?g$/.test(ext)?'image/jpeg':null;
     if(!mime)out='Only PNG, JPEG or WebP pictures. For a video, make a frame sheet first (pnpm tempoloom media frames or studio check).';
     else if(!vision)out='This model cannot see pictures. Describe what you need checked, or ask the user to choose a model that sees images.';
     else if(settings.share==='local')out='Settings say pictures may not leave this computer.';
     else{const b=fs.readFileSync(f);out=b.length>5*1048576?'That picture is over 5 MB; make a smaller frame.':[{type:'text',text:path.basename(f)},{type:'image',mime,data:b.toString('base64')}];}}
    else if(c.name==='write_file'){const f=writable(s.job,String(c.args.path));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,String(c.args.content??''));out='Written: '+f;}
    else if(c.name==='list_files'){const f=readable(String(c.args.path));out=fs.readdirSync(f,{withFileTypes:true}).slice(0,300).map(d=>d.name+(d.isDirectory()?'/':'')).join('\n')||'(empty)';}
    else if(c.name==='say'){emit(s.job,{type:'agent.say',task,role:t.role!,text:String(c.args.text??'').slice(0,300),...(c.args.face?{face:String(c.args.face) as never}:{})});out='Said.';}
    else out='Unknown tool '+c.name;
   }catch(e){out='Error: '+(e as Error).message;}
   // Pictures go back as a picture the model sees (for OpenAI-style services, in a user turn after the result).
   if(Array.isArray(out)&&!pick.provider.startsWith('anthropic')){msgs.push({role:'tool',toolId:c.id,content:'The picture follows.'});msgs.push({role:'user',content:out});}
   else msgs.push({role:'tool',toolId:c.id,content:out});}
  if(readPlan(s.job).tasks.find(x=>x.id===task)!.status==='done')return 'done';
 }
 s.state='stopped';s.why=`"${t.title}" took more than 80 turns; stopped so it does not run up the bill. Run it again, or let your terminal agent finish it.`;save(s);return 'stop';
}

// ---------- a job ----------
/** Runs a job's ready steps one after another until it reaches the user (an approval, a choice), the
 *  budget, a problem, or the end. Returns at once; the work goes on in the background. */
export async function drive(job:string,o:{model?:{provider:string;model:string};approveSpend?:boolean}={}){
 if(running.has(job))return driveState(job)!;
 const {readSettings}=await import('./models/settings.js'),st=readSettings(),model=o.model??driveState(job)?.model??st.model;
 if(!model)throw new Error('Choose a main model in Settings (Models and keys) first.');
 readPlan(job);
 const prev=driveState(job),now=new Date().toISOString();
 const s=save({job,state:'running',model,task:null,why:'',spent:prev?.spent??0,approvedSpend:o.approveSpend||prev?.approvedSpend||false,started:prev?.started??now,updated:now,turns:prev?.turns??0});
 const ac=new AbortController();running.set(job,ac);
 void (async()=>{
  try{
   for(;;){const n=next(job);
    if((n as {finished?:boolean}).finished){s.state='finished';s.task=null;s.why='Every step is done.';save(s);break;}
    if(!n.ready.length){s.state='waiting';s.task=null;
     const choose=(n as {userChooses?:{step:string}[]}).userChooses??[];
     s.why=choose.length?`Waiting for you to choose a version of ${choose.map(c=>c.step).join(', ')}.`:n.waitingForUser.length?`Waiting for you: ${n.waitingForUser.map(g=>g.title).join(', ')}.`:'Nothing is ready.';
     save(s);emit(job,{type:'agent.say',role:'director',face:'needs-approval',text:s.why});break;}
    const task=n.ready[0]!.task;s.task=task;s.state='running';s.why='';save(s);
    if(await runStep(s,task,ac.signal)==='stop')break;}
  }catch(e){s.state='failed';s.why=(e as Error).message;save(s);}
  finally{running.delete(job);}
 })();
 return s;
}
export function stopDrive(job:string){const ac=running.get(job);if(ac)ac.abort();const s=driveState(job);if(s&&!running.has(job)&&s.state==='running'){s.state='stopped';s.why='Stopped from the page.';save(s);}return driveState(job);}
/** After the user approves a gate on the page, a job the page drives carries on by itself. */
export async function carryOn(job:string){const s=driveState(job);if(!s||running.has(job)||!['waiting','asking'].includes(s.state))return null;return drive(job);}
