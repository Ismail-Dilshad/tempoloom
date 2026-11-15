// List and countdown videos: a "5 reasons" or "top 10" script gets one scene per item, each with
// the item's big number, a progress bar of the whole list and the same layout, so the list reads
// as one rhythm; every item scene is the same length. A countdown counts down (5, 4, 3...).
import type {Piece, Layer} from './scene-pieces-schema.js';

export type ListItem = {n: number; text: string; line: number};
export type ListScript = {title: string | null; items: ListItem[]; outro: string | null; countdown: boolean; lines: string[]};

const MARK = /^\s*(?:(?:#|no\.?|number)\s*(\d{1,2})\s*[:.)\-–—]?|(\d{1,2})\s*[.):\-–—]|\(?(\d{1,2})\))\s+(.+)$/i;
const TITLE = /\b(?:top\s+\d{1,2}|\d{1,2}\s+(?:reasons|ways|things|tips|mistakes|signs|steps|facts|ideas|habits|rules|tools|secrets|myths|lessons|questions|places|books|apps|foods|best|worst|minutes?)|countdown)\b/i;

/** A script that is a numbered list: its title, items (numbered 1., #2, "Number 3:", 4) ...) and the
 *  lines after them; null when it is not one (fewer than three numbered lines, or numbers out of order). */
export function readList(script: string): ListScript | null {
 const lines = script.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
 const items: ListItem[] = [];
 lines.forEach((l, i) => {const m = MARK.exec(l); if (m) items.push({n: Number(m[1] ?? m[2] ?? m[3]), text: m[4]!.trim(), line: i});});
 if (items.length < 3) return null;
 const up = items.every((x, i) => !i || x.n === items[i - 1]!.n + 1), down = items.every((x, i) => !i || x.n === items[i - 1]!.n - 1);
 if (!up && !down) return null;
 const first = items[0]!.line, last = items[items.length - 1]!.line;
 const before = lines.slice(0, first), after = lines.slice(last + 1);
 const title = before.find(l => TITLE.test(l)) ?? before[0] ?? null;
 return {title, items, outro: after.length ? after.join(' ') : null, countdown: down || /\bcountdown\b/i.test(title ?? ''), lines};
}

/** True when the script says it is a list ("5 reasons", "top 10") or is numbered line by line. */
export const isList = (script: string) => !!readList(script);

/** The script as it is spoken: the title, each item without its number (the number is on screen),
 *  and the closing lines; one item a line. */
export function spokenScript(l: ListScript, o: {keepNumbers?: boolean} = {}) {
 const pre = l.title ? [l.title] : [];
 return [...pre, ...l.items.map(x => o.keepNumbers ? `${x.n}. ${x.text}` : x.text), ...(l.outro ? [l.outro] : [])].join('\n');
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const IN = (at: number, dur: number, from: Layer['in']['from'], sound?: Layer['in']['sound']) => ({at: r3(at), dur, from, ...(sound ? {sound} : {})}) as Layer['in'];
const L = (l: Partial<Layer> & {type: Layer['type']}) => ({x: 0, y: 0, shape: 'rect', size: 5, weight: 700, align: 'start', progress: 1, level: 1, rotate: 0, opacity: 1, from: 0, decimals: 0, in: IN(0, .5, 'up'), ...l}) as Layer;

/** One item's visual: the big number, "of N" and the progress through the list; the same layout for
 *  every item, so only the number and the progress change. */
export function itemPiece(item: ListItem, index: number, total: number, o: {countdown: boolean}): Piece {
 const done = index + 1, seg = Math.min(total, 12), gap = .012, w = (0.84 - gap * (seg - 1)) / seg;
 const layers: Layer[] = [
  L({type: 'text', text: String(item.n), x: .1, y: 0, w: .8, h: .5, size: 34, weight: 800, align: 'center', color: 'primary', in: IN(0, .5, 'scale', 'pop')}),
  L({type: 'bar', x: .4, y: .52, w: .2, h: .02, progress: 1, fill: 'accent', in: IN(.2, .4, 'grow')}),
  L({type: 'text', text: o.countdown ? `#${item.n}` : `${done} / ${total}`, x: .2, y: .58, w: .6, h: .1, size: 4.4, weight: 700, align: 'center', color: 'muted', in: IN(.35, .4, 'fade')}),
 ];
 // The progress: one segment per item; the ones already seen are filled, this one grows.
 for (let k = 0; k < seg; k++) {
  const filled = k < done - 1, now = k === done - 1;
  layers.push(L({type: 'bar', x: r3(.08 + k * (w + gap)), y: .8, w: r3(w), h: .035, progress: filled || now ? 1 : 0.0001, ...(now ? {fill: 'accent'} : {}), in: now ? IN(.45, .6, 'grow', 'tick') : IN(0, .05, 'none')}));
 }
 return {kind: 'compose', name: `list-item-${item.n}`, layers, placement: 'center', size: .56, transition: 'push', delay: .1, direction: 'auto', keep: true, designed: {archetype: o.countdown ? 'countdown-item' : 'list-item', description: `Item ${item.n} of a ${o.countdown ? 'countdown' : 'list'} of ${total}: the big number and the list's progress, the same for every item.`}};
}

/** Seconds for every item scene: the longest item's reading time, so the list keeps one rhythm. */
export function itemSeconds(l: ListScript, wordsPerSecond = 2.6) {
 const longest = Math.max(...l.items.map(x => x.text.split(/\s+/).filter(Boolean).length));
 return Math.max(2.5, Math.ceil((longest / wordsPerSecond + 1.1) * 2) / 2);
}
