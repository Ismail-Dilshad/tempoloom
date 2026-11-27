// The Editor's pure logic (no browser): its page scripts are loaded in a sandbox, in the order index.html loads them,
// and their helpers are tested directly. Runs with every `pnpm test`.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ui=path.resolve('src/teach/ui');
/** The editor scripts, in page order (so this keeps working when the code is split into more files). */
const scripts=[...fs.readFileSync(path.join(ui,'index.html'),'utf8').matchAll(/<script src="\/([^"]+)"><\/script>/g)].map(m=>m[1]!).filter(n=>/^editor/.test(n));
function sandbox(){
 const noop=()=>{},el=()=>({getContext:()=>null,addEventListener:noop,style:{}});
 const ctx=vm.createContext({console,Blob,AbortController,TextEncoder,TextDecoder,URL,Intl,setTimeout,clearTimeout,structuredClone,
  Path2D:class{constructor(readonly data:string){}},
  window:{addEventListener:noop},document:{addEventListener:noop,createElement:el,fonts:{load:async()=>{}},documentElement:{}},navigator:{},
  localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},indexedDB:{},toast:noop,ask:async()=>true,dialog:noop,closeDialog:noop,$:()=>null,
  App:{register:noop},Pop:{open:()=>null,close:noop},I:new Proxy({},{get:()=>''}),esc:(s:string)=>String(s),withKey:(u:string)=>u,requestAnimationFrame:noop,getComputedStyle:()=>({getPropertyValue:()=>''})});
 for(const s of scripts)vm.runInContext(fs.readFileSync(path.join(ui,s),'utf8'),ctx,{filename:s});
 return <T,>(name:string)=>vm.runInContext(name,ctx) as T;
}
const get=sandbox();
type Fn=(...a:never[])=>unknown;
const f=<T extends Fn>(n:string)=>get<T>(n);

describe('editor actions',()=>{
 it('preloads nested footage, images, title fonts, and grades before rendering export frames',async()=>{
  const work=await sandbox()<Promise<{calls:string[];waiting:boolean}>>(`(async()=>{
   const calls=[];let imageReady,ready=false;
   document.fonts.load=async(font,text)=>calls.push(font+' '+text);
   const image={id:'logo',name:'Logo',type:'image'},video={id:'source',name:'Video',type:'video'};
   const leaf={id:'inner',nest:{tracks:[],clips:[{id:'a',media:'logo'},{id:'b',media:'logo'},
    {id:'v',media:'source',grade:{lut:{id:'look'}}},{title:{layers:[{type:'text',font:'Fixture Font',text:'Welcome'}]}}]}};
   const state=Object.assign(Object.create(Ed),{p:{clips:[{id:'outer',nest:{tracks:[],clips:[leaf]}}]},
    k:()=>.5,mediaOf:c=>c.media==='logo'?image:c.media==='source'?video:undefined,
    loadLuts:async()=>calls.push('grades'),image:()=>({decode:()=>new Promise(resolve=>{calls.push('image');imageReady=resolve;})}),
    element(c){calls.push(this._nk+c.id);return {readyState:2,seeking:false};}});
   const done=state.exportReady().then(()=>{ready=true;});
   await Promise.resolve();await Promise.resolve();
   if(!imageReady)throw new Error('Nested image was not decoded');
   const waiting=!ready;imageReady();await done;
   return {calls,waiting};
  })()`);
  expect(work.waiting).toBe(true);
  expect(work.calls).toEqual(['grades','image','outer/inner/v','600 20px "Fixture Font", "Tempoloom UI", system-ui, sans-serif Welcome']);
 });
 it('projects front, side, and back faces of a 3D box and changes its silhouette with depth',()=>{
  const faces=get<(x:number,y:number,depth:number)=>{points:number[][];shade:number}[]>('edBoxFaces');
  expect(faces(0,0,.58).map(face=>face.shade)).toEqual([1]);
  expect(faces(0,180,.58).map(face=>face.shade)).toEqual([.73]);
  expect(faces(-18,28,.58)).toHaveLength(3);
  expect(faces(-18,28,.1)).not.toEqual(faces(-18,28,1));
 });
 it('draws OBJ faces back to front and changes their projection with tilt',()=>{
  const project=get<(mesh:object,x:number,y:number,depth:number)=>{points:number[][];z:number}[]>('edMeshFaces');
  const mesh={vertices:[[-.2,-.2,.2],[.2,-.2,.2],[0,.2,.2],[-.2,-.2,-.2],[.2,-.2,-.2],[0,.2,-.2]],
   triangles:[[0,1,2],[3,4,5]]};
  const front=project(mesh,0,0,1);
  expect(front.map(face=>face.z)).toEqual([-.20000000000000004,.20000000000000004]);
  expect(project(mesh,20,65,1)[0]?.points).not.toEqual(front[0]?.points);
 });
 it('draws editable vector title layers in canvas coordinates and keeps their selection bounds',()=>{
  const result=get<{bounds:{x0:number;y0:number;x1:number;y1:number}[];paint:unknown[]}>(`(()=>{
   const paint=[],g={save(){},restore(){},translate(){},scale(){},fill:(path,rule)=>paint.push([path.data,rule]),
    stroke:path=>paint.push(path.data)};
   const path={type:'path',d:'M0,20L90,100Z',x:.5,y:.5,w:.8,h:.5,fill:'#000000',line:1};
   return {bounds:edDrawTitle(g,{layers:[path]},200,100,1),paint};
  })()`);
  expect(result.bounds).toMatchObject([{x0:20,y0:25,x1:180,y1:75}]);
  expect(result.paint).toEqual([['M0,20L90,100Z','evenodd'],'M0,20L90,100Z']);
 });
 it('keeps opted-in tracks aligned after a ripple delete and leaves other tracks alone',()=>{
  const state=sandbox()<Record<string,number>>(`(()=>{
   const origin={id:'main'},linked={id:'audio',syncLock:true},unlinked={id:'text'},locked={id:'overlay',syncLock:true,locked:true};
   const tracks=[origin,linked,unlinked,locked];
   const removed={id:'cut',track:'main',start:1,dur:2};
   const clips=[removed,...tracks.map(track=>({id:track.id,track:track.id,start:3,dur:1}))];
   const editor=Object.assign(Object.create(Ed),{p:{tracks,clips},els:{},picked:()=>[removed],snapshot(){},pick(){},after(){}});
   editor.rippleRemove();
   return Object.fromEntries(editor.p.clips.map(clip=>[clip.id,clip.start]));
  })()`);
  expect(state).toEqual({main:1,audio:1,text:3,overlay:3});
 });
 it('blocks a ripple when a linked clip crosses the edit and deduplicates aligned cuts',()=>{
  const result=sandbox()<unknown[]>(`(()=>{
   const tracks=[{id:'main'},{id:'overlay'},{id:'audio',syncLock:true}];
   const clip={track:'audio',start:2,dur:2},editor={p:{tracks,clips:[clip]}};
   const edits=[{track:'main',at:1,delta:-2},{track:'overlay',at:1,delta:-2}];
   const blocked=Ed.syncRipplePlan.call(editor,edits);
   clip.start=4;
   return [blocked,Ed.syncRipplePlan.call(editor,edits).get(clip),clip.start];
  })()`);
  expect(result).toEqual([null,2,4]);
 });
 it('toggles markers by project frame and keeps neighboring markers',()=>{
  const result=sandbox()<number[][]>(`(()=>{
   const editor={fps:()=>60,time:1,p:{markers:[]},snapshot(){},after(){}};
   const toggle=()=>Ed.toggleMarker.call(editor);
   toggle();editor.time=61/60;toggle();
   const added=editor.p.markers.map(edMt);
   toggle();
   return [added,editor.p.markers.map(edMt)];
  })()`);
  expect(result).toEqual([[1,61/60],[1]]);
 });
 it('applies transitions only to eligible cuts and skips undo for no changes',()=>{
  const result=sandbox()<number[]>(`(()=>{
   const clips=[{id:'first'},{id:'next'},{id:'locked',locked:true}];
   let snapshots=0;
   const editor={p:{clips},kindOf:()=> 'video',prevOf:clip=>clip.id!=='first',
    trackOf:clip=>({locked:clip.locked}),snapshot(){snapshots++;},after(){}};
   const change=type=>Ed.transAll.call(editor,type,.6);
   return [change('none'),change('fade'),change('none'),change('none'),snapshots];
  })()`);
  expect(result).toEqual([0,1,1,0,2]);
 });
 it('suppresses a WAV download when cancelled during the mix',async()=>{
  const result=await sandbox()<Promise<unknown[]>>(`(async()=>{
   let downloads=0,finishMix;
   edSaveFile=()=>{downloads++;};
   const editor={pause(){},end:()=>1,drawExport(){},async ensureEnvs(){},
    mixAudio:()=>new Promise(resolve=>{finishMix=resolve;})};
   const exporting=Ed.exportSound.call(editor,{format:'wav',name:'test'});
   await Promise.resolve();
   Ed.cancelExport.call(editor);
   finishMix(null);
   await exporting;
   return [downloads,editor.exporting];
  })()`);
  expect(result).toEqual([0,null]);
 });
 it('aborts MP3 conversion and suppresses its download',async()=>{
  const result=await sandbox()<Promise<unknown[]>>(`(async()=>{
   let downloads=0, signal, finishConversion, beginConversion;
   const converting=new Promise(resolve=>{beginConversion=resolve;});
   edSaveFile=()=>{downloads++;};
   edWav=()=>new Blob();
   globalThis.fetch=(_url,options)=>{
    signal=options.signal;
    beginConversion();
    return new Promise(resolve=>{finishConversion=resolve;});
   };
   const editor={pause(){},end:()=>1,drawExport(){},async ensureEnvs(){},async mixAudio(){}};
   const exporting=Ed.exportSound.call(editor,{format:'mp3',name:'test'});
   await converting;
   Ed.cancelExport.call(editor);
   finishConversion({ok:true,blob:async()=>new Blob()});
   await exporting;
   return [downloads,signal.aborted,editor.exporting];
  })()`);
  expect(result).toEqual([0,true,null]);
 });
 it('stops capture and prevents the recorder from starting when cancelled before recording',async()=>{
  const result=await sandbox()<Promise<unknown[]>>(`(async()=>{
   let startRecording,starts=0,stops=0;
   globalThis.setTimeout=callback=>{startRecording=callback;return 1;};
   globalThis.clearTimeout=()=>{};
   globalThis.MediaStream=class {};
   globalThis.MediaRecorder=class {
    static isTypeSupported(){return true;}
    state='inactive';
    start(){starts++;}
   };
   const capture={getVideoTracks:()=>[],getTracks:()=>[{stop(){stops++;}}]};
   const editor={dom:{canvas:{captureStream:()=>capture}},base:()=>[480,480],size:()=>[480,480],media:[],
    pause(){},drawExport(){},audio(){},pick(){},drawTimeline(){},drawProps(){},fit(){},seek(){}};
   await Ed.exportLive.call(editor,{format:'webm',name:'test',height:480,fps:30});
   Ed.cancelExport.call(editor);
   startRecording();
   return [starts,stops,editor.exporting];
  })()`);
  expect(result).toEqual([0,1,null]);
 });
});

describe('editor scripts',()=>{
 it('are listed in the page and load without the browser',()=>{expect(scripts.length).toBeGreaterThanOrEqual(2);expect(get<object>('Ed')).toBeTruthy();});
 it('never define the same global name twice (the later one would silently replace the earlier)',()=>{
  const seen=new Map<string,string>(),twice:string[]=[];
  for(const s of scripts)for(const m of fs.readFileSync(path.join(ui,s),'utf8').matchAll(/^(?:async\s+)?(?:function\s+([\w$]+)|(?:const|let|class)\s+([\w$]+))/gm)){const n=(m[1]||m[2])!;if(seen.has(n))twice.push(`${n} (${seen.get(n)}, ${s})`);else seen.set(n,s);}
  expect(twice).toEqual([]);
 });
});

describe('colour grading',()=>{
 it('draws curves through their points without overshooting',()=>{
  const c=f<(p:number[][])=>(x:number)=>number>('edCurveFn')([[0,0],[.3,.1],[.6,.9],[1,1]]);
  expect(c(0)).toBeCloseTo(0);expect(c(.3)).toBeCloseTo(.1);expect(c(.6)).toBeCloseTo(.9);expect(c(1)).toBeCloseTo(1);
  let last=-1;for(let x=0;x<=1;x+=.01){const y=c(x);expect(y).toBeGreaterThanOrEqual(last-1e-9);expect(y).toBeGreaterThanOrEqual(0);expect(y).toBeLessThanOrEqual(1);last=y;}
 });
 it('reads .cube looks and samples them between their points',()=>{
  const cube=f<(t:string)=>{n:number;data:Float32Array}|null>('edParseCube')('TITLE "id"\nLUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n')!;
  expect(cube.n).toBe(2);
  const v=f<(L:unknown,r:number,g:number,b:number)=>number[]>('edSampleCube')(cube,.25,.5,.75);
  expect(v[0]).toBeCloseTo(.25);expect(v[1]).toBeCloseTo(.5);expect(v[2]).toBeCloseTo(.75);
  expect(f<(t:string)=>unknown>('edParseCube')('not a look')).toBeNull();
 });
 it('builds the grade table: none is identity, lift raises black, a flat curve is flat',()=>{
  const build=f<(g:object,l:unknown)=>{n:number;data:Uint8Array}>('edBuildLut'),at=(t:{n:number;data:Uint8Array},r:number,g:number,b:number)=>{const N=t.n,o=((b*N+g)*N+r)*4;return [...t.data.slice(o,o+3)];};
  const id=build({},null);expect(at(id,0,0,0)).toEqual([0,0,0]);expect(at(id,32,32,32)).toEqual([255,255,255]);expect(at(id,16,8,24)).toEqual([128,64,191]);
  expect(at(build({lift:{l:.4}},null),0,0,0)[0]).toBeGreaterThan(15);
  const flat=build({curves:{m:[[0,.5],[1,.5]]}},null);expect(at(flat,0,0,0)).toEqual([128,128,128]);expect(at(flat,32,32,32)).toEqual([128,128,128]);
  expect(f<(g:unknown)=>boolean>('edGraded')({})).toBe(false);expect(f<(g:unknown)=>boolean>('edGraded')({gain:{x:.2}})).toBe(true);
 });
});

describe('speed curves',()=>{
 it('keeps the file covered and splits without a jump',()=>{
  const ramp=[[0,1.5],[.4,1.5],[.5,.3],[.6,1.5],[1,1.5]],int=f<(r:number[][],p:number)=>number>('edRampInt'),avg=f<(r:number[][])=>number>('edRampAvg'),split=f<(r:number[][],p:number)=>number[][][]>('edRampSplit');
  expect(int(ramp,1)).toBeCloseTo(avg(ramp));expect(int(ramp,0)).toBe(0);
  const [a,b]=split(ramp,.45);expect(a![0]![0]).toBe(0);expect(a!.at(-1)![0]).toBe(1);expect(b![0]![0]).toBe(0);expect(a!.at(-1)![1]).toBeCloseTo(b![0]![1]!);
  // the two halves together cover exactly what the whole did
  expect(avg(a!)*.45+avg(b!)*.55).toBeCloseTo(avg(ramp),6);
 });
});

describe('keyframe curves',()=>{
 it('follows a Bézier from start to end, and keeps the named easings',()=>{
  const bz=f<(...a:number[])=>(u:number)=>number>('edBezier'),of=f<(e:unknown)=>(u:number)=>number>('edEaseOf');
  const lin=bz(0,0,1,1);for(const u of [0,.1,.5,.9,1])expect(lin(u)).toBeCloseTo(u,4);
  const fast=bz(0,1,0,1);expect(fast(.2)).toBeGreaterThan(.6);expect(fast(0)).toBe(0);expect(fast(1)).toBe(1);
  // a custom curve may overshoot (a bounce past the value), the named ones do not change
  expect(Math.max(...Array.from({length:50},(_,i)=>bz(.3,1.3,.6,1.3)(i/49)))).toBeGreaterThan(1);
  expect(of('linear')(.3)).toBeCloseTo(.3);expect(of([0,0,1,1])(.3)).toBeCloseTo(.3,4);expect(of('hold')(.7)).toBe(0);expect(of(undefined)(.5)).toBeCloseTo(.5);
 });
});

describe('multicam',()=>{
 it('finds where one sound starts inside another, and says when they do not match',()=>{
  let seed=3;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const A=Float32Array.from({length:600},rnd),B=A.slice(120,420),off=f<(a:Float32Array,b:Float32Array)=>number|null>('edSyncOffset');
  expect(off(A,B)).toBeCloseTo(1.2,5);expect(off(B,A)).toBeCloseTo(-1.2,5);
  const C=Float32Array.from({length:300},rnd);expect(off(A,C)).toBeNull();
  const buf={sampleRate:1000,numberOfChannels:1,getChannelData:()=>Float32Array.from({length:2000},(_,i)=>i<1000?0:.5)};
  const env=f<(b:object,from:number,dur:number,rate:number)=>Float32Array>('edSyncEnv')(buf,0,2,10);expect(env.length).toBe(20);expect(env[2]).toBe(0);expect(env[15]).toBeCloseTo(.5);
 });
});

describe('remove silences',()=>{
 it('finds the long quiet parts, keeps a little air around speech, and skips short breaths',()=>{
  const env=Float32Array.from({length:500},(_,i)=>i>=100&&i<220||i>=300&&i<330?.001:.3),gaps=f<(e:Float32Array,r:number,t:number,m:number,p:number)=>number[][]>('edSilences')(env,100,-38,.6,.1);
  expect(gaps.length).toBe(1);expect(gaps[0]![0]).toBeCloseTo(1.1,5);expect(gaps[0]![1]).toBeCloseTo(2.1,5);
  // quiet at the very start and the very end: no air is kept at the clip's edges
  const edge=f<(e:Float32Array,r:number,t:number,m:number,p:number)=>number[][]>('edSilences')(Float32Array.from({length:300},(_,i)=>i<100||i>=200?0:.3),100,-38,.6,.1);
  expect(edge).toEqual([[0,0.9],[2.1,3]]);
 });
});

describe('colour tools',()=>{
 it('HSL changes only the chosen colour, and leaves grey alone',()=>{
  const hsl=f<(v:number[],h:object)=>number[]>('edHslAdjust');
  const red=hsl([.9,.1,.1],{red:{s:-100}});expect(Math.abs(red[0]-red[1])).toBeLessThan(.02);
  expect(hsl([.1,.2,.9],{red:{s:-100}})).toEqual([.1,.2,.9]);expect(hsl([.5,.5,.5],{red:{h:30,s:100}})).toEqual([.5,.5,.5]);
  const shifted=hsl([.9,.1,.1],{red:{h:30}});expect(shifted[1]).toBeGreaterThan(.2);
  expect(f<(g:unknown)=>boolean>('edGraded')({hsl:{red:{s:-40}}})).toBe(true);
 });
 it('colour match maps the target levels onto the reference',()=>{
  const img=(v:number[])=>{const d=new Uint8ClampedArray(100*4);for(let i=0;i<100;i++){const k=i/99;d.set([Math.round(v[0]*k*255),Math.round(v[1]*k*255),Math.round(v[2]*k*255),255],i*4);}return d;};
  const pts=f<(a:Uint8ClampedArray,b:Uint8ClampedArray)=>number[][][]>('edMatchCurves')(img([.5,.5,.5]),img([1,1,1]));
  const mid=pts[0]!.find(p=>Math.abs(p[0]!-.25)<.02);expect(mid?.[1]).toBeCloseTo(.5,1);expect(pts[0]![0]).toEqual([0,0]);expect(pts[0]!.at(-1)).toEqual([1,1]);
 });
});

describe('titles',()=>{
 it('wrap their text where asked, keep their own line breaks, and bring layers in after their delay',()=>{
  const g={measureText:(x:string)=>({width:x.length*10})},lines=f<(g:object,l:object,W:number)=>string[]>('edTitleLines');
  expect(lines(g,{text:'one two three four',w:.1},1000)).toEqual(['one two','three four']);expect(lines(g,{text:'a'+String.fromCharCode(10)+'b'},1000)).toEqual(['a','b']);
  const an=f<(l:object,lt:number,fade:number)=>{a:number;dx:number}>('edTitleAnim');
  expect(an({anim:'fade',delay:.5},.4,1).a).toBe(0);expect(an({anim:'fade',delay:.5},2,1).a).toBe(1);expect(an({anim:'left'},0,1).dx).toBeLessThan(0);expect(an({anim:'none'},0,.5).a).toBe(.5);
  expect(get<unknown[]>('ED_TITLES').length).toBeGreaterThanOrEqual(5);
 });
});

describe('captions and words',()=>{
 it('splits words in every script, and knows direction',()=>{
  const words=f<(t:string,l?:string)=>string[]>('edWords');
  expect(words('ئەمڕۆ دەستکاریکەری نوێ')).toEqual(['ئەمڕۆ','دەستکاریکەری','نوێ']);
  expect(words('今日は新しいエディターを公開します').length).toBeGreaterThan(3);
  expect(f<(s:string)=>boolean>('edRtl')('«سڵاو» هاوڕێ')).toBe(true);expect(f<(s:string)=>boolean>('edRtl')('Hello')).toBe(false);
  expect(f<(s:string)=>boolean>('edNoSpace')('ภาษาไทย')).toBe(true);
 });
 it('reads SRT and WebVTT, and writes SRT that reads back the same',()=>{
  const parse=f<(t:string)=>{s:number;e:number;text:string}[]>('edParseSubs'),srt=f<(c:object[])=>string>('edSrt');
  const cues=parse('﻿1\r\n00:00:01,000 --> 00:00:02,500\r\nسڵاو\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n<i>Two</i> lines\r\nhere\r\n');
  expect(cues).toEqual([{s:1,e:2.5,text:'سڵاو'},{s:3,e:4,text:'Two lines here'}]);
  expect(parse('WEBVTT\n\n00:01.200 --> 00:02.000 align:start\n<v Ann>Hi')).toEqual([{s:1.2,e:2,text:'Hi'}]);
  const back=parse(srt(cues.map(c=>({start:c.s,dur:c.e-c.s,text:c.text}))));expect(back).toEqual(cues);
 });
 it('packs caption words into lines no wider than asked',()=>{
  const g={measureText:(s:string)=>({width:s.length*10})},lines=f<(g:object,w:string[],sep:string,max:number)=>string[][]>('edPack')(g,['aaaa','bbbb','cccc','dd'],' ',100);
  expect(lines).toEqual([['aaaa','bbbb'],['cccc','dd']]);
 });
});

describe('project files',()=>{
 it('zips and unzips (stored, with the right CRC)',async()=>{
  expect(f<(u:Uint8Array,c:number)=>number>('edCrc')(new TextEncoder().encode('hello'),0)).toBe(0x3610a686);
  const zip=await f<(files:[string,Blob][])=>Promise<Blob>>('edZip')([['project.json',new Blob(['{"a":1}'])],['media/x.mp4',new Blob([new Uint8Array([1,2,3,4,5])])]]);
  const files=await f<(z:Blob)=>Promise<Map<string,Blob>>>('edUnzip')(zip);
  expect([...files.keys()]).toEqual(['project.json','media/x.mp4']);expect(await files.get('project.json')!.text()).toBe('{"a":1}');
  expect([...new Uint8Array(await files.get('media/x.mp4')!.arrayBuffer())]).toEqual([1,2,3,4,5]);
 });
 it('writes WAV headers that say what the samples are',async()=>{
  const buf={numberOfChannels:2,length:4,sampleRate:48000,getChannelData:()=>new Float32Array([0,.5,-.5,1])};
  const wav=new DataView(await f<(b:object)=>Blob>('edWav')(buf).arrayBuffer());
  expect(wav.getUint32(24,true)).toBe(48000);expect(wav.getUint16(22,true)).toBe(2);expect(wav.getUint32(40,true)).toBe(16);expect(wav.getInt16(44+2*2*3,true)).toBe(32767);
 });
});

describe('effects',()=>{
 it('keys out the chosen colour and keeps the rest',()=>{
  const d=new Uint8ClampedArray([0,176,64,255, 230,30,30,255]);f<(d:Uint8ClampedArray,k:object)=>void>('edKey')(d,{color:'#00b040',sim:25,smooth:10,spill:50});
  expect(d[3]).toBe(0);expect(d[7]).toBe(255);
 });
 it('shakes the same way at the same time (so the export matches the player)',()=>{
  const s=f<(fx:object,t:number,W:number)=>number[]>('edShake');expect(s({shake:50},1.3,1280)).toEqual(s({shake:50},1.3,1280));expect(s({},1,1280)).toEqual([0,0,0]);
  expect(s({shake:100},.7,1280)).not.toEqual(s({shake:100},.9,1280));
 });
});
