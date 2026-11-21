// What a studio job keeps on disk, below both the studio (studio.ts) and its versions and comments
// (studio-versions.ts): the shape of a job's plan, where jobs live, the kept version of each
// finished step, and the fingerprints of the scenes the user locked or did not comment on.
// It imports neither of them, so they can both build on it without importing each other.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './config.js';
import type {Verdict} from './feedback.js';
import type {SelfCheck} from './selfcheck.js';

// ---------- the plan of a job ----------
export type Status='todo'|'doing'|'done'|'redo';
export type Scene={n:number;start:number;end:number;id?:string;label:string};
export type Comment={id:string;at:string;task:string;round:number;slot:string;time:number;scene:Scene;text:string;answered?:number};
export type Task={id:string;stage:number;role?:string;gate?:boolean;title:string;needs:string[];produces?:string;status:Status;output?:string;note?:string;
 applied:string[];learned:string[];started?:string;finished?:string;rounds:number;
 /** Files to show the user with this step (frames, a preview video, a sound sample). */
 show?:string[];
 /** Two or more versions to choose between, each with the lessons only it used. */
 choices?:{label:string;file:string;applied:string[]}[];picked?:string;
 /** The agent's own check of the video this step made, before the user sees it. */
 selfcheck?:SelfCheck;
 /** What the studio expects the user to say about this step, from their earlier ratings. */
 predicted?:{good:number;reasons:string[];basis:number};held?:number;
 /** After comments on moments of its video: the scenes this redo may change, and how the others looked. */
 scope?:{round:number;scenes:(Scene&{comments:string[]})[];keep?:Record<string,string>}};
export type Rating={at:string;task:string;round:number;rating:'good'|'ok'|'bad';predicted?:number;reasons:string[];note:string;parts:{part:string;rating:'good'|'bad';note:string}[];scored:string[];rule?:string;reopened:string[]};
export type Plan={version:1;job:string;type:string;title:string;request:string;options:string[];created:string;updated:string;videoJob?:string;verdict?:string;
 tasks:Task[];feedback:{at:string;said:string;rule:string;verdict:Verdict;lesson:string;topics:string[];roles:string[];reopened:string[]}[];
 /** The user's rating of each step (the Studio page, or `studio rate`). */
 ratings?:Rating[];
 /** The request from the Studio page this job was planned from. */
 source?:string;
 /** Hidden from the Studio page's list (nothing is deleted). */
 archived?:boolean;
 /** The taste profile this job follows (main when not set). */
 profile?:string;
 /** The second reviewer's taste: another profile, or a general viewer when not set. */
 secondProfile?:string;
 /** The user's comments on moments of the videos steps showed. */
 comments?:Comment[];
 /** Scenes the user marked final: later rounds keep them exactly as they were when locked. */
 locked?:{id:string;n:number;label:string;hash:string;at:string}[]};

// ---------- where jobs live ----------
export const studioRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','studio');
export const jobDir=(job:string)=>{if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(job))throw new Error('Not a studio job name: '+job);return path.join(studioRoot(),job);};

// ---------- the kept versions of each step ----------
export type Version={n:number;round:number;at:string;output?:string;outputName?:string;show:string[];names:string[];
 choices?:{label:string;file:string;applied:string[]}[];picked?:string;applied:string[];note?:string;from?:number;
 /** Copied into the job's versions folder (false: the files are only referenced, from before versions were kept). */
 kept:boolean};
const now=()=>new Date().toISOString();
const file=(job:string)=>path.join(jobDir(job),'versions.json');
export function readAll(job:string):Record<string,Version[]>{try{return JSON.parse(fs.readFileSync(file(job),'utf8')) as Record<string,Version[]>;}catch{return {};}}
export function writeAll(job:string,v:Record<string,Version[]>){const tmp=file(job)+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,1)+'\n');fs.renameSync(tmp,file(job));}
export const dirOf=(job:string,task:string,n:number)=>path.join(jobDir(job),'versions',task,'v'+n);
const safeName=(f:string)=>path.basename(f).normalize('NFKC').replace(/[^\p{L}\p{N}._ -]+/gu,'-').slice(0,90)||'file';
// A copy that shares the disk blocks where the file system allows it (copy-on-write), else a plain copy.
const copy=(from:string,to:string)=>{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_FICLONE);return to;};

/** Keeps the version a step just finished as (called by studio done). A step finished twice in the
 *  same round replaces that round's copy. */
export function keepVersion(p:Plan,t:Task):Version{
 const all=readAll(p.job),list=all[t.id]??[],n=t.rounds+1;
 const old=list.find(v=>v.n===n);if(old?.kept&&!old.from)fs.rmSync(dirOf(p.job,t.id,n),{recursive:true,force:true});
 const dir=dirOf(p.job,t.id,n),here=(f:string)=>fs.existsSync(f)&&fs.statSync(f).isFile();
 const output=t.output&&here(t.output)?copy(t.output,path.join(dir,'output-'+safeName(t.output))):undefined;
 const show=(t.show??[]).filter(here).map((f,k)=>copy(f,path.join(dir,`${k}-${safeName(f)}`)));
 const choices=t.choices?.map((c,k)=>({label:c.label,file:here(c.file)?copy(c.file,path.join(dir,`choice-${k}-${safeName(c.file)}`)):c.file,applied:c.applied}));
 const v:Version={n,round:t.rounds,at:t.finished??now(),...(output?{output,outputName:path.basename(t.output!)}:{}),show,names:(t.show??[]).filter(here).map(f=>path.basename(f)),
  ...(choices?.length?{choices}:{}),...(t.picked?{picked:t.picked}:{}),applied:[...t.applied],...(t.note?{note:t.note}:{}),kept:true};
 all[t.id]=[...list.filter(x=>x.n!==n),v].sort((a,b)=>a.n-b.n);writeAll(p.job,all);
 return v;
}

// ---------- the scenes of the job's video ----------
const projectFile=(id:string)=>/^[a-z0-9][a-z0-9_-]{0,150}$/i.test(id)?path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','projects',id,'project.json'):null;
type ProjectScene={id:string;text:string;start:number;duration:number};
/** The scenes of the motion project a job made (studio done --link), read without loading the project. */
export function projectScenes(id:string|undefined):ProjectScene[]|null{
 const f=id?projectFile(id):null;if(!f)return null;
 try{const s=(JSON.parse(fs.readFileSync(f,'utf8')) as {scenes?:ProjectScene[]}).scenes;return Array.isArray(s)&&s.length?s:null;}catch{return null;}
}
/** A scene's fingerprint without its start (an earlier scene growing moves it, which is fine). */
export const sceneHash=(s:ProjectScene)=>{const {start:_,...rest}=s as ProjectScene&Record<string,unknown>;return createHash('sha1').update(JSON.stringify(rest)).digest('hex').slice(0,12);};
/** The scenes a redo changed that the user did not comment on (empty when it kept to its scenes). */
export function outsideScope(p:Plan,t:Task):string[]{
 if(!t.scope?.keep)return [];const ps=projectScenes(p.videoJob);if(!ps)return [];
 return Object.entries(t.scope.keep).filter(([id,h])=>{const s=ps.find(x=>x.id===id);return !s||sceneHash(s)!==h;}).map(([id])=>{const i=ps.findIndex(x=>x.id===id);return i<0?`${id} (removed)`:`scene ${i+1}`;});
}
