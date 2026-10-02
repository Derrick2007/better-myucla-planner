// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerWorkspace } from "../../src/content/planner-workspace";
import { MyUclaPlannerAdapter } from "../../src/adapters/myucla-adapter";
// @ts-expect-error Shared browser fixture is plain JavaScript.
import { workspaceFixtureHtml } from "../../harness/workspace-fixture.mjs";

describe("one-page native planner workspace", () => {
  let workspace: PlannerWorkspace;
  let adapter: MyUclaPlannerAdapter;
  const mount = () => workspace.reconcile(document, adapter.inspectContract().courses);
  beforeEach(() => {
    const fixture = new DOMParser().parseFromString(workspaceFixtureHtml(), "text/html");
    document.body.innerHTML = fixture.body.innerHTML;
    workspace = new PlannerWorkspace(); adapter = new MyUclaPlannerAdapter(document);
    expect(adapter.inspectContract().ok).toBe(true);
  });
  afterEach(() => workspace.restore());

  it("keeps the original form, inputs, course order and native handlers", () => {
    const form = document.querySelector("form");
    const fields = [...document.querySelectorAll("input,select")];
    const commands = [...document.querySelectorAll(".OrderingButtons button")];
    const courses = adapter.inspectContract().courses;
    mount(); mount();
    expect(document.querySelectorAll(".pl-workspace-deck > section")).toHaveLength(3);
    expect(document.querySelectorAll("form")).toHaveLength(1);
    expect(document.querySelector("form")).toBe(form);
    expect(new Set(document.querySelectorAll("input,select"))).toEqual(new Set(fields));
    expect([...document.querySelectorAll(".OrderingButtons button")]).toEqual(commands);
    expect(adapter.inspectContract().ok).toBe(true);
    expect(adapter.inspectContract().courses.map(c => c.node)).toEqual(courses.map(c => c.node));
  });
  it("opens original class details in place and returns keyboard focus", () => {
    const course = adapter.inspectContract().courses[0];
    const table = course.node.querySelector("table.coursetable")!;
    const parent = table.parentElement;
    mount();
    const details = course.node.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!;
    details.click();
    expect(course.node.classList.contains("pl-workspace-preview-card")).toBe(true);
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(false);
    expect(table.parentElement).toBe(parent);
    expect(adapter.inspectContract().ok).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(course.node.classList.contains("pl-workspace-preview-card")).toBe(false);
    expect(document.activeElement).toBe(details);
  });
  it("restores native sections, term and tools exactly", () => {
    const original = document.body.innerHTML;
    mount(); document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!.click(); workspace.restore();
    expect(document.body.innerHTML).toBe(original);
  });
  it("dismisses details on outside click without forwarding the click to native controls", () => {
    mount();
    const details = document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!;
    const panelClick = vi.fn();
    document.querySelector(".classPlannerWrapper")!.addEventListener("click", panelClick);
    details.click(); panelClick.mockClear();
    const backdrop = document.querySelector<HTMLElement>(".pl-workspace-detail-backdrop")!;
    expect(backdrop.hidden).toBe(false);
    document.querySelector<HTMLElement>(".pl-workspace-preview-head")!.click();
    expect(backdrop.hidden).toBe(false);
    document.querySelector<HTMLElement>("tbody.pl-workspace-preview-card table.coursetable th")!.click();
    expect(backdrop.hidden).toBe(false);
    panelClick.mockClear(); backdrop.click();
    expect(backdrop.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(true);
    expect(panelClick).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(details);
    expect(adapter.inspectContract().ok).toBe(true);
    details.click(); panelClick.mockClear();
    document.querySelector<HTMLButtonElement>(".pl-workspace-expand-search")!.click();
    expect(backdrop.hidden).toBe(true);
    expect(document.querySelector(".pl-workspace-deck")!.classList.contains("pl-workspace-search-expanded")).toBe(false);
    expect(panelClick).not.toHaveBeenCalled();
    workspace.restore();
    document.querySelector<HTMLElement>(".classPlannerWrapper")!.click();
    expect(panelClick).toHaveBeenCalledOnce();
  });
  it("offers an accessible close button and toggles the same course details", () => {
    mount();
    const details = document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!;
    const close = document.querySelector<HTMLButtonElement>(".pl-workspace-preview-close")!;
    details.click();
    expect(close.getAttribute("aria-label")).toBe("Close details");
    close.click();
    expect(document.querySelector<HTMLElement>(".pl-workspace-detail-backdrop")!.hidden).toBe(true);
    expect(document.activeElement).toBe(details);
    details.click(); details.click();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(true);
  });
  it("expands search without replacing native controls, then restores columns and focus", () => {
    const controls = [...document.querySelectorAll(".ClassSearchWidget input,.ClassSearchWidget select")];
    mount();
    const expand = document.querySelector<HTMLButtonElement>(".pl-workspace-expand-search")!;
    expand.click();
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".pl-workspace-deck")!.classList.contains("pl-workspace-search-expanded")).toBe(true);
    expect([...document.querySelectorAll(".ClassSearchWidget input,.ClassSearchWidget select")]).toEqual(controls);
    expect(controls.every(node => node.closest("form") === document.getElementById("aspnetForm"))).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true}));
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(expand);
    expand.click(); workspace.restore();
    expect(document.querySelector(".pl-workspace-expand-search")).toBeNull();
    expect(document.querySelectorAll("#ctl00_MainContent_classPlanPanel > section")).toHaveLength(6);
  });
  it("lists all three other native sections and restores every section in original layout", () => {
    const sections = [...document.querySelectorAll("#ctl00_MainContent_classPlanPanel > section")];
    mount();
    expect(document.querySelector(".pl-workspace-extras > summary")!.textContent).toBe("Other sections (3) & actions");
    expect([...document.querySelectorAll(".pl-workspace-section-links button")].map(n=>n.textContent)).toEqual(["Plan Optimizer","Study list outside this plan","Personal Entries"]);
    const extras = document.querySelector<HTMLDetailsElement>(".pl-workspace-extras")!;
    extras.open = true;
    document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true}));
    expect(extras.open).toBe(false);
    document.querySelector<HTMLButtonElement>(".pl-workspace-original")!.click();
    expect([...document.querySelectorAll("#ctl00_MainContent_classPlanPanel > section")]).toEqual(sections);
    document.querySelector<HTMLButtonElement>(".pl-workspace-return")!.click();
    expect(document.querySelectorAll(".pl-workspace-deck > section")).toHaveLength(3);
    expect(document.querySelectorAll(".pl-workspace-extra-content > section")).toHaveLength(3);
  });
  it("leaves an unknown native section structure untouched", () => {
    document.getElementById("classSearchTitle")!.id = "unexpectedSearchTitle";
    const original = document.body.innerHTML;
    mount();
    expect(document.body.innerHTML).toBe(original);
  });
  it("keeps native details accessible if their recorded structure changes", () => {
    const header = document.querySelector("table.coursetable tr")!;
    const cell = header.lastElementChild!;
    cell.remove();
    const original = document.body.innerHTML;
    mount(); expect(document.body.innerHTML).toBe(original);
    header.append(cell); mount();
    expect(document.querySelector(".pl-workspace-deck")).not.toBeNull();
    cell.remove(); expect(workspace.needsReconcile(document)).toBe(true);
    mount();
    expect(document.querySelector(".pl-workspace-deck")).toBeNull();
    expect(document.querySelector("table.coursetable")).not.toBeNull();
  });
  it("remounts a native panel redraw without reviving old sections", () => {
    mount(); document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!.click();
    const fixture = new DOMParser().parseFromString(workspaceFixtureHtml(), "text/html");
    const next = document.importNode(fixture.getElementById("ctl00_MainContent_classPlanPanel")!, true);
    document.getElementById("ctl00_MainContent_classPlanPanel")!.replaceWith(next);
    expect(workspace.needsReconcile(document)).toBe(true);
    mount();
    expect(document.querySelectorAll(".pl-workspace-deck")).toHaveLength(1);
    expect(document.querySelectorAll("#panelPlan")).toHaveLength(1);
    expect(document.querySelectorAll(".pl-workspace-detail-backdrop")).toHaveLength(1);
    expect(document.querySelector<HTMLElement>(".pl-workspace-detail-backdrop")!.hidden).toBe(true);
    expect(adapter.inspectContract().ok).toBe(true);
    expect(workspace.needsReconcile(document)).toBe(false);
  });
});
