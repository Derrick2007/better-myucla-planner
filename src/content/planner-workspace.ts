import type { CourseSnapshot } from "../adapters/planner-adapter";

const OWNED = "data-planner-lift-owned";
const PANEL = "ctl00_MainContent_classPlanPanel";
const PRIMARY = [
  ["classPlanner_CalendarSection", "plannerSectionCal", "pl-workspace-calendar"],
  ["classPlanner_ClassesInPlanSection", "plannerSectionClip", "pl-workspace-plan"],
  ["classPlanner_ClassSearchSection", "classSearchTitle", "pl-workspace-search"]
] as const;
const SECONDARY = [
  ["classPlanner_ClassOptimizerSection", "Plan Optimizer"],
  ["classPlanner_EnrolledNotInPlanSection", "Study list outside this plan"],
  ["classPlanner_PersonalTimeBlocksSection", "Personal Entries"]
] as const;
interface Placement { node: HTMLElement; anchor: Comment; }
interface Workspace {
  doc: Document; host: HTMLElement; panel: HTMLElement; deck: HTMLElement;
  top: HTMLElement; extras: HTMLDetailsElement; placements: Placement[];
  preview: HTMLElement; backdrop: HTMLElement; head: HTMLElement; close: HTMLButtonElement;
  expand: HTMLButtonElement;
  resize: () => void; key: (event: KeyboardEvent) => void; outside: (event: MouseEvent) => void;
}
function officialText(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  copy.querySelectorAll(`[${OWNED}],script,input,textarea`).forEach(n => n.remove());
  return (copy.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500);
}
function hasKnownDetails(card: HTMLElement): boolean {
  const rows = [...card.children];
  const tables = card.querySelectorAll(":scope > tr:nth-child(3) table.coursetable");
  const header = tables[0]?.querySelector("tr");
  return rows.length === 3 && rows.every(row => row.tagName === "TR") && tables.length === 1 && header?.children.length === 9;
}

/** Reorganizes the existing page. No iframe, replacement form, or data service. */
export class PlannerWorkspace {
  private state: Workspace | null = null;
  private selected: HTMLElement | null = null;
  private selectedHadStyle = false;
  private returnFocus: HTMLElement | null = null;
  private useOriginal = false;
  private returnButton: HTMLButtonElement | null = null;
  private latestCourses: readonly CourseSnapshot[] = [];

  needsReconcile(doc: Document): boolean {
    if (this.useOriginal) return false;
    const s = this.state;
    return !!s && (doc.getElementById(PANEL) !== s.panel || !s.deck.isConnected || (!!this.selected && !this.selected.isConnected) || this.latestCourses.some(c => !hasKnownDetails(c.node)));
  }

  reconcile(doc: Document, courses: readonly CourseSnapshot[]): void {
    this.latestCourses = courses;
    // A compact card must always have a usable route to its native details.
    if (courses.some(course => !hasKnownDetails(course.node))) { this.restore(); return; }
    const old = this.state;
    if (old && (doc.getElementById(PANEL) !== old.panel || !old.deck.isConnected)) this.restore();
    if (this.selected && !this.selected.isConnected) this.closePreview(false);
    if (!this.state && !this.useOriginal) this.mount(doc);
    const s = this.state;
    if (!s) return;
    for (const course of courses) {
      const host = course.node.querySelector<HTMLElement>(":scope > tr:first-child > td.linkPanelRight");
      if (!host) continue;
      if (!host.querySelector("[data-pl-workspace-details]")) {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "pl-workspace-detail-button";
        button.setAttribute(OWNED, "true");
        button.dataset.plWorkspaceDetails = "true";
        button.textContent = "Details";
        button.setAttribute("aria-label", `Details for ${course.label}`);
        button.addEventListener("click", () => this.openPreview(course, button));
        host.append(button);
      }
    }
  }

  openCourse(course: CourseSnapshot, trigger?: HTMLElement): boolean {
    if (!this.state || !course.node.querySelector("[data-pl-workspace-details]")) return false;
    this.openPreview(course, trigger || null);
    return true;
  }

  private mount(doc: Document): void {
    const panel = doc.getElementById(PANEL);
    const host = panel?.parentElement;
    if (!panel || !host?.classList.contains("classPlannerWrapper") || !host.closest("form#aspnetForm")) return;
    const sections = PRIMARY.map(([cls, title]) => [...panel.children].filter(n => n.matches(`section.${cls}`) && n.querySelector(`:scope > #${title}.classPlanner_SectionTitle`)));
    if (sections.some(matches => matches.length !== 1)) return;
    const placements: Placement[] = [];
    const place = (node: HTMLElement, destination: HTMLElement) => {
      const anchor = doc.createComment("planner-lift-workspace-position");
      node.before(anchor); placements.push({ node, anchor }); destination.append(node);
    };
    // These containers contain original page nodes; never mark them owned.
    const deck = doc.createElement("div"); deck.className = "pl-workspace-deck";
    panel.append(deck);
    sections.forEach((matches, i) => { const section = matches[0] as HTMLElement; section.classList.add(PRIMARY[i][2]); place(section, deck); });
    const top = doc.createElement("div"); top.className = "pl-workspace-top";
    host.prepend(top);
    const term = doc.getElementById("ctl00_MainContent_termSessionChooser");
    if (term?.classList.contains("enroll_term") && term.closest("form") === host.closest("form")) place(term, top);
    const extras = doc.createElement("details"); extras.className = "pl-workspace-extras";
    const summary = doc.createElement("summary"); summary.setAttribute(OWNED, "true");
    extras.append(summary); top.append(extras);
    const tools = doc.createElement("div"); tools.className = "pl-workspace-extra-content"; extras.append(tools);
    const directory = doc.createElement("nav"); directory.className = "pl-workspace-section-links";
    directory.setAttribute(OWNED, "true"); directory.setAttribute("aria-label", "Other planner sections"); tools.append(directory);
    for (const node of [...host.children]) if (node.matches(".plannerTopMenuLinks")) place(node as HTMLElement, tools);
    for (const [cls, label] of SECONDARY) {
      const matches = [...panel.children].filter(node => node.matches(`section.${cls}`));
      for (const node of matches) {
        const section = node as HTMLElement; place(section, tools);
        const link = doc.createElement("button"); link.type = "button"; link.textContent = label;
        link.addEventListener("click", () => {
          // Scroll only the disclosure; the original section toggle remains native.
          tools.scrollTop += section.getBoundingClientRect().top - tools.getBoundingClientRect().top - directory.getBoundingClientRect().height - 24;
          section.querySelector<HTMLElement>(".classPlanner_SectionTitle button")?.focus({ preventScroll: true });
        });
        directory.append(link);
      }
    }
    summary.textContent = `Other sections (${directory.children.length}) & actions`;
    const expand = doc.createElement("button"); expand.type = "button"; expand.className = "pl-workspace-expand-search";
    expand.setAttribute(OWNED, "true"); expand.setAttribute("aria-expanded", "false"); expand.setAttribute("aria-controls", "panelSearch");
    expand.textContent = "Expand search";
    const searchTitle = sections[2][0].querySelector("#classSearchTitle")!; searchTitle.append(expand);
    expand.addEventListener("click", () => this.setSearchExpanded(!deck.classList.contains("pl-workspace-search-expanded")));
    const original = doc.createElement("button"); original.type = "button"; original.className = "pl-workspace-original";
    original.textContent = "Original layout"; original.setAttribute(OWNED, "true"); top.append(original);
    original.addEventListener("click", () => {
      this.restore(); this.useOriginal = true;
      const back = doc.createElement("button"); back.type = "button"; back.className = "pl-workspace-return";
      back.textContent = "Open planner workspace"; back.setAttribute(OWNED, "true"); host.prepend(back); this.returnButton = back;
      back.addEventListener("click", () => { this.useOriginal = false; back.remove(); this.returnButton = null; this.reconcile(doc, this.latestCourses); });
    });
    const preview = doc.createElement("aside"); preview.className = "pl-workspace-preview"; preview.hidden = true;
    preview.setAttribute("role", "region"); preview.setAttribute("aria-label", "Selected class details");
    preview.setAttribute(OWNED, "true");
    const head = doc.createElement("div"); head.className = "pl-workspace-preview-head";
    const close = doc.createElement("button"); close.type = "button"; close.className = "pl-workspace-preview-close"; close.textContent = "×";
    close.setAttribute("aria-label", "Close details"); close.title = "Close details (Esc)";
    const backdrop = doc.createElement("div"); backdrop.className = "pl-workspace-detail-backdrop"; backdrop.hidden = true;
    backdrop.setAttribute(OWNED, "true"); backdrop.setAttribute("aria-hidden", "true");
    close.addEventListener("click", () => this.closePreview()); preview.append(close, head); host.append(backdrop, preview);
    const resize = () => this.positionPreview();
    const outside = (event: MouseEvent) => {
      const target = event.target;
      // The original detail row stays outside the owned heading in the DOM.
      // Treat both as inside; capture other clicks before native page actions.
      if (!this.selected || !(target instanceof Node) || preview.contains(target) || this.selected.children[2]?.contains(target)) return;
      event.preventDefault(); event.stopPropagation(); this.closePreview();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (this.selected) { this.closePreview(); event.preventDefault(); }
      else if (extras.open) { extras.open = false; summary.focus(); event.preventDefault(); }
      else if (deck.classList.contains("pl-workspace-search-expanded")) { this.setSearchExpanded(false); expand.focus(); event.preventDefault(); }
    };
    doc.defaultView?.addEventListener("resize", resize); doc.addEventListener("keydown", key); doc.addEventListener("click", outside, true);
    this.state = {doc,host,panel,deck,top,extras,placements,preview,backdrop,head,close,expand,resize,key,outside};
    host.classList.add("pl-workspace-host"); doc.documentElement.classList.add("pl-workspace-page");
  }

  private setSearchExpanded(expanded: boolean): void {
    const s = this.state;
    if (!s) return;
    this.closePreview(false);
    s.deck.classList.toggle("pl-workspace-search-expanded", expanded);
    s.expand.setAttribute("aria-expanded", String(expanded));
    s.expand.textContent = expanded ? "Restore columns" : "Expand search";
  }

  private openPreview(course: CourseSnapshot, trigger: HTMLElement | null): void {
    const s = this.state;
    if (!s || !s.deck.contains(course.node)) return;
    if (this.selected === course.node) { this.closePreview(); return; }
    this.closePreview(false);
    s.extras.open = false;
    this.selected = course.node; this.selectedHadStyle = course.node.hasAttribute("style"); this.returnFocus = trigger;
    const title = s.doc.createElement("h2"); title.textContent = course.label;
    const exam = course.node.querySelector(":scope > tr:nth-child(2) .final_exam_info");
    s.head.replaceChildren(title);
    if (exam) { const line = s.doc.createElement("p"); line.textContent = officialText(exam); s.head.append(line); }
    const hint = s.doc.createElement("p"); hint.className = "pl-workspace-preview-hint";
    hint.textContent = "Press Esc or click outside to close."; s.head.append(hint);
    course.node.classList.add("pl-workspace-preview-card"); s.backdrop.hidden = false; s.preview.hidden = false;
    this.positionPreview(); s.close.focus();
  }

  private positionPreview(): void {
    const s = this.state;
    if (!s || !this.selected || s.preview.hidden) return;
    const box = s.preview.getBoundingClientRect(), head = s.head.getBoundingClientRect();
    this.selected.style.setProperty("--pl-detail-left", `${box.left + 16}px`);
    this.selected.style.setProperty("--pl-detail-top", `${head.bottom + 16}px`);
    this.selected.style.setProperty("--pl-detail-width", `${Math.max(0, box.width - 32)}px`);
    const table = this.selected.querySelector<HTMLElement>(":scope > tr:nth-child(3) table.coursetable");
    const available = Math.max(180, (s.doc.defaultView?.innerHeight || 900) - box.top - 32);
    const height = Math.min(available, Math.max(260, head.bottom - box.top + (table?.scrollHeight || 140) + 48));
    s.preview.style.height = `${height}px`;
    this.selected.style.setProperty("--pl-detail-height", `${Math.max(80, height - (head.bottom - box.top) - 32)}px`);
  }

  closePreview(focus = true): void {
    if (this.selected) {
      this.selected.classList.remove("pl-workspace-preview-card");
      for (const name of ["left", "top", "width", "height"]) this.selected.style.removeProperty(`--pl-detail-${name}`);
      if (!this.selectedHadStyle && !this.selected.getAttribute("style")) this.selected.removeAttribute("style");
    }
    this.selected = null;
    if (this.state) { this.state.preview.hidden = true; this.state.backdrop.hidden = true; }
    if (focus && this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  restore(): void {
    this.useOriginal = false; this.returnButton?.remove(); this.returnButton = null;
    const s = this.state;
    if (!s) return;
    this.closePreview(false); this.state = null;
    s.doc.defaultView?.removeEventListener("resize", s.resize); s.doc.removeEventListener("keydown", s.key); s.doc.removeEventListener("click", s.outside, true);
    for (const {node,anchor} of [...s.placements].reverse()) {
      if (anchor.isConnected) anchor.replaceWith(node); else anchor.remove();
    }
    PRIMARY.forEach(([, ,cls]) => s.doc.querySelectorAll(`.${cls}`).forEach(n => n.classList.remove(cls)));
    s.doc.querySelectorAll("[data-pl-workspace-details]").forEach(n => n.remove());
    s.expand.remove(); s.preview.remove(); s.backdrop.remove(); s.deck.remove(); s.top.remove();
    s.host.classList.remove("pl-workspace-host"); s.doc.documentElement.classList.remove("pl-workspace-page");
  }
}
