// What each medium is good at, how a working artist builds a picture in it, and the checks of a
// plan against that practice (lint). The painter follows the plan; this is how the plan is judged
// before a single mark is made.
import type {Medium, Painting, Mark} from './schema.js';

export type MediumGuide = {medium: Medium; paper: string; ground: string; marks: string[]; order: string[]; principles: string[]};

export const GUIDES: Record<Medium, MediumGuide> = {
 pencil: {medium: 'pencil', paper: 'smooth or hot-press', ground: '#f6f3ec',
  marks: ['line (2H to block in, HB for form, 2B for the darks)', 'shape with hatch for tone areas', 'from-picture style pencil'],
  order: ['Light construction lines with 2H: proportions, the big shapes', 'Shadow shapes with HB hatching, one direction', 'Darks with 2B, crossing hatches', 'Accents and edges; leave the lightest lights as paper'],
  principles: ['Light pressure first; the darkest darks last', 'Hatching follows the form', 'Keep the lightest lights untouched paper']},
 charcoal: {medium: 'charcoal', paper: 'rough or toned', ground: '#e9e3d6',
  marks: ['line with charcoal', 'brushwork with charcoal', 'shape with hatch (tool charcoal)', 'paint with blender to smudge'],
  order: ['Big gestures for the composition', 'Mass in the shadow shapes, smudge them with the blender', 'Push the darks; lift lights with a pale shape or glaze', 'Crisp accents at the centre of interest'],
  principles: ['Mass, then line', 'Lost and found edges: smudge most, sharpen a few']},
 ink: {medium: 'ink', paper: 'smooth', ground: '#f7f4ee',
  marks: ['ink (tapered pressure lines)', 'line with pen or rotring', 'shape with hatch (tool pen)', 'paint with wash for ink washes'],
  order: ['Pencil guide lines (2H, very light)', 'Main contours in ink, thick to thin with pressure', 'Hatching and cross-hatching for tone', 'Spot blacks and a few washes'],
  principles: ['Line weight: thicker on the shadow side and in front', 'Commit: few, sure lines']},
 watercolor: {medium: 'watercolor', paper: 'cold-press or rough', ground: '#f8f5ee',
  marks: ['shape with fill (wet watercolour, bleeding edges)', 'paint with wash or glaze', 'brushwork with wash', 'line with 2H or HB for the drawing'],
  order: ['A light pencil drawing', 'Big light washes (sky, the overall colour), wet', 'Middle values, shape by shape', 'Darks and details, smaller brushes', 'A few lines or a glaze to finish'],
  principles: ['Light to dark: watercolour cannot cover a dark with a light', 'Save the whites: the paper is the lightest light', 'Big brushes first, small last', 'Few layers; muddy colour comes from overworking']},
 gouache: {medium: 'gouache', paper: 'hot-press', ground: '#f1ece2',
  marks: ['paint with flat or round', 'brushwork', 'shape with wash for flat areas'],
  order: ['Drawing', 'Flat mid-tone shapes', 'Shadows and lights as flat shapes', 'Details and highlights on top'],
  principles: ['Opaque: lights can go over darks', 'Flat, designed shapes']},
 oil: {medium: 'oil', paper: 'canvas', ground: '#b9a184',
  marks: ['paint with filbert, flat, round, fan, knife, dry, blender', 'brushwork', 'from-picture style oil, impressionist or expressionist', 'glaze', 'finish with impasto'],
  order: ['A toned ground and a thin drawing in one dark colour', 'Block in the big shapes, thin, with big brushes (lean)', 'Colour and form, thicker', 'Details and highlights, thickest (fat over lean)', 'Impasto light; a glaze if the colour needs unity'],
  principles: ['Dark to light; thin to thick (fat over lean)', 'Big brushes first, small last', 'Thick paint and the knife only at the end, in the lights', 'Vary the edges: soft in shadow, hard at the focus']},
 acrylic: {medium: 'acrylic', paper: 'canvas or panel', ground: '#c9b79c',
  marks: ['paint with flat, filbert, round, knife', 'brushwork', 'glaze', 'from-picture style oil or expressionist'],
  order: ['Toned ground and drawing', 'Block-in, big brushes', 'Colour and form', 'Details and highlights', 'Glazes'],
  principles: ['Dries fast: build in layers', 'Big to small']},
 pastel: {medium: 'pastel', paper: 'toned', ground: '#7d8a91',
  marks: ['line with pastel or crayon', 'brushwork with pastel', 'paint with blender to blend'],
  order: ['Drawing on toned paper', 'Darks and middle values, side of the stick', 'Lights and colour accents', 'A few blended passages, most strokes left visible'],
  principles: ['Toned paper is the middle value', 'Dark to light', 'Do not over-blend']},
 mixed: {medium: 'mixed', paper: 'cold-press', ground: '#f4efe4',
  marks: ['every kind of mark'],
  order: ['Drawing', 'Washes and big shapes', 'Paint and texture', 'Lines and details on top'],
  principles: ['Transparent media under opaque', 'Big to small']},
};

const L = (hex: string) => {const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;}); const y = 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;};
const colourOf = (m: Mark): string[] => {
 if (m.kind === 'line' || m.kind === 'ink' || m.kind === 'finish') return []; // drawing lines and accents are not layers of paint
 if (m.kind === 'shape') return [m.fill?.color, m.wash?.color].filter((x): x is string => !!x);
 if (m.kind === 'brushwork') return m.colors.map(c => Array.isArray(c) ? c[0] : c);
 if ('color' in m && typeof m.color === 'string') return [m.color];
 return [];
};
const sizeOf = (m: Mark) => m.kind === 'paint' || m.kind === 'brushwork' || m.kind === 'ink' ? m.size : m.kind === 'from-picture' ? Math.min(...(m.sizes ?? [8])) : null;

export type Lint = {level: 'problem' | 'advice'; pass: number | null; what: string};

/** Checks a plan against how an artist works in its medium, before it is painted. */
export function lint(p: Painting): Lint[] {
 const out: Lint[] = [], g = GUIDES[p.medium], kinds = p.passes.map(s => s.kind);
 const painted = p.passes.filter(s => s.marks.length);
 if (!painted.length) out.push({level: 'problem', pass: null, what: 'No pass has any marks yet.'});
 if (p.passes.length < 3 && !p.passes.some(s => s.marks.some(m => m.kind === 'from-picture'))) out.push({level: 'advice', pass: null, what: `Only ${p.passes.length} pass${p.passes.length > 1 ? 'es' : ''}: an artist builds a painting in stages (${g.order.length}: ${g.order.map(o => o.split(':')[0]!.split(',')[0]!.toLowerCase()).join('; ')}).`});
 const first = kinds.findIndex(k => k === 'detail'), block = kinds.findIndex(k => k === 'block-in');
 if (first >= 0 && block > first) out.push({level: 'problem', pass: first + 1, what: 'Detail comes before the block-in: block in the big shapes first.'});
 // Big to small: the typical brush of each pass should not grow after the block-in.
 const sizes = p.passes.map(s => {const v = s.marks.map(sizeOf).filter((x): x is number => x !== null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)]! : null;});
 for (let i = 1; i < sizes.length; i++) {const prev = sizes.slice(0, i).filter((x): x is number => x !== null); const now = sizes[i];
  if (now !== null && prev.length && now > Math.max(...prev) * 1.6 && p.passes[i]!.kind !== 'glaze' && p.passes[i]!.kind !== 'finish') out.push({level: 'advice', pass: i + 1, what: `Its brushes (${Math.round(now)} px) are much bigger than earlier passes': artists go from big brushes to small.`});}
 const meanL = p.passes.map(s => {const c = s.marks.flatMap(colourOf); return c.length ? c.reduce((a, h) => a + L(h), 0) / c.length : null;});
 if (p.medium === 'watercolor') {
  for (let i = 1; i < meanL.length; i++) {const a = meanL.slice(0, i).filter((x): x is number => x !== null), b = meanL[i];
   if (b !== null && b !== undefined && a.length && b > Math.min(...a) + 12 && p.passes[i]!.kind !== 'finish') out.push({level: 'problem', pass: i + 1, what: `Its colours (lightness ${Math.round(b)}) are lighter than an earlier pass (${Math.round(Math.min(...a))}): watercolour goes light to dark; a light cannot cover a dark.`});}
  if (p.passes.some(s => s.marks.some(m => m.kind === 'paint' && ['knife', 'flat', 'filbert'].includes(m.brush) && (m.thickness ?? 0) > 0.5))) out.push({level: 'advice', pass: null, what: 'Thick paint in a watercolour: use wash and glaze brushes and shapes with a fill.'});
 }
 if (p.medium === 'oil' || p.medium === 'acrylic') {
  const thick = p.passes.findIndex(s => s.marks.some(m => m.kind === 'paint' && (m.brush === 'knife' || (m.thickness ?? 0) >= 1.5)));
  if (thick >= 0 && thick < Math.floor(p.passes.length / 2) && p.passes.length >= 3) out.push({level: 'advice', pass: thick + 1, what: 'Thick paint (knife or impasto) early: fat over lean puts the thickest paint in the last passes.'});
  if (!p.passes.some(s => s.marks.some(m => m.kind === 'finish'))) out.push({level: 'advice', pass: null, what: 'No finish mark: add {"kind":"finish","impasto":0.8} at the end to light the thick paint.'});
  if (p.canvas.ground.toLowerCase() === '#ffffff') out.push({level: 'advice', pass: null, what: 'A white ground: oil painters usually tone the canvas (a warm middle value) so every colour is judged against it.'});
 }
 const all = p.passes.flatMap(s => s.marks), pics = all.filter(m => m.kind === 'from-picture').map(m => (m as {picture: string}).picture);
 for (const name of pics) if (!p.pictures?.[name]) out.push({level: 'problem', pass: null, what: `A mark paints from the picture "${name}", which the plan's pictures do not list.`});
 const W = p.canvas.width, H = p.canvas.height;
 const outside = all.filter(m => 'points' in m && m.points && (m.points as number[][]).some(q => q[0]! < -W * 0.2 || q[1]! < -H * 0.2 || q[0]! > W * 1.2 || q[1]! > H * 1.2)).length;
 if (outside) out.push({level: 'advice', pass: null, what: `${outside} mark${outside > 1 ? 's go' : ' goes'} far outside the ${W}x${H} canvas.`});
 return out;
}

const shortName = (why: string) => {const n = why.split(/[,:;(]/)[0]!.trim(); return n.length <= 28 ? n : n.split(' ').slice(0, 4).join(' ');};

/** A starting plan for a medium: the canvas, the passes an artist would use, empty. */
export function starter(title: string, medium: Medium, o: {width: number; height: number; paper?: string; ground?: string; picture?: string; seed?: number}) {
 const g = GUIDES[medium], kinds = ['drawing', 'block-in', 'colour', 'detail', 'finish'] as const;
 return {version: 1, title, medium, seed: o.seed ?? Math.floor(Math.random() * 1e6),
  canvas: {width: o.width, height: o.height, paper: o.paper ?? g.paper.split(' ')[0], ground: o.ground ?? g.ground},
  ...(o.picture ? {pictures: {reference: o.picture}} : {}),
  passes: g.order.slice(0, 5).map((why, i) => ({name: shortName(why), kind: kinds[Math.min(i, kinds.length - 1)]!, why, marks: [] as unknown[]}))};
}
