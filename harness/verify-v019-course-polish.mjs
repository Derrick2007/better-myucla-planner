/** Fictional production course presentation; never loads a student's page. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { nativeDetailFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '../../outputs/v019-course-polish');
const css = await readFile(resolve(root, process.env.BETTER_MYUCLA_POLISH_SOURCE_CSS ? 'public/injected.css' : 'dist/injected.css'), 'utf8');
const js = await readFile(resolve(root, 'dist/content.js'), 'utf8');
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
const widths = process.env.BETTER_MYUCLA_POLISH_WIDTHS?.split(',').map(Number) || [2048, 1440, 1280, 960, 390];
assert.ok(widths.every(width => Number.isInteger(width) && width >= 320 && width <= 3840));
const screenshotOnly = process.argv.includes('--screenshots-only');
const fixture = () => {
  const doc = new JSDOM(nativeDetailFixtureHtml()).window.document;
  const title = doc.querySelector('tbody.courseItem > tr:first-child .SubjectAreaName_ClassName p:last-child');
  title.textContent = '101 - Foundations of Computing, Design and Responsible Systems';
  for (const cell of doc.querySelectorAll('tbody.courseItem table.coursetable tbody:nth-child(2) td:nth-child(7)')) cell.textContent = 'Example Learning Center 210';
  return doc.documentElement.outerHTML;
};
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
await mkdir(output, { recursive: true });
const report = [];
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === url
      ? route.fulfill({ status: 200, contentType: 'text/html', body: fixture() })
      : (requests.push(route.request().url()), route.abort()));
    await page.goto(url);
    await page.evaluate(() => {
      const stored = { 'plannerLift.layout.v1': { tidy: true }, 'plannerLift.header.v1': { compact: true } }, listeners = [];
      window.chrome = { storage: { local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values), remove: async key => delete stored[key] }, onChanged: { addListener: listener => listeners.push(listener), removeListener: () => {} } } };
      window.fixtureTidy = tidy => listeners.forEach(listener => listener({ 'plannerLift.layout.v1': { newValue: { tidy } } }, 'local'));
      window.fixtureNative = [...document.querySelectorAll('tbody.courseItem table.coursetable')].map(table => ({
        table, parent: table.parentElement,
        rows: [...table.rows].filter(row => row.cells.length === 9 && row.cells[0].tagName === 'TD').map(row => ({
          row, parent: row.parentElement, cells: [...row.cells], status: row.cells[2].innerHTML,
          controls: [...row.querySelectorAll('button,a,input,select')].map(node => ({ node, parent: node.parentElement, form: node.form, onclick: node.getAttribute('onclick') }))
        }))
      }));
      window.fixtureResults = [...document.querySelectorAll('.ClassSearchList .data_row')].map(row => ({
        row, parent: row.parentElement, cells: [...row.children], status: row.children[2].innerHTML,
        controls: [...row.querySelectorAll('button,a,input,select')].map(node => ({ node, parent: node.parentElement, form: node.form, onclick: node.getAttribute('onclick') }))
      }));
    });
    await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
    await page.waitForSelector('.pl-workspace-group-strip:not([hidden])');
    await page.screenshot({ path: resolve(output, `classes-${width}.png`) });
    await page.locator('[data-pl-workspace-details]').nth(0).click();
    await page.screenshot({ path: resolve(output, `details-${width}.png`) });
    const measurements = await page.evaluate(() => {
      const course = document.querySelector('.pl-preview-docked'), table = course.querySelector('.pl-section-table');
      const fields = [...table.querySelectorAll('.pl-section-field')];
      const metadata = fields.filter(cell => ['6', '8'].includes(cell.dataset.plField));
      const firstRow = table.querySelector('.pl-section-card').getBoundingClientRect();
      const identity = window.fixtureNative.every(({ table, parent, rows }) => table.parentElement === parent && rows.every(({ row, parent, cells, status, controls }) => row.parentElement === parent && cells.every((cell, index) => row.cells[index] === cell) && row.cells[2].innerHTML === status && controls.every(({ node, parent, form, onclick }) => node.parentElement === parent && node.form === form && node.getAttribute('onclick') === onclick)));
      const action = table.querySelector('[data-pl-field="0"] > a, [data-pl-field="0"] > button')?.getBoundingClientRect();
      return { identity, fontSizes: fields.map(cell => Number.parseFloat(getComputedStyle(cell).fontSize)),
        metadataVisible: metadata.every(cell => getComputedStyle(cell).display !== 'none' && cell.getBoundingClientRect().height > 0),
        pageWidth: document.documentElement.scrollWidth, viewport: innerWidth,
        firstRow: { width: firstRow.width, height: firstRow.height }, action: action ? { width: action.width, height: action.height } : null,
        summaryFont: Number.parseFloat(getComputedStyle(course.querySelector('.pl-workspace-course-summary')).fontSize)
      };
    });
    if (!screenshotOnly) {
      assert.ok(measurements.identity, `${width}: native status and control identity`);
      assert.ok(measurements.metadataVisible, `${width}: rooms/instructors remain visible`);
      assert.ok(measurements.fontSizes.every(size => size >= 14), `${width}: detail body text >=14px: ${measurements.fontSizes}`);
      assert.ok(measurements.summaryFont >= 14, `${width}: summary body text >=14px`);
      assert.ok(measurements.pageWidth <= width + 1, `${width}: no horizontal page overflow`);
      if (measurements.action) assert.ok(measurements.action.width >= 32 && measurements.action.height >= 32, `${width}: native action target at least32px`);
    }
    // Simultaneous details must retain both native tables and local scrolling.
    await page.locator('[data-pl-workspace-details]').nth(1).click();
    assert.equal(await page.locator('[data-pl-workspace-details][aria-expanded="true"]').count(), 2);
    const jumps=page.locator('.pl-workspace-detail-jump');
    assert.equal(await jumps.count(),2);
    assert.ok(await page.locator('.pl-workspace-detail-index').isVisible());
    assert.equal(await page.locator('.pl-workspace-detail-index').evaluate(node=>getComputedStyle(node).boxShadow),'none');
    const beforeJump=await page.evaluate(()=>scrollY);
    await jumps.nth(0).click();
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    assert.ok(await page.locator('.pl-workspace-details-slot').evaluate(node=>node.scrollTop<2),`${width}: first jump returns to stack start`);
    await jumps.nth(0).press('End');
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    assert.equal(await jumps.nth(1).getAttribute('aria-current'),'true');
    assert.ok(await jumps.nth(1).evaluate(node=>node===document.activeElement));
    assert.ok(await page.locator('.pl-workspace-details-slot').evaluate(node=>node.scrollTop>0),`${width}: last jump moves local stack`);
    assert.equal(await page.evaluate(()=>scrollY),beforeJump,`${width}: detail jumps preserve document position`);
    await page.screenshot({ path: resolve(output, `multiple-details-${width}.png`) });
    await page.locator('.pl-workspace-group-tab[data-pl-tab="find"]').click();
    await page.waitForSelector('.pl-browser-list');
    await page.screenshot({ path: resolve(output, `find-${width}.png`) });
    assert.ok(await page.evaluate(() => window.fixtureResults.every(({ row, parent, cells, status, controls }) => row.parentElement === parent && cells.every((cell, index) => row.children[index] === cell) && row.children[2].innerHTML === status && controls.every(({ node, parent, form, onclick }) => node.parentElement === parent && node.form === form && node.getAttribute('onclick') === onclick))), `${width}: native result status and control identity`);
    if (!screenshotOnly) assert.ok(await page.evaluate(() => [...document.querySelectorAll('.pl-browser-body-active .pl-section-field')].every(cell => Number.parseFloat(getComputedStyle(cell).fontSize) >= 14 && (!['6', '8'].includes(cell.dataset.plField) || (getComputedStyle(cell).display !== 'none' && cell.getBoundingClientRect().height > 0)))), `${width}: readable visible result metadata`);
    await page.evaluate(() => window.fixtureTidy(false));
    await page.waitForFunction(() => !document.querySelector('.pl-workspace-deck'));
    assert.ok(await page.evaluate(() => window.fixtureNative.every(({ table, parent, rows }) => table.parentElement === parent && !table.classList.contains('pl-section-table') && rows.every(({ row, parent, status }) => row.parentElement === parent && row.cells[2].innerHTML === status && !row.hasAttribute('data-pl-field')))), `${width}: Original layout restores original tables`);
    if (width === 1440) {
      // An unexpected tenth native cell must retain the native result shape.
      await page.evaluate(() => {
        const row = document.querySelector('.ClassSearchList .data_row');
        const cell = document.createElement('div'); cell.className = 'example-unknown-cell'; cell.textContent = 'Example unfamiliar field'; row.append(cell);
        window.fixtureTidy(true);
      });
      await page.waitForSelector('.pl-workspace-deck');
      await page.locator('.pl-workspace-group-tab[data-pl-tab="find"]').click();
      assert.equal(await page.locator('.ClassSearchList .pl-section-field').count(), 0, 'unfamiliar result rows retain native presentation');
      assert.equal(await page.locator('.pl-browser-list').count(), 0, 'unfamiliar result shape does not gain a local browser');
    }
    assert.deepEqual(errors, [], `${width}: no page errors`); assert.deepEqual(requests, [], `${width}: no requests`);
    report.push({ width, ...measurements }); await page.close();
    console.log(`PASS ${width}px course/detail presentation and Original layout`);
  }
} finally { await browser.close(); }
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
