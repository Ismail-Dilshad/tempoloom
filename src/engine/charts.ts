// Charts from data: numbers you paste (a table, a CSV, "Label: value" lines) become an animated
// chart scene in the video's own style - bars that grow while their values count up, a line that
// draws itself through its points, or big counting numbers. The chart is a composed scene piece
// (engine/scene-pieces-schema.ts), so it takes the style, colours and sounds of the video.
import fs from 'node:fs';
import path from 'node:path';
import type {Piece, Layer} from './scene-pieces-schema.js';

export type Point = {label: string; value: number};
export type Data = {title?: string; series: {name: string; points: Point[]}[]; prefix?: string; suffix?: string; decimals: number};
export type ChartKind = 'bar' | 'line' | 'count' | 'compare';

const num = (s: string) => {
 const t = s.trim().replace(/[٫]/g, '.').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6F0));
 const m = /^([$€£¥]?)\s*(-?[\d.,]+)\s*([%kKmMbB]?|bn|mn)\s*$/.exec(t);
 if (!m) return null;
 let v = Number(m[2]!.replace(/,(?=\d{3}\b)/g, '').replace(/,/g, '.'));
 if (!Number.isFinite(v)) return null;
 const k = m[3]!.toLowerCase();
 return {v, prefix: m[1] || undefined, suffix: k === '%' ? '%' : k === 'k' ? 'K' : k === 'm' || k === 'mn' ? 'M' : k === 'b' || k === 'bn' ? 'B' : undefined, decimals: (m[2]!.split(/[.]/)[1] ?? '').length};
};

/** Reads pasted numbers: "Label: value" or "Label, value" lines, a CSV or TSV table (the first
 *  column labels, one column per series), or JSON ({label: value} or [{label, value}]). */
export function parseData(text: string, o: {title?: string} = {}): Data {
 const raw = text.trim();
 if (!raw) throw new Error('No data: paste "Label: value" lines or a table');
 if (/^[[{]/.test(raw)) {
  const j = JSON.parse(raw) as unknown;
  const pts: Point[] = Array.isArray(j) ? (j as {label?: string; name?: string; value: number}[]).map(x => ({label: String(x.label ?? x.name ?? ''), value: Number(x.value)})) : Object.entries(j as Record<string, number>).map(([label, value]) => ({label, value: Number(value)}));
  if (!pts.length || pts.some(p => !Number.isFinite(p.value))) throw new Error('The JSON needs numbers: {"Label": 12} or [{"label": "A", "value": 12}]');
  return {...(o.title ? {title: o.title} : {}), series: [{name: 'Value', points: pts}], decimals: Math.max(...pts.map(p => (String(p.value).split('.')[1] ?? '').length))};
 }
 const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
 const sep = (l: string) => l.includes('\t') ? l.split('\t') : /^[^:]+:\s*\S/.test(l) && !l.includes(',') ? [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)] : l.split(/\s*[,;]\s*(?=[^,;]*$)|\s*[,;]\s*/);
 let rows = lines.map(sep).map(c => c.map(x => x.trim().replace(/^"|"$/g, '')));
 let title = o.title, names = ['Value'];
 // A first row whose cells after the first are not numbers is a header (or a title line).
 const head = rows[0]!;
 if (rows.length > 1 && (head.length > 1 ? head.slice(1).every(c => num(c) === null) : !/\s\S*\d\S*$/.test(head[0]!))) {
  if (rows[0]!.length === 1) title ??= rows[0]![0]; else names = rows[0]!.slice(1);
  rows = rows.slice(1);
 }
 // "Label value" without a separator: the last word is the number.
 rows = rows.map(r => r.length === 1 ? (() => {const m = /^(.*\S)\s+(\S+)$/.exec(r[0]!); return m ? [m[1]!, m[2]!] : r;})() : r);
 const width = Math.max(...rows.map(r => r.length));
 if (width < 2) throw new Error('Each line needs a label and a number, like "Coffee: 42"');
 const series = Array.from({length: width - 1}, (_, k) => ({name: names[k] ?? `Series ${k + 1}`, points: [] as Point[]}));
 let prefix: string | undefined, suffix: string | undefined, decimals = 0;
 for (const r of rows) for (let k = 1; k < width; k++) {
  const n = r[k] === undefined ? null : num(r[k]!);
  if (!n) continue;
  series[k - 1]!.points.push({label: r[0]!, value: n.v});
  prefix ??= n.prefix; suffix ??= n.suffix; decimals = Math.max(decimals, Math.min(2, n.decimals));
 }
 const kept = series.filter(s => s.points.length);
 if (!kept.length) throw new Error('No numbers found: each line needs a label and a number, like "Coffee: 42"');
 return {...(title ? {title} : {}), series: kept.slice(0, 3), ...(prefix ? {prefix} : {}), ...(suffix ? {suffix} : {}), decimals};
}

const TIMELIKE = /^(?:(?:19|20)\d{2}|q[1-4]|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|(?:mon|tue|wed|thu|fri|sat|sun)\w*|week\s*\d+|day\s*\d+|month\s*\d+|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)\b/i;

/** The chart that fits the numbers: one value counts up, two compare, things over time draw a line,
 *  categories become bars. */
export function chooseKind(d: Data): {kind: ChartKind; why: string} {
 const p = d.series[0]!.points;
 if (p.length === 1) return {kind: 'count', why: 'one number: it counts up'};
 if (p.length === 2 && d.series.length === 1) return {kind: 'compare', why: 'two numbers: side by side, the change between them'};
 if (d.series.length > 1 || p.length > 8 || p.filter(x => TIMELIKE.test(x.label)).length >= p.length * 0.6) return {kind: 'line', why: d.series.length > 1 ? 'several series: lines' : 'values over time: a line that draws itself'};
 return {kind: 'bar', why: 'categories: bars that grow while their values count'};
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const IN = (at: number, dur: number, from: Layer['in']['from'], sound?: Layer['in']['sound']) => ({at: r3(at), dur, from, ...(sound ? {sound} : {})}) as Layer['in'];
const L = (l: Partial<Layer> & {type: Layer['type']}) => ({x: 0, y: 0, shape: 'rect', size: 5, weight: 700, align: 'start', progress: 1, level: 1, rotate: 0, opacity: 1, from: 0, decimals: 0, in: IN(0, .5, 'up'), ...l}) as Layer;
const short = (s: string, n: number) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
const fmt = (d: Data) => ({...(d.prefix ? {prefix: d.prefix} : {}), ...(d.suffix ? {suffix: d.suffix} : {}), decimals: d.decimals});

/** The chart as a composed scene piece (0..1 coordinates inside the piece). */
export function chartPiece(d: Data, o: {kind?: ChartKind; highlight?: string; sort?: boolean} = {}): Piece {
 const kind = o.kind ?? chooseKind(d).kind, s0 = d.series[0]!;
 let pts = [...s0.points];
 if (o.sort && kind === 'bar') pts.sort((a, b) => b.value - a.value);
 const layers: Layer[] = [], top = d.title ? .16 : .04;
 if (d.title) layers.push(L({type: 'text', text: short(d.title, 60), x: .04, y: .02, w: .72, h: .1, size: 5.6, weight: 800, in: IN(0, .5, 'up')}));
 const max = Math.max(...d.series.flatMap(s => s.points.map(p => Math.abs(p.value))), 1e-9);
 const best = pts.reduce((a, b) => b.value > a.value ? b : a, pts[0]!), hi = o.highlight?.toLowerCase();
 const hot = (p: Point) => hi ? p.label.toLowerCase().includes(hi) : p === best;
 if (kind === 'bar') {
  pts = pts.slice(0, 8);
  // Each row: the label and its value on one line, the bar under them; all inside the left three
  // quarters, clear of the platforms' buttons on the right of a vertical video.
  const n = pts.length, row = (0.96 - top) / n, barH = Math.min(.09, row * .3), size = Math.min(6, 3.2 + 10 / n);
  pts.forEach((p, i) => {
   const y = top + i * row, at = .25 + i * .18;
   layers.push(L({type: 'text', text: short(p.label, 24), x: .04, y, w: .5, h: row * .44, size, weight: 600, color: 'muted', in: IN(at, .4, 'fade')}));
   layers.push(L({type: 'number', value: p.value, ...fmt(d), x: .5, y, w: .26, h: row * .44, size: size * 1.15, weight: 800, align: 'end', ...(hot(p) ? {color: 'accent'} : {}), in: IN(at + .05, .9, 'count', hot(p) ? 'pop' : undefined)}));
   layers.push(L({type: 'bar', x: .04, y: y + row * .5, w: .72, h: barH, progress: Math.max(.02, Math.abs(p.value) / max), ...(hot(p) ? {fill: 'accent'} : {}), in: IN(at + .05, .9, 'grow', i === 0 ? 'whoosh' : undefined)}));
  });
 } else if (kind === 'line') {
  const series = d.series.slice(0, 3), labels = series[0]!.points.map(p => p.label), n = labels.length;
  const all = series.flatMap(s => s.points.map(p => p.value)), lo = Math.min(...all, 0), span = Math.max(...all) - lo || 1;
  const x0 = .06, x1 = .8, y0 = top + .1, y1 = .82, X = (i: number) => r3(x0 + (x1 - x0) * (n === 1 ? .5 : i / (n - 1))), Y = (v: number) => r3(y1 - (y1 - y0) * (v - lo) / span);
  layers.push(L({type: 'line', points: [{x: x0, y: y1 + .01}, {x: x1 + .04, y: y1 + .01}], x: 0, y: 0, w: 1, h: 1, size: 1.5, color: 'muted', opacity: .5, in: IN(.1, .5, 'draw')}));
  series.forEach((s, k) => {
   const p = s.points.slice(0, 24);
   layers.push(L({type: 'line', points: p.map((q, i) => ({x: X(i), y: Y(q.value)})), x: 0, y: 0, w: 1, h: 1, size: k ? 3.5 : 5, color: k === 0 ? 'primary' : k === 1 ? 'accent' : 'muted', in: IN(.3 + k * .3, 1.4 + n * .05, 'draw', k === 0 ? 'whoosh' : undefined)}));
   const last = p[p.length - 1]!;
   layers.push(L({type: 'shape', shape: 'circle', x: r3(X(p.length - 1) - .02), y: r3(Y(last.value) - .02), w: .04, fill: k === 0 ? 'primary' : k === 1 ? 'accent' : 'muted', in: IN(1.6 + k * .3 + n * .05, .35, 'pop')}));
   layers.push(L({type: 'number', value: last.value, ...fmt(d), x: .42, y: r3(Math.max(y0 - .08, Y(last.value) - .12)), w: .4, h: .1, size: 6.2, weight: 800, align: 'end', color: k === 0 ? 'primary' : k === 1 ? 'accent' : 'text', in: IN(1.6 + k * .3 + n * .05, .7, 'count', k === 0 ? 'pop' : undefined)}));
   if (series.length > 1) layers.push(L({type: 'text', text: short(s.name, 18), x: .06 + k * .25, y: .93, w: .24, h: .06, size: 3.4, weight: 700, color: k === 0 ? 'primary' : k === 1 ? 'accent' : 'muted', in: IN(.4, .4, 'fade')}));
  });
  const step = Math.max(1, Math.ceil(n / 5));
  labels.forEach((lb, i) => {if (i % step && i !== n - 1) return; layers.push(L({type: 'text', text: short(lb, 10), x: r3(Math.min(.8, Math.max(0, X(i) - .08))), y: .84, w: .16, h: .07, size: 4.4, weight: 600, color: 'muted', align: 'center', in: IN(.2, .4, 'fade')}));});
 } else if (kind === 'count') {
  const p = pts[0]!;
  layers.push(L({type: 'number', value: p.value, ...fmt(d), x: .05, y: top + .14, w: .9, h: .34, size: 18, weight: 800, align: 'center', color: 'primary', in: IN(.3, 1.6, 'count', 'tick')}));
  layers.push(L({type: 'text', text: short(p.label, 40), x: .08, y: top + .52, w: .84, h: .12, size: 4, weight: 600, align: 'center', color: 'muted', in: IN(1.2, .5, 'up')}));
  layers.push(L({type: 'bar', x: .25, y: top + .7, w: .5, h: .025, progress: 1, fill: 'accent', in: IN(1.6, .6, 'grow')}));
 } else {
  const [a, b] = pts as [Point, Point], change = a.value ? (b.value - a.value) / Math.abs(a.value) : null;
  [a, b].forEach((p, i) => {
   const x = i ? .53 : .05, at = .3 + i * .7;
   layers.push(L({type: 'text', text: short(p.label, 22), x, y: top + .04, w: .42, h: .08, size: 3.4, weight: 600, align: 'center', color: 'muted', in: IN(at, .4, 'fade')}));
   layers.push(L({type: 'number', value: p.value, ...fmt(d), x, y: top + .14, w: .42, h: .2, size: 10, weight: 800, align: 'center', color: i ? 'accent' : 'text', in: IN(at, 1.1, 'count', i ? 'pop' : 'tick')}));
   layers.push(L({type: 'bar', x: x + .06, y: top + .42, w: .3, h: .04, progress: Math.max(.04, Math.abs(p.value) / max), ...(i ? {fill: 'accent'} : {}), in: IN(at + .1, .8, 'grow')}));
  });
  if (change !== null && Number.isFinite(change)) layers.push(L({type: 'text', text: `${change >= 0 ? '+' : '−'}${Math.abs(Math.round(change * 100))}%`, x: .2, y: top + .56, w: .6, h: .14, size: 7, weight: 800, align: 'center', color: change >= 0 ? 'primary' : 'accent', in: IN(1.8, .5, 'pop', 'success')}));
 }
 return {kind: 'compose', name: `chart-${kind}`, layers, placement: 'center', size: kind === 'bar' ? .66 : .6, transition: 'wipe', delay: .15, direction: 'auto', keep: true, designed: {archetype: `chart-${kind}`, description: `A ${kind} chart drawn from the user's numbers: ${chooseKind(d).why}.`}};
}

/** Reads a data file (or pasted text after "data:") into a chart piece, with what was found. */
export function chartFromFile(file: string, o: {kind?: ChartKind; title?: string; highlight?: string; sort?: boolean} = {}) {
 const text = fs.readFileSync(path.resolve(file), 'utf8');
 const d = parseData(text, {...(o.title ? {title: o.title} : {})});
 const kind = o.kind ?? chooseKind(d).kind;
 return {data: d, kind, why: o.kind ? 'as asked' : chooseKind(d).why, piece: chartPiece(d, {kind, ...(o.highlight ? {highlight: o.highlight} : {}), ...(o.sort ? {sort: true} : {})})};
}

/** Which sentence of a script a chart belongs to: the one that shares the most of its labels and
 *  numbers, else the first with a figure, else the middle one. */
export function sentenceFor(sentences: string[], d: Data) {
 const words = new Set(d.series.flatMap(s => s.points.flatMap(p => [p.label.toLowerCase(), String(p.value)])).concat((d.title ?? '').toLowerCase().split(/\s+/).filter(w => w.length > 3)));
 const score = sentences.map(s => {const t = s.toLowerCase(); let k = 0; for (const w of words) if (w && t.includes(w)) k++; return k;});
 const best = score.indexOf(Math.max(...score));
 if (score[best]! > 0) return best;
 const fig = sentences.findIndex(s => /\d/.test(s));
 return fig >= 0 ? fig : Math.floor(sentences.length / 2);
}
