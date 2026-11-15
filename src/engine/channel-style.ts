// Learn from a channel: a creator's latest videos (a link to their channel or profile, or a folder of
// their videos) studied as one style. Each video is measured (cut pace, motion, colour, layout,
// sound) and the downloads are deleted; what the videos share is the channel's style, saved as a
// look to use with --like, with what stays the same from video to video and what changes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ffmpeg, run} from '../renderer/ffmpeg-encoder.js';
import {measure, type Measured} from './teach/measure.js';
import {lookFromMeasurements, looksDir, lookName, type Look} from './looks.js';

const VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i;
export type ChannelVideo = {title: string; source: string; seconds: number; measured: Measured};
export type Trait = {what: string; value: string; steady: boolean; spread: number};

const median = (a: number[]) => {const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1]! : (s[(s.length >> 1) - 1]! + s[s.length >> 1]!) / 2) : NaN;};
/** How much a number moves between videos: the middle half's width against the median. */
const spread = (a: number[]) => {const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (s.length < 3) return 0; const q = (p: number) => s[Math.floor(p * (s.length - 1))]!; const m = median(s); return Math.abs(m) > 1e-6 ? Math.round((q(0.75) - q(0.25)) / Math.abs(m) * 100) / 100 : 0;};
const hueOf = (hex: string) => {const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round((h * 60 + 360) % 360);};

/** What the channel's videos share, and what changes between them. */
export function channelTraits(vs: ChannelVideo[]): Trait[] {
 const t: Trait[] = [], m = vs.map(v => v.measured);
 // Steady: the middle half of the videos within 35% of the median (or, for a 0-1 measure, within 0.1).
 const iqr = (xs: number[]) => {const s = xs.filter(Number.isFinite).sort((x, y) => x - y); return s.length < 3 ? 0 : s[Math.floor(0.75 * (s.length - 1))]! - s[Math.floor(0.25 * (s.length - 1))]!;};
 const add = (what: string, xs: number[], fmt: (v: number) => string, unit?: number) => {const sp = spread(xs); t.push({what, value: fmt(median(xs)), steady: unit ? iqr(xs) <= unit : sp <= 0.35, spread: unit ? Math.round(iqr(xs) * 100) / 100 : sp});};
 add('Length', vs.map(v => v.seconds), v => `${Math.round(v)} s`);
 add('Cut pace', m.map(x => x.pacing.cutsPerMinute), v => `${Math.round(v)} cuts a minute`);
 add('Shot length', m.map(x => x.pacing.shotMedian), v => `${v.toFixed(1)} s a shot`);
 add('First cut', m.map(x => x.pacing.firstCut ?? NaN), v => Number.isFinite(v) ? `at ${v.toFixed(1)} s` : 'none');
 add('Movement inside shots', m.map(x => x.motion.energy), v => v >= 10 ? 'fast and busy' : v >= 5 ? 'lively' : v >= 2 ? 'even' : 'calm', 2);
 add('Brightness', m.map(x => x.color.brightness), v => v < 0.28 ? 'dark' : v > 0.7 ? 'light' : 'middle', 0.1);
 add('Colour', m.map(x => x.color.saturation), v => v > 0.45 ? 'vivid' : v < 0.15 ? 'muted' : 'moderate', 0.1);
 const shapes = vs.map(v => v.measured.media.shape), shape = [...new Set(shapes)].sort((a, b) => shapes.filter(x => x === b).length - shapes.filter(x => x === a).length)[0]!;
 t.push({what: 'Shape', value: shape, steady: shapes.filter(x => x === shape).length >= shapes.length * 0.8, spread: 0});
 const bg = m.map(x => hueOf(x.color.background)).filter(h => h >= 0);
 if (bg.length >= 2) {const near = bg.filter(h => Math.min(Math.abs(h - bg[0]!), 360 - Math.abs(h - bg[0]!)) < 30).length; t.push({what: 'Background colour', value: m[0]!.color.background, steady: near >= bg.length * 0.7, spread: 1 - near / bg.length});}
 const snd = m.map(x => x.sound?.bpm ?? NaN).filter(Number.isFinite);
 if (snd.length >= 2) add('Music tempo', snd, v => `${Math.round(v)} BPM`);
 const textUp = m.map(x => x.layout.top), textLow = m.map(x => x.layout.bottom);
 add('Busy at the top', textUp, v => `${Math.round(v * 100)}%`, 0.1); add('Busy at the bottom', textLow, v => `${Math.round(v * 100)}%`, 0.1);
 return t;
}

/** The channel's style as one look, from the median of its videos. */
export function channelLook(vs: ChannelVideo[], name: string, source: Look['source']): Look {
 const m = vs.map(v => v.measured), med = (f: (x: Measured) => number) => median(m.map(f));
 // The palette: the colours that come back across the videos, by how much of the frame they cover.
 const counts = new Map<string, number>(); for (const x of m) for (const p of x.color.palette) counts.set(p.hex, (counts.get(p.hex) ?? 0) + p.share);
 const palette = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex, share]) => ({hex, share: share / m.length, saturation: 0.5}));
 const bgs = m.map(x => x.color.background), background = bgs.sort((a, b) => bgs.filter(x => x === b).length - bgs.filter(x => x === a).length)[0]!;
 const accents = m.map(x => x.color.accent).filter((x): x is string => !!x);
 const item = {kind: 'video', durationSeconds: med(x => x.media.seconds), brightness: med(x => x.color.brightness),
  palette: {roles: {background, ...(accents[0] ? {accent: accents[0]} : {})}, colours: palette},
  rhythm: {averageShotSeconds: med(x => x.pacing.shotMedian) || null, cutsPerMinute: med(x => x.pacing.cutsPerMinute)},
  motion: {energyMean: med(x => x.motion.energy), burstsPerSecond: med(x => x.motion.burstsPerSecond), dominantEasing: null}};
 const s = m.filter(x => x.sound), audio = s.length ? {bpm: median(s.map(x => x.sound!.bpm)), confidence: median(s.map(x => x.sound!.tempoConfidence)), onsetsPerSecond: median(s.map(x => x.sound!.eventsPerSecond)), lufs: median(s.map(x => x.sound!.lufs ?? NaN)) || null} : null;
 const look = lookFromMeasurements([item], name, source, {audio});
 look.summary = [`${vs.length} videos of ${source.creator ?? source.title ?? 'one channel'}`, ...look.summary];
 return look;
}

/** One frame from the middle of each video, side by side: what the channel looks like at a glance. */
async function contactSheet(files: string[], out: string) {
 const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tempoloom-channel-'));
 try {
  const frames: string[] = [];
  for (const [i, f] of files.entries()) {
   const fr = path.join(tmp, `f${String(i).padStart(2, '0')}.jpg`);
   await run(ffmpeg, ['-v', 'error', '-y', '-ss', '2.5', '-i', f, '-frames:v', '1', '-vf', 'scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2:color=0x101010', fr]).catch(() => undefined);
   if (fs.existsSync(fr)) frames.push(fr);
  }
  if (!frames.length) return null;
  const cols = Math.min(10, frames.length), rows = Math.ceil(frames.length / cols);
  await run(ffmpeg, ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, 'f%02d.jpg'), '-vf', `tile=${cols}x${rows}:padding=4:color=0x101010`, '-frames:v', '1', '-q:v', '3', out]);
  return out;
 } finally {fs.rmSync(tmp, {recursive: true, force: true});}
}

export type ChannelOptions = {name: string; count?: number; confirm?: boolean; seconds?: number; out?: string; onStep?: (s: string) => void;
 /** Tests: stand-ins for listing a channel and downloading one of its videos. */
 list?: (url: string, n: number) => Promise<{channel: string | null; items: {id: string; title: string; url: string; duration: number | null}[]}>;
 download?: (url: string, section: string) => Promise<{video: string; folder: string}>};

/** Studies a channel (a link) or a folder of a creator's videos as one style. A link lists the latest
 *  videos first; they are downloaded (the first `seconds` of each, for study only) with confirm, and
 *  every download is deleted once measured. */
export async function learnChannel(input: string, o: ChannelOptions) {
 const name = lookName.parse(o.name.startsWith('channel-') ? o.name : 'channel-' + o.name), n = Math.max(3, Math.min(30, o.count ?? 20)), secs = o.seconds ?? 45;
 const videos: ChannelVideo[] = [], sheetFiles: string[] = [];
 let source: Look['source'];
 const cleanup: string[] = [];
 try {
  if (/^https?:\/\//i.test(input)) {
   const list = o.list ?? (async (url: string, k: number) => (await import('../reach/backends/ytdlp.js')).channelVideos({target: url, limit: k, timeout: 180, domains: (await import('./sourcing/reference-video.js')).sourceDomains(url)}));
   o.onStep?.('Listing the channel\'s latest videos');
   const ch = await list(input, n);
   if (!o.confirm) return {status: 'needs-confirmation' as const, channel: ch.channel, videos: ch.items.map(v => ({title: v.title, url: v.url, seconds: v.duration})),
    next: `To study them, run again with --confirm: the first ${secs} s of each of these ${ch.items.length} videos are downloaded for study only, measured, and deleted.`};
   source = {url: input, title: ch.channel ?? undefined, creator: ch.channel};
   const dl = o.download ?? (async (url: string, section: string) => {const d = await (await import('./sourcing/reference-video.js')).downloadReference(url, {section, maxHeight: 720}); return {video: d.video, folder: d.folder};});
   for (const [i, v] of ch.items.entries()) {
    o.onStep?.(`Studying video ${i + 1} of ${ch.items.length}: ${v.title}`);
    try {
     const d = await dl(v.url, `0-${secs}`); cleanup.push(d.folder);
     const frame = path.join(os.tmpdir(), `tempoloom-chf-${process.pid}-${i}.mp4`);
     fs.copyFileSync(d.video, frame); sheetFiles.push(frame); cleanup.push(frame);
     videos.push({title: v.title, source: v.url, seconds: v.duration ?? 0, measured: await measure(d.video, {sound: true})});
    } catch (e) {o.onStep?.(`Skipped "${v.title}": ${(e as Error).message.slice(0, 120)}`);}
   }
  } else {
   const dir = path.resolve(input);
   if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error('Give a link to a channel or profile, or a folder of the creator\'s videos');
   const files = fs.readdirSync(dir).filter(f => VIDEO.test(f)).sort().slice(0, n).map(f => path.join(dir, f));
   source = {file: path.basename(dir), title: path.basename(dir), creator: null};
   for (const [i, f] of files.entries()) {
    o.onStep?.(`Studying video ${i + 1} of ${files.length}: ${path.basename(f)}`);
    const m = await measure(f, {sound: true});
    videos.push({title: path.basename(f), source: f, seconds: m.media.seconds, measured: m}); sheetFiles.push(f);
   }
  }
  if (videos.length < 3) throw new Error(`Only ${videos.length} video${videos.length === 1 ? '' : 's'} could be studied; a channel's style needs at least 3`);
  const traits = channelTraits(videos), look = channelLook(videos, name, source!);
  const steady = traits.filter(t => t.steady), varies = traits.filter(t => !t.steady);
  look.summary.push(...steady.slice(0, 6).map(t => `${t.what.toLowerCase()}: ${t.value} in every video`));
  fs.mkdirSync(looksDir(), {recursive: true});
  const file = path.join(looksDir(), look.name + '.json');
  fs.writeFileSync(file, JSON.stringify(look, null, 1) + '\n');
  const folder = path.resolve(o.out ?? path.join(looksDir(), look.name + '-channel'));
  fs.mkdirSync(folder, {recursive: true});
  const sheet = await contactSheet(sheetFiles, path.join(folder, 'sheet.jpg'));
  const report = {name: look.name, source, videos: videos.map(v => ({title: v.title, source: v.source, seconds: Math.round(v.measured.media.seconds), cutsPerMinute: v.measured.pacing.cutsPerMinute, energy: v.measured.motion.energy, brightness: v.measured.color.brightness})), sameEveryTime: steady, changes: varies, sheet, at: new Date().toISOString()};
  fs.writeFileSync(path.join(folder, 'channel.json'), JSON.stringify(report, null, 1) + '\n');
  fs.writeFileSync(path.join(folder, 'channel.md'), `# ${look.name}\n\n${videos.length} videos${source!.creator ? ` of ${source!.creator}` : ''}.\n\n## The same in every video\n\n${steady.map(t => `- ${t.what}: ${t.value}`).join('\n') || '- Nothing measured stays the same.'}\n\n## What changes\n\n${varies.map(t => `- ${t.what}: around ${t.value} (it moves ${Math.round(t.spread * 100)}%)`).join('\n') || '- Nothing.'}\n\nUse it: \`pnpm tempoloom make SCRIPT.txt --like ${look.name}\`. Only measurements are kept; the videos were deleted.\n`);
  return {status: 'learned' as const, look: look.name, file, folder, sheet, videos: videos.length, sameEveryTime: steady.map(t => `${t.what}: ${t.value}`), changes: varies.map(t => `${t.what}: around ${t.value}`), summary: look.summary,
   next: `Look at ${sheet ?? 'the sheet'} and save what you see that the numbers cannot (the hook, the type, the framing) as lessons: pnpm tempoloom brain add --title "..." --body "..." --source "channel:${look.name}". Use the style: pnpm tempoloom make SCRIPT.txt --like ${look.name}`};
 } finally {for (const c of cleanup) fs.rmSync(c, {recursive: true, force: true});}
}
