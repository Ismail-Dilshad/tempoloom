// The app's home: what the brain holds, what is waiting, and what happened lately.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './config-root.js';
import {allKnowledge,jobCount,statuses} from './brain/db.js';
import {videos} from './teach/teach.js';
import {studioHome} from './studio-requests.js';
import {agentNow} from './studio-live.js';
import {platforms,PLATFORMS} from './safe-areas.js';
import {read as readTrends} from './trends.js';
const trendsNew=()=>{try{return readTrends().suggestions.filter(s=>s.status==='new').length;}catch{return 0;}};
const appVersion=()=>{try{return String(JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version);}catch{return '10.5.0';}};
const appUpdates=()=>[
 {version:'10.5.0',title:'Desktop-Grade Studio Redesign',items:['Pro NLE workspace layout inspired by DaVinci Resolve & Premiere Pro','Calibrated zinc/slate pro surfaces with 1px borders','Contextual Inspector adapting to selection','Single-lane consolidated captions and word-timing markers','Mobile phone bezel framing with TikTok & Reels safe area overlay guides','SMPTE timecode readout and audio peak meters']},
 {version:'10.4.0',title:'Multilingual Caption Hardening',items:['Full Kurdish Sorani & Kurmanji script alignment','Learned vocabulary fixes and punctuation support']}
];

export function home(){
 const vs=videos(),st=studioHome(),ks=allKnowledge();
 const byStatus=Object.fromEntries(statuses.map(status=>[status,0]));
 for(const k of ks)byStatus[k.status]=(byStatus[k.status]??0)+1;
 type Event={at:string;kind:'video'|'lesson'|'rating'|'rule'|'job';text:string;good?:boolean};
 const events:Event[]=[];
 for(const v of vs)if(v.learnedAt)events.push({at:v.learnedAt,kind:'video',text:`Learned "${v.title}" (${v.lessons.length} lesson${v.lessons.length===1?'':'s'})`,good:v.verdict==='good'});
 for(const k of ks)if(k.tags.includes('pattern'))events.push({at:k.updated,kind:'lesson',text:`Pattern: ${k.title}`});
 for(const j of st.jobs){events.push({at:j.created,kind:'job',text:`Started a ${j.mode==='edit'?'footage edit':'motion video'}`});
  for(const x of j.ratings)events.push({at:x.at,kind:'rating',text:`Rated ${x.task} ${x.rating==='ok'?'not bad':x.rating}`,good:x.rating!=='bad'});}
 const waiting=vs.filter(v=>v.status==='waiting').length;
 return {brain:{total:ks.length,byStatus,onTrial:byStatus.trial,jobs:jobCount()},
  teach:{videos:vs.filter(v=>v.status==='learned').length,good:vs.filter(v=>v.status==='learned'&&v.verdict==='good').length,waiting,drafts:vs.filter(v=>v.status==='draft').length,
   lessons:ks.filter(k=>k.tags.includes('taught')&&!k.tags.includes('pattern')&&!['rejected','retired'].includes(k.status)).length,patterns:ks.filter(k=>k.tags.includes('pattern')&&k.status!=='rejected').length},
  studio:st.totals,made:st.made,guesses:st.scores.guesses,scores:{good:st.scores.good,bad:st.scores.bad},
  // What to say to the agent now, most urgent first.
  agent:[...(waiting?[{say:'Study the videos I taught',command:'pnpm tempoloom teach next',why:`${waiting} taught video${waiting>1?'s are':' is'} waiting`}]:[]),
   ...(st.totals.waitingForAgent?[{say:'Check the studio inbox',command:'pnpm tempoloom studio inbox',why:`${st.totals.waitingForAgent} video job${st.totals.waitingForAgent>1?'s are':' is'} waiting`}]:[])],
  mascot:agentNow(),
  trends:trendsNew(),
  safe:{chosen:platforms(),platforms:Object.fromEntries(Object.entries(PLATFORMS).map(([id,p])=>[id,{label:p.label,top:p.top/1920,bottom:p.bottom/1920,left:p.left/1080,right:p.right/1080}]))},
  you:st.jobs.filter(j=>j.waitingFor==='you'&&!j.archived).map(j=>({job:j.job,title:j.request.split('\n')[0]!.slice(0,80)})),
  version:appVersion(),
  updates:appUpdates(),
  activity:events.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,14)};
}
