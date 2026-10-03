/** Run the literal inline fragment inside the visualization sandbox wrapper. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const wrapper = process.argv[2];
if (!wrapper) throw new Error('Pass the rendered inline preview path.');
const out = resolve(root, '../../outputs/planner-preview-v0.17.0');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
try {
  for (const width of [1440, 1024, 736, 390]) {
    const page = await browser.newPage({ viewport: { width: width + 32, height: 832 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // The wrapper's optional tooltip helpers are unnecessary to this preview.
    // All application code and resources must already be embedded.
    await page.route('https://**/*', route => route.abort());
    await page.goto(pathToFileURL(resolve(wrapper)).href);
    const frame = page.frames().find(candidate => candidate.parentFrame());
    assert.ok(frame, 'wrapper exposes one sandboxed content frame');
    await frame.waitForSelector('html[data-pl-preview-ready="true"]');
    await frame.locator('.pl-workspace-main').waitFor();
    assert.equal(await frame.locator('.pl-browser-choices button').count(), 3);
    const bounds = await frame.evaluate(() => ({
      height: document.getElementById('better-myucla-build-preview').getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      frame: innerWidth,
      nativeForm: document.querySelector('.ClassSearchWidget input')?.form?.id
    }));
    assert.equal(bounds.overflow, false, `no outer clipping at ${width}: ${JSON.stringify(bounds)}`);
    assert.equal(bounds.height, 800, 'bounded root does not grow with viewport feedback');
    assert.equal(bounds.nativeForm, 'aspnetForm');
    assert.ok(await frame.locator('#titleText').evaluate(node => node.getBoundingClientRect().top <= 16), 'compact header matches the standalone initial view');
    await page.screenshot({ path: resolve(out, `inline-${width}.png`) });
    await frame.locator('.pl-browser-choices button').nth(1).click();
    assert.equal(await frame.locator('.pl-browser-choices button').nth(1).getAttribute('aria-pressed'), 'true');
    const filter = frame.locator('.pl-browser-filter input');
    await filter.fill('103');
    assert.equal(await frame.locator('.pl-browser-choices button:visible').count(), 1);
    await filter.fill('');
    await frame.locator('button[data-pl-module="classes"]').click();
    const details = frame.locator('[data-pl-workspace-details]').first();
    await details.click();
    assert.ok(await frame.locator('.pl-workspace-preview').isVisible());
    await details.press('Escape');
    assert.equal(await details.getAttribute('aria-expanded'), 'false');
    assert.ok(await details.evaluate(node => node === document.activeElement));
    if (width < 1100) {
      await frame.locator('[data-pl-mobile-view="schedule"]').click();
      assert.ok(await frame.locator('.pl-workspace-calendar').isVisible());
      await frame.locator('[data-pl-mobile-view="main"]').click();
    }
    await frame.locator('button[data-pl-module="find"]').click();
    const header = frame.getByRole('button', { name: 'Show header', exact: true });
    await header.click();
    assert.ok(await frame.locator('#fixture-native-navigation').evaluate(node => node.getBoundingClientRect().top >= 0), 'Show header restores the original top');
    await frame.getByRole('button', { name: 'Compact header', exact: true }).click();
    assert.ok(await frame.locator('#titleText').evaluate(node => node.getBoundingClientRect().top <= 16));
    await frame.evaluate(() => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { widgetState: { privateContent: { build: '0.17.0', module: 'classes', details: '__proto__' } } } } })));
    assert.equal(await frame.locator('.pl-workspace-host').getAttribute('data-pl-module'), 'classes', 'saved module restores while malformed selection falls back safely');
    assert.equal(await frame.locator('.pl-workspace-preview').isVisible(), false);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`Inline preview ${width}: interactions, bounds, sandbox passed`);
    await page.close();
  }
} finally { await browser.close(); }
