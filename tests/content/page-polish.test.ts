// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  applyHeadline,
  markHeaderRows,
  readHeadline,
  restoreExamDetails,
  restoreHeadline,
  restoreSectionStatuses,
  restoreWeekGrid,
  tidyWeekGrid,
  tidyExamDetails,
  unmarkHeaderRows
} from "../../src/content/page-polish";

/** The two-paragraph title cell recorded in docs/MYUCLA_CONTRACT.md. */
function titleCell(head: string, body: string): HTMLElement {
  // A bare <td> is discarded by the parser, so it has to live in a table.
  document.body.innerHTML = `<table><tbody class="courseItem"><tr>
      <td class="SubjectAreaName_ClassName">
        <p>${head}</p>
        <p>${body}</p>
      </td>
    </tr></tbody></table>`;
  return document.querySelector<HTMLElement>("td.SubjectAreaName_ClassName")!;
}

describe("course headline", () => {
  it("reads the code a student actually scans for", () => {
    const host = titleCell("Class 15: Management", "170 - Real Estate Finance and Investments");
    expect(readHeadline(host)).toEqual({
      code: "Management 170",
      title: "Real Estate Finance and Investments",
      ordinal: "15"
    });
  });

  it("keeps a title that contains its own dash", () => {
    const host = titleCell("Class 2: Physics", "1B - Waves - and Oscillations");
    expect(readHeadline(host)?.title).toBe("Waves - and Oscillations");
  });

  it("refuses to rearrange a shape it does not recognise", () => {
    expect(readHeadline(titleCell("Management", "Real Estate Finance"))).toBeNull();
    expect(readHeadline(titleCell("Class 15: Management", "Real Estate Finance"))).toBeNull();

    const host = titleCell("Class 15: Management", "Real Estate Finance");
    expect(applyHeadline(host)).toBe(false);
    expect(host.classList.contains("pl-titled")).toBe(false);
    expect(host.querySelector("[data-pl-headline]")).toBeNull();
  });

  it("hides MyUCLA's paragraphs rather than rewriting them", () => {
    const host = titleCell("Class 15: Management", "170 - Real Estate Finance and Investments");
    expect(applyHeadline(host)).toBe(true);

    const paragraphs = [...host.querySelectorAll("p")].filter(
      (node) => !node.hasAttribute("data-planner-lift-owned")
    );
    expect(paragraphs.map((node) => node.textContent)).toEqual([
      "Class 15: Management",
      "170 - Real Estate Finance and Investments"
    ]);
    expect(host.querySelector(".pl-code")?.textContent).toBe("Management 170");
    expect(host.querySelector(".pl-course-title")?.textContent).toBe(
      "Real Estate Finance and Investments"
    );

    // Re-running must not stack a second headline.
    applyHeadline(host);
    expect(host.querySelectorAll("[data-pl-headline]")).toHaveLength(1);

    restoreHeadline(document);
    expect(host.querySelector("[data-pl-headline]")).toBeNull();
    expect(host.classList.contains("pl-titled")).toBe(false);
  });
});

/** One absolutely positioned meeting block from MyUCLA's weekly grid. */
function grid(inner: string): HTMLElement {
  document.body.innerHTML = `<div id="gridDiv"><div class="timebox">
    <div class="planneritembox">${inner}</div>
  </div></div>`;
  return document.querySelector<HTMLElement>(".planneritembox")!;
}

describe("weekly grid", () => {
  const BLOCK =
    'ENGR 216<br class="hide-small"><span class="hide-above-small"> &middot; </span>' +
    'Lec 1<br class="hide-small"><span class="hide-above-small"> &middot; </span>' +
    '<span class="icon-warning-sign planConflict"></span>Physics and Astronomy Building 1425';

  it("turns each run into its own line and keeps the full string reachable", () => {
    const block = grid(BLOCK);
    expect(tidyWeekGrid(document)).toBe(1);

    const lines = [...block.querySelectorAll(".pl-gridline")].map((n) => n.textContent);
    expect(lines).toEqual(["ENGR 216", "Lec 1", "Physics and Astronomy Building 1425"]);
    expect(block.title).toContain("Physics and Astronomy Building 1425");
    // MyUCLA's own responsive markup is left in place.
    expect(block.querySelectorAll("br.hide-small")).toHaveLength(2);
    expect(block.querySelector(".planConflict")).not.toBeNull();
  });

  it("never wraps the same block twice", () => {
    grid(BLOCK);
    tidyWeekGrid(document);
    expect(tidyWeekGrid(document)).toBe(0);
    expect(document.querySelectorAll(".pl-gridline")).toHaveLength(3);
  });

  it("leaves an unfamiliar block alone", () => {
    const block = grid("Something else entirely");
    expect(tidyWeekGrid(document)).toBe(0);
    expect(block.querySelectorAll(".pl-gridline")).toHaveLength(0);
    expect(block.getAttribute("data-pl-grid")).toBe("skipped");
  });

  it("puts the block back exactly as MyUCLA wrote it", () => {
    const block = grid(BLOCK);
    const before = block.innerHTML;
    tidyWeekGrid(document);
    restoreWeekGrid(document);
    expect(block.innerHTML).toBe(before);
    expect(block.hasAttribute("data-pl-grid")).toBe(false);
    expect(block.title).toBe("");
  });
});

describe("section table headers", () => {
  function plan(columns: number): HTMLElement {
    const cells = (tag: string, text: string) =>
      Array.from({ length: columns }, (_, i) => `<${tag}>${text}${i}</${tag}>`).join("");
    document.body.innerHTML = `<table id="root">
      <tbody class="courseItem"><tr><td><table class="coursetable">
        <tr>${cells("th", "H")}</tr>
        <tr>${cells("td", "D")}</tr>
        <tr><td colspan="${columns}">Plan Actions</td></tr>
      </table></td></tr></tbody>
    </table>`;
    return document.querySelector<HTMLElement>("#root")!;
  }

  it("marks only the all-header row, and shares a grid at nine columns", () => {
    const root = plan(9);
    markHeaderRows(root);
    const rows = [...root.querySelectorAll("table.coursetable tr")];
    expect(rows.filter((r) => r.classList.contains("pl-thead"))).toHaveLength(1);
    expect(rows[0].classList.contains("pl-thead")).toBe(true);
    expect(root.querySelector("table.coursetable")?.classList.contains("pl-cols-9")).toBe(true);
    expect(root.querySelectorAll("colgroup[data-pl-columns] > col")).toHaveLength(9);
    markHeaderRows(root);
    expect(root.querySelectorAll("colgroup[data-pl-columns]")).toHaveLength(1);
    unmarkHeaderRows(document);
    expect(root.querySelector("colgroup")).toBeNull();
  });

  it("leaves the automatic layout alone when the shape is different", () => {
    const root = plan(7);
    markHeaderRows(root);
    expect(root.querySelector("table.coursetable")?.classList.contains("pl-cols-9")).toBe(false);
    // The single-cell "Plan Actions" row is not a header.
    expect(root.querySelectorAll("tr.pl-thead")).toHaveLength(1);

    unmarkHeaderRows(document);
    expect(root.querySelectorAll("tr.pl-thead")).toHaveLength(0);
  });

  it("preserves an existing native column layout", () => {
    const root = plan(9);
    const table = root.querySelector("table.coursetable")!;
    const columns = document.createElement("colgroup");
    columns.innerHTML = '<col style="width: 20%">';
    table.prepend(columns);
    markHeaderRows(root);
    expect(table.classList.contains("pl-cols-9")).toBe(false);
    expect(table.querySelector("[data-pl-columns]")).toBeNull();
    unmarkHeaderRows(document);
    expect(table.firstElementChild).toBe(columns);
  });
});

describe("exam advisories", () => {
  it("folds the advisory while preserving original content and conflict controls", () => {
    document.body.innerHTML = `<div id="root"><div class="final_exam_info">
      <span>Final Exam:</span><span>Monday December 7, 2026 8am-11am<br>Check back on Monday for final exam location<br></span>
      <a data-content="conflict">Warning</a></div></div>`;
    const root = document.getElementById("root")!;
    const before = root.innerHTML;
    const native = root.querySelectorAll(".final_exam_info > span")[1];
    const warning = root.querySelector("a");
    tidyExamDetails(root);
    tidyExamDetails(root);
    expect(root.querySelectorAll("[data-pl-exam-details]")).toHaveLength(1);
    expect(root.querySelector("details")?.open).toBe(false);
    expect(root.querySelector("details p")?.textContent).toBe("Check back on Monday for final exam location");
    expect(root.querySelectorAll(".final_exam_info > span")[1]).toBe(native);
    expect(root.querySelector("a")).toBe(warning);
    restoreExamDetails(document);
    expect(root.innerHTML).toBe(before);
  });

  it("leaves unfamiliar markup and interactive notices intact", () => {
    document.body.innerHTML = `<div id="root"><div class="final_exam_info">
      <span>Final Exam:</span><span>Monday 8am<br><a href="#room">Room</a></span>
      </div></div>`;
    const root = document.getElementById("root")!;
    const before = root.innerHTML;
    tidyExamDetails(root);
    expect(root.innerHTML).toBe(before);
  });
});

describe("legacy status restoration", () => {
  it("unwraps the same native status nodes and removes the retired summary", () => {
    document.body.innerHTML = '<table><tr><td class="native-status pl-status-cell pl-status-dismissed"><span data-pl-status-original><i class="icon-unlock"></i>Waitlist<br>1 of 8 Taken</span><span data-pl-section-status>Waitlist summary</span></td></tr></table>';
    const icon = document.querySelector("i");
    restoreSectionStatuses(document);
    expect(document.querySelector("td")!.innerHTML).toBe('<i class="icon-unlock"></i>Waitlist<br>1 of 8 Taken');
    expect(document.querySelector("td")!.className).toBe("native-status");
    expect(document.querySelector("i")).toBe(icon);
    restoreSectionStatuses(document);
    expect(document.querySelector("i")).toBe(icon);
  });
});
