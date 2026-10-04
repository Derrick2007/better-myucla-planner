// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassSearchPresentation } from "../../src/content/class-search";
import { restorePlannerFrame, tidyPlannerFrame } from "../../src/content/planner-frame";
// @ts-expect-error The shared browser fixture is plain JavaScript.
import { searchMarkup, recordedSearchOptions } from "../../harness/search-fixture.mjs";

describe("native class search presentation", () => {
  let presentation: ClassSearchPresentation;
  const select = () => document.querySelector<HTMLSelectElement>("select.searchBy")!;
  const go = () => document.querySelector<HTMLInputElement>(".csGoButton")!;
  beforeEach(() => {
    document.body.innerHTML = `<form id="aspnetForm" method="post" action="/ClassPlanner/ClassPlan.aspx"><div class="classPlannerWrapper"><div id="ctl00_MainContent_classPlanPanel">${searchMarkup()}</div></div></form>`;
    presentation = new ClassSearchPresentation();
  });
  afterEach(() => { presentation.restore(); restorePlannerFrame(document); vi.restoreAllMocks(); });

  it("mounts without submitting, changing a mode, or replacing native inputs", () => {
    const change = vi.fn();
    select().addEventListener("change", change);
    const inputs = [...document.querySelectorAll("input")];
    const modeParent = select().parentElement;
    presentation.reconcile(document);
    presentation.reconcile(document);
    expect(change).not.toHaveBeenCalled();
    expect(select().value).toBe("subject");
    expect([...document.querySelectorAll("input")]).toEqual(inputs);
    expect(document.querySelectorAll(".pl-search-nav,.pl-search-more")).toHaveLength(0);
    expect(select().parentElement).toBe(modeParent);
    expect(select().getAttribute("aria-label")).toBe("Search by");
    expect(document.querySelectorAll(".pl-search-field-label:not([hidden])")).toHaveLength(2);
    expect(go().disabled).toBe(true);
    expect(go().value).toBe("Go");
  });
  it("leaves explicit selection to the original native change handler", () => {
    const changed = vi.fn();
    select().addEventListener("change", changed);
    presentation.reconcile(document);
    select().value = "instructor";
    select().dispatchEvent(new Event("change", { bubbles: true }));
    presentation.reconcile(document);
    expect(select().value).toBe("instructor");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-pl-search-mode]')).toBeNull();
  });
  it("retains every less common search directly in the original dropdown", () => {
    presentation.reconcile(document);
    select().value = "writing2";
    select().dispatchEvent(new Event("change"));
    expect(select().options).toHaveLength(15);
    expect(select().selectedOptions[0].textContent).toBe("Writing II Classes");
    expect(select().closest('.ClassSearchControls')).not.toBeNull();
    expect(document.querySelectorAll('[data-pl-search-mode]')).toHaveLength(0);
  });
  it("supports term-specific offerings and option order without inventing unavailable modes", () => {
    document.querySelector("section")!.outerHTML = searchMarkup([...recordedSearchOptions].reverse());
    select().value = "subject";
    presentation.reconcile(document);
    expect(document.querySelector(".pl-search-widget")).not.toBeNull();
    expect([...select().options].some(option=>option.value==='cutf')).toBe(false);
    const changed = vi.fn(); select().addEventListener("change", changed);
    select().value = "onlinerecorded";
    select().dispatchEvent(new Event("change", { bubbles: true }));
    expect(select().value).toBe("onlinerecorded");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(select().options[0].value).toBe(recordedSearchOptions.at(-1)[0]);
  });
  it("keeps an unknown search available in the original dropdown, without creating an unvalidated action", () => {
    select().append(new Option("Future search", "future"));
    presentation.reconcile(document);
    expect(document.querySelector(".pl-search-widget")).not.toBeNull();
    expect(document.querySelector(".searchType")?.classList.contains("pl-search-native-hidden")).toBe(false);
    expect(document.querySelector('[data-pl-search-mode="future"]')).toBeNull();
    expect(select().options).toHaveLength(16);
  });
  it("reconciles native option changes without forwarding events or replacing the selector", () => {
    presentation.reconcile(document);
    const changed = vi.fn(); select().addEventListener("change", changed);
    [...select().options].find(option => option.value === "writing2")!.textContent = "Unexpected writing option";
    const original = select();
    expect(changed).not.toHaveBeenCalled();
    expect(presentation.needsReconcile(document)).toBe(true);
    presentation.reconcile(document);
    expect(select()).toBe(original);
    expect(document.querySelector('[data-pl-search-mode="writing2"]')).toBeNull();
    expect(presentation.needsReconcile(document)).toBe(false);
  });
  it("explains the native disabled submit and updates when autocomplete enables it", async () => {
    presentation.reconcile(document);
    expect(document.querySelector('label[for="searchTier0"]')?.textContent).toBe("Subject");
    expect(document.querySelector(".pl-search-hint")?.textContent).toContain("Choose a dropdown suggestion");
    go().disabled = false;
    await Promise.resolve();
    expect(document.querySelector<HTMLElement>(".pl-search-hint")?.hidden).toBe(true);
  });
  it("updates field labels when MyUCLA finishes changing the autocomplete fields", async () => {
    presentation.reconcile(document);
    const field = document.getElementById("searchTier0")!;
    field.setAttribute("aria-label", "Foundation");
    await Promise.resolve();
    expect(document.querySelector('label[for="searchTier0"]')?.textContent).toBe("Foundation");
    field.style.display = "none";
    await Promise.resolve();
    expect(document.querySelector<HTMLLabelElement>('label[for="searchTier0"]')?.hidden).toBe(true);
  });
  it("keeps the native submitter and its disabled state", () => {
    presentation.reconcile(document);
    const submitted = vi.fn();
    document.querySelector("form")!.addEventListener("submit", event => { event.preventDefault(); submitted((event as SubmitEvent).submitter); });
    go().click();
    expect(submitted).not.toHaveBeenCalled();
    go().disabled = false;
    go().click();
    expect(submitted).toHaveBeenCalledExactlyOnceWith(go());
  });
  it("tracks native hidden attributes and classes without leaving orphan field labels", async () => {
    presentation.reconcile(document);
    const field = document.getElementById("searchTier0")!;
    const label = document.querySelector<HTMLLabelElement>('label[for="searchTier0"]')!;
    const widget = document.querySelector<HTMLElement>('.ClassSearchWidget')!;
    field.hidden = true;
    await Promise.resolve();
    expect(label.hidden).toBe(true); expect(widget.dataset.plSearchFields).toBe('1');
    field.hidden = false;
    await Promise.resolve();
    expect(label.hidden).toBe(false); expect(widget.dataset.plSearchFields).toBe('2');
    field.classList.add('hidden');
    await Promise.resolve();
    expect(label.hidden).toBe(true); expect(widget.dataset.plSearchFields).toBe('1');
    field.classList.remove('hidden');
    await Promise.resolve();
    expect(label.hidden).toBe(false); expect(widget.dataset.plSearchFields).toBe('2');
  });
  it("restores every native node, attribute, value and original position", () => {
    const widget = document.querySelector(".ClassSearchWidget")!;
    const before = widget.outerHTML;
    const nativeGo = go();
    presentation.reconcile(document);
    presentation.restore();
    expect(widget.outerHTML).toBe(before);
    expect(go()).toBe(nativeGo);
  });
  it("detects and reattaches to a replaced search panel without requiring a new plan", () => {
    presentation.reconcile(document);
    document.querySelector("section")!.outerHTML = searchMarkup();
    expect(presentation.needsReconcile(document)).toBe(true);
    presentation.reconcile(document);
    expect(presentation.needsReconcile(document)).toBe(false);
    expect(document.querySelectorAll(".pl-search-widget")).toHaveLength(1);
    expect(document.querySelectorAll(".pl-search-field-label")).toHaveLength(3);
  });
  it("preserves a native Go replacement inside the presentation wrapper", () => {
    const nativeParent=go().parentElement;
    presentation.reconcile(document);
    const replacement=go().cloneNode(true) as HTMLInputElement;
    replacement.removeAttribute('aria-label');replacement.disabled=false;
    go().replaceWith(replacement);
    expect(presentation.needsReconcile(document)).toBe(true);
    presentation.reconcile(document);
    expect(go()).toBe(replacement);expect(replacement.isConnected).toBe(true);
    expect(replacement.form).toBe(document.querySelector('form'));
    expect(replacement.disabled).toBe(false);expect(presentation.needsReconcile(document)).toBe(false);
    presentation.restore();expect(replacement.parentElement).toBe(nativeParent);
    expect(replacement.hasAttribute('aria-label')).toBe(false);
  });
  it.each(["option", "field", "form", "submitter"])("leaves an unfamiliar %s contract native", shape => {
    if (shape === "option") select().options[0].textContent = "Changed option";
    if (shape === "field") document.getElementById("searchTier1")!.id = "otherField";
    if (shape === "form") document.querySelector("form")!.action = "/OtherPage.aspx";
    if (shape === "submitter") go().setAttribute("formaction", "/OtherPage.aspx");
    const before = document.body.innerHTML;
    presentation.reconcile(document);
    expect(document.body.innerHTML).toBe(before);
  });
  it("restores native presentation when the core mode contract changes after mounting", () => {
    presentation.reconcile(document);
    select().options[0].value = "unknown";
    const changed = vi.fn(); select().addEventListener("change", changed);
    expect(changed).not.toHaveBeenCalled();
    expect(presentation.needsReconcile(document)).toBe(true);
    presentation.reconcile(document);
    expect(document.querySelector(".pl-search-widget")).toBeNull();
  });
  it("restores the optional page theme without hiding sections or changing their text", () => {
    const title = document.getElementById("classSearchTitle")!;
    const before = title.outerHTML;
    tidyPlannerFrame(document);
    expect(document.documentElement.classList.contains("pl-calm-page")).toBe(true);
    expect(title.classList.contains("pl-calm-title")).toBe(true);
    restorePlannerFrame(document);
    expect(title.outerHTML).toBe(before);
  });
});
