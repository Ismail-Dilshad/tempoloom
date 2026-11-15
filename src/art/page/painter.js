// Tempoloom's painting engine. It runs in a headless browser page (loaded by src/art/paint.ts) and
// paints a plan (src/art/schema.ts) pass by pass, the way an artist works, on one canvas:
//
//   - Natural media from p5.brush (MIT): pencils, charcoal, pastel, crayon, pens, markers,
//     watercolour fills with bleeding edges and granulation, washes, hatching.
//   - Our own bristle-brush engine for thick and wet paint: oil, acrylic, gouache, palette knife,
//     blender, dry brush, watercolour strokes and glazes. Colour picked up from the canvas is mixed
//     like pigment (Kubelka-Munk, spectral.js, MIT), so blue and yellow make green, not grey.
//   - Ink lines that swell and taper with pressure (perfect-freehand, MIT).
//   - Painting from a picture with Hertzmann's layered-brush method (1998): big brushes first, then
//     smaller ones only where the canvas still differs from the picture. Written for Tempoloom.
//   - Paper and canvas grain, and impasto light on thick paint.
//
// Both engines draw on the same picture: p5.brush works on a WebGL canvas and mixes with what is
// already there, our engine works on a 2D copy; the picture moves between them when the kind of
// mark changes. Every mark is counted, and frames are kept for the timelapse.
import {getStroke} from '/nm/perfect-freehand/dist/esm/index.mjs';

const B = window.brush, S = window.spectral;
const P5_TOOLS = ['pen', 'rotring', '2B', 'HB', '2H', 'cpencil', 'pastel', 'crayon', 'charcoal', 'spray', 'marker'];

// ---------------------------------------------------------------------------------------------
// Small helpers: seeded randomness, noise, colour
// ---------------------------------------------------------------------------------------------
function rng(seed) {
  let s = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f, seed + i * 17); f *= 2; amp *= 0.5; }
  return s / (1 - Math.pow(0.5, oct));
}
function hex(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim());
  if (!m) throw new Error('Not a colour: ' + c);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Pigment mixing, cached: the same pair of colours at the same share comes back at once.
const mixCache = new Map();
function pigmentMix(a, b, t) {
  if (t <= 0.02) return a;
  if (t >= 0.98) return b;
  const q = x => x >> 3;
  const key = `${q(a[0])},${q(a[1])},${q(a[2])}|${q(b[0])},${q(b[1])},${q(b[2])}|${Math.round(t * 16)}`;
  let m = mixCache.get(key);
  if (!m) {
    const c = S.mix([new S.Color([a[0], a[1], a[2]]), 1 - t], [new S.Color([b[0], b[1], b[2]]), t]);
    m = hex(c.toString());
    if (mixCache.size > 200000) mixCache.clear();
    mixCache.set(key, m);
  }
  return m;
}
// A small, natural variation of a colour (painters never lay the exact same note twice).
function vary(c, amount, r) {
  if (!amount) return c;
  const k = (r() - 0.5) * 2 * amount * 40, h = (r() - 0.5) * 2 * amount * 18;
  return [c[0] + k + h, c[1] + k, c[2] + k - h].map(v => Math.max(0, Math.min(255, v)));
}

// ---------------------------------------------------------------------------------------------
// The canvas: a WebGL canvas for p5.brush, a 2D copy for our engine, and the state between them
// ---------------------------------------------------------------------------------------------
let W = 0, H = 0, G, gl, C, X, img = null, side = 'gl', HM = null, TOOTH = null, paperRGB = [255, 255, 255];
let marks = 0, seedBase = 1;
const timelapse = {on: false, every: 1, frames: [], target: 600, width: 720, since: 0};

function toGL() {
  if (side === 'gl') return;
  X.putImageData(img, 0, 0);
  const prev = {
    read: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), draw: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
    tex: gl.getParameter(gl.TEXTURE_BINDING_2D), unit: gl.getParameter(gl.ACTIVE_TEXTURE),
    flip: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), premul: gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),
    scissor: gl.isEnabled(gl.SCISSOR_TEST),
  };
  gl.activeTexture(gl.TEXTURE0);
  const tex = gl.createTexture(), fb = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, C);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.disable(gl.SCISSOR_TEST);
  gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  const err = gl.getError();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prev.read);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, prev.draw);
  gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
  gl.bindTexture(gl.TEXTURE_2D, prev.tex); gl.activeTexture(prev.unit);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, prev.flip); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, prev.premul);
  if (prev.scissor) gl.enable(gl.SCISSOR_TEST);
  if (err) throw new Error('Could not copy the painting to the WebGL canvas (GL error ' + err + ')');
  side = 'gl';
}
function to2D() {
  if (side === '2d') return;
  B.render();
  const px = new Uint8Array(W * H * 4);
  const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prev);
  const d = img.data, row = W * 4;
  for (let y = 0; y < H; y++) d.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  side = '2d';
}
function current() { // the picture as it is now, on a 2D canvas
  if (side === 'gl') { B.render(); return G; }
  X.putImageData(img, 0, 0);
  return C;
}

function frame(force = false) {
  if (!timelapse.on) return;
  timelapse.since++;
  if (!force && timelapse.since < timelapse.every) return;
  timelapse.since = 0;
  const w = Math.min(timelapse.width, W), h = Math.round(H * w / W);
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  t.getContext('2d').drawImage(current(), 0, 0, w, h);
  timelapse.frames.push(t.toDataURL('image/jpeg', 0.86));
  if (timelapse.frames.length > timelapse.target * 2) { // too many: keep every other, keep half as often
    timelapse.frames = timelapse.frames.filter((_, i) => i % 2 === 0);
    timelapse.every *= 2;
  }
}
function mark() { marks++; frame(); }

// ---------------------------------------------------------------------------------------------
// Paper and canvas
// ---------------------------------------------------------------------------------------------
const PAPERS = {
  smooth: {tooth: 0.08, scale: 1.2, weave: 0},
  'hot-press': {tooth: 0.12, scale: 1.6, weave: 0},
  'cold-press': {tooth: 0.35, scale: 3.2, weave: 0},
  rough: {tooth: 0.55, scale: 5, weave: 0},
  toned: {tooth: 0.3, scale: 2.4, weave: 0},
  canvas: {tooth: 0.4, scale: 2, weave: 1},
  panel: {tooth: 0.06, scale: 1, weave: 0},
};
function setup(c) {
  W = c.width; H = c.height; seedBase = c.seed ?? 1;
  G = document.createElement('canvas'); G.width = W; G.height = H;
  gl = G.getContext('webgl2', {premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false}); // no multisampling: the picture is copied in with blitFramebuffer
  if (!gl) throw new Error('This browser has no WebGL2, which the pencils and watercolours need.');
  B.load(G); B.seed(seedBase); B.noiseSeed(seedBase); B.angleMode(B.DEGREES);
  C = document.createElement('canvas'); C.width = W; C.height = H;
  X = C.getContext('2d', {willReadFrequently: true});
  img = X.createImageData(W, H);
  HM = new Float32Array(W * H); TOOTH = new Float32Array(W * H);
  paperRGB = hex(c.ground);
  const p = PAPERS[c.paper] ?? PAPERS['cold-press'], d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let t = fbm(x / p.scale, y / p.scale, seedBase + 101, 3);
    if (p.weave) t = 0.5 * t + 0.25 * (Math.sin(x * 1.9) * Math.sin(y * 1.9) + 1);
    TOOTH[i] = t;
    const k = (t - 0.5) * p.tooth * 18 + (fbm(x / 140, y / 140, seedBase + 7, 3) - 0.5) * 6;
    d[i * 4] = paperRGB[0] + k; d[i * 4 + 1] = paperRGB[1] + k; d[i * 4 + 2] = paperRGB[2] + k; d[i * 4 + 3] = 255;
  }
  side = '2d';
  B.translate(-W / 2, -H / 2);
  timelapse.frames = []; timelapse.since = 0; marks = 0;
}

// ---------------------------------------------------------------------------------------------
// Our brush engine: bristles, paint load, pigment pick-up, impasto, watercolour strokes
// ---------------------------------------------------------------------------------------------
export const BRUSHES = {
  round: {aspect: 1, hard: 0.55, spacing: 0.1, bristles: 0.35, smudge: 0.25, load: 1.6, impasto: 0.5, pressureSize: 0.6},
  flat: {aspect: 0.3, hard: 0.8, spacing: 0.06, bristles: 0.6, smudge: 0.3, load: 1.4, impasto: 0.7, pressureSize: 0.3, follow: true},
  filbert: {aspect: 0.55, hard: 0.6, spacing: 0.08, bristles: 0.45, smudge: 0.3, load: 1.5, impasto: 0.6, pressureSize: 0.45, follow: true},
  fan: {aspect: 0.18, hard: 0.5, spacing: 0.06, bristles: 0.95, smudge: 0.2, load: 1, impasto: 0.2, pressureSize: 0.2, follow: true, sparse: 0.55},
  knife: {aspect: 0.22, hard: 1, spacing: 0.04, bristles: 0.05, smudge: 0.45, load: 2.5, impasto: 1.6, pressureSize: 0.15, follow: true, flatten: true},
  dry: {aspect: 0.6, hard: 0.7, spacing: 0.08, bristles: 0.9, smudge: 0.1, load: 0.45, impasto: 0.2, pressureSize: 0.4, follow: true, dry: true},
  blender: {aspect: 0.8, hard: 0.3, spacing: 0.06, bristles: 0.2, smudge: 1, load: 0, impasto: 0, pressureSize: 0.4, follow: true},
  soft: {aspect: 1, hard: 0.05, spacing: 0.08, bristles: 0, smudge: 0.05, load: 3, impasto: 0, pressureSize: 0.5},
  stipple: {aspect: 1, hard: 0.6, spacing: 1.4, bristles: 0.5, smudge: 0.1, load: 3, impasto: 0.3, pressureSize: 0.5},
  wash: {aspect: 1, hard: 0.35, spacing: 0.12, bristles: 0, smudge: 0, load: 4, impasto: 0, pressureSize: 0.5, wet: true, edge: 1, granulate: 0.5},
  glaze: {aspect: 1, hard: 0.2, spacing: 0.1, bristles: 0, smudge: 0, load: 4, impasto: 0, pressureSize: 0.3, wet: true, edge: 0.15, granulate: 0.1},
};

// Points of a smooth curve through the given points (Catmull-Rom), with pressure.
function curve(points, step) {
  const pts = points.map(p => [p[0], p[1], p[2] ?? 0.8]);
  if (pts.length === 1) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] + (p2[2] - p1[2]) * t]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function sample(x, y) {
  const xi = Math.max(0, Math.min(W - 1, x | 0)), yi = Math.max(0, Math.min(H - 1, y | 0)), i = (yi * W + xi) * 4, d = img.data;
  return [d[i], d[i + 1], d[i + 2]];
}
function sampleAround(x, y, r) {
  let s0 = 0, s1 = 0, s2 = 0;
  const o = [[0, 0], [r * 0.5, 0], [-r * 0.5, 0], [0, r * 0.5], [0, -r * 0.5]];
  for (const [dx, dy] of o) { const c = sample(x + dx, y + dy); s0 += c[0]; s1 += c[1]; s2 += c[2]; }
  return [s0 / 5, s1 / 5, s2 / 5];
}

/** One stroke of our brush engine. `s` is a validated stroke from the plan. */
function wetLayer() { return {mask: new Float32Array(W * H), cr: new Float32Array(W * H), cg: new Float32Array(W * H), cb: new Float32Array(W * H), cw: new Float32Array(W * H), x0: W, y0: H, x1: 0, y1: 0}; }
function paintStroke(s, r, shared = null) {
  to2D();
  const kind = BRUSHES[s.brush] ?? BRUSHES.round;
  const size = Math.max(1, s.size), base = hex(s.color ?? '#000000');
  const opacity = s.opacity ?? 1, smudge = s.smudge ?? kind.smudge;
  let load = s.load ?? kind.load;
  const col0 = vary(base, s.vary ?? 0.15, r);
  const step = Math.max(0.6, size * 0.5 * kind.spacing);
  const pts = curve(s.points, step);
  // Bristles: a fixed pattern across the brush for the whole stroke, so streaks run with it.
  const N = 48, pattern = new Float32Array(N);
  for (let i = 0; i < N; i++) pattern[i] = r();
  for (let k = 0; k < 2; k++) for (let i = 1; i < N - 1; i++) pattern[i] = (pattern[i - 1] + pattern[i] * 2 + pattern[i + 1]) / 4;
  let lo = 1, hi = 0; for (const v of pattern) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < N; i++) pattern[i] = (pattern[i] - lo) / ((hi - lo) || 1);
  const wet = kind.wet, layer = wet ? (shared ?? wetLayer()) : null, mask = layer?.mask;
  let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
  let carried = sampleAround(pts[0][0], pts[0][1], size * 0.4);
  let ang = 0, travelled = 0;
  const d = img.data;
  for (let k = 0; k < pts.length; k++) {
    const [x, y, p] = pts[k];
    if (k > 0) {
      const dx = x - pts[k - 1][0], dy = y - pts[k - 1][1], l = Math.hypot(dx, dy);
      travelled += l;
      if (l > 0.01) { const a = Math.atan2(dy, dx); ang = k === 1 ? a : ang + Math.atan2(Math.sin(a - ang), Math.cos(a - ang)) * 0.35; }
    } else if (pts.length > 1) ang = Math.atan2(pts[1][1] - y, pts[1][0] - x);
    if (kind.sparse && r() < kind.sparse * 0.3) continue;
    const rad = size / 2 * (1 - kind.pressureSize + kind.pressureSize * p);
    // Paint runs out along the stroke: the colour thins and the bristles start to skip.
    const remaining = kind.load ? Math.max(0, 1 - travelled / (size * 6 * Math.max(0.05, load))) : 1;
    // Picks up what is under the brush and mixes it in, like real paint.
    // Under the leading edge of the brush: paint it has not covered yet (behind it is its own paint).
    const under = sampleAround(x + Math.cos(ang) * rad * 0.8, y + Math.sin(ang) * rad * 0.8, rad * 0.5);
    carried = [0, 1, 2].map(i => carried[i] + (under[i] - carried[i]) * 0.35);
    const own = kind.load === 0 ? carried : pigmentMix(col0, carried, Math.min(1, smudge * (0.6 + 0.6 * (1 - remaining))));
    const alpha = opacity * (kind.load === 0 ? 0.35 : (0.45 + 0.55 * p) * (0.25 + 0.75 * Math.sqrt(remaining)));
    const ca = Math.cos(kind.follow ? ang : 0), sa = Math.sin(kind.follow ? ang : 0);
    const ax = rad * kind.aspect, ay = rad;
    const R = Math.ceil(rad) + 1, x0 = Math.max(0, Math.floor(x - R)), x1 = Math.min(W - 1, Math.ceil(x + R)), y0 = Math.max(0, Math.floor(y - R)), y1 = Math.min(H - 1, Math.ceil(y + R));
    bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1); by1 = Math.max(by1, y1);
    const hard = kind.hard, dryness = kind.dry ? 1 - remaining * 0.6 : Math.max(0, 0.45 - remaining) * 1.2; // only a nearly empty brush skips
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const ux = px - x, uy = py - y;
      const along = ux * ca + uy * sa, across = -ux * sa + uy * ca;
      const dd = Math.sqrt((along / ax) ** 2 + (across / ay) ** 2);
      if (dd >= 1) continue;
      let a = dd <= hard ? 1 : 1 - (dd - hard) / (1 - hard);
      a = a * a * (3 - 2 * a);
      const i = py * W + px;
      if (kind.bristles) {
        const b = pattern[Math.min(N - 1, Math.max(0, Math.round((across / ay + 1) / 2 * (N - 1))))];
        a *= 1 - kind.bristles + kind.bristles * b;
        if (dryness > 0.05 && b + TOOTH[i] * 0.5 < dryness) a *= 0.08; // the brush skips over the tooth
      }
      a *= alpha;
      if (a <= 0.004) continue;
      if (wet) { if (a > mask[i]) mask[i] = a; layer.cr[i] += own[0] * a; layer.cg[i] += own[1] * a; layer.cb[i] += own[2] * a; layer.cw[i] += a; continue; }
      const j = i * 4;
      d[j] += (own[0] - d[j]) * a; d[j + 1] += (own[1] - d[j + 1]) * a; d[j + 2] += (own[2] - d[j + 2]) * a;
      if (kind.flatten) HM[i] += (kind.impasto * 0.6 - HM[i]) * a;
      else if (kind.impasto) HM[i] = Math.min(3, HM[i] * (1 - a * 0.3) + kind.impasto * a * (s.thickness ?? 1) * (0.3 + 0.7 * remaining));
      else if (kind.load === 0) HM[i] *= 1 - a * 0.25;
    }
  }
  if (wet) {
    layer.x0 = Math.min(layer.x0, bx0); layer.y0 = Math.min(layer.y0, by0); layer.x1 = Math.max(layer.x1, bx1); layer.y1 = Math.max(layer.y1, by1);
    if (!shared) washFromMask(layer, 1, kind, s, r); // the opacity is already in the mask
  }
  mark();
}

// Watercolour: the stroke's water mask dries with dark edges and pigment settling in the paper.
function washFromMask(layer, opacity, kind, s, r) {
  const {mask, x0, y0, x1, y1} = layer;
  if (x1 < x0) return;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, blur = new Float32Array(w * h), tmp = new Float32Array(w * h);
  const rad = Math.max(2, Math.round(s.size * 0.18));
  for (let y = 0; y < h; y++) { let acc = 0; for (let x = -rad; x < w + rad; x++) { const xi = Math.min(w - 1, Math.max(0, x)); acc += mask[(y + y0) * W + xi + x0]; const xo = x - 2 * rad - 1; if (xo >= -rad) { const xoi = Math.min(w - 1, Math.max(0, xo)); acc -= mask[(y + y0) * W + xoi + x0]; } if (x - rad >= 0 && x - rad < w) tmp[y * w + x - rad] = acc / (2 * rad + 1); } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -rad; y < h + rad; y++) { const yi = Math.min(h - 1, Math.max(0, y)); acc += tmp[yi * w + x]; const yo = y - 2 * rad - 1; if (yo >= -rad) { const yoi = Math.min(h - 1, Math.max(0, yo)); acc -= tmp[yoi * w + x]; } if (y - rad >= 0 && y - rad < h) blur[(y - rad) * w + x] = acc / (2 * rad + 1); } }
  const d = img.data, gran = s.granulate ?? kind.granulate, edge = (s.edge ?? kind.edge);
  const seed = Math.floor(r() * 1e6);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y + y0) * W + x + x0, m = mask[i];
    if (m <= 0.003) continue;
    const rim = Math.max(0, m - blur[y * w + x]) * 1.3 * edge * (0.6 + 0.8 * vnoise((x + x0) / 9, (y + y0) / 9, seed + 5));
    const cwi = layer.cw[i] || 1, col = [layer.cr[i] / cwi, layer.cg[i] / cwi, layer.cb[i] / cwi];
    const settle = 1 + gran * (TOOTH[i] - 0.5) * 0.9 + gran * (vnoise((x + x0) / 3, (y + y0) / 3, seed) - 0.5) * 0.4;
    const bloom = 0.85 + 0.3 * fbm((x + x0) / 60, (y + y0) / 60, seed + 3, 2);
    const k = Math.min(1, opacity * (Math.min(1, m * settle * bloom) + rim));
    const j = i * 4;
    // Transparent paint filters the light that comes back from what is under it.
    d[j] *= 1 - k * (1 - col[0] / 255); d[j + 1] *= 1 - k * (1 - col[1] / 255); d[j + 2] *= 1 - k * (1 - col[2] / 255);
  }
}

// ---------------------------------------------------------------------------------------------
// p5.brush media: lines, shapes with watercolour fills, washes, hatching
// ---------------------------------------------------------------------------------------------
function p5Line(s) {
  toGL();
  B.noFill(); B.noHatch(); B.noWash();
  B.set(s.tool, s.color ?? '#222222', s.size ?? 1);
  const pts = s.points;
  if (pts.length === 2 && pts[0][2] === undefined && pts[1][2] === undefined) B.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
  else { B.beginShape(s.curve ?? 0.5); for (const p of pts) B.vertex(p[0], p[1], p[2] ?? 1); B.endShape(false); }
  B.noStroke();
  mark();
}
function shapePoints(s) {
  if (s.points) return s.points;
  const out = [];
  if (s.ellipse) { const [cx, cy, rx, ry] = s.ellipse, n = Math.max(12, Math.round((rx + ry) / 6)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } }
  else if (s.rect) { const [x, y, w, h] = s.rect; out.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]); }
  return out;
}
function p5Shape(s) {
  toGL();
  const pts = shapePoints(s);
  B.noFill(); B.noHatch(); B.noWash(); B.noStroke();
  if (s.fill) {
    B.fill(s.fill.color, Math.round((s.fill.opacity ?? 0.6) * 255));
    B.fillBleed(s.fill.bleed ?? 0.25, s.fill.direction ?? 'out');
    B.fillTexture(s.fill.texture ?? 0.4, s.fill.edge ?? 0.4, true, s.fill.split ?? 0.15);
  }
  if (s.wash) B.wash(s.wash.color, Math.round((s.wash.opacity ?? 0.5) * 255));
  if (s.hatch) { B.hatch(s.hatch.gap ?? 6, s.hatch.angle ?? 45, {rand: s.hatch.wobble ?? 0.1, continuous: false, gradient: s.hatch.gradient ?? false}); B.hatchStyle(s.hatch.tool ?? 'HB', s.hatch.color ?? '#222222', s.hatch.size ?? 1); }
  if (s.outline) B.set(s.outline.tool ?? 'HB', s.outline.color ?? '#222222', s.outline.size ?? 1);
  if (s.curve) { B.beginShape(s.curve); for (const p of pts) B.vertex(p[0], p[1], p[2] ?? 1); B.endShape(true); }
  else B.polygon(pts);
  B.noFill(); B.noHatch(); B.noWash(); B.noStroke();
  mark();
}

// Ink that swells and tapers with pressure (perfect-freehand), filled on the 2D canvas.
function inkStroke(s) {
  to2D();
  const hasPressure = s.points.some(p => p[2] !== undefined);
  const outline = getStroke(s.points.map(p => [p[0], p[1], p[2] ?? 0.5]), {
    size: s.size, thinning: s.thinning ?? 0.6, smoothing: 0.5, streamline: 0.4, simulatePressure: !hasPressure,
    start: {taper: s.taper ?? s.size * 2, cap: true}, end: {taper: s.taper ?? s.size * 3, cap: true},
  });
  if (outline.length < 3) return;
  X.putImageData(img, 0, 0);
  X.save();
  X.globalAlpha = s.opacity ?? 1;
  X.fillStyle = s.color ?? '#111111';
  X.beginPath(); X.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) { const [a, b] = outline[i], [c, e] = outline[(i + 1) % outline.length]; X.quadraticCurveTo(a, b, (a + c) / 2, (b + e) / 2); }
  X.closePath(); X.fill();
  X.restore();
  img = X.getImageData(0, 0, W, H);
  mark();
}

// A glaze over an area or the whole picture: transparent colour that tints what is under it.
function glaze(s) {
  to2D();
  X.putImageData(img, 0, 0);
  X.save(); X.globalCompositeOperation = s.mode ?? 'multiply'; X.globalAlpha = s.opacity ?? 0.2; X.fillStyle = s.color;
  if (s.feather) X.filter = `blur(${s.feather}px)`;
  const pts = shapePoints(s);
  X.beginPath();
  if (pts.length) { X.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) X.lineTo(p[0], p[1]); X.closePath(); }
  else X.rect(0, 0, W, H);
  X.fill(); X.restore();
  img = X.getImageData(0, 0, W, H);
  mark();
}

// ---------------------------------------------------------------------------------------------
// Brushwork: many strokes over an area (grass, foliage, sky, water, fur), from a few numbers
// ---------------------------------------------------------------------------------------------
function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function brushwork(s, r) {
  const area = shapePoints(s);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of area) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const areaPx = (x1 - x0) * (y1 - y0), n = Math.min(s.max ?? 4000, Math.round(areaPx / (s.size * s.length) * (s.density ?? 1)));
  const colors = s.colors.map(c => Array.isArray(c) ? c : [c, 1]), total = colors.reduce((a, c) => a + c[1], 0);
  const pick = () => { let t = r() * total; for (const c of colors) { t -= c[1]; if (t <= 0) return c[0]; } return colors[0][0]; };
  const fieldSeed = Math.floor(r() * 1e6);
  const dirAt = (x, y) => {
    if (typeof s.direction === 'number') return s.direction * Math.PI / 180 + (r() - 0.5) * (s.jitter ?? 0.3);
    if (s.direction === 'up') return -Math.PI / 2 + (r() - 0.5) * (s.jitter ?? 0.5);
    if (s.direction === 'around') { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; return Math.atan2(y - cy, x - cx) + Math.PI / 2; }
    if (s.direction === 'out') { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; return Math.atan2(y - cy, x - cx); }
    return fbm(x / 220, y / 220, fieldSeed, 3) * Math.PI * 4; // 'flow'
  };
  const marksBefore = marks, wetKind = BRUSHES[s.brush]?.wet, layer = wetKind && s.merge !== false ? (to2D(), wetLayer()) : null;
  for (let k = 0; k < n; k++) {
    let x = 0, y = 0, tries = 0;
    do { x = x0 + r() * (x1 - x0); y = y0 + r() * (y1 - y0); } while (!inside(area, x, y) && ++tries < 30);
    if (tries >= 30) continue;
    const pts = [[x, y, 0.6 + r() * 0.4]], len = s.length * (0.6 + r() * 0.8), seg = 4;
    for (let i = 1; i <= seg; i++) {
      const [px, py] = pts[pts.length - 1], a = dirAt(px, py), nx = px + Math.cos(a) * len / seg, ny = py + Math.sin(a) * len / seg;
      if (!inside(area, nx, ny) && !s.spill) break;
      pts.push([nx, ny, Math.max(0.15, 1 - i / seg * (s.taper ?? 0.5))]);
    }
    const size = s.size * (0.7 + r() * 0.6), color = pick();
    if (s.brush && P5_TOOLS.includes(s.brush)) p5Line({tool: s.brush, color, size, points: pts.length > 1 ? pts : [pts[0], [x + 1, y + 1]]});
    else if (s.brush === 'ink') { if (pts.length > 1) inkStroke({color, size, points: pts, opacity: s.opacity}); }
    else paintStroke({brush: s.brush ?? 'round', color, size, points: pts, opacity: s.opacity, vary: s.vary ?? 0.25, smudge: s.smudge}, r, layer);
  }
  // Wet strokes laid next to each other run together and dry as one wash.
  if (layer) washFromMask(layer, 1, BRUSHES[s.brush], {size: s.size * 2, edge: s.edge, granulate: s.granulate}, r);
  return marks - marksBefore;
}

// ---------------------------------------------------------------------------------------------
// Painting from a picture (Hertzmann 1998, layered curved brush strokes), and drawing from one
// ---------------------------------------------------------------------------------------------
const pictures = new Map();
async function loadPicture(name, url) {
  const im = new Image(); im.src = url; await im.decode(); pictures.set(name, im);
}
function fitted(name, region, blurPx = 0) {
  const im = pictures.get(name);
  if (!im) throw new Error('No picture called ' + name);
  const [rx, ry, rw, rh] = region, t = document.createElement('canvas'); t.width = W; t.height = H;
  const c = t.getContext('2d', {willReadFrequently: true}), k = Math.max(rw / im.width, rh / im.height);
  const w = im.width * k, h = im.height * k;
  c.save(); c.beginPath(); c.rect(rx, ry, rw, rh); c.clip();
  c.drawImage(im, rx + (rw - w) / 2, ry + (rh - h) / 2, w, h);
  if (blurPx > 0.5) { c.filter = `blur(${blurPx}px)`; c.drawImage(t, 0, 0); } // over the sharp copy, so the borders do not fade to black
  c.restore();
  return c.getImageData(0, 0, W, H).data;
}
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const STYLES = {
  oil: {brush: 'filbert', sizes: [56, 28, 14, 7], threshold: 26, minLen: 2, maxLen: 10, curv: 0.7, vary: 0.12, smudge: 0.15},
  impressionist: {brush: 'round', sizes: [40, 20, 10], threshold: 30, minLen: 1, maxLen: 4, curv: 1, vary: 0.35, smudge: 0.15},
  expressionist: {brush: 'flat', sizes: [64, 32, 16, 8], threshold: 40, minLen: 6, maxLen: 16, curv: 0.4, vary: 0.25, smudge: 0.35},
  watercolor: {brush: 'wash', sizes: [72, 36, 18], threshold: 30, minLen: 3, maxLen: 12, curv: 0.8, vary: 0.04, smudge: 0, light: 0.93, opacity: 0.9},
  pointillist: {brush: 'stipple', sizes: [14, 8, 5], threshold: 20, minLen: 0, maxLen: 0, curv: 1, vary: 0.4, smudge: 0, dots: true},
  gouache: {brush: 'flat', sizes: [48, 24, 12, 6], threshold: 22, minLen: 2, maxLen: 8, curv: 0.6, vary: 0.06, smudge: 0.1},
};

function fromPicture(s, r) {
  const style = s.style;
  if (style === 'pencil' || style === 'ink' || style === 'charcoal') return drawFromPicture(s, r);
  const st = STYLES[style] ?? STYLES.oil, region = s.region ?? [0, 0, W, H];
  const scale = Math.max(W, H) / 1080, sizes = (s.sizes ?? st.sizes.map(v => v * scale)).filter(v => v >= 2);
  const threshold = (s.threshold ?? st.threshold) / (s.detail ?? 1);
  const before = marks, flowSeed = Math.floor(r() * 1e6), wetStyle = BRUSHES[s.brush ?? st.brush]?.wet;
  for (const R of sizes) {
    to2D();
    const ref = fitted(s.picture, region, R * (s.blur ?? 0.5));
    const now = new Uint8ClampedArray(img.data);
    const diff = (i) => Math.hypot(now[i] - ref[i], now[i + 1] - ref[i + 1], now[i + 2] - ref[i + 2]);
    const L = (x, y) => { const xi = Math.max(0, Math.min(W - 1, x | 0)), yi = Math.max(0, Math.min(H - 1, y | 0)), i = (yi * W + xi) * 4; return lum(ref[i], ref[i + 1], ref[i + 2]); };
    const grid = Math.max(2, Math.round(R * (st.dots ? 0.9 : 1))), strokes = [];
    const [rx, ry, rw, rh] = region;
    for (let gy = ry; gy < ry + rh; gy += grid) for (let gx = rx; gx < rx + rw; gx += grid) {
      let sum = 0, cnt = 0, best = -1, bx = gx, by = gy;
      for (let y = gy; y < Math.min(ry + rh, gy + grid); y += 2) for (let x = gx; x < Math.min(rx + rw, gx + grid); x += 2) {
        const e = diff((y * W + x) * 4); sum += e; cnt++; if (e > best) { best = e; bx = x; by = y; }
      }
      if (!cnt || sum / cnt < threshold) continue;
      const i0 = (by * W + bx) * 4;
      let col = [ref[i0], ref[i0 + 1], ref[i0 + 2]];
      if (st.light) {
        if (lum(...col) > st.light) continue; // watercolour keeps its lightest lights as paper
        // Transparent paint can only darken: the wash is the filter that takes what is there to the picture.
        const c0 = [now[i0], now[i0 + 1], now[i0 + 2]];
        if (lum(...c0) <= lum(...col) + 0.02) continue;
        col = col.map((v, q) => Math.min(255, 255 * v / Math.max(1, c0[q])));
      }
      const pts = [[bx + (r() - 0.5) * grid * 0.4, by + (r() - 0.5) * grid * 0.4, 0.85]];
      let x = pts[0][0], y = pts[0][1], ldx = 0, ldy = 0;
      for (let i = 1; i <= st.maxLen; i++) {
        const xi = Math.max(0, Math.min(W - 1, x | 0)), yi = Math.max(0, Math.min(H - 1, y | 0)), j = (yi * W + xi) * 4;
        if (i > st.minLen && Math.hypot(ref[j] - now[j], ref[j + 1] - now[j + 1], ref[j + 2] - now[j + 2]) < Math.hypot(ref[j] - col[0], ref[j + 1] - col[1], ref[j + 2] - col[2])) break;
        const gx2 = L(x + R / 2, y) - L(x - R / 2, y), gy2 = L(x, y + R / 2) - L(x, y - R / 2);
        let dx, dy;
        if (Math.hypot(gx2, gy2) < 0.004) {
          // A flat area has no edge to follow: keep going, or lay the stroke the way the brushwork flows.
          if (i > 1) { dx = ldx; dy = ldy; } else { const a = fbm(x / 300, y / 300, flowSeed, 2) * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); }
        } else { dx = -gy2; dy = gx2; const m = Math.hypot(dx, dy); dx /= m; dy /= m; }
        if (ldx * dx + ldy * dy < 0) { dx = -dx; dy = -dy; }
        if (i > 1) { dx = st.curv * dx + (1 - st.curv) * ldx; dy = st.curv * dy + (1 - st.curv) * ldy; const m2 = Math.hypot(dx, dy) || 1; dx /= m2; dy /= m2; }
        x += R * dx; y += R * dy; ldx = dx; ldy = dy;
        if (x < rx || y < ry || x > rx + rw || y > ry + rh) break;
        pts.push([x, y, 0.85 - i / st.maxLen * 0.3]);
      }
      strokes.push({pts, col, R});
    }
    shuffle(strokes, r);
    // Watercolour: the strokes of one brush size are one wet layer, so each place is glazed once.
    const layer = wetStyle ? wetLayer() : null;
    for (const k of strokes.slice(0, s.max ?? 30000)) {
      const pts = k.pts.length > 1 ? k.pts : [k.pts[0], [k.pts[0][0] + 0.5, k.pts[0][1] + 0.3, 0.8]];
      paintStroke({brush: s.brush ?? st.brush, color: toHex(k.col), size: k.R * (st.dots ? 1 : 1.5), points: pts, opacity: s.opacity ?? st.opacity ?? 1, vary: st.vary, smudge: st.smudge, load: 2, granulate: 0.25, edge: 0.6}, r, layer);
    }
    if (layer) washFromMask(layer, 1, BRUSHES[s.brush ?? st.brush], {size: R * 1.5, edge: 0.6, granulate: 0.25}, r);
  }
  return marks - before;
}

// Pencil, charcoal or ink drawing from a picture: contour lines along the edges, then hatching
// where the picture is darker, in layers of crossing directions.
function drawFromPicture(s, r) {
  const region = s.region ?? [0, 0, W, H], [rx, ry, rw, rh] = region, scale = Math.max(W, H) / 1080;
  const tool = s.style === 'ink' ? (s.tool ?? 'pen') : s.style === 'charcoal' ? 'charcoal' : (s.tool ?? 'HB');
  const color = s.color ?? (s.style === 'ink' ? '#16130f' : '#1f1c19');
  const ref = fitted(s.picture, region, 2.5 * scale);
  const L = (x, y) => { const xi = Math.max(0, Math.min(W - 1, x | 0)), yi = Math.max(0, Math.min(H - 1, y | 0)), i = (yi * W + xi) * 4; return lum(ref[i], ref[i + 1], ref[i + 2]); };
  const before = marks;
  // Contours: start where the edge is strong, follow it while it lasts.
  const g = Math.round(14 * scale / (s.detail ?? 1)), used = new Uint8Array(Math.ceil(W / g) * Math.ceil(H / g));
  const seeds = [];
  for (let y = ry + g / 2; y < ry + rh; y += g) for (let x = rx + g / 2; x < rx + rw; x += g) {
    const m = Math.hypot(L(x + 2, y) - L(x - 2, y), L(x, y + 2) - L(x, y - 2));
    if (m > 0.06) seeds.push([x, y, m]);
  }
  seeds.sort((a, b) => b[2] - a[2]);
  for (const [sx, sy] of seeds.slice(0, s.max ?? 1400)) {
    const cell = Math.floor(sy / g) * Math.ceil(W / g) + Math.floor(sx / g);
    if (used[cell]) continue;
    const pts = [[sx, sy, 0.7]]; let x = sx, y = sy, ldx = 0, ldy = 0;
    for (let i = 0; i < 40; i++) {
      const gx = L(x + 2, y) - L(x - 2, y), gy = L(x, y + 2) - L(x, y - 2), m = Math.hypot(gx, gy);
      if (m < 0.05) break;
      let dx = -gy / m, dy = gx / m; if (ldx * dx + ldy * dy < 0) { dx = -dx; dy = -dy; }
      x += dx * 4 * scale; y += dy * 4 * scale; ldx = dx; ldy = dy;
      const c2 = Math.floor(y / g) * Math.ceil(W / g) + Math.floor(x / g);
      if (x < rx || y < ry || x > rx + rw || y > ry + rh) break;
      if (c2 >= 0 && c2 < used.length) used[c2] = 1;
      pts.push([x, y, Math.min(1, 0.4 + m * 4)]);
    }
    if (pts.length > 3) p5Line({tool: s.style === 'pencil' ? (s.tool ?? '2B') : tool, color, size: (s.size ?? 1) * (tool === 'charcoal' ? 1.8 : 1.3), points: pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1), curve: 0.4});
  }
  // Tone: hatching in layers, each darker level adds another direction.
  const soft = s.style === 'pencil' ? ['2H', 'HB', 'HB', '2B', '2B'] : null;
  const levels = [[0.8, 35], [0.6, -40], [0.42, 80], [0.26, 10], [0.14, 55]], gap = (s.gap ?? 6) * scale;
  levels.forEach(([t, deg], li) => {
    const lead = soft ? (s.tool ?? soft[li]) : tool, weight = (s.size ?? 1.5) * (0.8 + li * 0.25) * scale;
    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), diag = Math.hypot(rw, rh), cx = rx + rw / 2, cy = ry + rh / 2;
    for (let o = -diag / 2; o < diag / 2; o += gap * (1 + li * 0.15) * (0.8 + r() * 0.4)) {
      let run = null;
      for (let u = -diag / 2; u <= diag / 2; u += 3 * scale) {
        const x = cx + u * ca - o * sa, y = cy + u * sa + o * ca;
        const ok = x >= rx && y >= ry && x < rx + rw && y < ry + rh && L(x, y) < t + (r() - 0.5) * 0.04;
        if (ok) { if (!run) run = [[x, y]]; else run[1] = [x, y]; }
        else if (run) { if (run[1] && Math.hypot(run[1][0] - run[0][0], run[1][1] - run[0][1]) > 6 * scale) p5Line({tool: lead, color, size: weight, points: run}); run = null; }
      }
      if (run && run[1]) p5Line({tool: lead, color, size: weight, points: run});
    }
  });
  return marks - before;
}

// ---------------------------------------------------------------------------------------------
// Finish: impasto light on thick paint, paper grain
// ---------------------------------------------------------------------------------------------
function finish(s) {
  to2D();
  const d = img.data, k = s.impasto ?? 0.6, grain = s.grain ?? 0.25, a = ((s.light ?? 135) * Math.PI) / 180;
  const lx = Math.cos(a), ly = Math.sin(a);
  // The paint's surface, softened a little (paint settles), lit from one side.
  const hm = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    hm[i] = (HM[i] * 4 + HM[i - 1] + HM[i + 1] + HM[i - W] + HM[i + W]) / 8 + grain * 0.25 * TOOTH[i];
  }
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x;
    const g = (hm[i + 1] - hm[i - 1]) * lx + (hm[i + W] - hm[i - W]) * ly;
    const shade = 1 + Math.max(-0.22, Math.min(0.22, -g * 0.18 * k));
    const j = i * 4;
    d[j] *= shade; d[j + 1] *= shade; d[j + 2] *= shade;
  }
  mark();
}

// ---------------------------------------------------------------------------------------------
// Running a plan
// ---------------------------------------------------------------------------------------------
function op(o, r) {
  switch (o.kind) {
    case 'line': return P5_TOOLS.includes(o.tool) ? p5Line(o) : inkStroke(o);
    case 'ink': return inkStroke(o);
    case 'shape': return p5Shape(o);
    case 'paint': return paintStroke(o, r);
    case 'glaze': return glaze(o);
    case 'brushwork': return brushwork(o, r);
    case 'from-picture': return fromPicture(o, r);
    case 'finish': return finish(o);
    default: throw new Error('Unknown kind of mark: ' + o.kind);
  }
}

function png() {
  return current().toDataURL('image/png');
}

/** Sets up the canvas and loads the pictures the plan paints from. */
window.paintStart = async (plan, opts = {}) => {
  for (const [name, url] of Object.entries(opts.pictures ?? {})) await loadPicture(name, url);
  timelapse.on = !!opts.timelapse; timelapse.target = opts.frames ?? 600; timelapse.every = 1; timelapse.width = opts.frameWidth ?? 720;
  setup({...plan.canvas, seed: plan.seed});
  frame(true);
  return {width: W, height: H};
};
/** Paints one pass and returns its picture and the marks it made. */
window.paintPass = (plan, index) => {
  const pass = plan.passes[index], r = rng((plan.seed ?? 1) * 7919 + index * 104729), t0 = performance.now(), m0 = marks;
  for (const o of pass.marks) op(o, r);
  frame(true);
  return {png: png(), marks: marks - m0, ms: Math.round(performance.now() - t0)};
};
window.paintFrames = () => { const f = timelapse.frames; timelapse.frames = []; return f; };
/** The picture in values only (a value study), as a PNG. */
window.valuesOf = async (url) => {
  const im = new Image(); im.src = url; await im.decode();
  const t = document.createElement('canvas'); t.width = im.width; t.height = im.height;
  const c = t.getContext('2d', {willReadFrequently: true}); c.drawImage(im, 0, 0);
  const d = c.getImageData(0, 0, t.width, t.height);
  for (let i = 0; i < d.data.length; i += 4) { const v = lum(d.data[i], d.data[i + 1], d.data[i + 2]) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; }
  c.putImageData(d, 0, 0);
  return t.toDataURL('image/png');
};

// ---------------------------------------------------------------------------------------------
// Looking at a painting: values, colour, edges, where the eye goes, and likeness to a reference
// ---------------------------------------------------------------------------------------------
function lab(r, g, b) {
  const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = f(r), G2 = f(g), Bb = f(b);
  const x = (0.4124 * R + 0.3576 * G2 + 0.1805 * Bb) / 0.95047, y = 0.2126 * R + 0.7152 * G2 + 0.0722 * Bb, z = (0.0193 * R + 0.1192 * G2 + 0.9505 * Bb) / 1.08883;
  const t = v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  return [116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))];
}
async function pixelsOf(url, w, h) {
  const im = new Image(); im.src = url; await im.decode();
  const width = w ?? Math.round(256 * Math.min(1, im.width / im.height)), height = h ?? Math.round(width * im.height / im.width);
  const t = document.createElement('canvas'); t.width = width; t.height = height;
  const c = t.getContext('2d', {willReadFrequently: true}); c.drawImage(im, 0, 0, width, height);
  return {w: width, h: height, d: c.getImageData(0, 0, width, height).data, ratio: im.width / im.height};
}
window.lookAt = async (url, o = {}) => {
  const {w, h, d, ratio} = await pixelsOf(url);
  const n = w * h, Ls = new Float32Array(n), C2 = new Float32Array(n), Hs = new Float32Array(n);
  for (let i = 0; i < n; i++) { const [l, a, b] = lab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); Ls[i] = l; C2[i] = Math.hypot(a, b); Hs[i] = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; }
  const sorted = Float32Array.from(Ls).sort(), pct = p => sorted[Math.min(n - 1, Math.floor(p * n))];
  let dark = 0, mid = 0, light = 0, mud = 0, paper = 0, chroma = 0;
  const paperLab = o.paper ? lab(...hex(o.paper)) : null;
  const hueBins = new Array(12).fill(0);
  for (let i = 0; i < n; i++) {
    const l = Ls[i];
    if (l < 35) dark++; else if (l < 70) mid++; else light++;
    if (C2[i] < 10 && l > 28 && l < 68) mud++;
    chroma += C2[i];
    if (C2[i] > 15) hueBins[Math.floor(Hs[i] / 30) % 12]++;
    if (paperLab) { const [l2, a2, b2] = lab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); if (Math.hypot(l2 - paperLab[0], a2 - paperLab[1], b2 - paperLab[2]) < 5) paper++; }
  }
  const colourful = hueBins.reduce((a, b) => a + b, 0);
  const hues = hueBins.filter(v => colourful && v / colourful > 0.08).length;
  // Where the eye goes: the block with the most local contrast and edges.
  const bs = 16, gw = Math.floor(w / bs), gh = Math.floor(h / bs);
  let best = -1, fx = 0.5, fy = 0.5, hard = 0, soft = 0;
  const blocks = [];
  for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
    let s = 0, s2 = 0, e = 0;
    for (let y = by * bs; y < (by + 1) * bs; y++) for (let x = bx * bs; x < (bx + 1) * bs; x++) {
      const l = Ls[y * w + x]; s += l; s2 += l * l;
      if (x > 0 && y > 0) { const g = Math.hypot(l - Ls[y * w + x - 1], l - Ls[(y - 1) * w + x]); e += g; if (g > 15) hard++; else if (g > 3) soft++; }
    }
    const m = s / (bs * bs), sd = Math.sqrt(Math.max(0, s2 / (bs * bs) - m * m)), score = sd + e / (bs * bs) * 2;
    blocks.push(score);
    if (score > best) { best = score; fx = (bx + 0.5) / gw; fy = (by + 0.5) / gh; }
  }
  const mean = blocks.reduce((a, b) => a + b, 0) / (blocks.length || 1);
  const out = {
    width: w, height: h, ratio,
    values: {darkest: Math.round(pct(0.02)), lightest: Math.round(pct(0.98)), dark: dark / n, mid: mid / n, light: light / n},
    colour: {chroma: chroma / n, hues, mud: mud / n},
    paper: paperLab ? paper / n : null,
    edges: {hard: hard / ((hard + soft) || 1), amount: (hard + soft) / n},
    focus: {x: fx, y: fy, strength: mean ? best / mean : 1},
  };
  if (o.reference) {
    const S2 = 32, a = await pixelsOf(url, S2, S2), b = await pixelsOf(o.reference, S2, S2);
    const la = [], lb = [];
    for (let i = 0; i < S2 * S2; i++) { la.push(lab(a.d[i * 4], a.d[i * 4 + 1], a.d[i * 4 + 2])); lb.push(lab(b.d[i * 4], b.d[i * 4 + 1], b.d[i * 4 + 2])); }
    const corr = (x, y) => { const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sx && sy ? sxy / Math.sqrt(sx * sy) : 0; };
    out.likeness = {values: corr(la.map(v => v[0]), lb.map(v => v[0])), colour: la.reduce((s, v, i) => s + Math.hypot(v[0] - lb[i][0], v[1] - lb[i][1], v[2] - lb[i][2]), 0) / la.length};
  }
  return out;
};
window.painterReady = true;
