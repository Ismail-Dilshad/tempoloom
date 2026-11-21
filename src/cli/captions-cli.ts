// tempoloom captions: speech to text on this computer for captions (Omnilingual ASR, 1,600+ languages).
//   captions status            what is installed
//   captions setup [--model 1b|300m] [--yes]   download the model once (asks first in a terminal)
//   captions transcribe FILE [--model 1b|300m] [--json]   words with times
//   captions evaluate [--lang ckb]   score each model on the captions you corrected (your own speech)
import readline from 'node:readline/promises';
import fs from 'node:fs';
import path from 'node:path';
import * as L from '../engine/local-stt.js';

const args=process.argv.slice(2),cmd=args[0],flag=(n:string)=>{const i=args.indexOf(n);return i>=0?args[i+1]:undefined;};
const model=(flag('--model')??L.DEFAULT_LOCAL_MODEL) as L.LocalModel;
if(!(model in L.LOCAL_MODELS)){console.error('--model is 1b or 300m');process.exit(1);}
try{
 if(cmd==='status'||!cmd){console.log(JSON.stringify(L.status(),null,1));}
 else if(cmd==='setup'){
  const m=L.LOCAL_MODELS[model];
  if(L.installed(model)){console.log(`${m.label} is already set up.`);process.exit(0);}
  if(!args.includes('--yes')&&process.stdin.isTTY){const rl=readline.createInterface({input:process.stdin,output:process.stdout});
   const a=(await rl.question(`Download ${m.label} (${m.mb} MB, once) into ${L.modelRoot()}? [y/N] `)).trim().toLowerCase();rl.close();if(a!=='y'&&a!=='yes')process.exit(1);}
  let shown=0;await L.setup(model,{onProgress:p=>{const pct=Math.floor(p.bytes/p.total*100);if(p.state==='downloading'&&pct>=shown+5){shown=pct;process.stdout.write(`\r${pct}% of ${m.mb} MB`);}else if(p.state!=='downloading')process.stdout.write(`\n${p.state}…`);}});
  console.log(`\n${m.label} is ready.`);}
 else if(cmd==='transcribe'){const file=args[1];if(!file)throw new Error('Usage: tempoloom captions transcribe FILE [--model 1b|300m] [--json]');
  const t0=Date.now(),r=await L.transcribeLocal(file,{model:flag('--model') as L.LocalModel|undefined,onProgress:(d,n)=>process.stderr.write(`\rpiece ${d}/${n}`)});process.stderr.write('\n');
  if(args.includes('--json'))console.log(JSON.stringify({...r,took:(Date.now()-t0)/1000},null,1));
  else{console.log(r.text);console.error(`${r.words.length} words, ${r.seconds.toFixed(1)} s of audio in ${((Date.now()-t0)/1000).toFixed(1)} s (${r.model}${r.code?', looks like '+r.code:''})`);}}
 else if(cmd==='evaluate'){
  // The clips saved when you corrected captions: the audio and the text you wrote. Each model listens again and is scored.
  const C=await import('../engine/caption-learning.js'),lang=flag('--lang')??'ckb',file=path.join(C.datasetDir(),lang,'metadata.jsonl');
  const last=new Map<string,{file:string;text:string;original:string}>();
  if(fs.existsSync(file))for(const l of fs.readFileSync(file,'utf8').split('\n').filter(Boolean)){try{const r=JSON.parse(l) as {file:string;text:string;original:string};last.set(r.file,r);}catch{/* skip */}}
  const clips=[...last.values()].filter(c=>fs.existsSync(path.join(C.datasetDir(),lang,c.file)));
  if(!clips.length)throw new Error(`No corrected captions in ${lang} yet. Correct some captions made from speech in the Editor; each one is saved for this.`);
  const toks=(t:string)=>t.split(/\s+/).map(L.normWord).filter(Boolean),ed=<T>(a:T[],b:T[])=>{let p=Array.from({length:b.length+1},(_,j)=>j);for(let i=1;i<=a.length;i++){const q=[i];for(let j=1;j<=b.length;j++)q[j]=Math.min(p[j]!+1,q[j-1]!+1,p[j-1]!+(a[i-1]===b[j-1]?0:1));p=q;}return p[b.length]!;};
  const models:[string,(f:string)=>Promise<string>][]=[];
  if(L.installed())models.push(['Omnilingual',async f=>(await L.transcribeLocal(f)).words.map(w=>L.tidyLetters(w.text,lang)).join(' ')]);
  if(L.soraniAvailable()&&lang==='ckb')models.push(['Sorani Whisper',async f=>(await L.transcribeSorani(f)).words.map(w=>L.tidyLetters(w.text,lang)).join(' ')]);
  models.push(['Before your fixes (as first written)',async f=>clips.find(c=>path.join(C.datasetDir(),lang,c.file)===f)!.original]);
  console.log(`${clips.length} corrected clip${clips.length>1?'s':''} in ${lang}\n`);
  for(const [name,run] of models){let we=0,wn=0,ce=0,cn=0;const worst:[number,string,string][]=[];
   for(const c of clips){const ref=toks(c.text),hyp=toks(await run(path.join(C.datasetDir(),lang,c.file))),w=ed(ref,hyp),ch=ed([...ref.join(' ')],[...hyp.join(' ')]);
    we+=w;wn+=ref.length;ce+=ch;cn+=[...ref.join(' ')].length;worst.push([w/Math.max(1,ref.length),c.text,hyp.join(' ')]);}
   console.log(`${name.padEnd(36)} wrong words ${(we/Math.max(1,wn)*100).toFixed(1).padStart(5)}%   wrong letters ${(ce/Math.max(1,cn)*100).toFixed(1).padStart(5)}%`);
   if(args.includes('--show'))for(const [,r,h] of worst.sort((a,b)=>b[0]-a[0]).slice(0,3))console.log(`   yours: ${r}\n   model: ${h}`);}
 }
 else throw new Error('Use captions status|setup|transcribe|evaluate');
}catch(e){console.error((e as Error).message);process.exit(1);}
