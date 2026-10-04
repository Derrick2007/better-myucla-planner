/** A reversible presentation of the existing search controls, not a search engine. */
const OWNED = "data-planner-lift-owned";
const WIDGET = "section.classPlanner_ClassSearchSection > #panelSearch > .ClassSearchWidget";
const SEARCH_ID = "ctl00_MainContent_cs_searchBy";
const GO_ID = "ctl00_MainContent_cs_goButton";
const OPTIONS = [
  ["subject", "Subject Area"], ["units", "Class Units"], ["classidnumber", "Class ID"],
  ["instructor", "Instructor"], ["geclass", "General Education (GE) Classes"],
  ["writing2", "Writing II Classes"], ["diversity", "Diversity Classes"],
  ["collegehonors", "College Honors Classes"], ["fiatlux", "Fiat Lux Classes"],
  ["service", "Community-Engaged Learning Classes"],
  ["cutf", "Collegium of University Teaching Fellows (CUTF) Seminars"],
  ["usie", "Undergraduate Student Initiated Education (USIE) Seminars"],
  ["law", "Law Classes"], ["online", "Online - Classes Not Recorded"],
  ["onlinerecorded", "Online - Classes Recorded"],
  ["onlineasynchronous", "Online - Asynchronous"]
] as const;
const COMMON = [["subject", "Subject"], ["instructor", "Instructor"], ["geclass", "GE"]] as const;
const FIELD_LABELS: Record<string, string> = {
  "Subject Area": "Subject",
  "Catalog Number or Class Title (Required)": "Course number or title (required)",
  "Instructor's Last Name": "Instructor’s last name",
  "Subject Area or Catalog Number or Class Title (Required)": "Subject or course (required)",
  "Subject Area, Catalog Number or Class Title (Required)": "Subject or course (required)",
  "Category (Required)": "Category (required)"
};
function supportedOption(option: HTMLOptionElement): boolean {
  return OPTIONS.some(([value, label]) => option.value === value && option.textContent?.trim() === label);
}
function optionSignature(select: HTMLSelectElement): string {
  return JSON.stringify([...select.options].map(option => [option.value, option.textContent?.trim(), option.disabled]));
}

interface SearchControls {
  widget: HTMLElement;
  controls: HTMLElement;
  typePanel: HTMLElement;
  select: HTMLSelectElement;
  fields: HTMLInputElement[];
  go: HTMLInputElement;
}

function readControls(doc: Document): SearchControls | null {
  const widgets = doc.querySelectorAll<HTMLElement>(WIDGET);
  if (widgets.length !== 1) return null;
  const widget = widgets[0];
  const controls = widget.querySelector<HTMLElement>(":scope > .ClassSearchControls");
  const typePanel = widget.querySelector<HTMLElement>(".searchType");
  const select = typePanel?.querySelector<HTMLSelectElement>(`select#${SEARCH_ID}.searchBy`);
  const fields = [...widget.querySelectorAll<HTMLInputElement>(".searchFields > input.ClassSearchBox")];
  const go = widget.querySelector<HTMLInputElement>(`.goPanel input#${GO_ID}.csGoButton`);
  const form = doc.getElementById("aspnetForm");
  if (!controls || !typePanel || !select || !go || !form || form.tagName !== "FORM") return null;
  const nativeForm = form as HTMLFormElement;
  const url = new URL(nativeForm.action, doc.location.href);
  if (url.origin !== "https://be.my.ucla.edu" || url.pathname !== "/ClassPlanner/ClassPlan.aspx" || nativeForm.method.toLowerCase() !== "post") return null;
  if (select.form !== nativeForm || go.form !== nativeForm || go.type !== "submit" || go.value !== "Go" || ["formaction", "formmethod", "formenctype", "onclick"].some(name => go.hasAttribute(name))) return null;
  if (fields.length !== 3 || fields.some((field, index) => field.id !== `searchTier${index}` || field.type !== "text" || field.form !== nativeForm)) return null;
  // Retain the established native contract. Every option stays in the original
  // visible selector, including term-specific choices we do not interpret.
  if (COMMON.some(([value]) => {
    const matches = [...select.options].filter(option => option.value === value);
    return matches.length !== 1 || !supportedOption(matches[0]);
  })) return null;
  if (new Set([...select.options].map(option => option.value)).size !== select.options.length) return null;
  if (![...select.options].some(option => option.value === select.value && !option.disabled)) return null;
  return { widget, controls, typePanel, select, fields, go };
}

interface MountedSearch extends SearchControls {
  labels: HTMLLabelElement[];
  submit: HTMLElement;
  goAria: string | null;
  selectAria: string | null;
  hint: HTMLElement;
  options: string;
  observer: MutationObserver;
  sync: () => void;
}

export class ClassSearchPresentation {
  private mounted: MountedSearch | null = null;

  needsReconcile(doc: Document): boolean {
    const next = readControls(doc);
    const state = this.mounted;
    if (!next || !state) return !!next !== !!state;
    return next.widget !== state.widget || next.select !== state.select || next.go !== state.go || next.fields.some((field, index) => field !== state.fields[index]) || optionSignature(next.select) !== state.options || state.labels.some(label => !next.widget.contains(label)) || !state.submit.contains(next.go);
  }

  reconcile(doc: Document): void {
    const next = readControls(doc);
    if (!next || this.needsReconcile(doc)) {
      this.restore();
      if (next) this.mount(next);
    } else this.mounted?.sync();
  }

  restore(): void {
    const state = this.mounted;
    if (!state) return;
    this.mounted = null;
    state.observer.disconnect();
    state.select.removeEventListener("change", state.sync);
    state.labels.forEach(label => label.remove());
    if (state.selectAria === null) state.select.removeAttribute("aria-label");
    else state.select.setAttribute("aria-label", state.selectAria);
    state.hint.remove();
    // Native redraws may replace Go inside this wrapper. Restore the live
    // native children rather than removing them with our presentation shell.
    for (const child of [...state.submit.childNodes]) {
      if (!(child instanceof Element) || !child.hasAttribute(OWNED)) state.submit.before(child);
    }
    state.submit.remove();
    if (state.goAria === null) state.go.removeAttribute("aria-label");
    else state.go.setAttribute("aria-label", state.goAria);
    state.widget.classList.remove("pl-search-widget");
    delete state.widget.dataset.plSearchFields;
  }

  private mount(native: SearchControls): void {
    const { widget, controls, select, fields, go } = native;
    const doc = widget.ownerDocument;
    const owned = <T extends HTMLElement>(node: T, className: string): T => {
      node.className = className;
      node.setAttribute(OWNED, "true");
      return node;
    };
    // Native mode selection stays in its original position and keeps every
    // available option. Mounting never forwards changes or submits a query.
    const selectAria = select.getAttribute("aria-label");
    if (!selectAria) select.setAttribute("aria-label", "Search by");
    const labels = fields.map(field => {
      const label = owned(doc.createElement("label"), "pl-search-field-label");
      label.htmlFor = field.id;
      field.before(label);
      return label;
    });
    const submit = doc.createElement("span");
    submit.className = "pl-search-submit";
    go.before(submit);
    const caption = owned(doc.createElement("span"), "pl-search-submit-label");
    caption.textContent = "Search classes";
    caption.setAttribute("aria-hidden", "true");
    submit.append(go, caption);
    const goAria = go.getAttribute("aria-label");
    go.setAttribute("aria-label", "Search classes");
    widget.classList.add("pl-search-widget");
    const hint = owned(doc.createElement("p"), "pl-search-hint");
    hint.setAttribute("role", "status");
    hint.setAttribute("aria-live", "polite");
    controls.after(hint);
    const sync = () => {
      fields.forEach((field, index) => {
        const labelText = field.getAttribute("aria-label") || "";
        const label = labels[index];
        label.hidden = !labelText || /^unused for this search type$/i.test(labelText) || field.style.display === "none" || field.hidden || field.classList.contains("hidden");
        const readable = FIELD_LABELS[labelText] || labelText;
        if (label.textContent !== readable) label.textContent = readable;
        label.title = labelText;
      });
      widget.dataset.plSearchFields = String(labels.filter(label => !label.hidden).length);
      const message = go.disabled ? "Choose a dropdown suggestion in each required field." : "";
      if (hint.textContent !== message) hint.textContent = message;
      hint.hidden = !go.disabled;
    };
    const observer = new MutationObserver(sync);
    fields.forEach(field => observer.observe(field, { attributes: true, attributeFilter: ["aria-label", "placeholder", "style", "hidden", "class"] }));
    observer.observe(select, { attributes: true, attributeFilter: ["disabled"] });
    observer.observe(go, { attributes: true, attributeFilter: ["disabled"] });
    select.addEventListener("change", sync);
    this.mounted = { ...native, labels, submit, goAria, selectAria, observer, sync, hint, options: optionSignature(select) };
    sync();
  }
}
