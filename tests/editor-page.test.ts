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
    // media folders and search
    Ed.tab='media';m.folder='Interviews';Ed.drawLib();out.folders=[...document.querySelectorAll('.ed-folders [data-folder]')].map((b:any)=>b.textContent);
    const ms:any=document.querySelector('[data-msearch]');ms.value='zzz';ms.dispatchEvent(new Event('input'));out.hidden=(document.querySelector('.ed-media') as any).hidden;ms.value='';ms.dispatchEvent(new Event('input'));delete m.folder;Ed.drawLib();}
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
    out.titleBox=[...g7.getImageData(Math.round(W7*.3),Math.round(H7*.86),1,1).data].slice(0,3);out.titleLabel=!!document.querySelector(`[data-cid="${tt.id}"] .ed-clip-label`)?.textContent?.includes('Lower third');
    await edTitleEditor(tt);const n0=tt.title.layers.length;(document.querySelector('.ed-title-ed [data-tadd="text"]') as HTMLElement).click();(document.querySelector('.ed-title-ed [data-save]') as HTMLElement).click();
    const now=Ed.clip(tt.id);out.titleLayers=[n0,now.title.layers.length];Ed.undo();out.titleUndo=Ed.clip(tt.id).title.layers.length;Ed.p.clips=Ed.p.clips.filter((x:any)=>x.id!==tt.id);Ed.after(true);Ed.time=.5;}
   Ed.seek(.5);Ed.setRange('in');Ed.seek(1);Ed.setRange('out');Ed.playRange();out.span=Ed.span&&[Ed.span.s,Ed.span.e];out.playingRange=Ed.playing;Ed.pause();Ed.clearRange();Ed.select(null);
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
  expect(r.tpl1).toEqual({text:'Name Surname',align:'left',box:true});expect(r.swapped).toEqual([0,1]);expect(r.saved).toBe(true);
  expect(r.fastEase).toBeLessThan(.3);expect(r.linEase).toBeCloseTo(.8,2);
  expect(r.zc0).toBeGreaterThan(400);expect(r.zc12/r.zc0).toBeGreaterThan(1.8);expect(r.zc12/r.zc0).toBeLessThan(2.2);expect(r.robot).toBeGreaterThan(0);
  expect(r.fit).toEqual([.5,2]);expect(r.zoom).toEqual([1,1.2]);expect(r.folders).toEqual(['All','Interviews']);expect(r.hidden).toBe(true);
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
