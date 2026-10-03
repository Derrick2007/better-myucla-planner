/** Local UpdatePanel-shaped empty-plan regression; never opens a real account. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { introductionFixtureHtml, emptyPlanFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..'), output = resolve(root, '../../outputs/empty-plan-workspace');
const js = await readFile(resolve(root, process.env.BETTER_MYUCLA_QA_JS || 'dist/content.js'), 'utf8');
const css = await readFile(resolve(root, 'dist/injected.css'), 'utf8');
const baseline = process.argv.includes('--expect-baseline-failure');
const widths = process.env.BETTER_MYUCLA_EMPTY_WIDTHS?.split(',').map(Number) || [2048, 1440, 1280, 390];
assert.ok(widths.length && widths.every(width => Number.isInteger(width) && width >= 320 && width <= 3840));
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
const fullHtml = introductionFixtureHtml(), emptyHtml = emptyPlanFixtureHtml();
const report = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function setup(page, initialHtml) {
  const errors = [], requests = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: initialHtml })
    : (requests.push(route.request().url()), route.abort()));
  await page.goto(url);
  await page.evaluate(emptyHtml => {
    const stored = { 'plannerLift.layout.v1': { tidy: true }, 'plannerLift.header.v1': { compact: true } }, listeners = [];
    window.fixtureStorageCalls = [];
    window.chrome = { storage: { local: {
      get: async key => { window.fixtureStorageCalls.push({ operation: 'get', key }); return { [key]: stored[key] }; },
      set: async values => { Object.keys(values).forEach(key => window.fixtureStorageCalls.push({ operation: 'set', key })); Object.assign(stored, values); },
      remove: async key => { window.fixtureStorageCalls.push({ operation: 'remove', key }); delete stored[key]; },
    }, onChanged: { addListener: fn => listeners.push(fn), removeListener: fn => { const at = listeners.indexOf(fn); if (at >= 0) listeners.splice(at, 1); } } } };
    window.toggleFixtureTidy = tidy => listeners.slice().forEach(fn => fn({ 'plannerLift.layout.v1': { newValue: { tidy } } }, 'local'));
    window.fixtureNewPlanClicks = 0;
    window.fixtureSearchChanges = 0;
    window.fixtureSearchSubmits = 0;
    window.fixtureUnexpectedNativeActions = 0;
    window.fixtureNewPlanHtml = emptyHtml;
    window.fixtureMasthead = document.getElementById('fixture-native-navigation');
    window.fixtureMastheadHtml = window.fixtureMasthead.outerHTML;
    const bindNativeFixture = () => {
      const selector = document.getElementById('ctl00_MainContent_cs_searchBy');
      selector.addEventListener('change', () => { window.fixtureSearchChanges++; });
      const panel = document.getElementById('ctl00_MainContent_classPlanPanel');
      panel.addEventListener('click', event => {
        if (event.target.closest('.OrderingButtons button, .ClassSearchList button, .ClassSearchList input')) window.fixtureUnexpectedNativeActions++;
      });
      const menu = document.querySelector('.plannerTopMenuLinks');
      menu.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (button && button.id !== 'newPlanMenuEntry') window.fixtureUnexpectedNativeActions++;
      });
      document.getElementById('newPlanMenuEntry').addEventListener('click', () => {
        window.fixtureNewPlanClicks++;
        window.renderFixturePlan(window.fixtureNewPlanHtml);
      });
      window.fixtureNative = {
        search: [...document.querySelectorAll('.ClassSearchControls input,.ClassSearchControls select')].map(node => ({ node, parent: node.parentElement })),
        menu: [...menu.querySelectorAll('button')].map(node => ({ node, parent: node.parentElement, hiddenStyle: node.style.display })),
        sections: [...panel.querySelectorAll(':scope > section')],
      };
    };
    window.renderFixturePlan = html => {
      const fresh = new DOMParser().parseFromString(html, 'text/html');
      const next = document.importNode(fresh.querySelector('.classPlannerWrapper'), true);
      document.getElementById('ctl00_MainContent_planIDField').value = fresh.getElementById('ctl00_MainContent_planIDField').value;
      document.querySelector('.classPlannerWrapper').replaceWith(next);
      bindNativeFixture();
    };
    document.getElementById('aspnetForm').addEventListener('submit', event => { event.preventDefault(); window.fixtureSearchSubmits++; });
    bindNativeFixture();
  }, emptyHtml);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  return { errors, requests };
}

async function nativePreserved(page) {
  const result = await page.evaluate(() => {
    const native = window.fixtureNative, form = document.getElementById('aspnetForm');
    return {
      search: native.search.every(({ node, parent }) => node.isConnected && node.form === form && (node.parentElement === parent || node.id === 'ctl00_MainContent_cs_goButton' && node.parentElement.matches('.pl-search-submit') && node.parentElement.parentElement === parent)),
      menu: native.menu.every(({ node, parent, hiddenStyle }) => node.isConnected && node.parentElement === parent && node.style.display === hiddenStyle),
      sections: native.sections.length === 6 && native.sections.every(node => node.isConnected && node.closest('form') === form),
      masthead: window.fixtureMasthead.isConnected && window.fixtureMasthead.outerHTML === window.fixtureMastheadHtml,
    };
  });
  assert.ok(Object.values(result).every(Boolean), `native identity/form/hidden choices/masthead preserved: ${JSON.stringify(result)}`);
}

async function assertEmptySafety(page, storageStart) {
  assert.equal(await page.locator('#div_landing,tbody.courseItem').count(), 0);
  assert.equal(await page.locator('#planner-lift-toolbar,#planner-lift-actionbar,[data-pl-real-tools],[data-pl-workspace-details]').count(), 0, 'an empty presentation cannot expose reorder/course-action tools');
  const state = await page.evaluate(start => {
    const controller = window.__plannerLiftController;
    const contextCalls = window.fixtureStorageCalls.slice(start).filter(call => /plannerLift\.(annotations|view|draft)\./.test(call.key));
    return { context: controller.activeContextKey, loading: controller.loadingContextKey, reorderContract: controller.adapter.inspectContract().ok, contextCalls, compact: document.querySelector('.pl-intro-compact')?.getAttribute('aria-pressed') };
  }, storageStart);
  assert.equal(state.context, null, 'empty presentation has no active account-plan storage context');
  assert.equal(state.loading, null, 'empty presentation does not activate a new context');
  assert.equal(state.reorderContract, false, 'the strict reorder adapter still rejects an empty plan');
  assert.deepEqual(state.contextCalls, [], 'empty presentation does not read/write course annotations, view state or drafts');
  assert.ok(await page.locator('#panelPlan > .classPlanner_SectionData > .no_data_text').isVisible(), 'the original empty-state message stays visible');
  assert.equal(await page.locator('.pl-workspace-details-slot').isVisible(), false, 'empty plans do not show a duplicate master/detail placeholder');
  const panel = await page.locator('#panelPlan').boundingBox(), section = await page.locator('.pl-workspace-plan').boundingBox();
  assert.ok(Math.abs(panel.width - section.width) <= 2, 'the native empty message uses the full Classes workspace width');
}

async function assertWorkspace(page, width) {
  await page.waitForSelector('.pl-workspace-deck');
  assert.equal(await page.locator('.pl-workspace-nav [data-pl-module]').count(), 6);
  const module = name => page.locator(`.pl-workspace-nav [data-pl-module="${name}"]`);
  const schedule = page.locator('.pl-workspace-calendar');
  for (const name of ['classes', 'find', 'optimizer', 'study', 'personal', 'information']) {
    await module(name).click();
    assert.equal(await module(name).getAttribute('aria-pressed'), 'true');
    assert.equal(await schedule.isVisible(), width >= 1100, 'schedule remains available beside every desktop module');
  }
  await module('find').click();
  const selector = page.locator('#ctl00_MainContent_cs_searchBy');
  assert.ok(await selector.isVisible());
  assert.ok(await page.locator('#searchTier0').isVisible());
  const changes = await page.evaluate(() => window.fixtureSearchChanges);
  await selector.selectOption('instructor');
  assert.equal(await page.evaluate(() => window.fixtureSearchChanges), changes + 1, 'the original native search handler runs only for the explicit selection');
  assert.equal(await page.evaluate(() => window.fixtureSearchSubmits), 0);
  if (width < 1100) {
    await page.locator('.pl-workspace-schedule-toggle').click();
    assert.ok(await schedule.isVisible());
    await page.keyboard.press('Escape');
  }
  await nativePreserved(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'empty workspace has no horizontal page overflow');
}

async function returnToWorkspace(page) {
  const button = page.locator('.pl-workspace-return');
  if (await button.count()) await button.press('Enter');
  await page.waitForSelector('.pl-workspace-deck');
}

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const checks = await setup(page, fullHtml);
    await page.waitForSelector('.pl-workspace-deck');
    await page.locator('[data-pl-workspace-details]').first().click();
    assert.ok(await page.locator('.pl-workspace-preview').isVisible());
    await page.locator('.pl-workspace-plan-actions > summary').click();
    const storageStart = await page.evaluate(() => window.fixtureStorageCalls.length);
    await page.locator('#newPlanMenuEntry').click();
    await page.waitForSelector('#panelPlan .no_data_text');
    await settle(page);
    assert.equal(await page.evaluate(() => window.fixtureNewPlanClicks), 1, 'the original New Plan handler runs exactly once');
    if (baseline) {
      assert.equal(await page.locator('.pl-workspace-deck').count(), 0, 'old build drops the workspace after native New Plan creates an empty view');
      await page.screenshot({ path: resolve(output, `baseline-new-plan-${width}.png`) });
      report.push({ width, baselineRegressionReproduced: true });
      await page.close();
      continue;
    }
    await assertWorkspace(page, width);
    await page.locator('.pl-workspace-nav [data-pl-module="classes"]').click();
    await assertEmptySafety(page, storageStart);
    await page.screenshot({ path: resolve(output, `empty-classes-${width}.png`) });
    await page.locator('.pl-workspace-plan-actions > summary').click();
    assert.equal(await page.locator('.plannerTopMenuLinks button:visible').count(), 2, 'only native Load and About remain visible for an unsaved empty plan');
    assert.ok(await page.locator('#loadMenuEntry').isVisible() && await page.locator('#aboutMenuEntry').isVisible());
    await page.keyboard.press('Escape');
    await page.locator('.pl-workspace-nav [data-pl-module="find"]').click();
    await page.screenshot({ path: resolve(output, `empty-find-${width}.png`) });

    await page.locator('.pl-workspace-original').click();
    assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(), 6);
    await nativePreserved(page);
    await returnToWorkspace(page);
    await page.evaluate(() => window.toggleFixtureTidy(false));
    await page.waitForSelector('.pl-workspace-deck', { state: 'detached' });
    assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(), 6);
    await nativePreserved(page);
    await page.evaluate(() => window.toggleFixtureTidy(true));
    await returnToWorkspace(page);
    await page.locator('.pl-workspace-nav [data-pl-module="classes"]').click();
    await assertEmptySafety(page, storageStart);

    await page.evaluate(html => window.renderFixturePlan(html), fullHtml);
    await page.waitForSelector('#planner-lift-toolbar');
    await page.waitForSelector('.pl-workspace-deck');
    assert.equal(await page.locator('[data-pl-workspace-details]').count(), 6, 'a later populated redraw reactivates normal course tools');
    assert.ok(await page.evaluate(() => window.__plannerLiftController.adapter.inspectContract().ok));
    await nativePreserved(page);
    await page.evaluate(html => window.renderFixturePlan(html), emptyHtml);
    await page.waitForSelector('.pl-workspace-deck');
    await page.waitForSelector('#planner-lift-toolbar', { state: 'detached' });

    // Invalidating a marker in place must be detected even when #panelPlan and
    // every outer wrapper retain identity. Restoration uses the same node.
    await page.evaluate(() => {
      const marker = document.querySelector('#panelPlan .no_data_text');
      window.removedEmptyMarker = marker;
      marker.remove();
    });
    await page.waitForSelector('.pl-workspace-deck', { state: 'detached' });
    assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(), 6, 'malformed empty shape fails closed to all native modules');
    await nativePreserved(page);
    await page.evaluate(() => document.querySelector('#panelPlan > .classPlanner_SectionData').prepend(window.removedEmptyMarker));
    await returnToWorkspace(page);
    await page.locator('.pl-workspace-original').click();
    await page.evaluate(() => {
      const marker = document.querySelector('#panelPlan .no_data_text');
      window.removedEmptyMarker = marker; marker.remove();
    });
    await settle(page);
    if (await page.locator('.pl-workspace-return').count()) await page.locator('.pl-workspace-return').press('Enter');
    await settle(page);
    assert.equal(await page.locator('.pl-workspace-deck').count(), 0, 'return from Original layout cannot bypass empty-shape validation');
    await page.evaluate(() => document.querySelector('#panelPlan > .classPlanner_SectionData').prepend(window.removedEmptyMarker));
    await returnToWorkspace(page);
    await page.evaluate(() => window.__plannerLiftController.dispose());
    assert.equal(await page.locator('.pl-workspace-deck').count(), 0);
    assert.equal(await page.locator('#ctl00_MainContent_classPlanPanel > section').count(), 6);
    await nativePreserved(page);
    assert.equal(await page.evaluate(() => window.fixtureUnexpectedNativeActions), 0);
    assert.deepEqual(checks.errors, []); assert.deepEqual(checks.requests, []);
    await page.close();

    const initial = await browser.newPage({ viewport: { width, height: 900 } });
    const initialChecks = await setup(initial, emptyHtml);
    await assertWorkspace(initial, width);
    await initial.locator('.pl-workspace-nav [data-pl-module="classes"]').click();
    await assertEmptySafety(initial, 0);
    assert.equal(await initial.evaluate(() => window.fixtureNewPlanClicks), 0, 'initial empty mount does not invoke native New Plan');
    await initial.evaluate(html => window.renderFixturePlan(html), fullHtml);
    await initial.waitForSelector('#planner-lift-toolbar');
    assert.equal(await initial.locator('[data-pl-workspace-details]').count(), 6, 'initial-empty observer activates a later complete plan');

    // Keep stale full-course references in memory while the native Original
    // layout receives an unfamiliar empty response. A return click must not
    // use those detached references to bypass the strict empty-plan contract.
    await initial.locator('.pl-workspace-original').click();
    await initial.evaluate(html => {
      const malformed = new DOMParser().parseFromString(html, 'text/html');
      malformed.querySelector('#panelPlan .no_data_text').remove();
      window.fixtureNewPlanHtml = malformed.documentElement.outerHTML;
    }, emptyHtml);
    await initial.locator('#newPlanMenuEntry').press('Enter');
    await initial.waitForSelector('#fixture-empty-status');
    await settle(initial);
    if (await initial.locator('.pl-workspace-return').count()) await initial.locator('.pl-workspace-return').press('Enter');
    await settle(initial);
    assert.equal(await initial.locator('.pl-workspace-deck').count(), 0, 'stale populated snapshots cannot reopen a malformed empty workspace');
    assert.equal(await initial.locator('#planner-lift-toolbar,[data-pl-workspace-details],[data-pl-real-tools]').count(), 0);
    assert.equal(await initial.evaluate(() => window.fixtureNewPlanClicks), 1);
    assert.equal(await initial.evaluate(() => window.__plannerLiftController.adapter.inspectContract().ok), false);
    await nativePreserved(initial);
    assert.equal(await initial.evaluate(() => window.fixtureUnexpectedNativeActions), 0);
    assert.deepEqual(initialChecks.errors, []); assert.deepEqual(initialChecks.requests, []);
    await initial.close();
    report.push({ width, newPlan: true, initialEmpty: true, restored: true, malformedFailClosed: true, noEmptyContext: true });
    console.log(`Empty plan ${width}px: native New Plan, all modules/search/calendar, start-empty/redraws, fail-closed restoration and no action/storage activation passed`);
  }
} finally {
  await browser.close();
}
await writeFile(resolve(output, baseline ? 'baseline-results.json' : 'verified-results.json'), JSON.stringify(report, null, 2));
if (baseline) console.log(`Confirmed the old empty-plan workspace regression at ${widths.join(', ')}px.`);
