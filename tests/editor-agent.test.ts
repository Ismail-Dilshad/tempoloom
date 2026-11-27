import fs from 'node:fs';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createServer,type ServerResponse} from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import readline from 'node:readline';
import {promisify} from 'node:util';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';
import {serve} from '../src/teach/server.js';
import {callTool} from '../src/engine/agent-tools.js';
import * as editor from '../src/editor/shared-projects.js';
import {getEditorModelJob} from '../src/editor/editor-model-jobs.js';

declare const Ed:any;
let tmp:string;
beforeEach(()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-editor-agent-'));
 vi.stubEnv('VIDEO_WORKSPACE',path.join(tmp,'workspace'));
 vi.stubEnv('TEMPOLOOM_SETTINGS_DIR',path.join(tmp,'settings'));
 vi.stubEnv('TEMPOLOOM_ENV_FILE',path.join(tmp,'.env'));
 vi.stubEnv('OPENAI_API_KEY','test-editor-key');
});
afterEach(async()=>{
 vi.unstubAllEnvs();
 await fs.promises.rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});
});

function fixture(){
 return zipSync({
  'project.json':strToU8(JSON.stringify({
   app:'tempoloom-editor',v:1,project:{id:'browser',name:'Agent test',ratio:'16:9',
    tracks:[{id:'video',kind:'video',main:true},{id:'locked',kind:'text',locked:true}],
    clips:[{id:'first',track:'video',media:'media1',in:2,start:0,dur:8,speed:1},
           {id:'protected',track:'locked',text:'Keep me',start:0,dur:2}]},
   media:[{id:'media1',name:'test.mp4',mime:'video/mp4',type:'video',dur:14,w:1920,h:1080}],
   luts:[],
  })),
  'media/media1.mp4':strToU8('fixture bytes'),
 },{level:0});
}
const title={type:'addText',text:'بەخێربێن',start:0,duration:3,style:'lowerThird',animation:'slide'};
const motion={type:'addMotionTitle',name:'Welcome card',start:0,duration:3,layers:[
 {type:'box',x:0.5,y:0.5,w:0.7,h:0.3,fill:'#183154',anim:'wipe'},
 {type:'text',x:0.5,y:0.5,text:'Welcome',size:64,color:'#ffffff',anim:'up',delay:0.2},
]};

function useLocalModel(baseURL:string){
 const dir=path.join(tmp,'settings');
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({share:'local',local:[{id:'local-ollama',name:'Ollama',baseURL}]}));
}

it.skipIf(process.env.RUN_EDITOR_OLLAMA_TEST!=='1')('applies a validated Editor Agent edit through real Ollama',async()=>{
 const baseURL='http://127.0.0.1:11434';
 const model=process.env.TEMPOLOOM_OLLAMA_SMOKE_MODEL||'qwen2.5-coder:7b';
 if(/[:.-]cloud$/i.test(model))throw new Error('Choose an installed offline Ollama model');
 const listed=await fetch(baseURL+'/api/tags',{signal:AbortSignal.timeout(5000)});
 expect(listed.ok).toBe(true);
 const {models}=await listed.json() as {models:{name:string}[]};
 expect(models.map(item=>item.name)).toContain(model);
 useLocalModel(baseURL+'/v1');
 const {id}=editor.shareProject(fixture());
 const app=await serve({port:0});
 try{
  const response=await fetch('http://127.0.0.1:'+app.port+'/api/editor/model-jobs',{method:'POST',headers:{'x-teach-key':app.key},
   body:JSON.stringify({projectId:id,base:0,provider:'local-ollama',model,prompt:'Add one plain text clip reading Welcome at time 0 for 2 seconds. Use addText and make no other changes.'})});
  expect(response.status).toBe(202);
  const started=await response.json() as {id:string};
  await vi.waitFor(()=>expect(getEditorModelJob(started.id)).toMatchObject({state:'done',resultRevision:1}),{timeout:65_000,interval:400});
  expect(editor.inspectProject(id).project.clips).toContainEqual(expect.objectContaining({text:'Welcome',start:0,dur:2}));
 }finally{await app.close();}
},75_000);

it.skipIf(process.env.RUN_EDITOR_CODEX_TEST!=='1')('uses signed-in Codex to list an isolated Tempoloom project via MCP',async()=>{
 const marker='Synthetic MCP smoke '+randomUUID();
 const entries=unzipSync(fixture());
 const manifest=JSON.parse(strFromU8(entries['project.json']!));
 manifest.project.name=marker;
 entries['project.json']=strToU8(JSON.stringify(manifest));
 editor.shareProject(zipSync(entries,{level:0}));
 const execution=promisify(execFile)('codex',['exec','--ephemeral','--json','-s','read-only',
  '-c','mcp_servers.tempoloom.command="node"','-c','mcp_servers.tempoloom.args=["bin/tempoloom.mjs","mcp"]',
  '-c','mcp_servers.tempoloom.env_vars=["VIDEO_WORKSPACE"]',
  'Call the Tempoloom MCP editor_list tool exactly once and report the project name it returns. Use MCP only. Do not read or edit files.'],
  {timeout:85_000,windowsHide:true,maxBuffer:1024*1024});
 execution.child.stdin?.end();
 const {stdout}=await execution;
 const events=stdout.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
 const completed=events.find(event=>event.type==='item.completed'&&event.item?.type==='mcp_tool_call'&&
  event.item.server==='tempoloom'&&event.item.tool==='editor_list');
 expect(completed).toBeDefined();
 expect(JSON.stringify(completed)).toContain(marker);
},95_000);

it('versions shared media and atomic timeline edits across tools and previews',async()=>{
 const shared=editor.shareProject(fixture());
 const target={projectId:shared.id,base:0};
 expect(await callTool('editor_list',{})).toEqual([shared]);
 expect(()=>{
  editor.editProject(shared.id,0,[{type:'split',clipId:'first',at:3},{type:'remove',clipId:'protected'}]);
 }).toThrow(/locked/);
 expect(editor.inspectProject(shared.id).revision).toBe(0);
 const preview=unzipSync(editor.previewArchive(shared.id,0,[title]));
 expect(strFromU8(preview['media/media1.mp4']!)).toBe('fixture bytes');
 expect(JSON.parse(strFromU8(preview['project.json']!)).project.clips.at(-1)).toMatchObject({text:title.text,animIn:'slide'});
 expect(editor.inspectProject(shared.id).project.clips).toHaveLength(2);
 const applied=await callTool('editor_edit',{...target,edits:[{type:'split',clipId:'first',at:3},title]});
 expect(applied).toMatchObject({revision:1,project:{clips:[
  {id:'first',dur:3},{id:'protected'},{start:3,in:5,dur:5},{text:title.text,animIn:'slide'},
 ]}});
 await expect(callTool('editor_edit',{...target,edits:[title]})).rejects.toThrow(/revision 1/);
 expect(await callTool('editor_restore',{...target,base:1,restore:0})).toMatchObject({revision:2});
 expect(editor.inspectProject(shared.id).project.clips).toHaveLength(2);
 expect(JSON.parse(strFromU8(unzipSync(editor.downloadProject(shared.id,1))['project.json']!)).project.clips).toHaveLength(4);
});

it('discovers modern MCP and inspects the same persisted project',async()=>{
 const shared=editor.shareProject(fixture());
 const child=spawn(process.execPath,['--import','tsx','src/cli/mcp-cli.ts'],{env:process.env,stdio:['pipe','pipe','pipe']});
 const lines=readline.createInterface({input:child.stdout});
 const output=lines[Symbol.asyncIterator]();
 const ask=async(id:number,method:string,params:object)=>{
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  const result=await output.next();
  expect(result.done).toBe(false);
  if(result.done)throw new Error('MCP closed before replying');
  return JSON.parse(result.value);
 };
 const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}};
 try{
  expect(await ask(1,'server/discover',{_meta:meta})).toMatchObject({result:{supportedVersions:['2026-07-28'],_meta:{'io.modelcontextprotocol/serverInfo':{name:'tempoloom'}}}});
  const result=await ask(2,'tools/call',{_meta:meta,name:'editor_inspect',arguments:{projectId:shared.id}});
  expect(JSON.parse(result.result.content[0].text)).toMatchObject({id:shared.id,revision:0});
 }finally{lines.close();child.kill();}
},15_000);

it('negotiates durable MCP Tasks over stdio and keeps standard tool responses for other requests',async()=>{
 const shared=editor.shareProject(fixture());
 let hold=false,pending:ServerResponse|undefined;
 const provider=createServer((req,res)=>{
  req.resume();
  req.on('end',()=>{
   if(hold){pending=res;return;}
   res.setHeader('Content-Type','application/json');
   res.end(JSON.stringify({choices:[{message:{tool_calls:[{id:'call',function:{name:'propose_edits',
    arguments:JSON.stringify({summary:'Animated title',edits:[title]})}}]}}]}));
  });
 });
 provider.listen(0,'127.0.0.1');await once(provider,'listening');
 const address=provider.address();
 if(!address||typeof address==='string')throw new Error('No mock provider port');
 vi.stubEnv('TEMPOLOOM_OPENAI_URL','http://127.0.0.1:'+address.port);
 const child=spawn(process.execPath,['--import','tsx','src/cli/mcp-cli.ts'],{stdio:['pipe','pipe','pipe']});
 const lines=readline.createInterface({input:child.stdout}),output=lines[Symbol.asyncIterator]();
 const extension='io.modelcontextprotocol/tasks';let id=0;
 const ask=async(method:string,params:object,tasks=true)=>{
  const _meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28',
   'io.modelcontextprotocol/clientCapabilities':tasks?{extensions:{[extension]:{}}}:{}};
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:++id,method,params:{...params,_meta}})+'\n');
  const response=await output.next();if(response.done)throw new Error('MCP closed before replying');
  return JSON.parse(response.value);
 };
 try{
  expect(await ask('server/discover',{})).toMatchObject({result:{capabilities:{extensions:{[extension]:{}}}}});
  const args={projectId:shared.id,base:0,provider:'openai',model:'mock',prompt:'Add a title'};
  const handle=await ask('tools/call',{name:'editor_model_job_start',arguments:args});
  expect(handle).toMatchObject({result:{resultType:'task',status:'working',ttlMs:null}});
  const taskId=String(handle.result.taskId);
  expect(await ask('tasks/get',{taskId},false)).toMatchObject({error:{code:-32021}});
  expect(await ask('tasks/get',{taskId:'not-a-task'})).toMatchObject({error:{code:-32602}});
  await vi.waitFor(async()=>expect(await ask('tasks/get',{taskId})).toMatchObject({result:{resultType:'complete',status:'completed',result:{content:[{type:'text'}]}}}),
   {timeout:8000,interval:100});
  expect(editor.sharedProjectHead(shared.id).revision).toBe(1);
  expect(await ask('tasks/update',{taskId,inputResponses:{}})).toMatchObject({result:{resultType:'complete'}});
  expect(await ask('tasks/cancel',{taskId})).toMatchObject({result:{resultType:'complete'}});
  expect(await ask('tools/call',{name:'editor_model_job_status',arguments:{jobId:taskId.split(':')[1]}},false))
   .toMatchObject({result:{resultType:'complete',content:[{type:'text'}]}});
  hold=true;
  const ordinary=await ask('tools/call',{name:'editor_model_job_start',arguments:{...args,base:1}},false);
  expect(ordinary).toMatchObject({result:{resultType:'complete',content:[{type:'text'}]}});
  const ordinaryTaskId='model:'+JSON.parse(ordinary.result.content[0].text).id;
  const waiting=await vi.waitFor(()=>{expect(pending).toBeDefined();return pending!;},{timeout:8000,interval:100});
  const closed=once(waiting,'close');
  expect(await ask('tasks/cancel',{taskId:ordinaryTaskId})).toMatchObject({result:{resultType:'complete'}});
  await closed;
  expect(await ask('tasks/get',{taskId:ordinaryTaskId})).toMatchObject({result:{status:'cancelled'}});
  expect(editor.sharedProjectHead(shared.id).revision).toBe(1);
 }finally{
  lines.close();child.kill();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));
 }
},20_000);

it('validates provider plans without committing them and rejects stale API edits',async()=>{
 const fetcher:typeof fetch=async()=>Response.json({choices:[{message:{tool_calls:[{id:'call',function:{name:'propose_edits',
  arguments:JSON.stringify({summary:'Animated title',edits:[title]})}}]}}]});
 const server=await serve({port:0,fetcher});
 try{
  const base='http://127.0.0.1:'+server.port+'/api/editor/shared';
  const headers={'x-teach-key':server.key};
  const response=await fetch(base,{method:'POST',headers,body:Buffer.from(fixture())});
  expect(response.status).toBe(201);
  const shared=await response.json() as {id:string};
  const url=base+'/'+shared.id;
  const post=(route:string,body:object)=>fetch(url+route,{headers,method:'POST',body:JSON.stringify(body)});
  const proposal=await post('/propose',{provider:'openai',model:'mock',prompt:'Add an animated opening title'});
  const result=await proposal.json();
  expect(result).toMatchObject({base:0,edits:[title]});
  expect(editor.inspectProject(shared.id).revision).toBe(0);
  expect((await post('/edit',result)).status).toBe(200);
  expect((await post('/edit',result)).status).toBe(409);
  expect((await fetch(url)).status).toBe(403);
 }finally{server.close();}
});

it('plans a product reveal that can be previewed and edited as separate timeline layers',async()=>{
 const shared=editor.shareProject(fixture());
 const input={projectId:shared.id,revision:0,mediaId:'media1',title:'بەرهەمی نوێ',start:2,sourceStart:1,seconds:5};
 const app=await serve({port:0});
 try{
  const url='http://127.0.0.1:'+app.port+'/api/editor/product-reveal';
  const response=await fetch(url,{method:'POST',headers:{'x-teach-key':app.key},body:JSON.stringify(input)});
  expect(response.status).toBe(200);
  const proposal=await response.json();
  expect(proposal).toEqual(await callTool('editor_plan_product_reveal',input));
  expect(editor.sharedProjectHead(shared.id).revision).toBe(0);
  await expect(callTool('editor_plan_product_reveal',{...input,seconds:14})).rejects.toThrow(/covering its duration/);
  await expect(callTool('editor_plan_product_reveal',{...input,move:'push'})).resolves.toMatchObject({edits:[{scenes:[{
   visual:{keyframes:[{at:0,scale:0.42},{at:1,scale:0.57}]},
  }]}]});

  const preview=unzipSync(editor.previewArchive(shared.id,0,proposal.edits));
  const nest=JSON.parse(strFromU8(preview['project.json']!)).project.clips.at(-1).nest;
  expect(nest.tracks.map((track:{id:string})=>track.id)).toEqual(['titles','under-titles','backdrops','video']);
  expect(nest.clips).toMatchObject([
   {title:{layers:[{text:input.title}]}},
   {title:{layers:[{type:'box',x:0.5,y:0.5,w:1,h:1,fill:'#141C2A'}]}},
   {media:'media1',in:1,muted:true,kf:{opacity:[{t:0,v:0,e:'out'},{t:1.3,v:1,e:'smooth'}]}},
  ]);

  const applied=editor.editProject(shared.id,0,proposal.edits);
  const composition=applied.project.clips.at(-1)!;
  const [heading,,visual]=(composition.nest as {clips:{id:string}[]}).clips;
  const within=[composition.id];
  const revised=editor.editProject(shared.id,1,[
   {type:'replaceTitle',within,clipId:heading!.id,name:'New title',layers:[{type:'text',text:'Updated',x:0.5,y:0.8,size:50,color:'#ffffff'}]},
   {type:'keyframe',within,clipId:visual!.id,key:'scale',at:5,value:0.62},
  ]);
  expect(revised.project.clips.at(-1)?.nest).toMatchObject({clips:[{title:{layers:[{text:'Updated'}]}},{track:'backdrops'},
   {kf:{scale:expect.arrayContaining([{t:5,v:0.62}])}}]});
  const reopened=unzipSync(editor.downloadProject(shared.id,2));
  expect(strFromU8(reopened['media/media1.mp4']!)).toBe('fixture bytes');
  expect(JSON.parse(strFromU8(reopened['project.json']!)).project.clips.at(-1).nest).toEqual(revised.project.clips.at(-1)?.nest);
 }finally{await app.close();}
});

it('keeps editable device mockup screens fitted and aligned with the frame during motion',async()=>{
 const shared=editor.shareProject(fixture());
 const input={projectId:shared.id,revision:0,mediaId:'media1',device:'phone',fit:'cover',start:1,seconds:5};
 const app=await serve({port:0});
 try{
  const url='http://127.0.0.1:'+app.port+'/api/editor/device-mockup';
  const response=await fetch(url,{method:'POST',headers:{'x-teach-key':app.key},body:JSON.stringify(input)});
  expect(response.status).toBe(200);
  const proposal=await response.json();
  expect(proposal).toEqual(await callTool('editor_plan_device_mockup',input));
  expect(editor.sharedProjectHead(shared.id).revision).toBe(0);
  const variant=await callTool('editor_plan_device_mockup',{...input,device:'laptop',move:'float',fit:'contain'});
  expect(variant).toMatchObject({edits:[{name:'Laptop mockup',scenes:[{layers:[{type:'box'},{type:'box'},{type:'box'}],
   keyframes:[{at:0},{at:0.5,y:-0.022},{at:1}]}]}]});
  await expect(callTool('editor_plan_device_mockup',{...input,sourceStart:10})).rejects.toThrow(/covering its duration/);

  const applied=editor.editProject(shared.id,0,proposal.edits);
  const mockup=applied.project.clips.at(-1)!;
  expect(mockup).toMatchObject({start:1,dur:5,nest:{name:'Phone mockup'}});
  type Curve={t:number;v:number;e:string}[];
  type MotionClip={kf:{x:Curve;opacity:Curve;scale:Curve}};
  const {tracks,clips:[frame,backdrop,screen]}=mockup.nest as {tracks:{id:string}[];
   clips:[MotionClip,{id:string},MotionClip&{crop:{l:number;r:number}}]};
  expect(tracks.map(track=>track.id)).toEqual(['visuals','titles','backdrops','video']);
  expect(backdrop).toMatchObject({track:'backdrops',title:{name:'Backdrop'}});
  expect(screen).toMatchObject({media:'media1',crop:{l:expect.any(Number),r:expect.any(Number),t:0,b:0},muted:true});
  expect(1920*(1-screen.crop.l-screen.crop.r)/1080).toBeCloseTo(9/19.5);
  expect(screen.kf.x).toEqual(frame.kf.x);
  expect(screen.kf.opacity).toEqual(frame.kf.opacity);
  expect(screen.kf.scale[0]!.v/frame.kf.scale[0]!.v).toBeCloseTo(screen.kf.scale[1]!.v/frame.kf.scale[1]!.v);

  const changed=editor.editProject(shared.id,1,[{type:'transform',within:[mockup.id],clipId:backdrop.id,opacity:0.6}]);
  const reopened=unzipSync(editor.downloadProject(shared.id,2));
  expect(JSON.parse(strFromU8(reopened['project.json']!)).project.clips.at(-1).nest).toEqual(changed.project.clips.at(-1)?.nest);
  await expect(callTool('editor_plan_device_mockup',input)).rejects.toThrow(/revision 2/);
 }finally{await app.close();}
});

it('plans a local route map with editable geography, pins, and labels',async()=>{
 const {id}=editor.shareProject(fixture());
 const input={projectId:id,revision:0,places:['Erbil','Slemani','Duhok'],seconds:6,start:2};
 const result=await callTool('editor_plan_route_map',input) as {edits:unknown};
 await expect(callTool('editor_plan_route_map',{...input,places:['Erbil','Hawler']})).rejects.toThrow(/different locations/);
 await expect(callTool('editor_plan_route_map',{...input,places:['Erbil','Made-up place']})).rejects.toThrow(/Made-up place@LATITUDE,LONGITUDE/);
 const preview=editor.previewEdit(id,0,result.edits);
 const nest=preview.project.clips.at(-1)?.nest;
 expect(nest).toMatchObject({name:'Route map',clips:[{title:{layers:[
  {type:'path',name:'Land and borders',d:expect.stringMatching(/^M/)},
  {type:'path',name:'Route line',d:expect.stringMatching(/^M[^L]+L[^L]+L[^L]+$/)},
  {type:'box',delay:0},{type:'text',text:'Erbil',delay:0},
  {type:'box',delay:1.56},{type:'text',text:'Slemani',delay:1.56},
  {type:'box',delay:3.12},{type:'text',text:'Duhok',delay:3.12},
 ]}},{title:{name:'Backdrop'}}]});
 expect(editor.sharedProjectHead(id).revision).toBe(0);
 expect(editor.editProject(id,0,result.edits).project.clips.at(-1)).toMatchObject({start:2,dur:6});
});

it('imports an OBJ mesh through the authenticated editor API and preserves editable geometry',async()=>{
 const {id}=editor.shareProject(fixture());
 const input={name:'Pyramid',obj:'mtllib ignored.mtl\nv -1 0 -1\nv 1 0 -1\nv 1 0 1\nv -1 0 1\nv 0 2 0\nf -5 -4 -3 -2\nf 2/4/1 3/5/1 5/1/1'};
 const app=await serve({port:0});
 try{
  const url='http://127.0.0.1:'+app.port+'/api/editor/obj';
  const response=await fetch(url,{method:'POST',headers:{'x-teach-key':app.key},body:JSON.stringify(input)});
  expect(response.status).toBe(200);
  const mesh=await response.json();
  expect(mesh).toEqual(await callTool('editor_parse_obj',input));
  expect(mesh).toMatchObject({name:'Pyramid',type:'mesh',triangles:[[0,1,2],[0,2,3],[1,2,4]]});
  await expect(callTool('editor_parse_obj',{...input,obj:input.obj+'\nf 1 2 99'})).rejects.toThrow(/Invalid OBJ f/);
  const clip=editor.editProject(id,0,[{type:'addSticker',sticker:mesh,start:1,duration:3}]).project.clips.at(-1)!;
  const edited=editor.editProject(id,1,[{type:'keyframe',clipId:clip.id,key:'tiltY',at:1,value:90}]);
  expect(edited.project.clips.at(-1)).toMatchObject({sticker:mesh,depth3d:1,kf:{tiltY:[{t:1,v:90}]}});
  expect(JSON.parse(strFromU8(unzipSync(editor.downloadProject(id,2))['project.json']!)).project.clips.at(-1)?.sticker).toEqual(mesh);
 }finally{await app.close();}
});

it('makes consecutive editable kinetic phrases without splitting RTL text',async()=>{
 const {id}=editor.shareProject(fixture());
 const phrases=['سڵاو، چۆنی؟','A second phrase'];
 const result=await callTool('editor_plan_kinetic_titles',{projectId:id,revision:0,phrases,start:3,seconds:4}) as {edits:unknown};
 expect(editor.sharedProjectHead(id).revision).toBe(0);
 const timeline=editor.editProject(id,0,result.edits);
 expect(timeline.project.clips.at(-1)).toMatchObject({start:3,dur:4,nest:{clips:[
  {start:0,dur:2,title:{layers:[{text:phrases[0]}]}},{start:2,dur:2,title:{layers:[{text:phrases[1]}]}},
  {track:'backdrops'},{track:'backdrops'},
 ]}});
});

it('creates and keyframes editable 3D geometry through agent operations',async()=>{
 const {id}=editor.shareProject(fixture());
 const box=editor.editProject(id,0,[{type:'addSticker',sticker:{type:'shape',id:'cuboid'},start:1,duration:3,color:'#00AAFF'}]).project.clips.at(-1)!;
 const posed=editor.editProject(id,1,[{type:'transform',clipId:box.id,tiltX:-10,depth3d:.75}]);
 expect(posed.project.clips.at(-1)).toMatchObject({sticker:{id:'cuboid'},tiltX:-10,depth3d:.75});
 const animated=editor.editProject(id,2,[{type:'keyframe',clipId:box.id,key:'tiltY',at:0,value:25},
  {type:'keyframe',clipId:box.id,key:'tiltY',at:3,value:100}]);
 expect(animated.project.clips.at(-1)).toMatchObject({kf:{tiltY:[{t:0,v:25},{t:3,v:100}]}});
 expect(()=>editor.editProject(id,3,[{type:'keyframe',clipId:'first',key:'tiltY',at:0,value:0}])).toThrow(/3D box/);
});

it('persists detached local model jobs, preserves intervening edits, and cancels provider work',async()=>{
 const replies:ServerResponse[]=[];
 const provider=createServer((req,res)=>{
  req.on('end',()=>{
   if(req.url==='/v1/chat/completions')replies.push(res);
   else{res.statusCode=404;res.end();}
  });
  req.resume();
 });
 provider.listen(0,'127.0.0.1');
 await once(provider,'listening');
 const address=provider.address();
 if(!address||typeof address==='string')throw new Error('No mock provider port');
 useLocalModel('http://127.0.0.1:'+address.port+'/v1');
 const shared=editor.shareProject(fixture());
 const app=await serve({port:0});
 const url='http://127.0.0.1:'+app.port+'/api/editor/model-jobs';
 const headers={'x-teach-key':app.key};
 const input={projectId:shared.id,base:0,provider:'local-ollama',model:'mock',prompt:'Add an animated title'};
 const wait={timeout:10_000,interval:50};
 const respond=(res:ServerResponse)=>{
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({choices:[{message:{tool_calls:[{id:'call',function:{name:'propose_edits',
   arguments:JSON.stringify({summary:'Animated title',edits:[title]})}}]}}]}));
 };
 try{
  await expect(callTool('editor_model_job_start',{...input,provider:'openai'})).rejects.toThrow(/only local model servers/);
  const started=await fetch(url,{method:'POST',headers,body:JSON.stringify(input)});
  expect(started.status).toBe(202);
  const first=await started.json() as {id:string};
  expect(first).not.toHaveProperty('request');
  expect((await fetch(url+'?projectId='+shared.id,{headers})).status).toBe(200);
  await app.close();
  respond(await vi.waitFor(()=>{expect(replies).toHaveLength(1);return replies[0]!;},wait));
  await vi.waitFor(()=>expect(getEditorModelJob(first.id)).toMatchObject({state:'done',resultRevision:1}),wait);
  expect(editor.inspectProject(shared.id).project.clips).toHaveLength(3);

  const second=await callTool('editor_model_job_start',{...input,base:1}) as {id:string};
  const pending=await vi.waitFor(()=>{expect(replies).toHaveLength(2);return replies[1]!;},wait);
  await expect(callTool('editor_model_job_start',{...input,base:1})).rejects.toThrow(/already active/);
  editor.editProject(shared.id,1,[{...title,text:'Manual edit'}]);
  respond(pending);
  await vi.waitFor(async()=>expect(await callTool('editor_model_job_status',{jobId:second.id})).toMatchObject({state:'failed',resultRevision:null}),wait);
  expect(editor.inspectProject(shared.id)).toMatchObject({revision:2,project:{clips:expect.arrayContaining([expect.objectContaining({text:'Manual edit'})])}});

  const third=await callTool('editor_model_job_start',{...input,base:2}) as {id:string};
  const waiting=await vi.waitFor(()=>{expect(replies).toHaveLength(3);return replies[2]!;},wait);
  const closed=once(waiting,'close');
  expect(await callTool('editor_model_job_cancel',{jobId:third.id})).toMatchObject({state:'cancelled'});
  await closed;
  expect(getEditorModelJob(third.id)).toMatchObject({state:'cancelled',resultRevision:null});
  expect(editor.inspectProject(shared.id).revision).toBe(2);
 }finally{
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>(resolve=>provider.close(()=>resolve()));
 }
},35_000);

it('uses structured JSON when an OpenAI-compatible model declines tool calling',async()=>{
 const shared=editor.shareProject(fixture());
 const {proposeEditorEdit}=await import('../src/editor/editor-agent.js');
 const requests:Record<string,unknown>[]=[];
 const fetcher:typeof fetch=async(_url,init)=>{
  const request=JSON.parse(String(init?.body)) as Record<string,unknown>;
  requests.push(request);
  if(request.tools)return new Response('Tool calling is not supported', {status:400});
  return Response.json({choices:[{message:{content:JSON.stringify({summary:'A layered title',edits:[motion]})}}]});
 };
 const result=await proposeEditorEdit(shared.id,{provider:'openai',model:'text-only',prompt:'Create an opening card'},{fetch:fetcher});
 expect(requests).toHaveLength(2);
 expect(requests[1]).not.toHaveProperty('tools');
 expect(result.edits).toEqual([motion]);
 expect(editor.inspectProject(shared.id).revision).toBe(0);
});

it('probes a model using synthetic inputs and applies only a validated pinned revision',async()=>{
 const {probeEditorModel,runEditorModel}=await import('../src/editor/editor-agent.js');
 const model={provider:'openai',model:'mock'},shared=editor.shareProject(fixture());
 const probe:typeof fetch=async(_url,init)=>{
  const payload=String(init?.body);
  expect(payload).not.toContain('Agent test');
  if(payload.includes('report_check'))return Response.json({choices:[{message:{tool_calls:[
   {id:'1',function:{name:'report_check',arguments:'{"status":"ready"}'}},
  ]}}]});
  expect(payload).toContain('image/png');
  return Response.json({choices:[{message:{content:'Red.'}}]});
 };
 expect(await probeEditorModel(model,{fetch:probe})).toMatchObject({tools:{verified:true},vision:{verified:true}});
 const input={...model,projectId:shared.id,base:0,prompt:'Add an opening title'};
 const fetcher:typeof fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({summary:'Title',edits:[title]})}}]});
 await expect(runEditorModel(input,{fetch:fetcher})).resolves.toMatchObject({revision:1,summary:'Title'});
 await expect(runEditorModel(input,{fetch:fetcher})).rejects.toThrow(/revision changed/i);
 expect(editor.inspectProject(shared.id).revision).toBe(1);
 const controller=new AbortController();
 const aborting:typeof fetch=async(url,init)=>{
  controller.abort();
  return fetcher(url,init);
 };
 await expect(runEditorModel({...input,base:1},{fetch:aborting,signal:controller.signal})).rejects.toThrow(/abort/i);
 expect(editor.inspectProject(shared.id).revision).toBe(1);
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('shares an editor project and reopens an editable motion layer in Chromium',async()=>{
 const {ffmpeg,run}=await import('../src/renderer/ffmpeg-encoder.js');
 const {mediaInfo}=await import('../src/editor/editor.js');
 const footage=path.join(tmp,'footage.mp4');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=white:s=320x240:r=24:d=3',
  '-c:v','libx264','-pix_fmt','yuv420p',footage]);
 const server=await serve({port:0}),browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true});
 try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.port+'/?k='+server.key+'#/editor');
  await page.getByRole('button',{name:'New project'}).click();
  await page.locator('.editor > input[type=file]').setInputFiles(footage);
  await page.waitForFunction(()=>Ed.media.some((m:{name:string;dur:number})=>m.name==='footage.mp4'&&m.dur>0));
  await page.evaluate(()=>Ed.add(Ed.media.find((m:{name:string})=>m.name==='footage.mp4').id));
  await page.getByRole('button',{name:'Agent',exact:true}).click();
  await page.getByRole('button',{name:'Share current project copy'}).click();
  await page.getByText('Shared with agents. The original project is available in the Editor.').waitFor();
  const [shared]=editor.listProjects();
  await callTool('editor_edit',{projectId:shared!.id,base:0,edits:[title,motion]});
  await page.getByRole('button',{name:'Load into current timeline'}).click();
  const layer=page.locator('.ed-clip').filter({hasText:motion.name});
  await layer.waitFor();
  await layer.click();
  await page.locator('[data-title-ed]').click();
  await page.getByRole('textbox',{name:'Name',exact:true}).fill('Edited card');
  await page.getByRole('button',{name:'Save title'}).click();
  await page.locator('.ed-clip').filter({hasText:'Edited card'}).waitFor();
  const download=page.waitForEvent('download');
  await page.evaluate(()=>Ed.exportVideo({name:'motion-handoff',height:240,fps:24,format:'mp4',quality:'standard'}));
  const exported=path.join(tmp,'motion-handoff.mp4');
  await (await download).saveAs(exported);
  expect((await mediaInfo(exported)).duration).toBeCloseTo(3,1);
  const undo=page.locator('.ed-tl').getByRole('button',{name:/^Undo/});
  await undo.click();
  await layer.waitFor();
  await undo.click();
  await layer.waitFor({state:'detached'});
 }finally{await browser.close();server.close();}
},45_000);
