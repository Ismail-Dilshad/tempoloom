// tempoloom captions: speech to text on this computer for captions (Omnilingual ASR, 1,600+ languages).
//   captions status            what is installed
//   captions setup [--model 1b|300m] [--yes]   download the model once (asks first in a terminal)
//   captions transcribe FILE [--model 1b|300m] [--json]   words with times
import readline from 'node:readline/promises';
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
 else throw new Error('Use captions status|setup|transcribe');
}catch(e){console.error((e as Error).message);process.exit(1);}
