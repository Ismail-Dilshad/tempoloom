'use strict';
// Editor, the properties panel: every tab of the selected clip (basic, adjust, colour, effects, mask, animation, audio, speed, text), a transition, or the project.
// Loaded after editor-ui.js (see index.html); adds drawProps to Ed.
Object.assign(Ed,{
 drawProps(){
  const el=this.dom.props;if(!el)return;const [W,H]=this.base(),n=this.sels.size;
  // A transition between two clips.
  if(this.junction&&this.clip(this.junction)){const c=this.clip(this.junction),tr=c.trans;
   el.innerHTML=`<nav class="ed-ptabs" role="tablist"><button type="button" role="tab" aria-selected="true">Transition</button>${tr?`<span class="grow"></span><button type="button" class="iconbtn sm" data-remove aria-label="Remove transition" data-tooltip="Remove">${I.trash}</button>`:''}</nav>
    <div class="ed-pbody"><div class="ed-filters trans">${[['none','None'],...(this.kindOf(c)==='audio'?ED_ATRANS:ED_TRANS)].map(([id,l])=>`<button type="button" class="ed-filter" data-tr="${id}" aria-pressed="${(tr?.type||'none')===id}"><span class="ed-trans-swatch t-${id}"></span><span>${l}</span></button>`).join('')}</div>
    ${tr?`<section class="ed-sec"><div class="ed-row"><label for="ed-trd">Length</label><div class="ed-ctl"><input type="range" id="ed-trd" min=".2" max="2" step=".1" value="${tr.dur}"><span class="ed-num"><b data-trd>${tr.dur.toFixed(1)}</b><i>s</i></span></div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-tr-all>${I.layers} Use on every cut</button></div></div></section>`:''}</div>`;
   el.querySelectorAll('[data-tr]').forEach(b=>b.onclick=()=>{this.setTrans(c,b.dataset.tr);this.selectJoin(c.id);});
   const d=$('#ed-trd',el);if(d){d.onpointerdown=d.onfocus=()=>{if(!d._s){this.snapshot();d._s=true;}};d.oninput=()=>{c.trans.dur=Number(d.value);$('[data-trd]',el).textContent=c.trans.dur.toFixed(1);this.draw();};d.onchange=()=>{d._s=false;this.save();};}
   const all=$('[data-tr-all]',el);if(all)all.onclick=()=>{this.transAll(tr.type,tr.dur,this.kindOf(c));toast('Used on every cut');this.selectJoin(c.id);};
   const rm=$('[data-remove]',el);if(rm)rm.onclick=()=>{this.setTrans(c,'none');this.selectJoin(c.id);};return;}
  const c=this.sel&&this.clip(this.sel),m=c&&this.mediaOf(c);
  if(n>1){el.innerHTML=`<nav class="ed-ptabs" role="tablist"><button type="button" role="tab" aria-selected="true">${n} clips</button><span class="grow"></span><button type="button" class="iconbtn sm" data-remove aria-label="Delete clips" data-tooltip="Delete">${I.trash}</button></nav>
   <div class="ed-pbody"><div class="ed-multi"><span class="ed-multi-icon">${I.layers}</span><b>${n} clips selected</b><div class="ed-multi-actions"><button type="button" class="btn small" data-act="dup">${I.copy} Duplicate</button><button type="button" class="btn small" data-act="copy">Copy</button><button type="button" class="btn small ghost danger-text" data-act="del">${I.trash} Delete</button></div><small>Drag any of them to move them together.</small></div></div>`;
   el.querySelector('[data-remove]').onclick=el.querySelector('[data-act=del]').onclick=()=>this.remove();el.querySelector('[data-act=dup]').onclick=()=>this.duplicate();el.querySelector('[data-act=copy]').onclick=()=>this.copy();return;}
  const conv={pct:[v=>Math.round(v*100),v=>v/100],pxx:[v=>Math.round(v*W),v=>v/W],pxy:[v=>Math.round(v*H),v=>v/H],raw:[v=>Math.round(v*100)/100,v=>v]};
  const kfBtn=key=>c&&ED_KFKEYS.has(key)?`<button type="button" class="ed-kfbtn${this.kfAt(c,key)>=0?' on':''}${c.kf?.[key]?.length?' has':''}" data-kf="${key}" aria-label="Keyframe" data-tooltip="Keyframe">${I.diamond}</button>`:'';
  const cur=(key,def)=>c?(ED_KFKEYS.has(key)?this.val(c,key):(c[key]??def)):def;
  const row=(key,label,val,{min,max,step=1,unit='raw',suffix='',slider=true}={})=>{const [show]=conv[unit];
   return `<div class="ed-row"><label for="ed-${key}">${label}</label><div class="ed-ctl">${slider?`<input type="range" data-k="${key}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${show(val)}" aria-label="${label}">`:''}
    <span class="ed-num"><input type="number" id="ed-${key}" data-k="${key}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${show(val)}">${suffix?`<i>${suffix}</i>`:''}</span>${kfBtn(key)}</div></div>`;};
  const sec=(title,body,reset)=>`<section class="ed-sec"><header><h4>${title}</h4>${reset?`<button type="button" class="iconbtn sm" data-reset="${reset}" aria-label="Reset ${title}" data-tooltip="Reset">${I.refresh}</button>`:''}</header>${body}</section>`;
  const seg=(attr,list,val)=>`<div class="ed-seg">${list.map(([v,l])=>`<button type="button" data-${attr}="${v}" aria-pressed="${val===v}">${l}</button>`).join('')}</div>`;
  const kind=!c?'':c.title?'title':c.nest?'nest':c.adjustment?'adjustment':c.text!==undefined?'text':c.sticker?'sticker':this.kindOf(c)==='audio'?'audio':m?.type||'video';
  const tabs=!c?[['details','Details']]:kind==='title'?[['title','Title'],['anim','Animation'],['basic','Basic']]:kind==='text'?[['text','Text'],['anim','Animation'],['basic','Basic']]:kind==='sticker'?[['sticker','Sticker'],['anim','Animation'],['basic','Basic']]:kind==='audio'?[['audio','Audio'],['speed','Speed']]:kind==='adjustment'?[['adjust','Adjust'],['colour','Colour'],['effects','Effects'],['mask','Mask'],['basic','Basic']]:kind==='nest'?[['basic','Basic'],['adjust','Adjust'],['colour','Colour'],['effects','Effects'],['mask','Mask']]:kind==='image'?[['basic','Basic'],['adjust','Adjust'],['colour','Colour'],['effects','Effects'],['mask','Mask'],['anim','Animation']]:[['basic','Basic'],['adjust','Adjust'],['colour','Colour'],['effects','Effects'],['mask','Mask'],['anim','Animation'],['audio','Audio'],['speed','Speed']];
  if(!tabs.some(([id])=>id===this.ptab))this.ptab=tabs[0][0];
  const t=this.ptab,locked=c&&this.trackOf(c)?.locked;let body='';
  const fades=()=>sec('Fade',`${row('fadeIn','Fade in',c.fadeIn||0,{min:0,max:Math.min(5,+(c.dur/2).toFixed(1)),step:.1,suffix:'s'})}${row('fadeOut','Fade out',c.fadeOut||0,{min:0,max:Math.min(5,+(c.dur/2).toFixed(1)),step:.1,suffix:'s'})}`);
  if(!c)body=`<dl class="ed-details"><dt>Name</dt><dd dir="auto">${esc(this.p.name)}</dd><dt>Shape</dt><dd>${seg('ratio',Object.keys(ED_RATIOS).map(r=>[r,r]),this.p.ratio)}</dd>
    <dt>Resolution</dt><dd>${W} × ${H}</dd><dt>Length</dt><dd>${edFmt(this.end())}</dd><dt>Clips</dt><dd>${this.p.clips.length} on ${this.p.tracks.length} tracks</dd>
    <dt>Background</dt><dd>${seg('bgmode',[['color','Colour'],['gradient','Gradient'],['image','Picture'],['blur','Blur']],this.p.bgMode)}</dd>${this.p.bgMode==='color'||this.p.bgMode==='gradient'?`<dt></dt><dd><input type="color" data-bg value="${esc(this.p.bg||'#000000')}" aria-label="Background colour">${this.p.bgMode==='gradient'?` <input type="color" data-bg2 value="${esc(this.p.bg2||'#3a1c71')}" aria-label="Second background colour">`:''}</dd>`:''}${this.p.bgMode==='image'?`<dt></dt><dd><select data-bgimg aria-label="Background picture"><option value="">Choose a photo from Media…</option>${this.media.filter(m=>m.type==='image').map(m=>`<option value="${esc(m.id)}" ${this.p.bgImage===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></dd>`:''}
    <dt>Proxies</dt><dd>${this.media.some(m=>m.proxy)?`<label class="ed-xopt"><input type="checkbox" data-useproxy ${this.p.useProxy===false?'':'checked'}> Play with proxies</label>`:''}${this.p.clips.some(c=>{const m=this.mediaOf(c);return m&&m.type==='video'&&!m.proxy&&Math.max(m.w||0,m.h||0)>1280;})?` <button type="button" class="ed-link" data-proxies>Make proxies for big videos</button>`:this.media.some(m=>m.proxy)?'':'None needed'}</dd>
    <dt>Markers</dt><dd>${this.p.markers.length?`${this.p.markers.length} · <button type="button" class="ed-link" data-clear-markers>Clear</button>`:'Press M to add one'}</dd></dl>
    ${this.p.markers.length?`<div class="ed-mlist">${this.p.markers.map((m,i)=>`<button type="button" class="ed-mrow" data-mgo="${i}"><i class="ed-swatch" style="background:${m.color?edLabel(m.color):'var(--warn)'}"></i><span>${edFmt(edMt(m))}</span><b dir="auto">${esc(m.name||'Marker')}</b>${m.note?`<small dir="auto">${esc(m.note)}</small>`:''}</button>`).join('')}</div>`:''}`;
  else if(t==='text')body=(c.words?sec('Caption',`<div class="ed-seg wrap">${ED_CAPS.map(([v,l])=>`<button type="button" data-caplook="${v}" aria-pressed="${(c.capLook||'clean')===v}">${l}</button>`).join('')}</div>
     ${c.capStyle==='karaoke'||c.capStyle==='build'?`<div class="ed-row"><label>Highlight</label><div class="ed-ctl"><input type="color" data-k="hl" value="${esc(c.hl||'#FFD400')}" aria-label="Highlight colour"></div></div>`:''}
     ${c.words.some(w=>w.alt)?`<div class="ed-checks"><b>${I.flag} Check these words</b>${c.words.map((w,i)=>w.alt?`<div class="ed-check"><span class="ed-check-words"><bdi>${esc(c.words.slice(i,i+(w.altSpan||1)).map(x=>x.t).join(' '))}</bdi><i>other model heard</i><bdi>${esc(w.alt)}</bdi></span><span class="ed-check-btns"><button type="button" class="btn small" data-alt="${i}">Use</button><button type="button" class="btn small ghost" data-keep="${i}">Keep</button></span></div>`:'').join('')}</div>`:''}
     <div class="ed-row"><label>Capitals</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="upper" ${c.upper?'checked':''} aria-label="Capitals"></div></div>
     <div class="ed-row"><label>Language</label><div class="ed-ctl"><span class="ed-val" dir="auto">${esc(edLangName(c.lang||'auto'))}</span></div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-cap-all>${I.layers} Use this look on every caption</button></div></div>`):'')+(c.words?'':sec('Text effects',`<div class="ed-row"><label for="ed-grad">Gradient</label><div class="ed-ctl"><input type="checkbox" id="ed-grad" data-k="grad" ${c.grad?'checked':''}><input type="color" data-k="color2" value="${esc(c.color2||'#ffb000')}" aria-label="Second colour"></div></div>
     ${row('glow','Glow',c.glow||0,{min:0,max:100})}<div class="ed-row"><label>Glow colour</label><div class="ed-ctl"><input type="color" data-k="glowColor" value="${esc(c.glowColor||c.color||'#ffffff')}" aria-label="Glow colour"></div></div>
     ${row('depth','3D depth',c.depth||0,{min:0,max:20,suffix:'px'})}<div class="ed-row"><label>Depth colour</label><div class="ed-ctl"><input type="color" data-k="depthColor" value="${esc(c.depthColor||'#000000')}" aria-label="Depth colour"></div></div>
     ${row('curve','Curve',c.curve||0,{min:-100,max:100})}<div class="ed-row"><label for="ed-bubble">Speech bubble</label><div class="ed-ctl"><input type="checkbox" id="ed-bubble" data-k="bubble" ${c.bubble?'checked':''}></div></div>`,'textfx'))+
    sec('Text',`<textarea data-k="text" rows="3" dir="auto" aria-label="Text">${esc(c.text||'')}</textarea>${c.words?'':`<div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-tpl-save>${I.add} Save style as a template</button></div></div>`}`)+
    sec('Style',`<div class="ed-row"><label>Font</label><div class="ed-ctl"><select data-k="font" aria-label="Font">${ED_FONTS.map(([f,l])=>`<option value="${esc(f)}" ${c.font===f?'selected':''}>${l}</option>`).join('')}</select></div></div>
     ${row('size','Size',c.size||40,{min:12,max:200})}${row('weight','Weight',c.weight||600,{min:300,max:900,step:100})}${row('spacing','Letter spacing',c.spacing||0,{min:-5,max:30})}${row('lineH','Line spacing',c.lineH||1.25,{min:80,max:250,step:5,unit:'pct',suffix:'%'})}
     <div class="ed-row"><label>Colour</label><div class="ed-ctl"><input type="color" data-k="color" value="${esc(c.color||'#ffffff')}" aria-label="Colour"></div></div>
     <div class="ed-row"><label>Align</label><div class="ed-ctl">${seg('align',[['left','Left'],['center','Center'],['right','Right']],c.align||'center')}</div></div>`)+
    sec('Outline and shadow',`${row('stroke','Outline',c.stroke||0,{min:0,max:12})}<div class="ed-row"><label>Outline colour</label><div class="ed-ctl"><input type="color" data-k="strokeColor" value="${esc(c.strokeColor||'#000000')}" aria-label="Outline colour"></div></div>
     <div class="ed-row"><label>Shadow</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="shadow" ${c.shadow?'checked':''} aria-label="Shadow"></div></div>
     <div class="ed-row"><label>Background</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="box" ${c.box?'checked':''} aria-label="Background box">${c.box?`<input type="color" data-k="boxColor" value="${esc(c.boxColor||'#000000')}" aria-label="Box colour">`:''}</div></div>`);
  else if(t==='sticker')body=c.sticker.type==='shape'?sec('Colour',`<div class="ed-row"><label>Fill</label><div class="ed-ctl"><input type="color" data-k="color" value="${esc(c.color||'#ffd23f')}" aria-label="Fill colour"></div></div>`)+sec('Shape',`<div class="ed-stickers small">${ED_SHAPES.map(([s,l])=>`<button type="button" class="ed-sticker" data-reshape="${s}" aria-pressed="${c.sticker.shape===s}" title="${l}"><svg viewBox="0 0 40 40">${edShapeSvg(s)}</svg></button>`).join('')}</div>`)
    :sec('Emoji',`<div class="ed-stickers small">${ED_EMOJI.map(e=>`<button type="button" class="ed-sticker emoji" data-reemoji="${e}" aria-pressed="${c.sticker.emoji===e}">${e}</button>`).join('')}</div>`);
  else if(t==='anim'){const AN=c.text!==undefined?ED_ANIMS:ED_CLIP_ANIMS;body=sec('In',seg('animIn',AN,c.animIn||'none'))+sec('Out',seg('animOut',AN.filter(a=>a[0]!=='type'&&a[0]!=='words'),c.animOut||'none'))+sec('Speed',row('animDur','Length',c.animDur||.5,{min:.1,max:2,step:.1,suffix:'s'}));}
  else if(t==='basic'){const cr=c.crop||{},media=kind!=='text'&&kind!=='sticker';
   body=sec('Transform',`${kind!=='text'?row('scale','Scale',cur('scale'),{min:10,max:300,unit:'pct',suffix:'%'}):row('scale','Scale',cur('scale'),{min:20,max:300,unit:'pct',suffix:'%'})}
     <div class="ed-row"><label>Position</label><div class="ed-ctl two"><span class="ed-num"><b>X</b><input type="number" data-k="x" data-u="pxx" step="1" value="${Math.round(cur('x')*W)}" aria-label="Position X"></span><span class="ed-num"><b>Y</b><input type="number" data-k="y" data-u="pxy" step="1" value="${Math.round(cur('y')*H)}" aria-label="Position Y"></span>${kfBtn('x')}</div></div>
     ${row('rotate','Rotate',cur('rotate'),{min:-180,max:180,suffix:'°',slider:false})}
     ${media?`<div class="ed-row"><label>Flip</label><div class="ed-ctl"><button type="button" class="ed-tool" data-flip="flipH" aria-pressed="${!!c.flipH}">${I.flipH} Mirror</button><button type="button" class="ed-tool" data-flip="flipV" aria-pressed="${!!c.flipV}">${I.flipV} Flip</button></div></div>`:''}`,'transform')+
    (media?sec('Crop',`${['l','t','r','b'].map(s=>row('crop'+s,{l:'Left',t:'Top',r:'Right',b:'Bottom'}[s],cr[s]||0,{min:0,max:45,unit:'pct',suffix:'%'})).join('')}`,'crop'):'')+
    (media&&c.media?sec('Smart tools',this.toolJobs[c.id]?`<div class="ed-note"><span class="spin"></span> ${esc(this.toolJobs[c.id].label)}…${this.toolJobs[c.id].progress!=null?` ${Math.round(this.toolJobs[c.id].progress*100)}%`:''}<br><small>${esc(this.toolJobs[c.id].note||'Working on this computer; you can keep editing.')}</small></div>`:
     `<div class="ed-tools-row">${m?.type==='video'?`<button type="button" class="ed-tool" data-tool="stabilize">${I.wand} Stabilise</button>`:''}<button type="button" class="ed-tool" data-tool="cutout">${I.image} Remove background</button>${m?.type==='video'?`<button type="button" class="ed-tool" data-reverse>${I.undo} Reverse</button>`:''}${this.trackOf(c)&&!this.trackOf(c).main?`<button type="button" class="ed-tool" data-trackmo>${I.flag} Track motion</button>`:''}${m?.type==='video'?`<button type="button" class="ed-tool" data-tool="reframe">${I.crop} Auto reframe</button>`:''}</div>
     <p class="ed-hint">Stabilise steadies shaky footage. Remove background cuts out the person or object. Auto reframe fills the ${esc(this.p.ratio)} frame and follows the face.</p>`):'')+
    (!c.media&&!c.adjustment?sec('Motion tracking',this.toolJobs[c.id]?`<div class="ed-note"><span class="spin"></span> ${esc(this.toolJobs[c.id].label)}…</div>`:`<div class="ed-tools-row"><button type="button" class="ed-tool" data-trackmo>${I.flag} Track motion</button></div><p class="ed-hint">Place this over the thing to follow at the clip's start, then press: it moves with it in the video below.</p>`):'')+
    sec('Opacity and blend',row('opacity','Opacity',cur('opacity'),{min:0,max:100,unit:'pct',suffix:'%'})+`<div class="ed-row"><label for="ed-blend">Blend</label><div class="ed-ctl"><select id="ed-blend" data-k="blend" aria-label="Blend mode">${ED_BLENDS.map(([v,l])=>`<option value="${v}" ${(c.blend||'normal')===v?'selected':''}>${l}</option>`).join('')}</select></div></div>`)+(media?fades():'')+
    `<p class="ed-hint">${I.diamond} Keyframes: move the playhead, press the diamond, change the value. It animates between them.</p>`;}
  else if(t==='adjust'){const a=c.adj||{};body=sec('Filter',`<div class="ed-filters small">${ED_FILTERS.map(([id,l,f])=>`<button type="button" class="ed-filter" data-filter="${id}" aria-pressed="${JSON.stringify(a)===JSON.stringify(f)}"><span class="ed-filter-swatch" style="filter:${edCssFilter(f)}"></span><span>${l}</span></button>`).join('')}</div>`)+
    sec('Adjust',ED_ADJ.map(([k,l,mn,mx])=>row('adj_'+k,l,a[k]||0,{min:mn,max:mx})).join(''),'adjust')+
    sec('Green screen',`<div class="ed-row"><label>Remove a colour</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="key_on" ${c.key?.on?'checked':''} aria-label="Green screen"><button type="button" class="ed-tool" data-key-pick aria-pressed="${this.picking===c.id}">${I.wand} ${this.picking===c.id?'Click the picture…':'Pick from picture'}</button></div></div>
     ${c.key?.on?`<div class="ed-row"><label>Colour</label><div class="ed-ctl"><input type="color" data-k="key_color" value="${esc(c.key.color||'#00b140')}" aria-label="Key colour"></div></div>
      ${row('key_sim','Similarity',c.key.sim??25,{min:0,max:100})}${row('key_smooth','Smoothness',c.key.smooth??10,{min:0,max:100})}${row('key_spill','Spill',c.key.spill??50,{min:0,max:100})}`:''}`);}
  else if(t==='effects'){const fx=c.fx||{};
   body=sec('Effects',`<div class="ed-filters">${ED_STYLES.map(([v,l],i)=>`<button type="button" class="ed-filter" data-style="${v}" aria-pressed="${(fx.style||'none')===v}"><span class="ed-style-swatch s-${v}" style="filter:hue-rotate(${i*29}deg)"></span><span>${l}</span></button>`).join('')}</div>
     ${fx.style&&fx.style!=='none'?row('fx_amount','Amount',fx.amount??60,{min:0,max:100}):''}`)+sec('Look',`${row('fx_sharpen','Sharpen',fx.sharpen||0,{min:0,max:100})}${row('fx_glow','Glow',fx.glow||0,{min:0,max:100})}${row('fx_grain','Film grain',fx.grain||0,{min:0,max:100})}${row('fx_shake','Camera shake',fx.shake||0,{min:0,max:100})}`,'fx')+
    (kind!=='adjustment'?sec('Frame',`${row('fx_radius','Round corners',fx.radius||0,{min:0,max:100,suffix:'%'})}${row('fx_border','Border',fx.border||0,{min:0,max:20,suffix:'px'})}
     <div class="ed-row"><label>Border colour</label><div class="ed-ctl"><input type="color" data-k="fx_borderColor" value="${esc(fx.borderColor||'#ffffff')}" aria-label="Border colour"></div></div>${row('fx_shadow','Shadow',fx.shadow||0,{min:0,max:100})}
     <p class="ed-hint">Without rounded corners, the shadow follows the picture's own outline (good on cut-outs).</p>`):'');}
  else if(t==='colour'){const g=c.grade||{},ch=this.curveCh||'m',luts=this.lutList||[];
   body=sec('Colour wheels',`<div class="ed-wheels">${[['lift','Shadows'],['gamma','Midtones'],['gain','Highlights']].map(([k,l])=>`<div class="ed-wheel" data-wheel="${k}"><b>${l}</b>${edWheelSvg(g[k])}
     <input type="range" min="-100" max="100" step="1" value="${Math.round((g[k]?.l||0)*100)}" data-wl="${k}" aria-label="${l} brightness"><button type="button" class="ed-link" data-wreset="${k}">Reset</button></div>`).join('')}</div>
     <p class="ed-hint">Drag the dot towards a colour to tint that range; the slider makes it lighter or darker. Double-click a wheel to reset it.</p>`,'grade')+
    sec('Curves',`${'<div class="ed-seg">'+[['m','All'],['r','Red'],['g','Green'],['b','Blue']].map(([v,l])=>`<button type="button" data-curvech="${v}" aria-pressed="${ch===v}">${l}</button>`).join('')+'</div>'}
     <div class="ed-curve ed-gcurve">${edGradeCurveSvg(g.curves?.[ch],ch)}</div><p class="ed-hint">Click the line to add a point, drag it, double-click to remove it.</p>`)+
    (()=>{const bd=this.hslBand||'red',x=g.hsl?.[bd]||{};return sec('HSL: one colour',`<div class="ed-hsl">${ED_HSL.map(([k,l,h])=>`<button type="button" data-hsl="${k}" aria-pressed="${bd===k}" aria-label="${l}" title="${l}" style="--hc:hsl(${h} 85% 55%)"></button>`).join('')}</div>
     ${row('hsl_h','Hue',x.h||0,{min:-30,max:30,suffix:'°'})}${row('hsl_s','Saturation',x.s||0,{min:-100,max:100})}${row('hsl_l','Lightness',x.l||0,{min:-100,max:100})}
     <p class="ed-hint">Pick a colour, then shift only it: turn the sky bluer, calm a red shirt, warm the skin.</p>`,'hsl');})()+
    sec('Look (LUT)',`<div class="ed-row"><label>Look</label><div class="ed-ctl"><select data-lut aria-label="Look"><option value="">None</option>${luts.map(l=>`<option value="${l.id}" ${g.lut?.id===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div></div>
     ${g.lut?.id?row('lutmix','Intensity',g.lut.mix??1,{min:0,max:100,unit:'pct',suffix:'%'}):''}
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-lut-import>${I.upload} Import .cube</button><input type="file" accept=".cube" data-lut-file hidden></div></div>`);}
  else if(t==='title'){body=sec('Title',`<div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="btn small primary" data-title-ed>${I.text} Open the title editor</button></div></div>
     ${c.title.layers.map((l,i)=>l.type==='text'?`<div class="ed-row"><label for="ed-tl${i}">Text ${i+1}</label><div class="ed-ctl"><textarea id="ed-tl${i}" data-title-text="${i}" rows="1" dir="auto">${esc(l.text||'')}</textarea></div></div>`:'').join('')}
     <p class="ed-hint">Change the words here; move, size and add layers in the title editor (or double-click the clip).</p>`);}
  else if(t==='mask'){const mk=c.mask||{shape:'none'},sh=mk.shape||'none';
   body=sec('Shape',`<div class="ed-seg wrap">${ED_MASKS.map(([v,l])=>`<button type="button" data-mask="${v}" aria-pressed="${sh===v}">${l}</button>`).join('')}</div>`,sh!=='none'?'mask':'')+
    (sh==='none'?`<p class="ed-hint">A mask shows only part of the clip: a box, an ellipse, or one side of a line. Feather softens its edge.</p>`:
     sec('Mask',`${sh!=='linear'?row('mask_w','Width',mk.w??.8,{min:1,max:200,unit:'pct',suffix:'%'})+row('mask_h','Height',mk.h??.8,{min:1,max:200,unit:'pct',suffix:'%'}):''}
      ${row('mask_x','Position X',mk.x||0,{min:-100,max:100,unit:'pct',suffix:'%'})}${row('mask_y','Position Y',mk.y||0,{min:-100,max:100,unit:'pct',suffix:'%'})}
      ${sh==='linear'||sh==='band'?row('mask_angle','Angle',mk.angle||0,{min:-180,max:180,suffix:'°'}):''}${sh==='rect'?row('mask_round','Round corners',mk.round||0,{min:0,max:100,unit:'pct',suffix:'%'}):''}
      ${row('mask_feather','Feather',mk.feather||0,{min:0,max:200,suffix:'px'})}
      <div class="ed-row"><label>Invert</label><div class="ed-ctl"><input type="checkbox" role="switch" data-k="mask_invert" ${mk.invert?'checked':''} aria-label="Invert mask"></div></div>`));}
  else if(t==='audio'){const snd=!(kind==='video'&&c.detached),g=c.gainDb||0,lu=m?.lufs;
   const loud=sec('Loudness',`<div class="ed-row"><label>Match</label><div class="ed-ctl"><button type="button" class="ed-tool" data-loud>${I.wave} Even loudness (−14 LUFS)</button></div></div>
     <div class="ed-row"><label>Gain</label><div class="ed-ctl"><span class="ed-val">${g>0?'+':''}${g.toFixed(1)} dB${typeof lu==='number'?` · file ${lu} LUFS`:''}</span>${g?`<button type="button" class="ed-link" data-loud-reset>Reset</button>`:''}</div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-link" data-loud-all>Match every clip with sound</button></div></div>`);
   const duck=snd?sec('Ducking',`<div class="ed-row"><label>Lower under speech</label><div class="ed-ctl"><input type="checkbox" role="switch" data-duck ${c.duck?'checked':''} aria-label="Lower under speech"></div></div>
     ${c.duck?row('duckdb','Lower by',-(c.duck.db??-12),{min:3,max:30,suffix:'dB'}):''}<p class="ed-hint">${I.music} The sound goes down while someone speaks in the other clips and comes back after. Use it on music.</p>`):'';
   const af=c.afx||{};const sfx=snd?sec('Equaliser and effects',`${row('afx_low','Low (bass)',af.low||0,{min:-18,max:18,suffix:'dB'})}${row('afx_mid','Mid (voice)',af.mid||0,{min:-18,max:18,suffix:'dB'})}${row('afx_high','High (air)',af.high||0,{min:-18,max:18,suffix:'dB'})}
     ${row('afx_comp','Compressor',af.comp||0,{min:0,max:100,suffix:'%'})}${row('afx_reverb','Reverb',af.reverb||0,{min:0,max:100,suffix:'%'})}
     <div class="ed-row"><label>Voice</label><div class="ed-ctl"><div class="ed-chips">${ED_VOICES.map(([v,l])=>`<button type="button" data-voice="${v}" aria-pressed="${(af.voice||'')===v}">${l}</button>`).join('')}</div></div></div>
     ${row('afx_pitch','Pitch',af.pitch||0,{min:-12,max:12,suffix:'st'})}
     <div class="ed-row"><label>Presets</label><div class="ed-ctl"><div class="ed-chips">${[['voice','Clear voice'],['radio','Radio'],['warm','Warm'],['podcast','Podcast'],['hall','Hall'],['flat','Flat']].map(([v,l])=>`<button type="button" data-afx="${v}">${l}</button>`).join('')}</div></div></div>
     <div class="ed-row"><label></label><div class="ed-ctl"><div class="ed-tools-row"><button type="button" class="ed-tool" data-tool="voice">${I.mic} Clean voice (noise, hum)</button><button type="button" class="ed-tool" data-tool="beats">${I.flag} Beat markers</button></div></div></div>
     ${this.toolJobs[c.id]?`<div class="ed-note"><span class="spin"></span> ${esc(this.toolJobs[c.id].label)}…</div>`:''}`,'afx'):'';
   body=(kind==='video'?sec('Sound',c.detached?`<div class="ed-note">${I.detach} The sound is on its own audio track.</div>`:`${row('volume','Volume',cur('volume'),{min:0,max:200,unit:'pct',suffix:'%'})}<div class="ed-row"><label></label><div class="ed-ctl"><button type="button" class="ed-tool" data-detach>${I.detach} Detach audio</button></div></div>`)
    :sec('Volume',row('volume','Volume',cur('volume'),{min:0,max:200,unit:'pct',suffix:'%'})))+(snd?loud:'')+sfx+duck+(kind==='audio'?fades():'');}
  else if(t==='speed')body=sec('Speed',`${row('speed','Speed',c.speed||1,{min:.25,max:4,step:.05,suffix:'×'})}<div class="ed-chips">${[.5,1,1.5,2,3].map(s=>`<button type="button" data-speed="${s}" aria-pressed="${(c.speed||1)===s}">${s}×</button>`).join('')}</div>
     <div class="ed-row"><label>Length</label><div class="ed-ctl"><span class="ed-val">${edFmt(c.dur)}</span></div></div>`,'speed')+
    sec('Smooth slow motion',`<div class="ed-row"><label for="ed-fb">Frame blending</label><div class="ed-ctl"><input type="checkbox" id="ed-fb" data-k="frameBlend" ${c.frameBlend?'checked':''}></div></div><p class="ed-hint">Below 1×, mixes each frame into the next so slow motion glides instead of stepping. No AI: two frames, blended.</p>`)+
    sec('Speed curve',`<div class="ed-seg wrap">${[['none','None'],...ED_RAMPS.map(r=>[r[0],r[1]]),...(c.rampName==='custom'?[['custom','Custom']]:[])].map(([id,l])=>`<button type="button" data-ramp="${id}" aria-pressed="${(c.ramp?(c.rampName||'custom'):'none')===id}">${l}</button>`).join('')}</div>
     ${c.ramp?`<div class="ed-curve">${edCurveSvg(c.ramp)}</div><p class="ed-hint">Drag a point up for faster, down for slower. Click the line to add a point; double-click one to remove it.</p>`:'<p class="ed-hint">A curve changes the speed within the clip: fast, then slow motion, then fast. The sound keeps its pitch.</p>'}`);
  const ke=c&&(t==='basic'||t==='audio')&&c.kf?this.kfEaseAt(c):null;
  if(c?.nest?.multi&&t==='basic'){const vt=c.nest.tracks.filter(x=>x.kind==='video'),on=this.time>=c.start&&this.time<c.start+c.dur,cur=this.angleAt(c,this.time-c.start+(c.in||0));
   body=sec('Multicam',`<div class="ed-angles">${vt.map((x,i)=>`<button type="button" class="ed-angle${on&&cur===i?' on':''}" data-angle="${i}" aria-label="Angle ${i+1}${x.name?': '+esc(x.name):''}"><canvas data-angle-cv="${i}" width="192" height="108"></canvas><span>${i+1}${x.name?' · '+esc(x.name):''}</span></button>`).join('')}</div>
    <div class="ed-row"><label>Angle</label><div class="ed-ctl"><div class="ed-seg wrap">${vt.map((x,i)=>`<button type="button" data-angle="${i}" aria-pressed="${on&&cur===i}" title="${esc(x.name||'')} (key ${i+1})">${i+1}${x.name?` · ${esc(x.name)}`:''}</button>`).join('')}</div></div></div>
    <div class="ed-row"><label for="ed-mca">Sound from</label><div class="ed-ctl"><select id="ed-mca" data-mc-audio>${c.nest.tracks.map(x=>`<option value="${esc(x.id)}" ${c.nest.audio===x.id?'selected':''}>${esc(x.name||x.id)}</option>`).join('')}</select></div></div>
    <p class="ed-hint">Play and press 1–9 to cut between angles as it plays; each press is a cut from the playhead on. Double-click the clip to move an angle by hand; Break apart turns it into ordinary clips.</p>`)+body;}
  if(ke)body=sec('Keyframe at the playhead',`<div class="ed-row"><label>To the next</label><div class="ed-ctl"><div class="ed-seg wrap">${[...ED_EASES,...(Array.isArray(ke)?[['custom','Custom']]:[])].map(([v,l])=>`<button type="button" data-ease="${v}" aria-pressed="${Array.isArray(ke)?v==='custom':ke===v}">${l}</button>`).join('')}</div></div></div>
   ${ke!=='hold'?`<div class="ed-ecurve">${edEaseSvg(Array.isArray(ke)?ke:ED_EASE_BZ[ke]||ED_EASE_BZ.smooth)}</div><p class="ed-hint">Drag the two handles to shape the move to the next keyframe: steep is fast, flat is slow.</p>`:''}`)+body;
  el.innerHTML=`<nav class="ed-ptabs" role="tablist">${tabs.map(([id,l])=>`<button type="button" role="tab" aria-selected="${t===id}" data-ptab="${id}">${l}</button>`).join('')}
    ${c?`<span class="grow"></span><button type="button" class="iconbtn sm" data-remove aria-label="Delete clip" data-tooltip="Delete">${I.trash}</button>`:''}</nav><div class="ed-pbody${locked?' locked':''}">${locked?`<div class="ed-note">${I.lock} This track is locked.</div>`:''}${body}</div>`;
  el.querySelectorAll('[data-ptab]').forEach(b=>b.onclick=()=>{this.ptab=b.dataset.ptab;this.drawProps();});
  if(!c){
   el.querySelectorAll('[data-ratio]').forEach(b=>b.onclick=()=>{this.snapshot();this.p.ratio=b.dataset.ratio;this.save();this.drawProps();this.fit();this.draw();const lb=this.dom.root?.querySelector('.ed-ratio');if(lb)lb.textContent=this.p.ratio;});
   el.querySelectorAll('[data-bgmode]').forEach(b=>b.onclick=()=>{this.snapshot();this.p.bgMode=b.dataset.bgmode;this.save();this.drawProps();this.draw();});
   const bg=$('[data-bg]',el);if(bg){bg.onfocus=()=>this.snapshot();bg.oninput=()=>{this.p.bg=bg.value;this.save();this.draw();};}
   const bg2=$('[data-bg2]',el);if(bg2){bg2.onfocus=()=>this.snapshot();bg2.oninput=()=>{this.p.bg2=bg2.value;this.save();this.draw();};}
   const bgi=$('[data-bgimg]',el);if(bgi)bgi.onchange=()=>{this.snapshot();this.p.bgImage=bgi.value||undefined;this.save();this.draw();};
   el.querySelectorAll('[data-mgo]').forEach(b=>{b.onclick=()=>this.seek(edMt(this.p.markers[Number(b.dataset.mgo)]));b.ondblclick=()=>edMarkerEdit(b,Number(b.dataset.mgo));});
   const mp=$('[data-proxies]',el);if(mp)mp.onclick=()=>{mp.disabled=true;this.makeProxies();};const up=$('[data-useproxy]',el);if(up)up.onchange=()=>{this.p.useProxy=up.checked;this.resetElements();this.save();this.sync();this.draw();};
   const cm=$('[data-clear-markers]',el);if(cm)cm.onclick=()=>{this.snapshot();this.p.markers=[];this.after(true);};return;
  }
  const setSpeed=v=>{const mm=this.mediaOf(c),max=mm?.dur&&mm.type!=='image'?((mm.dur-(c.in||0))/(v*(c.ramp?edRampAvg(c.ramp):1))):Infinity;c.dur=Math.max(.1,Math.min(c.dur*(c.speed||1)/v,max));c.speed=v;};
  el.querySelectorAll('[data-k]').forEach(inp=>{
   const k=inp.dataset.k,u=inp.dataset.u||'raw';
   const snap=()=>{if(!inp._snap){this.snapshot();inp._snap=true;}};inp.addEventListener('focus',snap);inp.addEventListener('pointerdown',snap);
   inp.addEventListener('change',()=>{inp._snap=false;this.save();if(k==='text'&&c?.words?.length)this.learnFix(c);if(['speed','text','box','font'].includes(k))this.drawTimeline();if(k==='box'||k==='key_on'||k==='upper')this.drawProps();if(k==='font')document.fonts?.load(`40px "${c.font}"`).then(()=>this.draw()).catch(()=>{});this.drawTime();if(k==='speed')this.after(false);});
   inp.addEventListener('input',()=>{
    let v=inp.type==='checkbox'?inp.checked:inp.type==='range'||inp.type==='number'?Number(inp.value):inp.value;
    if(inp.type==='number'&&!Number.isFinite(v))return;
    if(u!=='raw')v=conv[u][1](v);
    if(k.startsWith('fx_')){c.fx={...(c.fx||{}),[k.slice(3)]:v};if(!Object.entries(c.fx).some(([kk,vv])=>kk!=='borderColor'&&vv))delete c.fx;}
    else if(k.startsWith('afx_')){c.afx={...(c.afx||{}),[k.slice(4)]:v};if(!Object.values(c.afx).some(Boolean))delete c.afx;}
    else if(k==='lutmix'){c.grade={...(c.grade||{}),lut:{...(c.grade?.lut||{}),mix:v}};}
    else if(k.startsWith('hsl_')){const bd=this.hslBand||'red',hs={...(c.grade?.hsl||{})};hs[bd]={...(hs[bd]||{}),[k.slice(4)]:v};if(!Object.values(hs[bd]).some(Boolean))delete hs[bd];c.grade={...(c.grade||{}),hsl:hs};if(!Object.keys(hs).length)delete c.grade.hsl;if(!edGraded(c.grade))delete c.grade;}
    else if(k==='text'&&c.words?.length){c.text=v;this.retime(c,v);}else if(k==='speed')setSpeed(v);else if(k==='duckdb'){c.duck={db:-edClamp(v,3,30)};this._dk=null;}
    else if(k.startsWith('key_'))c.key={color:'#00b140',sim:25,smooth:10,spill:50,...(c.key||{}),[k.slice(4)]:v};
    else if(k.startsWith('mask_'))c.mask={...(c.mask||{shape:'rect'}),[k.slice(5)]:v};else if(k.startsWith('crop'))c.crop={...(c.crop||{}),[k.slice(4)]:edClamp(v,0,.45)};else if(k.startsWith('adj_'))c.adj={...(c.adj||{}),[k.slice(4)]:v};
    else if(ED_KFKEYS.has(k))this.setVal(c,k,v);else c[k]=v;
    el.querySelectorAll(`[data-k="${k}"]`).forEach(o=>{if(o!==inp&&o.type!=='checkbox')o.value=conv[u][0](v);});
    if(k==='speed'||k==='text'){this.drawTimeline();this.drawTime();}
    this.sync();this.draw();});
  });
  const segs={align:'align',animIn:'animIn',animOut:'animOut'};
  for(const [attr,key] of Object.entries(segs))el.querySelectorAll(`[data-${attr}]`).forEach(b=>b.onclick=()=>{this.snapshot();c[key]=b.dataset[attr];this.save();this.drawProps();this.draw();});
  el.querySelectorAll('[data-afx]').forEach(b=>b.onclick=()=>{this.snapshot();const p={voice:{low:-4,mid:3,high:4,comp:45},radio:{low:-14,mid:6,high:-10,comp:70},warm:{low:4,mid:-1,high:-3,comp:20},podcast:{low:2,mid:2,high:3,comp:60},hall:{reverb:45},flat:null}[b.dataset.afx];if(p)c.afx={...p,...(c.afx?.voice?{voice:c.afx.voice}:{}),...(c.afx?.pitch?{pitch:c.afx.pitch}:{})};else delete c.afx;this.after(true);});
  el.querySelectorAll('[data-voice]').forEach(b=>b.onclick=()=>{this.snapshot();const v=b.dataset.voice;c.afx={...(c.afx||{})};if(v)c.afx.voice=v;else delete c.afx.voice;if(!Object.values(c.afx).some(Boolean))delete c.afx;this.after(true);});
  const rv=$('[data-reverse]',el);if(rv)rv.onclick=()=>this.reverseClip(c);el.querySelectorAll('[data-trackmo]').forEach(b=>b.onclick=()=>this.trackMotion(c));
  el.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>this.runTool(c,b.dataset.tool));
  el.querySelectorAll('[data-flip]').forEach(b=>b.onclick=()=>{this.snapshot();c[b.dataset.flip]=!c[b.dataset.flip];this.save();this.drawProps();this.draw();});
  el.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{this.snapshot();setSpeed(Number(b.dataset.speed));this.after(true);});
  el.querySelectorAll('[data-ramp]').forEach(b=>b.onclick=()=>{const id=b.dataset.ramp;if(id==='custom')return;const r=ED_RAMPS.find(x=>x[0]===id);this.setRamp(c,r?r[2].map(x=>[...x]):null);if(r)c.rampName=id;else delete c.rampName;this.save();this.drawProps();});
  const cs=$('.ed-curve svg',el);if(cs)edCurveWire(cs,c);
  el.querySelectorAll('[data-kf]').forEach(b=>b.onclick=()=>{const k=b.dataset.kf;if(k==='x'){this.toggleKf(c,'x');this.toggleKf(c,'y');this.past.splice(-1,1);}else this.toggleKf(c,k);});
  el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{this.snapshot();const a=ED_FILTERS.find(f=>f[0]===b.dataset.filter)[2];if(Object.keys(a).length)c.adj={...a};else delete c.adj;this.after(true);});
  el.querySelectorAll('[data-reshape]').forEach(b=>b.onclick=()=>{this.snapshot();c.sticker={...c.sticker,shape:b.dataset.reshape};this.after(true);});
  el.querySelectorAll('[data-reemoji]').forEach(b=>b.onclick=()=>{this.snapshot();c.sticker={...c.sticker,emoji:b.dataset.reemoji};this.after(true);});
  el.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{this.snapshot();const r=b.dataset.reset;
   if(r==='transform'){Object.assign(c,{scale:1,x:0,y:0,rotate:0,flipH:false,flipV:false});if(c.kf){for(const k of ['scale','x','y','rotate'])delete c.kf[k];}}else if(r==='crop')delete c.crop;else if(r==='mask')delete c.mask;else if(r==='afx')delete c.afx;else if(r==='fx')delete c.fx;else if(r==='grade')delete c.grade;else if(r==='adjust')delete c.adj;else setSpeed(1);this.after(true);});
  const det=$('[data-detach]',el);if(det)det.onclick=()=>this.detach(c);
  const busy=b=>{b.disabled=true;b.innerHTML='<span class="spin"></span> Measuring…';};
  const ld=$('[data-loud]',el);if(ld)ld.onclick=()=>{busy(ld);this.matchLoudness([c]).finally(()=>this.drawProps());};
  const la=$('[data-loud-all]',el);if(la)la.onclick=()=>{busy(la);this.matchLoudness(this.p.clips.filter(x=>x.media&&!(x.detached&&!x.asAudio)&&this.mediaOf(x)?.type!=='image')).finally(()=>this.drawProps());};
  const lr=$('[data-loud-reset]',el);if(lr)lr.onclick=()=>{this.snapshot();delete c.gainDb;this.after(true);};
  const dk=$('[data-duck]',el);if(dk)dk.onchange=()=>this.setDuck(c,dk.checked);
  el.querySelectorAll('[data-caplook]').forEach(b=>b.onclick=()=>{this.snapshot();this.capLook(c,b.dataset.caplook);this.after(true);});
  el.querySelectorAll('[data-alt]').forEach(b=>b.onclick=()=>this.useAlt(c,Number(b.dataset.alt)));
  el.querySelectorAll('[data-keep]').forEach(b=>b.onclick=()=>this.keepFlag(c,Number(b.dataset.keep)));
  const ca=$('[data-cap-all]',el);if(ca)ca.onclick=()=>{this.snapshot();const keys=['capLook','capStyle','font','size','weight','color','hl','stroke','strokeColor','shadow','box','boxColor','upper','align','y','animIn','animOut','animDur','spacing'];
   const all=this.p.clips.filter(x=>x!==c&&x.words?.length);for(const x of all)for(const k of keys){if(c[k]===undefined)delete x[k];else x[k]=c[k];}
   // Arabic-script captions keep a font that has every letter
   for(const x of all)if(edArabicScript(x.text)&&!edArabicScript(c.text))x.font='Vazirmatn';this.after(true);toast(`Used on ${all.length} caption${all.length===1?'':'s'}`);};
  // colour grading
  const setG=(f,snap=true)=>{if(snap)this.snapshot();c.grade={...(c.grade||{})};f(c.grade);if(!edGraded(c.grade))delete c.grade;this.save();this.draw();};
  el.querySelectorAll('[data-wheel]').forEach(w=>{const k=w.dataset.wheel,svg=w.querySelector('svg');
   const at=e=>{const r=svg.getBoundingClientRect();let x=((e.clientX-r.left)/r.width-.5)*2,y=-((e.clientY-r.top)/r.height-.5)*2;const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}return [Math.round(x*100)/100,Math.round(y*100)/100];};
   svg.onpointerdown=e=>{e.preventDefault();this.snapshot();const mv=ev=>{const [x,y]=at(ev);setG(g=>{g[k]={...(g[k]||{}),x,y};},false);svg.outerHTML;w.querySelector('svg').innerHTML=edWheelSvg(c.grade?.[k]).replace(/^<svg[^>]*>|<\/svg>$/g,'');};
    const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);this.drawProps();};mv(e);window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);};
   svg.ondblclick=()=>setG(g=>{delete g[k];});});
  el.querySelectorAll('[data-wl]').forEach(r=>{r.onpointerdown=r.onfocus=()=>{if(!r._s){this.snapshot();r._s=true;}};r.oninput=()=>setG(g=>{g[r.dataset.wl]={...(g[r.dataset.wl]||{}),l:Number(r.value)/100};},false);r.onchange=()=>{r._s=false;};});
  el.querySelectorAll('[data-wreset]').forEach(b=>b.onclick=()=>{setG(g=>{delete g[b.dataset.wreset];});this.drawProps();});
  const tle=$('[data-title-ed]',el);if(tle)tle.onclick=()=>edTitleEditor(c);
  el.querySelectorAll('[data-title-text]').forEach(x=>{x.onfocus=()=>this.snapshot();x.oninput=()=>{const l=c.title.layers[+x.dataset.titleText];if(l){l.text=x.value;this.draw();}};x.onchange=()=>{this.save();this.drawTimeline();};});
  el.querySelectorAll('[data-hsl]').forEach(b=>b.onclick=()=>{this.hslBand=b.dataset.hsl;this.drawProps();});
  el.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>{this.snapshot();const v=b.dataset.style;c.fx={...(c.fx||{})};if(v==='none'){delete c.fx.style;delete c.fx.amount;}else c.fx.style=v;if(!Object.values(c.fx).some(Boolean))delete c.fx;this.after(true);});
  el.querySelectorAll('[data-curvech]').forEach(b=>b.onclick=()=>{this.curveCh=b.dataset.curvech;this.drawProps();});
  const gc=$('.ed-gcurve svg',el);if(gc)edGradeCurveWire(gc,c,this.curveCh||'m');
  const ls=$('[data-lut]',el);if(ls){if(!this.lutList)this.loadLuts().then(()=>{if(this.ptab==='colour')this.drawProps();});
   ls.onchange=()=>{setG(g=>{if(ls.value)g.lut={id:ls.value,mix:g.lut?.mix??1};else delete g.lut;});this.drawProps();};}
  const li=$('[data-lut-import]',el),lf=$('[data-lut-file]',el);if(li&&lf){li.onclick=()=>lf.click();
   lf.onchange=async()=>{const f=lf.files[0];lf.value='';if(!f)return;try{const id=await this.importLut(f);setG(g=>{g.lut={id,mix:1};});toast('Look imported');this.drawProps();}catch(e){toast(e.message,true);}};}
  el.querySelectorAll('[data-mask]').forEach(b=>b.onclick=()=>{this.snapshot();const v=b.dataset.mask;if(v==='none')delete c.mask;else c.mask={w:.8,h:.8,x:0,y:0,feather:0,...(c.mask||{}),shape:v};this.after(true);});
  el.querySelectorAll('[data-ease]').forEach(b=>b.onclick=()=>{if(b.dataset.ease!=='custom')this.setKfEase(c,b.dataset.ease);});
  const ec=el.querySelector('.ed-ecurve');if(ec)edEaseWire(ec,c);
  el.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{if(this.time<c.start||this.time>=c.start+c.dur)this.seek(c.start);this.switchAngle(+b.dataset.angle);});
  const mca=el.querySelector('[data-mc-audio]');if(mca)mca.onchange=()=>{this.snapshot();c.nest.audio=mca.value;this.after(true);};
  const ts=$('[data-tpl-save]',el);if(ts)ts.onclick=async()=>{const n=prompt('Template name',String(c.text||'Text').slice(0,30));if(!n?.trim())return;await this.saveTemplate(c,n.trim().slice(0,40));if(this.tab==='text')this.drawLib();};
  const kp=$('[data-key-pick]',el);if(kp)kp.onclick=()=>{this.picking=this.picking===c.id?null:c.id;this.dom.frame?.classList.toggle('picking',!!this.picking);this.drawProps();this.draw();};
  $('[data-remove]',el).onclick=()=>this.remove();
 },
});
