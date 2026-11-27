import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import {decodeMono,frameLevels} from './pcm.js';
import {mediaId,previewEdit,projectId,revision,sharedMediaAsset} from './shared-projects.js';

export const multicamRequest=z.strictObject({
 projectId,revision,name:z.string().trim().min(1).max(80),start:z.number().min(0).default(0),
 angles:z.array(z.strictObject({mediaId,sourceStart:z.number().min(0).default(0),duration:z.number().positive()})).min(2).max(8),
});
const sampleRate=8000,frameMs=20,framesPerSecond=1000/frameMs;

function offset(reference:Float32Array,other:Float32Array){
 const minOverlap=2*framesPerSecond,maxLag=30*framesPerSecond;
 let score=0.55,best:number|undefined;
 for(let lag=Math.max(-maxLag,minOverlap-other.length);lag<=Math.min(maxLag,reference.length-minOverlap);lag++){
  const start=Math.max(0,lag),end=Math.min(reference.length,lag+other.length),n=end-start;
  if(n<minOverlap)continue;
  let a=0,b=0,ab=0,aa=0,bb=0;
  for(let i=start;i<end;i++){
   const x=Math.max(-65,reference[i]!),y=Math.max(-65,other[i-lag]!);
   a+=x;b+=y;ab+=x*y;aa+=x*x;bb+=y*y;
  }
  const v=(aa-a*a/n)*(bb-b*b/n);
  if(v<1)continue;
  const correlation=(ab-a*b/n)/Math.sqrt(v);
  const weighted=correlation*Math.sqrt(n/Math.min(reference.length,other.length));
  if(weighted>score){score=weighted;best=lag/framesPerSecond;}
 }
 return best;
}

export async function planSharedMulticam(input:unknown,decode=decodeMono){
 const request=multicamRequest.parse(input);
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'tempoloom-multicam-'));
 try{
  const envelopes:Float32Array[]=[];
  for(const [index,angle] of request.angles.entries()){
   const source=sharedMediaAsset(request.projectId,request.revision,angle.mediaId);
   if(source.asset.type!=='video')throw new Error('Camera angles must be shared video files');
   const file=path.join(folder,'angle-'+index+source.extension);
   await fs.writeFile(file,source.bytes,{flag:'wx'});
   const samples=await decode(file,sampleRate,{start:angle.sourceStart,seconds:Math.min(60,angle.duration)});
   envelopes.push(frameLevels(samples,sampleRate,frameMs));
  }
  const offsets=envelopes.map((samples,index)=>index===0?0:offset(envelopes[0]!,samples));
  if(offsets.some(value=>value===undefined))throw new Error('Could not match every camera angle by sound. Supply explicit offsets for an unmatched angle.');
  const first=Math.min(...offsets.map(value=>value!));
  const edits=[{type:'addMulticam',name:request.name,start:request.start,angles:request.angles.map((angle,index)=>({
   ...angle,offset:offsets[index]!-first,
  }))}];
  previewEdit(request.projectId,request.revision,edits);
  return {base:request.revision,edits,offsets:edits[0]!.angles.map(angle=>angle.offset)};
 }finally{await fs.rm(folder,{recursive:true,force:true});}
}
