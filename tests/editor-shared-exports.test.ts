import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {strToU8,zipSync} from 'fflate';
import {editProject,inspectProject,listProjects,shareProject} from '../src/editor/shared-projects.js';
import {cancelEditorExport,getEditorExport,listEditorExports,startEditorExport} from '../src/editor/shared-exports.js';
import {setSharedCover} from '../src/editor/shared-cover.js';
import {planDeviceMockup,planKineticTitle,planProductReveal,planRouteMap} from '../src/editor/shared-motion.js';
import {parseObjMesh} from '../src/editor/obj-mesh.js';

let directory:string;
beforeEach(()=>{
 directory=fs.mkdtempSync(path.join(os.tmpdir(),'tempoloom-export-'));
 vi.stubEnv('VIDEO_WORKSPACE',directory);
 vi.stubEnv('TEMPOLOOM_SETTINGS_DIR',path.join(directory,'settings'));
 vi.stubEnv('TEMPOLOOM_ENV_FILE',path.join(directory,'.env'));
});
afterEach(()=>{vi.unstubAllEnvs();fs.rmSync(directory,{recursive:true,force:true});});

function share(footage?:Buffer,visual?:Buffer){
 return shareProject(zipSync({
  'project.json':strToU8(JSON.stringify({app:'tempoloom-editor',v:1,
   project:{id:'local',name:'Test',ratio:'16:9',tracks:[{id:'video',kind:'video',main:true}],
    clips:footage?[{id:'clip',track:'video',start:0,dur:1,media:'footage'}]:[]},
   media:[...(footage?[{id:'footage',name:'footage.mp4',mime:'video/mp4',type:'video',dur:1}]:[]),
    ...(visual?[{id:'visual',name:'visual.png',mime:'image/png',type:'image',w:64,h:64}]:[])],luts:[],
  })),
  ...(footage?{'media/footage.mp4':footage}:{}),
  ...(visual?{'media/visual.png':visual}:{}),
 },{level:0})).id;
}
async function finished(id:string,timeout=5000){
 const until=Date.now()+timeout;
 for(;;){
  const state=getEditorExport(id);
  if(state.state!=='running'||Date.now()>=until)return state;
  await delay(50);
 }
}

it('muxes real editor frame and audio streams into a playable MP4 over loopback',async()=>{
 const {ffmpeg,run,probe}=await import('../src/renderer/ffmpeg-encoder.js');
 const {serve}=await import('../src/teach/server.js');
 const video=path.join(directory,'test.ivf'),audio=path.join(directory,'test.wav');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=red:s=64x64:r=24:d=1','-c:v','libvpx','-threads','1','-f','ivf',video]);
 await run(ffmpeg,['-v','error','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','1','-c:a','pcm_s16le',audio]);
 const frames=fs.readFileSync(video),server=await serve({port:0,renderOnly:true});
 try{
  const url=new URL('/api/editor/mux?format=mp4&fps=24&v='+frames.length,server.url);
  const response=await fetch(url,{method:'POST',headers:{'x-teach-key':server.key},body:Buffer.concat([frames,fs.readFileSync(audio)])});
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('video/mp4');
  const output=path.join(directory,'test.mp4');fs.writeFileSync(output,Buffer.from(await response.arrayBuffer()));
  expect((await probe(output)).streams).toEqual(expect.arrayContaining([
   expect.objectContaining({codec_name:'h264',width:64,height:64,avg_frame_rate:'24/1'}),
   expect.objectContaining({codec_name:'aac'}),
  ]));
  const pixel=path.join(directory,'decoded.rgb');
  await run(ffmpeg,['-v','error','-i',output,'-vf','format=rgb24,crop=2:2:30:30','-frames:v','1','-threads','1','-f','rawvideo',pixel]);
  const [red,green,blue]=fs.readFileSync(pixel);expect(red).toBeGreaterThan(200);expect(green).toBeLessThan(40);expect(blue).toBeLessThan(40);
 }finally{await server.close();}
});

it('pins a revision, persists progress and publishes the finished output once',async()=>{
 const projectId=share();
 expect(()=>startEditorExport({projectId,revision:1})).toThrow(/revision not found/i);
 const job=startEditorExport({projectId,revision:0},async(request,file,_signal,progress)=>{
  expect(request).toMatchObject({revision:0,format:'mp4'});
  progress('Encoding');
  await delay(75);
  fs.writeFileSync(file,'fake render');
 });
 expect(getEditorExport(job.id).message).toBe('Encoding');
 expect(()=>startEditorExport({projectId,revision:0})).toThrow(/already running/);
 const done=await finished(job.id);
 expect(done.state,done.message).toBe('done');
 expect(fs.readFileSync(done.file!,'utf8')).toBe('fake render');
 expect(cancelEditorExport(job.id).state).toBe('done');
 expect(listEditorExports(projectId)).toEqual([done]);
});

it('cancels running work and keeps failures from publishing incomplete files',async()=>{
 const projectId=share();
 let output='',aborted=false;
 const job=startEditorExport({projectId,revision:0},async(_request,file,signal)=>{
  output=file;fs.writeFileSync(file,'partial data');
  await new Promise<void>(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true}));
 });
 expect(cancelEditorExport(job.id).state).toBe('cancelled');
 await vi.waitFor(()=>{expect(aborted).toBe(true);expect(fs.existsSync(output)).toBe(false);},{timeout:3000});
 expect(getEditorExport(job.id).file).toBeUndefined();
 const failure=startEditorExport({projectId,revision:0},async()=>{throw new Error('Decode failed');});
 expect(await finished(failure.id)).toMatchObject({state:'failed',message:'Decode failed'});
});

it.skipIf(process.env.RUN_EDITOR_EXPORT_TEST!=='1')('exports an editable animated title over footage to MP4 over loopback only',async()=>{
 const {ffmpeg,run,probe}=await import('../src/renderer/ffmpeg-encoder.js');
 const {mediaInfo}=await import('../src/editor/editor.js');
 const source=path.join(directory,'footage.mp4');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=white:s=320x240:r=24:d=1','-c:v','libx264','-pix_fmt','yuv420p',source]);
 const visual=path.join(directory,'visual.png');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=red:s=64x64:d=0.1','-frames:v','1','-threads','1',visual]);
 const projectId=share(fs.readFileSync(source),fs.readFileSync(visual));
 editProject(projectId,0,[{type:'addMotionComposition',name:'Opener',start:0,scenes:[{name:'Welcome',start:0,duration:1,layers:[
  {type:'box',x:0.5,y:0.5,w:0.7,h:0.3,fill:'#183154',anim:'fade'},
  {type:'text',x:0.5,y:0.5,text:'Welcome',size:64,color:'#ffffff',anim:'up',delay:0.2},
 ],visual:{mediaId:'visual'}}]}]);
 const child=spawn(process.execPath,['--import','tsx','src/cli/mcp-cli.ts'],{stdio:['pipe','pipe','pipe']});
 const lines=readline.createInterface({input:child.stdout}),output=lines[Symbol.asyncIterator]();
 let stderr='';
 child.stderr.on('data',data=>{stderr=(stderr+String(data)).slice(-4000);});
 const _meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}};
 const ask=async(id:number,method:string,params:object)=>{
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params:{...params,_meta}})+'\n');
  const response=await output.next();
  if(response.done)throw new Error('MCP stopped before responding: '+stderr);
  return JSON.parse(response.value);
 };
 try{
  expect(await ask(1,'server/discover',{})).toMatchObject({result:{capabilities:{tools:{}}}});
  const created=await ask(2,'tools/call',{name:'editor_export_start',arguments:{projectId,revision:1,height:240,fps:24}});
  expect(created).toMatchObject({result:{content:[{type:'text',text:expect.any(String)}]}});
  const taskId=String(JSON.parse(created.result.content[0].text).id);
  lines.close();child.kill();
  const result=await finished(taskId,36_000);
  expect(result,result.message).toMatchObject({state:'done'});
  const media=await mediaInfo(result.file!);
  expect(media.duration).toBeCloseTo(1,1);
  expect(media.height).toBe(240);
  const pixel=path.join(directory,'pixel.rgb');
  await run(ffmpeg,['-v','error','-ss','0.8','-i',result.file!,'-vf','crop=2:2:100:100,format=rgb24','-frames:v','1','-f','rawvideo',pixel]);
  const [red,green,blue]=fs.readFileSync(pixel);
  expect(red).toBeLessThan(65);
  expect(blue).toBeGreaterThan(green!+12);
  const side=path.join(directory,'visual.rgb');
  await run(ffmpeg,['-v','error','-ss','0.8','-i',result.file!,'-vf','crop=2:2:336:120,format=rgb24','-frames:v','1','-f','rawvideo',side]);
  const [imageRed,imageGreen,imageBlue]=fs.readFileSync(side);
  expect(imageRed).toBeGreaterThan(190);expect(imageGreen).toBeLessThan(50);expect(imageBlue).toBeLessThan(50);
  for(const [format,codec] of [['webm','opus'],['gif','gif'],['mp3','mp3'],['wav','pcm_s16le']] as const){
   const job=startEditorExport({projectId,revision:1,height:240,fps:24,format});
   const output=await finished(job.id,10_000);
   expect(output,output.message).toMatchObject({state:'done'});
   expect((await probe(output.file!)).streams).toContainEqual(expect.objectContaining({codec_name:codec}));
  }
 }finally{lines.close();child.kill();}
},50_000);

it.skipIf(process.env.RUN_EDITOR_EXPORT_TEST!=='1')('renders live preset frames and exports editable motion and 3D geometry',async()=>{
 const {ffmpeg,run,probe}=await import('../src/renderer/ffmpeg-encoder.js');
 const {captureSharedFrame}=await import('../src/editor/shared-exports.js');
 const visual=path.join(directory,'visual.png');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=red:s=64x64','-frames:v','1','-threads','1',visual]);
 const projectId=share(undefined,fs.readFileSync(visual));
 const input={projectId,revision:0,mediaId:'visual',seconds:1};
 const product=planProductReveal({...input,title:'Preview'}),device=planDeviceMockup({...input,start:1,fit:'cover'});
 const route=await planRouteMap({projectId,revision:0,start:3,seconds:1,places:['West@0,-1','East@0,1'],accent:'#0022EE'});
 const mesh=parseObjMesh({name:'Test mesh',obj:'v -1 -1 0\nv 1 -1 0\nv 1 1 0\nv -1 1 0\nf 1 2 3 4'});
 const kinetic=await planKineticTitle({projectId,revision:0,start:5,seconds:1,phrases:['Welcome'],backdrop:'#093519'});
 editProject(projectId,0,[...product.edits,...device.edits,
  {type:'addSticker',sticker:{type:'shape',id:'cuboid'},color:'#00ee28',start:2,duration:1},...route.edits,
  {type:'addSticker',sticker:mesh,color:'#FF1200',start:4,duration:1},...kinetic.edits]);
 const assertFrame=async(file:string,time:number,label:string,channel:number|null)=>{
  const pixel=path.join(directory,label+'.rgb');
  await run(ffmpeg,['-v','error',...(time?['-ss',String(time)]:[]),'-i',file,
   '-vf',channel===null?'crop=iw/2:ih/3:iw/4:ih/3,format=rgb24':'format=rgb24,crop=16:8:(iw-16)/2:(ih-8)/2',
   '-frames:v','1','-threads','1','-f','rawvideo',pixel]);
  const bytes=fs.readFileSync(pixel);
  const colors=Array.from({length:bytes.length/3},(_,i)=>[bytes[i*3]!,bytes[i*3+1]!,bytes[i*3+2]!]);
  if(channel===null){
   expect(colors.some(rgb=>rgb.every(value=>value>175)),label+' text').toBe(true);
   expect(colors.some(([red,green,blue])=>green!>red!+22&&green!>blue!+14),label+' backdrop').toBe(true);
  }else{
   expect(colors.some(rgb=>rgb[channel]!>(channel===2?80:135)&&rgb.every((value,i)=>i===channel||value<rgb[channel]!-30)),label).toBe(true);
  }
 };
 const frames=[[0.8,'product',0],[1.8,'device',0],[2.8,'box',1],[3.8,'route',2],[4.8,'obj',0],[5.8,'kinetic',null]] as const;
 for(const [at,label,channel] of frames){
  const frame=await captureSharedFrame({projectId,revision:1},at);
  const file=path.join(directory,label+'.jpg');
  fs.writeFileSync(file,Buffer.from(frame.split(',')[1]!,'base64'));
  await assertFrame(file,0,label+'-preview',channel);
 }
 const job=startEditorExport({projectId,revision:1,height:240,fps:24});
 const result=await finished(job.id,28_000);
 expect(result,result.message).toMatchObject({state:'done'});
 expect((await probe(result.file!)).streams).toContainEqual(expect.objectContaining({height:240}));
 for(const [at,label,channel] of frames)await assertFrame(result.file!,at,label+'-export',channel);
},75_000);

it.skipIf(process.env.RUN_EDITOR_EXPORT_TEST!=='1')('syncs a linked timeline in Chromium without replacing unpublished browser edits',async()=>{
 const {chromium}=await import('playwright');
 const {chromiumExecutable}=await import('../src/renderer/browser-path.js');
 const {serve}=await import('../src/teach/server.js');
 const server=await serve({port:0});
 try{
  const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable(),args:[
   '--disable-background-networking','--disable-component-update','--no-proxy-server',
   '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
  ]});
  try{
   const context=await browser.newContext({serviceWorkers:'block'}),origin=new URL(server.url).origin;
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage();
   await page.goto(server.url+'#/editor');
   await page.getByRole('button',{name:'New project'}).click({timeout:8000});
   await page.locator('.editor > input[type=file]').setInputFiles({
    name:'sample.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=','base64'),
   });
   await page.getByText('sample.png',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Agent',exact:true}).click();
   await page.getByRole('button',{name:'Share current project copy'}).click();
   await page.getByText('Shared with agents. The original project is available in the Editor.').waitFor();
   await page.getByRole('combobox',{name:/^Media to share/}).click();
   await page.getByRole('option',{name:'sample.png',exact:true}).click();
   await page.getByRole('button',{name:'Share selected media'}).click();
   await page.getByText('Media shared with agents. The timeline stayed the same.').waitFor();
   await page.getByRole('button',{name:'Close dialog'}).click();
   const project=listProjects()[0]!;
   expect(project.revision).toBe(1);
   editProject(project.id,1,[{type:'addText',start:0,duration:2,text:'Agent revision'}]);
   await page.locator('.ed-clip').filter({hasText:'Agent revision'}).waitFor({timeout:8000});
   await page.getByRole('textbox',{name:'Project name'}).fill('Unpublished name');
   await page.locator('.ed-tl').click({position:{x:5,y:5}});
   editProject(project.id,2,[{type:'addText',start:2,duration:2,text:'Second agent revision'}]);
   await page.getByText('Sync paused · local changes').waitFor({state:'attached',timeout:8000});
   expect(await page.getByRole('textbox',{name:'Project name'}).inputValue()).toBe('Unpublished name');
   expect(await page.locator('.ed-clip').filter({hasText:'Second agent revision'}).count()).toBe(0);
   await page.getByRole('button',{name:'Agent',exact:true}).click();
   await page.getByRole('button',{name:'Publish timeline changes'}).click();
   await page.getByText(/Project is now at revision 3/).waitFor();
   await page.getByRole('button',{name:'Open latest copy'}).click();
   await page.locator('.ed-clip').filter({hasText:'Second agent revision'}).waitFor();
   await page.getByRole('textbox',{name:'Project name'}).fill('Published browser revision');
   await page.getByRole('button',{name:'Agent',exact:true}).click();
   await page.getByRole('button',{name:'Publish timeline changes'}).click();
   await page.getByText('Timeline published to shared revision 4.').waitFor();
   expect(listProjects()[0]).toMatchObject({name:'Published browser revision',revision:4});
   const sample=inspectProject(project.id).media.find(item=>item.name==='sample.png')!;
   expect(await setSharedCover({projectId:project.id,revision:4,mediaId:sample.id})).toMatchObject({revision:5});
   const image=inspectProject(project.id).coverImage;
   expect(image).toMatch(/^data:image\/jpeg;base64,/);
   expect(await setSharedCover({projectId:project.id,revision:5,at:0.5})).toMatchObject({revision:6});
   expect(inspectProject(project.id).coverImage).toMatch(/^data:image\/jpeg;base64,/);
   expect(inspectProject(project.id).coverImage).not.toBe(image);
   await page.getByRole('button',{name:'Open latest copy'}).click();
   await page.getByRole('button',{name:'Edit cover',exact:true}).waitFor();
   await page.getByRole('button',{name:'Agent',exact:true}).click();
   await page.getByRole('combobox',{name:/^Text template to share/}).click();
   await page.getByRole('option',{name:'Headline',exact:true}).click();
   await page.getByRole('button',{name:'Share text template'}).click();
   await page.getByText('Text template shared with agents.').waitFor();
   expect(inspectProject(project.id).textTemplates).toContainEqual(expect.objectContaining({name:'Headline'}));
   await page.getByRole('combobox',{name:/^Text template to share/}).click();
   await page.getByRole('option',{name:'Quote card',exact:true}).click();
   await page.getByRole('button',{name:'Share text template'}).click();
   await expect.poll(()=>inspectProject(project.id).textTemplates?.some(item=>item.name==='Quote card')).toBe(true);
   await page.getByRole('combobox',{name:/^Media to share/}).click();
   await page.getByRole('option',{name:'Whoosh',exact:true}).click();
   await page.getByRole('button',{name:'Share selected media'}).click();
   await page.getByText('Media shared with agents. The timeline stayed the same.').waitFor();
   const latest=inspectProject(project.id),quote=latest.textTemplates?.find(item=>item.name==='Quote card')!;
   const title=editProject(project.id,latest.revision,[{type:'addTextTemplate',templateId:quote.id,start:4,text:'Edited quote'}]);
   expect(title.project.clips.at(-1)?.title).toMatchObject({layers:[
    {line:2},{text:'Edited quote'},{text:'— Someone wise'},
   ]});
   expect(latest.media).toContainEqual(expect.objectContaining({id:'sfx-whoosh',type:'audio'}));
  }finally{await browser.close();}
 }finally{await server.close();}
},35_000);
