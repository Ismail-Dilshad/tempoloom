// Readability on a phone: every piece of text in a video, measured the way it will be seen - on a
// phone held upright, where a 1080-pixel-wide video is about 390 points wide - for its size there,
// and for how long it stays on screen against how long its words take to read.
import type {Page} from 'playwright';

export type TextSeen = {text: string; scene: string; firstSeen: number; seconds: number; words: number; need: number; phonePt: number};
export type ReadIssue = {kind: 'phone-size' | 'too-quick'; detail: string; severity: 'hard' | 'soft'};

/** A phone's width in points (an upright phone shows the whole width of the video). */
export const PHONE_WIDTH = 390;
/** Reading time: about 3.3 words a second, plus half a second to notice it; never under a second. */
export const needSeconds = (words: number) => Math.max(1, Math.round((0.3 * words + 0.5) * 10) / 10);
const NAME_SHIM = 'window.__name=window.__name||(function(f){return f;})';

/** The text on screen at this moment: each sentence (kinetic words grouped) or label, its font size
 *  as a share of the frame's width. */
export async function textOnScreen(page: Page): Promise<{text: string; px: number}[]> {
 await page.evaluate(NAME_SHIM);
 return page.evaluate(() => {
  const stage = document.getElementById('stage')!, W = innerWidth, H = innerHeight;
  const seen = (el: Element) => {let o = 1; for (let e: Element | null = el; e && e !== stage; e = e.parentElement) {const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= Number(cs.opacity);} return o;};
  const leaves = [...stage.querySelectorAll<HTMLElement>('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim().length > 0));
  const out = new Map<string, number>();
  for (const e of leaves) {
   const r = e.getBoundingClientRect();
   if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H || seen(e) < 0.6) continue;
   const group = e.closest<HTMLElement>('[data-kinetic]') ?? e;
   const text = (group.textContent ?? '').replace(/\s+/g, ' ').trim();
   if (!text || /^[•·|/“”"«»‘’\\-]+$/.test(text)) continue;
   const cs = getComputedStyle(e), scale = e.offsetWidth ? r.width / e.offsetWidth : 1, px = parseFloat(cs.fontSize) * scale;
   out.set(text, Math.max(out.get(text) ?? 0, px / W));
  }
  return [...out].map(([text, px]) => ({text: text.slice(0, 120), px}));
 });
}

/** Watches each scene from start to end (every `step` seconds) and returns every text with how
 *  long it was on screen and how big it is on a phone. `scale` is the page's scale of the video. */
export async function watchText(page: Page, scenes: {id: string; start: number; duration: number}[], o: {step?: number} = {}): Promise<TextSeen[]> {
 const step = o.step ?? 0.2, out: TextSeen[] = [];
 const shapeOf = (t: string) => t.replace(/[\d\u0660-\u0669\u06F0-\u06F9]+(?:[.,][\d\u0660-\u0669\u06F0-\u06F9]+)?/g, '#');
 for (const s of scenes) {
  let prev: TextSeen[] = [];
  for (let t = s.start + step / 2; t < s.start + s.duration; t += step) {
   await page.evaluate(x => window.render(x), t);
   const now = await textOnScreen(page), here: TextSeen[] = [];
   for (const {text, px} of now) {
    const pt = Math.round(px * PHONE_WIDTH * 10) / 10;
    // The same text as a moment ago; or what it became: a number counting (the same shape) or text
    // being typed (it grew from it), when the old one is no longer there.
    let cur = prev.find(v => v.text === text);
    if (!cur) cur = prev.find(v => !now.some(n => n.text === v.text) && !here.includes(v) && (shapeOf(v.text) === shapeOf(text) || text.startsWith(v.text) || v.text.startsWith(text)));
    if (cur) {
     if (!here.includes(cur)) cur.seconds = Math.round((cur.seconds + step) * 100) / 100;
     cur.phonePt = Math.max(cur.phonePt, pt);
     if (text.length > cur.text.length || shapeOf(text) === shapeOf(cur.text)) {cur.text = text; cur.words = text.split(/\s+/).filter(Boolean).length; cur.need = needSeconds(cur.words);}
    } else {
     // Back after being away (a blink, a loop): the same text in this scene counts on.
     cur = out.find(v => v.scene === s.id && v.text === text);
     if (cur) cur.seconds = Math.round((cur.seconds + step) * 100) / 100;
     else {const words = text.split(/\s+/).filter(Boolean).length; cur = {text, scene: s.id, firstSeen: Math.round((t - s.start) * 100) / 100, seconds: step, words, need: needSeconds(words), phonePt: pt}; out.push(cur);}
    }
    here.push(cur);
   }
   prev = here;
  }
 }
 return out;
}

/** What is hard to read: too small on a phone (under 12 pt; under 9 pt cannot be read), or gone
 *  before its words can be read (under half the time they need is a hard problem). */
export function readIssues(t: TextSeen): ReadIssue[] {
 const out: ReadIssue[] = [];
 if (t.phonePt < 12) out.push({kind: 'phone-size', detail: `"${t.text.slice(0, 40)}" is ${t.phonePt} pt on a phone (12 pt or more reads comfortably)`, severity: t.phonePt < 9 ? 'hard' : 'soft'});
 if (t.seconds + 0.05 < t.need) out.push({kind: 'too-quick', detail: `"${t.text.slice(0, 40)}" is on screen ${t.seconds.toFixed(1)} s; its ${t.words} word${t.words > 1 ? 's need' : ' needs'} ${t.need} s`, severity: t.seconds < t.need * 0.5 ? 'hard' : 'soft'});
 return out;
}
