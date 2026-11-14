// tempoloom find: one search over videos, scenes, lessons, taught videos and your clips.
// tempoloom tidy: the same video or lesson kept once, and space the studio can make again.
const args=process.argv.slice(2),tool=args[0],rest=args.slice(1);
const flag=(k:string)=>{const i=rest.indexOf(k);return i>=0?rest[i+1]:undefined;};
const words=()=>rest.filter((x,i)=>!x.startsWith('--')&&!rest[i-1]?.startsWith('--')).join(' ');
const mb=(b:number)=>b>=1073741824?(b/1073741824).toFixed(1)+' GB':(b/1048576).toFixed(1)+' MB';
const usage=`Usage: tempoloom find WORDS [--kind video,scene,lesson,taught,clip] [--limit 20]
       tempoloom find unseen              videos nobody has said what they show, with a frame sheet each
       tempoloom find describe ID "TEXT" [--agent]   what a video shows (people, places, objects)
       tempoloom find listen [--go] [--yes]   write the words of videos that have none (ElevenLabs, costs money)
       tempoloom tidy duplicates
       tempoloom tidy keep videos|lessons KEEP-ID OTHER-ID...
       tempoloom tidy storage
       tempoloom tidy clear --token TOKEN [--only ID,ID]`;
async function main(){
 if(['help','--help','-h'].includes(rest[0]??'')||!rest.length){console.log(usage);process.exit(rest.length?0:1);}
 if(tool==='find'&&['unseen','describe','listen'].includes(rest[0]!)){const F=await import('../engine/find.js');
  if(rest[0]==='unseen')return F.unseen({limit:flag('--limit')?Number(flag('--limit')):12});
  if(rest[0]==='describe'){const [,id,...txt]=rest.filter(x=>x!=='--agent');if(!id)throw new Error(usage);return F.describe(id,txt.join(' '),rest.includes('--agent')?'agent':'you');}
  return F.listen({go:rest.includes('--go'),approved:rest.includes('--yes')});}
 if(tool==='find'){const q=words();if(!q)throw new Error(usage);const F=await import('../engine/find.js');
  const ks=flag('--kind')?.split(',').map(s=>s.trim()) as import('../engine/find.js').FindKind[]|undefined;
  if(ks?.some(k=>!F.kinds.includes(k)))throw new Error('--kind is one or more of '+F.kinds.join(', '));
  const lim=flag('--limit')?Number(flag('--limit')):20;
  const r=await F.find(q,{kinds:ks,limit:lim});return {...r,hits:r.hits.map(h=>({kind:F.KIND_LABEL[h.kind],title:h.title,why:h.why,snippet:h.snippet,...(h.file?{file:h.file}:{}),...(h.at!==undefined?{at:h.at}:{}),id:h.id,score:h.score}))};}
 const T=await import('../engine/tidy.js'),sub=rest[0];
 if(sub==='duplicates')return T.duplicates();
 if(sub==='keep'){const [,group,keep,...others]=rest;if((group!=='videos'&&group!=='lessons')||!keep||!others.length)throw new Error(usage);return T.keepOne(group,keep,others);}
 if(sub==='storage'){const p=await T.storagePlan();return {...p,total:mb(p.bytes),next:p.items.length?`To clear all of it: tempoloom tidy clear --token ${p.token} (this cannot be undone)`:'Nothing to clear.'};}
 if(sub==='clear'){const t=flag('--token');if(!t)throw new Error('Give the token from tempoloom tidy storage: what you saw is what is cleared.');
  const r=await T.clearStorage(t,{only:flag('--only')?.split(',').map(s=>s.trim())});return {...r,freed:mb(r.bytes)};}
 throw new Error(usage);
}
main().then(r=>console.log(JSON.stringify(r,null,2)),e=>{console.error((e as Error).message);process.exit(1);});
