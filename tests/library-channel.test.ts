// Group 12: your library (logos, music, pictures, clips, searchable and reused) and learning a
// channel's style from its latest videos.
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg, run} from '../src/renderer/ffmpeg-encoder.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-g12-'));
const env = {VIDEO_WORKSPACE: path.join(tmp, 'ws'), TEMPOLOOM_BRAIN_DIR: path.join(tmp, 'brain'), TEMPOLOOM_BRAIN_DB: path.join(tmp, 'brain.db'), TEMPOLOOM_KNOWLEDGE_DIR: path.join(tmp, 'know'),
 TEMPOLOOM_SETTINGS_DIR: path.join(tmp, 'local'), TEMPOLOOM_STATE_FILE: path.join(tmp, 'state.json'), TEMPOLOOM_LOOKS_DIR: path.join(tmp, 'looks'), VIDEO_OUTPUT: path.join(tmp, 'out')}, before = {...process.env};
let closeDb: () => void;
beforeAll(async () => {Object.assign(process.env, env); fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR, {recursive: true}); closeDb = (await import('../src/engine/brain/db.js')).closeDb; (await import('../src/engine/brain/brain.js')).sync();});
afterAll(() => {closeDb(); for (const k of Object.keys(env)) before[k] === undefined ? delete process.env[k] : process.env[k] = before[k]; fs.rmSync(tmp, {recursive: true, force: true});});

describe('your library', () => {
 it('keeps logos, music and clips, finds them by what they show, and remembers which jobs used them', async () => {
  const src = path.join(tmp, 'mine'); fs.mkdirSync(src);
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xff6b4a@0.0:s=300x120,format=rgba,drawbox=x=40:y=30:w=220:h=60:color=0xff6b4a@1:t=fill', '-frames:v', '1', path.join(src, 'acme.png')]);
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920', '-frames:v', '1', path.join(src, 'storefront.jpg')]);
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*220*t)*exp(-8*mod(t,0.5))':s=22050:d=25", path.join(src, 'track.mp3')]);
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=900:d=0.4', path.join(src, 'ding.wav')]);
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:d=3', path.join(src, 'pouring-coffee.mp4')]);
  const L = await import('../src/engine/my-library.js');
  const r = await L.addToLibrary([src]);
  const byName = Object.fromEntries(r.added.map(a => [a.name, a]));
  expect(byName['acme.png']!.kind).toBe('logo'); // see-through
  expect(byName['storefront.jpg']!.kind).toBe('image');
  expect(byName['track.mp3']!.kind).toBe('music');
  expect(byName['ding.wav']!.kind).toBe('sound');
  expect(byName['pouring-coffee.mp4']!).toMatchObject({kind: 'clip', description: 'pouring coffee'});
  expect((await L.addToLibrary([path.join(src, 'acme.png')])).skipped[0]).toMatch(/already in the library/);
  const music = L.libraryEntry(byName['track.mp3']!.id);
  expect(music.bpm).toBe(120); // a hit every half second
  expect(music.energy).toBe('lively');
  expect(fs.existsSync(music.file) && music.file.startsWith(L.libraryRoot())).toBe(true); // a copy: always there
  expect(L.libraryEntry(byName['storefront.jpg']!.id)).toMatchObject({width: 1080, height: 1920});
  await L.describeEntry(byName['storefront.jpg']!.id, 'our cafe storefront at night', {tags: ['cafe']});
  const {find} = await import('../src/engine/find.js');
  const q = async (w: string) => (await find(w, {kinds: ['asset', 'clip']})).hits.map(h => h.id.split('#')[0]);
  expect((await q('cafe storefront'))[0]).toBe(byName['storefront.jpg']!.id);
  expect((await q('vertical photo'))[0]).toBe(byName['storefront.jpg']!.id);
  expect(await q('upbeat music')).toContain(byName['track.mp3']!.id);
  expect(await q('logo')).toContain(byName['acme.png']!.id);
  expect((await q('coffee'))[0]).toBe(L.libraryEntry(byName['pouring-coffee.mp4']!.id).clip);
  expect(L.useEntry(byName['acme.png']!.id, 'job-1').usedIn).toEqual(['job-1']);
  L.useEntry(byName['acme.png']!.id, 'job-2');
  expect(L.libraryEntry(byName['acme.png']!.id).uses.map(u => u.job)).toEqual(['job-1', 'job-2']);
  const copy = L.libraryEntry(byName['ding.wav']!.id).file;
  await L.removeEntry(byName['ding.wav']!.id);
  expect(fs.existsSync(copy)).toBe(false);
  expect(fs.existsSync(path.join(src, 'ding.wav'))).toBe(true); // your own file stays
 }, 120000);
});

describe('learn from a channel', () => {
 /** A creator's video: dark frames, an orange card in the middle, a cut every two seconds. */
 const video = async (f: string, tone: number, extra = 0) => run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x101828:s=360x640:d=${2 + extra}[a];color=c=0xf97316:s=360x640:d=1.5[b];color=c=0x101828:s=360x640:d=2[c];[a][b][c]concat=n=3:v=1`, '-f', 'lavfi', '-i', `sine=f=${tone}:d=${5.5 + extra}`, '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', f]);

 it('studies a folder of a creator\'s videos as one style: what stays the same, and what changes', async () => {
  const dir = path.join(tmp, 'creator'); fs.mkdirSync(dir);
  for (const [i, extra] of [0, 0, 3, 6].entries()) await video(path.join(dir, `v${i}.mp4`), 200 + i * 30, extra);
  const {learnChannel} = await import('../src/engine/channel-style.js'), {readLook} = await import('../src/engine/looks.js');
  const r = await learnChannel(dir, {name: 'night-cafe'});
  if (r.status !== 'learned') throw new Error('not learned');
  expect(r.look).toBe('channel-night-cafe');
  expect(r.videos).toBe(4);
  expect(r.sameEveryTime.join(' | ')).toMatch(/Brightness: dark.*Shape: vertical/);
  expect(r.changes.join(' | ')).toMatch(/Length/); // 5.5 to 11.5 s
  const look = await readLook('channel-night-cafe');
  expect(look.steer['tone-dark']).toBeGreaterThan(1);
  expect(look.summary[0]).toMatch(/^4 videos/);
  expect(fs.existsSync(r.sheet!)).toBe(true);
  expect(fs.readFileSync(path.join(r.folder, 'channel.md'), 'utf8')).toMatch(/## The same in every video[\s\S]*Brightness: dark/);
 }, 120000);

 it('lists a channel first, then studies its videos and deletes every download', async () => {
  const {learnChannel} = await import('../src/engine/channel-style.js');
  const items = [0, 1, 2].map(i => ({id: `v${i}`, title: `Video ${i}`, url: `https://www.youtube.com/watch?v=v${i}`, duration: 6}));
  const list = async () => ({channel: 'Night Cafe', items});
  const first = await learnChannel('https://www.youtube.com/@nightcafe/videos', {name: 'nc', list});
  expect(first.status).toBe('needs-confirmation');
  if (first.status === 'needs-confirmation') expect(first.videos).toHaveLength(3);
  const folders: string[] = [];
  const download = async (url: string, section: string) => {expect(section).toBe('0-45'); const folder = path.join(tmp, 'dl-' + url.slice(-2)); fs.mkdirSync(folder); folders.push(folder); const v = path.join(folder, 'v.mp4'); await video(v, 300); return {video: v, folder};};
  const r = await learnChannel('https://www.youtube.com/@nightcafe/videos', {name: 'nc', list, download, confirm: true});
  expect(r.status).toBe('learned');
  if (r.status === 'learned') expect(r.summary[0]).toBe('3 videos of Night Cafe');
  for (const f of folders) expect(fs.existsSync(f)).toBe(false); // study only: deleted once measured
 }, 120000);
});
