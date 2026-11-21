'use strict';
// Brain: one page of what the studio knows, in Studio's design. An overview, a graph of what it
// learned from which videos, the rules (lessons in the engine: approve, edit, archive), the
// benchmarks (taste targets), the patterns in your best examples and, once you rate, the results.
// Taste and What worked keep their own pages for adjusting.
const Brain={topic:store.get('brain-topic',''),state:store.get('brain-state','all'),q:''};
const brainState=l=>l.status==='trial'?'trial':['approved','proven'].includes(l.status)?'kept':'removed';
const BRAIN_STATES=[['all','All'],['trial','Needs review'],['kept','Active'],['removed','Archived']];

/** The map: your studio in the middle, the topics around it, the videos you taught around them.
 *  A line joins a video to each topic it taught a lesson in. Click a topic to see only its lessons. */
function brainMap(S){
 const topics=S.topics.map(t=>({...t,n:S.lessons.filter(l=>l.topics.includes(t.id)&&brainState(l)!=='removed').length})).filter(t=>t.n);
 if(!topics.length)return '';
 const W=800,H=440,cx=W/2,cy=H/2,videos=S.videos.filter(v=>v.status==='learned');
 const at=(i,n,rx,ry,off=0)=>{const a=-Math.PI/2+off+i/n*Math.PI*2;return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];};
 const tp=new Map(topics.map((t,i)=>[t.id,at(i,topics.length,220,138)])),vp=new Map(videos.map((v,i)=>[v.id,at(i,videos.length,360,196,Math.PI/videos.length)]));
 const max=Math.max(...topics.map(t=>t.n)),r=t=>14+Math.sqrt(t.n/max)*16;
 const links=[];for(const v of videos){const ts=new Set(S.lessons.filter(l=>l.from?.includes(v.id)).flatMap(l=>l.topics));for(const t of ts)if(tp.has(t))links.push([v.id,t]);}
 const sel=Brain.topic;
 return `<section class="brain-card brain-map" aria-label="What it learned from which videos">
  <div class="brain-card-head"><div><h2>Knowledge graph</h2></div>${sel?`<button type="button" class="btn small ghost" onclick="brainTopic('')">${I.x} Show all</button>`:''}</div>
  <svg viewBox="0 0 ${W} ${H}" class="brain-graph ${sel?'has-sel':''}" role="img" aria-label="${topics.length} topics from ${videos.length} taught videos">
   <defs><radialGradient id="bg-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="var(--accent)" stop-opacity=".9"/><stop offset="100%" stop-color="var(--accent)" stop-opacity=".35"/></radialGradient></defs>
   ${topics.map(t=>{const [x,y]=tp.get(t.id);return `<line class="bg-spoke ${sel===t.id?'on':''}" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;}).join('')}
   ${links.map(([v,t])=>{const [x1,y1]=vp.get(v),[x2,y2]=tp.get(t);return `<line class="bg-link ${sel===t?'on':''}" data-t="${t}" data-v="${esc(v)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;}).join('')}
   ${videos.map(v=>{const [x,y]=vp.get(v.id),on=sel&&links.some(([a,b])=>a===v.id&&b===sel);return `<a href="#/learn/${encodeURIComponent(v.id)}" class="bg-video ${on?'on':''}"><circle cx="${x}" cy="${y}" r="6"/><title>${esc(v.title)}</title></a>`;}).join('')}
   <circle class="bg-core" cx="${cx}" cy="${cy}" r="30" fill="url(#bg-core)"/><text class="bg-core-label" x="${cx}" y="${cy+4}">Studio</text>
   ${topics.map(t=>{const [x,y]=tp.get(t.id);return `<g class="bg-topic ${sel===t.id?'on':''}" data-topic="${t.id}" tabindex="0" role="button" aria-pressed="${sel===t.id}" aria-label="${esc(t.label)}: ${t.n} rules">
     <circle cx="${x}" cy="${y}" r="${r(t).toFixed(1)}"/><text class="bg-n" x="${x}" y="${y+4}">${t.n}</text><text class="bg-label" x="${x}" y="${y+r(t)+16}">${esc(t.label)}</text></g>`;}).join('')}
  </svg></section>`;
}
window.brainTopic=id=>{Brain.topic=Brain.topic===id?'':id;store.set('brain-topic',Brain.topic);App.show(false);if(Brain.topic)setTimeout(()=>$('#brain-lessons')?.scrollIntoView({behavior:'smooth',block:'start'}),60);};

function brainLesson(l,S){
 const st=brainState(l),id=esc(l.id),labels=l.topics.map(t=>S.topics.find(x=>x.id===t)?.label||t);
 const from=l.mine?'Added by you':`${l.from?.length||l.videos||1} source${(l.from?.length||l.videos||1)>1?'s':''}`;
 return `<article class="brain-lesson ${st}" data-state="${st}" data-id="${id}" data-find="${esc(`${l.body} ${labels.join(' ')}`)}">
  <p dir="auto">${l.kind==='avoid'&&!/^(avoid|never|no |do not|don't)/i.test(l.body)?'<b class="avoid">Avoid</b> ':''}${esc(l.body)}</p>
  <div class="brain-lesson-meta">
   <span class="brain-state ${st}">${{trial:'Needs review',kept:l.status==='proven'?'Proven':'Active',removed:'Archived'}[st]}</span>
   ${labels.map(x=>`<span class="brain-chip">${esc(x)}</span>`).join('')}
   <span class="brain-from">${from}${l.uses?` · applied ${l.uses}×`:''}</span>
   <span class="brain-conf" title="Confidence ${l.confidence}%" aria-label="Confidence ${l.confidence}%"><i style="width:${l.confidence}%"></i></span>
  </div>
  <div class="brain-lesson-actions">
   ${st==='trial'?`<button type="button" class="btn small primary" onclick="lessonDo('${id}','${l.conflictWith?'both':'keep'}','Rule approved')">${I.check} Approve</button>`:''}
   ${st==='removed'?`<button type="button" class="btn small" onclick="lessonDo('${id}','both','Rule restored')">${I.restore} Restore</button>`
    :`<button type="button" class="btn small ghost" onclick="brainReword(this,'${id}')">${I.text} Edit</button><button type="button" class="btn small ghost danger-text" onclick="brainRemove('${id}')">${I.trash} Archive</button>`}
  </div></article>`;
}
/** Edit a rule right in its card: the text becomes the field, the buttons become Cancel and Save. */
window.brainReword=(btn,id)=>{
 const l=(App.screens['brain-home'].data?.lessons||[]).find(x=>x.id===id),card=btn.closest('.brain-lesson');if(!l||!card)return;
 document.querySelector('.brain-lesson.editing [data-cancel]')?.click();
 const was=card.innerHTML;card.classList.add('editing');
 card.querySelector('p').outerHTML=`<textarea class="brain-edit" dir="auto" maxlength="1500" aria-label="Edit the rule">${esc(l.body)}</textarea>`;
 card.querySelector('.brain-lesson-actions').innerHTML=`<button type="button" class="btn small ghost" data-cancel>Cancel</button><button type="button" class="btn small primary" data-save>${I.check} Save</button>`;
 const t=card.querySelector('.brain-edit'),fit=()=>{t.style.height='auto';t.style.height=t.scrollHeight+'px';};
 const close=()=>{card.classList.remove('editing');card.innerHTML=was;};
 const save=()=>{const body=t.value.trim();if(body.length<8)return toast('Write a little more.');if(body===l.body)return close();card.classList.remove('editing');
  act(()=>api('/api/lessons/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action:'edit',body,title:body.split(/(?<=[.!?])\s/)[0].slice(0,100)})}),'Changes saved');};
 card.querySelector('[data-cancel]').onclick=close;card.querySelector('[data-save]').onclick=save;
 t.oninput=fit;t.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();save();}};
 fit();t.focus();t.setSelectionRange(t.value.length,t.value.length);
};

/** Benchmarks: the measured ranges every preview is checked against before you see it. Each one
 *  comes from your good examples by itself (Auto), or you set it (Custom). A row draws the range
 *  over the examples it came from, and edits in place: set your own numbers, go back to Auto, or
 *  stop checking it. Measurements your examples disagree on are listed as not checked, with why. */
const bmNum=(x,u)=>{const n=Math.abs(x)>=100?Math.round(x):Math.round(x*10)/10;return `${n}${u?(u==='%'?'%':' '+u):''}`;};
function bmChart(t,f){
 const vals=f?.values||[],pts=[...vals,t.lo,t.hi],lo0=Math.min(...pts),hi0=Math.max(...pts),pad=Math.max((hi0-lo0)*.18,Math.abs(hi0)*.02,.5);
 const a=lo0-pad,b=hi0+pad,x=v=>((v-a)/(b-a)*100).toFixed(2);
 return `<div class="bm-chart" aria-hidden="true"><div class="bm-track"></div><div class="bm-band" style="left:${x(t.lo)}%;width:${Math.max(.8,x(t.hi)-x(t.lo))}%"></div>
  ${vals.map(v=>`<i class="bm-dot${v<t.lo||v>t.hi?' bm-far':''}" style="left:${x(v)}%"></i>`).join('')}
  </div>`;
}
function brainBench(S){
 const T=S.taste;if(!T)return '';
 const found=new Map((S.patterns?.found||[]).map(f=>[f.metric,f])),why=new Map((S.patterns?.unclear||[]).map(u=>[u.metric,u.why]));
 const good=S.patterns?.from?.good||0;
 const rows=T.targets.map(t=>{const f=found.get(t.metric),auto=t.from!=='you';
  return `<div class="bm-row" data-metric="${esc(t.metric)}">
   <div class="bm-name"><b>${esc(t.label)}</b><small>${esc(t.about||'')}</small></div>
   ${bmChart(t,f)}
   <div class="bm-side"><span class="bm-range">${bmNum(t.lo,'')} – ${bmNum(t.hi,t.unit)}</span>
    <span class="bm-src ${auto?'auto':'custom'}" title="${auto?`Measured from ${t.videos} good example${t.videos===1?'':'s'}`:'Set by you'}">${auto?`${I.spark} Auto · ${t.videos}`:`${I.user} Custom`}</span>
    <button type="button" class="iconbtn sm" data-bm-edit aria-label="Adjust ${esc(t.label)}">${I.sliders}</button></div>
  </div>`;}).join('');
 const off=(T.untargeted||[]).map(u=>`<li><div><b>${esc(u.label)}</b><small>${esc(u.offRef?'You turned this off.':why.get(u.metric)||(good<3?'Teach a few more good examples to measure this.':'Not measured in your examples yet.'))}</small></div>
   ${u.offRef?`<button type="button" class="btn small ghost" data-bm-on="${esc(u.offRef)}">Check it again</button>`:`<button type="button" class="btn small ghost" data-bm-set="${esc(u.metric)}" data-label="${esc(u.label)}" data-unit="${esc(u.unit||'')}">Set a range</button>`}</li>`).join('');
 return `<section class="brain-card" id="brain-bench" aria-label="Benchmarks">
  <div class="brain-card-head"><div><h2>Benchmarks <span>${T.targets.length}</span></h2></div>
   ${S.inTaste?"":`<a class="btn small ghost" href="#/brain/taste">${I.gear} Taste profile</a>`}</div>
  ${rows?`<div class="bm-list">${rows}</div><div class="bm-legend"><span><i class="bm-band-key"></i>Target range</span><span><i class="bm-dot-key"></i>Your examples</span><span><i class="bm-dot-key bm-far"></i>Outside the range</span></div>`
   :`<p class="brain-empty">No benchmarks yet. Teach three good examples on Learn and they are measured by themselves.</p>`}
  ${off?`<details class="bm-off"><summary>Not checked <span class="muted">${T.untargeted.length}</span></summary><ul>${off}</ul></details>`:''}
 </section>`;
}
/** Edit a benchmark in its row: two numbers, then Save, Use auto (for your own) or Stop checking. */
function bmEdit(el,row,S,metric,label,unit){
 const T=S.taste,t=T.targets.find(x=>x.metric===metric),f=(S.patterns?.found||[]).find(x=>x.metric===metric);
 el.querySelector('.bm-row.editing [data-bm-cancel]')?.click();
 const host=row||document.createElement('div');
 if(!row){host.className='bm-row';el.querySelector('.bm-off').before(host);}
 const was=row?host.innerHTML:null;host.classList.add('editing');
 host.innerHTML=`<div class="bm-name"><b>${esc(label||t.label)}</b><small>${f?`Your examples: ${bmNum(Math.min(...f.values),'')} to ${bmNum(Math.max(...f.values),f.unit.trim())}`:'Set the range you want.'}</small></div>
  <div class="bm-edit"><label><span>From</span><input type="number" step="any" data-lo value="${t?t.lo:''}"></label><span class="bm-to">to</span><label><span>To</span><input type="number" step="any" data-hi value="${t?t.hi:''}"></label><span class="bm-unit">${esc((t?.unit||unit||'').trim())}</span></div>
  <div class="bm-side">${t?.from==='you'&&f?`<button type="button" class="btn small ghost" data-bm-auto>Use auto</button>`:''}${t?`<button type="button" class="btn small ghost danger-text" data-bm-stop>Stop checking</button>`:''}
   <button type="button" class="btn small ghost" data-bm-cancel>Cancel</button><button type="button" class="btn small primary" data-bm-save>${I.check} Save</button></div>`;
 const close=()=>{if(was===null)host.remove();else{host.classList.remove('editing');host.innerHTML=was;}};
 const post=b=>api('/api/taste',{method:'POST',body:JSON.stringify({profile:S.profile||'main',...b})});
 const lo=$('[data-lo]',host),hi=$('[data-hi]',host);setTimeout(()=>{const x=$('[data-lo]',host);x?.focus();x?.select();},0);
 $('[data-bm-cancel]',host).onclick=close;
 $('[data-bm-save]',host).onclick=()=>{const L=$('[data-lo]',host),H=$('[data-hi]',host),a=Number(L.value),b=Number(H.value);
  if(L.value===''||H.value===''||!Number.isFinite(a)||!Number.isFinite(b))return toast('Give both numbers.');if(b<a)return toast('The upper value must not be below the lower one.');
  host.classList.remove('editing');act(()=>post({action:'target',metric,lo:a,hi:b}),'Benchmark saved');};
 const auto=$('[data-bm-auto]',host);if(auto)auto.onclick=()=>{host.classList.remove('editing');act(()=>post({action:'target',metric,lo:null}),'Back to auto');};
 const stop=$('[data-bm-stop]',host);if(stop)stop.onclick=async()=>{if(!await ask(`Stop checking ${(t.label||'').toLowerCase()}?`,'Previews are no longer checked for it. You can turn it back on under Not checked.','Stop checking',true))return;
  host.classList.remove('editing');act(async()=>{if(t.from==='you')await post({action:'target',metric,lo:null});if(f)await post({action:'line',ref:f.id,on:false});},'Benchmark off');};
 host.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Enter'){e.preventDefault();$('[data-bm-save]',host).click();}};
}
function wireBench(el,S){
 const B=$('#brain-bench',el);if(!B)return;
 B.querySelectorAll('[data-bm-edit]').forEach(b=>b.onclick=()=>{const r=b.closest('.bm-row');bmEdit(B,r,S,r.dataset.metric);});
 B.querySelectorAll('[data-bm-set]').forEach(b=>b.onclick=()=>{b.closest('details').open=true;bmEdit(B,null,S,b.dataset.bmSet,b.dataset.label,b.dataset.unit);});
 B.querySelectorAll('[data-bm-on]').forEach(b=>b.onclick=()=>act(()=>api('/api/taste',{method:'POST',body:JSON.stringify({profile:S.profile||'main',action:'line',ref:b.dataset.bmOn,on:true})}),'Benchmark on'));
}
function brainWorked(W){
 const s=W?.scores;if(!s||!s.ratings)return '';
 return `<section class="brain-card"><div class="brain-card-head"><div><h2>Results</h2></div><a class="btn small ghost" href="#/brain/worked">See all</a></div>
  <div class="brain-stats small">${[['Ratings',s.ratings],['Good',s.good],['Bad',s.bad],['Videos rated',s.jobs]].map(([l,n])=>`<div class="brain-stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div></section>`;
}

App.register('brain-home',{
 title:()=>'Brain',
 load:async()=>{const [s,t,w]=await Promise.all([Teach.load(),api('/api/taste').catch(()=>null),api('/api/studio/state').catch(()=>null)]);s.taste=t;s.worked=w;return s;},
 hold:()=>!!Pop.el||!!document.querySelector('.brain-lesson.editing,.bm-row.editing'),
 render(el){
  const S=this.data,all=S.lessons,tot=S.totals;
  const byTopic=all.filter(l=>!Brain.topic||l.topics.includes(Brain.topic));
  const clash=new Set((S.conflicts||[]).map(c=>c.lesson.id)),list=byTopic.filter(l=>!(l.status==='trial'&&clash.has(l.id)));
  const n=st=>list.filter(l=>brainState(l)===st).length;
  const topicLabel=Brain.topic?(S.topics.find(t=>t.id===Brain.topic)?.label||Brain.topic):'';
  el.innerHTML=`<div class="no-head brain">
   <header class="brain-hero"><div><h1>Brain</h1></div>
    <div class="brain-hero-actions"><button type="button" class="btn ghost" onclick="exportLessons()">${I.down} Export</button><button type="button" class="btn primary" onclick="writeLesson()">${I.add} Add rule</button></div></header>
   <div class="brain-stats">${[['Rules',tot.lessons,`${tot.kept} active · ${tot.onTrial} to review`],['Sources',tot.videos,tot.waiting?`${tot.waiting} still learning`:'all learned'],['Topics',S.topics.filter(t=>all.some(l=>l.topics.includes(t.id)&&brainState(l)!=='removed')).length,`of ${S.topics.length} covered`],['Benchmarks',S.taste?.targets?.length||0,'checked on each preview']].map(([l,v,s])=>`<div class="brain-stat"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('')}</div>
   ${brainMap(S)}
   <section class="brain-card" id="brain-lessons" aria-label="Rules">
    <div class="brain-card-head"><div><h2>Rules${topicLabel?` · ${esc(topicLabel)}`:''} <span>${list.length-n('removed')}</span></h2></div>
     <button type="button" class="btn small" id="brain-keep-all" onclick="keepAll()" hidden>${I.check} <span></span></button></div>
    <div class="brain-bar"><div class="seg-tiles compact brain-states" role="group" aria-label="Show">${BRAIN_STATES.map(([id,l])=>`<button type="button" aria-pressed="${Brain.state===id}" data-state="${id}">${l} <span class="muted">${id==='all'?list.length-n('removed'):n(id)}</span></button>`).join('')}</div>
     <label class="create-find-box brain-search">${I.search}<input type="search" id="brain-q" placeholder="Search rules" aria-label="Search rules" value="${esc(Brain.q)}" autocomplete="off"></label></div>
    ${S.conflicts?.length?`<div class="brain-decide"><div class="brain-decide-head"><b>Conflict${S.conflicts.length>1?`s · ${S.conflicts.length}`:''}</b><span>These rules disagree. Choose which to follow.</span></div>${S.conflicts.map(c=>`<div class="brain-decide-pair"><div><small>New</small><p dir="auto">${esc(c.lesson.body)}</p></div><div><small>Current</small><p dir="auto">${esc(c.against.body)}</p></div>
     <div class="brain-lesson-actions"><button class="btn small primary" onclick="lessonDo('${esc(c.lesson.id)}','keep','Using the new rule')">Use new</button><button class="btn small ghost" onclick="lessonDo('${esc(c.lesson.id)}','remove','Kept the current rule')">Keep current</button><button class="btn small ghost" onclick="lessonDo('${esc(c.lesson.id)}','both','Kept both rules')">Keep both</button></div></div>`).join('')}</div>`:''}
    <div class="brain-lessons">${list.map(l=>brainLesson(l,S)).join('')}<p class="brain-empty" hidden></p></div>
   </section>
   ${brainBench(S)}
   ${brainWorked(S.worked)}
  </div>`;
  el.querySelectorAll('.bg-topic').forEach(g=>{g.onclick=()=>brainTopic(g.dataset.topic);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();brainTopic(g.dataset.topic);}};
   g.onmouseenter=()=>el.querySelectorAll(`.bg-link[data-t="${g.dataset.topic}"]`).forEach(x=>x.classList.add('hot'));g.onmouseleave=()=>el.querySelectorAll('.bg-link.hot').forEach(x=>x.classList.remove('hot'));});
  // Show the rules of the chosen tab that match the search; Approve all approves what is on screen.
  const apply=()=>{const q=Brain.q.trim().toLowerCase(),shown=[];
   el.querySelectorAll('.brain-lesson').forEach(c=>{const st=c.dataset.state,ok=(Brain.state==='all'?st!=='removed':st===Brain.state)&&(!q||c.dataset.find.toLowerCase().includes(q));c.hidden=!ok;if(ok)shown.push(c);});
   el.querySelectorAll('.brain-states button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state===Brain.state)));
   const empty=$('.brain-empty',el);empty.hidden=!!shown.length;
   empty.textContent=!all.length?'No rules yet. They appear after a video you add on Learn is learned.':q?'No rules match your search.':{trial:"You're all caught up. New rules appear here after a video is learned.",kept:'No active rules yet. Approve one from Needs review.',removed:'Nothing archived.'}[Brain.state]||'No rules here yet.';
   const trial=shown.filter(c=>c.dataset.state==='trial').map(c=>c.dataset.id);Teach.trialShown=trial;
   const ka=$('#brain-keep-all',el);ka.hidden=trial.length<2;$('span',ka).textContent=`Approve all ${trial.length}`;};
  $('.brain-states',el).onclick=e=>{const b=e.target.closest('button[data-state]');if(!b)return;Brain.state=b.dataset.state;store.set('brain-state',Brain.state);apply();};
  const qi=$('#brain-q',el);qi.oninput=()=>{Brain.q=qi.value;apply();};
  apply();
  wireBench(el,S);
 }});
/** Archive a rule, after asking: it stops being applied; Restore on the Archived tab (or Undo) returns it. */
window.brainRemove=async id=>{
 const l=(App.screens['brain-home'].data?.lessons||[]).find(x=>x.id===id),txt=l?.body||'';
 if(await ask('Archive this rule?','It stops applying to new videos. Restore it anytime from Archived.','Archive',true,{file:{name:txt.length>160?txt.slice(0,160)+'…':txt}}))lessonDo(id,'remove','Rule archived');
};
/** Add a rule in the side drawer, the same drawer Learn uses: the rule, Do or Avoid, its topics. */
const RULE_EXAMPLES=[
 ['End on the logo','End every ad on the logo for at least 2 seconds, with the website address under it.','do',['design']],
 ['Readable captions','Keep captions to two short lines, high contrast, away from the bottom edge.','do',['captions']],
 ['No stock music','Never use generic upbeat stock music; pick a track that fits the mood.','avoid',['audio']]];
window.writeLesson=window.brainAddRule=()=>{
 const S=App.screens['brain-home']?.data||Teach.S,d={type:'do',topics:new Set(Brain.topic?[Brain.topic]:[])};
 const topics=S.topics.filter(t=>S.lessons.some(l=>l.topics.includes(t.id))||t.id===Brain.topic);
 Panel.open({id:'add-rule',title:'Add rule',sub:'Rules you add are active right away.',focus:false,
  body:`<div class="video-settings add-rule">
   <section class="video-settings-section"><label class="field-label" for="ar-text">Rule</label>
    <div class="add-rule-box"><textarea id="ar-text" dir="auto" maxlength="1500" rows="4" placeholder="Describe what the studio should do, as one clear instruction."></textarea><span class="add-rule-count" id="ar-count">0 / 1500</span></div>
    <div class="add-rule-examples" aria-label="Examples"><span>Try</span>${RULE_EXAMPLES.map(([l],i)=>`<button type="button" data-ex="${i}">${esc(l)}</button>`).join('')}</div></section>
   <section class="video-settings-section"><h3 class="field-label">Type</h3>
    <div class="seg-tiles compact" role="group" aria-label="Type"><button type="button" data-type="do" aria-pressed="true">${I.check}<span>Do</span></button><button type="button" data-type="avoid" aria-pressed="false">${I.remove}<span>Avoid</span></button></div>
    <p class="add-rule-hint" id="ar-hint">Applied whenever it fits.</p></section>
   <section class="video-settings-section"><h3 class="field-label">Topics <span class="muted">· optional</span></h3>
    <div class="learn-focus" role="group" aria-label="Topics">${topics.map(t=>`<button type="button" data-topic="${t.id}" aria-pressed="${d.topics.has(t.id)}">${esc(t.label)}</button>`).join('')}</div></section>
  </div>`,
  foot:`<button type="button" class="btn ghost" id="ar-cancel">Cancel</button><span class="grow"></span><button type="button" class="btn primary" id="ar-save" disabled>${I.add} Add rule</button>`});
 const B=Panel.body(),t=$('#ar-text',B),save=$('#ar-save'),count=$('#ar-count',B);
 const fit=()=>{t.style.height='auto';t.style.height=Math.max(t.scrollHeight,96)+'px';count.textContent=`${t.value.length} / 1500`;save.disabled=t.value.trim().length<8;};
 const setType=v=>{d.type=v;B.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===v)));$('#ar-hint',B).textContent=v==='do'?'Applied whenever it fits.':'The studio never does this.';};
 const setTopics=()=>B.querySelectorAll('[data-topic]').forEach(b=>b.setAttribute('aria-pressed',String(d.topics.has(b.dataset.topic))));
 t.oninput=fit;
 B.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>setType(b.dataset.type));
 B.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{const id=b.dataset.topic;d.topics.has(id)?d.topics.delete(id):d.topics.add(id);setTopics();});
 B.querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>{const [,text,type,tp]=RULE_EXAMPLES[+b.dataset.ex];t.value=text;setType(type);tp.forEach(x=>{if(B.querySelector(`[data-topic="${x}"]`))d.topics.add(x);});setTopics();fit();t.focus();});
 const submit=async()=>{const text=t.value.trim();if(text.length<8)return t.focus();save.disabled=true;
  try{await api('/api/lessons',{method:'POST',body:JSON.stringify({text,topics:[...d.topics],avoid:d.type==='avoid'})});Panel.close();toast('Rule added');await App.refresh(true);}
  catch(e){save.disabled=false;toast(e.message,true);}};
 save.onclick=submit;$('#ar-cancel').onclick=()=>Panel.close();
 t.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}};
 fit();t.focus();
};
