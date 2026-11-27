import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {unzipSync,zipSync} from 'fflate';
import {z} from 'zod';
import {meshSticker} from './obj-mesh.js';
import {ROOT} from '../engine/config.js';

export const maxBundleBytes=128*1024*1024;
export const projectId=z.uuid();
export const revision=z.number().int().min(0);
const id=z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/);
export const mediaId=id;
const time=z.number().min(0).max(86_400);
const duration=time.min(0.001);
const track=z.looseObject({id,kind:z.enum(['video','audio','text','sticker','adjustment']),locked:z.boolean().optional()});
const clip=z.looseObject({id,track:id,start:time,dur:duration,in:time.optional(),speed:z.number().positive().optional(),media:id.optional(),text:z.string().max(50_000).optional()});
const asset=z.looseObject({id,name:z.string().max(1024),mime:z.string().max(128).optional(),
 type:z.enum(['image','video','audio']).optional(),dur:time.optional()});
const textTemplate=z.strictObject({
 id,name:z.string().trim().min(1).max(80),text:z.string().max(2000),
 style:z.object({
  font:z.string().max(100),size:z.number().min(1).max(1000),weight:z.number().min(100).max(1000),
  color:z.string().max(30),box:z.boolean(),boxColor:z.string().max(30),align:z.enum(['left','center','right']),
  stroke:z.number().min(0).max(100),strokeColor:z.string().max(30),shadow:z.boolean(),
  spacing:z.number().min(-100).max(100),lineH:z.number().positive().max(10),upper:z.boolean(),
  x:z.number().min(-10).max(10),y:z.number().min(-10).max(10),animIn:z.string().max(25),animOut:z.string().max(25),
  animDur:time,dur:duration,
 }).partial(),
});
type Manifest=z.infer<typeof manifest>;
type Clip=z.infer<typeof clip>;
type Project=Manifest['project'];
type Row={id:string;revision:number;manifest:string};
export class EditorProjectError extends Error {
 constructor(public status:number,message:string){super(message);}
}
const fail=(message:string,status=400):never=>{throw new EditorProjectError(status,message);};
const directory=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','editor-agent');
const bundlePath=(id:string)=>path.join(directory(),projectId.parse(id)+'.zip');

function database<T>(run:(db:DatabaseSync)=>T):T{
 fs.mkdirSync(directory(),{recursive:true});
 const db=new DatabaseSync(path.join(directory(),'projects.sqlite'));
 try{
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS editor_project_revision (
      id TEXT NOT NULL, revision INTEGER NOT NULL, manifest TEXT NOT NULL, PRIMARY KEY(id,revision)
    );
    CREATE TABLE IF NOT EXISTS editor_project_assets (
      id TEXT NOT NULL, revision INTEGER NOT NULL, bundle TEXT NOT NULL, PRIMARY KEY(id,revision)
    );
    CREATE TABLE IF NOT EXISTS editor_model_job (
      id TEXT PRIMARY KEY, projectId TEXT NOT NULL, base INTEGER NOT NULL,
      request TEXT NOT NULL, state TEXT NOT NULL, heartbeat INTEGER NOT NULL,
      created INTEGER NOT NULL, resultRevision INTEGER, message TEXT
    );`);
  return run(db);
 }finally{db.close();}
}
export {database as withSharedProjectDatabase};
function latest(db:DatabaseSync,id:string):Row{
 const row=db.prepare('SELECT * FROM editor_project_revision WHERE id=? ORDER BY revision DESC LIMIT 1').get(projectId.parse(id));
 return (row as Row|undefined)??fail('Shared editor project not found',404);
}
function read(row:Row){return {...JSON.parse(row.manifest) as Manifest,id:row.id,revision:row.revision};}

function validateTimeline(data:Manifest){
 const {clips,tracks}=data.project,trackIds=new Set(tracks.map(t=>t.id)),clipIds=new Set<string>(),media=new Set(data.media.map(m=>m.id));
 if(trackIds.size!==tracks.length||media.size!==data.media.length)fail('Duplicate track or media ID');
 for(const c of clips){
  if(clipIds.has(c.id)||!trackIds.has(c.track)||c.start+c.dur>86_400)fail('Invalid timeline clip '+c.id);
  if(c.media&&!media.has(c.media))fail('Missing media for clip '+c.id);
  clipIds.add(c.id);
 }
}
function zipEntries(bytes:Uint8Array){
 if(bytes.byteLength>maxBundleBytes)fail('Shared projects can be up to 128 MB',413);
 const seen=new Set<string>();
 return unzipSync(bytes,{filter(entry){
  const {name,size,originalSize,compression}=entry;
  if(!/^(project\.json|media\/[a-zA-Z0-9_-]+(?:\.[a-z0-9]{1,5})?|luts\/[a-z0-9-]+\.cube)$/.test(name)||seen.has(name))fail('Invalid project archive entry');
  if(compression!==0||size!==originalSize)fail('Use a project archive exported by the Editor');
  seen.add(name);
  if(seen.size>3100||name==='project.json'&&size>8*1024*1024)fail('Project archive exceeds limits',413);
  return true;
 }});
}

function readBundle(bytes:Uint8Array){
 const entries=zipEntries(bytes);
 const data=manifest.parse(JSON.parse(Buffer.from(entries['project.json']??[]).toString('utf8')));
 validateTimeline(data);
 const mediaFiles=new Set(Object.keys(entries).filter(name=>name.startsWith('media/')).map(name=>name.slice(6).split('.')[0]));
 if(data.media.some(m=>!mediaFiles.has(m.id)))fail('Project archive is missing media');
 if(data.luts.some(look=>!entries['luts/'+look.id+'.cube']))fail('Project archive is missing a look');
 return data;
}

export function shareProject(bytes:Uint8Array){
 const data=readBundle(bytes);
 const id=randomUUID();
 return database(db=>{
  const file=bundlePath(id);
  const fd=fs.openSync(file,'wx');
  try{
   try{fs.writeFileSync(fd,bytes);}finally{fs.closeSync(fd);}
   db.prepare('INSERT INTO editor_project_revision VALUES (?,0,?)').run(id,JSON.stringify(data));
  }catch(error){
   fs.rmSync(file,{force:true});
   throw error;
  }
  return {id,revision:0,name:data.project.name};
 });
}

export function listProjects(){
 return database(db=>(db.prepare(`SELECT r.* FROM editor_project_revision r
   JOIN (SELECT id,MAX(revision) AS revision FROM editor_project_revision GROUP BY id) h USING(id,revision)
   ORDER BY r.rowid DESC LIMIT 100`).all() as Row[]).map(row=>{
  const data=read(row);return {id:data.id,revision:data.revision,name:data.project.name};
 }));
}
export const inspectProject=(id:string)=>database(db=>read(latest(db,id)));
export function sharedProjectHead(id:string){
 return database(db=>{
  const head=db.prepare('SELECT revision FROM editor_project_revision WHERE id=? ORDER BY revision DESC LIMIT 1').get(projectId.parse(id));
  if(!head)throw new EditorProjectError(404,'Shared editor project not found');
  return {id,revision:Number(head.revision)};
 });
}
export function downloadProject(id:string,at?:number){
 const row=database(db=>at===undefined?latest(db,id):atRevision(db,id,at));
 return projectArchive(id,row.revision,manifest.parse(JSON.parse(row.manifest)));
}
function atRevision(db:DatabaseSync,id:string,at:number):Row{
 const row=db.prepare('SELECT * FROM editor_project_revision WHERE id=? AND revision=?').get(projectId.parse(id),revision.parse(at)) as Row|undefined;
 return row??fail('Editor revision not found',404);
}
function assetBundle(db:DatabaseSync,row:Row){
 const source=db.prepare('SELECT bundle FROM editor_project_assets WHERE id=? AND revision=?').get(row.id,row.revision);
 return source?projectId.parse(source.bundle):row.id;
}
function projectArchive(id:string,at:number,document:Manifest){
 return packEntries(storedEntries(id,at),document);
}
function storedEntries(id:string,at:number){
 const source=database(db=>assetBundle(db,atRevision(db,id,at)));
 return zipEntries(fs.readFileSync(bundlePath(source)));
}
function packEntries(entries:Record<string,Uint8Array>,document:Manifest){
 entries['project.json']=new TextEncoder().encode(JSON.stringify(document));
 if(entries['project.json'].byteLength>8*1024*1024||Object.keys(entries).length>3100)fail('Project archive exceeds limits',413);
 const archive=zipSync(entries,{level:0});
 if(archive.byteLength>maxBundleBytes)fail('Shared projects can be up to 128 MB',413);
 return archive;
}
export const previewArchive=(id:string,base:number,edits:unknown)=>projectArchive(id,base,previewEdit(id,base,edits));

const target=z.object({clipId:id,within:z.array(id).min(1).max(5).optional().describe('Outer-to-inner IDs of nested clips containing the target')});
const unit=z.number().min(0).max(1);
const keyValues={
 x:z.number().min(-2).max(2),y:z.number().min(-2).max(2),
 scale:z.number().min(0.01).max(10),rotate:z.number().min(-360).max(360),
 opacity:unit,volume:z.number().min(0).max(2),
 tiltX:z.number().min(-180).max(180),tiltY:z.number().min(-180).max(180),depth3d:z.number().min(.1).max(1),
};
const geometryKeys=['tiltX','tiltY','depth3d'] as const;
function has3DGeometry(clip:Clip){
 const shape=clip.sticker as {type?:string;shape?:string;id?:string}|undefined;
 return shape?.type==='mesh'||shape?.type==='shape'&&(shape.shape??shape.id)==='cuboid';
}
const color=z.string().regex(/^#[a-fA-F0-9]{6}$/);
const visualTransitions=['dissolve','fade','white','slide','push','zoom','zoomblur','wipe','iris','blur','whip','spin','flash','glitch','shake','wipeup','pushright','dipwarm'] as const;
const percentage=z.number().min(-100).max(100);
const adjustments=z.strictObject({brightness:percentage.optional(),contrast:percentage.optional(),saturation:percentage.optional(),
 hue:z.number().min(-180).max(180).optional(),temperature:percentage.optional(),
 vignette:z.number().min(0).max(100).optional(),blur:z.number().min(0).max(30).optional()});
const mask=z.strictObject({
 shape:z.enum(['none','rect','circle','linear','band','heart','star']),
 w:z.number().min(0.01).max(2).optional(),h:z.number().min(0.01).max(2).optional(),
 x:z.number().min(-1).max(1).optional(),y:z.number().min(-1).max(1).optional(),
 angle:z.number().min(-180).max(180).optional(),round:unit.optional(),
 feather:z.number().min(0).max(200).optional(),invert:z.boolean().optional(),
});
const wheel=z.strictObject({x:z.number().min(-1).max(1),y:z.number().min(-1).max(1),l:z.number().min(-1).max(1)});
const curve=z.array(z.tuple([unit,unit])).min(2).max(20).refine(points=>
 points.every(([x],index)=>!index||x>points[index-1]![0]),'Curve points must have strictly increasing input values');
const grading=z.strictObject({
 lift:wheel.optional(),gamma:wheel.optional(),gain:wheel.optional(),
 hsl:z.partialRecord(z.enum(['red','orange','yellow','green','aqua','blue','purple','magenta']),
  z.strictObject({h:z.number().min(-180).max(180),s:percentage,l:percentage})).optional(),
 curves:z.partialRecord(z.enum(['m','r','g','b']),curve).optional(),
 lut:z.strictObject({id,mix:unit}).nullable().optional(),
});
const videoEffects=z.strictObject({
 style:z.enum(['none','rgb','glitch','vhs','leak','burn','flash','mirror','kaleido','pixel','zoomblur','motion','invert']).optional(),
 amount:z.number().min(0).max(100).optional(),
 sharpen:z.number().min(0).max(100).optional(),glow:z.number().min(0).max(100).optional(),
 grain:z.number().min(0).max(100).optional(),shake:z.number().min(0).max(100).optional(),
});
const audioEffects=z.strictObject({
 low:z.number().min(-18).max(18).optional(),mid:z.number().min(-18).max(18).optional(),high:z.number().min(-18).max(18).optional(),
 comp:z.number().min(0).max(100).optional(),reverb:z.number().min(0).max(100).optional(),pitch:z.number().min(-12).max(12).optional(),
 voice:z.enum(['','deep','high','chipmunk','robot','radio','phone','megaphone','echo','monster']).optional(),
});
const sticker=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('shape'),id:z.enum(['rect','round','circle','triangle','star','arrow','line','heart','cuboid'])}),
 z.strictObject({type:z.literal('graphic'),id:z.enum(['arrow','underline','circle','focus','cursor','pin','record','play','bookmark','speech','burst','sparkle','confetti','tape'])}),
 meshSticker,
]);
const layer=z.object({x:unit,y:unit,opacity:unit.optional(),delay:time.optional(),anim:z.enum(['none','fade','up','left','wipe','pop']).optional()});
const titleLayer=z.discriminatedUnion('type',[
 layer.extend({type:z.literal('text'),text:z.string().min(1).max(300),size:z.number().min(12).max(240),
  weight:z.number().int().min(100).max(900).optional(),color,align:z.enum(['left','center','right']).optional(),w:unit.optional(),
  font:z.string().max(100).optional(),shadow:z.boolean().optional()}).strict(),
 layer.extend({type:z.literal('box'),w:unit,h:unit,fill:color,radius:z.number().min(0).max(100).optional(),
  line:z.number().min(0).max(30).optional(),lineColor:color.optional()}).strict(),
 layer.extend({type:z.literal('path'),name:z.string().max(40),w:unit.gt(0),h:unit.gt(0),
  d:z.string().min(1).max(700_000).regex(/^[MLZ0-9.,\s-]+$/),fill:color.optional(),
  line:z.number().min(0).max(30).optional(),lineColor:color.optional()}).strict(),
]);
const titleContent={name:z.string().trim().min(1).max(80),layers:z.array(titleLayer).min(1).max(16)};
const libraryTemplate=z.union([textTemplate,z.strictObject({id,...titleContent,dur:duration})]);
const manifest=z.looseObject({
 app:z.literal('tempoloom-editor'),v:z.literal(1),
 project:z.looseObject({id,name:z.string().max(256),tracks:z.array(track).max(256),clips:z.array(clip).max(20_000)}),
 media:z.array(asset).max(2000),luts:z.array(asset).max(1000),coverImage:z.string().max(1_000_000).nullable().optional(),
 textTemplates:z.array(libraryTemplate).max(100).optional(),
});
const titleScene=z.strictObject({...titleContent,start:time,duration});
const visualKeys={x:keyValues.x,y:keyValues.y,scale:keyValues.scale,rotate:keyValues.rotate,opacity:unit};
const visualKeyframes=z.array(z.strictObject({
 at:unit,ease:z.enum(['linear','smooth','in','out']).default('smooth'),...z.object(visualKeys).partial().shape,
}).refine(({x,y,scale,rotate,opacity})=>[x,y,scale,rotate,opacity].some(value=>value!==undefined),
 'Choose a visual property for each keyframe')).min(1).max(24)
 .refine(points=>points.every((point,i)=>i===0||point.at>points[i-1]!.at),'Visual keyframes must be in time order');
function motionCurves(keyframes:z.infer<typeof visualKeyframes>,duration:number){
 const curves:Record<string,{t:number;v:number;e:string}[]>={};
 for(const {at,ease,...values} of keyframes){
  for(const [property,value] of Object.entries(values)){
   if(value!==undefined)(curves[property]??=[]).push({t:at*duration,v:value,e:ease});
  }
 }
 return curves;
}
const screenCrop=z.strictObject({l:unit,r:unit,t:unit,b:unit})
 .refine(({l,r,t,b})=>l+r<1&&t+b<1,'Crop must leave part of the source visible');
const compositionScene=titleScene.extend({
 backdrop:color.optional(),
 keyframes:visualKeyframes.optional(),
 visual:z.strictObject({
  mediaId:id,sourceStart:time.default(0),x:keyValues.x.default(0.29),y:keyValues.y.default(0),
  scale:keyValues.scale.default(0.32),opacity:unit.default(1),behindTitle:z.boolean().default(false),
  keyframes:visualKeyframes.optional(),crop:screenCrop.optional(),
 }).optional(),
});
const captionCue=z.strictObject({text:z.string().trim().min(1).max(1000),start:time,duration});
export const operation=z.discriminatedUnion('type',[
 target.extend({type:z.literal('move'),start:time,trackId:id.optional()}).strict(),
 target.extend({type:z.literal('ungroup')}).strict(),
 target.extend({type:z.literal('detachAudio')}).strict(),
 target.extend({type:z.literal('reattachAudio')}).strict(),
 z.strictObject({type:z.literal('groupClips'),clipIds:z.array(id).min(2).max(100)}),
 target.extend({type:z.literal('trim'),start:time,end:time}).strict(),
 target.extend({type:z.literal('split'),at:time}).strict(),
 target.extend({type:z.literal('remove')}).strict(),
 target.extend({type:z.literal('rippleRemove')}).strict(),
 target.extend({type:z.literal('audio'),volume:z.number().min(0).max(2).optional(),muted:z.boolean().optional(),
  fadeIn:time.optional(),fadeOut:time.optional()}).strict(),
 target.extend({type:z.literal('text'),text:z.string().trim().min(1).max(2000)}).strict(),
 target.extend({type:z.literal('transform'),x:keyValues.x.optional(),y:keyValues.y.optional(),
  scale:keyValues.scale.optional(),rotate:keyValues.rotate.optional(),opacity:unit.optional(),
  tiltX:keyValues.tiltX.optional(),tiltY:keyValues.tiltY.optional(),depth3d:keyValues.depth3d.optional()}).strict(),
 target.extend({type:z.literal('keyframe'),key:z.enum(['x','y','scale','rotate','opacity','volume',...geometryKeys]),at:time,
  value:z.number(),ease:z.enum(['linear','smooth','in','out']).optional()}).strict(),
 target.extend({type:z.literal('adjustColor'),values:adjustments.nullable()}).strict(),
 target.extend({type:z.literal('gradeColor'),values:grading.nullable()}).strict(),
 target.extend({type:z.literal('videoEffects'),values:videoEffects.nullable()}).strict(),
 target.extend({type:z.literal('audioEffects'),values:audioEffects.nullable()}).strict(),
 target.extend({type:z.literal('positionLock'),locked:z.boolean()}).strict(),
 z.strictObject({type:z.literal('trackSettings'),trackId:id,values:z.strictObject({
  name:z.string().trim().max(80).optional(),locked:z.boolean().optional(),hidden:z.boolean().optional(),
  muted:z.boolean().optional(),syncLock:z.boolean().optional(),pan:z.number().min(-1).max(1).optional(),
 })}),
 target.extend({type:z.literal('mask'),values:mask}).strict(),
 target.extend({type:z.literal('transition'),effect:z.enum(['none','crossfade',...visualTransitions]),
  duration:duration.optional()}).strict(),
 z.strictObject({type:z.literal('addText'),text:z.string().trim().min(1).max(2000),start:time,duration,
  style:z.enum(['title','lowerThird','caption']).optional(),animation:z.enum(['none','fade','slide','pop','type']).optional()}),
 z.strictObject({type:z.literal('addCaptions'),language:z.string().regex(/^[a-z]{2,3}$/).optional(),cues:z.array(captionCue).min(1).max(1000)}),
 z.strictObject({type:z.literal('addSticker'),sticker,start:time,duration,color:color.optional()}),
 titleScene.extend({type:z.literal('addMotionTitle')}),
 z.strictObject({type:z.literal('addMotionComposition'),name:titleContent.name,start:time,scenes:z.array(compositionScene).min(1).max(30)}),
 z.strictObject({type:z.literal('addAdjustmentLayer'),name:titleContent.name,start:time,duration,adjust:adjustments.optional(),effects:videoEffects.optional()}),
 z.strictObject({type:z.literal('addTextTemplate'),templateId:id,start:time,text:z.string().max(2000).optional(),duration:duration.optional()}),
 z.strictObject({type:z.literal('addMulticam'),name:titleContent.name,start:time,
  angles:z.array(z.strictObject({mediaId:id,offset:time,sourceStart:time.default(0),duration})).min(2).max(8),
  audioAngle:z.number().int().min(0).max(7).default(0)}),
 target.extend({type:z.literal('switchMulticam'),at:time,angle:z.number().int().min(0).max(7)}).strict(),
 target.extend({type:z.literal('replaceTitle'),...titleContent}).strict(),
 z.strictObject({type:z.literal('addMedia'),mediaId:id,start:time,duration,sourceStart:time.optional(),trackId:id.optional(),overlay:z.boolean().optional()}),
]);
export const operations=z.array(operation).min(1).max(100);
type Operation=z.infer<typeof operation>;
const eps=0.001;
const extraVideoTrack=(p:Project)=>{
 const trackId=randomUUID(),main=p.tracks.findIndex(track=>track.kind==='video'&&track.main);
 p.tracks.splice(main<0?0:main,0,{id:trackId,kind:'video'});
 return trackId;
};
function setTitle(c:Clip,title:{name:string;layers:z.infer<typeof titleLayer>[]}){
 if(title.layers.some(layer=>(layer.delay??0)>=c.dur))fail('Layer delays must fit inside the title');
 c.title={name:title.name,layers:title.layers};
}
function avoidOverlap(p:Project,c:Clip){
 if(p.clips.some(other=>other.id!==c.id&&other.track===c.track&&other.start<c.start+c.dur-eps&&other.start+other.dur>c.start+eps))
  fail('Edit overlaps a clip on the same track',409);
}
const requiresCoordination=(c:Clip)=>c.group||c.link||c.linkId||c.detached||c.nest||c.trans||c.kf||c.positionLocked;
const meets=(left:Clip,right:Clip)=>left.id!==right.id&&left.track===right.track&&Math.abs(left.start+left.dur-right.start)<0.05;
function canMoveTogether(p:Project,clips:Clip[],checkTransitions=true){
 const ids=new Set(clips.map(c=>c.id));
 if(clips.some(c=>c.positionLocked||p.tracks.find(t=>t.id===c.track)?.locked))fail('Position or track is locked',409);
 if(clips.some(c=>c.group&&p.clips.some(other=>other.group===c.group&&!ids.has(other.id))))
  fail('The move would separate a clip group',409);
 if(clips.some(c=>{
  if(c.link)return true;
  if(!c.linkId)return Boolean(c.detached);
  const linked=p.clips.filter(other=>other.linkId===c.linkId);
  return linked.length<2||linked.some(other=>!ids.has(other.id));
 }))fail('This clip has a separate linked source',409);
 for(const right of checkTransitions?p.clips.filter(c=>c.trans):[]){
  const left=p.clips.find(c=>meets(c,right));
  if(left&&ids.has(left.id)!==ids.has(right.id))fail('The move would separate a transition',409);
 }
}
const rampPoints=z.array(z.tuple([unit,z.number().min(0.1).max(10)])).min(2).max(100).refine(points=>
 points[0]?.[0]===0&&points.at(-1)?.[0]===1&&points.every((point,index)=>index===0||point[0]>points[index-1]![0]),
 'Invalid speed curve');
type Ramp=z.infer<typeof rampPoints>;
function rampRate(points:Ramp,position:number){
 if(position<=0)return points[0]![1];
 const index=points.findIndex(point=>point[0]>=position);
 if(index<1)return points.at(-1)![1];
 const [from,first]=points[index-1]!,[to,last]=points[index]!;
 return first+(last-first)*(position-from)/(to-from);
}
function rampSlice(points:Ramp,from:number,to:number):Ramp{
 return [[0,rampRate(points,from)],...points.filter(([t])=>t>from&&t<to)
  .map(([t,rate]):[number,number]=>[(t-from)/(to-from),rate]),[1,rampRate(points,to)]];
}
function rampArea(points:Ramp,position:number){
 let area=0;
 for(let i=1;i<points.length&&points[i-1]![0]<position;i++){
  const [from,rate]=points[i-1]!,to=Math.min(points[i]![0],position);
  area+=(to-from)*(rate+rampRate(points,to))/2;
 }
 return area;
}
function clipTimeMap(clip:Clip){
 const start=clip.start,length=clip.dur,from=clip.in??0,speed=clip.speed??1;
 const ramp=clip.ramp?rampPoints.parse(clip.ramp):undefined;
 const normalized=(at:number)=>Math.min(1,Math.max(0,(at-start)/length));
 const sourceAt=(at:number)=>from+speed*(ramp?length*rampArea(ramp,normalized(at)):at-start);
 return {ramp,normalized,sourceAt};
}
export function clipSourceRange(clip:Clip){
 const {sourceAt,ramp}=clipTimeMap(clip),start=clip.start,end=start+clip.dur;
 const from=sourceAt(start),until=sourceAt(end);
 const timelineAt=(source:number)=>{
  if(source<=from)return start;
  if(source>=until)return end;
  if(!ramp)return start+(source-from)/(clip.speed??1);
  let low=start,high=end;
  for(let step=0;step<40;step++){
   const middle=(low+high)/2;
   if(sourceAt(middle)<source)low=middle;
   else high=middle;
  }
  return (low+high)/2;
 };
 return {from,until,timelineAt};
}
const keyframePoints=z.record(z.string(),z.array(z.looseObject({t:z.number(),v:z.number()})));
function sliceClip(c:Clip,start:number,end:number){
 const {ramp,normalized,sourceAt}=clipTimeMap(c);
 const sliced:Clip={...c,start,dur:end-start};
 if(c.media)sliced.in=sourceAt(start);
 if(ramp)sliced.ramp=rampSlice(ramp,normalized(start),normalized(end));
 if(c.kf){
  const from=start-c.start,to=end-c.start;
  sliced.kf=Object.fromEntries(Object.entries(keyframePoints.parse(c.kf)).map(([key,points])=>{
   const first=points.findIndex(point=>point.t>=from),after=points.findIndex(point=>point.t>to);
   // The adjacent points outside the slice preserve the original easing at its edges.
   return [key,points.slice(first<0?-1:Math.max(0,first-1),after<0?undefined:after+1)
    .map(point=>({...point,t:point.t-from}))];
  }));
 }
 return sliced;
}
function rippleAfterRemoval(p:Project,removed:Clip){
 const tracks=new Set(p.tracks.filter(t=>!t.locked&&(t.id===removed.track||t.syncLock)).map(t=>t.id));
 const end=removed.start+removed.dur,followers:Clip[]=[];
 for(const clip of p.clips){
  if(!tracks.has(clip.track))continue;
  if(clip.start>=end-eps)followers.push(clip);
  else if(clip.start+clip.dur>removed.start+eps)fail('Ripple would cut through a clip on a linked track',409);
 }
 canMoveTogether(p,followers);
 for(const clip of followers)clip.start=Math.max(0,clip.start-removed.dur);
 for(const clip of followers)avoidOverlap(p,clip);
}
function apply(p:Project,op:Operation,library:Pick<Manifest,'media'|'luts'|'textTemplates'>){
 if(op.type==='addAdjustmentLayer'){
  const trackId=randomUUID();
  p.tracks.unshift({id:trackId,kind:'video'});
  p.clips.push({id:randomUUID(),track:trackId,start:op.start,dur:op.duration,adjustment:true,adjustmentName:op.name,
   adj:op.adjust,fx:op.effects,opacity:1,scale:1});
  return;
 }
 if(op.type==='addMulticam'){
  if(op.audioAngle>=op.angles.length)fail('Multicam audio angle is out of range');
  const first=op.angles.findIndex(angle=>angle.offset===0);
  if(first<0)fail('At least one camera angle must start at zero');
  const tracks=op.angles.map((angle,i)=>{
   const media=library.media.find(asset=>asset.id===angle.mediaId)??fail('Camera angle media not found',404);
   if(media.type!=='video'||(media.dur??0)+eps<angle.sourceStart+angle.duration)fail('Camera angle exceeds available video');
   return {id:'mc'+i,kind:'video',name:media.name.slice(0,30)};
  });
  const clips=op.angles.map((angle,i)=>({id:randomUUID(),track:tracks[i]!.id,start:angle.offset,dur:angle.duration,
   in:angle.sourceStart,media:angle.mediaId,speed:1,volume:1,opacity:1,scale:1}));
  const dur=Math.max(...clips.map(clip=>clip.start+clip.dur));
  p.clips.push({id:randomUUID(),track:extraVideoTrack(p),start:op.start,dur,in:0,scale:1,opacity:1,
   nest:{name:op.name,multi:true,tracks,clips,dur,audio:'mc'+op.audioAngle,cuts:[{t:0,a:first}]}});
  return;
 }
 if(op.type==='trackSettings'){
  const track=p.tracks.find(item=>item.id===op.trackId)??fail('Track not found',404);
  Object.assign(track,op.values);return;
 }
 if(op.type==='addSticker'){
  const free=p.tracks.find(track=>track.kind==='sticker'&&!track.locked&&!track.hidden&&
   !p.clips.some(clip=>clip.track===track.id&&clip.start<op.start+op.duration-eps&&clip.start+clip.dur>op.start+eps));
  const trackId=free?.id??randomUUID();
  if(!free)p.tracks.unshift({id:trackId,kind:'sticker'});
  p.clips.push({id:randomUUID(),track:trackId,start:op.start,dur:op.duration,sticker:op.sticker,
   ...(op.color?{color:op.color}:op.sticker.type==='shape'?{color:'#ffd23f'}:{}),
   ...(op.sticker.type==='mesh'?{color:op.color??'#71A7F4',depth3d:1}:{}),
   x:0,y:0,rotate:0,scale:0.75,initialScale:0.75,opacity:1,animIn:'pop',animOut:'none',animDur:Math.min(op.duration/2,0.4)});
  return;
 }
 if(op.type==='addCaptions'){
  const trackId=randomUUID(),cues=[...op.cues].sort((a,b)=>a.start-b.start);
  if(cues.some((cue,i)=>i>0&&cues[i-1]!.start+cues[i-1]!.duration>cue.start+eps))fail('Caption cues overlap',409);
  p.tracks.unshift({id:trackId,kind:'text',name:'Captions'});
  for(const cue of cues)p.clips.push({id:randomUUID(),track:trackId,start:cue.start,dur:cue.duration,
   text:cue.text,cap:true,lang:op.language,size:42,weight:700,color:'#ffffff',stroke:3,strokeColor:'#000000',
   x:0,y:0.32,align:'center',opacity:1,scale:1});
  return;
 }
 if(op.type==='groupClips'){
  const ids=new Set(op.clipIds),clips=p.clips.filter(c=>ids.has(c.id));
  if(clips.length!==ids.size||ids.size<2)fail('Choose at least two different clips to group');
  if(clips.some(c=>p.tracks.find(track=>track.id===c.track)?.locked))fail('A selected track is locked',409);
  if(clips.some(c=>c.linkId))fail('Reattach detached audio before regrouping these clips',409);
  const groups=new Set(clips.flatMap(c=>c.group?[c.group]:[]));
  if(p.clips.some(c=>c.group&&groups.has(c.group)&&!ids.has(c.id)))fail('Select every member of each existing group first',409);
  const key=randomUUID();
  for(const clip of clips)clip.group=key;
  return;
 }
 if(op.type==='addMotionComposition'){
  const clips=op.scenes.map(scene=>{
   const c:Clip={id:randomUUID(),track:'titles',start:scene.start,dur:scene.duration,scale:1,opacity:1};
   setTitle(c,scene);
   if(scene.keyframes)c.kf=motionCurves(scene.keyframes,scene.duration);
   return c;
  });
  const sorted=[...clips].sort((a,b)=>a.start-b.start);
  if(sorted.some((clip,index)=>index>0&&clip.start<sorted[index-1]!.start+sorted[index-1]!.dur-eps))
   fail('Motion scenes overlap inside the composition',409);
  const dur=Math.max(...clips.map(c=>c.start+c.dur));
  const tracks:Project['tracks']=[{id:'titles',kind:'text'},{id:'video',kind:'video',main:true}];
  for(const scene of op.scenes){
   if(!scene.backdrop)continue;
   const backdrop:Clip={id:randomUUID(),track:'backdrops',start:scene.start,dur:scene.duration};
   setTitle(backdrop,{name:'Backdrop',layers:[{type:'box',x:0.5,y:0.5,w:1,h:1,fill:scene.backdrop}]});
   clips.push(backdrop);
  }
  const visuals=op.scenes.flatMap(scene=>{
   if(!scene.visual)return [];
   const {mediaId,sourceStart,x,y,scale,opacity,keyframes,behindTitle,crop}=scene.visual;
   const media=library.media.find(asset=>asset.id===mediaId);
   if(!media||media.type!=='image'&&media.type!=='video'||media.type==='video'&&sourceStart+scene.duration>(media.dur??0)+eps)
    fail('The scene needs a shared image or a video covering its duration');
   const visual:Clip={id:randomUUID(),track:behindTitle?'under-titles':'visuals',start:scene.start,dur:scene.duration,
    media:mediaId,in:sourceStart,x,y,scale,opacity,speed:1,muted:true};
   if(crop)visual.crop=crop;
   if(keyframes)visual.kf=motionCurves(keyframes,scene.duration);
   return [visual];
  });
  if(visuals.some(clip=>clip.track==='visuals'))tracks.unshift({id:'visuals',kind:'video',name:'Visuals'});
  if(visuals.some(clip=>clip.track==='under-titles'))tracks.splice(tracks.length-1,0,{id:'under-titles',kind:'video',name:'Visuals'});
  if(op.scenes.some(scene=>scene.backdrop))tracks.splice(tracks.length-1,0,{id:'backdrops',kind:'text',name:'Backdrop'});
  clips.push(...visuals);
  p.clips.push({id:randomUUID(),track:extraVideoTrack(p),start:op.start,in:0,dur,x:0,y:0,scale:1,rotate:0,opacity:1,
   nest:{name:op.name,dur,tracks,clips}});
  return;
 }
 if(op.type==='addMedia'){
  const media=library.media.find(m=>m.id===op.mediaId)??fail('Shared media not found',404);
  const source=op.sourceStart??0,kind=media.type==='audio'?'audio':'video';
  if(!media.type||media.type!=='image'&&source+op.duration>(media.dur??0)+eps)fail('Media range exceeds the available source');
  const compatible=(t:Project['tracks'][number])=>t.kind===kind&&!t.locked&&!t.hidden&&!(op.overlay&&t.main);
  const chosen=op.trackId?p.tracks.find(t=>t.id===op.trackId&&compatible(t))??fail('Destination track is unavailable',409)
   :p.tracks.find(t=>compatible(t)&&!p.clips.some(c=>c.track===t.id&&c.start<op.start+op.duration-eps&&c.start+c.dur>op.start+eps));
  const trackId=chosen?.id??randomUUID();
  if(!chosen){
   const lane:Project['tracks'][number]={id:trackId,kind};
   if(kind==='audio')p.tracks.push(lane);
   else{
    const main=p.tracks.findIndex(track=>track.main&&track.kind==='video');
    p.tracks.splice(main<0?0:main,0,lane);
   }
  }
  const c:Clip={id:randomUUID(),track:trackId,media:media.id,start:op.start,dur:op.duration,in:source,
   speed:1,volume:1,scale:1,x:0,y:0,rotate:0,opacity:1,fadeIn:0,fadeOut:0};
  avoidOverlap(p,c);p.clips.push(c);
  return;
 }
 if(op.type==='addText'||op.type==='addMotionTitle'||op.type==='addTextTemplate'){
  const template=op.type==='addTextTemplate'?library.textTemplates?.find(item=>item.id===op.templateId)??fail('Shared text template not found',404):null;
  const clipDuration=op.duration??(template&&('layers' in template?template.dur:template.style.dur))??3;
  const candidate:Clip={id:randomUUID(),track:'text',start:op.start,dur:clipDuration,x:0,y:0,rotate:0,opacity:1,scale:1};
  if(op.type==='addMotionTitle'){
   setTitle(candidate,op);
  }else if(op.type==='addTextTemplate'&&template){
   if('layers' in template){
    const first=template.layers.findIndex(layer=>layer.type==='text');
    setTitle(candidate,{name:template.name,layers:template.layers.map((layer,index)=>
     layer.type==='text'&&first===index&&op.text!==undefined?titleLayer.parse({...layer,text:op.text}):layer)});
   }else Object.assign(candidate,{size:48,weight:600,color:'#ffffff',align:'center'},template.style,{dur:clipDuration,text:op.text??template.text});
  }else if(op.type==='addText'){
   Object.assign(candidate,{text:op.text,size:48,weight:600,color:'#ffffff',align:'center'});
   if(op.style==='lowerThird')Object.assign(candidate,{x:-0.2,y:0.34,size:40,align:'left',box:true,boxColor:'#000000'});
   if(op.style==='caption')Object.assign(candidate,{y:0.32,size:42,stroke:3,strokeColor:'#000000'});
   if(op.animation)Object.assign(candidate,{animIn:op.animation,animOut:'none',animDur:Math.min(0.5,op.duration/2)});
  }
  const free=p.tracks.find(t=>t.kind==='text'&&!t.locked&&!t.hidden&&!p.clips.some(c=>c.track===t.id&&c.start<candidate.start+candidate.dur-eps&&c.start+c.dur>candidate.start+eps));
  candidate.track=free?.id??randomUUID();
  if(!free)p.tracks.unshift({id:candidate.track,kind:'text'});
  p.clips.push(candidate);
  return;
 }
 const c=p.clips.find(value=>value.id===op.clipId)??fail('Clip not found',404);
 const current=p.tracks.find(t=>t.id===c.track)??fail('Clip track not found',404);
 if(current.locked)fail('Clip track is locked',409);
 if(op.type==='detachAudio'){
  if(current.kind!=='video'||!c.media||!library.media.some(media=>media.id===c.media&&media.type==='video'))
   fail('Choose a video clip to detach its sound');
  if(c.group||c.link||c.linkId||c.detached)fail('This clip already belongs to a group or has detached sound',409);
  if(c.trans||p.clips.some(other=>other.trans&&meets(c,other)))fail('Remove the adjoining transition before detaching audio',409);
  const free=p.tracks.find(t=>t.kind==='audio'&&!t.locked&&!t.hidden&&
   !p.clips.some(other=>other.track===t.id&&other.start<c.start+c.dur-eps&&other.start+other.dur>c.start+eps));
  const trackId=free?.id??randomUUID(),link=randomUUID();
  if(!free)p.tracks.push({id:trackId,kind:'audio'});
  const audio:Clip={id:randomUUID(),track:trackId,media:c.media,start:c.start,dur:c.dur,in:c.in??0,
   speed:c.speed??1,ramp:c.ramp,volume:c.volume,fadeIn:c.fadeIn,fadeOut:c.fadeOut,muted:c.muted||current.muted,afx:c.afx,
   kf:(c.kf as {volume?:unknown}|undefined)?.volume?{volume:(c.kf as {volume:unknown}).volume}:undefined,
   asAudio:true,group:link,linkId:link};
  c.detached=true;c.group=link;c.linkId=link;
  p.clips.push(audio);
  return;
 }
 if(op.type==='reattachAudio'){
  const linked=c.linkId?p.clips.filter(other=>other.linkId===c.linkId):[];
  const video=linked.find(other=>other.detached),audio=linked.find(other=>other.asAudio);
  if(!video||!audio||linked.length!==2)throw new EditorProjectError(409,'No linked audio to reattach');
  if(linked.some(other=>p.tracks.find(track=>track.id===other.track)?.locked))fail('An audio source track is locked',409);
  if(!sameSourceRange(video,audio))fail('Linked video and audio are out of sync',409);
  for(const prop of ['volume','muted','fadeIn','fadeOut','afx'])video[prop]=audio[prop];
  const points={...(video.kf as Record<string,unknown>|undefined)},volume=(audio.kf as {volume?:unknown}|undefined)?.volume;
  if(volume)points.volume=volume;else delete points.volume;
  if(Object.keys(points).length)video.kf=points;else delete video.kf;
  delete video.detached;delete video.group;delete video.linkId;
  p.clips=p.clips.filter(item=>item!==audio);
  return;
 }
 if(op.type==='switchMulticam'){
  const nest=z.looseObject({multi:z.literal(true),tracks:z.array(track),clips:z.array(clip),
   cuts:z.array(z.strictObject({t:time,a:z.number().int().nonnegative()}))}).parse(c.nest);
  const destination=nest.tracks.filter(track=>track.kind==='video')[op.angle],at=op.at-c.start+(c.in??0);
  if(op.at<c.start||op.at>=c.start+c.dur||!destination||!nest.clips.some(clip=>clip.track===destination.id&&at>=clip.start&&at<clip.start+clip.dur))
   fail('The requested angle has no footage at that time');
  const cuts=nest.cuts.filter(cut=>(cut.t===0&&at>0)||Math.abs(cut.t-at)>1/60);
  cuts.push({t:at,a:op.angle});
  cuts.sort((a,b)=>a.t-b.t);
  c.nest={...nest,cuts:cuts.filter((cut,index)=>index===0||cut.a!==cuts[index-1]!.a)};
  return;
 }
 if(op.type==='positionLock'){
  if(current.kind==='audio'||c.adjustment)fail('Choose a visual clip to lock its position');
  if(op.locked)c.positionLocked=true;
  else delete c.positionLocked;
  return;
 }
 if(op.type==='videoEffects'){
  if(current.kind!=='video')fail('Video effects require a video track',409);
  if(op.values===null)delete c.fx;
  else c.fx={...(c.fx as object|undefined),...op.values};
  return;
 }
 if(op.type==='audioEffects'){
  if(!c.media||!library.media.some(item=>item.id===c.media&&item.type!=='image'))fail('Audio effects require media with sound',409);
  if(op.values===null)delete c.afx;
  else c.afx={...(c.afx as object|undefined),...op.values};
  return;
 }
 if(op.type==='ungroup'){
  const group=c.group;
  if(!group)return;
  const clips=p.clips.filter(other=>other.group===group);
  if(clips.some(clip=>clip.linkId))fail('Reattach the audio before ungrouping these clips',409);
  if(clips.some(clip=>p.tracks.find(t=>t.id===clip.track)?.locked))fail('A group track is locked',409);
  for(const clip of clips)delete clip.group;
  return;
 }
 if(op.type==='move'){
  const clips=c.group?p.clips.filter(other=>other.group===c.group):[c];
  const destination=p.tracks.find(track=>track.id===(op.trackId??c.track))??fail('Destination track not found',404);
  if(destination.locked||destination.kind!==current.kind)fail('Destination track is locked or incompatible',409);
  canMoveTogether(p,clips);
  if(destination.id!==c.track&&(clips.length>1||c.trans||p.clips.some(right=>right.trans&&meets(c,right))))
   fail('A linked clip cannot switch tracks',409);
  const delta=op.start-c.start;
  if(clips.some(clip=>clip.start+delta<0))fail('The move would place a linked clip before the timeline');
  c.track=destination.id;
  for(const clip of clips)clip.start+=delta;
  for(const clip of clips)avoidOverlap(p,clip);
  return;
 }
 if(op.type==='replaceTitle'){
  if(!c.title)fail('This clip is not a motion title',409);
  setTitle(c,op);return;
 }
 if(op.type==='adjustColor'){
  if(current.kind!=='video'&&!c.adjustment)fail('Color adjustment requires a video or adjustment clip',409);
  if(op.values===null)delete c.adj;
  else c.adj={...(c.adj as object|undefined),...op.values};
  return;
 }
 if(op.type==='gradeColor'){
  if(current.kind!=='video'&&!c.adjustment)fail('Color grading requires a video or adjustment clip',409);
  if(op.values===null){delete c.grade;return;}
  const {lut,curves,hsl,...wheels}=op.values;
  const grade={...(c.grade as Omit<z.infer<typeof grading>,'lut'>&{lut?:{id:string;mix:number;name?:string}}|undefined),...wheels};
  if(curves)grade.curves={...grade.curves,...curves};
  if(hsl)grade.hsl={...grade.hsl,...hsl};
  if(lut){
   const look=library.luts.find(item=>item.id===lut.id)??fail('Shared look not found',404);
   grade.lut={...lut,name:look.name};
  }else if(lut===null)delete grade.lut;
  c.grade=grade;return;
 }
 if(op.type==='mask'){
  if(current.kind!=='video'||c.adjustment)fail('A mask requires a visual media clip',409);
  if(op.values.shape==='none')delete c.mask;
  else c.mask={w:0.8,h:0.8,x:0,y:0,feather:0,...(c.mask as object|undefined),...op.values};
  return;
 }
 if(op.type==='transition'){
  if(op.effect==='none'){delete c.trans;return;}
  const previous=p.clips.find(other=>meets(other,c))??fail('A transition needs an adjoining clip on the same track',409);
  if(op.effect==='crossfade'?current.kind!=='audio':current.kind!=='video')fail('Transition is incompatible with the track',409);
  const length=Math.min(previous.dur,c.dur);
  if(op.duration!==undefined&&op.duration>length)fail('Transition exceeds an adjoining clip',409);
  c.trans={type:op.effect,dur:op.duration??Math.min(0.6,length)};
  return;
 }
 if(op.type==='audio'){
  if(!c.media)fail('The clip has no media audio');
  const {type:_type,clipId:_id,within:_within,...values}=op;
  if((values.fadeIn??0)>c.dur||(values.fadeOut??0)>c.dur)fail('Audio fades must fit inside the clip');
  if(values.volume!==undefined&&(c.kf as {volume?:unknown}|undefined)?.volume)fail('Clip volume uses keyframes',409);
  Object.assign(c,values);return;
 }
 if(op.type==='transform'){
  if(current.kind==='audio'||c.adjustment||c.positionLocked||c.kf)fail('The clip needs an unlocked visual transform',409);
  if(geometryKeys.some(key=>op[key]!==undefined)&&!has3DGeometry(c))fail('3D geometry controls require a 3D box or mesh');
  const {type:_type,clipId:_id,within:_within,...values}=op;
  Object.assign(c,values);return;
 }
 if(op.type==='keyframe'){
  if(op.at>c.dur)fail('Keyframe time is relative to the clip and must fit inside it');
  if(geometryKeys.some(key=>key===op.key)&&!has3DGeometry(c))fail('3D geometry keyframes require a 3D box or mesh');
  if(op.key==='volume'? !c.media : current.kind==='audio'||c.positionLocked||c.adjustment)fail('The clip cannot use that keyframe',409);
  const values=keyframePoints.parse(c.kf??{});
  const points=(values[op.key]??[]).filter(point=>point.t<0||point.t>c.dur||Math.abs(point.t-op.at)>=1/60);
  points.push({t:op.at,v:keyValues[op.key].parse(op.value),...(op.ease?{e:op.ease}:{})});
  c.kf={...values,[op.key]:points.sort((a,b)=>a.t-b.t)};
  return;
 }
 if(op.type==='text'){if(c.text===undefined)fail('The clip is not a text clip');c.text=op.text;return;}
 if((op.type==='trim'||op.type==='split')&&c.linkId){
  const linked=p.clips.filter(other=>other.linkId===c.linkId);
  if(linked.length!==2||linked.filter(clip=>clip.detached).length!==1||linked.filter(clip=>clip.asAudio).length!==1||
   linked.some(clip=>!sameSourceRange(clip,c)))
   fail('Linked video and audio must share the same source range',409);
  canMoveTogether(p,linked,false);
  cutClips(p,linked,op);
  return;
 }
 if(requiresCoordination(c)||p.clips.some(other=>other.trans&&meets(c,other)))fail('This clip requires a coordinated edit in the editor',409);
 if(op.type==='remove'||op.type==='rippleRemove'){
  p.clips=p.clips.filter(other=>other!==c);
  if(op.type==='rippleRemove')rippleAfterRemoval(p,c);
  return;
 }
 cutClips(p,[c],op);
}
function sameSourceRange(a:Clip,b:Clip){
 return a.media===b.media&&a.start===b.start&&a.dur===b.dur&&(a.in??0)===(b.in??0)&&
  (a.speed??1)===(b.speed??1)&&JSON.stringify(a.ramp??null)===JSON.stringify(b.ramp??null);
}
function cutClips(p:Project,clips:Clip[],op:Extract<Operation,{type:'split'|'trim'}>){
 const first=clips[0]!,start=first.start,end=start+first.dur;
 const transitionSchema=z.looseObject({dur:duration});
 const retain=(left:Clip|undefined,right:Clip)=>{
  if(!right.trans)return;
  const transition=transitionSchema.parse(right.trans);
  const dur=left&&meets(left,right)?Math.min(left.dur,right.dur,transition.dur):0;
  if(dur===transition.dur)return;
  if(p.tracks.find(t=>t.id===right.track)?.locked)fail('Transition track is locked',409);
  if(dur<eps)delete right.trans;
  else right.trans={...transition,dur};
 };
 if(op.type==='split'){
  if(op.at-start<eps||end-op.at<eps)fail('Split must be inside the clip');
  const link=clips.length>1?randomUUID():undefined;
  for(const c of clips){
   const previous=p.clips.find(other=>meets(other,c)),next=p.clips.find(other=>other.trans&&meets(c,other));
   const right=sliceClip(c,op.at,end);
   delete right.trans;
   const part={...right,id:randomUUID(),fadeIn:0,...(link?{group:link,linkId:link}:{})};
   p.clips.push(part);
   Object.assign(c,sliceClip(c,start,op.at),{fadeOut:0});
   retain(previous,c);if(next)retain(part,next);
  }
 }else{
  if(op.start<start||op.end>end+1e-9||op.end-op.start<eps)fail('Trim must keep a range inside the clip');
  for(const c of clips){
   const previous=p.clips.find(other=>meets(other,c)),next=p.clips.find(other=>other.trans&&meets(c,other));
   Object.assign(c,sliceClip(c,op.start,Math.min(end,op.end)));
   retain(previous,c);if(next)retain(c,next);
  }
 }
}

function update(id:string,base:number,change:(row:Row,db:DatabaseSync)=>{data:Manifest;bundle?:string},upload?:Uint8Array){
 return database(db=>{
  let newFile:string|undefined;
  db.exec('BEGIN IMMEDIATE');
  try{
   const row=latest(db,id);
   if(revision.parse(base)!==row.revision)fail(`Project is now at revision ${row.revision}. Read it again before editing.`,409);
   const changeSet=change(row,db),data=manifest.parse(changeSet.data),next=row.revision+1;
   validateTimeline(data);
   let bundle=changeSet.bundle??assetBundle(db,row);
   if(upload){
    bundle=randomUUID();
    const file=bundlePath(bundle),fd=fs.openSync(file,'wx');
    newFile=file;
    try{fs.writeFileSync(fd,upload);}finally{fs.closeSync(fd);}
   }
   db.prepare('INSERT INTO editor_project_revision VALUES (?,?,?)').run(id,next,JSON.stringify(data));
   if(bundle!==id)db.prepare('INSERT INTO editor_project_assets VALUES (?,?,?)').run(id,next,bundle);
   db.exec('COMMIT');
   return {id,revision:next,project:data.project};
  }catch(error){
   db.exec('ROLLBACK');
   if(newFile)fs.rmSync(newFile,{force:true});
   throw error;
  }
 });
}
export function publishProject(id:string,base:number,bytes:Uint8Array){
 const data=readBundle(bytes);
 const current=projectAtBase(id,base);
 if(!data.textTemplates&&current.textTemplates)data.textTemplates=current.textTemplates;
 const retained=current.media.filter(item=>!data.media.some(media=>media.id===item.id));
 const retainedLooks=current.luts.filter(item=>!data.luts.some(look=>look.id===item.id));
 if(!retained.length&&!retainedLooks.length)return update(id,base,()=>({data}),bytes);
 const entries=zipEntries(bytes),previous=storedEntries(id,base);
 for(const item of retained){
  const entry=mediaEntry(previous,item.id);
  if(entry)entries[entry]=previous[entry]!;
 }
 data.media.push(...retained);
 for(const look of retainedLooks){
  const entry='luts/'+look.id+'.cube';
  if(previous[entry])entries[entry]=previous[entry];
 }
 data.luts.push(...retainedLooks);
 return update(id,base,()=>({data}),packEntries(entries,data));
}
export function registerSharedTextTemplate(id:string,base:number,input:unknown){
 const template=libraryTemplate.parse(input);
 return update(id,base,row=>{
  const data=manifest.parse(JSON.parse(row.manifest));
  data.textTemplates=[...(data.textTemplates??[]).filter(item=>item.id!==template.id),template];
  return {data};
 });
}
export function updateSharedCover(id:string,base:number,image:string|null){
 if(image!==null&&(image.length>1_000_000||!/^data:image\/jpeg;base64,[a-z0-9+/]+={0,2}$/i.test(image)))
  fail('Cover image must be a JPEG');
 return update(id,base,row=>{
  const data=manifest.parse(JSON.parse(row.manifest));
  if(image===null)delete data.coverImage;
  else data.coverImage=image;
  return {data};
 });
}
function projectAtBase(id:string,base:number){
 const {id:_id,revision:current,...data}=inspectProject(id);
 if(revision.parse(base)!==current)fail(`Project is now at revision ${current}. Read it again before editing.`,409);
 return data;
}
const mediaEntry=(entries:Record<string,Uint8Array>,id:string)=>
 Object.keys(entries).find(name=>name==='media/'+id||name.startsWith('media/'+id+'.'));
export function sharedMediaAsset(project:string,at:number,id:string){
 const row=database(db=>atRevision(db,project,at)),data=read(row);
 const asset=data.media.find(item=>item.id===mediaId.parse(id))??fail('Shared media not found',404);
 const entries=storedEntries(project,at),entry=mediaEntry(entries,id);
 if(!entry)throw new EditorProjectError(404,'Shared media file not found');
 return {asset,bytes:entries[entry]!,extension:path.extname(entry)};
}

export function registerProjectMedia(id:string,base:number,bytes:Uint8Array){
 const incoming=zipEntries(bytes),data=projectAtBase(id,base);
 const item=asset.required({type:true,dur:true,mime:true}).parse(JSON.parse(Buffer.from(incoming['project.json']??[]).toString('utf8')));
 if(!item.mime.startsWith(item.type+'/')||(item.type!=='image'&&item.dur<=0))fail('Media must be a playable video, image, or audio file');
 if(data.media.some(media=>media.id===item.id))fail('This media is already shared',409);
 const entry=mediaEntry(incoming,item.id),contents=entry===undefined?undefined:incoming[entry];
 if(!entry||!contents?.byteLength||Object.keys(incoming).length!==2)throw new EditorProjectError(400,'The media upload must contain one file');
 const entries=storedEntries(id,base);
 entries[entry]=contents;
 data.media.push(item);
 return update(id,base,()=>({data}),packEntries(entries,data));
}
export function editProject(id:string,base:number,edits:unknown,commit?:(db:DatabaseSync,next:number)=>void){
 const batch=operations.parse(edits);
 return update(id,base,(row,db)=>{
  const data=edited(manifest.parse(JSON.parse(row.manifest)),batch);
  commit?.(db,row.revision+1);
  return {data};
 });
}
function edited(data:Manifest,batch:Operation[]){
 for(const item of batch){
  if(!('within' in item)||!item.within){apply(data.project,item,data);continue;}
  const nested:{parent:Clip;timeline:Project}[]=[];
  let timeline=data.project;
  for(const id of item.within){
   const parent=timeline.clips.find(c=>c.id===id)??fail('Nested clip not found',404);
   if(timeline.tracks.find(t=>t.id===parent.track)?.locked)fail('Nested clip track is locked',409);
   const container=z.looseObject({tracks:z.array(track).max(256),clips:z.array(clip).max(20_000)}).parse(parent.nest);
   timeline={...container,id:parent.id,name:timeline.name};
   nested.push({parent,timeline});
  }
  apply(timeline,item,data);
  for(const item of nested.reverse()){
   validateTimeline({...data,project:item.timeline});
   item.parent.nest={...(item.parent.nest as object),clips:item.timeline.clips,tracks:item.timeline.tracks,
    dur:Math.max(0.1,...item.timeline.clips.map(c=>c.start+c.dur))};
  }
 }
 return manifest.parse(data);
}
export function previewEdit(id:string,base:number,edits:unknown){
 const result=edited(projectAtBase(id,base),operations.parse(edits));
 validateTimeline(result);
 return result;
}
export function restoreProject(id:string,base:number,restore:number){
 return update(id,base,(_row,db)=>{
  const old=atRevision(db,id,restore);
  return {data:manifest.parse(JSON.parse(old.manifest)),bundle:assetBundle(db,old)};
 });
}
