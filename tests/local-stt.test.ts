import {describe,expect,it} from 'vitest';

describe('captions on this computer (Omnilingual ASR)',()=>{
 it('cuts long audio at the quietest moment, in pieces under the 40 s limit',async()=>{
  const {cutAtPauses}=await import('../src/engine/local-stt.js');
  const sr=16000,x=new Float32Array(sr*70);
  for(let i=0;i<x.length;i++)x[i]=.3*Math.sin(i/7);
  // a pause from 21.0 s to 21.6 s and another from 47.0 s to 47.5 s
  for(const [a,b] of [[21,21.6],[47,47.5]])for(let i=Math.floor(a*sr);i<b*sr;i++)x[i]=0;
  const cuts=cutAtPauses(x,sr);
  expect(cuts[0]![0]).toBe(0);expect(cuts.at(-1)![1]).toBeCloseTo(70,3);
  for(const [a,b] of cuts)expect(b-a).toBeLessThanOrEqual(28.001);
  for(let i=1;i<cuts.length;i++)expect(cuts[i]![0]).toBe(cuts[i-1]![1]);
  expect(cuts[0]![1]).toBeGreaterThan(20.8);expect(cuts[0]![1]).toBeLessThan(21.7);
 });
 it('turns SentencePiece tokens and their times into words, in any script',async()=>{
  const {wordsFromTokens}=await import('../src/engine/local-stt.js');
  const w=wordsFromTokens(['▁ئە','مڕۆ','▁دە','ست','▁نوێ'],[.1,.3,.8,1,1.6],10,12.5);
  expect(w.map(x=>x.text)).toEqual(['ئەمڕۆ','دەست','نوێ']);
  expect(w[0]!.start).toBeCloseTo(10.1);expect(w[1]!.start).toBeCloseTo(10.8);
  for(const x of w){expect(x.end).toBeGreaterThan(x.start);expect(x.end).toBeLessThanOrEqual(12.5);}
  expect(w[0]!.end).toBeLessThanOrEqual(w[1]!.start);
  // Omnilingual: one character per token, a space token between words (its time is where the word ends)
  const o=wordsFromTokens(['ب','ۆ',' ','ل','ە',' ','ک','و','ر','د'],[1,1.06,1.2,1.3,1.36,1.5,1.6,1.66,1.7,1.8],0,3);
  expect(o.map(x=>[x.text,x.start,x.end])).toEqual([['بۆ',1,1.2],['لە',1.3,1.5],['کورد',1.6,2.05]]);
  // Japanese: each character is a unit, ending where the next begins
  const j=wordsFromTokens(['今','日','は'],[0,.2,.4],5,6);
  expect(j.map(x=>x.text)).toEqual(['今','日','は']);expect(j[0]!.end).toBeCloseTo(5.2);
 });
 it('guesses Kurdish, Persian or Arabic from the letters',async()=>{
  const {guessCode}=await import('../src/engine/local-stt.js');
  expect(guessCode('ئەمڕۆ دەستکاریکەری نوێ')).toBe('ckb');
  expect(guessCode('امروز ویرایشگر جدید را منتشر می‌کنیم')).toBe('fa');
  expect(guessCode('اليوم نطلق المحرر الجديد')).toBe('ar');
  expect(guessCode('Today we ship')).toBeNull();
 });
 it('knows both models and where they go',async()=>{
  const L=await import('../src/engine/local-stt.js');
  expect(Object.keys(L.LOCAL_MODELS)).toEqual(['1b','300m']);
  expect(L.modelRoot()).toMatch(/omnilingual-asr$/);
  expect(L.status().models.map(m=>m.id)).toEqual(['1b','300m']);
 });
});

describe('captions that learn from corrections',()=>{
 it('learns the changed words of an edit, including a word split in two',async()=>{
  const {diffPairs}=await import('../src/engine/caption-learning.js');
  expect(diffPairs('پاش موسڵمانبوونی بڕیاریدا بەرگی','پاش موسڵمان بوونی بڕیاری دا بەرگی.')).toEqual([['موسڵمانبوونی بڕیاریدا','موسڵمان بوونی بڕیاری دا']]);
  expect(diffPairs('the cat sat','the cat sat')).toEqual([]);
  expect(diffPairs('we ship today','we shipped it today')).toEqual([['ship','shipped it']]);
  // deleting or adding a whole word alone is not learned
  expect(diffPairs('um we ship','we ship')).toEqual([]);
 });
 it('remembers fixes per language and applies them to new words, keeping times and punctuation',async()=>{
  const os=await import('node:os'),fs=await import('node:fs'),path=await import('node:path');
  process.env.TEMPOLOOM_SETTINGS_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'tl-fixes-'));
  const C=await import('../src/engine/caption-learning.js');
  C.learn('ckb','لە فرژنی دەترسن','لە فرەژنی دەترسن');C.learn('ckb','لە فرژنی دەترسن','لە فرەژنی دەترسن');
  expect(C.list()).toEqual([expect.objectContaining({lang:'ckb',from:'فرژنی',to:'فرەژنی',n:2})]);
  const r=C.applyFixes('ckb',[{text:'لە',start:0,end:.3},{text:'فرژنی،',start:.3,end:.9}]);
  expect(r.fixed).toBe(1);expect(r.words.map(w=>w.text)).toEqual(['لە','فرەژنی،']);expect(r.words[1]!.start).toBeCloseTo(.3);expect(r.words[1]!.end).toBeCloseTo(.9);
  expect(C.applyFixes('en',[{text:'فرژنی',start:0,end:1}]).fixed).toBe(0);
  expect(C.hotwords('ckb')).toBe('فرەژنی');
  C.remove('ckb','فرژنی');expect(C.list()).toEqual([]);
  delete process.env.TEMPOLOOM_SETTINGS_DIR;
 });
 it('marks where a second model heard something else, without changing the words',async()=>{
  const {secondOpinion}=await import('../src/engine/local-stt.js');
  const om=[{text:'پاش',start:0,end:.3},{text:'موسڵمانبوونی',start:.3,end:1},{text:'بکات',start:1,end:1.4}];
  const wh=[{text:'پاش',start:0,end:.3,confidence:.9},{text:'موسڵمان',start:.3,end:.6,confidence:.8},{text:'بوونی',start:.6,end:1,confidence:.8},{text:'بکات.',start:1,end:1.4,confidence:.9}];
  const r=secondOpinion(om,wh);expect(r.flags).toBe(1);
  // the words stay; only the full stop Whisper wrote after an agreed word is borrowed
  expect(r.words.map(w=>w.text)).toEqual(['پاش','موسڵمانبوونی','بکات.']);
  expect(r.words[1]).toMatchObject({alt:'موسڵمان بوونی',altSpan:1});
 });
});

describe('cleaner Kurdish captions',()=>{
 it('writes Kurdish letters, not their Arabic look-alikes, and leaves Arabic alone',async()=>{
  const {tidyLetters}=await import('../src/engine/local-stt.js');
  expect(tidyLetters('میدیایەك علي ھەموو هه\u200cر','ckb')).toBe('میدیایەک علی هەموو هەر');
  expect(tidyLetters('علي كتاب','ar')).toBe('علي كتاب');
  expect(tidyLetters('Hello','en')).toBe('Hello');
 });
 it('repairs the half letters the Sorani model sometimes writes',async()=>{
  const {repairHalfLetters}=await import('../src/engine/local-stt.js');
  expect(repairHalfLetters('چی\uFFFDتە بین\uFFFDرد')).toBe('چێتە بینێرد');
 });
 it('drops words "heard" over silence that nobody said',async()=>{
  const {dropInventedWords}=await import('../src/engine/local-stt.js');
  const sr=16000,x=new Float32Array(sr*5);for(let i=0;i<sr*3.3;i++)x[i]=.05*Math.sin(i/5);
  const ws=[{text:'هاوەڵ',start:.2,end:.8},{text:'بۆ',start:.9,end:1.1},{text:'خودا',start:1.2,end:1.8},{text:'گەورەیە',start:2.6,end:3.2},{text:'موسیقی',start:3.5,end:4.2},{text:'دیگه',start:4.3,end:4.9}];
  expect(dropInventedWords(ws,x,sr).map(w=>w.text)).toEqual(['هاوەڵ','بۆ','خودا','گەورەیە']);
 });
 it('marks only short disagreements and borrows punctuation where both agree',async()=>{
  const {secondOpinion}=await import('../src/engine/local-stt.js');
  const om=['a','b','c','d','e','f','g'].map((t,i)=>({text:t,start:i,end:i+1}));
  const wh=[{text:'a,',start:0,end:1,confidence:.9},...['x','y','z','u','v','w'].map((t,i)=>({text:t,start:i+1,end:i+2,confidence:.9}))];
  const r=secondOpinion(om,wh);expect(r.flags).toBe(0);expect(r.words[0]!.text).toBe('a,');
 });
});
