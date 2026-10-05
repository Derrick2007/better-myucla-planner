/** Production-build calendar QA. Every page and meeting is fictional. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { introductionFixtureHtml } from './workspace-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '../../outputs/v019-calendar');
const js = await readFile(resolve(root, 'dist/content.js'), 'utf8');
const css = await readFile(resolve(root, 'dist/injected.css'), 'utf8');
const calendarCss = await readFile(resolve(root, 'public/v019-calendar.css'), 'utf8');
assert.ok(css.includes(calendarCss), 'production build includes the calendar stylesheet');
const baseCss = css.replace(calendarCss, '');
const url = 'https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx';
const widths = process.env.BETTER_MYUCLA_CALENDAR_WIDTHS?.split(',').map(Number) || [2048, 1440, 1366, 1280, 960, 390];
assert.ok(widths.every(width => Number.isInteger(width) && width >= 320 && width <= 3840));
const cases = widths.map(width => ({ width, height: width === 390 ? 780 : 1000 }));
if (widths.includes(390)) cases.push({ width: 390, height: 600 });
const frame = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const reports = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });

async function measurements(page) {
  return page.evaluate(() => [...document.querySelectorAll('#gridDiv .planneritembox')].map(node => {
    const b = node.getBoundingClientRect(), p = node.parentElement.getBoundingClientRect(), c = getComputedStyle(node);
    return { x: b.x - p.x, y: b.y - p.y, width: b.width, height: b.height,
      inline: node.getAttribute('style'), background: c.backgroundColor,
      borders: [c.borderTopWidth, c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth, c.borderStyle, c.borderColor] };
  }));
}

async function identity(page) {
  assert.deepEqual(await page.evaluate(() => ({
    controls: fixtureCalendarControls.every(({ node, parent, form, handler }) => node.isConnected && node.parentElement === parent && node.form === form && node.getAttribute('onclick') === handler),
    meetings: fixtureCalendarMeetings.every(({ node, parent, style, source }) => node.isConnected && node.parentElement === parent && node.getAttribute('style') === style && node.textContent.replace(/\s+/g, ' ').trim() === source),
    nativeNavigation: fixtureNativeNavigation.isConnected && fixtureNativeNavigation.outerHTML === fixtureNativeNavigationSource,
    menuParent: document.querySelector('.pl-workspace-calendar .plannerMenuLinks, .classPlanner_CalendarSection .plannerMenuLinks')?.parentElement === document.getElementById('gridDiv'),
    submissions: fixtureSubmits.length,
  })), { controls: true, meetings: true, nativeNavigation: true, menuParent: true, submissions: 0 });
}

async function bounds(page, width, height) {
  const result = await page.locator('.pl-workspace-calendar').evaluate(node => {
    const b = node.getBoundingClientRect();
    return { x: b.x, right: b.right, y: b.y, bottom: b.bottom, width: b.width, height: b.height,
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
      visible: getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' };
  });
  assert.ok(result.visible && result.width > 100 && result.height > 80, `calendar remains usable: ${JSON.stringify(result)}`);
  assert.ok(result.x >= -1 && result.right <= width + 1 && result.y >= 0 && result.bottom <= height + 1, `calendar stays inside viewport: ${JSON.stringify(result)}`);
  assert.ok(result.documentOverflow <= 1, 'calendar creates no document horizontal overflow');
  return result;
}

try {
  for (const { width, height } of cases) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(6000);
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === url
      ? route.fulfill({ status: 200, contentType: 'text/html', body: introductionFixtureHtml(8, true, 8) })
      : (requests.push(route.request().url()), route.abort()));
    try {
      await page.goto(url);
      await page.evaluate(() => {
        const stored = { 'plannerLift.layout.v1': { tidy: true }, 'plannerLift.header.v1': { compact: true } };
        window.chrome = { storage: { local: {
          get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values), remove: async key => delete stored[key],
        }, onChanged: { addListener() {}, removeListener() {} } } };
        window.fixtureCommands = []; window.fixtureSubmits = []; window.fixtureMeetingOpens = 0;
        window.fixtureNativeNavigation = document.getElementById('fixture-native-navigation');
        window.fixtureNativeNavigationSource = fixtureNativeNavigation.outerHTML;
        document.getElementById('aspnetForm').addEventListener('submit', event => { event.preventDefault(); fixtureSubmits.push(event.submitter?.id || 'implicit'); });
        const grid = document.getElementById('gridDiv'), menu = document.querySelector('.plannerMenuLinks');
        grid.prepend(menu);
        document.getElementById('plannerSectionCal').innerHTML = '<button id="ctl00_MainContent_toggleGrid" class="planSectionToggle link" onclick="shrink(\'gridDiv\'); __doPostBack(\'ctl00$MainContent$toggleGrid\',\'\')"><i class="icon-minus-sign"></i><label>Weekly Schedule</label></button>';
        const days = grid.querySelector('.fixture-weekdays');
        days.innerHTML = '<table style="width:100%;border-collapse:collapse;table-layout:fixed"><tbody><tr class="primary light headerBar classPlanner">'+['Monday','Tuesday','Wednesday','Thursday','Friday'].map(day => '<td>'+day+'</td>').join('')+'</tr></tbody></table>';
        const pairs = [['studylist', 'sl', 'studylistChecked', '27'], ['plan', 'plan', 'planChecked', '36'], ['alternates', 'alt', 'alternatesChecked', '31']];
        for (const [name, id, state, command] of pairs) for (const [suffix, method, sign] of [['Uncheck','addClass','+'],['Check','removeClass','-']]) {
          const button = document.getElementById(name + suffix); button.id = id + suffix;
          button.setAttribute('onclick', `$('.checkboxStateHolder').${method}('${state}'); triggerPostback('${command}|${sign}'); return false;`);
        }
        menu.insertAdjacentHTML('beforeend', `<span>Grid size: <button id="gridPlus" aria-label="Larger grid" onclick="triggerPostback('16|+'); return false;">+</button><button id="gridMinus" aria-label="Smaller grid" onclick="triggerPostback('16|-'); return false;">−</button></span>
          <span>Grid View: <span class="icontoggle gridsizeicons"><button id="sgUncheck" aria-label="unchecked Grid View" onclick="$('#gridDiv').addClass('sgChecked'); triggerPostback('41|+'); return false;">☐</button><button id="sgCheck" aria-label="checked Grid View" onclick="$('#gridDiv').removeClass('sgChecked').addClass('saChecked'); triggerPostback('41|-'); return false;">☑</button></span></span>
          <span>Agenda View: <span class="icontoggle gridsizeicons"><button id="saUncheck" aria-label="unchecked Agenda View" onclick="$('#gridDiv').addClass('saChecked'); triggerPostback('42|+'); return false;">☐</button><button id="saCheck" aria-label="checked Agenda View" onclick="$('#gridDiv').removeClass('saChecked').addClass('sgChecked'); triggerPostback('42|-'); return false;">☑</button></span></span>`);
        grid.insertAdjacentHTML('beforeend', '<div class="fixture-agenda"><h3>Example agenda</h3><button type="button" data-fixture-meeting>Example agenda meeting</button></div>');
        grid.querySelectorAll('.planneritembox').forEach(node => { node.tabIndex = 0; node.setAttribute('role', 'button'); node.dataset.fixtureMeeting = ''; });
        window.fixtureGridCapture = () => {
          window.fixtureCalendarControls = [...document.querySelectorAll('.classPlanner_CalendarSection button,.classPlanner_CalendarSection input')].filter(node => !node.closest('[data-planner-lift-owned]'))
            .map(node => ({ node, parent: node.parentElement, form: node.form, handler: node.getAttribute('onclick') }));
          window.fixtureCalendarMeetings = [...document.querySelectorAll('#gridDiv .planneritembox')].map(node => ({ node, parent: node.parentElement, style: node.getAttribute('style'), source: node.textContent.replace(/\s+/g, ' ').trim() }));
        };
        const pristine = grid.cloneNode(true);
        window.fixtureGridScale = 1;
        window.triggerPostback = command => {
          fixtureCommands.push(command);
          if (!['16|+', '16|-'].includes(command)) return;
          fixtureGridScale += command === '16|+' ? .2 : -.2;
          const current = document.getElementById('gridDiv'), replacement = pristine.cloneNode(true);
          replacement.className = current.className;
          replacement.querySelectorAll('.planneritembox').forEach(node => {
            node.style.top = `${parseFloat(node.style.top) * fixtureGridScale}px`; node.style.height = `${parseFloat(node.style.height) * fixtureGridScale}px`;
          });
          current.replaceWith(replacement); fixtureGridCapture();
        };
        window.$ = selector => { const api = { addClass: name => { document.querySelectorAll(selector).forEach(node => node.classList.add(name)); return api; }, removeClass: name => { document.querySelectorAll(selector).forEach(node => node.classList.remove(name)); return api; } }; return api; };
        window.shrink = id => document.getElementById(id).classList.toggle('hidden');
        window.__doPostBack = (...args) => fixtureCommands.push(args.join('|'));
        const dialog = document.createElement('dialog'); dialog.id = 'fixture-meeting-dialog'; dialog.innerHTML = '<p>Fictional meeting information</p><button type="button">Close example meeting</button>'; document.body.append(dialog);
        let trigger;
        const close = () => { dialog.close(); trigger?.focus({ preventScroll: true }); };
        dialog.querySelector('button').onclick = close;
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        document.addEventListener('click', event => { const meeting = event.target.closest?.('[data-fixture-meeting]'); if (!meeting) return; event.preventDefault(); trigger = meeting; fixtureMeetingOpens++; dialog.showModal(); dialog.querySelector('button').focus(); });
        document.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.matches?.('.planneritembox[data-fixture-meeting]')) { event.preventDefault(); event.target.click(); } });
        const style = document.createElement('style');
        style.textContent = `.fixture-weekdays{display:block!important}.fixture-weekdays td{padding:4px 0;text-align:center;background:#24528f;color:white;font-size:13px;line-height:18px} #gridDiv .icontoggle.gridsizeicons>button{min-width:34px} ${pairs.map(([name,,state])=>`.checkboxStateHolder.${state} .${name}Uncheck,.checkboxStateHolder:not(.${state}) .${name}Check{display:none}`).join('')} #gridDiv:not(.sgChecked)>.fixture-weekdays,#gridDiv:not(.sgChecked)>.fixture-weekbody,#gridDiv:not(.saChecked)>.fixture-agenda{display:none!important} #gridDiv.sgChecked #sgUncheck,#gridDiv:not(.sgChecked) #sgCheck,#gridDiv.saChecked #saUncheck,#gridDiv:not(.saChecked) #saCheck{display:none} dialog{max-width:75vw;padding:24px;border:1px solid #ccd} dialog::backdrop{background:#0003}`;
        document.head.append(style); fixtureGridCapture();
      });
      await page.addStyleTag({ content: baseCss }); await page.addScriptTag({ content: js });
      await page.waitForSelector('.pl-workspace-group-strip:visible');
      await page.locator('.pl-workspace-nav [data-pl-module="schedule"]').click(); await frame(page);
      const beforeSkin = await measurements(page);
      await page.addStyleTag({ content: calendarCss }); await frame(page);
      assert.deepEqual(await measurements(page), beforeSkin, 'calendar skin preserves all event positions, sizes, colors and border widths');
      const initial = await bounds(page, width, height);
      await identity(page);
      assert.deepEqual(await page.evaluate(() => fixtureCommands), [], 'mounting and skinning perform no native actions');
      await page.screenshot({ path: resolve(output, `calendar-${width}-${height}.png`) });

      // A short viewport may scroll the native toolbar within its pane. Each
      // target must be reachable without shifting the document itself.
      const rootScroll = await page.evaluate(() => document.scrollingElement.scrollTop);
      const hitTargets = [];
      for (const button of await page.locator('.pl-workspace-calendar .plannerMenuLinks button:visible').all()) {
        await button.scrollIntoViewIfNeeded();
        hitTargets.push(await button.evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return { id: node.id, width: r.width, height: r.height, hit: node.contains(hit), right: r.right, bottom: r.bottom }; }));
      }
      assert.ok(hitTargets.length >= 8 && hitTargets.every(target => target.hit && target.width >= 20 && target.height >= 30 && target.right <= width && target.bottom <= height), `native toolbar targets remain reachable: ${JSON.stringify(hitTargets)}`);
      assert.equal(await page.evaluate(() => document.scrollingElement.scrollTop), rootScroll, 'reaching toolbar controls uses local scrolling');
      for (const [prefix, name] of [['sl','studylistChecked'],['plan','planChecked'],['alt','alternatesChecked']]) {
        const initialState = await page.locator('.checkboxStateHolder').evaluate((node, name) => node.classList.contains(name), name);
        await page.locator(`#${prefix}${initialState?'Check':'Uncheck'}`).click();
        assert.equal(await page.locator('.checkboxStateHolder').evaluate((node, name) => node.classList.contains(name), name), !initialState);
        await page.locator(`#${prefix}${initialState?'Uncheck':'Check'}`).click();
      }
      await page.locator('#sgCheck').click();
      assert.equal(await page.locator('.fixture-weekbody').isVisible(), false); assert.equal(await page.locator('.fixture-agenda').isVisible(), true);
      await page.locator('.fixture-agenda button').click(); await page.keyboard.press('Escape');
      await page.locator('#sgUncheck').click(); await page.locator('#saCheck').click();
      assert.equal(await page.locator('.fixture-weekbody').isVisible(), true); assert.equal(await page.locator('.fixture-agenda').isVisible(), false);
      const meeting = page.locator('.planneritembox').first(); await meeting.focus(); await meeting.press('Enter');
      assert.equal(await page.locator('#fixture-meeting-dialog').isVisible(), true); await page.keyboard.press('Escape');
      assert.equal(await meeting.evaluate(node => node === document.activeElement), true);
      assert.equal(await page.evaluate(() => fixtureMeetingOpens), 2);
      await identity(page);
      const originalHeight = await meeting.evaluate(node => parseFloat(node.style.height));
      await page.locator('#gridPlus').click(); await frame(page);
      assert.ok(await meeting.evaluate(node => parseFloat(node.style.height)) > originalHeight);
      await page.locator('#gridMinus').click(); await frame(page);
      assert.equal(await meeting.evaluate(node => parseFloat(node.style.height)), originalHeight);
      await identity(page); await bounds(page, width, height);

      // Close the other dock and make sure the remaining calendar fills it.
      for (const id of ['classes','find']) { const close = page.locator(`[data-pl-tab-close="${id}"]`); if (await close.isVisible()) { await close.click(); await frame(page); } }
      const single = await bounds(page, width, height), deck = await page.locator('.pl-workspace-deck').boundingBox();
      assert.ok(Math.abs(single.width - deck.width) <= 2, 'a lone calendar fills the entire deck');
      if (width >= 1100) assert.ok(single.width >= initial.width, 'closing neighboring tabs frees calendar room');
      await page.screenshot({ path: resolve(output, `calendar-filled-${width}-${height}.png`) });
      const resizedWidth = width >= 1280 ? width - 100 : width === 390 ? 430 : 850;
      await page.setViewportSize({ width: resizedWidth, height }); await frame(page); await bounds(page, resizedWidth, height);
      await page.setViewportSize({ width, height }); await frame(page); await bounds(page, width, height); await identity(page);
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('#gridDiv .fixture-weekbody').isVisible(), true, 'printing reveals the native calendar');
      assert.equal(await page.locator('.pl-workspace-group-strip:visible').count(), 0, 'printing omits workspace tab UI');
      await page.emulateMedia({ media: 'screen' }); await frame(page);
      await page.locator('.pl-workspace-original').click(); await frame(page); await identity(page);
      assert.equal(await page.locator('.pl-workspace-group-strip').count(), 0);
      assert.equal(await page.locator('#gridDiv .planneritembox').first().evaluate(node => getComputedStyle(node).borderRadius), '0px', 'Original layout removes calendar skin');
      assert.deepEqual(errors, []); assert.deepEqual(requests, []);
      reports.push({ width, height, nativeControlCount: hitTargets.length, originalCalendarWidth: initial.width, expandedCalendarWidth: single.width, errors, requests });
      console.log(`PASS ${width}x${height}: exact event geometry, native switches, grid redraw, keyboard meeting, full-width fill, resize, print and restore`);
    } catch (error) {
      await page.screenshot({ path: resolve(output, `failure-${width}-${height}.png`) }); throw error;
    } finally { await page.close(); }
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
