/** Production extension QA on fictional HTML, with every network request intercepted. */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { workspaceFixtureHtml, introductionFixtureHtml, futureQuarterFixtureHtml } from './workspace-fixture.mjs';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'../../outputs/planner-workspace-v0.16.0');
const workspaceWidths=process.env.BETTER_MYUCLA_QA_WIDTHS?.split(',').map(Number)||[1920,1440,1536,1280,1200,960,390];
assert.ok(workspaceWidths.length&&workspaceWidths.every(width=>Number.isInteger(width)&&width>=320&&width<=3840),'QA widths must be bounded whole pixels');
const url='https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx',fixture=workspaceFixtureHtml(6,true);
const js=await readFile(resolve(root,'dist/content.js'),'utf8'),css=await readFile(resolve(root,'dist/injected.css'),'utf8');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BETTER_MYUCLA_CHROMIUM||undefined});
const setup=async(page,html,compactHeader=false,ready='.pl-workspace-deck')=>{
 const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url()===url ? route.fulfill({status:200,contentType:'text/html',body:html}) : (requests.push(route.request().url()),route.abort()));
 await page.goto(url);
 await page.evaluate(compactHeader=>{
  const listeners=[];
  const stored={'plannerLift.layout.v1':{tidy:true},'plannerLift.header.v1':{compact:compactHeader}};
  window.fixturePreferences=stored;
  window.chrome={storage:{local:{get:async key=>({[key]:stored[key]}),set:async values=>Object.assign(stored,values),remove:async key=>delete stored[key]},onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}}};
  window.toggleTidy=tidy=>listeners.forEach(fn=>fn({'plannerLift.layout.v1':{newValue:{tidy}}},'local'));
  window.nativeFields=[...document.querySelectorAll('input,select')];
  window.nativeCommands=[...document.querySelectorAll('.OrderingButtons button')].map(node=>({node,parent:node.parentElement,command:node.getAttribute('onclick'),visible:!!node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'}));
  window.nativeCommandClicks=0;document.addEventListener('click',event=>{if(event.target.closest?.('.OrderingButtons button'))window.nativeCommandClicks++;},true);
  window.nativeResultControls=[...document.querySelectorAll('.ClassSearchList button,.ClassSearchList input,.ClassSearchList select,.ClassSearchList a')].map(node=>({node,parent:node.parentElement}));
  window.nativeResultHeadings=[...document.querySelectorAll('.ClassSearchList .header-row > div')].map(node=>({node,html:node.innerHTML}));
  window.nativeDetails=document.querySelector('tbody.courseItem > tr:nth-child(3)');window.nativeDetailsParent=window.nativeDetails?.parentElement;
  window.nativeNavigation=document.getElementById('fixture-native-navigation');window.nativeNavigationHtml=window.nativeNavigation.outerHTML;
  window.nativeTerm=document.getElementById('ctl00_MainContent_termSessionChooser_TermChooser');window.nativeTermParent=window.nativeTerm.parentElement;
  window.nativeSidebar=document.querySelector('right-sidebar');window.nativeSidebarParent=window.nativeSidebar?.parentElement;
  window.nativeIntroduction=document.getElementById('page_title_text');window.nativeIntroductionHtml=window.nativeIntroduction?.innerHTML;
  window.nativeWorkspaceTop=document.querySelector('.classPlannerWrapper')?.getBoundingClientRect().top;
  window.nativeStatuses=[...document.querySelectorAll('table.coursetable td:nth-child(3),.ClassSearchList .data_row > .span3')].map(node=>({node,html:node.innerHTML}));
  window.nativeResultClickCount=0;document.querySelectorAll('.ClassSearchList .class-title a').forEach(node=>node.addEventListener('click',()=>window.nativeResultClickCount++));
 },compactHeader);
 await page.addStyleTag({content:css});await page.addScriptTag({content:js});await page.waitForSelector(ready);
 return {errors,requests};
};
const verifyResultHeadings=async(page)=>{
 const result=await page.locator('.pl-browser-body-active').evaluate(body=>{
  const preview=body.closest('.pl-browser-list'),heading=body.querySelector('.pl-section-result-heading'),row=body.querySelector('.pl-section-card');
  const visible=node=>!!node&&!!node.getClientRects().length&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';
  const width=preview.clientWidth,wide=width>=640;
  const alignment=[0,1,2,3,4,5,7].map(field=>{
   const head=heading?.querySelector(`[data-pl-field="${field}"]`),cell=row?.querySelector(`[data-pl-field="${field}"]`);
   const h=head?.getBoundingClientRect(),c=cell?.getBoundingClientRect();
   return {field,visible:visible(head),left:h&&c?Math.abs(h.left-c.left):null,right:h&&c?Math.abs(h.right-c.right):null};
  });
  const labels=[1,4,5,7].map(field=>{
   const label=row?.querySelector(`[data-pl-field="${field}"] > .pl-section-label`),style=label&&getComputedStyle(label),rect=label?.getBoundingClientRect();
   return {field,exists:!!label,accessible:!!label&&style.display!=='none'&&style.visibility!=='hidden'&&label.getAttribute('aria-hidden')!=='true',compact:!!rect&&rect.width<=2&&rect.height<=2,visible:visible(label),height:rect?.height};
  });
  const help=[...heading?.querySelectorAll('button,a,input,select')||[]].map(node=>({visible:visible(node),focusable:node.tabIndex>=0&&!node.disabled,field:node.parentElement?.getAttribute('data-pl-field'),height:node.getBoundingClientRect().height}));
  return {width,wide,heading:!!heading,headerFields:heading?.children.length,alignment,labels,help};
 });
 assert.ok(result.heading&&result.headerFields===9,'the validated native result header retains all nine indexed cells');
 assert.ok(result.help.length>=3&&result.help.every(control=>control.visible&&control.focusable&&control.height>1),'all native header help remains accessible, including Instructor when rooms are hidden');
 assert.ok(result.labels.every(label=>label.exists&&label.accessible),'per-row labels remain available to assistive technology');
 if(result.wide){
  assert.ok(result.alignment.every(field=>field.visible&&field.left<=1&&field.right<=1),`shared headings line up with their section fields: ${JSON.stringify(result)}`);
  assert.ok(result.labels.every(label=>label.compact),`wide results hide repeated visual labels: ${JSON.stringify(result.labels)}`);
  const list=page.locator('.pl-browser-list'),priorScroll=await list.evaluate(node=>node.scrollTop);
  await list.evaluate(node=>{node.scrollTop=node.scrollHeight;});
  const sticky=await page.locator('.pl-browser-body-active .pl-section-result-heading').evaluate(node=>{const bounds=node.getBoundingClientRect(),preview=node.closest('.pl-browser-list').getBoundingClientRect();return {position:getComputedStyle(node).position,top:bounds.top,bottom:bounds.bottom,previewTop:preview.top,previewBottom:preview.bottom};});
  assert.ok(sticky.position==='sticky'&&sticky.top>=sticky.previewTop-1&&sticky.bottom<=sticky.previewBottom+1,`shared headings remain available while preview rows scroll: ${JSON.stringify(sticky)}`);
  await list.evaluate((node,top)=>{node.scrollTop=top;},priorScroll);
 }else{
  assert.ok(result.alignment.filter(field=>[0,1,3,4,5].includes(field.field)).every(field=>!field.visible),'narrow results retain only native header help controls');
  assert.ok(result.labels.every(label=>label.visible&&label.height>2),'narrow section cards keep their individual visible labels');
 }
};
try {
 for(const width of [1440,960]){
  const preview=await browser.newPage({viewport:{width,height:900}}),checks=await setup(preview,introductionFixtureHtml(),true);
  await preview.waitForFunction(()=>document.getElementById('titleText').getBoundingClientRect().top<=13);
  await preview.screenshot({path:resolve(out,`compact-plan-${width}.png`)});
  await preview.locator('.pl-workspace-task-switches [data-pl-task-view="find"]').click();
  await preview.screenshot({path:resolve(out,`compact-find-${width}.png`)});
  assert.deepEqual(checks.errors,[]);assert.deepEqual(checks.requests,[]);await preview.close();
 }
 for(const width of workspaceWidths){
  const height=width===1536?735:900,page=await browser.newPage({viewport:{width,height},hasTouch:width===390});
  const {errors,requests}=await setup(page,fixture);
  assert.equal(await page.locator('.pl-workspace-deck > section').count(),3);
  assert.equal(await page.locator('.pl-workspace-deck > section:visible').count(),2,'Plan starts with classes and schedule');
  const planTask=page.locator('.pl-workspace-task-switches [data-pl-task-view="plan"]');
  const findTask=page.locator('.pl-workspace-task-switches [data-pl-task-view="find"]');
  assert.equal(await planTask.innerText(),'Plan');assert.equal(await findTask.innerText(),'Find classes');
  assert.equal(await planTask.getAttribute('aria-pressed'),'true');assert.equal(await findTask.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('.pl-browse-expand').count(),0,'task navigation replaces Browse expansion');
  assert.equal(await page.locator('.pl-workspace-splitter').count(),1);
  assert.ok(await page.locator('.pl-workspace-extras .pl-workspace-pane-switches').count());
  assert.equal(await page.locator('.pl-workspace-pane-switches button').count(),2,'Tools reopens only the two Plan panes');
  assert.equal(await page.locator('form').count(),1);assert.equal(await page.locator('[data-pl-workspace-details]').count(),6);
  assert.equal(await page.locator('[data-pl-status-badge], [data-pl-section-status], [data-pl-status-original]').count(),0);
  const nativePreserved=()=>page.evaluate(()=>window.nativeFields.every(node=>node.isConnected&&node.form===document.getElementById('aspnetForm'))&&window.nativeCommands.every(({node,parent,command})=>node.isConnected&&node.parentElement===parent&&node.getAttribute('onclick')===command)&&window.nativeResultControls.every(({node,parent})=>node.isConnected&&node.parentElement===parent)&&window.nativeResultHeadings.every(({node,html})=>node.innerHTML===html)&&window.nativeStatuses.every(({node,html})=>node.innerHTML===html)&&window.nativeNavigation.outerHTML===window.nativeNavigationHtml);
  assert.ok(await nativePreserved());
  const detailsOrder=await page.locator('[data-pl-workspace-details]').evaluateAll(buttons=>buttons.map(button=>{
   const host=button.parentElement,controls=[...host.querySelectorAll('button,a[href],input,select,[tabindex]')].filter(node=>node.tabIndex>=0&&!node.disabled&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'&&getComputedStyle(node).display!=='none');
   return {nativeHost:host.matches('td.linkPanelRight'),firstChild:host.firstElementChild===button,firstFocusable:controls[0]===button,height:button.getBoundingClientRect().height};
  }));
  assert.ok(detailsOrder.every(result=>result.nativeHost&&result.firstChild&&result.firstFocusable&&result.height>=38),`Details is the first reachable, comfortably sized action in each native control host: ${JSON.stringify(detailsOrder)}`);
  const firstActions=page.locator('.pl-workspace-actions-button').first(),firstCard=page.locator('tbody.courseItem').first();
  assert.equal(await page.locator('.pl-workspace-actions-button').count(),6);
  assert.equal(await firstActions.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('td.linkPanelRight .OrderingButtons:visible,td.linkPanelRight .pl-real-tools:visible').count(),0,'secondary class controls start behind the named disclosure');
  const firstDetails=page.locator('[data-pl-workspace-details]').first();await firstDetails.focus();await firstDetails.press('Tab');
  assert.ok(await firstActions.evaluate(node=>node===document.activeElement),'Tab proceeds from Details to Class actions');
  await page.keyboard.press('Shift+Tab');assert.ok(await firstDetails.evaluate(node=>node===document.activeElement),'keyboard order matches the visible Details-first layout');
  if(width===390)await firstActions.tap();else await firstActions.press('Enter');
  assert.equal(await firstActions.getAttribute('aria-expanded'),'true');
  assert.ok((await firstActions.boundingBox()).height>=38,'Class actions is a comfortable touch target');
  assert.ok(await firstCard.locator('.OrderingButtons').isVisible());assert.ok(await firstCard.locator('.pl-real-tools').isVisible());
  assert.ok(await firstCard.locator('[data-pl-position]').isVisible());assert.ok(await firstCard.locator('[data-pl-action="drag"]').isVisible());
  assert.ok(await page.evaluate(()=>window.nativeCommands.filter(command=>command.visible&&command.node.closest('tbody.courseItem')===document.querySelector('tbody.courseItem')).every(({node})=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'&&getComputedStyle(node).display!=='none')),'the disclosure restores the unchanged native ordering buttons');
  const more=firstCard.locator('.pl-course-more');await more.click();
  assert.ok(await firstCard.locator('[data-pl-action="tag"]').isVisible());assert.ok(await firstCard.locator('[data-pl-action="top"]').isVisible());
  await page.keyboard.press('Escape');assert.equal(await firstActions.getAttribute('aria-expanded'),'true','first Escape closes the nested More menu only');
  assert.ok(await more.evaluate(node=>node===document.activeElement));
  await page.keyboard.press('Escape');assert.equal(await firstActions.getAttribute('aria-expanded'),'false');assert.ok(await firstActions.evaluate(node=>node===document.activeElement));
  await firstActions.click();await more.click();await firstCard.locator('[data-pl-action="tag"]').click();
  const note=firstCard.locator('[data-pl-tag]');await note.fill('Fictional note');await firstActions.click();
  assert.equal(await firstActions.getAttribute('aria-expanded'),'false','saving a note on blur does not swallow the close action');await firstActions.click();
  assert.ok(await note.isVisible());assert.equal(await note.inputValue(),'Fictional note','closing Class actions preserves the note editor and text');
  await note.fill('');await firstActions.click();assert.equal(await firstActions.getAttribute('aria-expanded'),'false','clearing a note does not swallow the close action');
  await firstActions.click();const toolsSummary=page.locator('.pl-workspace-extras > summary');await toolsSummary.click();
  await page.keyboard.press('Escape');assert.equal(await page.locator('.pl-workspace-extras').evaluate(node=>node.open),false,'Escape dismisses the foreground Tools menu first');
  assert.equal(await firstActions.getAttribute('aria-expanded'),'true','dismissing Tools preserves background class actions');assert.ok(await toolsSummary.evaluate(node=>node===document.activeElement));
  await page.keyboard.press('Escape');assert.equal(await firstActions.getAttribute('aria-expanded'),'false');assert.ok(await firstActions.evaluate(node=>node===document.activeElement));
  assert.ok(await nativePreserved());assert.equal(await page.evaluate(()=>window.nativeCommandClicks),0);
  assert.ok(await page.locator('.pl-workspace-host > .plannerTopMenuLinks').isVisible());
  assert.ok(await page.locator('#ctl00_MainContent_termSessionChooser').isVisible());
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1),`page overflow ${width}`);
  const planBoxes=await page.locator('.pl-workspace-deck > section:visible').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
  if(width>=900){
   assert.ok(planBoxes[0].right<=planBoxes[1].left,'desktop Plan keeps its list beside the schedule');
   assert.ok(planBoxes[1].width>=420,'schedule retains comparison space');
  }else assert.ok(planBoxes[0].bottom<=planBoxes[1].top,'narrow Plan stacks readable panes');
  if(width===1440||width===960||width===390)await page.screenshot({path:resolve(out,`plan-${width}.png`)});
  await firstActions.click();const lastActions=page.locator('.pl-workspace-actions-button').last();await lastActions.scrollIntoViewIfNeeded();
  const rootBeforeActions=await page.evaluate(()=>scrollY);if(width===390)await lastActions.tap();else await lastActions.press('Enter');
  assert.equal(await firstActions.getAttribute('aria-expanded'),'false','only one class action group is open at a time');
  const actionReachability=await lastActions.evaluate(button=>{
   const host=button.parentElement,targets=[button,...host.querySelectorAll('.OrderingButtons button,[data-pl-action="drag"],[data-pl-position],.pl-course-more')].filter(node=>getComputedStyle(node).visibility!=='hidden');
   return targets.map(node=>{const rect=node.getBoundingClientRect();let top=0,bottom=innerHeight;for(let parent=node.parentElement;parent&&parent!==document.body;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll|hidden|clip/.test(style.overflowY)){const box=parent.getBoundingClientRect();top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}}return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,clipTop:top,clipBottom:bottom,width:innerWidth};});
  });
  assert.ok(actionReachability.every(bounds=>bounds.top>=bounds.clipTop-1&&bounds.bottom<=bounds.clipBottom+1&&bounds.left>=0&&bounds.right<=bounds.width),`last class actions remain reachable inside their scroll container: ${JSON.stringify(actionReachability)}`);
  assert.equal(await page.evaluate(()=>scrollY),rootBeforeActions,'opening Class actions keeps document scroll unchanged');
  if(width===1440||width===390)await page.screenshot({path:resolve(out,`class-actions-${width}.png`)});
  await page.keyboard.press('Escape');assert.equal(await lastActions.getAttribute('aria-expanded'),'false');assert.ok(await lastActions.evaluate(node=>node===document.activeElement));
  await firstDetails.scrollIntoViewIfNeeded();
  if(width>=900){
   const bottomDetails=page.locator('[data-pl-workspace-details]').last();await bottomDetails.scrollIntoViewIfNeeded();
   const rootBeforeDetails=await page.evaluate(()=>scrollY);await bottomDetails.click();
   const close=page.getByRole('button',{name:'Close details',exact:true}),closeBounds=await close.boundingBox(),paneBounds=await page.locator('.pl-workspace-plan').boundingBox();
   assert.ok(closeBounds.y>=paneBounds.y&&closeBounds.y+closeBounds.height<=paneBounds.y+paneBounds.height,`opening the last visible class reveals its focused Close control: ${JSON.stringify({width,closeBounds,paneBounds})}`);
   assert.equal(await page.evaluate(()=>scrollY),rootBeforeDetails,'inline Details reveals itself without scrolling the document');
   await page.keyboard.press('Escape');assert.ok(await bottomDetails.evaluate(node=>node===document.activeElement));
   await page.locator('[data-pl-workspace-details]').first().scrollIntoViewIfNeeded();
  }
  await firstActions.click();await findTask.click();
  assert.equal(await firstActions.getAttribute('aria-expanded'),'false','Find closes class actions before hiding Plan');
  assert.equal(await findTask.getAttribute('aria-pressed'),'true');assert.equal(await planTask.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('.pl-workspace-deck > section:visible').count(),1,'Find classes uses the available workspace');
  assert.ok(await page.locator('.pl-workspace-search').isVisible());
  assert.equal(await page.locator('.pl-browser-index button').count(),3);
  assert.equal(await page.locator('.pl-browser-list > .pl-browser-body:visible').count(),1);
  await page.locator('.pl-browser-index button').nth(2).click();
  assert.equal(await page.locator('#CourseListEntry_M2').evaluate(node=>node.classList.contains('pl-browser-active')),true);
  assert.equal(await page.evaluate(()=>window.nativeResultClickCount),0,'preview selection must not send native requests');
  assert.ok(await page.locator('#container_course_M2').isVisible(),'loaded hidden course must preview locally');
  assert.ok(await page.locator('.pl-browser-list').evaluate(node=>node.scrollWidth<=node.clientWidth+1),'result cards fit the browser pane');
  assert.ok(await page.locator('.ClassSearchWidget.pl-browser-results').evaluate(node=>node.getBoundingClientRect().width<=1281),'Find keeps result reading width bounded on large screens');
  assert.ok(await page.locator('.pl-browser-body-active .pl-section-card').first().evaluate(node=>[1,2,4,5].every(field=>parseFloat(getComputedStyle(node.querySelector(`[data-pl-field="${field}"]`)).fontSize)>=14)),'primary result values use readable text size');
  assert.equal(await page.locator('.pl-browser-body-active .data_row > .span7').first().isVisible(),false);
  await verifyResultHeadings(page);
  await page.locator('.pl-browser-toolbar button').getByText('Rooms & instructors',{exact:true}).click();
  assert.equal(await page.locator('.pl-browser-body-active .data_row > .span7').first().isVisible(),true);
  for(const field of [6,8])assert.ok(await page.locator(`.pl-browser-body-active .data_row [data-pl-field="${field}"] > .pl-section-label`).first().evaluate(node=>node.getBoundingClientRect().height>2&&getComputedStyle(node).display!=='none'),'expanded optional fields keep their visible labels');
  await page.locator('.pl-browser-toolbar button').getByText('Rooms & instructors',{exact:true}).click();
  await page.locator('.pl-browser-toolbar button').getByText('Edit search',{exact:true}).click();
  assert.ok(await page.locator('input#searchTier0').isVisible());
  await page.locator('.pl-browser-toolbar button').getByText('Hide search fields',{exact:true}).click();
  assert.ok(await nativePreserved());
  assert.ok(await page.locator('.pl-browser-body-active .header-Status').isVisible(),'native header help remains accessible');
  assert.ok(await page.locator('#fixture-result-footer button').isVisible(),'global native result actions remain accessible');
  if(width>=960){
   const indexBox=await page.locator('.pl-browser-index').boundingBox(),previewBox=await page.locator('.pl-browser-list').boundingBox();
   assert.ok(indexBox.x+indexBox.width<=previewBox.x,'Find presents the course list beside its preview');
   assert.ok(previewBox.width>=360,'preview retains readable space');
  }
  assert.ok(await page.locator('.pl-browser-preview-title').isVisible());
  assert.equal(await page.locator('.pl-browser-preview-title').innerText(),await page.locator('.pl-browser-index button[aria-pressed="true"]').innerText());
  const localFilter=page.getByRole('searchbox',{name:'Filter courses',exact:true});
  await localFilter.fill('Example course B');await localFilter.press('Enter');
  assert.equal(await page.locator('.pl-browser-index button:visible').count(),1);
  assert.equal(await page.locator('#container_course_M1').isVisible(),true);
  await localFilter.fill('');await page.locator('.pl-browser-index button').first().press('End');
  assert.equal(await page.locator('.pl-browser-index button').last().getAttribute('aria-pressed'),'true');
  assert.ok(await page.locator('.pl-browser-list').evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Find previews do not overflow');
  assert.ok(await nativePreserved());
  if(width===1440||width===960||width===390)await page.screenshot({path:resolve(out,`find-classes-${width}.png`)});
  const fictionalSelection=page.locator('#container_course_M2 .data_row input').first();
  await fictionalSelection.check();await page.locator('.pl-browser-index button').first().click();
  assert.ok(await page.locator('.pl-browser-selections').isVisible(),'hidden checked sections have a visible reminder');
  assert.equal(await fictionalSelection.evaluate(n=>n.checked),true);
  await page.locator('.pl-browser-selections > summary').click();
  if(width===1440)await page.screenshot({path:resolve(out,'selection-reminder.png')});
  await page.locator('.pl-browser-selection-actions button').click();
  assert.ok(await fictionalSelection.isVisible());assert.equal(await fictionalSelection.evaluate(n=>n.checked),true);
  assert.ok(await fictionalSelection.evaluate(n=>n===document.activeElement));
  await fictionalSelection.uncheck();assert.equal(await page.locator('.pl-browser-selections').isVisible(),false);
  if(width===1440){
   for(const toolsOpen of [false,true]){
   await page.locator('.pl-workspace-extras').evaluate((node,open)=>{node.open=open;},toolsOpen);
   // Media emulation does not fire the native print lifecycle by itself.
   await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));
   await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('.pl-workspace-deck > section:visible').count(),3,'printing restores panes hidden by either task');
   assert.equal(await page.locator('.pl-workspace-extra-content > section:visible').count(),3,`printing includes the three native sections when Tools is ${toolsOpen?'open':'closed'}`);
   assert.equal(await page.locator('.pl-browser-body:visible').count(),3,'printing includes every loaded course');
   assert.ok(await page.locator('.pl-browser-body .data_row > .span7').first().isVisible(),'print includes rooms without opening the extra-fields toggle');
   assert.ok(await page.locator('.pl-browser-body .data_row > .span9').first().isVisible(),'print includes instructors');
   assert.ok(await page.locator('.pl-browser-list').evaluate(node=>getComputedStyle(node).maxHeight==='none'&&getComputedStyle(node).overflow==='visible'),'print does not clip result rows');
   assert.equal(await page.locator('.pl-workspace-task-switches').isVisible(),false);
   assert.equal(await page.locator('.pl-workspace-actions-button:visible').count(),0,'print omits the owned Class actions disclosures');
   assert.equal(await page.locator('td.linkPanelRight .OrderingButtons:visible').count(),6,'print retains native ordering controls even when Class actions is folded');
   await page.emulateMedia({media:'screen'});
   await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
   assert.equal(await page.locator('.pl-workspace-extras').evaluate(node=>node.open),toolsOpen,'printing restores the prior Tools disclosure choice');
   }
   await page.locator('.pl-workspace-extras > summary').click();
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.pl-workspace-deck > section:visible').count(),2);
  assert.equal(await planTask.getAttribute('aria-pressed'),'true');
  assert.ok(await findTask.evaluate(node=>node===document.activeElement),'Escape returns to Plan with a route back to Find');
  if(width>=900){
   const nav=await page.locator('#fixture-native-navigation').boundingBox(),host=await page.locator('.pl-workspace-host').boundingBox();
   assert.ok(host.y>=nav.y+nav.height,'UCLA navigation remains unobscured');
   const boxes=await page.locator('.pl-workspace-deck > section:visible').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
   assert.ok(boxes.every(box=>box.bottom<=height&&box.width>=200),JSON.stringify(boxes));
   assert.ok(boxes[0].right<=boxes[1].left);
   assert.ok(boxes[1].width>=420,'schedule needs room');
   const sep=page.getByRole('separator',{name:'Resize classes pane'}),before=(await page.locator('.pl-workspace-plan').boundingBox()).width;
   await sep.press('ArrowRight');assert.ok((await page.locator('.pl-workspace-plan').boundingBox()).width>before);
   const handle=await sep.boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+100);await page.mouse.down();await page.mouse.move(handle.x+60,handle.y+100,{steps:8});await page.mouse.up();
   assert.ok((await page.locator('.pl-workspace-plan').boundingBox()).width>before+40,'pointer resizing');
   await sep.dblclick();
   const switches=page.locator('.pl-workspace-pane-switches button'),scheduleBefore=(await page.locator('.pl-workspace-calendar').boundingBox()).width;
   await page.locator('#plannerSectionClip > button.planSectionToggle').click();
   assert.equal(await page.locator('.pl-workspace-plan').isVisible(),false);
   assert.ok((await page.locator('.pl-workspace-calendar').boundingBox()).width>scheduleBefore);
   assert.equal(await switches.nth(0).evaluate(node=>document.activeElement===node),true);await switches.nth(0).press('Enter');
   for(let i=0;i<2;i++)await switches.nth(i).click();assert.ok(await page.locator('.pl-workspace-empty').isVisible());
   for(let i=0;i<2;i++)await switches.nth(i).press('Space');
   assert.equal(await page.locator('.pl-workspace-deck > section:visible').count(),2);
   await page.keyboard.press('Escape');
   await page.locator('tbody.courseItem').last().scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>scrollY),0);await page.locator('tbody.courseItem').first().scrollIntoViewIfNeeded();
  } else {
   const boxes=await page.locator('.pl-workspace-deck > section:visible').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
   assert.ok(boxes[0].bottom<=boxes[1].top,'narrow layout stacks readable panes');
  }
  const calendar=await page.locator('#gridDiv .planneritembox').evaluateAll(nodes=>nodes.map(node=>({overflow:node.getBoundingClientRect().right-node.parentElement.getBoundingClientRect().right,height:node.getBoundingClientRect().height,intended:parseFloat(node.style.height)+(node.style.border.includes('double')?6:2)})));
  assert.ok(calendar.every(box=>box.overflow<=1&&Math.abs(box.height-box.intended)<1),`native calendar sizing ${width}`);
  if(width>=900){
   const calendarText=await page.locator('#gridDiv .planneritembox[data-pl-grid="tidy"]').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect(),bottom=box.bottom-parseFloat(getComputedStyle(node).borderBottomWidth),lines=[...node.querySelectorAll('.pl-gridline')];return {lines:lines.length,overflow:Math.max(...lines.map(line=>line.getBoundingClientRect().bottom-bottom))};}));
   assert.ok(calendarText.length&&calendarText.every(box=>box.lines===3&&box.overflow<=1),`all three calendar text lines fit without changing native box geometry: ${JSON.stringify(calendarText)}`);
  }
  const details=page.locator('[data-pl-workspace-details]').first();await details.click();
  assert.equal(await details.getAttribute('aria-expanded'),'true','Details exposes its expanded state');
  assert.ok(await page.locator('.pl-workspace-preview').isVisible());
  assert.ok(await page.locator('.pl-workspace-preview-card.pl-preview-inline').count(),'Details remains inside its class at every width');
  assert.ok(await page.locator('.pl-workspace-calendar').isVisible(),'Schedule stays visible while inspecting a class');
  assert.equal(await page.locator('.pl-workspace-detail-backdrop').count(),0);
  assert.ok(await page.evaluate(()=>window.nativeDetails.parentElement===window.nativeDetailsParent));
  assert.ok(await nativePreserved());
  const detailRow=page.locator('tbody.pl-workspace-preview-card > tr:nth-child(3)');
  assert.ok(await detailRow.isVisible());
  const rect=await detailRow.boundingBox();assert.ok(rect.width>200&&rect.x>=0&&rect.x+rect.width<=width+1,`details fit ${width}: ${JSON.stringify(rect)}`);
  const classPane=await page.locator('.pl-workspace-plan').boundingBox();
  assert.ok(rect.x>=classPane.x&&rect.x+rect.width<=classPane.x+classPane.width,'Details fits inside My classes');
  if(width>=900){
   await page.locator('.pl-workspace-extras > summary').click();await page.locator('.pl-workspace-pane-switches button').nth(1).click();
   assert.ok(await page.locator('.pl-workspace-preview').isVisible(),'schedule controls remain usable while inspecting');
   await page.locator('.pl-workspace-pane-switches button').nth(1).click();
   await page.locator('.pl-workspace-extras > summary').click();
   if(width===1440)await page.screenshot({path:resolve(out,'class-details.png')});
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('.pl-workspace-preview').isVisible(),false);
  assert.equal(await details.getAttribute('aria-expanded'),'false');
  assert.equal(await details.evaluate(node=>document.activeElement===node),true);
  await details.click();const close=page.getByRole('button',{name:'Close details',exact:true}),closeBox=await close.boundingBox();
  assert.ok(closeBox.width>=44&&closeBox.height>=44);await close.click();assert.equal(await details.evaluate(node=>document.activeElement===node),true);
  await details.click();await findTask.click();
  assert.equal(await page.locator('.pl-workspace-preview').isVisible(),false,'Find must close Details before hiding its native class row');
  assert.ok(await page.locator('.pl-browser-list').isVisible(),'results remain available after switching from Details');
  assert.ok(await nativePreserved());await planTask.click();
  await page.locator('.pl-workspace-extras > summary').click();assert.equal(await page.locator('.pl-workspace-section-links button').count(),3);
  await page.locator('.pl-workspace-section-links button').getByText('Personal Entries',{exact:true}).click();
  const fold=page.locator('#plannerSectionPer > .pl-pane-toggle');await fold.click();assert.equal(await page.locator('input[name="examplePersonalEntry"]').isVisible(),false);
  await page.locator('.pl-workspace-section-links button').getByText('Personal Entries',{exact:true}).click();assert.equal(await page.locator('input[name="examplePersonalEntry"]').isVisible(),true);
  await page.keyboard.press('Escape');await page.locator('.pl-workspace-extras > summary').click();await page.locator('.pl-workspace-original').click();
  assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(),6);
  assert.equal(await page.locator('.pl-browser-index').count(),0);assert.ok(await nativePreserved());
  await page.locator('.pl-workspace-return').click();await page.waitForSelector('.pl-workspace-deck');
  await page.locator('.pl-workspace-task-switches [data-pl-task-view="find"]').click();
  await page.evaluate(html=>{
   const next=document.importNode(new DOMParser().parseFromString(html,'text/html').getElementById('ctl00_MainContent_classPlanPanel'),true);
   window.redrawFields=[...next.querySelectorAll('input,select')];document.getElementById('ctl00_MainContent_classPlanPanel').replaceWith(next);
  },fixture);
  await page.waitForSelector('.pl-workspace-deck .pl-browser-index',{state:'attached'});
  assert.equal(await page.locator('.pl-workspace-task-switches [data-pl-task-view="find"]').getAttribute('aria-pressed'),'true','native redraw preserves the active task');
  assert.equal(await page.locator('.pl-workspace-deck > section:visible').count(),1);
  assert.ok(await page.locator('.pl-browser-list').isVisible());
  assert.equal(await page.locator('.pl-workspace-deck').count(),1);assert.equal(await page.locator('#panelPlan').count(),1);assert.equal(await page.locator('input[name="examplePersonalEntry"]').count(),1);
  await page.evaluate(()=>window.toggleTidy(false));await page.waitForSelector('.pl-workspace-deck',{state:'detached'});
  assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(),6);assert.equal(await page.locator('[data-pl-workspace-details],.pl-section-label,.pl-browser-index').count(),0);
  assert.ok(await page.evaluate(()=>window.redrawFields.every(node=>node.isConnected&&node.form===document.getElementById('aspnetForm'))));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await page.close();console.log(`Workspace verified: ${width}px`);
 }
 if(process.env.BETTER_MYUCLA_QA_FOCUS!=='workspace'){
 for(const width of [1440,960,390]){
  const single=await browser.newPage({viewport:{width,height:900}});
  const singleChecks=await setup(single,fixture);
  await single.locator('.pl-workspace-task-switches [data-pl-task-view="find"]').click();
  await single.evaluate(()=>{for(const index of [1,2]){document.getElementById(`CourseListEntry_M${index}`).remove();document.getElementById(`container_course_M${index}`).remove();}});
  await single.waitForFunction(()=>document.querySelectorAll('.pl-browser-index button').length===1);
  assert.equal(await single.locator('.pl-browser-index').isVisible(),false,'a single course does not need an index or filter');
  assert.ok(await single.locator('.pl-browser-preview-title').isVisible());
  await verifyResultHeadings(single);
  const list=single.locator('.pl-browser-list');assert.ok((await list.boundingBox()).height>100);
  assert.ok(await single.locator('.ClassSearchWidget.pl-browser-results').evaluate(node=>node.getBoundingClientRect().width<=1081),'single-course results retain a readable maximum width');
  assert.ok(await list.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  assert.ok(await list.evaluate(n=>{const parent=n.parentElement,style=getComputedStyle(parent);return n.getBoundingClientRect().width>=parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-1;}),'single preview fills the parent content width');
  if(width===1440)await single.screenshot({path:resolve(out,'single-course-browse.png')});
  assert.deepEqual(singleChecks.errors,[]);assert.deepEqual(singleChecks.requests,[]);
  await single.close();console.log(`Single-course presentation verified: ${width}px`);
 }
 const tall=await browser.newPage({viewport:{width:2048,height:927}});
 const tallChecks=await setup(tall,workspaceFixtureHtml(6,true,true));
 // BODY must not scroll independently of the document, even if native code
 // constrains its height and a sidebar extends below it.
 await tall.evaluate(()=>{
  document.documentElement.style.overflowY='auto';
  document.body.style.height='827px';
  const extra=document.createElement('aside');extra.id='fixture-native-long-sidebar';
  extra.style.cssText='height:1200px;width:1px';document.body.append(extra);
  document.body.style.overflow='hidden';
  document.body.scrollTop=848;
 });
 assert.ok(await tall.evaluate(()=>document.body.scrollTop>0),'fixture must reproduce the old hidden-overflow scroll bug');
 await tall.evaluate(()=>{document.body.style.removeProperty('overflow');document.body.scrollTop=848;});
 assert.equal(await tall.evaluate(()=>document.body.scrollTop),0,'native focus/postback cannot scroll BODY behind the workspace');
 const navRect=await tall.locator('#fixture-native-navigation').boundingBox(),hostRect=await tall.locator('.pl-workspace-host').boundingBox();
 assert.ok(navRect.y>=0&&hostRect.y>=navRect.y+navRect.height,'UCLA navigation remains visible after attempted body scroll');
 const nativeMenu=await tall.locator('.plannerTopMenuLinks').boundingBox();
 await tall.locator('[data-pl-workspace-details]').first().click();
 const assertTallDetails=async()=>{
  const row=await tall.locator('tbody.pl-workspace-preview-card > tr:nth-child(3)').boundingBox();
  const pane=await tall.locator('.pl-workspace-plan').boundingBox();
  assert.ok(row.height>=60&&row.x>=pane.x&&row.x+row.width<=pane.x+pane.width,`inline inspector fits narrow class pane: ${JSON.stringify(row)}`);
  assert.ok(await tall.locator('.pl-workspace-calendar').isVisible());
  assert.ok(await tall.locator('tbody.pl-workspace-preview-card.pl-preview-inline').count());
 };
 await assertTallDetails();await tall.locator('.pl-workspace-preview-head summary').click();await assertTallDetails();
 const afterMenu=await tall.locator('.plannerTopMenuLinks').boundingBox();assert.deepEqual(afterMenu,nativeMenu,'native plan menus stay put');
 assert.deepEqual(tallChecks.errors,[]);assert.deepEqual(tallChecks.requests,[]);
 await tall.screenshot({path:resolve(out,'tall-header-details.png')});await tall.close();console.log('Tall native header and long exam details verified');
 for (const width of [2048,1440,1280,960,390]) {
  const height=927,page=await browser.newPage({viewport:{width,height}});
  const {errors,requests}=await setup(page,introductionFixtureHtml());
  assert.equal(await page.locator('.pl-intro-about').evaluate(e=>e.open),false);
  assert.equal(await page.locator('.pl-intro-notice:visible').count(),2,'term notices remain visible');
  assert.ok(await page.evaluate(()=>window.nativeTerm.parentElement===window.nativeTermParent&&window.nativeSidebar.parentElement===window.nativeSidebarParent));
  assert.ok(await page.evaluate(()=>window.nativeNavigation.outerHTML===window.nativeNavigationHtml&&window.nativeIntroduction.innerHTML===window.nativeIntroductionHtml));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`introduction overflow ${width}`);
  if (width>=900) {
   const before=await page.locator('.pl-workspace-host').boundingBox();
   assert.ok(await page.evaluate(y=>y<window.nativeWorkspaceTop-60,before.y),'introduction gives the planner more room');
   await page.screenshot({path:resolve(out,`compact-introduction-${width}.png`)});
   const headerToggle=page.locator('.pl-intro-header-toggle');
   assert.equal(await headerToggle.innerText(),'Compact header');
   await headerToggle.click();
   await page.waitForFunction(()=>document.querySelector('.pl-intro-header-toggle').textContent==='Show header');
   const compactTitle=await page.locator('#titleText').boundingBox();
   const compactTerm=await page.locator('#ctl00_MainContent_termSessionChooser_TermChooser').boundingBox();
   const compactNav=await page.locator('#fixture-native-navigation').boundingBox();
   assert.ok(compactTitle.y>=11&&compactTitle.y<=13&&compactTerm.y>=11,'compact action retains title and term');
   assert.ok(compactNav.y+compactNav.height<=12,'compact action scrolls the entire original banner away');
   assert.ok((await page.locator('.pl-workspace-host').boundingBox()).height>before.height,'compact action gives planner more space');
   assert.ok(await page.evaluate(()=>window.nativeNavigation.outerHTML===window.nativeNavigationHtml));
   assert.ok(await headerToggle.evaluate(e=>e===document.activeElement));
   await page.screenshot({path:resolve(out,`header-compacted-${width}.png`)});
   await headerToggle.press('Enter');await page.waitForFunction(()=>scrollY===0);
   assert.equal(await headerToggle.innerText(),'Compact header');
   assert.equal((await page.locator('#fixture-native-navigation').boundingBox()).y,0,'show action restores access to the original menu');
   await page.mouse.move(20,40);await page.mouse.wheel(0,240);
   await page.waitForFunction(()=>scrollY>100);
   await page.waitForFunction(()=>document.querySelector('.pl-workspace-host').getBoundingClientRect().bottom<=innerHeight);
   await page.mouse.wheel(0,800);
   await page.waitForFunction(()=>Math.abs(document.querySelector('.pl-workspace-host').getBoundingClientRect().top-12)<1);
   const after=await page.locator('.pl-workspace-host').boundingBox(),nav=await page.locator('#fixture-native-navigation').boundingBox();
   assert.ok(nav.y<0,'native UCLA header scrolls away through ordinary page scrolling');
   assert.ok(after.y>=11&&after.y<before.y&&after.height>before.height,'planner expands as the header scrolls away');
   assert.equal(await page.evaluate(()=>document.body.scrollTop),0);
   await page.locator('[data-pl-workspace-details]').first().click();
   const row=await page.locator('tbody.pl-workspace-preview-card > tr:nth-child(3)').boundingBox(),pane=await page.locator('.pl-workspace-plan').boundingBox();
   assert.ok(row.x>=pane.x&&row.x+row.width<=pane.x+pane.width,'inline Details remains within Classes after page scrolling');
   await page.keyboard.press('Escape');
   const scrollBefore=await page.evaluate(()=>scrollY);
   await page.evaluate(html=>{const next=document.importNode(new DOMParser().parseFromString(html,'text/html').getElementById('ctl00_MainContent_classPlanPanel'),true);document.getElementById('ctl00_MainContent_classPlanPanel').replaceWith(next);},introductionFixtureHtml());
   await page.waitForSelector('.pl-workspace-deck .pl-browser-index',{state:'attached'});
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scrollBefore)<=1,'native redraw preserves intentional document scrolling');
   assert.ok(Math.abs((await page.locator('.pl-workspace-host').boundingBox()).y-12)<=1);
   await page.screenshot({path:resolve(out,`scrolled-workspace-${width}.png`)});
   await page.mouse.move(8,40);await page.mouse.wheel(0,-1000);await page.waitForFunction(()=>scrollY===0);
   assert.equal((await page.locator('#fixture-native-navigation').boundingBox()).y,0,'scrolling back reveals unchanged navigation');
  }
  await page.locator('.pl-intro-about > summary').click();assert.ok(await page.locator('#page_title_text').isVisible());
  await page.locator('.pl-intro-about > summary').click();
  await page.locator('.pl-intro-info').click();assert.ok(await page.locator('right-sidebar').isVisible());
  assert.equal(await page.locator('right-sidebar > :not([data-planner-lift-owned])').count(),4);
  const sidebar=await page.locator('right-sidebar').boundingBox();assert.ok(sidebar.y>=0&&sidebar.y+sidebar.height<=height);
  await page.keyboard.press('Escape');assert.equal(await page.locator('right-sidebar').isVisible(),false);
  assert.ok(await page.locator('.pl-intro-info').evaluate(e=>e===document.activeElement));
  await page.locator('.pl-intro-info').click();await page.locator('.pl-intro-info-close').click();
  assert.equal(await page.locator('right-sidebar').isVisible(),false);
  await page.evaluate(()=>window.toggleTidy(false));await page.waitForSelector('.pl-workspace-deck',{state:'detached'});
  assert.equal(await page.locator('.pl-intro-about,.pl-intro-info,.pl-intro-term-label,.pl-intro-header-toggle').count(),0);
  assert.ok(await page.evaluate(()=>window.nativeTerm.parentElement===window.nativeTermParent&&window.nativeSidebar.parentElement===window.nativeSidebarParent&&window.nativeNavigation.outerHTML===window.nativeNavigationHtml));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await page.close();console.log(`Compact introduction and root scrolling verified: ${width}px`);
 }
 // Header preference must survive the real controller's lifecycle, including
 // native quarter redraws and a new page, not merely a single click/scroll.
 const persistent=await browser.newPage({viewport:{width:1440,height:927}});
 const firstCheck=await setup(persistent,introductionFixtureHtml());
 await persistent.locator('.pl-intro-header-toggle').click();
 await persistent.waitForFunction(()=>window.fixturePreferences['plannerLift.header.v1'].compact===true);
 await persistent.evaluate(()=>window.scrollTo(0,0));
 await persistent.waitForFunction(()=>document.getElementById('titleText').getBoundingClientRect().top<=13);
 await persistent.evaluate(html=>{
  window.fixtureTermChanges=0;
  const select=document.getElementById('ctl00_MainContent_termSessionChooser_TermChooser');
  select.append(new Option('Example winter','27W'));
  select.addEventListener('change',()=>{
   window.fixtureTermChanges++;
   const replacement=document.importNode(new DOMParser().parseFromString(html,'text/html').getElementById('layoutContentArea'),true);
   const nextSelect=replacement.querySelector('select');nextSelect.append(new Option('Example winter','27W',true,true));
   document.getElementById('layoutContentArea').replaceWith(replacement);window.scrollTo(0,0);
  });
 },introductionFixtureHtml());
 await persistent.locator('#ctl00_MainContent_termSessionChooser_TermChooser').selectOption('27W');
 await persistent.waitForFunction(()=>document.querySelector('.pl-intro-header-toggle')?.textContent==='Show header'&&document.getElementById('titleText').getBoundingClientRect().top<=13);
 assert.equal(await persistent.evaluate(()=>window.fixtureTermChanges),1,'original quarter change handler still runs');
 assert.ok(await persistent.evaluate(()=>window.nativeNavigation.outerHTML===window.nativeNavigationHtml));
 const saved=await persistent.evaluate(()=>window.fixturePreferences['plannerLift.header.v1'].compact);
 const reloadCheck=await setup(persistent,introductionFixtureHtml(),saved);
 await persistent.waitForFunction(()=>document.getElementById('titleText').getBoundingClientRect().top<=13);
 assert.equal(await persistent.locator('.pl-intro-header-toggle').innerText(),'Show header','fresh controller restores saved preference');
 const otherTab=await browser.newPage();await otherTab.bringToFront();
 await persistent.evaluate(()=>window.scrollTo(0,0));await persistent.bringToFront();
 await persistent.waitForFunction(()=>document.getElementById('titleText').getBoundingClientRect().top<=13);
 await otherTab.close();
 await persistent.screenshot({path:resolve(out,'persistent-header.png')});
 await persistent.locator('#fixture-native-navigation button').focus();
 await persistent.waitForFunction(()=>window.fixturePreferences['plannerLift.header.v1'].compact===false);
 assert.equal(await persistent.evaluate(()=>scrollY),0,'keyboard focus restores access to the native menu');
 assert.equal(await persistent.locator('.pl-intro-header-toggle').innerText(),'Compact header');
 await persistent.locator('.pl-intro-header-toggle').click();
 await persistent.waitForFunction(()=>window.fixturePreferences['plannerLift.header.v1'].compact===true);
 await persistent.locator('.pl-intro-header-toggle').click();
 await persistent.waitForFunction(()=>window.fixturePreferences['plannerLift.header.v1'].compact===false);
 const shownCheck=await setup(persistent,introductionFixtureHtml(),false);
 assert.equal(await persistent.evaluate(()=>scrollY),0,'Show header persists across a new page');
 assert.ok(await persistent.evaluate(()=>window.nativeNavigation.outerHTML===window.nativeNavigationHtml));
 for(const check of [firstCheck,reloadCheck,shownCheck]){assert.deepEqual(check.errors,[]);assert.deepEqual(check.requests,[]);}
 await persistent.close();console.log('Header preference verified across native quarter redraw, page reload and browser tab changes');
 const future=await browser.newPage({viewport:{width:1440,height:927}});
 const futureCheck=await setup(future,futureQuarterFixtureHtml(),true,'.pl-intro-toolbar');
 await future.waitForFunction(()=>document.getElementById('titleText').getBoundingClientRect().top<=13);
 assert.equal(await future.locator('.pl-intro-header-toggle').innerText(),'Show header');
 assert.equal(await future.locator('[data-pl-action], [data-pl-workspace-details], .pl-workspace-deck').count(),0,'future quarter must not enable course actions');
 assert.ok(await future.locator('#fixture-future-plan button').isVisible());
 assert.ok(await future.evaluate(()=>window.nativeTerm.parentElement===window.nativeTermParent&&window.nativeNavigation.outerHTML===window.nativeNavigationHtml));
 await future.locator('.pl-intro-header-toggle').click();
 await future.waitForFunction(()=>window.fixturePreferences['plannerLift.header.v1'].compact===false);
 assert.equal(await future.evaluate(()=>scrollY),0);
 await future.locator('.pl-intro-header-toggle').click();
 await future.waitForFunction(()=>window.fixturePreferences['plannerLift.header.v1'].compact===true);
 // A native redraw from an uneditable quarter must restart normal tools only
 // after the unchanged reorder contract passes again.
 await future.evaluate(html=>{
  const replacement=document.importNode(new DOMParser().parseFromString(html,'text/html').getElementById('layoutContentArea'),true);
  document.getElementById('layoutContentArea').replaceWith(replacement);window.scrollTo(0,0);
 },introductionFixtureHtml());
 await future.waitForSelector('.pl-workspace-deck');
 await future.waitForFunction(()=>document.getElementById('titleText').getBoundingClientRect().top<=13);
 assert.equal(await future.locator('.pl-intro-toolbar').count(),0);
 assert.equal(await future.locator('.pl-intro-header-toggle').count(),1);
 assert.equal(await future.locator('[data-pl-workspace-details]').count(),6);
 // And the populated controller must keep presentation on a future redraw.
 await future.evaluate(html=>{
  const replacement=document.importNode(new DOMParser().parseFromString(html,'text/html').getElementById('layoutContentArea'),true);
  document.getElementById('layoutContentArea').replaceWith(replacement);window.scrollTo(0,0);
 },futureQuarterFixtureHtml());
 await future.waitForSelector('.pl-intro-toolbar');
 await future.waitForFunction(()=>document.getElementById('titleText').getBoundingClientRect().top<=13);
 assert.equal(await future.locator('.pl-intro-header-toggle').count(),1);
 assert.equal(await future.locator('.pl-workspace-deck').count(),0);
 await future.evaluate(()=>window.toggleTidy(false));
 await future.waitForFunction(()=>!document.querySelector('.pl-intro-header-toggle'));
 assert.equal(await future.locator('html.pl-intro-page').count(),0);
 assert.ok(await future.locator('right-sidebar').isVisible());
 assert.ok(await future.evaluate(()=>window.nativeNavigation.outerHTML===window.nativeNavigationHtml));
 assert.deepEqual(futureCheck.errors,[]);assert.deepEqual(futureCheck.requests,[]);
 await future.close();console.log('Empty/future quarter header verified with unchanged fail-closed course controls');
 const page=await browser.newPage({viewport:{width:1440,height:600}});
 const {errors,requests}=await setup(page,workspaceFixtureHtml(12));
 await page.evaluate(()=>{window.nativeActionCount=0;window.courseListAction=()=>window.nativeActionCount++;});
 await page.locator('.pl-workspace-actions-button').first().click();
 const grip=await page.locator('[data-pl-action="drag"]').first().boundingBox(),plan=await page.locator('.pl-workspace-plan').boundingBox();
 await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,plan.y+plan.height-12,{steps:8});
 await page.waitForFunction(()=>document.querySelector('.pl-workspace-plan').scrollTop>80);await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.nativeActionCount),0);assert.equal(await page.evaluate(()=>scrollY),0);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await page.close();console.log('Local panel dragging verified');
 }
} finally { await browser.close(); }
