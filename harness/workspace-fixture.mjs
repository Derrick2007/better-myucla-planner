/** Native section hierarchy with fictional data; never uses a student page. */
import { JSDOM } from 'jsdom';
import { calendarFixtureHtml } from './calendar-fixture.mjs';
import { searchMarkup, recordedSearchOptions } from './search-fixture.mjs';

export function workspaceFixtureHtml(count = 5, includeResults = false) {
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
    const header = cells(['Select','Section','Status','Info','Days','Time','Location','Units','Instructor']);
    const rows = Array.from({length:5}, (_,i) => `<div class="row-fluid data_row class-info scrollable-collapse table-width2">${cells([
      `<input type="checkbox" name="exampleSection${i}" aria-label="Example section ${i+1}">`,i ? `Dis 1${String.fromCharCode(64+i)}` : 'Lec 1',
      'Open<br>10 of 30 seats left','Info',i ? 'F' : 'MWF','10am–10:50am','Example Hall 100',i ? '0.0' : '4.0','Example Instructor'
    ])}</div>`).join('');
    doc.querySelector('#resultHeaderDiv').textContent = 'Example search results';
    doc.querySelector('.ClassSearchWidget').insertAdjacentHTML('beforeend', `<div class="ClassSearchList search_results"><div id="CourseListEntry_M0" class="CourseListEntry"><div class="row-fluid class-title"><h3 class="head"><a href="#" onclick="document.getElementById('container_course_M0').hidden = !document.getElementById('container_course_M0').hidden; return false">EXAMPLE 101 — Example course</a></h3></div><div id="container_course_M0"><div class="row-fluid header-row class-info scrollable-collapse table-width2">${header}</div>${rows}</div></div></div>`);
  }
  doc.querySelectorAll('tbody.courseItem').forEach((card, i) => {
    const labels = card.querySelectorAll(':scope > tr:first-child .SubjectAreaName_ClassName p');
    labels[0].textContent = `Class ${i + 1}: Example Studies`;
    labels[1].textContent = `${101 + i} - Example course ${String.fromCharCode(65 + i)}`;
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
