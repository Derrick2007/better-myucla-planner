const OWNED = "data-planner-lift-owned";
const TERM = "ctl00_MainContent_termSessionChooser_TermChooser";
interface Introduction {
  doc: Document; layout: HTMLElement; description: HTMLElement; text: HTMLElement;
  anchor: Comment; about: HTMLDetailsElement; term: HTMLElement; label: HTMLLabelElement;
  sidebar: HTMLElement; info: HTMLButtonElement; close: HTMLButtonElement; notices: HTMLElement[];
  sidebarHadClass: boolean; sidebarHadStyle: boolean; layoutHadClass: boolean; noticeHadClass: boolean[];
}

/** Compact only the recorded planner introduction; never touch UCLA's header. */
export class PlannerIntroduction {
  private state: Introduction | null = null;

  needsRefresh(doc: Document): boolean {
    const s = this.state;
    return !!s && (doc.getElementById("layoutContentArea") !== s.layout ||
      doc.getElementById("div_page_title_section2") !== s.description ||
      doc.getElementById("page_title_text") !== s.text || !s.info.isConnected ||
      !s.sidebar.isConnected || doc.getElementById(TERM)?.parentElement !== s.label.parentElement);
  }

  mount(doc: Document, toolbar: HTMLElement, onLayout: () => void): void {
    if (this.state) return;
    const layout = doc.getElementById("layoutContentArea"), title = doc.getElementById("titleText");
    const description = doc.getElementById("div_page_title_section2"), text = doc.getElementById("page_title_text");
    const main = doc.getElementById("main-content"), term = doc.getElementById("ctl00_MainContent_termSessionChooser");
    const select = doc.getElementById(TERM) as HTMLSelectElement | null;
    const columns = main?.parentElement, sidebars = columns?.querySelectorAll<HTMLElement>(":scope > right-sidebar");
    const sidebar = sidebars?.length === 1 ? sidebars[0] : null;
    if (!main || !layout?.matches("section#layoutContentArea") || title?.parentElement !== layout || title.tagName !== "H2" ||
      title.textContent?.trim() !== "Class Planner" || description?.parentElement !== layout ||
      description.children.length !== 1 || text?.parentElement !== description || text.tagName !== "DIV" ||
      text.querySelector("input,select,button,textarea,script,iframe") || columns?.parentElement !== layout ||
      !columns.matches("layout-columnwrapper.col-2MR") || !sidebar || !term || term.parentElement !== main ||
      term.children.length !== 2 || !term.children[0].matches("div.term_display") ||
      !term.children[1].matches("div.term") || select?.tagName !== "SELECT" ||
      select.parentElement !== term.children[1] || select.form !== doc.getElementById("aspnetForm") ||
      term.querySelectorAll("input,select,button,textarea").length !== 1) return;

    const owned = <T extends HTMLElement>(e: T, cls: string): T => {
      e.className = cls; e.setAttribute(OWNED, "true"); return e;
    };
    const anchor = doc.createComment("planner-lift-introduction"); text.before(anchor);
    // This wrapper contains native text/links and deliberately is not owned.
    const about = doc.createElement("details"); about.className = "pl-intro-about";
    const summary = owned(doc.createElement("summary"), ""); summary.textContent = "About this planner";
    about.append(summary, text); description.append(about);
    about.addEventListener("toggle", onLayout);
    const label = owned(doc.createElement("label"), "pl-intro-term-label"); label.htmlFor = TERM; label.textContent = "Term";
    select.before(label);
    const info = owned(doc.createElement("button"), "pl-intro-info"); info.type = "button";
    info.textContent = "Links & help"; info.setAttribute("aria-expanded", "false");
    info.title = "Planner links, enrollment appointments and help"; toolbar.append(info);
    const close = owned(doc.createElement("button"), "pl-intro-info-close"); close.type = "button";
    close.textContent = "×"; close.setAttribute("aria-label", "Close links and help"); sidebar.prepend(close);
    const notices = [...main.children].filter((e): e is HTMLElement => e instanceof HTMLElement &&
      e.tagName === "DIV" && !e.id && !e.className && !e.querySelector("input,select,button,a,textarea,script,iframe") &&
      [...e.children].every(c => ["SPAN", "STRONG", "BR"].includes(c.tagName)));
    const noticeHadClass = notices.map(e => e.hasAttribute("class"));
    const sidebarHadClass = sidebar.hasAttribute("class"), sidebarHadStyle = sidebar.hasAttribute("style"), layoutHadClass = layout.hasAttribute("class");
    notices.forEach(e => e.classList.add("pl-intro-notice"));
    layout.classList.add("pl-planner-introduction"); term.classList.add("pl-intro-term"); sidebar.classList.add("pl-intro-sidebar");
    this.state = {doc, layout, description, text, anchor, about, term, label, sidebar, info, close, notices,
      sidebarHadClass, sidebarHadStyle, layoutHadClass, noticeHadClass};
    info.addEventListener("click", () => {
      if (sidebar.classList.contains("pl-intro-sidebar-open")) { this.closeInfo(); return; }
      sidebar.classList.add("pl-intro-sidebar-open"); info.setAttribute("aria-expanded", "true");
      this.positionInfo(); close.focus({preventScroll: true});
    });
    close.addEventListener("click", () => this.closeInfo());
  }

  positionInfo(): void {
    const s = this.state; if (!s || !s.sidebar.classList.contains("pl-intro-sidebar-open")) return;
    const top = Math.max(12, Math.min(s.doc.defaultView!.innerHeight - 160, s.info.getBoundingClientRect().bottom + 8));
    s.sidebar.style.setProperty("--pl-info-top", `${Math.ceil(top)}px`);
  }

  closeInfo(focus = true): boolean {
    const s = this.state; if (!s?.sidebar.classList.contains("pl-intro-sidebar-open")) return false;
    s.sidebar.classList.remove("pl-intro-sidebar-open"); s.info.setAttribute("aria-expanded", "false");
    if (focus && s.info.isConnected) s.info.focus({preventScroll: true}); return true;
  }

  restore(): void {
    const s = this.state; if (!s) return; this.state = null;
    s.layout.classList.remove("pl-planner-introduction"); s.term.classList.remove("pl-intro-term");
    s.sidebar.classList.remove("pl-intro-sidebar", "pl-intro-sidebar-open");
    if (!s.layoutHadClass && !s.layout.className) s.layout.removeAttribute("class");
    if (!s.sidebarHadClass && !s.sidebar.className) s.sidebar.removeAttribute("class");
    s.sidebar.style.removeProperty("--pl-info-top"); if (!s.sidebarHadStyle && !s.sidebar.getAttribute("style")) s.sidebar.removeAttribute("style");
    s.notices.forEach((e,i) => {e.classList.remove("pl-intro-notice"); if (!s.noticeHadClass[i] && !e.className) e.removeAttribute("class");});
    // Preserve native replacements too; never revive disconnected text or discard a new child.
    for (const child of [...s.about.childNodes]) {
      if (child instanceof Element && child.hasAttribute(OWNED)) continue;
      if (s.anchor.isConnected) s.anchor.before(child); else s.about.before(child);
    }
    s.anchor.remove();
    s.about.remove(); s.label.remove(); s.info.remove(); s.close.remove();
  }
}
