/** v0.19 production workspace QA. Fictional HTML only; all requests intercepted. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { introductionFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '../../outputs/workspace-groups');
const css = await readFile(resolve(root, 'dist/injected.css'), 'utf8');
const js = await readFile(resolve(root, 'dist/content.js'), 'utf8');
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
const key = 'plannerLift.workspace.v2';
const legacyKey = 'plannerLift.workspace.v1';
const widths = process.env.BETTER_MYUCLA_GROUP_WIDTHS?.split(',').map(Number) || [2048, 1440, 1280, 960, 390];
assert.ok(widths.length && widths.every(width => Number.isInteger(width) && width >= 320 && width <= 3840));
const reports = [];
const frame = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const panelSelectors = {
  classes: '.pl-workspace-plan', find: '.pl-workspace-search', schedule: '.pl-workspace-calendar',
  optimizer: '.classPlanner_ClassOptimizerSection', study: '.classPlanner_EnrolledNotInPlanSection', personal: '.classPlanner_PersonalTimeBlocksSection',
};
const panel = (page, id) => page.locator(panelSelectors[id]);
const tab = (page, id) => page.locator(`[data-pl-tab="${id}"]`);
const nav = (page, id) => page.locator(`.pl-workspace-nav [data-pl-module="${id}"]`);
const stored = page => page.evaluate(() => structuredClone(window.fixtureStored));
const groups = async page => (await stored(page))[key]?.groups;

async function open(browser, width, saved = {}) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  page.setDefaultTimeout(7000);
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: introductionFixtureHtml(12, true, 12) })
    : (requests.push(route.request().url()), route.abort()));
  await page.goto(url);
  await page.evaluate(saved => {
    const listeners = [], stored = { 'plannerLift.layout.v1': { tidy: true }, 'plannerLift.header.v1': { compact: true }, ...saved };
    window.fixtureStored = stored;
    window.fixtureWrites = []; window.fixtureCalls = []; window.fixtureSubmits = [];
    window.chrome = { storage: { local: {
      get: async key => typeof key === 'string' ? { [key]: structuredClone(stored[key]) } : structuredClone(stored),
      set: async values => { window.fixtureWrites.push(structuredClone(values)); Object.assign(stored, structuredClone(values)); },
      remove: async key => delete stored[key],
    }, onChanged: { addListener: fn => listeners.push(fn), removeListener() {} } } };
    window.fixtureTidy = tidy => listeners.forEach(fn => fn({ 'plannerLift.layout.v1': { newValue: { tidy } } }, 'local'));
    document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); window.fixtureSubmits.push(event.submitter?.id || 'implicit'); });
    window.__doPostBack = (...args) => window.fixtureCalls.push(args);
    const original = document.querySelector('.classPlannerWrapper').outerHTML;
    window.fixtureCapture = () => {
      window.fixtureControls = [...document.querySelectorAll('.classPlannerWrapper input,.classPlannerWrapper select,.classPlannerWrapper button,.classPlannerWrapper a')]
        .filter(node => !node.closest('[data-planner-lift-owned]')).map(node => ({ node, parent: node.parentElement, form: node.form, handler: node.getAttribute('onclick') }));
      window.fixtureRows = [...document.querySelectorAll('tbody.courseItem > tr:nth-child(3)')].map(node => ({ node, parent: node.parentElement }));
      window.fixtureStatuses = [...document.querySelectorAll('table.coursetable td:nth-child(3)')].map(node => ({ node, html: node.innerHTML }));
    };
    window.fixtureCapture();
    window.fixtureNavigation = document.getElementById('fixture-native-navigation');
    window.fixtureNavigationHtml = window.fixtureNavigation.outerHTML;
    window.fixtureRedraw = () => {
      const template = document.createElement('template'); template.innerHTML = original;
      document.querySelector('.classPlannerWrapper').replaceWith(template.content.firstElementChild);
      window.fixtureCapture();
    };
  }, saved);
  await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
  await page.waitForSelector('.pl-workspace-group-strip:visible'); await frame(page);
  return { page, errors, requests };
}

async function identity(page) {
  const proof = await page.evaluate(() => ({
    controls: window.fixtureControls.every(({ node, parent, form, handler }) => node.isConnected && node.form === form && node.getAttribute('onclick') === handler
      && (node.parentElement === parent || (node.id === 'ctl00_MainContent_cs_goButton' && node.parentElement?.matches('span.pl-search-submit') && node.parentElement.parentElement === parent))),
    rows: window.fixtureRows.every(({ node, parent }) => node.isConnected && node.parentElement === parent),
    statuses: window.fixtureStatuses.every(({ node, html }) => node.isConnected && node.innerHTML === html),
    navigation: window.fixtureNavigation.isConnected && window.fixtureNavigation.outerHTML === window.fixtureNavigationHtml,
    forms: document.querySelectorAll('form').length,
    submissions: window.fixtureSubmits.length,
  }));
  assert.deepEqual(proof, { controls: true, rows: true, statuses: true, navigation: true, forms: 1, submissions: 0 });
}

async function geometry(page) {
  const layout = await page.evaluate(selectors => {
    const visible = node => node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      strips: [...document.querySelectorAll('.pl-workspace-group-strip')].filter(visible).map(node => ({ dock: node.dataset.plGroup, box: node.getBoundingClientRect().toJSON() })),
      panes: Object.entries(selectors).map(([id, selector]) => ({ id, node: document.querySelector(selector) }))
        .filter(({ node }) => visible(node) && !node.classList.contains('pl-floating-panel'))
        .map(({ id, node }) => ({ id, placement: node.dataset.plPanelPlacement, box: node.getBoundingClientRect().toJSON() })),
      viewport: innerWidth,
    };
  }, panelSelectors);
  assert.ok(layout.overflow <= 1, `no horizontal document overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.panes.length <= 2, `at most two visible docked panels: ${JSON.stringify(layout)}`);
  for (const item of layout.panes) assert.ok(item.box.left >= -1 && item.box.right <= layout.viewport + 1 && item.box.width > 0, `${item.id} has usable viewport bounds`);
  if (layout.panes.length === 2) {
    const [a, b] = layout.panes;
    assert.ok(Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) <= 1, 'native active panels never overlap');
    const floors = { classes: 420, find: 560, schedule: 420, optimizer: 480, study: 480, personal: 420 };
    for (const item of layout.panes) assert.ok(item.box.width >= floors[item.id] - 1, `${item.id} respects its readable minimum width: ${item.box.width}`);
  }
  return layout;
}

async function select(page, id) { await nav(page, id).click(); await frame(page); }
async function tabClose(page, id) {
  const close = page.locator(`[data-pl-tab-close="${id}"]`);
  await close.click(); await frame(page);
}

async function verifyDragging(browser) {
  const run = await open(browser, 1440), { page } = run;
  const start = async id => {
    const box = await tab(page, id).boundingBox();
    assert.ok(box, `${id} supplies a visible tab drag surface`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  };
  const preview = () => page.locator('.pl-panel-drop-preview:visible');
  const hoverCenter = async id => {
    const box = await panel(page, id).boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 }); await frame(page);
    assert.equal(await preview().getAttribute('data-pl-drop-operation'), 'merge');
    return preview().boundingBox();
  };
  try {
    await select(page, 'find');
    const before = await stored(page), beforeGroups = await groups(page);
    await start('find'); await hoverCenter('schedule');
    assert.deepEqual(await stored(page), before, 'held tab drag never persists transient active or floating state');
    await page.keyboard.press('Escape'); await page.mouse.up(); await frame(page);
    assert.deepEqual(await groups(page), beforeGroups, 'Escape restores tab membership and selected siblings');
    assert.equal(await panel(page, 'find').getAttribute('data-pl-panel-placement'), beforeGroups.panels.find.placement);
    // Commit the same center drop and compare its advertised pane geometry.
    await start('find'); const target = await hoverCenter('schedule');
    await page.screenshot({ path: resolve(output, 'center-drop-preview-1440.png') });
    await page.mouse.up(); await frame(page);
    const merged = await groups(page), actual = await panel(page, 'find').boundingBox();
    assert.equal(merged.panels.find.placement, merged.panels.schedule.placement);
    assert.equal(merged.active[merged.panels.find.placement], 'find');
    assert.equal(await panel(page, 'schedule').isVisible(), false);
    assert.ok(Math.abs(actual.x - target.x) <= 2 && Math.abs(actual.width - target.width) <= 2
      && Math.abs(actual.y - target.y - 40) <= 2 && Math.abs(actual.height - target.height + 40) <= 2,
      `center preview exactly describes the tab group, including its strip: ${JSON.stringify({ target, actual })}`);
    await geometry(page); await identity(page);
    // Closing the other group leaves room to split a readable second column.
    await tabClose(page, 'classes');
    const deck = await page.locator('.pl-workspace-deck').boundingBox();
    await start('find');
    await page.mouse.move(deck.x + 20, deck.y + deck.height / 2, { steps: 8 }); await frame(page);
    assert.equal(await preview().getAttribute('data-pl-drop-operation'), 'split');
    assert.equal(await preview().getAttribute('data-pl-dock-target'), 'left');
    const splitPreview = await preview().boundingBox();
    await page.screenshot({ path: resolve(output, 'edge-drop-preview-1440.png') });
    await page.mouse.up(); await frame(page);
    const split = await groups(page), splitActual = await panel(page, 'find').boundingBox();
    assert.equal(split.panels.find.placement, 'left'); assert.equal(split.panels.schedule.placement, 'right');
    assert.ok(Math.abs(splitActual.x - splitPreview.x) <= 2 && Math.abs(splitActual.width - splitPreview.width) <= 2);
    await geometry(page); await identity(page);
    // Reopening Classes must join an existing group, not recreate a thin third.
    await select(page, 'classes'); await geometry(page);
    assert.equal(new Set(Object.values((await groups(page)).panels).filter(item => item.open && item.placement !== 'floating').map(item => item.placement)).size, 2);
    await select(page, 'find');
    const saved = await stored(page);
    await start('find'); await page.mouse.move(720, 85, { steps: 8 }); await frame(page);
    assert.equal(await panel(page, 'find').getAttribute('data-pl-panel-placement'), 'floating', 'actual panel follows the drag out');
    await page.evaluate(() => window.fixtureRedraw()); await frame(page); await page.mouse.up(); await frame(page);
    assert.deepEqual(await groups(page), saved[key].groups, 'native redraw cancels the gesture and restores the committed tab group');
    await identity(page); await geometry(page);
    assert.deepEqual(run.errors, []); assert.deepEqual(run.requests, []);
    console.log('PASS 1440px: center merge, edge split, filled previews, cancel, redraw and no third column');
  } catch (error) {
    await page.screenshot({ path: resolve(output, 'drag-failure-1440.png') }); throw error;
  } finally { await page.close(); }
}

async function verifyGroupControls(browser) {
  const run = await open(browser, 1440), { page } = run;
  try {
    for (const id of ['find', 'optimizer', 'study', 'personal']) await select(page, id);
    const beforeScroll = await page.evaluate(() => scrollY);
    const schedule = await panel(page, 'schedule').boundingBox();
    const divider = page.locator('[data-pl-dock-divider]:visible');
    const grip = await divider.boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
    await page.mouse.move(grip.x - 70, grip.y + grip.height / 2, { steps: 6 }); await page.mouse.up(); await frame(page);
    const resized = await panel(page, 'schedule').boundingBox();
    assert.ok(resized.width > schedule.width + 20, 'group divider changes the pane balance');
    const widen = page.getByRole('button', { name: 'Widen schedule', exact: true });
    if (await widen.isVisible()) {
      await widen.click(); await frame(page);
      const widened = await panel(page, 'schedule').boundingBox();
      assert.ok(widened.width > resized.width, 'Widen works after a custom divider size');
      await page.getByRole('button', { name: 'Restore schedule width', exact: true }).click(); await frame(page);
      assert.ok(Math.abs((await panel(page, 'schedule').boundingBox()).width - resized.width) <= 2, 'Restore returns the user divider size');
    }
    for (const id of ['personal', 'classes', 'study', 'find']) {
      await select(page, id);
      const bounds = await tab(page, id).evaluate(node => {
        const tab = node.getBoundingClientRect(), strip = node.closest('.pl-workspace-group-strip').getBoundingClientRect();
        return { left: tab.left, right: tab.right, stripLeft: strip.left, stripRight: strip.right };
      });
      assert.ok(bounds.left >= bounds.stripLeft - 1 && bounds.right <= bounds.stripRight + 1, 'sidebar selection reveals its active tab within the strip');
    }
    assert.equal(await page.evaluate(() => scrollY), beforeScroll, 'tab strip navigation never jumps the document');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.pl-workspace-group-strip:visible').count(), 0, 'print removes owned tab strips');
    for (const id of Object.keys(panelSelectors)) assert.equal(await panel(page, id).isVisible(), true, `print restores the native ${id} module`);
    await page.emulateMedia({ media: 'screen' }); await frame(page); await identity(page);
    for (const id of ['classes', 'find', 'optimizer', 'study', 'personal', 'schedule']) await tabClose(page, id);
    assert.equal(await page.locator('.pl-workspace-group-strip:visible').count(), 0);
    assert.equal(await page.locator('.pl-workspace-dock-placeholder').isVisible(), true, 'closing every group leaves reachable reopening guidance');
    await select(page, 'classes'); assert.equal(await panel(page, 'classes').isVisible(), true);
    await identity(page); await geometry(page);
    assert.deepEqual(run.errors, []); assert.deepEqual(run.requests, []);
    console.log('PASS group controls: divider, Widen/Restore, active-tab reveal, print, all-closed and reopening');
  } catch (error) {
    await page.screenshot({ path: resolve(output, 'group-controls-failure.png') }); throw error;
  } finally { await page.close(); }
}

const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
await mkdir(output, { recursive: true });
try {
  for (const width of widths) {
    const run = await open(browser, width), { page } = run;
    const report = { width, passed: false }; reports.push(report);
    try {
      await identity(page); await geometry(page);
      await select(page, 'schedule');
      assert.equal(await panel(page, 'schedule').isVisible(), true, 'Schedule navigation reveals the actual native calendar at every width');
      assert.equal(await page.locator('#studylistCheck').isVisible(), true, 'selected Schedule includes its original visible display controls');
      await geometry(page); await select(page, 'classes');
      await select(page, 'find');
      assert.ok(await panel(page, 'find').isVisible(), 'Find opens in a visible group');
      assert.equal(await panel(page, 'classes').isVisible(), false, 'inactive Classes is retained but not visually stacked');
      assert.equal(await tab(page, 'find').getAttribute('aria-selected'), 'true');
      const findGeometry = await geometry(page);
      const scheduleBefore = findGeometry.panes.find(item => item.id === 'schedule')?.box;
      await page.screenshot({ path: resolve(output, `find-${width}.png`) });
      await tab(page, 'classes').click(); await frame(page);
      assert.equal(await tab(page, 'classes').getAttribute('aria-selected'), 'true');
      const classGeometry = await geometry(page);
      const scheduleAfter = classGeometry.panes.find(item => item.id === 'schedule')?.box;
      if (scheduleBefore && scheduleAfter) assert.deepEqual(scheduleAfter, scheduleBefore, 'switching browsing tabs keeps Schedule in place');
      await identity(page);
      await tab(page, 'classes').focus(); await page.keyboard.press('ArrowRight'); await frame(page);
      assert.equal(await tab(page, 'find').getAttribute('aria-selected'), 'true', 'arrow keys select the next group tab');
      assert.equal(await tab(page, 'find').evaluate(node => document.activeElement === node), true, 'keyboard selection moves focus with the tab');
      // Native fields remain in their original nodes and retain a user selection.
      await select(page, 'find');
      const checkbox = page.locator('#container_course_M0 input[type="checkbox"]').first();
      if (await checkbox.count()) {
        await checkbox.check(); await tab(page, 'classes').click(); await tab(page, 'find').click();
        assert.equal(await checkbox.isChecked(), true, 'switching tabs preserves native section selection');
      }
      await tabClose(page, 'find');
      assert.equal(await tab(page, 'find').isVisible(), false, 'closed tab leaves the visible strip');
      await select(page, 'find');
      assert.equal(await tab(page, 'find').getAttribute('aria-selected'), 'true', 'sidebar reopens its remembered tab');
      const remembered = await groups(page);
      assert.equal(remembered.panels.find.placement, remembered.panels.classes.placement, 'Find retains browsing membership');
      await identity(page); await geometry(page);
      const saved = await stored(page);
      assert.equal(saved[key].version, 2);
      assert.doesNotMatch(JSON.stringify(saved[key]), /Example|9999999999|container_course|Instructor|Hall|MWF|fixtureNative/);
      await page.close();
      const restored = await open(browser, width, saved);
      assert.equal(await tab(restored.page, 'find').getAttribute('aria-selected'), 'true', 'fresh document restores the active group tab');
      assert.deepEqual(await restored.page.evaluate(() => window.fixtureCalls), [], 'restoring groups does not invoke native actions');
      await identity(restored.page); await geometry(restored.page);
      await restored.page.evaluate(() => window.fixtureRedraw()); await frame(restored.page);
      await restored.page.waitForSelector('.pl-workspace-group-strip:visible');
      assert.equal(await tab(restored.page, 'find').getAttribute('aria-selected'), 'true', 'native redraw preserves active tab');
      await identity(restored.page);
      await restored.page.getByRole('button', { name: 'Default layout', exact: true }).click(); await frame(restored.page);
      assert.equal(await tab(restored.page, 'classes').getAttribute('aria-selected'), 'true');
      assert.deepEqual(await restored.page.evaluate(() => window.fixtureCalls), [], 'reset never invokes native actions');
      await restored.page.getByRole('button', { name: 'Original layout', exact: true }).click(); await frame(restored.page);
      assert.equal(await restored.page.locator('.pl-workspace-group-strip').count(), 0, 'Original layout removes every owned group strip');
      await identity(restored.page);
      assert.deepEqual(run.errors, []); assert.deepEqual(run.requests, []);
      assert.deepEqual(restored.errors, []); assert.deepEqual(restored.requests, []);
      await restored.page.close(); report.passed = true;
      console.log(`PASS ${width}px: grouped browsing, native controls, close/reopen, persistence, redraw and restoration`);
    } catch (error) {
      report.error = error.message;
      if (!page.isClosed()) await page.screenshot({ path: resolve(output, `failure-${width}.png`) });
      throw error;
    }
  }
  // Upgrade the exact shape that produced an accidental third browsing column.
  const legacy = { version: 1, module: 'classes', mainModule: 'classes', navigationCollapsed: false,
    scheduleWidth: 900, scheduleExpanded: false, dockSizes: { left: 900, right: 500 }, collapsedPanes: [],
    panels: [{ id: 'schedule', placement: 'left', hidden: false }, { id: 'classes', placement: 'right', hidden: false }, { id: 'find', placement: 'main', hidden: true }],
  };
  const migration = await open(browser, 2048, { [legacyKey]: legacy });
  await select(migration.page, 'find');
  const upgraded = await groups(migration.page);
  assert.equal(upgraded.panels.find.placement, upgraded.panels.classes.placement);
  assert.equal(upgraded.panels.schedule.placement, 'left');
  assert.deepEqual((await stored(migration.page))[legacyKey], legacy, 'v0.18 rollback layout remains untouched');
  await geometry(migration.page); await identity(migration.page);
  await migration.page.screenshot({ path: resolve(output, 'legacy-migration-2048.png') });
  await migration.page.close();
  console.log('PASS v0.18 migration: Find joins browsing, Schedule stays left, rollback data unchanged');
  await verifyDragging(browser);
  await verifyGroupControls(browser);
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(reports, null, 2));
  await browser.close();
}
