/** Test the production bundle on fictional data, without accessing MyUCLA. */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { workspaceFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '../../outputs/planner-workspace-v0.13.0');
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
const fixture = workspaceFixtureHtml(6, true);
const js = await readFile(resolve(root, 'dist/content.js'), 'utf8');
const css = await readFile(resolve(root, 'dist/injected.css'), 'utf8');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
try {
  for (const width of [1920, 1440, 1536, 1280, 1200, 960, 390]) {
    const height = width === 1536 ? 735 : 900;
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [], extraRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (route.request().url() === url) return route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
      extraRequests.push(route.request().url()); return route.abort();
    });
    await page.goto(url);
    await page.evaluate(() => {
      const listeners = [];
      window.chrome = { storage: { local: {
        get: async key => key === 'plannerLift.layout.v1' ? { [key]: { tidy: true } } : {},
        set: async () => {}, remove: async () => {}
      }, onChanged: { addListener: fn => listeners.push(fn), removeListener: () => {} } } };
      window.toggleTidy = tidy => listeners.forEach(fn => fn({ 'plannerLift.layout.v1': { newValue: { tidy } } }, 'local'));
      window.nativeFields = [...document.querySelectorAll('input,select')];
      window.nativeCommands = [...document.querySelectorAll('.OrderingButtons button')].map(node => ({ node, command: node.getAttribute('onclick') }));
      window.nativeDetails = document.querySelector('tbody.courseItem > tr:nth-child(3)');
      window.nativeDetailsParent = window.nativeDetails.parentElement;
      window.nativeNavigation = document.getElementById('fixture-native-navigation');
      window.nativeNavigationHtml = window.nativeNavigation.outerHTML;
      window.nativeStatusCells = [...document.querySelectorAll('table.coursetable td:nth-child(3)')].map(node=>({node,html:node.innerHTML}));
    });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.waitForSelector('.pl-workspace-deck');
    assert.equal(await page.locator('.pl-workspace-deck > section').count(), 3);
    assert.equal(await page.locator('form').count(), 1);
    assert.equal(await page.locator('[data-pl-workspace-details]').count(), 6);
    assert.equal(await page.locator('[data-pl-status-badge], [data-pl-section-status], [data-pl-status-original]').count(),0);
    assert.ok(await page.evaluate(()=>window.nativeStatusCells.every(({node,html})=>node.isConnected && node.innerHTML===html)));
    assert.ok(await page.evaluate(()=>window.nativeNavigation.outerHTML===window.nativeNavigationHtml));
    assert.ok(await page.locator('.pl-workspace-host > .plannerTopMenuLinks').isVisible());
    assert.ok(await page.locator('#ctl00_MainContent_termSessionChooser').isVisible());
    assert.ok(await page.locator('.pl-workspace-plan .pl-course-title').evaluateAll(nodes => nodes.every(n => getComputedStyle(n).display === 'none')), 'full titles should be reserved for Details');
    assert.ok(await page.evaluate(() => window.nativeFields.every(node => node.isConnected && node.form === document.getElementById('aspnetForm'))));
    assert.ok(await page.evaluate(() => window.nativeCommands.every(({node,command}) => node.isConnected && node.getAttribute('onclick') === command)));
    assert.ok(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1), `horizontal page overflow at ${width}`);
    if (width <= 1200) {
      const boxes = await page.locator('.pl-workspace-deck > section').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
      assert.ok(boxes[0].bottom <= boxes[1].top && boxes[1].bottom <= boxes[2].top, 'narrow windows need a readable stacked fallback');
    }
    if (width > 1200) {
      const nativeTop = await page.locator('#fixture-native-navigation').boundingBox();
      const workspaceTop = await page.locator('.pl-workspace-host').boundingBox();
      assert.ok(workspaceTop.y >= nativeTop.y + nativeTop.height, 'workspace must not cover UCLA navigation');
      assert.ok(await page.locator('tbody.courseItem').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().right <= node.closest('section').getBoundingClientRect().right + 1)), 'class cards must fit their panel');
      const panels = await page.locator('.pl-workspace-deck > section').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width };
      }));
      assert.ok(panels.every(r => r.top >= 0 && r.bottom <= height && r.width >= 250), `panels exceed viewport at ${width}: ${JSON.stringify(panels)}`);
      assert.ok(panels[0].right <= panels[1].left && panels[1].right <= panels[2].left);
      assert.ok(panels[2].width >= 520, 'search should have a wider default column');
      await page.mouse.wheel(0, 600);
      assert.equal(await page.evaluate(() => window.scrollY), 0, 'desktop should not scroll between sections');
      assert.ok(await page.locator('[data-pl-workspace-details]').last().isVisible());
      if (height >= 900) {
        const lastCard = await page.locator('tbody.courseItem').last().boundingBox();
        assert.ok(lastCard.y + lastCard.height <= panels[1].bottom + 1, `six compact classes should fit at ${width}px`);
      } else {
        // Keeping the original navigation reserves height above the workspace.
        // Short windows must expose every course through the local pane scroll.
        await page.locator('tbody.courseItem').last().scrollIntoViewIfNeeded();
        const lastCard = await page.locator('tbody.courseItem').last().boundingBox();
        assert.ok(lastCard.y + lastCard.height <= panels[1].bottom + 1, 'last course must be reachable inside its pane');
        assert.equal(await page.evaluate(()=>window.scrollY),0);
        await page.locator('tbody.courseItem').first().scrollIntoViewIfNeeded();
      }
    }
    const calendarGeometry = await page.locator('#gridDiv .planneritembox').evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(), p = node.parentElement.getBoundingClientRect();
      return { overflow: r.right - p.right, height: r.height, intended: parseFloat(node.style.height) + (node.style.border.includes('double') ? 6 : 2) };
    }));
    assert.ok(calendarGeometry.every(r => r.overflow <= 1 && Math.abs(r.height-r.intended) < 1), `calendar geometry changed at ${width}`);
    if (width > 1200) await page.screenshot({ path: resolve(out, `workspace-${width}.png`) });
    if (width > 1200) {
      const switches = page.locator('.pl-workspace-pane-switches button');
      const initialSearchWidth = (await page.locator('.pl-workspace-search').boundingBox()).width;
      await page.locator('#plannerSectionClip > button.planSectionToggle').click();
      assert.equal(await page.locator('.pl-workspace-plan').isVisible(),false);
      assert.ok((await page.locator('.pl-workspace-search').boundingBox()).width > initialSearchWidth, 'closing a pane must reclaim its column');
      assert.equal(await switches.nth(1).evaluate(node=>document.activeElement===node),true);
      await switches.nth(1).press('Enter');
      assert.equal(await page.locator('.pl-workspace-plan').isVisible(),true);
      for(let i=0;i<3;i++) await switches.nth(i).click();
      assert.ok(await page.locator('.pl-workspace-empty').isVisible());
      for(let i=0;i<3;i++) await switches.nth(i).press('Space');
      assert.equal(await page.locator('.pl-workspace-empty').isVisible(),false);
      assert.equal(await page.locator('.pl-workspace-deck > section:visible').count(),3);
      const resultControls = await page.locator('.ClassSearchList input').count();
      await page.locator('.pl-workspace-expand-search').click();
      assert.equal(await page.locator('.pl-workspace-expand-search').getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('.pl-workspace-calendar').isVisible(), false);
      const resultBox = await page.locator('.ClassSearchList').boundingBox();
      const rowBox = await page.locator('.ClassSearchList .data_row').first().boundingBox();
      assert.ok(resultBox.width > 1000 && rowBox.width >= 940, 'expanded results need readable columns');
      assert.ok(await page.locator('.ClassSearchList').evaluate(n=>n.scrollWidth <= n.clientWidth + 1), 'expanded results should fit without horizontal scrolling');
      assert.ok(await page.evaluate(() => window.nativeFields.every(node => node.isConnected && node.form === document.getElementById('aspnetForm'))));
      assert.equal(await page.locator('.ClassSearchList input').count(), resultControls);
      assert.ok(await page.locator('.ClassSearchList .data_row').first().evaluate(n=>[...n.children].every(c=>c.getBoundingClientRect().height < 100)), 'section fields must not wrap into very tall cells');
      // Exercise the original course disclosure, never Add or Enroll.
      await page.locator('.ClassSearchList .class-title a').click();
      assert.equal(await page.locator('#container_course_M0').isVisible(), false);
      await page.locator('.ClassSearchList .class-title a').click();
      assert.equal(await page.locator('#container_course_M0').isVisible(), true);
      if (width === 1536) await page.screenshot({path:resolve(out,'expanded-search.png')});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.pl-workspace-expand-search').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.pl-workspace-expand-search').evaluate(n=>document.activeElement===n), true);
      assert.equal(await page.locator('.pl-workspace-calendar').isVisible(), true);
    }
    const details = page.locator('[data-pl-workspace-details]').first();
    await details.click();
    await page.locator('.pl-workspace-preview').waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(() => window.nativeDetails.parentElement === window.nativeDetailsParent));
    const detailRect = await page.locator('tbody.pl-workspace-preview-card > tr:nth-child(3)').evaluate(node => {
      const r = node.getBoundingClientRect(); return { width:r.width, height:r.height, left:r.left, right:r.right, bottom:r.bottom, display:getComputedStyle(node).display };
    });
    assert.ok(detailRect.width > 250 && detailRect.height > 0 && detailRect.left >= 0 && detailRect.right <= width && detailRect.bottom <= height, `details bounds at ${width}: ${JSON.stringify(detailRect)}`);
    if (width === 1440) await page.screenshot({ path: resolve(out, 'class-details.png') });
    await page.locator('tbody.pl-workspace-preview-card table.coursetable th').first().click();
    assert.equal(await page.locator('.pl-workspace-preview').isVisible(), true, 'native detail content must stay interactive');
    await page.keyboard.press('Escape');
    assert.equal(await details.evaluate(node => document.activeElement === node), true);
    const closedRow = await page.locator('tbody.courseItem > tr:nth-child(3)').first().evaluate(node => getComputedStyle(node).display);
    assert.equal(closedRow, 'none');
    assert.equal(await page.locator('.pl-workspace-detail-backdrop').isVisible(), false);
    await details.click();
    // Click outside in viewport coordinates: no underlying original action.
    const previewBox = await page.locator('.pl-workspace-preview').boundingBox();
    await page.mouse.click(Math.max(4, previewBox.x - 12), previewBox.y + 16);
    assert.equal(await page.locator('.pl-workspace-preview').isVisible(), false);
    assert.equal(await details.evaluate(node => document.activeElement === node), true);
    await details.click();
    const closeButton = page.getByRole('button',{name:'Close details',exact:true});
    const closeBox = await closeButton.boundingBox();
    assert.ok(closeBox.width >= 44 && closeBox.height >= 44, 'close target should work for touch');
    await closeButton.click();
    assert.equal(await page.locator('.pl-workspace-preview').isVisible(), false);
    assert.equal(await details.evaluate(node => document.activeElement === node), true);
    await page.locator('[data-pl-workspace-details]').last().click();
    assert.equal(await page.locator('tbody.pl-workspace-preview-card tr.pl-thead').evaluate(n => getComputedStyle(n).display), 'table-row', 'each preview must retain its original column headings');
    await page.keyboard.press('Escape');
    await page.locator('.pl-workspace-extras > summary').click();
    assert.ok(await page.locator('.pl-workspace-host > .plannerTopMenuLinks').isVisible());
    assert.equal(await page.locator('.pl-workspace-section-links button').count(),3);
    await page.locator('.pl-workspace-section-links button').getByText('Personal Entries',{exact:true}).click();
    assert.ok(await page.locator('#plannerSectionPer').isVisible());
    const fold = page.locator('#plannerSectionPer > .pl-pane-toggle');
    await fold.click(); assert.equal(await fold.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('input[name="examplePersonalEntry"]').isVisible(),false);
    await page.locator('.pl-workspace-section-links button').getByText('Personal Entries',{exact:true}).click();
    assert.equal(await fold.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('input[name="examplePersonalEntry"]').isVisible(),true);
    if(width===1536) await page.screenshot({path:resolve(out,'other-sections.png')});
    await page.locator('.pl-workspace-extras > summary').click();
    await page.locator('.pl-workspace-original').click();
    assert.equal(await page.locator('.pl-workspace-deck').count(), 0);
    assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(), 6);
    assert.ok(await page.locator('section.classPlanner_CalendarSection').isVisible());
    await page.locator('.pl-workspace-return').click();
    await page.waitForSelector('.pl-workspace-deck');
    // Reproduce a native UpdatePanel redraw; extension must rebuild once.
    await page.evaluate(html => {
      const next = new DOMParser().parseFromString(html, 'text/html').getElementById('ctl00_MainContent_classPlanPanel');
      const imported = document.importNode(next, true);
      // Track the newly rendered panel, not old secondary sections awaiting
      // cleanup outside the replaced panel. Those old nodes must be discarded.
      window.redrawFields = [...imported.querySelectorAll('input,select')];
      document.getElementById('ctl00_MainContent_classPlanPanel').replaceWith(imported);
    }, fixture);
    await page.waitForSelector('.pl-workspace-deck [data-pl-workspace-details]');
    assert.equal(await page.locator('.pl-workspace-deck').count(), 1);
    assert.equal(await page.locator('#panelPlan').count(), 1);
    assert.equal(await page.locator('input[name="examplePersonalEntry"]').count(), 1);
    await page.evaluate(() => window.toggleTidy(false));
    await page.waitForSelector('.pl-workspace-deck', { state: 'detached' });
    assert.equal(await page.locator('.classPlannerWrapper > #ctl00_MainContent_classPlanPanel > section').count(), 6);
    assert.equal(await page.locator('[data-pl-workspace-details]').count(), 0);
    assert.equal(await page.locator('.pl-workspace-detail-backdrop').count(), 0);
    assert.ok(await page.evaluate(() => window.redrawFields.every(node => node.isConnected && node.form === document.getElementById('aspnetForm'))));
    assert.deepEqual(errors, []);
    assert.deepEqual(extraRequests, []);
    await page.close();
    console.log(`Workspace verified: ${width}px`);
  }
  const dragPage = await browser.newPage({ viewport: { width: 1440, height: 600 } });
  await dragPage.route(url, route => route.fulfill({ status: 200, contentType: 'text/html', body: workspaceFixtureHtml(12) }));
  await dragPage.goto(url);
  await dragPage.evaluate(() => {
    window.chrome = { storage: { local: { get: async key => key === 'plannerLift.layout.v1' ? { [key]: { tidy: true } } : {}, set: async () => {}, remove: async () => {} }, onChanged: { addListener: () => {}, removeListener: () => {} } } };
    window.nativeActionCount = 0;
    window.courseListAction = () => { window.nativeActionCount++; };
  });
  await dragPage.addStyleTag({ content: css }); await dragPage.addScriptTag({ content: js });
  await dragPage.waitForSelector('.pl-workspace-deck');
  const grip = await dragPage.locator('[data-pl-action="drag"]').first().boundingBox();
  const plan = await dragPage.locator('.pl-workspace-plan').boundingBox();
  await dragPage.mouse.move(grip.x + grip.width/2, grip.y + grip.height/2);
  await dragPage.mouse.down();
  await dragPage.mouse.move(grip.x + grip.width/2, plan.y + plan.height - 12, { steps: 8 });
  await dragPage.waitForFunction(() => document.querySelector('.pl-workspace-plan').scrollTop > 80);
  await dragPage.mouse.up();
  assert.equal(await dragPage.evaluate(() => window.nativeActionCount), 0, 'dragging must remain a local edit');
  assert.equal(await dragPage.evaluate(() => window.scrollY), 0, 'dragging should scroll the class panel only');
  await dragPage.close(); console.log('Workspace panel dragging verified');
} finally { await browser.close(); }
