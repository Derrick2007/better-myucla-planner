import type { CourseSnapshot } from "../adapters/planner-adapter";
import { CourseBrowserPresentation } from "./course-browser";
import { SectionCards } from "./section-cards";
import { PlannerIntroduction } from "./planner-introduction";

const OWNED = "data-planner-lift-owned";
const PANEL = "ctl00_MainContent_classPlanPanel";
const PRIMARY = [
  ["classPlanner_ClassesInPlanSection", "plannerSectionClip", "pl-workspace-plan", "Classes"],
  ["classPlanner_CalendarSection", "plannerSectionCal", "pl-workspace-calendar", "Schedule"],
  ["classPlanner_ClassSearchSection", "classSearchTitle", "pl-workspace-search", "Browse"]
] as const;
const SECONDARY = [
  ["classPlanner_ClassOptimizerSection", "Plan Optimizer"],
  ["classPlanner_EnrolledNotInPlanSection", "Study list outside this plan"],
  ["classPlanner_PersonalTimeBlocksSection", "Personal Entries"]
] as const;
interface Placement { node: HTMLElement; anchor: Comment; }
interface Pane {
  section: HTMLElement; title: HTMLElement; body: HTMLElement; label: string;
  toggle: HTMLButtonElement; reopen: HTMLButtonElement | null; collapsed: boolean;
  bodyHadClass: boolean; click: (event: MouseEvent) => void;
}
interface Workspace {
  doc: Document; host: HTMLElement; panel: HTMLElement; deck: HTMLElement;
  top: HTMLElement; extras: HTMLDetailsElement; placements: Placement[];
  preview: HTMLElement; head: HTMLElement; content: HTMLElement; close: HTMLButtonElement;
  more: HTMLButtonElement; panes: Pane[]; splitters: HTMLElement[]; empty: HTMLElement;
  expandBrowse: HTMLButtonElement;
  position: HTMLElement; scrollRoom: HTMLElement; hostHadStyle: boolean;
  resize: () => void; key: (event: KeyboardEvent) => void;
  move: (event: PointerEvent) => void; end: () => void;
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

/** A resizable presentation of the existing planner. Native forms stay intact. */
export class PlannerWorkspace {
  private state: Workspace | null = null;
  private selected: HTMLElement | null = null;
  private selectedTable: HTMLTableElement | null = null;
  private selectedHadStyle = false;
  private detailCards: SectionCards | null = null;
  private returnFocus: HTMLElement | null = null;
  private useOriginal = false;
  private returnButton: HTMLButtonElement | null = null;
  private latestCourses: readonly CourseSnapshot[] = [];
  private paneChoices = new Map<string, boolean>();
  private widths = [240, 460];
  private expandedBrowse = false;
  private drag: {index:number; start:number; width:number; pointerId:number} | null = null;
  private browser = new CourseBrowserPresentation();
  private introduction: PlannerIntroduction;
  private introductionOnly: {doc: Document; toolbar: HTMLElement; resize: () => void; key: (event: KeyboardEvent) => void} | null = null;

  constructor(onHeaderChange: (compact: boolean) => void | Promise<void> = () => {}) {
    this.introduction = new PlannerIntroduction(onHeaderChange);
  }

  setHeaderCompact(compact: boolean): void {
    this.introduction.setHeaderCompact(compact); this.state?.resize(); this.introductionOnly?.resize();
  }

  needsReconcile(doc: Document): boolean {
    if (this.useOriginal) return !!this.returnButton && !this.returnButton.isConnected;
    if (this.introductionOnly) return !this.introductionOnly.toolbar.isConnected || this.introduction.needsRefresh(doc);
    const s = this.state;
    return !!s && (doc.getElementById(PANEL) !== s.panel || !s.deck.isConnected ||
      s.panes.some(p => !p.section.isConnected || p.body.parentElement !== p.section || p.title.parentElement !== p.section) ||
      (!!this.selected && (!this.selected.isConnected || this.selected.querySelector("table.coursetable") !== this.selectedTable || this.detailCards?.needsRefresh())) ||
      this.latestCourses.some(c => !hasKnownDetails(c.node)) || this.browser.needsReconcile(doc) || this.introduction.needsRefresh(doc));
  }

  reconcile(doc: Document, courses: readonly CourseSnapshot[]): void {
    if (this.introductionOnly) this.restore();
    this.latestCourses = courses;
    if (this.useOriginal) { this.ensureReturnButton(doc); return; }
    if (courses.some(course => !hasKnownDetails(course.node))) { this.restore(); return; }
    const old = this.state;
    const view = doc.defaultView;
    let redrawScroll: {left: number; top: number} | null = null;
    if (old && (doc.getElementById(PANEL) !== old.panel || !old.deck.isConnected || old.panes.some(p => !p.section.isConnected || p.body.parentElement !== p.section || p.title.parentElement !== p.section))) {
      // Removing the old flow spacer can briefly shrink the document enough for
      // the browser to clamp its scroll. Preserve it only for automatic remounts.
      if (view) redrawScroll = {left: view.scrollX, top: view.scrollY};
      this.restore();
    }
    if (this.selected && (!this.selected.isConnected || this.selected.querySelector("table.coursetable") !== this.selectedTable || this.detailCards?.needsRefresh())) this.closePreview(false);
    if (!this.state && !this.useOriginal) this.mount(doc);
    if (!this.state) return;
    if (this.introduction.needsRefresh(doc)) this.introduction.restore();
    this.introduction.mount(doc, this.state.top, this.state.resize);
    this.browser.reconcile(doc);
    for (const course of courses) {
      const host = course.node.querySelector<HTMLElement>(":scope > tr:first-child > td.linkPanelRight");
      if (!host || host.querySelector("[data-pl-workspace-details]")) continue;
      const button = doc.createElement("button");
      button.type = "button"; button.className = "pl-workspace-detail-button";
      button.setAttribute(OWNED, "true"); button.dataset.plWorkspaceDetails = "true";
      button.textContent = "Details"; button.setAttribute("aria-label", `Details for ${course.label}`);
      button.addEventListener("click", () => this.openPreview(course, button)); host.append(button);
    }
    this.state.resize();
    if (view && redrawScroll && (view.scrollX !== redrawScroll.left || view.scrollY !== redrawScroll.top)) {
      view.scrollTo({...redrawScroll, behavior: "instant"});
      // Height is restored now; saved compaction still supplies its minimum.
      this.state.resize();
    }
  }

  /** Presentation can survive an empty/future quarter without enabling reorder. */
  reconcileIntroductionOnly(doc: Document): void {
    if (this.useOriginal) return;
    if (this.state || this.needsReconcile(doc)) this.restore();
    if (this.introductionOnly) { this.introductionOnly.resize(); return; }
    const title = doc.getElementById("titleText"), description = doc.getElementById("div_page_title_section2");
    if (!title || description?.parentElement !== title.parentElement) return;
    const toolbar = doc.createElement("div");
    toolbar.className = "pl-workspace-top pl-intro-toolbar"; toolbar.setAttribute(OWNED, "true");
    description.after(toolbar);
    const resize = () => { this.introduction.positionHeader(); this.introduction.positionInfo(); };
    if (!this.introduction.mount(doc, toolbar, resize)) { toolbar.remove(); return; }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && this.introduction.closeInfo()) event.preventDefault();
    };
    this.introductionOnly = {doc, toolbar, resize, key};
    doc.documentElement.classList.add("pl-intro-page");
    for (const event of ["resize", "scroll", "focus", "pageshow", "load"]) doc.defaultView?.addEventListener(event, resize);
    doc.addEventListener("visibilitychange", resize); doc.addEventListener("keydown", key); resize();
  }

  openCourse(course: CourseSnapshot, trigger?: HTMLElement): boolean {
    if (!this.state || !course.node.querySelector("[data-pl-workspace-details]")) return false;
    this.openPreview(course, trigger || null); return true;
  }

  private ensureReturnButton(doc: Document): void {
    const host=doc.getElementById(PANEL)?.parentElement;
    if(!host?.classList.contains("classPlannerWrapper")||!host.closest("form#aspnetForm"))return;
    if(this.returnButton?.parentElement===host)return;
    this.returnButton?.remove();
    const back=doc.createElement("button");back.type="button";back.className="pl-workspace-return";
    back.setAttribute(OWNED,"true");back.textContent="Open planner workspace";
    host.prepend(back);this.returnButton=back;
    back.addEventListener("click",()=>{this.useOriginal=false;back.remove();this.returnButton=null;this.reconcile(doc,this.latestCourses);});
  }

  private mount(doc: Document): void {
    const panel = doc.getElementById(PANEL), host = panel?.parentElement;
    if (!panel || !host?.classList.contains("classPlannerWrapper") || !host.closest("form#aspnetForm")) return;
    const sections = PRIMARY.map(([cls,title]) => [...panel.children].filter(n => n.matches(`section.${cls}`) && n.querySelector(`:scope > #${title}.classPlanner_SectionTitle`)));
    const knownBody = (section: Element) => section.children.length === 2 && section.children[0].matches(".classPlanner_SectionTitle") && section.children[1].tagName === "DIV";
    if (sections.some(matches => matches.length !== 1 || !knownBody(matches[0]))) return;
    const owned = <T extends HTMLElement>(node:T,cls:string):T => {node.className=cls;node.setAttribute(OWNED,"true");return node;};
    const panes: Pane[] = [];
    const addPane = (section: HTMLElement, label: string): Pane | null => {
      if (!knownBody(section)) return null;
      const title = section.children[0] as HTMLElement, body = section.children[1] as HTMLElement;
      if (!title.id) return null;
      const primary = PRIMARY.some(([cls]) => section.classList.contains(cls));
      const collapsed = this.paneChoices.get(title.id) ?? (primary ? false : body.hidden || doc.defaultView?.getComputedStyle(body).display === "none");
      const toggle = owned(doc.createElement("button"),"pl-pane-toggle"); toggle.type="button";
      if (body.id) toggle.setAttribute("aria-controls",body.id);
      title.append(toggle);
      const pane:Pane={section,title,body,label,toggle,reopen:null,collapsed,bodyHadClass:body.hasAttribute("class"),click:()=>{}};
      title.classList.add("pl-pane-title"); body.classList.add("pl-pane-body");
      toggle.addEventListener("click",()=>this.setPaneCollapsed(pane,!pane.collapsed,true));
      pane.click=event=>{
        const target=event.target;
        if (!(target instanceof Element) || target.closest("button.planSectionToggle")?.parentElement !== title) return;
        event.preventDefault();event.stopImmediatePropagation();this.setPaneCollapsed(pane,!pane.collapsed,true);
      };
      title.addEventListener("click",pane.click,true);panes.push(pane);return pane;
    };
    const primaryPanes=sections.map((matches,i)=>addPane(matches[0] as HTMLElement,PRIMARY[i][3])!);
    const expandBrowse=owned(doc.createElement("button"),"pl-browse-expand");expandBrowse.type="button";
    expandBrowse.addEventListener("click",()=>{
      // Details belongs to its original class row. Hiding Classes would hide
      // that row too, leaving an empty inspector. Expanded Browse shows results.
      this.closePreview(false);
      this.expandedBrowse=!this.expandedBrowse;
      primaryPanes[2].collapsed=false;this.paneChoices.set(primaryPanes[2].title.id,false);
      this.updatePanes();expandBrowse.focus({preventScroll:true});
    });
    primaryPanes[2].toggle.before(expandBrowse);
    const placements:Placement[]=[];
    const place=(node:HTMLElement,destination:HTMLElement)=>{
      const anchor=doc.createComment("planner-lift-workspace-position");node.before(anchor);
      placements.push({node,anchor});destination.append(node);
    };
    // Containers of native nodes must never be marked owned by the extension.
    const deck=doc.createElement("div");deck.className="pl-workspace-deck";panel.append(deck);
    const splitters:HTMLElement[]=[];
    sections.forEach((matches,i)=>{
      const section=matches[0] as HTMLElement;section.classList.add(PRIMARY[i][2]);place(section,deck);
      if (i===2) return;
      const splitter=owned(doc.createElement("div"),"pl-workspace-splitter");
      splitter.tabIndex=0;splitter.setAttribute("role","separator");splitter.setAttribute("aria-orientation","vertical");
      splitter.setAttribute("aria-label",i===0 ? "Resize classes pane" : "Resize browser pane");
      splitter.title="Drag to resize. Arrow keys adjust; double-click resets.";
      splitter.addEventListener("pointerdown",event=>{
        if(event.button!==0)return;event.preventDefault();splitter.focus();
        this.drag={index:i,start:event.clientX,width:this.widths[i],pointerId:event.pointerId};deck.classList.add("pl-workspace-resizing");
      });
      splitter.addEventListener("dblclick",()=>{this.widths[i]=i===0?240:460;this.updatePanes();});
      splitter.addEventListener("keydown",event=>{
        if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
        event.preventDefault();
        const change=(event.key==="ArrowRight"?1:-1)*(i===0?1:-1)*(event.shiftKey?40:16);
        this.widths[i]=event.key==="Home" ? (i===0?200:340) : event.key==="End" ? (i===0?420:720) : this.widths[i]+change;
        this.updatePanes();
      });
      deck.append(splitter);splitters.push(splitter);
    });
    const top=doc.createElement("div");top.className="pl-workspace-top";panel.before(top);
    const position=owned(doc.createElement("div"),"pl-workspace-position");host.before(position);
    // Reserve the planner's full height in document flow so the unchanged
    // masthead can scroll away without the page height changing underneath it.
    const scrollRoom=owned(doc.createElement("div"),"pl-workspace-scroll-room");host.after(scrollRoom);
    const switches=owned(doc.createElement("nav"),"pl-workspace-pane-switches");switches.setAttribute("aria-label","Visible planner panes");top.append(switches);
    primaryPanes.forEach(pane=>{
      const button=doc.createElement("button");button.type="button";button.textContent=pane.label;
      button.addEventListener("click",()=>this.setPaneCollapsed(pane,!pane.collapsed));switches.append(button);pane.reopen=button;
    });
    const empty=owned(doc.createElement("p"),"pl-workspace-empty");empty.textContent="Choose Classes, Schedule or Browse above to reopen a pane.";deck.append(empty);
    const extras=doc.createElement("details");extras.className="pl-workspace-extras";top.append(extras);
    const summary=owned(doc.createElement("summary"),"");summary.textContent="Tools";extras.append(summary);
    const tools=doc.createElement("div");tools.className="pl-workspace-extra-content";extras.append(tools);
    const directory=owned(doc.createElement("nav"),"pl-workspace-section-links");directory.setAttribute("aria-label","Other planner sections");tools.append(directory);
    for(const [cls,label] of SECONDARY){
      const matches=[...panel.children].filter(node=>node.matches(`section.${cls}`));
      for(const node of matches){
        const section=node as HTMLElement,pane=addPane(section,label);place(section,tools);
        const link=doc.createElement("button");link.type="button";link.textContent=label;
        link.addEventListener("click",()=>{
          extras.open=true;if(pane)this.setPaneCollapsed(pane,false);
          tools.scrollTop+=section.getBoundingClientRect().top-tools.getBoundingClientRect().top-directory.getBoundingClientRect().height-24;
          (pane?.toggle||section.querySelector<HTMLElement>(".classPlanner_SectionTitle button"))?.focus({preventScroll:true});
        });directory.append(link);
      }
    }
    summary.textContent=`Tools (${directory.children.length})`;
    const original=owned(doc.createElement("button"),"pl-workspace-original");original.type="button";original.textContent="Original layout";top.append(original);
    original.addEventListener("click",()=>{
      this.restore();this.useOriginal=true;
      this.ensureReturnButton(doc);
    });
    const preview=owned(doc.createElement("aside"),"pl-workspace-preview");preview.hidden=true;
    preview.setAttribute("role","region");preview.setAttribute("aria-label","Selected class details");
    const head=doc.createElement("div");head.className="pl-workspace-preview-head";
    const content=doc.createElement("div");content.className="pl-workspace-preview-content";
    const close=doc.createElement("button");close.type="button";close.className="pl-workspace-preview-close";close.textContent="×";
    close.setAttribute("aria-label","Close details");close.title="Back to browsing (Esc)";close.addEventListener("click",()=>this.closePreview());
    const more=doc.createElement("button");more.type="button";more.className="pl-workspace-preview-more";more.textContent="Rooms & instructors";
    more.setAttribute("aria-expanded","false");more.addEventListener("click",()=>{
      if(!this.selected)return;const expanded=this.selected.classList.toggle("pl-section-more");more.setAttribute("aria-expanded",String(expanded));
    });
    preview.append(close,head,more,content);primaryPanes[2].body.append(preview);
    const resize=()=>{this.introduction.positionHeader();this.positionWorkspace();this.updatePanes();this.introduction.positionInfo();extras.style.setProperty("--pl-extras-top",`${Math.ceil(summary.getBoundingClientRect().bottom+8)}px`);};
    const key=(event:KeyboardEvent)=>{
      if(event.key!=="Escape"||event.defaultPrevented)return;
      if(this.introduction.closeInfo()){event.preventDefault();}
      else if(this.selected){this.closePreview();event.preventDefault();}
      else if(extras.open){extras.open=false;summary.focus();event.preventDefault();}
      else if(this.expandedBrowse){this.expandedBrowse=false;this.updatePanes();expandBrowse.focus({preventScroll:true});event.preventDefault();}
    };
    const move=(event:PointerEvent)=>{
      if(!this.drag||event.pointerId!==this.drag.pointerId)return;
      this.widths[this.drag.index]=this.drag.width+(event.clientX-this.drag.start)*(this.drag.index===0?1:-1);this.updatePanes();
    };
    const end=()=>{this.drag=null;deck.classList.remove("pl-workspace-resizing");};
    this.state={doc,host,panel,deck,top,extras,placements,preview,head,content,close,more,panes,splitters,empty,expandBrowse,position,scrollRoom,hostHadStyle:host.hasAttribute("style"),resize,key,move,end};
    doc.defaultView?.addEventListener("resize",resize);doc.defaultView?.addEventListener("scroll",resize,{passive:true});extras.addEventListener("toggle",resize);doc.addEventListener("keydown",key);
    doc.defaultView?.addEventListener("focus",resize);doc.defaultView?.addEventListener("pageshow",resize);doc.defaultView?.addEventListener("load",resize);doc.addEventListener("visibilitychange",resize);
    doc.addEventListener("pointermove",move);doc.addEventListener("pointerup",end);doc.addEventListener("pointercancel",end);doc.defaultView?.addEventListener("blur",end);
    host.classList.add("pl-workspace-host");doc.documentElement.classList.add("pl-workspace-page");resize();
  }

  private positionWorkspace(): void {
    const s=this.state,view=s?.doc.defaultView;if(!s||!view)return;
    // UCLA navigation and original menus remain in their original ancestry.
    // Root scrolling is intentional: UCLA's unchanged header can scroll away.
    // BODY stays non-scrollable; only the document and individual panes scroll.
    const marker=s.position.getBoundingClientRect(),top=Math.max(12,Math.ceil(marker.top));
    s.host.style.setProperty("--pl-workspace-top",`${top}px`);s.host.classList.toggle("pl-workspace-flow",view.innerHeight-top<400);
    s.host.style.setProperty("--pl-workspace-left",`${marker.left}px`);
    s.host.style.setProperty("--pl-workspace-width",`${s.doc.documentElement.clientWidth - 32}px`);
    s.scrollRoom.style.height=`${Math.max(0,view.innerHeight-28)}px`;
  }

  private setPaneCollapsed(pane:Pane,collapsed:boolean,focus=false): void {
    const s=this.state;if(!s)return;
    if(this.expandedBrowse&&s.panes.slice(0,3).includes(pane)){
      this.expandedBrowse=false;
      if(pane!==s.panes[2])collapsed=false;
    }
    if(collapsed && [s.panes[0],s.panes[2]].includes(pane))this.closePreview(false);
    pane.collapsed=collapsed;this.paneChoices.set(pane.title.id,collapsed);this.updatePanes();
    if(focus)(collapsed&&pane.reopen?pane.reopen:pane.toggle).focus({preventScroll:true});
  }

  private updatePanes(): void {
    const s=this.state;if(!s)return;
    const primary=s.panes.slice(0,3),available=s.deck.clientWidth||1400;
    s.deck.classList.toggle("pl-browse-expanded",this.expandedBrowse);
    s.expandBrowse.textContent=this.expandedBrowse?"Restore panes":"Expand Browse";
    s.expandBrowse.setAttribute("aria-pressed",String(this.expandedBrowse));
    s.expandBrowse.title=this.expandedBrowse?"Return to your previous pane layout (Esc)":"Give course browsing the full workspace width";
    this.widths[0]=Math.max(200,Math.min(420,this.widths[0],available-24-420-(primary[2].collapsed?0:340)));
    this.widths[1]=Math.max(340,Math.min(720,this.widths[1],available-24-420-(primary[0].collapsed?0:this.widths[0])));
    for(const pane of s.panes){
      pane.section.classList.toggle("pl-pane-collapsed",pane.collapsed);pane.section.classList.toggle("pl-pane-open",!pane.collapsed);
      pane.toggle.setAttribute("aria-expanded",String(!pane.collapsed));
      const action=`${pane.collapsed?"Expand":"Collapse"} ${pane.label}`;
      pane.toggle.setAttribute("aria-label",action);pane.toggle.title=action;pane.toggle.textContent=pane.collapsed?"›":"⌄";
      const hidden=pane.collapsed||(this.expandedBrowse&&primary.includes(pane)&&pane!==primary[2]);
      pane.reopen?.setAttribute("aria-pressed",String(!hidden));
      if(pane.reopen)pane.reopen.title=`${hidden?"Show":"Hide"} ${pane.label}`;
    }
    const tracks:string[]=[];
    primary.forEach((pane,i)=>{
      if(!pane.collapsed)tracks.push(i===1?"minmax(0,1fr)":primary.filter(p=>!p.collapsed).length===1?"minmax(0,1fr)":`${this.widths[i===0?0:1]}px`);
      if(i<2){const visible=!this.expandedBrowse&&!pane.collapsed&&!primary[i+1].collapsed;s.splitters[i].hidden=!visible;if(visible)tracks.push("12px");}
    });
    s.deck.style.setProperty("--pl-workspace-columns",this.expandedBrowse?"minmax(0,1fr)":tracks.join(" ")||"minmax(0,1fr)");
    s.splitters.forEach((splitter,i)=>{
      splitter.setAttribute("aria-valuemin",String(i===0?200:340));splitter.setAttribute("aria-valuemax",String(i===0?420:720));splitter.setAttribute("aria-valuenow",String(Math.round(this.widths[i])));
    });
    s.empty.hidden=primary.some(pane=>!pane.collapsed);this.positionPreview();
  }

  private openPreview(course:CourseSnapshot,trigger:HTMLElement|null):void{
    const s=this.state;if(!s||!s.deck.contains(course.node))return;
    if(this.selected===course.node){this.closePreview();return;}
    this.introduction.closeInfo(false);
    this.closePreview(false);s.extras.open=false;
    this.expandedBrowse=false;
    for(const pane of [s.panes[0],s.panes[2]]){pane.collapsed=false;this.paneChoices.set(pane.title.id,false);}this.updatePanes();
    this.selected=course.node;this.selectedHadStyle=course.node.hasAttribute("style");this.returnFocus=trigger;
    this.selectedTable=course.node.querySelector<HTMLTableElement>("table.coursetable");
    this.detailCards=new SectionCards();if(this.selectedTable)this.detailCards.table(this.selectedTable);
    const title=s.doc.createElement("h2");title.textContent=course.label.replace(/^Class\s+\d+:\s*/,"");s.head.replaceChildren(title);
    const exam=course.node.querySelector(":scope > tr:nth-child(2) .final_exam_info");
    if(exam){
      const disclosure=s.doc.createElement("details"),summary=s.doc.createElement("summary"),line=s.doc.createElement("p");
      summary.textContent="Final exam";line.textContent=officialText(exam);disclosure.append(summary,line);s.head.append(disclosure);
      disclosure.addEventListener("toggle",()=>this.positionPreview());
    }
    course.node.classList.add("pl-workspace-preview-card");s.preview.hidden=false;s.more.setAttribute("aria-expanded","false");
    s.panes[2].body.classList.add("pl-inspector-open");this.positionPreview();s.close.focus({preventScroll:true});
  }

  private positionPreview():void{
    const s=this.state,view=s?.doc.defaultView;if(!s||!view||!this.selected||s.preview.hidden)return;
    const inline=view.innerWidth<=1240;
    this.selected.classList.toggle("pl-preview-inline",inline);
    const destination=inline?this.selected.children[2]?.firstElementChild:s.panes[2].body;
    if(destination && s.preview.parentElement!==destination)destination.prepend(s.preview);
    if(inline)return;
    const box=s.content.getBoundingClientRect();
    const height=Math.min(box.height,Math.max(0,s.panes[2].section.getBoundingClientRect().bottom-12-box.top),Math.max(0,view.innerHeight-16-box.top));
    for(const [name,value] of [["left",box.left],["top",box.top],["width",box.width],["height",height]] as const)
      this.selected.style.setProperty(`--pl-detail-${name}`,`${Math.max(0,value)}px`);
  }

  closePreview(focus=true):void{
    this.detailCards?.restore();this.detailCards=null;
    if(this.selected){
      this.selected.classList.remove("pl-workspace-preview-card","pl-preview-inline","pl-section-more");
      for(const name of ["left","top","width","height"])this.selected.style.removeProperty(`--pl-detail-${name}`);
      if(!this.selectedHadStyle&&!this.selected.getAttribute("style"))this.selected.removeAttribute("style");
    }
    this.selected=null;this.selectedTable=null;
    if(this.state){const s=this.state;s.preview.hidden=true;s.panes[2].body.classList.remove("pl-inspector-open");if(s.preview.parentElement!==s.panes[2].body)s.panes[2].body.append(s.preview);}
    if(focus&&this.returnFocus?.isConnected)this.returnFocus.focus({preventScroll:true});this.returnFocus=null;
  }

  restore():void{
    this.useOriginal=false;this.returnButton?.remove();this.returnButton=null;this.browser.restore();this.introduction.restore();
    const intro = this.introductionOnly; this.introductionOnly = null;
    if (intro) {
      for (const event of ["resize", "scroll", "focus", "pageshow", "load"]) intro.doc.defaultView?.removeEventListener(event, intro.resize);
      intro.doc.removeEventListener("visibilitychange", intro.resize); intro.doc.removeEventListener("keydown", intro.key);
      intro.toolbar.remove(); intro.doc.documentElement.classList.remove("pl-intro-page");
    }
    const s=this.state;if(!s)return;this.closePreview(false);this.state=null;this.drag=null;
    s.doc.defaultView?.removeEventListener("resize",s.resize);s.doc.defaultView?.removeEventListener("scroll",s.resize);s.extras.removeEventListener("toggle",s.resize);s.doc.removeEventListener("keydown",s.key);
    s.doc.defaultView?.removeEventListener("focus",s.resize);s.doc.defaultView?.removeEventListener("pageshow",s.resize);s.doc.defaultView?.removeEventListener("load",s.resize);s.doc.removeEventListener("visibilitychange",s.resize);
    s.doc.removeEventListener("pointermove",s.move);s.doc.removeEventListener("pointerup",s.end);s.doc.removeEventListener("pointercancel",s.end);s.doc.defaultView?.removeEventListener("blur",s.end);
    for(const pane of s.panes){
      pane.title.removeEventListener("click",pane.click,true);pane.toggle.remove();pane.title.classList.remove("pl-pane-title");pane.body.classList.remove("pl-pane-body");
      if(!pane.bodyHadClass&&!pane.body.getAttribute("class"))pane.body.removeAttribute("class");pane.section.classList.remove("pl-pane-open","pl-pane-collapsed");
    }
    for(const {node,anchor} of [...s.placements].reverse()){if(anchor.isConnected)anchor.replaceWith(node);else anchor.remove();}
    PRIMARY.forEach(([, ,cls])=>s.doc.querySelectorAll(`.${cls}`).forEach(n=>n.classList.remove(cls)));
    s.doc.querySelectorAll("[data-pl-workspace-details]").forEach(n=>n.remove());
    s.expandBrowse.remove();s.preview.remove();s.deck.remove();s.top.remove();s.position.remove();s.scrollRoom.remove();["--pl-workspace-top","--pl-workspace-left","--pl-workspace-width"].forEach(p=>s.host.style.removeProperty(p));
    if(!s.hostHadStyle&&!s.host.getAttribute("style"))s.host.removeAttribute("style");s.host.classList.remove("pl-workspace-host","pl-workspace-flow");s.doc.documentElement.classList.remove("pl-workspace-page");
  }
}
