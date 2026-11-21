'use strict';
// Models and keys: connect the services the browser studio may use, pick a model for the team and
// for each role, who makes images, sound and voice, the budgets, and what may leave the computer.
// Keys are typed here once and never shown again: the page only ever sees their last 4 letters.
I.gear=ICON('<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.650 1.650 0 0 0 .330 1.820l.060.060a2 2 0 1 1-2.830 2.830l-.060-.060a1.650 1.650 0 0 0-1.820-.330 1.650 1.650 0 0 0-1 1.510V21a2 2 0 1 1-4 0v-.090A1.650 1.650 0 0 0 9 19.400a1.650 1.650 0 0 0-1.820.330l-.060.060a2 2 0 1 1-2.830-2.830l.060-.060A1.650 1.650 0 0 0 4.680 15a1.650 1.650 0 0 0-1.510-1H3a2 2 0 1 1 0-4h.090A1.650 1.650 0 0 0 4.600 9a1.650 1.650 0 0 0-.330-1.820l-.060-.060a2 2 0 1 1 2.830-2.830l.060.060A1.650 1.650 0 0 0 9 4.680a1.650 1.650 0 0 0 1-1.510V3a2 2 0 1 1 4 0v.090a1.650 1.650 0 0 0 1 1.510 1.650 1.650 0 0 0 1.820-.330l.060-.060a2 2 0 1 1 2.830 2.830l-.060.060A1.650 1.650 0 0 0 19.400 9a1.650 1.650 0 0 0 1.510 1H21a2 2 0 1 1 0 4h-.090a1.650 1.650 0 0 0-1.510 1z"/>');
I.key=ICON('<circle cx="7.500" cy="15.500" r="4.500"/><path d="M10.700 12.300 21 2M16 7l3 3M19 4l2 2"/>');
const SetUI={GROUPS:[['models','Models for the agents'],['makers','Make images, video and sound'],['voice','Voice'],['sources','Free sources'],['local','On this computer or your network']],
 CAN:{agents:'agents',vision:'see frames',images:'images',video:'video',speech:'speech'}};

const usd=n=>n==null?'':n===0?'free':'$'+(n<1?n.toFixed(2):n%1?n.toFixed(2):n);
const modelLabel=m=>`${m.name}${m.price?` (${usd(m.price.in)} in, ${usd(m.price.out)} out per 1M tokens)`:''}`;
function modelSelect(attr,list,cur,services,blank){
 const byProv=new Map();for(const m of list){if(!byProv.has(m.provider))byProv.set(m.provider,[]);byProv.get(m.provider).push(m);}
 const val=cur?cur.provider+'|'+cur.model:'';
 return `<select ${attr}><option value="">${esc(blank)}</option>${[...byProv].map(([p,ms])=>`<optgroup label="${esc(services.find(s=>s.id===p)?.name||p)}">${ms.map(m=>`<option value="${esc(m.provider+'|'+m.model)}" ${val===m.provider+'|'+m.model?'selected':''}>${esc(modelLabel(m))}</option>`).join('')}</optgroup>`).join('')}</select>`;
}
function serviceRow(s){
 const caps=s.models?Object.entries(SetUI.CAN).filter(([k])=>s.models[k]).map(([k,l])=>`${s.models[k]} ${l}`).join(', '):'';
 const status=s.error?`<span class="badge bad">not working</span>`:s.connected?`<span class="badge good">connected</span>`:'';
 return `<div class="service ${s.connected?'on':''}"><div class="service-main"><div class="row" style="gap:8px"><b>${esc(s.name)}</b>${status}${s.hint?`<span class="muted small">key ${esc(s.hint)}${s.stored==='keychain'?', in your keychain':s.stored==='env-file'?', in .env':s.stored==='environment'?', from your environment':''}</span>`:''}</div>
  <p class="muted small">${esc(s.about)}</p>
  ${s.error?`<p class="small" style="color:var(--bad)">${esc(s.error)}</p>`:''}
  ${s.connected&&(caps||s.note)?`<p class="small">${caps?esc(caps):''}${caps&&s.note?'. ':''}${s.note?esc(s.note):''}${s.checked?` <span class="muted">(checked ${ago(s.checked)})</span>`:''}</p>`:''}</div>
  <div class="row service-actions">${s.group==='local'?`<button class="btn small" onclick="setTest('${s.id}')">Test</button><button class="btn small danger-text" onclick="setRemoveLocal('${s.id}')">Remove</button>`
   :s.connected?`<button class="btn small" onclick="setTest('${s.id}')">Test</button><button class="btn small ghost" onclick="setConnect('${s.id}')">Change key</button>${s.stored!=='environment'?`<button class="btn small danger-text" onclick="setRemoveKey('${s.id}')">Remove</button>`:''}`
   :`<button class="btn small" onclick="setConnect('${s.id}')">${I.key} Connect</button>`}</div></div>`;
}

App.register('settings',{
 title:()=>'Models and keys',sub:()=>'Optional: the browser studio',
 async load(){const [o,agents,images]=await Promise.all([api('/api/settings'),api('/api/settings/models?can=agents'),api('/api/settings/models?can=images')]);return {...o,agents:agents.models,imageModels:images.models};},
 head:()=>({title:'Models and keys'}),
 render(el){
  const d=this.data,s=d.settings,svc=d.services,conn=svc.filter(x=>x.connected);
  const maker=(kind,label,can,note)=>{const ok=svc.filter(x=>x.group!=='local'&&x.connected&&can.some(c=>x.can[c]));
   return `<label class="teach-setting"><span><b>${label}</b><small class="muted">${note}</small></span><select data-maker="${kind}" aria-label="${label}"><option value="off">Off: find it or draw it with code</option>${ok.map(x=>`<option value="${x.id}" ${s.makers[kind]===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;};
  const tile=(group,v,name,about,icon,cur)=>`<button type="button" class="teach-mode" aria-pressed="${cur===v}" onclick="setPatch({${group}:'${v}'})"><span class="teach-mode-icon">${I[icon]}</span><span><b>${name}</b><small>${about}</small></span></button>`;
  el.innerHTML=`${d.warnings.length?`<div class="banner warn">${d.warnings.map(esc).join('<br>')}</div>`:''}
  ${SetUI.GROUPS.map(([g,label])=>{const list=svc.filter(x=>x.group===g);return `<section class="card"><div class="teach-section-head"><h3>${label}</h3>${list.some(x=>x.connected)?`<span class="badge good">${list.filter(x=>x.connected).length} connected</span>`:''}</div>
   ${list.map(serviceRow).join('')||'<p class="muted small">No model server added yet.</p>'}
   ${g==='local'?`<div class="row" style="margin-top:12px">${d.presets.map(p=>`<button class="btn small" onclick="setAddLocal('${esc(p.name)}','${esc(p.baseURL)}')">Add ${esc(p.name)}</button>`).join('')}<button class="btn small ghost" onclick="setAddLocal()">Another server</button></div>`:''}</section>`;}).join('')}
  <section class="card teach-settings"><div class="teach-section-head"><h3>Platforms</h3></div>
   ${[['tiktok','TikTok'],['reels','Instagram Reels'],['shorts','YouTube Shorts']].map(([id,l])=>`<label class="teach-setting"><span><b>${l}</b></span><input type="checkbox" role="switch" data-platform="${id}" ${(s.platforms||['tiktok','reels','shorts']).includes(id)?'checked':''}></label>`).join('')}</section>
`;
  el.querySelectorAll('[data-model],[data-role]').forEach(x=>x.onchange=()=>{const v=x.value?{provider:x.value.split('|')[0],model:x.value.split('|').slice(1).join('|')}:null;setPatch(x.dataset.model?{model:v,...(v?{driver:'browser'}:{})}:{roleModels:{[x.dataset.role]:v}});});
  if(s.model&&s.driver!=='browser')api('/api/settings',{method:'PATCH',body:JSON.stringify({driver:'browser'})}).catch(()=>{});
  el.querySelectorAll('[data-maker]').forEach(x=>x.onchange=()=>setPatch({makers:{[x.dataset.maker]:x.value}}));
  el.querySelectorAll('[data-platform]').forEach(x=>x.onchange=()=>{const on=[...el.querySelectorAll('[data-platform]:checked')].map(c=>c.dataset.platform);if(!on.length){x.checked=true;return toast('Keep at least one platform',true);}setPatch({platforms:on});});
 }
});
window.setPatch=patch=>act(()=>api('/api/settings',{method:'PATCH',body:JSON.stringify(patch)}),'Saved');
window.setBudget=()=>{const b={};document.querySelectorAll('[data-budget]').forEach(x=>b[x.dataset.budget]=Number(x.value));setPatch({budget:b});};
window.setTest=id=>act(async()=>{const r=await api('/api/settings/test/'+id,{method:'POST'});if(!r.ok)throw new Error(r.error);toast(`Works: ${r.count} model${r.count===1?'':'s'}${r.note?'. '+r.note:''}`);});
window.setRemoveKey=async id=>{const s=App.screens.settings.data.services.find(x=>x.id===id);if(await ask(`Remove the ${s.name} key?`,'Tempoloom stops using this service. You can connect it again any time.','Remove',true))act(()=>api('/api/settings/keys/'+id,{method:'DELETE'}),'Removed');};
window.setRemoveLocal=async id=>{if(await ask('Remove this server?','Roles that used its models go back to the main model.','Remove',true))act(()=>api('/api/settings/local/'+id,{method:'DELETE'}),'Removed');};
window.setConnect=id=>{const s=App.screens.settings.data.services.find(x=>x.id===id);
 dialog(`<form id="keyform" class="connect-card">
  <span class="connect-badge" aria-hidden="true">${I.key}</span>
  <h2>Connect ${esc(s.name)}</h2><p class="connect-sub">${esc(s.about)}</p>
  <label class="connect-field"><span class="sr-only">API key</span><input id="keyin" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your API key" required><button type="button" class="connect-eye" aria-label="Show the key" aria-pressed="false">${I.eye}</button></label>
  <p class="connect-note">${I.lock} Kept on this computer, never shown again.${s.signup?` <a href="${esc(s.signup)}" target="_blank" rel="noopener noreferrer">Get a key</a>`:''}</p>
  <div class="connect-actions"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn primary" type="submit">Connect</button></div></form>`);
 const eye=$('#keyform .connect-eye');eye.onclick=()=>{const k=$('#keyin'),show=k.type==='password';k.type=show?'text':'password';eye.setAttribute('aria-pressed',String(show));eye.setAttribute('aria-label',show?'Hide the key':'Show the key');};
 $('#keyin').focus();
 $('#modal [data-no]').onclick=()=>closeDialog();
 $('#keyform').onsubmit=async e=>{e.preventDefault();const b=$('#keyform button[type=submit]');b.disabled=true;b.innerHTML='<span class="spin"></span> Checking';
  try{const r=await api('/api/settings/keys/'+id,{method:'POST',body:JSON.stringify({key:$('#keyin').value})});closeDialog(true);
   r.test.ok?toast(`${s.name} is connected${r.test.main?`. Main model: ${r.test.main}`:''}`):toast(`Saved, but the check failed: ${r.test.error}`,true);}
  catch(err){toast(err.message,true);b.disabled=false;b.textContent='Connect';return;}
  App.refresh(true);};};
window.setAddLocal=(name,baseURL)=>{
 dialog(`<form id="localform" class="connect-card">
  <span class="connect-badge" aria-hidden="true">${I.monitor}</span>
  <h2>Add a model server</h2><p class="connect-sub">An OpenAI-compatible server on this computer or your network.</p>
  <label class="connect-field"><span class="sr-only">Name</span><input id="ln" type="text" value="${esc(name||'')}" placeholder="Name" required maxlength="60"></label>
  <label class="connect-field"><span class="sr-only">Address</span><input id="lu" type="url" value="${esc(baseURL||'http://localhost:11434/v1')}" placeholder="http://localhost:11434/v1" required></label>
  <div class="connect-actions"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn primary" type="submit">Add server</button></div></form>`);
 $('#modal [data-no]').onclick=()=>closeDialog();
 $('#localform').onsubmit=async e=>{e.preventDefault();try{const r=await api('/api/settings/local',{method:'POST',body:JSON.stringify({name:$('#ln').value,baseURL:$('#lu').value})});closeDialog(true);
  r.test.ok?toast(`${r.added.name} is connected${r.test.main?`. Main model: ${r.test.main}`:''}`):toast(`Added, but it did not answer: ${r.test.error}`,true);}catch(err){toast(err.message,true);return;}App.refresh(true);};};
