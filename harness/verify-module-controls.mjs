/** Behavior audit of native module/calendar controls on wholly fictional data.
 * Recorded toolbar/disclosure IDs and handler strings model native structure;
 * server results, popovers, Personal submissions and all text are local doubles.
 * This verifies extension compatibility, not UCLA's backend implementation. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { introductionFixtureHtml } from './workspace-fixture.mjs';

const root=resolve(import.meta.dirname,'..'),output=resolve(root,'../../outputs/module-controls');
const js=await readFile(resolve(root,'dist/content.js'),'utf8'),css=await readFile(resolve(root,'dist/injected.css'),'utf8');
const version=JSON.parse(await readFile(resolve(root,'dist/manifest.json'),'utf8')).version;
const url='https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
const widths=process.env.BETTER_MYUCLA_MODULE_WIDTHS?.split(',').map(Number)||[1440,1280,960,390];
assert.ok(widths.every(width=>Number.isInteger(width)&&width>=320&&width<=3840));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BETTER_MYUCLA_CHROMIUM||undefined});
const reports=[];
try {
 for(const width of widths){
  const height=width===390?600:900,page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',body:introductionFixtureHtml()}):(requests.push(route.request().url()),route.abort()));
  await page.goto(url);
  await page.evaluate(()=>{
   const stored={'plannerLift.layout.v1':{tidy:true},'plannerLift.header.v1':{compact:true}};
   window.chrome={storage:{local:{get:async key=>({[key]:stored[key]}),set:async value=>Object.assign(stored,value),remove:async key=>delete stored[key]},onChanged:{addListener(){},removeListener(){}}}};
   window.fixtureCommands=[];window.fixtureSubmits=[];window.fixtureHelp=[];window.fixtureMeetings=0;
   const menu=document.querySelector('.plannerMenuLinks'),grid=document.getElementById('gridDiv');
   const pairs=[['studylist','sl','studylistChecked','27'],['plan','plan','planChecked','36'],['alternates','alt','alternatesChecked','31']];
   for(const [name,id,state,command] of pairs){
    for(const [suffix,method,sign] of [['Uncheck','addClass','+'],['Check','removeClass','-']]){
     const button=document.getElementById(name+suffix);button.id=id+suffix;button.removeAttribute('type');
     button.setAttribute('onclick',`$('.checkboxStateHolder').${method}('${state}'); triggerPostback('${command}|${sign}'); return false;`);
    }
   }
   menu.insertAdjacentHTML('beforeend',`<span>Grid size: <button id="gridPlus" aria-label="Larger grid" onclick="triggerPostback('16|+'); return false;">+</button><button id="gridMinus" aria-label="Smaller grid" onclick="triggerPostback('16|-'); return false;">−</button></span>
    <span><button id="fixture-grid-help" class="uit-clickover-bottom link" onclick="return false;">Grid View</button>: <span class="icontoggle gridsizeicons"><button id="sgUncheck" aria-label="unchecked Grid View" onclick="$('#gridDiv').addClass('sgChecked'); triggerPostback('41|+'); return false;">☐</button><button id="sgCheck" aria-label="checked Grid View" onclick="$('#gridDiv').removeClass('sgChecked').addClass('saChecked'); triggerPostback('41|-'); return false;">☑</button></span></span>
    <span><button id="fixture-agenda-help" class="uit-clickover-bottom link" onclick="return false;">Agenda View</button>: <span class="icontoggle gridsizeicons"><button id="saUncheck" aria-label="unchecked Agenda View" onclick="$('#gridDiv').addClass('saChecked'); triggerPostback('42|+'); return false;">☐</button><button id="saCheck" aria-label="checked Agenda View" onclick="$('#gridDiv').removeClass('saChecked').addClass('sgChecked'); triggerPostback('42|-'); return false;">☑</button></span></span>`);
   grid.insertAdjacentHTML('beforeend','<div class="fixture-agenda"><h3>Example agenda</h3><button type="button" data-fixture-meeting>Example agenda meeting</button></div>');
   document.querySelectorAll('#gridDiv .planneritembox').forEach(node=>{node.tabIndex=0;node.setAttribute('role','button');node.dataset.fixtureMeeting='';});
   const originalGrid=grid.cloneNode(true);
   window.fixtureGridScale=1;
   const updateCalendar=()=>{
    const current=document.getElementById('gridDiv'),replacement=originalGrid.cloneNode(true);replacement.className=current.className;
    replacement.querySelectorAll('.planneritembox').forEach(node=>{node.style.top=`${parseFloat(node.style.top)*window.fixtureGridScale}px`;node.style.height=`${parseFloat(node.style.height)*window.fixtureGridScale}px`;});
    replacement.querySelector('.fixture-weekbody').style.height=`${540*window.fixtureGridScale}px`;
    current.replaceWith(replacement);
   };
   window.triggerPostback=command=>{window.fixtureCommands.push(command);if(command==='16|+')window.fixtureGridScale+=.2;if(command==='16|-')window.fixtureGridScale-=.2;updateCalendar();};
   window.$=selector=>{const api={addClass:name=>{document.querySelectorAll(selector).forEach(node=>node.classList.add(name));return api;},removeClass:name=>{document.querySelectorAll(selector).forEach(node=>node.classList.remove(name));return api;},toggle:()=>{document.querySelectorAll(selector).forEach(node=>node.style.display=getComputedStyle(node).display==='none'?'block':'none');return api;}};return api;};
   window.shrink=id=>{const node=document.getElementById(id);node.classList.toggle('hidden');const title=node.closest('section')?.querySelector(':scope > .classPlanner_SectionTitle');title?.querySelector('button.planSectionToggle > i')?.setAttribute('class',node.classList.contains('hidden')?'icon-plus-sign':'icon-minus-sign');};
   window.__doPostBack=(target,arg)=>window.fixtureCommands.push(`${target}|${arg}`);
   const modules=[['classOptimizerTitle','panelOptimizer','toggleOptimizer','Plan Optimizer','ctl00_MainContent_planSectionHelpTipOpPop',"$('#HelpOptimizerDiv').toggle(300); return false;"],['plannerSectionEnip','panelNotplan','toggleNotplan','In Study List but Not In Current Plan','slneTip','return false;'],['plannerSectionPer','panelPersonal','togglePersonal','Personal Entries','ctl00_MainContent_helpPersonal','return false;']];
   for(const [titleId,bodyId,toggleId,label,helpId,helpHandler] of modules){
    document.getElementById(titleId).innerHTML=`${bodyId==='panelNotplan'?'<a id="fixture-study-help-link" class="planSectionHelpTip" href="#fictional-study-help">?</a>':''}<button id="${helpId}" class="${bodyId==='panelOptimizer'?'':'uit-clickover-bottom '}planSectionHelpTip link" onclick="${helpHandler}">Help</button><button id="ctl00_MainContent_${toggleId}" class="planSectionToggle link" onclick="shrink('${bodyId}'); __doPostBack('ctl00$MainContent$${toggleId}','')"><i class="${bodyId==='panelOptimizer'?'icon-plus-sign':'icon-minus-sign'}"></i><label>${label}</label></button>`;
   }
   document.getElementById('HelpOptimizerDiv').style.display='none';
   document.getElementById('plannerSectionCal').innerHTML='<button id="ctl00_MainContent_toggleGrid" class="planSectionToggle link" onclick="shrink(\'gridDiv\'); __doPostBack(\'ctl00$MainContent$toggleGrid\',\'\')"><i class="icon-minus-sign"></i><label>Weekly Schedule</label></button>';
   document.getElementById('classSearchTitle').innerHTML='<a href="#fictional-enrollment-link" class="planSectionHelpTip" data-fixture-search-enroll-link>Find a Class and Enroll</a><button id="faceTip" class="uit-clickover-bottom planSectionHelpTip link" onclick="return false;">Help</button><button id="ctl00_MainContent_toggleSearch" class="planSectionToggle link" onclick="shrink(\'panelSearch\'); __doPostBack(\'ctl00$MainContent$toggleSearch\',\'\')"><i class="icon-minus-sign"></i><label>Search for Class and Add to Plan</label></button>';
   document.getElementById('panelPersonal').insertAdjacentHTML('beforeend','<button type="submit" id="fixture-personal-submit" name="fixturePersonalSubmit">Save example personal entry</button>');
   document.getElementById('aspnetForm').addEventListener('submit',event=>{event.preventDefault();window.fixtureSubmits.push(event.submitter?.id||'implicit');if(event.submitter?.id==='fixture-personal-submit')document.querySelector('#panelPersonal output').textContent='Example personal entry submitted';});
   const dialog=document.createElement('dialog');dialog.id='fixture-native-help';dialog.innerHTML='<p>Fictional native help or meeting information</p><button type="button">Close example help</button>';document.body.append(dialog);
   let helpTrigger=null;const closeHelp=()=>{dialog.close();helpTrigger?.focus({preventScroll:true});};dialog.querySelector('button').onclick=closeHelp;dialog.addEventListener('cancel',event=>{event.preventDefault();closeHelp();});
   const showHelp=button=>{helpTrigger=button;window.fixtureHelp.push(button.id||'meeting');dialog.showModal();dialog.querySelector('button').focus();};
   const showClickover=button=>{
    const title=button.closest('.classPlanner_SectionTitle'),prior=title.querySelector(':scope > .popover.clickover');if(prior){prior.remove();button.focus({preventScroll:true});return;}
    const popup=document.createElement('div');popup.className='popover clickover fade bottom in';popup.style.cssText='left:-160px;top:40px;width:376.6px;display:block;';
    popup.innerHTML='<div class="arrow"></div><div class="popover-content">'+('<p>Fictional native planning help. This control stays inside its original module header.</p>').repeat(button.id==='slneTip'?18:1)+'<button type="button" data-fixture-clickover-close>Close example help</button></div>';
    title.append(popup);window.fixtureHelp.push(button.id);popup.querySelector('button').onclick=()=>{popup.remove();button.focus({preventScroll:true});};
   };
   document.addEventListener('click',event=>{const target=event.target.closest?.('button,a,[data-fixture-meeting]');if(!target)return;if(target.matches('[data-fixture-meeting]')){event.preventDefault();window.fixtureMeetings++;showHelp(target);}else if(target.matches('#slneTip,#ctl00_MainContent_helpPersonal,#faceTip')){event.preventDefault();showClickover(target);}else if(target.matches('.uit-clickover-bottom,#fixture-study-help-link,#widgetNeedHelp button,#ctl00_CustomSidePanel a')){event.preventDefault();showHelp(target);}});
   document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches?.('.planneritembox[data-fixture-meeting]')){event.preventDefault();event.target.click();}});
   const style=document.createElement('style');
   style.textContent=`${pairs.map(([name,,state])=>`.checkboxStateHolder.${state} .${name}Uncheck,.checkboxStateHolder:not(.${state}) .${name}Check{display:none}`).join('')} #gridDiv:not(.sgChecked) > :is(.fixture-weekdays,.fixture-weekbody),#gridDiv:not(.saChecked) > .fixture-agenda{display:none} .plannerMenuLinks:has(+ #gridDiv.sgChecked) #sgUncheck,.plannerMenuLinks:has(+ #gridDiv:not(.sgChecked)) #sgCheck,.plannerMenuLinks:has(+ #gridDiv.saChecked) #saUncheck,.plannerMenuLinks:has(+ #gridDiv:not(.saChecked)) #saCheck{display:none} dialog{max-width:min(420px,80vw);border:1px solid #aac;padding:24px} dialog::backdrop{background:#0004} .popover.clickover{position:absolute;z-index:1010;max-width:380px;box-sizing:border-box;background:white;border:1px solid #abb;border-radius:6px;padding:12px;font:14px/1.5 Arial,sans-serif;color:#234}`;
   document.head.append(style);
   window.fixtureControls=[...document.querySelectorAll('.plannerMenuLinks button,#classOptimizerTitle button,#plannerSectionEnip button,#plannerSectionEnip a,#plannerSectionPer button,#classSearchTitle button,#panelOptimizer input,#panelOptimizer select,#panelOptimizer button,#panelNotplan input,#panelNotplan button,#panelPersonal input,#panelPersonal select,#panelPersonal button,#widgetNeedHelp button,#ctl00_CustomSidePanel a')].map(node=>({node,parent:node.parentElement,handler:node.onclick,source:node.getAttribute('onclick'),form:node.form}));
   window.fixtureNativePanelHtml=document.getElementById('ctl00_MainContent_classPlanPanel').outerHTML;
  });
  await page.addStyleTag({content:css});await page.addScriptTag({content:js});await page.waitForSelector('.pl-workspace-deck');
  assert.deepEqual(await page.evaluate(()=>[fixtureCommands,fixtureSubmits,fixtureHelp]),[[],[],[]],'mount invokes no native actions');
  const nav=module=>page.locator(`.pl-workspace-nav [data-pl-module="${module}"]`);
  const closeHelp=async()=>{await page.locator('#fixture-native-help').waitFor({state:'visible'});await page.keyboard.press('Escape');assert.equal(await page.locator('#fixture-native-help').isVisible(),false);};
  const closeClickover=async title=>{
   const popup=page.locator(`${title} > .popover.clickover`);await popup.waitFor({state:'visible'});
   const hits=await popup.evaluate(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,hits:[[r.left+3,r.top+3],[r.right-3,r.top+3],[r.left+r.width/2,r.bottom-3]].map(([x,y])=>node.contains(document.elementFromPoint(x,y)))};});
   assert.ok(hits.left>=0&&hits.right<=width&&hits.top>=0&&hits.bottom<=height&&hits.hits.every(Boolean),`native header clickover is unclipped: ${JSON.stringify(hits)}`);
   if(title==='#plannerSectionEnip')assert.ok(await popup.evaluate(node=>node.scrollHeight>node.clientHeight&&getComputedStyle(node).overflowY==='auto'),'long native help is locally scrollable');
   if([1440,390].includes(width))await page.screenshot({path:resolve(output,`help-${title.slice(1)}-${width}.png`)});
   await popup.locator('[data-fixture-clickover-close]').click();assert.equal(await popup.count(),0);
  };
  const identity=()=>page.evaluate(()=>fixtureControls.every(({node,parent,handler,source,form})=>node.isConnected&&node.parentElement===parent&&node.onclick===handler&&node.getAttribute('onclick')===source&&node.form===form));
  await nav('optimizer').click();assert.ok(await page.locator('#panelOptimizer').isVisible());
  assert.deepEqual(await page.evaluate(()=>fixtureCommands),['ctl00$MainContent$toggleOptimizer|']);
  await page.locator('#ctl00_MainContent_planSectionHelpTipOpPop').click();assert.ok(await page.locator('#HelpOptimizerDiv').isVisible());
  await page.locator('#ctl00_MainContent_planSectionHelpTipOpPop').click();assert.equal(await page.locator('#HelpOptimizerDiv').isVisible(),false);
  await page.locator('[name="exampleOptimizerPriority"]').selectOption('afternoon');
  if(width===390)await page.screenshot({path:resolve(output,'optimizer-short-height-390.png')});
  await page.locator('[name="exampleOptimizerDays"]').check();
  await page.locator('[data-fixture-module-action="optimizer"]').click();assert.equal(await page.locator('#panelOptimizer output').innerText(),'Example optimizer preview ready');
  for(const [module,body,toggle,help] of [['study','panelNotplan','toggleNotplan','slneTip'],['personal','panelPersonal','togglePersonal','ctl00_MainContent_helpPersonal']]){
   await nav(module).click();const control=page.locator(`#ctl00_MainContent_${toggle}`);
   assert.notEqual(await control.locator('i').evaluate(node=>getComputedStyle(node).display),'none',`${module} keeps its native disclosure affordance`);
   await control.click();assert.equal(await page.locator(`#${body}`).isVisible(),false);
   const collapsedCommands=await page.evaluate(()=>fixtureCommands.length);
   await nav('classes').click();await nav(module).click();assert.ok(await page.locator(`#${body}`).isVisible(),`explicit ${module} navigation reopens its closed native disclosure`);
   assert.equal(await page.evaluate(()=>fixtureCommands.length),collapsedCommands+1,'explicit reopen forwards exactly one native disclosure');
   await nav(module).click();await page.evaluate(()=>dispatchEvent(new Event('resize')));
   assert.equal(await page.evaluate(()=>fixtureCommands.length),collapsedCommands+1,'already-open navigation and resize do not submit');
   await page.locator(`#${help}`).click();await closeClickover(module==='study'?'#plannerSectionEnip':'#plannerSectionPer');assert.ok(await page.locator(`#${help}`).evaluate(node=>node===document.activeElement));
   if(module==='study'){await page.locator('#fixture-study-help-link').click();await closeHelp();}
   if(module==='study')await page.locator('[name="exampleStudyEntry"]').check();
   else {await page.locator('[name="examplePersonalEntry"]').fill('Fictional study time');await page.locator('[name="examplePersonalDay"]').selectOption('friday');}
   await page.locator(`[data-fixture-module-action="${module}"]`).click();assert.equal(await page.locator(`#${body} output`).innerText(),`Example ${module} preview ready`);
  }
  const beforePersonalSubmit=await page.evaluate(()=>fixtureSubmits.length);
  await page.locator('#fixture-personal-submit').click();assert.equal(await page.evaluate(()=>fixtureSubmits.length),beforePersonalSubmit+1);assert.equal(await page.evaluate(()=>fixtureSubmits.at(-1)),'fixture-personal-submit');
  await nav('information').click();await page.locator('#widgetNeedHelp button').click();await closeHelp();assert.ok(await nav('information').getAttribute('aria-pressed')==='true');
  await page.locator('#ctl00_CustomSidePanel a').click();await closeHelp();await page.locator('.pl-intro-info-close').click();assert.equal(await nav('personal').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[name="examplePersonalEntry"]').inputValue(),'Fictional study time');
  await nav('study').click();assert.ok(await page.locator('[name="exampleStudyEntry"]').isChecked());
  await nav('optimizer').click();assert.equal(await page.locator('[name="exampleOptimizerPriority"]').inputValue(),'afternoon');
  await nav('find').click();await page.locator('#faceTip').click();await closeClickover('#classSearchTitle');
  if(width<1100)await page.locator('.pl-workspace-schedule-toggle').click();
  if(!await page.locator('#slCheck').isVisible()){
   await page.screenshot({path:resolve(output,`calendar-open-failure-${width}.png`)});
   console.log(await page.evaluate(()=>({calendar:document.querySelector('.pl-workspace-calendar')?.className,host:document.querySelector('.pl-workspace-host')?.dataset,mobile:document.querySelector('[data-pl-mobile-view=schedule]')?.outerHTML,strips:[...document.querySelectorAll('.pl-workspace-group-strip')].map(node=>({hidden:node.hidden,selected:node.querySelector('[aria-selected=true]')?.textContent})),toggle:document.getElementById('slCheck')?.getBoundingClientRect().toJSON()})));
  }
  for(const [name,prefix,state] of [['studylist','sl','studylistChecked'],['plan','plan','planChecked'],['alternates','alt','alternatesChecked']]){
   const initial=await page.locator('.checkboxStateHolder').evaluate((node,state)=>node.classList.contains(state),state);
   await page.locator(`#${prefix}${initial?'Check':'Uncheck'}`).click();
   assert.equal(await page.locator('.checkboxStateHolder').evaluate((node,state)=>node.classList.contains(state),state),!initial);
   const reverse=page.locator(`#${prefix}${initial?'Uncheck':'Check'}`);
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
   if(!await reverse.isVisible()){
    await page.screenshot({path:resolve(output,`calendar-redraw-failure-${width}.png`)});
    const state=await page.locator('.pl-workspace-calendar').evaluate(node=>({classes:node.className,placement:node.dataset.plPanelPlacement,calendar:node.getBoundingClientRect().toJSON(),grid:document.getElementById('gridDiv').className,toolbar:document.querySelector('.checkboxStateHolder').className,active:document.querySelector('[data-pl-mobile-view=schedule]')?.getAttribute('aria-pressed')}));
    assert.fail(`Calendar reverse control hidden after native redraw: ${JSON.stringify(state)}`);
   }
   await reverse.click();
   assert.equal(await page.locator('.checkboxStateHolder').evaluate((node,state)=>node.classList.contains(state),state),initial);
   await page.locator(`#tip-${name}`).click();await closeHelp();
  }
  const firstHeight=await page.locator('#gridDiv .planneritembox').first().evaluate(node=>parseFloat(node.style.height));
  await page.locator('#gridPlus').click();await page.waitForFunction(()=>document.querySelector('#gridDiv .planneritembox')?.hasAttribute('data-pl-grid'));
  assert.ok(await page.locator('#gridDiv .planneritembox').first().evaluate(node=>parseFloat(node.style.height))>firstHeight);
  await page.locator('#gridMinus').click();assert.equal(await page.locator('#gridDiv .planneritembox').first().evaluate(node=>parseFloat(node.style.height)),firstHeight);
  await page.locator('#sgCheck').click();assert.equal(await page.locator('#gridDiv .fixture-weekbody').isVisible(),false);assert.ok(await page.locator('#gridDiv .fixture-agenda').isVisible());
  await page.locator('#sgUncheck').click();assert.ok(await page.locator('#gridDiv .fixture-weekbody').isVisible());
  await page.locator('#saCheck').click();assert.equal(await page.locator('#gridDiv .fixture-agenda').isVisible(),false);assert.ok(await page.locator('#gridDiv .fixture-weekbody').isVisible());
  await page.locator('#saUncheck').click();assert.ok(await page.locator('#gridDiv .fixture-agenda').isVisible());
  for(const id of ['fixture-grid-help','fixture-agenda-help']){await page.locator(`#${id}`).click();await closeHelp();}
  await page.locator('#gridDiv .planneritembox').first().click();await closeHelp();
  await page.locator('#gridDiv .fixture-agenda button').click();await closeHelp();assert.equal(await page.evaluate(()=>fixtureMeetings),2);
  const beforeCollapse=await page.evaluate(()=>fixtureCommands.length);
  await page.locator('#ctl00_MainContent_toggleGrid').click();assert.equal(await page.locator('#ctl00_MainContent_panelGrid').isVisible(),false);
  await page.locator('.pl-workspace-calendar .pl-pane-toggle').click();assert.ok(await page.locator('#ctl00_MainContent_panelGrid').isVisible());
  assert.equal(await page.evaluate(()=>fixtureCommands.length),beforeCollapse,'workspace calendar folding is local presentation');
  assert.ok(await identity(),'native controls retain identity, immediate parent, handler and form across every module action');
  if(width<1100)await page.locator('[data-pl-mobile-view="main"]').click();
  await nav('personal').click();assert.equal(await page.locator('[name="examplePersonalDay"]').inputValue(),'friday');
  await page.screenshot({path:resolve(output,`personal-${width}.png`)});
  await page.locator('.pl-workspace-original').click();assert.ok(await identity());
  const viewStates=await page.locator('#gridDiv').evaluate(node=>['sgChecked','saChecked'].map(name=>node.classList.contains(name)));
  await page.locator('#ctl00_MainContent_toggleGrid').focus();await page.locator('#ctl00_MainContent_toggleGrid').press('Enter');
  assert.equal(await page.evaluate(()=>fixtureCommands.at(-1)),'ctl00$MainContent$toggleGrid|','Original layout restores the original calendar handler');
  const nativeClosedCommands=await page.evaluate(()=>fixtureCommands.length);
  const back=page.locator('.pl-workspace-return');await back.focus();await back.press('Enter');await page.waitForSelector('.pl-workspace-deck');assert.ok(await identity());
  assert.equal(await page.locator('.pl-workspace-calendar .pl-pane-toggle').getAttribute('aria-expanded'),'false','a natively closed calendar returns as closed');
  assert.equal(await page.evaluate(()=>fixtureCommands.length),nativeClosedCommands,'returning to the workspace never invokes a native disclosure');
  if(width<1100)await page.locator('.pl-workspace-schedule-toggle').click();
  else await page.locator('.pl-workspace-calendar .pl-pane-toggle').click();
  assert.ok(await page.locator('#gridDiv').isVisible(),'explicit Expand or mobile Schedule reopens the original calendar');
  assert.equal(await page.evaluate(()=>fixtureCommands.length),nativeClosedCommands+1,'calendar reopen forwards exactly one native disclosure');
  assert.deepEqual(await page.locator('#gridDiv').evaluate(node=>['sgChecked','saChecked'].map(name=>node.classList.contains(name))),viewStates,'opening the calendar preserves native Grid and Agenda selections');
  if(width<1100)await page.locator('[data-pl-mobile-view="main"]').click();
  // Native disclosure BUTTONs omit type/return false, so this local postback
  // double also observes their original submit event. Every such submit must
  // correspond to an explicitly exercised native postback; owned UI never
  // adds another submitter or sends an implicit form submission.
  assert.deepEqual(await page.evaluate(()=>fixtureSubmits.filter(id=>id!=='fixture-personal-submit')),await page.evaluate(()=>fixtureCommands.filter(command=>command.startsWith('ctl00$MainContent$')).map(command=>command.slice(0,-1).replaceAll('$','_'))));
  await nav('study').click();const beforeRedraw=await page.evaluate(()=>fixtureCommands.length);
  await page.evaluate(()=>{const next=document.importNode(new DOMParser().parseFromString(fixtureNativePanelHtml,'text/html').getElementById('ctl00_MainContent_classPlanPanel'),true);document.getElementById('ctl00_MainContent_classPlanPanel').replaceWith(next);});
  await page.waitForSelector('.pl-workspace-main > .classPlanner_EnrolledNotInPlanSection');
  assert.equal(await page.locator('.pl-workspace-deck').count(),1);assert.equal(await nav('study').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>fixtureCommands.length),beforeRedraw,'a native partial redraw never invokes a disclosure or submits');
  await page.locator('[name="exampleStudyEntry"]').check();await page.locator('[data-fixture-module-action="study"]').click();
  assert.equal(await page.locator('#panelNotplan output').innerText(),'Example study preview ready','native replacement controls retain behavior after workspace remount');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const result=await page.evaluate(()=>({controlCount:fixtureControls.length,commands:fixtureCommands,submitters:fixtureSubmits,helpOpens:fixtureHelp.length,meetingOpens:fixtureMeetings}));
  reports.push({width,height,...result,limits:'Local fictional responses only; no real UCLA backend or account mutation tested.'});
  console.log(`Module controls ${width}x${height}: ${result.controlCount} native identities; calendar states/redraw, disclosures, help, module fields/actions, submitter and restoration passed`);
  await page.close();
 }
 await writeFile(resolve(output,'inventory.json'),JSON.stringify({version,contentSha256:createHash('sha256').update(js).digest('hex'),cssSha256:createHash('sha256').update(css).digest('hex'),
  families:[
   {family:'Optimizer',checks:'Exact native expansion, help toggle, select/checkbox state, local action handler; no opening from mount'},
   {family:'Study list',checks:'Native collapse, explicit navigation reopen, title help/link, section selection, original action handler and partial redraw'},
   {family:'Personal entries',checks:'Native collapse/navigation reopen, help, original text/select fields, action handler, real form submitter identity'},
   {family:'Information & help',checks:'Original sidebar button/link handlers, foreground dialog Escape, focus return and previous module restoration; native direct-header clickover edge hit tests, long-help local scrolling and close/focus'},
   {family:'Schedule categories',checks:'Recorded paired native BUTTONs and postback strings for Study List/Plan/Alternates; help controls'},
   {family:'Schedule views',checks:'Recorded Grid+/Grid−/Grid View/Agenda View native handlers, local server redraw, states and meeting interactions'},
   {family:'Workspace/Original layout',checks:'Native identities/parents/handlers/form ownership, local calendar fold, native collapsed calendar remount, explicit Expand/mobile Schedule recovery preserving Grid/Agenda state, original handler restoration'},
  ],
  companionSuites:{planActions:'harness/verify-plan-actions.mjs',finals:'harness/verify-finals-controls.mjs',courseControls:'harness/verify-course-controls.mjs'},
  limits:'Fictional local responses establish extension compatibility; actual provider backend actions and clickover popup geometry require separate authorized live verification.',runs:reports},null,2));
}finally{await browser.close();}
