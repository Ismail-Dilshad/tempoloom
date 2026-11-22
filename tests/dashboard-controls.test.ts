import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('dashboard controls preserve form state, keyboard access, dialogs and mobile layout',async()=>{
 const browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light',reducedMotion:'reduce'});
 page.setDefaultTimeout(6000);
 await page.addInitScript(()=>{
  if(window===window.top&&location.hostname==='dashboard.test')localStorage.setItem('tl-theme','light');
 });
 let confirmedLink:Record<string,unknown>|null=null;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const settings={services:[],warnings:[],roles:[],presets:[],settings:{work:'terminal',model:null,roleModels:{},makers:{images:'off',video:'off',music:'off',sfx:'off',voice:'off'},share:'frames',budget:{perJob:5,perDay:20,askAbove:1}}};
 const home={teach:{videos:9,waiting:0,lessons:52,patterns:5},studio:{jobs:1,waitingForYou:0},scores:{good:12,bad:0},brain:{total:52,byStatus:{trial:30,approved:22}},you:[],agent:[],activity:[]};
 const studio={scores:{ratings:4,good:2,bad:1,jobs:1,steps:[{step:'script',good:2,bad:1,ok:1}],best:[],worst:[],rules:[],trend:[{job:'demo',created:'2026-01-01',rated:4,good:2}]},requests:[],jobs:[{job:'waiting-demo',request:'Waiting example',mode:'motion',finished:false,waitingFor:'agent',archived:false,ratings:[],done:2,of:5,created:'2026-01-01'}],taught:[{id:'reference-demo',title:'Reference example'}],reasons:[],can:{maxMB:2048}};
 try{
  await page.route('http://dashboard.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/studio/jobs/waiting-demo/archive'){Object.assign(studio.jobs[0]!,{archived:route.request().postDataJSON().on});return route.fulfill({json:{ok:true}});}
   if(url.pathname==='/api/studio/live')return route.fulfill({json:{jobs:[]}});
   if(url.pathname==='/api/studio/jobs/waiting-demo'&&route.request().method()==='DELETE'){studio.jobs.splice(0);return route.fulfill({json:{deleted:'waiting-demo'}});}
   if(url.pathname==='/api/link'){
    const input=route.request().postDataJSON();
    if(input.confirm){confirmedLink=input;return route.fulfill({json:{status:'ready',video:{id:'linked-draft'}}});}
    const choices=[{id:'first',item:1,title:'First carousel video',duration:10},{id:'second',item:2,title:'Second carousel video',duration:8}];
    return route.fulfill({json:{status:'needs-confirmation',previewToken:'test-preview',info:{page:input.url,item:1,title:'Instagram post',choices}}});
   }
   if(url.pathname==='/api/settings/models')return route.fulfill({json:{models:[]}});
   if(url.pathname==='/api/settings'){
    if(route.request().method()==='PATCH')Object.assign(settings.settings.budget,route.request().postDataJSON().budget);
    return route.fulfill({json:settings});
   }
   if(url.pathname==='/api/home')return route.fulfill({json:home});
   if(url.pathname==='/api/studio/state')return route.fulfill({json:studio});
   if(url.pathname==='/api/state')return route.fulfill({json:{videos:[],topics:[],can:{maxMB:2048,speech:false}}});
   if(url.pathname==='/logo.svg')return route.fulfill({body:await fs.readFile('assets/brand/logo/svg/tempoloom-wordmark-for-dark.svg'),contentType:'image/svg+xml'});
   const name=url.pathname==='/'?'index.html':path.basename(url.pathname);
   if(!['index.html','tokens.css','app.css','shell.css','core.js','shell.js','icons.js','create.js','learn.js','brain.js','editor.js','editor-ui.js','editor-sound.js','editor-colour.js','editor-export.js','editor-captions.js','editor-smart.js','editor-files.js','editor-widgets.js','editor-pitch.js','editor-title.js','editor-edit.js','editor-nest.js','editor-text.js','editor-props.js','editor-input.js','editor-dialogs.js','places.js','teach.js','studio.js','settings.js'].includes(name))return route.fulfill({status:204});
   return route.fulfill({body:await fs.readFile(path.resolve('src/teach/ui',name)),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://dashboard.test/#/studio/new');
  await page.locator('.logo-mark').waitFor();
  expect(new URL(page.url()).hash).toBe('#/create'); // old addresses open their new place
  await page.waitForFunction(()=>{const img=document.querySelector<HTMLImageElement>('.logo-mark');return img?.complete&&img.naturalWidth>0;});
  expect(await page.locator('.logo-mark').getAttribute('src')).toContain('/logo.svg');
  const colorScheme=()=>page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme);
  expect(await colorScheme()).toBe('dark');
  const logoSize=await page.locator('.logo-mark').boundingBox();
  await page.locator('#rail-bell').waitFor();
  await page.locator('#rail-settings').click();
  await page.waitForFunction(()=>location.hash==='#/settings');
  await page.evaluate(()=>{location.hash='/create';});await page.locator('#dock-text').waitFor();
  expect(await page.getByRole('menuitemradio').count()).toBe(0);
  await page.emulateMedia({colorScheme:'dark'});
  await page.emulateMedia({colorScheme:'light'});
  expect(await colorScheme()).toBe('dark');
  const otherLogoSize=await page.locator('.logo-mark').boundingBox();
  expect(otherLogoSize!.width).toBe(logoSize!.width);
  expect(otherLogoSize!.height).toBe(logoSize!.height);
  await page.waitForFunction(()=>{const img=document.querySelector<HTMLImageElement>('.logo-mark');return img?.complete&&img.naturalWidth>0;});
  expect(await page.locator('.logo-mark').getAttribute('src')).toContain('/logo.svg');
  const header=await page.locator('.rail-head').boundingBox(),navigation=await page.locator('.rail-body').boundingBox(),footer=await page.locator('.rail-foot').boundingBox();
  expect(navigation!.y).toBeGreaterThanOrEqual(header!.y+header!.height);
  expect(footer!.y+footer!.height).toBeCloseTo(1000,0);
  // The rail: four places (Projects lives on Create) in order, Trash and Collapse at its foot.
  expect(await page.locator('.rail-body .navlink .lbl').allInnerTexts()).toEqual(['Studio','Editor','Brain']);
  await page.getByRole('button',{name:'Collapse',exact:true}).click();
  expect(await page.locator('#app').getAttribute('data-rail')).toBe('collapsed');
  const brainIcon=page.locator('.rail-body a[href="#/brain"]');
  await brainIcon.hover();
  await page.locator('#dashboard-tooltip.visible',{hasText:'Brain'}).waitFor();
  await page.keyboard.press('Escape');
  await page.keyboard.press('[');
  expect(await page.locator('#app').getAttribute('data-rail')).toBe('');
  // The prompt box keeps what you wrote; its settings open in the right panel.
  // Create shows the ways to start only while it has nothing else (no uploads, projects or outputs):
  // the demo project is set aside here and comes back below.
  // (taught styles are cards on Create too, so they are set aside as well)
  const taughtWas=studio.taught;studio.taught=[];
  studio.jobs[0]!.archived=true;await page.evaluate('App.refresh(true)');await page.locator('.create-preview-art').first().waitFor();
  const previews=await page.locator('.create-preview-art').evaluateAll(async elements=>Promise.all(elements.map(async el=>{
   const image=new Image();
   const background=getComputedStyle(el).backgroundImage;
   image.src=background.slice(5,-2);
   await image.decode();
   return image.naturalWidth;
  })));
  expect(previews).toHaveLength(3);
  expect(previews.every(width=>width>0)).toBe(true);
  await page.getByRole('button',{name:'Use a reference',exact:true}).click();
  const files=page.getByRole('dialog',{name:'Add files'});
  await files.getByRole('heading',{name:'No reference yet'}).waitFor();
  const [upload]=await Promise.all([
   page.waitForEvent('filechooser'),
   files.getByRole('button',{name:'Upload files'}).click()
  ]);
  expect(upload.isMultiple()).toBe(true);
  await files.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Edit footage',exact:true}).click();
  expect(await page.locator('#dock-kind').innerText()).toContain('Edit my footage');
  await page.getByRole('button',{name:'Animate an idea'}).click();
  expect(await page.locator('#dock-kind').innerText()).toContain('Motion graphics');
  studio.taught=taughtWas;studio.jobs[0]!.archived=false;await page.evaluate('App.refresh(true)');await page.locator('[data-group=projects]').waitFor();
  await page.locator('#view').focus();
  await page.keyboard.type('go');
  expect(await page.locator('#dock-text').inputValue()).toBe('go');
  await page.locator('#dock-text').fill('A complete original script.');
  await page.getByRole('button',{name:'Expand prompt'}).click();
  await page.getByRole('heading',{name:'Edit prompt'}).waitFor();
  const expandedPrompt=page.locator('#panel #dock-text');
  expect(await expandedPrompt.inputValue()).toBe('A complete original script.');
  const footageMode=page.locator('#panel .prompt-mode',{hasText:'Edit my footage'});
  await footageMode.click();
  expect(await footageMode.getAttribute('aria-pressed')).toBe('true');
  expect(await expandedPrompt.inputValue()).toBe('A complete original script.');
  await page.locator('#panel .prompt-mode',{hasText:'Motion graphics'}).click();
  await expandedPrompt.fill('Revised in the drawer.');
  await page.keyboard.press('Escape');
  await page.locator('#panel').waitFor({state:'hidden'});
  expect(await page.locator('#dock-slot #dock-text').inputValue()).toBe('Revised in the drawer.');
  await page.locator('#dock-text').fill('A complete original script.');
  await page.getByRole('button',{name:'Settings for this video'}).click();
  await page.getByRole('heading',{name:'Settings for this video'}).waitFor();
  await page.getByRole('button',{name:'16:9'}).click();
  expect(await page.getByRole('button',{name:'16:9'}).getAttribute('aria-pressed')).toBe('true');
  expect(await page.getByRole('group',{name:'Length'}).count()).toBe(0);
  expect(await page.locator('#language').count()).toBe(0);
  await page.getByRole('switch',{name:'Voice-over'}).check();
  expect(await page.getByRole('switch',{name:'Second opinion'}).isVisible()).toBe(true);
  const referenceStyle=page.getByRole('combobox',{name:/^Reference style/});
  const readBorder=()=>referenceStyle.evaluate(el=>{
   const css=getComputedStyle(el);
   return {radius:css.borderTopLeftRadius,color:css.borderTopColor,width:css.borderTopWidth};
  });
  const restingBorder=await readBorder();
  expect(restingBorder.radius).toBe('999px');
  expect(restingBorder.width).toBe('1px');
  await referenceStyle.hover();
  await referenceStyle.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
  expect(await readBorder()).toEqual(restingBorder);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.locator('#panel').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Rules for this video'}).click();
  await page.getByRole('button',{name:'Add instruction',exact:true}).waitFor();
  expect(await page.getByRole('textbox',{name:'Guideline',exact:true}).count()).toBe(0);
  await page.getByRole('button',{name:'Add instruction',exact:true}).click();
  await page.getByRole('textbox',{name:'Guideline',exact:true}).first().fill('Keep it brief.');
  await page.getByRole('textbox',{name:'Instruction title',exact:true}).fill('Pacing');
  await page.getByRole('button',{name:'Add instruction',exact:true}).click();
  await page.getByRole('textbox',{name:'Guideline',exact:true}).last().fill('Use this only when enabled.');
  await page.getByRole('switch',{name:'Enable instruction 2'}).uncheck();
  await page.locator('.instruction-card').first().locator('input[type=file]').setInputFiles({
   name:'example.png',mimeType:'image/png',buffer:Buffer.from('sample reference')
  });
  await page.locator('.instruction-card').last().locator('input[type=file]').setInputFiles({
   name:'disabled.png',mimeType:'image/png',buffer:Buffer.from('disabled reference')
  });

  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.locator('#dock-text').click();await page.keyboard.press('Escape');
  await page.reload();await page.locator('#dock-text').waitFor();
  await page.locator('#dock-instructions[data-instructions-active]').waitFor();
  expect(await page.locator('#dock-text').inputValue()).toBe('A complete original script.');
  await page.getByRole('button',{name:'Rules for this video'}).click();
  expect(await page.getByRole('textbox',{name:'Guideline',exact:true}).first().inputValue()).toBe('Keep it brief.');
  expect(await page.getByRole('textbox',{name:'Instruction title',exact:true}).first().inputValue()).toBe('Pacing');
  expect(await page.getByRole('switch',{name:'Enable instruction 2'}).isChecked()).toBe(false);
  expect(await page.getByRole('button',{name:'Replace reference for instruction 1'}).innerText()).toBe('example.png');

  await page.getByRole('textbox',{name:'Guideline',exact:true}).first().fill('Unsaved draft');
  await page.getByRole('button',{name:'Close the panel'}).click();
  await page.getByRole('button',{name:'Rules for this video'}).click();
  expect(await page.getByRole('textbox',{name:'Guideline',exact:true}).first().inputValue()).toBe('Keep it brief.');
  await page.getByRole('button',{name:'Close the panel'}).click();
  await page.getByRole('button',{name:'Settings for this video'}).click();
  expect(await page.getByRole('button',{name:'16:9'}).getAttribute('aria-pressed')).toBe('true');
  expect(await page.getByRole('switch',{name:'Voice-over'}).isChecked()).toBe(true);
  await page.getByRole('button',{name:'Close the panel'}).click();
  // The kind pill and the command menu.
  await page.locator('#dock-kind').click();await page.getByRole('menuitemradio',{name:/Edit my footage/}).click();
  expect(await page.locator('#dock-kind').innerText()).toContain('Edit my footage');
  // On Create, Ctrl+K goes to the page's search first; pressed again there it opens the command menu.
  await page.keyboard.press('Control+k');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('create-search');
  await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:/Search places/}).fill('trash');
  await page.keyboard.press('Enter');await expect.poll(()=>new URL(page.url()).hash).toBe('#/trash');
  await page.evaluate(()=>{location.hash='/create';});await page.locator('#dock-text').waitFor();
  // A select created inside a dialog is enhanced too; Escape closes the list first.
  await page.evaluate(()=>{(window as any).dialog('<h2>Options</h2><label for="test-select">Test choice</label><select id="test-select"><option>A</option><option disabled>B</option><option>C</option></select>');});
  const choice=page.getByRole('combobox',{name:/Test choice/});await choice.waitFor();await choice.click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');expect(await page.locator('#test-select').inputValue()).toBe('C');
  await choice.click();await page.keyboard.press('Escape');expect(await page.getByRole('dialog').count()).toBe(1);await page.keyboard.press('Escape');expect(await page.getByRole('dialog').count()).toBe(0);
  await page.evaluate(()=>{(window as any).dialog('<h2>Numeric controls</h2><label for="test-amount">Amount</label><input type="number" id="test-amount" step="any" min="-2" max="2" value="0.25"><label for="test-quantity">Quantity</label><input type="number" id="test-quantity" value="1" readonly>');});
  const amount=page.getByRole('spinbutton',{name:'Amount',exact:true});
  await page.getByRole('button',{name:'Increase Amount',exact:true}).click();
  expect(await amount.inputValue()).toBe('1.25');
  await page.getByRole('button',{name:'Increase Amount',exact:true}).click();
  expect(await amount.inputValue()).toBe('2');
  expect(await page.getByRole('button',{name:'Increase Amount',exact:true}).isDisabled()).toBe(true);
  await page.getByRole('button',{name:'Decrease Amount',exact:true}).click({modifiers:['Shift']});
  expect(await amount.inputValue()).toBe('-2');
  expect(await page.getByRole('button',{name:'Decrease Amount',exact:true}).isDisabled()).toBe(true);
  const quantity=page.getByRole('spinbutton',{name:'Quantity',exact:true});
  expect(await page.getByRole('button',{name:'Increase Quantity',exact:true}).isDisabled()).toBe(true);
  await quantity.evaluate(el=>{(el as HTMLInputElement).readOnly=false;});
  await page.getByRole('button',{name:'Increase Quantity',exact:true}).click();
  expect(await quantity.inputValue()).toBe('2');
  await quantity.evaluate(el=>{(el as HTMLInputElement).disabled=true;});
  await expect.poll(()=>page.getByRole('button',{name:'Increase Quantity',exact:true}).isDisabled()).toBe(true);
  await page.evaluate(()=>{(window as any).closeDialog();});
  if(process.env.DASHBOARD_SCREENSHOTS){await fs.mkdir('workspace/cache/dashboard-review',{recursive:true});await page.screenshot({path:'workspace/cache/dashboard-review/studio-desktop.png',fullPage:true});}
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollbarWidth)).toBe('none');
  await page.getByRole('button',{name:'Settings for this video'}).click();
  const captions=page.getByRole('switch',{name:'Captions',exact:true});
  await captions.uncheck();
  expect(await captions.isChecked()).toBe(false);
  await page.getByRole('button',{name:'Close the panel'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Open the menu'}).click();expect(await page.locator('#app').getAttribute('class')).toContain('open');
  await page.locator('.navlink[href="#/create"]').click();await page.locator('[data-group=projects]').waitFor();
  expect(await page.locator('#app').getAttribute('class')).not.toContain('open');
  if(process.env.DASHBOARD_SCREENSHOTS)await page.screenshot({path:'workspace/cache/dashboard-review/home-mobile.png',fullPage:true});
  await page.evaluate(()=>{(window as any).dialog('<h2>Tooltip check</h2><button id="tip-check" title="Save your changes" aria-describedby="tip-help">Save</button><span id="tip-help">Settings</span>');});
  const tooltip=page.getByRole('tooltip'),tipButton=page.locator('#tip-check');
  await tipButton.focus();
  await page.waitForTimeout(350);
  expect(await tooltip.isVisible()).toBe(false);
  await tipButton.hover();
  await tooltip.waitFor({state:'visible'});
  expect(await tooltip.innerText()).toBe('Save your changes');
  expect(await tipButton.getAttribute('title')).toBeNull();
  expect(await tipButton.getAttribute('aria-describedby')).toBe('tip-help dashboard-tooltip');
  const tipBounds=await tooltip.boundingBox();
  expect(tipBounds!.x).toBeGreaterThanOrEqual(8);
  expect(tipBounds!.x+tipBounds!.width).toBeLessThanOrEqual(382);
  await page.keyboard.press('Escape');
  await tooltip.waitFor({state:'hidden'});
  expect(await tipButton.getAttribute('aria-describedby')).toBe('tip-help');
  await page.evaluate(()=>{(window as any).closeDialog();});
  await page.evaluate(()=>{location.hash='/studio/videos';});
  await expect.poll(()=>new URL(page.url()).hash).toBe('#/create');// the project list lives on Create
  // A project goes to the trash first; only the trash deletes it, after asking.
  await page.getByRole('button',{name:'More for Waiting example',exact:true}).click();
  await page.getByRole('menuitem',{name:'Move to trash'}).or(page.getByRole('button',{name:'Move to trash'})).click();
  await page.locator('[data-group=projects]').waitFor({state:'detached'});
  await page.evaluate(()=>{location.hash='/trash';});
  const more=page.getByRole('button',{name:'More for Waiting example',exact:true});
  await more.click();await page.getByRole('button',{name:'Delete forever'}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await more.count()).toBe(1);
  expect(new URL(page.url()).hash).toBe('#/trash');
  await more.click();await page.getByRole('button',{name:'Delete forever'}).click();
  await page.getByRole('button',{name:'Delete job',exact:true}).click();
  await page.getByRole('heading',{name:'Trash is empty'}).waitFor();
  expect(await page.locator('#view').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
  if(process.env.DASHBOARD_SCREENSHOTS)await page.screenshot({path:'workspace/cache/dashboard-review/empty-videos-mobile.png'});
  expect(studio.jobs).toHaveLength(0);
  expect(await page.locator('.toast').count()).toBe(0);
  await page.evaluate("(async()=>{const refresh=App.refresh;App.refresh=async()=>{};try{await act(async()=>{},'Saved');}finally{App.refresh=refresh;}})()");
  expect(await page.locator('.toast').count()).toBe(0);
  // Notifications in the Sileo style: a pill at the top centre that springs open into a body.
  await page.evaluate(()=>{document.querySelector('#toasts')!.replaceChildren();(window as any).toast('Changes saved');});
  const notification=page.locator('.toast').filter({hasText:'Changes saved'});
  const bounds=await notification.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeLessThan(40);
  expect(Math.abs(bounds!.x+bounds!.width/2-195)).toBeLessThan(2);
  expect(bounds!.width).toBeLessThanOrEqual(358);
  expect(await notification.locator('button').count()).toBe(0);
  expect(await notification.getAttribute('role')).toBe('status');
  expect(await notification.locator('.toast-title').innerText()).toBe('Done');
  expect(await notification.locator('svg filter feColorMatrix').count()).toBe(1); // the gooey join
  await notification.focus();await page.keyboard.press('Escape');
  await notification.waitFor({state:'detached'});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{(window as any).toast('Your video brief has been saved and is ready for the studio.');});
  const expanding=page.locator('.toast').first();
  expect((await expanding.boundingBox())!.height).toBeLessThan(48); // a pill first
  await expect.poll(()=>expanding.getAttribute('data-open')).toBe('true');
  await expect.poll(async()=>(await expanding.boundingBox())!.height).toBeGreaterThanOrEqual(90); // then it opens
  expect(await expanding.locator('p').isVisible()).toBe(true);
  expect(await expanding.locator('.toast-shape rect').first().evaluate(el=>getComputedStyle(el).fill)).toBe('rgb(242, 242, 242)');
  if(process.env.DASHBOARD_SCREENSHOTS)await page.screenshot({path:'workspace/cache/dashboard-review/toast-dark.png'});
  await expanding.focus();await page.keyboard.press('Escape');
  await expect.poll(()=>expanding.getAttribute('data-leaving')).toBe('true');
  await expanding.waitFor({state:'detached'});
  // Several at once: newest on top, 12 px apart, each dismissed on its own.
  await page.evaluate(()=>{
   document.querySelector('#toasts')!.replaceChildren();
   (window as any).toast('First stacked message');
   (window as any).toast('Second stacked message');
   (window as any).toast('Third stacked message');
  });
  await page.mouse.move(10,500);
  await expect.poll(()=>page.locator('.toast[data-open=true]').count()).toBe(3);
  await page.waitForTimeout(700);
  const second=page.locator('.toast').filter({hasText:'Second stacked message'}),newest=page.locator('.toast').filter({hasText:'Third stacked message'});
  const nb=(await newest.boundingBox())!,sb=(await second.boundingBox())!;
  expect(sb.y-(nb.y+nb.height)).toBeCloseTo(12,0);
  if(process.env.DASHBOARD_SCREENSHOTS)await page.screenshot({path:'workspace/cache/dashboard-review/toast-stack.png'});
  await newest.dispatchEvent('keydown',{key:'Escape'});
  await page.waitForFunction(()=>document.querySelectorAll('.toast').length===2);
  await page.waitForTimeout(700);
  expect((await second.boundingBox())!.y).toBeLessThan(sb.y);
  // An error says so, and the same message twice shows once.
  await page.evaluate(()=>{document.querySelector('#toasts')!.replaceChildren();});
  await page.evaluate(()=>{(window as any).toast('Cannot save this change',true);(window as any).toast('Cannot save this change',true);});
  expect(await page.locator('.toast').count()).toBe(1);
  expect(await page.locator('.toast').innerText()).toContain('Cannot save this change');
  expect(await page.locator('.toast').getAttribute('role')).toBe('alert');
  expect(await page.locator('.toast .toast-title').innerText()).toBe('Something went wrong');
  await page.evaluate(()=>{document.querySelector('#toasts')!.replaceChildren();});
  await page.evaluate(()=>{(window as any).dialog('<h2>Animated options</h2><label for="animated-select">Choose style</label><select id="animated-select"><option>Soft</option><option>Rounded</option></select>');});
  const animatedSelect=page.getByRole('combobox',{name:/Choose style/});
  await animatedSelect.click();
  const animatedMenu=page.getByRole('listbox');
  expect(await animatedMenu.evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);
  await animatedMenu.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
  await page.keyboard.press('Escape');
  expect(await animatedSelect.getAttribute('aria-expanded')).toBe('false');
  expect(await page.getByRole('listbox').count()).toBe(0);
  expect(await page.locator('.select-menu[aria-hidden=true]').count()).toBe(1);
  await page.locator('.select-menu').waitFor({state:'detached'});
  await page.evaluate(()=>{(window as any).closeDialog();});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.mouse.move(10,500);
  await page.evaluate(()=>{(window as any).toast('Expires independently');(window as any).toast('Take your time reading');});
  const paused=page.locator('.toast').filter({hasText:'Take your time reading'});
  await page.waitForTimeout(1000);
  await paused.hover(); // held open while you read it
  await page.waitForTimeout(5500);
  expect(await paused.isVisible()).toBe(true);
  expect(await paused.getAttribute('data-open')).toBe('true');
  expect(await page.locator('.toast').filter({hasText:'Expires independently'}).count()).toBe(0);
  await page.mouse.move(10,500);
  await page.waitForTimeout(1600);
  expect(await paused.isVisible()).toBe(true);
  await paused.waitFor({state:'detached',timeout:5000});
  await page.evaluate(()=>{location.hash='/studio/scores';});
  await page.getByRole('heading',{name:'First-pass approval'}).waitFor();
  await page.getByText('View chart data').click();
  expect(await page.locator('.chart-row').innerText()).toContain('2/4 \u00b7 50%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  // Learn takes a link in its + popup; a post with several videos asks which one.
  await page.evaluate(()=>{location.hash='/teach/add';});
  await expect.poll(()=>new URL(page.url()).hash).toBe('#/learn');
  const learnPrompt=page.getByRole('textbox',{name:'Learn from a video'});await learnPrompt.waitFor();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const postUrl='https://www.instagram.com/p/CorrectCode/';
  await page.getByRole('button',{name:'Add a video to learn from'}).click();
  await page.getByRole('button',{name:'Link',exact:true}).click();
  await page.getByRole('textbox',{name:'Link to a video'}).fill(postUrl);
  await page.getByRole('button',{name:'Bring it in'}).click();
  await page.getByRole('menuitem',{name:'Second carousel video'}).click();
  await expect.poll(()=>confirmedLink).toMatchObject({url:postUrl,confirm:true,previewToken:'test-preview',selection:{id:'second',item:2}});
  await page.evaluate(()=>{location.hash='/settings';});
  // Settings keeps to models and keys: no budgets, privacy or sidebar tab.
  await page.getByRole('heading',{name:/Models for the agents/}).waitFor();
  expect(await page.getByRole('heading',{name:/Budgets|Privacy/}).count()).toBe(0);
  expect(await page.locator('nav.tabs a',{hasText:'Sidebar'}).count()).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const uploads:string[]=[];
  let notes:string|undefined;
  await page.route(/\/api\/studio\/requests(?:\/|$)/,route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/files')){
    const name=url.searchParams.get('name')!;
    uploads.push(name);
    return route.fulfill({json:{files:[{kind:'asset',name,bytes:16}]}});
   }
   if(url.pathname.endsWith('/submit')){
    notes=route.request().postDataJSON().notes;
    return route.fulfill({json:{driving:false}});
   }
   return route.fulfill({json:{id:'instruction-test'}});
  });
  await page.evaluate(()=>{location.hash='/create';});
  await page.locator('#dock-kind').click();
  await page.getByRole('menuitemradio',{name:/Motion graphics/}).click();
  await page.locator('#dock-text').fill('A short video about the ocean.');
  await page.locator('#dock-send').click();
  await expect.poll(()=>notes).toMatch(/^Pacing\nKeep it brief\.\nReference: instruction-[\da-f]+\.png$/);
  expect(uploads).toEqual([notes!.split('Reference: ')[1]]);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},30000);

