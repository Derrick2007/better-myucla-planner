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
const handle = (page, id) => panel(page, id).locator(`button[data-pl-panel-handle="${id}"]:visible`).first();
const close = (page, id) => panel(page, id).locator(`[data-pl-panel-close="${id}"]`);

const preview = page => page.locator('.pl-panel-drop-preview[data-pl-dock-target]:visible');
const interactive = 'button,a,input,select,textarea,label,[role="button"],[contenteditable="true"]';

async function dockRegions(page) {
  return { deck: await page.locator('.pl-workspace-deck').boundingBox(), main: await page.locator('.pl-workspace-main').boundingBox(), classes: await panel(page, 'classes').boundingBox() };
}

/** Point at the pane itself: a target must not be needed to discover a drop. */
async function hoverDockDestination(page, destination, regions) {
  const { deck, main, classes } = regions;
  assert.ok(deck && deck.width > 0 && deck.height > 0, 'the workspace supplies a visible drop area');
  const view = page.viewportSize();
  const points = destination === 'main'
    ? [classes, main, deck].filter(box => box && box.width > 0 && box.height > 0).flatMap(box => [.5, .4, .6].flatMap(x => [.08, .16, .3, .5, .7].map(y => ({ x: box.x + box.width * x, y: box.y + box.height * y }))))
    : [.5, .3, .7, .15].flatMap(y => [20, 48, deck.width * .12].map(inset => ({ x: destination === 'left' ? deck.x + inset : deck.x + deck.width - inset, y: deck.y + deck.height * y })));
  for (const point of points) {
    if (point.x < 0 || point.x >= view.width || point.y < 0 || point.y >= view.height) continue;
    await page.mouse.move(point.x, point.y, { steps: 6 }); await frame(page);
    if (await preview(page).count() && await preview(page).getAttribute('data-pl-dock-target') === destination) {
      assert.equal(await preview(page).count(), 1, 'only the hovered destination is previewed');
      assert.equal(await page.locator('[data-pl-dock-target="bottom"],.pl-panel-drop-target').count(), 0, 'no bottom target or small target button is rendered');
      const box = await preview(page).boundingBox();
      const style = await preview(page).evaluate(node => ({ background: getComputedStyle(node).backgroundColor, pointerEvents: getComputedStyle(node).pointerEvents }));
      assert.ok(box && box.width * box.height > deck.width * deck.height * .1 && box.height > Math.min(160, deck.height * .5), `the ${destination} preview fills a pane-sized destination: ${JSON.stringify({ box, deck })}`);
      assert.ok(style.background !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(style.background), 'the drop preview is a filled rectangle');
      assert.equal(style.pointerEvents, 'none', 'the destination preview does not intercept native controls');
      return { point, box };
    }
  }
  assert.fail(`Moving over the measured ${destination} pane region did not show its destination preview`);
}

async function assertNoBottomDock(page, id) {
  assert.equal(await page.locator('[data-pl-dock-divider="bottom"],[data-pl-dock-target="bottom"]').count(), 0, 'the workspace has no bottom docking controls');
  const placement = await panel(page, id).getAttribute('data-pl-panel-placement');
  await handle(page, id).focus(); await page.keyboard.press('Alt+ArrowDown'); await frame(page);
  assert.equal(await panel(page, id).getAttribute('data-pl-panel-placement'), placement, 'Alt+Down has no bottom docking action');
  await page.keyboard.press('Shift+F10');
  const items = await page.getByRole('menuitem').allTextContents();
  assert.ok(items.length > 0 && items.every(text => !/bottom/i.test(text)), 'the layout menu exposes no bottom docking action');
  await page.keyboard.press('Escape'); await frame(page);
}

async function blankHeaderPoint(page, id) {
  return handle(page, id).evaluate((grip, excluded) => {
    const header = grip.closest('.classPlanner_SectionTitle') || grip.parentElement;
    const box = header.getBoundingClientRect();
    for (const y of [.5, .25, .75]) for (let x = box.right - 8; x >= box.left + 8; x -= 8) {
      const point = { x, y: box.top + box.height * y };
      const target = document.elementFromPoint(point.x, point.y);
      if (target && header.contains(target) && !target.closest(excluded)) return point;
    }
    return null;
  }, interactive);
}

async function hidePanel(page, id) {
  await assertReachable(close(page, id), `${id} close control is pointer reachable`);
  await close(page, id).click(); await frame(page);
  assert.ok(await panel(page, id).evaluate(node => node.classList.contains('pl-panel-hidden')), `${id} can be hidden without removing its native content`);
  await assertIdentity(page);
}

/** Check the original panel while the pointer remains down, not its final drop. */
async function assertLiveDragAndCancel(page, id, width, useBlankHeader = false) {
  const original = await panel(page, id).boundingBox();
  const placement = await panel(page, id).getAttribute('data-pl-panel-placement');
  const grip = await handle(page, id).boundingBox();
  const regions = await dockRegions(page);
  assert.ok(original && grip, `${id} starts visible before live drag`);
  const start = useBlankHeader ? await blankHeaderPoint(page, id) : { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  assert.ok(start, `${id} has blank header space that can start a drag`);
  assert.equal(await page.locator('[data-pl-dock-target]').count(), 0, 'no destination target exists before a drag');
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(width * .51, 600, { steps: 8 }); await frame(page);
  const first = await panel(page, id).boundingBox();
  // A full-width narrow panel cannot move horizontally, and tall panes clamp
  // at the bottom. Move upward too so even those original panels must move.
  await page.mouse.move(width * .59, 90, { steps: 8 }); await frame(page);
  const second = await panel(page, id).boundingBox();
  assert.ok(first && second && Math.abs(first.x - second.x) + Math.abs(first.y - second.y) > 30,
    `${id} itself follows the mouse before release: ${JSON.stringify({ first, second })}`);
  assert.ok(await panel(page, id).isVisible(), 'the dragged original panel remains visible');
  assert.equal(await page.locator('.pl-panel-drag-ghost').count(), 0, 'dragging shows the actual panel, not only a label ghost');
  assert.equal(await preview(page).count(), 0, 'free-space dragging shows no destination preview');
  await assertIdentity(page);
  await hoverDockDestination(page, id === 'schedule' ? 'right' : 'main', regions);
  await page.screenshot({ path: resolve(output, `${id}-live-drag-${width}.png`) });
  await page.keyboard.press('Escape'); await page.mouse.up(); await frame(page);
  assert.equal(await panel(page, id).getAttribute('data-pl-panel-placement'), placement, 'Escape cancels temporary undocking');
  const restored = await panel(page, id).boundingBox();
  assert.ok(restored && ['x', 'y', 'width', 'height'].every(key => Math.abs(restored[key] - original[key]) <= 2),
    `${id} returns to its pre-drag geometry after Escape: ${JSON.stringify({ original, restored })}`);
  assert.equal(await page.locator('[data-pl-dock-target],.pl-panel-drop-overlay').count(), 0, 'cancel removes the destination preview and drag overlay');
  await assertIdentity(page);
}

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
  await drag(page, source, async () => {
    const { width, height } = page.viewportSize();
    // Narrow floating panes are deliberately placed below the navigation row,
    // so this test can reach it without first moving the window out of the way.
    for (const y of width < 600 ? [.68, .74, .55, .42, .98, .1] : [.42, .55, .68, .3, .1]) for (const x of [.52, .64, .4, .74]) {
      const point = { x: width * x, y: height * y };
      await page.mouse.move(point.x, point.y, { steps: 4 }); await frame(page);
      if (!await preview(page).count()) return point;
    }
    throw Error('No free position outside docking targets');
  });
  assert.ok(await panel(page, id).evaluate(node => node.classList.contains('pl-floating-panel')), `${id} floats after dragging to free space`);
  assert.equal(await page.locator('.pl-panel-drop-overlay').count(), 0, 'floating finishes without a stale preview overlay');
}

async function dockPanel(page, id, destination, scenario = '') {
  const regions = await dockRegions(page);
  const detailsGeometry = () => page.evaluate(() => {
    const plan = document.querySelector('.pl-workspace-plan'), title = plan.querySelector('.classPlanner_SectionTitle'), main = document.querySelector('.pl-workspace-main'), details = document.querySelector('.pl-workspace-details-frame');
    const style = getComputedStyle(plan);
    return { placement: plan.getAttribute('data-pl-panel-placement'), classes: plan.className, plan: plan.getBoundingClientRect().toJSON(), title: title.getBoundingClientRect().toJSON(), rows: style.gridTemplateRows, columns: style.gridTemplateColumns, clientHeight: plan.clientHeight, clientWidth: plan.clientWidth, main: main.getBoundingClientRect().toJSON(), details: details.getBoundingClientRect().toJSON() };
  });
  const before = id === 'details' ? await detailsGeometry() : null;
  let targetBox, whileDragging;
  await drag(page, handle(page, id), async () => {
    const { point, box } = await hoverDockDestination(page, destination, regions);
    targetBox = box;
    if (id === 'details') whileDragging = await detailsGeometry();
    await page.screenshot({ path: resolve(output, `${id}-${destination}${scenario ? `-${scenario}` : ''}-drop-preview-${page.viewportSize().width}.png`) });
    return point;
  });
  assert.equal(await panel(page, id).getAttribute('data-pl-panel-placement'), destination, `${id} docks ${destination}`);
  assert.equal(await panel(page, id).evaluate(node => node.classList.contains('pl-floating-panel')), false);
  const dropped = await panel(page, id).boundingBox();
  const after = id === 'details' ? await detailsGeometry() : null;
  assert.ok(dropped && ['x', 'y', 'width', 'height'].every(key => Math.abs(dropped[key] - targetBox[key]) <= 2), `${id} ${destination} drop matches the filled destination preview: ${JSON.stringify({ preview: targetBox, dropped, ...(before ? { before, whileDragging, after } : {}) })}`);
  assert.equal(await page.locator('[data-pl-dock-target],.pl-panel-drop-overlay').count(), 0, 'a completed drop removes its preview');
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
      await assertNoBottomDock(page, 'schedule');
      await assertLiveDragAndCancel(page, 'schedule', width, true);
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
      await dockPanel(page, 'schedule', 'right');
      const mainBeforeHide = await page.locator('.pl-workspace-main').boundingBox();
      await hidePanel(page, 'schedule');
      assert.equal(await panel(page, 'schedule').isVisible(), false, 'closed schedule is no longer displayed');
      if (width >= 1100) {
        const mainAfterHide = await page.locator('.pl-workspace-main').boundingBox();
        assert.ok(mainAfterHide.width > mainBeforeHide.width + 100, 'hiding the docked schedule gives its width back to the workspace');
      }
      await nav('schedule').click(); await frame(page);
      assert.ok(await panel(page, 'schedule').isVisible(), 'Schedule navigation reopens the hidden native calendar');
      if (width < 1100) await page.locator('[data-pl-mobile-view="main"]').click();
      await nav('classes').click();
      const details = page.locator('[data-pl-workspace-details]');
      await details.nth(0).click(); await details.nth(1).click();
      assert.equal(await page.locator('[data-pl-workspace-details][aria-expanded="true"]').count(), 2, 'two details remain open');
      await assertLiveDragAndCancel(page, 'details', width);
      await floatPanel(page, 'details');
      await nav('find').click();
      assert.ok(await panel(page, 'details').isVisible(), 'floating Details remains visible while finding classes');
      await page.locator('.pl-workspace-details-slot').evaluate(node => { node.scrollTop = 0; }); await frame(page);
      const action = page.locator('[data-fixture-detail-action="0"]'); await action.focus();
      await assertReachable(action, 'native section action is reachable inside floating Details');
      await action.click();
      const response = page.locator('tbody.courseItem').first().locator('.planClass select');
      await response.focus(); await assertReachable(response, 'returned native review is reachable inside floating Details');
      const actionBeforeHide = await action.boundingBox();
      await hidePanel(page, 'details');
      assert.equal(await action.isVisible(), false, 'hiding Details also hides the native fixed course rows');
      assert.equal(await action.evaluate((node, box) => { const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return hit === node || node.contains(hit); }, actionBeforeHide), false,
        'closed Details native actions cannot intercept pointer clicks');
      assert.equal(await page.locator('tbody.courseItem.pl-workspace-preview-card').count(), 2, 'closing the Details pane preserves its open course records');
      assert.equal(await page.locator('[data-pl-workspace-details][aria-expanded="true"]').count(), 0, 'hidden Details is correctly announced as collapsed');
      await nav('classes').click(); await details.nth(0).click(); await frame(page);
      assert.equal(await page.locator('[data-pl-workspace-details][aria-expanded="true"]').count(), 2, 'an already-open course Details button reopens the pane without toggling that course off');
      await response.focus(); await assertReachable(response, 'reopening Details restores the same native review control');
      await hidePanel(page, 'classes');
      await response.focus(); await frame(page);
      await assertReachable(response, 'floating Details stays usable when its My classes list is closed');
      await nav('classes').click(); await frame(page);
      await assertIdentity(page);
      await page.screenshot({ path: resolve(output, `details-floating-${width}.png`) });
      await dockPanel(page, 'details', 'main', 'normal-classes');
      await response.focus(); await assertReachable(response, 'native review remains reachable after docking Details');
      await floatPanel(page, 'details');
      await hidePanel(page, 'classes');
      await dockPanel(page, 'details', 'main', 'hidden-classes');
      assert.ok(await panel(page, 'classes').isVisible(), 'docking Details reopens its hidden My classes destination');
      await response.focus(); await assertReachable(response, 'Details docked into reopened My classes retains the native review');
      await floatPanel(page, 'details');
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
        await dockPanel(page, 'details', 'main', 'floating-classes');
        assert.equal(await panel(page, 'classes').getAttribute('data-pl-panel-placement'), 'floating', 'docking Details preserves the floating My classes placement');
        await response.focus(); await assertReachable(response, 'native review remains reachable when Details docks inside floating My classes');
        await floatPanel(page, 'details');
        await hidePanel(page, 'classes');
        await dockPanel(page, 'details', 'main', 'hidden-floating-classes');
        assert.equal(await panel(page, 'classes').getAttribute('data-pl-panel-placement'), 'floating', 'docking Details reopens hidden floating My classes in its retained position');
        await response.focus(); await assertReachable(response, 'Details rejoined to hidden floating My classes preserves the reachable native review');
        await handle(page, 'details').focus(); await page.keyboard.press('Shift+F10');
        await page.getByRole('menuitem', { name: 'Reset layout', exact: true }).click();
        assert.equal(await page.locator('.pl-floating-panel').count(), 0, 'keyboard layout menu restores every panel');
      } else await dockPanel(page, 'details', 'main');
      await nav('find').click();
      const selected = page.locator('#container_course_M0 input[type="checkbox"]').first();
      await selected.check();
      await hidePanel(page, 'find');
      assert.equal(await panel(page, 'find').isVisible(), false, 'Find classes can be closed');
      await nav('find').click(); await frame(page);
      assert.ok(await selected.isChecked(), 'closing and reopening Find classes retains the native section selection');
      await floatPanel(page, 'find', nav('find'));
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
        const field = page.locator(`[data-fixture-module="${id}"]`).locator('input,select').first();
        await field.evaluate(node => { if (node.type === 'checkbox') node.checked = true; else if (node.tagName === 'SELECT') node.selectedIndex = 1; else node.value = 'Example retained input'; });
        const selectedState = await field.evaluate(node => ({ value: node.value, checked: node.checked }));
        await hidePanel(page, id);
        assert.equal(await page.locator(`[data-fixture-module="${id}"]`).isVisible(), false, `${id} body disappears when its panel is closed`);
        await nav(id).click(); await frame(page);
        assert.deepEqual(await field.evaluate(node => ({ value: node.value, checked: node.checked })), selectedState, `${id} retains the same native inputs after reopening`);
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
      await hidePanel(page, 'schedule');
      await page.evaluate(() => window.fixtureRedraw());
      await page.waitForSelector('.pl-workspace-calendar.pl-floating-panel.pl-panel-hidden', { state: 'attached' }); await frame(page);
      assert.equal(await panel(page, 'schedule').isVisible(), false, 'same-context native redraw preserves a hidden panel');
      await nav('schedule').click(); await frame(page);
      const afterRedraw = await panel(page, 'schedule').boundingBox();
      assert.ok(Math.abs(afterRedraw.x - beforeRedraw.x) <= 2 && Math.abs(afterRedraw.y - beforeRedraw.y) <= 2, 'same-context full native redraw retains floating layout');
      await assertIdentity(page);
      await hidePanel(page, 'schedule');
      await nav('find').click(); await hidePanel(page, 'find');
      await page.emulateMedia({ media: 'print' });
      const print = await page.locator('.pl-workspace-calendar').evaluate(node => ({ position: getComputedStyle(node).position, visible: !!node.getClientRects().length }));
      assert.ok(print.visible && !['fixed', 'absolute'].includes(print.position), 'print removes floating bounds and keeps schedule content');
      assert.ok(await panel(page, 'find').isVisible(), 'print restores content from closed native modules');
      await page.emulateMedia({ media: 'screen' });
      assert.equal(await panel(page, 'schedule').isVisible(), false, 'leaving print keeps the user\'s hidden screen layout');
      await nav('classes').click();
      await handle(page, 'classes').focus(); await page.keyboard.press('Shift+F10');
      await page.getByRole('menuitem', { name: 'Reset layout', exact: true }).click();
      assert.equal(await page.locator('.pl-panel-hidden').count(), 0, 'Reset layout reopens all closed panes');
      await page.evaluate(() => window.fixtureRedraw(true));
      await page.waitForSelector('.pl-workspace-deck'); await frame(page);
      assert.equal(await page.locator('[data-pl-workspace-details][aria-expanded="true"]').count(), 0, 'new plan context discards old course Details');
      const overflow = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(overflow.content <= overflow.viewport + 1, `no document horizontal overflow: ${JSON.stringify(overflow)}`);
      await nav('find').click(); await hidePanel(page, 'find');
      await page.locator('.pl-workspace-original').click();
      await page.waitForSelector('.pl-workspace-deck', { state: 'detached' });
      assert.equal(await page.locator('[data-pl-panel-placement],.pl-floating-panel,.pl-panel-hidden,[data-pl-panel-close],[data-pl-panel-handle],[data-pl-dock-target],.pl-workspace-details-frame').count(), 0, 'Original layout removes all docking and closing presentation');
      assert.ok(await page.locator('.classPlanner_ClassSearchSection').isVisible(), 'Original layout restores a closed search module');
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
console.log(`Flexible panels passed at ${widths.join(', ')}px: native header dragging/cancel, full destination previews matching drops, no bottom docking, close/reopen and preserved selections, resize/dock, multiple details/native controls, modules, sidebar, redraws, printing and restoration.`);
