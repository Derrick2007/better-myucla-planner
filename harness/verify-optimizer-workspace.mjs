/** Native Optimizer disclosure compatibility. All data and postbacks are fictional. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { introductionFixtureHtml } from './workspace-fixture.mjs';

const root=resolve(import.meta.dirname,'..');
const output=resolve(root,'../../outputs/optimizer-workspace');
const js=await readFile(resolve(root,'dist/content.js'),'utf8');
const css=await readFile(resolve(root,'dist/injected.css'),'utf8');
const url='https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BETTER_MYUCLA_CHROMIUM||undefined});
try {
  for(const width of [2048,1440,1280,390]) {
    const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',body:introductionFixtureHtml()}):(requests.push(route.request().url()),route.abort()));
    await page.goto(url);
    await page.evaluate(()=>{
      const stored={'plannerLift.layout.v1':{tidy:true},'plannerLift.header.v1':{compact:true}};
      window.chrome={storage:{local:{get:async key=>({[key]:stored[key]}),set:async value=>Object.assign(stored,value),remove:async key=>delete stored[key]},onChanged:{addListener(){},removeListener(){}}}};
      const title=document.getElementById('classOptimizerTitle');
      title.innerHTML='<button type="button" id="ctl00_MainContent_planSectionHelpTipOpPop" class="planSectionHelpTip link">Help</button><button id="ctl00_MainContent_toggleOptimizer" class="planSectionToggle link" onclick="shrink(\'panelOptimizer\'); __doPostBack(\'ctl00$MainContent$toggleOptimizer\',\'\')"><i class="icon-plus-sign"></i><label>Plan Optimizer</label></button>';
      document.getElementById('HelpOptimizerDiv').style.display='none';
      document.getElementById('panelOptimizer').classList.add('hidden');
      window.fixtureOptimizerCalls=0;window.fixtureUnexpectedActions=0;
      window.shrink=()=>{};
      window.__doPostBack=(target,arg)=>{if(target==='ctl00$MainContent$toggleOptimizer'&&arg==='')window.fixtureOptimizerCalls++;else window.fixtureUnexpectedActions++;};
      document.getElementById('aspnetForm').addEventListener('submit',event=>event.preventDefault());
      document.getElementById('panelOptimizer').addEventListener('click',event=>{if(event.target.closest('button,input[type=submit]'))window.fixtureUnexpectedActions++;});
      window.fixtureOptimizerControls=[...document.querySelectorAll('#panelOptimizer input,#panelOptimizer select,#panelOptimizer button')].map(node=>({node,parent:node.parentElement}));
      window.fixtureNativeToggle=document.getElementById('ctl00_MainContent_toggleOptimizer');
      window.fixtureSetOptimizerOpen=open=>{
        document.getElementById('panelOptimizer').classList.toggle('hidden',!open);
        document.querySelector('#ctl00_MainContent_toggleOptimizer i').className=open?'icon-minus-sign':'icon-plus-sign';
      };
    });
    await page.addStyleTag({content:css});await page.addScriptTag({content:js});
    await page.waitForSelector('.pl-workspace-deck');
    assert.equal(await page.evaluate(()=>window.fixtureOptimizerCalls),0,'mount cannot load Optimizer');
    const nav=page.locator('.pl-workspace-nav [data-pl-module="optimizer"]');
    await nav.click();
    assert.equal(await page.evaluate(()=>window.fixtureOptimizerCalls),1,'one explicit navigation opens the native disclosure once');
    assert.ok(await page.locator('.pl-optimizer-state').isVisible(),'loading state explains the pending native response');
    assert.ok(await page.locator('#ctl00_MainContent_toggleOptimizer').isVisible(),'the native heading remains available for manual retry');
    assert.notEqual(await page.locator('#ctl00_MainContent_toggleOptimizer i').evaluate(e=>getComputedStyle(e).display),'none','native disclosure icon is discoverable');
    await nav.click();await nav.press('Enter');
    assert.equal(await page.evaluate(()=>window.fixtureOptimizerCalls),1,'pending load cannot duplicate postbacks');
    await page.evaluate(()=>window.fixtureSetOptimizerOpen(true));
    await page.locator('.pl-optimizer-state').waitFor({state:'hidden'});
    assert.ok(await page.locator('#panelOptimizer').isVisible());
    await nav.click();assert.equal(await page.evaluate(()=>window.fixtureOptimizerCalls),1,'open Optimizer does not reload');
    await page.locator('.pl-workspace-nav [data-pl-module="information"]').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>window.fixtureOptimizerCalls),1,'implicit module restoration never opens native controls');
    await page.screenshot({path:resolve(output,`optimizer-open-${width}.png`)});
    assert.ok(await page.evaluate(()=>window.fixtureOptimizerControls.every(({node,parent})=>node.isConnected&&node.parentElement===parent&&node.form===document.getElementById('aspnetForm'))));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    // Native collapse followed by explicit navigation can load it again.
    await page.evaluate(()=>window.fixtureSetOptimizerOpen(false));
    await page.locator('#panelOptimizer').waitFor({state:'hidden'});
    await nav.click();assert.equal(await page.evaluate(()=>window.fixtureOptimizerCalls),2);
    await page.evaluate(()=>window.fixtureSetOptimizerOpen(true));
    await page.locator('.pl-optimizer-state').waitFor({state:'hidden'});
    await page.locator('.pl-workspace-original').click();
    assert.equal(await page.locator('.pl-optimizer-state').count(),0);
    assert.ok(await page.evaluate(()=>document.getElementById('ctl00_MainContent_toggleOptimizer')===window.fixtureNativeToggle));
    assert.ok(await page.locator('#panelOptimizer').isVisible(),'Original layout keeps the user-opened native state');
    const returnButton=page.locator('.pl-workspace-return');
    if(width<700){
      // Original layout restores this fictional native fixture's fixed 260px
      // sidebar. It has no mobile CSS and overlaps the narrow main column;
      // verify keyboard restoration here without forcing a pointer click or
      // changing the production extension's promise to restore native styles.
      await returnButton.focus();
      assert.ok(await returnButton.evaluate(node=>node===document.activeElement),'Original layout keeps workspace return keyboard reachable');
      await returnButton.press('Enter');
    }else await returnButton.click();
    assert.equal(await page.evaluate(()=>window.fixtureOptimizerCalls),2,'returning to the workspace never loads Optimizer');
    assert.equal(await page.evaluate(()=>window.fixtureUnexpectedActions),0);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log(`Optimizer ${width}px: explicit native expansion, pending deduplication, original controls, no automatic actions and restoration passed`);
    await page.close();
  }
} finally {await browser.close();}
