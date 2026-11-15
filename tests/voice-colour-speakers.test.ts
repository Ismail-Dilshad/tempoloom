// Group 9: your voice and footage - audio clean-up, colour matching, speaker labels.
import {describe, it, expect, afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg, run} from '../src/renderer/ffmpeg-encoder.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-g9-'));
afterAll(() => fs.rmSync(tmp, {recursive: true, force: true}));
const R = 16000;

/** A voice-like sound: a buzz at the pitch through three formant resonators, in syllables. */
function voice(f0: number, formants: [number, number][], secs: number, seed: number) {
 const n = Math.round(secs * R), src = new Float64Array(n), out = new Float64Array(n);
 let ph = 0;
 for (let i = 0; i < n; i++) {const t = i / R; ph += f0 * (1 + 0.06 * Math.sin(2 * Math.PI * 0.7 * t + seed) + 0.03 * Math.sin(2 * Math.PI * 3.1 * t)) / R; src[i] = 2 * (ph % 1) - 1;}
 for (const [fc, bw] of formants) {
  const r = Math.exp(-Math.PI * bw / R), th = 2 * Math.PI * fc / R, a1 = -2 * r * Math.cos(th), a2 = r * r, y = new Float64Array(n);
  for (let i = 2; i < n; i++) y[i] = src[i]! - a1 * y[i - 1]! - a2 * y[i - 2]!;
  const m = Math.max(...y.map(Math.abs)); for (let i = 0; i < n; i++) out[i] += y[i]! / m;
 }
 const m = Math.max(...out.map(Math.abs)), res = new Float64Array(n);
 let env = 0;
 for (let i = 0; i < n; i++) {const on = Math.sin(2 * Math.PI * 4 * i / R + seed * 1.7) > -0.3 ? 1 : 0; env += (on - env) / 320; res[i] = 0.3 * out[i]! / m * env;}
 return res;
}
const A = (s: number, seed: number) => voice(115, [[650, 90], [1100, 110], [2500, 160]], s, seed);
const B = (s: number, seed: number) => voice(215, [[850, 90], [2000, 120], [3000, 170]], s, seed);
const gap = (s: number) => new Float64Array(Math.round(s * R));
function wav(file: string, parts: Float64Array[]) {
 const n = parts.reduce((a, p) => a + p.length, 0), b = Buffer.alloc(44 + n * 2);
 b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(R, 24); b.writeUInt32LE(R * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
 let o = 44; for (const p of parts) for (const v of p) {b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), o); o += 2;}
 fs.writeFileSync(file, b); return file;
}

describe('audio clean-up', () => {
 it('hears noise, hum, room echo and uneven loudness, fixes them, and measures again', async () => {
  const dry = wav(path.join(tmp, 'dry.wav'), [A(4, 1), gap(0.4), voice(115, [[650, 90], [1100, 110], [2500, 160]], 4, 2).map(v => v * 0.35), gap(0.4), A(4, 3), gap(0.4), A(4, 4).map(v => v * 0.35)]);
  const bad = path.join(tmp, 'bad.wav');
  await run(ffmpeg, ['-v', 'error', '-y', '-i', dry, '-f', 'lavfi', '-i', 'anoisesrc=c=pink:a=0.02:d=20:r=16000', '-f', 'lavfi', '-i', 'sine=f=50:d=20:r=16000', '-filter_complex', '[0]aecho=0.8:0.7:60|130|220:0.5|0.35|0.25[e];[2]volume=0.03[h];[e][1][h]amix=inputs=3:normalize=0:duration=first', bad]);
  const {measureVoice, cleanVoice, planVoice, voiceFilter} = await import('../src/editor/voice-clean.js');
  const clean = await measureVoice(dry);
  expect(clean.hum.hz).toBe(0);
  expect(clean.echoMs!).toBeLessThan(120);
  const r = await cleanVoice(bad, {out: path.join(tmp, 'bad-clean.wav')});
  expect(r.before.hum.hz).toBe(50);
  expect(r.before.snr).toBeLessThan(40);
  expect(r.before.echoMs!).toBeGreaterThan(200);
  expect(r.before.unevenDb!).toBeGreaterThan(6);
  expect(r.why.join(' ')).toMatch(/Noise reduction.*50 Hz.*room between words.*evened out/s);
  // After: the hum is gone, the speech stands further above the noise, the level is steadier.
  expect(r.after!.hum.hz).toBe(0);
  expect(r.after!.snr).toBeGreaterThan(r.before.snr + 10);
  expect(r.after!.unevenDb!).toBeLessThan(r.before.unevenDb!);
  expect(r.after!.echoMs!).toBeLessThan(r.before.echoMs!);
  // A clean recording is left alone apart from rumble; a plan can be overridden.
  const p = planVoice(clean);
  expect([p.op.denoise, p.op.hum, p.op.dereverb]).toEqual([0, 0, 0]);
  expect(voiceFilter({...p.op, hum: 60})).toMatch(/bandreject=f=60.*bandreject=f=120/);
 }, 120000);

 it('is an edit operation too, and keeps the picture', async () => {
  const {runEdl} = await import('../src/editor/editor.js'), {mediaInfo} = await import('../src/editor/editor.js');
  const v = path.join(tmp, 'talk.mp4');
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x240:d=4', '-i', path.join(tmp, 'bad.wav'), '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', v]);
  const r = await runEdl({version: 1, input: v, operations: [{op: 'voice', hum: 50, denoise: 0.5, dereverb: 0.5, noiseFloor: -49, speech: -15}]}, tmp, {output: path.join(tmp, 'talk-clean.mp4')});
  expect(r.steps[0]!.note).toMatch(/voice cleaned \(50 Hz hum, noise 50%, room 50%, evened\)/);
  const i = await mediaInfo(r.output);
  expect([i.width, i.height, i.hasAudio]).toEqual([320, 240, true]);
 }, 120000);
});

describe('colour matching', () => {
 it('brings clips from different cameras to one look, to a reference or to the most typical clip', async () => {
  const a = path.join(tmp, 'camA.mp4'), b = path.join(tmp, 'camB.mp4'), c = path.join(tmp, 'camC.mp4');
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:d=2,format=yuv420p', a]);
  await run(ffmpeg, ['-v', 'error', '-y', '-i', a, '-vf', 'colorbalance=rs=.25:bs=-.2:rm=.2:bm=-.15,eq=contrast=0.7:brightness=0.08', b]);
  await run(ffmpeg, ['-v', 'error', '-y', '-i', a, '-vf', 'colorbalance=rs=.05:bs=-.05,eq=contrast=0.92', c]);
  const {matchClips, measureColour, lookDistance} = await import('../src/editor/colour-match.js');
  const warm = await measureColour(b), plain = await measureColour(a);
  expect(warm.warmth).toBeGreaterThan(plain.warmth + 4);
  const r = await matchClips([b], {ref: a, out: path.join(tmp, 'matched')});
  const m = r.clips[0]!;
  expect(m.before).toBeGreaterThan(8);
  expect(m.after!).toBeLessThan(m.before / 2.5);
  expect(lookDistance(await measureColour(m.output!), plain)).toBeLessThan(4);
  // Without a reference: the clip closest to all the others is kept as it is.
  const auto = await matchClips([a, b, c], {plan: true});
  expect(auto.referenceChosen).toBe(true);
  expect(path.basename(auto.reference)).not.toBe('camB.mp4');
  expect(auto.clips.find(x => x.clip.endsWith('camB.mp4'))!.op!.op).toBe('match');
  // As an edit operation.
  const {runEdl} = await import('../src/editor/editor.js');
  const e = await runEdl({version: 1, input: b, operations: [m.op!]}, tmp, {output: path.join(tmp, 'camB-op.mp4')});
  expect(e.steps[0]!.note).toMatch(/^colour matched/);
 }, 120000);
});

describe('speaker labels', () => {
 it('tells two voices apart, names them, and finds when each first speaks', async () => {
  const f = wav(path.join(tmp, 'interview.wav'), [A(4.5, 1), gap(0.6), B(3.5, 2), gap(0.6), A(3.8, 3), gap(0.6), B(4.2, 4), gap(0.6), A(2.5, 5)]);
  const {labelSpeakers, nameMoments, speakerSrt} = await import('../src/editor/speakers.js');
  const r = await labelSpeakers(f, {names: ['Sara', 'Ali']});
  expect(r.speakers.map(s => s.name)).toEqual(['Sara', 'Ali']);
  expect(r.turns.map(t => t.speaker)).toEqual(['A', 'B', 'A', 'B', 'A']);
  for (const [i, s] of [0, 5.1, 9.2, 13.6, 18.4].entries()) expect(Math.abs(r.turns[i]!.start - s)).toBeLessThan(0.3);
  expect(r.speakers[0]!.pitchHz!).toBeLessThan(140);
  expect(r.speakers[1]!.pitchHz!).toBeGreaterThan(180);
  expect(nameMoments(r).map(m => m.speaker)).toEqual(['A', 'B']);
  // One voice is one speaker.
  const one = wav(path.join(tmp, 'one.wav'), [A(4, 1), gap(0.5), A(4, 2), gap(0.5), A(4, 3), gap(0.5), A(3, 4)]);
  expect((await labelSpeakers(one)).speakers).toHaveLength(1);
  // With words: an introduction names the speaker, and the captions say who speaks.
  const words = [{word: "Hi,", start: 0.2, end: 0.5}, {word: "I'm", start: 0.6, end: 0.8}, {word: 'Sara', start: 0.9, end: 1.3}, {word: 'and', start: 1.5, end: 1.7}, {word: 'welcome.', start: 1.8, end: 4.3},
   {word: 'Thanks', start: 5.2, end: 6}, {word: 'for', start: 6.1, end: 6.4}, {word: 'having', start: 6.5, end: 7}, {word: 'me.', start: 7.1, end: 8.5}];
  const named = await labelSpeakers(f, {words, count: 2});
  expect(named.speakers[0]).toMatchObject({name: 'Sara', named: 'introduced'});
  expect(speakerSrt(named)).toMatch(/SARA: Hi, I'm Sara and welcome\.[\s\S]*SPEAKER B: Thanks for having me\./);
  // A transcript that already tells speakers apart is used as it is.
  const told = await labelSpeakers(f, {words: words.map((w, i) => ({...w, speaker: i < 5 ? 'speaker_0' : 'speaker_1'})), names: ['Sara', 'Ali']});
  expect(told.turns.map(t => [t.speaker, t.text])).toEqual([['A', "Hi, I'm Sara and welcome."], ['B', 'Thanks for having me.']]);
 }, 120000);

 it.skipIf(process.env.RUN_BROWSER_TESTS !== '1')('puts a name bar on screen when each speaker first appears', async () => {
  const v = path.join(tmp, 'interview.mp4');
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x334455:s=640x360:d=21', '-i', path.join(tmp, 'interview.wav'), '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', v]);
  const {nameSpeakers} = await import('../src/editor/speakers.js');
  const r = await nameSpeakers(v, {names: ['Sara', 'Ali'], roles: ['Host', 'Guest'], bars: true});
  expect(r.nameBars.map(b => b.speaker)).toEqual(['Sara', 'Ali']);
  expect(fs.existsSync(r.video!)).toBe(true);
  expect(JSON.parse(fs.readFileSync(r.json, 'utf8')).speakers).toHaveLength(2);
  // During Ali's first turn the lower left is the brand's bar, not the plain background.
  const frame = path.join(tmp, 'bar.raw');
  await run(ffmpeg, ['-v', 'error', '-y', '-ss', '6', '-i', r.video!, '-frames:v', '1', '-vf', 'crop=200:60:30:265', '-f', 'rawvideo', '-pix_fmt', 'rgb24', frame]);
  const px = fs.readFileSync(frame); let differ = 0;
  for (let i = 0; i < px.length; i += 3) if (Math.abs(px[i]! - 0x33) + Math.abs(px[i + 1]! - 0x44) + Math.abs(px[i + 2]! - 0x55) > 40) differ++;
  expect(differ / (px.length / 3)).toBeGreaterThan(0.2);
 }, 120000);
});
