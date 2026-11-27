'use strict';
const ED_BOX_FACES=[[[0,1,2,3],1],[[5,4,7,6],.73],[[4,5,1,0],1.2],[[1,5,6,2],.62],[[3,2,6,7],.49],[[4,0,3,7],.82]];
function edProjectVertices(vertices,tiltX,tiltY,depth){
 const ax=tiltX*Math.PI/180,ay=tiltY*Math.PI/180;
 const sx=Math.sin(ax),cx=Math.cos(ax),sy=Math.sin(ay),cy=Math.cos(ay);
 return vertices.map(([x,y,z0])=>{
  const z=z0*edClamp(depth,.1,1);
  const ry=y*cx-z*sx,rz=y*sx+z*cx,rx=x*cy+rz*sy,dz=rz*cy-x*sy;
  const factor=2.8/(2.8-dz);
  return [rx*factor,ry*factor,dz];
 });
}
function edBoxFaces(tiltX,tiltY,depth){
 const corners=[[-1,-1],[1,-1],[1,1],[-1,1]],half=.31;
 const vertices=edProjectVertices([1,-1].flatMap(side=>corners.map(([x,y])=>[x*half,y*half,side*half])),tiltX,tiltY,depth);
 return ED_BOX_FACES.flatMap(([indices,shade])=>{
  const points=indices.map(i=>vertices[i]),[a,b,c]=points;
  return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>1e-7?[{points,shade}]:[];
 });
}
function edMeshFaces(mesh,tiltX,tiltY,depth){
 if(!Array.isArray(mesh.vertices)||mesh.vertices.length>4000||!Array.isArray(mesh.triangles)||mesh.triangles.length>8000)return [];
 const vertices=edProjectVertices(mesh.vertices.map(v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=.51)?v:[]),tiltX,tiltY,depth);
 return mesh.triangles.flatMap(face=>{
  if(!Array.isArray(face)||face.length!==3||face.some(index=>!Number.isInteger(index)||index<0||index>=vertices.length))return [];
  const points=face.map(index=>vertices[index]),[a,b,c]=points;
  if(!a||!b||!c)return [];
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz);
  if(!Number.isFinite(length)||Math.abs(nz)<1e-8)return [];
  const light=Math.abs((-nx*.4-ny*.6+nz*.69)/length);
  return [{points,shade:.44+.56*light,z:(a[2]+b[2]+c[2])/3}];
 }).sort((a,b)=>a.z-b.z);
}
function edDrawGeometry(g,size,color,faces){
 const hex=/^#[a-f0-9]{6}$/i.test(color)?color:'#ffd23f';
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 for(const {points,shade} of faces){
  g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x*size,y*size):g.moveTo(x*size,y*size));g.closePath();
  g.fillStyle=`rgb(${rgb.map(channel=>Math.min(255,Math.round(channel*shade))).join(',')})`;g.fill();
 }
}

// Original vector artwork. Each path uses a 100 × 100 coordinate space shared by previews and exports.
const ED_GRAPHICS={
 arrow:['Curved arrow','Callouts','#ffcc47',[['M16 77Q18 32 72 28M54 11L79 27 62 48','stroke',9]]],
 underline:['Marker underline','Callouts','#ffcc47',[['M11 63Q48 51 89 56M20 74Q52 63 80 66','stroke',7]]],
 circle:['Hand-drawn circle','Callouts','#ff5a66',[['M78 20C57 6 22 15 14 38S20 84 52 83 92 62 87 43 68 20 49 20','stroke',6]]],
 focus:['Focus brackets','Callouts','#70e4ff',[['M36 17H17V36M64 17H83V36M83 64V83H64M36 83H17V64','stroke',7],['M50 42V58M42 50H58','#fff',3]]],
 cursor:['Click pointer','Callouts','#ffffff',[['M26 17L26 78 42 64 55 87 65 81 53 59 76 57Z','#121925',5],['M26 17L26 78 42 64 55 87 65 81 53 59 76 57Z'],['M55 15V7M67 22L75 15M72 34H83','#ffcc47',4]]],
 pin:['Location pin','Social','#ff646e',[['M50 9C33 9 21 22 21 38 21 58 50 90 50 90S79 58 79 38C79 22 67 9 50 9Z'],['M50 26A12 12 0 1 0 50 50 12 12 0 1 0 50 26Z','#fff']]],
 record:['REC frame','Social','#ff575f',[['M15 35V16H34M66 16H85V35M85 65V84H66M34 84H15V65','#fff',5],['M50 31A19 19 0 1 0 50 69 19 19 0 1 0 50 31Z']]],
 play:['Play badge','Social','#6b8bff',[['M17 23H83Q89 23 89 29V71Q89 77 83 77H17Q11 77 11 71V29Q11 23 17 23Z'],['M43 34L68 50 43 66Z','#fff']]],
 bookmark:['Save badge','Social','#56ddbe',[['M22 13H78Q83 13 83 18V82Q83 87 78 87H22Q17 87 17 82V18Q17 13 22 13Z','#182232'],['M35 28H65V74L50 62 35 74Z','stroke',5]]],
 speech:['Speech bubble','Social','#c7adff',[['M21 15H80Q90 15 90 25V64Q90 74 80 74H49L29 89V74H21Q11 74 11 64V25Q11 15 21 15Z'],['M30 40H71M30 53H60','#251b40',5]]],
 burst:['Comic impact','Accents','#ffbb43',[['M50 7L59 33 82 17 72 40 96 47 74 59 87 81 61 72 52 94 42 71 16 86 27 62 4 52 30 44 13 22 39 32Z'],['M43 44L57 44 53 62 47 62ZM47 67H53V73H47Z','#241932']]],
 sparkle:['Star glints','Accents','#ffe484',[['M43 13Q46 41 70 45 46 50 43 77 37 50 15 45 37 41 43 13Z'],['M75 7Q77 22 90 25 77 28 75 43 71 28 59 25 71 22 75 7Z','#fff'],['M76 62Q78 73 90 77 78 80 76 92 73 80 63 77 73 73 76 62Z','#fff']]],
 confetti:['Confetti burst','Accents','#ffbf5b',[['M32 65L60 86 16 94Z'],['M38 57Q42 35 62 30M48 65Q69 45 86 57','#78efbc',5],['M59 13L69 10 72 21 62 24ZM82 24L93 29 88 39 77 34ZM72 68L83 70 80 80 71 79Z','#c79bff'],['M20 47L31 43 34 52 23 56ZM42 21L51 18 53 30 45 33Z','#74d9ff']]],
 tape:['Paper tape','Accents','#ffca90',[['M10 38L89 27 86 36 92 43 87 52 94 61 13 73 17 64 11 57 15 48Z'],['M26 48L76 41M29 59L67 54','#6c3d3e',3]]],
};
const ED_GRAPHIC_PATHS=new Map();
function edPaintGraphic(g,id,x,y,size,colour){
 if(!Object.hasOwn(ED_GRAPHICS,id))return;
 const art=ED_GRAPHICS[id];
 g.save();g.translate(x,y);g.scale(size/100,size/100);g.lineCap='round';g.lineJoin='round';
 const accent=colour||art[2];
 for(const [d,ink,width] of art[3]){
  if(!ED_GRAPHIC_PATHS.has(d))ED_GRAPHIC_PATHS.set(d,new Path2D(d));
  const path=ED_GRAPHIC_PATHS.get(d);
  if(width){g.strokeStyle=ink==='stroke'?accent:ink;g.lineWidth=width;g.stroke(path);}
  else{g.fillStyle=ink||accent;g.fill(path);}
 }
 g.restore();
}
// Editor, text and stickers: in/out animations (text, stickers, video and photo clips), text layout and drawing (gradient, glow, 3D, curve, bubble), stickers.
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 /** How far a clip's in or out animation is (0 to 1, 1 = fully shown). */
 anim(c,t){const d=Math.max(.1,c.animDur||.5),lt=t-c.start,rt=c.start+c.dur-t;return {i:c.animIn&&c.animIn!=='none'?edClamp(lt/d,0,1):1,o:c.animOut&&c.animOut!=='none'?edClamp(rt/d,0,1):1};},
 animApply(c,t){const {i,o}=this.anim(c,t),r={alpha:1,k:1,dx:0,dy:0,rot:0,chars:1,blur:0,words:1};
  const one=(type,p)=>{if(p>=1)return;const e=edEase(p);if(type==='fade')r.alpha*=e;else if(type==='pop'){const b=1-Math.pow(1-p,3);r.k*=.5+.5*b+Math.sin(p*Math.PI)*.12;r.alpha*=Math.min(1,p*3);}else if(type==='slide'){r.dy+=(1-e)*.08;r.alpha*=e;}else if(type==='type')r.chars=Math.min(r.chars,p);
   else if(type==='zoom'){r.k*=1+(1-e)*.6;r.alpha*=e;}else if(type==='blur'){r.blur=Math.max(r.blur||0,(1-e)*24);r.alpha*=e;}else if(type==='words')r.words=p;
   else if(type==='zoomout'){r.k*=1-(1-e)*.4;r.alpha*=e;}else if(type==='left'){r.dx+=(1-e)*.6;}else if(type==='right'){r.dx-=(1-e)*.6;}else if(type==='down'){r.dy-=(1-e)*.6;}
   else if(type==='bounce'){const b=1-Math.pow(1-p,2)*Math.cos(p*Math.PI*3.5);r.k*=Math.max(.05,b);r.alpha*=Math.min(1,p*4);}
   else if(type==='spin'){r.rot+=(1-e)*-180;r.k*=.3+.7*e;r.alpha*=e;}else if(type==='swing'){r.rot+=Math.sin(p*Math.PI*3)*(1-p)*14;r.alpha*=Math.min(1,p*3);}
   else if(type==='shake'){r.dx+=Math.sin(p*60)*(1-p)*.03;r.dy+=Math.cos(p*47)*(1-p)*.03;r.alpha*=Math.min(1,p*4);}};
  one(c.animIn,i);one(c.animOut,o);return r;},
 lines(g,c,W){const width=W*.86;
  return String(c.text||'').split(/\r\n?|\n/).flatMap(paragraph=>{
   if(!paragraph.trim())return [''];
   if(edNoSpace(paragraph))return edPack(g,edWords(paragraph,c.lang),'',width).map(line=>line.join(''));
   const lines=[];let line='';
   for(const word of paragraph.trim().split(/\s+/)){
    const next=line?`${line} ${word}`:word;
    if(line&&g.measureText(next).width>width){lines.push(line);line=word;}else line=next;
   }
   return [...lines,line];
  });
 },
 font(c,t){return `${c.weight||600} ${Math.round((c.size||40)*this.val(c,'scale',t)*this.k())}px "${c.font||'Tempoloom UI'}", "Tempoloom UI", system-ui, sans-serif`;},
 textBox(g,c,W,H,t=this.time){if(c.words?.length)return this.capBox(g,c,W,H,t);g.save();g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;const ls=this.lines(g,c,W),lh=(c.size||40)*this.val(c,'scale',t)*this.k()*(c.lineH||1.25),w=Math.max(...ls.map(l=>g.measureText(l).width))+lh*.6,h=ls.length*lh+lh*.3;g.restore();
  return {w,h,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H,ls,lh};},
 drawText(g,c,W,H,t=this.time,o={}){
  if(c.words?.length)return this.drawCaption(g,c,W,H,t,o);
  const b=this.textBox(g,c,W,H,t),an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha;if(a<=0)return;
  g.save();g.globalAlpha=a;g.translate(b.cx+(o.dx||0)+an.dx*W,b.cy+(o.dy||0)+an.dy*H);g.rotate((this.val(c,'rotate',t)+an.rot)*Math.PI/180);g.scale(an.k,an.k);if(an.blur)g.filter=`blur(${an.blur*this.k()}px)`;g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;g.textBaseline='middle';g.direction=edRtl(c.text)?'rtl':'ltr';
  if(c.bubble){const r=b.lh*.45,tx=-b.w/2+b.w*.22;g.fillStyle=c.boxColor&&c.boxColor!=='#000000'?c.boxColor:'#ffffff';g.beginPath();g.roundRect(-b.w/2,-b.h/2,b.w,b.h,r);g.moveTo(tx,b.h/2-1);g.lineTo(tx-b.lh*.15,b.h/2+b.lh*.55);g.lineTo(tx+b.lh*.45,b.h/2-1);g.closePath();g.fill();}
  else if(c.box){g.fillStyle=c.boxColor||'#000';g.globalAlpha=a*.72;g.beginPath();g.roundRect(-b.w/2,-b.h/2,b.w,b.h,b.lh*.25);g.fill();g.globalAlpha=a;}
  g.textAlign=c.align||'center';const x=c.align==='left'?-b.w/2+b.lh*.3:c.align==='right'?b.w/2-b.lh*.3:0;
  let ls=b.ls;if(an.chars<1){let n=Math.round(ls.join(' ').length*an.chars);ls=ls.map(l=>{const s=l.slice(0,Math.max(0,n));n-=l.length+1;return s;});}
  const kk=this.k(),fill=y=>{if(!c.grad)return c.color||'#fff';const gr=g.createLinearGradient(0,y-b.lh*.45,0,y+b.lh*.45);gr.addColorStop(0,c.color||'#fff');gr.addColorStop(1,c.color2||'#ffb000');return gr;};
  const paint=(l,x,y)=>{
   // 3D: copies stepping down and right, darker, under the letters
   if(c.depth){const n=Math.round(c.depth*kk);g.fillStyle=c.depthColor||'#000000';if(c.stroke){g.lineJoin='round';g.lineWidth=c.stroke*kk*2;g.strokeStyle=c.depthColor||'#000000';}for(let i=n;i>=1;i--){if(c.stroke)g.strokeText(l,x+i,y+i);g.fillText(l,x+i,y+i);}}
   if(c.shadow&&!c.box&&!c.bubble){g.shadowColor='rgba(0,0,0,.5)';g.shadowBlur=b.lh*.25;g.shadowOffsetY=b.lh*.05;}
   if(c.stroke){g.lineJoin='round';g.lineWidth=c.stroke*kk*2;g.strokeStyle=c.strokeColor||'#000';g.strokeText(l,x,y);g.shadowColor='transparent';}
   if(c.glow){g.save();g.shadowColor=c.glowColor||c.color||'#fff';g.shadowBlur=c.glow/100*b.lh*.9;g.shadowOffsetY=0;g.fillStyle=fill(y);g.fillText(l,x,y);g.fillText(l,x,y);g.restore();}
   g.fillStyle=c.bubble&&!c.color?'#000':fill(y);g.fillText(l,x,y);};
  // curved text: each letter along an arc (up for a positive curve, down for a negative one); not for joined scripts
  const curved=c.curve&&!edRtl(c.text)&&an.words>=1&&an.chars>=1;
  if(curved){const s=Math.sign(c.curve),th=Math.min(Math.PI*1.6,Math.abs(c.curve)/100*Math.PI);g.textAlign='center';
   ls.forEach((l,i)=>{const y0=-b.h/2+b.lh*.15+b.lh*(i+.5),chars=[...l],wd=chars.map(ch=>g.measureText(ch).width),tot=wd.reduce((p,v)=>p+v,0)||1,R=tot/th;let acc=0;
    chars.forEach((ch,j)=>{const an2=-th/2+(acc+wd[j]/2)/R;acc+=wd[j];g.save();g.translate(R*Math.sin(an2),y0+s*R*(1-Math.cos(an2)));g.rotate(s*an2);paint(ch,0,0);g.restore();});});
   g.restore();return;}
  if(an.words<1){// word by word: each whole word rises in after the one before (right to left for Arabic-script text)
   const rtl=/[\u0590-\u08FF\uFB1D-\uFEFF]/.test(c.text||''),all=ls.map(l=>l.split(' ')),N=all.flat().length||1,sp=g.measureText(' ').width;let n=0;
   g.textAlign='left';
   all.forEach((ws,i)=>{const y=-b.h/2+b.lh*.15+b.lh*(i+.5),wd=ws.map(w=>g.measureText(w).width),lw=wd.reduce((a,v)=>a+v,0)+sp*(ws.length-1);
    let xs=c.align==='left'?-b.w/2+b.lh*.3:c.align==='right'?b.w/2-b.lh*.3-lw:-lw/2;const pos=[];let cur=xs;for(const v of wd){pos.push(cur);cur+=v+sp;}
    ws.forEach((w,j)=>{const at=rtl?xs+lw-(pos[j]-xs)-wd[j]:pos[j],k=n++,u=edClamp((an.words-k/N*.7)/.3,0,1),e=edEase(u);if(u<=0)return;
     g.globalAlpha=a*e;paint(w,at,y+(1-e)*b.lh*.45);});});
   g.globalAlpha=a;}
  else ls.forEach((l,i)=>paint(l,x,-b.h/2+b.lh*.15+b.lh*(i+.5)));
  g.restore();
 },
 drawSticker(g,c,W,H,t=this.time,o={}){
  const r=this.rect(c,W,H,t),an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha;if(a<=0)return;
  g.save();g.globalAlpha=a;g.translate(r.cx+(o.dx||0)+an.dx*W,r.cy+(o.dy||0)+an.dy*H);g.rotate((this.val(c,'rotate',t)+an.rot)*Math.PI/180);g.scale(an.k,an.k);if(an.blur)g.filter=`blur(${an.blur*this.k()}px)`;
  const s=c.sticker,w=r.w,h=r.h,shape=s.shape??s.id;
  if(s.type==='emoji'){g.font=`${Math.round(w*.85)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(s.emoji,0,w*.04);}
  else if(s.type==='graphic')edPaintGraphic(g,s.id,-w/2,-w/2,w,c.color);
  else if(shape==='cuboid'||s.type==='mesh'){
   const x=this.val(c,'tiltX',t),y=this.val(c,'tiltY',t),depth=this.val(c,'depth3d',t);
   edDrawGeometry(g,w,c.color,s.type==='mesh'?edMeshFaces(s,x,y,depth):edBoxFaces(x,y,depth));
  }
  else{g.fillStyle=c.color||'#ffd23f';g.beginPath();const R=w/2;
   if(shape==='rect')g.rect(-R,-R,w,w);else if(shape==='round')g.roundRect(-R,-R,w,w,w*.2);else if(shape==='circle')g.arc(0,0,R,0,Math.PI*2);
   else if(shape==='triangle'){g.moveTo(0,-R);g.lineTo(R,R*.8);g.lineTo(-R,R*.8);g.closePath();}
   else if(shape==='star'){for(let i=0;i<10;i++){const rr=i%2?R*.45:R,a2=-Math.PI/2+i*Math.PI/5;g.lineTo(Math.cos(a2)*rr,Math.sin(a2)*rr);}g.closePath();}
   else if(shape==='arrow'){g.moveTo(-R,-R*.22);g.lineTo(R*.2,-R*.22);g.lineTo(R*.2,-R*.6);g.lineTo(R,0);g.lineTo(R*.2,R*.6);g.lineTo(R*.2,R*.22);g.lineTo(-R,R*.22);g.closePath();}
   else if(shape==='line')g.roundRect(-w/2,-h/2,w,h,h/2);
   else if(shape==='heart'){g.moveTo(0,R*.75);g.bezierCurveTo(-R*1.3,-R*.1,-R*.5,-R*1.05,0,-R*.4);g.bezierCurveTo(R*.5,-R*1.05,R*1.3,-R*.1,0,R*.75);}
   g.fill();}
  g.restore();
 },
});
