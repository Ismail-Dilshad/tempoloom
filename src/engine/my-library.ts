// Your library: the logos, music, sounds, pictures and clips you use again and again, kept in one
// place, described by what they show (or sound like), searchable from any job, and remembered with
// the jobs that used them. Clips join the b-roll library (split into shots, each described);
// pictures and sounds are copied in, so a job can always find them. Files of yours are never changed.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {ROOT} from './config.js';
import {ffmpeg, probe, run} from '../renderer/ffmpeg-encoder.js';

export const LIB_KINDS = ['logo', 'image', 'music', 'sound', 'clip'] as const;
export type LibKind = typeof LIB_KINDS[number];
export type LibEntry = {id: string; kind: LibKind; name: string; file: string; original: string; added: string; bytes: number;
 description: string; by: 'name' | 'you' | 'agent'; tags: string[]; width?: number; height?: number; seconds?: number; transparent?: number;
 colours?: string[]; bpm?: number | null; energy?: 'calm' | 'steady' | 'lively'; sheet?: string; clip?: string; uses: {job: string; at: string}[]};

export const libraryRoot = () => path.resolve(ROOT, process.env.VIDEO_WORKSPACE || 'workspace', 'library');
const indexFile = () => path.join(libraryRoot(), 'index.json');
export function libraryEntries(): LibEntry[] {try {return (JSON.parse(fs.readFileSync(indexFile(), 'utf8')) as {entries: LibEntry[]}).entries;} catch {return [];}}
function save(entries: LibEntry[]) {fs.mkdirSync(libraryRoot(), {recursive: true}); const tmp = indexFile() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({version: 1, entries}, null, 1) + '\n'); fs.renameSync(tmp, indexFile());}
const fromName = (f: string) => path.basename(f, path.extname(f)).replace(/^(img|vid|mvi|dsc|pxl|gopr)[_-]?\d+/i, '').replace(/[_\-.]+/g, ' ').replace(/\b\d{6,}\b/g, '').replace(/\s+/g, ' ').trim();

const IMAGE = /\.(png|jpe?g|webp|svg|gif|bmp)$/i, AUDIO = /\.(mp3|wav|m4a|aac|flac|ogg|opus)$/i, VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i;

function raw(file: string, args: string[]): Promise<Buffer> {
 return new Promise((resolve, reject) => {const c = spawn(ffmpeg, ['-v', 'error', '-i', file, ...args, '-'], {windowsHide: true}); const p: Buffer[] = []; let e = '';
  c.stdout.on('data', (d: Buffer) => p.push(d)); c.stderr.on('data', d => e += d); c.on('error', reject); c.on('close', code => code === 0 ? resolve(Buffer.concat(p)) : reject(new Error(e.slice(-300))));});
}
/** A picture: its size, how much of it is see-through, and its main colours. */
async function readImage(file: string) {
 const info = await probe(file).catch(() => null), v = (info?.streams as {width?: number; height?: number}[] | undefined)?.[0];
 const px = await raw(file, ['-frames:v', '1', '-vf', 'scale=48:48,format=rgba', '-f', 'rawvideo', '-pix_fmt', 'rgba']).catch(() => Buffer.alloc(0));
 let clear = 0, n = 0; const bins = new Map<string, number>();
 for (let i = 0; i + 3 < px.length; i += 4) {n++; if (px[i + 3]! < 40) {clear++; continue;} const k = [0, 1, 2].map(c => Math.min(255, Math.round(px[i + c]! / 51) * 51).toString(16).padStart(2, '0')).join(''); bins.set(k, (bins.get(k) ?? 0) + 1);}
 const colours = [...bins].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => '#' + k);
 return {width: v?.width, height: v?.height, transparent: n ? Math.round(clear / n * 100) / 100 : 0, colours};
}
/** A sound: its length, tempo (from the rhythm of its hits) and how much is going on. */
async function readAudio(file: string) {
 const {decodeMono} = await import('../editor/pcm.js'), R = 8000, x = await decodeMono(file, R), hop = 80, env: number[] = [];
 for (let f = 0; (f + 1) * hop <= x.length; f++) {let s = 0; for (let i = f * hop; i < (f + 1) * hop; i++) s += x[i]! * x[i]!; env.push(Math.sqrt(s / hop));}
 const flux = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? v))), mean = flux.reduce((a, b) => a + b, 0) / (flux.length || 1);
 let best = 0, bpm: number | null = null;
 if (env.length > 400) for (let b = 60; b <= 180; b++) {const lag = Math.round(60 / b * 100); let s = 0; for (let i = lag; i < flux.length; i++) s += flux[i]! * flux[i - lag]!; s /= flux.length - lag; s *= Math.exp(-0.5 * (Math.log2(b / 120) / 0.9) ** 2); /* a tempo and its half or double match alike: the one nearer common tempos wins */ if (s > best) {best = s; bpm = b;}}
 const onsets = flux.filter(v => v > mean * 3).length / Math.max(1, x.length / R);
 const rms = Math.sqrt(env.reduce((a, b) => a + b * b, 0) / (env.length || 1));
 return {seconds: Math.round(x.length / R * 10) / 10, bpm: best > mean * mean * 1.5 ? bpm : null, energy: (onsets > 3 || (bpm ?? 0) >= 120 ? 'lively' : onsets < 1 && (bpm ?? 100) < 95 ? 'calm' : 'steady') as LibEntry['energy'], loud: rms};
}
const guessKind = (file: string, img?: {transparent: number}): LibKind => VIDEO.test(file) ? 'clip' : AUDIO.test(file) ? 'music' : /\.svg$/i.test(file) || /logo|brand|mark|icon/i.test(path.basename(file)) || (img && img.transparent > 0.15) ? 'logo' : 'image';

/** Adds files (or every file of a folder) to the library. Adding the same file again does nothing. */
export async function addToLibrary(inputs: string[], o: {kind?: LibKind; tags?: string[]; about?: string; copyClips?: boolean; onStep?: (s: string) => void} = {}) {
 const files = inputs.flatMap(f => {const p = path.resolve(f); if (!fs.existsSync(p)) throw new Error('No such file or folder: ' + p); return fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(n => IMAGE.test(n) || AUDIO.test(n) || VIDEO.test(n)).sort().map(n => path.join(p, n)) : [p];});
 if (!files.length) throw new Error('No pictures, sounds or videos to add');
 const entries = libraryEntries(), added: LibEntry[] = [], skipped: string[] = [];
 for (const file of files) {
  if (!IMAGE.test(file) && !AUDIO.test(file) && !VIDEO.test(file)) {skipped.push(`${path.basename(file)} (not a picture, sound or video)`); continue;}
  const hash = createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  if (entries.some(e => e.id.endsWith(hash))) {skipped.push(`${path.basename(file)} (already in the library)`); continue;}
  o.onStep?.(`Adding ${path.basename(file)}`);
  const now = new Date().toISOString(), base = {name: path.basename(file), original: file, added: now, bytes: fs.statSync(file).size, description: o.about ?? fromName(file), by: (o.about ? 'you' : 'name') as LibEntry['by'], tags: o.tags ?? [], uses: []};
  if (VIDEO.test(file)) {
   // Clips go to the b-roll library: shots, a sheet of each, descriptions an edit can match.
   const B = await import('../editor/broll.js');
   const source = o.copyClips ? path.join(libraryRoot(), 'files', hash, path.basename(file)) : file;
   if (source !== file) {
    await fs.promises.mkdir(path.dirname(source), {recursive: true});
    await fs.promises.copyFile(file, source);
   }
   try {await B.addClips([source]);}
   catch (error) {if (source !== file) await fs.promises.rm(source, {force: true}); throw error;}
   const c = B.library().find(x => x.file === source)!;
   if (o.about) B.describe(c.id, 1, o.about, 'you');
   added.push({...base, id: 'clip-' + hash, kind: 'clip', file: source, clip: c.id, width: c.width, height: c.height, seconds: Math.round(c.duration * 10) / 10, sheet: c.shots[0]?.sheet});
   continue;
  }
  const dir = path.join(libraryRoot(), 'files'), sheets = path.join(libraryRoot(), 'sheets');
  fs.mkdirSync(dir, {recursive: true}); fs.mkdirSync(sheets, {recursive: true});
  const copy = path.join(dir, `${hash}-${path.basename(file).replace(/[^\w.-]+/g, '-')}`);
  fs.copyFileSync(file, copy);
  if (AUDIO.test(file)) {
   const a = await readAudio(copy), kind: LibKind = o.kind ?? (a.seconds >= 20 ? 'music' : 'sound'), sheet = path.join(sheets, hash + '.png');
   await run(ffmpeg, ['-v', 'error', '-y', '-i', copy, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=480x96:colors=0x8fb3ff', '-frames:v', '1', sheet]).catch(() => undefined);
   added.push({...base, id: `${kind}-${hash}`, kind, file: copy, seconds: a.seconds, bpm: a.bpm, energy: a.energy, ...(fs.existsSync(sheet) ? {sheet} : {})});
  } else {
   const img = await readImage(copy), kind = o.kind ?? guessKind(file, img), sheet = path.join(sheets, hash + '.png');
   await run(ffmpeg, ['-v', 'error', '-y', '-i', copy, '-frames:v', '1', '-vf', 'scale=320:320:force_original_aspect_ratio=decrease', sheet]).catch(() => undefined);
   added.push({...base, id: `${kind}-${hash}`, kind, file: copy, ...(img.width ? {width: img.width, height: img.height} : {}), transparent: img.transparent, colours: img.colours, ...(fs.existsSync(sheet) ? {sheet} : {})});
  }
 }
 save([...entries, ...added]);
 return {added: added.map(e => ({id: e.id, kind: e.kind, name: e.name, description: e.description})), skipped, total: entries.length + added.length,
  next: added.some(e => e.by === 'name') ? 'Say what each shows or sounds like, so search finds it: pnpm tempoloom library describe ID "WHAT IT SHOWS" (look at its sheet first).' : undefined};
}

export function libraryEntry(id: string) {const e = libraryEntries().find(x => x.id === id); if (!e) throw new Error(`No "${id}" in your library. See it: pnpm tempoloom library list`); return e;}

/** Says what an entry shows or sounds like (for a clip, its first shot unless `shot`). */
export async function describeEntry(id: string, text: string, o: {by?: 'you' | 'agent'; shot?: number; tags?: string[]} = {}) {
 const t = text.replace(/\s+/g, ' ').trim(); if (t.length < 3) throw new Error('Say what it shows or sounds like, in a few words');
 const entries = libraryEntries(), e = entries.find(x => x.id === id); if (!e) throw new Error(`No "${id}" in your library`);
 if (e.kind === 'clip' && e.clip) (await import('../editor/broll.js')).describe(e.clip, o.shot ?? 1, t, o.by ?? 'you');
 if (e.kind !== 'clip' || (o.shot ?? 1) === 1) {e.description = t.slice(0, 300); e.by = o.by ?? 'you';}
 if (o.tags) e.tags = [...new Set([...e.tags, ...o.tags])].slice(0, 20);
 save(entries);
 return {id, description: e.description, tags: e.tags};
}

/** Records that a job used an entry (shown with it, and a reason to keep it). */
export function useEntry(id: string, job: string) {
 const entries = libraryEntries(), e = entries.find(x => x.id === id); if (!e) throw new Error(`No "${id}" in your library`);
 if (!e.uses.some(u => u.job === job)) e.uses.push({job, at: new Date().toISOString()});
 save(entries);
 return {id, file: e.file, kind: e.kind, usedIn: e.uses.map(u => u.job)};
}

/** Takes an entry out of the library: its copy and sheet go; your own file stays where it was. */
export async function removeEntry(id: string) {
 const entries = libraryEntries(), e = entries.find(x => x.id === id); if (!e) throw new Error(`No "${id}" in your library`);
 if (e.kind === 'clip' && e.clip) {
  try {(await import('../editor/broll.js')).removeClip(e.clip);} catch {/* already gone */}
  if (e.file !== e.original && e.file.startsWith(libraryRoot() + path.sep)) fs.rmSync(e.file, {force: true});
 }
 else {if (e.file.startsWith(libraryRoot())) fs.rmSync(e.file, {force: true}); if (e.sheet?.startsWith(libraryRoot())) fs.rmSync(e.sheet, {force: true});}
 save(entries.filter(x => x !== e));
 return {removed: e.name, note: 'Your own file is where it was; only the library\'s copy was removed.'};
}

/** Words that say what an entry is, for search: its kind, shape, colours, tempo and energy. */
export function entryWords(e: LibEntry): string[] {
 const w: string[] = [e.kind, e.kind === 'clip' ? 'video b-roll footage' : e.kind === 'music' ? 'music track song' : e.kind === 'sound' ? 'sound effect sfx' : e.kind === 'logo' ? 'logo brand mark' : 'picture photo image'];
 if (e.width && e.height) w.push(e.height > e.width * 1.2 ? 'vertical portrait' : e.width > e.height * 1.2 ? 'horizontal landscape wide' : 'square');
 if (e.transparent && e.transparent > 0.15) w.push('transparent cut-out');
 if (e.energy) w.push(e.energy === 'calm' ? 'calm slow quiet soft' : e.energy === 'lively' ? 'lively upbeat energetic fast' : 'steady');
 if (e.bpm) w.push(`${e.bpm} bpm`);
 if (e.seconds) w.push(e.seconds < 10 ? 'short' : e.seconds > 120 ? 'long' : '');
 if (e.uses.length) w.push('used before');
 return w.filter(Boolean);
}
