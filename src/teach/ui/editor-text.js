'use strict';
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
 lines(g,c,W){const tx=String(c.text||'');if(edNoSpace(tx))return edPack(g,edWords(tx,c.lang),'',W*.86).map(l=>l.join(''));const words=tx.split(/\s+/);const out=[];let line='';for(const w of words){const next=line?line+' '+w:w;if(g.measureText(next).width>W*.86&&line){out.push(line);line=w;}else line=next;}if(line)out.push(line);return out.length?out:[''];},
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
  const s=c.sticker,w=r.w,h=r.h;
  if(s.type==='emoji'){g.font=`${Math.round(w*.85)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(s.emoji,0,w*.04);}
  else{g.fillStyle=c.color||'#ffd23f';g.beginPath();const R=w/2;
   if(s.shape==='rect')g.rect(-R,-R,w,w);else if(s.shape==='round')g.roundRect(-R,-R,w,w,w*.2);else if(s.shape==='circle')g.arc(0,0,R,0,Math.PI*2);
   else if(s.shape==='triangle'){g.moveTo(0,-R);g.lineTo(R,R*.8);g.lineTo(-R,R*.8);g.closePath();}
   else if(s.shape==='star'){for(let i=0;i<10;i++){const rr=i%2?R*.45:R,a2=-Math.PI/2+i*Math.PI/5;g.lineTo(Math.cos(a2)*rr,Math.sin(a2)*rr);}g.closePath();}
   else if(s.shape==='arrow'){g.moveTo(-R,-R*.22);g.lineTo(R*.2,-R*.22);g.lineTo(R*.2,-R*.6);g.lineTo(R,0);g.lineTo(R*.2,R*.6);g.lineTo(R*.2,R*.22);g.lineTo(-R,R*.22);g.closePath();}
   else if(s.shape==='line')g.roundRect(-w/2,-h/2,w,h,h/2);
   else if(s.shape==='heart'){g.moveTo(0,R*.75);g.bezierCurveTo(-R*1.3,-R*.1,-R*.5,-R*1.05,0,-R*.4);g.bezierCurveTo(R*.5,-R*1.05,R*1.3,-R*.1,0,R*.75);}
   g.fill();}
  g.restore();
 },
});
