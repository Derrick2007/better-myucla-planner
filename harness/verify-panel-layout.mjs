/** Production docking QA on fictional planner HTML. No live page or backend. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { introductionFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '../../outputs/panel-layout');
const build = resolve(root, process.env.BETTER_MYUCLA_PANEL_BUILD || 'dist');
const js = await readFile(resolve(build, 'content.js'), 'utf8');
const css = await readFile(resolve(build, 'injected.css'), 'utf8');
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
const widths = process.env.BETTER_MYUCLA_PANEL_WIDTHS?.split(',').map(Number) || [2048, 1440, 390];
assert.ok(widths.length && widths.every(width => Number.isInteger(width) && width >= 320 && width <= 3840));
const reports = [];
const selectors = {
  schedule: '.pl-workspace-calendar', details: '.pl-workspace-details-frame',
  classes: '.pl-workspace-plan', find: '.pl-workspace-search',
  optimizer: '.classPlanner_ClassOptimizerSection', study: '.classPlanner_EnrolledNotInPlanSection',
  personal: '.classPlanner_PersonalTimeBlocksSection',
};

function fixture() {
  const doc = new JSDOM(introductionFixtureHtml(8, true, 8)).window.document;
  for (const [title, body, toggle, label, help] of [
    ['classOptimizerTitle', 'panelOptimizer', 'toggleOptimizer', 'Plan Optimizer', 'ctl00_MainContent_planSectionHelpTipOpPop'],
    ['plannerSectionEnip', 'panelNotplan', 'toggleNotplan', 'In Study List but Not In Current Plan', 'slneTip'],
    ['plannerSectionPer', 'panelPersonal', 'togglePersonal', 'Personal Entries', 'ctl00_MainContent_helpPersonal'],
  ]) {
    doc.getElementById(title).innerHTML = `${body === 'panelNotplan' ? '<a class="planSectionHelpTip" href="#fictional-help">Help</a>' : ''}<button id="${help}" class="${body === 'panelOptimizer' ? '' : 'uit-clickover-bottom '}planSectionHelpTip link" onclick="return false;">Help</button><button id="ctl00_MainContent_${toggle}" class="planSectionToggle link" onclick="shrink('${body}'); __doPostBack('ctl00$MainContent$${toggle}','')"><i class="${body === 'panelOptimizer' ? 'icon-plus-sign' : 'icon-minus-sign'}"></i><label>${label}</label></button>`;
  }
  doc.getElementById('HelpOptimizerDiv').style.display = 'none';
  for (const [index, card] of [...doc.querySelectorAll('tbody.courseItem')].entries()) {
    const table = card.querySelector('table.coursetable');
    const row = table.tBodies[1].rows[0];
    row.cells[0].innerHTML = `<button type="button" class="link actionMenu" aria-label="Example details action" data-fixture-detail-action="${index}" onclick="this.closest('tbody.courseItem').querySelector('.planClass').hidden=false;return false;">✎</button>`;
    const response = doc.createElement('div'); response.className = 'planClass'; response.hidden = true;
    response.innerHTML = '<label>Example native review <select name="fixtureNativeReview"><option>Example choice</option></select></label><button type="button" onclick="this.parentElement.hidden=true;return false;">Close example review</button>';
    table.after(response);
  }
  const style = doc.createElement('style');
  style.textContent = '.planClass:not([hidden]){padding:12px;border:1px solid #ccd}.planClass select,.planClass button{padding:6px;max-width:100%}';
  doc.head.append(style);
  return doc.documentElement.outerHTML;
}

const frame = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const panel = (page, id) => page.locator(selectors[id]);
const handle = (page, id) => panel(page, id).locator(`[data-pl-panel-handle="${id}"]:visible`).first();

async function drag(page, source, destination) {
  await source.scrollIntoViewIfNeeded();
  const box = await source.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'drag handle is visible');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 18, start.y + 12, { steps: 4 });
  await frame(page);
  const point = typeof destination === 'function' ? await destination() : destination;
  await page.mouse.move(point.x, point.y, { steps: 10 });
  await page.mouse.up(); await frame(page);
}

async function floatPanel(page, id, source = handle(page, id)) {
  await drag(page, source, async () => page.evaluate(() => {
    const targets = [...document.querySelectorAll('[data-pl-dock-target]')].filter(node => node.getClientRects().length).map(node => node.getBoundingClientRect());
    // Narrow floating panes are deliberately placed below the navigation row,
    // so this test can reach it without first moving the window out of the way.
    for (const y of innerWidth < 600 ? [.68, .74, .55, .42] : [.42, .55, .68, .3]) for (const x of [.52, .64, .4, .74]) {
      const point = { x: innerWidth * x, y: innerHeight * y };
      if (!targets.some(box => point.x >= box.left - 8 && point.x <= box.right + 8 && point.y >= box.top - 8 && point.y <= box.bottom + 8)) return point;
    }
    throw Error('No free position outside docking targets');
  }));
  assert.ok(await panel(page, id).evaluate(node => node.classList.contains('pl-floating-panel')), `${id} floats after dragging to free space`);
}

async function dockPanel(page, id, destination) {
  await drag(page, handle(page, id), async () => {
    const target = page.locator(`[data-pl-dock-target="${destination}"]:visible`).first();
    const box = await target.boundingBox();
    assert.ok(box, `${destination} docking destination is visible while dragging`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  assert.equal(await panel(page, id).getAttribute('data-pl-panel-placement'), destination, `${id} docks ${destination}`);
  assert.equal(await panel(page, id).evaluate(node => node.classList.contains('pl-floating-panel')), false);
}

async function assertReachable(locator, message) {
  const view = await locator.evaluate(node => {
    const r = node.getBoundingClientRect(), target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { reachable: !!target && (node === target || node.contains(target)), bounds: r.toJSON(), target: target?.className, viewport: [innerWidth, innerHeight] };
  });
  assert.ok(view.reachable && view.bounds.width > 0 && view.bounds.height > 0, `${message}: ${JSON.stringify(view)}`);
}

async function assertIdentity(page) {
  const mismatches = await page.evaluate(() => window.fixtureReferences.filter(({ node, parent, form, handler }) => !node.isConnected || !window.fixtureParentPreserved(node, parent) || node.form !== form || node.getAttribute('onclick') !== handler).map(({ node, parent, form, handler }) => ({
    id: node.id, tag: node.tagName, cls: node.className, connected: node.isConnected,
    originalParent: `${parent?.tagName}.${parent?.className}`, currentParent: `${node.parentElement?.tagName}.${node.parentElement?.className}`,
    sameForm: node.form === form, sameHandler: node.getAttribute('onclick') === handler,
  })));
  const proof = await page.evaluate(() => ({
    controls: window.fixtureReferences.every(({ node, parent, form, handler }) => node.isConnected && window.fixtureParentPreserved(node, parent) && node.form === form && node.getAttribute('onclick') === handler),
    rows: window.fixtureRows.every(({ node, parent }) => node.isConnected && node.parentElement === parent),
    status: window.fixtureStatuses.every(({ node, html }) => node.isConnected && node.innerHTML === html),
    calendar: window.fixtureMeetings.every(({ node, parent, top, height }) => node.isConnected && node.parentElement === parent && node.style.top === top && node.style.height === height),
    masthead: window.fixtureNavigation.isConnected && window.fixtureNavigation.outerHTML === window.fixtureNavigationHtml,
    forms: document.querySelectorAll('form').length,
  }));
  assert.deepEqual(proof, { controls: true, rows: true, status: true, calendar: true, masthead: true, forms: 1 }, `original form, immediate native control/row parents, status markup, calendar geometry and UCLA navigation survive layout gestures: ${JSON.stringify(mismatches)}`);
}

async function setup(page) {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: fixture() })
    : (requests.push(route.request().url()), route.abort()));
  await page.goto(url);
  await page.evaluate(() => {
    const stored = { 'plannerLift.layout.v1': { tidy: true }, 'plannerLift.header.v1': { compact: true } }, listeners = [];
    window.fixtureWrites = []; window.fixtureNativeCalls = []; window.fixtureSubmits = [];
    window.chrome = { storage: { local: { get: async key => ({ [key]: stored[key] }), set: async value => { window.fixtureWrites.push(Object.keys(value)); Object.assign(stored, value); }, remove: async key => delete stored[key] }, onChanged: { addListener: fn => listeners.push(fn), removeListener() {} } } };
    window.fixtureTidy = tidy => listeners.forEach(fn => fn({ 'plannerLift.layout.v1': { newValue: { tidy } } }, 'local'));
    document.getElementById('aspnetForm').addEventListener('submit', event => { event.preventDefault(); window.fixtureSubmits.push(event.submitter?.id || 'implicit'); });
    window.shrink = id => { const body = document.getElementById(id); body.classList.toggle('hidden'); body.closest('section').querySelector('.planSectionToggle > i').className = body.classList.contains('hidden') ? 'icon-plus-sign' : 'icon-minus-sign'; };
    window.__doPostBack = (target, arg) => window.fixtureNativeCalls.push(`${target}|${arg}`);
    // The pre-existing search presentation wraps the same native Go input in
    // one label surface; docking must preserve that wrapper under goPanel.
    window.fixtureParentPreserved = (node, parent) => node.parentElement === parent || (node.id === 'ctl00_MainContent_cs_goButton' && node.parentElement?.matches('span.pl-search-submit') && node.parentElement.parentElement === parent);
    const original = document.querySelector('.classPlannerWrapper').outerHTML;
    window.fixtureCapture = () => {
      window.fixtureReferences = [...document.querySelectorAll('.classPlannerWrapper input,.classPlannerWrapper select,.classPlannerWrapper button,.classPlannerWrapper a')].filter(node => !node.closest('[data-planner-lift-owned]')).map(node => ({ node, parent: node.parentElement, form: node.form, handler: node.getAttribute('onclick') }));
      window.fixtureRows = [...document.querySelectorAll('tbody.courseItem > tr:nth-child(3)')].map(node => ({ node, parent: node.parentElement }));
      window.fixtureStatuses = [...document.querySelectorAll('table.coursetable td:nth-child(3),.ClassSearchList .data_row > .span3')].map(node => ({ node, html: node.innerHTML }));
      window.fixtureMeetings = [...document.querySelectorAll('#gridDiv .planneritembox')].map(node => ({ node, parent: node.parentElement, top: node.style.top, height: node.style.height }));
    };
    window.fixtureCapture();
    window.fixtureNavigation = document.getElementById('fixture-native-navigation'); window.fixtureNavigationHtml = window.fixtureNavigation.outerHTML;
    window.fixtureNativeSections = [...document.querySelectorAll('#ctl00_MainContent_classPlanPanel > section')];
    window.fixtureRedraw = (context = false) => {
      const template = document.createElement('template'); template.innerHTML = original;
      if (context) document.getElementById('ctl00_MainContent_planIDField').value = '9999999999';
      document.querySelector('.classPlannerWrapper').replaceWith(template.content.firstElementChild);
      window.fixtureCapture();
    };
  });
  await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
  await page.waitForSelector('.pl-workspace-deck'); await frame(page);
  return { errors, requests };
}

const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
await mkdir(output, { recursive: true });
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: true });
    page.setDefaultTimeout(10000);
    const checks = await setup(page), report = { width };
    try {
      const nav = id => page.locator(`.pl-workspace-nav [data-pl-module="${id}"]`);
      await assertIdentity(page);
      assert.deepEqual(await page.evaluate(() => window.fixtureNativeCalls), [], 'mount does not open a native module');
      if (width < 1100) await page.locator('.pl-workspace-schedule-toggle').click();
      await floatPanel(page, 'schedule');
      await assertReachable(handle(page, 'schedule'), 'floating schedule header is pointer reachable');
      const beforeMove = await panel(page, 'schedule').boundingBox();
      const scheduleHandle = await handle(page, 'schedule').boundingBox();
      // Stay above all docking targets; a move onto a target would redock it.
      await drag(page, handle(page, 'schedule'), { x: Math.min(width - 35, scheduleHandle.x + scheduleHandle.width / 2 + 50), y: 90 });
      const afterMove = await panel(page, 'schedule').boundingBox();
      assert.ok(Math.abs(afterMove.x - beforeMove.x) + Math.abs(afterMove.y - beforeMove.y) > 10, 'floating calendar moves with a trusted pointer drag');
      report.floatingSchedule = afterMove;
      const resize = panel(page, 'schedule').locator(':scope > .pl-panel-resize');
      if (await resize.count() && await resize.isVisible()) {
        const before = await panel(page, 'schedule').boundingBox(), grip = await resize.boundingBox();
        await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
        await page.mouse.move(Math.max(80, grip.x - 70), Math.max(200, grip.y - 80), { steps: 10 }); await page.mouse.up(); await frame(page);
        const after = await panel(page, 'schedule').boundingBox();
        assert.ok(Math.abs(after.width - before.width) + Math.abs(after.height - before.height) > 20, 'floating schedule resizes with its grip');
      } else assert.fail('floating schedule has a visible resize grip');
      await assertIdentity(page);
      await page.screenshot({ path: resolve(output, `schedule-floating-${width}.png`) });
      await dockPanel(page, 'schedule', 'left');
      await assertReachable(handle(page, 'schedule'), 'left-docked schedule has an accessible handle');
      await dockPanel(page, 'schedule', 'bottom');
      await assertReachable(handle(page, 'schedule'), 'bottom-docked schedule has an accessible handle');
      await dockPanel(page, 'schedule', 'right');
      if (width < 1100) await page.locator('[data-pl-mobile-view="main"]').click();
      await nav('classes').click();
      const details = page.locator('[data-pl-workspace-details]');
      await details.nth(0).click(); await details.nth(1).click();
      assert.equal(await page.locator('[data-pl-workspace-details][aria-expanded="true"]').count(), 2, 'two details remain open');
      await floatPanel(page, 'details');
      await nav('find').click();
      assert.ok(await panel(page, 'details').isVisible(), 'floating Details remains visible while finding classes');
      await page.locator('.pl-workspace-details-slot').evaluate(node => { node.scrollTop = 0; }); await frame(page);
      const action = page.locator('[data-fixture-detail-action="0"]'); await action.focus();
      await assertReachable(action, 'native section action is reachable inside floating Details');
      await action.click();
      const response = page.locator('tbody.courseItem').first().locator('.planClass select');
      await response.focus(); await assertReachable(response, 'returned native review is reachable inside floating Details');
      await assertIdentity(page);
      await page.screenshot({ path: resolve(output, `details-floating-${width}.png`) });
      if (width >= 1100) {
        await nav('classes').click(); await floatPanel(page, 'classes');
        await nav('find').click(); await floatPanel(page, 'find', nav('find'));
        assert.ok(await page.locator('.pl-workspace-dock-placeholder').isVisible(), 'detaching both primary modules shows a clear empty workspace destination');
        assert.equal(await page.locator('#panelOptimizer').isVisible(), false, 'detaching primary modules does not silently select unopened Optimizer');
        assert.deepEqual(await page.evaluate(() => window.fixtureNativeCalls), [], 'empty dock presentation invokes no native disclosure');
        await action.focus(); await frame(page);
        await assertReachable(action, 'native Details content comes forward while My classes and Find classes also float');
        await response.focus(); await frame(page);
        await assertReachable(response, 'native response comes forward without changing its original parent');
        await assertIdentity(page);
        await page.screenshot({ path: resolve(output, `multiple-floating-${width}.png`) });
        await handle(page, 'details').focus(); await page.keyboard.press('Shift+F10');
        await page.getByRole('menuitem', { name: 'Reset layout', exact: true }).click();
        assert.equal(await page.locator('.pl-floating-panel').count(), 0, 'keyboard layout menu restores every panel');
      } else await dockPanel(page, 'details', 'main');
      await nav('find').click(); await floatPanel(page, 'find', nav('find'));
      await nav('classes').click();
      assert.ok(await panel(page, 'find').isVisible(), 'floating Find classes remains accessible beside My classes');
      await assertIdentity(page);
      await page.screenshot({ path: resolve(output, `find-floating-${width}.png`) });
      await dockPanel(page, 'find', 'left');
      await assertReachable(handle(page, 'find'), 'Find classes remains reachable in a side dock');
      if (width >= 1100) {
        const divider = page.locator('[data-pl-dock-divider="left"]'), grip = await divider.boundingBox();
        const before = await panel(page, 'find').boundingBox();
        assert.ok(grip, 'docked Find classes has a visible resizing divider');
        await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
        await page.mouse.move(grip.x - 60, grip.y + grip.height / 2, { steps: 6 }); await page.mouse.up(); await frame(page);
        const after = await panel(page, 'find').boundingBox();
        assert.ok(Math.abs(before.width - after.width) > 20, 'docked Find classes width adjusts with a trusted divider drag');
      }
      await dockPanel(page, 'find', 'main');
      assert.deepEqual(await page.evaluate(() => window.fixtureSubmits), [], 'dragging, resizing and floating native content never submits the form');
      // Native opaque modules retain their original disclosure and form controls.
      for (const id of ['optimizer', 'study', 'personal']) {
        await nav(id).click();
        assert.ok(await page.locator(`[data-fixture-module="${id}"]`).isVisible(), `${id} body is accessible`);
        await floatPanel(page, id); await nav('classes').click();
        assert.ok(await page.locator(`[data-fixture-module="${id}"]`).isVisible(), `${id} remains accessible while floating`);
        await assertIdentity(page); await dockPanel(page, id, 'main');
      }
      assert.equal(await page.evaluate(() => window.fixtureNativeCalls.length), 1, 'only explicit opening of initially collapsed fictional Optimizer invokes native disclosure');
      assert.deepEqual(await page.evaluate(() => window.fixtureSubmits), ['ctl00_MainContent_toggleOptimizer'], 'only the explicit native Optimizer disclosure can submit; layout gestures never submit');
      const collapse = page.getByRole('button', { name: 'Collapse navigation', exact: true });
      await collapse.click();
      await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
      if (width >= 1280) {
        const edge = page.getByRole('separator', { name: 'Resize navigation', exact: true }), box = await edge.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
        await page.mouse.move(box.x - 45, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
        await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
      }
      await assertReachable(nav('find'), 'module navigation reopens after being collapsed');
      await nav('classes').click();
      if (width < 1100) await page.locator('.pl-workspace-schedule-toggle').click();
      await floatPanel(page, 'schedule');
      const beforeRedraw = await panel(page, 'schedule').boundingBox();
      await page.evaluate(() => window.fixtureRedraw());
      await page.waitForSelector('.pl-workspace-calendar.pl-floating-panel'); await frame(page);
      const afterRedraw = await panel(page, 'schedule').boundingBox();
      assert.ok(Math.abs(afterRedraw.x - beforeRedraw.x) <= 2 && Math.abs(afterRedraw.y - beforeRedraw.y) <= 2, 'same-context full native redraw retains floating layout');
      await assertIdentity(page);
      await page.emulateMedia({ media: 'print' });
      const print = await page.locator('.pl-workspace-calendar').evaluate(node => ({ position: getComputedStyle(node).position, visible: !!node.getClientRects().length }));
      assert.ok(print.visible && !['fixed', 'absolute'].includes(print.position), 'print removes floating bounds and keeps schedule content');
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.fixtureRedraw(true));
      await page.waitForSelector('.pl-workspace-deck'); await frame(page);
      assert.equal(await page.locator('[data-pl-workspace-details][aria-expanded="true"]').count(), 0, 'new plan context discards old course Details');
      const overflow = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(overflow.content <= overflow.viewport + 1, `no document horizontal overflow: ${JSON.stringify(overflow)}`);
      await page.locator('.pl-workspace-original').click();
      await page.waitForSelector('.pl-workspace-deck', { state: 'detached' });
      assert.equal(await page.locator('[data-pl-panel-placement],.pl-floating-panel,[data-pl-panel-handle],[data-pl-dock-target],.pl-workspace-details-frame').count(), 0, 'Original layout removes all docking presentation');
      await assertIdentity(page);
      assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(), 6, 'all original native sections return to their native parent');
      assert.deepEqual(checks.errors, [], 'no page errors'); assert.deepEqual(checks.requests, [], 'no outgoing fixture requests');
      assert.deepEqual(await page.evaluate(() => window.fixtureWrites.filter(keys => keys.some(key => !['plannerLift.layout.v1', 'plannerLift.header.v1', 'plannerLift.view.v1'].includes(key)))), [], 'docking introduces no persistent storage');
      report.passed = true; reports.push(report);
    } catch (error) {
      report.passed = false; report.error = error.message; report.pageErrors = checks.errors; reports.push(report);
      await page.screenshot({ path: resolve(output, `failure-${width}.png`) });
      throw error;
    } finally { await page.close(); }
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'metrics.json'), JSON.stringify(reports, null, 2));
}
console.log(`Flexible panels passed at ${widths.join(', ')}px: trusted drag/resize/dock, multiple details/native controls, modules, sidebar, redraws, printing and restoration.`);
