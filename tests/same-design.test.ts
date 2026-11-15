// Same design, your content: a reference's design read scene by scene and recreated with the user's
// content (checked against it); an edited reference's style applied to the user's footage.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-same-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups'),VIDEO_OUTPUT:path.join(tmp,'out')},before={...process.env};
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

/** A four-scene motion video: a title top left, a big number in the middle, a mark top and words at
 *  the bottom, an end card in the middle; a cut, a fade through black and a crossfade between them.
 *  "mine" is the same design in other colours; "other" puts things elsewhere. */
async function motion(name:string,variant:'ref'|'mine'|'other'){
 const f=path.join(tmp,name);if(fs.existsSync(f))return f;
 const C=variant==='ref'?['0x14213D','0xFFFFFF','0x0B3D2E','0x14213D','0xFCA311','0xF5F5F5']:['0x3A0CA3','0xF7F7F2','0x222222','0x3A0CA3','0x06D6A0','0xFAFAFA'];
 const o=variant==='other';
 const box=(x:number,y:number,w:number,h:number,c:string)=>`drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${c}:t=fill`;
 const scenes=[[C[0],[box(60,o?820:140,340,90,C[5]!),box(60,o?930:250,220,18,C[4]!)]],[C[1],[box(o?40:200,o?100:420,o?340:320,180,C[4]!),box(250,o?300:620,220,30,'0x222222')]],
  [C[2],[box(260,o?700:150,200,200,C[4]!),box(110,o?200:860,500,70,C[5]!)]],[C[3],[box(260,460,200,200,C[5]!),box(285,485,150,150,C[3]!)]]] as const;
 const lens=[2.5,2.8,2.6,2.4];
 const ins=scenes.flatMap(([bg,boxes],i)=>['-f','lavfi','-i',`color=c=${bg}:s=720x1280:r=30:d=${lens[i]},${boxes.join(',')},format=yuv420p`]);
 // A cut into scene 2, a fade through black into 3, a crossfade into 4.
 const fc=`[0][1]concat=n=2:v=1,settb=AVTB[a];[2]settb=AVTB[c];[3]settb=AVTB[d];[a][c]xfade=transition=fadeblack:duration=0.5:offset=${(2.5+2.8-.5).toFixed(2)}[b];[b][d]xfade=transition=fade:duration=0.5:offset=${(2.5+2.8+2.6-1).toFixed(2)},format=yuv420p[v]`;
 const part=f.replace(/\.mp4$/,'.part.mp4');await run(ffmpeg,['-v','error','-y',...ins,'-filter_complex',fc,'-map','[v]','-c:v','libx264','-preset','ultrafast',part]);fs.renameSync(part,f);return f;
}
const brand={primary:'#3A0CA3',accent:'#06D6A0',background:'#F7F7F2',text:'#222222'};

describe('same design, your content: motion',()=>{
 it('reads a reference scene by scene: its timing, how each comes in, where things sit, its colour roles',async()=>{
  const B=await import('../src/engine/blueprint.js'),bp=await B.study(await motion('ref.mp4','ref'),{text:false});
  expect(bp.scenes.map(s=>s.transition)).toEqual(['start','cut','fade','dissolve']);
  expect(bp.scenes.map(s=>Math.round(s.start*4)/4)).toEqual([0,2.5,5,7.25].map(x=>expect.closeTo(x,0)) as never);
  for(const [i,t] of [2.5,5.05,7.4].entries())expect(Math.abs(bp.scenes[i+1]!.start-t)).toBeLessThan(.4);
  expect(bp.scenes[0]!.where).toMatch(/^top left/);expect(bp.scenes[1]!.where).toMatch(/^middle/);
  expect(B.colorDistance(bp.scenes[0]!.colors.background,'#14213D')).toBeLessThan(20);expect(B.colorDistance(bp.scenes[1]!.colors.background,'#FFFFFF')).toBeLessThan(20);
  expect(bp.scenes[1]!.colors.accent&&B.colorDistance(bp.scenes[1]!.colors.accent,'#FCA311')).toBeLessThan(40);
  expect(fs.existsSync(bp.sheet!)).toBe(true);expect(fs.readFileSync(path.join(bp.folder,'blueprint.md'),'utf8')).toMatch(/\| 3 \| .* \| fade \|/);
  // Never the reference itself: the blueprint holds measurements, and frames only to look at.
  expect(JSON.stringify(bp)).not.toMatch(/data:image/);
 },120000);
 it('puts the user\'s script and colours into the design, and checks a video against it',async()=>{
  const B=await import('../src/engine/blueprint.js'),R=await import('../src/engine/recreate.js');
  const bp=await B.study(await motion('ref.mp4','ref'),{text:false,out:path.join(tmp,'bp')});
  const p=await R.plan(bp,{script:'Learn Kurdish fast. Twelve times faster with daily practice. Join the class today.',brand});
  expect(p.scenes.map(s=>s.words)).toEqual(['Learn Kurdish fast.','Twelve times faster with daily practice.','Join the class today.',null]);
  expect(p.scenes[3]!.logo).toBe(true);
  // A dark scene stays dark and a light one light, in the user's colours; two different dark scenes stay different.
  expect(p.scenes[1]!.colors.background).toBe('#F7F7F2');expect(p.scenes[0]!.colors.background).not.toBe(p.scenes[2]!.colors.background);
  for(const s of p.scenes)expect(R.contrast(s.colors.ink,s.colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(fs.readFileSync(p.plan,'utf8')).toMatch(/never the reference's artwork, logo, footage or words/);
  const good=await R.check(bp,await motion('mine.mp4','mine'),{brand,text:false});expect(good.issues).toEqual([]);expect(good.pass).toBe(true);expect(good.score).toBeGreaterThanOrEqual(90);
  const bad=await R.check(bp,await motion('other.mp4','other'),{brand,text:false});expect(bad.pass).toBe(false);
  expect(bad.issues.map(i=>i.scene)).toEqual(expect.arrayContaining([1,2,3]));expect(bad.issues.find(i=>i.scene===1)!.what).toMatch(/in the design it sits top left/);
  // The reference's own colours, kept by mistake, are caught.
  const same=await R.check(bp,await motion('ref.mp4','ref'),{brand,text:false});expect(same.issues.some(i=>/still uses the reference's colour/.test(i.what))).toBe(true);
 },180000);
 it.skipIf(process.env.RUN_MEDIA_TESTS!=='1')('reads where text sits and how big, never what it says',async()=>{
  const B=await import('../src/engine/blueprint.js'),bp=await B.study(process.env.SAME_TEXT_SAMPLE!);
  expect(bp.scenes.every(s=>s.text.read)).toBe(true);expect(bp.scenes[1]!.text.size).toBeGreaterThan(.1);
  expect(JSON.stringify(bp.scenes.map(s=>s.text))).not.toMatch(/"text"/);
 },180000);
});

describe('edit it the same way: footage',()=>{
 it('grades a picture toward another\'s colour',async()=>{
  const {runEdl}=await import('../src/editor/editor.js'),L=await import('../src/editor/edit-like.js');
  const src=path.join(tmp,'grey.mp4');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=640x360:r=25:d=2','-vf','eq=saturation=.5','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',src]);
  const r=await runEdl({version:1,input:src,operations:[{op:'grade',saturation:1.6,warmth:.15}],export:{preset:'draft'}},tmp,{output:path.join(tmp,'graded.mp4')});
  expect(r.steps[0]!.note).toMatch(/^graded: /);
  const a=await L.gradeOf(src),b=await L.gradeOf(path.join(tmp,'graded.mp4'));expect(b.saturation).toBeGreaterThan(a.saturation*1.2);expect(b.warmth).toBeGreaterThan(a.warmth+.03);
  const g=L.gradeToward({brightness:.5,contrast:.25,saturation:.9,warmth:.1},{brightness:.4,contrast:.25,saturation:.3,warmth:-.1});
  expect(g).toEqual({brightness:.1,contrast:1,saturation:1.9,warmth:.2});
 },60000);
 it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('reads an edit\'s pace, punch-ins and grade, and edits other footage the same way',async()=>{
  const {runEdl}=await import('../src/editor/editor.js'),L=await import('../src/editor/edit-like.js');
  const still=path.join(tmp,'still.png');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=1280x720:r=1:d=1','-frames:v','1',still]);
  for(const [n,col] of [['raw.mp4',''],['mine.mp4',',eq=saturation=.6']] as const)
   await run(ffmpeg,['-v','error','-y','-loop','1','-i',still,'-f','lavfi','-i','sine=f=220:d=12','-t','12','-r','30','-vf','format=yuv420p'+col,'-c:v','libx264','-preset','ultrafast','-c:a','aac','-shortest',path.join(tmp,n)]);
  const ref=path.join(tmp,'reference.mp4');
  await runEdl({version:1,input:path.join(tmp,'raw.mp4'),operations:[{op:'grade',saturation:1.4,warmth:.12},{op:'punch',ranges:[{start:2,end:4,scale:1.25},{start:6,end:8,scale:1.25},{start:10,end:11.5,scale:1.25}],focusX:.5,focusY:.5},
   {op:'captions',cues:'Here is how we grow every week'.split(' ').map((w,i)=>({start:.5+i*1.4,end:1.7+i*1.4,text:w})),size:.06,color:'#FFD400',background:'#000000',strokeWidth:0,position:'bottom',margin:.1,safeArea:false}],export:{preset:'draft'}} as never,tmp,{output:ref});
  const st=await L.studyEdit(ref);
  expect(st.punch).toMatchObject({count:3});expect(st.punch!.scale).toBeCloseTo(1.25,1);expect(st.punch!.hold).toBeCloseTo(2,0);expect(st.music).toBe(false);
  if(st.captions?.found){expect(st.captions).toMatchObject({position:'bottom',style:'word'});expect(st.captions.background).not.toBeNull();}
  const words=path.join(tmp,'words.json');fs.writeFileSync(words,JSON.stringify({language:'en',words:'So today I will show you the plan. First we measure what works. Then we cut what does not. Finally we repeat it every single week.'.split(' ').map((w,i)=>({text:w,start:+(.4+i*.42).toFixed(2),end:+(.4+i*.42+.34).toFixed(2),type:'word'}))}));
  const r=await L.editLike(ref,path.join(tmp,'mine.mp4'),{transcript:words,out:path.join(tmp,'edit')});
  expect(r.status).toBe('done');expect(r.settings.punch!.scale).toBeCloseTo(1.25,1);
  // As fast as the reference cuts (within a third), and its colour moved toward the reference's.
  expect(Math.abs(r.close!.cutsPerMinute.yours as number-(r.close!.cutsPerMinute.reference as number))).toBeLessThan((r.close!.cutsPerMinute.reference as number)/3);
  const before=await L.gradeOf(path.join(tmp,'mine.mp4'));
  expect(Math.abs((r.close!.saturation.yours as number)-st.grade.saturation)).toBeLessThan(Math.abs(before.saturation-st.grade.saturation));
 },600000);
});

describe('in the studio',()=>{
 it('a request with a reference and "same" becomes a same-design job; its preview must pass the check',async()=>{
  const R=await import('../src/engine/studio-requests.js'),st=await import('../src/engine/studio.js');
  const r=R.newRequest(),f=R.filePath(r.id,'reference','theirs.mp4');fs.copyFileSync(await motion('ref.mp4','ref'),f);R.addFile(r.id,'reference',f);
  R.submit(r.id,{mode:'motion',text:'Learn Kurdish fast. Join the class.',script:true,link:'',voice:false,captions:true,visuals:false,pick:true,colors:{},notes:'',second:false,same:true} as never);
  const t=R.take(r.id),p=st.readPlan(t.job);
  expect(p.type).toBe('reference-match');expect(p.options).toContain('same');expect(p.options).not.toContain('pick');
  expect(p.request).toMatch(/Same design, your content: recreate the design of .*theirs\.mp4 scene by scene/);
  for(const id of ['intake','brief','research'])st.done(t.job,id,{...(st.start(t.job,id),{}),output:(()=>{const o=path.join(st.jobDir(t.job),id+'.md');fs.writeFileSync(o,'x');return o;})(),applied:[]});
  expect((st.start(t.job,'reference') as {sameDesign?:string}).sameDesign).toMatch(/recreate study REFERENCE\.mp4/);
  // The build cannot finish before its preview follows the design.
  const pl=st.readPlan(t.job);for(const x of pl.tasks)if(x.id!=='build'&&!['learn','final','review','preview-ok'].includes(x.id)&&x.status!=='done'){x.status='done';}
  fs.writeFileSync(path.join(st.jobDir(t.job),'plan.json'),JSON.stringify(pl));
  st.start(t.job,'build');const out=path.join(st.jobDir(t.job),'preview.md');fs.writeFileSync(out,'x');
  expect(()=>st.done(t.job,'build',{output:out,applied:[]})).toThrow(/recreate check BLUEPRINT PREVIEW\.mp4/);
  fs.writeFileSync(path.join(st.jobDir(t.job),'recreate-check.json'),JSON.stringify({pass:false,score:60,issues:[{what:'Scene 1 lasts 4 s; the design says 2.5 s.'}]}));
  expect(()=>st.done(t.job,'build',{output:out,applied:[]})).toThrow(/does not follow the design yet \(60%\): Scene 1 lasts 4 s/);
 },120000);
 it('an edit with a reference and "same" studies its style and edits the same way',async()=>{
  const R=await import('../src/engine/studio-requests.js'),st=await import('../src/engine/studio.js');
  const r=R.newRequest();for(const [k,n] of [['reference','theirs.mp4'],['footage','mine.mp4']] as const){const f=R.filePath(r.id,k,n);fs.copyFileSync(await motion('ref.mp4','ref'),f);R.addFile(r.id,k,f);}
  R.submit(r.id,{mode:'edit',text:'',script:false,link:'',voice:false,captions:true,visuals:true,pick:false,colors:{},notes:'',second:false,same:true} as never);
  const t=R.take(r.id),p=st.readPlan(t.job);expect(p.type).toBe('footage-edit');expect(p.options).toEqual(['same']);
  expect(p.request).toMatch(/Edit it the same way: give the user's footage the editing style of/);
  st.done(t.job,'intake',{...(st.start(t.job,'intake'),{}),output:(()=>{const o=path.join(st.jobDir(t.job),'intake.md');fs.writeFileSync(o,'x');return o;})(),applied:[]});
  expect((st.start(t.job,'analysis') as {editTheSameWay?:string}).editTheSameWay).toMatch(/recreate style REFERENCE\.mp4/);
 },60000);
});
