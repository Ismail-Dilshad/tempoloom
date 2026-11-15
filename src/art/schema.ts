// A painting plan: the canvas, then passes in the order an artist works (drawing, block-in, colour,
// detail, finish), each a list of marks. Coordinates are canvas pixels from the top left; a point
// is [x, y] or [x, y, pressure 0-1]. The painter page (src/art/page/painter.js) paints it.
import {z} from 'zod';

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a colour like #2A4B7C');
const point = z.union([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number(), z.number().min(0).max(1)])]);
const points = z.array(point);
const area = {
 points: points.min(3).optional(),
 ellipse: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]).optional().describe('cx, cy, rx, ry'),
 rect: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]).optional().describe('x, y, width, height'),
};
const hasArea = (s: {points?: unknown; ellipse?: unknown; rect?: unknown}) => !!(s.points || s.ellipse || s.rect);

export const P5_TOOLS = ['pen', 'rotring', '2B', 'HB', '2H', 'cpencil', 'pastel', 'crayon', 'charcoal', 'spray', 'marker'] as const;
export const PAINT_BRUSHES = ['round', 'flat', 'filbert', 'fan', 'knife', 'dry', 'blender', 'soft', 'stipple', 'wash', 'glaze'] as const;
export const PICTURE_STYLES = ['oil', 'impressionist', 'expressionist', 'watercolor', 'pointillist', 'gouache', 'pencil', 'charcoal', 'ink'] as const;
export const PAPERS = ['smooth', 'hot-press', 'cold-press', 'rough', 'toned', 'canvas', 'panel'] as const;
export const PASS_KINDS = ['drawing', 'block-in', 'colour', 'detail', 'finish', 'glaze', 'other'] as const;

/** A drawn line: a pencil, charcoal, pastel, crayon, pen or marker from p5.brush. */
const line = z.object({kind: z.literal('line'), tool: z.enum(P5_TOOLS), color: colour.default('#222222'), size: z.number().positive().default(1), points: points.min(2), curve: z.number().min(0).max(1).optional()});
/** An ink line that swells and tapers with pressure. */
const ink = z.object({kind: z.literal('ink'), color: colour.default('#111111'), size: z.number().positive(), points: points.min(2), thinning: z.number().min(-1).max(1).optional(), taper: z.number().min(0).optional(), opacity: z.number().min(0).max(1).optional()});
/** A shape: a watercolour fill (bleeding edges, granulation), a flat wash, hatching and/or an outline. */
const shape = z.object({kind: z.literal('shape'), ...area, curve: z.number().min(0).max(1).optional(),
 fill: z.object({color: colour, opacity: z.number().min(0).max(1).optional(), bleed: z.number().min(0).max(1).optional(), direction: z.enum(['in', 'out']).optional(), texture: z.number().min(0).max(1).optional(), edge: z.number().min(0).max(1).optional(), split: z.number().min(0).max(1).optional()}).optional(),
 wash: z.object({color: colour, opacity: z.number().min(0).max(1).optional()}).optional(),
 hatch: z.object({gap: z.number().positive().optional(), angle: z.number().optional(), tool: z.enum(P5_TOOLS).optional(), color: colour.optional(), size: z.number().positive().optional(), wobble: z.number().min(0).max(1).optional(), gradient: z.number().min(0).max(1).optional()}).optional(),
 outline: z.object({tool: z.enum(P5_TOOLS).optional(), color: colour.optional(), size: z.number().positive().optional()}).optional(),
}).refine(hasArea, 'a shape needs points, an ellipse or a rect').refine(s => !!(s.fill || s.wash || s.hatch || s.outline), 'a shape needs a fill, a wash, hatching or an outline');
/** One stroke of paint: oil, acrylic, gouache, a palette knife, a blender, or a watercolour stroke. */
const paint = z.object({kind: z.literal('paint'), brush: z.enum(PAINT_BRUSHES).default('round'), color: colour.optional(), size: z.number().positive(), points: points.min(1),
 opacity: z.number().min(0).max(1).optional(), load: z.number().min(0).max(5).optional().describe('how much paint is on the brush; low runs dry'), smudge: z.number().min(0).max(1).optional().describe('how much it mixes with the paint under it'),
 thickness: z.number().min(0).max(3).optional().describe('impasto height'), vary: z.number().min(0).max(1).optional(), edge: z.number().min(0).max(2).optional(), granulate: z.number().min(0).max(1).optional(),
}).refine(s => s.brush === 'blender' || !!s.color, 'every brush but the blender needs a colour');
/** A transparent glaze over an area or the whole picture. */
const glaze = z.object({kind: z.literal('glaze'), color: colour, opacity: z.number().min(0).max(1).default(0.2), mode: z.enum(['multiply', 'source-over', 'overlay', 'soft-light', 'screen', 'color']).optional(), feather: z.number().min(0).optional(), ...area});
/** Many strokes over an area from a few numbers: grass, foliage, sky, water, fur, texture. */
const brushwork = z.object({kind: z.literal('brushwork'), ...area, brush: z.union([z.enum(PAINT_BRUSHES), z.enum(P5_TOOLS), z.literal('ink')]).default('round'),
 colors: z.array(z.union([colour, z.tuple([colour, z.number().positive()])])).min(1), size: z.number().positive(), length: z.number().positive(),
 direction: z.union([z.number(), z.enum(['flow', 'up', 'around', 'out'])]).default('flow'), jitter: z.number().min(0).max(3).optional(), density: z.number().positive().max(6).optional(),
 taper: z.number().min(0).max(1).optional(), opacity: z.number().min(0).max(1).optional(), vary: z.number().min(0).max(1).optional(), smudge: z.number().min(0).max(1).optional(), spill: z.boolean().optional(),
 merge: z.boolean().optional().describe('wet strokes run together into one wash (default for wash and glaze)'), edge: z.number().min(0).max(2).optional(), granulate: z.number().min(0).max(1).optional(), max: z.number().int().positive().max(20000).optional(),
}).refine(hasArea, 'brushwork needs an area: points, an ellipse or a rect');
/** Paint (or draw) a picture: big brushes first, smaller ones only where it still differs. */
const fromPicture = z.object({kind: z.literal('from-picture'), picture: z.string().min(1).describe('a name from the plan\'s pictures'), style: z.enum(PICTURE_STYLES).default('oil'),
 region: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]).optional(), sizes: z.array(z.number().positive()).optional(), detail: z.number().min(0.3).max(3).optional(),
 threshold: z.number().positive().optional(), brush: z.enum(PAINT_BRUSHES).optional(), opacity: z.number().min(0).max(1).optional(), blur: z.number().min(0).max(2).optional(),
 tool: z.enum(P5_TOOLS).optional(), color: colour.optional(), size: z.number().positive().optional(), gap: z.number().positive().optional(), max: z.number().int().positive().max(60000).optional()});
/** The last touch: impasto light on thick paint and the grain of the paper or canvas. */
const finish = z.object({kind: z.literal('finish'), impasto: z.number().min(0).max(2).optional(), grain: z.number().min(0).max(2).optional(), light: z.number().optional().describe('where the light comes from, in degrees (135 = top left)')});

export const Mark = z.union([line, ink, shape, paint, glaze, brushwork, fromPicture, finish]);
export type Mark = z.infer<typeof Mark>;

export const Pass = z.object({name: z.string().min(1), kind: z.enum(PASS_KINDS).default('other'), why: z.string().optional(), marks: z.array(Mark)});
export type Pass = z.infer<typeof Pass>;

export const MEDIA = ['pencil', 'charcoal', 'ink', 'watercolor', 'gouache', 'oil', 'acrylic', 'pastel', 'mixed'] as const;
export type Medium = typeof MEDIA[number];

export const Painting = z.object({
 version: z.literal(1).default(1),
 title: z.string().min(1),
 medium: z.enum(MEDIA),
 seed: z.number().int().default(1),
 canvas: z.object({width: z.number().int().min(64).max(4096), height: z.number().int().min(64).max(4096), paper: z.enum(PAPERS).default('cold-press'), ground: colour.default('#f4efe4')}),
 palette: z.array(colour).optional(),
 pictures: z.record(z.string(), z.string()).optional().describe('name: image file, relative to the plan'),
 brief: z.string().optional(),
 passes: z.array(Pass).min(1),
});
export type Painting = z.infer<typeof Painting>;

/** Reads and checks a plan; problems are named by pass and mark. */
export function parsePainting(raw: unknown): Painting {
 const r = Painting.safeParse(raw);
 if (r.success) return r.data;
 const lines = r.error.issues.slice(0, 8).map(i => {
  const p = i.path; let where = p.join('.');
  if (p[0] === 'passes' && typeof p[1] === 'number') where = `pass ${p[1] + 1}${p[2] === 'marks' && typeof p[3] === 'number' ? `, mark ${p[3] + 1}` : ''}${p.length > 4 ? ` (${p.slice(4).join('.')})` : ''}`;
  return `${where || 'the plan'}: ${i.message}`;
 });
 throw new Error('The painting plan has problems:\n- ' + lines.join('\n- '));
}

/** The same plan at another size (a quick study at a quarter size, say). */
export function scalePainting(p: Painting, k: number): Painting {
 const pt = (q: number[]) => q.length === 3 ? [q[0]! * k, q[1]! * k, q[2]!] : [q[0]! * k, q[1]! * k];
 const box = (b?: number[]) => b ? b.map(v => v * k) : b;
 const mark = (m: Mark): Mark => {
  const o: Record<string, unknown> = {...m};
  if ('points' in m && m.points) o.points = m.points.map(q => pt(q as number[]));
  if ('ellipse' in m && m.ellipse) o.ellipse = box(m.ellipse);
  if ('rect' in m && m.rect) o.rect = box(m.rect);
  if ('region' in m && m.region) o.region = box(m.region);
  if ('sizes' in m && m.sizes) o.sizes = m.sizes.map(v => Math.max(1, v * k));
  if ('size' in m && typeof m.size === 'number' && m.kind !== 'line') o.size = Math.max(0.5, m.size * k);
  if ('length' in m && typeof m.length === 'number') o.length = m.length * k;
  if ('feather' in m && typeof m.feather === 'number') o.feather = m.feather * k;
  if ('gap' in m && typeof m.gap === 'number') o.gap = m.gap * k;
  if (m.kind === 'shape' && m.hatch?.gap) o.hatch = {...m.hatch, gap: m.hatch.gap * k};
  return o as Mark;
 };
 return {...p, canvas: {...p.canvas, width: Math.max(64, Math.round(p.canvas.width * k)), height: Math.max(64, Math.round(p.canvas.height * k))}, passes: p.passes.map(s => ({...s, marks: s.marks.map(mark)}))};
}
