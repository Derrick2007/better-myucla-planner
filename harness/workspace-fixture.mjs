/** Native section hierarchy with fictional data; never uses a student page. */
import { JSDOM } from 'jsdom';
import { calendarFixtureHtml } from './calendar-fixture.mjs';
import { searchMarkup, recordedSearchOptions } from './search-fixture.mjs';

export function workspaceFixtureHtml(count = 5, includeResults = false, tallHeader = false) {
  const dom = new JSDOM(calendarFixtureHtml(count));
  const doc = dom.window.document;
  const navigation = doc.createElement('nav'); navigation.id = 'fixture-native-navigation';
  navigation.setAttribute('aria-label','Example UCLA navigation');
  navigation.innerHTML = '<strong>UCLA</strong><a href="#home">Home</a><a href="#academics">Academics</a><button type="button">Menu</button>';
  navigation.style.cssText = 'display:flex;align-items:center;gap:24px;height:64px;padding:0 24px;background:#24528f;color:white;box-sizing:border-box';
  doc.body.prepend(navigation);
  const panel = doc.getElementById('ctl00_MainContent_classPlanPanel');
  const wrapper = doc.createElement('div');
  wrapper.className = 'classPlannerWrapper';
  panel.replaceWith(wrapper);
  wrapper.append(panel);
  panel.className = 'contentBox';
  const header = doc.createElement('div');
  header.id = 'classPlanHeader'; header.textContent = 'Example plan';
  const menu = doc.createElement('div');
  menu.className = 'plannerTopMenuLinks'; menu.textContent = 'Native plan actions';
  panel.before(header, menu);
  const term = doc.createElement('div');
  term.className = 'enroll_term'; term.id = 'ctl00_MainContent_termSessionChooser';
  wrapper.before(term);
  term.append(doc.getElementById('ctl00_MainContent_termSessionChooser_TermChooser'));
  if (tallHeader) {
    navigation.style.height = '228px'; term.style.cssText = 'height:108px;box-sizing:border-box';
    menu.style.cssText = 'height:22px;margin:10px 0';
    panel.insertAdjacentHTML('beforebegin','<div class="classPlanner_Messages noprint" style="height:27px">Example planner notice</div><div class="classPlanner_Messages noprint" style="height:27px">Another example notice</div>');
    panel.insertAdjacentHTML('afterbegin','<div style="margin-top:12px;margin-bottom:12px">Example study list refresh</div>');
  }
  const calendar = doc.createElement('section');
  calendar.className = 'classPlanner_CalendarSection';
  calendar.innerHTML = '<div id="plannerSectionCal" class="classPlanner_SectionTitle">Weekly schedule</div><div id="ctl00_MainContent_panelGrid"></div>';
  calendar.lastElementChild.append(doc.querySelector('.plannerMenuLinks'), doc.getElementById('gridDiv'));
  doc.getElementById('ctl00_MainContent_panelGrid').remove();
  panel.prepend(calendar);
  panel.insertAdjacentHTML('beforeend', searchMarkup(recordedSearchOptions));
  panel.insertAdjacentHTML('beforeend', '<section class="classPlanner_ClassOptimizerSection"><div id="classOptimizerTitle" class="classPlanner_SectionTitle">Plan optimizer</div><div>Native tools</div></section>');
  panel.insertAdjacentHTML('beforeend', '<section class="classPlanner_EnrolledNotInPlanSection"><div id="plannerSectionEnip" class="classPlanner_SectionTitle"><button type="button">In Study List but Not In Current Plan</button></div><div>Example study list entries</div></section><section class="classPlanner_PersonalTimeBlocksSection"><div id="plannerSectionPer" class="classPlanner_SectionTitle"><button type="button">Personal Entries</button></div><div><input aria-label="Example personal entry" name="examplePersonalEntry"></div></section>');
  if (includeResults) {
    const widths = [6,10,19,5,9,15,12,7,17];
    const cells = values => values.map((value,i) => `<div class="span${i+1}" style="float:left;width:${widths[i]}%;box-sizing:border-box;padding:8px">${value}</div>`).join('');
    const header = cells(['Select','Section','<button type="button" class="header-Status link">Status</button>','Info','Day(s)','Time in Pacific Time','Location','<button type="button" class="header-Unit link">Units</button>','<button type="button" class="header-Instructor link">Instructor(s)</button>']);
    const rows = Array.from({length:5}, (_,i) => `<div class="row-fluid data_row class-info scrollable-collapse table-width2">${cells([
      `<input type="checkbox" name="exampleSection${i}" aria-label="Example section ${i+1}">`,i ? `Dis 1${String.fromCharCode(64+i)}` : 'Lec 1',
      'Open<br>10 of 30 seats left','Info',i ? 'F' : 'MWF','10am–10:50am','Example Hall 100',i ? '0.0' : '4.0','Example Instructor'
    ])}</div>`).join('');
    doc.querySelector('#resultHeaderDiv').textContent = 'Example search results';
    doc.querySelector('.ClassSearchWidget').insertAdjacentHTML('beforeend', `<div class="ClassSearchList search_results"><div id="searchLabel">Example results</div>${Array.from({length:3}, (_,c) => `<div id="CourseListEntry_M${c}" class="CourseListEntry"><div class="row-fluid class-title"><h3 class="head"><a href="#" onclick="document.getElementById('container_course_M${c}').hidden = !document.getElementById('container_course_M${c}').hidden; return false">EXAMPLE ${101+c} — Example course ${String.fromCharCode(65+c)}</a></h3></div></div><div id="container_course_M${c}"${c ? ' hidden style="display:none"' : ''}><div></div><div class="classSearchTableSubSectionHeader info-bar">Example section group</div><div class="row-fluid header-row class-info scrollable-collapse table-width2">${header}</div>${rows.replaceAll('exampleSection', `exampleCourse${c}Section`)}</div>`).join('')}<div id="fixture-result-footer"><button type="button">Example native result action</button></div></div>`);
  }
  doc.querySelectorAll('tbody.courseItem').forEach((card, i) => {
    const labels = card.querySelectorAll(':scope > tr:first-child .SubjectAreaName_ClassName p');
    labels[0].textContent = `Class ${i + 1}: Example Studies`;
    labels[1].textContent = `${101 + i} - Example course ${String.fromCharCode(65 + i)}`;
    if (tallHeader) card.querySelector('.final_exam_info').textContent = 'Example final exam: a long fictional explanation of the exam time and the later location announcement. This deliberately exercises a lengthy native exam note.';
    card.querySelectorAll('table.coursetable tr:not(:first-child)').forEach(row => {
      row.cells[6].textContent = 'Example Hall'; row.cells[8].textContent = 'Example instructor';
    });
    // The real table has a separate header body and a body per section, each
    // with an additional hidden controls row. A first-child selector over all
    // bodies would mistakenly count these as multiple header rows.
    const table = card.querySelector('table.coursetable');
    const headerRow = table.rows[0], lecture = table.rows[1];
    const headerBody = doc.createElement('tbody'); headerBody.append(headerRow);
    const discussion = lecture.cloneNode(true);
    discussion.cells[1].textContent = 'Dis 1A'; discussion.cells[7].textContent = '0.0';
    const groups = [lecture, discussion].map(row => {
      const group = doc.createElement('tbody');
      const extra = doc.createElement('tr'); extra.style.display = 'none';
      extra.innerHTML = '<td colspan="9">Example section controls</td>';
      group.append(row, extra); return group;
    });
    table.replaceChildren(headerBody, ...groups);
    card.querySelectorAll('[data-content]').forEach(link => link.setAttribute('data-content', '&lt;div&gt;Example time conflict&lt;/div&gt;'));
  });
  const style = doc.createElement('style');
  style.textContent = '.timebox,.fixture-weekbody{height:540px}td.SubjectAreaName_ClassName{margin:20px 0 5px}#div_landing{margin:30px 0}.classPlanner_SectionTitle{background:#24528f;color:white;padding:10px}.ClassSearchControls{display:flex}.searchType{width:42%}.searchFieldPanel{display:flex;width:58%}.ClassSearchBox{display:block;width:95%;margin-bottom:10px}.ClassSearchList{width:100%;font-size:13px;line-height:1.45}.ClassSearchList .row-fluid:after{content:"";display:table;clear:both}.ClassSearchList .header-row{background:#edf1f5}.ClassSearchList .data_row{border-bottom:1px solid #e3e8ed}';
  doc.head.append(style);
  return dom.serialize();
}

/** Recorded introduction hierarchy, populated entirely with fictional content. */
export function introductionFixtureHtml(count = 6, includeResults = true) {
  const dom = new JSDOM(workspaceFixtureHtml(count, includeResults)), doc = dom.window.document;
  doc.querySelector('.pagehead').remove();
  doc.querySelector('#main_wrapper > label')?.remove();
  doc.getElementById('fixture-native-navigation').style.height = '166px';
  const navigation = doc.getElementById('fixture-native-navigation');
  const header = doc.createElement('layout-headerwrap'); header.style.display = 'block';
  navigation.replaceWith(header); header.append(navigation);
  const layout = doc.createElement('section'); layout.id = 'layoutContentArea';
  layout.innerHTML = '<h2 id="titleText">Class Planner</h2><div id="div_page_title_section2"><div id="page_title_text">Example introduction explaining how this fictional planner works. <a href="#example-guide">Example guide</a></div></div><layout-columnwrapper class="col-2MR"><main-content id="main-content"><div id="AlertDiv"></div></main-content><right-sidebar><div id="ctl00_CustomSidePanel">Example planner links <a href="#example-links">Example link</a></div><div class="enroll_appt_widget_container">Example enrollment information</div><iwe-widget id="widgetNeedHelp"><button type="button">Example help</button></iwe-widget><iwe-widget id="voter_widget_container">Example public information</iwe-widget></right-sidebar></layout-columnwrapper>';
  const term = doc.getElementById('ctl00_MainContent_termSessionChooser'), select = term.querySelector('select');
  term.innerHTML = '<div class="term_display">Example term</div><div class="term"></div>'; term.lastElementChild.append(select);
  const main = layout.querySelector('main-content');
  main.append(term);
  main.insertAdjacentHTML('beforeend', '<div style="margin-top:10px"><span class="label warning">Example term notice</span> Example public term information. <strong>Example emphasis</strong></div><div>All times use <span class="badge info">Pacific Time (PT)</span>.</div>');
  main.append(doc.querySelector('.classPlannerWrapper'));
  doc.getElementById('main_wrapper').append(layout);
  const style = doc.createElement('style');
  style.textContent = 'html,body{height:100%;overflow:auto}body{margin:0}form{height:100%;padding:0}#layoutContentArea{width:min(1280px,100%);box-sizing:border-box;margin:-20px auto 100px;padding:50px 30px;background:white}#titleText{font-size:35px;line-height:42px;margin:0 0 20px;border-bottom:1px solid #ccd}#page_title_text{padding:0 0 10px;margin:0 0 10px;line-height:18.5px}layout-columnwrapper{display:inline-block;width:100%}main-content{display:block;float:left;width:calc(100% - 280px)}right-sidebar{display:block;float:right;width:260px;height:1200px}right-sidebar>*{padding:12px;margin:0 0 12px;border:1px solid #ccc;display:block}.enroll_term{padding:5px 12px;margin-bottom:10px;border:1px solid #888;background:#ddd;height:42px;box-sizing:border-box}.term_display{float:left}.term{float:right}';
  doc.head.append(style); return dom.serialize();
}

/** Empty/future-quarter presentation without the reorder contract. */
export function futureQuarterFixtureHtml() {
  const dom = new JSDOM(introductionFixtureHtml()), doc = dom.window.document;
  doc.querySelector('.classPlannerWrapper').outerHTML = '<div id="fixture-future-plan"><h3>Example future plan</h3><button type="button">Example native future action</button></div>';
  const select = doc.getElementById('ctl00_MainContent_termSessionChooser_TermChooser');
  select.append(new dom.window.Option('Example future winter', '27W', true, true));
  return dom.serialize();
}
