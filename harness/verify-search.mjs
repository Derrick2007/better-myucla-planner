/** Isolated browser verification against an invented page, never a user's account. */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { searchFixtureHtml, searchMarkup, recordedSearchOptions } from "./search-fixture.mjs";
const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "../../outputs/planner-search-v0.11.1");
const url = "https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx";
const css = await readFile(resolve(root, "dist/injected.css"), "utf8");
const js = await readFile(resolve(root, "dist/content.js"), "utf8");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BETTER_MYUCLA_CHROMIUM || undefined });
try {
  for (const width of [1920, 1440, 960, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    const errors = [];
    const requests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => requests.push(request.url()));
    await page.route("**/*", route => route.request().url() === url
      ? route.fulfill({ status: 200, contentType: "text/html", body: searchFixtureHtml() })
      : route.abort());
    await page.goto(url);
    const originalButtons = await page.locator(".OrderingButtons button").evaluateAll(buttons => buttons.map(button => button.outerHTML));
    await page.evaluate(() => {
      const listeners = [];
      window.chrome = { storage: { local: { get: async key => key === "plannerLift.layout.v1" ? { [key]: { tidy: true } } : {}, set: async () => {}, remove: async () => {} }, onChanged: { addListener: fn => listeners.push(fn), removeListener: () => {} } } };
      window.toggleTidy = tidy => listeners.forEach(fn => fn({ "plannerLift.layout.v1": { newValue: { tidy } } }, "local"));
      window.modeChanges = 0;
      window.searchSubmits = 0;
      const updateFields = () => {
        const select = document.querySelector("select.searchBy");
        const mode = select.value;
        const labels = mode === "geclass" ? ["Foundation", "Category (Required)", "Subject Area, Catalog Number or Class Title (Required)"] : mode === "instructor" ? ["Instructor's Last Name", "Subject Area or Catalog Number or Class Title (Required)", "unused for this search type"] : ["Subject Area", "Catalog Number or Class Title (Required)", "unused for this search type"];
        document.querySelectorAll(".ClassSearchBox").forEach((field, index) => {
          field.setAttribute("aria-label", labels[index]);
          field.placeholder = labels[index];
          field.style.display = labels[index] === "unused for this search type" ? "none" : "";
        });
      };
      document.addEventListener("change", event => { if (event.target.matches("select.searchBy")) { window.modeChanges++; updateFields(); } });
      document.querySelector("form").addEventListener("submit", event => { event.preventDefault(); window.searchSubmits++; window.lastSubmitter = event.submitter; });
    });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.waitForSelector(".pl-search-nav");
    assert.equal(await page.evaluate(() => window.modeChanges), 0);
    assert.equal(await page.evaluate(() => window.searchSubmits), 0);
    const go = page.getByRole("button", { name: "Search classes", exact: true });
    assert.equal(await go.isDisabled(), true);
    assert.deepEqual(await page.locator(".pl-search-field-label:not([hidden])").allTextContents(), ["Subject", "Course number or title (required)"]);
    assert.match(await page.locator(".pl-search-hint").textContent(), /Choose dropdown suggestions/);
    if (width > 780) {
      const inputs = await page.locator(".ClassSearchBox:visible").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().top));
      assert.ok(Math.abs(inputs[0] - inputs[1]) < 1, "Desktop fields should share one row");
    }
    await page.locator(".pl-search-widget").screenshot({ path: resolve(out, `subject-${width}.png`) });
    await page.getByRole("button", { name: "Instructor", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('label[for="searchTier0"]').textContent === "Instructor’s last name");
    assert.equal(await page.evaluate(() => window.modeChanges), 1);
    await page.getByRole("button", { name: "Instructor", exact: true }).click();
    assert.equal(await page.evaluate(() => window.modeChanges), 1);
    await page.getByRole("button", { name: "GE", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('label[for="searchTier2"]').hidden === false);
    assert.equal(await page.locator(".pl-search-field-label:not([hidden])").count(), 3);
    const box = await page.locator(".pl-search-widget").boundingBox();
    const children = await page.locator(".pl-search-nav, .ClassSearchBox, .pl-search-submit").evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
    assert.ok(children.every(rect => rect.left >= box.x && rect.right <= box.x + box.width + .5), `Search controls overflow at ${width}px`);
    await page.locator(".pl-search-widget").screenshot({ path: resolve(out, `search-${width}.png`) });
    await page.locator(".pl-search-more > summary").click();
    assert.equal(await page.getByRole("button", { name: "Online · recorded", exact: true }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "CUTF seminars", exact: true }).count(), 0);
    const groupRect = await page.locator(".pl-search-groups").boundingBox();
    assert.ok(groupRect.x >= box.x && groupRect.x + groupRect.width <= box.x + box.width + .5, "More menu stays inside search");
    await page.locator(".pl-search-widget").screenshot({ path: resolve(out, `more-${width}.png`) });
    await page.getByRole("button", { name: "Writing II", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.pl-search-more-label').textContent.includes('Writing II'));
    assert.equal(await page.locator(".pl-search-more").evaluate(n => n.open), false);
    assert.equal(await page.locator("select.searchBy option").count(), 15);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Subject", exact: true }).click();
    await page.locator("#searchTier0").fill("EXAMPLE SUBJECT");
    await page.locator("#searchTier1").fill("101");
    await page.evaluate(() => document.querySelector(".csGoButton").disabled = false);
    await page.waitForFunction(() => document.querySelector(".pl-search-hint").textContent === "Ready to search.");
    await go.click();
    assert.equal(await page.evaluate(() => window.searchSubmits), 1);
    assert.equal(await page.evaluate(() => window.lastSubmitter === document.querySelector(".csGoButton")), true);
    // Search-only redraw: the course plan stays the same DOM node.
    await page.evaluate(markup => {
      const parsed = new DOMParser().parseFromString(markup, "text/html");
      document.querySelector("#panelSearch").replaceWith(parsed.querySelector("#panelSearch"));
    }, searchMarkup(recordedSearchOptions));
    await page.waitForSelector(".pl-search-nav");
    assert.equal(await page.locator(".pl-search-nav").count(), 1);
    await page.screenshot({ path: resolve(out, `planner-${width}.png`), fullPage: width === 1440 });
    assert.deepEqual(await page.locator(".OrderingButtons button").evaluateAll(buttons => buttons.map(button => button.outerHTML)), originalButtons);
    await page.evaluate(() => window.toggleTidy(false));
    assert.equal(await page.locator(".pl-search-nav, .pl-search-field-label, .pl-search-submit, .pl-search-more, .pl-calm-title").count(), 0);
    assert.equal(await page.locator(".csGoButton").getAttribute("aria-label"), null);
    assert.equal(await page.locator(".csGoButton").getAttribute("value"), "Go");
    assert.equal(await page.locator(".searchType").evaluate(node => node.parentElement.classList.contains("ClassSearchControls")), true);
    assert.deepEqual(requests, [url]);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: native search, labels, submitter, dropdown, redraw, reversible layout, no extra requests`);
    await page.close();
  }
} finally { await browser.close(); }
