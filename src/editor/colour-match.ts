// Colour matching: clips shot on different cameras or days measured (the average colour, contrast
// and the black and white points of each channel) and brought to one look, so they cut together as
// one shoot. The match is a per-channel curve (gain and offset, Reinhard's colour transfer) applied
// with ffmpeg's lutrgb; the result is measured again.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ffmpeg, run} from '../renderer/ffmpeg-encoder.js';
import {mediaInfo} from './editor.js';

export type Channel = {mean: number; sd: number; low: number; high: number};
export type ColourStats = {file: string; r: Channel; g: Channel; b: Channel; lab: [number, number, number]; contrast: number; warmth: number};
export type MatchOp = {op: 'match'; r: [number, number]; g: [number, number]; b: [number, number]};

function frames(file: string, n: number, duration: number): Promise<Buffer> {
 return new Promise((resolve, reject) => {
  const fps = Math.max(0.05, n / Math.max(0.5, duration));
  const c = spawn(ffmpeg, ['-v', 'error', '-i', file, '-vf', `fps=${fps.toFixed(4)},scale=160:90:flags=area`, '-frames:v', String(n), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {windowsHide: true});
  const parts: Buffer[] = []; let err = '';
  c.stdout.on('data', (d: Buffer) => parts.push(d)); c.stderr.on('data', d => err += d);
  c.on('error', reject); c.on('close', code => code === 0 ? resolve(Buffer.concat(parts)) : reject(new Error('Could not read the frames: ' + err.slice(-300))));
 });
}
const lab = (r: number, g: number, b: number): [number, number, number] => {
 const f = (v: number) => {v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;};
 const R = f(r), G = f(g), B = f(b), x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, y = 0.2126 * R + 0.7152 * G + 0.0722 * B, z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
 const t = (v: number) => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
 return [116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))];
};

/** The colour of a clip: per channel its mean, spread and black and white points (1% and 99%). */
export async function measureColour(file: string, samples = 12): Promise<ColourStats> {
 const info = await mediaInfo(file), buf = await frames(file, samples, info.duration);
 const px = Math.floor(buf.length / 3);
 if (!px) throw new Error('No picture in ' + file);
 const ch = (k: number): Channel => {
  const h = new Uint32Array(256); let s = 0, s2 = 0;
  for (let i = 0; i < px; i++) {const v = buf[i * 3 + k]!; h[v]!++; s += v; s2 += v * v;}
  const at = (p: number) => {let acc = 0; for (let v = 0; v < 256; v++) {acc += h[v]!; if (acc >= p * px) return v;} return 255;};
  const mean = s / px;
  return {mean: Math.round(mean * 10) / 10, sd: Math.round(Math.sqrt(Math.max(0, s2 / px - mean * mean)) * 10) / 10, low: at(0.01), high: at(0.99)};
 };
 const r = ch(0), g = ch(1), b = ch(2), L = lab(r.mean, g.mean, b.mean);
 return {file: path.resolve(file), r, g, b, lab: L.map(v => Math.round(v * 10) / 10) as [number, number, number], contrast: Math.round((r.sd + g.sd + b.sd) / 3), warmth: Math.round(r.mean - b.mean)};
}

/** How far apart two looks are: the difference of their average colours (Lab) plus their contrast. */
export function lookDistance(a: ColourStats, b: ColourStats) {
 const d = Math.hypot(a.lab[0] - b.lab[0], a.lab[1] - b.lab[1], a.lab[2] - b.lab[2]);
 return Math.round((d + Math.abs(a.contrast - b.contrast) * 0.3) * 10) / 10;
}

/** The curve that gives `src` the look of `ref`: per channel out = in x gain + offset. */
export function matchOp(src: ColourStats, ref: ColourStats, strength = 1): MatchOp {
 const one = (s: Channel, t: Channel): [number, number] => {
  const gain = Math.min(1.7, Math.max(0.6, t.sd / Math.max(4, s.sd)));
  const offset = Math.min(70, Math.max(-70, t.mean - gain * s.mean));
  const k = Math.min(1, Math.max(0, strength));
  return [Math.round((1 + (gain - 1) * k) * 1000) / 1000, Math.round(offset * k * 10) / 10];
 };
 return {op: 'match', r: one(src.r, ref.r), g: one(src.g, ref.g), b: one(src.b, ref.b)};
}

export const matchFilter = (m: Pick<MatchOp, 'r' | 'g' | 'b'>) => `lutrgb=r='clip(val*${m.r[0]}+${m.r[1]},0,255)':g='clip(val*${m.g[0]}+${m.g[1]},0,255)':b='clip(val*${m.b[0]}+${m.b[1]},0,255)'`;

/** Brings clips to one look: to `ref` if given, else to the clip whose look is closest to all the
 *  others (the least change overall). Writes NAME-matched.mp4 for each clip that changed. */
export async function matchClips(clips: string[], o: {ref?: string; out?: string; strength?: number; plan?: boolean; onStep?: (s: string) => void} = {}) {
 const files = clips.map(f => path.resolve(f));
 for (const f of [...files, ...(o.ref ? [path.resolve(o.ref)] : [])]) if (!fs.existsSync(f)) throw new Error('No such file: ' + f);
 if (files.length + (o.ref ? 1 : 0) < 2) throw new Error('Give at least two clips (or a clip and --to REFERENCE)');
 o.onStep?.('Measuring the colour of each clip');
 const stats = await Promise.all(files.map(f => measureColour(f)));
 let ref: ColourStats;
 if (o.ref) ref = await measureColour(path.resolve(o.ref));
 else ref = stats.map(s => ({s, sum: stats.reduce((a, t) => a + lookDistance(s, t), 0)})).sort((a, b) => a.sum - b.sum)[0]!.s;
 const results: {clip: string; before: number; after: number | null; op: MatchOp | null; output: string | null; reference: boolean}[] = [];
 for (const [i, s] of stats.entries()) {
  if (s.file === ref.file) {results.push({clip: s.file, before: 0, after: 0, op: null, output: null, reference: true}); continue;}
  const before = lookDistance(s, ref);
  if (before < 3) {results.push({clip: s.file, before, after: before, op: null, output: null, reference: false}); continue;}
  const op = matchOp(s, ref, o.strength ?? 1);
  if (o.plan) {results.push({clip: s.file, before, after: null, op, output: null, reference: false}); continue;}
  const dir = o.out ? path.resolve(o.out) : path.dirname(s.file);
  fs.mkdirSync(dir, {recursive: true});
  let out = path.join(dir, path.basename(s.file).replace(/\.[^.]+$/, '') + '-matched.mp4');
  for (let k = 2; fs.existsSync(out); k++) out = out.replace(/-matched(-\d+)?\.mp4$/, `-matched-${k}.mp4`);
  o.onStep?.(`Matching clip ${i + 1} of ${stats.length}`);
  await run(ffmpeg, ['-v', 'error', '-n', '-i', s.file, '-map', '0:v:0', '-map', '0:a?', '-vf', matchFilter(op) + ',format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-c:a', 'copy', out]);
  results.push({clip: s.file, before, after: lookDistance(await measureColour(out), ref), op, output: out, reference: false});
 }
 return {reference: ref.file, referenceChosen: !o.ref, clips: results};
}
