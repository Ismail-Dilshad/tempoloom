// Find and tidy: one search over videos (what they say, how they look), scenes, lessons, taught
// videos and clips; the same video or lesson kept once; space cleared in one confirmed step.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-find-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups'),VIDEO_OUTPUT:path.join(tmp,'out')},before={...process.env};
const out=env.VIDEO_OUTPUT,DAY=86400000;
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);for(const d of [env.TEMPOLOOM_KNOWLEDGE_DIR,out])fs.mkdirSync(d,{recursive:true});
 closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();
 // A wide talk (and a copy, and the same picture made smaller), a red vertical promo.
 await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=1280x720:r=30:d=6','-f','lavfi','-i','sine=d=6','-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast','-c:a','aac',path.join(out,'camera-talk.mp4')]);
 fs.copyFileSync(path.join(out,'camera-talk.mp4'),path.join(out,'camera-talk-again.mp4'));
 await run(ffmpeg,['-v','error','-y','-i',path.join(out,'camera-talk.mp4'),'-vf','scale=640:-2','-c:v','libx264','-preset','ultrafast','-c:a','aac',path.join(out,'camera-talk-small.mp4')]);
 await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','color=c=#c0182a:s=720x1280:d=4:r=30','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',path.join(out,'spring-promo.mp4')]);
},120000);
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

describe('one search over everything',()=>{
 it('evens out how Kurdish, Arabic and Persian are typed',async()=>{
  const F=await import('../src/engine/find.js');
  expect(F.normal('كاميرا ٣')).toBe(F.normal('کامیرا 3'));expect(F.words('Cameras and Editing')).toEqual(['camera','edit']);
  expect(F.looksOf(Buffer.from(Array(30).fill([200,20,30]).flat()))).toEqual(expect.arrayContaining(['red','colourful colorful']));
 });
 it('finds videos by what they say and how they look, lessons by their words, with why',async()=>{
  const F=await import('../src/engine/find.js'),B=await import('../src/engine/brain/brain.js'),T=await import('../src/editor/text-edit.js');
  B.add({title:'Light the face from the side',body:'Side light gives faces shape; a flat front light makes shots look flat.',source:'feedback',kind:'technique',domain:'both'});
  const words='Why do your shots look flat? Turn the lamp to the side.'.split(' ').map((w,i)=>({text:w,start:.3+i*.4,end:.6+i*.4,type:'word' as const}));
  await T.createDoc(path.join(out,'camera-talk.mp4'),{transcript:{language:'en',words},title:'Lamp talk'});
  const flat=await F.find('flat shots');
  expect(flat.hits.map(h=>h.kind)).toEqual(expect.arrayContaining(['video','lesson']));
  const v=flat.hits.find(h=>h.kind==='video')!;expect(v.why).toContain('in what it says');expect(v.snippet).toMatch(/look flat/);
  const red=await F.find('red vertical');expect(red.hits[0]!.title).toBe('spring promo');expect(red.hits[0]!.why).toContain('in how it looks');
  expect((await F.find('red vertical',{kinds:['lesson']})).hits.every(h=>h.kind==='lesson')).toBe(true);
  expect((await F.find('the a of')).hits).toEqual([]);
 },120000);
});

describe('the same thing twice',()=>{
 it('groups the same video exported again, keeping the sharpest; lessons that say the same, keeping the proven one',async()=>{
  const T=await import('../src/engine/tidy.js'),B=await import('../src/engine/brain/brain.js');
  B.add({id:'tec-beat-a',title:'Cut on the beat in fast edits',body:'In fast edits put each cut on a beat of the music so the rhythm carries the viewer.',source:'feedback',kind:'technique',domain:'editing',status:'proven'});
  B.add({id:'tec-beat-b',title:'Cut on the beat for fast edits',body:'For fast edits, place every cut on a beat of the music so the rhythm carries viewers along.',source:'feedback',kind:'technique',domain:'editing',status:'trial'});
  B.add({id:'avo-beat',title:'Never cut on the beat in fast edits',body:'Do not put each cut on a beat of the music in fast edits.',source:'feedback',kind:'avoid',domain:'editing'});
  const d=await T.duplicates();
  expect(d.videos).toHaveLength(1);const g=d.videos[0]!;
  expect(g.items.map(i=>path.basename(i.file)).sort()).toEqual(['camera-talk-again.mp4','camera-talk-small.mp4','camera-talk.mp4']);
  expect(g.items.find(i=>i.file.endsWith('small.mp4'))!.same).toBe('near');expect(path.basename(g.items.find(i=>i.id===g.keep)!.file)).not.toBe('camera-talk-small.mp4');
  const l=d.lessons.find(x=>x.items.some(i=>i.id==='tec-beat-a'))!;
  expect(l.keep).toBe('tec-beat-a');expect(l.items.map(i=>i.id).sort()).toEqual(['tec-beat-a','tec-beat-b']); // the "never" one is not the same
  // Keeping one: the others go (videos deleted, lessons retired with Undo).
  const small=g.items.find(i=>i.file.endsWith('small.mp4'))!;
  const r=await T.keepOne('videos',g.keep,[small.id]) as {deleted:string[]};expect(r.deleted).toHaveLength(1);expect(fs.existsSync(path.join(out,'camera-talk-small.mp4'))).toBe(false);
  await T.keepOne('lessons','tec-beat-a',['tec-beat-b']);
  const {getKnowledge}=await import('../src/engine/brain/db.js');expect(getKnowledge('tec-beat-b')!.status).toBe('retired');
  const H=await import('../src/engine/history.js'),last=H.history({kind:'lessons'}).entries.find(e=>/Kept one of 2 lessons/.test(e.title))!;await H.undo(last.id);
  expect(getKnowledge('tec-beat-b')!.status).toBe('trial');
 },120000);
});

describe('space',()=>{
 it('lists what the studio can make again with its size, never finals or transcripts, and clears it in one confirmed step',async()=>{
  const T=await import('../src/engine/tidy.js'),ws=env.VIDEO_WORKSPACE,old=new Date(Date.now()-5*DAY);
  const put=(rel:string,bytes:number,when=old)=>{const f=path.join(ws,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,Buffer.alloc(bytes));fs.utimesSync(f,when,when);return f;};
  put('cache/temp/stt-1.flac',20000);put('cache/temp/stt-new.flac',5000,new Date());put('cache/editor/resume/ab12/step-1.mp4',40000);
  put('cache/transcripts/abc.json',3000);put('cache/voiceovers/v.mp3',3000);
  const pj=path.join(ws,'projects','promo');put('projects/promo/renders/r-old/validated.mp4',60000);put('projects/promo/renders/r-new/validated.mp4',60000);
  fs.writeFileSync(path.join(pj,'renders/r-old/status.json'),'{"state":"complete"}');fs.writeFileSync(path.join(pj,'renders/r-new/status.json'),'{"state":"complete"}');
  fs.writeFileSync(path.join(pj,'latest-render.json'),JSON.stringify({file:path.join(pj,'renders/r-new/validated.mp4'),fingerprint:'fp-new'}));
  put('projects/promo/render-cache/fp-old.mp4',30000);put('projects/promo/render-cache/fp-new.mp4',30000);
  const p=await T.storagePlan();const paths=p.items.map(i=>i.path);
  expect(paths.some(x=>x.endsWith('cache/temp/stt-1.flac'))).toBe(true);expect(paths.some(x=>x.endsWith('stt-new.flac'))).toBe(false);
  expect(paths.some(x=>x.endsWith('renders/r-old'))).toBe(true);expect(paths.some(x=>x.endsWith('renders/r-new'))).toBe(false);
  expect(paths.some(x=>x.endsWith('fp-old.mp4'))).toBe(true);expect(paths.some(x=>x.endsWith('fp-new.mp4'))).toBe(false);
  expect(paths.some(x=>/transcripts|voiceovers|\.mp4$/.test(x)&&!/render-cache|resume/.test(x))).toBe(false);
  expect(p.kinds['earlier-render'].bytes).toBeGreaterThan(60000);
  await expect(T.clearStorage('nope')).rejects.toThrow(/changed since/);
  // Only the ones still ticked.
  const only=p.items.filter(i=>i.kind!=='earlier-render').map(i=>i.id),r=await T.clearStorage(p.token,{only});
  expect(r.removed).toBe(only.length);expect(fs.existsSync(path.join(pj,'renders/r-old'))).toBe(true);expect(fs.existsSync(path.join(ws,'cache/temp/stt-1.flac'))).toBe(false);
  expect(fs.existsSync(path.join(ws,'cache/transcripts/abc.json'))).toBe(true);expect(fs.existsSync(path.join(out,'camera-talk.mp4'))).toBe(true);
 },60000);
 it('is on the page: search, the groups and the space, behind the access key',async()=>{
  const {serve}=await import('../src/teach/server.js'),s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key,'content-type':'application/json'};
   expect((await fetch(base+'/api/find?q=red')).status).toBe(403);
   expect(((await (await fetch(base+'/api/find?q=red+vertical&kinds=video',{headers:h})).json()) as {hits:{title:string}[]}).hits[0]!.title).toBe('spring promo');
   expect((await fetch(base+'/find.js')).status).toBe(200);
   const sp=await (await fetch(base+'/api/tidy/storage',{headers:h})).json() as {token:string};
   expect((await fetch(base+'/api/tidy/clear',{method:'POST',headers:h,body:JSON.stringify({token:'old'})})).status).toBe(409);
   expect((await fetch(base+'/api/tidy/clear',{method:'POST',headers:h,body:JSON.stringify({token:sp.token})})).status).toBe(200);
   expect((await fetch(base+'/api/tidy/keep',{method:'POST',headers:h,body:JSON.stringify({group:'files',keep:'a',others:['b']})})).status).toBe(409);
  }finally{await s.close();}
 },60000);
});
