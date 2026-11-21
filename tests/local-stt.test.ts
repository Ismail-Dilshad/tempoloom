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
