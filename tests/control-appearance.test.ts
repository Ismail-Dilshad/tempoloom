import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('numeric states and notifications of different lengths stay stable in both themes',async()=>{
 const browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setContent('<div id="modal"></div><div id="toasts" class="toasts" role="status" aria-live="polite"></div><main style="margin:220px 24px 0;display:grid;gap:18px"><label class="f">In<input id="value" type="number" value="0.25" step="0.01" min="0" max="10"></label><label class="f">Disabled<input type="number" value="12" disabled></label><label class="f">Read only<input type="number" value="4" readonly></label></main>');
  for(const f of ['tokens.css','app.css','shell.css'])await page.addStyleTag({content:await fs.readFile('src/teach/ui/'+f,'utf8')});
  await page.addScriptTag({content:await fs.readFile('src/teach/ui/core.js','utf8')});
  await page.evaluate('Controls.start()');
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
   const input=page.locator('#value'),field=page.locator('.number-control').first();
   await input.focus();await page.waitForTimeout(260);
   const state=await field.evaluate(el=>({border:getComputedStyle(el).borderColor,accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),outline:getComputedStyle(el.querySelector('input')!).outlineStyle,height:el.getBoundingClientRect().height}));
   expect(state.outline).toBe('none');expect(state.height).toBe(38);
   const accent=await page.evaluate(color=>{const el=document.createElement('span');el.style.color=color;document.body.append(el);const result=getComputedStyle(el).color;el.remove();return result;},state.accent);
   expect(state.border).toBe(accent);
   expect(await page.locator('.number-control.disabled button:disabled').count()).toBe(2);
   expect(await page.getByRole('button',{name:/Read only/}).first().isDisabled()).toBe(true);
   await page.mouse.move(0,800);await input.blur();
   await page.evaluate(()=>{(window as any).toast('This longer notification should wrap naturally inside its body, and the body grows to hold every line of it.',true);(window as any).toast('Ready');});
   const front=page.locator('.toast').first(),back=page.locator('.toast').nth(1);
   await expect.poll(()=>page.locator('.toast[data-open=true]').count()).toBe(2);
   await page.waitForTimeout(700);
   const fb=(await front.boundingBox())!,bb=(await back.boundingBox())!;
   expect(fb.height).toBeCloseTo(90,0); // a short message opens to the smallest body
   expect(bb.height).toBeGreaterThan(fb.height); // a long one grows to fit
   expect(bb.y).toBeGreaterThanOrEqual(fb.y+fb.height+11); // never overlapping
   expect(await back.locator('p').isVisible()).toBe(true);
   expect(await front.locator('button').count()).toBe(0);
   expect(await back.locator('.toast-title').evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');
   const fill=await front.locator('.toast-shape rect').first().evaluate(el=>getComputedStyle(el).fill);
   expect(fill).toBe(theme==='light'?'rgb(26, 26, 26)':'rgb(242, 242, 242)');
   if(process.env.DASHBOARD_SCREENSHOTS)await page.screenshot({path:`workspace/cache/dashboard-review/controls-${theme}.png`});
   await back.dispatchEvent('keydown',{key:'Escape'});
   expect(await back.getAttribute('data-leaving')).toBe('true');
   await back.waitFor({state:'detached'});
   await page.evaluate(()=>document.querySelector('#toasts')!.replaceChildren());
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>(window as any).toast('Reduced motion'));
  expect(await page.locator('.toast').evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(.001);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},30000);
