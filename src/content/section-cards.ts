const OWNED = "data-planner-lift-owned";
const LABELS = ["Change", "Section", "Status", "Info", "Days", "Time", "Location", "Units", "Instructor"];
interface Mark { node: HTMLElement; className: string | null; added: string; field: string | null; }

/** Presentation only. Native cells, controls, values and row ancestry stay put. */
export class SectionCards {
  private marks: Mark[] = [];
  private labels: HTMLElement[] = [];

  private mark(node: HTMLElement, className: string, field?: number): void {
    this.marks.push({node,className:node.getAttribute("class"),added:className,field:node.getAttribute("data-pl-field")});
    node.classList.add(className);
    if (field !== undefined) {
      node.dataset.plField = String(field);
      // Preserve the native status cell contents byte-for-byte.
      if (field === 0 || field === 2 || field === 3) return;
      const label = node.ownerDocument.createElement("span");
      label.className = "pl-section-label"; label.textContent = LABELS[field];
      label.setAttribute(OWNED, "true"); node.append(label); this.labels.push(label);
    }
  }

  table(table: HTMLTableElement): boolean {
    const rows = [...table.rows];
    const header = rows.find(row=>row.cells.length === 9 && [...row.cells].every(cell=>cell.tagName === "TH"));
    if (!header || [...header.cells].some((cell,i)=>cell.textContent?.trim() !== LABELS[i])) return false;
    const data = rows.filter(row=>row.cells.length === 9 && [...row.cells].every(cell=>cell.tagName === "TD" && cell.colSpan === 1 && cell.rowSpan === 1) && row.style.display !== "none");
    if (!data.length) return false;
    this.mark(table,"pl-section-table"); this.mark(header,"pl-section-heading");
    for (const row of data) { this.mark(row,"pl-section-card"); [...row.cells].forEach((cell,i)=>this.mark(cell,"pl-section-field",i)); }
    return true;
  }

  static knownResultRows(body: HTMLElement): HTMLElement[] | null {
    const rows = [...body.querySelectorAll<HTMLElement>(".row-fluid.class-info.table-width2")];
    if (!rows.length || !rows.some(row=>row.classList.contains("data_row"))) return null;
    if (rows.some(row=>row.children.length !== 9 || [...row.children].some((cell,i)=>!cell.classList.contains(`span${i+1}`)))) return null;
    const headers = rows.filter(row=>row.classList.contains("header-row"));
    if (headers.length !== 1 || [...headers[0].children].some((cell,i)=>cell.textContent?.trim() !== (i === 0 ? "Select" : LABELS[i]))) return null;
    return rows;
  }

  results(body: HTMLElement): boolean {
    const rows = SectionCards.knownResultRows(body);
    if (!rows) return false;
    for (const row of rows) {
      if (row.classList.contains("header-row")) this.mark(row,"pl-section-heading");
      else if (row.classList.contains("data_row")) {
        this.mark(row,"pl-section-card");
        [...row.children].forEach((cell,i)=>this.mark(cell as HTMLElement,"pl-section-field",i));
      }
    }
    return true;
  }

  needsRefresh(): boolean { return this.marks.some(mark=>!mark.node.isConnected); }

  restore(): void {
    this.labels.forEach(label=>label.remove()); this.labels=[];
    for (const mark of this.marks.reverse()) {
      const original = (mark.className || "").split(/\s+/).filter(Boolean);
      if (!original.includes(mark.added)) mark.node.classList.remove(mark.added);
      // Keep native class updates made while the inspector was open.
      if ([...mark.node.classList].join(" ") === original.join(" ")) {
        if (mark.className === null) mark.node.removeAttribute("class"); else mark.node.setAttribute("class",mark.className);
      }
      if (mark.field === null) mark.node.removeAttribute("data-pl-field"); else mark.node.setAttribute("data-pl-field",mark.field);
    }
    this.marks=[];
  }
}
