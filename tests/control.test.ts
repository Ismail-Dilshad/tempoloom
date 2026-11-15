// Group 11: control over the look - lock what you like, readability on a phone, text that reacts
// to the voice, the style mixer.
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg, run} from '../src/renderer/ffmpeg-encoder.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-g11-'));
const env = {VIDEO_WORKSPACE: path.join(tmp, 'ws'), TEMPOLOOM_BRAIN_DIR: path.join(tmp, 'brain'), TEMPOLOOM_BRAIN_DB: path.join(tmp, 'brain.db'), TEMPOLOOM_KNOWLEDGE_DIR: path.join(tmp, 'know'),
 TEMPOLOOM_SETTINGS_DIR: path.join(tmp, 'local'), TEMPOLOOM_STATE_FILE: path.join(tmp, 'state.json'), TEMPOLOOM_LOOKS_DIR: path.join(tmp, 'looks'), VIDEO_OUTPUT: path.join(tmp, 'out')}, before = {...process.env};
let closeDb: () => void;
beforeAll(async () => {Object.assign(process.env, env); fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR, {recursive: true}); closeDb = (await import('../src/engine/brain/db.js')).closeDb; (await import('../src/engine/brain/brain.js')).sync();});
afterAll(() => {closeDb(); for (const k of Object.keys(env)) before[k] === undefined ? delete process.env[k] : process.env[k] = before[k]; fs.rmSync(tmp, {recursive: true, force: true});});

describe('lock what you like', () => {
 it('keeps a locked scene exactly as it was; only the user unlocks it', async () => {
  const S = await import('../src/engine/studio.js'), V = await import('../src/engine/studio-versions.js');
  const p = S.plan('A video about tea', {type: 'script-to-motion', job: 'tea'});
  // The job's video: a motion project with three scenes.
  const proj = path.join(env.VIDEO_WORKSPACE, 'projects', 'tea-video');
  fs.mkdirSync(proj, {recursive: true});
  const scenes = [{id: 'scene-1', text: 'Tea is old.', start: 0, duration: 2}, {id: 'scene-2', text: 'It came from China.', start: 2, duration: 2}, {id: 'scene-3', text: 'Drink it hot.', start: 4, duration: 2}];
  const write = (s: typeof scenes) => fs.writeFileSync(path.join(proj, 'project.json'), JSON.stringify({scenes: s}));
  write(scenes);
  S.savePlan({...S.readPlan('tea'), videoJob: 'tea-video'});
  expect(() => V.lock('tea', [4])).toThrow(/No scene 4: the video has 3 scenes/);
  const r = V.lock('tea', [2]);
  expect(r.locked).toEqual([{scene: 2, label: 'It came from China.'}]);
  // Every step after: the locked scene's words and visual must stay.
  const o = (f: string) => {const x = path.join(tmp, f); fs.writeFileSync(x, '# ' + f + '\n'); return x;};
  for (const t of ['intake', 'brief']) {S.start('tea', t); S.done('tea', t, {output: o(t + '.md'), applied: []});}
  const st = S.start('tea', 'research');
  expect((st as {lockedScenes?: string}).lockedScenes).toMatch(/locked scene 2 \("It came from China\."\)/);
  write([scenes[0]!, {...scenes[1]!, text: 'It came from India.'}, scenes[2]!]);
  expect(() => S.done('tea', 'research', {output: o('research.md'), applied: [], anyway: true})).toThrow(/scene 2 is locked \(the user marked it final\) but changed/);
  // A change elsewhere is fine; and once unlocked, scene 2 may change.
  write([{...scenes[0]!, text: 'Tea is very old.'}, scenes[1]!, scenes[2]!]);
  S.done('tea', 'research', {output: o('research.md'), applied: []});
  V.lock('tea', [2], false);
  expect(S.readPlan('tea').locked).toEqual([]);
 });
});

describe('readability on a phone', () => {
 it('needs time to read the words and a size a phone shows clearly', async () => {
  const {needSeconds, readIssues, PHONE_WIDTH} = await import('../src/renderer/readability.js');
  expect(PHONE_WIDTH).toBe(390);
  expect(needSeconds(1)).toBe(1); expect(needSeconds(10)).toBe(3.5);
  const ok = {text: 'Coffee wins', scene: 's', firstSeen: 0, seconds: 2, words: 2, need: 1.1, phonePt: 20};
  expect(readIssues(ok)).toEqual([]);
  expect(readIssues({...ok, phonePt: 10}).map(i => [i.kind, i.severity])).toEqual([['phone-size', 'soft']]);
  expect(readIssues({...ok, phonePt: 8}).map(i => i.severity)).toEqual(['hard']);
  const quick = readIssues({...ok, text: 'Seven words that flash by far too fast', words: 8, need: needSeconds(8), seconds: 0.8});
  expect(quick[0]).toMatchObject({kind: 'too-quick', severity: 'hard'});
  expect(quick[0]!.detail).toMatch(/on screen 0\.8 s; its 8 words need 2\.9 s/);
 });

 it.skipIf(process.env.RUN_BROWSER_TESTS !== '1')('watches each scene: how long each text stays, counting numbers and typed text as one', async () => {
  const {chromium} = await import('playwright'), {chromiumExecutable} = await import('../src/renderer/browser-path.js'), {watchText} = await import('../src/renderer/readability.js');
  const b = await chromium.launch({executablePath: chromiumExecutable()});
  try {
   const page = await b.newPage({viewport: {width: 540, height: 960}});
   // A frame: a sentence all the time, a number counting 0 to 42 in the first second, a label
   // typed in, and a note shown only for 0.4 s; fonts in pixels of a 540-wide page.
   await page.setContent(`<div id="stage" style="position:relative;width:540px;height:960px"><p id="s" style="font-size:40px">Coffee wins at work.</p><p id="n" style="font-size:30px"></p><p id="t" style="font-size:10px"></p><p id="q" style="font-size:30px">Flash note with many words here</p></div>
   <script>window.render=t=>{n.textContent=Math.round(Math.min(1,t)*42)+'%';const w='Most popular';t_=Math.min(w.length,Math.floor(t*12));document.getElementById('t').textContent=w.slice(0,Math.max(1,t_));q.style.opacity=t>1&&t<1.4?1:0;};</script>`);
   const seen = await watchText(page, [{id: 'scene-1', start: 0, duration: 3}], {step: 0.1});
   const by = (re: RegExp) => seen.find(s => re.test(s.text))!;
   expect(Math.round(by(/Coffee/).seconds)).toBe(3);
   expect(seen.filter(s => /%$/.test(s.text))).toHaveLength(1); // one counting number
   expect(by(/%$/).text).toBe('42%');
   expect(seen.filter(s => /^M/.test(s.text))).toHaveLength(1); // one typed label
   expect(by(/^Most popular$/).phonePt).toBeLessThan(9); // 10px of 540 ≈ 7 pt on a phone
   expect(by(/Flash/).seconds).toBeLessThan(0.6);
  } finally {await b.close();}
 }, 60000);
});

describe('text that reacts to the voice', () => {
 it('finds the words said with the most stress', async () => {
  // Six "words": tones, the fourth much louder and held longer.
  const f = path.join(tmp, 'say.wav');
  const parts = [[0.2, 0.6, 0.2], [0.7, 1.1, 0.2], [1.2, 1.6, 0.2], [1.7, 2.4, 0.8], [2.5, 2.9, 0.2], [3.0, 3.4, 0.2]];
  const expr = parts.map(([a, b, v]) => `${v}*between(t,${a},${b})`).join('+');
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc='(${expr})*sin(2*PI*180*t)':s=16000:d=3.6`, f]);
  const {wordEmphasis} = await import('../src/editor/captions.js');
  const e = await wordEmphasis(f, [{start: 0.2, end: 3.4, text: 'one two three FOUR five six', words: parts.map(([a, b], i) => ({text: ['one', 'two', 'three', 'FOUR', 'five', 'six'][i]!, start: a!, end: b!}))}]);
  expect(e[0]).toHaveLength(6);
  expect(e[0]![3]!).toBeGreaterThanOrEqual(1);
  expect(Math.max(...e[0]!.filter((_, i) => i !== 3))).toBeLessThan(0.5);
  const {captionStyle} = await import('../src/editor/caption-styles.js');
  expect(captionStyle('loud').fields.react).toBe(0.8);
 });

 it.skipIf(process.env.RUN_BROWSER_TESTS !== '1')('draws the stressed word bigger and lit as it is said', async () => {
  const v = path.join(tmp, 'say.mp4');
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x222222:s=480x854:d=3.6', '-i', path.join(tmp, 'say.wav'), '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', v]);
  const {runEdl} = await import('../src/editor/editor.js');
  const words = [[0.2, 0.6], [0.7, 1.1], [1.2, 1.6], [1.7, 2.4], [2.5, 2.9], [3.0, 3.4]].map(([a, b], i) => ({text: ['one', 'two', 'three', 'four', 'five', 'six'][i]!, start: a!, end: b!}));
  const r = await runEdl({version: 1, input: v, operations: [{op: 'captions', preset: 'loud', position: 'center', cues: [{start: 0.2, end: 3.4, text: 'one two three four five six', words}]}]}, tmp, {output: path.join(tmp, 'say-captions.mp4')});
  expect(r.steps[0]!.note).toMatch(/reacting to the voice \(1 stressed word/);
  // Lit (the highlight's yellow) while "four" is said, not while "two" is.
  const yellow = async (t: number) => {const raw = path.join(tmp, `f${t}.raw`); await run(ffmpeg, ['-v', 'error', '-y', '-ss', String(t), '-i', r.output, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', raw]);
   const px = fs.readFileSync(raw); let n = 0; for (let i = 0; i < px.length; i += 3) if (px[i]! > 200 && px[i + 1]! > 170 && px[i + 2]! < 90) n++; return n;};
  expect(await yellow(2.0)).toBeGreaterThan(await yellow(0.9) + 200);
 }, 120000);
});

describe('style mixer', () => {
 it('blends two styles by their shares', async () => {
  const {mixLooks, saveMix, readLook} = await import('../src/engine/looks.js');
  const base = {version: 1 as const, source: {}, music: {mood: 'calm' as const, bpm: 80}, summary: ['x'], created: '2026-01-01'};
  const A = {...base, name: 'calm-paper', measured: {brightness: 0.8, backgroundSaturation: 0.1, backgroundHue: 350, accentHue: 30, energy: 2, burstsPerSecond: 0.2, easing: 'ease-in-out', averageShotSeconds: 5, cutsPerMinute: 10}, steer: {'tone-paper': 7, 'motion-smooth': 6}, pacing: {minSceneDuration: 4, wordsPerSecond: 2.2}, palette: {background: '#ffffff'}, summary: ['warm paper-like light frames', 'calm, slow motion']};
  const B = {...base, name: 'fast-dark', music: {mood: 'energetic' as const, bpm: 140}, measured: {brightness: 0.2, backgroundSaturation: 0.3, backgroundHue: 10, accentHue: 200, energy: 12, burstsPerSecond: 2, easing: 'linear', averageShotSeconds: 1, cutsPerMinute: 60}, steer: {'tone-dark': 8, 'motion-snap': 6}, pacing: {minSceneDuration: 1.8, wordsPerSecond: 3}, palette: {background: '#000000'}, summary: ['dark frames', 'fast cuts and snappy motion']};
  const m = mixLooks(A as never, B as never, 0.7);
  expect(m.name).toBe('mix-calm-paper-fast-dark-70');
  expect(m.measured.brightness).toBeCloseTo(0.62, 2);
  expect(m.measured.backgroundHue).toBe(356); // across 0, not through 180
  expect(m.measured.cutsPerMinute).toBeCloseTo(25, 5);
  expect(m.music).toEqual({mood: 'calm', bpm: 98}); // the mood from the bigger share
  expect(m.measured.easing).toBe('ease-in-out');
  // Each trait keeps its share of the pull: 70% of A's 7 is still a strong nudge, 30% of B's 8 a weak one.
  expect(m.steer['tone-paper']!).toBeCloseTo(7 ** 0.7, 1);
  expect(m.steer['tone-dark']!).toBeCloseTo(8 ** 0.3, 1);
  expect(m.pacing).toEqual({minSceneDuration: 3.34, wordsPerSecond: 2.44});
  expect(m.palette!.background).toMatch(/^#[0-9a-f]{6}$/);
  expect(m.summary[0]).toMatch(/^70% "calm-paper" .* and 30% "fast-dark"/);
  expect(mixLooks(A as never, B as never, 0.2).music.mood).toBe('energetic');
  // Saved as a look, used like any other with --like.
  fs.mkdirSync(env.TEMPOLOOM_LOOKS_DIR, {recursive: true});
  for (const l of [A, B]) fs.writeFileSync(path.join(env.TEMPOLOOM_LOOKS_DIR, l.name + '.json'), JSON.stringify(l));
  const s = await saveMix('calm-paper', 'fast-dark', 0.5);
  expect((await readLook(s.look.name)).source.title).toBe('50% calm-paper, 50% fast-dark');
  await expect(saveMix('calm-paper', 'nope', 0.5)).rejects.toThrow(/No look "nope"/);
 });
});
