import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import {clipSourceRange,inspectProject,mediaId,previewEdit,projectId,revision,sharedMediaAsset} from './shared-projects.js';
import {groupCues} from './caption-builder.js';

export const transcriptRequest=z.strictObject({
 projectId,revision,mediaId,language:z.string().regex(/^(auto|[a-z]{2,3})$/).default('auto'),
});
export const captionsRequest=transcriptRequest.omit({mediaId:true}).extend({clipId:mediaId});
type Word={start:number;end:number;text:string};
type Speech=(source:string,language:string)=>Promise<{code:string|null;words:Word[]}>;

async function recognize(source:string,language:string){
 const stt=await import('../engine/local-stt.js');
 const corrections=await import('../engine/caption-learning.js');
 const sorani=language==='ckb'&&stt.soraniAvailable();
 if(!stt.installed()&&!sorani)throw new Error('Set up on-device captions in the Editor before transcribing shared media');
 const result=await stt.transcribeBest(source,{engine:sorani&&!stt.installed()?'whisper':'omnilingual',
  hotwords:corrections.hotwords(language==='auto'?'ckb':language)});
 const code=language==='auto'?result.code:language;
 const words=corrections.applyFixes(code,result.words.map(word=>({...word,text:stt.tidyLetters(word.text,code)}))).words;
 return {code,words};
}
export async function transcribeSharedMedia(input:unknown,speech:Speech=recognize){
 const {projectId,revision,mediaId,language}=transcriptRequest.parse(input);
 const {asset,bytes,extension}=sharedMediaAsset(projectId,revision,mediaId);
 if(asset.type!=='video'&&asset.type!=='audio')throw new Error('Transcription needs a video or audio asset');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tempoloom-transcript-'));
 try{
  const source=path.join(directory,'source'+extension);
  await fs.writeFile(source,bytes,{flag:'wx'});
  const result=await speech(source,language);
  return {projectId,revision,mediaId,code:result.code,timebase:'source seconds',words:result.words};
 }finally{await fs.rm(directory,{recursive:true,force:true});}
}

export async function planSharedCaptions(input:unknown,speech:Speech=recognize){
 const request=captionsRequest.parse(input),shared=inspectProject(request.projectId);
 if(shared.revision!==request.revision)throw new Error('The shared timeline changed. Read its latest revision before planning captions');
 const clip=shared.project.clips.find(item=>item.id===request.clipId);
 if(!clip?.media)throw new Error('Choose a timeline clip with audio or video media');
 if(clip.reverse)throw new Error('Render the reversed clip to media before transcribing its audio');
 const {from,until,timelineAt}=clipSourceRange(clip);
 const transcript=await transcribeSharedMedia({projectId:request.projectId,revision:request.revision,mediaId:clip.media,language:request.language},speech);
 const words=transcript.words.filter(word=>word.end>from&&word.start<until).map(word=>({
  text:word.text,start:timelineAt(word.start),end:timelineAt(word.end),
 }));
 const limit=clip.start+clip.dur;
 const cues=groupCues(words).map(cue=>({text:cue.text,start:cue.start,duration:Math.min(limit,cue.end)-cue.start})).filter(cue=>cue.duration>=0.001);
 if(!cues.length)throw new Error('No speech was found in this part of the clip');
 const edits=[{type:'addCaptions',cues,...(transcript.code&&/^[a-z]{2,3}$/.test(transcript.code)?{language:transcript.code}:{})}];
 previewEdit(request.projectId,request.revision,edits);
 return {base:request.revision,edits,cues:cues.length};
}
