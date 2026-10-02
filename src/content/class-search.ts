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
const GROUPS = [
  { title: "Course details", choices: [["units", "Units"], ["classidnumber", "Class ID"]] },
  { title: "Requirements", choices: [["writing2", "Writing II"], ["diversity", "Diversity"], ["collegehonors", "College honors"]] },
  { title: "Programs", choices: [["fiatlux", "Fiat Lux"], ["service", "Community-engaged learning"], ["cutf", "CUTF seminars"], ["usie", "USIE seminars"], ["law", "Law"]] },
  { title: "Format", choices: [["online", "Online · not recorded"], ["onlinerecorded", "Online · recorded"], ["onlineasynchronous", "Online · asynchronous"]] }
];
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
  // Search offerings differ by term. Only the exact mappings our common actions
  // need are required; every other native option remains intact, even unknown ones.
  if (COMMON.some(([value]) => {
    const matches = [...select.options].filter(option => option.value === value);
    return matches.length !== 1 || !supportedOption(matches[0]);
  })) return null;
  if (new Set([...select.options].map(option => option.value)).size !== select.options.length) return null;
  if (![...select.options].some(option => option.value === select.value && !option.disabled)) return null;
  return { widget, controls, typePanel, select, fields, go };
}

interface MountedSearch extends SearchControls {
  nav: HTMLElement;
  more: HTMLDetailsElement;
  summary: HTMLElement;
  labels: HTMLLabelElement[];
  submit: HTMLElement;
  goAria: string | null;
  typeAnchor: Comment;
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
    return next.widget !== state.widget || next.select !== state.select || next.go !== state.go || next.fields.some((field, index) => field !== state.fields[index]) || optionSignature(next.select) !== state.options || !next.widget.contains(state.nav);
  }

  reconcile(doc: Document): void {
    const next = readControls(doc);
    if (!next || next.widget !== this.mounted?.widget || next.select !== this.mounted.select || next.go !== this.mounted.go || next.fields.some((field, i) => field !== this.mounted!.fields[i]) || optionSignature(next.select) !== this.mounted.options || !next.widget.contains(this.mounted.nav)) {
      this.restore();
      if (next) this.mount(next);
    } else this.mounted.sync();
  }

  restore(): void {
    const state = this.mounted;
    if (!state) return;
    this.mounted = null;
    state.observer.disconnect();
    state.select.removeEventListener("change", state.sync);
    state.labels.forEach(label => label.remove());
    // Restore the exact position before removing a navigation wrapper that
    // contains the native dropdown. Such wrappers must never be marked owned.
    if (state.typeAnchor.parentNode && state.more.contains(state.typePanel)) state.typeAnchor.replaceWith(state.typePanel);
    else state.typeAnchor.remove();
    state.typePanel.classList.remove("pl-search-native-hidden");
    state.nav.remove();
    state.hint.remove();
    if (state.submit.contains(state.go)) state.submit.before(state.go);
    state.submit.remove();
    if (state.goAria === null) state.go.removeAttribute("aria-label");
    else state.go.setAttribute("aria-label", state.goAria);
    state.widget.classList.remove("pl-search-widget");
    delete state.widget.dataset.plSearchFields;
  }

  private mount(native: SearchControls): void {
    const { widget, controls, typePanel, select, fields, go } = native;
    const doc = widget.ownerDocument;
    const owned = <T extends HTMLElement>(node: T, className: string): T => {
      node.className = className;
      node.setAttribute(OWNED, "true");
      return node;
    };
    const nav = doc.createElement("div");
    nav.className = "pl-search-nav";
    nav.setAttribute("role", "group");
    nav.setAttribute("aria-label", "Search classes by");
    const more = doc.createElement("details");
    more.className = "pl-search-more";
    const summary = owned(doc.createElement("summary"), "pl-search-more-label");
    more.append(summary);
    const buttonFor = (value: string, label: string) => {
      const button = owned(doc.createElement("button"), "pl-search-choice");
      button.type = "button";
      button.dataset.plSearchMode = value;
      button.textContent = label;
      button.addEventListener("click", () => {
        const fresh = readControls(doc);
        const option = fresh && [...fresh.select.options].find(option => option.value === value);
        if (!fresh || fresh.widget !== widget || fresh.select !== select || select.disabled || !option || option.disabled || !supportedOption(option)) return;
        more.open = false;
        if (select.value === value) return;
        // One explicit user choice, forwarded to MyUCLA's own mode-change handler.
        // Never submit a query or trigger Add/Enroll on behalf of the user.
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return button;
    };
    for (const [value, label] of COMMON) nav.append(buttonFor(value, label));
    const menu = owned(doc.createElement("div"), "pl-search-groups");
    for (const group of GROUPS) {
      const choices = group.choices.filter(([value]) => [...select.options].some(option => option.value === value && supportedOption(option)));
      if (!choices.length) continue;
      const section = doc.createElement("div");
      const heading = doc.createElement("h3");
      heading.textContent = group.title;
      section.append(heading, ...choices.map(([value, label]) => buttonFor(value, label)));
      menu.append(section);
    }
    more.append(menu);
    const typeAnchor = doc.createComment("planner-lift-search-type-position");
    typePanel.before(typeAnchor);
    more.append(typePanel);
    typePanel.classList.toggle("pl-search-native-hidden", [...select.options].every(supportedOption));
    nav.append(more);
    controls.prepend(nav);
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
      const common = COMMON.some(([value]) => value === select.value);
      const selected = select.selectedOptions[0]?.textContent?.trim() || "";
      const caption = common ? "More searches" : `More searches · ${selected}`;
      if (summary.textContent !== caption) summary.textContent = caption;
      nav.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.plSearchMode === select.value));
        const option = [...select.options].find(option => option.value === button.dataset.plSearchMode);
        button.disabled = select.disabled || !option || option.disabled || !supportedOption(option);
      });
      fields.forEach((field, index) => {
        const labelText = field.getAttribute("aria-label") || "";
        const label = labels[index];
        label.hidden = !labelText || /^unused for this search type$/i.test(labelText) || field.style.display === "none";
        const readable = FIELD_LABELS[labelText] || labelText;
        if (label.textContent !== readable) label.textContent = readable;
        label.title = labelText;
      });
      widget.dataset.plSearchFields = String(labels.filter(label => !label.hidden).length);
      const message = go.disabled ? "Choose dropdown suggestions in the required fields to enable Search classes." : "Ready to search.";
      if (hint.textContent !== message) hint.textContent = message;
    };
    const observer = new MutationObserver(sync);
    fields.forEach(field => observer.observe(field, { attributes: true, attributeFilter: ["aria-label", "placeholder", "style"] }));
    observer.observe(select, { attributes: true, attributeFilter: ["disabled"] });
    observer.observe(go, { attributes: true, attributeFilter: ["disabled"] });
    select.addEventListener("change", sync);
    this.mounted = { ...native, nav, more, summary, labels, submit, goAria, observer, sync, typeAnchor, hint, options: optionSignature(select) };
    sync();
  }
}
