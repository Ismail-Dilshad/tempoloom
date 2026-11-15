// Group 10: new kinds of video - charts from data, list and countdown videos, photo stories.
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg, run} from '../src/renderer/ffmpeg-encoder.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-g10-'));
const env = {VIDEO_WORKSPACE: path.join(tmp, 'ws'), TEMPOLOOM_BRAIN_DIR: path.join(tmp, 'brain'), TEMPOLOOM_BRAIN_DB: path.join(tmp, 'brain.db'), TEMPOLOOM_KNOWLEDGE_DIR: path.join(tmp, 'know'),
 TEMPOLOOM_SETTINGS_DIR: path.join(tmp, 'local'), TEMPOLOOM_STATE_FILE: path.join(tmp, 'state.json'), VIDEO_OUTPUT: path.join(tmp, 'out')}, before = {...process.env};
let closeDb: () => void;
beforeAll(async () => {Object.assign(process.env, env); fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR, {recursive: true}); closeDb = (await import('../src/engine/brain/db.js')).closeDb; (await import('../src/engine/brain/brain.js')).sync();});
afterAll(() => {closeDb(); for (const k of Object.keys(env)) before[k] === undefined ? delete process.env[k] : process.env[k] = before[k]; fs.rmSync(tmp, {recursive: true, force: true});});

describe('charts from data', () => {
 it('reads pasted numbers in the ways people paste them', async () => {
  const {parseData} = await import('../src/engine/charts.js');
  const a = parseData('Coffee: 42%\nTea: 27%\nJuice: 18%');
  expect(a.series[0]!.points).toEqual([{label: 'Coffee', value: 42}, {label: 'Tea', value: 27}, {label: 'Juice', value: 18}]);
  expect(a.suffix).toBe('%');
  const b = parseData('Year,Users,Paying\n2023,1.2,0.3\n2024,2.4,0.7\n2025,5.1,1.6', {title: 'Users (millions)'});
  expect(b.series.map(s => s.name)).toEqual(['Users', 'Paying']);
  expect(b.series[1]!.points.at(-1)).toEqual({label: '2025', value: 1.6});
  expect(b.decimals).toBe(1);
  const c = parseData('Revenue\nJanuary\t$12,400\nFebruary\t$15,900');
  expect(c.title).toBe('Revenue'); expect(c.prefix).toBe('$'); expect(c.series[0]!.points[1]!.value).toBe(15900);
  expect(parseData('Sales 1200\nRefunds 80').series[0]!.points[0]).toEqual({label: 'Sales', value: 1200});
  expect(parseData('{"North": 12, "South": 30}').series[0]!.points[1]!.value).toBe(30);
  expect(parseData('الاشتراكات: ٤٢').series[0]!.points[0]!.value).toBe(42);
  expect(() => parseData('just words here')).toThrow(/label and a number/);
 });

 it('chooses the chart that fits, and builds it as a scene piece in the video style', async () => {
  const {parseData, chooseKind, chartPiece, sentenceFor} = await import('../src/engine/charts.js'), {pieceSchema} = await import('../src/engine/scene-pieces-schema.js');
  expect(chooseKind(parseData('Users: 5100000')).kind).toBe('count');
  expect(chooseKind(parseData('Before: 12\nAfter: 30')).kind).toBe('compare');
  expect(chooseKind(parseData('2021: 1\n2022: 2\n2023: 4\n2024: 5')).kind).toBe('line');
  expect(chooseKind(parseData('Coffee: 42\nTea: 27\nJuice: 18')).kind).toBe('bar');
  const d = parseData('Coffee: 42%\nTea: 27%\nJuice: 18%\nWater: 13%');
  const bar = pieceSchema.parse(chartPiece(d));
  expect(bar.keep).toBe(true); // the art director never redesigns the user's data
  expect(bar.layers.filter(l => l.type === 'bar').map(l => l.progress)).toEqual([1, 27 / 42, 18 / 42, 13 / 42]);
  const nums = bar.layers.filter(l => l.type === 'number');
  expect(nums.map(l => [l.value, l.suffix, l.in.from])).toEqual([[42, '%', 'count'], [27, '%', 'count'], [18, '%', 'count'], [13, '%', 'count']]);
  expect(nums[0]!.color).toBe('accent'); // the biggest stands out
  expect(Math.max(...bar.layers.map(l => l.x + (l.w ?? 0)))).toBeLessThanOrEqual(0.77); // clear of the buttons on the right
  const line = pieceSchema.parse(chartPiece(parseData('2021: 1\n2022: 2\n2023: 4'), {}));
  expect(line.layers.some(l => l.type === 'line' && l.in.from === 'draw' && l.points!.length === 3)).toBe(true);
  pieceSchema.parse(chartPiece(parseData('Before: 12\nAfter: 30')));
  expect(chartPiece(parseData('Before: 12\nAfter: 30')).layers.some(l => l.text === '+150%')).toBe(true);
  expect(sentenceFor(['We asked the office.', 'Coffee won with 42 percent.', 'Thanks.'], d)).toBe(1);
  expect(sentenceFor(['Hello.', 'Here is a figure: 3.', 'Bye.'], parseData('A: 1\nB: 2'))).toBe(1);
 });
});

describe('list and countdown videos', () => {
 it('reads a numbered list, speaks it without its numbers, and gives every item the same visual and length', async () => {
  const {readList, spokenScript, itemPiece, itemSeconds} = await import('../src/engine/listicle.js'), {pieceSchema} = await import('../src/engine/scene-pieces-schema.js');
  const l = readList('Top 3 reasons to walk every day.\n1. Your heart gets stronger.\n2) Walking clears your head.\n#3 It costs nothing at all.\nStart today.')!;
  expect(l.title).toBe('Top 3 reasons to walk every day.');
  expect(l.items.map(x => [x.n, x.text])).toEqual([[1, 'Your heart gets stronger.'], [2, 'Walking clears your head.'], [3, 'It costs nothing at all.']]);
  expect(l.countdown).toBe(false);
  expect(spokenScript(l)).toBe('Top 3 reasons to walk every day.\nYour heart gets stronger.\nWalking clears your head.\nIt costs nothing at all.\nStart today.');
  const down = readList('My top 5 films, counting down.\nNumber 5: Alien.\nNumber 4: Heat.\nNumber 3: Up.\nNumber 2: Jaws.\nNumber 1: Psycho.')!;
  expect(down.countdown).toBe(true);
  expect(readList('1. One.\n3. Three.\n2. Two.')).toBeNull();
  expect(readList('Just a script.\nWith lines.')).toBeNull();
  const p = l.items.map((x, i) => pieceSchema.parse(itemPiece(x, i, 3, {countdown: false})));
  expect(p.map(x => x.designed!.archetype)).toEqual(['list-item', 'list-item', 'list-item']);
  expect(p.map(x => x.layers.find(y => y.type === 'text')!.text)).toEqual(['1', '2', '3']);
  // The progress: segments filled up to this item.
  expect(p[1]!.layers.filter(y => y.type === 'bar' && y.y > .7).map(y => y.progress > .5)).toEqual([true, true, false]);
  expect(itemSeconds(l)).toBeGreaterThanOrEqual(2.5);
 });
});

/** A JPEG with an EXIF block: the camera's date and an orientation. */
function withExif(jpeg: Buffer, date: string, orientation: number) {
 const entries = 2, ifd0 = 8, exifIfd = ifd0 + 2 + entries * 12 + 4, dateAt = exifIfd + 2 + 12 + 4;
 const t = Buffer.alloc(dateAt + 20);
 t.write('II', 0); t.writeUInt16LE(42, 2); t.writeUInt32LE(ifd0, 4);
 t.writeUInt16LE(entries, ifd0);
 t.writeUInt16LE(0x0112, ifd0 + 2); t.writeUInt16LE(3, ifd0 + 4); t.writeUInt32LE(1, ifd0 + 6); t.writeUInt16LE(orientation, ifd0 + 10);
 t.writeUInt16LE(0x8769, ifd0 + 14); t.writeUInt16LE(4, ifd0 + 16); t.writeUInt32LE(1, ifd0 + 18); t.writeUInt32LE(exifIfd, ifd0 + 22);
 t.writeUInt16LE(1, exifIfd); t.writeUInt16LE(0x9003, exifIfd + 2); t.writeUInt16LE(2, exifIfd + 4); t.writeUInt32LE(20, exifIfd + 6); t.writeUInt32LE(dateAt, exifIfd + 10);
 t.write(date + '\0', dateAt, 'latin1');
 const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t]), seg = Buffer.alloc(4); seg.writeUInt16BE(0xFFE1, 0); seg.writeUInt16BE(body.length + 2, 2);
 return Buffer.concat([jpeg.subarray(0, 2), seg, body, jpeg.subarray(2)]);
}

describe('photo story', () => {
 it('orders photos by when they were taken (camera, name, file), by look, or by what they show', async () => {
  const {readExif, dateInName, readPhotos, orderPhotos} = await import('../src/editor/photo-story.js');
  const dir = path.join(tmp, 'photos'); fs.mkdirSync(dir);
  const make = async (name: string, hue: number, w = 640, h = 480) => {const f = path.join(dir, name); await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=s=${w}x${h},hue=h=${hue}`, '-frames:v', '1', f]); return f;};
  const late = await make('beach.jpg', 0), early = await make('IMG_20230101_101500.jpg', 120), mid = await make('market.jpg', 240, 480, 640);
  fs.writeFileSync(late, withExif(fs.readFileSync(late), '2024:08:02 18:30:00', 1));
  fs.writeFileSync(mid, withExif(fs.readFileSync(mid), '2023:06:10 09:00:00', 6));
  const ex = readExif(fs.readFileSync(mid));
  expect(ex.orientation).toBe(6); expect(ex.taken!.getFullYear()).toBe(2023); expect(ex.taken!.getMonth()).toBe(5);
  expect(dateInName('PXL_20240512_093000.jpg')!.getDate()).toBe(12);
  const photos = await readPhotos([dir], {about: {'beach.jpg': 'the beach at sunset', 'market.jpg': 'a spice market', 'IMG_20230101_101500.jpg': 'sunset over the beach'}});
  const byDate = orderPhotos(photos, 'date').map(p => path.basename(p.file));
  expect(byDate).toEqual(['IMG_20230101_101500.jpg', 'market.jpg', 'beach.jpg']);
  expect(photos.find(p => p.file === mid)!.width).toBe(640); // turned upright: 480x640 stored, shown 640 wide
  expect(orderPhotos(photos, 'about').map(p => path.basename(p.file))).toEqual(['IMG_20230101_101500.jpg', 'beach.jpg', 'market.jpg']);
  expect(orderPhotos(photos, 'look')).toHaveLength(3);
  for (const p of photos) {expect(p.focus.x).toBeGreaterThanOrEqual(.2); expect(p.focus.x).toBeLessThanOrEqual(.8);}
 }, 60000);

 it('makes the video: each photo moving, dissolving into the next, paced on the music', async () => {
  const {photoStory, cutTimes} = await import('../src/editor/photo-story.js'), {mediaInfo} = await import('../src/editor/editor.js');
  expect(await cutTimes(4, {seconds: 2})).toEqual([0, 2, 4, 6, 8]);
  // Music with a hit every 0.5 s: the cuts land on hits.
  const music = path.join(tmp, 'beat.wav');
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='0.8*sin(2*PI*90*t)*exp(-20*mod(t,0.5))':s=8000:d=10", music]);
  const cuts = await cutTimes(4, {music, seconds: 2.1});
  for (const c of cuts.slice(1, -1)) expect(Math.abs(c * 2 - Math.round(c * 2))).toBeLessThan(0.12);
  const r = await photoStory([path.join(tmp, 'photos')], {shape: '1:1', seconds: 1.5, music, out: path.join(tmp, 'story.mp4')});
  const i = await mediaInfo(r.output);
  expect([i.width, i.height, i.hasAudio]).toEqual([1080, 1080, true]);
  expect(Math.abs(i.duration - r.seconds)).toBeLessThan(0.2);
  expect(r.photos.map(p => p.move)).toEqual(['in', 'out', 'in']);
  expect(r.paced).toBe('on the music');
 }, 120000);
});

describe.skipIf(process.env.RUN_BROWSER_TESTS !== '1')('in a made video', () => {
 it('puts a chart on the sentence it belongs to, and gives a list one rhythm', async () => {
  const {make} = await import('../src/engine/make.js');
  const data = path.join(tmp, 'drinks.txt'); fs.writeFileSync(data, 'Coffee: 42%\nTea: 27%\nJuice: 18%\n');
  const r = await make({script: 'What we drink at work.\nCoffee wins with forty two percent.\nAsk your team.', charts: [{file: data}], draft: true, music: 'off', formats: [], thumbnail: false, seed: 't'});
  const req = JSON.parse(fs.readFileSync(r.request, 'utf8'));
  expect(req.sceneVisuals[1].piece.name).toBe('chart-bar');
  expect(fs.readFileSync(r.storyboard, 'utf8')).toMatch(/chart-bar/);
  const l = await make({script: 'Top 3 reasons to walk.\n1. Your heart gets stronger with every single step.\n2. Walking clears your head.\n3. It is free.\nStart today.', draft: true, music: 'off', formats: [], thumbnail: false, seed: 't'});
  const lr = JSON.parse(fs.readFileSync(l.request, 'utf8'));
  expect(lr.script).toBe('Top 3 reasons to walk.\nYour heart gets stronger with every single step.\nWalking clears your head.\nIt is free.\nStart today.');
  expect(lr.sceneLengths.slice(1, 4)).toEqual([lr.sceneLengths[1], lr.sceneLengths[1], lr.sceneLengths[1]]);
  expect(lr.sceneLengths[0]).toBeNull();
  const proj = JSON.parse(fs.readFileSync(path.join(env.VIDEO_WORKSPACE, 'projects', l.project!, 'project.json'), 'utf8')) as {scenes: {duration: number; piece?: {name?: string}}[]};
  const items = proj.scenes.slice(1, 4);
  expect(new Set(items.map(s => s.duration)).size).toBe(1);
  expect(items.map(s => s.piece!.name)).toEqual(['list-item-1', 'list-item-2', 'list-item-3']);
 }, 300000);
});
