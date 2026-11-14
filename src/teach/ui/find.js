// Find and tidy: one search over everything the studio keeps; the same video or lesson kept once;
// space the studio can make again, cleared in one confirmed step.
const Find={more:null,moreBusy:false,q:'',kind:'all',got:null,asked:null,busy:false,dups:null,dupBusy:false,space:null,spaceBusy:false,off:new Set()};
const FIND_KIND={video:'Video',scene:'Scene',lesson:'Lesson',taught:'Taught video',clip:'Your clip'};
App.nav.splice(App.nav.findIndex(n=>n[0]==='studio/gallery')+1,0,['find','Find and tidy','search','Studio']);
window.findGo=q=>{q=String(q||'').trim();Find.q=q;App.go('find',q||undefined);};
async function findRun(){const q=Find.q;if(!q){Find.got=null;Find.asked='';return;}if(Find.asked===q||Find.busy)return;
 Find.busy=true;Find.asked=q;try{Find.got=await api('/api/find?q='+encodeURIComponent(q));}catch(e){toast(e.message,true);Find.got=null;}Find.busy=false;if(App.route==='find')App.show(false);}
App.register('find',{
 title:()=>'Find and tidy',sub:()=>'',
 head:()=>({title:'Find anything, keep one of each',text:'Search your videos, scenes, lessons, taught videos and clips by what they say or how they look. Then keep one of anything you have twice, and clear space the studio can make again.'}),
 hold:()=>Find.busy||Find.dupBusy||Find.spaceBusy,
 render(el,arg){
  if(arg!==undefined&&arg!==Find.q){Find.q=arg;}
  const tq=$('#topq');if(tq&&document.activeElement!==tq)tq.value=Find.q;
  if(Find.q&&Find.asked!==Find.q)findRun();
  const g=Find.got,hits=g?(Find.kind==='all'?g.hits:g.hits.filter(h=>h.kind===Find.kind)):[];
  el.innerHTML=`<section class="card"><form class="find-box" role="search" onsubmit="event.preventDefault();findGo($('#fq').value)">${I.search}<input type="search" id="fq" dir="auto" value="${esc(Find.q)}" placeholder="For example: red title, says camera, vertical and short" aria-label="Search everything" maxlength="200" autocomplete="off"><button class="btn primary">Search</button></form>
   ${Find.busy?'<p class="muted"><span class="spin"></span> Looking through everything (the first search looks at each video once)</p>':''}
   ${g&&Find.q?`<div class="chips" role="group" aria-label="Show">${[['all','Everything',g.hits.length],...Object.entries(FIND_KIND).map(([k,l])=>[k,l,g.counts[k]||0])].filter(([k,,n])=>k==='all'||n).map(([k,l,n])=>`<button type="button" class="chip ${Find.kind===k?'on':''}" aria-pressed="${Find.kind===k}" onclick="Find.kind='${k}';App.show(false)">${l} ${n}</button>`).join('')}</div>
    ${hits.length?`<ol class="find-hits">${hits.map((h,i)=>`<li><span class="badge st">${FIND_KIND[h.kind]}</span><div><a href="${esc(h.open)}" onclick="return findOpen(${i})" dir="auto">${esc(h.title)}</a>${h.at!==undefined?` <span class="muted small">at ${fmtS(h.at)}</span>`:''}
      ${h.snippet&&h.snippet!==h.title?`<p class="small" dir="auto">${esc(h.snippet)}</p>`:''}<p class="muted small">Found ${h.why.join(', ')}</p></div></li>`).join('')}</ol>`
     :`<div class="empty small"><h3>Nothing matches "${esc(Find.q)}"</h3><p>Try fewer words, another word for the same thing, or a colour or shape (red, dark, vertical, short).</p></div>`}`:''}
  </section>
  <section class="card"><div class="teach-section-head"><h3>Help search see and hear</h3></div>
   ${Find.more?findMore(Find.more):`<p class="muted" style="margin-top:0">Search reads what each video shows once someone has said it, and what it says once its words are written.</p><button class="btn" onclick="findMoreLoad()" ${Find.moreBusy?'disabled':''}>${Find.moreBusy?'<span class="spin"></span> Checking':'Check what is missing'}</button>`}</section>
  <section class="card"><div class="teach-section-head"><h3>The same thing twice</h3>${Find.dups?`<span class="muted small">${Find.dups.videos.length+Find.dups.lessons.length} group${Find.dups.videos.length+Find.dups.lessons.length===1?'':'s'}</span>`:''}</div>
   ${Find.dups?findDups(Find.dups):`<p class="muted" style="margin-top:0">Videos exported more than once (the same file, or the same picture in another size) and lessons that say the same thing, grouped so you keep one.</p><button class="btn" onclick="findDupsLoad()" ${Find.dupBusy?'disabled':''}>${Find.dupBusy?'<span class="spin"></span> Comparing':'Look for them'}</button>`}</section>
  <section class="card"><div class="teach-section-head"><h3>Space</h3>${Find.space?`<span class="muted small">${mb(Find.space.bytes)} can be cleared</span>`:''}</div>
   ${Find.space?findSpace(Find.space):`<p class="muted" style="margin-top:0">Old previews, earlier renders and caches the studio can make again, with their size. Nothing is removed until you say so.</p><button class="btn" onclick="findSpaceLoad()" ${Find.spaceBusy?'disabled':''}>${Find.spaceBusy?'<span class="spin"></span> Measuring':'See what can be cleared'}</button>`}</section>`;
  const fq=$('#fq');if(fq&&!Find.q)fq.focus();
 }});
window.findOpen=i=>{const h=(Find.kind==='all'?Find.got.hits:Find.got.hits.filter(x=>x.kind===Find.kind))[i];
 // Lessons open on the Lessons page, filtered to that lesson.
 if(h&&h.kind==='lesson'&&window.Teach&&Teach.les){Teach.les.q=h.title;}return true;};
function findDups(d){
 if(!d.videos.length&&!d.lessons.length)return '<p class="muted" style="margin-top:0">Nothing is here twice.</p>';
 const vids=d.videos.map((g,k)=>`<div class="dup"><p class="small">${esc(g.why)}${g.saves?` Keeping one frees ${mb(g.saves)}.`:''}</p>
  ${g.items.map(x=>`<label class="dup-row"><input type="radio" name="dv${k}" value="${x.id}" ${x.id===g.keep?'checked':''}><span dir="auto"><b>${esc(x.title)}</b><span class="muted small"> ${esc(x.file)}, ${mb(x.bytes)}, ${x.id===g.keep?'suggested to keep':x.same==='identical'?'the same file':'the same picture'}${x.starred?', starred':''}${x.rating?`, rated ${x.rating==='ok'?'not bad':x.rating}`:''}${x.canDelete?'':', outside the export folder (hidden, not deleted)'}</span></span></label>`).join('')}
  <button class="btn small" onclick="findKeep('videos',${k})">Keep the chosen one</button></div>`).join('');
 const less=d.lessons.map((g,k)=>`<div class="dup"><p class="small">${esc(g.why)}</p>
  ${g.items.map(x=>`<label class="dup-row"><input type="radio" name="dl${k}" value="${esc(x.id)}" ${x.id===g.keep?'checked':''}><span dir="auto"><b>${esc(x.title)}</b><span class="muted small"> ${esc(x.status)}${x.wins?`, worked ${x.wins}×`:''}${x.similarity<1?`, ${Math.round(x.similarity*100)}% alike`:''}</span><span class="small find-body">${esc(x.body.slice(0,180))}</span></span></label>`).join('')}
  <button class="btn small" onclick="findKeep('lessons',${k})">Keep the chosen one</button></div>`).join('');
 return `${d.videos.length?`<h4>Videos</h4>${vids}`:''}${d.lessons.length?`<h4>Lessons</h4>${less}`:''}`;
}
window.findDupsLoad=async()=>{Find.dupBusy=true;App.show(false);try{Find.dups=await api('/api/tidy/duplicates');}catch(e){toast(e.message,true);}Find.dupBusy=false;App.show(false);};
window.findKeep=async(group,k)=>{const g=Find.dups[group][k],keep=document.querySelector(`[name="${group==='videos'?'dv':'dl'}${k}"]:checked`)?.value||g.keep,others=g.items.filter(x=>x.id!==keep);
 const ok=group==='videos'
  ?await ask('Keep one of these videos?',`${others.filter(x=>x.canDelete).length?`${others.filter(x=>x.canDelete).length} file${others.filter(x=>x.canDelete).length>1?'s are':' is'} deleted from your computer (${mb(others.filter(x=>x.canDelete).reduce((t,x)=>t+x.bytes,0))}). This cannot be undone.`:''}${others.some(x=>!x.canDelete)?' Files outside the export folder are only hidden.':''}`,'Keep one',true)
  :await ask('Keep one of these lessons?',`The other ${others.length===1?'one is':others.length+' are'} retired: no longer used. You can undo this on the History page.`,'Keep one');
 if(!ok)return;
 try{await api('/api/tidy/keep',{method:'POST',body:JSON.stringify({group,keep,others:others.map(x=>x.id)})});Find.dups[group].splice(k,1);toast(group==='videos'?'Kept one video':'Kept one lesson');App.show(false);}catch(e){toast(e.message,true);}};
const SPACE_LABEL={preview:'Old previews','earlier-render':'Earlier renders','render-cache':'Render caches','work-cache':'Work files','broll-copies':'B-roll copies'};
function findSpace(s){
 if(!s.items.length)return `<p class="muted" style="margin-top:0">Nothing to clear. ${esc(s.never)}</p>`;
 const kept=s.items.filter(i=>!Find.off.has(i.id)),bytes=kept.reduce((t,i)=>t+i.bytes,0);
 return `<p class="muted small" style="margin-top:0">${esc(s.never)}</p>${Object.entries(SPACE_LABEL).filter(([k])=>s.kinds[k].count).map(([k,l])=>`<details class="space-kind"><summary><b>${l}</b> <span class="muted small">${s.kinds[k].count}, ${mb(s.kinds[k].bytes)}</span></summary>
  ${s.items.filter(i=>i.kind===k).map(i=>`<label class="dup-row"><input type="checkbox" ${Find.off.has(i.id)?'':'checked'} onchange="Find.off[this.checked?'delete':'add']('${i.id}');App.show(false)"><span><span class="small" style="overflow-wrap:anywhere">${esc(i.path)}</span> <span class="muted small">${mb(i.bytes)}, ${esc(i.why)}</span></span></label>`).join('')}</details>`).join('')}
  <div class="row" style="margin-top:12px"><button class="btn primary" ${kept.length?'':'disabled'} onclick="findClear()">Clear ${kept.length} (${mb(bytes)})</button><button class="btn ghost" onclick="findSpaceLoad()">Measure again</button></div>`;
}
window.findSpaceLoad=async()=>{Find.spaceBusy=true;App.show(false);try{Find.space=await api('/api/tidy/storage');Find.off=new Set();}catch(e){toast(e.message,true);}Find.spaceBusy=false;App.show(false);};
window.findClear=async()=>{const s=Find.space,kept=s.items.filter(i=>!Find.off.has(i.id));
 if(!await ask(`Clear ${mb(kept.reduce((t,i)=>t+i.bytes,0))}?`,`${kept.length} item${kept.length>1?'s are':' is'} removed from your computer. This cannot be undone; the studio makes them again when it needs them.`,'Clear them',true))return;
 try{const r=await api('/api/tidy/clear',{method:'POST',body:JSON.stringify({token:s.token,only:Find.off.size?kept.map(i=>i.id):undefined})});toast(`Cleared ${mb(r.bytes)}`);await findSpaceLoad();}
 catch(e){toast(e.message,true);await findSpaceLoad();}};
function findMore(m){const L=m.listen,money=n=>n<.01?'less than $0.01':'$'+n.toFixed(2);
 return `<p style="margin-top:0"><b>${m.unseen} video${m.unseen===1?'':'s'}</b> ${m.unseen===1?'has':'have'} no words for what ${m.unseen===1?'it shows':'they show'}. ${m.unseen?'Say it on each video in the Gallery (What it shows), or ask your agent: “Describe my videos for search”. It looks at a sheet of frames from each.':''}</p>
  <p><b>${L.videos} video${L.videos===1?'':'s'}</b> with sound ${L.videos===1?'has':'have'} no written words${L.videos?` (${L.minutes} min). ElevenLabs can write them for ${L.usd<.01?'':'about '}${money(L.usd)}.`:'.'}</p>
  ${L.videos?`${!L.verdict.ok&&!L.verdict.ask?`<p class="err small">${esc(L.verdict.why)}</p>`:`<button class="btn" onclick="findListen(${L.verdict.ask?'true':'false'})" ${Find.moreBusy?'disabled':''}>${Find.moreBusy?'<span class="spin"></span> Writing the words':`Write their words (${money(L.usd)})`}</button>`}`:''}`;}
window.findMoreLoad=async()=>{Find.moreBusy=true;App.show(false);try{const [u,l]=await Promise.all([api('/api/find/unseen-count'),api('/api/find/listen')]);Find.more={unseen:u.count,listen:l};}catch(e){toast(e.message,true);}Find.moreBusy=false;App.show(false);};
window.findListen=async ask=>{const L=Find.more.listen;
 if(!await ask_(ask))return;
 Find.moreBusy=true;App.show(false);try{const r=await api('/api/find/listen',{method:'POST',body:JSON.stringify({approved:true})});toast(`Wrote the words of ${r.done} video${r.done===1?'':'s'}${r.failed?.length?`; ${r.failed.length} failed`:''}`);Find.asked=null;}catch(e){toast(e.message,true);}Find.moreBusy=false;await findMoreLoad();
 function ask_(over){return window.ask(`Write the words of ${L.videos} video${L.videos===1?'':'s'}?`,`ElevenLabs writes what is said in ${L.minutes} minutes of video, for about $${L.usd.toFixed(2)}${over?' (more than the amount you are asked about first)':''}. It is recorded against your daily budget.`,'Write them');}};
