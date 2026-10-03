// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyUclaPlannerAdapter } from "../../src/adapters/myucla-adapter";
import { MyUclaPlannerController } from "../../src/content/myucla-controller";
import { isKnownEmptyPlanner } from "../../src/content/planner-workspace";
// @ts-expect-error Shared browser fixtures use fictional native-shaped markup.
import { emptyPlanFixtureHtml, introductionFixtureHtml, futureQuarterFixtureHtml } from "../../harness/workspace-fixture.mjs";

const TRACKER = "ctl00_MainContent_planClassListView_clCommandFieldTracker";
const COMMAND = "ctl00_MainContent_planClassListView_clCommandField";
const ids = ["26440403", "26511217", "26691534"];

function command(direction: "up" | "down", id: string): string {
  const action = direction === "up" ? "moveupClass" : "movedownClass";
  return `courseListAction($(".maincontentpanel")[0].id, "${TRACKER}", "${COMMAND}", "${action}|${id}!0"); return false;`;
}

function card(
  id: string,
  index: number,
  label: string,
  status: string,
  conflict = false,
  total: number = ids.length
): string {
  return `
    <tbody class="Class${id} courseItem itemClass">
      <tr>
        <td class="SubjectAreaName_ClassName"><p>Class ${index + 1}: ${label}</p></td>
        <td class="linkPanelRight"><div class="OrderingButtons">
          <input class="colorpicker" type="color" />
          <button id="muClass${id}" class="link moveupClass"
            title="Move this Class up in the list" aria-label="Move this Class up in the list"
            onclick='${command("up", id)}' style="visibility:${index === 0 ? "hidden" : "visible"}"></button>
          <button id="mdClass${id}" class="link movedownClass"
            title="Move this Class down in the list" aria-label="Move this Class down in the list"
            onclick='${command("down", id)}' style="visibility:${index === total - 1 ? "hidden" : "visible"}"></button>
        </div></td>
      </tr>
      <tr><td>${conflict ? '<a class="uit-clickover-bottom" data-content="&lt;div class=&quot;popover_section_title warning light&quot;&gt;Warning: Time Conflict&lt;/div&gt;&lt;ul class=&#39;bulleted_list&#39;&gt;&lt;li&gt;COM SCI 35L&lt;/li&gt;&lt;/ul&gt;"><span class="icon-warning-sign"></span></a>' : ""}</td></tr>
      <tr><td><table class="coursetable"><tr><td>${status}</td></tr></table></td></tr>
    </tbody>`;
}

const LABELS: Record<string, string> = {
  [ids[0]]: "LING 1",
  [ids[1]]: "RUSSN C124C",
  [ids[2]]: "COM SCI 35L"
};
const STATUSES: Record<string, string> = {
  [ids[0]]: "Open: 4 of 100 Left",
  [ids[1]]: "Waitlisted Class Full (20)",
  [ids[2]]: "Enrolled Class Full (120)"
};

function planPanelHtml(order: readonly string[] = ids): string {
  return `<div id="panelPlan"><div id="div_landing"><table>
      ${order
        .map((id, index) =>
          card(id, index, LABELS[id], STATUSES[id], id === ids[2], order.length)
        )
        .join("")}
    </table></div></div>`;
}

function render(): void {
  document.body.innerHTML = `
    <form id="aspnetForm" method="post" action="/ClassPlanner/ClassPlan.aspx">
      <select id="ctl00_MainContent_termSessionChooser_TermChooser">
        <option value="26F" selected>Fall</option>
      </select>
      <input id="ctl00_MainContent_planIDField" value="1234567" />
      <div id="ctl00_MainContent_classPlanPanel">${planPanelHtml()}</div>
    </form>`;
}

/** MS AJAX replaces the whole UpdatePanel body on a partial postback. */
function partialPostback(order: readonly string[] = ids): void {
  document.getElementById("ctl00_MainContent_classPlanPanel")!.innerHTML =
    planPanelHtml(order);
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
  });
}

function planOrder(): string[] {
  return [...document.querySelectorAll<HTMLElement>("#div_landing > table > tbody.courseItem")]
    .map((cardNode) => (cardNode.className.match(/Class(\d+)/) || [])[1]);
}

describe("MyUclaPlannerController UI", () => {
  let controller: MyUclaPlannerController | null = null;

  beforeEach(() => {
    render();
    const stored: Record<string, unknown> = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: stored[key] })),
          set: vi.fn(async (value: Record<string, unknown>) => Object.assign(stored, value)),
          remove: vi.fn(async (key: string) => delete stored[key])
        }
      }
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
  });

  afterEach(() => {
    controller?.dispose();
    controller = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderWorkspace = (html:string) => {document.body.innerHTML=new DOMParser().parseFromString(html,'text/html').body.innerHTML;};
  const replaceWorkspace = (html:string) => {
    const next=new DOMParser().parseFromString(html,'text/html');
    document.querySelector('.classPlannerWrapper')!.replaceWith(document.importNode(next.querySelector('.classPlannerWrapper')!,true));
  };
  const enableTidy = () => chrome.storage.local.set({'plannerLift.layout.v1':{tidy:true}});

  it("starts a recognized empty New plan as presentation only, preserving native search and controls", async () => {
    renderWorkspace(emptyPlanFixtureHtml());await enableTidy();
    const adapter=new MyUclaPlannerAdapter(),body=document.getElementById('panelPlan')!,native=body.innerHTML;
    const controls=[...document.querySelectorAll('input,select')],parents=controls.map(node=>node.parentElement),submit=vi.fn();document.querySelector('form')!.addEventListener('submit',submit);
    expect(adapter.inspectContract().ok).toBe(false);expect(isKnownEmptyPlanner(document)).toBe(true);
    vi.mocked(chrome.storage.local.get).mockClear();controller=new MyUclaPlannerController(adapter);await controller.start();await settle();
    expect(document.querySelector('.pl-workspace-empty-plan')).not.toBeNull();expect(document.querySelectorAll('.pl-workspace-nav-main button')).toHaveLength(5);
    expect(document.querySelector('.pl-workspace-calendar')).not.toBeNull();expect(document.querySelector('.pl-search-widget')).not.toBeNull();expect(document.documentElement.classList.contains('pl-calm-page')).toBe(true);
    expect(document.querySelector('#planner-lift-toolbar')).toBeNull();expect(document.querySelector('[data-pl-real-tools]')).toBeNull();expect(document.querySelector('#planner-lift-actionbar')).toBeNull();
    expect(document.querySelector('.pl-workspace-empty')!.textContent).toContain('No classes in this plan yet');expect(body.innerHTML).toBe(native);
    expect(controls.filter(node=>node.id!=='ctl00_MainContent_cs_goButton').every((node)=>node.parentElement===parents[controls.indexOf(node)])).toBe(true);
    document.querySelector<HTMLButtonElement>('button[data-pl-module=find]')!.click();expect(document.querySelector('.pl-workspace-search.pl-module-active')).not.toBeNull();
    expect(isKnownEmptyPlanner(document)).toBe(true);expect(adapter.inspectContract().ok).toBe(false);expect(submit).not.toHaveBeenCalled();
    const keys=vi.mocked(chrome.storage.local.get).mock.calls.map(call=>call[0]);expect(keys).not.toContain('plannerLift.annotations.v1');expect(keys).not.toContain('plannerLift.draft.v1');
    controller.dispose();expect(document.querySelector('.pl-workspace-host')).toBeNull();expect(body.innerHTML).toBe(native);
  });

  it("returns from full to empty to full without stale save tools and detects in-place empty invalidation", async () => {
    renderWorkspace(introductionFixtureHtml());await enableTidy();controller=new MyUclaPlannerController(new MyUclaPlannerAdapter());await controller.start();await settle();
    expect(document.querySelector('[data-pl-real-tools]')).not.toBeNull();
    replaceWorkspace(emptyPlanFixtureHtml());await settle();await settle();
    expect(document.querySelector('.pl-workspace-empty-plan')).not.toBeNull();expect(document.querySelector('[data-pl-real-tools]')).toBeNull();expect(document.querySelector('#planner-lift-actionbar')).toBeNull();
    const marker=document.querySelector<HTMLElement>('#panelPlan .no_data_text')!,placeholder=document.createElement('div');marker.replaceWith(placeholder);await settle();await settle();
    expect(document.querySelector('.pl-workspace-host')).toBeNull();expect(document.querySelector('.pl-search-widget')).toBeNull();expect(document.documentElement.classList.contains('pl-calm-page')).toBe(false);
    placeholder.replaceWith(marker);await settle();await settle();expect(document.querySelector('.pl-workspace-empty-plan')).not.toBeNull();
    replaceWorkspace(introductionFixtureHtml());await settle();await settle();
    expect(document.querySelector('.pl-workspace-host')).not.toBeNull();expect(document.querySelector('.pl-workspace-empty-plan')).toBeNull();
    expect(document.querySelectorAll('[data-pl-real-tools]')).toHaveLength(6);expect(document.querySelector('#planner-lift-actionbar')).not.toBeNull();
  });

  it("activates the editable context when an initially empty plan receives native courses", async () => {
    renderWorkspace(emptyPlanFixtureHtml());await enableTidy();controller=new MyUclaPlannerController(new MyUclaPlannerAdapter());await controller.start();await settle();
    replaceWorkspace(introductionFixtureHtml());await settle();await settle();
    expect(document.querySelectorAll('[data-pl-real-tools]')).toHaveLength(6);expect(document.querySelector('#planner-lift-toolbar')).not.toBeNull();
    expect(document.querySelector('.pl-workspace-host')).not.toBeNull();expect(document.querySelector('.pl-workspace-empty-plan')).toBeNull();
  });

  it.each(['marker','foreign-form','foreign-command','unknown-module','future'])("leaves %s outside the empty-plan contract", async kind => {
    renderWorkspace(kind==='future'?futureQuarterFixtureHtml():emptyPlanFixtureHtml());await enableTidy();
    if(kind==='marker')document.querySelector('.no_data_text')!.className='unexpected-empty-text';
    if(kind==='foreign-form')document.querySelector('form')!.action='https://example.invalid/ClassPlanner/ClassPlan.aspx';
    if(kind==='foreign-command')document.getElementById(COMMAND)!.setAttribute('form','anotherForm');
    if(kind==='unknown-module'){const section=document.createElement('section');section.textContent='Example unknown module';document.getElementById('ctl00_MainContent_classPlanPanel')!.append(section);}
    expect(isKnownEmptyPlanner(document)).toBe(false);controller=new MyUclaPlannerController(new MyUclaPlannerAdapter());await controller.start();await settle();
    expect(document.querySelector('.pl-workspace-host')).toBeNull();expect(document.querySelector('.pl-search-widget')).toBeNull();expect(document.querySelector('[data-pl-real-tools]')).toBeNull();
  });

  it("adds a searchable summary without replacing official controls", async () => {
    const nativeCommands = [...document.querySelectorAll<HTMLButtonElement>("button.moveupClass")]
      .map((button) => button.getAttribute("onclick"));
    const adapter = new MyUclaPlannerAdapter();
    const contractSpy = vi.spyOn(adapter, "inspectContract");
    controller = new MyUclaPlannerController(adapter);
    await controller.start();
    await Promise.resolve();

    expect(document.querySelector("#planner-lift-toolbar")?.textContent).toContain(
      "Collapse all"
    );
    // The filter count is hidden until a filter is actually narrowing the list.
    expect(document.querySelector<HTMLElement>("[data-pl-count]")?.hidden).toBe(true);
    expect(document.querySelectorAll("input.colorpicker")).toHaveLength(3);
    expect(
      [...document.querySelectorAll<HTMLButtonElement>("button.moveupClass")].map((button) =>
        button.getAttribute("onclick")
      )
    ).toEqual(nativeCommands);

    const search = document.querySelector<HTMLInputElement>("[data-pl-search]")!;
    search.value = "russn";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll("tbody.courseItem.pl-filtered-out")).toHaveLength(2);
    expect(document.querySelector("[data-pl-count]")?.textContent).toBe("1 of 3");
    const checksAfterSearch = contractSpy.mock.calls.length;
    search.value = "russian";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(contractSpy).toHaveBeenCalledTimes(checksAfterSearch);

    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector<HTMLButtonElement>('[data-pl-action="toggle-all"]')!.click();
    expect(document.querySelectorAll("tbody.courseItem.pl-course-collapsed")).toHaveLength(3);

    const nativeClicks = vi.fn();
    document
      .querySelectorAll("button.moveupClass, button.movedownClass")
      .forEach((button) => button.addEventListener("click", nativeClicks));

    expect(planOrder()).toEqual(ids);

    document.querySelector<HTMLButtonElement>(
      `[data-course-id="myucla-class-${ids[1]}"] [data-pl-action="top"]`
    )!.click();

    // Rearranging is local: the list moves, MyUCLA is not touched, and the
    // student is offered one save rather than a confirmation per drag.
    expect(planOrder()).toEqual([ids[1], ids[0], ids[2]]);
    expect(nativeClicks).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    const dirty = document.querySelector<HTMLElement>("[data-pl-dirty]")!;
    expect(dirty.hidden).toBe(false);
    expect(document.querySelector("[data-pl-dirty-text]")?.textContent).toContain(
      "1 class moved"
    );

    // A second rearrangement batches into the same pending save.
    document.querySelector<HTMLButtonElement>(
      `[data-course-id="myucla-class-${ids[2]}"] [data-pl-action="top"]`
    )!.click();
    expect(planOrder()).toEqual([ids[2], ids[1], ids[0]]);
    expect(nativeClicks).not.toHaveBeenCalled();

    document.querySelector<HTMLButtonElement>('[data-pl-action="discard"]')!.click();
    expect(planOrder()).toEqual(ids);
    expect(document.querySelector<HTMLElement>("[data-pl-dirty]")?.hidden).toBe(true);
    expect(nativeClicks).not.toHaveBeenCalled();
  });

  it("rebuilds itself after an UpdatePanel partial postback", async () => {
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    await Promise.resolve();
    expect(document.querySelectorAll("[data-pl-real-tools]")).toHaveLength(3);

    // A colour change (or any MyUCLA action) replaces the panel body wholesale,
    // destroying our UI and the node the observer used to watch.
    partialPostback();
    expect(document.querySelectorAll("[data-pl-real-tools]")).toHaveLength(0);

    await settle();

    expect(document.querySelector("#planner-lift-toolbar")).not.toBeNull();
    expect(document.querySelectorAll("[data-pl-real-tools]")).toHaveLength(3);
  });

  it("does not revive controls after disposal with a native redraw queued", async () => {
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    partialPostback();
    await Promise.resolve(); // The observer has queued its animation frame.
    controller.dispose();
    await settle();
    expect(document.querySelectorAll("[data-planner-lift-owned]")).toHaveLength(0);
    expect(document.querySelectorAll(".pl-plan-root")).toHaveLength(0);
    expect(planOrder()).toEqual(ids);
  });

  it("does not finish starting after it is disabled during a storage read", async () => {
    let finishRead!: (value: Record<string, unknown>) => void;
    vi.mocked(chrome.storage.local.get).mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    const starting = controller.start();
    controller.dispose();
    finishRead({});
    await starting;
    partialPostback();
    await settle();
    expect(document.querySelectorAll("[data-planner-lift-owned]")).toHaveLength(0);
  });

  it("loads notes and view preferences for the new plan without carrying an unsaved order", async () => {
    const firstKey = "myucla-26F-plan-1234567", nextKey = "myucla-26F-plan-7654321";
    const courseId = `myucla-class-${ids[0]}`;
    await chrome.storage.local.set({
      "plannerLift.annotations.v1": {schemaVersion: 1, contexts: {
        [firstKey]: {[courseId]: {color: "none", tag: "First plan"}},
        [nextKey]: {[courseId]: {color: "none", tag: "Second plan"}}
      }},
      "plannerLift.view.v1": {[nextKey]: {collapsed: [courseId], seen: true}}
    });
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    expect(document.querySelector("[data-pl-tag-badge]")?.textContent).toBe("First plan");
    document.querySelector<HTMLButtonElement>(`[data-course-id="myucla-class-${ids[1]}"] [data-pl-action="top"]`)!.click();
    await settle();
    const draftsBefore = await chrome.storage.local.get("plannerLift.draft.v1");

    document.querySelector<HTMLInputElement>("#ctl00_MainContent_planIDField")!.value = "7654321";
    partialPostback();
    await settle();
    expect(planOrder()).toEqual(ids);
    expect(document.querySelector("[data-pl-tag-badge]")?.textContent).toBe("Second plan");
    expect(document.querySelector(`tbody.Class${ids[0]}`)?.classList.contains("pl-course-collapsed")).toBe(true);
    expect(document.querySelector<HTMLElement>("[data-pl-dirty]")?.hidden).toBe(true);
    expect(await chrome.storage.local.get("plannerLift.draft.v1")).toEqual(draftsBefore);

    document.querySelector<HTMLInputElement>("#ctl00_MainContent_planIDField")!.value = "1234567";
    partialPostback();
    await settle();
    expect(document.querySelector("[data-pl-tag-badge]")?.textContent).toBe("First plan");
    expect(document.querySelector<HTMLElement>("[data-pl-draft]")?.hidden).toBe(false);
  });

  it("removes stale save controls on a future quarter while preserving the prior draft", async () => {
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    document.querySelector<HTMLButtonElement>(`[data-course-id="myucla-class-${ids[1]}"] [data-pl-action="top"]`)!.click();
    await settle();
    const draftsBefore = await chrome.storage.local.get("plannerLift.draft.v1");
    document.getElementById("ctl00_MainContent_classPlanPanel")!.innerHTML = '<p>Example future plan</p>';
    await settle();
    expect(document.querySelector("#planner-lift-actionbar")).toBeNull();
    expect(document.querySelector("[data-pl-action=save]")).toBeNull();
    expect(document.documentElement.classList.contains("pl-has-actionbar")).toBe(false);
    expect(await chrome.storage.local.get("plannerLift.draft.v1")).toEqual(draftsBefore);

    partialPostback();
    await settle();
    expect(document.querySelector<HTMLElement>("[data-pl-draft]")?.hidden).toBe(false);
    expect(document.querySelector("[data-pl-status]")?.textContent).toBe("");
    expect(planOrder()).toEqual(ids);
  });

  it("ignores an old plan's delayed storage response after a second navigation", async () => {
    const courseId = `myucla-class-${ids[0]}`;
    await chrome.storage.local.set({"plannerLift.annotations.v1": {schemaVersion: 1, contexts: {
      "myucla-26F-plan-7654321": {[courseId]: {color: "none", tag: "Skipped plan"}},
      "myucla-26F-plan-7654322": {[courseId]: {color: "none", tag: "Current plan"}}
    }}});
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    const originalGet = vi.mocked(chrome.storage.local.get).getMockImplementation()! as unknown as (key: string) => Promise<Record<string, unknown>>;
    let finish!: (value: Record<string, unknown>) => void;
    let held = false;
    vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) => {
      if (key === "plannerLift.annotations.v1" && !held) {
        held = true;
        return new Promise<Record<string, unknown>>(resolve => { finish = resolve; });
      }
      return originalGet(key);
    }) as typeof chrome.storage.local.get);
    const plan = document.querySelector<HTMLInputElement>("#ctl00_MainContent_planIDField")!;
    plan.value = "7654321"; partialPostback(); await settle();
    plan.value = "7654322"; partialPostback(); await settle();
    expect(document.querySelector("[data-pl-tag-badge]")?.textContent).toBe("Current plan");
    finish(await originalGet("plannerLift.annotations.v1"));
    await settle();
    expect(document.querySelector("[data-pl-tag-badge]")?.textContent).toBe("Current plan");
    expect(document.querySelectorAll("[data-pl-real-tools]")).toHaveLength(3);
  });

  it("keeps secondary actions accessible in a menu without touching native buttons", async () => {
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    const tools = document.querySelector<HTMLElement>("[data-pl-real-tools]")!;
    const menu = tools.querySelector<HTMLDetailsElement>("[data-pl-course-menu]")!;
    const summary = menu.querySelector<HTMLElement>("summary")!;
    const nativeClicks = vi.fn();
    document.querySelectorAll("button.moveupClass, button.movedownClass").forEach((button) => button.addEventListener("click", nativeClicks));
    summary.click();
    expect(menu.open).toBe(true);
    menu.querySelector<HTMLButtonElement>('[data-pl-action="tag"]')!.click();
    expect(menu.open).toBe(false);
    expect(tools.querySelector<HTMLElement>("[data-pl-tag-editor]")?.hidden).toBe(false);
    expect(document.activeElement).toBe(tools.querySelector("[data-pl-tag]"));
    summary.click();
    summary.focus();
    summary.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect(nativeClicks).not.toHaveBeenCalled();
  });

  it("restores an unsaved arrangement when a postback did not change the order", async () => {
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    await Promise.resolve();

    document.querySelector<HTMLButtonElement>(
      `[data-course-id="myucla-class-${ids[1]}"] [data-pl-action="top"]`
    )!.click();
    expect(planOrder()).toEqual([ids[1], ids[0], ids[2]]);

    // MyUCLA re-renders the server order, which is still the original one.
    partialPostback(ids);
    await settle();

    expect(planOrder()).toEqual([ids[1], ids[0], ids[2]]);
    expect(document.querySelector<HTMLElement>("[data-pl-dirty]")?.hidden).toBe(false);
    // Position chips and MyUCLA's own "Class N:" numbers follow what is on
    // screen, not the order the server just re-rendered.
    const chip = (id: string): string =>
      document.querySelector<HTMLSelectElement>(
        `[data-course-id="myucla-class-${id}"] [data-pl-position]`
      )!.value;
    expect(chip(ids[1])).toBe("0");
    expect(chip(ids[0])).toBe("1");
    expect(
      document.querySelector<HTMLElement>(`tbody.Class${ids[1]} p`)!.textContent!.trim()
    ).toBe("Class 1: RUSSN C124C");
  });

  it("drops unsaved changes when MyUCLA's own order moved underneath", async () => {
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    await Promise.resolve();

    document.querySelector<HTMLButtonElement>(
      `[data-course-id="myucla-class-${ids[1]}"] [data-pl-action="top"]`
    )!.click();
    expect(document.querySelector<HTMLElement>("[data-pl-dirty]")?.hidden).toBe(false);

    // Someone used an official arrow: the server order itself is different now.
    partialPostback([ids[2], ids[0], ids[1]]);
    await settle();

    expect(planOrder()).toEqual([ids[2], ids[0], ids[1]]);
    expect(document.querySelector<HTMLElement>("[data-pl-dirty]")?.hidden).toBe(true);
    expect(document.querySelector("[data-pl-status]")?.textContent).toContain(
      "unsaved changes were dropped"
    );
  });

  it("renumbers MyUCLA's own Class labels while an arrangement is unsaved", async () => {
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    await Promise.resolve();

    const titleOf = (id: string): string =>
      document.querySelector<HTMLElement>(`tbody.Class${id} p`)!.textContent!.trim();
    expect(titleOf(ids[1])).toBe("Class 2: RUSSN C124C");

    document.querySelector<HTMLButtonElement>(
      `[data-course-id="myucla-class-${ids[1]}"] [data-pl-action="top"]`
    )!.click();
    expect(titleOf(ids[1])).toBe("Class 1: RUSSN C124C");
    expect(titleOf(ids[0])).toBe("Class 2: LING 1");

    document.querySelector<HTMLButtonElement>('[data-pl-action="discard"]')!.click();
    expect(titleOf(ids[1])).toBe("Class 2: RUSSN C124C");
    expect(titleOf(ids[0])).toBe("Class 1: LING 1");
  });

  it("keeps the arrangement and its renumbered labels while saving", async () => {
    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    await Promise.resolve();

    const title = (id: string): string =>
      document.querySelector<HTMLElement>(`tbody.Class${id} p`)!.textContent!.trim();
    const chip = (id: string): string =>
      document.querySelector<HTMLSelectElement>(
        `[data-course-id="myucla-class-${id}"] [data-pl-position]`
      )!.value;

    document.querySelector<HTMLButtonElement>(
      `[data-course-id="myucla-class-${ids[1]}"] [data-pl-action="top"]`
    )!.click();
    expect(title(ids[1])).toBe("Class 1: RUSSN C124C");
    expect(chip(ids[1])).toBe("0");

    // The offscreen frame cannot load under jsdom, so freeze its timers and
    // check the visible page the moment saving starts.
    vi.useFakeTimers();
    try {
      document.querySelector<HTMLButtonElement>('[data-pl-action="save"]')!.click();
      await Promise.resolve();

      // Saving must not quietly put MyUCLA's original numbering back while the
      // list is still showing the student's arrangement.
      expect(planOrder()).toEqual([ids[1], ids[0], ids[2]]);
      expect(title(ids[1])).toBe("Class 1: RUSSN C124C");
      expect(title(ids[0])).toBe("Class 2: LING 1");
      expect(chip(ids[1])).toBe("0");
      expect(document.querySelector("[data-pl-status]")?.textContent).toBe("Saving to MyUCLA\u2026");
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers back an arrangement that a logout interrupted", async () => {
    const key = "plannerLift.draft.v1";
    await chrome.storage.local.set({
      [key]: {
        "myucla-26F-plan-1234567": {
          savedOrder: ids.map((id) => `myucla-class-${id}`),
          desiredOrder: [ids[2], ids[0], ids[1]].map((id) => `myucla-class-${id}`),
          moved: [`myucla-class-${ids[2]}`],
          expiresAt: Date.now() + 60_000
        }
      }
    });

    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    await Promise.resolve();

    const offer = document.querySelector<HTMLElement>("[data-pl-draft]")!;
    expect(offer.hidden).toBe(false);
    expect(planOrder()).toEqual(ids);

    document.querySelector<HTMLButtonElement>('[data-pl-action="restore-draft"]')!.click();

    expect(planOrder()).toEqual([ids[2], ids[0], ids[1]]);
    expect(document.querySelector<HTMLElement>("[data-pl-dirty]")?.hidden).toBe(false);
    expect(offer.hidden).toBe(true);
  });

  it("drops a draft once MyUCLA's own order has moved on", async () => {
    await chrome.storage.local.set({
      "plannerLift.draft.v1": {
        "myucla-26F-plan-1234567": {
          savedOrder: [ids[1], ids[0], ids[2]].map((id) => `myucla-class-${id}`),
          desiredOrder: [ids[2], ids[1], ids[0]].map((id) => `myucla-class-${id}`),
          moved: [],
          expiresAt: Date.now() + 60_000
        }
      }
    });

    controller = new MyUclaPlannerController(new MyUclaPlannerAdapter());
    await controller.start();
    await Promise.resolve();

    expect(document.querySelector<HTMLElement>("[data-pl-draft]")?.hidden).toBe(true);
    expect(planOrder()).toEqual(ids);
  });
});
