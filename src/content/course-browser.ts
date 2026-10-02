import { SectionCards } from "./section-cards";

const OWNED = "data-planner-lift-owned";
const ROOT = "section.classPlanner_ClassSearchSection > #panelSearch > .ClassSearchWidget > .ClassSearchList";
interface Entry { node: HTMLElement; body: HTMLElement; bodyHadClass: boolean; heading: HTMLElement; rows: HTMLElement[]; cells: Element[]; label: string; key: string; button?: HTMLButtonElement; }
interface BrowserState {
  root: HTMLElement; widget: HTMLElement; entries: Entry[]; toolbar: HTMLElement; index: HTMLElement;
  edit: HTMLButtonElement; more: HTMLButtonElement; cards: SectionCards; selected: string;
  filter: HTMLInputElement; filterStatus: HTMLElement; previewTitle: HTMLElement;
}
function read(doc: Document): {root:HTMLElement;entries:Entry[]} | null {
  const roots = doc.querySelectorAll<HTMLElement>(ROOT);
  if (roots.length !== 1) return null;
  const root = roots[0], nodes = [...root.querySelectorAll<HTMLElement>(":scope > .CourseListEntry")];
  if (!nodes.length) return null;
  const entries: Entry[] = [];
  for (const node of nodes) {
    const match = /^CourseListEntry_M(\d+)$/.exec(node.id);
    const heading = node.querySelector<HTMLElement>(":scope > .class-title > h3.head > a");
    const bodies = match ? [...root.querySelectorAll<HTMLElement>(`#container_course_M${match[1]}`)] : [];
    // MyUCLA emits headings and loaded bodies as siblings. Older known markup
    // nests the body in its entry. Preserve either topology without moving it.
    const body = bodies.length === 1 && (bodies[0].parentElement === root || bodies[0].parentElement === node) ? bodies[0] : null;
    // Incomplete or unfamiliar results stay in MyUCLA's native presentation.
    // Never load a missing course in the background just to create a preview.
    const rows = body && SectionCards.knownResultRows(body);
    if (!match || !heading || !body || !rows) return null;
    const label = (heading.textContent || "").replace(/\s+/g," ").trim();
    if (!label) return null;
    entries.push({node,body,bodyHadClass:body.hasAttribute("class"),heading,rows,cells:rows.flatMap(row=>[...row.children]),label,key:node.id});
  }
  return {root,entries};
}

/** Browse already-rendered results locally; no native click or query is sent. */
export class CourseBrowserPresentation {
  private state: BrowserState | null = null;
  private lastKey = "";
  private lastLabel = "";

  needsReconcile(doc: Document): boolean {
    const next = read(doc), s = this.state;
    if (!next || !s) return !!next !== !!s;
    return next.root !== s.root || next.entries.length !== s.entries.length || next.entries.some((entry,i)=>entry.node !== s.entries[i].node || entry.body !== s.entries[i].body || entry.heading !== s.entries[i].heading || entry.label !== s.entries[i].label || entry.cells.length !== s.entries[i].cells.length || entry.cells.some((cell,j)=>cell !== s.entries[i].cells[j])) || !s.toolbar.isConnected || s.entries.some(entry=>!entry.body.querySelector(".pl-section-card"));
  }

  reconcile(doc: Document): void {
    const next = read(doc);
    const previous = this.state;
    // A native section expansion can replace rows without changing the search.
    // Keep the reader's local view through that redraw, but reset for new results.
    const sameResults = next && previous && next.root === previous.root && next.entries.length === previous.entries.length && next.entries.every((entry,i)=>entry.node === previous.entries[i].node && entry.body === previous.entries[i].body && entry.heading === previous.entries[i].heading && entry.label === previous.entries[i].label);
    const retained = sameResults ? {
      query: previous.filter.value,
      editing: previous.widget.classList.contains("pl-browser-editing"),
      more: previous.root.classList.contains("pl-section-more"),
      scrollTop: previous.index.scrollTop,
      focus: doc.activeElement === previous.filter ? "filter" : doc.activeElement === previous.edit ? "edit" : doc.activeElement === previous.more ? "more" : previous.entries.find(entry=>entry.button === doc.activeElement)?.key
    } : null;
    if (this.needsReconcile(doc)) {
      this.restore();
      // Read the restored native class state, not our previous presentation mark.
      next?.entries.forEach(entry=>{entry.bodyHadClass=entry.body.hasAttribute("class");});
    }
    if (!next || this.state) return;
    const widget = next.root.parentElement!;
    const owned = <T extends HTMLElement>(node:T,cls:string):T => {node.className=cls;node.setAttribute(OWNED,"true");return node;};
    const toolbar = owned(doc.createElement("div"),"pl-browser-toolbar");
    const title = doc.createElement("strong"); title.textContent=`Courses (${next.entries.length})`;
    const edit = doc.createElement("button"); edit.type="button"; edit.textContent="Edit search"; edit.setAttribute("aria-expanded","false");
    const more = doc.createElement("button"); more.type="button"; more.textContent="Rooms & instructors"; more.setAttribute("aria-expanded","false");
    edit.addEventListener("click",()=>{
      const expanded = widget.classList.toggle("pl-browser-editing"); edit.setAttribute("aria-expanded",String(expanded));
      edit.textContent=expanded ? "Hide search fields" : "Edit search";
    });
    more.addEventListener("click",()=>{
      const expanded=next.root.classList.toggle("pl-section-more"); more.setAttribute("aria-expanded",String(expanded));
    });
    toolbar.append(title,edit,more);
    const index = owned(doc.createElement("nav"),"pl-browser-index"); index.setAttribute("aria-label","Courses in search results");
    const filterLabel = doc.createElement("label"); filterLabel.className="pl-browser-filter";
    const filterCaption = doc.createElement("span"); filterCaption.textContent="Filter courses";
    const filter = doc.createElement("input"); filter.type="search"; filter.placeholder="Course number or title";
    filter.autocomplete="off"; filter.value=retained?.query || "";
    filterLabel.append(filterCaption,filter);
    const filterStatus = doc.createElement("p"); filterStatus.className="pl-browser-filter-status";
    filterStatus.setAttribute("role","status"); filterStatus.setAttribute("aria-live","polite");
    const choices = doc.createElement("div"); choices.className="pl-browser-choices";
    index.append(filterLabel,filterStatus,choices);
    const previewTitle = owned(doc.createElement("h3"),"pl-browser-preview-title");
    previewTitle.setAttribute("aria-live","polite"); next.root.prepend(previewTitle);
    next.root.before(toolbar,index);
    const cards = new SectionCards();
    for (const entry of next.entries) {
      cards.results(entry.body); entry.node.classList.add("pl-browser-course"); entry.body.classList.add("pl-browser-body");
      const button = doc.createElement("button"); button.type="button"; button.textContent=entry.label; entry.button=button;
      button.setAttribute("aria-controls",entry.body.id);
      button.addEventListener("click",()=>this.select(entry.key)); choices.append(button);
    }
    widget.classList.add("pl-browser-results"); next.root.classList.add("pl-browser-list");
    this.state={...next,widget,toolbar,index,edit,more,cards,selected:"",filter,filterStatus,previewTitle};
    filter.addEventListener("input",()=>this.filterCourses());
    // This owned filter lives inside UCLA's form but must never submit it.
    filter.addEventListener("keydown",event=>{if(event.key === "Enter") event.preventDefault();});
    choices.addEventListener("keydown",event=>{
      const buttons=next.entries.map(entry=>entry.button!).filter(button=>!button.hidden);
      const current=buttons.indexOf(event.target as HTMLButtonElement);
      if(current<0 || !["ArrowUp","ArrowDown","Home","End"].includes(event.key)) return;
      event.preventDefault();
      const position=event.key === "Home" ? 0 : event.key === "End" ? buttons.length-1 : Math.max(0,Math.min(buttons.length-1,current+(event.key === "ArrowDown" ? 1 : -1)));
      const button=buttons[position];
      this.select(next.entries.find(entry=>entry.button===button)!.key);
      button.focus({preventScroll:true});
      const bounds=index.getBoundingClientRect(), target=button.getBoundingClientRect();
      const visibleTop=Math.max(bounds.top,filterLabel.getBoundingClientRect().bottom);
      if(target.top<visibleTop) index.scrollTop-=visibleTop-target.top;
      else if(target.bottom>bounds.bottom) index.scrollTop+=target.bottom-bounds.bottom;
    });
    this.select(next.entries.some(entry=>entry.key===this.lastKey && entry.label===this.lastLabel) ? this.lastKey : next.entries[0].key);
    this.filterCourses();
    if(retained) {
      widget.classList.toggle("pl-browser-editing",retained.editing);
      edit.setAttribute("aria-expanded",String(retained.editing)); edit.textContent=retained.editing ? "Hide search fields" : "Edit search";
      next.root.classList.toggle("pl-section-more",retained.more); more.setAttribute("aria-expanded",String(retained.more));
      const focus=retained.focus === "filter" ? filter : retained.focus === "edit" ? edit : retained.focus === "more" ? more : next.entries.find(entry=>entry.key===retained.focus)?.button;
      focus?.focus({preventScroll:true}); index.scrollTop=retained.scrollTop;
    }
  }

  private filterCourses(): void {
    const s=this.state; if(!s) return;
    const query=s.filter.value.trim().toLocaleLowerCase();
    const matches=s.entries.filter(entry=>entry.label.toLocaleLowerCase().includes(query));
    for(const entry of s.entries) entry.button!.hidden=!matches.includes(entry);
    s.filterStatus.textContent=query ? `${matches.length} of ${s.entries.length} courses` : "";
    s.filterStatus.hidden=!query;
    if(!matches.some(entry=>entry.key===s.selected)) this.select(matches[0]?.key || "");
  }

  private select(key:string): void {
    const s=this.state; if (!s) return;
    s.selected=key;
    const selectedEntry=s.entries.find(entry=>entry.key===key);
    if(selectedEntry) { this.lastKey=key; this.lastLabel=selectedEntry.label; }
    s.previewTitle.textContent=selectedEntry?.label || "No matching courses";
    for (const entry of s.entries) {
      const selected=entry.key===key; entry.node.classList.toggle("pl-browser-active",selected);
      entry.body.classList.toggle("pl-browser-body-active",selected);
      entry.button?.setAttribute("aria-pressed",String(selected));
    }
    s.root.scrollTop=0;
  }

  restore(): void {
    const s=this.state; if(!s) return; this.state=null;
    s.cards.restore(); s.toolbar.remove(); s.index.remove(); s.previewTitle.remove();
    s.widget.classList.remove("pl-browser-results","pl-browser-editing");
    s.root.classList.remove("pl-browser-list","pl-section-more");
    for(const entry of s.entries) {
      entry.node.classList.remove("pl-browser-course","pl-browser-active");entry.body.classList.remove("pl-browser-body","pl-browser-body-active");
      if (!entry.bodyHadClass && !entry.body.getAttribute("class")) entry.body.removeAttribute("class");
    }
  }
}
