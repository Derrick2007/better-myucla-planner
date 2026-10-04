/** All page content is fictional. No real account, plan or enrollment action. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { introductionFixtureHtml, emptyPlanFixtureHtml } from './workspace-fixture.mjs';

const root=resolve(import.meta.dirname,'..'),output=resolve(root,'../../outputs/finals-controls');
const js=await readFile(resolve(root,'dist/content.js'),'utf8'),css=await readFile(resolve(root,'dist/injected.css'),'utf8');
const url='https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BETTER_MYUCLA_CHROMIUM||undefined});
try {
  for(const [width,height] of [[1440,900],[1280,900],[960,900],[390,900],[390,600]]) {
    const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',body:introductionFixtureHtml()}):(requests.push(route.request().url()),route.abort()));
    await page.goto(url);
    await page.evaluate(()=>{
      const stored={'plannerLift.layout.v1':{tidy:true},'plannerLift.header.v1':{compact:true}},watchers=[];
      window.chrome={storage:{local:{get:async key=>({[key]:stored[key]}),set:async value=>Object.assign(stored,value),remove:async key=>delete stored[key]},onChanged:{addListener:fn=>watchers.push(fn),removeListener:fn=>{const i=watchers.indexOf(fn);if(i>=0)watchers.splice(i,1);}}}};
      window.fixtureSetTidy=tidy=>watchers.forEach(fn=>fn({'plannerLift.layout.v1':{newValue:{tidy}}},'local'));
      window.fixtureNativeActions=0;
      document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();window.fixtureNativeActions++;});
      document.querySelectorAll('.OrderingButtons button,.plannerTopMenuLinks button').forEach(node=>node.addEventListener('click',()=>window.fixtureNativeActions++));
      window.fixtureCalendar=document.getElementById('ctl00_MainContent_panelGrid');
      window.fixtureCalendarFields=[...fixtureCalendar.querySelectorAll('input,select,button')].map(node=>({node,parent:node.parentElement}));
    });
    await page.addStyleTag({content:css});await page.addScriptTag({content:js});await page.waitForSelector('.pl-workspace-deck');
    const more=page.locator('#planner-lift-toolbar [data-pl-action="menu"]'),menu=page.locator('[data-pl-menu]'),entry=page.locator('[data-pl-action="finals"]');
    assert.equal(await entry.count(),1);assert.equal(await page.locator('#planner-lift-finals-toggle').count(),0);
    const checkHit=async locator=>assert.ok(await locator.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&(node===hit||node.contains(hit));}));
    await more.click();await menu.waitFor({state:'visible'});assert.ok(await menu.evaluate(node=>node.matches(':popover-open')));
    await more.click();assert.equal(await menu.isVisible(),false,'the same More button closes its open menu');await more.click();await menu.waitFor({state:'visible'});
    const box=await menu.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'More menu stays within viewport');
    for(const locator of [entry,menu.locator('a.pl-menu-link'),menu.locator('[data-pl-action="clear-all-annotations"]')]){await locator.scrollIntoViewIfNeeded();await checkHit(locator);}
    await page.screenshot({path:resolve(output,`more-${width}x${height}.png`)});
    await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);assert.ok(await more.evaluate(node=>node===document.activeElement));
    await more.press('Enter');await entry.press('Enter');
    const panel=page.locator('dialog[data-pl-finals]'),close=panel.locator('[data-pl-action="close-finals"]');await panel.waitFor({state:'visible'});
    assert.ok(await panel.evaluate(node=>node.parentElement===document.body&&node.hasAttribute('data-planner-lift-owned')&&node.getAttribute('aria-modal')==='false'));
    assert.ok(await close.evaluate(node=>node===document.activeElement));assert.equal(await entry.getAttribute('aria-expanded'),'true');
    const finals=await panel.boundingBox();assert.ok(finals.width>=Math.min(700,width-40),'finals no longer crammed into master list');
    assert.ok(finals.x>=0&&finals.y>=0&&finals.x+finals.width<=width+1&&finals.y+finals.height<=height+1,'finals stays within viewport');
    assert.ok(await page.locator('.pl-finals-block').count()>0);await checkHit(close);
    assert.ok(await page.evaluate(()=>document.getElementById('ctl00_MainContent_panelGrid')===fixtureCalendar&&fixtureCalendarFields.every(({node,parent})=>node.parentElement===parent&&node.form===document.getElementById('aspnetForm'))));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(width<700){
      const scroller=panel.locator('.pl-finals-scroll');assert.ok(await scroller.evaluate(node=>node.scrollWidth>node.clientWidth));
      await scroller.evaluate(node=>node.scrollLeft=node.scrollWidth);assert.ok(await scroller.evaluate(node=>node.scrollLeft>0));
    }
    await page.screenshot({path:resolve(output,`finals-${width}x${height}.png`)});
    await page.keyboard.press('Escape');assert.equal(await panel.count(),0);assert.ok(await more.evaluate(node=>node===document.activeElement));
    assert.equal(await entry.getAttribute('aria-expanded'),'false');
    await more.click();await entry.click();await close.click();assert.equal(await panel.count(),0);assert.ok(await more.evaluate(node=>node===document.activeElement));
    // Nonmodal outside-click dismissal works even when the small-screen panel
    // overlaps the module navigation. The margin is outside its measured box.
    await more.click();await entry.click();await page.mouse.click(8,8);assert.equal(await panel.count(),0);
    await page.locator('button[data-pl-module="find"]').click();
    assert.equal(await page.locator('button[data-pl-module="find"]').getAttribute('aria-pressed'),'true');
    await page.locator('button[data-pl-module="classes"]').click();await more.click();await entry.click();
    await page.evaluate(()=>window.fixtureSetTidy(false));await panel.waitFor({state:'detached'});assert.equal(await page.locator('.pl-workspace-host').count(),0);
    await page.evaluate(()=>window.fixtureSetTidy(true));await page.waitForSelector('.pl-workspace-deck');
    await more.click();await entry.click();
    await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');document.querySelector('.classPlannerWrapper').replaceWith(document.importNode(doc.querySelector('.classPlannerWrapper'),true));},introductionFixtureHtml());
    await panel.waitFor({state:'detached'});await page.waitForSelector('.pl-workspace-deck');assert.equal(await entry.count(),1);
    await more.click();await entry.click();
    await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');document.querySelector('.classPlannerWrapper').replaceWith(document.importNode(doc.querySelector('.classPlannerWrapper'),true));},emptyPlanFixtureHtml());
    await panel.waitFor({state:'detached'});await page.waitForSelector('.pl-workspace-empty-plan');assert.equal(await entry.count(),0);
    assert.equal(await page.evaluate(()=>window.fixtureNativeActions),0);assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    console.log(`Finals controls ${width}x${height}: one entry, top-layer More, bounded calendar, keyboard/Close/outside dismissal, redraw and tidy cleanup passed`);
    await page.close();
  }
} finally {await browser.close();}
