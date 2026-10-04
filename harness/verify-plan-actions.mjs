/** Native Plan Actions compatibility. Every plan, handler and response is fictional. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { introductionFixtureHtml } from './workspace-fixture.mjs';

const root=resolve(import.meta.dirname,'..'),output=resolve(root,'../../outputs/plan-actions');
const js=await readFile(resolve(root,'dist/content.js'),'utf8'),css=await readFile(resolve(root,'dist/injected.css'),'utf8');
const url='https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BETTER_MYUCLA_CHROMIUM||undefined});
try {
  for(const [width,height] of [[1440,900],[1280,900],[390,900],[390,600]]) {
    const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',body:introductionFixtureHtml()}):(requests.push(route.request().url()),route.abort()));
    await page.goto(url);
    await page.evaluate(()=>{
      const stored={'plannerLift.layout.v1':{tidy:true},'plannerLift.header.v1':{compact:true}};
      window.chrome={storage:{local:{get:async key=>({[key]:stored[key]}),set:async value=>Object.assign(stored,value),remove:async key=>delete stored[key]},onChanged:{addListener(){},removeListener(){}}}};
      const host=document.querySelector('.classPlannerWrapper'),menu=host.querySelector('.plannerTopMenuLinks');
      const handlers={renamePlan:'showSave(false); return false;',newPlanMenuEntry:"triggerPostback('2'); return false;",savePlanAsMenuEntry:'showSave(true); return false;',deletePlanMenuEntry:"confirm('Are you sure you want to delete this plan?') && triggerPostback('10'); return false;",loadMenuEntry:'$(".mobileloadmenupanel").toggle(); return false;',printPlanMenuEntry:'window.print && window.print(); return false;',aboutMenuEntry:'showAbout(); return false;'};
      const labels=['Rename Plan','New Plan','Save a Copy','Delete Plan','Load Plan','Print','About'];
      [...menu.children].forEach((button,index)=>{button.removeAttribute('type');button.setAttribute('onclick',handlers[button.id]);button.textContent=labels[index];});
      host.insertAdjacentHTML('beforeend',`<div class="mobileloadmenupanel touchpanelmenu noprint" style="display:none"><div class="message"><ul>${Array.from({length:16},(_,index)=>`<li><button type="button" onclick="triggerPostback('example-load-${index}'); $('.mobileloadmenupanel').hide(); return false;">Example saved plan ${index+1}</button></li>`).join('')}</ul></div></div>
        <div id="AboutDragger" class="message info" style="display:none"><header><button class="link" onclick="$('#AboutDragger').hide(); $('#aboutMenuEntry').focus(); return false;">Close</button><h2>About Class Planner</h2></header><div>${'<p>Example native planning instructions. All content in this fixture is fictional.</p>'.repeat(24)}</div></div>
        <div id="SaveDragger" class="message info" style="display:none"><header><button class="link" onclick="$('#SaveDragger').hide(); return false;">Close</button><h2>Save Plan</h2></header><div class="row xsmall-collapse"><label for="planNameBox">Plan name</label><input id="planNameBox"><textarea aria-label="Example description"></textarea></div><div class="row xsmall-collapse"><input type="hidden"></div><div class="row xsmall-collapse"><input type="submit" id="ctl00_MainContent_SaveButton" value="Save" onclick="gatherClientSaveValues();"></div></div>
        <div id="ResponseMessageDragger" style="position:absolute;z-index:1000;display:none"><table><tbody><tr><td>Example native response<button class="link" onclick="$('#ResponseMessageDragger').hide(); return false;">Close</button></td></tr></tbody></table></div>`);
      window.fixturePosts=[];window.fixtureSaveModes=[];window.fixtureSaves=0;window.fixturePrints=0;window.fixtureConfirm=false;window.fixtureSubmits=0;
      window.triggerPostback=command=>window.fixturePosts.push(command);
      window.confirm=()=>window.fixtureConfirm;
      window.$=selector=>({hide:()=>document.querySelectorAll(selector).forEach(node=>node.style.display='none'),toggle:()=>document.querySelectorAll(selector).forEach(node=>node.style.display=getComputedStyle(node).display==='none'?'block':'none'),focus:()=>document.querySelector(selector)?.focus()});
      window.showSave=copy=>{window.fixtureSaveModes.push(copy);document.getElementById('SaveDragger').style.display='block';};
      window.showAbout=()=>document.getElementById('AboutDragger').style.display='block';
      window.gatherClientSaveValues=()=>window.fixtureSaves++;
      window.print=()=>{window.fixturePrints++;dispatchEvent(new Event('beforeprint'));dispatchEvent(new Event('afterprint'));};
      document.getElementById('aspnetForm').addEventListener('submit',event=>{event.preventDefault();window.fixtureSubmits++;});
      window.fixtureNativeActions=[...menu.querySelectorAll('button')].map(node=>({node,parent:node.parentElement,handler:node.onclick,source:node.getAttribute('onclick')}));
      window.fixtureNativePanels=[...host.querySelectorAll(':scope > .mobileloadmenupanel,:scope > #AboutDragger,:scope > #SaveDragger,:scope > #ResponseMessageDragger')].map(node=>({node,parent:node.parentElement,controls:[...node.querySelectorAll('input,textarea,button')].map(control=>({control,parent:control.parentElement,handler:control.onclick}))}));
    });
    await page.addStyleTag({content:css});await page.addScriptTag({content:js});await page.waitForSelector('.pl-workspace-deck');
    assert.deepEqual(await page.evaluate(()=>[fixturePosts,fixtureSaveModes,fixtureSaves,fixturePrints,fixtureSubmits]),[[],[],0,0,0],'mount must not activate native actions');
    const extras=page.locator('.pl-workspace-plan-actions'),summary=extras.locator(':scope > summary');
    const openMenu=async()=>{if(!await extras.evaluate(node=>node.open))await summary.click();};
    const shell=await page.locator('.pl-workspace-shell').boundingBox();
    const checkSurface=async selector=>{
      const panel=page.locator(selector);await panel.waitFor({state:'visible'});
      const bounds=await panel.boundingBox(),currentShell=await page.locator('.pl-workspace-shell').boundingBox();
      assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,`${selector} stays in viewport at${width}x${height}: ${JSON.stringify(bounds)}`);
      assert.ok(Math.abs(shell.height-currentShell.height)<2,`${selector} must not steal workspace height`);
      assert.ok(await panel.evaluate(node=>getComputedStyle(node).position==='absolute'));
    };
    await openMenu();
    for(const [id,copy] of [['renamePlan',false],['savePlanAsMenuEntry',true]]){
      await page.locator(`#${id}`).click();await checkSurface('#SaveDragger');
      assert.equal(await page.evaluate(()=>fixtureSaveModes.at(-1)),copy);
      await page.locator('#planNameBox').fill('Example plan title');
      if(copy){
        await page.locator('#ctl00_MainContent_SaveButton').click();assert.equal(await page.evaluate(()=>fixtureSaves),1);assert.equal(await page.evaluate(()=>fixtureSubmits),1);
        await page.evaluate(()=>document.getElementById('ResponseMessageDragger').style.display='block');
        await checkSurface('#ResponseMessageDragger');await page.locator('#ResponseMessageDragger button').focus();await page.keyboard.press('Escape');
        assert.equal(await page.locator('#ResponseMessageDragger').isVisible(),false);assert.ok(await page.locator('#SaveDragger').isVisible());
        assert.ok(await page.locator('#SaveDragger').evaluate(node=>node.contains(document.activeElement)),'response closes before Save and returns focus inside Save');
        await page.keyboard.press('Escape');
      }else await page.locator('#SaveDragger > header button').click();
      assert.equal(await page.locator('#SaveDragger').isVisible(),false);
      assert.ok(await page.locator(`#${id}`).evaluate(node=>node===document.activeElement),'native dialog close returns to visible trigger');
      assert.ok(await extras.evaluate(node=>node.open));
    }
    await page.locator('#newPlanMenuEntry').click();assert.deepEqual(await page.evaluate(()=>fixturePosts),['2']);
    await page.locator('#deletePlanMenuEntry').click();assert.deepEqual(await page.evaluate(()=>fixturePosts),['2'],'native confirmation cancellation is preserved');
    await page.evaluate(()=>window.fixtureConfirm=true);await page.locator('#deletePlanMenuEntry').click();assert.deepEqual(await page.evaluate(()=>fixturePosts),['2','10']);
    await page.locator('#loadMenuEntry').click();await checkSurface('.mobileloadmenupanel');
    assert.ok(await page.locator('.pl-plan-action-load-close').isVisible());await page.locator('.pl-plan-action-load-close').click();
    assert.equal(await page.locator('.mobileloadmenupanel').isVisible(),false);assert.ok(await page.locator('#loadMenuEntry').evaluate(node=>node===document.activeElement));
    await page.locator('#loadMenuEntry').click();await page.locator('.mobileloadmenupanel li button').last().click();
    assert.deepEqual(await page.evaluate(()=>fixturePosts),['2','10','example-load-15']);assert.equal(await page.locator('.mobileloadmenupanel').isVisible(),false);
    await page.locator('#printPlanMenuEntry').click();assert.equal(await page.evaluate(()=>fixturePrints),1);
    await page.locator('#aboutMenuEntry').click();await checkSurface('#AboutDragger');
    await page.screenshot({path:resolve(output,`about-${width}x${height}.png`)});
    await page.locator('#AboutDragger > header button').click();assert.ok(await page.locator('#aboutMenuEntry').evaluate(node=>node===document.activeElement));
    await page.keyboard.press('Escape');assert.equal(await extras.evaluate(node=>node.open),false);
    await openMenu();await page.locator('#aboutMenuEntry').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#aboutMenuEntry').evaluate(node=>{const rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return node===hit||node.contains(hit);}), 'last dropdown action is reachable at short heights');
    await page.screenshot({path:resolve(output,`menu-${width}x${height}.png`)});
    assert.ok(await page.evaluate(()=>fixtureNativeActions.every(({node,parent,handler,source})=>node.isConnected&&node.parentElement===parent&&node.onclick===handler&&node.getAttribute('onclick')===source&&node.form===document.getElementById('aspnetForm'))));
    assert.ok(await page.evaluate(()=>fixtureNativePanels.every(({node,parent,controls})=>node.parentElement===parent&&controls.every(({control,parent,handler})=>control.isConnected&&control.parentElement===parent&&control.onclick===handler&&control.form===document.getElementById('aspnetForm')))));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    // Menu-only native redraws use anonymous DIVs. Reconcile must retain the new
    // node, and Original layout must not delete it with the disclosure wrapper.
    await page.evaluate(()=>{const menu=document.querySelector('.plannerTopMenuLinks');window.fixtureReplacement=menu.cloneNode(true);menu.replaceWith(fixtureReplacement);});
    await page.waitForFunction(()=>document.querySelector('.pl-workspace-plan-actions > .plannerTopMenuLinks')===window.fixtureReplacement);
    await page.keyboard.press('Escape');await page.locator('.pl-workspace-original').click();
    assert.ok(await page.evaluate(()=>fixtureReplacement.parentElement===document.querySelector('.classPlannerWrapper')));
    assert.ok(await page.evaluate(()=>fixtureNativePanels.every(({node,parent})=>node.parentElement===parent&&!node.classList.contains('pl-plan-action-surface')&&!node.style.getPropertyValue('--pl-plan-action-width'))));
    assert.equal(await page.locator('.pl-plan-action-load-close').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log(`Plan Actions ${width}x${height}: all seven native actions, dialogs, safe dismissal, short-height access, original identity and menu redraw passed`);
    await page.close();
  }
} finally {await browser.close();}
