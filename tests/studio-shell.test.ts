// The redesigned Studio page: its places and old addresses, one registry for its tools, your library and
// scenes over the server, design tokens that read well in both themes, and a blue brand everywhere.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-shell-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),VIDEO_OUTPUT:path.join(tmp,'out')},before={...process.env};
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

const UI='src/teach/ui';
/** The tokens of one theme, read from tokens.css. */
function tokens(theme:'dark'|'light'){
 const css=fs.readFileSync(path.join(UI,'tokens.css'),'utf8'),block=(sel:string)=>css.slice(css.indexOf(sel)+sel.length,css.indexOf('}',css.indexOf(sel)));
 const read=(b:string)=>Object.fromEntries([...b.matchAll(/--([a-z0-9-]+):(#[0-9A-Fa-f]{6})/g)].map(m=>[m[1]!,m[2]!]));
 return {...read(block(':root{')),...(theme==='light'?read(block(':root[data-theme=light]{')):{})} as Record<string,string>;
}
const lum=(h:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);return .2126*r!+.7152*g!+.0722*b!;};
const contrast=(a:string,b:string)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x!+.05)/(y!+.05);};

describe('design tokens',()=>{
 for(const theme of ['dark','light'] as const)it(`read well in the ${theme} theme`,()=>{
  const t=tokens(theme);
  for(const bg of ['bg','surface-1','surface-2','surface-3']){
   for(const fg of ['text','text-2','text-3','accent','bad'])expect(contrast(t[fg]!,t[bg]!),`${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
   for(const fg of ['good','warn'])expect(contrast(t[fg]!,t[bg]!),`${fg} on ${bg}`).toBeGreaterThanOrEqual(theme==='light'?4.5:3);
  }
  expect(contrast(t['on-accent']!,t['accent-fill']!),'white on a filled blue button').toBeGreaterThanOrEqual(4.5);
 });
 it('are the only place the new shell names colours',()=>{
  for(const f of ['shell.css','shell.js','create.js','places.js'])expect(fs.readFileSync(path.join(UI,f),'utf8'),f).not.toMatch(/#[0-9a-fA-F]{6}\b|coral/);
  for(const f of fs.readdirSync(UI))expect(fs.readFileSync(path.join(UI,f),'utf8'),f).not.toMatch(/--coral|#f27542|#FF6B4A/i);
 });
});

describe('the icons',()=>{
 it('are Material Symbols, with their source and licence recorded',()=>{
  const js=fs.readFileSync(path.join(UI,'icons.js'),'utf8'),names=[...js.matchAll(/^ ([a-z]+):\['([a-z_0-9]+)'/gm)];
  expect(names.length).toBeGreaterThan(60);
  for(const k of ['home','spark','film','palette','scenes','folder','tools','brain','trash','bell','send','sliders','rules'])expect(js).toMatch(new RegExp(`^ ${k}:\\[`,'m'));
  expect(fs.readFileSync('assets/icons/material-symbols/LICENSE.txt','utf8')).toMatch(/Apache License/);
  const readme=fs.readFileSync('assets/icons/material-symbols/README.md','utf8');for(const [,,n] of names)expect(readme).toContain(`| ${n} |`);
 });
});

describe('the brand',()=>{
 it('is blue in every logo, mascot, icon and the brand profile',()=>{
  const old=/#0B3B3C|#FF6B4A|#FFF1D6|#F2DDB3|#E6CE9C|#082D2E/i;
  const walk=(d:string):string[]=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  for(const f of [...['logo','expressions','icons','social','web'].flatMap(d=>walk(path.join('assets/brand',d))),'agent/status/states.json','config/brand.json'].filter(f=>/\.(svg|css|json|html|webmanifest)$/.test(f)))
   expect(fs.readFileSync(f,'utf8'),f).not.toMatch(old);
  const brand=JSON.parse(fs.readFileSync('config/brand.json','utf8')) as {colors:Record<string,string>};
  expect(brand.colors).toMatchObject({primary:'#0B1F4A',accent:'#4C8DFF',background:'#EAF1FF'});
 });
});

describe('the page server',()=>{
 it('serves the new files, the tools from the registry, your library and every project\'s scenes',async()=>{
  const {serve}=await import('../src/teach/server.js'),s=await serve({port:4830});
  try{
   const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key};
   for(const f of ['font-ui.ttf','font-ui-ar.ttf','favicon.svg','mark.svg','tokens.css','shell.css','shell.js','create.js','places.js','icons.js'])expect((await fetch(base+'/'+f)).status,f).toBe(200);
   const page=await (await fetch(base+'/?k='+s.key)).text();
   for(const f of ['/tokens.css','/shell.css','/shell.js','/create.js','/places.js','/icons.js'])expect(page).toContain(f);
   expect(page.indexOf('/icons.js')).toBeGreaterThan(page.indexOf('/places.js')); // the icon set is drawn last, over every screen's own
   expect((await fetch(base+'/logo.svg')).headers.get('cache-control')).toBe('no-cache'); // a recoloured logo shows at once
   const {tools}=await (await fetch(base+'/api/tools',{headers:h})).json() as {tools:{id:string;name:string;group:string;icon:string;command:string;open?:string}[]};
   expect(tools.map(t=>t.id)).toEqual(expect.arrayContaining(['media-voice','media-speakers','media-match','edit-by-text','look-channel','paint-from','edit-export-timeline']));
   expect(tools.find(t=>t.id==='edit-by-text')).toMatchObject({name:'Edit by text',open:'#/tools/text'});
   expect(tools.every(t=>t.name&&t.group&&t.icon&&t.command.startsWith('pnpm'))).toBe(true);
   // Your library: added by upload, listed, served, removed.
   const {ffmpeg,run}=await import('../src/renderer/ffmpeg-encoder.js'),png=path.join(tmp,'mark.png');
   await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','color=c=0x4C8DFF:s=200x120','-frames:v','1',png]);
   const up=await fetch(base+'/api/library/upload?name=storefront.png',{method:'POST',headers:h,body:fs.readFileSync(png)});
   expect(up.status).toBe(200);const {added}=await up.json() as {added:string[]};expect(added).toHaveLength(1);
   const lib=await (await fetch(base+'/api/library',{headers:h})).json() as {entries:{id:string;kind:string;name:string}[];kinds:string[]};
   expect(lib.entries[0]).toMatchObject({id:added[0],kind:'image',name:'storefront.png'});expect(lib.kinds).toContain('logo');
   const file=await fetch(base+`/api/library/${added[0]}/file`,{headers:h});expect(file.status).toBe(200);expect(file.headers.get('content-type')).toContain('image/png');
   expect((await fetch(base+'/api/library/upload?name=empty.png',{method:'POST',headers:h,body:''})).status).toBe(400);
   expect((await fetch(base+`/api/library/${added[0]}`,{method:'DELETE',headers:h})).status).toBe(200);
   expect(((await (await fetch(base+'/api/library',{headers:h})).json()) as {entries:unknown[]}).entries).toHaveLength(0);
   expect((await fetch(base+'/api/library/nope/file',{headers:h})).status).toBe(404);
   expect((await (await fetch(base+'/api/scenes',{headers:h})).json())).toEqual({scenes:[]});
   expect((await fetch(base+'/api/library',{headers:{}})).status).toBe(403);
  }finally{await s.close();}
 },60000);
});

describe('places and old addresses',()=>{
 it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('opens each old address in its new place, with the right tabs',async()=>{
  const {chromium}=await import('playwright'),{chromiumExecutable}=await import('../src/renderer/browser-path.js');
  const {serve}=await import('../src/teach/server.js'),s=await serve({port:4831});
  const browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
   await page.goto(s.url);await page.locator('#dock-text').waitFor();
   expect(new URL(page.url()).hash).toBe('');
   expect(await page.locator('#title').innerText()).toBe('Create');
   const moves:[string,string,string][]=[['home','create','Create'],['studio/new','create','Create'],['studio/videos','projects','Projects'],['studio/gallery','projects/finished','Projects'],
    ['studio/scores','brain/worked','Brain'],['studio/ideas','tools/trends','Tools'],['studio/text','tools/text','Tools'],['taste','brain/taste','Brain'],['teach/add','library/teach','Library'],
    ['teach/library','library/references','Library'],['teach/lessons','brain/lessons','Brain'],['teach/patterns','brain/lessons','Brain'],['looks','library/looks','Library'],['scenes','library/scenes','Library'],['brain/teach','library/teach','Library'],['find','library/tidy','Library'],
    ['history','settings/history','Settings'],['backup','settings/backup','Settings'],['settings','settings','Settings']];
   for(const [old,now,place] of moves){
    await page.evaluate(h=>{location.hash='/'+h;},old);
    await expect.poll(()=>new URL(page.url()).hash,{message:old}).toBe('#/'+now);
    await page.waitForFunction(p=>document.querySelector('#title')?.textContent===p||p==='Settings',place);
    const current=page.locator('.rail .navlink[aria-current=page] .lbl');
    if(place!=='Settings')expect(await current.innerText(),old).toBe(place);
    if(now.includes('/')&&now!=='library/teach')await expect.poll(()=>page.locator('.tabs [aria-current=page]').count(),{message:old}).toBe(1);
   }
   // The command menu reaches places and tools by name.
   await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:/Search places, tools/}).fill('clean audio');
   await page.getByRole('option',{name:/Clean up audio/}).waitFor();await page.keyboard.press('Enter');
   await page.getByRole('heading',{name:'Clean up audio'}).waitFor();
   expect(await page.locator('.cmdline code').innerText()).toContain('pnpm tempoloom media voice');
   await page.keyboard.press('Escape');expect(await page.locator('#panel').isHidden()).toBe(true);
   // Keyboard: g then t goes to Tools; [ collapses the rail.
   await page.locator('body').click({position:{x:700,y:300}});await page.keyboard.press('g');await page.keyboard.press('t');
   await expect.poll(()=>new URL(page.url()).hash).toBe('#/tools');
   await page.locator('.tool-card').first().waitFor();
   expect(await page.locator('.section-head h3').allInnerTexts()).toEqual(expect.arrayContaining(['Sound','Words','Picture','Style','Art','Export']));
   expect(errors).toEqual([]);
  }finally{await browser.close();await s.close();}
 },60000);
});
