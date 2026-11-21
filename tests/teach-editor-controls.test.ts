import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

// Learn, in one place: a video in Learn's prompt opens a drawer beside the page that says what to
// learn from it; Send teaches it with those choices and the words in the prompt.
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('a video in Learn\'s prompt is set up in the drawer and taught with Send',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'tl-learn-ui-'));
 const clip=path.join(temp,'clip.mp4');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=0x16383a:s=320x180:d=12:r=25','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',clip]);
 const browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1080},colorScheme:'light',reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
 const topics=Object.entries({pacing:'Pacing and rhythm',transitions:'Transitions and cuts',motion:'Motion and animation',typography:'Text and typography',color:'Colour',design:'Layout and composition',audio:'Music and sound',script:'Hook and script',captions:'Captions',editing:'Editing choices'}).map(([id,label])=>({id,label}));
 const groups=[{id:'motion',label:'Motion design',about:''},{id:'edit',label:'Footage editing',about:''}];
 let sent:Record<string,unknown>|null=null,failNext=true,uploaded=false,named:Record<string,unknown>|null=null;const removed:string[]=[];
 const taught=(id:string,title:string)=>({id,title,source:'link',status:'learned',verdict:'good',group:'motion',prompt:'',topics:['motion'],style:['Steady cuts'],lessons:[],media:{seconds:8,width:320,height:180,fps:25,audio:false},created:'2026-11-01T00:00:00Z',measured:null,similar:[],hasThumb:false,hasPlayback:false,canAgain:false,link:null});
 const learned=[taught('learned-a','Post by someone'),taught('learned-b','Another reel')];
 const draft={id:'learn-demo',title:'studio_reference',source:'upload',status:'draft',media:{seconds:12,width:320,height:180,fps:25,audio:true}};
 try{
  await page.route('http://teach.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/home')return route.fulfill({json:{teach:{videos:0,waiting:0,lessons:0,patterns:0},studio:{jobs:0},scores:{good:0,bad:0},brain:{total:0,byStatus:{}},you:[],agent:[],activity:[]}});
   if(url.pathname==='/api/studio/state')return route.fulfill({json:{requests:[],jobs:[],taught:[],looks:[],profiles:[],reasons:[],scores:{rules:[]},can:{maxMB:2048}}});
   if(url.pathname==='/api/studio/live')return route.fulfill({json:{jobs:[]}});
   if(url.pathname==='/api/state')return route.fulfill({json:{videos:uploaded&&!sent?[draft]:sent?learned:[],topics,groups,can:{maxMB:2048,speech:true}}});
   if(url.pathname==='/api/videos/names'){named=route.request().postDataJSON();return route.fulfill({json:{by:'model',renamed:[{id:'learned-a',title:'Soft product reveal'}]}});}
   if(url.pathname.startsWith('/api/videos/learned-')&&route.request().method()==='DELETE'){removed.push(url.pathname.split('/').pop()+url.search);return route.fulfill({json:{ok:true}});}
   if(url.pathname==='/api/upload'){uploaded=true;return route.fulfill({json:{id:draft.id}});}
   if(url.pathname==='/api/videos/learn-demo/teach'){
    if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Temporary study failure'}});}
    sent=route.request().postDataJSON();return route.fulfill({json:{ok:true}});
   }
   if(url.pathname.startsWith('/media/'))return route.fulfill({body:await fs.readFile(clip),contentType:'video/mp4'});
   const name=url.pathname==='/'?'index.html':path.basename(url.pathname);
   if(!['index.html','tokens.css','app.css','shell.css','core.js','shell.js','create.js','learn.js','places.js','teach.js','studio.js'].includes(name))return route.fulfill({status:204});
   return route.fulfill({body:await fs.readFile(path.resolve('src/teach/ui',name)),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  // The old teach pages open Learn.
  await page.goto('http://teach.test/#/teach/add');
  await expect.poll(()=>new URL(page.url()).hash).toBe('#/learn');
  await page.getByRole('heading',{name:'Nothing learned yet'}).waitFor();
  const prompt=page.getByRole('textbox',{name:'Learn from a video'});
  expect(await prompt.getAttribute('placeholder')).toContain('Add the video with +');
  // A video file comes in through +: it shows in the prompt and the drawer opens beside the page.
  await page.getByRole('button',{name:'Add a video to learn from'}).click();
  await page.getByRole('heading',{name:'Add a video to learn from'}).waitFor();
  expect(await page.locator('#pick-side [data-pick-tab]').allInnerTexts()).toEqual(['Video file','Link','Made by the studio']);
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Upload video'}).click();
  await (await chooser).setFiles(clip);
  // Uploaded videos are listed in the popup; the new one is selected, so it shows in the prompt too.
  await page.getByRole('region',{name:'Your uploaded videos'}).waitFor();
  expect(await page.getByRole('button',{name:'Selected: studio_reference'}).getAttribute('aria-pressed')).toBe('true');
  expect(await page.locator('#dock-files .dock-attachment').count()).toBe(1);
  // Unselecting keeps it in the uploaded videos; selecting puts it back in the prompt.
  await page.getByRole('button',{name:'Selected: studio_reference'}).click();
  await expect.poll(()=>page.locator('#dock-files:not([hidden]) .dock-attachment').count()).toBe(0);
  await page.getByRole('button',{name:'Select: studio_reference'}).click();
  await expect.poll(()=>page.locator('#dock-files:not([hidden]) .dock-attachment').count()).toBe(1);
  await page.locator('#pick-setup').click();
  await page.getByRole('heading',{name:'Learn from this video'}).waitFor();
  expect(await prompt.getAttribute('placeholder')).toContain('optional');
  const drawer=page.locator('#panel');
  expect(await drawer.locator('#learn-name').inputValue()).toContain('Motion study');
  await drawer.getByRole('button',{name:'Footage editing'}).click();
  expect(await drawer.locator('#learn-name').inputValue()).toContain('Editing study');
  await drawer.getByRole('button',{name:'What to avoid'}).click();
  await drawer.getByRole('button',{name:'Hook and script'}).click();
  await drawer.getByRole('button',{name:'Transitions and cuts'}).click();
  await drawer.getByRole('slider',{name:'End'}).fill('5');
  expect(await drawer.locator('#learn-trim-note').textContent()).toBe('0:00 – 0:05 · 0:05 of 0:12');
  await drawer.getByRole('button',{name:'1:1',exact:true}).click();
  expect(await drawer.locator('.learn-crop-box').isVisible()).toBe(true);
  await drawer.getByRole('button',{name:'Apply crop'}).click();
  // Applied: the frame goes and the preview takes the cropped shape (square here).
  expect(await drawer.locator('.learn-crop-box').isHidden()).toBe(true);
  expect(await drawer.locator('.learn-stage').evaluate(el=>Math.round(el.getBoundingClientRect().width/el.getBoundingClientRect().height*100))).toBe(100);
  await drawer.getByText('Cropped to 1:1').waitFor();
  await drawer.getByRole('switch',{name:'Study the soundtrack'}).uncheck();
  expect(await drawer.getByRole('switch',{name:'Write down what is said'}).isDisabled()).toBe(true);
  await drawer.locator('#learn-name').fill('My reference — ڕیتم');
  // Send teaches it; a failure keeps everything as it was, to send again.
  await prompt.fill('Keep my own instructions exactly.');
  await drawer.getByRole('button',{name:'Teach it'}).click();
  await page.getByText('Temporary study failure').waitFor();
  expect(await page.getByRole('button',{name:'Teach this video'}).count()).toBe(1);
  await page.getByRole('button',{name:'Teach this video'}).click();
  await expect.poll(()=>sent).not.toBeNull();
  expect(sent).toMatchObject({title:'My reference — ڕیتم',verdict:'bad',prompt:'Keep my own instructions exactly.',topics:['editing','pacing','script'],segment:{start:0,end:5},sound:false,speech:false,autoName:true,crop:{x:.2188,y:0,w:.5625,h:1}});
  await page.getByText('Learning from it now').waitFor();
  await expect.poll(()=>prompt.getAttribute('placeholder')).toContain('Add the video with +');
  expect(await page.locator('#panel').isHidden()).toBe(true);
  // Learned videos are picked like Create's cards; the search row becomes a bar for them.
  await page.getByRole('button',{name:'Select Post by someone'}).click();
  await page.getByRole('toolbar',{name:'Picked videos'}).waitFor();
  expect(await page.locator('.learn-sel-count').textContent()).toBe('1 picked');
  expect(await page.getByRole('button',{name:'Learn again'}).isDisabled()).toBe(true);
  await page.getByRole('button',{name:'Better names'}).click();
  await expect.poll(()=>named).toEqual({ids:['learned-a']});
  await page.locator('.toast').first().waitFor({state:'detached',timeout:10000});// it sits over the cards for a moment
  await page.getByRole('button',{name:'Select Post by someone'}).click();
  await page.getByRole('button',{name:'Select Another reel'}).click();
  await page.getByRole('button',{name:'Remove',exact:true}).click();
  await page.getByRole('menuitem',{name:/Keep its rules/}).click();
  await expect.poll(()=>removed).toEqual(['learned-a?keep=lessons','learned-b?keep=lessons']);
  expect(errors).toEqual([]);
 }finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
},30000);
