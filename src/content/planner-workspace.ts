import type { CourseSnapshot } from "../adapters/planner-adapter";
import { CourseBrowserPresentation } from "./course-browser";
import { SectionCards } from "./section-cards";
import { PlannerIntroduction } from "./planner-introduction";

const OWNED = "data-planner-lift-owned";
const PANEL = "ctl00_MainContent_classPlanPanel";
const PRIMARY = [
  ["classPlanner_ClassesInPlanSection", "plannerSectionClip", "pl-workspace-plan", "My classes"],
  ["classPlanner_CalendarSection", "plannerSectionCal", "pl-workspace-calendar", "Schedule"],
  ["classPlanner_ClassSearchSection", "classSearchTitle", "pl-workspace-search", "Find classes"]
] as const;
const SECONDARY = [
  ["classPlanner_ClassOptimizerSection", "Plan Optimizer"],
  ["classPlanner_EnrolledNotInPlanSection", "Study list outside this plan"],
  ["classPlanner_PersonalTimeBlocksSection", "Personal Entries"]
] as const;
function hasUnknownSection(panel:HTMLElement):boolean {
  const known=[...PRIMARY.map(([name])=>name),...SECONDARY.map(([name])=>name)];
  return [...panel.children].some(node=>node.tagName==="SECTION"&&!known.some(name=>node.classList.contains(name)));
}
/** Separate read-only contract for the native New plan result. This never
 * makes an empty plan eligible for the adapter's editable/reorder contract. */
export function isKnownEmptyPlanner(doc:Document):boolean {
  const location=doc.defaultView?.location;
  if(!location||location.origin!=="https://be.my.ucla.edu"||location.pathname!=="/ClassPlanner/ClassPlan.aspx")return false;
  const form=doc.getElementById("aspnetForm"),panel=doc.getElementById(PANEL),body=doc.getElementById("panelPlan");
  if(["aspnetForm",PANEL,"panelPlan"].some(id=>doc.querySelectorAll(`#${id}`).length!==1))return false;
  if(!(form instanceof HTMLFormElement)||form.method.toLowerCase()!=="post"||!panel||!body||panel.closest("form")!==form)return false;
  try {const action=new URL(form.action,location.href);if(action.origin!==location.origin||action.pathname!==location.pathname)return false;}catch{return false;}
  const parent=panel.parentElement,host=parent?.matches(".pl-workspace-shell")?parent.parentElement:parent;
  // Study list may contain its own landing table and course rows. Only the
  // current plan's body must be empty; other modules remain opaque/native.
  if(!host?.classList.contains("classPlannerWrapper")||hasUnknownSection(panel)||body.querySelector("#div_landing, tbody.courseItem"))return false;
  const sections=[...panel.querySelectorAll<HTMLElement>(":scope > section, :scope > .pl-workspace-deck > section, :scope > .pl-workspace-deck > .pl-workspace-main > section")];
  const shapes=[
    [PRIMARY[0][0],PRIMARY[0][1],"panelPlan"],
    [PRIMARY[1][0],PRIMARY[1][1],"ctl00_MainContent_panelGrid"],
    [PRIMARY[2][0],PRIMARY[2][1],"panelSearch"],
    [SECONDARY[0][0],"classOptimizerTitle","panelOptimizer"],
    [SECONDARY[1][0],"plannerSectionEnip","panelNotplan"],
    [SECONDARY[2][0],"plannerSectionPer","panelPersonal"]
  ];
  if(sections.length!==shapes.length||shapes.some(([cls,titleId,bodyId],index)=>{
    const matches=sections.filter(section=>section.classList.contains(cls));if(matches.length!==1)return true;
    const children=[...matches[0].children].filter(node=>!node.hasAttribute(OWNED));
    const title=children[0],content=children[children.length-1];
    return title?.id!==titleId||!title.classList.contains("classPlanner_SectionTitle")||content?.id!==bodyId||content.tagName!=="DIV"||
      (index<3&&children.length!==2)||(index>=3&&children.length<2);
  }))return false;
  const children=[...body.children];
  if(children.length!==2||!children[0].matches("div.classPlanner_SectionData")||children[1].tagName!=="TABLE"||children[1].children.length||children[1].textContent?.trim())return false;
  const data=[...children[0].children];
  if(data.length!==3||!data[0].matches("div.no_data_text")||data[0].children.length||!data[0].textContent?.trim())return false;
  return ["ctl00_MainContent_planClassListView_clCommandField","ctl00_MainContent_planClassListView_clCommandFieldTracker"].every((id,index)=>{
    const input=data[index+1];return input instanceof HTMLInputElement&&input.id===id&&input.type==="hidden"&&input.form===form&&doc.querySelectorAll(`#${id}`).length===1;
  });
}
type Module = "classes" | "find" | "optimizer" | "study" | "personal" | "information";
const MODULE_LABELS: Record<Module,string> = {classes:"My classes",find:"Find classes",optimizer:"Optimizer",study:"Study list",personal:"Personal entries",information:"Information & help"};
interface Placement { node: HTMLElement; anchor: Comment; }
interface ClassActions {
  button: HTMLButtonElement; nativeTools: Element | null; ownedTools: Element | null;
  key: (event: KeyboardEvent) => void;
}
interface Pane {
  section: HTMLElement; title: HTMLElement; body: HTMLElement; label: string;
  toggle: HTMLButtonElement | null; reopen: HTMLButtonElement | null; collapsed: boolean; module: Module | null; opaque: boolean;
  bodyHadClass: boolean; click: (event: MouseEvent) => void;
}
interface Workspace {
  doc: Document; host: HTMLElement; panel: HTMLElement; deck: HTMLElement;
  top: HTMLElement; extras: HTMLDetailsElement; placements: Placement[];
  preview: HTMLElement; head: HTMLElement; content: HTMLElement; close: HTMLButtonElement;
  more: HTMLButtonElement; panes: Pane[]; splitters: HTMLElement[]; empty: HTMLElement;
  shell: HTMLElement; main: HTMLElement; navMain: HTMLElement; navFooter: HTMLElement; slot: HTMLElement;
  moduleButtons: Map<Module,HTMLButtonElement>; mobileMain: HTMLButtonElement; mobileSchedule: HTMLButtonElement;
  position: HTMLElement; scrollRoom: HTMLElement; hostHadStyle: boolean;
  resize: () => void; key: (event: KeyboardEvent) => void;
  move: (event: PointerEvent) => void; end: () => void;
  beforePrint: () => void; afterPrint: () => void;
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
function sectionSummary(table: HTMLTableElement): string[][] {
  return [...table.rows].filter(row=>row.cells.length===9&&[...row.cells].every(cell=>cell.tagName==="TD"&&cell.colSpan===1&&cell.rowSpan===1)&&row.style.display!=="none"&&!row.hidden)
    .map(row=>[1,4,5,2].map(index=>officialText(row.cells[index])));
}

/** A resizable presentation of the existing planner. Native forms stay intact. */
export class PlannerWorkspace {
  private state: Workspace | null = null;
  private selected: HTMLElement | null = null;
  private selectedTable: HTMLTableElement | null = null;
  private selectedHadStyle = false;
  private detailCards: SectionCards | null = null;
  private returnFocus: HTMLElement | null = null;
  private actionControls = new Map<HTMLElement, ClassActions>();
  private actionsHost: HTMLElement | null = null;
  private useOriginal = false;
  private returnButton: HTMLButtonElement | null = null;
  private latestCourses: readonly CourseSnapshot[] = [];
  private paneChoices = new Map<string, boolean>();
  private scheduleWidth: number | null = null;
  private module: Module = "classes";
  private previousModule: Module = "classes";
  private showSchedule = false;
  private summaries = new Map<HTMLElement,{node:HTMLElement;table:HTMLTableElement;signature:string}>();
  private drag: {start:number; width:number; pointerId:number} | null = null;
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
    return !!s && (doc.getElementById(PANEL) !== s.panel || !s.deck.isConnected || hasUnknownSection(s.panel) || (!this.latestCourses.length&&!isKnownEmptyPlanner(doc)) ||
      s.panes.some(p => !p.section.isConnected || p.body.parentElement !== p.section || p.title.parentElement !== p.section) ||
      (!!this.selected && (!this.selected.isConnected || this.selected.querySelector("table.coursetable") !== this.selectedTable || this.detailCards?.needsRefresh())) ||
      this.latestCourses.some(c => {
        const host=c.node.querySelector<HTMLElement>(":scope > tr:first-child > td.linkPanelRight"),actions=host&&this.actionControls.get(host);
        return !hasKnownDetails(c.node)||!host||!actions||actions.button.parentElement!==host||
          actions.nativeTools!==host.querySelector(".OrderingButtons")||actions.ownedTools!==host.querySelector(":scope > [data-pl-real-tools]")||
          this.summaryChanged(c.node);
      }) || this.browser.needsReconcile(doc) || this.introduction.needsRefresh(doc));
  }

  reconcile(doc: Document, courses: readonly CourseSnapshot[]): void {
    if (this.introductionOnly) this.restore();
    this.latestCourses = courses;
    if (this.useOriginal) { this.ensureReturnButton(doc); return; }
    if(!courses.length&&!isKnownEmptyPlanner(doc)){this.restore();return;}
    const currentRoot=doc.querySelector(`#${PANEL} #panelPlan #div_landing > table`);
    if(courses.some(course=>!doc.contains(course.node)||course.node.parentElement!==currentRoot)){this.restore();return;}
    const panel=doc.getElementById(PANEL);
    // An unfamiliar module has no reliable navigation destination. Keep the
    // complete native layout accessible instead of trapping it outside the deck.
    if(panel&&hasUnknownSection(panel)){this.restore();return;}
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
    this.state.host.classList.toggle("pl-workspace-empty-plan",courses.length===0);
    const emptyMessage=courses.length?"Select a class to see its sections and details.":"No classes in this plan yet. Use Find classes to browse courses.";
    if(this.state.empty.textContent!==emptyMessage)this.state.empty.textContent=emptyMessage;
    if (this.introduction.needsRefresh(doc)) this.introduction.restore();
    this.introduction.mount(doc,this.state.top,this.state.resize,{navigation:this.state.navFooter,onInformation:()=>this.selectModule("information",true),onCloseInformation:()=>{this.selectModule(this.previousModule);doc.querySelector<HTMLButtonElement>(".pl-intro-info")?.focus({preventScroll:true});}});
    this.browser.reconcile(doc);
    for(const host of this.actionControls.keys())if(!courses.some(course=>course.node.contains(host)))this.removeActions(host);
    for (const course of courses) {
      const host = course.node.querySelector<HTMLElement>(":scope > tr:first-child > td.linkPanelRight");
      if (!host) continue;
      let button=host.querySelector<HTMLButtonElement>("[data-pl-workspace-details]");
      if(!button){
        button=doc.createElement("button");
        button.type="button";button.className="pl-workspace-detail-button";
        button.setAttribute(OWNED,"true");button.dataset.plWorkspaceDetails="true";
        button.textContent="Details";button.setAttribute("aria-label",`Details for ${course.label}`);button.setAttribute("aria-expanded","false");
        const details=button;button.addEventListener("click",()=>this.openPreview(course,details));host.prepend(button);
      }
      // Both owned entry points precede the unchanged native control groups.
      this.ensureActions(course,host,button);
      this.ensureSummary(course);
    }
    for(const [card,summary] of this.summaries)if(!courses.some(course=>course.node===card)){summary.node.remove();this.summaries.delete(card);}
    this.state.resize();
    if (view && redrawScroll && (view.scrollX !== redrawScroll.left || view.scrollY !== redrawScroll.top)) {
      view.scrollTo({...redrawScroll, behavior: "instant"});
      // Height is restored now; saved compaction still supplies its minimum.
      this.state.resize();
    }
  }

  private ensureActions(course:CourseSnapshot,host:HTMLElement,details:HTMLButtonElement):void {
    const previous=this.actionControls.get(host),nativeTools=host.querySelector(".OrderingButtons"),ownedTools=host.querySelector(":scope > [data-pl-real-tools]");
    const restoreFocus=this.actionsHost===host&&host.contains(host.ownerDocument.activeElement);
    if(previous&&(previous.button.parentElement!==host||previous.nativeTools!==nativeTools||previous.ownedTools!==ownedTools))this.removeActions(host);
    if(this.actionControls.has(host))return;
    const button=host.ownerDocument.createElement("button");button.type="button";button.className="pl-workspace-actions-button";
    button.setAttribute(OWNED,"true");button.dataset.plWorkspaceActions="true";button.textContent="Class actions";
    button.setAttribute("aria-label",`Class actions for ${course.label}`);button.setAttribute("aria-expanded","false");
    // Blurring a note can insert its saved badge above this button. Keep that
    // layout change after click dispatch, rather than between mouse down/up.
    button.addEventListener("mousedown",event=>{if(event.button===0)event.preventDefault();});
    button.addEventListener("click",()=>{
      if(this.actionsHost===host){this.closeActions();return;}
      this.introduction.closeInfo(false);this.closePreview(false);this.closeActions(false);
      if(this.state)this.state.extras.open=false;
      this.actionsHost=host;host.classList.add("pl-course-actions-open");button.setAttribute("aria-expanded","true");button.focus({preventScroll:true});
      this.revealInPlan(host,button.getBoundingClientRect().top,host.getBoundingClientRect().bottom);
    });
    const key=(event:KeyboardEvent)=>{
      if(event.key!=="Escape"||event.defaultPrevented||this.actionsHost!==host)return;
      const target=event.target instanceof Element?event.target:null;
      const menu=target?.closest<HTMLDetailsElement>("details[data-pl-course-menu][open]");
      if(menu&&ownedTools?.contains(menu)){
        // Close the inner owned More disclosure before hiding its outer actions.
        menu.open=false;menu.querySelector<HTMLElement>("summary")?.focus({preventScroll:true});event.preventDefault();
      }
    };
    host.addEventListener("keydown",key,true);details.after(button);
    this.actionControls.set(host,{button,nativeTools,ownedTools,key});
    if(restoreFocus)button.focus({preventScroll:true});
  }

  private closeActions(focus=true):void {
    const host=this.actionsHost;if(!host)return;this.actionsHost=null;
    const actions=this.actionControls.get(host);
    host.querySelectorAll<HTMLDetailsElement>("[data-pl-real-tools] details[data-pl-course-menu][open]").forEach(menu=>{menu.open=false;});
    host.classList.remove("pl-course-actions-open");actions?.button.setAttribute("aria-expanded","false");
    if(focus&&actions?.button.isConnected)actions.button.focus({preventScroll:true});
  }

  private removeActions(host:HTMLElement):void {
    if(this.actionsHost===host)this.closeActions(false);
    const actions=this.actionControls.get(host);if(!actions)return;
    host.removeEventListener("keydown",actions.key,true);actions.button.remove();host.classList.remove("pl-course-actions-open");this.actionControls.delete(host);
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
    const panel=doc.getElementById(PANEL),host=panel?.parentElement;
    if(!panel||!host?.classList.contains("classPlannerWrapper")||!host.closest("form#aspnetForm")||hasUnknownSection(panel))return;
    const primary=PRIMARY.map(([cls,title])=>[...panel.children].filter(node=>node.matches(`section.${cls}`)&&node.querySelector(`:scope > #${title}.classPlanner_SectionTitle`)));
    const known=(section:Element)=>section.children.length===2&&section.children[0].matches(".classPlanner_SectionTitle")&&section.children[1].tagName==="DIV";
    if(primary.some(matches=>matches.length!==1||!known(matches[0])))return;
    const secondary=SECONDARY.map(([cls])=>[...panel.children].filter(node=>node.matches(`section.${cls}`)));
    // Secondary bodies are opaque. Optimizer may include a help block before
    // a conditionally hidden panel; its native visibility must remain native.
    if(secondary.some(matches=>matches.length>1||matches.some(node=>!node.firstElementChild?.matches(".classPlanner_SectionTitle")||node.children.length<2)))return;
    const owned=<T extends HTMLElement>(node:T,cls:string):T=>{node.className=cls;node.setAttribute(OWNED,"true");return node;};
    const placements:Placement[]=[];
    const place=(node:HTMLElement,destination:HTMLElement)=>{const anchor=doc.createComment("planner-lift-workspace-position");node.before(anchor);placements.push({node,anchor});destination.append(node);};
    const top=doc.createElement("div");top.className="pl-workspace-top";panel.before(top);
    const shell=doc.createElement("div");shell.className="pl-workspace-shell";panel.before(shell);
    const navigation=owned(doc.createElement("nav"),"pl-workspace-nav");navigation.setAttribute("aria-label","Planner modules");shell.append(navigation);
    const navMain=owned(doc.createElement("div"),"pl-workspace-nav-main"),navFooter=owned(doc.createElement("div"),"pl-workspace-nav-footer");navigation.append(navMain,navFooter);
    const deck=doc.createElement("div");deck.className="pl-workspace-deck";panel.append(deck);
    const main=doc.createElement("div");main.className="pl-workspace-main";deck.append(main);
    const panes:Pane[]=[],moduleButtons=new Map<Module,HTMLButtonElement>();
    const add=(section:HTMLElement,label:string,module:Module|null,opaque=false):Pane=>{
      const title=section.children[0] as HTMLElement,body=section.lastElementChild as HTMLElement;
      const pane:Pane={section,title,body,label,module,opaque,toggle:null,reopen:null,collapsed:this.paneChoices.get(title.id)??false,bodyHadClass:body.hasAttribute("class"),click:()=>{}};
      title.classList.add("pl-pane-title");
      if(!opaque){
        body.classList.add("pl-pane-body");
        const toggle=owned(doc.createElement("button"),"pl-pane-toggle");toggle.type="button";if(body.id)toggle.setAttribute("aria-controls",body.id);title.append(toggle);pane.toggle=toggle;
        toggle.addEventListener("click",()=>this.setPaneCollapsed(pane,!pane.collapsed,true));
        pane.click=event=>{if(event.target instanceof Element&&event.target.closest("button.planSectionToggle")?.parentElement===title){event.preventDefault();event.stopImmediatePropagation();this.setPaneCollapsed(pane,!pane.collapsed,true);}};
        title.addEventListener("click",pane.click,true);
      }
      panes.push(pane);return pane;
    };
    primary.forEach((matches,i)=>{
      const section=matches[0] as HTMLElement;section.classList.add(PRIMARY[i][2]);
      add(section,PRIMARY[i][3],i===0?"classes":i===2?"find":null);place(section,i===1?deck:main);
    });
    secondary.forEach((matches,i)=>{if(matches[0]){const section=matches[0] as HTMLElement;add(section,SECONDARY[i][1],(["optimizer","study","personal"] as Module[])[i],true);place(section,main);}});
    const slot=owned(doc.createElement("div"),"pl-workspace-details-slot");panes[0].section.append(slot);
    const empty=owned(doc.createElement("p"),"pl-workspace-empty");empty.textContent="Select a class to see its sections and details.";slot.append(empty);
    const infoPlaceholder=owned(doc.createElement("div"),"pl-workspace-information-placeholder");infoPlaceholder.textContent="Information & help";main.append(infoPlaceholder);
    for(const module of ["classes","find","optimizer","study","personal"] as Module[]){
      const button=doc.createElement("button");button.type="button";button.dataset.plModule=module;button.textContent=MODULE_LABELS[module];
      const pane=panes.find(p=>p.module===module);button.disabled=!pane;if(pane){pane.reopen=button;if(pane.body.id)button.setAttribute("aria-controls",pane.body.id);}
      button.addEventListener("click",()=>this.selectModule(module,true));
      button.addEventListener("keydown",event=>{
        if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
        const choices=[...moduleButtons.entries()].filter(([,entry])=>!entry.disabled),index=choices.findIndex(([key])=>key===module);
        const next=event.key==="Home"?0:event.key==="End"?choices.length-1:(index+(["ArrowUp","ArrowLeft"].includes(event.key)?-1:1)+choices.length)%choices.length;
        event.preventDefault();this.selectModule(choices[next][0],true);
      });navMain.append(button);moduleButtons.set(module,button);
    }
    const original=owned(doc.createElement("button"),"pl-workspace-original");original.type="button";original.textContent="Original layout";navFooter.append(original);
    original.addEventListener("click",()=>{this.restore();this.useOriginal=true;this.ensureReturnButton(doc);});
    const tabs=owned(doc.createElement("div"),"pl-workspace-mobile-tabs");top.append(tabs);
    const mobileMain=doc.createElement("button"),mobileSchedule=doc.createElement("button");
    mobileMain.type=mobileSchedule.type="button";mobileMain.dataset.plMobileView="main";mobileSchedule.dataset.plMobileView="schedule";
    mobileSchedule.className="pl-workspace-schedule-toggle";mobileSchedule.textContent="Schedule";tabs.append(mobileMain,mobileSchedule);
    mobileMain.addEventListener("click",()=>{this.showSchedule=false;this.updatePanes();mobileMain.focus({preventScroll:true});});
    mobileSchedule.addEventListener("click",()=>{this.showSchedule=true;panes[1].collapsed=false;this.updatePanes();mobileSchedule.focus({preventScroll:true});});
    const extras=doc.createElement("details");extras.className="pl-workspace-plan-actions";top.append(extras);
    const summary=owned(doc.createElement("summary"),"");summary.textContent="Plan actions";extras.append(summary);
    const menu=[...host.children].find(node=>node.classList.contains("plannerTopMenuLinks"));if(menu)place(menu as HTMLElement,extras);else extras.hidden=true;
    place(panel,shell);
    const splitter=owned(doc.createElement("div"),"pl-workspace-splitter");splitter.tabIndex=0;splitter.setAttribute("role","separator");splitter.setAttribute("aria-orientation","vertical");splitter.setAttribute("aria-label","Resize schedule");
    splitter.title="Drag to resize schedule. Arrow keys adjust; double-click resets.";main.after(splitter);
    splitter.addEventListener("pointerdown",event=>{if(event.button!==0)return;event.preventDefault();splitter.focus();this.drag={start:event.clientX,width:this.currentScheduleWidth(),pointerId:event.pointerId};deck.classList.add("pl-workspace-resizing");});
    splitter.addEventListener("dblclick",()=>{this.scheduleWidth=null;this.updatePanes();});
    splitter.addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();this.scheduleWidth=event.key==="Home"?420:event.key==="End"?640:this.currentScheduleWidth()+(event.key==="ArrowLeft"?1:-1)*(event.shiftKey?40:16);this.updatePanes();});
    const position=owned(doc.createElement("div"),"pl-workspace-position");host.before(position);
    const scrollRoom=owned(doc.createElement("div"),"pl-workspace-scroll-room");host.after(scrollRoom);
    const preview=owned(doc.createElement("aside"),"pl-workspace-preview");preview.hidden=true;preview.setAttribute("role","region");preview.setAttribute("aria-label","Selected class details");
    const head=doc.createElement("div");head.className="pl-workspace-preview-head";
    const content=doc.createElement("div");content.className="pl-workspace-preview-content";
    const close=doc.createElement("button");close.type="button";close.className="pl-workspace-preview-close";close.textContent="×";close.setAttribute("aria-label","Close details");close.addEventListener("click",()=>this.closePreview());
    const more=doc.createElement("button");more.type="button";more.className="pl-workspace-preview-more";more.textContent="Rooms & instructors";more.setAttribute("aria-expanded","false");more.addEventListener("click",()=>{if(this.selected)more.setAttribute("aria-expanded",String(this.selected.classList.toggle("pl-section-more")));});preview.append(close,head,more,content);slot.append(preview);
    const resize=()=>{this.introduction.positionHeader();this.positionWorkspace();this.updatePanes();this.introduction.positionInfo();};
    const key=(event:KeyboardEvent)=>{
      if(event.key!=="Escape"||event.defaultPrevented)return;
      const target=event.target;
      if(target instanceof Element&&target.matches("input.ClassSearchBox")&&panes[2].body.contains(target)&&[...doc.querySelectorAll<HTMLElement>(".ui-autocomplete")].some(menu=>!menu.hidden&&menu.children.length>0&&doc.defaultView?.getComputedStyle(menu).display!=="none"&&doc.defaultView?.getComputedStyle(menu).visibility!=="hidden"))return;
      if(extras.open){extras.open=false;summary.focus();event.preventDefault();}
      else if(this.actionsHost){this.closeActions();event.preventDefault();}
      else if(this.module==="information"){this.selectModule(this.previousModule);doc.querySelector<HTMLButtonElement>(".pl-intro-info")?.focus({preventScroll:true});event.preventDefault();}
      else if(this.showSchedule&&doc.defaultView!.innerWidth<1100){this.showSchedule=false;this.updatePanes();mobileSchedule.focus({preventScroll:true});event.preventDefault();}
      else if(this.selected&&this.module==="classes"){this.closePreview();event.preventDefault();}
    };
    const move=(event:PointerEvent)=>{if(this.drag&&event.pointerId===this.drag.pointerId){this.scheduleWidth=this.drag.width+this.drag.start-event.clientX;this.updatePanes();}};
    const end=()=>{this.drag=null;deck.classList.remove("pl-workspace-resizing");};
    let before:boolean|null=null;
    const beforePrint=()=>{if(before===null)before=extras.open;extras.open=true;};
    const afterPrint=()=>{if(before!==null){extras.open=before;before=null;}};
    this.state={doc,host,panel,deck,top,extras,placements,preview,head,content,close,more,panes,splitters:[splitter],empty,shell,main,navMain,navFooter,slot,moduleButtons,mobileMain,mobileSchedule,position,scrollRoom,hostHadStyle:host.hasAttribute("style"),resize,key,move,end,beforePrint,afterPrint};
    for(const name of ["resize","scroll","focus","pageshow","load"])doc.defaultView?.addEventListener(name,resize);
    doc.addEventListener("visibilitychange",resize);doc.addEventListener("keydown",key);extras.addEventListener("toggle",resize);
    doc.addEventListener("pointermove",move);doc.addEventListener("pointerup",end);doc.addEventListener("pointercancel",end);doc.defaultView?.addEventListener("blur",end);
    doc.defaultView?.addEventListener("beforeprint",beforePrint);doc.defaultView?.addEventListener("afterprint",afterPrint);
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

  private currentScheduleWidth():number {
    const s=this.state,available=s?.deck.clientWidth||1400;
    return Math.max(420,Math.min(640,Math.max(420,available-632),this.scheduleWidth??available*.38));
  }

  private selectModule(module:Module,focus=false):void {
    const s=this.state;if(!s)return;
    if(module!=="information"&&!s.panes.some(p=>p.module===module))return;
    if(module==="information"&&this.module!=="information")this.previousModule=this.module;
    this.closeActions(false);this.module=module;this.showSchedule=false;s.extras.open=false;
    const pane=s.panes.find(p=>p.module===module);if(pane&&!pane.opaque){pane.collapsed=false;this.paneChoices.set(pane.title.id,false);}
    this.updatePanes();if(focus)(module==="information"?s.doc.querySelector<HTMLButtonElement>(".pl-intro-info"):s.moduleButtons.get(module))?.focus({preventScroll:true});
  }

  private setPaneCollapsed(pane:Pane,collapsed:boolean,focus=false):void {
    if(!this.state||pane.opaque)return;
    if(collapsed&&pane===this.state.panes[0]){this.closeActions(false);this.closePreview(false);}
    pane.collapsed=collapsed;this.paneChoices.set(pane.title.id,collapsed);this.updatePanes();
    if(focus)(collapsed&&pane.reopen?pane.reopen:pane.toggle)?.focus({preventScroll:true});
  }

  private updatePanes():void {
    const s=this.state;if(!s)return;
    if(this.module!=="information"&&!s.panes.some(pane=>pane.module===this.module))this.module="classes";
    s.host.dataset.plModule=this.module;s.host.classList.toggle("pl-show-schedule",this.showSchedule);
    for(const [module,button] of s.moduleButtons)button.setAttribute("aria-pressed",String(this.module===module));
    for(const pane of s.panes){
      pane.section.classList.toggle("pl-module-active",pane.module===this.module||pane.module===null);
      if(!pane.opaque){pane.section.classList.toggle("pl-pane-collapsed",pane.collapsed);pane.section.classList.toggle("pl-pane-open",!pane.collapsed);pane.toggle?.setAttribute("aria-expanded",String(!pane.collapsed));const label=`${pane.collapsed?"Expand":"Collapse"} ${pane.label}`;pane.toggle?.setAttribute("aria-label",label);if(pane.toggle){pane.toggle.title=label;pane.toggle.textContent=pane.collapsed?"›":"⌄";}}
    }
    const width=this.currentScheduleWidth();s.deck.style.setProperty("--pl-schedule-width",`${width}px`);
    const splitter=s.splitters[0];splitter.setAttribute("aria-valuemin","420");splitter.setAttribute("aria-valuemax",String(Math.max(420,Math.min(640,(s.deck.clientWidth||1400)-632))));splitter.setAttribute("aria-valuenow",String(Math.round(width)));
    s.mobileMain.textContent=MODULE_LABELS[this.module];s.mobileMain.setAttribute("aria-pressed",String(!this.showSchedule));s.mobileSchedule.setAttribute("aria-pressed",String(this.showSchedule));
    s.panes[0].section.classList.toggle("pl-has-docked-details",!!this.selected);s.empty.hidden=!!this.selected;
    const mainWidth=s.main.getBoundingClientRect().width;
    s.main.dataset.plMainSize=mainWidth>=700?"wide":mainWidth>=560?"medium":"narrow";
    this.positionPreview();this.introduction.showInformationInWorkspace(this.module==="information"&&!(this.showSchedule&&s.doc.defaultView!.innerWidth<1100),s.main.getBoundingClientRect(),this.module==="information");
  }

  private summaryChanged(card:HTMLElement):boolean {
    const table=card.querySelector<HTMLTableElement>("table.coursetable"),previous=this.summaries.get(card);
    return !table||!previous||previous.table!==table||!previous.node.isConnected||previous.signature!==JSON.stringify(sectionSummary(table));
  }

  private ensureSummary(course:CourseSnapshot):void {
    const table=course.node.querySelector<HTMLTableElement>("table.coursetable"),host=course.node.querySelector<HTMLElement>(":scope > tr:first-child > td.SubjectAreaName_ClassName");
    if(!table||!host)return;
    const values=sectionSummary(table),signature=JSON.stringify(values),previous=this.summaries.get(course.node);
    if(previous?.table===table&&previous.node.isConnected&&previous.signature===signature)return;
    previous?.node.remove();const summary=host.ownerDocument.createElement("div");summary.className="pl-workspace-course-summary";summary.setAttribute(OWNED,"true");
    for(const fields of values){
      const line=host.ownerDocument.createElement("p");
      fields.forEach((text,index)=>{const value=host.ownerDocument.createElement("span");value.dataset.plSummaryField=String([1,4,5,2][index]);value.textContent=text;line.append(value);});
      summary.append(line);
    }
    host.append(summary);this.summaries.set(course.node,{node:summary,table,signature});
  }

  private openPreview(course:CourseSnapshot,trigger:HTMLElement|null):void{
    const s=this.state;if(!s||!s.deck.contains(course.node))return;
    if(this.selected===course.node){this.closePreview();return;}
    this.introduction.closeInfo(false);this.closeActions(false);
    this.closePreview(false);s.extras.open=false;
    this.module="classes";this.showSchedule=false;
    const pane=s.panes[0];pane.collapsed=false;this.paneChoices.set(pane.title.id,false);this.updatePanes();
    this.selected=course.node;this.selectedHadStyle=course.node.hasAttribute("style");this.returnFocus=trigger;
    trigger?.setAttribute("aria-expanded","true");
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
    this.updatePanes();s.close.focus({preventScroll:true});
  }

  private revealInPlan(target:HTMLElement,start:number,end:number):void {
    const s=this.state,view=s?.doc.defaultView;if(!s||!view)return;
    const plan=s.panes[0];
    for(let container=target.parentElement;container&&plan.section.contains(container);container=container.parentElement){
      const overflow=view.getComputedStyle(container).overflowY;
      if(!/^(auto|scroll)$/.test(overflow)||container.clientHeight<=0||container.scrollHeight<=container.clientHeight)continue;
      const bounds=container.getBoundingClientRect();
      const top=Math.max(bounds.top+container.clientTop,container===plan.section?plan.title.getBoundingClientRect().bottom:0)+8;
      const bottom=Math.min(bounds.top+container.clientTop+container.clientHeight,view.innerHeight)-8;
      if(bottom<=top)return;
      const delta=start<top?start-top:end>bottom?Math.min(end-bottom,start-top):0;
      container.scrollTop=Math.max(0,Math.min(container.scrollHeight-container.clientHeight,container.scrollTop+delta));
      return;
    }
  }

  private positionPreview():void {
    const s=this.state;if(!s||!this.selected||s.preview.hidden)return;
    this.selected.classList.add("pl-preview-docked");this.selected.classList.remove("pl-preview-inline");
    const destination=this.selected.children[2]?.firstElementChild;if(destination&&s.preview.parentElement!==destination)destination.prepend(s.preview);
    const box=s.slot.getBoundingClientRect();
    for(const [key,value] of [["left",box.left],["top",box.top],["width",box.width],["height",box.height]] as const)this.selected.style.setProperty(`--pl-detail-${key}`,`${Math.max(0,value)}px`);
  }

  closePreview(focus=true):void{
    this.detailCards?.restore();this.detailCards=null;
    this.returnFocus?.setAttribute("aria-expanded","false");
    if(this.selected){
      this.selected.classList.remove("pl-workspace-preview-card","pl-preview-inline","pl-preview-docked","pl-section-more");
      for(const name of ["left","top","width","height"])this.selected.style.removeProperty(`--pl-detail-${name}`);
      if(!this.selectedHadStyle&&!this.selected.getAttribute("style"))this.selected.removeAttribute("style");
    }
    this.selected=null;this.selectedTable=null;
    if(this.state){const s=this.state;s.preview.hidden=true;if(s.preview.parentElement!==s.slot)s.slot.append(s.preview);s.panes[0].section.classList.remove("pl-has-docked-details");s.empty.hidden=false;}
    if(focus&&this.returnFocus?.isConnected)this.returnFocus.focus({preventScroll:true});this.returnFocus=null;
  }

  restore():void{
    for(const host of this.actionControls.keys())this.removeActions(host);
    for(const summary of this.summaries.values())summary.node.remove();this.summaries.clear();
    this.useOriginal=false;this.returnButton?.remove();this.returnButton=null;this.browser.restore();this.introduction.restore();
    const intro = this.introductionOnly; this.introductionOnly = null;
    if (intro) {
      for (const event of ["resize", "scroll", "focus", "pageshow", "load"]) intro.doc.defaultView?.removeEventListener(event, intro.resize);
      intro.doc.removeEventListener("visibilitychange", intro.resize); intro.doc.removeEventListener("keydown", intro.key);
      intro.toolbar.remove(); intro.doc.documentElement.classList.remove("pl-intro-page");
    }
    const s=this.state;if(!s)return;this.closePreview(false);this.state=null;this.drag=null;
    s.doc.defaultView?.removeEventListener("beforeprint",s.beforePrint);s.doc.defaultView?.removeEventListener("afterprint",s.afterPrint);s.afterPrint();
    s.doc.defaultView?.removeEventListener("resize",s.resize);s.doc.defaultView?.removeEventListener("scroll",s.resize);s.extras.removeEventListener("toggle",s.resize);s.doc.removeEventListener("keydown",s.key);
    s.doc.defaultView?.removeEventListener("focus",s.resize);s.doc.defaultView?.removeEventListener("pageshow",s.resize);s.doc.defaultView?.removeEventListener("load",s.resize);s.doc.removeEventListener("visibilitychange",s.resize);
    s.doc.removeEventListener("pointermove",s.move);s.doc.removeEventListener("pointerup",s.end);s.doc.removeEventListener("pointercancel",s.end);s.doc.defaultView?.removeEventListener("blur",s.end);
    for(const pane of s.panes){
      pane.title.removeEventListener("click",pane.click,true);pane.toggle?.remove();pane.title.classList.remove("pl-pane-title");if(!pane.opaque)pane.body.classList.remove("pl-pane-body");
      if(!pane.bodyHadClass&&!pane.body.getAttribute("class"))pane.body.removeAttribute("class");pane.section.classList.remove("pl-pane-open","pl-pane-collapsed","pl-module-active","pl-has-docked-details");
    }
    for(const {node,anchor} of [...s.placements].reverse()){
      // A native partial update can replace the panel inside our shell. Restore
      // that live replacement, never revive the now-disconnected old panel.
      const current=node.isConnected?node:node.id?s.doc.getElementById(node.id):null;
      if(anchor.isConnected&&current)anchor.replaceWith(current);else anchor.remove();
    }
    PRIMARY.forEach(([, ,cls])=>s.doc.querySelectorAll(`.${cls}`).forEach(n=>n.classList.remove(cls)));
    s.doc.querySelectorAll("[data-pl-workspace-details]").forEach(n=>n.remove());
    s.preview.remove();s.slot.remove();s.deck.remove();s.shell.remove();s.top.remove();s.position.remove();s.scrollRoom.remove();["--pl-workspace-top","--pl-workspace-left","--pl-workspace-width"].forEach(p=>s.host.style.removeProperty(p));
    if(!s.hostHadStyle&&!s.host.getAttribute("style"))s.host.removeAttribute("style");s.host.classList.remove("pl-workspace-host","pl-workspace-flow","pl-task-plan","pl-task-find","pl-show-schedule","pl-workspace-empty-plan");delete s.host.dataset.plModule;s.doc.documentElement.classList.remove("pl-workspace-page");
  }
}
