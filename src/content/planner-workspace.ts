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
const PANE_LABELS = ["Weekly schedule", "Class plan", "Find classes"];
const PANE_COLUMNS = ["minmax(300px,1.2fr)", "minmax(270px,.8fr)", "minmax(520px,1.6fr)"];
interface Placement { node: HTMLElement; anchor: Comment; }
interface Pane {
  section: HTMLElement; title: HTMLElement; body: HTMLElement; label: string;
  toggle: HTMLButtonElement; reopen: HTMLButtonElement | null; collapsed: boolean;
  bodyHadClass: boolean; click: (event: MouseEvent) => void;
}
interface Workspace {
  doc: Document; host: HTMLElement; panel: HTMLElement; deck: HTMLElement;
  top: HTMLElement; extras: HTMLDetailsElement; placements: Placement[];
  preview: HTMLElement; backdrop: HTMLElement; head: HTMLElement; close: HTMLButtonElement;
  expand: HTMLButtonElement;
  panes: Pane[]; empty: HTMLElement; position: HTMLElement; hostHadStyle: boolean;
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
  private paneChoices = new Map<string, boolean>();

  needsReconcile(doc: Document): boolean {
    if (this.useOriginal) return false;
    const s = this.state;
    return !!s && (doc.getElementById(PANEL) !== s.panel || !s.deck.isConnected || s.panes.some(p => !p.section.isConnected || p.body.parentElement !== p.section || p.title.parentElement !== p.section) || (!!this.selected && !this.selected.isConnected) || this.latestCourses.some(c => !hasKnownDetails(c.node)));
  }

  reconcile(doc: Document, courses: readonly CourseSnapshot[]): void {
    this.latestCourses = courses;
    // A compact card must always have a usable route to its native details.
    if (courses.some(course => !hasKnownDetails(course.node))) { this.restore(); return; }
    const old = this.state;
    if (old && (doc.getElementById(PANEL) !== old.panel || !old.deck.isConnected || old.panes.some(p => !p.section.isConnected || p.body.parentElement !== p.section || p.title.parentElement !== p.section))) this.restore();
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
    // Local folding is safe only for the native title + one body shape.
    const knownBody = (section: Element) => section.children.length === 2 && section.children[0].matches(".classPlanner_SectionTitle") && section.children[1].tagName === "DIV";
    if (sections.some(matches => !knownBody(matches[0]))) return;
    const panes: Pane[] = [];
    const addPane = (section: HTMLElement, label: string): Pane | null => {
      if (!knownBody(section)) return null;
      const title = section.children[0] as HTMLElement, body = section.children[1] as HTMLElement;
      const key = title.id;
      if (!key) return null;
      const collapsed = this.paneChoices.get(key) ?? (body.hidden || doc.defaultView?.getComputedStyle(body).display === "none");
      const toggle = doc.createElement("button"); toggle.type = "button"; toggle.className = "pl-pane-toggle";
      toggle.setAttribute(OWNED, "true"); title.append(toggle);
      if (body.id) toggle.setAttribute("aria-controls", body.id);
      const pane: Pane = {section,title,body,label,toggle,reopen:null,collapsed,bodyHadClass:body.hasAttribute("class"),click:()=>{}};
      title.classList.add("pl-pane-title"); body.classList.add("pl-pane-body");
      toggle.addEventListener("click", () => this.setPaneCollapsed(pane, !pane.collapsed, true));
      // A header click is a local presentation action. Keep the native button
      // and its handler intact for Original layout, but don't run two toggles.
      pane.click = event => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const native = target.closest("button.planSectionToggle");
        if (native?.parentElement !== title) return;
        event.preventDefault(); event.stopImmediatePropagation();
        this.setPaneCollapsed(pane, !pane.collapsed, true);
      };
      title.addEventListener("click", pane.click, true); panes.push(pane); return pane;
    };
    const primaryPanes = sections.map((matches,i) => addPane(matches[0] as HTMLElement, PANE_LABELS[i])!);
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
    // Keep UCLA's original navigation, term chooser and plan action menus
    // exactly where they were. Only extension controls go in this new row.
    panel.before(top);
    const position = doc.createElement("div"); position.className = "pl-workspace-position";
    position.setAttribute(OWNED, "true"); host.before(position);
    const switches = doc.createElement("nav"); switches.className = "pl-workspace-pane-switches";
    switches.setAttribute(OWNED, "true"); switches.setAttribute("aria-label", "Visible planner panes"); top.append(switches);
    for (const pane of primaryPanes) {
      const button = doc.createElement("button"); button.type = "button"; button.textContent = pane.label;
      button.addEventListener("click", () => {
        const visible = !pane.collapsed && (!deck.classList.contains("pl-workspace-search-expanded") || pane === primaryPanes[2]);
        this.setSearchExpanded(false); this.setPaneCollapsed(pane, visible);
      });
      switches.append(button); pane.reopen = button;
    }
    const empty = doc.createElement("p"); empty.className = "pl-workspace-empty";
    empty.setAttribute(OWNED, "true"); empty.textContent = "Choose a pane above to reopen it."; deck.append(empty);
    const extras = doc.createElement("details"); extras.className = "pl-workspace-extras";
    const summary = doc.createElement("summary"); summary.setAttribute(OWNED, "true");
    extras.append(summary); top.append(extras);
    const tools = doc.createElement("div"); tools.className = "pl-workspace-extra-content"; extras.append(tools);
    const directory = doc.createElement("nav"); directory.className = "pl-workspace-section-links";
    directory.setAttribute(OWNED, "true"); directory.setAttribute("aria-label", "Other planner sections"); tools.append(directory);
    for (const [cls, label] of SECONDARY) {
      const matches = [...panel.children].filter(node => node.matches(`section.${cls}`));
      for (const node of matches) {
        const section = node as HTMLElement; const pane = addPane(section, label); place(section, tools);
        const link = doc.createElement("button"); link.type = "button"; link.textContent = label;
        link.addEventListener("click", () => {
          if (pane) this.setPaneCollapsed(pane, false);
          tools.scrollTop += section.getBoundingClientRect().top - tools.getBoundingClientRect().top - directory.getBoundingClientRect().height - 24;
          (pane?.toggle || section.querySelector<HTMLElement>(".classPlanner_SectionTitle button"))?.focus({ preventScroll: true });
        });
        directory.append(link);
      }
    }
    summary.textContent = `Other sections (${directory.children.length})`;
    const expand = doc.createElement("button"); expand.type = "button"; expand.className = "pl-workspace-expand-search";
    expand.setAttribute(OWNED, "true"); expand.setAttribute("aria-expanded", "false"); expand.setAttribute("aria-controls", "panelSearch");
    expand.textContent = "Expand search";
    const searchTitle = sections[2][0].querySelector("#classSearchTitle")!; searchTitle.insertBefore(expand, primaryPanes[2].toggle);
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
    const resize = () => {
      this.positionWorkspace(); this.positionPreview();
      extras.style.setProperty("--pl-extras-top", `${Math.ceil(summary.getBoundingClientRect().bottom + 8)}px`);
    };
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
    doc.defaultView?.addEventListener("resize", resize); extras.addEventListener("toggle", resize); doc.addEventListener("keydown", key); doc.addEventListener("click", outside, true);
    this.state = {doc,host,panel,deck,top,extras,placements,preview,backdrop,head,close,expand,panes,empty,position,hostHadStyle:host.hasAttribute("style"),resize,key,outside};
    host.classList.add("pl-workspace-host"); doc.documentElement.classList.add("pl-workspace-page");
    this.updatePanes(); resize();
  }

  private positionWorkspace(): void {
    const s = this.state, view = s?.doc.defaultView;
    if (!s || !view) return;
    // Measure an in-flow marker instead of guessing UCLA's header height.
    const top = Math.max(12, Math.ceil(s.position.getBoundingClientRect().top + view.scrollY));
    s.host.style.setProperty("--pl-workspace-top", `${top}px`);
    s.host.classList.toggle("pl-workspace-flow", view.innerHeight - top < 400);
  }

  private setPaneCollapsed(pane: Pane, collapsed: boolean, focus = false): void {
    const s = this.state;
    if (!s) return;
    this.closePreview(false);
    if (pane.section.classList.contains("pl-workspace-search") && collapsed) this.setSearchExpanded(false);
    pane.collapsed = collapsed; this.paneChoices.set(pane.title.id, collapsed);
    this.updatePanes();
    if (focus) (collapsed && pane.reopen ? pane.reopen : pane.toggle).focus({preventScroll:true});
  }

  private updatePanes(): void {
    const s = this.state;
    if (!s) return;
    const primary = s.panes.slice(0,3), expanded = s.deck.classList.contains("pl-workspace-search-expanded");
    for (const pane of s.panes) {
      pane.section.classList.toggle("pl-pane-collapsed", pane.collapsed);
      pane.section.classList.toggle("pl-pane-open", !pane.collapsed);
      pane.toggle.setAttribute("aria-expanded", String(!pane.collapsed));
      const action = `${pane.collapsed ? "Expand" : "Collapse"} ${pane.label}`;
      pane.toggle.setAttribute("aria-label", action); pane.toggle.title = action;
      pane.toggle.textContent = pane.collapsed ? "›" : "⌄";
      if (pane.reopen) {
        const visible = !pane.collapsed && (!expanded || pane === primary[2]);
        pane.reopen.setAttribute("aria-pressed", String(visible));
        pane.reopen.title = `${visible ? "Hide" : "Show"} ${pane.label}`;
      }
    }
    s.deck.style.setProperty("--pl-workspace-columns", primary.flatMap((pane,i) => pane.collapsed ? [] : [PANE_COLUMNS[i]]).join(" ") || "minmax(0,1fr)");
    s.empty.hidden = primary.some(pane => !pane.collapsed);
  }

  private setSearchExpanded(expanded: boolean): void {
    const s = this.state;
    if (!s) return;
    this.closePreview(false);
    s.deck.classList.toggle("pl-workspace-search-expanded", expanded);
    if (expanded) { s.panes[2].collapsed = false; this.paneChoices.set(s.panes[2].title.id, false); }
    s.expand.setAttribute("aria-expanded", String(expanded));
    s.expand.textContent = expanded ? "Restore columns" : "Expand search";
    this.updatePanes();
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
    s.doc.defaultView?.removeEventListener("resize", s.resize); s.extras.removeEventListener("toggle", s.resize); s.doc.removeEventListener("keydown", s.key); s.doc.removeEventListener("click", s.outside, true);
    for (const pane of s.panes) {
      pane.title.removeEventListener("click", pane.click, true); pane.toggle.remove();
      pane.title.classList.remove("pl-pane-title"); pane.body.classList.remove("pl-pane-body");
      if (!pane.bodyHadClass && !pane.body.getAttribute("class")) pane.body.removeAttribute("class");
      pane.section.classList.remove("pl-pane-open", "pl-pane-collapsed");
    }
    for (const {node,anchor} of [...s.placements].reverse()) {
      if (anchor.isConnected) anchor.replaceWith(node); else anchor.remove();
    }
    PRIMARY.forEach(([, ,cls]) => s.doc.querySelectorAll(`.${cls}`).forEach(n => n.classList.remove(cls)));
    s.doc.querySelectorAll("[data-pl-workspace-details]").forEach(n => n.remove());
    s.expand.remove(); s.preview.remove(); s.backdrop.remove(); s.deck.remove(); s.top.remove(); s.position.remove();
    s.host.style.removeProperty("--pl-workspace-top");
    if (!s.hostHadStyle && !s.host.getAttribute("style")) s.host.removeAttribute("style");
    s.host.classList.remove("pl-workspace-host", "pl-workspace-flow"); s.doc.documentElement.classList.remove("pl-workspace-page");
  }
}
