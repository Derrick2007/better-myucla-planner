// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerWorkspace } from "../../src/content/planner-workspace";
import { MyUclaPlannerAdapter } from "../../src/adapters/myucla-adapter";
// @ts-expect-error Shared browser fixture is plain JavaScript.
import { workspaceFixtureHtml, introductionFixtureHtml } from "../../harness/workspace-fixture.mjs";

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
  it("keeps a long exam note in a separate disclosure and preserves its native source", () => {
    const course=adapter.inspectContract().courses[0],exam=course.node.querySelector('.final_exam_info')!;
    const native=exam.innerHTML;mount();course.node.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!.click();
    const disclosure=document.querySelector<HTMLDetailsElement>('.pl-workspace-preview-head details')!;
    expect(disclosure.open).toBe(false);expect(disclosure.querySelector('summary')!.textContent).toBe('Final exam');
    expect(disclosure.querySelector('p')!.textContent).toBe(exam.textContent!.replace(/\s+/g,' ').trim());
    expect(exam.innerHTML).toBe(native);
  });
  it("restores native sections, term and tools exactly", () => {
    const original = document.body.innerHTML;
    mount(); document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!.click(); workspace.restore();
    expect(document.body.innerHTML).toBe(original);
  });
  it("keeps the planner interactive while details are docked", () => {
    mount();
    const details = document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!;
    const native = document.querySelector<HTMLButtonElement>('#fixture-native-navigation button')!;
    const handler = vi.fn(); native.addEventListener('click', handler);
    details.click(); native.click();
    expect(handler).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(false);
    expect(document.querySelector('.pl-workspace-detail-backdrop')).toBeNull();
    document.querySelector<HTMLButtonElement>('.pl-workspace-pane-switches button:nth-child(2)')!.click();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(false);
    expect(adapter.inspectContract().ok).toBe(true);
  });
  it("offers an accessible close button and toggles the same course details", () => {
    mount();
    const details = document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!;
    const close = document.querySelector<HTMLButtonElement>(".pl-workspace-preview-close")!;
    details.click();
    expect(close.getAttribute("aria-label")).toBe("Close details");
    close.click();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(true);
    expect(document.activeElement).toBe(details);
    details.click(); details.click();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(true);
  });
  it("resizes supporting panes with the keyboard and restores original controls", () => {
    const controls = [...document.querySelectorAll(".ClassSearchWidget input,.ClassSearchWidget select")];
    mount();
    const separators = [...document.querySelectorAll<HTMLElement>('[role="separator"]')];
    expect(separators).toHaveLength(2);
    separators[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    expect(separators[0].getAttribute('aria-valuenow')).toBe('256');
    separators[1].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
    expect(separators[1].getAttribute('aria-valuenow')).toBe('476');
    separators[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
    expect(separators[0].getAttribute('aria-valuenow')).toBe('420');
    separators[0].dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
    expect(separators[0].getAttribute('aria-valuenow')).toBe('240');
    expect([...document.querySelectorAll(".ClassSearchWidget input,.ClassSearchWidget select")]).toEqual(controls);
    expect(controls.every(node=>node.closest('form')===document.getElementById('aspnetForm'))).toBe(true);
    workspace.restore(); expect(document.querySelector('[role="separator"]')).toBeNull();
  });
  it("expands Browse and restores the user's pane choices without native actions", () => {
    mount();
    const paneButtons=[...document.querySelectorAll<HTMLButtonElement>('.pl-workspace-pane-switches button')];
    paneButtons[0].click();
    const expand=document.querySelector<HTMLButtonElement>('.pl-browse-expand')!;
    const nativeForm=document.querySelector('form')!;
    const submit=vi.fn();nativeForm.addEventListener('submit',submit);
    expand.click();
    expect(document.querySelector('.pl-workspace-deck')!.classList.contains('pl-browse-expanded')).toBe(true);
    expect(paneButtons.map(b=>b.getAttribute('aria-pressed'))).toEqual(['false','false','true']);
    expect(expand.textContent).toBe('Restore panes');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(paneButtons.map(b=>b.getAttribute('aria-pressed'))).toEqual(['false','true','true']);
    expect(document.activeElement).toBe(expand);
    expand.click();paneButtons[0].click();
    expect(document.querySelector('.pl-browse-expanded')).toBeNull();
    expect(paneButtons.map(b=>b.getAttribute('aria-pressed'))).toEqual(['true','true','true']);
    expect(submit).not.toHaveBeenCalled();expect(adapter.inspectContract().ok).toBe(true);
  });
  it("lists all three other native sections and restores every section in original layout", () => {
    const sections = [...document.querySelectorAll("#ctl00_MainContent_classPlanPanel > section")];
    mount();
    expect(document.querySelector(".pl-workspace-extras > summary")!.textContent).toBe("Tools (3)");
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
  it("returns from docked details to results before expanding Browse", () => {
    mount();
    const course=adapter.inspectContract().courses[0],row=course.node.children[2],parent=row.parentElement;
    const nativeFields=[...row.querySelectorAll('input,select,button')];
    course.node.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!.click();
    expect(document.querySelector<HTMLElement>('.pl-workspace-preview')!.hidden).toBe(false);
    const expand=document.querySelector<HTMLButtonElement>('.pl-browse-expand')!;expand.click();
    expect(document.querySelector<HTMLElement>('.pl-workspace-preview')!.hidden).toBe(true);
    expect(document.querySelector('.pl-inspector-open')).toBeNull();
    expect(document.querySelector('.pl-workspace-preview-card')).toBeNull();
    expect(document.querySelector('.pl-browse-expanded')).not.toBeNull();
    expect(row.parentElement).toBe(parent);
    expect([...row.querySelectorAll('input,select,button')]).toEqual(nativeFields);
    expect(document.activeElement).toBe(expand);
  });
  it("keeps the return to workspace control after an original-layout redraw", () => {
    mount();document.querySelector<HTMLButtonElement>('.pl-workspace-original')!.click();
    const replacement=new DOMParser().parseFromString(workspaceFixtureHtml(), 'text/html');
    document.querySelector('.classPlannerWrapper')!.replaceWith(document.importNode(replacement.querySelector('.classPlannerWrapper')!,true));
    mount();
    expect(document.querySelector('.pl-workspace-deck')).toBeNull();
    expect(document.querySelectorAll('.pl-workspace-return')).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('.pl-workspace-return')!.click();
    expect(document.querySelectorAll('.pl-workspace-deck > section')).toHaveLength(3);
    expect(adapter.inspectContract().ok).toBe(true);
  });
  it("leaves an unknown native section structure untouched", () => {
    document.getElementById("classSearchTitle")!.id = "unexpectedSearchTitle";
    const original = document.body.innerHTML;
    mount();
    expect(document.body.innerHTML).toBe(original);
  });
  it("folds locally once, reclaims columns and keeps a keyboard-accessible reopening route", () => {
    const title = document.getElementById("plannerSectionClip")!;
    const native = title.querySelector<HTMLButtonElement>("button.planSectionToggle")!;
    const handler = vi.fn(); native.addEventListener("click", handler);
    const body = document.getElementById("panelPlan")!;
    const bodyStyle = body.getAttribute("style");
    mount();
    const reopen = document.querySelector<HTMLButtonElement>('.pl-workspace-pane-switches button:nth-child(1)')!;
    native.click();
    expect(handler).not.toHaveBeenCalled();
    expect(body.parentElement!.classList.contains("pl-pane-collapsed")).toBe(true);
    expect(document.activeElement).toBe(reopen);
    expect(reopen.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector<HTMLElement>(".pl-workspace-deck")!.style.getPropertyValue("--pl-workspace-columns")).not.toContain("240px");
    reopen.click();
    expect(body.parentElement!.classList.contains("pl-pane-open")).toBe(true);
    expect(body.getAttribute("style")).toBe(bodyStyle);
    expect(native.getAttribute("onclick")).toBeNull();
    workspace.restore(); native.click(); expect(handler).toHaveBeenCalledOnce();
  });
  it("can reopen every pane after closing all three and keeps the native top menus in place", () => {
    const term = document.getElementById("ctl00_MainContent_termSessionChooser")!;
    const menu = document.querySelector(".plannerTopMenuLinks")!;
    const menuParent = menu.parentElement, termParent = term.parentElement;
    const menuNext = menu.nextSibling, termNext = term.nextSibling;
    mount();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".pl-workspace-pane-switches button")];
    buttons.forEach(button=>button.click());
    expect(document.querySelector<HTMLElement>(".pl-workspace-empty")!.hidden).toBe(false);
    expect(document.querySelectorAll(".pl-workspace-deck > section.pl-pane-collapsed")).toHaveLength(3);
    buttons.forEach(button=>button.click());
    expect(document.querySelector<HTMLElement>(".pl-workspace-empty")!.hidden).toBe(true);
    expect(document.querySelectorAll(".pl-workspace-deck > section.pl-pane-open")).toHaveLength(3);
    expect(menu.parentElement).toBe(menuParent); expect(term.parentElement).toBe(termParent);
    expect(menu.nextSibling).not.toBe(menuNext); // Only the owned control row was inserted before the panel.
    workspace.restore(); expect(menu.nextSibling).toBe(menuNext); expect(term.nextSibling).toBe(termNext);
  });
  it("opens a folded secondary module through its shortcut without invoking native handlers", () => {
    const section = document.querySelector<HTMLElement>(".classPlanner_PersonalTimeBlocksSection")!;
    const body = section.children[1] as HTMLElement; body.style.display = "none";
    mount();
    const toggle = section.querySelector<HTMLButtonElement>(".pl-pane-toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    document.querySelector<HTMLButtonElement>(".pl-workspace-section-links button:last-child")!.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(toggle);
    toggle.click(); expect(toggle.getAttribute("aria-expanded")).toBe("false");
    workspace.restore(); expect(body.style.display).toBe("none");
  });
  it("retains local pane choices after a native redraw and rejects unknown body shapes", () => {
    mount();
    document.querySelector<HTMLButtonElement>(".pl-workspace-pane-switches button:last-child")!.click();
    const fixture = new DOMParser().parseFromString(workspaceFixtureHtml(), "text/html");
    document.getElementById("ctl00_MainContent_classPlanPanel")!.replaceWith(document.importNode(fixture.getElementById("ctl00_MainContent_classPlanPanel")!,true));
    mount();
    expect(document.querySelector(".pl-workspace-search")!.classList.contains("pl-pane-collapsed")).toBe(true);
    document.querySelector<HTMLButtonElement>(".pl-workspace-pane-switches button:last-child")!.click();
    expect(document.querySelector(".pl-workspace-search")!.classList.contains("pl-pane-open")).toBe(true);
    workspace.restore();
    document.querySelector(".classPlanner_ClassSearchSection")!.append(document.createElement("div"));
    const before = document.body.innerHTML;
    mount(); expect(document.body.innerHTML).toBe(before);
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
  it("restores root scrolling after an automatic remount temporarily shortens the page", () => {
    mount();
    let scrollY = 280;
    const scroll = vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    const restore = workspace.restore.bind(workspace);
    const restoreSpy = vi.spyOn(workspace, "restore").mockImplementation(() => {
      restore();
      // Simulate Chrome clamping scroll when removing the fixed workspace spacer.
      scrollY = 0;
    });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((options: ScrollToOptions | number) => {
      expect(document.querySelector(".pl-workspace-deck")).not.toBeNull();
      expect(document.querySelector<HTMLElement>(".pl-workspace-scroll-room")!.style.height).not.toBe("");
      scrollY = typeof options === "number" ? options : options.top || 0;
    });
    try {
      const next = new DOMParser().parseFromString(workspaceFixtureHtml(), "text/html");
      document.getElementById("ctl00_MainContent_classPlanPanel")!.replaceWith(document.importNode(next.getElementById("ctl00_MainContent_classPlanPanel")!, true));
      mount();
      expect(scrollY).toBe(280);
      expect(scrollTo).toHaveBeenCalledOnce();
      scrollTo.mockClear();
      document.querySelector<HTMLButtonElement>(".pl-workspace-original")!.click();
      expect(scrollTo).not.toHaveBeenCalled();
      expect(document.querySelector(".pl-workspace-deck")).toBeNull();
    } finally {
      restoreSpy.mockRestore(); scrollTo.mockRestore(); scroll.mockRestore();
    }
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
    expect(document.querySelectorAll(".pl-workspace-preview")).toHaveLength(1);
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(true);
    expect(adapter.inspectContract().ok).toBe(true);
    expect(workspace.needsReconcile(document)).toBe(false);
  });
  it("compacts the known introduction without moving the term or changing UCLA navigation", () => {
    document.body.innerHTML = new DOMParser().parseFromString(introductionFixtureHtml(), "text/html").body.innerHTML;
    const original = document.body.innerHTML, nav = document.getElementById('fixture-native-navigation')!;
    const navHtml = nav.outerHTML, term = document.getElementById('ctl00_MainContent_termSessionChooser_TermChooser')!;
    const termParent = term.parentElement, fields = [...document.querySelectorAll('input,select')];
    const text = document.getElementById('page_title_text')!, textHtml = text.innerHTML;
    mount(); mount();
    expect(nav.outerHTML).toBe(navHtml); expect(term.parentElement).toBe(termParent);
    expect(new Set([...document.querySelectorAll('input,select')].filter(node=>!node.closest('[data-planner-lift-owned]')))).toEqual(new Set(fields));
    const about = document.querySelector<HTMLDetailsElement>('.pl-intro-about')!;
    expect(about.open).toBe(false); expect(text.parentElement).toBe(about); expect(text.innerHTML).toBe(textHtml);
    expect(document.querySelectorAll('.pl-intro-term-label')).toHaveLength(1);
    expect(document.querySelectorAll('.pl-intro-notice')).toHaveLength(2);
    workspace.restore(); expect(document.body.innerHTML).toBe(original);
  });
  it("keeps every sidebar widget accessible with close and Escape returning focus", () => {
    document.body.innerHTML = new DOMParser().parseFromString(introductionFixtureHtml(), "text/html").body.innerHTML;
    const sidebar = document.querySelector('right-sidebar')!, parent = sidebar.parentElement;
    const widgets = [...sidebar.children], help = sidebar.querySelector<HTMLButtonElement>('button')!, handler = vi.fn();
    help.addEventListener('click', handler); mount();
    const info = document.querySelector<HTMLButtonElement>('.pl-intro-info')!;
    info.click(); expect(sidebar.classList.contains('pl-intro-sidebar-open')).toBe(true);
    expect(info.getAttribute('aria-expanded')).toBe('true'); expect(sidebar.parentElement).toBe(parent);
    help.click(); expect(handler).toHaveBeenCalledOnce();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(info.getAttribute('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(info);
    info.click(); document.querySelector<HTMLButtonElement>('.pl-intro-info-close')!.click();
    expect(document.activeElement).toBe(info); workspace.restore(); expect([...sidebar.children]).toEqual(widgets);
  });
  it("compacts and restores the banner by scrolling while preserving native navigation", () => {
    document.body.innerHTML = new DOMParser().parseFromString(introductionFixtureHtml(), "text/html").body.innerHTML;
    const nav = document.getElementById('fixture-native-navigation')!, navHtml = nav.outerHTML;
    const title = document.getElementById('titleText')!;
    let scrollY = 0;
    const scroll = vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
    const bounds = vi.spyOn(title, 'getBoundingClientRect').mockImplementation(() => ({top: 178 - scrollY}) as DOMRect);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options: ScrollToOptions | number) => {
      scrollY = typeof options === 'number' ? options : options.top || 0;
      window.dispatchEvent(new Event('scroll'));
    });
    try {
      mount(); const button = document.querySelector<HTMLButtonElement>('.pl-intro-header-toggle')!;
      expect(button.type).toBe('button'); expect(button.textContent).toBe('Compact header');
      button.click(); expect(scrollY).toBe(166); expect(button.textContent).toBe('Show header');
      expect(button.getAttribute('aria-pressed')).toBe('true'); expect(document.activeElement).toBe(button);
      expect(nav.outerHTML).toBe(navHtml); expect(document.getElementById('fixture-native-navigation')).toBe(nav);
      button.click(); expect(scrollY).toBe(0); expect(button.textContent).toBe('Compact header');
      expect(nav.outerHTML).toBe(navHtml); workspace.restore(); expect(button.isConnected).toBe(false);
    } finally { scrollTo.mockRestore(); bounds.mockRestore(); scroll.mockRestore(); }
  });
  it("leaves unfamiliar introductions native and preserves replacement text on reconciliation", () => {
    document.body.innerHTML = new DOMParser().parseFromString(introductionFixtureHtml(), "text/html").body.innerHTML;
    const sidebar = document.querySelector('right-sidebar')!; sidebar.remove(); mount();
    expect(document.querySelector('.pl-intro-about')).toBeNull(); expect(document.querySelector('.pl-intro-info')).toBeNull();
    workspace.restore(); document.querySelector('layout-columnwrapper')!.append(sidebar); mount();
    const old = document.getElementById('page_title_text')!, next = old.cloneNode(true) as HTMLElement;
    next.textContent = 'New example introduction'; old.replaceWith(next);
    expect(workspace.needsReconcile(document)).toBe(true); mount();
    expect(document.getElementById('page_title_text')).toBe(next); expect(old.isConnected).toBe(false);
    workspace.restore(); expect(next.parentElement?.id).toBe('div_page_title_section2');
    expect(document.querySelectorAll('#page_title_text')).toHaveLength(1);
  });
});
