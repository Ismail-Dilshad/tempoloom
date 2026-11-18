// Speaker labels: who speaks when in an interview, a name for each voice, and a name bar on screen
// when a speaker first appears. The voices are told apart by their sound (the shape of the
// spectrum, MFCCs, and the pitch), each stretch of speech is grouped with the ones that sound alike,
// and the groups are named from the user's list or from how people introduce themselves.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../renderer/browser-path.js';
import {decodeMono, frameLevels, percentile, median, fft} from './pcm.js';

const RATE = 16000, HOP = 160, WIN = 400, NFFT = 512, MELS = 26, CEPS = 13;

export type Word = {word: string; start: number; end: number; speaker?: string | undefined};
export type Turn = {speaker: string; start: number; end: number; text?: string};
export type Speaker = {id: string; name: string; seconds: number; turns: number; pitchHz: number | null; named: 'given' | 'introduced' | 'letter'};
export type SpeakerResult = {speakers: Speaker[]; turns: Turn[]; separation: number; notes: string[]};

// ---------------------------------------------------------------------------------------------
// Features: MFCCs and pitch per 10 ms frame
// ---------------------------------------------------------------------------------------------
function melBank() {
 const mel = (f: number) => 2595 * Math.log10(1 + f / 700), inv = (m: number) => 700 * (10 ** (m / 2595) - 1);
 const lo = mel(80), hi = mel(7000), pts = Array.from({length: MELS + 2}, (_, i) => inv(lo + (hi - lo) * i / (MELS + 1))).map(f => Math.floor((NFFT + 1) * f / RATE));
 return Array.from({length: MELS}, (_, m) => {
  const w = new Float64Array(NFFT / 2 + 1), a = pts[m]!, b = pts[m + 1]!, c = pts[m + 2]!;
  for (let k = a; k < b; k++) w[k] = (k - a) / Math.max(1, b - a);
  for (let k = b; k < c; k++) w[k] = (c - k) / Math.max(1, c - b);
  return w;
 });
}
function features(x: Float32Array) {
 const n = Math.floor((x.length - WIN) / HOP), bank = melBank(), mfcc: Float64Array[] = [], pitch = new Float64Array(n);
 const ham = Float64Array.from({length: WIN}, (_, i) => 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (WIN - 1)));
 const re = new Float64Array(NFFT), im = new Float64Array(NFFT), logm = new Float64Array(MELS);
 for (let f = 0; f < n; f++) {
  re.fill(0); im.fill(0);
  for (let i = 0; i < WIN; i++) re[i] = (x[f * HOP + i]! - 0.97 * (x[f * HOP + i - 1] ?? 0)) * ham[i]!;
  fft(re, im);
  for (let m = 0; m < MELS; m++) {let e = 0; const w = bank[m]!; for (let k = 0; k <= NFFT / 2; k++) if (w[k]) e += w[k]! * (re[k]! * re[k]! + im[k]! * im[k]!); logm[m] = Math.log(e + 1e-10);}
  const c = new Float64Array(CEPS);
  for (let k = 0; k < CEPS; k++) {let s = 0; for (let m = 0; m < MELS; m++) s += logm[m]! * Math.cos(Math.PI * k * (m + 0.5) / MELS); c[k] = s;}
  mfcc.push(c);
  // Pitch (every fourth frame is enough): the strongest normalised autocorrelation, 70 to 400 Hz.
  if (f % 4) continue;
  const s0 = f * HOP; let best = 0, lag = 0, e0 = 0;
  for (let i = 0; i < WIN; i++) e0 += x[s0 + i]! ** 2;
  if (e0 > 1e-6) for (let L = Math.floor(RATE / 400); L <= Math.floor(RATE / 70); L++) {
   let s = 0, e1 = 0; for (let i = 0; i < WIN - L; i++) {s += x[s0 + i]! * x[s0 + i + L]!; e1 += x[s0 + i + L]! ** 2;}
   const r = s / Math.sqrt(e0 * e1 + 1e-12); if (r > best) {best = r; lag = L;}
  }
  pitch[f] = best > 0.5 && lag ? RATE / lag : 0;
 }
 return {mfcc, pitch};
}

// ---------------------------------------------------------------------------------------------
// Stretches of speech: from the words when there is a transcript, else from the sound's level
// ---------------------------------------------------------------------------------------------
function stretches(x: Float32Array, words?: Word[]) {
 const out: {start: number; end: number}[] = [];
 // Long runs are cut into stretches of about 2.5 s, so a speaker change inside a run is found.
 const push = (s: number, e: number) => {const len = e - s, n = Math.max(1, Math.round(len / 2.5)); for (let i = 0; i < n; i++) out.push({start: s + len * i / n, end: s + len * (i + 1) / n});};
 if (words?.length) {
  let s = words[0]!.start, e = words[0]!.end;
  for (const w of words.slice(1)) {if (w.start - e > 0.25) {push(s, e); s = w.start;} e = Math.max(e, w.end);}
  push(s, e);
 } else {
  const L = frameLevels(x, RATE, 10), floor = percentile(L, 0.1), loud = percentile(L, 0.95), thr = floor + Math.max(8, (loud - floor) * 0.35);
  let s = -1, quiet = 0;
  for (let f = 0; f <= L.length; f++) {
   const on = f < L.length && L[f]! > thr;
   if (on) {if (s < 0) s = f; quiet = 0;}
   else if (s >= 0 && ++quiet > 25) {const e = f - quiet; if ((e - s) * 0.01 >= 0.35) push(s * 0.01, e * 0.01); s = -1; quiet = 0;}
  }
  if (s >= 0) push(s * 0.01, (L.length - quiet) * 0.01);
 }
 return out.filter(r => r.end - r.start >= 0.3);
}

// ---------------------------------------------------------------------------------------------
// Grouping voices: average-linkage clustering, the number of voices by silhouette when not given
// ---------------------------------------------------------------------------------------------
const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]!) ** 2, 0));
function cluster(v: number[][], k: number) {
 let groups = v.map((_, i) => [i]);
 const d = v.map(a => v.map(b => dist(a, b)));
 while (groups.length > k) {
  let bi = 0, bj = 1, best = Infinity;
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
   let s = 0; for (const a of groups[i]!) for (const b of groups[j]!) s += d[a]![b]!;
   s /= groups[i]!.length * groups[j]!.length; if (s < best) {best = s; bi = i; bj = j;}
  }
  groups[bi] = [...groups[bi]!, ...groups[bj]!]; groups.splice(bj, 1);
 }
 const label = new Array<number>(v.length).fill(0);
 groups.forEach((g, i) => g.forEach(j => label[j] = i));
 return {label, d};
}
function clusterUntil(v: number[][], limit: number) {
 const groups = v.map((_, i) => [i]), d = v.map(a => v.map(b => dist(a, b)));
 for (;;) {
  let bi = -1, bj = -1, best = Infinity;
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
   let s = 0; for (const a of groups[i]!) for (const b of groups[j]!) s += d[a]![b]!;
   s /= groups[i]!.length * groups[j]!.length; if (s < best) {best = s; bi = i; bj = j;}
  }
  if (bi < 0 || best > limit) break;
  groups[bi] = [...groups[bi]!, ...groups[bj]!]; groups.splice(bj, 1);
 }
 const label = new Array<number>(v.length).fill(0);
 groups.forEach((g, i) => g.forEach(j => label[j] = i));
 return {label, d};
}
function silhouette(label: number[], d: number[][]) {
 const k = Math.max(...label) + 1; if (k < 2) return 0;
 let s = 0;
 for (let i = 0; i < label.length; i++) {
  const mean = (c: number) => {let t = 0, n = 0; for (let j = 0; j < label.length; j++) if (label[j] === c && j !== i) {t += d[i]![j]!; n++;} return n ? t / n : 0;};
  const a = mean(label[i]!); let b = Infinity;
  for (let c = 0; c < k; c++) if (c !== label[i]) b = Math.min(b, mean(c));
  s += (b - a) / Math.max(a, b, 1e-9);
 }
 return s / label.length;
}

const INTRO = /(?:^|[^\p{L}])(?:[Ii]['’]m|[Ii] am|[Mm]y name is|[Mm]y name['’]s|[Tt]his is|[Cc]all me)\s+(\p{Lu}[\p{L}'-]+)/u;
const NOT_NAMES = new Set(['Here', 'Going', 'Not', 'So', 'Just', 'Really', 'Very', 'The', 'A', 'An', 'It', 'Glad', 'Happy', 'Excited', 'Sure', 'Okay', 'Ok', 'Fine', 'Good', 'Great', 'Back', 'From', 'With']);

/** Who speaks when. `count` fixes the number of voices; `names` names them in the order they first
 *  speak (an introduction like "I'm Sara" in a speaker's first words names them too). */
export async function labelSpeakers(file: string, o: {count?: number; names?: string[]; words?: Word[]} = {}): Promise<SpeakerResult> {
 // A transcript whose words already say who speaks (the transcription service told them apart).
 if (o.words?.length && !o.count && o.words.filter(w => w.speaker).length >= o.words.length * 0.8) return fromTranscript(o.words, o.names);
 const x = await decodeMono(path.resolve(file), RATE);
 const parts = stretches(x, o.words);
 const notes: string[] = [];
 if (!parts.length) throw new Error('No speech found');
 const {mfcc, pitch} = features(x);
 const emb = parts.map(p => {
  const a = Math.floor(p.start * 100), b = Math.min(mfcc.length, Math.ceil(p.end * 100)), fr = mfcc.slice(a, b);
  const mean = Array.from({length: CEPS - 1}, (_, k) => fr.reduce((s, c) => s + c[k + 1]!, 0) / Math.max(1, fr.length));
  const sd = mean.map((m, k) => Math.sqrt(fr.reduce((s, c) => s + (c[k + 1]! - m) ** 2, 0) / Math.max(1, fr.length)));
  const f0 = Array.from(pitch.slice(a, b)).filter(v => v > 0);
  return {mean, sd, f0: f0.length >= 5 ? median(f0) : 0};
 });
 const withPitch = emb.filter(e => e.f0).map(e => Math.log(e.f0)), fillF0 = withPitch.length ? median(withPitch) : Math.log(150);
 // Each stretch as one vector on a fixed scale: the spectrum's shape, how much it moves, and the pitch
 // (20 per unit of log pitch: a voice an octave apart is 14 away; one voice's stretches stay within ~3).
 const vec = emb.map(e => [...e.mean, ...e.sd.map(v => v * 0.5), (e.f0 ? Math.log(e.f0) : fillF0) * 20]);
 const SAME = 6;
 let label: number[], separation = 0;
 if (o.count) {const c = cluster(vec, Math.min(o.count, vec.length)); label = c.label; separation = silhouette(c.label, c.d);}
 else {
  // Joined while the closest two groups sound alike; what is left are the voices.
  const c = clusterUntil(vec, SAME); label = c.label; separation = silhouette(c.label, c.d);
  // A "voice" heard for under 3% of the speech is noise or a cough: it joins the nearest voice.
  const total = parts.reduce((a, p) => a + p.end - p.start, 0);
  for (let changed = true; changed;) {
   changed = false;
   const ks = [...new Set(label)];
   if (ks.length < 2) break;
   for (const k of ks) {
    const secs = parts.reduce((a, p, i) => a + (label[i] === k ? p.end - p.start : 0), 0);
    if (secs >= Math.max(1.5, total * 0.03)) continue;
    const mine = vec.filter((_, i) => label[i] === k), centre = (g: number[][]) => g[0]!.map((_, d) => g.reduce((a, v) => a + v[d]!, 0) / g.length), cm = centre(mine);
    const other = ks.filter(j => j !== k).map(j => ({j, d: dist(cm, centre(vec.filter((_, i) => label[i] === j)))})).sort((a, b) => a.d - b.d)[0]!;
    label = label.map(l => l === k ? other.j : l); changed = true; break;
   }
  }
  if (new Set(label).size === 1) separation = 0;
 }
 const best = {label};
 // Short stretches between two of the same speaker are that speaker (a cough, an "mm").
 const lab = [...best.label];
 for (let i = 1; i < lab.length - 1; i++) if (parts[i]!.end - parts[i]!.start < 0.8 && lab[i - 1] === lab[i + 1] && lab[i] !== lab[i - 1]) lab[i] = lab[i - 1]!;
 // Letters in the order the voices first speak.
 const order: number[] = []; for (const l of lab) if (!order.includes(l)) order.push(l);
 const id = (l: number) => String.fromCharCode(65 + order.indexOf(l));
 const turns: Turn[] = [];
 parts.forEach((p, i) => {const s = id(lab[i]!), last = turns[turns.length - 1]; if (last && last.speaker === s && p.start - last.end < 1.5) last.end = p.end; else turns.push({speaker: s, start: Math.round(p.start * 100) / 100, end: Math.round(p.end * 100) / 100});});
 for (const t of turns) t.end = Math.round(t.end * 100) / 100;
 if (o.words?.length) for (const t of turns) t.text = o.words.filter(w => w.start >= t.start - 0.05 && w.end <= t.end + 0.05).map(w => w.word).join(' ').trim();
 const speakers: Speaker[] = order.map((l, i) => {
  const s = String.fromCharCode(65 + i), mine = turns.filter(t => t.speaker === s);
  const f0 = emb.filter((_, j) => lab[j] === l && emb[j]!.f0).map(e => e.f0);
  let name = o.names?.[i]?.trim(), named: Speaker['named'] = name ? 'given' : 'letter';
  if (!name) {const m = mine.slice(0, 2).map(t => t.text ?? '').join(' ').match(INTRO); if (m && !NOT_NAMES.has(m[1]!)) {name = m[1]; named = 'introduced';}}
  return {id: s, name: name ?? `Speaker ${s}`, seconds: Math.round(mine.reduce((a, t) => a + t.end - t.start, 0)), turns: mine.length, pitchHz: f0.length ? Math.round(median(f0)) : null, named};
 });
 if (o.names && o.names.length !== speakers.length) notes.push(`${o.names.length} name${o.names.length > 1 ? 's were' : ' was'} given and ${speakers.length} voice${speakers.length > 1 ? 's were' : ' was'} heard: check the names, or give --count ${o.names.length}.`);
 return {speakers, turns, separation: Math.round(separation * 100) / 100, notes};
}

function fromTranscript(words: Word[], names?: string[]): SpeakerResult {
 const turns: Turn[] = [], order: string[] = [];
 for (const w of words) {
  const k = w.speaker ?? turns[turns.length - 1]?.speaker ?? '?';
  if (!order.includes(k)) order.push(k);
  const s = String.fromCharCode(65 + order.indexOf(k)), last = turns[turns.length - 1];
  if (last && last.speaker === s && w.start - last.end < 1.5) {last.end = w.end; last.text = (last.text + ' ' + w.word).trim();}
  else turns.push({speaker: s, start: w.start, end: w.end, text: w.word});
 }
 const speakers = order.map((_, i): Speaker => {
  const s = String.fromCharCode(65 + i), mine = turns.filter(t => t.speaker === s);
  let name = names?.[i]?.trim(), named: Speaker['named'] = name ? 'given' : 'letter';
  if (!name) {const m = mine.slice(0, 2).map(t => t.text ?? '').join(' ').match(INTRO); if (m && !NOT_NAMES.has(m[1]!)) {name = m[1]; named = 'introduced';}}
  return {id: s, name: name ?? `Speaker ${s}`, seconds: Math.round(mine.reduce((a, t) => a + t.end - t.start, 0)), turns: mine.length, pitchHz: null, named};
 });
 return {speakers, turns, separation: 1, notes: ['Speakers as the transcript told them apart.']};
}

const time = (t: number) => {const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;};

/** Captions that say who speaks: "SARA: ..." on the first line of each turn. */
export function speakerSrt(r: SpeakerResult) {
 const name = (s: string) => r.speakers.find(x => x.id === s)?.name ?? s;
 return r.turns.filter(t => t.text).map((t, i) => `${i + 1}\n${time(t.start)} --> ${time(t.end)}\n${name(t.speaker).toUpperCase()}: ${t.text}\n`).join('\n');
}

/** When each name bar shows: a speaker's first turn, and again after a minute without them. */
export function nameMoments(r: SpeakerResult, o: {hold?: number; again?: number} = {}) {
 const hold = o.hold ?? 4, again = o.again ?? 60, last = new Map<string, number>(), out: {speaker: string; start: number; end: number}[] = [];
 for (const t of r.turns) {
  const prev = last.get(t.speaker);
  if ((prev === undefined || t.start - prev > again) && t.end - t.start >= 1.2) out.push({speaker: t.speaker, start: t.start + 0.3, end: Math.min(t.end, t.start + 0.3 + hold)});
  last.set(t.speaker, t.end);
 }
 return out;
}

/** A name bar (name, and an optional role underneath) as a transparent PNG in the brand's colours and font. */
export async function nameBar(o: {name: string; role?: string; width: number; out: string; colors: {primary: string; accent: string; text: string}; font?: string | null; rtl?: boolean}) {
 const w = Math.round(o.width), size = Math.round(w * 0.09);
 const face = o.font ? `@font-face{font-family:B;src:url(http://bar.local/font)}` : '';
 const esc = (s: string) => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]!));
 const html = `<!doctype html><html dir="${o.rtl ? 'rtl' : 'ltr'}"><head><style>${face}html,body{margin:0;background:transparent}
  #b{display:inline-flex;align-items:stretch;font-family:${o.font ? 'B,' : ''}system-ui,sans-serif;max-width:${w}px}
  .k{width:${Math.round(size * 0.22)}px;background:${o.colors.accent}}
  .t{background:${o.colors.primary};color:${o.colors.text};padding:${Math.round(size * 0.35)}px ${Math.round(size * 0.7)}px}
  .n{font-size:${size}px;font-weight:700;line-height:1.1;white-space:nowrap}.r{font-size:${Math.round(size * 0.55)}px;opacity:.85;margin-top:${Math.round(size * 0.12)}px;white-space:nowrap}</style></head>
  <body><div id="b"><div class="k"></div><div class="t"><div class="n" dir="auto">${esc(o.name)}</div>${o.role ? `<div class="r" dir="auto">${esc(o.role)}</div>` : ''}</div></div></body></html>`;
 const browser = await chromium.launch({headless: true, executablePath: chromiumExecutable()});
 try {
  const page = await browser.newPage({viewport: {width: w + 40, height: size * 4}, deviceScaleFactor: 1});
  await page.route('**/*', async r => {const u = new URL(r.request().url()); if (u.hostname === 'bar.local' && o.font) return r.fulfill({contentType: 'font/ttf', body: fs.readFileSync(o.font)}); return r.abort('blockedbyclient');});
  await page.setContent(html, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const el = await page.$('#b');
  fs.writeFileSync(o.out, await el!.screenshot({omitBackground: true, type: 'png'}));
 } finally {await browser.close();}
 return o.out;
}

/** Labels the speakers of a recording and writes what it found: speakers.json, captions with the
 *  names (when there are words), and with `bars` a copy of the video with a name bar on screen when
 *  each speaker first appears (and again after a minute without them). */
export async function nameSpeakers(file: string, o: {count?: number; names?: string[]; roles?: string[]; words?: Word[]; bars?: boolean; out?: string; onStep?: (s: string) => void} = {}) {
 const src = path.resolve(file);
 if (!fs.existsSync(src)) throw new Error('No such file: ' + src);
 o.onStep?.('Listening for the voices');
 const r = await labelSpeakers(src, {...(o.count ? {count: o.count} : {}), ...(o.names ? {names: o.names} : {}), ...(o.words ? {words: o.words} : {})});
 const stem = src.replace(/\.[^.]+$/, ''), free = (f: string) => {let x = f; for (let k = 2; fs.existsSync(x); k++) x = f.replace(/(\.[^.]+)$/, `-${k}$1`); return x;};
 const json = free(stem + '.speakers.json');
 fs.writeFileSync(json, JSON.stringify({file: src, ...r}, null, 1) + '\n');
 const srt = r.turns.some(t => t.text) ? free(stem + '.speakers.srt') : null;
 if (srt) fs.writeFileSync(srt, speakerSrt(r));
 let video: string | null = null;
 const moments = nameMoments(r);
 if (o.bars) {
  const {mediaInfo, runEdl} = await import('./editor.js');
  const info = await mediaInfo(src);
  if (!info.width) throw new Error('Name bars need a video; this file has no picture');
  const {brandProfile} = await import('../engine/brand.js'), {fontCatalog} = await import('../engine/font-catalog.js'), {ROOT} = await import('../engine/config.js');
  const brand = await brandProfile(), cat = await fontCatalog();
  const font = cat.fonts.find(f => f.id === brand.fonts.en && f.available) ?? cat.fonts.find(f => f.id === 'inter' && f.available) ?? null;
  const dir = path.join(path.dirname(json), path.basename(stem) + '-name-bars');
  fs.mkdirSync(dir, {recursive: true});
  const width = Math.round(info.width * (info.height > info.width ? 0.62 : 0.36));
  const colors = {primary: brand.colors.primary ?? '#0B1F4A', accent: brand.colors.accent ?? '#4C8DFF', text: '#FFFFFF'};
  const png: Record<string, string> = {};
  for (const [i, s] of r.speakers.entries()) {
   o.onStep?.(`Name bar for ${s.name}`);
   png[s.id] = await nameBar({name: s.name, ...(o.roles?.[i] ? {role: o.roles[i]} : {}), width, out: path.join(dir, `${s.id}.png`), colors, font: font ? path.resolve(ROOT, font.path) : null});
  }
  // A bar sits in the lower left (lower third), its width from the picture it was drawn for.
  const items = moments.map(m => {const f = png[m.speaker]!, w = fs.readFileSync(f).readUInt32BE(16), frac = Math.min(0.9, w / info.width);
   return {file: f, start: m.start, end: m.end, x: 0.05 + frac / 2, y: info.height > info.width ? 0.68 : 0.8, width: frac};});
  if (items.length) {
   o.onStep?.('Putting the names on screen');
   const out = free(o.out ? path.resolve(o.out) : stem + '-names.mp4');
   video = (await runEdl({version: 1, input: src, operations: [{op: 'overlays', items}]}, path.dirname(src), {output: out})).output;
  }
 }
 return {...r, json, srt, nameBars: moments.map(m => ({speaker: r.speakers.find(s => s.id === m.speaker)!.name, from: m.start, to: m.end})), video};
}
