// Audio clean-up for a recorded voice: measures what is wrong (background noise, mains hum, room
// echo between words, uneven loudness, clipping) and fixes only that, with ffmpeg's own filters,
// then measures again so the result says what changed.
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg, run} from '../renderer/ffmpeg-encoder.js';
import {decodeMono, frameLevels, percentile, median, tonePower} from './pcm.js';

export type VoiceReport = {
 seconds: number;
 noiseFloor: number; // dBFS of the quiet parts
 speech: number; // dBFS of the speech
 snr: number; // speech over noise, dB
 hum: {hz: 0 | 50 | 60; db: number}; // how far the mains tone stands above its neighbours in the quiet parts
 echoMs: number | null; // how long the room takes to fall 20 dB after a word ends
 unevenDb: number | null; // how much the speech level moves from second to second (p90 - p10)
 clipped: number; // share of samples at full scale
 problems: string[];
};

export type VoiceOp = {op: 'voice'; highpass: number; hum: 0 | 50 | 60; denoise: number; noiseFloor?: number | undefined; speech?: number | undefined; dereverb: number; even: boolean; deess: number; loudness?: number | undefined};

const RATE = 16000;

/** Measures a recording's voice the way a sound engineer listens to it. */
export async function measureVoice(file: string): Promise<VoiceReport> {
 const x = await decodeMono(file, RATE);
 if (x.length < RATE) throw new Error('The recording is shorter than a second, or has no sound');
 const L = frameLevels(x, RATE, 10);
 const floor = percentile(L, 0.1), speech = percentile(L, 0.9), snr = speech - floor;
 const hum = {hz: 0 as 0 | 50 | 60, db: 0};
 // Mains hum sits below the voice (50 or 60 Hz): its fundamental against its neighbours, in 400 ms
 // blocks (2.5 Hz apart, so the tone does not leak into the neighbours), the median of the blocks.
 for (const base of [50, 60] as const) {
  const ex: number[] = [];
  for (let from = 0; from + 6400 <= x.length; from += Math.max(6400, Math.floor(x.length / 80))) ex.push(tonePower(x, from, 6400, base, RATE) - (tonePower(x, from, 6400, base - 8, RATE) + tonePower(x, from, 6400, base + 8, RATE)) / 2);
  const db = ex.length ? median(ex) : 0;
  if (db > hum.db) {hum.db = db; hum.hz = base;}
 }
 if (hum.db < 10) hum.hz = 0;
 // Echo: after each word ends, how long until the sound has fallen 20 dB.
 const tails: number[] = [];
 for (let t = 5; t < L.length - 60; t++) {
  const v = L[t]!;
  if (v < speech - 10 || L[t + 1]! >= v - 1 || L[t - 1]! < v - 3) continue;
  const drop = Math.min(20, v - floor - 3);
  if (drop < 10) continue;
  // Follow the fall; if the level rises again before it has fallen, the next word came: no reading.
  let k = 1, ok = true, low = v;
  while (k < 60 && L[t + k]! > v - drop) {if (L[t + k]! > L[t + k - 1]! + 6) {ok = false; break;} low = Math.min(low, L[t + k]!); k++;}
  if (ok && k < 60) {tails.push(k * 10 * 20 / drop); t += k;}
  // The next word came (or 600 ms passed) before the room went quiet: the fall so far gives the rate.
  else if (k >= 12) {tails.push(Math.min(600, k * 10 * 20 / Math.max(1, v - low))); t += k;}
 }
 const echoMs = tails.length >= 4 ? Math.round(median(tails)) : null;
 // Evenness: the speech level second by second.
 const per: number[] = [];
 for (let s = 0; s + 100 <= L.length; s += 100) {
  // The loud half of the frames that rise above the background: the voice's level in that second.
  const v = Array.from(L.slice(s, s + 100)).filter(l => l > floor + 3).sort((a, b) => b - a);
  if (v.length >= 30) {const top = v.slice(0, Math.ceil(v.length / 2)); per.push(10 * Math.log10(top.reduce((a, l) => a + 10 ** (l / 10), 0) / top.length));}
 }
 const unevenDb = per.length >= 4 ? Math.round((percentile(per, 0.9) - percentile(per, 0.1)) * 10) / 10 : null;
 let clip = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]!) >= 0.985) clip++;
 const r: VoiceReport = {seconds: Math.round(x.length / RATE * 10) / 10, noiseFloor: Math.round(floor), speech: Math.round(speech), snr: Math.round(snr), hum: {hz: hum.hz, db: Math.round(hum.db)}, echoMs, unevenDb, clipped: clip / x.length, problems: []};
 if (snr < 40) r.problems.push(`Background noise: the speech is only ${r.snr} dB above it${snr < 25 ? ' (clearly audible)' : ''}.`);
 if (hum.hz) r.problems.push(`A ${hum.hz} Hz mains hum (${r.hum.db} dB above the sound around it).`);
 if (echoMs !== null && echoMs > 150) r.problems.push(`Room echo: the sound takes about ${echoMs} ms to die away after a word (a dry voice takes under 120).`);
 if (unevenDb !== null && unevenDb > 6) r.problems.push(`Uneven loudness: the voice moves ${unevenDb} dB from second to second.`);
 if (r.clipped > 0.0005) r.problems.push(`Clipping: ${(r.clipped * 100).toFixed(2)}% of the sound hit full scale (distorted; it cannot be fully undone).`);
 return r;
}

/** What to do about what was measured, each choice with its reason. */
export function planVoice(r: VoiceReport, o: Partial<Omit<VoiceOp, 'op'>> = {}): {op: VoiceOp; why: string[]} {
 const why: string[] = [];
 const denoise = o.denoise ?? (r.snr >= 45 ? 0 : Math.min(1, Math.max(0.2, (45 - r.snr) / 30)));
 if (denoise) why.push(`Noise reduction ${Math.round(denoise * 100)}%: the speech is ${r.snr} dB above the background.`);
 const hum = o.hum ?? r.hum.hz;
 if (hum) why.push(`A notch at ${hum} Hz and its harmonics for the mains hum.`);
 const dereverb = o.dereverb ?? (r.echoMs !== null && r.echoMs > 150 ? Math.min(1, (r.echoMs - 120) / 300) : 0);
 if (dereverb) why.push(`The room between words lowered (${Math.round(dereverb * 100)}%): it rings for ${r.echoMs} ms. Echo inside the words stays.`);
 const even = o.even ?? (r.unevenDb !== null && r.unevenDb > 6);
 if (even) why.push(`Loudness evened out: the voice moved ${r.unevenDb} dB from second to second.`);
 const highpass = o.highpass ?? 75;
 if (highpass) why.push(`Rumble under ${highpass} Hz removed (no voice is that low).`);
 const deess = o.deess ?? 0;
 if (deess) why.push(`Harsh "s" sounds softened (${Math.round(deess * 100)}%).`);
 return {op: {op: 'voice', highpass, hum: hum as 0 | 50 | 60, denoise: Math.round(denoise * 100) / 100, noiseFloor: r.noiseFloor, speech: r.speech, dereverb: Math.round(dereverb * 100) / 100, even, deess, ...(o.loudness !== undefined ? {loudness: o.loudness} : {})}, why};
}

const amp = (db: number) => Math.min(1, Math.max(0.0001, 10 ** (db / 20)));

/** The ffmpeg audio filter of a voice clean-up. `speech` and `floor` (dBFS) set the room gate. */
export function voiceFilter(op: Omit<VoiceOp, 'op'>, levels: {speech?: number} = {}) {
 const f: string[] = [];
 if (op.highpass) f.push(`highpass=f=${op.highpass}:poles=2`);
 if (op.hum) for (const k of [1, 2, 3, 4]) f.push(`bandreject=f=${op.hum * k}:width_type=h:w=${k === 1 ? 4 : 3}`);
 if (op.denoise > 0) {
  const nf = Math.min(-20, Math.max(-80, Math.round(op.noiseFloor ?? -60)));
  f.push(`afftdn=nr=${(6 + 24 * op.denoise).toFixed(1)}:nf=${nf}:tn=1`);
  if (op.denoise > 0.6) f.push(`anlmdn=s=${(0.0004 + 0.001 * (op.denoise - 0.6)).toFixed(5)}`);
 }
 if (op.dereverb > 0) {
  // A downward expander: between words (below the gate) the room's tail is turned down.
  const floor = op.noiseFloor ?? -60, speech = levels.speech ?? op.speech ?? floor + 40;
  const thr = floor + (speech - floor) * (0.35 + 0.15 * op.dereverb);
  f.push(`agate=threshold=${amp(thr).toFixed(5)}:ratio=${(2 + 4 * op.dereverb).toFixed(1)}:range=${amp(-(6 + 18 * op.dereverb)).toFixed(4)}:attack=4:release=${Math.round(90 - 40 * op.dereverb)}:knee=4`);
 }
 if (op.deess > 0) f.push(`deesser=i=${(0.2 + 0.6 * op.deess).toFixed(2)}:m=0.5:f=0.5`);
 // Evened out over about 1.5 s; frames below the gate's level are not raised (no noise pumped up).
 if (op.even) f.push(`dynaudnorm=f=200:g=7:p=0.9:m=20:r=0.6:s=8${op.noiseFloor !== undefined ? `:t=${amp(op.noiseFloor + 10).toFixed(5)}` : ''}`);
 if (op.loudness !== undefined) f.push(`loudnorm=I=${op.loudness}:TP=-1.5:LRA=11`);
 return f.join(',') || 'anull';
}

const AUDIO_ONLY = /\.(wav|mp3|m4a|aac|flac|ogg|opus)$/i;

/** Measures, plans and (unless `plan`) cleans the voice; the picture is copied untouched. */
export async function cleanVoice(file: string, o: {out?: string; plan?: boolean; set?: Partial<Omit<VoiceOp, 'op'>>; onStep?: (s: string) => void} = {}) {
 const src = path.resolve(file);
 if (!fs.existsSync(src)) throw new Error('No such file: ' + src);
 o.onStep?.('Listening to the recording');
 const before = await measureVoice(src), {op, why} = planVoice(before, o.set);
 if (o.plan) return {before, op, why, output: null, after: null};
 const ext = path.extname(src) || '.mp4';
 let out = path.resolve(o.out ?? src.replace(/\.[^.]+$/, '') + '-clean' + ext);
 for (let k = 2; fs.existsSync(out); k++) out = path.resolve(o.out ?? src.replace(/\.[^.]+$/, '') + `-clean-${k}` + ext);
 o.onStep?.('Cleaning the voice');
 const af = voiceFilter(op, {speech: before.speech});
 const audioOnly = AUDIO_ONLY.test(ext);
 await run(ffmpeg, ['-v', 'error', '-n', '-i', src, ...(audioOnly ? [] : ['-map', '0:v?', '-c:v', 'copy']), '-map', '0:a:0', '-af', af, ...(audioOnly ? (/\.wav$/i.test(ext) ? ['-c:a', 'pcm_s16le'] : /\.flac$/i.test(ext) ? ['-c:a', 'flac'] : []) : ['-c:a', 'aac', '-b:a', '256k']), '-ar', '48000', out]);
 o.onStep?.('Listening again');
 const after = await measureVoice(out);
 return {before, op, why, output: out, after, filter: af};
}
