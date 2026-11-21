'use strict';
// Teach: what the studio learned from (Learn's cards and each video's page), compare, the lessons
// and the patterns. Bringing a video in and saying what to learn from it is in learn.js.
const Teach={
 data:null,D:{},editing:null,
 lib:{group:'all',style:'',...store.get('teach-lib',{q:'',verdict:'all',status:'all',topic:'all',sort:'new'})},picked:new Set(),
 les:store.get('teach-les',{q:'',status:'all',topic:'all'}),
 load(){return api('/api/state');},
 /** The current teach screen's data (each screen loads the same state). */
 get S(){const here=App.screens[App.route];return here?.data?.topics?here.data:['teach/library','teach/lessons','teach/patterns'].map(r=>App.screens[r].data).find(Boolean);},
};
const word=(n,a)=>a.find(([max])=>n<max)[1];
const topicLabel=id=>Teach.S.topics.find(t=>t.id===id)?.label||id;

const TEACH_MODES=[
 {id:'motion',name:'Motion design',short:'Motion study',icon:'spark',description:'Animation, type & composition',topics:['motion','typography','transitions','design','pacing']},
 {id:'edit',name:'Footage editing',short:'Editing study',icon:'film',description:'Cut rhythm, flow & sound',topics:['editing','pacing','transitions','audio']}
];
const teachMode=id=>TEACH_MODES.find(m=>m.id===id)||TEACH_MODES[0];
function automaticTitle(d){
 const mode=teachMode(d.mode);
 const base=d.sourceTitle.replace(/^Video by /i,'').replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_]+/g,' ').trim();
 const generic=/^(video|clip|source|download|reel|untitled|screen recording|[a-f0-9-]{16,})(?:\s|$)/i.test(base)||/^\d+$/.test(base);
 const title=generic?`${mode.short} · ${fmtS(d.end-d.start)}`:`${base} · ${mode.short}`;
 if(title.length<=120)return title;
 let shortened='';
 for(const word of title.split(/\s+/u)){const next=(shortened+' '+word).trim();if(next.length>120)break;shortened=next;}
 return shortened||mode.short;
}
function automaticPrompt(d){
 const topics=Teach.S.topics.filter(t=>d.topics.has(t.id)).map(t=>t.label.toLowerCase());
 const subject=topics.length?topics.join(', '):'the selected learning focus';
 const direction=d.verdict==='good'?'Explain what works and why, with techniques worth reusing.':'Explain what does not work and why, with concrete changes to avoid repeating those problems.';
 const part=d.start<=.01&&d.end>=d.seconds-.01?'Study the full clip.':`Study only ${fmtT(d.start)} to ${fmtT(d.end)}.`;
 let prompt=`${part} Focus on ${subject}. ${direction} Ground each lesson in a visible moment and describe how to apply it to another video.${d.sound&&d.audio?' Include how the sound supports the visuals.':''}`;
 for(const mark of d.marks.filter(m=>m.t>=d.start&&m.t<=d.end)){
  const instruction=` Pay attention at ${fmtT(mark.t)}${mark.note?' — '+mark.note:''}.`;
  if(prompt.length+instruction.length>1950){prompt+=' Review the remaining marked moments as well.';break;}
  prompt+=instruction;
 }
 return prompt;
}
// ---------- lessons (shared pieces) ----------
function lessonHtml(l,ctx=''){
 const gone=l.status==='rejected'||l.status==='retired';
 const st=l.status==='trial'?'<span class="badge wait">on trial</span>':gone?'<span class="badge st">removed</span>':`<span class="badge good">${l.status==='proven'?'proven':'kept'}</span>`;
 const id=esc(l.id),key=ctx+l.id;
 if(Teach.editing===key)return `<div class="lesson" id="edit-${esc(key)}"><textarea id="et" dir="auto" maxlength="1500">${esc(l.body)}</textarea><div class="row" style="margin-top:8px"><button class="btn small primary" onclick="saveLesson('${id}')">Save and keep</button><button class="btn small ghost" onclick="Teach.editing=null;App.show(false)">Cancel</button></div></div>`;
 return `<div class="lesson ${gone?'removed':''} ${l.conflictWith&&l.status==='trial'?'conflict':''}">
  <div class="row">${st}${l.kind==='avoid'?'<span class="badge bad">avoid</span>':''}${l.mine?'<span class="chip">written by you</span>':''}${l.topics.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}
   <span class="muted small" style="margin-left:auto">${l.videos>1?`seen in ${l.videos} videos, `:''}${l.uses?`used ${l.uses}×, `:''}${l.wins||l.losses?`${l.wins} good ${l.losses} bad, `:''}confidence ${l.confidence}%</span></div>
  <div class="body" dir="auto">${esc(l.body)}</div>
  <div class="row">${l.status==='trial'?`<button class="btn small" onclick="lessonDo('${id}','${l.conflictWith?'both':'keep'}','Kept')">Keep</button>`:''}
   ${gone?`<button class="btn small" onclick="lessonDo('${id}','both','Brought back')">Bring back</button>`:`<button class="btn small ghost" onclick="Teach.editing='${esc(key)}';App.show(false)">Reword</button><button class="btn small ghost" onclick="lessonDo('${id}','remove','Removed')">Remove</button>`}</div></div>`;
}
window.lessonDo=(id,action,done)=>act(()=>api('/api/lessons/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action})}),done);
window.saveLesson=id=>act(async()=>{const body=$('#et').value;await api('/api/lessons/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action:'edit',body,title:body.split(/(?<=[.!?])\s/)[0].slice(0,100)})});Teach.editing=null;},'Saved');

// ---------- library ----------
function chips(m,speech){
 if(!m)return '';const c=[];
 c.push(`<b>${fmtS(m.media.seconds)}</b> ${m.media.shape}`);
 c.push(m.pacing.cuts>=2?`shots <b>${m.pacing.shotMedian} s</b>`:'<b>one continuous piece</b>');
 c.push(`motion <b>${word(m.motion.energy,[[1,'calm'],[2.5,'gentle'],[5,'lively'],[1e9,'very busy']])}</b>`);
 c.push(`<b>${word(m.color.brightness,[[.3,'dark'],[.7,'mid'],[9,'light']])}</b>, ${word(m.color.saturation,[[.2,'muted'],[.5,'coloured'],[9,'vivid']])}`);
 if(m.sound&&m.sound.tempoConfidence>=.25)c.push(`<b>${m.sound.bpm} BPM</b>`);
 if(speech)c.push(`<b>${speech.wordsPerSecond}</b> words/s`);
 return `<div class="chips">${c.map(x=>`<span class="chip">${x}</span>`).join('')}</div>`;
}
const cutStrip=m=>m&&m.pacing.cutTimes.length?`<div class="cuts" role="img" aria-label="${m.pacing.cuts} cuts across ${fmtS(m.media.seconds)}">${m.pacing.cutTimes.map(t=>`<i style="left:${t/m.media.seconds*100}%"></i>`).join('')}</div>`:'';
const palette=m=>m?`<div class="pal" role="img" aria-label="The main colours">${m.color.palette.map(p=>`<i style="width:${Math.max(4,p.share*100)}%;background:${esc(p.hex)}" title="${esc(p.hex)}"></i>`).join('')}</div>`:'';
const statusBadge=v=>v.status==='measuring'?`<span class="badge st"><span class="spin"></span> ${esc(v.step||'Measuring')}</span>`:v.status==='waiting'?'<span class="badge wait">waiting for the agent</span>':v.status==='failed'?'<span class="badge bad">failed</span>':'<span class="badge st">learned</span>';
// ---------- Learn: what the studio learned from, beside Create ----------
// The same grid and card as Create (a still, the name on hover, a ••• menu), one search and one
// filter; a card opens the video on its own flat page. New videos come in through the dock below.
// A study that kept no still or clip gets a soft cover in the video's own measured colours, with its name.
const hexOk=h=>/^#[0-9a-f]{3,8}$/i.test(h||'');
function taughtCover(v,cls,extra=''){
 const pal=(v.measured?.color?.palette||[]).map(p=>p.hex).filter(hexOk),bg=pal[0]||'#2a2f3a',mid=pal[1]||bg,end=pal[3]||pal[2]||mid;
 // The name sits on the last colour, so its brightness picks dark or light text.
 const lum=h=>{h=h.slice(1);if(h.length<6)h=h.split('').map(c=>c+c).join('');const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);return .2126*r+.7152*g+.0722*b;};
 const light=lum(end)>.55;
 return `<div class="taught-cover ${cls||''} ${light?'light':''}" style="background:linear-gradient(150deg,${bg},${mid} 55%,${end});${extra}" aria-hidden="true">
  <span class="taught-cover-dots">${pal.slice(0,5).map(h=>`<i style="background:${h}"></i>`).join('')}</span><b dir="auto">${esc(v.title)}</b></div>`;
}
const taughtThumb=v=>v.hasThumb?`<img class="upload-preview" loading="lazy" alt="" src="${esc(withKey('/media/'+v.id+'/thumb.jpg'))}">`:v.hasPlayback?`<video class="upload-preview" muted preload="metadata" playsinline src="${esc(withKey('/media/'+v.id+'/playback.mp4'))}#t=0.5"></video>`:taughtCover(v);
const taughtState=v=>v.status==='learned'?'Learned':v.status==='measuring'?'Studying':'Not studied yet';
function taughtCard(v,S){
 const id=esc(v.id),group=(S.groups.find(g=>g.id===v.group)||{}).label||'';
 return `<article class="upload-card output-card taught-card${v.hasThumb||v.hasPlayback?'':' has-cover'}" data-group="${esc(`${v.verdict} ${v.group} ${v.status==='learned'?'learned':'waiting'}`)}"
  data-find="${esc(`${v.title} ${v.prompt||''} ${group} ${v.style.join(' ')} ${v.lessons.map(l=>l.body).join(' ')}`)}" data-name="${esc(v.title)}" data-taught="${id}">
  ${I.film}${taughtThumb(v)}
  ${(()=>{const on=Learn.picked.has(v.id);return `<button type="button" class="upload-select" aria-pressed="${on}" aria-label="${on?'Unselect':'Select'} ${esc(v.title)}"><span aria-hidden="true">${on?I.check:I.add}</span></button>`;})()}
  <span class="taught-state ${v.verdict}" title="${v.verdict==='good'?'Good example':'Bad example'}"><i aria-hidden="true"></i>${taughtState(v)}</span>
  <span class="upload-name" dir="auto">${esc(v.title)}</span>
  <button type="button" class="iconbtn sm upload-action" aria-haspopup="menu" aria-expanded="false" aria-label="More options for ${esc(v.title)}" onclick="taughtMenu(this,'${id}')">${I.more}</button></article>`;
}
window.taughtMenu=(btn,id)=>{
 const v=Teach.S.videos.find(x=>x.id===id);if(!v)return;
 const others=Teach.S.videos.filter(x=>x.id!==id&&x.measured&&x.status!=='draft');
 const menu=Pop.open(btn,`<a class="pop-item" role="menuitem" href="#/learn/${encodeURIComponent(id)}" data-close>${I.play}<span>Open</span></a>
  ${v.status==='learned'?`<button type="button" class="pop-item" role="menuitem" data-close onclick="Learn.useInCreate(['${esc(id)}'])">${I.spark}<span>Use in Create</span></button>`:''}
  ${v.canAgain||v.link?`<button type="button" class="pop-item" role="menuitem" data-close onclick="Learn.again('${esc(id)}')">${I.refresh}<span>Learn again</span></button>`:''}
  ${v.measured&&others.length?`<button type="button" class="pop-item" role="menuitem" data-compare>${I.mix}<span>Compare with…</span></button>`:''}
  ${v.status==='learned'?`<button type="button" class="pop-item" role="menuitem" data-rename>${I.text}<span>Rename</span></button><button type="button" class="pop-item" role="menuitem" data-close onclick="Learn.betterNames(['${esc(id)}'])">${I.spark}<span>Better name</span></button>`:''}
  ${v.status!=='measuring'?`<hr><button type="button" class="pop-item danger" role="menuitem" data-remove>${I.trash}<span>Remove</span></button>`:''}`,{align:'end',label:'Video options'});
 menu?.querySelector('[data-compare]')?.addEventListener('click',()=>{Pop.close(true);compareWith(btn,id);});
 menu?.querySelector('[data-rename]')?.addEventListener('click',()=>{Pop.close(true);renameTaught(id,btn);});
 menu?.querySelector('[data-remove]')?.addEventListener('click',()=>{Pop.close(true);Learn.removeMenu(btn,[id]);});
};
/** Picks the second video to compare with, from a short list. */
function compareWith(btn,id){
 const others=Teach.S.videos.filter(x=>x.id!==id&&x.measured&&x.status!=='draft');
 const menu=Pop.open(btn,`<div class="pop-head">Compare with</div>${others.map(o=>`<button type="button" class="pop-item" role="menuitem" data-with="${esc(o.id)}"><span dir="auto">${esc(o.title)}</span></button>`).join('')}`,{align:'end',label:'Compare with'});
 menu?.querySelectorAll('[data-with]').forEach(b=>b.onclick=()=>{Pop.close(true);Teach.picked=new Set([id,b.dataset.with]);compareVideos();});
}
window.compareWith=compareWith;
/** The hero banner's colours: the video's measured palette, deepened so white text stays clear. */
function taughtHeroStyle(v){
 const pal=(v.measured?.color?.palette||[]).map(p=>p.hex).filter(hexOk);
 const c=pal.length?pal:['var(--surface-3)','var(--surface-1)'];
 return `--h1:${c[0]};--h2:${c[1]||c[0]};--h3:${c[3]||c[2]||c[1]||c[0]}`;
}
function taughtPage(v,S){
 const id=esc(v.id),m=v.measured,group=(S.groups.find(g=>g.id===v.group)||{}).label||'';
 const facts=[taughtState(v),v.verdict==='good'?'Good example':'Bad example',group,v.media?.seconds?fmtS(v.media.seconds):'',m?.media?.shape||'',`${v.lessons.length} lesson${v.lessons.length===1?'':'s'}`,`taught ${ago(v.created)}`].filter(Boolean);
 const tags=v.style.length?v.style:v.topics.map(topicLabel),shown=tags.slice(0,6);
 const lessons=v.lessons.filter(l=>l.status!=='rejected'&&l.status!=='retired');
 const others=S.videos.filter(x=>x.id!==v.id&&x.measured&&x.status!=='draft');
 const media=v.hasPlayback?`<video class="video-player" src="${esc(withKey('/media/'+v.id+'/playback.mp4'))}" controls playsinline preload="metadata"${m?.media?.width?` style="aspect-ratio:${m.media.width}/${m.media.height}"`:''}></video>`
  :v.hasThumb?`<img class="video-player" alt="" src="${esc(withKey('/media/'+v.id+'/thumb.jpg'))}">`:taughtCover(v,`video-player ${m?.media?.shape==='horizontal'?'wide':''}`,m?.media?.width?`aspect-ratio:${m.media.width}/${m.media.height}`:'');
 return `<div class="no-head video-page taught-page">
  <div class="video-bar">
   <button type="button" class="video-back" onclick="history.length>1?history.back():location.hash='#/learn'">${I.back}<span>Back</span></button>
   <div class="video-actions">
    ${v.measured&&others.length?`<button type="button" class="video-act" id="tp-compare" aria-label="Compare">${I.mix}<span>Compare</span></button>`:''}
    ${v.status==='learned'?`<button type="button" class="video-act" aria-label="Rename" onclick="renameTaught('${id}',this)">${I.text}<span>Rename</span></button>`:''}
    ${v.status==='waiting'?`<button type="button" class="video-act" aria-label="Finish now" onclick="finishVideo('${id}')">${I.check}<span>Finish now</span></button>`:''}
    ${v.status==='learned'?`<button type="button" class="video-act" aria-label="Use in Create" onclick="Learn.useInCreate(['${id}'])">${I.spark}<span>Use in Create</span></button>`:''}
    ${(()=>{const has=v.canAgain||v.link,off=has?'':` disabled title="Nothing of this video is kept to learn from again"`;return v.status==='learned'?`<button type="button" class="video-act" aria-label="Refine" aria-haspopup="dialog" onclick="Learn.refine(this,'${id}')">${I.sliders}<span>Refine</span></button><button type="button" class="video-act" aria-label="Learn again" onclick="Learn.again('${id}')"${off}>${I.refresh}<span>Learn again</span></button>`:'';})()}
    ${v.status!=='measuring'?`<button type="button" class="video-act danger" aria-label="Remove" aria-haspopup="menu" onclick="Learn.removeMenu(this,['${id}'])">${I.trash}<span>Remove</span></button>`:''}
   </div>
  </div>
  ${v.hasPlayback||v.hasThumb?`<div class="video-frame">${media}</div>
  <div class="video-info"><div class="video-about"><h1 class="video-title" dir="auto" title="${esc(v.title)}">${esc(v.title)}</h1>
   <p class="video-facts">${facts.map(f=>`<span>${esc(f)}</span>`).join('')}</p></div></div>`
   // No clip kept: a soft banner in the video's own colours carries its name and facts.
   :`<header class="taught-hero" style="${taughtHeroStyle(v)}"><span class="taught-hero-tag">${I.lesson} Taught video</span><h1 dir="auto">${esc(v.title)}</h1><p class="taught-hero-facts">${facts.map(f=>`<span>${esc(f)}</span>`).join('')}</p></header>`}
  ${v.error?`<p class="taught-note bad">${esc(v.error)}</p>`:''}
  ${v.status==='waiting'?`<p class="taught-note">Your agent has not studied it yet. Tell it “study the videos I taught”.</p>`:''}
  ${shown.length?`<section class="taught-section"><h2>What it learned</h2><div class="taught-tags">${shown.map(t=>`<span>${esc(t)}</span>`).join('')}${tags.length>6?`<span class="more">+${tags.length-6}</span>`:''}</div></section>`:''}
  <section class="taught-section"><h2>Rules</h2>
   ${lessons.length?`<ul class="taught-lessons">${lessons.map(l=>`<li><p dir="auto">${l.kind==='avoid'?'<b class="avoid">Avoid</b> ':''}${esc(l.body)}</p><span>${l.status==='trial'?'On trial':l.uses?`Used ${l.uses}×`:'Not used yet'}</span></li>`).join('')}</ul>`
    :`<p class="taught-empty">${v.status==='learned'?'No rules written. Its measurements still count towards the patterns.':'None yet.'}</p>`}
  </section>
  ${m||v.prompt||v.similar.length?`<details class="taught-more"><summary>Details</summary><div class="taught-more-body">
   ${v.prompt?`<p class="taught-prompt" dir="auto">“${esc(v.prompt)}”</p>`:''}
   ${m?`${chips(m,v.speech)}${cutStrip(m)}`:''}
   ${v.similar.length?`<h3>Most like it</h3><ul class="taught-similar">${v.similar.map(s=>`<li><a href="#/learn/${encodeURIComponent(s.id)}" dir="auto">${esc(s.title)}</a><span>${s.alike}% alike</span></li>`).join('')}</ul>`:''}
  </div></details>`:''}
 </div>`;
}
App.register('teach/library',{
 title:a=>a?(Teach.S?.videos.find(v=>v.id===a)?.title||'Video'):'Learn',load:Teach.load,
 // Re-drawing while the video plays would restart it.
 hold:()=>!!App.arg,
 render(el,arg){
  const S=this.data,all=S.videos.filter(v=>v.status!=='draft');
  if(arg){
   const v=all.find(x=>x.id===arg);
   el.innerHTML=v?taughtPage(v,S):`<div class="no-head create-none" role="status"><span class="create-none-icon" aria-hidden="true">${I.film}</span><h2 class="create-none-title">This video is not here any more</h2><a class="btn create-none-reset" href="#/learn">Back to Learn</a></div>`;
   if(v)$('#tp-compare',el)?.addEventListener('click',e=>compareWith(e.currentTarget,v.id));
   return;
  }
  const list=all.slice().sort((a,b)=>String(b.created).localeCompare(String(a.created)));
  el.innerHTML=list.length?`${LearnFind.bar()}
   <section class="no-head create-section" data-section="all" aria-label="Videos the studio learned from"><div class="card-grid upload-grid create-uploads learn-grid" data-uploads>${list.map(v=>taughtCard(v,S)).join('')}</div></section>
   ${LearnFind.emptyHtml()}`
   :`<div class="no-head create-none" role="status"><span class="create-none-icon" aria-hidden="true">${I.lesson}</span><h2 class="create-none-title">Nothing learned yet</h2><p class="create-none-text">Paste a link below, or press + to add a video for the studio to learn from.</p></div>`;
  LearnFind.wire(el);Learn.wireCards(el);
 }});
window.libGroup=g=>{Teach.lib.group=g;store.set('teach-lib',Teach.lib);App.show(false);};
window.libStyle=t=>{Teach.lib.style=Teach.lib.style===t?'':t;store.set('teach-lib',Teach.lib);App.show(false);};
window.pickVideo=(id,on)=>{on?Teach.picked.add(id):Teach.picked.delete(id);if(Teach.picked.size>2){const first=[...Teach.picked][0];Teach.picked.delete(first);}App.show(false);};
window.finishVideo=async id=>{if(await ask('Finish without the agent?','This saves the measurements and finishes the study without writing lessons.','Finish study'))act(()=>api('/api/videos/'+id+'/finish',{method:'POST'}),'Study finished.');};
window.forgetVideo=async(id,status)=>{if(status==='learned'&&!await ask('Forget this video?','Its measurements go, with any rules only it taught that were never applied.','Forget it',true))return;
 act(async()=>{await api('/api/videos/'+id,{method:'DELETE'});Teach.picked.delete(id);if(App.arg===id)App.go('teach/library');},status==='learned'?'Forgotten':'Removed');};
window.renameTaught=(id,anchor)=>{
 const v=Teach.S.videos.find(item=>item.id===id);if(!v||!anchor)return;
 renamePop(anchor,{value:v.title,label:'Video name',save:async title=>{await api('/api/videos/'+id,{method:'PATCH',body:JSON.stringify({title})});await App.refresh(true);}});
};
window.watchExample=id=>{
 const v=Teach.S.videos.find(item=>item.id===id);
 let localUrl;
 dialog(`<h2 dir="auto">${esc(v.title)}</h2>${v.hasPlayback?'':'<p class="muted">This study has no saved clip. Choose the original video to watch it on this device.</p><input type="file" accept="video/*" id="local-example" aria-label="Choose the original video">'}<video class="library-player" controls playsinline preload="metadata" ${v.hasPlayback?'src="'+withKey('/media/'+id+'/playback.mp4')+'"':'hidden'}></video><div class="dialog-actions"><button class="btn" onclick="closeDialog()">Close</button></div>`,{wide:true,onclose:()=>{if(localUrl)URL.revokeObjectURL(localUrl);}});
 const player=$('.library-player');
 player.onerror=()=>toast('This clip could not be played in your browser.',true);
 const picker=$('#local-example');
 if(picker)picker.onchange=()=>{const file=picker.files[0];if(!file)return;if(localUrl)URL.revokeObjectURL(localUrl);localUrl=URL.createObjectURL(file);player.src=localUrl;player.hidden=false;};
};
function videoDetail(v){
 const m=v.measured,id=esc(v.id),bar=(n,max)=>`<div class="meter"><i style="width:${Math.max(2,Math.min(100,n/max*100))}%"></i></div>`;
 return `<div class="vid library-detail">
  <div>${v.hasThumb?`<img class="thumb" style="width:200px" alt="" src="${withKey('/media/'+id+'/thumb.jpg')}">`:'<div class="thumb" style="width:200px"></div>'}</div>
  <div><div class="row"><span class="badge ${v.verdict}">${v.verdict==='good'?'good example':'bad example'}</span>${statusBadge(v)}<span class="muted small">taught ${ago(v.created)}</span></div>
   <div style="margin-top:8px">Learning: ${v.topics.map(t=>`<span class="chip">${esc(topicLabel(t))}</span>`).join(' ')}</div>
   ${v.prompt?`<p dir="auto" style="max-width:70ch">“${esc(v.prompt)}”</p>`:''}
   ${v.marks.length?`<div class="muted small">Marked moments: ${v.marks.map(k=>`${fmtS(k.t)}${k.note?' ('+esc(k.note)+')':''}`).join(', ')}</div>`:''}
   <div class="row" style="margin-top:12px"><button class="btn primary small" onclick="watchExample('${id}')">${v.hasPlayback?'Watch clip':'Watch original file'}</button>${v.status==='learned'?`<button class="btn small" onclick="renameTaught('${id}',this)">Rename</button>`:''}${v.status==='waiting'?`<button class="btn small" onclick="finishVideo('${id}')">Finish now</button>`:''}${v.status!=='measuring'?`<button class="btn small ghost" onclick="forgetVideo('${id}','${v.status}')">${v.status==='learned'?'Forget this video':'Remove'}</button>`:''}</div></div></div>
 ${m?`<div class="cols"><div class="card"><h3>Pacing</h3>${cutStrip(m)||'<div class="muted small" style="margin-top:8px">No hard cuts: one continuous piece.</div>'}
   <dl class="kv" style="margin-top:12px"><dt>Length</dt><dd>${fmtS(m.media.seconds)}, ${m.media.shape}, ${m.media.width}×${m.media.height}</dd><dt>Cuts</dt><dd>${m.pacing.cuts} (${m.pacing.cutsPerMinute} a minute)</dd>
    <dt>Typical shot</dt><dd>${m.pacing.shotMedian} s (shortest ${m.pacing.shotShortest}, longest ${m.pacing.shotLongest})</dd><dt>First cut</dt><dd>${m.pacing.firstCut==null?'none':m.pacing.firstCut+' s'}</dd></dl>
   <h3 style="margin-top:18px">Motion</h3><dl class="kv" style="margin-top:8px"><dt>Energy</dt><dd>${bar(m.motion.energy,8)}<span class="muted small">${m.motion.energy} (${word(m.motion.energy,[[1,'calm'],[2.5,'gentle'],[5,'lively'],[1e9,'very busy']])})</span></dd>
    <dt>Still</dt><dd>${bar(m.motion.stillShare,1)}<span class="muted small">${Math.round(m.motion.stillShare*100)}% of the time</span></dd><dt>Busiest at</dt><dd>${m.motion.peakAt==null?'none':fmtS(m.motion.peakAt)}</dd></dl></div>
  <div class="card"><h3>Colour</h3>${palette(m)}
   <dl class="kv" style="margin-top:12px"><dt>Brightness</dt><dd>${bar(m.color.brightness,1)}<span class="muted small">${Math.round(m.color.brightness*100)}%</span></dd><dt>Colour strength</dt><dd>${bar(m.color.saturation,1)}<span class="muted small">${Math.round(m.color.saturation*100)}%</span></dd>
    <dt>Background</dt><dd><span class="swatch" style="background:${esc(m.color.background)}"></span> ${esc(m.color.background)}</dd>${m.color.accent?`<dt>Accent</dt><dd><span class="swatch" style="background:${esc(m.color.accent)}"></span> ${esc(m.color.accent)}</dd>`:''}</dl>
   <h3 style="margin-top:18px">Sound</h3>${m.sound?`<dl class="kv" style="margin-top:8px">${m.sound.tempoConfidence>=.25?`<dt>Tempo</dt><dd>${m.sound.bpm} BPM</dd>`:'<dt>Tempo</dt><dd>no steady beat</dd>'}
    ${m.sound.cutsOnBeat!=null?`<dt>Cuts on the beat</dt><dd>${Math.round(m.sound.cutsOnBeat*100)}% (chance would be ${Math.round(m.sound.cutsOnBeatByChance*100)}%)</dd>`:''}<dt>Sound events</dt><dd>${m.sound.eventsPerSecond} a second</dd>${m.sound.lufs!=null?`<dt>Loudness</dt><dd>${m.sound.lufs} LUFS</dd>`:''}
    ${v.speech?`<dt>Speech</dt><dd>${v.speech.wordsPerSecond} words a second, ${v.speech.hookWords} in the first 3 s</dd>`:''}</dl>`:'<div class="muted small" style="margin-top:8px">Not studied, or the video has no sound.</div>'}</div></div>`:''}
 <h2 style="margin:24px 0 4px">Rules from this video</h2>
 ${v.lessons.length?v.lessons.map(l=>lessonHtml(l,v.id+'|')).join(''):`<div class="muted">${v.status==='learned'?'No rules written. Its measurements still count towards the patterns.':'None yet.'}</div>`}
 ${v.dropped.length?`<details><summary>${v.dropped.length} rule${v.dropped.length>1?'s':''} filtered out as noise</summary>${v.dropped.map(x=>`<div class="lesson removed"><div class="body" dir="auto">${esc(x.text)}</div><div class="muted small">${esc(x.reason)}</div></div>`).join('')}</details>`:''}
 ${v.similar.length?`<h2 style="margin:24px 0 8px">Most like it</h2><div class="grid">${v.similar.map(s=>`<a class="card" style="text-decoration:none;color:inherit" href="#/teach/library/${esc(s.id)}"><div class="row"><b dir="auto">${esc(s.title)}</b><span class="muted small" style="margin-left:auto">${s.alike}% alike, mostly in ${s.mostAlikeIn.map(esc).join(' and ')}</span></div><div class="meter" style="margin-top:8px"><i style="width:${s.alike}%"></i></div></a>`).join('')}</div>`:''}`;
}
window.compareVideos=()=>{
 const [a,b]=[...Teach.picked].map(id=>Teach.S.videos.find(v=>v.id===id)).filter(v=>v&&v.measured);if(!a||!b)return toast('Pick two measured videos to compare.',true);
 const rows=[['Example',v=>v.verdict],['Length',v=>fmtS(v.measured.media.seconds)+', '+v.measured.media.shape],['Cuts a minute',v=>v.measured.pacing.cutsPerMinute],['Typical shot',v=>v.measured.pacing.shotMedian+' s'],['First cut',v=>v.measured.pacing.firstCut==null?'none':v.measured.pacing.firstCut+' s'],
  ['Motion energy',v=>v.measured.motion.energy],['Still',v=>Math.round(v.measured.motion.stillShare*100)+'%'],['Brightness',v=>Math.round(v.measured.color.brightness*100)+'%'],['Colour strength',v=>Math.round(v.measured.color.saturation*100)+'%'],
  ['Tempo',v=>v.measured.sound&&v.measured.sound.tempoConfidence>=.25?v.measured.sound.bpm+' BPM':'none'],['Loudness',v=>v.measured.sound?.lufs!=null?v.measured.sound.lufs+' LUFS':'none'],['Rules',v=>v.lessons.length]];
 const alike=a.similar.find(s=>s.id===b.id);
 dialog(`<h2>Compare</h2>${alike?`<p class="muted">${alike.alike}% alike, mostly in ${alike.mostAlikeIn.map(esc).join(' and ')}.</p>`:''}
  <div class="cmp"><span></span><span class="h" dir="auto">${esc(a.title)}</span><span class="h" dir="auto">${esc(b.title)}</span>
   <span class="k">Cuts</span><span>${cutStrip(a.measured)||'none'}</span><span>${cutStrip(b.measured)||'none'}</span><span class="k">Colours</span><span>${palette(a.measured)}</span><span>${palette(b.measured)}</span>
   ${rows.map(([k,f])=>{const x=f(a),y=f(b);return `<span class="k">${k}</span><span>${esc(x)}</span><span style="${String(x)!==String(y)?'font-weight:600':''}">${esc(y)}</span>`;}).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeDialog()">Close</button></div>`,{wide:true});
};
