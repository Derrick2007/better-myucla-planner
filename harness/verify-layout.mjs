/** Browser regression checks for tidy layout geometry and secondary controls. */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { calendarFixtureHtml } from "./calendar-fixture.mjs";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "../../outputs/planner-status-v0.11.0");
const url = "https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx";
const css = await readFile(resolve(root, "dist/injected.css"), "utf8");
const js = await readFile(resolve(root, "dist/content.js"), "utf8");
const popupJs = await readFile(resolve(root, "dist/popup.js"), "utf8");
const popupHtml = await readFile(resolve(root, "dist/popup.html"), "utf8");
const manifest = JSON.parse(await readFile(resolve(root, "dist/manifest.json"), "utf8"));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
try {
  for (const width of [1920, 1440, 960, 780]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const fixture = calendarFixtureHtml();
    await page.route(url, (route) => route.fulfill({ status: 200, contentType: "text/html", body: fixture }));
    await page.goto(url);
    await page.evaluate(() => {
      const tables = [...document.querySelectorAll("#panelPlan table.coursetable")];
      tables[0].rows[1].cells[2].innerHTML = '<i class="icon-unlock"></i>Waitlist<br>1 of 8 Taken';
      const discussion = tables[0].rows[1].cloneNode(true);
      discussion.cells[1].textContent = "Dis 1A";
      discussion.cells[2].innerHTML = '<i class="icon-unlock"></i>Open<br>12 of 80 Left';
      discussion.cells[7].textContent = "0.0";
      tables[0].tBodies[0].append(discussion);
      tables[3].rows[1].cells[2].innerHTML = '<i class="icon-ok"></i>Enrolled Class Full (36)';
    });
    const nativeStatuses = await page.locator("#panelPlan table.coursetable tr td:nth-child(3)").evaluateAll(cells => cells.map(cell => cell.innerHTML));
    const originalCommands = await page.locator(".OrderingButtons button").evaluateAll((buttons) => buttons.map((b) => b.getAttribute("onclick")));
    await page.evaluate(() => {
      const listeners = [];
      window.chrome = {
        storage: {
          local: {
            get: async (key) => key === "plannerLift.layout.v1" ? { [key]: { tidy: true } } : {},
            set: async () => {}, remove: async () => {}
          },
          onChanged: { addListener: (fn) => listeners.push(fn), removeListener: () => {} }
        }
      };
      window.toggleTidy = (tidy) => listeners.forEach((fn) => fn({ "plannerLift.layout.v1": { newValue: { tidy } } }, "local"));
    });
    // Reproduce the older extension's added outer padding before checking
    // the fix, so this test proves it detects the screenshot's actual defect.
    await page.addStyleTag({ content: '@media (min-width:781px) { #gridDiv .planneritembox[data-pl-grid="tidy"] { padding:2px 4px; } }' });
    await page.addScriptTag({ content: js });
    await page.waitForSelector("[data-pl-real-tools]");
    const originalGridStyles = await page.locator("#gridDiv .planneritembox").evaluateAll(blocks => blocks.map(block => block.getAttribute("style")));
    const overflowingBefore = await page.locator("#gridDiv .planneritembox").evaluateAll(blocks => blocks.filter(block => block.getBoundingClientRect().right > block.parentElement.getBoundingClientRect().right + 0.5).length);
    if (width > 780) assert.ok(overflowingBefore > 0, "regression fixture must reproduce the old overflow");
    await page.addStyleTag({ content: css });
    assert.deepEqual(await page.locator("[data-pl-section-status]").allTextContents(), [
      "Waitlist · 1/8 places filled", "Open · 12 seats left", "Closed", "Open · 12 seats left", "Enrolled", "Open · 40 seats left"
    ]);
    const status = page.locator("[data-pl-section-status]").first();
    const statusTip = page.locator("[data-pl-status-original]").first();
    assert.equal(await status.getAttribute("aria-describedby"), await statusTip.getAttribute("id"));
    await status.focus();
    await statusTip.waitFor({ state: "visible" });
    assert.equal(await statusTip.innerHTML(), nativeStatuses[0]);
    await page.keyboard.press("Escape");
    await statusTip.waitFor({ state: "hidden" });
    await page.locator(".pagehead").click();
    await status.hover();
    await statusTip.waitFor({ state: "visible" });
    await statusTip.hover();
    assert.ok(await statusTip.isVisible(), "tip must remain visible when the pointer moves onto it");
    await page.keyboard.press("Escape");
    await statusTip.waitFor({ state: "hidden" });
    await page.locator(".pagehead").click();
    const columns = await page.locator("table.coursetable").evaluateAll((tables) => tables.map((table) => {
      const row = [...table.rows].find((r) => r.cells.length === 9 && r.cells[0].tagName === "TD");
      return [...row.cells].map((cell) => Math.round(cell.getBoundingClientRect().left * 100) / 100);
    }));
    for (let col = 0; col < 9; col++) {
      assert.ok(Math.max(...columns.map((c) => c[col])) - Math.min(...columns.map((c) => c[col])) < 1, `column ${col + 1} drifts at ${width}px`);
    }
    const labelMetrics = await page.locator(".pl-lead-card tr.pl-thead th").evaluateAll((cells) => cells.map((cell, index) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      return { index, overflow: range.getBoundingClientRect().right - cell.getBoundingClientRect().right };
    }));
    assert.ok(labelMetrics.every((label) => label.overflow <= 0), `column labels overflow at ${width}px: ${JSON.stringify(labelMetrics.filter((label) => label.overflow > 0))}`);
    const geometry = await page.locator("#gridDiv .planneritembox").evaluateAll((blocks) => blocks.map((block) => {
      const rect = block.getBoundingClientRect();
      const parent = block.parentElement.getBoundingClientRect();
      const s = getComputedStyle(block);
      const borderX = parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
      const borderY = parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth);
      const parentContent = parseFloat(getComputedStyle(block.parentElement).width);
      const half = block.style.width.includes("50%");
      const deduction = s.borderStyle === "double" ? 7 : 3;
      const text = block.querySelector('[data-pl-gridline="2"]')?.getBoundingClientRect();
      return { width: rect.width, height: rect.height, nativeWidth: parentContent * (half ? 0.5 : 1) - deduction + borderX, nativeHeight: parseFloat(block.style.height) + borderY, sizing: s.boxSizing, inside: rect.right <= parent.right, textFits: !!text && text.bottom <= rect.bottom - parseFloat(s.borderBottomWidth) + 0.1 };
    }));
    if (width > 780) for (const box of geometry) {
      assert.equal(box.sizing, "content-box");
      assert.ok(Math.abs(box.width - box.nativeWidth) < 0.1, "native percentage width changed");
      assert.ok(Math.abs(box.height - box.nativeHeight) < 0.1, "native meeting duration changed");
      assert.ok(box.inside);
      assert.ok(box.textFits, "room line should fit inside a 50-minute meeting");
    }
    else assert.ok(geometry.every((box) => box.sizing === "content-box"), "narrow layout should remain native");
    const collisionPairs = await page.locator(".timebox").evaluateAll(days => days.map(day => {
      const [first, second] = day.querySelectorAll(".planneritembox");
      return second.getBoundingClientRect().left - first.getBoundingClientRect().right;
    }));
    assert.ok(collisionPairs.every(gap => gap >= 0), "colliding meetings spill into adjacent lanes");
    assert.ok(await page.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth), `page overflows at ${width}px`);

    const tools = page.locator("[data-pl-real-tools]").first();
    await assert.rejects(tools.locator('[data-pl-action="top"]').waitFor({ state: "visible", timeout: 100 }));
    await tools.locator("summary.pl-course-more").click();
    await tools.locator('[data-pl-action="tag"]').click();
    await tools.locator("[data-pl-tag]").waitFor({ state: "visible" });
    assert.equal(await tools.locator("details").getAttribute("open"), null);
    await tools.locator("summary.pl-course-more").click();
    await page.keyboard.press("Escape");
    assert.equal(await tools.locator("details").getAttribute("open"), null);
    await tools.locator("summary.pl-course-more").click();
    await page.locator(".pagehead").click();
    assert.equal(await tools.locator("details").getAttribute("open"), null);
    const advisory = page.locator("[data-pl-exam-details]").first();
    await advisory.locator("summary").click();
    await advisory.locator("details p").waitFor({ state: "visible" });
    await advisory.locator("summary").click();
    await tools.locator("summary.pl-course-more").click();
    await tools.locator('[data-pl-action="tag"]').click();
    assert.equal(await page.locator(".OrderingButtons button").evaluateAll((buttons) => buttons.map((b) => b.getAttribute("onclick")).join("\n")), originalCommands.join("\n"));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(out, `tidy-${width}.png`), fullPage: width === 1440 });
    await page.evaluate(() => window.toggleTidy(false));
    assert.equal(await page.locator("[data-pl-columns], [data-pl-exam-details], .pl-exam-original, [data-pl-section-status], [data-pl-status-original]").count(), 0);
    assert.deepEqual(await page.locator("#panelPlan table.coursetable tr td:nth-child(3)").evaluateAll(cells => cells.map(cell => cell.innerHTML)), nativeStatuses);
    assert.equal(await page.locator(".planneritembox[data-pl-grid]").count(), 0);
    assert.deepEqual(await page.locator("#gridDiv .planneritembox").evaluateAll(blocks => blocks.map(block => block.getAttribute("style"))), originalGridStyles);
    console.log(`PASS ${width}px: separate statuses, hover/focus tips, Escape, layout restoration, columns, calendar, menus, native controls`);
    await page.close();
  }

  const popup = await browser.newPage({ viewport: { width: 320, height: 900 } });
  await popup.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
  await popup.evaluate(version => {
    window.chrome = {
      runtime: { getManifest: () => ({ version }) },
      storage: { local: { get: async () => ({}), set: async () => {} } }
    };
  }, manifest.version);
  await popup.addScriptTag({ content: popupJs });
  assert.equal(await popup.locator("#version").textContent(), `v${manifest.version}`);
  assert.ok(await popup.locator("#toggle").isChecked());
  await popup.screenshot({ path: resolve(out, "popup-version.png"), animations: "disabled" });
  await popup.close();
  console.log(`PASS popup: identifies build v${manifest.version}`);
} finally {
  await browser.close();
}
