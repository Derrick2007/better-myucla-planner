/** Realistic native result CSS on invented data; all network traffic is isolated. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { introductionFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '../../outputs/native-result-layout');
const cssPath = resolve(root, process.env.BETTER_MYUCLA_QA_CSS || 'dist/injected.css');
const css = await readFile(cssPath, 'utf8'), js = await readFile(resolve(root, 'dist/content.js'), 'utf8');
const baseline = process.argv.includes('--expect-baseline-failure'), label = baseline ? 'baseline' : 'fixed';
const widths = process.env.BETTER_MYUCLA_RESULT_WIDTHS?.split(',').map(Number) || [2048, 1440, 1366, 1280, 960, 390];
assert.ok(widths.length && widths.every(width => Number.isInteger(width) && width >= 320 && width <= 3840), 'result widths must be bounded whole pixels');
const shapes = process.env.BETTER_MYUCLA_RESULT_SHAPE === 'single' ? [true] : process.env.BETTER_MYUCLA_RESULT_SHAPE === 'many' ? [false] : [false, true];
const reportName = `${label}${widths.length === 6 && shapes.length === 2 ? '' : '-focused'}-metrics.json`;
const failures = [], measurements = [];
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
const check = (ok, message) => { if (!ok) failures.push(message); };

function fixture(single) {
  const dom = new JSDOM(introductionFixtureHtml(6, true, single ? 5 : 14));
  const doc = dom.window.document;
  if (single) for (const suffix of ['M1', 'M2']) {
    doc.getElementById(`CourseListEntry_${suffix}`).remove();
    doc.getElementById(`container_course_${suffix}`).remove();
  }
  doc.querySelectorAll('[id^="container_course_"]').forEach(body => {
    body.querySelector('.data_row > .span3').innerHTML = '<i class="icon-unlock" aria-hidden="true" style="color:green;display:block;float:left;height:3em"></i>Open — 10 left';
    body.querySelectorAll('.data_row > .span3')[1].innerHTML = '<i class="icon-lock" aria-hidden="true" style="color:orange;display:block;float:left;height:3em"></i>Waitlist<br>3 of 10 spaces taken';
  });
  return dom.serialize();
}

async function inspect(page) {
  return page.locator('.pl-browser-body-active').evaluate(body => {
    const list = body.closest('.pl-browser-list'), heading = body.querySelector('.pl-section-result-heading');
    const rows = [...body.querySelectorAll('.pl-section-card')];
    const visible = node => !!node && node.getClientRects().length > 0 && getComputedStyle(node).display !== 'none';
    const rect = node => node.getBoundingClientRect().toJSON();
    const fields = row => [...row.children].map(cell => ({ field: Number(cell.dataset.plField), visible: visible(cell), rect: rect(cell), minHeight: getComputedStyle(cell).minHeight, align: getComputedStyle(cell).textAlign, background: getComputedStyle(cell).backgroundColor }));
    return {
      width: list.clientWidth, more: list.classList.contains('pl-section-more'), list: rect(list), heading: fields(heading),
      rows: rows.map(row => ({ rect: rect(row), fields: fields(row), before: getComputedStyle(row, '::before').display, after: getComputedStyle(row, '::after').display })),
      headerBefore: getComputedStyle(heading, '::before').display, headerAfter: getComputedStyle(heading, '::after').display,
      icons: [...body.querySelectorAll('.pl-section-field[data-pl-field="2"] > i')].map(node => ({ float: getComputedStyle(node).float, height: rect(node).height, lineHeight: parseFloat(getComputedStyle(node).lineHeight) })),
      documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
    };
  });
}

async function preserved(page) {
  return page.evaluate(() => {
    const saved = window.originalResultContract, form = document.getElementById('aspnetForm');
    return {
      controls: saved.controls.every(({ node, parent }) => node.isConnected && node.parentElement === parent && (!(node instanceof HTMLInputElement) || node.form === form)),
      statuses: saved.statuses.every(({ node, html }) => node.isConnected && node.innerHTML === html),
      headings: saved.headings.every(({ node, html }) => node.isConnected && node.innerHTML === html),
      widgets: saved.widgets.every(({ node, parent, html }) => node.isConnected && node.parentElement === parent && node.innerHTML === html),
    };
  });
}

try {
  for (const single of shapes) for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const tag = `${single ? 'single' : 'many'}-${width}`, errors = [], requests = [];
    const named = message => `${tag}: ${message}`;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === url
      ? route.fulfill({ status: 200, contentType: 'text/html', body: fixture(single) })
      : (requests.push(route.request().url()), route.abort()));
    await page.goto(url);
    await page.evaluate(() => {
      const listeners = [], stored = { 'plannerLift.layout.v1': { tidy: true }, 'plannerLift.header.v1': { compact: true } };
      window.chrome = { storage: { local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values), remove: async key => delete stored[key] }, onChanged: { addListener: fn => listeners.push(fn), removeListener: () => {} } } };
      window.toggleTidy = tidy => listeners.forEach(fn => fn({ 'plannerLift.layout.v1': { newValue: { tidy } } }, 'local'));
      window.originalResultContract = {
        controls: [...document.querySelectorAll('.ClassSearchList input,.ClassSearchList button,.ClassSearchList a')].map(node => ({ node, parent: node.parentElement })),
        statuses: [...document.querySelectorAll('.ClassSearchList .data_row > .span3')].map(node => ({ node, html: node.innerHTML })),
        headings: [...document.querySelectorAll('.ClassSearchList .header-row > div')].map(node => ({ node, html: node.innerHTML })),
        widgets: [...document.querySelectorAll('[data-fixture-rating]')].map(node => ({ node, parent: node.parentElement, html: node.innerHTML })),
      };
      window.nativeResultActions = 0;
      document.querySelector('.ClassSearchList').addEventListener('click', event => { if (event.target.closest('input,button,a')) window.nativeResultActions++; });
    });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.waitForSelector('.pl-workspace-deck');
    await page.locator('.pl-workspace-nav [data-pl-module="find"]').click();
    await page.waitForFunction(() => document.getElementById('titleText').getBoundingClientRect().top <= 13);
    const more = page.locator('.pl-browser-toolbar button');

    for (const state of ['closed', 'open', 'closed-again']) {
      if (state !== 'closed') await more.click();
      const view = await inspect(page), open = state === 'open';
      measurements.push({ tag, state, ...view });
      check(view.more === open, named(`${state} disclosure state matches its content`));
      check(view.rows.length === (single ? 5 : 14), named('all fictional section rows remain present'));
      check(view.headerBefore === 'none' && view.headerAfter === 'none' && view.rows.every(row => row.before === 'none' && row.after === 'none'), named(`${state} clearfix boxes do not create implicit grid cells`));
      check(view.rows.every(row => row.fields.filter(field => [6, 8].includes(field.field)).every(field => field.visible === open)), named(`${state} optional data follows Rooms & instructors`));
      check(view.heading.filter(field => [6, 8].includes(field.field)).every(field => field.visible === open), named(`${state} optional header help follows Rooms & instructors`));
      check(view.icons.every(icon => icon.float === 'none' && icon.height <= icon.lineHeight + 1), named(`${state} native icons do not impose a three-line row height`));
      check(view.documentWidth <= view.viewport + 1 && view.rows.every(row => row.rect.left >= view.list.left - 1 && row.rect.right <= view.list.right + 1), named(`${state} rows stay within the preview without horizontal page overflow`));
      check(view.rows.every(row => row.fields.filter(field => field.visible).every(field => field.rect.left >= row.rect.left - 1 && field.rect.right <= row.rect.right + 1)), named(`${state} every visible cell stays within its section row`));
      check(view.rows.every(row => row.fields.filter(field => field.visible).every(field => field.minHeight === '0px' && ['left', 'start'].includes(field.align))), named(`${state} native minimum height and centered cell text do not disturb the layout`));
      check(view.rows.every(row => row.fields.filter(field => field.visible).every(field => field.background === 'rgba(0, 0, 0, 0)')), named(`${state} native gray/blue cell backgrounds do not fragment the section rows`));
      if (view.width >= 640) {
        const aligned = [0, 1, 2, 3, 4, 5, 7, ...(open ? [6, 8] : [])].every(field => {
          const head = view.heading.find(cell => cell.field === field), cell = view.rows[0].fields.find(cell => cell.field === field);
          return head.visible && cell.visible && Math.abs(head.rect.left - cell.rect.left) <= 1 && Math.abs(head.rect.right - cell.rect.right) <= 1;
        });
        check(aligned, named(`${state} shared headings line up with their data columns`));
        if (!open) check(view.rows[0].rect.height <= 80, named(`${state} one-line section stays compact (${Math.round(view.rows[0].rect.height)}px)`));
      }
      const invariants = await preserved(page);
      check(Object.values(invariants).every(Boolean), named(`${state} native control/status/header/widget identity remains intact ${JSON.stringify(invariants)}`));
      if (state !== 'closed-again') {
        await page.screenshot({ path: resolve(output, `${label}-${tag}-${state}.png`) });
        if (width === 390) {
          const pane = page.locator('.pl-workspace-search > .pl-pane-body');
          const priorScroll = await pane.evaluate(node => node.scrollTop);
          await pane.evaluate(node => {
            const row = node.querySelector('.pl-browser-body-active .pl-section-card');
            node.scrollTop += row.getBoundingClientRect().top - node.getBoundingClientRect().top - 12;
          });
          await page.screenshot({ path: resolve(output, `${label}-${tag}-${state}-rows.png`) });
          await pane.evaluate((node, value) => { node.scrollTop = value; }, priorScroll);
        }
      }
    }

    // The disclosure must not revive a field independently hidden by UCLA.
    await more.click();
    for (const selector of ['.pl-browser-body-active .pl-section-card > [data-pl-field="6"]', '.pl-browser-body-active .pl-section-result-heading > [data-pl-field="8"]']) {
      const field = page.locator(selector).first(), priorStyle = await field.getAttribute('style');
      await field.evaluate(node => { node.style.display = 'none'; });
      check(!await field.isVisible(), named('an inline-hidden optional field remains hidden while expanded'));
      await field.evaluate((node, value) => { if (value === null) node.removeAttribute('style'); else node.setAttribute('style', value); node.hidden = true; }, priorStyle);
      check(!await field.isVisible(), named('a native hidden attribute remains hidden while expanded'));
      await field.evaluate(node => { node.hidden = false; node.classList.add('hidden'); });
      check(!await field.isVisible(), named('a native hidden class remains hidden while expanded'));
      await field.evaluate(node => { node.classList.remove('hidden'); });
    }
    await more.click();
    await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    check(await page.locator('.pl-browser-body-active .data_row > .span7').first().isVisible() && await page.locator('.pl-browser-body-active .data_row > .span9').first().isVisible(), named('printing includes optional location and instructor data'));
    check(await page.locator('.pl-browser-body-active .header-Location').isVisible() && await page.locator('.pl-browser-body-active .header-Instructor').isVisible(), named('printing includes original optional column headings'));
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    check(await more.getAttribute('aria-expanded') === 'false', named('printing preserves the previous disclosure choice'));
    check(!await page.locator('.pl-browser-body-active .data_row > .span7').first().isVisible(), named('returning from print restores optional-field folding'));

    await page.evaluate(() => window.toggleTidy(false));
    await page.waitForSelector('.pl-workspace-deck', { state: 'detached' });
    check(await page.locator('#container_course_M0 .data_row > .span7').first().isVisible() && await page.locator('#container_course_M0 .data_row > .span9').first().isVisible(), named('turning tidy off restores native optional content'));
    check(await page.locator('.pl-section-field,.pl-section-help-field,.pl-section-card').count() === 0, named('turning tidy off removes presentation marks'));
    check(Object.values(await preserved(page)).every(Boolean), named('restoration preserves original controls, statuses, headings and nested rating widgets'));
    check(await page.evaluate(() => window.nativeResultActions) === 0, named('verification does not invoke native result actions'));
    check(errors.length === 0 && requests.length === 0, named(`no script errors or requests (${errors.join('; ')})`));
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(resolve(output, reportName), JSON.stringify({ cssPath, measurements, failures }, null, 2));
if (baseline) {
  assert.ok(failures.some(failure => failure.includes('clearfix boxes')), 'the previous build reproduces implicit clearfix grid cells');
  assert.ok(failures.some(failure => failure.includes('optional data')), 'the previous build reproduces optional fields that do not collapse');
  console.log(`Confirmed previous-build result regression: ${failures.length} expected failures. Full evidence: ${resolve(output, 'baseline-metrics.json')}`);
  console.log(failures.slice(0, 10).join('\n'));
} else {
  assert.deepEqual(failures, [], 'native result layout, disclosure and restoration regressions');
  console.log(`Native result layout passed for single/multiple courses at ${widths.join(', ')}px, including rooms toggles, native hidden states, print/restoration and identity.`);
}
