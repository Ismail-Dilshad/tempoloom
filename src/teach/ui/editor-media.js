'use strict';
// Library content, import controls, and media processing status.
const ED_LIB=[['media','Media','film'],['audio','Audio','music'],['text','Text','text'],['stickers','Stickers','shapes'],['trans','Transitions','trans'],['captions','Captions','captions'],['filters','Filters','filter'],['adjustment','Adjustment','sliders'],['templates','Templates','layers']];
const ED_LIBRARY_ADJUSTMENTS={
 clean:['Clean plate','Empty layer',{}],
 interview:['Interview lift','Brighter faces and softer contrast',{adj:{brightness:10,contrast:-8,temperature:7}}],
 product:['Product detail','Crisp edges and fuller colour',{adj:{contrast:13,saturation:12},fx:{sharpen:24}}],
 film:['Film texture','Fine grain and softened colour',{adj:{saturation:-15,contrast:9},fx:{grain:22}}],
 focus:['Focus vignette','Darkens the outer frame',{adj:{vignette:48}}],
 blur:['Background blur','Softens all clips underneath',{adj:{blur:12}}],
 night:['Cool night','Cooler shadows and tighter contrast',{adj:{temperature:-30,contrast:20,brightness:-7}}],
};
const ED_LIBRARY_FILTERS=[['Everyday',['none','daylight','interview','product','vivid']],['Travel & outdoor',['warm','cool','golden','urban','night']],['Editorial',['bw','mono','punchmono','vintage','faded','drama']]];
const ED_LIBRARY_TRANSITIONS=[['Everyday',['dissolve','fade','white','wipe','wipeup','iris']],['Motion',['slide','push','pushright','zoom','zoomblur','whip','spin']],['Stylised',['dipwarm','blur','flash','glitch','shake']]];
const edLibraryGroup=(label,cards)=>`<section class="ed-lib-group" aria-label="${esc(label)}"><h3>${esc(label)}</h3><div class="ed-lib-presets">${cards}</div></section>`;
const edLibraryCard=(name,attributes,preview,note='')=>`<button type="button" class="ed-lib-preset" ${attributes}><span class="ed-lib-preset-art" aria-hidden="true">${preview}</span><span class="ed-lib-preset-name" dir="auto">${esc(name)}</span>${note?`<small>${esc(note)}</small>`:''}</button>`;
function edMediaPanel(){return '<section class="ed-panel ed-lib" aria-label="Media library"></section>';}

Object.assign(Ed,{
 showLibraryClip(clip,{editText=false,intro=0}={}){
  if(!clip)return;
  this.revealTimeline(clip.start,clip.track);
  if(this.playing)return;
  const outside=this.time<clip.start||this.time>=clip.start+clip.dur;
  if(intro>0||(outside&&this.kindOf(clip)!=='audio'))this.seek(clip.start+Math.min(intro,clip.dur/2));
  if(editText){
   this.ptab='text';this.drawProps();
   const input=this.dom.props.querySelector('textarea[data-k="text"]');
   input?.focus({preventScroll:true});input?.select();
  }
 },
 updateLibrarySoundButtons(){
  this.dom.lib?.querySelectorAll('[data-sfx-preview]').forEach(button=>{
   const playing=this.librarySample?.key===button.dataset.sfxPreview,pressed=String(playing);
   if(button.getAttribute('aria-pressed')!==pressed){button.setAttribute('aria-pressed',pressed);button.innerHTML=playing?I.pause:I.play;}
  });
 },
 stopLibrarySound(){
  this.librarySoundRequest=(this.librarySoundRequest||0)+1;
  const sample=this.librarySample;this.librarySample=null;
  if(sample){sample.stop();sample.disconnect();this.updateLibrarySoundButtons();}
 },
 async previewLibrarySound(key){
  const same=this.librarySample?.key===key;
  this.stopLibrarySound();if(same)return;
  const request=this.librarySoundRequest,project=this.p;
  try{
   this.audio();if(!this.ac||!this.monitorGain)throw new Error('Audio preview unavailable');
   const ready=this.ac.resume();
   const [buffer]=await Promise.all([edMakeSfx(key),ready]);
   if(request!==this.librarySoundRequest||project!==this.p||this.tab!=='audio'||!this.dom.root?.isConnected)return;
   const source=this.ac.createBufferSource(),gain=this.ac.createGain();gain.gain.value=.45;
   source.key=key;source.buffer=buffer;source.connect(gain).connect(this.monitorGain);
   source.onended=()=>{source.disconnect();gain.disconnect();if(this.librarySample===source){this.librarySample=null;this.updateLibrarySoundButtons();}};
   this.librarySample=source;source.start();this.updateLibrarySoundButtons();
  }catch{if(request===this.librarySoundRequest)toast('Could not play the sound preview.',true);}
 },
 drawLib(){
  const el=this.dom.lib;if(!el)return;
  const previousEffects=el.querySelector('.ed-audio-effects');
  const previousBody=el.querySelector('.ed-lib-body');
  const libraryScroll=previousBody?.dataset.libraryTab===this.tab?previousBody.scrollTop:0;
  if(previousEffects)this.audioEffectsOpen=previousEffects.open;
  const items=this.media;
  const libraryType=items.some(item=>item.type===this.libraryType)?this.libraryType:'all';
  const used=new Set(edAll(this.p.clips).map(clip=>clip.media));
  const tile=m=>`<div class="ed-media" draggable="true" data-mid="${m.id}" title="${esc(m.name)}">
    <div class="ed-media-thumb">${m.type==='audio'?`<span class="ed-media-wave">${I.music}</span>`:m.thumbs?.[0]?`<img src="${m.thumbs[Math.min(2,m.thumbs.length-1)]}" alt="">`:`<span class="ed-media-wave">${I[m.type==='image'?'image':'film']}</span>`}
     ${m.type!=='image'&&m.dur?`<span class="ed-media-dur">${edFmt(m.dur).slice(0,5)}</span>`:''}
     ${used.has(m.id)?'<span class="ed-media-used">Added</span>':''}
     <button type="button" class="ed-media-add" data-add="${m.id}" aria-label="Add ${esc(m.name)} to the timeline">${I.add}</button>
     ${m.type!=='audio'?`<button type="button" class="ed-media-overlay" data-overlay="${m.id}" aria-label="Add ${esc(m.name)} as overlay" data-tooltip="Add overlay at the playhead">${I.layers}</button>`:''}
     <button type="button" class="ed-media-del" data-del="${m.id}" aria-label="Remove ${esc(m.name)}">${I.x}</button></div>
    <span class="ed-media-name" dir="auto">${esc(m.name)}</span></div>`;
  const media=()=>items.length?`<div class="ed-lib-bar"><button type="button" class="btn small" data-import>${I.upload} Import media</button></div>
   ${new Set(items.map(m=>m.type)).size>1?`<div class="ed-seg ed-lib-media-types" role="group" aria-label="Media type">${[['all','All'],['video','Video'],['image','Photos'],['audio','Audio']].filter(([type])=>type==='all'||items.some(m=>m.type===type)).map(([type,label])=>`<button type="button" data-library-type="${type}" aria-pressed="${libraryType===type}">${label}</button>`).join('')}</div>`:''}
   <div class="ed-media-grid">${items.filter(m=>libraryType==='all'||m.type===libraryType).map(tile).join('')}</div>`:
   `<button type="button" class="ed-drop" data-import aria-label="Import media"><span class="ed-drop-btn">${I.upload} Import media</span><span>Drag and drop videos, photos and audio files here</span></button>`;
  const sel=this.sel&&this.clip(this.sel),visual=sel&&this.kindOf(sel)==='video'&&!this.trackOf(sel)?.locked&&this.mediaOf(sel);
  const junction=this.junction&&this.clip(this.junction),cut=junction&&this.prevOf(junction)&&!this.trackOf(junction)?.locked?junction:null;
  const cutKind=cut&&this.kindOf(cut)==='audio'?'audio':'video';
  const allCuts=this.libraryTransitionScope==='all';
  let body='';
  if(this.tab==='captions'){
   const caps=this.p.clips.some(c=>c.cap||c.words);
   const editableCaps=this.p.clips.some(c=>(c.cap||c.words)&&!this.trackOf(c)?.locked);
   const engine=this.capEngine();
   body=`<section class="ed-caption-section" aria-label="Auto captions">
    <h3>Auto captions</h3>
    <label class="ed-caption-field"><span>Language</span><select data-cap-lang aria-label="Spoken language">${ED_CAP_LANGS.map(l=>`<option value="${l}" ${(this.p.capLang||'auto')===l?'selected':''} dir="auto">${esc(edLangName(l))}</option>`).join('')}</select></label>
    <label class="ed-caption-field"><span>Recognition</span><select data-cap-engine aria-label="Speech recognition"><option value="local" ${engine==='local'?'selected':''}>On this computer</option>${this.stt?.sorani?`<option value="whisper" ${engine==='whisper'?'selected':''}>Kurdish Sorani model</option>`:''}<option value="elevenlabs" ${engine==='elevenlabs'?'selected':''}>ElevenLabs (online)</option></select></label>
    <div class="ed-caption-status" data-stt-note role="status"></div>
    ${this.stt?.sorani&&engine==='local'?`<label class="ed-caption-toggle"><span>Check Sorani words</span><input type="checkbox" role="switch" data-cap-sorani ${this.p.capSorani===false?'':'checked'}></label>`:''}
    <button type="button" class="btn small primary" data-captions>${I.captions} Generate captions</button>
    ${this.stt?.learning?`<button type="button" class="btn small" data-fixes>${I.brain} Manage corrections</button>`:''}
   </section>
   ${edLibraryGroup('Caption styles',ED_CAPS.map(([id,label])=>edLibraryCard(label,`data-caption-style="${id}" aria-pressed="${(this.p.capLook||'clean')===id}"`,`<b class="ed-cap-example ed-cap-example-${id}">Read <em>along</em></b>`)).join(''))}
   ${editableCaps?`<button type="button" class="btn small" data-cap-library-apply>${I.layers} Apply style to all captions</button>`:''}
   <section class="ed-caption-section" aria-label="Subtitle files">
    <h3>Subtitle files</h3>
    <div class="ed-caption-actions"><button type="button" class="btn small" data-srt-in>${I.upload} Import SRT or VTT</button><button type="button" class="btn small" data-srt-out ${caps?'':'disabled'}>${I.down} Export SRT</button></div>
    <input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" data-srt-file hidden>
   </section>`;
  }
  else if(this.tab==='text'){
   const types=ED_TEXTS.map(([label,size,weight,box],i)=>edLibraryCard(label,`data-text="${i}"`,`<b class="ed-lib-type${box?' boxed':''}" style="font-size:${Math.round(size/2.6)}px;font-weight:${weight}">Aa</b>`)).join('');
   const styles=ED_TTPL.map((t,i)=>edLibraryCard(t.name,`data-tpl="builtin:${i}"`,`<b class="ed-lib-type${t.style.box?' boxed':''}" style="color:${esc(t.style.color||'#fff')};background:${t.style.box?esc(t.style.boxColor):'none'};font-size:${Math.min(20,Math.round(t.style.size/3.6))}px;font-weight:${t.style.weight||600}">${esc(t.text)}</b>`)).join('');
   body=edLibraryGroup('Add text',types)+edLibraryGroup('Text styles',styles);
  }else if(this.tab==='templates'){
   const groups=[['Lower thirds',['Lower third','Interview ID','Name tag']],['Openers & tutorials',['Headline card','Chapter opener','Tutorial step','Location opener']],['Promos & end cards',['Product spotlight','Quote card','Subscribe button','End card']]];
   body=`<div class="ed-lib-bar"><button type="button" class="btn small" data-title="new">${I.add} New title</button></div>`+
    groups.map(([label,names])=>edLibraryGroup(label,names.map(name=>{const index=ED_TITLES.findIndex(t=>t.name===name);return edLibraryCard(name,`data-title="${index}"`,`<canvas width="240" height="135" data-title-art="${index}"></canvas>`);}).join(''))).join('')+
    edLibraryGroup('Saved text templates',(this.tpls||[]).map(t=>edLibraryCard(t.name,`data-tpl="${esc(t.id)}" title="Right-click to manage"`,I.text)).join('')||'<p class="ed-audio-empty">Save a style from a text clip’s Details panel.</p>');
  }else if(this.tab==='stickers'){
   body=['Callouts','Social','Accents'].map(group=>edLibraryGroup(group,Object.entries(ED_GRAPHICS).filter(([,art])=>art[1]===group).map(([id,art])=>edLibraryCard(art[0],`data-graphic="${id}"`,`<canvas width="120" height="84" data-graphic-art="${id}"></canvas>`)).join(''))).join('')+
    edLibraryGroup('Shapes',ED_SHAPES.map(([id,label])=>edLibraryCard(label,`data-shape="${id}"`,`<svg class="ed-lib-shape" viewBox="0 0 40 40">${edShapeSvg(id)}</svg>`)).join(''))+
    edLibraryGroup('3D models',`<button type="button" class="btn small" data-import-obj>${I.upload} Import OBJ</button><input type="file" accept=".obj" data-obj-file hidden>`);
  }else if(this.tab==='adjustment'){
   body=edLibraryGroup('Adjustment layers',Object.entries(ED_LIBRARY_ADJUSTMENTS).map(([id,[name,note]])=>edLibraryCard(name,`data-adjlayer="${id}"`,I[id==='clean'?'layers':id==='film'?'film':id==='focus'?'safe':'sliders'],note)).join(''));
  }else if(this.tab==='filters'){
   const thumbnail=visual&&(visual.thumbs?.[1]||visual.thumbs?.[0]);
   body=`${visual?'':'<p class="ed-lib-instruction">Select an unlocked video or photo to apply a filter.</p>'}`+
    ED_LIBRARY_FILTERS.map(([label,ids])=>edLibraryGroup(label,ids.map(id=>{
     const [,name,adjustments]=ED_FILTERS.find(f=>f[0]===id);
     return edLibraryCard(name,`data-filter="${id}" aria-pressed="${!!visual&&JSON.stringify(sel.adj||{})===JSON.stringify(adjustments)}" ${visual?'':'disabled'}`,`<span class="ed-lib-filter-art" style="filter:${edCssFilter(adjustments)}">${thumbnail?`<img src="${esc(thumbnail)}" alt="" loading="lazy">`:''}</span>`);
    }).join(''))).join('');
  }else if(this.tab==='trans'){
   const groups=cutKind==='audio'?[['Audio cuts',ED_ATRANS.map(([id])=>id)]]:ED_LIBRARY_TRANSITIONS;
   const cards=ids=>ids.map(id=>{const [,name]=[...ED_TRANS,...ED_ATRANS].find(t=>t[0]===id);
    return edLibraryCard(name,`data-lib-transition="${id}" ${cut||allCuts?'':'disabled'} aria-pressed="${!allCuts&&cut?.trans?.type===id}"`,`<span class="ed-trans-swatch t-${id}"></span>`);}).join('');
   body=`<div class="ed-seg ed-lib-media-types" role="group" aria-label="Transition scope"><button type="button" data-transition-scope="cut" aria-pressed="${!allCuts}">Selected cut</button><button type="button" data-transition-scope="all" aria-pressed="${allCuts}">All ${cutKind} cuts</button></div>
    ${!allCuts&&!cut?'<p class="ed-lib-instruction">Select the join between two clips to add a transition.</p>':''}`+
    groups.map(([label,ids])=>edLibraryGroup(label,cards(ids))).join('')+
    `<button type="button" class="btn small ghost" data-lib-transition="none" ${cut||allCuts?'':'disabled'}>${I.x} Remove ${allCuts?'all transitions':'transition'}</button>`;
  }
  else if(this.tab==='audio'){
   const files=items.filter(m=>m.type==='audio');
   body=`<div class="ed-audio-tools">
     <button type="button" class="btn small primary" data-import>${I.upload} Import audio</button>
     ${this.recording?`<button type="button" class="btn small ed-rec on" data-voice aria-label="Stop recording"><i class="ed-rec-dot"></i> Stop <span data-rec-time>00:00</span></button>`:`<button type="button" class="btn small" data-voice>${I.mic} Record voice-over</button>`}
    </div>
    <section class="ed-audio-files" aria-labelledby="ed-audio-files-title">
     <h3 id="ed-audio-files-title">Imported audio</h3>
     ${files.length?`<div class="ed-audio-list">${files.map(m=>`<div class="ed-media ed-audio-file" draggable="true" data-mid="${m.id}" title="${esc(m.name)}">
      <span class="ed-audio-icon">${I.music}</span><span class="ed-media-name" dir="auto">${esc(m.name)}</span>
      <span class="ed-audio-duration">${m.dur?edFmt(m.dur).slice(0,5):''}</span>
      <button type="button" class="ed-tool" data-source-audio="${m.id}" aria-label="Preview ${esc(m.name)}">${I.play}</button>
      <button type="button" class="ed-tool" data-add="${m.id}" aria-label="Add ${esc(m.name)} to the timeline">${I.add}</button>
      <button type="button" class="ed-tool" data-del="${m.id}" aria-label="Remove ${esc(m.name)}">${I.x}</button></div>`).join('')}</div>`:
      '<p class="ed-audio-empty">Drop an audio file here to import it.</p>'}
    </section>
    <details class="ed-audio-effects" ${this.audioEffectsOpen?'open':''}>
     <summary>${I.wave}<span>Sound effects</span><span class="ed-sfx-chevron">${I.chevron}</span></summary>
     <div class="ed-sfx-groups">${ED_SFX_GROUPS.map(([label,effects])=>`<section class="ed-sfx-group">
      <h3>${esc(label)}</h3>
      <ul>${effects.map(([key,name])=>`<li><button type="button" class="ed-sfx-item" data-sfx="${key}" aria-label="Add ${name}" title="Add ${name} at the playhead"><span>${name}</span>${I.add}</button><button type="button" class="iconbtn sm" data-sfx-preview="${key}" aria-label="Preview ${name}" aria-pressed="${this.librarySample?.key===key}">${this.librarySample?.key===key?I.pause:I.play}</button></li>`).join('')}</ul>
     </section>`).join('')}</div>
    </details>`;}
  else body=media();
  el.innerHTML=`<header class="ed-ph"><h2>Library</h2></header>
   <div class="ed-library-content"><nav class="ed-cats" role="tablist" aria-label="Library tools" aria-orientation="vertical">${ED_LIB.map(([id,l,ic])=>`<button type="button" role="tab" id="ed-library-${id}" aria-controls="ed-library-content" aria-selected="${this.tab===id}" tabindex="${this.tab===id?0:-1}" data-tab="${id}">${I[ic]}<span>${l}</span></button>`).join('')}</nav>
    <div class="ed-lib-body" id="ed-library-content" data-library-tab="${this.tab}" role="tabpanel" aria-labelledby="ed-library-${this.tab}">${body}</div></div>`;
  el.querySelector('.ed-lib-body').scrollTop=libraryScroll;
  el.querySelectorAll('[data-graphic-art]').forEach(cv=>edPaintGraphic(cv.getContext('2d'),cv.dataset.graphicArt,28,10,64));
  el.querySelectorAll('[data-title-art]').forEach(cv=>edDrawTitle(cv.getContext('2d'),ED_TITLES[+cv.dataset.titleArt],cv.width,cv.height,cv.height/720));
  const tabs=[...el.querySelectorAll('[data-tab]')];
  const activate=tab=>{if(tab!=='audio')this.stopLibrarySound();this.tab=tab;this.drawLib();el.querySelector('.ed-cats [aria-selected=true]')?.focus();};
  tabs.forEach((b,i)=>{
   b.onclick=()=>activate(b.dataset.tab);
   b.onkeydown=e=>{
    const next={ArrowDown:(i+1)%tabs.length,ArrowUp:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[e.key];
    if(!Number.isInteger(next))return;
    e.preventDefault();activate(tabs[next].dataset.tab);
   };
  });
  el.querySelectorAll('[data-import]').forEach(b=>b.onclick=e=>{e.preventDefault();this.dom.file.click();});
  el.querySelectorAll('[data-library-type]').forEach(b=>b.onclick=()=>{this.libraryType=b.dataset.libraryType;this.drawLib();});
  el.querySelectorAll('[data-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.showLibraryClip(this.add(b.dataset.add));if(this.tab==='media')this.drawLib();});
  el.querySelectorAll('[data-source-audio]').forEach(b=>b.onclick=()=>{this.stopLibrarySound();const media=this.media.find(item=>item.id===b.dataset.sourceAudio);if(media)edSource(media);});
  el.querySelectorAll('[data-overlay]').forEach(b=>b.onclick=e=>{
   e.stopPropagation();
   const clip=this.add(b.dataset.overlay,this.time,undefined,{overlay:true});
   if(clip)this.revealTimeline(clip.start,clip.track);
  });
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=e=>{e.stopPropagation();this.removeMedia(b.dataset.del);});
  el.querySelectorAll('[data-text]').forEach(b=>b.onclick=()=>this.showLibraryClip(this.addText(+b.dataset.text),{editText:true}));
  el.querySelectorAll('[data-title]').forEach(b=>b.onclick=()=>{
   const clip=this.addTitle(b.dataset.title==='new'?null:ED_TITLES[+b.dataset.title],false);
   const intro=Math.max(0,...clip.title.layers.filter(layer=>layer.anim&&layer.anim!=='none').map(layer=>(layer.delay||0)+.45));
   this.showLibraryClip(clip,{intro});edTitleEditor(clip);
  });
  el.querySelectorAll('[data-tpl]').forEach(b=>{const id=b.dataset.tpl,t=id.startsWith('builtin:')?ED_TTPL[+id.slice(8)]:this.tpls?.find(x=>x.id===id);if(!t)return;b.onclick=()=>{
   const clip=this.addTemplate(t),intro=clip.animIn&&clip.animIn!=='none'?(clip.animDur||.5):0;
   this.showLibraryClip(clip,{editText:true,intro});
  };
   if(!id.startsWith('builtin:'))b.oncontextmenu=e=>{e.preventDefault();edMenu(e.clientX,e.clientY,[['Delete template','trash',async()=>{if(!await ask(`Delete the template “${t.name}”?`,'Text already made with it stays.','Delete',true))return;await this.dropTemplate(id);this.drawLib();},false,true]]);};});
  const addSticker=sticker=>{const clip=this.addSticker(sticker);this.showLibraryClip(clip,{intro:clip.animDur});};
  const objFile=el.querySelector('[data-obj-file]');
  if(objFile){
   el.querySelector('[data-import-obj]').onclick=()=>objFile.click();
   objFile.onchange=async()=>{
    const file=objFile.files?.[0],project=this.p;objFile.value='';
    if(!file)return;
    try{
     if(!/\.obj$/i.test(file.name)||file.size>750_000)throw new Error('Choose an OBJ file up to 750 KB');
     const name=file.name.replace(/\.obj$/i,'').slice(0,80)||'3D model';
     const mesh=await api('/api/editor/obj',{method:'POST',body:JSON.stringify({name,obj:await file.text()})});
     if(this.p===project)addSticker(mesh);
    }catch(error){toast(error.message,true);}
   };
  }
  el.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>addSticker({type:'shape',shape:b.dataset.shape}));
  el.querySelectorAll('[data-graphic]').forEach(b=>b.onclick=()=>addSticker({type:'graphic',id:b.dataset.graphic}));
  el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{if(!visual||this.clip(sel.id)!==sel||this.trackOf(sel)?.locked)return;this.snapshot();const a=ED_FILTERS.find(f=>f[0]===b.dataset.filter)[2];if(Object.keys(a).length)sel.adj={...a};else delete sel.adj;this.after(true);});
  el.querySelectorAll('[data-transition-scope]').forEach(b=>b.onclick=()=>{this.libraryTransitionScope=b.dataset.transitionScope;this.drawLib();});
  el.querySelectorAll('[data-lib-transition]').forEach(b=>b.onclick=()=>{
   const type=b.dataset.libTransition,duration=type==='flash'?.25:type==='dissolve'||type==='crossfade'?.45:.6;
   if(allCuts)edTransitionFeedback(type,this.transAll(type,duration,cutKind));
   else if(cut&&this.junction===cut.id&&!this.trackOf(cut)?.locked)this.setTrans(cut,type,duration);
  });
  el.querySelectorAll('[data-adjlayer]').forEach(b=>b.onclick=()=>{const [name,,preset]=ED_LIBRARY_ADJUSTMENTS[b.dataset.adjlayer];this.showLibraryClip(this.addAdjustment({...preset,adjustmentName:name}));});
  const cap=$('[data-captions]',el);if(cap)cap.onclick=()=>this.captions();
  const cl=$('[data-cap-lang]',el);if(cl)cl.onchange=()=>{this.p.capLang=cl.value;this.save();};
  el.querySelectorAll('[data-caption-style]').forEach(b=>b.onclick=()=>{this.p.capLook=b.dataset.captionStyle;this.save();for(const card of el.querySelectorAll('[data-caption-style]'))card.setAttribute('aria-pressed',String(card===b));});
  const applyCaption=$('[data-cap-library-apply]',el);
  if(applyCaption)applyCaption.onclick=()=>{
   this.snapshot();
   for(const clip of this.p.clips)if((clip.cap||clip.words)&&!this.trackOf(clip)?.locked)this.capLook(clip,this.p.capLook||'clean');
   this.after(true);toast('Caption style applied');
  };
  const ce=$('[data-cap-engine]',el);if(ce){ce.onchange=()=>{this.p.capEngine=ce.value;this.save();this.drawLib();};this.drawStt();
   // what is installed can change (a model set up, the server restarted): ask again, and redraw the box if anything differs
   if(!this._sttAsking){const key=s=>JSON.stringify(s&&[s.sorani,s.elevenlabs,s.local?.models?.map(m=>m.installed),s.learning]),before=key(this.stt);this._sttAsking=true;
    this.loadStt().then(()=>{this._sttAsking=false;if((this.tab==='captions'||this.tab==='text')&&key(this.stt)!==before)this.drawLib();});}}
  const cs=$('[data-cap-sorani]',el);if(cs)cs.onchange=()=>{this.p.capSorani=cs.checked;this.save();};
  const fx=$('[data-fixes]',el);if(fx)fx.onclick=()=>edFixesDialog();
  const so=$('[data-srt-out]',el);if(so)so.onclick=()=>{const list=this.p.clips.filter(c=>c.text!==undefined&&(c.cap||c.words)).sort((a,b)=>a.start-b.start);if(!list.length)return toast('There are no captions yet.');
   edSaveFile(new Blob(['\uFEFF'+edSrt(list)],{type:'application/x-subrip;charset=utf-8'}),this.p.name+'.srt');toast(`Saved ${list.length} caption${list.length>1?'s':''} as .srt`);};
  const sf=$('[data-srt-file]',el),si=$('[data-srt-in]',el);if(si&&sf){si.onclick=()=>sf.click();
   sf.onchange=async()=>{const file=sf.files[0];sf.value='';if(!file)return;const cues=edParseSubs(await file.text());if(!cues.length)return toast('No captions were found in that file.',true);
    const lines=cues.map(q=>{const ws=edWords(q.text),d=(q.e-q.s)/Math.max(1,ws.length);return {s:q.s,e:q.e,words:ws.map((w,i)=>({t:w,s:q.s+i*d,e:q.s+(i+1)*d}))};});
    const lang=this.p.capLang&&this.p.capLang!=='auto'?this.p.capLang:'auto',n=this.addCaptions(lines,lang,this.p.capLook||'clean');this.drawLib();toast(`Imported ${n} caption${n>1?'s':''}`);};}
  const vo=$('[data-voice]',el);if(vo)vo.onclick=()=>this.recordVoice();
  el.querySelectorAll('[data-sfx-preview]').forEach(b=>b.onclick=()=>this.previewLibrarySound(b.dataset.sfxPreview));
  el.querySelectorAll('[data-sfx]').forEach(b=>b.onclick=async()=>{
   const key=b.dataset.sfx,hadFocus=document.activeElement===b;
   b.disabled=true;
   try{const clip=await this.addSfx(key);if(this.dom.root?.isConnected)this.showLibraryClip(clip);}catch{toast('Could not add the sound effect.',true);}finally{
    b.disabled=false;
    if(hadFocus&&document.activeElement===document.body)el.querySelector(`[data-sfx="${CSS.escape(key)}"]`)?.focus({preventScroll:true});
   }
  });
  el.querySelectorAll('.ed-media').forEach(t=>t.oncontextmenu=e=>{e.preventDefault();const m=this.media.find(x=>x.id===t.dataset.mid);if(!m)return;
   edMenu(e.clientX,e.clientY,[['Add to the timeline','add',()=>this.add(m.id)],['Remove from Media','trash',()=>this.removeMedia(m.id),false,true]]);});
  el.querySelectorAll('.ed-media').forEach(t=>{t.ondragstart=e=>{e.dataTransfer.setData('text/x-ed-media',t.dataset.mid);e.dataTransfer.effectAllowed='copy';};t.ondblclick=()=>{const m=this.media.find(x=>x.id===t.dataset.mid);m&&(m.type==='video'||m.type==='audio')?edSource(m):this.add(t.dataset.mid);};});
 },
 async loadVideoPeaks(media){
  this.videoPeakJobs??=new WeakSet();
  if(this.videoPeakJobs.has(media))return;
  this.videoPeakJobs.add(media);
  try{const file=await this.get(media.id);media.peaks=file?await edPeaks(file):[];}
  catch{media.peaks=[];}
  finally{this.videoPeakJobs.delete(media);}
  if(!this.media.includes(media))return;
  this.write([['meta','media',this.media]]).catch(()=>{});
  if(this.dom.root?.isConnected&&!this.exporting)this.drawTimeline();
 },
 capEngine(){const st=this.stt;return this.p.capEngine||(st&&!st.local.models.some(m=>m.installed)&&st.elevenlabs?'elevenlabs':'local');},
 async loadStt(){try{const r=await fetch(withKey('/api/editor/stt'));if(r.ok)this.stt=await r.json();}catch{}return this.stt;},
 /** The line under the engine choice: ready, set up (one download), downloading %, or add a key. */
 async drawStt(fetchFirst){
  if(fetchFirst||!this.stt)await this.loadStt();const el=this.dom.lib?.querySelector('[data-stt-note]');if(!el||!this.stt)return;
  const st=this.stt,eng=this.capEngine(),lm=st.local.models,ready=lm.find(m=>m.installed),pr=st.local.progress,busy=pr&&(pr.state==='downloading'||pr.state==='unpacking');
  const sel=this.dom.lib.querySelector('[data-cap-engine]');if(sel&&sel.value!==eng)sel.value=eng;
  if(eng==='elevenlabs')el.textContent=st.elevenlabs?'Audio is sent to ElevenLabs.':'Add an ElevenLabs key in Settings.';
  else if(eng==='whisper'||ready)el.textContent='';
  else if(busy){
   const progress=pr.total>0?` ${Math.floor(pr.bytes/pr.total*100)}%`:'';
   el.innerHTML=`<span class="spin" aria-hidden="true"></span> ${pr.state==='unpacking'?'Installing speech model.':`Downloading speech model.${progress}`}`;
  }else{
   const model=lm.find(m=>m.id===st.local.default)||lm[0];
   if(!model){el.textContent='No local speech model is available.';return;}
   el.innerHTML=`${pr?.state==='error'?`<p>${esc(pr.error||'Speech model download failed.')}</p>`:''}
    <div class="ed-caption-actions"><button type="button" class="btn small" data-stt-setup="${model.id}">${I.down} Install model (${model.mb} MB)</button>${lm.filter(m=>m.id!==model.id).map(m=>`<button type="button" class="btn small" data-stt-setup="${m.id}">Lighter model (${m.mb} MB)</button>`).join('')}</div>`;
   el.querySelectorAll('[data-stt-setup]').forEach(b=>b.onclick=async()=>{b.disabled=true;
    try{const r=await fetch(withKey('/api/editor/stt/setup?model='+b.dataset.sttSetup),{method:'POST'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not start the download');this.stt=j;}catch(e){toast(e.message,true);}
    this.drawStt();});}
  clearTimeout(this._sttT);if(busy)this._sttT=setTimeout(()=>this.drawStt(true),1500);
 },
});
