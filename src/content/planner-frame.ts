/** Quiet visual hierarchy; no changes to section visibility or page actions. */
const TITLES = ["plannerSectionCal", "classOptimizerTitle", "classSearchTitle", "plannerSectionClip", "plannerSectionEnip", "plannerSectionPer"];
export function tidyPlannerFrame(doc: Document): void {
  if (!doc.querySelector(".classPlannerWrapper > #ctl00_MainContent_classPlanPanel")) return;
  doc.documentElement.classList.add("pl-calm-page");
  TITLES.forEach(id => {
    const title = doc.getElementById(id);
    if (title?.classList.contains("classPlanner_SectionTitle")) title.classList.add("pl-calm-title");
  });
}
export function restorePlannerFrame(doc: Document): void {
  doc.documentElement.classList.remove("pl-calm-page");
  doc.querySelectorAll(".pl-calm-title").forEach(title => title.classList.remove("pl-calm-title"));
}
