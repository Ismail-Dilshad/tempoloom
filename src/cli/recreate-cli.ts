// tempoloom recreate: same design, your content. A reference's design scene by scene with your own
// script, logo and colours; or a reference's editing style on your own footage.
import fs from 'node:fs';
import path from 'node:path';

const [command,...rest]=process.argv.slice(2);
const flag=(k:string)=>{const i=rest.indexOf(k);return i>=0?rest[i+1]:undefined;};
const args=()=>rest.filter((x,i)=>!x.startsWith('--')&&!(rest[i-1]?.startsWith('--')&&!['--plan'].includes(rest[i-1]!)));
const usage=`Usage: tempoloom recreate study REFERENCE.mp4 [--scenes 2.1,4.5] [--out FOLDER]   its design, scene by scene (a blueprint)
       tempoloom recreate plan BLUEPRINT --script SCRIPT.txt | --text "..." [--primary #HEX --accent #HEX --background #HEX --text-color #HEX]
       tempoloom recreate check BLUEPRINT VIDEO.mp4 [--job JOB]              how closely a video follows the design
       tempoloom recreate style REFERENCE.mp4                                 how an edited video is edited
       tempoloom recreate edit REFERENCE.mp4 FOOTAGE [--transcript WORDS.json] [--plan] [--out FOLDER]   your footage, edited the same way

Only the design (or the editing style) is taken: never the reference's artwork, logo, footage or words.`;
async function main(){
 if(!command||['help','--help','-h'].includes(command)){console.log(usage);process.exit(command?0:1);}
 const a=args();
 switch(command){
  case 'study':{if(!a[0])throw new Error(usage);const {study}=await import('../engine/blueprint.js');
   const scenes=flag('--scenes')?.split(',').map(Number).filter(Number.isFinite);const b=await study(a[0],{...(scenes?.length?{scenes}:{}),...(flag('--out')?{out:flag('--out')!}:{})});
   return {blueprint:path.join(b.folder,'blueprint.json'),page:path.join(b.folder,'blueprint.md'),sheet:b.sheet,scenes:b.scenes.map(s=>({scene:s.n,time:`${s.start}-${s.end} s`,comesIn:s.transition,where:s.where})),notes:b.notes,
    next:'Look at the sheet, then: pnpm tempoloom recreate plan '+path.join(b.folder,'blueprint.json')+' --script YOUR-SCRIPT.txt'};}
  case 'plan':{if(!a[0])throw new Error(usage);const {plan}=await import('../engine/recreate.js');
   const script=flag('--script')?fs.readFileSync(path.resolve(flag('--script')!),'utf8'):flag('--text');if(!script)throw new Error('Give your script: --script FILE or --text "..."');
   const pick=(k:string)=>{const v=flag(k);if(v&&!/^#[0-9a-f]{6}$/i.test(v))throw new Error(k+' takes a colour like #1A2B3C');return v;};
   const own={primary:pick('--primary'),accent:pick('--accent'),background:pick('--background'),text:pick('--text-color')};
   const brand=Object.values(own).some(Boolean)?{...(await (await import('../engine/brand.js')).brandProfile()).colors,...Object.fromEntries(Object.entries(own).filter(([,v])=>v))}:undefined;
   const r=await plan(path.resolve(a[0]),{script,...(brand?{brand}:{}),...(flag('--out')?{out:flag('--out')!}:{})});
   return {plan:r.plan,seconds:r.seconds,scenes:r.scenes.map(s=>({scene:s.n,time:`${s.start}-${s.end} s`,words:s.logo?'(your logo)':s.words,colours:s.colors})),notes:r.notes};}
  case 'check':{if(a.length<2)throw new Error(usage);const {check}=await import('../engine/recreate.js');const r=await check(path.resolve(a[0]!),path.resolve(a[1]!));
   const job=flag('--job');if(job){const {jobDir}=await import('../engine/studio.js');fs.writeFileSync(path.join(jobDir(job),'recreate-check.json'),JSON.stringify({...r,video:path.resolve(a[1]!),at:new Date().toISOString()},null,1)+'\n');}
   if(!r.pass)process.exitCode=2;return r;}
  case 'style':{if(!a[0])throw new Error(usage);const {studyEdit}=await import('../editor/edit-like.js');const s=await studyEdit(a[0]);return s;}
  case 'edit':{if(a.length<2)throw new Error(usage);const {editLike}=await import('../editor/edit-like.js');
   const r=await editLike(a[0]!,a[1]!,{...(flag('--transcript')?{transcript:flag('--transcript')!}:{}),plan:rest.includes('--plan'),...(flag('--out')?{out:flag('--out')!}:{}),onStep:s=>console.error(s)});
   return {...r,style:undefined,styleFound:{pace:r.style.pace,punch:r.style.punch,captions:r.style.captions,grade:r.style.grade,music:r.style.music,notes:r.style.notes}};}
  default:throw new Error(usage);
 }
}
main().then(r=>console.log(JSON.stringify(r,null,2)),e=>{console.error((e as Error).message);process.exit(1);});
