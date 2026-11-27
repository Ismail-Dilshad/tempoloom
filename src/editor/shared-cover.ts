import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {z} from 'zod';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';
import {mediaId,projectId,revision,sharedMediaAsset,updateSharedCover} from './shared-projects.js';
import {captureSharedFrame} from './shared-exports.js';

export const coverRequest=z.strictObject({
 projectId,revision,mediaId:mediaId.nullable().optional(),at:z.number().min(0).max(86_400).optional(),
}).refine(input=>(input.mediaId===undefined)!==(input.at===undefined),'Provide either mediaId or a timeline time');
const run=promisify(execFile);
export async function setSharedCover(input:unknown){
 const data=coverRequest.parse(input);
 const {projectId,revision}=data;
 if(data.at!==undefined)return updateSharedCover(projectId,revision,await captureSharedFrame(data,data.at));
 if(data.mediaId===null)return updateSharedCover(projectId,revision,null);
 const media=sharedMediaAsset(projectId,revision,mediaId.parse(data.mediaId));
 if(media.asset.type!=='image')throw new Error('Choose a shared image for the cover');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tempoloom-cover-'));
 try{
  const source=path.join(dir,'cover'+media.extension);
  await fs.writeFile(source,media.bytes,{flag:'wx'});
  const {stdout}=await run(ffmpeg,['-v','error','-protocol_whitelist','file,pipe','-i',source,'-frames:v','1',
   '-vf',"scale='min(480,iw)':'min(480,ih)':force_original_aspect_ratio=decrease",
   '-f','image2pipe','-c:v','mjpeg','pipe:1'],{encoding:'buffer',windowsHide:true,timeout:15_000});
  if(!stdout.length)throw new Error('Could not decode the cover image');
  return updateSharedCover(projectId,revision,'data:image/jpeg;base64,'+stdout.toString('base64'));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
