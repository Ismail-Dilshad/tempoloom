'use strict';
// Editor, nested clips and multicam: clips inside one clip with their own tracks (drawn on their own frame, edited in place), and multicam angles lined up by sound.
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 // ---------- nested clips (compound clips): clips inside one clip, with their own tracks ----------
 /** Run fn with the nested clip's tracks and clips standing in for the timeline's (synchronously only). */
 withNest(c,fn){const P=this.p,K=this._nk,A=this._mcA;this.p={...P,tracks:c.nest.tracks,clips:c.nest.clips,markers:[],range:null};this._nk=(K||'')+c.id+'/';this._mcA=c.nest.multi?c.nest.audio:undefined;
  try{return fn();}finally{this.p=P;this._nk=K;this._mcA=A;}},
 // ---------- multicam: angles of the same moment, lined up by their sound; one shows at a time ----------
 /** The angle (index among the video tracks) a multicam clip shows at its own time lt. */
 angleAt(c,lt){let a=0;for(const x of c.nest?.cuts||[])if(x.t<=lt+1e-6)a=x.a;return a;},
 /** Make a multicam clip from the selected clips: their sound lines them up; each becomes an angle (sound-only clips can be the sound). */
 async multicam(){const list=this.picked().filter(c=>c.media&&this.mediaOf(c)?.type!=='image'&&!this.trackOf(c)?.locked);
  if(list.length<2)return toast('Select two or more clips of the same moment, each with its sound, to make a multicam clip.');
  if(list.some(c=>c.ramp||(c.speed&&c.speed!==1)))return toast('Multicam needs clips at normal speed.');
  if(!list.some(c=>this.mediaOf(c).type==='video'&&!c.asAudio))return toast('Multicam needs at least one video.');
  toast('Lining up the angles by their sound…');const env=[];
  for(const c of list){const m=this.mediaOf(c),blob=await this.get(m.id).catch(()=>null);let buf=null;try{buf=blob?await edDecode(blob):null;}catch{buf=null;}env.push(buf?edSyncEnv(buf,c.in||0,Math.min(c.dur,90)):null);}
  const off=[0],miss=[];for(let i=1;i<list.length;i++){const o=env[0]?.length&&env[i]?.length?edSyncOffset(env[0],env[i]):null;if(o==null)miss.push(this.mediaOf(list[i]).name);off.push(o??(list[i].start-list[0].start));}
  if(!list.every(c=>this.p.clips.includes(c)))return;// the timeline changed while listening
  const min=Math.min(...off),ids=new Set(list.map(c=>c.id));this.snapshot();
  const tracks=list.map((c,i)=>({id:'mc'+i,kind:this.mediaOf(c).type==='video'&&!c.asAudio?'video':'audio',name:this.mediaOf(c).name.replace(/\.[^.]+$/,'').slice(0,30)}));
  const clips=list.map((c,i)=>{const x={...JSON.parse(JSON.stringify(c)),id:this.uid(),track:'mc'+i,start:Math.round((off[i]-min)*1000)/1000};delete x.group;delete x.trans;delete x.detached;return x;});
  const dur=Math.round(Math.max(...clips.map(x=>x.start+x.dur))*1000)/1000,audio=(tracks.find(t=>t.kind==='audio')||tracks[0]).id,start=Math.max(0,list[0].start+min);
  const n=this.p.clips.filter(c=>c.nest?.multi).length+1,vt=this.trackOf(list.find(c=>tracks[list.indexOf(c)].kind==='video'));
  this.p.clips=this.p.clips.filter(c=>!ids.has(c.id));
  const c={id:this.uid(),nest:{name:`Multicam ${n}`,multi:true,tracks,clips,dur,audio,cuts:[{t:0,a:0}]},start,dur,in:0,scale:1,x:0,y:0,rotate:0,opacity:1};
  c.track=vt&&vt.kind==='video'&&this.fits(vt.id,start,dur)?vt.id:this.place('video',start,dur,vt?.id);this.p.clips.push(c);this.pick(c.id);this.after(true);
  toast(miss.length?`Multicam made, but ${miss.join(', ')} could not be matched by sound: it stays where it was.`:`Multicam: ${tracks.filter(t=>t.kind==='video').length} angles lined up. Press 1–9 to switch (also while playing).`,!!miss.length);return c;},
 /** Switch a multicam clip (the selected one, or the one under the playhead) to angle n from the playhead on; while playing, a live cut. */
 switchAngle(n){const t=this.time,sel=this.sel&&this.clip(this.sel),c=sel?.nest?.multi&&t>=sel.start&&t<sel.start+sel.dur?sel:this.p.clips.find(x=>x.nest?.multi&&t>=x.start&&t<x.start+x.dur);if(!c)return false;
  const vt=c.nest.tracks.filter(x=>x.kind==='video');if(n<0||n>=vt.length)return true;const lt=Math.round((t-c.start+(c.in||0))*1000)/1000;
  if(!this.playing||!this._mcSnap){this.snapshot();this._mcSnap=this.playing;}
  let cu=(c.nest.cuts||[]).filter(x=>Math.abs(x.t-lt)>1/60);cu.push({t:lt,a:n});cu.sort((a,b)=>a.t-b.t);if(cu[0].t>0)cu.unshift({t:0,a:0});cu=cu.filter((x,i)=>i===0||x.a!==cu[i-1].a);c.nest.cuts=cu;
  this.save();this.drawTimeline();if(!this.playing){this.draw();this.drawProps();}return true;},
 /** The nested clip's picture at timeline time t: its own tracks painted on a clear frame (its layers kept apart from ours). */
 nestFrame(c,t){const [W,H]=this.size(),all=this._nests||(this._nests=new Map()),key=(this._nk||'')+c.id;let n=all.get(key);if(!n)all.set(key,n={cv:document.createElement('canvas')});
  if(n.cv.width!==W||n.cv.height!==H){n.cv.width=W;n.cv.height=H;}const g=n.cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.filter='none';g.clearRect(0,0,W,H);
  if((this._depth||0)>4)return n.cv;
  const keep=[this._layer,this._adjSnap,this._adjFrame];this._layer=n.layer;this._adjSnap=n.adj;this._depth=(this._depth||0)+1;
  try{this.withNest(c,()=>{const lt=t-c.start+(c.in||0);if(!c.nest.multi)return this.paint(g,lt);const T=this.p.tracks,v=T.filter(x=>x.kind==='video'),a=v[this.angleAt(c,lt)];this.p.tracks=a?[a]:[];try{this.paint(g,lt);}finally{this.p.tracks=T;}});}finally{n.layer=this._layer;n.adj=this._adjSnap;[this._layer,this._adjSnap,this._adjFrame]=keep;this._depth--;}
  return n.cv;},
 /** The whole project: the timeline, also while editing inside a nested clip (then this.p is the nested clip's own). */
 root(){return this.stack?.[0]?.P||this.p;},
 /** Edits inside a nested clip go back into it (its tracks and clips, and how long its contents are), level by level. */
 relink(){const S=this.stack||[];for(let i=S.length-1;i>=0;i--){const child=i===S.length-1?this.p:S[i+1].P,c=S[i].P.clips.find(x=>x.id===S[i].cid);if(!c?.nest)continue;
  c.nest.tracks=child.tracks;c.nest.clips=child.clips;c.nest.dur=Math.round(Math.max(.1,...child.clips.map(x=>x.start+x.dur))*1000)/1000;}},
 /** Open a nested clip: the timeline shows what is inside it, to edit in place (Back or Esc to return). */
 enterNest(c){if(!c?.nest||this.exporting)return;if(this.playing)this.pause();this.relink();const P=this.p;this.stack=this.stack||[];
  this.stack.push({P,cid:c.id,past:this.past,future:this.future,pre:JSON.stringify(P),time:this.time,name:c.nest.name||'Nested'});
  this.p={...P,tracks:c.nest.tracks,clips:c.nest.clips,markers:[],range:null};this.past=[];this.future=[];
  this.time=Math.max(0,this.time-c.start+(c.in||0));this.sels.clear();this.sel=null;this.junction=null;this.after(true);this.fit?.();this.drawCrumb();
  toast(`Inside “${c.nest.name||'Nested'}”: edit as usual, then Back (or Esc)`);},
 /** Back out of a nested clip; everything done inside is one undo step outside. */
 exitNest(){const e=this.stack?.at(-1);if(!e)return;if(this.playing)this.pause();this.relink();this.stack.pop();const c=e.P.clips.find(x=>x.id===e.cid),lt=this.time;
  this.p=e.P;this.past=e.past;this.future=e.future;if(JSON.stringify(this.p)!==e.pre){this.past.push(e.pre);this.future=[];}
  this.time=c?edClamp(c.start+lt-(c.in||0),c.start,c.start+c.dur):e.time;this.sels.clear();this.sel=null;if(c)this.pick(c.id);this.after(true);this.fit?.();this.drawCrumb();},
 drawCrumb(){const el=this.dom.root?.querySelector('[data-crumb]');if(!el)return;const S=this.stack||[];el.hidden=!S.length;
  el.innerHTML=S.length?`${I.layers}<span>${S.map(x=>esc(x.name)).join(' › ')}</span><button type="button" class="ed-link" data-crumb-back>Back</button>`:'';
  const b=el.querySelector('[data-crumb-back]');if(b)b.onclick=()=>this.exitNest();},
 /** A deep copy of a nested clip's contents with new clip ids (for a split, a copy or a paste). */
 renest(n){const x=JSON.parse(JSON.stringify(n));const re=cl=>{for(const c of cl){c.id=this.uid();if(c.nest)re(c.nest.clips);}};re(x.clips);return x;},
 /** Nest: the selected clips become one clip (on the top video track they used); their tracks come along inside it. */
 nest(){const list=this.picked().filter(c=>!this.trackOf(c)?.locked);if(!list.length)return toast('Select the clips to nest.');
  const s=Math.min(...list.map(c=>c.start)),e=Math.max(...list.map(c=>c.start+c.dur)),ids=new Set(list.map(c=>c.id));
  const used=new Set(list.map(c=>c.track)),tracks=this.p.tracks.filter(t=>used.has(t.id)).map(t=>({...JSON.parse(JSON.stringify(t)),main:undefined,locked:undefined,hidden:undefined,muted:undefined,solo:undefined}));
  const vt=this.p.tracks.find(t=>used.has(t.id)&&t.kind==='video');this.snapshot();
  const inner=list.map(c=>({...JSON.parse(JSON.stringify(c)),start:Math.round((c.start-s)*1000)/1000}));for(const c of inner)delete c.group;
  this.p.clips=this.p.clips.filter(c=>!ids.has(c.id));
  const n=this.p.clips.filter(c=>c.nest).length+1,c={id:this.uid(),nest:{name:`Nested ${n}`,tracks,clips:inner,dur:Math.round((e-s)*1000)/1000},start:s,dur:Math.round((e-s)*1000)/1000,in:0,scale:1,x:0,y:0,rotate:0,opacity:1};
  c.track=vt&&this.fits(vt.id,s,c.dur)?vt.id:this.place('video',s,c.dur,vt?.id);this.p.clips.push(c);this.pick(c.id);this.after(true);toast(`Nested ${list.length} clip${list.length>1?'s':''}: right-click it to break it apart`);return c;},
 /** Break apart: the clips inside come back to the timeline where they play now (the nested clip's own look is not kept). */
 unnest(c){if(!c?.nest)return;this.snapshot();const off=c.start-(c.in||0),A=c.start,B=c.start+c.dur,back=[],T=c.nest.tracks,jobs=[];
  // a copy of an inner clip for the part [a, b] of the timeline, or null
  const cut=(x0,a,b)=>{const x=JSON.parse(JSON.stringify(x0));let st=x.start+off,en=st+x.dur;if(en<=a+1e-3||st>=b-1e-3)return null;
   if(st<a){const d=a-st;if(x.media||x.nest)x.in=(x.in||0)+d*(x.speed||1);if(x.kf)for(const k in x.kf)x.kf[k]=x.kf[k].map(f=>({...f,t:f.t-d})).filter(f=>f.t>=-1e-6);st=a;}
   if(en>b)en=b;x.start=Math.round(st*1000)/1000;x.dur=Math.round((en-st)*1000)/1000;x.id=this.uid();delete x.trans;return x;};
  if(c.nest.multi){const vt=T.filter(t=>t.kind==='video'),cu=c.nest.cuts?.length?c.nest.cuts:[{t:0,a:0}];
   cu.forEach((k,i)=>{const a=Math.max(A,off+k.t),b=Math.min(B,i+1<cu.length?off+cu[i+1].t:B),tr=vt[k.a];if(b-a<1e-3||!tr)return;
    for(const x of c.nest.clips.filter(x=>x.track===tr.id)){const y=cut(x,a,b);if(y){y.detached=true;delete y.asAudio;jobs.push([y,'video',c.track]);}}});
   for(const x of c.nest.clips.filter(x=>x.track===c.nest.audio)){const y=cut(x,A,B);if(y){delete y.detached;if(this.mediaOf(y)?.type==='video')y.asAudio=true;jobs.push([y,'audio']);}}}
  else for(const x of c.nest.clips){const y=cut(x,A,B);if(y)jobs.push([y,T.find(t=>t.id===x.track)?.kind||this.kindOf(x),x.track]);}
  this.p.clips=this.p.clips.filter(o=>o.id!==c.id);
  for(const [y,kind,pref] of jobs){const same=this.p.tracks.find(t=>t.id===pref&&t.kind===kind);y.track=same&&this.fits(same.id,y.start,y.dur)?same.id:this.place(kind,y.start,y.dur,kind==='video'?c.track:undefined);this.p.clips.push(y);back.push(y.id);}
  this.sels=new Set(back);this.sel=back.at(-1)||null;this.after(true);toast(c.nest.multi?`Multicam flattened: ${back.length} clips`:`Broke apart: ${back.length} clip${back.length===1?'':'s'}`);},
});
