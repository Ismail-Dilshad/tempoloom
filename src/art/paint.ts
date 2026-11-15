// Paints a plan in a headless browser, pass by pass, and keeps what an artist and a viewer need:
// the painting, a picture after every pass (to look at and correct), and a timelapse of it being
// painted. Also looks at a finished painting (values, colour, edges, focus, likeness).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium, type Page} from 'playwright';
import {chromiumExecutable, glArgs} from '../renderer/browser-path.js';
import {ffmpeg, run} from '../renderer/ffmpeg-encoder.js';
import {parsePainting, scalePainting, type Painting, type Medium} from './schema.js';
import {lint, type Lint} from './media.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const packages = new Map<string, string>();
/** A package's folder (found from its main file: some packages do not export package.json). */
const packageDir = (name: string) => {
 let d = packages.get(name);
 if (d) return d;
 d = path.dirname(require.resolve(name));
 while (!(fs.existsSync(path.join(d, 'package.json')) && JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')).name === name)) {const up = path.dirname(d); if (up === d) throw new Error('Cannot find the package ' + name); d = up;}
 packages.set(name, d);
 return d;
};
const TYPES: Record<string, string> = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json'};

/** Opens the painter page and gives it to `fn`; the browser is closed afterwards. */
export async function withPainter<T>(fn: (page: Page) => Promise<T>): Promise<T> {
 const browser = await chromium.launch({headless: true, executablePath: chromiumExecutable(), args: glArgs()});
 try {
  const page = await browser.newPage({viewport: {width: 800, height: 600}, deviceScaleFactor: 1});
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('http://painter.local/**', r => {
   const u = new URL(r.request().url()).pathname;
   let file: string;
   if (u.startsWith('/nm/')) {const [pkg, ...rest] = u.slice(4).split('/'); file = path.join(packageDir(pkg!), ...rest);}
   else if (u.startsWith('/art/')) file = path.join(here, 'page', u.slice(5));
   else file = path.join(here, 'page', 'painter.html');
   if (!fs.existsSync(file)) return r.fulfill({status: 404, body: 'not found'});
   return r.fulfill({path: file, contentType: TYPES[path.extname(file)] ?? 'application/octet-stream'});
  });
  await page.goto('http://painter.local/painter.html');
  await page.waitForFunction(() => (window as unknown as {painterReady?: boolean}).painterReady, null, {timeout: 30000}).catch(() => {throw new Error('The painter page did not start: ' + (errors.join('; ') || 'no WebGL2?'));});
  return await fn(page);
 } finally {await browser.close();}
}

const dataUrl = (file: string) => {
 const ext = path.extname(file).toLowerCase(), type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
 return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
};
const writeData = (file: string, url: string) => fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'pass';

export type RenderResult = {folder: string; painting: string; passes: {n: number; name: string; picture: string; marks: number; seconds: number}[]; timelapse: string | null; lint: Lint[]; plan: string};

export function readPainting(file: string): Painting {
 let raw: unknown;
 try {raw = JSON.parse(fs.readFileSync(file, 'utf8'));} catch (e) {throw new Error(`Cannot read ${file}: ${(e as Error).message}`);}
 return parsePainting(raw);
}

/** Paints a plan. `upto` stops after that pass (to look before going on); `scale` paints it smaller
 *  (a quick study); `values` keeps values only (a value study); `timelapse` films it being painted. */
export async function renderPainting(planFile: string, o: {out?: string; upto?: number; scale?: number; values?: boolean; timelapse?: boolean; seconds?: number; shape?: string; onStep?: (s: string) => void} = {}): Promise<RenderResult> {
 const file = path.resolve(planFile), dir = path.dirname(file);
 let plan = readPainting(file);
 const problems = lint(plan);
 if (o.scale && o.scale !== 1) plan = scalePainting(plan, o.scale);
 const pictures: Record<string, string> = {};
 for (const [name, rel] of Object.entries(plan.pictures ?? {})) {const f = path.resolve(dir, rel); if (!fs.existsSync(f)) throw new Error(`The picture "${name}" is not there: ${f}`); pictures[name] = dataUrl(f);}
 const folder = path.resolve(o.out ?? dir), passDir = path.join(folder, o.values ? 'study' : 'passes');
 fs.mkdirSync(passDir, {recursive: true});
 const upto = Math.min(plan.passes.length, o.upto ?? plan.passes.length);
 const frames: string[] = [];
 const passes: RenderResult['passes'] = [];
 let last = '';
 await withPainter(async page => {
  await page.evaluate(([p, opts]) => (window as unknown as {paintStart: (a: unknown, b: unknown) => Promise<unknown>}).paintStart(p, opts), [plan, {pictures, timelapse: !!o.timelapse, frames: Math.round((o.seconds ?? 20) * 30)}] as const);
  for (let i = 0; i < upto; i++) {
   const pass = plan.passes[i]!;
   o.onStep?.(`Painting pass ${i + 1} of ${upto}: ${pass.name} (${pass.marks.length} marks)`);
   const r = await page.evaluate(([p, n]) => (window as unknown as {paintPass: (a: unknown, b: number) => {png: string; marks: number; ms: number}}).paintPass(p, n), [plan, i] as const);
   let png = r.png;
   if (o.values) png = await page.evaluate(u => (window as unknown as {valuesOf: (u: string) => Promise<string>}).valuesOf(u), png);
   const pic = path.join(passDir, `${String(i + 1).padStart(2, '0')}-${slug(pass.name)}.png`);
   writeData(pic, png); last = png;
   passes.push({n: i + 1, name: pass.name, picture: pic, marks: r.marks, seconds: Math.round(r.ms / 100) / 10});
   if (o.timelapse) frames.push(...await page.evaluate(() => (window as unknown as {paintFrames: () => string[]}).paintFrames()));
  }
 });
 const painting = path.join(folder, o.values ? 'value-study.png' : upto < plan.passes.length ? `painting-upto-${upto}.png` : o.scale && o.scale !== 1 ? 'study.png' : 'painting.png');
 writeData(painting, last);
 const timelapse = o.timelapse && frames.length ? await makeTimelapse(frames, path.join(folder, 'timelapse.mp4'), {seconds: o.seconds ?? 20, ground: plan.canvas.ground, ...(o.shape ? {shape: o.shape} : {}), finalPicture: painting}) : null;
 const result: RenderResult = {folder, painting, passes, timelapse, lint: problems, plan: file};
 fs.writeFileSync(path.join(folder, 'render.json'), JSON.stringify({...result, at: new Date().toISOString()}, null, 1) + '\n');
 return result;
}

/** The frames as a video: the painting appears over `seconds`, then holds for two seconds. A shape
 *  like 9:16 fits it on a page of the paper's colour. */
export async function makeTimelapse(frames: string[], out: string, o: {seconds: number; ground: string; shape?: string; finalPicture?: string}) {
 const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tempoloom-timelapse-'));
 try {
  frames.forEach((f, i) => writeData(path.join(tmp, `f${String(i).padStart(5, '0')}.jpg`), f));
  const fps = Math.min(60, Math.max(4, frames.length / Math.max(2, o.seconds)));
  const shape = o.shape?.match(/^(\d+):(\d+)$/);
  const size = shape ? (Number(shape[1]) >= Number(shape[2]) ? [1920, Math.round(1920 * Number(shape[2]) / Number(shape[1]))] : [Math.round(1920 * Number(shape[1]) / Number(shape[2])), 1920]) : null;
  const even = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  const fit = size ? `scale=${size[0]! - 160}:${size[1]! - 160}:force_original_aspect_ratio=decrease,pad=${size[0]}:${size[1]}:(ow-iw)/2:(oh-ih)/2:color=${o.ground.replace('#', '0x')},${even}` : even;
  let out2 = out; for (let k = 2; fs.existsSync(out2); k++) out2 = out.replace(/\.mp4$/, `-${k}.mp4`);
  await run(ffmpeg, ['-y', '-v', 'error', '-framerate', fps.toFixed(3), '-i', path.join(tmp, 'f%05d.jpg'), '-vf', `${fit},tpad=stop_mode=clone:stop_duration=2,fps=30,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart', out2]);
  return out2;
 } finally {fs.rmSync(tmp, {recursive: true, force: true});}
}

/** Paints a picture in a style, in passes from big brushes to small (or draws it). */
export async function paintFromPicture(picture: string, o: {style: string; out: string; size?: number; seed?: number; detail?: number; timelapse?: boolean; seconds?: number; shape?: string; onStep?: (s: string) => void}) {
 const src = path.resolve(picture);
 if (!fs.existsSync(src)) throw new Error('No such picture: ' + src);
 const ratio = await withPainter(page => page.evaluate(async u => {const im = new Image(); im.src = u; await im.decode(); return im.width / im.height;}, dataUrl(src)));
 const long = o.size ?? 1350, width = Math.round(ratio >= 1 ? long : long * ratio), height = Math.round(ratio >= 1 ? long / ratio : long);
 const medium: Medium = o.style === 'watercolor' ? 'watercolor' : o.style === 'pencil' ? 'pencil' : o.style === 'charcoal' ? 'charcoal' : o.style === 'ink' ? 'ink' : o.style === 'gouache' ? 'gouache' : 'oil';
 const ground = medium === 'oil' ? '#b9a184' : medium === 'charcoal' ? '#e9e3d6' : '#f6f2ea', paper = medium === 'oil' ? 'canvas' : medium === 'watercolor' ? 'cold-press' : medium === 'charcoal' ? 'rough' : 'hot-press';
 const k = long / 1080, detail = o.detail ?? 1;
 const fp = (sizes: number[] | null, extra: Record<string, unknown> = {}) => ({kind: 'from-picture', picture: 'reference', style: o.style, detail, ...(sizes ? {sizes: sizes.map(s => Math.round(s * k))} : {}), ...extra});
 const passes = ['pencil', 'charcoal', 'ink'].includes(o.style)
  ? [{name: 'Drawing', kind: 'drawing', why: 'Contours along the edges, then hatching in layers where it is darker', marks: [fp(null)]}]
  : o.style === 'watercolor'
   ? [{name: 'Big light washes', kind: 'block-in', marks: [fp([84])]}, {name: 'Middle values', kind: 'colour', marks: [fp([40])]}, {name: 'Darks and details', kind: 'detail', marks: [fp([18])]}]
   : [{name: 'Block-in', kind: 'block-in', why: 'Big brushes, the big shapes and colours', marks: [fp(o.style === 'pointillist' ? [16] : [64, 36])]},
      {name: 'Form and colour', kind: 'colour', marks: [fp(o.style === 'pointillist' ? [9] : [18])]},
      {name: 'Details', kind: 'detail', marks: [fp(o.style === 'pointillist' ? [5] : [8])]},
      {name: 'Finish', kind: 'finish', marks: [{kind: 'finish', impasto: o.style === 'expressionist' ? 0.9 : 0.5, grain: 0.3}]}];
 fs.mkdirSync(o.out, {recursive: true});
 const ext = path.extname(src).toLowerCase() || '.jpg', copy = path.join(o.out, 'reference' + ext);
 if (path.resolve(copy) !== src) fs.copyFileSync(src, copy);
 const plan = {version: 1, title: path.basename(src).replace(/\.[^.]+$/, '') + ' (' + o.style + ')', medium, seed: o.seed ?? 1, canvas: {width, height, paper, ground}, pictures: {reference: path.basename(copy)}, passes};
 const planFile = path.join(o.out, 'painting.json');
 fs.writeFileSync(planFile, JSON.stringify(plan, null, 1) + '\n');
 return renderPainting(planFile, {...(o.timelapse ? {timelapse: true} : {}), ...(o.seconds ? {seconds: o.seconds} : {}), ...(o.shape ? {shape: o.shape} : {}), ...(o.onStep ? {onStep: o.onStep} : {})});
}

export type Look = {width: number; height: number; ratio: number;
 values: {darkest: number; lightest: number; dark: number; mid: number; light: number};
 colour: {chroma: number; hues: number; mud: number}; paper: number | null;
 edges: {hard: number; amount: number}; focus: {x: number; y: number; strength: number};
 likeness?: {values: number; colour: number}};

/** Measures a picture the way a painter squints at it. */
export async function lookAtPicture(picture: string, o: {paper?: string; reference?: string} = {}): Promise<Look> {
 const url = dataUrl(path.resolve(picture)), ref = o.reference ? dataUrl(path.resolve(o.reference)) : undefined;
 return withPainter(page => page.evaluate(([u, opts]) => (window as unknown as {lookAt: (u: string, o: unknown) => Promise<Look>}).lookAt(u, opts), [url, {...(o.paper ? {paper: o.paper} : {}), ...(ref ? {reference: ref} : {})}] as const));
}
