'use strict';
// Taste profile: what every new video starts from, in the Brain's design. Your notes, the rules it
// follows (switch one off, add your own), the benchmarks every preview is checked against (the
// same card as the Brain) and what you reject most. More than one profile, for a client or brand.
const Taste={pid:store.get('taste-profile','main')};
const TASTE_SRC={pattern:'From your examples',lesson:'Learned',rule:'From your ratings',you:'Added by you'};
App.register('taste',{
 title:()=>'Taste profile',
 load:async()=>{const pid=App.arg||Taste.pid;
  const b=await api('/api/taste?profile='+encodeURIComponent(pid)).catch(()=>{Taste.pid='main';store.set('taste-profile','main');return api('/api/taste');});
  // The measured examples draw each benchmark; a profile built on some videos only shows its ranges.
  b.patterns=b.videos?null:(await api('/api/state').catch(()=>null))?.patterns||null;return b;},
 hold:()=>!!document.querySelector('.bm-row.editing,#tl-notes:focus,#tl-text:focus'),
 render(el){
  const b=this.data,post=(action,extra,done)=>act(()=>api('/api/taste',{method:'POST',body:JSON.stringify({action,profile:b.id,...extra})}),done);Taste.post=post;Taste.b=b;
  const lines=b.topics.flatMap(t=>t.lines),on=lines.filter(l=>l.on).length;
  const based=b.videos?`${b.videos.length} chosen video${b.videos.length===1?'':'s'}`:`${b.basedOn.good} good example${b.basedOn.good===1?'':'s'}`;
  const line=l=>{const own=l.ref.startsWith('own-');
   return `<div class="taste-line${l.on?'':' off'}"><div class="taste-line-text"><p dir="auto">${l.avoid&&!/^(avoid|never|no |do not|don't)/i.test(l.text)?'<b class="avoid">Avoid</b> ':''}${esc(l.text)}</p>
    <div class="brain-lesson-meta"><span class="brain-from">${TASTE_SRC[l.source]||''}</span>${l.source==='you'?'':`<span class="brain-conf" title="Confidence ${l.strength}%"><i style="width:${l.strength}%"></i></span>`}</div></div>
    ${own?`<button type="button" class="iconbtn sm" aria-label="Remove this line" data-drop="${esc(l.ref)}">${I.trash}</button>`:`<input type="checkbox" role="switch" aria-label="Use this rule" ${l.on?'checked':''} data-line="${esc(l.ref)}">`}</div>`;};
  el.innerHTML=`<div class="no-head brain taste">
   <header class="brain-hero"><div><h1>${b.id==='main'?'Taste profile':esc(b.name)}</h1></div>
    <div class="brain-hero-actions">${b.profiles.length>1?`<label class="taste-switch">${I.users}<select aria-label="Profile" id="taste-pick">${b.profiles.map(p=>`<option value="${esc(p.id)}"${p.id===b.id?' selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`:''}
     <button type="button" class="btn ghost" onclick="tasteExport()">${I.down} Export</button><button type="button" class="btn primary" onclick="tasteNew()">${I.add} New profile</button></div></header>
   <div class="brain-stats">${[['Rules in use',on,`of ${lines.length}`],['Topics',b.topics.length,'with rules'],['Benchmarks',b.targets.length,'checked on each preview'],['Based on',b.videos?b.videos.length:b.basedOn.good,b.videos?'chosen videos':'good examples']].map(([l,v,s])=>`<div class="brain-stat"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('')}</div>
   <section class="brain-card"><div class="brain-card-head"><div><h2>Style notes</h2></div><span class="taste-saved" id="tl-saved" hidden>${I.check} Saved</span></div>
    <div class="add-rule-box taste-notes"><textarea id="tl-notes" dir="auto" maxlength="2000" rows="3" placeholder="For example: a calm, premium feel for a coffee brand; warm colours; never loud or salesy.">${esc(b.notes)}</textarea></div></section>
   <section class="brain-card" aria-label="Rules it follows"><div class="brain-card-head"><div><h2>Rules it follows</h2></div></div>
    <div class="taste-add"><select id="tl-topic" aria-label="Topic">${b.topicList.map(t=>`<option value="${t.id}">${esc(t.label)}</option>`).join('')}</select>
     <input type="text" id="tl-text" dir="auto" maxlength="400" placeholder="Add a line in your own words, for example: never use stock photos of people" aria-label="New line"><button type="button" class="btn primary" id="tl-add" disabled>${I.add} Add</button></div>
    ${b.topics.length?b.topics.map(t=>`<div class="taste-group"><div class="taste-group-head"><b>${esc(t.label)}</b><span>${t.lines.filter(l=>l.on).length} of ${t.lines.length} in use</span></div>${t.lines.map(line).join('')}</div>`).join('')
     :`<p class="brain-empty">No rules yet. Approve rules on the Brain, or add a line above.</p>`}</section>
   ${brainBench({taste:b,patterns:b.patterns,profile:b.id,inTaste:true})}
   ${b.rejects.length?`<section class="brain-card"><div class="brain-card-head"><div><h2>What you reject most</h2></div></div>
    <div class="taste-rejects">${b.rejects.map(r=>`<span class="brain-chip">${esc(r.reason)} <b>${r.times}×</b></span>`).join('')}</div></section>`:''}
   ${b.id!=='main'?`<section class="brain-card"><div class="brain-card-head"><div><h2>This profile</h2></div>
    <div class="brain-hero-actions"><button type="button" class="btn small ghost danger-text" onclick="tasteRemove()">${I.trash} Remove profile</button><button type="button" class="btn small" onclick="tasteVideos()">${I.film} Choose videos</button></div></div></section>`:''}
  </div>`;
  const add=$('#tl-add',el),txt=$('#tl-text',el);
  txt.oninput=()=>{add.disabled=txt.value.trim().length<8;};
  add.onclick=()=>{const text=txt.value.trim();if(text.length<8)return txt.focus();post('add',{topic:$('#tl-topic',el).value,text},'Line added');};
  txt.onkeydown=e=>{if(e.key==='Enter'&&!add.disabled)add.click();};
  const notes=$('#tl-notes',el),fit=()=>{notes.style.height='auto';notes.style.height=Math.max(notes.scrollHeight,84)+'px';};notes.oninput=fit;fit();
  notes.onchange=async()=>{try{await api('/api/taste',{method:'POST',body:JSON.stringify({action:'notes',profile:b.id,notes:notes.value})});b.notes=notes.value;const s=$('#tl-saved',el);s.hidden=false;clearTimeout(Taste.st);Taste.st=setTimeout(()=>{s.hidden=true;},2200);}catch(e){toast(e.message,true);}};
  el.querySelectorAll('[data-line]').forEach(i=>i.onchange=()=>{i.closest('.taste-line').classList.toggle('off',!i.checked);post('line',{ref:i.dataset.line,on:i.checked});});
  el.querySelectorAll('[data-drop]').forEach(x=>x.onclick=async()=>{if(await ask('Remove this line?','It leaves this profile. Your rules on the Brain stay.','Remove',true))post('drop',{id:x.dataset.drop},'Line removed');});
  const pick=$('#taste-pick',el);if(pick)pick.onchange=()=>tasteGo(pick.value);
  wireBench(el,{taste:b,patterns:b.patterns,profile:b.id});
 }});
window.tasteGo=id=>{Taste.pid=id;store.set('taste-profile',id);App.screens.taste.data=null;App.refresh(true);};
window.tasteExport=()=>{const b=Taste.b,on=l=>l.on;
 const md=`# Taste profile: ${b.name}\n\n${b.notes?b.notes+'\n\n':''}`+b.topics.map(t=>`## ${t.label}\n\n${t.lines.filter(on).map(l=>`- ${l.avoid&&!/^(avoid|never|no |do not|don't)/i.test(l.text)?'Avoid: ':''}${l.text}`).join('\n')}\n`).join('\n')+(b.targets.length?`\n## Benchmarks\n\n${b.targets.map(t=>`- ${t.label}: ${t.lo} to ${t.hi}${t.unit?' '+t.unit:''}`).join('\n')}\n`:'');
 download(`taste-${b.id}.md`,md);};
/** The videos a profile is built on, as a list to tick (none ticked: every video). */
const tasteVideoList=(b,cur)=>`<div class="taste-videos">${b.allVideos.map(v=>`<label class="taste-video"><input type="checkbox" value="${esc(v.id)}" ${cur.has(v.id)?'checked':''}><span dir="auto">${esc(v.title)}</span><span class="brain-state ${v.verdict==='good'?'kept':'trial'}">${v.verdict==='good'?'Good':'Avoid'}</span></label>`).join('')}</div>`;
/** New profile, in the side drawer: a name and, if you like, the videos it is based on. */
window.tasteNew=()=>{const b=Taste.b;
 Panel.open({id:'taste-profile',title:'New taste profile',sub:'For a client or brand of its own. Leave every video unticked to use them all.',focus:false,
  body:`<div class="video-settings"><section class="video-settings-section"><label class="field-label" for="tp-name">Name</label><input type="text" id="tp-name" maxlength="60" placeholder="For example: Hawler Roasters"></section>
   ${b.allVideos.length?`<section class="video-settings-section"><h3 class="field-label">Based on</h3>${tasteVideoList(b,new Set())}</section>`:''}</div>`,
  foot:`<button type="button" class="btn ghost" id="tp-cancel">Cancel</button><button type="button" class="btn primary" id="tp-go" disabled>${I.add} Create profile</button>`});
 const B=Panel.body(),name=$('#tp-name',B),go=$('#tp-go');name.oninput=()=>{go.disabled=!name.value.trim();};name.focus();
 $('#tp-cancel').onclick=()=>Panel.close();
 go.onclick=async()=>{go.disabled=true;try{const r=await api('/api/taste',{method:'POST',body:JSON.stringify({action:'create',name:name.value.trim(),videos:[...B.querySelectorAll('.taste-videos input:checked')].map(i=>i.value)})});Panel.close();toast('Profile created');tasteGo(r.id);}catch(e){go.disabled=false;toast(e.message,true);}};};
window.tasteVideos=()=>{const b=Taste.b;
 Panel.open({id:'taste-profile',title:'Videos this profile is based on',sub:'Leave every video unticked to use them all.',focus:false,body:`<div class="video-settings"><section class="video-settings-section">${tasteVideoList(b,new Set(b.videos||[]))}</section></div>`,
  foot:`<button type="button" class="btn ghost" id="tv-cancel">Cancel</button><button type="button" class="btn primary" id="tv-go">${I.check} Save</button>`});
 $('#tv-cancel').onclick=()=>Panel.close();
 $('#tv-go').onclick=()=>{const videos=[...Panel.body().querySelectorAll('.taste-videos input:checked')].map(i=>i.value);Panel.close();Taste.post('videos',{videos},'Saved');};};
window.tasteRemove=async()=>{if(!await ask('Remove this profile?','Its own lines and benchmarks go. Your rules and videos stay.','Remove',true))return;
 try{await api('/api/taste',{method:'POST',body:JSON.stringify({action:'remove',profile:Taste.b.id})});toast('Removed');tasteGo('main');}catch(e){toast(e.message,true);}};
