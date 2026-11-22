// The Editor page in a real browser: import a clip through the file picker, edit, grade, caption, mix, export an MP4
// (checked with ffprobe), pack and reopen a project file, and reload with everything kept. RUN_BROWSER_TESTS=1.
import {it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Ed:any;declare const edParseSubs:any;declare const edHandleAt:any;

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
  // import like a person: the file picker
  await page.locator('.editor > input[type=file]').setInputFiles(clip);
  await page.waitForFunction(()=>Ed.media.some((m:any)=>m.name==='clip.mp4'&&m.dur>1.9));

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
   Ed.setRange('in');Ed.seek(1);Ed.setRange('out');Ed.playRange();out.span=Ed.span&&[Ed.span.s,Ed.span.e];out.playingRange=Ed.playing;Ed.pause();Ed.clearRange();Ed.select(null);
   // export an exact MP4 (the file is handed back here instead of downloaded)
   let file:Blob|null=null;(window as any).edSaveFile=(bl:Blob)=>{file=bl;};
   await Ed.exportVideo({name:'test',height:240,fps:30,format:'mp4',quality:'standard'});
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
  expect(r.span).toEqual([.5,1]);expect(r.playingRange).toBe(true);
  expect(r.reopened).toBe(r.original);
  expect(r.mp4,JSON.stringify(r.toasts)).toBeTruthy();const out=path.join(tmp,'out.mp4');fs.writeFileSync(out,Buffer.from(r.mp4,'base64'));
  const info=await mediaInfo(out);expect(info.duration).toBeGreaterThan(1.9);expect(info.duration).toBeLessThan(2.2);expect(info.height).toBe(240);expect(info.hasAudio).toBe(true);
  // everything is still there after a reload
  await page.reload();await page.waitForFunction(()=>typeof Ed!=='undefined');
  const kept=await page.evaluate(async(pid)=>{await Ed.load();const p=Ed.readProject(pid);return {clips:p.clips.length,markers:p.markers.length,captions:p.clips.filter((x:any)=>x.cap).length};},id);
  expect(kept).toEqual({clips:r.original,markers:1,captions:1});
  expect(errors).toEqual([]);
 }finally{await browser.close();await server.close();process.env=before;fs.rmSync(tmp,{recursive:true,force:true});}
},180000);
