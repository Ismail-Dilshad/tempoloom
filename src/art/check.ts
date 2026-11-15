// The critique an art teacher gives a finished painting, measured: is there a full range of values,
// does one value family dominate, is the colour clean, is there a place the eye goes to, are the
// edges varied, is the paper left where the medium needs it, and (with a reference) is it alike.
// Every issue says what to do in the next pass. A painting passes at 75 with no hard problem.
import fs from 'node:fs';
import path from 'node:path';
import {lookAtPicture, type Look} from './paint.js';
import type {Medium} from './schema.js';

export type Issue = {hard: boolean; what: string; fix: string; points: number};
export type Critique = {picture: string; medium: Medium; score: number; pass: boolean; issues: Issue[]; good: string[]; look: Look};

const pct = (v: number) => Math.round(v * 100) + '%';
const MONO: Medium[] = ['pencil', 'charcoal', 'ink'];

/** With `ref` (the reference measured the same way) a painting is not blamed for what its subject
 *  already is: a dark, grey subject painted dark and grey is faithful, not muddy. */
export function critique(look: Look, medium: Medium, o: {intent?: string; ref?: Look} = {}): {issues: Issue[]; good: string[]} {
 const issues: Issue[] = [], good: string[] = [], v = look.values, high = /high[- ]key|light|airy|soft|misty|fog/i.test(o.intent ?? ''), low = /low[- ]key|night|dark|moody|noir/i.test(o.intent ?? '');
 const range = v.lightest - v.darkest, refRange = o.ref ? o.ref.values.lightest - o.ref.values.darkest : null;
 if (range < (high || low ? 35 : 55) && !(refRange !== null && range >= refRange - 8)) issues.push({hard: range < 30, points: range < 30 ? 25 : 14, what: `The values are close together: the darkest dark is ${v.darkest} and the lightest light ${v.lightest} (out of 100).`, fix: low ? 'Keep it dark, but give the focus one light that really shines.' : 'Push the darkest darks darker at the centre of interest and keep a few lights clean.'});
 else good.push(`A full range of values (${v.darkest} to ${v.lightest}).`);
 const top = Math.max(v.dark, v.mid, v.light), name = top === v.dark ? 'dark' : top === v.mid ? 'middle' : 'light';
 const refTop = o.ref ? Math.max(o.ref.values.dark, o.ref.values.mid, o.ref.values.light) : null;
 if (top < 0.42 && !(refTop !== null && top >= refTop - 0.06)) issues.push({hard: false, points: 10, what: `No value family leads: dark ${pct(v.dark)}, middle ${pct(v.mid)}, light ${pct(v.light)}.`, fix: 'Let one of light, middle or dark take most of the picture; group the others into a few simple shapes (squint at it).'});
 else good.push(`The ${name} values lead (${pct(top)}), so the picture reads as one design.`);
 if (!MONO.includes(medium)) {
  const mudLimit = o.ref ? Math.max(0.38, o.ref.colour.mud + 0.12) : 0.38;
  if (look.colour.mud > mudLimit) issues.push({hard: look.colour.mud > 0.55, points: look.colour.mud > 0.55 ? 20 : 12, what: `${pct(look.colour.mud)} of the picture is greyish middle-value colour (mud).`, fix: medium === 'watercolor' ? 'Fewer layers: mix on the paper, wet in wet, and stop before it is overworked.' : 'Mix fewer colours into each note; let some passages stay clean and saturated, especially near the focus.'});
  if (look.colour.hues > Math.max(5, o.ref?.colour.hues ?? 0)) issues.push({hard: false, points: 8, what: `${look.colour.hues} different hues compete.`, fix: 'Limit the palette: one main hue family, its complement as an accent.'});
  if (look.colour.hues >= 1 && look.colour.hues <= 4 && look.colour.mud <= mudLimit) good.push(`A controlled palette (${look.colour.hues} hue famil${look.colour.hues > 1 ? 'ies' : 'y'}).`);
 }
 if (look.paper !== null) {
  if ((medium === 'watercolor') && look.paper < 0.005 && !low) issues.push({hard: false, points: 8, what: 'No white paper is left.', fix: 'In watercolour the paper is the lightest light: keep the highlights unpainted.'});
  if (['oil', 'acrylic', 'gouache'].includes(medium) && look.paper > 0.12) issues.push({hard: look.paper > 0.3, points: look.paper > 0.3 ? 20 : 10, what: `${pct(look.paper)} of the ground still shows.`, fix: 'Cover the canvas in the block-in (bigger brushes, longer strokes), unless the ground is meant to show.'});
 }
 const f = look.focus, cx = Math.abs(f.x - 0.5), cy = Math.abs(f.y - 0.5);
 if (f.strength < 1.6) issues.push({hard: false, points: 10, what: 'The eye has nowhere to go: contrast and detail are spread evenly.', fix: 'Choose a centre of interest: put the strongest contrast, the sharpest edges and the most detail there, and quieten the rest.'});
 else if (cx < 0.07 && cy < 0.07) issues.push({hard: false, points: 5, what: 'The centre of interest sits in the dead centre.', fix: 'Move it towards a third (left or right, up or down) for a livelier composition, unless the subject wants symmetry.'});
 else if (f.x < 0.06 || f.x > 0.94 || f.y < 0.06 || f.y > 0.94) issues.push({hard: false, points: 8, what: 'The strongest contrast is at the edge of the picture, which pulls the eye out of it.', fix: 'Soften or darken the edges and move the strongest contrast inward.'});
 else good.push(`A clear centre of interest (${Math.round(f.x * 100)}% across, ${Math.round(f.y * 100)}% down).`);
 if (look.edges.amount > 0.02) {
  if (look.edges.hard > 0.75) issues.push({hard: false, points: 8, what: `Almost every edge is hard (${pct(look.edges.hard)}).`, fix: 'Lose some edges: soften where forms turn away or sit in shadow; keep the hard ones at the focus.'});
  else if (!MONO.includes(medium) && (o.ref ? look.edges.hard < o.ref.edges.hard * 0.3 : look.edges.hard < 0.015)) issues.push({hard: false, points: 6, what: 'Every edge is soft; nothing comes into focus.', fix: 'Sharpen a few edges at the centre of interest.'});
  else good.push('Varied edges: soft and lost in places, hard in others.');
 }
 if (look.likeness) {
  const l = look.likeness;
  if (l.values < 0.55) issues.push({hard: l.values < 0.35, points: l.values < 0.35 ? 22 : 12, what: `The big value shapes differ from the reference (alike ${Math.round(l.values * 100)}%).`, fix: 'Compare a value study of both (squint): correct the big light and dark shapes before any detail.'});
  else good.push(`The big value shapes follow the reference (alike ${Math.round(l.values * 100)}%).`);
  if (l.colour > 35) issues.push({hard: false, points: 6, what: `The colours are far from the reference (average difference ${Math.round(l.colour)}).`, fix: 'Mix the big colour notes from the reference; it is fine to push them, not to lose them.'});
 }
 return {issues, good};
}

/** Looks at a painting and writes the critique (and check.json in `job`'s folder when given). */
export async function checkPainting(picture: string, o: {medium: Medium; paper?: string; reference?: string; intent?: string; out?: string}): Promise<Critique> {
 const file = path.resolve(picture);
 if (!fs.existsSync(file)) throw new Error('No such picture: ' + file);
 const look = await lookAtPicture(file, {...(o.paper ? {paper: o.paper} : {}), ...(o.reference ? {reference: o.reference} : {})});
 const ref = o.reference ? await lookAtPicture(o.reference) : undefined;
 const {issues, good} = critique(look, o.medium, {...(o.intent ? {intent: o.intent} : {}), ...(ref ? {ref} : {})});
 const score = Math.max(0, 100 - issues.reduce((a, i) => a + i.points, 0));
 const r: Critique = {picture: file, medium: o.medium, score, pass: score >= 75 && !issues.some(i => i.hard), issues, good, look};
 if (o.out) fs.writeFileSync(o.out, JSON.stringify({...r, at: new Date().toISOString()}, null, 1) + '\n');
 return r;
}
