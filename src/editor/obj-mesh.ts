import {z} from 'zod';

const maxVertices=4000,maxTriangles=8000;
const coordinate=z.number().min(-0.51).max(0.51);
const index=z.number().int().nonnegative();
export const meshSticker=z.strictObject({
 type:z.literal('mesh'),name:z.string().trim().min(1).max(80),
 vertices:z.array(z.tuple([coordinate,coordinate,coordinate])).min(3).max(maxVertices),
 triangles:z.array(z.tuple([index,index,index])).min(1).max(maxTriangles),
}).refine(({vertices,triangles})=>triangles.every(face=>new Set(face).size===3&&face.every(i=>i<vertices.length)),
 'Mesh triangles must use three different vertex indices');

export const objRequest=z.strictObject({name:z.string().trim().min(1).max(80),obj:z.string().min(1).max(750_000)});
export function parseObjMesh(input:unknown){
 const {name,obj}=objRequest.parse(input);
 const vertices:[number,number,number][]=[],triangles:[number,number,number][]=[];
 for(const [line,source] of obj.split(/\r?\n/).entries()){
  const [kind,...fields]=source.replace(/#.*$/,'').trim().split(/\s+/);
  const invalid=()=>new Error(`Invalid OBJ ${kind} at line ${line+1}`);
  if(kind==='v'){
   const [x,y,z]=fields.slice(0,3).map(Number);
   if(x===undefined||y===undefined||z===undefined||![x,y,z].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e12))throw invalid();
   if(vertices.length>=maxVertices)throw new Error('OBJ exceeds 4,000 vertices');
   vertices.push([x,y,z]);
  }else if(kind==='f'){
   if(fields.length<3||fields.length>128)throw invalid();
   const face=fields.map(field=>{
    const raw=field.split('/')[0]!;
    if(!/^-?[1-9]\d*$/.test(raw))throw invalid();
    const value=Number(raw),resolved=value<0?vertices.length+value:value-1;
    if(resolved<0||resolved>=vertices.length)throw invalid();
    return resolved;
   });
   if(new Set(face).size!==face.length)throw invalid();
   if(triangles.length+face.length-2>maxTriangles)throw new Error('OBJ exceeds 8,000 triangles');
   for(let i=1;i+1<face.length;i++)triangles.push([face[0]!,face[i]!,face[i+1]!]);
  }
 }
 if(!triangles.length)throw new Error('OBJ has no polygon faces');
 const used=[...new Set(triangles.flat())],remap=new Map(used.map((v,i)=>[v,i]));
 const mesh=used.map(i=>vertices[i]!);
 const center=([0,1,2] as const).map(axis=>{
  const values=mesh.map(vertex=>vertex[axis]);return (Math.min(...values)+Math.max(...values))/2;
 });
 const centered=mesh.map(([x,y,z])=>[x-center[0]!,-(y-center[1]!),z-center[2]!] as const);
 const radius=Math.max(...centered.map(vertex=>Math.hypot(...vertex)));
 if(!radius)throw new Error('OBJ geometry has no size');
 return meshSticker.parse({type:'mesh',name,vertices:centered.map(vertex=>vertex.map(n=>n/radius*.43)),
  triangles:triangles.map(face=>face.map(i=>remap.get(i)))});
}
