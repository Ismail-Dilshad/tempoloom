import {z} from 'zod';
import {defaults} from '../engine/config.js';
import {languageSchema} from '../engine/languages.js';
import {landPaths,viewFor} from '../engine/motion-kit/map.js';
import {deviceScreenSizes} from '../engine/motion-kit/mockup.js';
import {findPlace} from '../engine/motion-kit/places.js';
import {plan,validateTimeline} from '../engine/scene-planner.js';
import {EditorProjectError,inspectProject,mediaId,previewEdit,projectId,revision} from './shared-projects.js';

export const motionRequest=z.strictObject({
 projectId,revision,title:z.string().trim().min(1).max(80),script:z.string().min(1).max(3000),
 start:z.number().min(0).default(0),language:languageSchema.optional(),
 layout:z.enum(['center','lower-third','split']).default('center'),
 visuals:z.array(z.strictObject({scene:z.number().int().min(1).max(30),mediaId,sourceStart:z.number().min(0).optional()})).max(30).default([]),
});
export async function planSharedMotion(input:unknown){
 const request=motionRequest.parse(input);
 const config=await defaults({visuals:false,useReferences:false,...(request.language?{language:request.language}:{})});
 const scenes=plan(request.script,config);
 validateTimeline(scenes,request.script);
 const visuals=new Map(request.visuals.map(visual=>[visual.scene,visual]));
 if(visuals.size!==request.visuals.length||request.visuals.some(visual=>visual.scene>scenes.length))
  throw new Error('Choose one visual per existing scene');
 const edits=[{type:'addMotionComposition',name:request.title,start:request.start,scenes:scenes.map((scene,index)=>{
  const visual=visuals.get(index+1);
  const split=request.layout==='split'||!!visual,lower=request.layout==='lower-third'&&!split;
  const x=split?0.29:lower?0.28:0.5,y=lower?0.81:0.5,w=split?0.45:lower?0.48:0.86;
  return {
  name:'Scene '+(index+1),start:scene.start,duration:scene.duration,layers:[
   {type:'box',x,y,w,h:lower?0.28:0.72,fill:config.primary,opacity:0.94,radius:16,anim:'fade'},
   {type:'text',x,y:y-0.02,w:w-0.1,text:scene.text,size:Math.max(26,Math.min(split||lower?52:72,520/Math.sqrt(scene.text.length))),
    weight:700,color:'#ffffff',align:'center',anim:config.reducedMotion?'none':index%2===0?'up':'fade'},
  ],...(visual?{visual:{mediaId:visual.mediaId,sourceStart:visual.sourceStart}}:{}),
 };})}];
 previewEdit(request.projectId,request.revision,edits);
 return {projectId:request.projectId,base:request.revision,edits,scenes:scenes.length};
}

const visualPresetRequest=z.strictObject({
 projectId,revision,mediaId,
 start:z.number().min(0).max(86_400).default(0),sourceStart:z.number().min(0).max(86_400).default(0),
 seconds:z.number().min(1).max(20).default(5),
 backdrop:z.string().regex(/^#[a-fA-F0-9]{6}$/).default('#141C2A'),
});
export const productRevealRequest=visualPresetRequest.extend({
 title:z.string().trim().min(1).max(80),move:z.enum(['rise','push']).default('rise'),
});

export function planProductReveal(input:unknown){
 const request=productRevealRequest.parse(input);
 const keyframes=request.move==='rise'?
  [{at:0,y:0.12,scale:0.43,opacity:0,ease:'out'},
   {at:0.26,y:-0.1,scale:0.55,opacity:1},{at:1,y:-0.12,scale:0.57}]:
  [{at:0,y:-0.1,scale:0.42,ease:'out'},{at:1,y:-0.1,scale:0.57}];
 const edits=[{type:'addMotionComposition',name:'Product reveal',start:request.start,scenes:[{
  name:'Product title',start:0,duration:request.seconds,backdrop:request.backdrop,
  layers:[{type:'text',x:0.5,y:0.83,w:0.84,text:request.title,size:Math.min(68,340/Math.sqrt(request.title.length)),
   weight:700,color:'#ffffff',align:'center',anim:'up',delay:0.25}],
  visual:{mediaId:request.mediaId,sourceStart:request.sourceStart,x:0,y:-0.1,scale:0.55,behindTitle:true,keyframes},
 }]}];
 previewEdit(request.projectId,request.revision,edits);
 return {projectId:request.projectId,base:request.revision,edits,scenes:1};
}

export const deviceMockupRequest=visualPresetRequest.extend({
 device:z.enum(['phone','tablet','laptop']).default('phone'),
 move:z.enum(['slide','float']).default('slide'),fit:z.enum(['contain','cover']).default('contain'),
});
const frameRatios={'16:9':16/9,'9:16':9/16,'1:1':1,'4:5':4/5};
const frameRatio=z.enum(['16:9','9:16','1:1','4:5']).catch('16:9');

export function planDeviceMockup(input:unknown){
 const request=deviceMockupRequest.parse(input);
 const current=inspectProject(request.projectId);
 if(current.revision!==request.revision)throw new EditorProjectError(409,`Project is now at revision ${current.revision}. Read it again before editing.`);
 const media=current.media.find(item=>item.id===request.mediaId);
 if(!media||media.type!=='image'&&media.type!=='video')throw new EditorProjectError(400,'Choose a shared image or video for the screen');
 const dimensions=z.object({w:z.number().int().positive(),h:z.number().int().positive()}).safeParse(media);
 if(!dimensions.success)throw new EditorProjectError(400,'The screen media needs dimensions. Import and share it from the Editor Library.');
 const frameAspect=frameRatios[frameRatio.parse(current.project.ratio)];
 const screen=deviceScreenSizes[request.device],screenAspect=screen.w/screen.h;
 const sourceAspect=dimensions.data.w/dimensions.data.h;
 const h=Math.min(0.7,0.72*frameAspect/screenAspect),w=h*screenAspect/frameAspect;
 const side=Math.max(0,(1-screenAspect/sourceAspect)/2),vertical=Math.max(0,(1-sourceAspect/screenAspect)/2);
 const crop=request.fit==='cover'?{l:side,r:side,t:vertical,b:vertical}:undefined;
 const fittedAspect=crop?screenAspect:sourceAspect;
 const scale=Math.min(w*frameAspect/Math.min(frameAspect,fittedAspect),h/Math.min(1,frameAspect/fittedAspect));
 const keyframes=request.move==='slide'?
  [{at:0,x:0.24,y:0,scale:0.9,opacity:0,ease:'out'},
   {at:0.22,x:0,y:0,scale:1,opacity:1}]:
  [{at:0,x:0,y:0.03,scale:0.97,opacity:1},{at:0.5,x:0,y:-0.022,scale:1.02,opacity:1},
   {at:1,x:0,y:0.03,scale:0.97,opacity:1}];
 const name={phone:'Phone',tablet:'Tablet',laptop:'Laptop'}[request.device];
 const layers=[
  {type:'box',x:0.5,y:0.5,w:w*1.1,h:h*1.07,fill:'#242B36',radius:request.device==='phone'?18:10,line:1,lineColor:'#64748B'},
  {type:'box',x:0.5,y:0.5,w,h,fill:'#0A101A'},
  ...(request.device==='laptop'?[{type:'box',x:0.5,y:0.5+h*0.55,w:w*1.23,h:h*0.044,fill:'#667387',radius:5}]:[]),
 ];
 const edits=[{type:'addMotionComposition',name:name+' mockup',start:request.start,scenes:[{
  name:name+' frame',start:0,duration:request.seconds,backdrop:request.backdrop,layers,keyframes,
  visual:{mediaId:request.mediaId,sourceStart:request.sourceStart,x:0,y:0,scale,crop,
   keyframes:keyframes.map(point=>({...point,scale:point.scale*scale}))},
 }]}];
 previewEdit(request.projectId,request.revision,edits);
 return {projectId:request.projectId,base:request.revision,edits,scenes:1};
}

export const routeMapRequest=visualPresetRequest.omit({mediaId:true,sourceStart:true}).extend({
 places:z.array(z.string().trim().min(1).max(90)).min(2).max(6),
 accent:z.string().regex(/^#[a-fA-F0-9]{6}$/).default('#4C8DFF'),
});

export async function planRouteMap(input:unknown){
 const request=routeMapRequest.parse(input),current=inspectProject(request.projectId);
 if(current.revision!==request.revision)throw new EditorProjectError(409,`Project is now at revision ${current.revision}. Read it again before editing.`);
 const places=await Promise.all(request.places.map(place=>findPlace(place,{online:false})));
 if(new Set(places.map(place=>`${place.lat},${place.lon}`)).size!==places.length)
  throw new EditorProjectError(400,'Choose stops at different locations');
 const aspect=frameRatios[frameRatio.parse(current.project.ratio)],size=1000;
 const base=viewFor(places,aspect*size,size);
 const view={...base,project:(lon:number,lat:number)=>{
  const projected=base.project(lon,lat);return {x:projected.x/aspect,y:projected.y};
 }};
 const points=places.map(place=>view.project(place.lon,place.lat)),land=landPaths(view,size,size).join('');
 const pathLayer={type:'path',x:0.5,y:0.5,w:1,h:1};
 const layers=[
  ...(land?[{...pathLayer,name:'Land and borders',d:land,fill:'#2B3D53',line:1,lineColor:'#415976'}]:[]),
  {...pathLayer,name:'Route line',d:'M'+points.map(({x,y})=>`${x.toFixed(1)},${y.toFixed(1)}`).join('L'),line:4,lineColor:request.accent,anim:'fade'},
  ...places.flatMap((place,i)=>{
   const x=points[i]!.x/size,y=points[i]!.y/size,delay=request.seconds*0.52*i/(places.length-1);
   return [{type:'box',x,y,w:0.019/aspect,h:0.019,fill:request.accent,radius:100,anim:'pop',delay},
    {type:'text',x,y:y-0.042,w:0.38,text:place.name,size:34,weight:700,color:'#FFFFFF',align:'center',anim:'fade',delay}];
  }),
 ];
 const edits=[{type:'addMotionComposition',name:'Route map',start:request.start,scenes:[{
  name:'Map and stops',start:0,duration:request.seconds,backdrop:request.backdrop,layers,
 }]}];
 previewEdit(request.projectId,request.revision,edits);
 return {projectId:request.projectId,base:request.revision,edits,scenes:1};
}

export const kineticTitleRequest=visualPresetRequest.omit({mediaId:true,sourceStart:true}).extend({
 phrases:z.array(z.string().trim().min(1).max(120)).min(1).max(8),
});
export async function planKineticTitle(input:unknown){
 const request=kineticTitleRequest.parse(input);
 const config=await defaults({visuals:false,useReferences:false});
 const duration=request.seconds/request.phrases.length;
 const name='Kinetic titles';
 const edits=[{type:'addMotionComposition',name,start:request.start,scenes:request.phrases.map((text,i)=>({
  name:`Phrase ${i+1}`,start:i*duration,duration,backdrop:request.backdrop,
  layers:[{type:'text',text,x:0.5,y:0.5,w:0.83,size:Math.max(28,Math.min(92,480/Math.sqrt(text.length))),
   weight:800,color:'#FFFFFF',align:'center',anim:config.reducedMotion||duration<0.5?'none':'up'}],
 }))}];
 previewEdit(request.projectId,request.revision,edits);
 return {projectId:request.projectId,base:request.revision,edits,scenes:request.phrases.length};
}
