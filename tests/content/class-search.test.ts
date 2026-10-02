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
    presentation.reconcile(document);
    presentation.reconcile(document);
    expect(change).not.toHaveBeenCalled();
    expect(select().value).toBe("subject");
    expect([...document.querySelectorAll("input")]).toEqual(inputs);
    expect(document.querySelectorAll(".pl-search-nav")).toHaveLength(1);
    expect(document.querySelectorAll(".pl-search-field-label:not([hidden])")).toHaveLength(2);
    expect(go().disabled).toBe(true);
    expect(go().value).toBe("Go");
  });
  it("forwards one explicit mode choice to the native change handler", () => {
    const changed = vi.fn();
    select().addEventListener("change", changed);
    presentation.reconcile(document);
    const instructor = document.querySelector<HTMLButtonElement>('[data-pl-search-mode="instructor"]')!;
    instructor.click(); instructor.click();
    expect(select().value).toBe("instructor");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(instructor.getAttribute("aria-pressed")).toBe("true");
  });
  it("retains the full dropdown and identifies less common searches", () => {
    presentation.reconcile(document);
    select().value = "writing2";
    select().dispatchEvent(new Event("change"));
    expect(select().options).toHaveLength(15);
    expect(document.querySelector(".pl-search-more-label")?.textContent).toBe("More searches · Writing II Classes");
    expect(document.querySelector('[data-pl-search-mode="writing2"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll('.pl-search-nav > button[aria-pressed="true"]')).toHaveLength(0);
  });
  it("supports term-specific offerings and option order without inventing unavailable modes", () => {
    document.querySelector("section")!.outerHTML = searchMarkup([...recordedSearchOptions].reverse());
    select().value = "subject";
    presentation.reconcile(document);
    expect(document.querySelector(".pl-search-nav")).not.toBeNull();
    expect(document.querySelector('[data-pl-search-mode="cutf"]')).toBeNull();
    const recorded = document.querySelector<HTMLButtonElement>('[data-pl-search-mode="onlinerecorded"]')!;
    const changed = vi.fn(); select().addEventListener("change", changed);
    document.querySelector<HTMLDetailsElement>(".pl-search-more")!.open = true;
    recorded.click();
    expect(select().value).toBe("onlinerecorded");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLDetailsElement>(".pl-search-more")!.open).toBe(false);
  });
  it("keeps an unknown search available in the original dropdown, without creating an unvalidated action", () => {
    select().append(new Option("Future search", "future"));
    presentation.reconcile(document);
    expect(document.querySelector(".pl-search-nav")).not.toBeNull();
    expect(document.querySelector(".searchType")?.classList.contains("pl-search-native-hidden")).toBe(false);
    expect(document.querySelector('[data-pl-search-mode="future"]')).toBeNull();
    expect(select().options).toHaveLength(16);
  });
  it("rejects a changed grouped action and rebuilds its menu when offerings change", () => {
    presentation.reconcile(document);
    const changed = vi.fn(); select().addEventListener("change", changed);
    [...select().options].find(option => option.value === "writing2")!.textContent = "Unexpected writing option";
    document.querySelector<HTMLButtonElement>('[data-pl-search-mode="writing2"]')!.click();
    expect(changed).not.toHaveBeenCalled();
    expect(presentation.needsReconcile(document)).toBe(true);
    presentation.reconcile(document);
    expect(document.querySelector('[data-pl-search-mode="writing2"]')).toBeNull();
    expect(presentation.needsReconcile(document)).toBe(false);
  });
  it("explains the native disabled submit and updates when autocomplete enables it", async () => {
    presentation.reconcile(document);
    expect(document.querySelector('label[for="searchTier0"]')?.textContent).toBe("Subject");
    expect(document.querySelector(".pl-search-hint")?.textContent).toContain("Choose dropdown suggestions");
    go().disabled = false;
    await Promise.resolve();
    expect(document.querySelector(".pl-search-hint")?.textContent).toBe("Ready to search.");
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
    expect(document.querySelectorAll(".pl-search-nav")).toHaveLength(1);
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
  it("stops mode changes if the native contract changes after mounting", () => {
    presentation.reconcile(document);
    select().options[0].value = "unknown";
    const changed = vi.fn(); select().addEventListener("change", changed);
    document.querySelector<HTMLButtonElement>('[data-pl-search-mode="geclass"]')!.click();
    expect(changed).not.toHaveBeenCalled();
    expect(presentation.needsReconcile(document)).toBe(true);
    presentation.reconcile(document);
    expect(document.querySelector(".pl-search-nav")).toBeNull();
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
