/** Sanitized search structure; the field contents and server are fictional. */
import { calendarFixtureHtml } from "./calendar-fixture.mjs";
export const searchOptions = [
  ["subject", "Subject Area"], ["units", "Class Units"], ["classidnumber", "Class ID"],
  ["instructor", "Instructor"], ["geclass", "General Education (GE) Classes"],
  ["writing2", "Writing II Classes"], ["diversity", "Diversity Classes"],
  ["collegehonors", "College Honors Classes"], ["fiatlux", "Fiat Lux Classes"],
  ["service", "Community-Engaged Learning Classes"],
  ["cutf", "Collegium of University Teaching Fellows (CUTF) Seminars"],
  ["usie", "Undergraduate Student Initiated Education (USIE) Seminars"],
  ["law", "Law Classes"], ["online", "Online - Classes Not Recorded"],
  ["onlineasynchronous", "Online - Asynchronous"]
];
// Public search labels observed on a second term, without any account content.
export const recordedSearchOptions = searchOptions.filter(([value]) => value !== "cutf");
recordedSearchOptions.splice(recordedSearchOptions.length - 1, 0, ["onlinerecorded", "Online - Classes Recorded"]);

// Public native layout constraints observed on the Class Planner, recreated
// without a real page or query. Clearfix pseudo-elements become grid items if
// the extension changes .row to grid, and native panel widths can shrink each
// grid cell a second time. Keep these in every fixture that hosts search.
export const nativeSearchLayoutCss = `
  .ClassSearchControls.row::before,
  .ClassSearchControls.row::after { content:""; display:table; }
  .ClassSearchControls.row .searchType.panel-5 { width:40.17094017094017%; }
  .ClassSearchControls.row .searchFieldPanel.panel-7 { width:57.26495726495726%; margin-left:8px; }
  .ClassSearchControls.row .searchFields.panel-10 { width:82.90598290598291%; }
  /* Reproduce the native button theme that otherwise overrides the extension. */
  #panelSearch input.button[type="submit"] { background:linear-gradient(#fff,#eee); color:#2f2f2f; font-size:14px; text-shadow:0 1px #fff; }
  #panelSearch input.button[type="submit"]:disabled { background:linear-gradient(#fff,#eee); color:#aaa; opacity:.6; }
`;
export function searchMarkup(options = searchOptions) {
  return `<section class="classPlanner_ClassSearchSection">
    <div id="classSearchTitle" class="classPlanner_SectionTitle"><a href="#" class="classPlanner_SectionMenu" data-fixture-search-enroll-link>Find a Class and Enroll</a><button type="button" class="link planSectionToggle"><label>Search for Class and Add to Plan</label></button></div>
    <div id="panelSearch"><div class="ClassSearchWidget">
      <div class="ClassSearchControls row medium-small-collapse">
        <div class="searchType panel-5"><div><span id="classearchby">Search By</span> : <select id="ctl00_MainContent_cs_searchBy" class="searchBy" name="ctl00$MainContent$cs$searchBy">${options.map(([value,label])=>`<option value="${value}">${label}</option>`).join("")}</select></div></div>
        <div class="searchFieldPanel panel-7" style="display:block"><div class="searchFields panel-10">
          <input type="text" id="searchTier0" class="ClassSearchBox tier0 CSAutoComplete" aria-label="Subject Area" style="width:96%" placeholder="Enter Subject Area">
          <input type="text" id="searchTier1" class="ClassSearchBox tier1 CSAutoComplete" aria-label="Catalog Number or Class Title (Required)" style="width:96%" placeholder="Enter a Catalog Number or Class Title (Required)">
          <input type="text" id="searchTier2" class="ClassSearchBox tier2 CSAutoComplete" aria-label="unused for this search type" style="width:96%;display:none" placeholder="unused for this search type">
        </div><div class="goPanel" style="display:block"><input id="ctl00_MainContent_cs_goButton" class="csGoButton button" name="ctl00$MainContent$cs$goButton" type="submit" value="Go" disabled></div></div>
      </div><div id="resultHeaderDiv"></div>
    </div></div>
  </section>`;
}
export function searchFixtureHtml(options = recordedSearchOptions) {
  return calendarFixtureHtml(3)
    .replace('<div id="ctl00_MainContent_classPlanPanel">', '<div class="classPlannerWrapper"><div class="contentBox" id="ctl00_MainContent_classPlanPanel">' + searchMarkup(options))
    .replace('</form>', '</div></form>')
    .replace('</style>', `
      .ClassSearchControls { display:flex; margin:16px 0; }
      .searchType { width:42%; } .searchFieldPanel { display:flex; width:58%; }
      .searchFields { width:83%; } .goPanel { width:17%; }
      .ClassSearchBox { display:block; width:95%; margin-bottom:10px; }
      .ClassSearchWidget .button { color:#fff; background:#204e91; border:0; }
      .ClassSearchWidget .button:disabled { opacity:.5; }
      ${nativeSearchLayoutCss}
    </style>`);
}
