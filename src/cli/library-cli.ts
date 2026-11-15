// tempoloom library: your logos, music, sounds, pictures and clips, described, searchable and reused.
import path from 'node:path';
import {LIB_KINDS, type LibKind} from '../engine/my-library.js';

const [command, ...rest] = process.argv.slice(2);
const VALUED = ['--kind', '--tags', '--about', '--job', '--shot', '--limit'];
const flag = (k: string) => {const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined;};
const args = () => rest.filter((x, i) => !x.startsWith('--') && !VALUED.includes(rest[i - 1] ?? ''));
const usage = `Usage: tempoloom library add FILE|FOLDER... [--kind logo|image|music|sound|clip] [--about "WHAT IT SHOWS"] [--tags a,b]
       tempoloom library list [--kind KIND] [--used]
       tempoloom library find WORDS [--kind KIND]           by what it shows or sounds like, its colours, shape, tempo
       tempoloom library describe ID "WHAT IT SHOWS" [--shot N] [--agent] [--tags a,b]
       tempoloom library show ID
       tempoloom library use ID --job JOB                     record that a job used it (and get its file)
       tempoloom library remove ID                            the library's copy goes; your own file stays

Logos, pictures, music and sounds are copied into the library; clips stay where they are and join the
b-roll library (split into shots, each described). Kinds: ${LIB_KINDS.join(', ')}.`;
const kind = (v?: string) => {if (v === undefined) return undefined; if (!(LIB_KINDS as readonly string[]).includes(v)) throw new Error('--kind is ' + LIB_KINDS.join(', ')); return v as LibKind;};

async function main() {
 if (!command || ['help', '--help', '-h'].includes(command)) {console.log(usage); process.exit(command ? 0 : 1);}
 const L = await import('../engine/my-library.js'), a = args();
 const view = (e: ReturnType<typeof L.libraryEntries>[number]) => ({id: e.id, kind: e.kind, name: e.name, shows: e.description, ...(e.tags.length ? {tags: e.tags} : {}),
  ...(e.width ? {size: `${e.width}x${e.height}`} : {}), ...(e.seconds ? {seconds: e.seconds} : {}), ...(e.bpm ? {bpm: e.bpm} : {}), ...(e.energy ? {energy: e.energy} : {}),
  ...(e.transparent ? {seeThrough: `${Math.round(e.transparent * 100)}%`} : {}), ...(e.colours ? {colours: e.colours} : {}), usedIn: e.uses.map(u => u.job), file: e.file, ...(e.sheet ? {sheet: e.sheet} : {})});
 switch (command) {
  case 'add': {if (!a.length) throw new Error(usage);
   return L.addToLibrary(a, {...(kind(flag('--kind')) ? {kind: kind(flag('--kind'))!} : {}), ...(flag('--about') ? {about: flag('--about')!} : {}), ...(flag('--tags') ? {tags: flag('--tags')!.split(',').map(t => t.trim()).filter(Boolean)} : {}), onStep: s => console.error(s)});}
  case 'list': {const k = kind(flag('--kind')); return L.libraryEntries().filter(e => (!k || e.kind === k) && (!rest.includes('--used') || e.uses.length)).map(view);}
  case 'find': {if (!a.length) throw new Error(usage);
   const {find} = await import('../engine/find.js'), k = kind(flag('--kind'));
   const r = await find(a.join(' '), {kinds: k === 'clip' ? ['clip'] : k ? ['asset'] : ['asset', 'clip'], limit: Number(flag('--limit') ?? 12)});
   const all = L.libraryEntries(), byId = new Map(all.map(e => [e.id, e]));
   return {query: r.query, found: r.hits.filter(h => h.kind === 'clip' || !k || byId.get(h.id)?.kind === k).map(h => {const e = byId.get(h.id); return {id: e?.id ?? h.id, kind: e?.kind ?? 'clip', title: h.title, why: h.why, ...(h.snippet ? {shows: h.snippet} : {}), file: h.file ?? e?.file, ...(h.at !== undefined ? {at: h.at} : {})};})};}
  case 'describe': {if (a.length < 2) throw new Error(usage);
   return L.describeEntry(a[0]!, a.slice(1).join(' '), {by: rest.includes('--agent') ? 'agent' : 'you', ...(flag('--shot') ? {shot: Number(flag('--shot'))} : {}), ...(flag('--tags') ? {tags: flag('--tags')!.split(',').map(t => t.trim()).filter(Boolean)} : {})});}
  case 'show': {if (!a[0]) throw new Error(usage); return view(L.libraryEntry(a[0]));}
  case 'use': {if (!a[0] || !flag('--job')) throw new Error('Usage: tempoloom library use ID --job JOB'); return L.useEntry(a[0], flag('--job')!);}
  case 'remove': {if (!a[0]) throw new Error(usage); return L.removeEntry(a[0]);}
  default: throw new Error(usage);
 }
}
main().then(r => console.log(JSON.stringify(r, null, 2)), e => {console.error((e as Error).message); process.exit(1);});
