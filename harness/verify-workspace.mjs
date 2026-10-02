/** Production extension QA on fictional HTML, with every network request intercepted. */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { workspaceFixtureHtml } from './workspace-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'../../outputs/planner-workspace-v0.14.1');
const url='https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx',fixture=workspaceFixtureHtml(6,true);
const js=await readFile(resolve(root,'dist/content.js'),'utf8'),css=await readFile(resolve(root,'dist/injected.css'),'utf8');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BETTER_MYUCLA_CHROMIUM||undefined});
const setup=async(page,html)=>{
 const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url()===url ? route.fulfill({status:200,contentType:'text/html',body:html}) : (requests.push(route.request().url()),route.abort()));
 await page.goto(url);
 await page.evaluate(()=>{
  const listeners=[];
  window.chrome={storage:{local:{get:async key=>key==='plannerLift.layout.v1'?{[key]:{tidy:true}}:{},set:async()=>{},remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}}};
  window.toggleTidy=tidy=>listeners.forEach(fn=>fn({'plannerLift.layout.v1':{newValue:{tidy}}},'local'));
  window.nativeFields=[...document.querySelectorAll('input,select')];
  window.nativeCommands=[...document.querySelectorAll('.OrderingButtons button')].map(node=>({node,command:node.getAttribute('onclick')}));
  window.nativeDetails=document.querySelector('tbody.courseItem > tr:nth-child(3)');window.nativeDetailsParent=window.nativeDetails.parentElement;
  window.nativeNavigation=document.getElementById('fixture-native-navigation');window.nativeNavigationHtml=window.nativeNavigation.outerHTML;
  window.nativeStatuses=[...document.querySelectorAll('table.coursetable td:nth-child(3),.ClassSearchList .data_row > .span3')].map(node=>({node,html:node.innerHTML}));
  window.nativeResultClickCount=0;document.querySelectorAll('.ClassSearchList .class-title a').forEach(node=>node.addEventListener('click',()=>window.nativeResultClickCount++));
 });
 await page.addStyleTag({content:css});await page.addScriptTag({content:js});await page.waitForSelector('.pl-workspace-deck');
 return {errors,requests};
};
try {
 for(const width of [1920,1440,1536,1280,1200,960,390]){
  const height=width===1536?735:900,page=await browser.newPage({viewport:{width,height}});
  const {errors,requests}=await setup(page,fixture);
  assert.equal(await page.locator('.pl-workspace-deck > section').count(),3);
  assert.equal(await page.locator('form').count(),1);assert.equal(await page.locator('[data-pl-workspace-details]').count(),6);
  assert.equal(await page.locator('[data-pl-status-badge], [data-pl-section-status], [data-pl-status-original]').count(),0);
  const nativePreserved=()=>page.evaluate(()=>window.nativeFields.every(node=>node.isConnected&&node.form===document.getElementById('aspnetForm'))&&window.nativeCommands.every(({node,command})=>node.isConnected&&node.getAttribute('onclick')===command)&&window.nativeStatuses.every(({node,html})=>node.innerHTML===html)&&window.nativeNavigation.outerHTML===window.nativeNavigationHtml);
  assert.ok(await nativePreserved());
  assert.ok(await page.locator('.pl-workspace-host > .plannerTopMenuLinks').isVisible());
  assert.ok(await page.locator('#ctl00_MainContent_termSessionChooser').isVisible());
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1),`page overflow ${width}`);
  assert.equal(await page.locator('.pl-browser-index button').count(),3);
  assert.equal(await page.locator('.pl-browser-list > .pl-browser-body:visible').count(),1);
  await page.locator('.pl-browser-index button').nth(2).click();
  assert.equal(await page.locator('#CourseListEntry_M2').evaluate(node=>node.classList.contains('pl-browser-active')),true);
  assert.equal(await page.evaluate(()=>window.nativeResultClickCount),0,'preview selection must not send native requests');
  assert.ok(await page.locator('#container_course_M2').isVisible(),'loaded hidden course must preview locally');
  assert.ok(await page.locator('.pl-browser-list').evaluate(node=>node.scrollWidth<=node.clientWidth+1),'result cards fit the browser pane');
  assert.equal(await page.locator('.pl-browser-body-active .data_row > .span7').first().isVisible(),false);
  await page.locator('.pl-browser-toolbar button').getByText('Rooms & instructors',{exact:true}).click();
  assert.equal(await page.locator('.pl-browser-body-active .data_row > .span7').first().isVisible(),true);
  await page.locator('.pl-browser-toolbar button').getByText('Rooms & instructors',{exact:true}).click();
  await page.locator('.pl-browser-toolbar button').getByText('Edit search',{exact:true}).click();
  assert.ok(await page.locator('input#searchTier0').isVisible());
  await page.locator('.pl-browser-toolbar button').getByText('Hide search fields',{exact:true}).click();
  assert.ok(await nativePreserved());
  assert.ok(await page.locator('.pl-browser-body-active .header-Status').isVisible(),'native header help remains accessible');
  assert.ok(await page.locator('#fixture-result-footer button').isVisible(),'global native result actions remain accessible');
  if(width>1240){
   const nav=await page.locator('#fixture-native-navigation').boundingBox(),host=await page.locator('.pl-workspace-host').boundingBox();
   assert.ok(host.y>=nav.y+nav.height,'UCLA navigation remains unobscured');
   const boxes=await page.locator('.pl-workspace-deck > section').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
   assert.ok(boxes.every(box=>box.bottom<=height&&box.width>=200),JSON.stringify(boxes));
   assert.ok(boxes[0].right<=boxes[1].left&&boxes[1].right<=boxes[2].left);
   assert.ok(boxes[1].width>=420,'schedule needs room');assert.ok(boxes[2].width>=340);
   const sep=page.getByRole('separator',{name:'Resize browser pane'}),before=(await page.locator('.pl-workspace-search').boundingBox()).width;
   await sep.press('ArrowLeft');assert.ok((await page.locator('.pl-workspace-search').boundingBox()).width>before);
   const handle=await sep.boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+100);await page.mouse.down();await page.mouse.move(handle.x-60,handle.y+100,{steps:8});await page.mouse.up();
   assert.ok((await page.locator('.pl-workspace-search').boundingBox()).width>before+40,'pointer resizing');
   await sep.dblclick();
   const switches=page.locator('.pl-workspace-pane-switches button'),scheduleBefore=(await page.locator('.pl-workspace-calendar').boundingBox()).width;
   await page.locator('#plannerSectionClip > button.planSectionToggle').click();
   assert.equal(await page.locator('.pl-workspace-plan').isVisible(),false);
   assert.ok((await page.locator('.pl-workspace-calendar').boundingBox()).width>scheduleBefore);
   assert.equal(await switches.nth(0).evaluate(node=>document.activeElement===node),true);await switches.nth(0).press('Enter');
   for(let i=0;i<3;i++)await switches.nth(i).click();assert.ok(await page.locator('.pl-workspace-empty').isVisible());
   for(let i=0;i<3;i++)await switches.nth(i).press('Space');
   assert.equal(await page.locator('.pl-workspace-deck > section:visible').count(),3);
   await page.locator('tbody.courseItem').last().scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>scrollY),0);await page.locator('tbody.courseItem').first().scrollIntoViewIfNeeded();
   if(width===1440)await page.screenshot({path:resolve(out,'workspace-1440.png')});
  } else {
   const boxes=await page.locator('.pl-workspace-deck > section').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
   assert.ok(boxes[0].bottom<=boxes[1].top&&boxes[1].bottom<=boxes[2].top,'narrow layout stacks readable panes');
  }
  const calendar=await page.locator('#gridDiv .planneritembox').evaluateAll(nodes=>nodes.map(node=>({overflow:node.getBoundingClientRect().right-node.parentElement.getBoundingClientRect().right,height:node.getBoundingClientRect().height,intended:parseFloat(node.style.height)+(node.style.border.includes('double')?6:2)})));
  assert.ok(calendar.every(box=>box.overflow<=1&&Math.abs(box.height-box.intended)<1),`native calendar sizing ${width}`);
  const details=page.locator('[data-pl-workspace-details]').first();await details.click();
  assert.ok(await page.locator('.pl-workspace-preview').isVisible());
  assert.equal(await page.locator('.pl-workspace-detail-backdrop').count(),0);
  assert.ok(await page.evaluate(()=>window.nativeDetails.parentElement===window.nativeDetailsParent));
  assert.ok(await nativePreserved());
  const detailRow=page.locator('tbody.pl-workspace-preview-card > tr:nth-child(3)');
  assert.ok(await detailRow.isVisible());
  const rect=await detailRow.boundingBox();assert.ok(rect.width>200&&rect.x>=0&&rect.x+rect.width<=width+1,`details fit ${width}: ${JSON.stringify(rect)}`);
  if(width>1240){
   assert.ok(rect.y+rect.height<=height,'docked details remain in viewport');
   const right=await page.locator('.pl-workspace-search').boundingBox();assert.ok(rect.x>=right.x&&rect.x+rect.width<=right.x+right.width);
   await page.locator('.pl-workspace-pane-switches button').nth(1).click();
   assert.ok(await page.locator('.pl-workspace-preview').isVisible(),'schedule controls remain usable while inspecting');
   await page.locator('.pl-workspace-pane-switches button').nth(1).click();
   if(width===1440)await page.screenshot({path:resolve(out,'class-details.png')});
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('.pl-workspace-preview').isVisible(),false);
  assert.equal(await details.evaluate(node=>document.activeElement===node),true);
  await details.click();const close=page.getByRole('button',{name:'Close details',exact:true}),closeBox=await close.boundingBox();
  assert.ok(closeBox.width>=44&&closeBox.height>=44);await close.click();assert.equal(await details.evaluate(node=>document.activeElement===node),true);
  await page.locator('.pl-workspace-extras > summary').click();assert.equal(await page.locator('.pl-workspace-section-links button').count(),3);
  await page.locator('.pl-workspace-section-links button').getByText('Personal Entries',{exact:true}).click();
  const fold=page.locator('#plannerSectionPer > .pl-pane-toggle');await fold.click();assert.equal(await page.locator('input[name="examplePersonalEntry"]').isVisible(),false);
  await page.locator('.pl-workspace-section-links button').getByText('Personal Entries',{exact:true}).click();assert.equal(await page.locator('input[name="examplePersonalEntry"]').isVisible(),true);
  await page.keyboard.press('Escape');await page.locator('.pl-workspace-original').click();
  assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(),6);
  assert.equal(await page.locator('.pl-browser-index').count(),0);assert.ok(await nativePreserved());
  await page.locator('.pl-workspace-return').click();await page.waitForSelector('.pl-workspace-deck');
  await page.evaluate(html=>{
   const next=document.importNode(new DOMParser().parseFromString(html,'text/html').getElementById('ctl00_MainContent_classPlanPanel'),true);
   window.redrawFields=[...next.querySelectorAll('input,select')];document.getElementById('ctl00_MainContent_classPlanPanel').replaceWith(next);
  },fixture);
  await page.waitForSelector('.pl-workspace-deck .pl-browser-index');
  assert.equal(await page.locator('.pl-workspace-deck').count(),1);assert.equal(await page.locator('#panelPlan').count(),1);assert.equal(await page.locator('input[name="examplePersonalEntry"]').count(),1);
  await page.evaluate(()=>window.toggleTidy(false));await page.waitForSelector('.pl-workspace-deck',{state:'detached'});
  assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(),6);assert.equal(await page.locator('[data-pl-workspace-details],.pl-section-label,.pl-browser-index').count(),0);
  assert.ok(await page.evaluate(()=>window.redrawFields.every(node=>node.isConnected&&node.form===document.getElementById('aspnetForm'))));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await page.close();console.log(`Workspace verified: ${width}px`);
 }
 const tall=await browser.newPage({viewport:{width:2048,height:927}});
 const tallChecks=await setup(tall,workspaceFixtureHtml(6,true,true));
 const nativeMenu=await tall.locator('.plannerTopMenuLinks').boundingBox();
 await tall.locator('[data-pl-workspace-details]').first().click();
 const assertTallDetails=async()=>{
  const row=await tall.locator('tbody.pl-workspace-preview-card > tr:nth-child(3)').boundingBox();
  const pane=await tall.locator('.pl-workspace-search').boundingBox();
  assert.ok(row.height>=60&&row.y+row.height<=Math.min(927,pane.y+pane.height),`short pane inspector fits: ${JSON.stringify(row)}`);
 };
 await assertTallDetails();await tall.locator('.pl-workspace-preview-head summary').click();await assertTallDetails();
 const afterMenu=await tall.locator('.plannerTopMenuLinks').boundingBox();assert.deepEqual(afterMenu,nativeMenu,'native plan menus stay put');
 assert.deepEqual(tallChecks.errors,[]);assert.deepEqual(tallChecks.requests,[]);
 await tall.screenshot({path:resolve(out,'tall-header-details.png')});await tall.close();console.log('Tall native header and long exam details verified');
 const page=await browser.newPage({viewport:{width:1440,height:600}});
 const {errors,requests}=await setup(page,workspaceFixtureHtml(12));
 await page.evaluate(()=>{window.nativeActionCount=0;window.courseListAction=()=>window.nativeActionCount++;});
 const grip=await page.locator('[data-pl-action="drag"]').first().boundingBox(),plan=await page.locator('.pl-workspace-plan').boundingBox();
 await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,plan.y+plan.height-12,{steps:8});
 await page.waitForFunction(()=>document.querySelector('.pl-workspace-plan').scrollTop>80);await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.nativeActionCount),0);assert.equal(await page.evaluate(()=>scrollY),0);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await page.close();console.log('Local panel dragging verified');
} finally { await browser.close(); }
