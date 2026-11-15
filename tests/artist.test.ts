// Artist: paintings and drawings planned and painted like an artist works - the plan's format, the
// medium's rules, the critique, the painting job in the studio, and (with a browser) real painting.
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-art-'));
const env = {VIDEO_WORKSPACE: path.join(tmp, 'ws'), TEMPOLOOM_BRAIN_DIR: path.join(tmp, 'brain'), TEMPOLOOM_BRAIN_DB: path.join(tmp, 'brain.db'), TEMPOLOOM_KNOWLEDGE_DIR: path.join(tmp, 'know'),
 TEMPOLOOM_SETTINGS_DIR: path.join(tmp, 'local'), TEMPOLOOM_STATE_FILE: path.join(tmp, 'state.json'), TEMPOLOOM_BACKUP_DIR: path.join(tmp, 'backups'), VIDEO_OUTPUT: path.join(tmp, 'out')}, before = {...process.env};
let closeDb: () => void;
beforeAll(async () => {Object.assign(process.env, env); fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR, {recursive: true}); closeDb = (await import('../src/engine/brain/db.js')).closeDb; (await import('../src/engine/brain/brain.js')).sync();});
afterAll(() => {closeDb(); for (const k of Object.keys(env)) before[k] === undefined ? delete process.env[k] : process.env[k] = before[k]; fs.rmSync(tmp, {recursive: true, force: true});});

const canvas = {width: 320, height: 240, paper: 'cold-press', ground: '#f8f5ee'};
const plan = (medium: string, passes: unknown[], extra: Record<string, unknown> = {}) => ({title: 'Test', medium, seed: 3, canvas, passes, ...extra});

describe('the painting plan', () => {
 it('names a problem by its pass and mark, and scales a plan for a quick study', async () => {
  const {parsePainting, scalePainting} = await import('../src/art/schema.js');
  expect(() => parsePainting(plan('oil', [{name: 'a', marks: [{kind: 'paint', brush: 'round', size: 10, points: [[1, 2]]}]}]))).toThrow(/pass 1, mark 1.*colour/);
  expect(() => parsePainting(plan('oil', [{name: 'a', marks: [{kind: 'shape', rect: [0, 0, 10, 10]}]}]))).toThrow(/fill, a wash, hatching or an outline/);
  const p = parsePainting(plan('oil', [{name: 'a', kind: 'block-in', marks: [{kind: 'paint', brush: 'flat', color: '#336699', size: 40, points: [[100, 100, 0.5], [200, 120]]}, {kind: 'brushwork', rect: [0, 0, 100, 50], colors: ['#112233'], size: 8, length: 20}]}]));
  const s = scalePainting(p, 0.5);
  expect(s.canvas).toMatchObject({width: 160, height: 120});
  expect(s.passes[0]!.marks[0]).toMatchObject({size: 20, points: [[50, 50, 0.5], [100, 60]]});
  expect(s.passes[0]!.marks[1]).toMatchObject({rect: [0, 0, 50, 25], size: 4, length: 10});
 });

 it('checks a plan against how artists work in its medium', async () => {
  const {parsePainting} = await import('../src/art/schema.js'), {lint, starter} = await import('../src/art/media.js');
  // Watercolour: a light wash after a dark one cannot cover it; the pencil drawing is not paint.
  const wc = lint(parsePainting(plan('watercolor', [
   {name: 'Drawing', kind: 'drawing', marks: [{kind: 'line', tool: '2H', color: '#555555', points: [[0, 0], [10, 10]]}]},
   {name: 'Darks', kind: 'block-in', marks: [{kind: 'shape', rect: [0, 0, 100, 100], fill: {color: '#1d2b3a'}}]},
   {name: 'Sky', kind: 'colour', marks: [{kind: 'shape', rect: [0, 0, 320, 100], fill: {color: '#cfe2f3'}}]}])));
  expect(wc.filter(l => l.level === 'problem').map(l => l.pass)).toEqual([3]);
  expect(wc.find(l => l.pass === 3)!.what).toMatch(/light to dark/);
  // Detail before the block-in, a picture that is not listed, thick paint early, no finish.
  const oil = lint(parsePainting(plan('oil', [
   {name: 'Knife', kind: 'detail', marks: [{kind: 'paint', brush: 'knife', color: '#eeeeee', size: 20, points: [[5, 5], [50, 5]]}]},
   {name: 'Block', kind: 'block-in', marks: [{kind: 'from-picture', picture: 'photo'}]},
   {name: 'More', kind: 'colour', marks: [{kind: 'paint', brush: 'round', color: '#335577', size: 10, points: [[5, 5], [9, 9]]}]}])));
  const said = oil.map(l => l.what).join(' | ');
  expect(said).toMatch(/Detail comes before the block-in/);
  expect(said).toMatch(/picture "photo"/);
  expect(said).toMatch(/fat over lean/);
  expect(said).toMatch(/No finish mark/);
  // A starting plan has a pass for each stage of the medium, in its order.
  const st = starter('Harbour', 'watercolor', {width: 600, height: 400});
  expect(st.passes.map(p => p.kind)).toEqual(['drawing', 'block-in', 'colour', 'detail', 'finish']);
  expect(st.passes[1]!.why).toMatch(/light washes/);
  expect(st.passes.every(p => p.name.length <= 28)).toBe(true);
 });
});

describe('the critique', () => {
 const look = (o: Record<string, unknown> = {}) => ({width: 256, height: 192, ratio: 4 / 3, values: {darkest: 12, lightest: 94, dark: 0.2, mid: 0.25, light: 0.55}, colour: {chroma: 22, hues: 3, mud: 0.15}, paper: 0.04, edges: {hard: 0.3, amount: 0.1}, focus: {x: 0.66, y: 0.4, strength: 2.4}, ...o}) as never;
 it('says what an art teacher would, with what to do next', async () => {
  const {critique} = await import('../src/art/check.js');
  expect(critique(look(), 'watercolor').issues).toEqual([]);
  const flat = critique(look({values: {darkest: 40, lightest: 70, dark: 0.33, mid: 0.34, light: 0.33}, colour: {chroma: 8, hues: 7, mud: 0.6}, focus: {x: 0.5, y: 0.5, strength: 1.1}, edges: {hard: 0.9, amount: 0.1}}), 'oil');
  const what = flat.issues.map(i => i.what + ' ' + i.fix).join(' | ');
  for (const re of [/values are close together/, /No value family leads/, /mud/, /7 different hues/, /nowhere to go/, /Almost every edge is hard/]) expect(what).toMatch(re);
  expect(flat.issues.some(i => i.hard)).toBe(true);
  // A watercolour with no white paper; an oil with the ground showing.
  expect(critique(look({paper: 0}), 'watercolor').issues.map(i => i.what).join()).toMatch(/No white paper/);
  expect(critique(look({paper: 0.4}), 'oil').issues.find(i => /ground still shows/.test(i.what))!.hard).toBe(true);
  // Pencil is not judged on colour.
  expect(critique(look({colour: {chroma: 1, hues: 0, mud: 0.9}}), 'pencil').issues).toEqual([]);
  // With a reference, a grey dark subject painted grey and dark is faithful, not muddy.
  const ref = look({values: {darkest: 10, lightest: 55, dark: 0.5, mid: 0.45, light: 0.05}, colour: {chroma: 9, hues: 2, mud: 0.5}});
  const faithful = critique(look({values: {darkest: 12, lightest: 52, dark: 0.48, mid: 0.47, light: 0.05}, colour: {chroma: 9, hues: 2, mud: 0.55}, likeness: {values: 0.9, colour: 12}}), 'oil', {ref});
  expect(faithful.issues).toEqual([]);
  expect(critique(look({likeness: {values: 0.2, colour: 50}}), 'oil').issues.map(i => i.what).join()).toMatch(/differ from the reference.*far from the reference/);
 });
});

describe('a painting job in the studio', () => {
 it('plans concept studies, a pick, the painting, a review and an approval; the painting must pass its critique', async () => {
  const S = await import('../src/engine/studio.js');
  const p = S.plan('A watercolour of a quiet harbour at dawn', {type: 'painting', job: 'harbour', options: ['reference']});
  expect(p.tasks.map(t => t.id)).toEqual(['intake', 'brief', 'reference', 'concept', 'concept-pick', 'paint', 'review', 'painting-ok', 'final', 'learn']);
  expect(p.tasks.find(t => t.id === 'paint')!.role).toBe('artist');
  expect(S.plan('A pencil portrait', {type: 'painting', job: 'portrait'}).tasks.map(t => t.id)).not.toContain('reference');
  const o = (f: string) => {const x = path.join(tmp, f); fs.writeFileSync(x, '# ' + f + '\n'); return x;};
  for (const [t, f] of [['intake', 'intake.md'], ['brief', 'brief.md'], ['reference', 'reference.md'], ['concept', 'concept.md']] as const) {
   const st = S.start('harbour', t);
   if (t === 'concept') {expect(JSON.stringify(st)).toMatch(/paint render PLAN --study/); expect(st.role.title).toBe('Concept artist');}
   S.done('harbour', t, {output: o(f), applied: []});
  }
  S.approve('harbour', 'concept-pick');
  const st = S.start('harbour', 'paint');
  expect(JSON.stringify(st)).toMatch(/paint check .* --job harbour/);
  expect(() => S.done('harbour', 'paint', {output: o('painting.md'), applied: []})).toThrow(/Critique the painting first/);
  fs.writeFileSync(path.join(S.jobDir('harbour'), 'art-check.json'), JSON.stringify({pass: false, score: 60, issues: [{what: 'The values are close together.'}]}));
  expect(() => S.done('harbour', 'paint', {output: o('painting.md'), applied: []})).toThrow(/does not pass its critique yet \(60\): The values are close together/);
  fs.writeFileSync(path.join(S.jobDir('harbour'), 'art-check.json'), JSON.stringify({pass: true, score: 88, issues: []}));
  S.done('harbour', 'paint', {output: o('painting.md'), applied: []});
  expect(S.next('harbour').ready.map(r => r.task)).toEqual(['review']);
 });

 it('takes a painting request from the page', async () => {
  const R = await import('../src/engine/studio-requests.js');
  const {brief, requestInput} = R;
  expect(requestInput.parse({mode: 'art', text: 'A harbour at dawn', medium: 'watercolor', shape: 'vertical'})).toMatchObject({mode: 'art', medium: 'watercolor'});
  const text = brief({input: requestInput.parse({mode: 'art', text: 'A harbour at dawn', medium: 'oil'}), files: []} as never);
  expect(text).toMatch(/^An oil painting, painted in passes like an artist/);
 });

 it('routes feedback about brushwork and paint to the art roles', async () => {
  const {topicsOf} = await import('../src/engine/feedback.js');
  expect(topicsOf('the watercolour looks muddy and the brush strokes are too small')).toContain('art');
 });
});

describe.skipIf(process.env.RUN_BROWSER_TESTS !== '1')('painting in the browser', () => {
 it('paints every kind of mark, a picture per pass, and a timelapse', async () => {
  const dir = path.join(tmp, 'all'); fs.mkdirSync(dir, {recursive: true});
  const f = path.join(dir, 'painting.json');
  fs.writeFileSync(f, JSON.stringify(plan('mixed', [
   {name: 'Drawing', kind: 'drawing', marks: [{kind: 'line', tool: 'HB', color: '#333333', points: [[20, 200], [300, 190]]}, {kind: 'ink', color: '#111111', size: 4, points: [[20, 20, 0.2], [160, 40, 1], [300, 20, 0.3]]}]},
   {name: 'Washes', kind: 'block-in', marks: [{kind: 'shape', ellipse: [160, 120, 90, 60], fill: {color: '#2a6fb0', opacity: 0.7}}, {kind: 'shape', rect: [200, 150, 100, 70], hatch: {gap: 5, angle: 30, color: '#222222'}}, {kind: 'glaze', color: '#f2c38b', opacity: 0.2}]},
   {name: 'Paint', kind: 'colour', marks: [{kind: 'paint', brush: 'flat', color: '#c0392b', size: 30, points: [[40, 60], [140, 80], [200, 70]]}, {kind: 'paint', brush: 'knife', color: '#f1f1e6', size: 24, points: [[60, 160], [140, 170]], thickness: 2},
    {kind: 'paint', brush: 'wash', color: '#3d5d47', size: 26, points: [[220, 40], [300, 90]]}, {kind: 'brushwork', points: [[20, 230], [120, 180], [200, 230]], brush: 'round', colors: [['#4a7a3a', 2], '#6b8f3c'], size: 6, length: 18, direction: 'up', density: 1.5}]},
   {name: 'Finish', kind: 'finish', marks: [{kind: 'finish', impasto: 0.8}]}])));
  const {renderPainting, lookAtPicture} = await import('../src/art/paint.js');
  const r = await renderPainting(f, {timelapse: true, seconds: 3});
  expect(r.passes.map(p => p.name)).toEqual(['Drawing', 'Washes', 'Paint', 'Finish']);
  expect(r.passes[3]!.marks).toBe(1);
  expect(r.passes[2]!.marks).toBeGreaterThan(10); // the brushwork is many strokes
  for (const p of r.passes) expect(fs.statSync(p.picture).size).toBeGreaterThan(1000);
  expect(fs.statSync(r.timelapse!).size).toBeGreaterThan(5000);
  const {probe} = await import('../src/renderer/ffmpeg-encoder.js');
  expect(Number((await probe(r.timelapse!)).format.duration)).toBeGreaterThan(4); // the painting appears, then holds for two seconds
  // Each pass changed the picture, and the painting is no longer blank paper.
  const L = await lookAtPicture(r.painting, {paper: '#f8f5ee'});
  expect(L.paper!).toBeLessThan(0.8);
  expect(L.values.darkest).toBeLessThan(40);
  // Paint picked up from the canvas mixes like pigment: blue under yellow gives green, not grey.
  const mix = path.join(tmp, 'mix'); fs.mkdirSync(mix);
  fs.writeFileSync(path.join(mix, 'painting.json'), JSON.stringify(plan('oil', [{name: 'Mix', kind: 'colour', marks: [
   {kind: 'paint', brush: 'round', color: '#1a3fa0', size: 60, points: [[40, 120], [280, 120]], vary: 0},
   {kind: 'paint', brush: 'round', color: '#f5d000', size: 60, points: [[40, 120], [280, 120]], smudge: 0.9, vary: 0}]}])));
  const m = await renderPainting(path.join(mix, 'painting.json'));
  const px = await (await import('../src/art/paint.js')).withPainter(page => page.evaluate(async u => {const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d')!; x.drawImage(im, 0, 0); return Array.from(x.getImageData(160, 120, 1, 1).data);}, 'data:image/png;base64,' + fs.readFileSync(m.painting).toString('base64')));
  expect(px[1]!).toBeGreaterThan(px[2]! + 20); // green leads blue
  expect(px[1]!).toBeGreaterThan(px[0]!); // and red
 }, 180000);

 it('paints a photo big brushes to small, and the critique compares it with the photo', async () => {
  // A photo-like picture: a red ball lit from the top left on a blue wall and a brown table.
  const {ffmpeg, run} = await import('../src/renderer/ffmpeg-encoder.js');
  const photo = path.join(tmp, 'photo.png');
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x46566a:s=480x360,drawbox=y=230:w=480:h=130:color=0x8a5a36:t=fill,drawbox=x=170:y=110:w=150:h=150:color=0xc0281e:t=fill,drawbox=x=195:y=130:w=40:h=30:color=0xf08070:t=fill,gblur=sigma=6', '-frames:v', '1', photo]);
  const {paintFromPicture} = await import('../src/art/paint.js'), {checkPainting} = await import('../src/art/check.js');
  const r = await paintFromPicture(photo, {style: 'oil', out: path.join(tmp, 'from'), size: 480});
  expect(r.passes.map(p => p.name)).toEqual(['Block-in', 'Form and colour', 'Details', 'Finish']);
  expect(r.passes[0]!.marks).toBeGreaterThan(30);
  const c = await checkPainting(r.painting, {medium: 'oil', paper: '#b9a184', reference: photo});
  expect(c.look.likeness!.values).toBeGreaterThan(0.7);
  expect(c.look.paper!).toBeLessThan(0.12); // the canvas is covered
  expect(c.pass).toBe(true);
 }, 180000);
});
