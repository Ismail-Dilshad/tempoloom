// The sound of a file as numbers (mono, 32-bit float), and small signal tools shared by the voice
// clean-up and the speaker labels: frame levels, a fast Fourier transform, Goertzel tone power.
import {spawn} from 'node:child_process';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';

/** Decodes the first audio stream to mono float samples at `rate`. */
export function decodeMono(file: string, rate = 16000, o: {start?: number; seconds?: number} = {}): Promise<Float32Array> {
 return new Promise((resolve, reject) => {
  const args = ['-v', 'error', ...(o.start ? ['-ss', String(o.start)] : []), '-i', file, ...(o.seconds ? ['-t', String(o.seconds)] : []), '-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'];
  const c = spawn(ffmpeg, args, {windowsHide: true}), parts: Buffer[] = [];
  let err = '';
  c.stdout.on('data', (d: Buffer) => parts.push(d));
  c.stderr.on('data', d => err += d);
  c.on('error', reject);
  c.on('close', code => {
   if (code !== 0) return reject(new Error('Could not read the sound: ' + err.slice(-300)));
   const b = Buffer.concat(parts), out = new Float32Array(Math.floor(b.length / 4));
   for (let i = 0; i < out.length; i++) out[i] = b.readFloatLE(i * 4);
   resolve(out);
  });
 });
}

/** Level of each frame in dBFS (RMS), frames of `ms` milliseconds. */
export function frameLevels(x: Float32Array, rate: number, ms = 20): Float32Array {
 const n = Math.max(1, Math.round(rate * ms / 1000)), out = new Float32Array(Math.floor(x.length / n));
 for (let f = 0; f < out.length; f++) {
  let s = 0;
  for (let i = f * n; i < (f + 1) * n; i++) s += x[i]! * x[i]!;
  out[f] = 10 * Math.log10(s / n + 1e-12);
 }
 return out;
}

export const percentile = (v: ArrayLike<number>, p: number) => {
 const a = Array.from(v).sort((m, n) => m - n);
 return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]! : NaN;
};
export const median = (v: ArrayLike<number>) => percentile(v, 0.5);

/** In-place radix-2 FFT of re/im (length a power of two). */
export function fft(re: Float64Array, im: Float64Array) {
 const n = re.length;
 for (let i = 1, j = 0; i < n; i++) {
  let bit = n >> 1;
  for (; j & bit; bit >>= 1) j ^= bit;
  j ^= bit;
  if (i < j) {[re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!];}
 }
 for (let len = 2; len <= n; len <<= 1) {
  const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
  for (let i = 0; i < n; i += len) {
   let cr = 1, ci = 0;
   for (let k = 0; k < len / 2; k++) {
    const ar = re[i + k]!, ai = im[i + k]!, br = re[i + k + len / 2]! * cr - im[i + k + len / 2]! * ci, bi = re[i + k + len / 2]! * ci + im[i + k + len / 2]! * cr;
    re[i + k] = ar + br; im[i + k] = ai + bi; re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
    const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
   }
  }
 }
}

/** Power of one frequency in a block of samples (Goertzel), in dB. */
export function tonePower(x: Float32Array, from: number, len: number, freq: number, rate: number) {
 const k = 2 * Math.cos(2 * Math.PI * freq / rate);
 let s1 = 0, s2 = 0;
 for (let i = from; i < from + len && i < x.length; i++) {const s = x[i]! + k * s1 - s2; s2 = s1; s1 = s;}
 const p = s1 * s1 + s2 * s2 - k * s1 * s2;
 return 10 * Math.log10(p / (len * len) + 1e-14);
}
