// Photo story: a folder of photos becomes a paced video. Ordered by when they were taken (the
// camera's date in the photo, else a date in the file name, else the file's date), by how they
// look (alike photos together), by what they show (descriptions you or the agent give), or by name.
// Each photo gets a gentle move towards where the eye goes in it; they dissolve into each other,
// paced evenly or on the music's beats, with an optional title.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../renderer/browser-path.js';
import {ffmpeg, run} from '../renderer/ffmpeg-encoder.js';
import {decodeMono} from './pcm.js';

const IMAGES = /\.(jpe?g|png|webp|bmp|tiff?)$/i;
export type Photo = {file: string; taken: Date | null; dateFrom: 'camera' | 'name' | 'file'; orientation: number; width: number; height: number; focus: {x: number; y: number}; colour: [number, number, number]; about?: string | undefined};
export type Order = 'date' | 'look' | 'about' | 'name';

// ---------------------------------------------------------------------------------------------
// The camera's date and orientation (EXIF), without a library
// ---------------------------------------------------------------------------------------------
export function readExif(buf: Buffer): {taken: Date | null; orientation: number} {
 const out = {taken: null as Date | null, orientation: 1};
 if (buf[0] !== 0xFF || buf[1] !== 0xD8) return out;
 let p = 2;
 while (p + 4 < buf.length && buf[p] === 0xFF) {
  const marker = buf[p + 1]!, len = buf.readUInt16BE(p + 2);
  if (marker === 0xE1 && buf.toString('latin1', p + 4, p + 10) === 'Exif\0\0') {
   const t = p + 10, le = buf.toString('latin1', t, t + 2) === 'II';
   const u16 = (o: number) => le ? buf.readUInt16LE(t + o) : buf.readUInt16BE(t + o), u32 = (o: number) => le ? buf.readUInt32LE(t + o) : buf.readUInt32BE(t + o);
   const ifd = (o: number, want: number[]) => {const found = new Map<number, {type: number; count: number; value: number}>(); if (t + o + 2 > buf.length) return found; const n = u16(o);
    for (let i = 0; i < n && t + o + 2 + i * 12 + 12 <= buf.length; i++) {const e = o + 2 + i * 12, tag = u16(e); if (want.includes(tag)) found.set(tag, {type: u16(e + 2), count: u32(e + 4), value: u16(e + 2) === 3 ? u16(e + 8) : u32(e + 8)});}
    return found;};
   const ifd0 = ifd(u32(4), [0x0112, 0x8769, 0x0132]);
   if (ifd0.get(0x0112)) out.orientation = ifd0.get(0x0112)!.value;
   const ascii = (e?: {count: number; value: number}) => e && t + e.value + 19 <= buf.length ? buf.toString('latin1', t + e.value, t + e.value + 19) : null;
   let s = ifd0.get(0x8769) ? ascii(ifd(ifd0.get(0x8769)!.value, [0x9003]).get(0x9003)) : null;
   s ??= ascii(ifd0.get(0x0132));
   const m = s && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s);
   if (m) out.taken = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
   return out;
  }
  if (marker === 0xDA) break;
  p += 2 + len;
 }
 return out;
}
/** A date in a file name: IMG_20240512_..., 2024-05-12, PXL_20240512... */
export function dateInName(name: string): Date | null {
 const m = /(20\d{2}|19\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?:[-_ T]?([01]\d|2[0-3])[-_.:]?([0-5]\d)[-_.:]?([0-5]\d))?/.exec(name);
 return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 12), Number(m[5] ?? 0), Number(m[6] ?? 0)) : null;
}

function pixels(file: string, w: number, h: number): Promise<Buffer> {
 return new Promise((resolve, reject) => {
  const c = spawn(ffmpeg, ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=area`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {windowsHide: true});
  const parts: Buffer[] = []; let err = '';
  c.stdout.on('data', (d: Buffer) => parts.push(d)); c.stderr.on('data', d => err += d);
  c.on('error', reject); c.on('close', code => code === 0 ? resolve(Buffer.concat(parts)) : reject(new Error(`Could not read ${path.basename(file)}: ${err.slice(-200)}`)));
 });
}
async function size(file: string): Promise<{width: number; height: number}> {
 const out = await new Promise<string>((resolve, reject) => {const c = spawn(ffmpeg, ['-hide_banner', '-i', file], {windowsHide: true}); let e = ''; c.stderr.on('data', d => e += d); c.on('error', reject); c.on('close', () => resolve(e));});
 const m = /, (\d{2,5})x(\d{2,5})/.exec(out);
 if (!m) throw new Error('Not a picture ffmpeg can read: ' + path.basename(file));
 return {width: Number(m[1]), height: Number(m[2])};
}

/** Where the eye goes in a photo (the most detailed, colourful part) and its average colour. */
async function look(file: string): Promise<{focus: {x: number; y: number}; colour: [number, number, number]}> {
 const S = 48, b = await pixels(file, S, S), L = new Float32Array(S * S);
 let r = 0, g = 0, bl = 0;
 for (let i = 0; i < S * S; i++) {r += b[i * 3]!; g += b[i * 3 + 1]!; bl += b[i * 3 + 2]!; L[i] = 0.3 * b[i * 3]! + 0.59 * b[i * 3 + 1]! + 0.11 * b[i * 3 + 2]!;}
 const score: {x: number; y: number; s: number}[] = [];
 for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
  const i = y * S + x, edge = Math.abs(L[i + 1]! - L[i - 1]!) + Math.abs(L[i + S]! - L[i - S]!);
  const sat = Math.max(b[i * 3]!, b[i * 3 + 1]!, b[i * 3 + 2]!) - Math.min(b[i * 3]!, b[i * 3 + 1]!, b[i * 3 + 2]!);
  const centre = 1 - 0.6 * Math.hypot(x / S - 0.5, y / S - 0.45);
  score.push({x, y, s: (edge + sat * 0.4) * centre});
 }
 score.sort((a, c) => c.s - a.s);
 const top = score.slice(0, Math.ceil(score.length * 0.08)), sum = top.reduce((a, q) => a + q.s, 0) || 1;
 const fx = top.reduce((a, q) => a + q.x * q.s, 0) / sum / S, fy = top.reduce((a, q) => a + q.y * q.s, 0) / sum / S;
 return {focus: {x: Math.round(Math.min(0.8, Math.max(0.2, fx)) * 100) / 100, y: Math.round(Math.min(0.8, Math.max(0.2, fy)) * 100) / 100}, colour: [r / (S * S), g / (S * S), bl / (S * S)].map(Math.round) as [number, number, number]};
}

/** The photos of a folder (or a list), measured: when taken, which way up, where the eye goes. */
export async function readPhotos(inputs: string[], o: {about?: Record<string, string>} = {}): Promise<Photo[]> {
 const files = inputs.flatMap(f => {const p = path.resolve(f); if (!fs.existsSync(p)) throw new Error('No such file or folder: ' + p); return fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(n => IMAGES.test(n)).sort().map(n => path.join(p, n)) : [p];}).filter(f => IMAGES.test(f));
 if (files.length < 2) throw new Error('A photo story needs at least two photos (jpg, png, webp, bmp or tiff)');
 const out: Photo[] = [];
 for (const file of files) {
  const head = Buffer.alloc(Math.min(256 * 1024, fs.statSync(file).size)), fd = fs.openSync(file, 'r'); fs.readSync(fd, head, 0, head.length, 0); fs.closeSync(fd);
  const ex = readExif(head), named = dateInName(path.basename(file));
  const taken = ex.taken ?? named ?? fs.statSync(file).mtime, from: Photo['dateFrom'] = ex.taken ? 'camera' : named ? 'name' : 'file';
  const s = await size(file), l = await look(file), turned = ex.orientation >= 5;
  out.push({file, taken, dateFrom: from, orientation: ex.orientation, width: turned ? s.height : s.width, height: turned ? s.width : s.height, focus: l.focus, colour: l.colour, about: o.about?.[path.basename(file)] ?? o.about?.[file]});
 }
 return out;
}

/** The order to show them in. `look` walks from photo to the most alike photo; `about` keeps photos
 *  whose descriptions share words together, in date order within a group. */
export function orderPhotos(photos: Photo[], order: Order): Photo[] {
 const byDate = [...photos].sort((a, b) => (a.taken?.getTime() ?? 0) - (b.taken?.getTime() ?? 0) || a.file.localeCompare(b.file));
 if (order === 'name') return [...photos].sort((a, b) => a.file.localeCompare(b.file, undefined, {numeric: true}));
 if (order === 'date') return byDate;
 if (order === 'look') {
  const left = [...byDate], out = [left.shift()!];
  const d = (a: Photo, b: Photo) => Math.hypot(a.colour[0] - b.colour[0], a.colour[1] - b.colour[1], a.colour[2] - b.colour[2]);
  while (left.length) {const last = out[out.length - 1]!; let k = 0; left.forEach((p, i) => {if (d(p, last) < d(left[k]!, last)) k = i;}); out.push(left.splice(k, 1)[0]!);}
  return out;
 }
 // about: group by the most common shared word of the descriptions
 const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'at', 'with', 'to', 'is', 'my', 'our', 'for', 'by', 'from']);
 const words = (p: Photo) => (p.about ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2 && !STOP.has(w));
 const counts = new Map<string, number>(); for (const p of photos) for (const w of new Set(words(p))) counts.set(w, (counts.get(w) ?? 0) + 1);
 const key = (p: Photo) => words(p).filter(w => (counts.get(w) ?? 0) > 1).sort((a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b))[0] ?? '~';
 const groups = new Map<string, Photo[]>(); for (const p of byDate) {const k = key(p); groups.set(k, [...(groups.get(k) ?? []), p]);}
 return [...groups.values()].flat();
}

/** Cut times: evenly paced, or on the music's beats (the strongest onset near each even cut). */
export async function cutTimes(n: number, o: {seconds?: number; music?: string; length?: number}): Promise<number[]> {
 if (!o.music) {const per = o.length ? o.length / n : o.seconds ?? 3.5; return Array.from({length: n + 1}, (_, i) => Math.round(i * per * 100) / 100);}
 const x = await decodeMono(o.music, 8000), hop = 400, env: number[] = [];
 for (let f = 0; (f + 1) * hop <= x.length; f++) {let s = 0; for (let i = f * hop; i < (f + 1) * hop; i++) s += x[i]! * x[i]!; env.push(Math.sqrt(s / hop));}
 const flux = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? v)));
 const total = Math.min(o.length ?? n * (o.seconds ?? 3.5), env.length * hop / 8000), per = total / n, t = [0];
 for (let i = 1; i < n; i++) {
  const want = i * per, lo = Math.floor((want - Math.min(0.5, per * 0.25)) * 20), hi = Math.ceil((want + Math.min(0.5, per * 0.25)) * 20);
  let best = Math.round(want * 20); for (let f = Math.max(lo, 1); f <= Math.min(hi, flux.length - 1); f++) if (flux[f]! > flux[best]!) best = f;
  t.push(Math.max(t[t.length - 1]! + 1, best / 20));
 }
 t.push(total);
 return t.map(v => Math.round(v * 100) / 100);
}

const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const SHAPES: Record<string, [number, number]> = {'9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350]};

async function titlePng(text: string, width: number, out: string) {
 const browser = await chromium.launch({headless: true, executablePath: chromiumExecutable()});
 try {
  const page = await browser.newPage({viewport: {width, height: Math.round(width * 0.6)}, deviceScaleFactor: 1});
  const esc = text.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]!));
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent"><div id="t" dir="auto" style="display:inline-block;max-width:${Math.round(width * 0.86)}px;padding:${Math.round(width * 0.02)}px ${Math.round(width * 0.03)}px;font:800 ${Math.round(width * 0.075)}px/1.1 system-ui,sans-serif;color:#fff;text-shadow:0 ${Math.round(width * 0.004)}px ${Math.round(width * 0.02)}px rgba(0,0,0,.55)">${esc}</div></body></html>`);
  fs.writeFileSync(out, await (await page.$('#t'))!.screenshot({omitBackground: true, type: 'png'}));
 } finally {await browser.close();}
 return out;
}

/** Makes the photo story. */
export async function photoStory(inputs: string[], o: {out?: string; order?: Order; shape?: string; seconds?: number; length?: number; music?: string; title?: string; about?: Record<string, string>; fade?: number; onStep?: (s: string) => void} = {}) {
 const [W, H] = SHAPES[o.shape ?? '9:16'] ?? SHAPES['9:16']!, fps = 30, fade = o.fade ?? 0.6;
 o.onStep?.('Reading the photos');
 const photos = orderPhotos(await readPhotos(inputs, {...(o.about ? {about: o.about} : {})}), o.order ?? (o.about ? 'about' : 'date'));
 const cuts = await cutTimes(photos.length, {...(o.seconds ? {seconds: o.seconds} : {}), ...(o.music ? {music: path.resolve(o.music)} : {}), ...(o.length ? {length: o.length} : {})});
 const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tempoloom-story-'));
 try {
  const parts: string[] = [];
  for (const [i, p] of photos.entries()) {
   o.onStep?.(`Moving photo ${i + 1} of ${photos.length}`);
   const dur = cuts[i + 1]! - cuts[i]! + (i < photos.length - 1 ? fade : 0), frames = Math.max(2, Math.round(dur * fps));
   // Upright first, then fitted: a photo of the frame's own shape fills it; another shape sits on a blurred copy of itself.
   const rot = p.orientation === 3 ? 'hflip,vflip,' : p.orientation === 6 ? 'transpose=1,' : p.orientation === 8 ? 'transpose=2,' : '';
   const fill = Math.abs(p.width / p.height - W / H) / (W / H) < 0.3;
   const S = 2; // drawn at twice the size, so the slow zoom stays sharp
   const base = fill ? `${rot}scale=${W * S}:${H * S}:force_original_aspect_ratio=increase,crop=${W * S}:${H * S}`
    : `${rot}split[a][b];[a]scale=${W * S}:${H * S}:force_original_aspect_ratio=increase,crop=${W * S}:${H * S},gblur=sigma=40,eq=brightness=-0.08[bg];[b]scale=${W * S}:${H * S}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
   // In or out, alternately, drifting towards (or away from) where the eye goes.
   const zin = i % 2 === 0, z0 = zin ? 1 : 1.12, z1 = zin ? 1.12 : 1, fx = fill ? p.focus.x : 0.5, fy = fill ? p.focus.y : 0.5;
   const z = `${z0}+(${z1 - z0})*on/${frames}`;
   const x = `(iw-iw/zoom)*(0.5+(${(fx - 0.5).toFixed(3)})*(zoom-1)/0.12)`, y = `(ih-ih/zoom)*(0.5+(${(fy - 0.5).toFixed(3)})*(zoom-1)/0.12)`;
   const seg = path.join(tmp, `p${String(i).padStart(3, '0')}.mp4`);
   await run(ffmpeg, ['-v', 'error', '-y', '-i', p.file, '-filter_complex', `${base},zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${W}x${H}:fps=${fps},setsar=1,format=yuv420p[v]`, '-map', '[v]', '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', seg]);
   parts.push(seg);
  }
  o.onStep?.('Joining them');
  let graph = '', last = '0:v', at = 0;
  for (let i = 1; i < parts.length; i++) {at += cuts[i]! - cuts[i - 1]!; graph += `${graph ? ';' : ''}[${last}][${i}:v]xfade=transition=fade:duration=${fade}:offset=${(at).toFixed(3)}[x${i}]`; last = `x${i}`;}
  const total = cuts[cuts.length - 1]!;
  let inputs2 = parts.flatMap(f => ['-i', f]);
  if (o.title) {
   const png = await titlePng(o.title, W, path.join(tmp, 'title.png'));
   inputs2 = [...inputs2, '-loop', '1', '-i', png];
   graph += `${graph ? ';' : ''}[${parts.length}:v]format=rgba,fade=t=in:st=0.3:d=0.6:alpha=1,fade=t=out:st=${Math.min(3.6, total - 0.5).toFixed(2)}:d=0.6:alpha=1[t];[${last}][t]overlay=(W-w)/2:H*0.72-h/2:shortest=1[tv]`;
   last = 'tv';
  }
  const music = o.music ? ['-i', path.resolve(o.music)] : [];
  const audio = o.music ? ['-map', `${parts.length + (o.title ? 1 : 0)}:a`, '-af', `afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5`, '-c:a', 'aac', '-b:a', '192k'] : [];
  const dir = path.dirname(path.resolve(o.out ?? path.join(path.dirname(photos[0]!.file), 'photo-story.mp4')));
  fs.mkdirSync(dir, {recursive: true});
  let out = path.resolve(o.out ?? path.join(dir, 'photo-story.mp4'));
  for (let k = 2; fs.existsSync(out); k++) out = out.replace(/(-\d+)?\.mp4$/, `-${k}.mp4`);
  await run(ffmpeg, ['-v', 'error', '-n', ...inputs2, ...music, '-filter_complex', graph, '-map', `[${last}]`, ...audio, '-t', total.toFixed(3), '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  return {output: out, seconds: total, photos: photos.map((p, i) => ({file: p.file, from: cuts[i]!, to: cuts[i + 1]!, taken: p.taken ? local(p.taken) : null, dateFrom: p.dateFrom, ...(p.about ? {about: p.about} : {}), move: i % 2 === 0 ? 'in' : 'out'})), order: o.order ?? (o.about ? 'about' : 'date'), paced: o.music ? 'on the music' : 'evenly'};
 } finally {fs.rmSync(tmp, {recursive: true, force: true});}
}
