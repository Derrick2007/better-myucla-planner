import { SectionCards } from "./section-cards";

const OWNED = "data-planner-lift-owned";
const ROOT = "section.classPlanner_ClassSearchSection > #panelSearch > .ClassSearchWidget > .ClassSearchList";
interface Entry { node: HTMLElement; body: HTMLElement; bodyHadClass: boolean; heading: HTMLElement; rows: HTMLElement[]; cells: Element[]; label: string; key: string; button?: HTMLButtonElement; }
interface BrowserState {
  root: HTMLElement; widget: HTMLElement; entries: Entry[]; toolbar: HTMLElement; index: HTMLElement;
  edit: HTMLButtonElement; more: HTMLButtonElement; cards: SectionCards; selected: string;
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
    if (this.needsReconcile(doc)) this.restore();
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
    next.root.before(toolbar,index);
    const cards = new SectionCards();
    for (const entry of next.entries) {
      cards.results(entry.body); entry.node.classList.add("pl-browser-course"); entry.body.classList.add("pl-browser-body");
      const button = doc.createElement("button"); button.type="button"; button.textContent=entry.label; entry.button=button;
      button.addEventListener("click",()=>this.select(entry.key)); index.append(button);
    }
    widget.classList.add("pl-browser-results"); next.root.classList.add("pl-browser-list");
    this.state={...next,widget,toolbar,index,edit,more,cards,selected:""};
    this.select(next.entries.some(entry=>entry.key===this.lastKey && entry.label===this.lastLabel) ? this.lastKey : next.entries[0].key);
  }

  private select(key:string): void {
    const s=this.state; if (!s) return;
    s.selected=key; this.lastKey=key; this.lastLabel=s.entries.find(entry=>entry.key===key)?.label || "";
    for (const entry of s.entries) {
      const selected=entry.key===key; entry.node.classList.toggle("pl-browser-active",selected);
      entry.body.classList.toggle("pl-browser-body-active",selected);
      entry.button?.setAttribute("aria-pressed",String(selected));
    }
    s.root.scrollTop=0;
  }

  restore(): void {
    const s=this.state; if(!s) return; this.state=null;
    s.cards.restore(); s.toolbar.remove(); s.index.remove();
    s.widget.classList.remove("pl-browser-results","pl-browser-editing");
    s.root.classList.remove("pl-browser-list","pl-section-more");
    for(const entry of s.entries) {
      entry.node.classList.remove("pl-browser-course","pl-browser-active");entry.body.classList.remove("pl-browser-body","pl-browser-body-active");
      if (!entry.bodyHadClass && !entry.body.getAttribute("class")) entry.body.removeAttribute("class");
    }
  }
}
