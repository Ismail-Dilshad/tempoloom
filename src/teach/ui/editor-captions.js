'use strict';
// Editor, captions: auto captions from speech (on this computer or online), caption looks with word timing, subtitle files (SRT/VTT), learning from corrections.
// Loaded after editor.js (see index.html); adds its part to Ed.
Object.assign(Ed,{
 // ---------- auto captions: the speech in each clip with sound, as caption text clips ----------
 async captions(){
  const src=this.p.clips.filter(c=>{const m=this.mediaOf(c);return m&&(m.type==='audio'||m.type==='video')&&!this.trackOf(c)?.muted&&!(c.detached&&!c.asAudio);});
  if(!src.length)return toast('Add a video or sound with speech first.');
  const busy=this.dom.lib?.querySelector('[data-captions]');if(busy){busy.disabled=true;busy.innerHTML=`<span class="spin"></span> ${this.capEngine?.()==='local'?'Listening on this computer…':'Reading the speech…'}`;}
  try{
   const words={},lang=this.p.capLang||'auto',look=this.p.capLook||'clean';let code=lang,fixed=0,flags=0;
   for(const id of new Set(src.map(c=>c.media))){const m=this.media.find(x=>x.id===id),blob=await this.get(id);if(!blob)continue;
    const r=await fetch(withKey('/api/editor/captions?name='+encodeURIComponent(m.name)+'&lang='+encodeURIComponent(lang)+'&engine='+(this.capEngine?.()==='elevenlabs'?'elevenlabs':'local')+(this.capEngine?.()==='whisper'?'&model=whisper':'')+(this.p.capSorani===false?'&sorani=0':'')),{method:'POST',body:blob});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not read the speech');
    words[id]=(j.words||[]).map(w=>({...w,aid:j.audioId}));if(lang==='auto'&&j.code)code=j.code;fixed+=j.fixed||0;flags+=j.flags||0;}
   const lines=[];
   for(const c of src){const a=c.in||0,b=this.srcAt(c,c.start+c.dur)+.05;
    const ws=(words[c.media]||[]).filter(w=>w.start>=a&&w.end<=b).map(w=>({t:w.text.trim(),s:this.tlAt(c,w.start),e:this.tlAt(c,Math.min(w.end,b)),s0:w.start,e0:w.end,aid:w.aid,...(w.alt?{alt:w.alt,altSpan:w.altSpan||1}:{})})).filter(w=>w.t);
    // A line ends at a pause, after about 3 seconds, at the end of a sentence (in any language), or when it is long.
    let cur=null;const budget=w=>edNoSpace(w)?16:42;
    for(const w of ws){const txt=cur?cur.words.map(x=>x.t).join(' '):'';
     if(cur&&(w.s-cur.e>.6||cur.e-cur.s>3.2||/[\p{Sentence_Terminal}]$/u.test(cur.words.at(-1).t)||edLen(txt+' '+w.t)>budget(txt+w.t))){lines.push(cur);cur=null;}
     if(!cur)cur={s:w.s,e:w.e,words:[]};cur.words.push(w);cur.e=w.e;}
    if(cur)lines.push(cur);}
   if(!lines.length)return toast('No speech was found.');
   // Speech models on this computer write no capitals: each caption line starts with one (in scripts that have them).
   for(const l of lines){const w=l.words[0];if(w){const loc=code&&code!=='auto'?code:undefined,f=w.t.charAt(0),F=f.toLocaleUpperCase(loc);if(F!==f)w.t=F+w.t.slice(1);}}
   const n=this.addCaptions(lines,code,look);
   toast(`Added ${n} caption${n>1?'s':''}${code&&code!=='auto'?` (${edLangName(code)})`:''}${fixed?` · ${fixed} fixed from your corrections`:''}${flags?` · ${flags} to check (marked)`:''}`);this.loadStt?.().then(()=>this.drawStt?.());
  }catch(e){toast(e.message,true);}
  finally{this.drawLib();}
 },
 // ---------- captions with word times: phrase, karaoke, one word at a time, build up ----------
 capText(c,w){return c.upper?w.toLocaleUpperCase(c.lang&&c.lang!=='auto'?c.lang:undefined):w;},
 capSep(c){return edNoSpace(c.text)?'':' ';},
 capBox(g,c,W,H,t=this.time){g.save();g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;
  const lh=(c.size||40)*this.val(c,'scale',t)*this.k()*1.25,lines=edPack(g,c.words.map(w=>this.capText(c,w.t)),this.capSep(c),W*.86),sw=g.measureText(this.capSep(c)).width;
  const w=Math.max(...lines.map(l=>l.reduce((a,x)=>a+g.measureText(x).width,0)+sw*(l.length-1)))+lh*.6,h=lines.length*lh+lh*.3;g.restore();
  return {w,h,cx:W/2+this.val(c,'x',t)*W,cy:H/2+this.val(c,'y',t)*H,ls:lines.map(l=>l.join(this.capSep(c))),lh};},
 drawCaption(g,c,W,H,t,o={}){
  const lt=t-c.start,ws=c.words,st=c.capStyle||'phrase';let cur=-1,last=-1;for(let i=0;i<ws.length;i++){if(ws[i].s<=lt)last=i;if(lt>=ws[i].s&&lt<ws[i].e)cur=i;}
  const flagged=new Set();ws.forEach((w,i)=>{if(w.alt)for(let k=0;k<(w.altSpan||1);k++)flagged.add(i+k);});
  let show=ws.map((_,i)=>i);if(st==='word')show=[cur>=0?cur:Math.max(0,last)];else if(st==='build')show=show.filter(i=>i<=last);if(!show.length)return;
  const an=this.animApply(c,t),a=this.val(c,'opacity',t)*(o.alpha??1)*an.alpha;if(a<=0)return;
  g.save();g.font=this.font(c,t);g.letterSpacing=`${(c.spacing||0)*this.k()}px`;g.textBaseline='middle';const rtl=edRtl(c.text);g.direction=rtl?'rtl':'ltr';
  const sep=this.capSep(c),sw=g.measureText(sep).width,lh=(c.size||40)*this.val(c,'scale',t)*this.k()*1.25,txt=show.map(i=>this.capText(c,ws[i].t)),wd=txt.map(x=>g.measureText(x).width);
  const rows=[];{let row=[],w=0;show.forEach((i,j)=>{const add=(row.length?sw:0)+wd[j];if(row.length&&w+add>W*.86){rows.push({js:row,w});row=[];w=0;}w+=(row.length?sw:0)+wd[j];row.push(j);});if(row.length)rows.push({js:row,w});}
  const bw=Math.max(...rows.map(r=>r.w))+lh*.6,bh=rows.length*lh+lh*.3,cx=W/2+this.val(c,'x',t)*W+(o.dx||0),cy=H/2+this.val(c,'y',t)*H+(o.dy||0)+an.dy*H;
  g.globalAlpha=a;g.translate(cx,cy);g.rotate(this.val(c,'rotate',t)*Math.PI/180);g.scale(an.k,an.k);if(an.blur)g.filter=`blur(${an.blur*this.k()}px)`;
  if(c.box){g.fillStyle=c.boxColor||'#000';g.globalAlpha=a*.72;g.beginPath();g.roundRect(-bw/2,-bh/2,bw,bh,lh*.25);g.fill();g.globalAlpha=a;}
  g.textAlign='left';// words are placed one by one; each keeps its shaping and its punctuation on the right side for its direction
  rows.forEach((r,ri)=>{const y=-bh/2+lh*.15+lh*(ri+.5);let x=c.align==='left'?-bw/2+lh*.3:c.align==='right'?bw/2-lh*.3-r.w:-r.w/2;const pos=[];
   for(const j of r.js){pos.push(x);x+=wd[j]+sw;}
   r.js.forEach((j,k)=>{const at=rtl?(pos[0]+r.w)-(pos[k]-pos[0])-wd[j]:pos[k],i=show[j],on=i===cur;
    let sc=1;if(st==='word'&&on)sc=1+.18*(1-Math.min(1,(lt-ws[i].s)/.12));
    g.save();g.translate(at+wd[j]/2,y);g.scale(sc,sc);g.textAlign='center';g.direction=rtl?'rtl':'ltr';
    if(c.shadow&&!c.box){g.shadowColor='rgba(0,0,0,.5)';g.shadowBlur=lh*.25;g.shadowOffsetY=lh*.05;}
    if(c.stroke){g.lineJoin='round';g.lineWidth=c.stroke*this.k()*2;g.strokeStyle=c.strokeColor||'#000';g.strokeText(txt[j],0,0);g.shadowColor='transparent';}
    g.fillStyle=on&&(st==='karaoke'||st==='build')?(c.hl||'#FFD400'):(c.color||'#fff');g.fillText(txt[j],0,0);
    if(!this.exporting&&flagged.has(i)){g.shadowColor='transparent';g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--warn').trim()||'orange';g.lineWidth=Math.max(2,lh*.06);g.setLineDash([lh*.08,lh*.08]);g.beginPath();g.moveTo(-wd[j]/2,lh*.42);g.lineTo(wd[j]/2,lh*.42);g.stroke();g.setLineDash([]);}
    g.restore();});});
  g.restore();
 },
 /** A caption look on one clip. */
 capLook(c,name){const base={stroke:3,strokeColor:'#000000',shadow:true,box:false,animIn:'fade',animOut:'none',animDur:.15,upper:false,capStyle:'phrase',hl:c.hl||'#FFD400',weight:Math.max(700,c.weight||700)};
  const looks={clean:{},karaoke:{capStyle:'karaoke'},word:{capStyle:'word',upper:true,weight:800,size:Math.max(c.size||34,56),animIn:'none'},build:{capStyle:'build'},boxed:{box:true,boxColor:'#000000',stroke:0,shadow:false,animIn:'slide',animDur:.2}};
  Object.assign(c,base,looks[name]||{},{capLook:name});},
 /** New text in a caption: its words keep their times when the count is the same, else share the clip's length evenly. */
 retime(c,text){const ws=edWords(text,c.lang);// a reviewed caption: its "check" marks go
  if(ws.length===c.words.length){c.words=c.words.map((w,i)=>({t:ws[i],s:w.s,e:w.e}));return;}
  const d=c.dur/Math.max(1,ws.length);c.words=ws.map((w,i)=>({t:w,s:i*d,e:(i+1)*d}));},
 /** Learns from an edited caption: the changed words are remembered for this language, and the clip is kept for training. */
 async learnFix(c){if(!c?.asr||c.asr===c.text)return;const from=c.asr,to=c.text;c.asr=to;this.save();
  try{const r=await fetch(withKey('/api/editor/caption-fixes'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lang:c.lang,from,to,audio:c.src||undefined})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not learn the change');
   if(j.learned?.length)toast(`Learned: ${j.learned.map(x=>`${x.from} → ${x.to}`).slice(0,3).join(', ')}`);if(this.stt)this.stt.learning={fixes:j.fixes,clips:j.clips};this.drawStt?.();}
  catch(e){toast(e.message,true);}},
 /** Uses the second model's words for a flagged span of a caption (and learns from it). */
 useAlt(c,i){const w=c.words[i];if(!w?.alt)return;this.snapshot();const n=w.altSpan||1,alt=edWords(w.alt,c.lang),a=w.s,b=c.words[Math.min(c.words.length-1,i+n-1)].e,step=(b-a)/Math.max(1,alt.length);
  c.words.splice(i,n,...alt.map((t,k)=>({t,s:a+k*step,e:a+(k+1)*step})));c.text=c.words.map(x=>x.t).join(edNoSpace(c.text)?'':' ');this.after(true);this.learnFix(c);},
 keepFlag(c,i){const w=c.words[i];if(!w)return;this.snapshot();delete w.alt;delete w.altSpan;this.after(true);},
 /** Timeline time where a clip shows file time `src` (inverse of srcAt; works with speed curves). */
 tlAt(c,src){let lo=c.start,hi=c.start+c.dur;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(this.srcAt(c,m)<src)lo=m;else hi=m;}return (lo+hi)/2;},
 /** Makes caption clips from lines [{s,e,words:[{t,s,e}]}] on a new text track. */
 addCaptions(lines,lang,look){
  this.snapshot();const tr=this.addTrack('text');let n=0;
  for(let i=0;i<lines.length;i++){const l=lines[i],next=lines[i+1];let e=l.e;if(next&&next.s-e<.3)e=next.s;// no flicker between close lines
   const text=l.words.map(w=>w.t).join(edNoSpace(l.words.map(w=>w.t).join(''))?'':' '),c=this.textClip(3,l.s,text);
   c.dur=Math.max(.4,e-l.s);c.track=tr.id;c.lang=lang;c.cap=true;
   c.words=l.words.map((w,k)=>({t:w.t,s:Math.max(0,w.s-l.s),e:Math.max(.05,w.e-l.s),...(w.alt?{alt:w.alt,altSpan:Math.min(w.altSpan||1,l.words.length-k)}:{})}));
   // from speech: the model's text (to learn from your changes) and where it is in the audio (for a training clip)
   const f0=l.words[0],f1=l.words[l.words.length-1];if(f0?.aid&&f0.s0!=null){c.asr=text;c.src={id:f0.aid,s:f0.s0,e:f1.e0};}
   if(edArabicScript(text))c.font='Vazirmatn';this.capLook(c,look);this.p.clips.push(c);n++;}
  this.after(true);return n;},
});
// ---------- captions helpers ----------
/** Greedy lines of words no wider than maxW (sep between words: a space, or nothing for scripts without spaces). */
function edPack(g,words,sep,maxW){const out=[];let row=[],w=0;const sw=g.measureText(sep).width;
 for(const x of words){const xw=g.measureText(x).width,add=(row.length?sw:0)+xw;if(row.length&&w+add>maxW){out.push(row);row=[];w=0;}w+=(row.length?sw:0)+xw;row.push(x);}if(row.length)out.push(row);return out.length?out:[['']];}
const ED_LANG_NAMES={ckb:'کوردی (سۆرانی)',kmr:'Kurdî (Kurmancî)',badini:'Kurdî (Badînî)'};
/** A language's name in that language (Kurdish names are written out; others come from Intl.DisplayNames). */
function edLangName(code){if(code==='auto')return 'Detect automatically';if(ED_LANG_NAMES[code])return ED_LANG_NAMES[code];
 try{const n=new Intl.DisplayNames([code],{type:'language'}).of(code);return n&&n!==code?n.charAt(0).toLocaleUpperCase(code)+n.slice(1):code;}catch{return code;}}
const edSrtTime=t=>{t=Math.max(0,t);const ms=Math.round(t*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
/** SRT text from caption clips (UTF-8, numbered, HH:MM:SS,mmm). */
function edSrt(clips){return clips.map((c,i)=>`${i+1}\n${edSrtTime(c.start)} --> ${edSrtTime(c.start+c.dur)}\n${String(c.text||'').trim()}\n`).join('\n');}
/** Cues from an SRT or WebVTT file: [{s,e,text}]. */
function edParseSubs(raw){const txt=String(raw).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'),out=[];
 const tm=x=>{const m=/(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/.exec(x);return m?(+(m[1]||0))*3600+(+m[2])*60+(+m[3])+(+m[4].padEnd(3,'0'))/1000:NaN;};
 for(const block of txt.split(/\n{2,}/)){const ls=block.split('\n'),k=ls.findIndex(l=>l.includes('-->'));if(k<0)continue;const [a,b]=ls[k].split('-->'),s=tm(a),e=tm(b);
  const text=ls.slice(k+1).join(' ').replace(/<[^>]+>/g,'').replace(/\{\\[^}]*\}/g,'').trim();if(isFinite(s)&&isFinite(e)&&e>s&&text)out.push({s,e,text});}
 return out;}
