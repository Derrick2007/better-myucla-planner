/**
 * A visual playground only. This entry is never part of content.js or the
 * extension. It reuses production presentation code against invented markup;
 * the live adapter, storage, session bridge and account actions are not loaded.
 */
import type { CourseSnapshot } from "../adapters/planner-adapter";
import { ClassSearchPresentation } from "../content/class-search";
import { PlannerWorkspace } from "../content/planner-workspace";
import { tidyPlannerFrame } from "../content/planner-frame";
import { applyHeadline, markHeaderRows, tidyExamDetails, tidyWeekGrid } from "../content/page-polish";

const form = document.querySelector<HTMLFormElement>("#aspnetForm");
const root = document.querySelector<HTMLElement>("#div_landing > table");
if (!form || !root || document.documentElement.dataset.plFictionalPreview !== "true") {
  throw new Error("The fictional preview fixture is missing.");
}

let feedbackTimer = 0;
function feedback(message: string): void {
  const region = document.getElementById("preview-feedback");
  if (!region) return;
  window.clearTimeout(feedbackTimer);
  region.textContent = message;
  region.hidden = false;
  feedbackTimer = window.setTimeout(() => { region.hidden = true; }, 5500);
}
const unavailable = () => feedback("Fictional preview only. Account actions are available on MyUCLA with the extension.");
const sectionHelp = () => feedback("Sample section information. Status, units and instructors are fictional.");

// This handler is installed before production presentation is mounted. CSP
// form-action 'none' also blocks programmatic submission if a handler fails.
document.addEventListener("submit", event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event instanceof SubmitEvent && event.submitter?.id === "ctl00_MainContent_cs_goButton") {
    simulateSearch();
  } else unavailable();
}, true);
// Every fixture link is inert, including same-document hashes (no page jumps).
document.addEventListener("click", event => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest("a")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const heading = event.target.closest(".CourseListEntry .class-title a");
    const body = heading?.closest(".CourseListEntry")?.nextElementSibling;
    if (body instanceof HTMLElement && body.id.startsWith("container_course_")) {
      body.hidden = !body.hidden;
      body.style.display = body.hidden ? "none" : "";
    } else unavailable();
  }
}, true);

const originalButtons = [...document.querySelectorAll<HTMLButtonElement>("button")];
originalButtons.forEach(button => {
  button.type = "button";
  button.addEventListener("click", () => {
    if (button.closest(".classPlanner_SectionTitle")) return;
    if (button.hasAttribute("data-fixture-optimizer-help")) {
      document.getElementById("panelOptimizer")?.classList.toggle("hidden");
      return;
    }
    const module = button.dataset.fixtureModuleAction;
    if (module) {
      const output = button.closest("[data-fixture-module]")?.querySelector("output");
      if (output) output.textContent = `Sample ${module} preview ready. No account data is changed.`;
      return;
    }
    const calendarToggle = /^(studylist|plan|alternates)(Check|Uncheck)$/.exec(button.id);
    if (calendarToggle) {
      const category = calendarToggle[1];
      const toolbar = button.closest(".plannerMenuLinks");
      const visible = !toolbar?.classList.contains(`${category}Checked`);
      toolbar?.classList.toggle(`${category}Checked`, visible);
      document.querySelectorAll<HTMLElement>(`[data-preview-calendar-category="${category}"]`)
        .forEach(meeting => { meeting.hidden = !visible; });
      feedback(`Sample ${category === "studylist" ? "study list" : category} meetings ${visible ? "shown" : "hidden"}.`);
      return;
    }
    if (button.closest(".plannerMenuLinks")) {
      feedback("Sample calendar display. The installed extension keeps UCLA’s complete calendar controls.");
      return;
    }
    if (button.closest(".header-row")) {
      sectionHelp();
      return;
    }
    unavailable();
  });
});

const mode = document.querySelector<HTMLSelectElement>("#ctl00_MainContent_cs_searchBy")!;
const fields = [0, 1, 2].map(index => document.getElementById(`searchTier${index}`) as HTMLInputElement);
const go = document.querySelector<HTMLInputElement>("#ctl00_MainContent_cs_goButton")!;
const resultList = document.querySelector<HTMLElement>(".ClassSearchList")!;
const originalResults = resultList.innerHTML;
const resultContainer = resultList.cloneNode(false) as HTMLElement;
const search = new ClassSearchPresentation();
const workspace = new PlannerWorkspace();
const courses: CourseSnapshot[] = [...root.querySelectorAll<HTMLElement>(":scope > tbody.courseItem")].map(node => ({
  id: [...node.classList].find(value => /^Class\d+$/.test(value))!.slice(5),
  label: node.querySelector(".SubjectAreaName_ClassName")?.textContent?.replace(/\s+/g, " ").trim() || "Sample course",
  node
}));

function configureSearch(): void {
  const primary = mode.value === "instructor" ? "Instructor's Last Name"
    : mode.value === "geclass" ? "General Education Area"
    : mode.value === "classidnumber" ? "Class ID" : "Subject Area";
  const secondary = mode.value === "instructor" ? "Subject Area or Catalog Number or Class Title (Required)"
    : mode.value === "geclass" ? "Category (Required)" : "Catalog Number or Class Title (Required)";
  fields.forEach((field, index) => {
    field.value = "";
    field.style.display = index === 2 || (index === 1 && mode.value === "classidnumber") ? "none" : "";
    const label = index === 0 ? primary : index === 1 ? secondary : "unused for this search type";
    field.setAttribute("aria-label", label);
    field.placeholder = `Enter ${label}`;
  });
  go.disabled = false;
  search.reconcile(document);
  feedback("Preview search filters the three sample courses locally. Live UCLA search keeps its own required selections and loading.");
}

function simulateSearch(): void {
  // Only invented fixture text is read here, never a real UCLA query.
  const query = fields.filter(field => field.style.display !== "none")
    .map(field => field.value.trim()).filter(Boolean).join(" ").toLowerCase();
  const holder = document.createElement("div");
  holder.innerHTML = originalResults;
  let count = 0;
  holder.querySelectorAll<HTMLElement>(".CourseListEntry").forEach(entry => {
    const body = entry.nextElementSibling;
    const text = `${entry.textContent} ${body?.textContent}`.toLowerCase();
    const visible = !query || query.split(/\s+/).every(word => text.includes(word));
    if (visible) count++;
    else { body?.remove(); entry.remove(); }
  });
  const replacement = resultContainer.cloneNode(false) as HTMLElement;
  if (count) replacement.append(...holder.childNodes);
  else {
    const empty = document.createElement("p");
    empty.className = "preview-empty";
    empty.textContent = "No sample courses match. Try 101, 102, 103 or leave the fields blank.";
    replacement.append(empty);
  }
  const active = document.querySelector(".ClassSearchList");
  active?.replaceWith(replacement);
  // Reconcile only the new result presentation; no native action or request.
  workspace.reconcile(document, courses);
  document.getElementById("resultHeaderDiv")!.textContent = `${count} sample ${count === 1 ? "course" : "courses"} · local preview`;
  replacement.querySelector<HTMLButtonElement>("#fixture-result-footer button")?.addEventListener("click", unavailable);
  replacement.querySelectorAll<HTMLButtonElement>(".header-row button").forEach(button => button.addEventListener("click", sectionHelp));
  feedback(`${count} sample ${count === 1 ? "course" : "courses"} shown. No network request was made.`);
}

mode.addEventListener("change", configureSearch);
go.disabled = false;
fields[0].value = "";
fields[1].value = "";
fields[0].placeholder = "Try Example or leave blank";
fields[1].placeholder = "Try 101, 102 or 103";
document.querySelector<HTMLSelectElement>("#ctl00_MainContent_termSessionChooser_TermChooser")!
  .addEventListener("change", () => feedback("Quarter changed in the fictional preview. The installed extension loads that quarter through UCLA."));
document.querySelectorAll<HTMLElement>("#gridDiv .planneritembox").forEach(meeting => {
  meeting.dataset.previewCalendarCategory = meeting.style.borderStyle === "double" ? "studylist" : "plan";
  meeting.tabIndex = 0;
  meeting.setAttribute("role", "button");
  meeting.addEventListener("click", () => feedback("Sample meeting. The installed extension preserves UCLA’s meeting interactions."));
  meeting.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); meeting.click(); }
  });
});

root.classList.add("pl-plan-root");
search.reconcile(document);
tidyPlannerFrame(document);
markHeaderRows(root);
tidyExamDetails(root);
tidyWeekGrid(document);
courses.forEach(course => {
  const label = course.node.querySelector<HTMLElement>(".SubjectAreaName_ClassName");
  if (label) applyHeadline(label);
});
workspace.setHeaderCompact(true);
workspace.reconcile(document, courses);

// Production navigation owns the switch. No duplicate preview navigation.
document.querySelector<HTMLButtonElement>('button[data-pl-module="find"]')?.click();
document.documentElement.dataset.plPreviewReady = "true";

document.getElementById("preview-about")?.addEventListener("click", () => {
  feedback("Same production layout code and stylesheet; fictional content. Search is local. Account actions, notes, drag/save and session features are unavailable.");
});
