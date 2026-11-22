'use strict';
// Editor, titles: a title clip holds layers (text and boxes) laid out on the frame, made in the title editor
// (click a layer, drag to move it, drag its corner to size it) or from a ready-made title. Positions are parts
// of the frame (0 to 1), sizes are at 720p and grow with the frame, so a title fits any shape of video.
// Loaded after editor-dialogs.js (see index.html).

/** Ready-made titles. A layer: {type:'text'|'box', x, y (its anchor: a text's alignment point, a box's centre), w, h (boxes;
 *  a text's w is how wide it may grow before wrapping), text, font, size, weight, color, align, fill, radius, line, lineColor,
 *  opacity, anim ('none','fade','up','left','wipe','pop') and delay (seconds after the clip starts)}. */
const ED_TITLES=[
 {name:'Lower third',dur:5,layers:[
  {type:'box',x:.255,y:.83,w:.39,h:.115,fill:'#111111',opacity:.88,radius:10,anim:'left'},
  {type:'box',x:.064,y:.83,w:.008,h:.115,fill:'#ffb000',anim:'left'},
  {type:'text',x:.085,y:.81,text:'Name Surname',size:38,weight:800,color:'#ffffff',align:'left',anim:'left',delay:.12},
  {type:'text',x:.085,y:.857,text:'Role or place',size:22,weight:600,color:'#ffb000',align:'left',anim:'fade',delay:.3}]},
 {name:'Headline card',dur:4,layers:[
  {type:'box',x:.5,y:.5,w:1,h:1,fill:'#000000',opacity:.55,anim:'fade'},
  {type:'text',x:.5,y:.46,text:'BIG NEWS',size:110,weight:900,color:'#ffffff',align:'center',anim:'pop'},
  {type:'box',x:.5,y:.57,w:.18,h:.008,fill:'#ff3b30',anim:'wipe',delay:.2},
  {type:'text',x:.5,y:.63,text:'What it means for you',size:30,weight:600,color:'#dddddd',align:'center',anim:'up',delay:.35}]},
 {name:'Name tag',dur:4,layers:[
  {type:'box',x:.2,y:.15,w:.26,h:.085,fill:'#ffffff',radius:40,anim:'pop'},
  {type:'text',x:.2,y:.15,text:'@yourname',size:30,weight:800,color:'#111111',align:'center',anim:'fade',delay:.1}]},
 {name:'Quote card',dur:6,layers:[
  {type:'box',x:.5,y:.5,w:.7,h:.46,fill:'#101820',opacity:.9,radius:18,line:2,lineColor:'#ffb000',anim:'fade'},
  {type:'text',x:.5,y:.46,w:.6,text:'“The best way to start is to begin.”',size:40,weight:600,color:'#ffffff',align:'center',anim:'up',delay:.15},
  {type:'text',x:.5,y:.64,text:'— Someone wise',size:24,weight:500,color:'#ffb000',align:'center',anim:'fade',delay:.45}]},
 {name:'End card',dur:8,layers:[
  {type:'text',x:.5,y:.2,text:'Thanks for watching',size:56,weight:800,color:'#ffffff',align:'center',anim:'up'},
  {type:'box',x:.3,y:.55,w:.34,h:.34,fill:'#ffffff',opacity:.12,radius:14,line:2,lineColor:'#ffffff',anim:'fade',delay:.2},
  {type:'box',x:.7,y:.55,w:.34,h:.34,fill:'#ffffff',opacity:.12,radius:14,line:2,lineColor:'#ffffff',anim:'fade',delay:.3},
  {type:'text',x:.3,y:.55,text:'Watch next',size:28,weight:700,color:'#ffffff',align:'center',anim:'fade',delay:.4},
  {type:'text',x:.7,y:.55,text:'Subscribe',size:28,weight:700,color:'#ffffff',align:'center',anim:'fade',delay:.5}]},
 {name:'Subscribe button',dur:4,layers:[
  {type:'box',x:.5,y:.8,w:.24,h:.09,fill:'#e5252a',radius:12,anim:'pop'},
  {type:'text',x:.5,y:.8,text:'SUBSCRIBE',size:32,weight:900,color:'#ffffff',align:'center',anim:'pop',delay:.05}]},
];

/** How far in a layer is at clip time lt (0..1) and what that does to it. */
function edTitleAnim(l,lt,fade){const p=edClamp((lt-(l.delay||0))/.45,0,1),e=edEase(p),r={a:1,dx:0,dy:0,k:1,clip:1};
 const t=l.anim||'none';if(t==='fade')r.a=e;else if(t==='up'){r.a=e;r.dy=(1-e)*.04;}else if(t==='left'){r.a=Math.min(1,p*2);r.dx=-(1-e)*.06;}
 else if(t==='wipe')r.clip=e;else if(t==='pop'){const b=1-Math.pow(1-p,3);r.k=.6+.4*b+Math.sin(p*Math.PI)*.08;r.a=Math.min(1,p*3);}
 r.a*=fade;return r;}

/** A text layer's lines: its own line breaks, and wrapped at w (part of the frame's width) when set. */
function edTitleLines(g,l,W){const max=l.w?l.w*W:Infinity,out=[];for(const para of String(l.text??'').split('\n')){
 if(!isFinite(max)){out.push(para);continue;}const words=para.split(/\s+/);let line='';for(const w of words){const n=line?line+' '+w:w;if(g.measureText(n).width>max&&line){out.push(line);line=w;}else line=n;}out.push(line);}return out;}

/** Draw every layer of a title onto g (frame size W x H, k = the frame's scale from 720p). lt: time within the clip
 *  (layers animate in), fade: the clip's own opacity part. Returns each layer's box in frame pixels (for picking). */
function edDrawTitle(g,title,W,H,k,lt=99,fade=1){const boxes=[];
 (title?.layers||[]).forEach((l,i)=>{const an=edTitleAnim(l,lt,fade),x=(l.x+an.dx)*W,y=(l.y+an.dy)*H,a=(l.opacity??1)*an.a;
  g.save();g.globalAlpha=Math.max(0,Math.min(1,a));g.translate(x,y);g.scale(an.k,an.k);
  if(l.type==='box'){const w=(l.w||.2)*W,h=(l.h||.1)*H,r=Math.min(w,h)/2*Math.min(1,(l.radius||0)*k/(Math.min(w,h)/2||1));
   if(an.clip<1){g.beginPath();g.rect(-w/2,-h/2,w*an.clip,h);g.clip();}
   g.beginPath();g.roundRect(-w/2,-h/2,w,h,r);if(l.fill){g.fillStyle=l.fill;g.fill();}if(l.line){g.lineWidth=l.line*k;g.strokeStyle=l.lineColor||'#ffffff';g.stroke();}
   boxes.push({i,x0:x-w/2,y0:y-h/2,x1:x+w/2,y1:y+h/2});}
  else{const size=(l.size||40)*k;g.font=`${l.weight||600} ${size}px "${l.font||'Tempoloom UI'}", "Tempoloom UI", system-ui, sans-serif`;g.textBaseline='middle';g.textAlign=l.align||'center';
   g.direction=edRtl(l.text||'')?'rtl':'ltr';const ls=edTitleLines(g,l,W),lh=size*1.2,wd=Math.max(1,...ls.map(s=>g.measureText(s).width)),y0=-(ls.length-1)*lh/2;
   if(an.clip<1){const L=l.align==='left'?0:l.align==='right'?-wd:-wd/2;g.beginPath();g.rect(L,y0-lh,wd*an.clip,ls.length*lh+lh);g.clip();}
   if(l.shadow!==false){g.shadowColor='rgba(0,0,0,.45)';g.shadowBlur=size*.18;g.shadowOffsetY=size*.04;}
   g.fillStyle=l.color||'#ffffff';ls.forEach((s,j)=>g.fillText(s,0,y0+j*lh));
   const L=l.align==='left'?x:l.align==='right'?x-wd:x-wd/2;boxes.push({i,x0:L,y0:y+y0-lh/2,x1:L+wd,y1:y+y0+(ls.length-.5)*lh});}
  g.restore();});
 return boxes;}

Object.assign(Ed,{
 /** A title clip on the frame: its layers, then the clip's own position, size, turn, opacity and in/out animation over all of them. */
 drawTitle(g,c,W,H,t=this.time,o={}){
  const an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha*this.fade(c,t);if(a<=0)return;
  const s=this.val(c,'scale',t)*an.k*(o.k||1);g.save();g.translate(W/2+this.val(c,'x',t)*W+(o.dx||0)+an.dx*W,H/2+this.val(c,'y',t)*H+(o.dy||0)+an.dy*H);
  g.rotate((this.val(c,'rotate',t)+an.rot)*Math.PI/180);g.scale(s,s);g.translate(-W/2,-H/2);if(an.blur)g.filter=`blur(${an.blur*this.k()}px)`;
  edDrawTitle(g,c.title,W,H,this.k(),t-c.start,Math.min(1,a));g.restore();},
 /** Add a title (a ready-made one, or an empty one) at the playhead, on a text track; open the title editor. */
 addTitle(tp,open=true){this.snapshot();const T=JSON.parse(JSON.stringify(tp||{name:'Title',layers:[{type:'text',x:.5,y:.5,text:'Your title',size:64,weight:800,color:'#ffffff',align:'center',anim:'up'}]}));
  const c={id:this.uid(),title:{name:T.name||'Title',layers:T.layers},start:this.time,dur:T.dur||4,x:0,y:0,scale:1,rotate:0,opacity:1,animIn:'none',animOut:'fade',animDur:.4};
  c.track=this.place('text',c.start,c.dur,this.p.tracks.find(t=>t.kind==='text')?.id);this.p.clips.push(c);this.pick(c.id);this.after(true);if(open)edTitleEditor(c);return c;},
});

/** The title editor: the frame on the left (the video under the title, as it is at the playhead), the layers and the chosen
 *  layer's settings on the right. Click a layer to choose it, drag to move it, drag its corner to size it. Save keeps it as one undo step. */
async function edTitleEditor(c){if(!c?.title)return;await Ed.seekExact?.(Ed.time).catch(()=>{});
 const draft=JSON.parse(JSON.stringify(c.title)),[W,H]=Ed.size();let sel=draft.layers.length?draft.layers.length-1:-1,boxes=[];
 // the frame without this title, under the preview
 c._hide=true;Ed.draw();const under=document.createElement('canvas');under.width=W;under.height=H;under.getContext('2d').drawImage(Ed.dom.canvas,0,0);delete c._hide;Ed.draw();
 dialog(`<div class="ed-title-ed"><div class="ed-title-stage"><canvas width="${W}" height="${H}" aria-label="Title preview"></canvas>
   <p class="ed-xnote">Click a layer to choose it; drag to move; drag its corner to size it. Arrow keys nudge (Shift: more).</p>
   <div class="ed-xactions"><button type="button" class="btn" data-no>Cancel</button><button type="button" class="btn primary" data-save>Save title</button></div></div>
  <div class="ed-title-side"><h2>Title</h2><label class="ed-tf"><span>Name</span><input data-tname value="${esc(draft.name||'Title')}"></label>
   <div class="ed-title-add"><button type="button" class="btn small" data-tadd="text">${I.text} Text</button><button type="button" class="btn small" data-tadd="box">${I.shapes} Box</button></div>
   <ol class="ed-title-layers"></ol><div class="ed-title-props"></div></div></div>`);
 const box=$('.ed-title-ed'),cv=box.querySelector('canvas'),g=cv.getContext('2d'),list=box.querySelector('.ed-title-layers'),props=box.querySelector('.ed-title-props');
 const paint=()=>{g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);g.drawImage(under,0,0);boxes=edDrawTitle(g,draft,W,H,Ed.k());
  const b=boxes.find(x=>x.i===sel);if(b){g.save();g.strokeStyle='rgba(80,150,255,.95)';g.lineWidth=Math.max(2,W/500);g.setLineDash([W/90,W/140]);g.strokeRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);g.setLineDash([]);
   const hs=Math.max(8,W/90);g.fillStyle='#fff';g.fillRect(b.x1-hs/2,b.y1-hs/2,hs,hs);g.strokeRect(b.x1-hs/2,b.y1-hs/2,hs,hs);g.restore();}};
 const field=(k,label,type,val,extra='')=>`<label class="ed-tf"><span>${label}</span>${type==='textarea'?`<textarea data-tk="${k}" rows="2" dir="auto">${esc(val??'')}</textarea>`:type==='select'?extra:`<input type="${type}" data-tk="${k}" value="${esc(String(val??''))}" ${extra}>`}</label>`;
 const drawList=()=>{list.innerHTML=draft.layers.map((l,i)=>`<li><button type="button" data-tl="${i}" aria-pressed="${i===sel}">${l.type==='box'?I.shapes:I.text}<span dir="auto">${esc(l.type==='box'?'Box':String(l.text||'Text').split('\n')[0].slice(0,28))}</span></button></li>`).reverse().join('');
  list.querySelectorAll('[data-tl]').forEach(b=>b.onclick=()=>{sel=+b.dataset.tl;drawAll();});};
 const drawProps=()=>{const l=draft.layers[sel];if(!l){props.innerHTML='<p class="ed-xnote">Add a text or a box, or choose a layer.</p>';return;}
  const anims=[['none','None'],['fade','Fade'],['up','Rise'],['left','Slide in'],['wipe','Wipe'],['pop','Pop']].map(([v,n])=>`<option value="${v}" ${(l.anim||'none')===v?'selected':''}>${n}</option>`).join('');
  props.innerHTML=(l.type==='text'?field('text','Text','textarea',l.text)+field('font','Font','select',0,`<select data-tk="font">${ED_FONTS.map(([f,n])=>`<option value="${esc(f)}" ${(l.font||'Tempoloom UI')===f?'selected':''}>${n}</option>`).join('')}</select>`)+
    field('size','Size','number',l.size||40,'min="8" max="300"')+field('weight','Weight','number',l.weight||600,'min="300" max="900" step="100"')+field('color','Colour','color',l.color||'#ffffff')+
    field('align','Align','select',0,`<select data-tk="align">${[['left','Left'],['center','Centre'],['right','Right']].map(([v,n])=>`<option value="${v}" ${(l.align||'center')===v?'selected':''}>${n}</option>`).join('')}</select>`)+
    field('w','Wrap width %','number',Math.round((l.w||0)*100),'min="0" max="100"')
   :field('fill','Fill','color',l.fill||'#111111')+field('radius','Round corners','number',l.radius||0,'min="0" max="200"')+field('line','Outline','number',l.line||0,'min="0" max="20"')+field('lineColor','Outline colour','color',l.lineColor||'#ffffff')+
    field('w','Width %','number',Math.round((l.w||.2)*100),'min="1" max="100"')+field('h','Height %','number',Math.round((l.h||.1)*100),'min="1" max="100"'))+
   field('opacity','Opacity %','number',Math.round((l.opacity??1)*100),'min="0" max="100"')+field('anim','Comes in','select',0,`<select data-tk="anim">${anims}</select>`)+field('delay','After (s)','number',l.delay||0,'min="0" max="10" step=".05"')+
   `<div class="ed-title-order"><button type="button" class="btn small" data-tmv="1">Forward</button><button type="button" class="btn small" data-tmv="-1">Back</button><button type="button" class="btn small" data-tdup>Duplicate</button><button type="button" class="btn small danger" data-tdel>Delete</button></div>`;
  props.querySelectorAll('[data-tk]').forEach(inp=>inp.oninput=inp.onchange=()=>{const k=inp.dataset.tk;let v=inp.value;
   if(['size','weight','radius','line','delay'].includes(k))v=Number(v)||0;if(k==='w'||k==='h')v=edClamp(Number(v)||0,0,100)/100;if(k==='opacity')v=edClamp(Number(v),0,100)/100;
   if(k==='w'&&l.type==='text'&&!v)delete l.w;else l[k]=v;paint();if(k==='text')drawList();});
  props.querySelectorAll('[data-tmv]').forEach(b=>b.onclick=()=>{const d=+b.dataset.tmv,j=sel+d;if(j<0||j>=draft.layers.length)return;[draft.layers[sel],draft.layers[j]]=[draft.layers[j],draft.layers[sel]];sel=j;drawAll();});
  props.querySelector('[data-tdup]').onclick=()=>{const x={...JSON.parse(JSON.stringify(l)),x:l.x+.03,y:l.y+.03};draft.layers.splice(sel+1,0,x);sel++;drawAll();};
  props.querySelector('[data-tdel]').onclick=()=>{draft.layers.splice(sel,1);sel=Math.min(sel,draft.layers.length-1);drawAll();};};
 const drawAll=()=>{drawList();drawProps();paint();};
 box.querySelectorAll('[data-tadd]').forEach(b=>b.onclick=()=>{draft.layers.push(b.dataset.tadd==='text'?{type:'text',x:.5,y:.5,text:'New text',size:48,weight:700,color:'#ffffff',align:'center',anim:'fade'}:{type:'box',x:.5,y:.5,w:.3,h:.15,fill:'#111111',opacity:.85,radius:12,anim:'fade'});sel=draft.layers.length-1;drawAll();});
 // pointer: choose, move, size
 const at=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];};
 cv.onpointerdown=e=>{e.preventDefault();const [px,py]=at(e),hs=Math.max(8,W/90)*1.8,cur=boxes.find(x=>x.i===sel);
  const corner=cur&&Math.abs(px-cur.x1)<hs&&Math.abs(py-cur.y1)<hs;
  if(!corner){const hit=[...boxes].reverse().find(b=>px>=b.x0&&px<=b.x1&&py>=b.y0&&py<=b.y1);sel=hit?hit.i:-1;drawAll();if(!hit)return;}
  const l=draft.layers[sel],o={x:l.x,y:l.y,w:l.w,h:l.h,size:l.size,bw:cur?cur.x1-cur.x0:1},[sx,sy]=[px,py];cv.setPointerCapture(e.pointerId);
  cv.onpointermove=ev=>{const [qx,qy]=at(ev);
   if(corner){if(l.type==='box'){l.w=edClamp((o.w||.2)+(qx-sx)*2/W,.01,1);l.h=edClamp((o.h||.1)+(qy-sy)*2/H,.005,1);}else l.size=Math.round(edClamp((o.size||40)*(o.bw+(qx-sx))/o.bw,8,300));}
   else{let x=o.x+(qx-sx)/W,y=o.y+(qy-sy)/H;if(Math.abs(x-.5)<.01)x=.5;if(Math.abs(y-.5)<.01)y=.5;l.x=Math.round(x*1000)/1000;l.y=Math.round(y*1000)/1000;}paint();};
  cv.onpointerup=()=>{cv.onpointermove=cv.onpointerup=null;drawProps();};};
 box.tabIndex=-1;box.onkeydown=e=>{if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;const l=draft.layers[sel];if(!l)return;const d=(e.shiftKey?10:1)/1000,m={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,-d],ArrowDown:[0,d]}[e.key];
  if(m){e.preventDefault();l.x+=m[0]*10;l.y+=m[1]*10;paint();}else if((e.key==='Delete'||e.key==='Backspace')){e.preventDefault();draft.layers.splice(sel,1);sel=Math.min(sel,draft.layers.length-1);drawAll();}};
 box.querySelector('[data-tname]').oninput=e=>{draft.name=e.target.value.slice(0,40);};
 box.querySelector('[data-no]').onclick=()=>closeDialog();
 box.querySelector('[data-save]').onclick=()=>{closeDialog();Ed.snapshot();c.title=draft;Ed.after(true);toast('Title saved');};
 drawAll();box.focus();
}
