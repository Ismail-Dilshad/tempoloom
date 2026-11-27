// The Editor page in a real browser: import a clip through the file picker, edit, grade, caption, mix, export an MP4
// (checked with ffprobe), pack and reopen a project file, and reload with everything kept. RUN_BROWSER_TESTS=1.
import {it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Ed:any;declare const edParseSubs:any;declare const edHandleAt:any;declare const ED_TTPL:any;declare const ED_STYLES:any;declare const ED_TITLES:any;declare const edTitleEditor:any;declare const ED_TRANS:any;
declare function edTimelineDrag(scroll:HTMLElement,event:PointerEvent,update:(event:PointerEvent)=>void,finish:()=>void):void;
declare const ED_SFX:[string,string][];
declare function edMakeSfx(key:string):Promise<AudioBuffer>;

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('the Editor: import, edit, grade, caption, mix, export, project file, reload',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-editor-')),before={...process.env};
 process.env.VIDEO_WORKSPACE=path.join(tmp,'ws');process.env.TEMPOLOOM_SETTINGS_DIR=path.join(tmp,'settings');
 const {ffmpeg,run}=await import('../src/renderer/ffmpeg-encoder.js'),{mediaInfo}=await import('../src/editor/editor.js'),{serve}=await import('../src/teach/server.js');
 const clip=path.join(tmp,'clip.mp4');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','testsrc=size=320x240:rate=30:duration=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-g','15','-pix_fmt','yuv420p','-c:a','aac','-shortest',clip]);
 const browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true}),server=await serve({port:0});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(20000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.port}/?k=${server.key}`;
  await page.goto(base+'#/editor');await page.waitForFunction(()=>typeof Ed!=='undefined');
  const id=await page.evaluate(async()=>{await Ed.load();return Ed.create({name:'Editor test'});});
  await page.goto(base+'#/editor/'+id);await page.locator('.editor canvas[aria-label="Preview"]').waitFor();
  expect(await page.locator('.ed-workspace > .ed-panel').count()).toBe(4);
  expect(await page.locator('.editor').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(28, 28, 28)');
  const details=page.getByRole('region',{name:'Details and clip properties'});
  expect(await details.locator('.ed-project-stats dt').allTextContents()).toEqual(['Resolution','Duration','Clips','Tracks']);
  expect(await details.getByRole('combobox',{name:'Frame rate'}).count()).toBe(1);
  const detailsColumns=()=>details.locator('.ed-prop-pair').evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(await detailsColumns()).toBe(1);
  await page.setViewportSize({width:1000,height:900});
  expect(await detailsColumns()).toBe(2);
  await page.setViewportSize({width:1440,height:900});
  const timeline=page.getByRole('region',{name:'Timeline',exact:true});
  const dragUpdates=await timeline.locator('.ed-scroll').evaluate(async scroll=>{
   const bounds=scroll.getBoundingClientRect(),pointerId=51;
   const pointer=(type:string,x:number)=>new PointerEvent(type,{pointerId,clientX:bounds.left+bounds.width/2+x,clientY:bounds.top+20});
   const moves:number[]=[];let committed=0;
   edTimelineDrag(scroll as HTMLElement,pointer('pointerdown',0),event=>moves.push(event.clientX),()=>{committed=moves.at(-1)??0;});
   for(let i=1;i<=16;i++)window.dispatchEvent(pointer('pointermove',i));
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   const updatesBeforeRelease=moves.length;
   window.dispatchEvent(pointer('pointermove',17));
   window.dispatchEvent(pointer('pointerup',17));
   return {updatesBeforeRelease,updates:moves.length,committedAtLastMove:committed===pointer('pointermove',17).clientX};
  });
  expect(dragUpdates).toEqual({updatesBeforeRelease:1,updates:2,committedAtLastMove:true});
  expect(await timeline.locator('.ed-lane[data-track]').count()).toBe(1);
  const centeredMain=await timeline.evaluate(section=>{
   const lane=section.querySelector('.ed-lane.main')!;
   const scroll=section.querySelector('.ed-scroll') as HTMLElement;
   const ruler=scroll.querySelector('.ed-ruler')!.getBoundingClientRect();
   const track=lane.getBoundingClientRect();
   const bottom=scroll.getBoundingClientRect().top+scroll.clientHeight;
   const header=lane.closest('.ed-tl-body')!.querySelector('.ed-head.main')!.getBoundingClientRect();
   return {offset:(track.top+track.bottom-ruler.bottom-bottom)/2,headerOffset:header.top-track.top};
  });
  expect(centeredMain.offset).toBeCloseTo(0,0);
  expect(centeredMain.headerOffset).toBeCloseTo(0,0);
  const playheadLayer=await timeline.locator('.ed-playhead').evaluate(head=>{
   const line=head.getBoundingClientRect(),body=head.parentElement!;
   const cover=body.querySelector('.ed-cover-strip')!.getBoundingClientRect();
   const visible=document.elementFromPoint(cover.right-2,line.top+20);
   return {seam:line.left-cover.right,onTop:visible===head,bodyTop:line.top-body.getBoundingClientRect().top};
  });
  expect(playheadLayer.seam).toBeCloseTo(0,0);
  expect(playheadLayer.onTop).toBe(true);
  expect(playheadLayer.bodyTop).toBeCloseTo(0,0);
  const timelineBottom=async()=>{const {y,height}=(await timeline.boundingBox())!;return y+height;};
  const emptyTimelineBottom=await timelineBottom();
  const viewportHeight=page.viewportSize()!.height;
  expect(emptyTimelineBottom).toBeGreaterThan(viewportHeight-16);
  expect(emptyTimelineBottom).toBeLessThanOrEqual(viewportHeight);
  const playerCenters=async()=>page.locator('.ed-controls').evaluate(controls=>
   ['[data-play]','.ed-player-menu summary','[data-full]','[data-preview-audio]'].map(selector=>{
    const bounds=controls.querySelector(selector)!.getBoundingClientRect();
    return bounds.top+bounds.height/2;
   }));
  const [playY,optionsY,fullY,volumeY]=await playerCenters();
  expect(optionsY).toBeCloseTo(playY!,0);
  expect(optionsY).toBeCloseTo(fullY!,0);
  expect(volumeY).toBeCloseTo(fullY!,0);
  const divider=page.locator('[data-rz=tl]');
  const dividerBounds=(await divider.boundingBox())!,initialHeight=(await timeline.boundingBox())!.height;
  const dividerX=dividerBounds.x+dividerBounds.width/2,dividerY=dividerBounds.y+dividerBounds.height/2;
  await page.mouse.move(dividerX,dividerY);
  await page.mouse.down();
  await page.mouse.move(dividerX,dividerY-24,{steps:3});
  expect(await divider.evaluate(el=>[getComputedStyle(el).backgroundColor,getComputedStyle(el,'::before').height]))
   .toEqual(['rgba(0, 0, 0, 0)','1px']);
  await page.mouse.up();
  expect((await timeline.boundingBox())!.height).toBeGreaterThan(initialHeight+10);
  await divider.dblclick();
  expect((await timeline.boundingBox())!.height).toBeCloseTo(initialHeight,0);
  const library=page.getByRole('region',{name:'Media library'});
  const mediaTab=library.getByRole('tab',{name:'Media',exact:true}),audioTab=library.getByRole('tab',{name:'Audio',exact:true});
  await mediaTab.press('ArrowDown');
  expect(await audioTab.getAttribute('aria-selected')).toBe('true');
  const audioPanel=page.getByRole('tabpanel',{name:'Audio',exact:true});
  expect(await audioPanel.getByRole('button',{name:'Import audio'}).count()).toBe(1);
  expect(await audioPanel.getByRole('button',{name:'Record voice-over'}).isVisible()).toBe(true);
  const effects=audioPanel.getByText('Sound effects',{exact:true});
  const whoosh=audioPanel.getByRole('button',{name:'Add Whoosh',exact:true});
  expect(await whoosh.isVisible()).toBe(false);
  await effects.click();
  expect(await whoosh.isVisible()).toBe(true);
  expect(await audioPanel.locator('.ed-sfx-group h3').allTextContents()).toEqual(['Transitions','Impacts','Clicks & alerts','Ambience']);
  expect(await audioPanel.locator('[data-sfx]').count()).toBe(16);
  expect(await page.evaluate(async()=>{
   const verified=[];
   for(const [key] of ED_SFX){const sound=await edMakeSfx(key);verified.push(sound.duration>0&&sound.getChannelData(0).some(sample=>Math.abs(sample)>.001));}
   return verified.every(Boolean);
  })).toBe(true);
  await audioPanel.getByRole('button',{name:'Preview Soft wind',exact:true}).click();
  await page.waitForFunction(()=>Ed.librarySample?.key==='wind');
  expect(await page.evaluate(()=>Ed.p.clips.length)).toBe(0);
  await effects.click();
  await audioTab.press('Home');
  expect(await mediaTab.getAttribute('aria-selected')).toBe('true');
  expect(await page.evaluate(()=>Ed.librarySample)).toBeNull();
  // import like a person: the file picker
  // a second file with uneven sound, for lining up multicam angles
  const noise=path.join(tmp,'noise.mp4');
  await run(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=30:duration=3','-f','lavfi','-i','anoisesrc=d=3:c=pink:r=48000:a=0.5:seed=7','-af',"volume='0.15+0.85*abs(sin(t*2.3)*sin(t*5.1))':eval=frame",'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',noise]);
  // and a sound with a pause in the middle (a tone, one second of silence, a tone), for removing silences
  const talk=path.join(tmp,'talk.wav');
  await run(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=330:duration=3:sample_rate=48000','-af',"volume='if(between(t,1,2),0,0.5)':eval=frame",talk]);
  // and a video with one hard cut (red, then blue), for scene detection
  const cut=path.join(tmp,'cut.mp4');
  await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=red:s=320x240:d=1:r=30','-f','lavfi','-i','color=c=blue:s=320x240:d=1:r=30','-filter_complex','[0][1]concat=n=2:v=1','-c:v','libx264','-pix_fmt','yuv420p',cut]);
  await page.locator('.editor > input[type=file]').setInputFiles([clip,noise,talk,cut]);
  await page.waitForFunction(()=>['clip.mp4','noise.mp4','talk.wav','cut.mp4'].every(n=>Ed.media.some((m:any)=>m.name===n&&m.dur>1.9)));
  const mediaTypes=library.getByRole('group',{name:'Media type'});
  await mediaTypes.getByRole('button',{name:'Audio',exact:true}).click();
  expect(await library.locator('.ed-media').count()).toBe(1);
  await mediaTypes.getByRole('button',{name:'All',exact:true}).click();
  const libraryTab=(name:string)=>library.getByRole('tab',{name,exact:true});
  await libraryTab('Stickers').click();
  expect(await library.locator('[data-graphic]').count()).toBe(14);
  expect(await library.locator('[data-graphic-art]').evaluateAll(nodes=>nodes.every(node=>{
   const canvas=node as HTMLCanvasElement;
   return canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data.some((value,i)=>i%4===3&&value>0);
  }))).toBe(true);
  expect(await library.getByText('Emoji',{exact:true}).count()).toBe(0);
  await library.getByRole('button',{name:'Curved arrow',exact:true}).click();
  const sticker=await page.evaluate(()=>{
   const clip=Ed.clip(Ed.sel),cv=document.createElement('canvas');cv.width=360;cv.height=240;
   const g=cv.getContext('2d')!;Ed.drawSticker(g,clip,360,240,clip.start+.5);
   return {graphic:clip.sticker,pixels:g.getImageData(0,0,360,240).data.some((value,i)=>i%4===3&&value>0)};
  });
  expect(sticker).toEqual({graphic:{type:'graphic',id:'arrow'},pixels:true});
  await page.evaluate(()=>Ed.undo());
  await libraryTab('Text').click();
  await page.evaluate(()=>{Ed.seek(0);Ed.p.tracks.find((track:any)=>track.kind==='text').hidden=true;});
  await library.getByRole('region',{name:'Add text'}).getByRole('button',{name:'Title',exact:true}).click();
  expect(await page.evaluate(()=>!Ed.trackOf(Ed.clip(Ed.sel)).hidden)).toBe(true);
  const textInput=details.getByRole('textbox',{name:'Text',exact:true});
  expect(await textInput.evaluate(input=>input===document.activeElement)).toBe(true);
  await textInput.fill('First line\n\nSecond line');
  await textInput.press('Tab');
  expect(await page.evaluate(()=>Ed.lines(Ed.dom.canvas.getContext('2d'),Ed.clip(Ed.sel),Ed.dom.canvas.width))).toEqual(['First line','','Second line']);
  await page.evaluate(()=>{Ed.undo();Ed.undo();delete Ed.p.tracks.find((track:any)=>track.kind==='text').hidden;Ed.seek(0);});
  for(const preset of await library.locator('[data-tpl]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-tpl')!))){
   await library.locator(`[data-tpl="${preset}"]`).click();
   expect(await page.evaluate(()=>{
    const c=Ed.clip(Ed.sel),canvas=Ed.dom.canvas as HTMLCanvasElement;
    Ed.draw(false);
    return c.start===0&&Ed.time>c.start&&canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data.some((value,i)=>i%4!==3&&value>30);
   }),preset).toBe(true);
   await page.evaluate(()=>{Ed.undo();Ed.seek(0);});
  }
  await libraryTab('Templates').click();
  await library.getByRole('button',{name:'Interview ID',exact:true}).click();
  const titleEditor=page.locator('.ed-title-ed');
  await titleEditor.locator('[data-tname]').fill('Edited interview');
  await titleEditor.getByRole('button',{name:'Save title',exact:true}).click();
  expect(await page.evaluate(()=>Ed.clip(Ed.sel).title.name)).toBe('Edited interview');
  await page.evaluate(()=>{Ed.undo();Ed.undo();Ed.seek(0);});
  await libraryTab('Adjustment').click();
  await library.getByRole('button',{name:/^Film texture/}).click();
  expect(await page.evaluate(()=>{const c=Ed.clip(Ed.sel);return [c.adjustment,Ed.p.tracks[0].id===c.track,c.fx.grain];})).toEqual([true,true,22]);
  await page.evaluate(()=>Ed.undo());
  await mediaTab.click();

  await library.getByRole('button',{name:'Add clip.mp4 to the timeline',exact:true}).click();
  const clipId=await page.evaluate(()=>Ed.sel);
  expect(await page.evaluate(id=>Ed.mediaOf(Ed.clip(id)).name,clipId)).toBe('clip.mp4');
  const distantPlayers=await page.evaluate(id=>{
   const source=Ed.clip(id),time=Ed.time;
   const distant=Array.from({length:80},(_,i)=>({...source,id:`performance-${i}`,start:10+i*5}));
   const clips=Ed.p.clips;
   try{
    Ed.p.clips=[...clips,...distant];
    Ed.sync(0);
    const initial=distant.filter(clip=>Ed.els[clip.id]).length;
    Ed.sync(10);
    return {initial,afterSeek:distant.filter(clip=>Ed.els[clip.id]).length};
   }finally{Ed.p.clips=clips;Ed.prune();Ed.sync(time);}
  },clipId);
  expect(distantPlayers).toEqual({initial:0,afterSeek:1});
  const detailsTabs=details.getByRole('tablist',{name:'Clip properties'});
  const tabNames=['Video','Adjust','Colour','Effects','Mask','Animation','Audio','Speed'];
  expect(await detailsTabs.getByRole('tab').count()).toBe(tabNames.length);
  await detailsTabs.getByRole('tab',{name:'Video',exact:true}).press('ArrowRight');
  expect(await detailsTabs.getByRole('tab',{name:'Adjust',exact:true}).getAttribute('aria-selected')).toBe('true');
  for(const name of tabNames){
   const tab=detailsTabs.getByRole('tab',{name,exact:true});
   await tab.click();
   expect(await tab.locator('svg').count()).toBe(1);
   const properties=details.getByRole('tabpanel',{name,exact:true});
   expect(await properties.locator('h3').count()).toBeGreaterThan(0);
   expect(await properties.evaluate(panel=>panel.scrollWidth<=panel.clientWidth)).toBe(true);
  }
  await detailsTabs.getByRole('tab',{name:'Video',exact:true}).click();
  expect(await details.getByRole('button',{name:'Flip horizontally',exact:true}).isVisible()).toBe(true);
  const resetVideo=details.getByRole('button',{name:'Reset video settings',exact:true});
  await details.getByRole('button',{name:'Flip horizontally',exact:true}).click();
  const clipBounds=await page.evaluate(id=>{
   const c=Ed.clip(id);
   Object.assign(c,{in:.25,dur:1.25,speed:1.2,volume:.6,adj:{brightness:20},mask:{shape:'circle'},muted:true,kf:{scale:[{t:0,v:1.5}]}});
   return [c.media,c.track,c.start,c.in,c.dur];
  },clipId);
  await detailsTabs.getByRole('tab',{name:'Colour',exact:true}).click();
  await resetVideo.click();
  const resetState=await page.evaluate(id=>{
   const c=Ed.clip(id);
   return {bounds:[c.media,c.track,c.start,c.in,c.dur],speed:c.speed,volume:c.volume,scale:c.scale,
    cleared:['flipH','adj','mask','muted','kf'].every(key=>c[key]===undefined)};
  },clipId);
  expect(resetState).toEqual({bounds:clipBounds,speed:1,volume:1,scale:1,cleared:true});
  expect(await detailsTabs.getByRole('tab',{name:'Colour',exact:true}).getAttribute('aria-selected')).toBe('true');
  await page.evaluate(()=>Ed.undo());
  expect(await page.evaluate(id=>Ed.clip(id).adj.brightness,clipId)).toBe(20);
  await resetVideo.click();
  await libraryTab('Filters').click();
  await library.getByRole('button',{name:'Golden hour',exact:true}).click();
  expect(await page.evaluate(id=>Ed.clip(id).adj.temperature,clipId)).toBe(32);
  await page.evaluate(()=>Ed.undo());
  await libraryTab('Transitions').click();
  const wipeUp=library.getByRole('button',{name:'Wipe up',exact:true});
  expect(await wipeUp.isDisabled()).toBe(true);
  const join=await page.evaluate(id=>{const next=Ed.add(Ed.clip(id).media);Ed.selectJoin(next.id);return next.id;},clipId);
  await wipeUp.click();
  expect(await page.evaluate(id=>Ed.clip(id).trans.type,join)).toBe('wipeup');
  await page.evaluate(id=>{Ed.undo();Ed.undo();Ed.select(id);},clipId);
  await mediaTab.click();
  const energy=()=>page.evaluate(async()=>{
   const mix=await Ed.mixAudio(0,1);
   return mix.getChannelData(0).reduce((sum:number,sample:number)=>sum+sample*sample,0);
  });
  const baseline=await energy();
  expect(baseline).toBeGreaterThan(0);
  await timeline.locator(`[data-cid="${clipId}"]`).click({button:'right'});
  const clipMenu=page.getByRole('menu',{name:'Clip',exact:true});
  expect(await clipMenu.getByRole('button',{name:'Copy',exact:false}).first().isVisible()).toBe(true);
  expect(await clipMenu.getByRole('button',{name:/^(Split at playhead|Duplicate|Delete|Ripple delete|Detach audio|Freeze frame|Group|Nest into|Paste|Swap with|Fit to fill|Reverse|Stabilise|Auto reframe|Remove background)/}).count()).toBe(0);
  expect(await clipMenu.getByRole('button',{name:'Replace media…',exact:true}).isVisible()).toBe(true);
  await page.keyboard.press('Escape');
  await timeline.getByRole('button',{name:'Combine selected clips'}).click();
  expect(await page.getByRole('button',{name:'Create compound clip',exact:true}).isVisible()).toBe(true);
  await page.keyboard.press('Escape');
  const previewTrigger=page.getByRole('button',{name:'Preview volume',exact:true});
  await previewTrigger.click();
  const previewAudio=page.getByRole('dialog',{name:'Preview audio',exact:true});
  await previewAudio.getByRole('slider').fill('35');
  await page.evaluate(()=>Ed.audio());
  expect(await page.evaluate(()=>Ed.monitorGain.gain.value)).toBeCloseTo(.35);
  await previewAudio.getByRole('button',{name:'Mute preview',exact:true}).click();
  expect(await page.evaluate(()=>Ed.monitorGain.gain.value)).toBe(0);
  expect(await energy()).toBeCloseTo(baseline);
  await previewAudio.getByRole('button',{name:'Unmute preview',exact:true}).click();
  expect(await page.evaluate(()=>Ed.monitorGain.gain.value)).toBeCloseTo(.35);
  await previewAudio.getByRole('slider').fill('100');
  await page.keyboard.press('Escape');

  await timeline.getByRole('button',{name:'Clip audio',exact:true}).click();
  const clipAudio=page.getByRole('dialog',{name:'Clip audio',exact:true});
  await clipAudio.getByRole('slider').fill('50');
  expect((await energy())/baseline).toBeCloseTo(.25);
  await clipAudio.getByRole('button',{name:'Mute clip',exact:true}).click();
  expect(await energy()).toBe(0);
  await clipAudio.getByRole('button',{name:'Unmute clip',exact:true}).click();
  expect((await energy())/baseline).toBeCloseTo(.25);
  await page.keyboard.press('Escape');
  await timeline.getByRole('button',{name:'Detach audio',exact:true}).click();
  expect(await page.evaluate(()=>Ed.p.clips.some((c:any)=>c.asAudio&&c.volume===.5))).toBe(true);
  await page.evaluate(()=>Ed.undo());
  await timeline.getByRole('button',{name:'Ripple delete',exact:true}).click();
  expect(await page.evaluate(()=>Ed.p.clips.length)).toBe(0);

  const r=await page.evaluate(async()=>{
   const out:any={},m=Ed.media.find((x:any)=>x.name==='clip.mp4'),c=Ed.add(m.id),main=()=>Ed.p.clips.filter((x:any)=>x.track===Ed.main().id).length;
   // split, undo, redo
   Ed.seek(1);Ed.select(c.id);Ed.split();out.afterSplit=main();Ed.undo();out.afterUndo=main();Ed.redo();out.afterRedo=main();Ed.undo();
   // grade: a flat curve makes every pixel mid grey
   const clipNow=Ed.p.clips.find((x:any)=>x.media===m.id);Ed.select(null);Ed.seek(.5);await Ed.seekExact(.5);
   const g=Ed.dom.canvas.getContext('2d'),[W,H]=Ed.size(),px=()=>[...g.getImageData(W>>1,H>>1,1,1).data].slice(0,3);
   clipNow.grade={curves:{m:[[0,.5],[1,.5]]}};Ed.draw();out.flat=px();delete clipNow.grade;Ed.draw();
   // captions from a subtitle file, in Kurdish
   const n=Ed.addCaptions(edParseSubs('1\n00:00:00,200 --> 00:00:01,500\nسڵاو لە هەمووان\n').map((q:any)=>({s:q.s,e:q.e,words:q.text.split(' ').map((t:string,i:number,a:string[])=>({t,s:q.s+i*(q.e-q.s)/a.length,e:q.s+(i+1)*(q.e-q.s)/a.length}))})),'ckb','karaoke');
   out.captions=n;out.captionFont=Ed.p.clips.find((x:any)=>x.cap)?.font;
   // mixer: pan the main track right; the left channel of the mix is silent
   Ed.main().pan=1;const b=await Ed.mixAudio(0,1);let l=0,rr=0;const L=b.getChannelData(0),R=b.getChannelData(1);for(let i=0;i<L.length;i++){l+=L[i]*L[i];rr+=R[i]*R[i];}out.left=l;out.right=rr;delete Ed.main().pan;
   // markers
   Ed.seek(.5);Ed.toggleMarker();Ed.setMarker(0,{name:'Start',color:'blue'});out.marker=Ed.p.markers[0];
   // basics: split every track, select from the playhead on, nudge a frame, the resize handle, text line spacing
   const n0=Ed.p.clips.length;Ed.seek(1);Ed.select(null);Ed.splitAll();out.splitAll=Ed.p.clips.length-n0;Ed.undo();
   Ed.seek(.5);Ed.selectFrom(1);out.forward=Ed.sels.size;
   const mc=Ed.p.clips.find((x:any)=>x.media===m.id);Ed.select(mc.id);out.noRoom=Ed.nudge(-1)&&mc.start===0;const cc=Ed.p.clips.find((x:any)=>x.cap);Ed.select(cc.id);Ed.nudge(3);out.nudged=cc.start;Ed.undo();
   {const g2=Ed.dom.canvas.getContext('2d'),[W2,H2]=Ed.size(),b=Ed.box(g2,Ed.p.clips.find((x:any)=>x.media===m.id),W2,H2);out.corner=edHandleAt(Ed.p.clips.find((x:any)=>x.media===m.id),g2,W2,H2,b.cx+b.w/2,b.cy+b.h/2);out.middle=edHandleAt(Ed.p.clips.find((x:any)=>x.media===m.id),g2,W2,H2,b.cx,b.cy);}
   {const tc=Ed.textClip?Ed.p.clips.find((x:any)=>x.cap):null,g2=Ed.dom.canvas.getContext('2d'),[W2,H2]=Ed.size();if(tc){const words=tc.words;delete tc.words;const h1=Ed.textBox(g2,tc,W2,H2,.5).h;tc.lineH=2.5;out.lineRatio=Ed.textBox(g2,tc,W2,H2,.5).h/h1;delete tc.lineH;tc.words=words;}}
   // swap two clips on a track; a keyframe curve changes the value between keyframes; text templates
   {const tx=Ed.p.tracks.find((t:any)=>t.kind==='text')||null;Ed.seek(0);const t1=Ed.addTemplate(ED_TTPL[0]);out.tpl1=t1&&{text:t1.text,align:t1.align,box:t1.box};
    Ed.seek(t1.start+t1.dur+.5);const t2=Ed.addTemplate({name:'B',text:'B',style:{dur:1}});t2.track=t1.track;void tx;
    Ed.select(t1.id);Ed.swap(1);out.swapped=[t2.start,Math.round(t1.start*1000)/1000];Ed.undo();
    const saved=await Ed.saveTemplate(Ed.p.clips.find((x:any)=>x.text==='B'),'Mine');out.saved=Ed.tpls.some((x:any)=>x.id===saved.id&&x.style.dur===1);Ed.p.clips=Ed.p.clips.filter((x:any)=>x.text!=='Name Surname'&&x.text!=='B');Ed.after(true);}
   {const mc2=Ed.p.clips.find((x:any)=>x.media===m.id);Ed.select(mc2.id);Ed.seek(0);Ed.toggleKf(mc2,'opacity');Ed.seek(1);Ed.setVal(mc2,'opacity',0);Ed.seek(0);
    Ed.setKfCurve(mc2,[0,1,0,1]);out.fastEase=Ed.val(mc2,'opacity',.2);Ed.setKfEase(mc2,'linear');out.linEase=Ed.val(mc2,'opacity',.2);delete mc2.kf;mc2.opacity=1;}
   // voice changer: +12 semitones doubles the 440 Hz tone (count zero crossings in the offline mix, as the export hears it)
   {const mc3=Ed.p.clips.find((x:any)=>x.media===m.id),zc=(b:any)=>{const d=b.getChannelData(1);let z=0;for(let i=4800;i<43200;i++)if((d[i-1]<0)!==(d[i]<0))z++;return z;};
    out.zc0=zc(await Ed.mixAudio(0,1));mc3.afx={pitch:12};out.zc12=zc(await Ed.mixAudio(0,1));mc3.afx={voice:'robot'};out.robot=zc(await Ed.mixAudio(0,1));delete mc3.afx;
    // fit to fill and dynamic zoom (on a clip with room after it)
    const vt=Ed.addTrack('video');const v1={...JSON.parse(JSON.stringify(mc3)),id:'fit1',track:vt?.id??Ed.p.tracks.at(-1).id,start:0,dur:1,speed:1},v2={...v1,id:'fit2',start:2};Ed.p.clips.push(v1,v2);
    Ed.fitFill(Ed.clip('fit1'));out.fit=[Ed.clip('fit1').speed,Ed.clip('fit1').dur];Ed.dynZoom(Ed.clip('fit1'),1);out.zoom=Ed.clip('fit1').kf.scale.map((k:any)=>k.v);
    Ed.p.clips=Ed.p.clips.filter((x:any)=>!['fit1','fit2'].includes(x.id));Ed.p.tracks=Ed.p.tracks.filter((t:any)=>Ed.p.clips.some((c:any)=>c.track===t.id)||t.main||t.kind!=='video');Ed.after(true);
    // a flat media library still shows files carrying older folder metadata
    Ed.tab='media';m.folder='Interviews';Ed.drawLib();
    const library=Ed.dom.lib;
    out.mediaCards=library.querySelectorAll('.ed-media').length;
    out.importControls=library.querySelectorAll('[data-import]').length;
    out.extraControls=library.querySelectorAll('input[type=search], select, [data-media-list], [data-folder]').length;
    delete m.folder;
    Ed.tab='audio';Ed.drawLib();out.audioCards=library.querySelectorAll('.ed-media').length;
    out.audioImportControls=library.querySelectorAll('[data-import]').length;
    Ed.tab='media';Ed.drawLib();}
   // nested clips: the same picture and sound as before; a grade on the nested clip covers what is inside; break apart
   {const g3=Ed.dom.canvas.getContext('2d'),[W3,H3]=Ed.size(),px3=()=>[...g3.getImageData(W3>>1,H3>>1,1,1).data].slice(0,3),en=(b:any)=>{const d=b.getChannelData(0);let x=0;for(let i=0;i<d.length;i++)x+=d[i]*d[i];return x;};
    Ed.seek(.5);await Ed.seekExact(.5);Ed.select(null);out.pxBefore=px3();out.enBefore=en(await Ed.mixAudio(0,1));
    const mc4=Ed.p.clips.find((x:any)=>x.media===m.id);Ed.select(mc4.id);const nc=Ed.nest();out.nested=!!nc?.nest&&!Ed.p.clips.some((x:any)=>x.media===m.id);
    Ed.select(null);Ed.seek(.5);await Ed.seekExact(.5);Ed.draw();out.pxNested=px3();out.enNested=en(await Ed.mixAudio(0,1));
    nc.grade={curves:{m:[[0,.5],[1,.5]]}};Ed.draw();out.pxGraded=px3();delete nc.grade;
    Ed.unnest(Ed.clip(nc.id));out.back=Ed.p.clips.filter((x:any)=>x.media===m.id).length;out.noNest=!Ed.p.clips.some((x:any)=>x.nest);
    Ed.undo();Ed.undo();out.restored=Ed.p.clips.filter((x:any)=>x.media===m.id).length;
    // open a nested clip, edit inside (move its clip), come back: one undo step, saved into the project
    const mc5=Ed.p.clips.find((x:any)=>x.media===m.id);Ed.select(mc5.id);const nc2=Ed.nest();Ed.enterNest(nc2);out.inside=[Ed.stack.length,Ed.p.clips.length,Ed.p.clips[0].media===m.id];
    Ed.p.clips[0].opacity=.5;Ed.after(true);await Ed.flush();out.savedInside=JSON.parse(Ed.pjson.get(Ed.root().id)).clips.find((x:any)=>x.id===nc2.id)?.nest.clips[0].opacity;
    Ed.exitNest();out.outside=[Ed.stack.length,Ed.p.clips.some((x:any)=>x.id===nc2.id)];Ed.undo();out.undoneInside=Ed.p.clips.find((x:any)=>x.id===nc2.id)?.nest.clips[0].opacity;Ed.undo();
    out.afterNestUndo=Ed.p.clips.filter((x:any)=>x.media===m.id).length;}
   // multicam: two angles of the same moment (one starts 0.8 s later in the file), lined up by sound; cuts; flatten
   {const nz=Ed.media.find((x:any)=>x.name==='noise.mp4'),t2=Ed.addTrack('video'),t3=Ed.addTrack('video');
    const A={id:'mcA',media:nz.id,track:t2.id,start:3,in:0,dur:3,scale:1,x:0,y:0,rotate:0,opacity:1},B={id:'mcB',media:nz.id,track:t3.id,start:3,in:.8,dur:2.2,scale:1,x:0,y:0,rotate:0,opacity:1};
    Ed.p.clips.push(A,B);Ed.after(true);Ed.sels=new Set(['mcA','mcB']);Ed.sel='mcB';const mcc=await Ed.multicam();
    out.mc=mcc&&{angles:mcc.nest.tracks.length,offset:Math.round((mcc.nest.clips[1].start-mcc.nest.clips[0].start)*100)/100,start:mcc.start};
    Ed.select(mcc.id);Ed.seek(mcc.start+1);Ed.switchAngle(1);Ed.seek(mcc.start+2);Ed.switchAngle(0);out.cuts=mcc.nest.cuts.map((k:any)=>[k.t,k.a]);
    const en=(b:any)=>{const d=b.getChannelData(0);let x=0;for(let i=0;i<d.length;i++)x+=d[i]*d[i];return x;};
    out.mcEnergy=en(await Ed.mixAudio(mcc.start+1,1));Ed.p.clips=Ed.p.clips.filter((x:any)=>x.id!==mcc.id);const solo={...A,id:'mcS',start:mcc.start,in:0};Ed.p.clips.push(solo);out.soloEnergy=en(await Ed.mixAudio(mcc.start+1,1));
    Ed.p.clips=Ed.p.clips.filter((x:any)=>x.id!=='mcS');Ed.p.clips.push(mcc);Ed.after(true);
    // the angle viewer: a live picture of every angle, the one showing outlined
    Ed.select(mcc.id);Ed.ptab='basic';Ed.drawProps();Ed.seek(mcc.start+1.5);await Ed.seekExact(mcc.start+1.5);Ed.draw();
    out.angles=[...document.querySelectorAll('.ed-angles canvas')].map((cv:any)=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let lit=0;for(let i=0;i<d.length;i+=4)lit+=d[i]+d[i+1]+d[i+2];return lit>0;});
    out.angleOn=[...document.querySelectorAll('.ed-angle')].map((b:any)=>b.classList.contains('on'));
    Ed.unnest(mcc);const flat=Ed.p.clips.filter((x:any)=>x.media===nz.id);out.flatMc=[flat.filter((x:any)=>x.detached).length,flat.filter((x:any)=>x.asAudio).length];
    Ed.p.clips=Ed.p.clips.filter((x:any)=>x.media!==nz.id);Ed.p.tracks=Ed.p.tracks.filter((t:any)=>t.main||Ed.p.clips.some((c:any)=>c.track===t.id)||t.kind!=='video');Ed.after(true);}
   // audio crossfade at a cut; remove silences (the pause goes, what follows closes up)
   {const tk=Ed.p.tracks.find((t:any)=>t.kind==='audio')||Ed.addTrack('audio'),tw=Ed.media.find((x:any)=>x.name==='talk.wav');
    const A={id:'xa',media:m.id,asAudio:true,track:tk.id,start:10,in:0,dur:1},B={id:'xb',media:m.id,asAudio:true,track:tk.id,start:11,in:.5,dur:1,trans:{type:'crossfade',dur:.4}};
    Ed.p.clips.push(A,B);Ed.after(true);out.spans=[Ed.sndSpan(Ed.clip('xa')),Ed.sndSpan(Ed.clip('xb'))].map((x:any)=>x.map((v:number)=>Math.round(v*100)/100));
    const rms=(b:any,a:number,z:number)=>{const d=b.getChannelData(0);let x=0;for(let i=Math.round(a*48000);i<Math.round(z*48000);i++)x+=d[i]*d[i];return Math.sqrt(x/((z-a)*48000));};
    const mx=await Ed.mixAudio(10,2);out.xfade=rms(mx,.9,1.1)/rms(mx,.3,.6);
    Ed.p.clips=Ed.p.clips.filter((x:any)=>!['xa','xb'].includes(x.id));
    const T1={id:'s1',media:tw.id,track:tk.id,start:20,in:0,dur:3},T2={id:'s2',media:tw.id,track:tk.id,start:24,in:0,dur:1};Ed.p.clips.push(T1,T2);Ed.after(true);
    Ed.sels=new Set(['s1']);Ed.sel='s1';out.removed=await Ed.removeSilences({thr:-38,min:.6,pad:.1});
    const parts=Ed.p.clips.filter((x:any)=>x.media===tw.id&&x.id!=='s2').sort((a:any,b:any)=>a.start-b.start);out.silence={parts:parts.length,dur:Math.round(parts.reduce((s:number,x:any)=>s+x.dur,0)*100)/100,next:Math.round(Ed.clip('s2').start*100)/100,joined:Math.round((parts[1].start-(parts[0].start+parts[0].dur))*1000)};
    Ed.p.clips=Ed.p.clips.filter((x:any)=>x.media!==tw.id);Ed.after(true);}
   // CapCut-style tools: clip animations, a style effect, every transition, text effects, backgrounds, split screen,
   // frame blending, scene detection, colour match, sound effects
   {const mc6=Ed.p.clips.find((x:any)=>x.media===m.id),g6=Ed.dom.canvas.getContext('2d'),[W6,H6]=Ed.size(),px6=(x=W6>>1,y=H6>>1)=>[...g6.getImageData(x,y,1,1).data].slice(0,3);
    mc6.animIn='left';mc6.animDur=.5;out.animDx=Ed.animApply(mc6,.05).dx;delete mc6.animIn;delete mc6.animDur;
    Ed.select(null);Ed.seek(.5);await Ed.seekExact(.5);Ed.draw();const before=px6();mc6.fx={style:'invert',amount:100};Ed.draw();const inv=px6();delete mc6.fx;Ed.draw();
    out.invert=before.map((v:number,i:number)=>Math.abs(255-v-inv[i])<=3);
    for(const st of ED_STYLES.map((x:any)=>x[0]))if(st!=='none'){mc6.fx={style:st,amount:70};Ed.draw();}delete mc6.fx;
    const A2={...JSON.parse(JSON.stringify(mc6)),id:'tA'},B2={...A2,id:'tB'};for(const [ty] of ED_TRANS)for(const p of [.2,.5,.8])Ed.drawTrans(g6,A2,{...B2,trans:{type:ty,dur:.6}},ty,p,.5);
    const tx=Ed.addText(0);const tc=Ed.p.clips.find((x:any)=>x.text!==undefined&&!x.words&&!x.cap&&x.id===Ed.sel);Object.assign(tc,{curve:60,depth:6,glow:50,grad:true,color2:'#00ffff',bubble:true,text:'Curved title'});Ed.draw();Object.assign(tc,{curve:0,bubble:false});Ed.draw();void tx;
    Ed.p.clips=Ed.p.clips.filter((x:any)=>x!==tc);
    Ed.p.bgMode='gradient';Ed.p.bg='#ff0000';Ed.p.bg2='#0000ff';Ed.time=40;Ed.draw();out.bgCorner=px6(1,1);Ed.p.bgMode='color';Ed.p.bg='#000000';delete Ed.p.bg2;Ed.time=.5;
    const tv=Ed.addTrack('video'),L1={...JSON.parse(JSON.stringify(mc6)),id:'L1',track:tv.id},L2={...L1,id:'L2',track:Ed.addTrack('video').id};Ed.p.clips.push(L1,L2);Ed.sels=new Set(['L1','L2']);Ed.layout('2h');
    out.layout=['L1','L2'].map(id=>{const c=Ed.clip(id);return [c.x,c.y];});Ed.p.clips=Ed.p.clips.filter((x:any)=>!['L1','L2'].includes(x.id));
    mc6.speed=.5;mc6.frameBlend=true;Ed.seek(.3);await Ed.seekExact(.3);Ed.draw();out.blendEl=Object.keys(Ed.els).some(k=>k.endsWith('#b'));delete mc6.frameBlend;mc6.speed=1;
    const cm=Ed.media.find((x:any)=>x.name==='cut.mp4'),cc={id:'cc',media:cm.id,track:tv.id,start:30,in:0,dur:2,scale:1,x:0,y:0,rotate:0,opacity:1};Ed.p.clips.push(cc);Ed.after(true);
    out.scenes=await Ed.detectScenes(Ed.clip('cc'));out.sceneAt=Ed.p.clips.filter((x:any)=>x.media===cm.id).map((x:any)=>Math.round(x.start*10)/10).sort();
    Ed.seek(30.5);out.matched=await Ed.colorMatch(Ed.p.clips.find((x:any)=>x.media===cm.id),mc6);out.matchCurves=!!Ed.p.clips.find((x:any)=>x.media===cm.id).grade?.curves?.r;
    Ed.p.clips=Ed.p.clips.filter((x:any)=>x.media!==cm.id);Ed.p.tracks=Ed.p.tracks.filter((t:any)=>t.main||t.kind!=='video'||Ed.p.clips.some((c:any)=>c.track===t.id));
    Ed.seek(45);const sfx=await Ed.addSfx('pop');out.sfx=[!!Ed.media.find((x:any)=>x.name==='SFX Pop.wav'),!!sfx];Ed.p.clips=Ed.p.clips.filter((x:any)=>x!==sfx&&x.id!==sfx?.id);Ed.after(true);}
   // titles: a lower third drawn over the video; the title editor adds a layer and saves it as one undo step
   {Ed.seek(50);const tt=Ed.addTitle(ED_TITLES[0],false);out.titleTrack=Ed.trackOf(tt)?.kind;Ed.time=51.5;Ed.draw();const g7=Ed.dom.canvas.getContext('2d'),[W7,H7]=Ed.size();
    const titleBounds=Ed.box(g7,tt,W7,H7);out.compactTitle=titleBounds.w<W7*.65&&titleBounds.h<H7*.25;
    out.titleBox=[...g7.getImageData(Math.round(W7*.3),Math.round(H7*.86),1,1).data].slice(0,3);out.titleLabel=!!document.querySelector(`[data-cid="${tt.id}"] .ed-clip-label`)?.textContent?.includes('Lower third');
    await edTitleEditor(tt);const n0=tt.title.layers.length;(document.querySelector('.ed-title-ed [data-tadd="text"]') as HTMLElement).click();(document.querySelector('.ed-title-ed [data-save]') as HTMLElement).click();
    const now=Ed.clip(tt.id);out.titleLayers=[n0,now.title.layers.length];Ed.undo();out.titleUndo=Ed.clip(tt.id).title.layers.length;Ed.p.clips=Ed.p.clips.filter((x:any)=>x.id!==tt.id);Ed.after(true);Ed.time=.5;}
   Ed.seek(.5);Ed.setRange('in');Ed.seek(1);Ed.setRange('out');Ed.playRange();out.span=Ed.span&&[Ed.span.s,Ed.span.e];out.playingRange=Ed.playing;Ed.pause();Ed.clearRange();Ed.select(null);
   // export an exact MP4 (the file is handed back here instead of downloaded)
   let file:Blob|null=null;(window as any).edSaveFile=(bl:Blob)=>{file=bl;};
   Ed.seek(.2);Ed.addSticker({type:'graphic',id:'arrow'});
   Object.assign(Ed.clip(Ed.sel),{dur:1,color:'#14ed9a'});
   await Ed.exportVideo({name:'test',height:240,fps:30,format:'mp4',quality:'standard'});
   Ed.undo();
   out.toasts=[...document.querySelectorAll('.toast')].map((t:any)=>t.innerText.replace(/\s+/g,' '));out.mp4=file?btoa(String.fromCharCode(...new Uint8Array(await (file as Blob).arrayBuffer()))):null;
   // project file round trip
   const zip=await Ed.packProject(Ed.p.id),nid=await Ed.importProjectFile(new File([zip],'p.zip'));out.reopened=Ed.readProject(nid).clips.length;out.original=Ed.p.clips.length;
   await Ed.flush();return out;
  });
  expect(r.afterSplit).toBe(2);expect(r.afterUndo).toBe(1);expect(r.afterRedo).toBe(2);
  expect(r.flat).toEqual([128,128,128]);
  expect(r.captions).toBe(1);expect(r.captionFont).toBe('Vazirmatn');
  expect(r.left).toBeLessThan(1e-9);expect(r.right).toBeGreaterThan(1);
  expect(r.marker).toMatchObject({name:'Start',color:'blue'});
  expect(r.splitAll).toBe(2);expect(r.forward).toBe(2);expect(r.noRoom).toBe(true);expect(r.nudged).toBeCloseTo(.3,3);
  expect(r.corner).toBe('scale');expect(r.middle).toBeNull();expect(r.lineRatio).toBeCloseTo(2,1);
  expect(r.tpl1).toEqual({text:'Name Surname',align:'left',box:true});expect(r.swapped).toEqual([0,1]);expect(r.saved).toBe(true);
  expect(r.fastEase).toBeLessThan(.3);expect(r.linEase).toBeCloseTo(.8,2);
  expect(r.zc0).toBeGreaterThan(400);expect(r.zc12/r.zc0).toBeGreaterThan(1.8);expect(r.zc12/r.zc0).toBeLessThan(2.2);expect(r.robot).toBeGreaterThan(0);
  expect(r.fit).toEqual([.5,2]);expect(r.zoom).toEqual([1,1.2]);expect(r.mediaCards).toBe(4);expect(r.importControls).toBe(1);expect(r.extraControls).toBe(0);
  expect(r.audioCards).toBe(1);expect(r.audioImportControls).toBe(1);
  expect(r.nested).toBe(true);expect(r.pxNested).toEqual(r.pxBefore);expect(r.enNested/r.enBefore).toBeGreaterThan(.98);expect(r.enNested/r.enBefore).toBeLessThan(1.02);
  expect(r.pxGraded).toEqual([128,128,128]);expect(r.back).toBe(1);expect(r.noNest).toBe(true);expect(r.restored).toBe(1);
  expect(r.inside).toEqual([1,1,true]);expect(r.savedInside).toBe(.5);expect(r.outside).toEqual([0,true]);expect(r.undoneInside??1).toBe(1);expect(r.afterNestUndo).toBe(1);
  expect(r.mc).toEqual({angles:2,offset:.8,start:3});expect(r.cuts).toEqual([[0,0],[1,1],[2,0]]);expect(r.mcEnergy/r.soloEnergy).toBeGreaterThan(.95);expect(r.mcEnergy/r.soloEnergy).toBeLessThan(1.05);
  expect(r.flatMc).toEqual([3,1]);
  expect(r.angles).toEqual([true,true]);expect(r.angleOn).toEqual([false,true]);
  expect(r.spans).toEqual([[10,11.2],[10.8,12]]);expect(r.xfade).toBeGreaterThan(.5);expect(r.xfade).toBeLessThan(1.6);
  expect(r.removed).toBe(1);expect(r.silence.parts).toBe(2);expect(r.silence.joined).toBe(0);expect(Math.abs(r.silence.dur-2.2)).toBeLessThan(.04);expect(Math.abs(r.silence.next-23.2)).toBeLessThan(.04);
  expect(r.animDx).toBeGreaterThan(.3);expect(r.invert).toEqual([true,true,true]);expect(r.bgCorner[0]).toBeGreaterThan(200);expect(r.bgCorner[2]).toBeLessThan(40);
  expect(r.layout).toEqual([[-.25,0],[.25,0]]);expect(r.blendEl).toBe(true);expect(r.scenes).toBe(1);expect(r.sceneAt).toEqual([30,31]);
  expect(r.matched).toBe(true);expect(r.matchCurves).toBe(true);expect(r.sfx).toEqual([true,true]);
  expect(r.titleTrack).toBe('text');expect(Math.max(...r.titleBox)).toBeLessThan(60);expect(r.titleLabel).toBe(true);expect(r.titleLayers).toEqual([4,5]);expect(r.titleUndo).toBe(4);
  expect(r.compactTitle).toBe(true);
  expect(r.span).toEqual([.5,1]);expect(r.playingRange).toBe(true);
  expect(r.reopened).toBe(r.original);
  expect(r.mp4,JSON.stringify(r.toasts)).toBeTruthy();const out=path.join(tmp,'out.mp4');fs.writeFileSync(out,Buffer.from(r.mp4,'base64'));
  const info=await mediaInfo(out);expect(info.duration).toBeGreaterThan(1.9);expect(info.duration).toBeLessThan(2.2);expect(info.height).toBe(240);expect(info.hasAudio).toBe(true);
  const encodedStickerFrame=path.join(tmp,'encoded-sticker.png');
  await run(ffmpeg,['-v','error','-ss','0.7','-i',out,'-frames:v','1',encodedStickerFrame]);
  const hasStickerColour=await page.evaluate(async encoded=>{
   const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
   const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
   const cv=document.createElement('canvas');cv.width=image.width;cv.height=image.height;
   const g=cv.getContext('2d')!;g.drawImage(image,0,0);image.close();
   const pixels=g.getImageData(cv.width/2-40,cv.height/2-40,80,80).data;
   for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]!-20)<15&&Math.abs(pixels[i+1]!-237)<15&&Math.abs(pixels[i+2]!-154)<15)return true;
   return false;
  },fs.readFileSync(encodedStickerFrame).toString('base64'));
  expect(hasStickerColour).toBe(true);
  // everything is still there after a reload
  await page.reload();await page.waitForFunction(()=>typeof Ed!=='undefined');
  const kept=await page.evaluate(async(pid)=>{await Ed.load();const p=Ed.readProject(pid);return {clips:p.clips.length,markers:p.markers.length,captions:p.clips.filter((x:any)=>x.cap).length};},id);
  expect(kept).toEqual({clips:r.original,markers:1,captions:1});
  await page.locator('.ed-tl').waitFor();
  const transport=page.locator('[data-play]');
  await transport.click();
  await page.waitForFunction(()=>Ed.playing&&Ed.time>0);
  const pauseIcon=await transport.locator('svg').elementHandle();
  const playBox=(await transport.boundingBox())!;
  await page.mouse.move(playBox.x+playBox.width/2,playBox.y+playBox.height/2);
  await page.mouse.down();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  expect(await pauseIcon!.evaluate(icon=>icon.isConnected)).toBe(true);
  await page.mouse.up();
  expect(await transport.getAttribute('aria-label')).toBe('Play');
  expect(await page.evaluate(()=>[Ed.playing,Ed.playFrame,Object.values(Ed.els).every((element:any)=>element.paused)])).toEqual([false,null,true]);

  const pausedAt=await page.evaluate(()=>Ed.time);
  await transport.press('Space');
  await page.waitForFunction(time=>Ed.playing&&Ed.time>time,pausedAt);
  await transport.press('Space');
  expect(await transport.getAttribute('aria-label')).toBe('Play');

  const loop=page.getByRole('button',{name:'Loop',exact:true});
  await loop.click();
  await transport.click();
  await page.evaluate(()=>Ed.seek(Ed.end()-.03));
  await page.waitForFunction(()=>Ed.playing&&Ed.time<.5);
  await transport.click();
  await loop.click();
  await transport.click();
  await page.evaluate(()=>Ed.seek(Ed.end()-.03));
  await page.waitForFunction(()=>!Ed.playing&&Ed.time===Ed.end());
  expect(await page.evaluate(()=>Ed.dom.head.getBoundingClientRect().left-Ed.dom.inner.getBoundingClientRect().left))
   .toBeCloseTo(await page.evaluate(()=>Ed.end()*Ed.zoom),1);
  await page.evaluate(()=>Ed.select(null));
  await page.locator('#ed-fps').selectOption('25',{force:true});
  await page.evaluate(()=>{Ed.seek(0);Ed.select(Ed.p.clips.find((clip:any)=>Ed.mediaOf(clip)?.type==='video').id);});
  expect(await timelineBottom()).toBeCloseTo(emptyTimelineBottom,0);
  await page.getByRole('tab',{name:'Video',exact:true}).click();
  const scale=page.locator('#ed-scale');
  await scale.fill('900');
  await scale.press('Enter');
  expect(await scale.inputValue()).toBe('500');
  await scale.fill('');
  await scale.press('Tab');
  expect(await scale.inputValue()).toBe('500');
  await scale.fill('250');
  await scale.press('Escape');
  expect(await scale.inputValue()).toBe('500');
  await page.evaluate(()=>Ed.flush());
  await page.reload();
  await page.locator('.ed-tl').waitFor();
  expect(await page.evaluate(()=>Ed.fps())).toBe(25);
  const scrubTarget=await page.evaluate(()=>{
   const clip=Ed.p.clips.find((item:any)=>Ed.mediaOf(item)?.type==='video');
   const start=clip.start+clip.dur/4, delta=clip.dur/4;
   Ed.seek(start);
   const clipBounds=Ed.dom.tracks.querySelector(`[data-cid="${clip.id}"]`).getBoundingClientRect();
   const x=Ed.dom.head.getBoundingClientRect().left+2;
   const y=(clipBounds.top+clipBounds.bottom)/2;
   const hit=document.elementFromPoint(x,y);
   return {x,y,start,delta,distance:delta*Ed.zoom,hitHead:hit===Ed.dom.head,
    cursor:getComputedStyle(Ed.dom.head,'::after').cursor};
  });
  expect(scrubTarget.hitHead).toBe(true);
  expect(scrubTarget.cursor).toBe('ew-resize');
  await page.mouse.move(scrubTarget.x,scrubTarget.y);
  await page.mouse.down();
  expect(await page.evaluate(()=>Ed.time)).toBeCloseTo(scrubTarget.start);
  await page.mouse.move(scrubTarget.x+scrubTarget.distance,scrubTarget.y,{steps:5});
  expect(await page.evaluate(()=>Ed.time)).toBeCloseTo(scrubTarget.start+scrubTarget.delta,1);
  expect(await page.evaluate(()=>Ed.playing)).toBe(false);
  await page.mouse.up();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.evaluate(()=>Ed.playing)).toBe(false);
  expect(await page.evaluate(()=>Ed.time)).toBeCloseTo(scrubTarget.start+scrubTarget.delta,1);
  const timelineDrag=await page.evaluate(()=>{
   const clip=Ed.p.clips.find((item:any)=>Ed.mediaOf(item)?.type==='video');
   const zoom=Ed.zoom,snap=Ed.snap;
   Ed.zoom=300;Ed.snap=true;
   const marker=clip.start+.8;
   Ed.p.markers.push({t:marker,name:'Snap test'});
   Ed.seek(clip.start);
   Ed.drawTimeline();
   Ed.dom.scroll.scrollLeft=0;
   const bounds=Ed.dom.tracks.querySelector(`[data-cid="${clip.id}"]`).getBoundingClientRect();
   return {zoom,snap,id:clip.id,marker,x:bounds.left+Math.min(70,bounds.width/2),y:bounds.top+bounds.height/2};
  });
  const ruler=page.locator('.ed-ruler');
  expect(await ruler.getAttribute('data-frames')).not.toBeNull();
  expect(await ruler.evaluate(el=>el.style.getPropertyValue('--ed-tick'))).toBe('12px');
  await page.mouse.move(timelineDrag.x,timelineDrag.y);
  await page.mouse.down();
  await page.mouse.move(timelineDrag.x+237,timelineDrag.y,{steps:4});
  expect(await page.locator('.ed-snap-guide').isVisible()).toBe(true);
  expect(await page.locator('.ed-drag-time').innerText()).toMatch(/^In \d+:\d+:\d+:\d+$/);
  expect(await page.evaluate(id=>Ed.clip(id).start,timelineDrag.id)).toBeCloseTo(timelineDrag.marker);
  await page.mouse.up();
  expect(await page.locator('.ed-snap-guide').isVisible()).toBe(false);
  expect(await page.locator('.ed-drag-time').isVisible()).toBe(false);
  const draggedClip=page.locator(`[data-cid="${timelineDrag.id}"]`);
  await draggedClip.click({button:'right',position:{x:35,y:20}});
  await page.getByRole('button',{name:/Trim tools/}).click();
  expect(await page.getByRole('button',{name:/Roll trim/}).isVisible()).toBe(true);
  await page.getByRole('button',{name:/Slip clip/}).click();
  expect(await page.evaluate(()=>Ed.dom.scroll.edNextTrim.tool)).toBe('slip');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>Ed.dom.scroll.edNextTrim)).toBeNull();
  const synced=await page.evaluate(id=>{
   const origin=Ed.clip(id),track=Ed.p.tracks.find((item:any)=>item.kind==='text');
   const prior=track.syncLock??null,start=origin.start+origin.dur+.5;
   track.syncLock=true;
   Ed.p.clips.push({id:'sync-trim-test',track:track.id,start,dur:.25,text:'Sync test'});
   Ed.drawTimeline();
   return {start,track:track.id,prior};
  },timelineDrag.id);
  const trimHandle=draggedClip.locator('[data-h=r]');
  await trimHandle.click({button:'right'});
  await page.getByRole('button',{name:/Ripple trim/}).click();
  const trimBounds=(await trimHandle.boundingBox())!;
  const duration=await page.evaluate(id=>Ed.clip(id).dur,timelineDrag.id);
  const trimX=trimBounds.x+trimBounds.width/2,trimY=trimBounds.y+trimBounds.height/2;
  await page.mouse.move(trimX,trimY);
  await page.mouse.down();
  await page.mouse.move(trimX-60,trimY,{steps:3});
  expect(await page.locator('.ed-drag-time').innerText()).toMatch(/^Out /);
  await page.mouse.up();
  expect(await page.evaluate(id=>Ed.clip(id).dur,timelineDrag.id)).toBeCloseTo(duration-.2,1);
  expect(await page.evaluate(()=>Ed.clip('sync-trim-test').start)).toBeCloseTo(synced.start-.2,1);
  await page.evaluate(()=>Ed.undo());
  await page.evaluate(({track,prior})=>{
   Ed.p.clips=Ed.p.clips.filter((clip:any)=>clip.id!=='sync-trim-test');
   const linked=Ed.p.tracks.find((item:any)=>item.id===track);
   if(prior===null)delete linked.syncLock;else linked.syncLock=prior;
   Ed.drawTimeline();
  },synced);
  const edgeDrag=await page.evaluate(()=>{
   Ed.seek(.5);
   const scroll=Ed.dom.scroll.getBoundingClientRect(),head=Ed.dom.head.getBoundingClientRect();
   return {x:head.left+2,y:scroll.top+45,right:scroll.left+Ed.dom.scroll.clientWidth-4};
  });
  await page.mouse.move(edgeDrag.x,edgeDrag.y);
  await page.mouse.down();
  await page.mouse.move(edgeDrag.right,edgeDrag.y);
  await expect.poll(()=>page.evaluate(()=>Ed.dom.scroll.scrollLeft)).toBeGreaterThan(20);
  await page.mouse.up();
  expect(await page.evaluate(()=>Ed.playing)).toBe(false);
  await page.evaluate(({zoom,snap})=>{
   Ed.undo();
   Ed.p.markers=Ed.p.markers.filter((marker:any)=>marker.name!=='Snap test');
   Ed.zoom=zoom;Ed.snap=snap;Ed.dom.scroll.scrollLeft=0;Ed.select(null);Ed.drawTimeline();
  },timelineDrag);
  await page.evaluate(()=>Ed.seek(0));
  await page.getByRole('tab',{name:'Captions',exact:true}).click();
  const captionTools=page.getByRole('region',{name:'Auto captions'});
  const subtitleFiles=page.getByRole('region',{name:'Subtitle files'});
  expect(await captionTools.getByRole('combobox',{name:'Spoken language'}).isVisible()).toBe(true);
  expect(await captionTools.getByRole('button',{name:'Generate captions'}).isVisible()).toBe(true);
  expect(await subtitleFiles.getByRole('button',{name:'Import SRT or VTT'}).isVisible()).toBe(true);
  expect(await subtitleFiles.getByRole('button',{name:'Export SRT'}).isEnabled()).toBe(true);
  await library.getByRole('button',{name:/^Spotlight/}).click();
  await library.getByRole('button',{name:'Apply style to all captions'}).click();
  expect(await page.evaluate(()=>Ed.p.clips.some((clip:any)=>clip.capLook==='highlight'&&clip.hl==='#78efbc'))).toBe(true);
  await audioTab.click();
  await effects.click();
  await whoosh.click();
  await page.waitForFunction(()=>Ed.p.clips.some((clip:any)=>Ed.mediaOf(clip)?.name==='SFX Whoosh.wav'));
  expect(await whoosh.isVisible()).toBe(true);
  const findTimeline=timeline.getByRole('button',{name:'Find in timeline'});
  await findTimeline.click();
  const findDialog=page.getByRole('dialog',{name:'Find in timeline'});
  await findDialog.getByRole('searchbox').fill('Whoosh');
  await findDialog.getByRole('searchbox').press('Enter');
  expect(await page.evaluate(()=>Ed.mediaOf(Ed.clip(Ed.sel)).name)).toBe('SFX Whoosh.wav');
  await findDialog.getByRole('searchbox').press('Escape');
  const foundClip=await page.evaluate(()=>{const clip=Ed.clip(Ed.sel);return {start:clip.start,end:clip.start+clip.dur};});
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(()=>Ed.time)).toBeCloseTo(foundClip.end);
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(()=>Ed.time)).toBeCloseTo(foundClip.start);
  await timeline.getByRole('button',{name:'Zoom to selection'}).click();
  expect(await page.evaluate(()=>{
   const clip=Ed.clip(Ed.sel),node=Ed.dom.tracks.querySelector(`[data-cid="${clip.id}"]`);
   const sc=Ed.dom.scroll.getBoundingClientRect(),bounds=node.getBoundingClientRect();
   return bounds.left>=sc.left-1&&bounds.right<=sc.right+1;
  })).toBe(true);
  const oldHeights=await page.evaluate(()=>{
   const heights=Ed.p.tracks.map((track:any)=>track.h??null);
   Ed.p.tracks.forEach((track:any)=>{track.h=140;});Ed.drawTimeline();
   return heights;
  });
  const fitTracks=timeline.getByRole('button',{name:'Fit tracks',exact:true});
  await fitTracks.click();
  expect(await fitTracks.getAttribute('aria-pressed')).toBe('true');
  expect(await page.evaluate(()=>Ed.dom.tracks.querySelector('.ed-lane.main').offsetHeight)).toBeLessThan(140);
  expect(await page.evaluate(()=>Ed.p.tracks.every((track:any)=>track.h===140))).toBe(true);
  await fitTracks.click();
  expect(await page.evaluate(()=>Ed.dom.tracks.querySelector('.ed-lane.main').offsetHeight)).toBe(140);
  await page.evaluate(heights=>{Ed.p.tracks.forEach((track:any,i:number)=>{if(heights[i]===null)delete track.h;else track.h=heights[i];});Ed.drawTimeline();},oldHeights);
  const linkTrack=page.getByRole('complementary',{name:'Tracks',exact:true}).getByRole('button',{name:/Sync Lock for/}).first();
  await linkTrack.click();
  expect(await linkTrack.getAttribute('aria-pressed')).toBe('true');
  await linkTrack.click();
  await page.setViewportSize({width:390,height:844});
  const rail=page.getByRole('complementary',{name:'Tracks',exact:true});
  expect(await rail.getByRole('button',{name:'Add a track'}).count()).toBe(0);
  expect(await timeline.locator('.ed-tools').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.evaluate(()=>{
   Ed.p.clips.at(-1).start=120;
   Ed.drawTimeline();
  });
  await timeline.getByRole('button',{name:'Fit timeline'}).click();
  const fit=await page.evaluate(()=>{
   const scroll=Ed.dom.scroll.getBoundingClientRect();
   const firstLane=Ed.dom.tracks.querySelector('.ed-lane[data-track]').getBoundingClientRect();
   const firstTrack=Ed.dom.heads.querySelector('.ed-head').getBoundingClientRect();
   const last=Ed.p.clips.reduce((a:any,b:any)=>a.start+a.dur>b.start+b.dur?a:b);
   return {right:Ed.dom.tracks.querySelector('[data-cid="'+last.id+'"]').getBoundingClientRect().right,
    edge:scroll.right,zoom:Ed.zoom,aligned:firstLane.top===firstTrack.top,joined:Ed.dom.cover.closest('.ed-cover-strip').getBoundingClientRect().right===scroll.left};
  });
  expect(fit.aligned).toBe(true);
  expect(fit.joined).toBe(true);
  expect(fit.right).toBeLessThan(fit.edge);
  expect(fit.zoom).toBeLessThan(10);
  const exportButton=page.locator('.ed-top [data-export]');
  expect(await exportButton.evaluate(button=>getComputedStyle(button).backgroundColor)).toBe('rgb(47, 107, 224)');
  await exportButton.click();
  const exportDialog=page.getByRole('dialog',{name:'Export',exact:true});
  const exportSurface=exportDialog.locator('.dialog');
  expect(await exportSurface.evaluate(surface=>{
   const style=getComputedStyle(surface);
   return [style.borderRadius,style.backgroundColor,surface.scrollWidth<=surface.clientWidth];
  })).toEqual(['8px','rgb(37, 37, 37)',true]);
  const preset=exportDialog.getByRole('combobox',{name:/^Preset:/});
  await preset.click();
  const options=page.getByRole('listbox');
  expect(await options.evaluate(menu=>getComputedStyle(menu).borderRadius)).toBe('6px');
  await preset.press('Escape');
  expect(await options.isVisible()).toBe(false);
  await exportDialog.getByRole('button',{name:'Close dialog',exact:true}).click();
  expect(await exportDialog.isVisible()).toBe(false);
  expect(await exportButton.evaluate(button=>button===document.activeElement)).toBe(true);
  const previewOptions=page.locator('.ed-player-menu summary');
  await previewOptions.click();
  const previewActions=page.getByRole('group',{name:'Preview actions'});
  expect(await previewActions.evaluate(menu=>getComputedStyle(menu).backgroundColor)).toBe('rgb(48, 48, 48)');
  await previewActions.getByRole('button',{name:'Fit preview'}).press('Escape');
  expect(await previewActions.isVisible()).toBe(false);
  const cover=timeline.getByRole('region',{name:'Cover',exact:true});
  expect(await cover.getByRole('heading',{name:'Cover',exact:true}).isVisible()).toBe(true);
  expect(await cover.evaluate(region=>{
   const bounds=region.querySelector('.ed-cover')!.getBoundingClientRect();
   const lane=document.querySelector('.ed-lane.main')!.getBoundingClientRect();
   const rail=document.querySelector('.ed-heads-wrap')!.getBoundingClientRect();
   return bounds.top===lane.top&&bounds.bottom===lane.bottom&&bounds.left===rail.right&&bounds.right===lane.left;
  })).toBe(true);
  await page.evaluate(()=>Ed.seek(.5));
  const clipCount=await page.evaluate(()=>Ed.p.clips.length);
  await cover.getByRole('button',{name:'Add cover'}).click();
  await page.getByRole('button',{name:'Use current frame'}).click();
  const coverThumbnail=cover.locator('img');
  await coverThumbnail.waitFor();
  const captured=await coverThumbnail.getAttribute('src');
  expect(captured).toMatch(/^data:image\/jpeg;base64,/);
  const png=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=16;
   const context=canvas.getContext('2d')!;context.fillStyle='orange';context.fillRect(0,0,32,16);
   return canvas.toDataURL().split(',')[1];
  });
  await cover.locator('[data-cover-file]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(original=>document.querySelector('.ed-cover img')?.getAttribute('src')!==original,captured);
  const uploaded=await coverThumbnail.getAttribute('src');
  expect(uploaded).toMatch(/^data:image\/jpeg;base64,/);
  expect(await page.evaluate(()=>Ed.p.clips.length)).toBe(clipCount);
  const packedCover=await page.evaluate(async()=>{
   const zip=await Ed.packProject(Ed.p.id);
   const imported=await Ed.importProjectFile(new File([zip],'with-cover.zip'));
   return Ed.list().find((entry:any)=>entry.id===imported)?.coverImage;
  });
  expect(packedCover).toBe(uploaded);
  await page.reload();
  await coverThumbnail.waitFor();
  expect(await coverThumbnail.getAttribute('src')).toBe(uploaded);
  await cover.getByRole('button',{name:'Edit cover'}).click();
  const [coverDownload]=await Promise.all([
   page.waitForEvent('download'),page.getByRole('button',{name:'Download cover'}).click(),
  ]);
  expect(coverDownload.suggestedFilename()).toBe('Editor test - cover.jpg');
  await cover.getByRole('button',{name:'Edit cover'}).click();
  await page.getByRole('button',{name:'Remove cover'}).click();
  expect(await cover.getByRole('button',{name:'Add cover'}).isVisible()).toBe(true);
  await page.setViewportSize({width:1440,height:900});
  await mediaTab.click();
  const composition=await page.evaluate(()=>{
   const clip=Ed.p.clips.find((item:any)=>item.track===Ed.main().id&&Ed.mediaOf(item)?.type==='video');
   Ed.seek(clip.start+.1);
   return {base:clip.id,name:Ed.mediaOf(clip).name,time:Ed.time};
  });
  const timelineHeight=(await timeline.boundingBox())!.height;
  await library.getByRole('button',{name:`Add ${composition.name} as overlay`,exact:true}).click();
  const layer=await page.evaluate(({base})=>{
   const clip=Ed.clip(Ed.sel),main=Ed.clip(base);
   const [width,height]=Ed.size(),box=Ed.rect(clip,width,height),source=Ed.mediaOf(clip);
   return {id:clip.id,start:clip.start,above:Ed.p.tracks.findIndex((track:any)=>track.id===clip.track)<Ed.p.tracks.findIndex((track:any)=>track.id===main.track),
    fits:box.w<=width*.55&&box.h<=height*.55,notEnlarged:box.w<=source.w&&box.h<=source.h};
  },composition);
  expect(layer.above).toBe(true);
  expect(layer.fits&&layer.notEnlarged).toBe(true);
  expect(layer.start).toBeCloseTo(composition.time);
  expect((await timeline.boundingBox())!.height).toBeCloseTo(timelineHeight,0);
  const previewBounds=(await page.locator('.ed-preview-canvas').boundingBox())!;
  const center={x:previewBounds.x+previewBounds.width/2,y:previewBounds.y+previewBounds.height/2};
  const positions=()=>page.evaluate(({base,id})=>[Ed.val(Ed.clip(base),'x'),Ed.val(Ed.clip(id),'x')],{base:composition.base,id:layer.id});
  const baselinePositions=await positions();
  await page.evaluate(base=>Ed.select(base),composition.base);
  await page.mouse.move(center.x,center.y);await page.mouse.down();
  await page.mouse.move(center.x+34,center.y,{steps:4});await page.mouse.up();
  const underlayMoved=await positions();
  expect(underlayMoved[0]).toBeGreaterThan(baselinePositions[0]!);
  expect(underlayMoved[1]).toBe(baselinePositions[1]);
  await page.evaluate(()=>Ed.undo());
  await page.mouse.click(center.x,center.y);
  expect(await page.evaluate(()=>Ed.sel)).toBe(layer.id);
  await detailsTabs.getByRole('tab',{name:'Video',exact:true}).click();
  await details.getByRole('button',{name:'Lock position',exact:true}).click();
  expect(await details.getByRole('spinbutton',{name:'Position X',exact:true}).isDisabled()).toBe(true);
  await page.mouse.move(center.x,center.y);await page.mouse.down();
  await page.mouse.move(center.x+34,center.y,{steps:4});await page.mouse.up();
  expect(await positions()).toEqual(baselinePositions);
  await details.getByRole('button',{name:'Unlock position',exact:true}).click();
  expect(await details.getByRole('spinbutton',{name:'Position X',exact:true}).isEnabled()).toBe(true);
  await page.keyboard.down('Alt');await page.mouse.click(center.x,center.y);await page.keyboard.up('Alt');
  expect(await page.evaluate(()=>Ed.sel)).toBe(composition.base);
  await timeline.locator(`[data-cid="${layer.id}"]`).click({button:'right',position:{x:20,y:20}});
  await page.getByRole('button',{name:/^Keyframes/}).click();
  await page.getByRole('button',{name:'Add opacity keyframe'}).click();
  expect(await page.evaluate(id=>Ed.clip(id).kf.opacity.length,layer.id)).toBe(1);
  await page.evaluate(()=>Ed.undo());
  await page.evaluate(({base,id})=>{Ed.sels=new Set([base,id]);Ed.sel=id;Ed.drawTimeline();},{base:composition.base,id:layer.id});
  await timeline.getByRole('button',{name:'Combine selected clips'}).click();
  await page.getByRole('button',{name:'Create compound clip'}).click();
  expect(await page.evaluate(()=>Ed.clip(Ed.sel).nest.clips.length)).toBe(2);
  await page.evaluate(()=>{Ed.undo();Ed.undo();});
  await page.evaluate(encoded=>{
   const drop=Ed.dom.tracks.querySelector('[data-new=top]');
   const bounds=drop.getBoundingClientRect(),transfer=new DataTransfer();
   transfer.items.add(new File([Uint8Array.from(atob(encoded),char=>char.charCodeAt(0))],'Timeline photo.png',{type:'image/png'}));
   drop.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:bounds.left+40,clientY:bounds.top+5}));
  },png);
  await page.waitForFunction(()=>Ed.p.clips.some((item:any)=>Ed.mediaOf(item)?.name==='Timeline photo.png'));
  expect(await page.evaluate(()=>{
   const photo=Ed.p.clips.find((item:any)=>Ed.mediaOf(item)?.name==='Timeline photo.png');
   return Ed.p.tracks.indexOf(Ed.trackOf(photo))<Ed.p.tracks.indexOf(Ed.main());
  })).toBe(true);
  await page.evaluate(()=>Ed.undo());
  const beforeReview=await page.evaluate(()=>{
   const clip=Ed.p.clips.find((item:any)=>Ed.mediaOf(item)?.type==='video'&&item.dur>.2);
   Ed.p.range={in:clip.start+clip.dur/4,out:clip.start+clip.dur/2};
   Ed.drawTimeline();
   return Ed.p.clips.length;
  });
  const rangeTools=timeline.getByRole('button',{name:'Range and review tools'});
  await rangeTools.click();
  await page.getByRole('button',{name:'Add range note',exact:true}).click();
  await page.getByRole('textbox',{name:'Note',exact:true}).fill('Keep the opening pause');
  await page.getByRole('button',{name:'Save note'}).click();
  expect(await timeline.getByRole('button',{name:'Range note: Keep the opening pause'}).isVisible()).toBe(true);
  await rangeTools.click();
  await page.getByRole('button',{name:'Edit marked range'}).click();
  await page.getByRole('button',{name:'Review boundary splits'}).click();
  const review=timeline.getByRole('region',{name:'Timeline review'});
  expect(await review.getByRole('button',{name:'Apply selected'}).isDisabled()).toBe(true);
  expect(await page.evaluate(()=>Ed.p.clips.length)).toBe(beforeReview);
  await review.getByRole('checkbox',{name:'Approve cut 1'}).check();
  await review.getByRole('button',{name:'Apply selected'}).click();
  expect(await page.evaluate(()=>Ed.p.clips.length)).toBe(beforeReview+1);
  await page.evaluate(()=>Ed.undo());
  expect(await page.evaluate(()=>Ed.p.clips.length)).toBe(beforeReview);
  let sentNotes:unknown;
  await page.route('**/api/editor/suggest-cuts*',async route=>{
   sentNotes=route.request().postDataJSON().notes;
   await route.fulfill({json:{cuts:[{id:0,reason:'Shorten this pause.'}]}});
  });
  await page.evaluate(()=>{
   const range=Ed.rangeSpan(),clip=Ed.p.clips.find((item:any)=>Ed.mediaOf(item)?.type==='video'&&item.start<=range.s&&item.start+item.dur>=range.e);
   (window as any).edReviewCuts({project:Ed.p,range,cuts:[{clip,source:JSON.stringify(clip),a:range.s,b:range.e,kind:'ripple',label:'Test clip'}]});
  });
  await review.getByRole('button',{name:'Ask AI to suggest cuts'}).click();
  await page.getByRole('textbox',{name:'Editing instructions'}).fill('Tighten the dialogue.');
  await page.getByRole('button',{name:'Get suggestions'}).click();
  await review.getByText('Shorten this pause.',{exact:true}).waitFor();
  expect(sentNotes).toEqual([expect.objectContaining({text:'Keep the opening pause'})]);
  expect(await review.getByRole('button',{name:'Apply selected'}).isDisabled()).toBe(true);
  await review.getByRole('button',{name:'Close timeline review'}).click();
  await exportButton.click();
  await exportDialog.getByRole('textbox',{name:'Name',exact:true}).fill('Range review test');
  await exportDialog.getByRole('button',{name:'Check timeline'}).click();
  await review.getByRole('button',{name:'Back to export'}).click();
  expect(await exportDialog.getByRole('textbox',{name:'Name',exact:true}).inputValue()).toBe('Range review test');
  await exportDialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(errors).toEqual([]);
 }finally{await browser.close();await server.close();process.env=before;fs.rmSync(tmp,{recursive:true,force:true});}
},180000);
