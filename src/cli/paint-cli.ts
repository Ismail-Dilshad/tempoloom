// tempoloom paint: paints and draws like an artist. A plan of passes (drawing, block-in, colour,
// detail, finish) is painted with natural media, a picture after every pass to look at and
// correct, a timelapse of it being painted, and a critique of the result.
import fs from 'node:fs';
import path from 'node:path';
import {MEDIA, PICTURE_STYLES, PAINT_BRUSHES, P5_TOOLS, PAPERS, type Medium} from '../art/schema.js';

const [command, ...rest] = process.argv.slice(2);
const VALUED = ['--medium', '--size', '--paper', '--ground', '--picture', '--out', '--upto', '--scale', '--seconds', '--shape', '--style', '--detail', '--reference', '--intent', '--job', '--seed', '--title'];
const flag = (k: string) => {const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined;};
const has = (k: string) => rest.includes(k);
const args = () => rest.filter((x, i) => !x.startsWith('--') && !VALUED.includes(rest[i - 1] ?? ''));
const num = (k: string) => {const v = flag(k); if (v === undefined) return undefined; const n = Number(v); if (!Number.isFinite(n)) throw new Error(`${k} takes a number`); return n;};
const usage = `Usage: tempoloom paint media [MEDIUM]                      the media, brushes and how an artist builds a picture in each
       tempoloom paint new "TITLE" --medium M [--size 1080x1350] [--paper P] [--ground #HEX] [--picture FILE] [--out FOLDER]
                                                          a plan to fill: the canvas and an empty pass per stage
       tempoloom paint lint PLAN.json                     checks a plan against how artists work (before painting)
       tempoloom paint render PLAN.json [--upto N] [--study] [--timelapse] [--seconds 20] [--shape 9:16] [--out FOLDER]
                                                          paints it: painting.png, a picture after every pass, a timelapse
                                                          --upto N stops after pass N to look; --study is a quick value study
       tempoloom paint from PICTURE --style STYLE [--size 1350] [--detail 1] [--timelapse] [--out FOLDER]
                                                          paints (or draws) a picture, big brushes to small
       tempoloom paint check PICTURE|FOLDER [--medium M] [--reference IMG] [--intent "WORDS"] [--job JOB]
                                                          the critique: values, colour, focus, edges, likeness

Media: ${MEDIA.join(', ')}. Styles from a picture: ${PICTURE_STYLES.join(', ')}.`;

async function outRoot() {
 const {defaults, roots} = await import('../engine/config.js');
 return path.join(roots(await defaults()).output, 'art');
}
function freshFolder(base: string) {let d = base; for (let k = 2; fs.existsSync(d); k++) d = `${base}-${k}`; fs.mkdirSync(d, {recursive: true}); return d;}
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'painting';
const size = (v?: string) => {if (!v) return {width: 1080, height: 1350}; const m = /^(\d+)x(\d+)$/.exec(v); if (!m) throw new Error('--size takes WIDTHxHEIGHT, like 1080x1350'); return {width: Number(m[1]), height: Number(m[2])};};
const medium = (v?: string): Medium => {if (!v) throw new Error(`Give the medium: --medium ${MEDIA.join('|')}`); if (!(MEDIA as readonly string[]).includes(v)) throw new Error(`Unknown medium "${v}". Media: ${MEDIA.join(', ')}`); return v as Medium;};
const steps = (s: string) => console.error(s);

async function main() {
 if (!command || ['help', '--help', '-h'].includes(command)) {console.log(usage); process.exit(command ? 0 : 1);}
 const a = args();
 switch (command) {
  case 'media': {
   const {GUIDES} = await import('../art/media.js');
   const which = a[0] ? [medium(a[0])] : [...MEDIA];
   return {media: which.map(m => GUIDES[m]), brushes: {paint: PAINT_BRUSHES, drawing: P5_TOOLS, ink: 'ink (pressure lines)'}, papers: PAPERS,
    marks: {line: 'a pencil, charcoal, pastel, crayon, pen or marker line', ink: 'a tapered ink line', shape: 'an area: watercolour fill, wash, hatching, outline', paint: 'one stroke of paint (oil, gouache, knife, blender, watercolour wash or glaze)', glaze: 'a transparent tint over an area', brushwork: 'many strokes over an area (foliage, grass, sky, water, fur)', 'from-picture': 'paint or draw a picture, big brushes to small', finish: 'impasto light and paper grain'},
    guide: 'docs/guides/artist.md'};
  }
  case 'new': {
   const title = a[0] ?? flag('--title'); if (!title) throw new Error(usage);
   const {starter} = await import('../art/media.js');
   const m = medium(flag('--medium')), dims = size(flag('--size'));
   const folder = flag('--out') ? path.resolve(flag('--out')!) : freshFolder(path.join(await outRoot(), slug(title)));
   fs.mkdirSync(folder, {recursive: true});
   let picture: string | undefined;
   if (flag('--picture')) {const src = path.resolve(flag('--picture')!); if (!fs.existsSync(src)) throw new Error('No such picture: ' + src); picture = 'reference' + path.extname(src).toLowerCase(); fs.copyFileSync(src, path.join(folder, picture));}
   const plan = starter(title, m, {...dims, ...(flag('--paper') ? {paper: flag('--paper')!} : {}), ...(flag('--ground') ? {ground: flag('--ground')!} : {}), ...(picture ? {picture} : {}), ...(num('--seed') !== undefined ? {seed: num('--seed')!} : {})});
   const file = path.join(folder, 'painting.json');
   if (fs.existsSync(file)) throw new Error('There is already a plan here: ' + file);
   fs.writeFileSync(file, JSON.stringify(plan, null, 1) + '\n');
   return {plan: file, folder, passes: plan.passes.map(p => `${p.name}: ${p.why}`), next: `Fill each pass's marks (pnpm tempoloom paint media ${m}), then paint pass by pass: pnpm tempoloom paint render ${file} --upto 1`};
  }
  case 'lint': {
   if (!a[0]) throw new Error(usage);
   const {readPainting} = await import('../art/paint.js'), {lint} = await import('../art/media.js');
   const l = lint(readPainting(path.resolve(a[0])));
   if (l.some(x => x.level === 'problem')) process.exitCode = 2;
   return {ok: !l.some(x => x.level === 'problem'), notes: l};
  }
  case 'render': case 'timelapse': {
   if (!a[0]) throw new Error(usage);
   const {renderPainting} = await import('../art/paint.js');
   const study = has('--study');
   const r = await renderPainting(a[0], {...(flag('--out') ? {out: flag('--out')!} : {}), ...(num('--upto') ? {upto: num('--upto')!} : {}),
    ...(study ? {scale: num('--scale') ?? 0.3, values: true} : num('--scale') ? {scale: num('--scale')!} : {}), ...(has('--values') ? {values: true} : {}),
    timelapse: command === 'timelapse' || has('--timelapse'), ...(num('--seconds') ? {seconds: num('--seconds')!} : {}), ...(flag('--shape') ? {shape: flag('--shape')!} : {}), onStep: steps});
   return {painting: r.painting, passes: r.passes.map(p => `${p.n}. ${p.name}: ${p.marks} marks, ${p.seconds} s -> ${p.picture}`), timelapse: r.timelapse, notes: r.lint,
    next: r.passes.length && !study ? `Look at ${r.passes[r.passes.length - 1]!.picture}, fix the plan, and go on; when it is finished: pnpm tempoloom paint check ${r.folder}` : undefined};
  }
  case 'from': {
   if (!a[0]) throw new Error(usage);
   const style = flag('--style') ?? 'oil';
   if (!(PICTURE_STYLES as readonly string[]).includes(style)) throw new Error(`Unknown style "${style}". Styles: ${PICTURE_STYLES.join(', ')}`);
   const {paintFromPicture} = await import('../art/paint.js');
   const out = flag('--out') ? path.resolve(flag('--out')!) : freshFolder(path.join(await outRoot(), slug(path.basename(a[0]).replace(/\.[^.]+$/, '') + '-' + style)));
   const r = await paintFromPicture(a[0], {style, out, ...(num('--size') ? {size: num('--size')!} : {}), ...(num('--detail') ? {detail: num('--detail')!} : {}), ...(num('--seed') !== undefined ? {seed: num('--seed')!} : {}),
    timelapse: has('--timelapse'), ...(num('--seconds') ? {seconds: num('--seconds')!} : {}), ...(flag('--shape') ? {shape: flag('--shape')!} : {}), onStep: steps});
   return {painting: r.painting, plan: r.plan, passes: r.passes.map(p => `${p.n}. ${p.name}: ${p.marks} marks -> ${p.picture}`), timelapse: r.timelapse,
    next: `The plan is editable: add your own passes (a glaze, accents, a signature) and paint it again with paint render ${r.plan}`};
  }
  case 'check': {
   if (!a[0]) throw new Error(usage);
   const {checkPainting} = await import('../art/check.js');
   let picture = path.resolve(a[0]), m = flag('--medium') as Medium | undefined, paper: string | undefined, reference = flag('--reference');
   const planFile = fs.statSync(picture).isDirectory() ? path.join(picture, 'painting.json') : path.join(path.dirname(picture), 'painting.json');
   if (fs.statSync(picture).isDirectory()) {const p = path.join(picture, 'painting.png'); if (!fs.existsSync(p)) throw new Error('Nothing painted here yet: ' + p); picture = p;}
   if (fs.existsSync(planFile)) {
    const {readPainting} = await import('../art/paint.js'); const plan = readPainting(planFile);
    m ??= plan.medium; paper = plan.canvas.ground;
    if (!reference && plan.pictures?.reference) reference = path.resolve(path.dirname(planFile), plan.pictures.reference);
   }
   const job = flag('--job');
   let out: string | undefined;
   if (job) {const {jobDir} = await import('../engine/studio.js'); out = path.join(jobDir(job), 'art-check.json');}
   const r = await checkPainting(picture, {medium: medium(m), ...(paper ? {paper} : {}), ...(reference ? {reference} : {}), ...(flag('--intent') ? {intent: flag('--intent')!} : {}), ...(out ? {out} : {})});
   if (!r.pass) process.exitCode = 2;
   return {score: r.score, pass: r.pass, problems: r.issues.map(i => `${i.hard ? 'Must fix' : 'Fix'}: ${i.what} ${i.fix}`), good: r.good, ...(out ? {recorded: out} : {})};
  }
  default: throw new Error(usage);
 }
}
main().then(r => console.log(JSON.stringify(r, null, 2)), e => {console.error((e as Error).message); process.exit(1);});
