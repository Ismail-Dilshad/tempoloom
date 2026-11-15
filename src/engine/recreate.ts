// Same design, your content: the user's script, logo and colours put into a reference's design scene
// by scene (from its blueprint), and a check that a made video follows that design. What goes in is
// the user's; what is kept from the reference is only its design: timing, transitions, where things
// sit and how big, which colour plays which role, how much it moves.
import fs from 'node:fs';
import path from 'node:path';
import {colorDistance,readBlueprint,rgbOf,study,type Blueprint,type Box,type Scene} from './blueprint.js';

type Brand={primary?:string;accent?:string;background?:string;text?:string;neutral?:string};
const lum=(h:string)=>{const [r,g,b]=rgbOf(h);return (.299*r+.587*g+.114*b)/255;};
const chroma=(h:string)=>{const c=rgbOf(h);return (Math.max(...c)-Math.min(...c))/255;};
/** WCAG contrast between two colours. */
export function contrast(a:string,b:string){const L=(h:string)=>{const c=rgbOf(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*c[0]!+.7152*c[1]!+.0722*c[2]!;};
 const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
/** Which of the user's colours plays each of the reference's colour roles: a dark background stays
 *  dark, a light one light, the ink stands out from it, the accent is the user's accent. */
export function colourMap(bp:Blueprint,brand:Brand){
 const mine=[...new Set([brand.background,brand.primary,brand.text,brand.neutral,brand.accent,'#FFFFFF','#111111'].filter((c):c is string=>!!c&&/^#[0-9a-f]{6}$/i.test(c)).map(c=>c.toUpperCase()))];
 const backgrounds=mine.filter(c=>c!==brand.accent?.toUpperCase()||mine.length<3);
 const map=new Map<string,string>(),bgOf=(ref:string)=>{for(const [k,v] of map)if(colorDistance(k,ref)<20)return v;
  // The user's colour closest in lightness, the brand's own colours first.
  // Like for like: as light, as colourful; a colour another reference colour already took, or a
  // plain white or near-black, only when nothing closer is left (two scenes that differ still differ).
  const used=new Set(map.values()),cost=(c:string)=>Math.abs(lum(c)-lum(ref))+.5*Math.abs(chroma(c)-chroma(ref))+(used.has(c)?.18:0)+(/^#(FFFFFF|111111)$/.test(c)?.08:0);
  const pick=[...backgrounds].sort((a,b)=>cost(a)-cost(b))[0]!;map.set(ref,pick);return pick;};
 return bp.scenes.map(s=>{const background=bgOf(s.colors.background);
  const ink=[...mine].filter(c=>c!==background).sort((a,b)=>contrast(b,background)-contrast(a,background))[0]!;
  const accent=brand.accent&&contrast(brand.accent,background)>=2?brand.accent.toUpperCase():[...mine].filter(c=>c!==background&&c!==ink&&chroma(c)>.25).sort((a,b)=>contrast(b,background)-contrast(a,background))[0]??ink;
  return {scene:s.n,background,ink,accent:s.colors.accent?accent:null,from:{background:s.colors.background,ink:s.colors.ink,accent:s.colors.accent}};});
}
const splitSentences=(t:string)=>t.replace(/\r\n/g,'\n').split('\n').map(l=>l.trim()).filter(Boolean).flatMap(l=>l.split(/(?<=[.!?؟])\s+(?=\S)/u).map(s=>s.trim()).filter(Boolean));
const words=(s:string)=>s.split(/\s+/).filter(Boolean).length;
/** A last scene with a little content in the middle and a short word or a mark: the logo's place. */
const logoScene=(s:Scene,last:boolean)=>last&&!!s.content&&s.content.w<.6&&s.content.h<.45&&Math.abs(s.content.x+s.content.w/2-.5)<.15&&(!s.text.read||s.text.boxes.every(b=>b.chars<=8));
export type PlanScene={n:number;start:number;end:number;duration:number;transition:string;words:string|null;logo:boolean;where:string;content:Box|null;
 text:{boxes:(Box&{lines:number})[];size:number|null}|null;colors:{background:string;ink:string;accent:string|null};motion:string;note:string|null};
/** The user's content in the reference's design: each scene's time, how it comes in, where its
 *  content and words sit and how big, the user's colours in the reference's colour roles. */
export async function plan(blueprint:string|Blueprint,o:{script:string;brand?:Brand;out?:string;speechRate?:number}){
 const bp=typeof blueprint==='string'?readBlueprint(blueprint):blueprint;
 const brand=o.brand??(await (await import('./brand.js')).brandProfile()).colors,lines=splitSentences(o.script);
 if(!lines.length)throw new Error('Give the script: the words that go in the scenes');
 const colours=colourMap(bp,brand),last=bp.scenes.length-1;
 // The logo gets the reference's logo scene; the sentences share the others in order, by their time.
 const slots=bp.scenes.filter((s,i)=>!logoScene(s,i===last));
 const total=slots.reduce((t,s)=>t+s.duration,0)||1,given=new Map<number,string[]>();let at=0;
 slots.forEach((s,k)=>{const share=k===slots.length-1?lines.length-at:Math.max(1,Math.round(lines.length*s.duration/total));const n=Math.max(k<lines.length?1:0,Math.min(share,lines.length-at-(slots.length-1-k>0?Math.min(slots.length-1-k,lines.length-at-1):0)));
  given.set(s.n,lines.slice(at,at+n));at+=n;});
 if(at<lines.length)given.set(slots.at(-1)!.n,[...(given.get(slots.at(-1)!.n)??[]),...lines.slice(at)]);
 const rate=o.speechRate??2.6,notes:string[]=[];let t=0;
 const scenes:PlanScene[]=bp.scenes.map((s,i)=>{const c=colours[i]!,ws=given.get(s.n)??[],text=ws.join(' ')||null,logo=logoScene(s,i===last);
  // Long words for a short scene: the scene is held longer, the design stays.
  const need=text?words(text)/rate+.6:0,duration=+Math.max(s.duration,need).toFixed(2);
  const note=duration>s.duration+.05?`Held ${(duration-s.duration).toFixed(1)} s longer than the reference, for the words to be read.`:!text&&!logo?'No line falls here: show a visual for the line before it, as the reference does.':null;
  if(note)notes.push(`Scene ${s.n}: ${note}`);
  const p:PlanScene={n:s.n,start:+t.toFixed(2),end:+(t+duration).toFixed(2),duration,transition:s.transition,words:text,logo,where:s.where,content:s.content,
   text:s.text.read?{boxes:s.text.boxes.map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,lines:b.lines})),size:s.text.size}:null,colors:{background:c.background,ink:c.ink,accent:c.accent},
   motion:`${s.energy<1?'still':s.energy<4?'gentle':'busy'}${s.entrance>s.energy*1.5?', builds in':''}`,note};t+=duration;return p;});
 const out=path.resolve(o.out??path.join(bp.folder,'recreation'));fs.mkdirSync(out,{recursive:true});
 const result={blueprint:bp.folder,width:bp.width,height:bp.height,seconds:+t.toFixed(2),scenes,notes,colours:colours.map(c=>({scene:c.scene,yours:{background:c.background,ink:c.ink,accent:c.accent},reference:c.from}))};
 fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(result,null,1)+'\n');
 const pct=(n:number)=>Math.round(n*100)+'%';
 fs.writeFileSync(path.join(out,'plan.md'),[`# Same design, your content`,'',`The reference's design, scene by scene, with your words and colours. ${bp.width}x${bp.height}, ${result.seconds} s.`,
  'Keep each scene\'s timing, how it comes in, where its content and words sit and how big, and how it moves. Use only your own words, logo, pictures and colours: never the reference\'s artwork, logo, footage or words.','',
  ...scenes.map(s=>[`## Scene ${s.n}: ${s.start}-${s.end} s, comes in with ${s.transition==='start'?'the start':`a ${s.transition}`}`,'',
   `- Words: ${s.logo?'your logo (and name), as the reference ends':s.words?`"${s.words}"`:'none'}`,`- Where: ${s.where}${s.content?` (content box ${pct(s.content.x)},${pct(s.content.y)} to ${pct(s.content.x+s.content.w)},${pct(s.content.y+s.content.h)})`:''}`,
   ...(s.text?.boxes.length?[`- Text: ${s.text.boxes.length} line${s.text.boxes.length>1?'s':''}, the biggest ${pct(s.text.size??0)} of the height (about ${Math.round((s.text.size??0)*bp.height)} px), at ${s.text.boxes.map(b=>`${pct(b.x)},${pct(b.y)}`).join('; ')}`]:[]),
   `- Colours: background ${s.colors.background}, words ${s.colors.ink}${s.colors.accent?`, accent ${s.colors.accent}`:''}`,`- Motion: ${s.motion}`,...(s.note?[`- Note: ${s.note}`]:[]),''].join('\n')),
  'When it is made: pnpm tempoloom recreate check '+path.join(bp.folder,'blueprint.json')+' VIDEO.mp4',''].join('\n'));
 return {...result,folder:out,plan:path.join(out,'plan.md')};
}

// ---------- the check ----------
const iou=(a:Box|null,b:Box|null)=>{if(!a||!b)return a===b?1:0;const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h);const i=Math.max(0,x2-x1)*Math.max(0,y2-y1);return i/(a.w*a.h+b.w*b.h-i||1);};
const cosine=(a:number[],b:number[])=>{let d=0,x=0,y=0;for(let i=0;i<a.length;i++){d+=a[i]!*(b[i]??0);x+=a[i]!**2;y+=(b[i]??0)**2;}return x&&y?d/Math.sqrt(x*y):x===y?1:0;};
/** Where most of a scene's content is, in a few words, from its grid. */
const halves=(g:number[])=>{const row=(a:number,b:number)=>g.slice(a*6,b*6).reduce((x,y)=>x+y,0),t=row(0,2),mm=row(2,4),bt=row(4,6),all=t+mm+bt||1;
 return [t/all>.3?'top':'',mm/all>.3?'middle':'',bt/all>.3?'bottom':''].filter(Boolean).join(' and ')||'spread out';};
const family=(t:string)=>t==='flash'?'fade':t;
/** How closely a video follows a blueprint, scene by scene, with what to fix. */
export async function check(blueprint:string|Blueprint,video:string,o:{brand?:Brand;out?:string;text?:boolean}={}){
 const ref=typeof blueprint==='string'?readBlueprint(blueprint):blueprint;
 const made=await study(video,{out:o.out??path.resolve(video).replace(/\.[^.]+$/,'')+'-check',text:o.text});
 const issues:{scene:number|null;what:string;kind:string}[]=[],passed:string[]=[];let checks=0,ok=0;
 const tick=(good:boolean,scene:number|null,what:string,yes:string,kind='other')=>{checks++;if(good){ok++;passed.push(yes);}else issues.push({scene,what,kind});};
 tick(made.scenes.length===ref.scenes.length,null,`It has ${made.scenes.length} scene${made.scenes.length>1?'s':''}; the design has ${ref.scenes.length}.`,'The same number of scenes.');
 const plan=(()=>{try{return JSON.parse(fs.readFileSync(path.join(ref.folder,'recreation','plan.json'),'utf8')) as {scenes:PlanScene[]};}catch{return null;}})();
 const theirs=new Set(ref.scenes.flatMap(s=>[s.colors.background,s.colors.accent].filter((c):c is string=>!!c)));
 const brandList=Object.values(o.brand??(await (await import('./brand.js')).brandProfile()).colors).filter((c):c is string=>!!c);
 for(let i=0;i<Math.min(ref.scenes.length,made.scenes.length);i++){const r=ref.scenes[i]!,m=made.scenes[i]!,want=plan?.scenes[i]?.duration??r.duration;
  tick(Math.abs(m.duration-want)<=Math.max(.35,want*.2),r.n,`Scene ${r.n} lasts ${m.duration} s; the design says ${want} s.`,`Scene ${r.n}: its timing.`);
  if(i>0)tick(family(m.transition)===family(r.transition)||(r.transition==='dissolve'&&m.transition==='move'),r.n,`Scene ${r.n} comes in with a ${m.transition}; the design has a ${r.transition}.`,`Scene ${r.n}: how it comes in.`);
  // Where things sit, cell by cell (the whole content box alone would miss two parts swapping places).
  const empty=(g:number[])=>g.every(v=>v<.01),lay=empty(r.grid)||empty(m.grid)?iou(m.content,r.content):cosine(m.grid,r.grid);
  tick(lay>=.6,r.n,m.where===r.where?`Scene ${r.n}: the parts inside it sit in other places than in the design (${halves(m.grid)} here, ${halves(r.grid)} in the design): compare the two sheets.`:`Scene ${r.n}: the content sits ${m.where}; in the design it sits ${r.where}.`,`Scene ${r.n}: where things sit.`,'layout');
  if(r.text.read&&m.text.read&&r.text.boxes.length&&m.text.boxes.length){
   const big=(s:Scene)=>s.text.boxes.reduce((a,b)=>b.h>a.h?b:a),a=big(r),b=big(m),dy=Math.abs((a.y+a.h/2)-(b.y+b.h/2)),ratio=b.h/a.h;
   tick(dy<=.12,r.n,`Scene ${r.n}: the main words sit at ${Math.round((b.y+b.h/2)*100)}% down; in the design at ${Math.round((a.y+a.h/2)*100)}%.`,`Scene ${r.n}: where the words sit.`);
   tick(ratio>=.6&&ratio<=1.6,r.n,`Scene ${r.n}: the main words are ${ratio<1?'smaller':'bigger'} than the design's (${Math.round(ratio*100)}%).`,`Scene ${r.n}: how big the words are.`);}
  // The user's colours, not the reference's own (unless the brand has them too).
  const own=(c:string)=>brandList.some(x=>colorDistance(x,c)<25)||['#FFFFFF','#111111','#000000'].some(x=>colorDistance(x,c)<25);
  const stillTheirs=own(m.colors.background)?[]:[...theirs].filter(c=>!own(c)&&colorDistance(c,m.colors.background)<36);
  tick(!stillTheirs.length,r.n,`Scene ${r.n} still uses the reference's colour ${stillTheirs[0]} for its background: use yours.`,`Scene ${r.n}: your colours.`);}
 // It follows the design when every scene is laid out like the design's and nearly everything else matches.
 const score=Math.round(ok/Math.max(1,checks)*100),pass=score>=85&&!issues.some(i=>i.kind==='layout'||i.kind==='count');
 return {score,pass,scenes:{design:ref.scenes.length,made:made.scenes.length},issues,passed:passed.length,checks,sheet:made.sheet,
  note:pass?'It follows the design.':'Fix what is listed (each line says the scene and what differs), make it again, and check again.'};
}
