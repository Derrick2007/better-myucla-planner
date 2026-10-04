/** Fictional native plan details; no account data or outgoing requests. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { nativeDetailFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..'), output = resolve(root, '../../outputs/native-detail-layout');
const cssPath = resolve(root, process.env.BETTER_MYUCLA_QA_CSS || 'dist/injected.css');
const css = await readFile(cssPath, 'utf8'), js = await readFile(resolve(root, 'dist/content.js'), 'utf8');
const widths = process.env.BETTER_MYUCLA_DETAIL_WIDTHS?.split(',').map(Number) || [2048, 1440, 1366, 1280, 960, 390];
assert.ok(widths.every(width => Number.isInteger(width) && width >= 320 && width <= 3840));
const baseline = process.argv.includes('--expect-baseline-failure');
const label = baseline ? 'baseline' : 'fixed', failures = [], measurements = [];
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
const check = (ok, message) => { if (!ok) failures.push(message); };

async function preserved(page) {
  return page.evaluate(() => {
    const saved = window.originalDetailContract, form = document.getElementById('aspnetForm');
    return {
      controls: saved.controls.every(({ node, parent }) => node.isConnected && node.parentElement === parent && node.closest('form') === form),
      statuses: saved.statuses.every(({ node, html }) => node.isConnected && node.innerHTML === html),
      headings: saved.headings.every(({ node, html }) => node.isConnected && node.innerHTML === html),
      widgets: saved.widgets.every(({ node, parent, html }) => node.isConnected && node.parentElement === parent && node.innerHTML === html),
      hidden: saved.hidden.every(({ node, html }) => node.isConnected && node.outerHTML === html && !node.getClientRects().length),
    };
  });
}

async function inspect(page) {
  return page.locator('.pl-preview-docked table.pl-section-table').evaluate(table => {
    const rect = node => node.getBoundingClientRect().toJSON();
    const visible = node => !!node.getClientRects().length && getComputedStyle(node).display !== 'none';
    const fields = row => [...row.children].map(cell => ({ field: Number(cell.dataset.plField), visible: visible(cell), rect: rect(cell), background: getComputedStyle(cell).backgroundColor, align: getComputedStyle(cell).textAlign, gridRow: getComputedStyle(cell).gridRowStart }));
    const heading = table.querySelector('.pl-section-heading'), rows = [...table.querySelectorAll('.pl-section-card')];
    return {
      width: table.clientWidth, table: rect(table), headingVisible: visible(heading), heading: fields(heading),
      rows: rows.map(row => ({ rect: rect(row), fields: fields(row), background: getComputedStyle(row).backgroundColor })),
      icons: [...table.querySelectorAll('.pl-section-field[data-pl-field="2"] > i')].map(node => ({ float: getComputedStyle(node).float, height: rect(node).height, lineHeight: parseFloat(getComputedStyle(node).lineHeight) })),
      documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
    };
  });
}

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [], requests = [];
    const named = message => `${width}px: ${message}`;
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === url
      ? route.fulfill({ status: 200, contentType: 'text/html', body: nativeDetailFixtureHtml() })
      : (requests.push(route.request().url()), route.abort()));
    await page.goto(url);
    await page.evaluate(() => {
      const listeners = [], stored = { 'plannerLift.layout.v1': { tidy: true }, 'plannerLift.header.v1': { compact: true } };
      window.chrome = { storage: { local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values), remove: async key => delete stored[key] }, onChanged: { addListener: fn => listeners.push(fn), removeListener: () => {} } } };
      window.toggleDetailTidy = tidy => listeners.forEach(fn => fn({ 'plannerLift.layout.v1': { newValue: { tidy } } }, 'local'));
      const table = document.querySelector('table.coursetable');
      window.originalDetailContract = {
        controls: [...table.querySelectorAll('input,button,a')].map(node => ({ node, parent: node.parentElement })),
        statuses: [...table.querySelectorAll('td:nth-child(3)')].map(node => ({ node, html: node.innerHTML })),
        headings: [...table.querySelectorAll('th')].map(node => ({ node, html: node.innerHTML })),
        widgets: [...table.querySelectorAll('[data-fixture-detail-rating]')].map(node => ({ node, parent: node.parentElement, html: node.innerHTML })),
        hidden: [...table.querySelectorAll('tr')].filter(node => node.style.display === 'none').map(node => ({ node, html: node.outerHTML })),
      };
      window.nativeDetailActions = 0;
      table.addEventListener('click', event => { if (event.target.closest('a,button,input') && !event.target.closest('[data-planner-lift-owned]')) window.nativeDetailActions++; });
    });
    await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
    await page.waitForSelector('.pl-workspace-deck');
    const details = page.locator('[data-pl-workspace-details]').first();
    await details.click();
    await page.waitForSelector('.pl-preview-docked table.pl-section-table');
    check(await page.locator('.pl-workspace-preview-more').count() === 0, named('no Rooms & instructors disclosure button'));
    for (const state of ['visible', 'reopened']) {
      if (state === 'reopened') { await page.keyboard.press('Escape'); await details.click(); }
      const view = await inspect(page);
      measurements.push({ viewportWidth: width, state, ...view });
      check(view.rows.length === 2, named('both lecture and discussion remain present'));
      check(view.rows.every(row => row.fields.filter(field => [6, 8].includes(field.field)).every(field => field.visible)), named('native rooms and instructors appear without another click'));
      check(view.rows.every(row => row.fields.filter(field => field.visible).every(field => field.background === 'rgba(0, 0, 0, 0)' && ['left', 'start'].includes(field.align))), named(`${state} native gray/blue cell blocks and centered text are reset`));
      check(view.icons.every(icon => icon.float === 'none' && icon.height <= icon.lineHeight + 1), named(`${state} native status icons share the text line`));
      check(view.documentWidth <= view.viewport + 1, named(`${state} document has no horizontal overflow`));
      check(view.rows.every(row => row.rect.left >= view.table.left - 1 && row.rect.right <= view.table.right + 1 && row.fields.filter(field => field.visible).every(field => field.rect.left >= row.rect.left - 1 && field.rect.right <= row.rect.right + 1)), named(`${state} all rows and cells fit inside details`));
      if (view.width >= 640) {
        check(view.headingVisible, named(`${state} wide details show original column headings`));
        const columns = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        check(columns.every(field => {
          const head = view.heading.find(cell => cell.field === field), cell = view.rows[0].fields.find(cell => cell.field === field);
          return head.visible && cell.visible && Math.abs(head.rect.left - cell.rect.left) <= 1 && Math.abs(head.rect.right - cell.rect.right) <= 1;
        }), named(`${state} native headings align with their complete data columns`));
        check(view.rows[0].rect.height <= 125, named(`wide section including metadata stays compact (${Math.round(view.rows[0].rect.height)}px)`));
      } else {
        check(!view.headingVisible, named(`${state} narrow details use row captions instead of cramped shared headings`));
        check(view.rows.every(row => row.fields.filter(field => [0, 1, 2, 3, 4, 5, 7].includes(field.field)).every(field => ['1', '2'].includes(field.gridRow))), named(`${state} primary fields use two readable bands`));
      }
      check(Object.values(await preserved(page)).every(Boolean), named(`${state} native controls/status/headings/widgets/hidden actions preserved`));
      if (state === 'visible') {
        await page.screenshot({ path: resolve(output, `${label}-details-${width}-${state}.png`) });
        if (width === 390) {
          const pane = page.locator('.pl-preview-docked > tr:nth-child(3)');
          const priorScroll = await pane.evaluate(node => node.scrollTop);
          await pane.evaluate(node => { const row = node.querySelector('.pl-section-card'); node.scrollTop += row.getBoundingClientRect().top - node.getBoundingClientRect().top - 10; });
          await page.screenshot({ path: resolve(output, `${label}-details-${width}-${state}-rows.png`) });
          await pane.evaluate((node, value) => { node.scrollTop = value; }, priorScroll);
        }
      }
    }
    const field = page.locator('.pl-preview-docked .pl-section-field[data-pl-field="6"]').first();
    const prior = await field.getAttribute('style');
    await field.evaluate(node => { node.style.display = 'none'; });
    check(!await field.isVisible(), named('native inline-hidden metadata field stays hidden'));
    await field.evaluate((node, value) => { if (value === null) node.removeAttribute('style'); else node.setAttribute('style', value); node.hidden = true; }, prior);
    check(!await field.isVisible(), named('native hidden attribute stays hidden'));
    await field.evaluate(node => { node.hidden = false; node.classList.add('hidden'); });
    check(!await field.isVisible(), named('native hidden class stays hidden'));
    await field.evaluate(node => node.classList.remove('hidden'));
    await page.evaluate(() => dispatchEvent(new Event('beforeprint'))); await page.emulateMedia({ media: 'print' });
    check(await field.isVisible() && await page.locator('.pl-preview-docked .pl-section-field[data-pl-field="8"]').first().isVisible(), named('printing includes optional rooms and instructors'));
    await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    check(await field.isVisible(), named('return from print keeps native metadata visible'));
    await page.keyboard.press('Escape');
    check(await details.evaluate(node => document.activeElement === node), named('Escape closes details and returns focus'));
    check(await page.locator('#panelPlan :is(.pl-section-table,.pl-section-heading,.pl-section-field)').count() === 0, named('closing details removes plan presentation marks'));
    await details.click();
    await page.evaluate(() => window.toggleDetailTidy(false));
    await page.waitForSelector('.pl-workspace-deck', { state: 'detached' });
    check(Object.values(await preserved(page)).every(Boolean), named('Tidy off restores original native details'));
    check(await page.evaluate(() => window.nativeDetailActions) === 0, named('verification never invokes native course actions'));
    check(errors.length === 0 && requests.length === 0, named('no script errors or outgoing requests'));
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(resolve(output, `${label}-metrics.json`), JSON.stringify({ cssPath, measurements, failures }, null, 2));
if (baseline) {
  assert.ok(failures.some(failure => failure.includes('rooms and instructors')), 'old CSS hides native metadata behind another click');
  console.log(`Reproduced ${failures.length} old-CSS failures.`);
} else {
  assert.deepEqual(failures, [], 'native plan details presentation regression');
  console.log(`Native details passed at ${widths.join(', ')}px: primary columns, always-visible metadata, native identity/status, print, dismissal and restoration.`);
}
