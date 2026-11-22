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
 const ctx=vm.createContext({console,Blob,TextEncoder,TextDecoder,URL,Intl,setTimeout,clearTimeout,structuredClone,
  window:{addEventListener:noop},document:{addEventListener:noop,createElement:el,fonts:{load:async()=>{}},documentElement:{}},navigator:{},
  localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},indexedDB:{},toast:noop,ask:async()=>true,dialog:noop,closeDialog:noop,$:()=>null,
  App:{register:noop},Pop:{open:()=>null,close:noop},I:new Proxy({},{get:()=>''}),esc:(s:string)=>String(s),withKey:(u:string)=>u,requestAnimationFrame:noop,getComputedStyle:()=>({getPropertyValue:()=>''})});
 for(const s of scripts)vm.runInContext(fs.readFileSync(path.join(ui,s),'utf8'),ctx,{filename:s});
 return <T,>(name:string)=>vm.runInContext(name,ctx) as T;
}
const get=sandbox();
type Fn=(...a:never[])=>unknown;
const f=<T extends Fn>(n:string)=>get<T>(n);

describe('editor scripts',()=>{
 it('are listed in the page and load without the browser',()=>{expect(scripts.length).toBeGreaterThanOrEqual(2);expect(get<object>('Ed')).toBeTruthy();});
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
