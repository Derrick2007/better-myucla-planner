/** Production CSS/controller regression for native clearfix and panel widths. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { introductionFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '../../outputs/native-search-layout');
const cssPath = resolve(root, process.env.BETTER_MYUCLA_QA_CSS || 'dist/injected.css');
const css = await readFile(cssPath, 'utf8');
const js = await readFile(resolve(root, 'dist/content.js'), 'utf8');
const baseline = process.argv.includes('--expect-baseline-failure');
const label = baseline ? 'baseline' : 'fixed';
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
const failures = [], measurements = [];
const widths = [2048, 1440, 1366, 1280, 1100, 960, 390];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });

function check(passes, message) {
  if (!passes) failures.push(message);
}

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === url
      ? route.fulfill({ status: 200, contentType: 'text/html', body: introductionFixtureHtml(6, true) })
      : (requests.push(route.request().url()), route.abort()));
    await page.goto(url);
    await page.evaluate(() => {
      const stored = { 'plannerLift.layout.v1': { tidy: true }, 'plannerLift.header.v1': { compact: true } };
      window.chrome = { storage: { local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values), remove: async key => delete stored[key] }, onChanged: { addListener: () => {}, removeListener: () => {} } } };
      window.originalSearchControls = [...document.querySelectorAll('.ClassSearchControls input,.ClassSearchControls select')];
      const titleLink = document.querySelector('[data-fixture-search-enroll-link]');
      window.originalSearchTitleLink = { node: titleLink, parent: titleLink.parentElement, href: titleLink.getAttribute('href') };
      window.searchChangeCount = 0;
      window.searchSubmitCount = 0;
      document.querySelector('select.searchBy').addEventListener('change', () => window.searchChangeCount++);
      document.getElementById('aspnetForm').addEventListener('submit', event => { event.preventDefault(); window.searchSubmitCount++; });
    });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.waitForSelector('.pl-workspace-deck');
    await page.locator('.pl-workspace-nav [data-pl-module="find"]').click();
    await page.waitForFunction(() => document.getElementById('titleText').getBoundingClientRect().top <= 13);

    const geometry = await page.locator('.ClassSearchControls').evaluate(controls => {
      const rect = node => node?.getBoundingClientRect().toJSON();
      const mode = controls.querySelector('select.searchBy');
      const fields = [...controls.querySelectorAll('input.ClassSearchBox')].filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none');
      const go = controls.querySelector('.csGoButton');
      return {
        controls: rect(controls), mode: rect(mode), fields: fields.map(rect), go: rect(go),
        before: getComputedStyle(controls, '::before').display,
        after: getComputedStyle(controls, '::after').display,
        viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      };
    });
    measurements.push({ width, ...geometry });
    const named = message => `${width}px: ${message}`;
    check(Math.abs(geometry.mode.x - geometry.controls.x) <= 2, named('search mode starts at the left edge instead of an empty grid column'));
    check(geometry.fields.every(field => field.width > 86), named(`fields remain wider than 86px (${geometry.fields.map(field => Math.round(field.width)).join(', ')}px)`));
    check([geometry.mode, geometry.go, ...geometry.fields].every(box => box.x >= geometry.controls.x - 1 && box.right <= geometry.controls.right + 1), named('native controls stay inside the search band'));
    check(geometry.documentWidth <= geometry.viewport + 1, named('no horizontal page overflow'));
    const searchAppearance = await page.locator('.pl-search-submit').evaluate(wrapper => {
      const input = wrapper.querySelector('input'), label = wrapper.querySelector('.pl-search-submit-label');
      const style = getComputedStyle(input), caption = getComputedStyle(label);
      return { disabled: input.disabled, background: style.backgroundColor, image: style.backgroundImage, opacity: style.opacity, color: caption.color, labelFits: label.scrollWidth <= label.clientWidth && label.scrollHeight <= label.clientHeight };
    });
    check(searchAppearance.disabled && searchAppearance.background === 'rgb(232, 237, 243)' && searchAppearance.color === 'rgb(82, 97, 116)', named('disabled search has a readable label and neutral background'));
    check(searchAppearance.image === 'none' && searchAppearance.opacity === '1' && searchAppearance.labelFits, named('native gradient/fading cannot wash out or clip the search label'));
    if (geometry.controls.width >= 700) {
      check(geometry.controls.height <= 105, named(`desktop controls occupy one compact band (${Math.round(geometry.controls.height)}px high)`));
      check(Math.max(...[geometry.mode, geometry.go, ...geometry.fields].map(box => box.bottom)) - Math.min(...[geometry.mode, geometry.go, ...geometry.fields].map(box => box.bottom)) <= 2, named('mode, inputs and submit align on one desktop row'));
      check(geometry.fields.every(field => field.width >= 120), named('desktop text inputs retain usable width'));
      const heading = await page.locator('#classSearchTitle > .planSectionToggle').boundingBox();
      const nativeLink = await page.locator('[data-fixture-search-enroll-link]').boundingBox();
      check(heading.x < nativeLink.x && Math.abs(heading.y - nativeLink.y) < 20, named('the title stays left of the native Find a Class and Enroll link'));
    } else if (geometry.controls.width < 600) {
      check(geometry.fields.every(field => field.top >= geometry.mode.bottom - 1), named('narrow search fields occupy a clear row below search mode'));
    }
    await page.screenshot({ path: resolve(output, `${label}-${width}.png`) });

    // Existing inline display:none must win over presentation. Hiding each
    // native group independently catches unscoped display:...!important fixes.
    for (const selector of ['.searchFieldPanel', '.searchFields', '.goPanel', '.searchType']) {
      const control = page.locator(selector).first();
      const priorStyle = await control.getAttribute('style');
      await control.evaluate(node => { node.style.display = 'none'; });
      check(!await control.isVisible(), named(`native hidden ${selector} stays hidden`));
      await control.evaluate((node, value) => { if (value === null) node.removeAttribute('style'); else node.setAttribute('style', value); }, priorStyle);
      await control.evaluate(node => { node.hidden = true; });
      check(!await control.isVisible(), named(`native hidden attribute on ${selector} stays hidden`));
      await control.evaluate(node => { node.hidden = false; node.classList.add('hidden'); });
      check(!await control.isVisible(), named(`native hidden class on ${selector} stays hidden`));
      await control.evaluate(node => { node.classList.remove('hidden'); });
    }
    check(!await page.locator('#searchTier2').isVisible(), named('the unused native input stays hidden'));
    await page.locator('#searchTier2').evaluate(node => {
      node.style.display = '';
      node.setAttribute('aria-label', 'Subject Area, Catalog Number or Class Title (Required)');
      node.placeholder = 'Example third required field';
    });
    await page.waitForFunction(() => document.querySelector('.pl-search-widget').dataset.plSearchFields === '3');
    const threeFields = await page.locator('input.ClassSearchBox').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    check(threeFields.every(box => box.width > 86 && box.x >= geometry.controls.x - 1 && box.right <= geometry.controls.right + 1), named(`three required fields fit at readable widths (${threeFields.map(box => Math.round(box.width)).join(', ')}px)`));
    await page.locator('#searchTier2').evaluate(node => { node.style.display = 'none'; });
    if (width === 1440) {
      await page.waitForFunction(() => document.querySelector('.pl-search-widget').dataset.plSearchFields === '2');
      const section = page.locator('.pl-workspace-search');
      const priorStyle = await section.getAttribute('style');
      for (const containerWidth of [599, 600, 699, 700]) {
        await section.evaluate((node, pixels) => { node.style.width = `${pixels}px`; }, containerWidth);
        const boundary = await page.locator('.ClassSearchControls').evaluate(controls => {
          const fieldPanel = controls.querySelector('.searchFieldPanel');
          const inputs = [...controls.querySelectorAll('input.ClassSearchBox')].filter(node => getComputedStyle(node).display !== 'none');
          return { container: controls.closest('.pl-workspace-search').getBoundingClientRect().width, bounds: controls.getBoundingClientRect().toJSON(), panel: getComputedStyle(fieldPanel).display, fields: inputs.map(node => node.getBoundingClientRect().toJSON()) };
        });
        check(Math.abs(boundary.container - containerWidth) <= 1, named(`container boundary ${containerWidth}px is exercised`));
        check(boundary.panel === (containerWidth < 600 ? 'contents' : 'flex'), named(`native inline block does not override the ${containerWidth}px layout`));
        check(boundary.fields.every(box => box.width > 86 && box.x >= boundary.bounds.x - 1 && box.right <= boundary.bounds.right + 1), named(`fields fit at the ${containerWidth}px container breakpoint`));
      }
      await section.evaluate((node, value) => { if (value === null) node.removeAttribute('style'); else node.setAttribute('style', value); }, priorStyle);
    }
    check(await page.evaluate(() => window.originalSearchControls.every(node => node.isConnected && node.form === document.getElementById('aspnetForm'))), named('original controls retain identity and form association'));
    check(await page.evaluate(() => { const saved = window.originalSearchTitleLink; return saved.node.isConnected && saved.node.parentElement === saved.parent && saved.node.getAttribute('href') === saved.href; }), named('the original enrollment-navigation link retains its identity, parent and target'));
    check(await page.evaluate(() => window.searchChangeCount === 0 && window.searchSubmitCount === 0), named('mount and layout checks send no native search events'));
    // Exercise the original mode selector and submitter after the zero-event
    // mount checks. These handlers are fictional; each invocation is counted,
    // prevented locally, and must never result in a request.
    {
      const select = page.locator('select.searchBy');
      const modes = await select.locator('option').evaluateAll(nodes => nodes.filter(node => !node.disabled).map(node => node.value));
      for (const [index, mode] of modes.entries()) {
        await select.selectOption(mode);
        check(await select.inputValue() === mode, named(`native search mode ${mode} remains selectable`));
        check(await page.evaluate(() => window.searchChangeCount) === index + 1, named(`mode ${mode} forwards its one native change event`));
      }
      check(await page.evaluate(() => window.searchSubmitCount === 0), named('changing search modes does not submit an extra query'));
      const field = page.locator('#searchTier0'), fieldLabel = page.locator('label[for="searchTier0"]');
      for (const hiding of ['hidden', 'class']) {
        await field.evaluate((node, kind) => { if (kind === 'hidden') node.hidden = true; else node.classList.add('hidden'); }, hiding);
        await page.waitForFunction(() => document.querySelector('label[for="searchTier0"]').hidden);
        check(!await field.isVisible() && !await fieldLabel.isVisible(), named(`${hiding} native input and its added label stay hidden together`));
        await field.evaluate(node => { node.hidden = false; node.classList.remove('hidden'); });
        await page.waitForFunction(() => !document.querySelector('label[for="searchTier0"]').hidden);
      }
      const go = page.locator('#ctl00_MainContent_cs_goButton');
      check(await go.isDisabled(), named('native disabled behavior is retained'));
      await go.evaluate(node => { node.disabled = false; });
      await page.locator('.pl-search-hint').waitFor({ state: 'hidden' });
      const enabled = await go.evaluate(node => ({ bg: getComputedStyle(node).backgroundColor, image: getComputedStyle(node).backgroundImage, value: node.value, name: node.name }));
      check(enabled.bg === 'rgb(35, 95, 152)' && enabled.image === 'none', named('enabled native search has a solid primary color'));
      check(enabled.value === 'Go' && enabled.name === 'ctl00$MainContent$cs$goButton', named('native submitter value and name are preserved'));
      await page.locator('#searchTier1').focus();
      await page.keyboard.press('Tab');
      check(await go.evaluate(node => document.activeElement === node), named('Tab reaches the original search submitter'));
      check(await go.evaluate(node => getComputedStyle(node).outlineStyle !== 'none'), named('keyboard focus is visible'));
      await page.screenshot({ path: resolve(output, `${label}-${width}-search-enabled.png`) });
      await go.press('Enter');
      check(await page.evaluate(() => window.searchSubmitCount === 1), named('keyboard activation submits the original form exactly once'));
      await go.click();
      check(await page.evaluate(() => window.searchSubmitCount === 2), named('pointer activation submits the original form exactly once'));
    }
    check(errors.length === 0, named(`no script errors: ${errors.join('; ')}`));
    check(requests.length === 0, named('no extra requests'));
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(resolve(output, `${label}-metrics.json`), JSON.stringify({ cssPath, measurements, failures }, null, 2));
if (baseline) {
  assert.ok(failures.some(failure => failure.includes('empty grid column')), 'the old build must reproduce the native clearfix grid failure');
  assert.ok(failures.some(failure => failure.includes('fields remain wider')), 'the old build must reproduce the shrunken input failure');
  console.log(`Confirmed old-build regression across ${widths.length} widths (${failures.length} expected failures).`);
  console.log(failures.slice(0, 12).join('\n'));
  if (failures.length > 12) console.log(`Full baseline evidence: ${resolve(output, 'baseline-metrics.json')}`);
} else {
  assert.deepEqual(failures, [], 'native search layout and visibility regressions');
  console.log(`Native search layout passed at ${widths.join(', ')}px: compact alignment, readable fields, native hidden states/control identity and no extra requests.`);
}
