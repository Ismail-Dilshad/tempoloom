// The Studio page: requests, the agent's inbox, step ratings that score only that step's lessons,
// picking between two looks, and the page's server.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-studio-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know')},before={...process.env};
type S=typeof import('../src/engine/studio.js');type R=typeof import('../src/engine/studio-requests.js');type B=typeof import('../src/engine/brain/brain.js');
let st:S,rq:R,brain:B,closeDb:()=>void;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
beforeAll(async()=>{
 Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});
 st=await import('../src/engine/studio.js');rq=await import('../src/engine/studio-requests.js');brain=await import('../src/engine/brain/brain.js');closeDb=(await import('../src/engine/brain/db.js')).closeDb;
 brain.sync();
 for(const [id,tags] of [['t-look-a','design'],['t-look-b','design'],['t-look-both','color'],['t-scene','motion']] as const)
  brain.add({id,title:'Lesson '+id,body:'A lesson used by one step of a job, for the test.',kind:'technique',domain:'motion',tags:[tags],source:'job:x',status:'trial'});
});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});
const out=(job:string,name:string,text='x')=>{const f=path.join(st.jobDir(job),name);fs.writeFileSync(f,text);return f;};
/** Does a task the way a role would. */
const run=(job:string,task:string,o:Parameters<S['done']>[2]={})=>{const s=st.start(job,task) as {writeTo?:string};
 return st.done(job,task,{applied:['none'],...(s.writeTo?{output:out(job,path.basename(s.writeTo),task==='script'?'Hook line.\nSecond line.\nCall to action.':task)}:{}),...o});};

describe('the Studio page',()=>{
 let job='';
 it('takes a motion request with only a link, and an edit with no instructions',()=>{
  const a=rq.newRequest();
  expect(()=>rq.submit(a.id,{mode:'motion'})).toThrow(/script, a prompt, a topic or a link/);
  const logo=rq.filePath(a.id,'logo','My Logo.png');fs.writeFileSync(logo,png);rq.addFile(a.id,'logo',logo);
  expect(()=>rq.filePath(a.id,'logo','two.png')).toThrow(/At most 1 logo/);
  expect(()=>rq.filePath(a.id,'footage','evil.exe')).toThrow(/must be a video/);
  rq.submit(a.id,{mode:'motion',link:'https://example.com/product',seconds:30,shape:'vertical',colors:{accent:'#FF6B4A'}});
  const e=rq.newRequest();
  expect(()=>rq.submit(e.id,{mode:'edit'})).toThrow(/Add the footage/);
  const clip=rq.filePath(e.id,'footage','talk.mp4');fs.writeFileSync(clip,'video');rq.addFile(e.id,'footage',clip);
  rq.submit(e.id,{mode:'edit'});
  const box=rq.inbox();expect(box.newRequests.map(r=>r.mode)).toEqual(['motion','edit']);
  const t=rq.take(a.id);job=t.job;
  const p=st.readPlan(job);
  expect(p.options).toEqual(['write','pick']);expect(p.request).toContain('build the video from the link');expect(p.request).toContain('Logo: ');expect(p.request).toContain('accent #FF6B4A');
  expect(p.tasks.some(x=>x.id==='style-pick'&&x.gate)).toBe(true);
  expect(()=>rq.take(a.id)).toThrow(/Already taken/);
  const ed=st.readPlan(rq.take(e.id).job);
  expect(ed.type).toBe('footage-edit');expect(ed.request).toContain('gave no instructions: decide everything');expect(ed.options).toEqual(['visuals']);
  expect(rq.inbox().newRequests).toHaveLength(0);
 });

 it('shows a step with its files, and a bad rating scores only that step and reopens only it',async()=>{
  for(const t of ['intake','brief','research','facts'])run(job,t);
  const pic=out(job,'frame.png');fs.writeFileSync(pic,png);
  run(job,'script',{applied:['t-scene'],show:[pic]});
  expect(()=>st.done(job,'script',{show:[path.join(tmp,'missing.png')]})).toThrow(/No such file to show/);
  let v=rq.overview().jobs.find(j=>j.job===job)!;
  expect(v.waitingFor).toBe('you');
  const step=v.tasks.find(t=>t.id==='script')! as {output:string;show:{name:string;type:string}[];canRate:boolean;lessons:{id:string}[]};
  expect(step.output).toContain('Hook line.');expect(step.show).toEqual([{k:0,name:'frame.png',type:'image'}]);expect(step.canRate).toBe(true);expect(step.lessons.map(l=>l.id)).toEqual(['t-scene']);
  expect(rq.shownFile(job,st.readPlan(job).tasks.findIndex(t=>t.id==='script'),'show-0')).toBe(pic);
  expect(()=>rq.shownFile(job,0,'show-9')).toThrow();
  await expect(st.rate(job,'script',{rating:'bad'})).rejects.toThrow(/Say what is wrong/);
  await expect(st.rate(job,'script-ok',{rating:'good'})).rejects.toThrow(/approval/);
  const r=await st.rate(job,'script',{rating:'ok',parts:[{part:'line 2',rating:'bad',note:'too long'}],reasons:['words']}) as {rating:string;reopened:string[];savedRule:string;goesTo:string[]};
  expect(r.rating).toBe('bad'); // a flagged part makes the step bad
  expect(r.reopened).toEqual(['script']);expect(r.goesTo).toEqual(['Scriptwriter']);expect(r.savedRule).toContain('line 2');
  expect(brain.getKnowledge('t-scene')).toMatchObject({losses:1,wins:0});
  const p=st.readPlan(job);
  expect(p.tasks.find(t=>t.id==='research')!.status).toBe('done'); // other steps are untouched
  expect(rq.inbox().jobs.find(j=>j.job===job)!.ready[0]).toMatchObject({task:'script',redo:true});
  // Redone, then rated good: a new version takes a new rating; the same version cannot be rated twice.
  run(job,'script',{applied:['t-scene']});
  expect((await st.rate(job,'script',{rating:'good'}) as {scored:{id:string}[]}).scored.map(x=>x.id)).toEqual(['t-scene']);
  await expect(st.rate(job,'script',{rating:'good'})).rejects.toThrow(/already rated/);
  expect(brain.getKnowledge('t-scene')).toMatchObject({losses:1,wins:1});
  st.approve(job,'script-ok');
 });

 it('lets the user pick one of two looks: its lessons win, the other\'s lose',()=>{
  st.start(job,'style');
  const a=out(job,'a.png'),b=out(job,'b.png');fs.writeFileSync(a,png);fs.writeFileSync(b,png);
  expect(()=>st.done(job,'style',{output:out(job,'style.md'),applied:['none']})).toThrow(/two versions/);
  st.done(job,'style',{output:out(job,'style.md'),applied:['t-look-both'],choices:[`A: Calm paper|${a}|t-look-a`,`B: Bold neon|${b}|t-look-b`]});
  expect(()=>st.approve(job,'style-pick')).toThrow(/chooses a version/);
  expect(rq.overview().jobs.find(j=>j.job===job)!.waitingFor).toBe('you');
  const r=st.pick(job,'style','B');
  expect(r).toMatchObject({picked:'B: Bold neon',won:['t-look-b'],lost:['t-look-a']});
  expect(brain.getKnowledge('t-look-b')!.wins).toBe(1);expect(brain.getKnowledge('t-look-a')!.losses).toBe(1);expect(brain.getKnowledge('t-look-both')).toMatchObject({wins:0,losses:0});
  expect(()=>st.pick(job,'style','A')).toThrow(/already picked/);
  st.approve(job,'style-pick');
  const s=st.start(job,'storyboard') as {inputs:{from:string;note?:string}[]};
  expect(s.inputs.find(i=>i.from==='style')!.note).toContain('The user picked "B: Bold neon"');
 });

 it('finishes: the final rating gives the verdict without scoring rated steps twice',async()=>{
  st.done(job,'storyboard',{output:out(job,'storyboard.md'),applied:['t-scene']});
  for(const t of ['sound','design'])run(job,t);
  st.approve(job,'design-ok');for(const t of ['build','review'])run(job,t);st.approve(job,'preview-ok');
  await expect(rq.finalRating(job,{rating:'good'})).rejects.toThrow(/not finished/);
  run(job,'final',{applied:['t-look-both']});
  const before=brain.getKnowledge('t-scene')!;
  await rq.finalRating(job,{rating:'good'});
  expect(st.readPlan(job).verdict).toBe('approved');
  expect(brain.getKnowledge('t-look-both')!.wins).toBe(1);   // the final step's own lesson, once
  expect(brain.getKnowledge('t-scene')!.wins).toBe(before.wins); // already scored by the script's rating: one job never scores a lesson twice
  expect(brain.getKnowledge('t-look-b')!.wins).toBe(1); // scored by the pick, not again by the verdict
  const o=rq.overview();expect(o.scores.steps.find(s=>s.step==='script')).toMatchObject({good:1,bad:1});expect(o.scores.rules.length).toBe(1);
 });

 it('serves the Studio page: brief, files, ratings, and only files a step showed',async()=>{
  const {serve}=await import('../src/teach/server.js');const s=await serve({port:0});
  try{
   const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key},jh={...h,'content-type':'application/json'};
   expect((await fetch(base+'/studio?k='+s.key)).headers.get('content-type')).toContain('text/html');
   expect((await fetch(base+'/app.css')).status).toBe(200);
   expect((await fetch(base+'/api/studio/state')).status).toBe(403);
   const r=await (await fetch(base+'/api/studio/requests',{method:'POST',headers:h})).json() as {id:string};
   expect((await fetch(base+`/api/studio/requests/${r.id}/files?kind=logo&name=x.exe`,{method:'POST',headers:h,body:png})).status).toBe(400);
   expect((await fetch(base+`/api/studio/requests/${r.id}/files?kind=logo&name=logo.png`,{method:'POST',headers:h,body:png})).status).toBe(200);
   expect((await fetch(base+`/studio-file/request/${r.id}/logo.png`,{headers:h})).headers.get('content-type')).toBe('image/png');
   expect((await fetch(base+`/api/studio/requests/${r.id}/submit`,{method:'POST',headers:jh,body:JSON.stringify({mode:'motion'})})).status).toBe(400);
   expect((await fetch(base+`/api/studio/requests/${r.id}/submit`,{method:'POST',headers:jh,body:JSON.stringify({mode:'motion',text:'A topic: why sleep matters',seconds:30})})).status).toBe(200);
   const revised=await fetch(base+`/api/studio/requests/${r.id}`,{method:'PATCH',headers:jh,body:JSON.stringify({text:'A revised brief'})});
   expect(await revised.json()).toMatchObject({status:'waiting',input:{text:'A revised brief',seconds:30}});
   const state=await (await fetch(base+'/api/studio/state',{headers:h})).json() as {requests:{id:string;status:string}[];jobs:{job:string;finished:boolean}[];totals:{waitingForAgent:number}};
   expect(state.requests.find(x=>x.id===r.id)!.status).toBe('waiting');expect(state.totals.waitingForAgent).toBeGreaterThan(0);
   const idx=st.readPlan(job).tasks.findIndex(t=>t.id==='script');
   expect((await fetch(base+`/studio-file/job/${job}/${idx}/show-0`,{headers:h})).status).toBe(200);
   expect((await fetch(base+`/studio-file/job/${job}/${idx}/show-5`,{headers:h})).status).toBe(404);
   expect((await fetch(base+`/api/studio/jobs/${job}/rate/sound`,{method:'POST',headers:jh,body:JSON.stringify({rating:'ok'})})).status).toBe(200);
   expect((await fetch(base+`/api/studio/jobs/${job}/rate/sound`,{method:'POST',headers:jh,body:JSON.stringify({rating:'good'})})).status).toBe(400);
   expect((await fetch(base+`/api/studio/requests/${r.id}`,{method:'DELETE',headers:h})).status).toBe(200);
  }finally{await s.close();}
 });
});

describe('the app',()=>{
 it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('previews Create uploads, restores files, and empties Trash',async()=>{
  const {serve}=await import('../src/teach/server.js');
  const {ffmpeg,run}=await import('../src/renderer/ffmpeg-encoder.js');
  const clip=path.join(tmp,'clip.mp4');
  await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=blue:s=64x48','-t','1','-c:v','libx264',clip]);
  const browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true});
  const server=await serve({port:0});
  try{
   const page=await browser.newPage({reducedMotion:'reduce'});
   page.setDefaultTimeout(6000);
   const base=`http://127.0.0.1:${server.port}/?k=${server.key}`;
   for(const [name,data] of [['library-clip.mp4',fs.readFileSync(clip)],['library-logo.png',png]] as const){
    const uploaded=await page.request.post(new URL(`/api/library/upload?name=${name}`,base).href,{headers:{'x-teach-key':server.key},data});
    expect(uploaded.ok(),await uploaded.text()).toBe(true);
   }
   await page.goto(base+'#/create');
   // Earlier tests left outputs, so Create shows them instead of the welcome: open the reference picker as its button does.
   await page.locator('#dock-text').waitFor();await page.evaluate('Picker.open("reference")');
   await page.locator('#pick-file').setInputFiles([{name:'sample.png',mimeType:'image/png',buffer:png},{name:'clip.mp4',mimeType:'video/mp4',buffer:fs.readFileSync(clip)}]);
   await page.locator('#pick-main').getByText('clip.mp4',{exact:true}).waitFor();
   await page.waitForFunction(()=>{
    const previews=[...document.querySelectorAll<HTMLImageElement>('#pick-main img')];
    return previews.length===2&&previews.every(img=>img.naturalWidth>0);
   });
   await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.waitForFunction(()=>{
    const previews=[...document.querySelectorAll<HTMLImageElement>('.upload-card:not(.output-card) img')];
    return previews.length===2&&previews.every(img=>img.naturalWidth>0);
   });
   await page.waitForFunction(()=>{
    const previews=[...document.querySelectorAll<HTMLImageElement>('.dock-attachment img')];
    return previews.length===2&&previews.every(img=>img.naturalWidth>0);
   });
   expect(await page.locator('#dock-files').innerText()).toBe('');
   await page.locator('#dock-text').fill('Temporary prompt');
   await page.getByRole('button',{name:'Clear prompt',exact:true}).click();
   expect(await page.locator('#dock-text').inputValue()).toBe('');
   expect(await page.locator('#dock-clear').isVisible()).toBe(false);
   expect(await page.locator('.dock-attachment').count()).toBe(2);
   const detachSample=page.locator('#dock-files').getByRole('button',{name:'Remove sample.png from prompt'});
   const useSample=page.locator('.create-uploads .upload-card[data-name="sample.png"] .upload-select');// its label says Add or Remove
   expect(await page.locator('.create-uploads img').first().evaluate(image=>getComputedStyle(image).objectFit)).toBe('contain');
   const card=await page.locator('.create-uploads .upload-card').first().boundingBox();
   expect(card!.width).toBeCloseTo(card!.height);
   await detachSample.click();
   await detachSample.waitFor({state:'detached'});
   expect(await useSample.getAttribute('aria-pressed')).toBe('false');
   await page.reload();
   await useSample.waitFor();
   expect(await useSample.getAttribute('aria-pressed')).toBe('false');
   await useSample.click();
   await detachSample.waitFor();
   await page.getByRole('button',{name:'Add files',exact:true}).click();
   const picker=page.getByRole('dialog',{name:'Add files'});
   expect(await picker.getByRole('button',{name:'Footage',exact:true}).count()).toBe(0);
   await picker.getByRole('button',{name:'Logo',exact:true}).click();
   await picker.locator('#pick-file').setInputFiles({name:'draft-logo.png',mimeType:'image/png',buffer:png});
   await picker.getByText('draft-logo.png',{exact:true}).waitFor();
   expect(await picker.getByRole('button',{name:'Upload files'}).isDisabled()).toBe(true);
   await picker.getByRole('button',{name:'Library',exact:true}).click();
   await picker.getByRole('button',{name:'library-logo.png'}).waitFor();
   expect(await picker.getByRole('button',{name:'library-logo.png'}).isDisabled()).toBe(true);
   await page.waitForFunction(()=>{
    const previews=[...document.querySelectorAll<HTMLImageElement>('#pick-main img')];
    return previews.length===2&&previews.every(img=>img.naturalWidth>0);
   });
   await picker.getByRole('button',{name:'library-clip.mp4'}).click();
   await picker.getByRole('button',{name:'Add selected'}).click();
   await picker.getByText('library-clip.mp4',{exact:true}).waitFor();
   expect(await picker.getByRole('button',{name:'Upload files'}).isDisabled()).toBe(true);
   await picker.getByRole('button',{name:'Close',exact:true}).click();
   await page.getByRole('button',{name:'More options for draft-logo.png'}).waitFor();
   await page.getByRole('button',{name:'More options for library-clip.mp4'}).waitFor();
   await page.getByRole('button',{name:'More options for sample.png'}).click();
   await page.getByRole('menuitem',{name:'Rename'}).click();
   const editor=page.locator('.rename-pop').getByRole('textbox',{name:'File name'});
   expect(await editor.inputValue()).toBe('sample.png');
   await editor.fill('Unsaved.png');
   await page.getByRole('button',{name:'Cancel rename'}).click();
   await page.getByRole('button',{name:'More options for sample.png'}).click();
   await page.getByRole('menuitem',{name:'Rename'}).click();
   await editor.fill('Renamed photo.png');
   await page.getByRole('button',{name:'Save name'}).click();
   await page.getByRole('button',{name:'More options for clip.mp4'}).click();
   await page.getByRole('menuitem',{name:'Rename'}).click();
   const longName='A'.repeat(64)+'.mp4';
   await editor.fill(longName);
   await editor.press('Enter');
   const longTile=page.locator('.upload-card').filter({has:page.getByRole('button',{name:`More options for ${longName}`})});
   await longTile.hover();
   expect(await longTile.locator('.upload-name').isVisible()).toBe(false);
   await page.getByRole('button',{name:'More options for Renamed photo.png'}).click();
   await page.getByRole('menuitem',{name:'Move to Trash'}).click();
   await page.getByRole('button',{name:'More options for Renamed photo.png'}).waitFor({state:'detached'});
   const detachLogo=page.locator('#dock-files').getByRole('button',{name:'Remove draft-logo.png from prompt'});
   await detachLogo.click();
   await detachLogo.waitFor({state:'detached'});
   await page.locator('#dock-text').fill('A video about the ocean');
   await page.getByRole('button',{name:'Send to the studio'}).click();
   await page.locator('#drawer-start .drawer-work').waitFor();// Create stays; the drawer follows what was sent
   const sent=rq.requests().find(r=>r.input?.text==='A video about the ocean')!;
   expect(sent.files.find(file=>file.name==='draft-logo.png')?.detached).toBe(true);
   expect(rq.brief(sent)).not.toContain('draft-logo.png');
   expect(rq.brief(sent)).toContain('library-clip.mp4');
   await page.goto(base+'#/trash');
   const restored=page.waitForResponse(res=>new URL(res.url()).pathname.includes('/trashed-files/'));
   await page.getByRole('button',{name:'Restore Renamed photo.png'}).click();
   const response=await restored;
   expect(response.ok(),await response.text()).toBe(true);
   await page.getByRole('button',{name:'Restore Renamed photo.png'}).waitFor({state:'detached'});
   await page.goto(base+'#/create');
   await page.getByRole('button',{name:'More options for Renamed photo.png'}).waitFor();
   const active=rq.requests().find(r=>r.files.some(f=>f.name==='Renamed photo.png'))!;
   const disposable=rq.filePath(active.id,'asset','discarded.png');
   fs.writeFileSync(disposable,png);
   rq.addFile(active.id,'asset',disposable);
   rq.trashFile(active.id,'asset','discarded.png');
   const archived=st.plan('Archived project to empty',{type:'script-to-motion',job:'empty-trash-test'}).job;
   const keep=st.plan('Project restored during confirmation',{type:'script-to-motion',job:'restored-trash-test'}).job;
   st.archive(archived,true);
   st.archive(keep,true);
   await page.goto(base+'#/trash');
   const empty=page.getByRole('button',{name:'Empty Trash',exact:true});
   const confirmation=page.getByRole('dialog',{name:'Empty Trash?'});
   await empty.click();
   await confirmation.getByText(/Delete 3 items/).waitFor();
   await confirmation.getByRole('button',{name:'Cancel'}).click();
   expect(fs.existsSync(disposable)).toBe(true);
   expect(st.readPlan(archived).archived).toBe(true);
   await empty.click();
   st.archive(keep,false);
   await confirmation.getByRole('button',{name:'Empty Trash'}).click();
   await page.getByRole('heading',{name:'Trash is empty'}).waitFor();
   expect(await empty.count()).toBe(0);
   expect(fs.existsSync(disposable)).toBe(false);
   expect(fs.existsSync(active.files.find(f=>f.name==='Renamed photo.png')!.file)).toBe(true);
   expect(()=>st.readPlan(archived)).toThrow();
   expect(st.readPlan(keep).archived).toBe(false);
  }finally{await browser.close();await server.close();}
 },30000);
 it('serves its files, the home summary, written lessons, feedback and archive',async()=>{
  const {serve}=await import('../src/teach/server.js');const s=await serve({port:0});
  try{
   const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key},jh={...h,'content-type':'application/json'};
   for(const f of ['tokens.css','app.css','shell.css','core.js','shell.js','create.js','places.js','teach.js','studio.js'])expect((await fetch(base+'/'+f)).status,f).toBe(200);
   expect((await fetch(base+'/server.ts')).status).toBe(403);
   expect(await (await fetch(base+'/?k='+s.key)).text()).toContain('/core.js');
   const home=await (await fetch(base+'/api/home',{headers:h})).json() as {brain:{total:number};teach:{lessons:number};activity:{kind:string}[];agent:unknown[]};
   expect(home.brain.total).toBeGreaterThan(50);expect(home.activity.some(a=>a.kind==='rating')).toBe(true);
   expect((await fetch(base+'/api/lessons',{method:'POST',headers:jh,body:JSON.stringify({text:'short',topics:['design']})})).status).toBe(400);
   const made=await (await fetch(base+'/api/lessons',{method:'POST',headers:jh,body:JSON.stringify({text:'End every ad on the logo for at least 2 seconds, with the website address under it.',topics:['design'],avoid:false})})).json() as {id:string;status:string;mine:boolean};
   expect(made).toMatchObject({status:'approved',mine:true});
   const state=await (await fetch(base+'/api/state',{headers:h})).json() as {lessons:{id:string}[]};
   expect(state.lessons.some(l=>l.id===made.id)).toBe(true);
   const job=(await (await fetch(base+'/api/studio/state',{headers:h})).json() as {jobs:{job:string;brief:unknown;archived:boolean}[];scores:{trend:unknown[];best:unknown[]}}).jobs.find(j=>j.brief)!;
   expect((await fetch(base+`/api/studio/jobs/${job.job}/feedback`,{method:'POST',headers:jh,body:JSON.stringify({said:'x'})})).status).toBe(400);
   const fb=await (await fetch(base+`/api/studio/jobs/${job.job}/feedback`,{method:'POST',headers:jh,body:JSON.stringify({said:'The music is too loud under the voice.'})})).json() as {goesTo:string[]};
   expect(fb.goesTo).toContain('Sound designer');
   expect((await fetch(base+`/api/studio/jobs/${job.job}/archive`,{method:'POST',headers:jh,body:JSON.stringify({on:true})})).status).toBe(200);
   const after=await (await fetch(base+'/api/studio/state',{headers:h})).json() as {jobs:{job:string;archived:boolean}[];scores:{trend:{rated:number}[];best:unknown[]}};
   expect(after.jobs.find(j=>j.job===job.job)!.archived).toBe(true);expect(after.scores.trend.length).toBeGreaterThan(0);
   const all=(await (await fetch(base+'/api/studio/state',{headers:h})).json() as {jobs:{job:string;tasks:{index?:number;show?:unknown[]}[]}[]}).jobs,withFile=all.find(j=>j.tasks.some(t=>t.show?.length))!,idx=withFile.tasks.find(t=>t.show?.length)!.index;
   expect((await fetch(base+`/studio-file/job/${withFile.job}/${idx}/show-0?dl=1`,{headers:h})).headers.get('content-disposition')).toContain('attachment');
   expect((await fetch(base+`/api/studio/jobs/${job.job}`,{method:'DELETE',headers:h})).status).toBe(200);
   expect(()=>st.readPlan(job.job)).toThrow();
   expect(rq.overview().jobs.some(item=>item.job===job.job)).toBe(false);
  }finally{await s.close();}
 });
});
