'use strict';
// Editor, widgets: the speed curve editor, colour wheels and grading curves (drawn as SVG, dragged with the pointer).
// Loaded after editor-ui.js (see index.html).
// ---------- the speed curve editor: position across, speed up and down (0.1x to 10x, log scale) ----------
const ED_CW=260,ED_CH=120,edCy=v=>6+(1-(Math.log10(v)+1)/2)*(ED_CH-12),edCv=y=>Math.pow(10,(1-(y-6)/(ED_CH-12))*2-1);
function edCurveSvg(r){
 const grid=[.25,.5,1,2,4,8].map(v=>`<line x1="0" x2="${ED_CW}" y1="${edCy(v)}" y2="${edCy(v)}" class="${v===1?'one':''}"/><text x="3" y="${edCy(v)-2}">${v}×</text>`).join('');
 const pts=r.map(([p,v])=>`${p*ED_CW},${edCy(v)}`).join(' ');
 return `<svg viewBox="0 0 ${ED_CW} ${ED_CH}" class="ed-curve-svg" role="img" aria-label="Speed curve">${grid}<polyline points="${pts}"/>${r.map(([p,v],i)=>`<circle data-pt="${i}" cx="${p*ED_CW}" cy="${edCy(v)}" r="5"><title>${v.toFixed(2)}×</title></circle>`).join('')}</svg>`;
}
function edCurveWire(svg,c){
 const at=e=>{const b=svg.getBoundingClientRect();return [edClamp((e.clientX-b.left)/b.width,0,1),edClamp(edCv((e.clientY-b.top)/b.height*ED_CH),.1,10)];};
 const redraw=()=>{svg.outerHTML=edCurveSvg(c.ramp);const n=Ed.dom.props?.querySelector('.ed-curve svg');if(n)edCurveWire(n,c);Ed.drawTimeline();Ed.sync();Ed.draw();};
 svg.onpointerdown=e=>{e.preventDefault();const pt=e.target.closest('[data-pt]');Ed.snapshot();
  let i=pt?Number(pt.dataset.pt):-1;const pts=c.ramp.map(x=>[...x]);
  if(i<0){const [p,v]=at(e);i=pts.findIndex(x=>x[0]>p);if(i<=0)return;pts.splice(i,0,[p,v]);}
  c.rampName='custom';
  const mv=ev=>{const [p,v]=at(ev);const lo=i>0?pts[i-1][0]+.02:0,hi=i<pts.length-1?pts[i+1][0]-.02:1;pts[i]=[i===0?0:i===pts.length-1?1:edClamp(p,lo,hi),Math.round(v*100)/100];Ed.setRamp(c,pts,true);redraw();};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);Ed.setRamp(c,pts,true);Ed.after(true);};
  if(!pt){Ed.setRamp(c,pts,true);redraw();}
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);};
 svg.ondblclick=e=>{const pt=e.target.closest('[data-pt]');if(!pt)return;const i=Number(pt.dataset.pt);if(i===0||i===c.ramp.length-1)return;
  const pts=c.ramp.filter((_,j)=>j!==i);c.rampName='custom';Ed.setRamp(c,pts);};
}
// ---------- colour widgets ----------
function edWheelSvg(w){const x=w?.x||0,y=w?.y||0;
 return `<svg viewBox="-50 -50 100 100" class="ed-wheel-svg" role="img" aria-label="Colour wheel"><defs><radialGradient id="ewf"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <circle r="46" fill="url(#ewc)" style="fill:conic-gradient(red,yellow,lime,cyan,blue,magenta,red)"/>${Array.from({length:36},(_,i)=>{const a=i*10*Math.PI/180;return `<path d="M0 0 L${46*Math.cos(a)} ${-46*Math.sin(a)} A46 46 0 0 0 ${46*Math.cos(a+.18)} ${-46*Math.sin(a+.18)}Z" fill="hsl(${(i*10+0)%360} 85% 55%)"/>`;}).join('')}
  <circle r="46" fill="url(#ewf)"/><circle r="46" fill="none" stroke="rgba(0,0,0,.35)"/><line x1="-4" x2="4" stroke="#0006"/><line y1="-4" y2="4" stroke="#0006"/>
  <circle cx="${x*46}" cy="${-y*46}" r="5" fill="#fff" stroke="#000" stroke-width="1.5"/></svg>`;}
function edGradeCurveSvg(pts,ch){const P=pts||[[0,0],[1,1]],f=edCurveFn(P),col={m:'#fff',r:'#ff5a5a',g:'#4be37a',b:'#5a8cff'}[ch];
 const line=Array.from({length:65},(_,i)=>{const x=i/64;return `${x*200},${(1-f(x))*120}`;}).join(' ');
 return `<svg viewBox="0 0 200 120" class="ed-curve-svg" role="img" aria-label="Curve">${[.25,.5,.75].map(v=>`<line x1="${v*200}" x2="${v*200}" y1="0" y2="120"/><line x1="0" x2="200" y1="${v*120}" y2="${v*120}"/>`).join('')}
  <line x1="0" y1="120" x2="200" y2="0" class="one"/><polyline points="${line}" style="stroke:${col}"/>${P.map(([x,y],i)=>`<circle data-gp="${i}" cx="${x*200}" cy="${(1-y)*120}" r="4"/>`).join('')}</svg>`;}
function edGradeCurveWire(svg,c,ch){
 const at=e=>{const r=svg.getBoundingClientRect();return [edClamp((e.clientX-r.left)/r.width,0,1),edClamp(1-(e.clientY-r.top)/r.height,0,1)];};
 const get=()=>(c.grade?.curves?.[ch]||[[0,0],[1,1]]).map(p=>[...p]);
 const put=pts=>{c.grade={...(c.grade||{}),curves:{...(c.grade?.curves||{}),[ch]:pts}};if(!edGraded(c.grade))delete c.grade;Ed.draw();const n=Ed.dom.props?.querySelector('.ed-gcurve');if(n){n.innerHTML=edGradeCurveSvg(pts,ch);edGradeCurveWire(n.querySelector('svg'),c,ch);}};
 svg.onpointerdown=e=>{e.preventDefault();Ed.snapshot();const pts=get();let i=e.target.closest('[data-gp]')?Number(e.target.closest('[data-gp]').dataset.gp):-1;
  if(i<0){const [x,y]=at(e);i=pts.findIndex(p=>p[0]>x);if(i<=0)return;pts.splice(i,0,[x,y]);put(pts);}
  const mv=ev=>{const [x,y]=at(ev),lo=i>0?pts[i-1][0]+.01:0,hi=i<pts.length-1?pts[i+1][0]-.01:1;pts[i]=[i===0?0:i===pts.length-1?1:edClamp(x,lo,hi),Math.round(y*1000)/1000];put(pts);};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);Ed.save();};window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);};
 svg.ondblclick=e=>{const g=e.target.closest('[data-gp]');if(!g)return;const i=Number(g.dataset.gp),pts=get();if(i===0||i===pts.length-1)return;Ed.snapshot();pts.splice(i,1);put(pts);Ed.save();};
}
