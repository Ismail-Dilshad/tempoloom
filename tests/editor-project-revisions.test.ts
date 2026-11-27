import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {expect,it} from 'vitest';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {downloadProject,editProject,inspectProject,previewArchive,publishProject,registerProjectMedia,registerSharedTextTemplate,restoreProject,sharedProjectHead,shareProject} from '../src/editor/shared-projects.js';
import {planSharedCaptions,transcribeSharedMedia} from '../src/editor/shared-transcript.js';
import {planSharedMotion} from '../src/editor/shared-motion.js';
import {planSharedMulticam} from '../src/editor/shared-multicam.js';

function archive(name:string,mediaId:string,content:string){
 return zipSync({
  'project.json':strToU8(JSON.stringify({
   app:'tempoloom-editor',v:1,
   project:{id:'browser',name,tracks:[{id:'video',kind:'video',main:true}],
    clips:[{id:'clip',track:'video',media:mediaId,start:0,dur:2}]},
   media:[{id:mediaId,name:mediaId+'.mp4',type:'video',dur:2}],luts:[],
  })),
  ['media/'+mediaId+'.mp4']:strToU8(content),
 },{level:0});
}

it('publishes new media as one revision and preserves the exact assets of every saved revision',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tempoloom-revision-'));
 const before=process.env.VIDEO_WORKSPACE;
 process.env.VIDEO_WORKSPACE=folder;
 try{
  const {id}=shareProject(archive('Original','old','first media'));
  const uploaded=archive('Updated','new','second media');
  expect(publishProject(id,0,uploaded)).toMatchObject({revision:1,project:{name:'Updated'}});
  expect(()=>publishProject(id,0,uploaded)).toThrow(/revision 1/);
  const files=fs.readdirSync(path.join(folder,'editor-agent')).filter(f=>f.endsWith('.zip'));
  expect(files).toHaveLength(2);

  const operations=[{type:'split',clipId:'clip',at:1}];
  const preview=unzipSync(previewArchive(id,1,operations));
  expect(strFromU8(preview['media/new.mp4']!)).toBe('second media');
  expect(editProject(id,1,operations)).toMatchObject({revision:2,project:{clips:[{dur:1},{dur:1}]}});
  expect(strFromU8(unzipSync(downloadProject(id))['media/new.mp4']!)).toBe('second media');

  expect(restoreProject(id,2,0)).toMatchObject({revision:3,project:{name:'Original'}});
  const restored=unzipSync(downloadProject(id));
  expect(strFromU8(restored['media/old.mp4']!)).toBe('first media');
  expect(restored['media/new.mp4']).toBeUndefined();
  expect(inspectProject(id).media.map(m=>m.id)).toEqual(['old']);
  expect(strFromU8(unzipSync(downloadProject(id,2))['media/new.mp4']!)).toBe('second media');

  const {project}=restoreProject(id,3,2);
  const [left,right]=project.clips;
  expect(()=>editProject(id,4,[{type:'transition',clipId:right!.id,effect:'crossfade'}])).toThrow(/incompatible/);
  const effects=editProject(id,4,[
   {type:'transition',clipId:right!.id,effect:'dissolve',duration:0.4},
   {type:'mask',clipId:right!.id,values:{shape:'circle',feather:20}},
   {type:'adjustColor',clipId:right!.id,values:{temperature:-10}},
   {type:'gradeColor',clipId:right!.id,values:{gamma:{x:0.1,y:0,l:0.1},curves:{m:[[0,0],[0.5,0.6],[1,1]]}}},
  ]);
  expect(effects.project.clips[1]).toMatchObject({trans:{type:'dissolve',dur:0.4},mask:{shape:'circle',feather:20},adj:{temperature:-10},
   grade:{gamma:{x:0.1},curves:{m:[[0,0],[0.5,0.6],[1,1]]}}});
  expect(()=>editProject(id,5,[{type:'move',clipId:left!.id,start:4}])).toThrow(/separate a transition/);
  expect(editProject(id,5,[{type:'transition',clipId:right!.id,effect:'none'},{type:'move',clipId:left!.id,start:4}]).revision).toBe(6);

  const registration=zipSync({
   'project.json':strToU8(JSON.stringify({id:'overlay',name:'overlay.png',mime:'image/png',type:'image',dur:5})),
   'media/overlay.png':strToU8('overlay bytes'),
  },{level:0});
  const previous=inspectProject(id);
  expect(()=>registerProjectMedia(id,5,registration)).toThrow(/revision 6/);
  expect(registerProjectMedia(id,6,registration)).toMatchObject({revision:7,project:previous.project});
  expect(()=>registerProjectMedia(id,7,registration)).toThrow(/already shared/);
  expect(unzipSync(downloadProject(id,6))['media/overlay.png']).toBeUndefined();
  expect(strFromU8(unzipSync(downloadProject(id,7))['media/overlay.png']!)).toBe('overlay bytes');
  expect(publishProject(id,7,uploaded)).toMatchObject({revision:8});
  const placed=editProject(id,8,[{type:'addMedia',mediaId:'overlay',start:0,duration:1,overlay:true}]);
  expect(placed.project.clips).toHaveLength(2);
  expect(placed.project.clips[1]).toMatchObject({media:'overlay',start:0,dur:1});
  expect(placed.project.clips[1]!.track).not.toBe('video');
  expect(sharedProjectHead(id)).toEqual({id,revision:9});
  const polished=editProject(id,9,[
   {type:'audioEffects',clipId:'clip',values:{mid:3,comp:35}},
   {type:'videoEffects',clipId:'clip',values:{style:'vhs',amount:20}},
   {type:'positionLock',clipId:'clip',locked:true},
   {type:'trackSettings',trackId:'video',values:{name:'Primary',pan:0.25}},
   {type:'addSticker',sticker:{type:'graphic',id:'arrow'},start:0,duration:1},
  ]);
  expect(polished.project.clips[0]).toMatchObject({positionLocked:true,afx:{mid:3,comp:35},fx:{style:'vhs',amount:20}});
  expect(polished.project.clips.at(-1)).toMatchObject({sticker:{type:'graphic',id:'arrow'}});
  expect(polished.project.tracks.find(t=>t.id==='video')).toMatchObject({name:'Primary',pan:0.25});
  const multicam=editProject(id,10,[{type:'addMulticam',name:'Two cameras',start:2,angles:[
   {mediaId:'old',offset:0,duration:2},{mediaId:'new',offset:0.25,duration:1.5},
  ]}]).project.clips.at(-1)!;
  expect(()=>editProject(id,11,[{type:'switchMulticam',clipId:multicam.id,angle:1,at:2.1}])).toThrow(/no footage/);
  expect(editProject(id,11,[{type:'switchMulticam',clipId:multicam.id,angle:1,at:2.5}]).project.clips.at(-1)?.nest)
   .toMatchObject({multi:true,cuts:[{t:0,a:0},{t:0.5,a:1}]});
  const detached=editProject(id,12,[{type:'positionLock',clipId:'clip',locked:false},{type:'detachAudio',clipId:'clip'}]);
  const audio=detached.project.clips.at(-1)!;
  expect(audio).toMatchObject({asAudio:true,media:'new',afx:{mid:3}});
  const moved=editProject(id,13,[{type:'move',clipId:audio.id,start:1}]);
  expect(moved.project.clips.filter(c=>c.linkId===audio.linkId).map(c=>c.start)).toEqual([1,1]);
  expect(()=>editProject(id,14,[
   {type:'trackSettings',trackId:audio.track,values:{locked:true}},
   {type:'split',clipId:'clip',at:2},
  ])).toThrow(/locked/);
  expect(sharedProjectHead(id).revision).toBe(14);
  const trimmed=editProject(id,14,[
   {type:'keyframe',clipId:'clip',key:'scale',at:0,value:1,ease:'smooth'},
   {type:'keyframe',clipId:'clip',key:'scale',at:2,value:2},
   {type:'trim',clipId:audio.id,start:1.25,end:2.75},
  ]);
  expect(trimmed.project.clips.filter(c=>c.linkId===audio.linkId)).toMatchObject([
   {start:1.25,dur:1.5,in:0.25},{start:1.25,dur:1.5,in:0.25},
  ]);
  const split=editProject(id,15,[{type:'split',clipId:'clip',at:2}]);
  const rightPair=split.project.clips.filter(c=>c.linkId&&c.linkId!==audio.linkId);
  expect(rightPair).toMatchObject([{start:2,dur:0.75,in:1},{start:2,dur:0.75,in:1}]);
  expect(rightPair[0]?.linkId).toBe(rightPair[1]?.linkId);
  expect(rightPair[0]?.kf).toMatchObject({scale:[{t:-1,v:1,e:'smooth'},{t:1,v:2}]});
  const joined=editProject(id,16,[{type:'audio',clipId:audio.id,volume:0.5},{type:'reattachAudio',clipId:audio.id}]);
  expect(joined.project.clips.some(c=>c.id===audio.id)).toBe(false);
  expect(joined.project.clips.find(c=>c.id==='clip')).toMatchObject({volume:0.5});
  const extended=editProject(id,17,[{type:'addMedia',mediaId:'new',trackId:'video',start:2.75,duration:0.5}]);
  const next=extended.project.clips.at(-1)!;
  const withTransition=editProject(id,18,[{type:'transition',clipId:next.id,effect:'dissolve',duration:0.5}]);
  expect(withTransition.project.clips.at(-1)?.trans).toMatchObject({dur:0.5});
  const splitAgain=editProject(id,19,[{type:'split',clipId:rightPair[0]!.id,at:2.5}]);
  expect(splitAgain.project.clips.find(c=>c.id===next.id)?.trans).toMatchObject({dur:0.25});
  const shortened=editProject(id,20,[{type:'trim',clipId:splitAgain.project.clips.at(-1)!.id,start:2.5,end:2.65}]);
  expect(shortened.project.clips.find(c=>c.id===next.id)?.trans).toBeUndefined();
  const assetMotion={type:'addMotionComposition',name:'With visual',start:1,scenes:[{
   name:'Layer',start:0,duration:1,layers:[{type:'box',x:0.5,y:0.5,w:0.5,h:0.5,fill:'#224466'}],visual:{mediaId:'overlay'},
  }]};
  const mediaScene=editProject(id,21,[assetMotion,{
   type:'addAdjustmentLayer',name:'Film texture',start:0,duration:2,adjust:{saturation:-15},effects:{grain:22},
  }]);
  expect(mediaScene.project.clips.at(-2)?.nest).toMatchObject({clips:[{title:{name:'Layer'}},{media:'overlay',track:'visuals'}]});
  expect(mediaScene.project.clips.at(-1)).toMatchObject({adjustment:true,fx:{grain:22}});
  registerSharedTextTemplate(id,22,{id:'library-headline',name:'Headline',text:'Headline',style:{size:96,dur:4,upper:true}});
  const templated=editProject(id,23,[{type:'addTextTemplate',templateId:'library-headline',start:0,text:'Revised'}]);
  expect(templated.project.clips.at(-1)).toMatchObject({text:'Revised',size:96,dur:4,upper:true});
 }finally{
  if(before===undefined)delete process.env.VIDEO_WORKSPACE;
  else process.env.VIDEO_WORKSPACE=before;
  fs.rmSync(folder,{recursive:true,force:true});
 }
});


it('coordinates track ripple, trims a nested speed ramp, and transcribes pinned media locally',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tempoloom-deep-edits-'));
 const before=process.env.VIDEO_WORKSPACE;
 process.env.VIDEO_WORKSPACE=folder;
 try{
  const entries=unzipSync(archive('Nested test','source','pinned footage'));
  const doc=JSON.parse(strFromU8(entries['project.json']!));
  doc.media[0].dur=6;
  doc.project.tracks.push({id:'audio',kind:'audio',syncLock:true},{id:'locked',kind:'text',locked:true,syncLock:true});
  doc.project.clips.push(
   {id:'nest',track:'video',start:2,dur:4,nest:{dur:4,tracks:[{id:'inside',kind:'video'}],
    clips:[{id:'ramp',track:'inside',media:'source',start:0,dur:4,in:3,speed:1,ramp:[[0,1],[1,3]]}]}},
   {id:'follow',track:'audio',media:'source',start:3,dur:1},
   {id:'still',track:'locked',text:'Keep',start:2,dur:1},
  );
  doc.project.clips[0].ramp=[[0,1],[1,2]];
  entries['project.json']=strToU8(JSON.stringify(doc));
  const {id}=shareProject(zipSync(entries,{level:0}));
  const ramped=await planSharedCaptions({projectId:id,revision:0,clipId:'clip'},async()=>({
   code:'en',words:[{text:'Hello',start:1.25,end:2.1}],
  }));
  expect(ramped.edits[0]).toMatchObject({cues:[{start:1,text:'Hello'}]});
  const result=editProject(id,0,[{type:'rippleRemove',clipId:'clip'},
   {type:'trim',within:['nest'],clipId:'ramp',start:1,end:3}]);
  expect(result.project.clips).toMatchObject([
   {id:'nest',start:0,nest:{dur:3,clips:[{id:'ramp',start:1,dur:2,in:4.25,ramp:[[0,1.5],[1,2.5]]}]}},
   {id:'follow',start:1},{id:'still',start:2},
  ]);
  await expect(transcribeSharedMedia({projectId:id,revision:0,mediaId:'source',language:'ckb'},async(file,language)=>{
   expect(fs.readFileSync(file,'utf8')).toBe('pinned footage');
   return {code:language,words:[{text:'سڵاو',start:0.1,end:0.6}]};
  })).resolves.toMatchObject({timebase:'source seconds',code:'ckb',words:[{text:'سڵاو'}]});
  const motion=await planSharedMotion({projectId:id,revision:1,title:'Opener',script:'سڵاو.\n\nبەخێربێن.',language:'ckb',start:1});
  expect(motion.scenes).toBeGreaterThan(1);
  expect(sharedProjectHead(id).revision).toBe(1);
  const withMotion=editProject(id,1,motion.edits),composition=withMotion.project.clips.at(-1)!;
  const nested=composition.nest as {name:string;clips:{id:string;title:{layers:{text?:string}[]}}[]};
  expect(nested.name).toBe('Opener');
  expect(nested.clips.flatMap(clip=>clip.title.layers.map(layer=>layer.text??'')).join('')).toBe('سڵاو.\n\nبەخێربێن.');
  const revised=editProject(id,2,[{type:'replaceTitle',within:[composition.id],clipId:nested.clips[0]!.id,
   name:'Revised slide',layers:[{type:'text',x:0.5,y:0.5,text:'سڵاو',size:60,color:'#ffffff'}]}]);
  expect(revised.project.clips.at(-1)?.nest).toMatchObject({clips:[{title:{name:'Revised slide'}},{}]});
  const moved=editProject(id,3,[{type:'groupClips',clipIds:['nest','follow']},{type:'move',clipId:'follow',start:4}]);
  expect(moved.project.clips.slice(0,2)).toMatchObject([{id:'nest',start:3},{id:'follow',start:4}]);
  const captions=await planSharedCaptions({projectId:id,revision:4,clipId:'follow'},async()=>({
   code:'ckb',words:[{text:'سڵاو',start:0.25,end:0.55}],
  }));
  expect(captions.edits[0]).toMatchObject({type:'addCaptions',language:'ckb',cues:[{start:4.25,duration:0.75}]});
  expect(editProject(id,4,captions.edits).project.clips.at(-1)).toMatchObject({cap:true,lang:'ckb',text:'سڵاو'});
  const generated=Float32Array.from({length:48_000},(_,index)=>((Math.sin(Math.floor(index/160)*14.125)*7231)%1+1.1)/2.2);
  const camera=await planSharedMulticam({projectId:id,revision:5,name:'Matched',angles:[
   {mediaId:'source',duration:6},{mediaId:'source',sourceStart:0.4,duration:5.6},
  ]},async(_file,_rate,range)=>generated.slice(Math.round((range?.start??0)*8000)));
  expect(camera.offsets).toEqual([0,0.4]);
  expect(editProject(id,5,camera.edits).project.clips.at(-1)?.nest).toMatchObject({multi:true,clips:[{start:0},{start:0.4}]});
 }finally{
  if(before===undefined)delete process.env.VIDEO_WORKSPACE;
  else process.env.VIDEO_WORKSPACE=before;
  fs.rmSync(folder,{recursive:true,force:true});
 }
});
