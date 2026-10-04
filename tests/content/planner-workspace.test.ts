// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isKnownEmptyPlanner, PlannerWorkspace } from "../../src/content/planner-workspace";
import { MyUclaPlannerAdapter } from "../../src/adapters/myucla-adapter";
// @ts-expect-error Shared browser fixture is plain JavaScript.
import { workspaceFixtureHtml, introductionFixtureHtml, emptyPlanFixtureHtml } from "../../harness/workspace-fixture.mjs";

describe("one-page native planner workspace", () => {
  let workspace: PlannerWorkspace;
  let adapter: MyUclaPlannerAdapter;
  let optimizerPostback: ReturnType<typeof vi.fn>;
  let optimizerShrink: ReturnType<typeof vi.fn>;
  const mount = () => workspace.reconcile(document, adapter.inspectContract().courses);
  const nativeOptimizerHandler = (button:HTMLButtonElement) => {
    button.onclick=()=>{optimizerShrink('panelOptimizer');optimizerPostback('ctl00$MainContent$toggleOptimizer','');return false;};
  };
  const optimizerToggle = () => {
    const title=document.getElementById('classOptimizerTitle')!;
    title.innerHTML='<button type="button" id="ctl00_MainContent_planSectionHelpTipOpPop" class="planSectionHelpTip link">Help</button><button id="ctl00_MainContent_toggleOptimizer" class="planSectionToggle link" onclick="shrink(\'panelOptimizer\'); __doPostBack(\'ctl00$MainContent$toggleOptimizer\',\'\')"><i class="icon-plus-sign"></i><label>Plan Optimizer</label></button>';
    const button=title.querySelector<HTMLButtonElement>('#ctl00_MainContent_toggleOptimizer')!;nativeOptimizerHandler(button);return button;
  };
  beforeEach(() => {
    const fixture = new DOMParser().parseFromString(workspaceFixtureHtml(), "text/html");
    document.body.innerHTML = fixture.body.innerHTML;
    workspace = new PlannerWorkspace(); adapter = new MyUclaPlannerAdapter(document);
    expect(adapter.inspectContract().ok).toBe(true);
    optimizerPostback=vi.fn();optimizerShrink=vi.fn((id:string)=>{
      const panel=document.getElementById(id)!;panel.classList.toggle('hidden');
      const icon=document.querySelector('#ctl00_MainContent_toggleOptimizer > i');
      if(icon)icon.className=panel.classList.contains('hidden')?'icon-plus-sign':'icon-minus-sign';
    });
    const native=document.getElementById('ctl00_MainContent_toggleOptimizer');if(native)nativeOptimizerHandler(native as HTMLButtonElement);
    document.querySelector('form')!.addEventListener('submit',event=>event.preventDefault());
  });
  afterEach(() => workspace.restore());

  it("keeps the original form, inputs, course order and native handlers", () => {
    const form = document.querySelector("form");
    const fields = [...document.querySelectorAll("input,select")];
    const commands = [...document.querySelectorAll(".OrderingButtons button")];
    const courses = adapter.inspectContract().courses;
    mount(); mount();
    expect(document.querySelectorAll(".pl-workspace-main > section")).toHaveLength(5);
    expect(document.querySelectorAll("form")).toHaveLength(1);
    expect(document.querySelector("form")).toBe(form);
    expect(new Set(document.querySelectorAll("input,select"))).toEqual(new Set(fields));
    expect([...document.querySelectorAll(".OrderingButtons button")]).toEqual(commands);
    expect(adapter.inspectContract().ok).toBe(true);
    expect(adapter.inspectContract().courses.map(c => c.node)).toEqual(courses.map(c => c.node));
  });
  it("opens original class details in place and returns keyboard focus", () => {
    const course = adapter.inspectContract().courses[0];
    const table = course.node.querySelector("table.coursetable")!;
    const parent = table.parentElement;
    mount();
    const details = course.node.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!;
    expect(details.parentElement!.firstElementChild).toBe(details);
    expect(details.getAttribute("aria-expanded")).toBe("false");
    details.click();
    expect(details.getAttribute("aria-expanded")).toBe("true");
    expect(course.node.classList.contains("pl-workspace-preview-card")).toBe(true);
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(false);
    expect(table.parentElement).toBe(parent);
    expect(adapter.inspectContract().ok).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(course.node.classList.contains("pl-workspace-preview-card")).toBe(false);
    expect(details.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(details);
  });
  it("shows exact per-section native summaries and refreshes changed statuses without aggregating", () => {
    const course=adapter.inspectContract().courses[0],table=course.node.querySelector<HTMLTableElement>('table.coursetable')!;
    const rows=[...table.rows].filter(row=>row.cells.length===9&&row.cells[0].tagName==='TD');
    const cells=rows.map(row=>row.cells[2]),native=cells.map(cell=>cell.innerHTML);mount();
    const lines=course.node.querySelectorAll('.pl-workspace-course-summary > p');expect(lines).toHaveLength(rows.length);
    rows.forEach((row,index)=>expect([...lines[index].children].map(node=>node.textContent)).toEqual([1,4,5,2].map(field=>row.cells[field].textContent!.replace(/\s+/g,' ').trim())));
    expect(cells.map(cell=>cell.innerHTML)).toEqual(native);
    cells[0].textContent='Example updated native status';expect(workspace.needsReconcile(document)).toBe(true);mount();
    expect(course.node.querySelector('[data-pl-summary-field="2"]')!.textContent).toBe('Example updated native status');
    expect(course.node.querySelectorAll('.pl-workspace-course-summary')).toHaveLength(1);expect(workspace.needsReconcile(document)).toBe(false);
    course.node.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!.click();mount();
    expect(workspace.needsReconcile(document)).toBe(false);workspace.restore();expect(course.node.querySelector('.pl-workspace-course-summary')).toBeNull();
    expect(cells[0].textContent).toBe('Example updated native status');
  });
  it("keeps native class controls in place behind one local Class actions disclosure", () => {
    const courses=adapter.inspectContract().courses;
    const native=[...document.querySelectorAll<HTMLElement>('.OrderingButtons')].map(node=>({node,parent:node.parentElement,html:node.outerHTML}));
    const nativeAction=vi.fn();document.querySelectorAll('.OrderingButtons button').forEach(button=>button.addEventListener('click',nativeAction));
    mount();mount();
    const actions=[...document.querySelectorAll<HTMLButtonElement>('[data-pl-workspace-actions]')];
    expect(actions).toHaveLength(courses.length);
    expect(actions[0].getAttribute('aria-label')).toBe(`Class actions for ${courses[0].label}`);
    expect(actions.every(button=>button.type==='button'&&button.getAttribute('aria-expanded')==='false')).toBe(true);
    for(const button of actions){
      expect(button.previousElementSibling?.matches('[data-pl-workspace-details]')).toBe(true);
      expect(button.parentElement!.firstElementChild).toBe(button.previousElementSibling);
    }
    actions[0].click();expect(actions[0].getAttribute('aria-expanded')).toBe('true');
    actions[1].click();expect(actions[0].getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('.pl-course-actions-open')).toHaveLength(1);
    expect(actions[1].parentElement!.classList.contains('pl-course-actions-open')).toBe(true);
    expect(native.every(({node,parent,html})=>node.parentElement===parent&&node.outerHTML===html)).toBe(true);
    expect(nativeAction).not.toHaveBeenCalled();expect(adapter.inspectContract().ok).toBe(true);
    actions[1].click();expect(document.querySelector('.pl-course-actions-open')).toBeNull();expect(document.activeElement).toBe(actions[1]);
  });
  it("closes an inner owned More menu before Class actions and preserves a note editor", () => {
    const host=adapter.inspectContract().courses[0].node.querySelector<HTMLElement>('td.linkPanelRight')!;
    const tools=document.createElement('div');tools.className='pl-real-tools';tools.dataset.plRealTools='true';
    tools.innerHTML='<details data-pl-course-menu><summary>More tools</summary><button type="button">Example action</button></details><input data-pl-tag aria-label="Example note">';host.append(tools);
    const more=tools.querySelector<HTMLDetailsElement>('details')!,summary=more.querySelector('summary')!,input=tools.querySelector('input')!;
    input.value='Example note';mount();
    const actions=host.querySelector<HTMLButtonElement>('[data-pl-workspace-actions]')!;actions.click();more.open=true;summary.focus();
    summary.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(more.open).toBe(false);expect(actions.getAttribute('aria-expanded')).toBe('true');expect(document.activeElement).toBe(summary);
    input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(actions.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(actions);
    actions.click();expect(input.value).toBe('Example note');expect(input.parentElement).toBe(tools);
    input.focus();
    const blur=vi.fn();input.addEventListener('blur',blur);
    const down=new MouseEvent('mousedown',{button:0,bubbles:true,cancelable:true});actions.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);expect(document.activeElement).toBe(input);expect(blur).not.toHaveBeenCalled();
    actions.click();expect(actions.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(actions);expect(blur).toHaveBeenCalledOnce();
    expect(input.value).toBe('Example note');
  });
  it("reveals newly disclosed class controls at the Plan pane's lower edge without document scrolling", () => {
    mount();
    const pane=document.querySelector<HTMLElement>('.pl-workspace-plan')!,actions=document.querySelector<HTMLButtonElement>('[data-pl-workspace-actions]')!;
    pane.style.overflowY='auto';pane.scrollTop=50;
    const rect=(top:number,bottom:number)=>({top,bottom,height:bottom-top,left:0,right:360,width:360,x:0,y:top,toJSON:()=>({})}) as DOMRect;
    const spies=[
      vi.spyOn(pane,'clientHeight','get').mockReturnValue(500),vi.spyOn(pane,'scrollHeight','get').mockReturnValue(1000),
      vi.spyOn(pane,'getBoundingClientRect').mockReturnValue(rect(100,600)),
      vi.spyOn(document.getElementById('plannerSectionClip')!,'getBoundingClientRect').mockReturnValue(rect(100,140)),
      vi.spyOn(actions,'getBoundingClientRect').mockReturnValue(rect(540,576)),
      vi.spyOn(actions.parentElement!,'getBoundingClientRect').mockReturnValue(rect(500,700)),
      vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
    ];
    try {
      actions.click();expect(pane.scrollTop).toBe(158);expect(document.activeElement).toBe(actions);
      expect(spies[spies.length-1]).not.toHaveBeenCalled();
      pane.scrollTop=200;window.dispatchEvent(new Event('resize'));expect(pane.scrollTop).toBe(200);
    } finally {spies.forEach(spy=>spy.mockRestore());}
  });
  it("closes Class actions before Details, Find classes, or folding My classes hides them", () => {
    mount();
    const actions=document.querySelector<HTMLButtonElement>('[data-pl-workspace-actions]')!,details=document.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!;
    actions.click();details.click();expect(actions.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector<HTMLElement>('.pl-workspace-preview')!.hidden).toBe(false);
    actions.click();expect(document.querySelector<HTMLElement>('.pl-workspace-preview')!.hidden).toBe(true);
    expect(details.getAttribute('aria-expanded')).toBe('false');
    const find=document.querySelector<HTMLButtonElement>('button[data-pl-module="find"]')!;find.click();
    expect(actions.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(find);
    document.querySelector<HTMLButtonElement>('button[data-pl-module="classes"]')!.click();actions.click();
    document.querySelector<HTMLButtonElement>('.pl-workspace-plan .pl-pane-toggle')!.click();
    expect(actions.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(document.querySelector('button[data-pl-module=classes]'));
  });
  it.each(['actions','details'] as const)("dismisses foreground Plan actions before the background class %s", kind => {
    mount();
    const trigger=document.querySelector<HTMLButtonElement>(kind==='actions'?'[data-pl-workspace-actions]':'[data-pl-workspace-details]')!;trigger.click();
    const tools=document.querySelector<HTMLDetailsElement>('.pl-workspace-plan-actions')!,summary=tools.querySelector('summary')!;
    tools.open=true;summary.focus();summary.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(tools.open).toBe(false);expect(document.activeElement).toBe(summary);expect(trigger.getAttribute('aria-expanded')).toBe('true');
    summary.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(trigger);
  });
  it("resets a replaced native tools host and restores all Class actions presentation", () => {
    mount();
    const host=adapter.inspectContract().courses[0].node.querySelector<HTMLElement>('td.linkPanelRight')!;
    host.querySelector<HTMLButtonElement>('[data-pl-workspace-actions]')!.click();
    const native=host.querySelector('.OrderingButtons')!,replacement=native.cloneNode(true) as HTMLElement;native.replaceWith(replacement);
    expect(workspace.needsReconcile(document)).toBe(true);mount();
    expect(host.classList.contains('pl-course-actions-open')).toBe(false);
    const actions=host.querySelector<HTMLButtonElement>('[data-pl-workspace-actions]')!;
    expect(actions.getAttribute('aria-expanded')).toBe('false');expect(host.querySelectorAll('[data-pl-workspace-actions]')).toHaveLength(1);
    expect(document.activeElement).toBe(actions);
    actions.click();
    const nextHost=host.cloneNode(true) as HTMLElement;
    nextHost.querySelectorAll('[data-pl-workspace-details],[data-pl-workspace-actions]').forEach(button=>button.remove());
    nextHost.classList.remove('pl-course-actions-open');host.replaceWith(nextHost);
    expect(workspace.needsReconcile(document)).toBe(true);mount();
    expect(host.classList.contains('pl-course-actions-open')).toBe(false);
    expect(nextHost.querySelectorAll('[data-pl-workspace-actions]')).toHaveLength(1);
    expect(nextHost.querySelector('[data-pl-workspace-actions]')!.getAttribute('aria-expanded')).toBe('false');
    nextHost.replaceWith(host);mount();
    host.querySelector<HTMLButtonElement>('[data-pl-workspace-actions]')!.click();workspace.restore();
    expect(document.querySelector('[data-pl-workspace-actions]')).toBeNull();expect(document.querySelector('.pl-course-actions-open')).toBeNull();
    expect(replacement.parentElement).toBe(host);
    const more=document.createElement('details');more.dataset.plCourseMenu='true';more.open=true;more.innerHTML='<summary>Example more</summary>';replacement.append(more);
    more.querySelector('summary')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(more.open).toBe(true);
  });
  it("keeps a long exam note in a separate disclosure and preserves its native source", () => {
    const course=adapter.inspectContract().courses[0],exam=course.node.querySelector('.final_exam_info')!;
    const native=exam.innerHTML;mount();course.node.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!.click();
    const disclosure=document.querySelector<HTMLDetailsElement>('.pl-workspace-preview-head details')!;
    expect(disclosure.open).toBe(false);expect(disclosure.querySelector('summary')!.textContent).toBe('Final exam');
    expect(disclosure.querySelector('p')!.textContent).toBe(exam.textContent!.replace(/\s+/g,' ').trim());
    expect(exam.innerHTML).toBe(native);
  });
  it("docks Details to its slot without scrolling the class list or moving native rows", () => {
    mount();const course=adapter.inspectContract().courses[0],row=course.node.children[2],parent=row.parentElement;
    const body=document.getElementById('panelPlan')!,slot=document.querySelector<HTMLElement>('.pl-workspace-details-slot')!;
    body.scrollTop=120;const bounds=vi.spyOn(slot,'getBoundingClientRect').mockReturnValue({left:320,top:180,width:410,height:520} as DOMRect);
    const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
    try {
      course.node.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!.click();
      expect(course.node.classList.contains('pl-preview-docked')).toBe(true);expect(row.parentElement).toBe(parent);
      expect(row.contains(document.querySelector('.pl-workspace-preview'))).toBe(true);
      expect(course.node.style.getPropertyValue('--pl-detail-width')).toBe('410px');expect(course.node.style.getPropertyValue('--pl-detail-top')).toBe('180px');
      expect(body.scrollTop).toBe(120);expect(scroll).not.toHaveBeenCalled();
    } finally {bounds.mockRestore();scroll.mockRestore();}
  });
  it("restores native sections, term and tools exactly", () => {
    const original = document.body.innerHTML;
    mount(); document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!.click(); workspace.restore();
    expect(document.body.innerHTML).toBe(original);
  });
  it("keeps the schedule and original navigation interactive while Details stays selected", () => {
    mount();const details=document.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!;
    const native=document.querySelector<HTMLButtonElement>('#fixture-native-navigation button')!,handler=vi.fn();native.addEventListener('click',handler);
    details.click();native.click();expect(handler).toHaveBeenCalledOnce();
    expect(document.querySelector('.pl-workspace-calendar')!.parentElement).toBe(document.querySelector('.pl-workspace-deck'));
    expect(document.querySelector('.pl-workspace-detail-backdrop')).toBeNull();
    document.querySelector<HTMLButtonElement>('button[data-pl-module=personal]')!.click();
    expect(details.getAttribute('aria-expanded')).toBe('true');expect(document.querySelector('.pl-workspace-calendar.pl-module-active')).not.toBeNull();
    expect(adapter.inspectContract().ok).toBe(true);
  });
  it("offers an accessible close button and toggles the same course details", () => {
    mount();
    const details = document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!;
    const close = document.querySelector<HTMLButtonElement>(".pl-workspace-preview-close")!;
    details.click();
    expect(close.getAttribute("aria-label")).toBe("Close details");
    close.click();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(true);
    expect(document.activeElement).toBe(details);
    details.click(); details.click();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(true);
  });
  it("resizes supporting panes with the keyboard and restores original controls", () => {
    const controls = [...document.querySelectorAll(".ClassSearchWidget input,.ClassSearchWidget select")];
    mount();
    const separators = [...document.querySelectorAll<HTMLElement>('[role="separator"]')];
    expect(separators).toHaveLength(1);
    separators[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    expect(separators[0].getAttribute('aria-valuenow')).toBe('516');
    separators[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
    expect(separators[0].getAttribute('aria-valuenow')).toBe('640');
    separators[0].dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
    expect(separators[0].getAttribute('aria-valuenow')).toBe('532');
    expect([...document.querySelectorAll(".ClassSearchWidget input,.ClassSearchWidget select")]).toEqual(controls);
    expect(controls.every(node=>node.closest('form')===document.getElementById('aspnetForm'))).toBe(true);
    workspace.restore(); expect(document.querySelector('[role="separator"]')).toBeNull();
  });
  it("reserves the main workspace when clamping schedule width and reports its responsive size", () => {
    mount();const deck=document.querySelector<HTMLElement>('.pl-workspace-deck')!,main=document.querySelector<HTMLElement>('.pl-workspace-main')!,splitter=document.querySelector<HTMLElement>('[role=separator]')!;
    const width=vi.spyOn(deck,'clientWidth','get').mockReturnValue(1100),bounds=vi.spyOn(main,'getBoundingClientRect').mockReturnValue({width:568} as DOMRect);
    try {
      splitter.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));expect(splitter.getAttribute('aria-valuenow')).toBe('468');expect(splitter.getAttribute('aria-valuemax')).toBe('468');
      expect(main.dataset.plMainSize).toBe('medium');bounds.mockReturnValue({width:540} as DOMRect);window.dispatchEvent(new Event('resize'));expect(main.dataset.plMainSize).toBe('narrow');
      bounds.mockReturnValue({width:760} as DOMRect);window.dispatchEvent(new Event('resize'));expect(main.dataset.plMainSize).toBe('wide');
    } finally {width.mockRestore();bounds.mockRestore();}
  });
  it("changes modules without replacing native inputs or submitting", () => {
    mount();const plan=document.querySelector<HTMLButtonElement>('button[data-pl-module=classes]')!,find=document.querySelector<HTMLButtonElement>('button[data-pl-module=find]')!;
    const form=document.querySelector('form')!,input=document.querySelector<HTMLInputElement>('#searchTier0')!,controls=[...document.querySelectorAll('.ClassSearchWidget input,.ClassSearchWidget select')];
    input.value='Example query';const submit=vi.fn();form.addEventListener('submit',submit);
    expect(plan.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('.pl-workspace-original')!.closest('.pl-workspace-nav-footer')).not.toBeNull();
    find.click();expect(find.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('.classPlannerWrapper')!.getAttribute('data-pl-module')).toBe('find');
    plan.click();expect(input.value).toBe('Example query');expect([...document.querySelectorAll('.ClassSearchWidget input,.ClassSearchWidget select')]).toEqual(controls);
    expect(controls.every(node=>node.closest('form')===form)).toBe(true);expect(submit).not.toHaveBeenCalled();expect(adapter.inspectContract().ok).toBe(true);
  });
  it("supports task keyboard navigation and respects a native consumed Escape", () => {
    mount();
    const plan=document.querySelector<HTMLButtonElement>('button[data-pl-module="classes"]')!;
    const find=document.querySelector<HTMLButtonElement>('button[data-pl-module="find"]')!;
    plan.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    expect(find.getAttribute('aria-pressed')).toBe('true');expect(document.activeElement).toBe(find);
    const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});escape.preventDefault();
    document.dispatchEvent(escape);expect(find.getAttribute('aria-pressed')).toBe('true');
    find.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
    expect(plan.getAttribute('aria-pressed')).toBe('true');expect(document.activeElement).toBe(plan);
  });
  it("leaves Escape to an open native autocomplete before dismissing Plan actions", () => {
    mount();document.querySelector<HTMLButtonElement>('button[data-pl-module=find]')!.click();
    const input=document.querySelector<HTMLInputElement>('#searchTier0')!,actions=document.querySelector<HTMLDetailsElement>('.pl-workspace-plan-actions')!;actions.open=true;
    const menu=document.createElement('ul');menu.className='ui-autocomplete';menu.innerHTML='<li>Example subject</li>';document.body.append(menu);
    try {
      const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});input.dispatchEvent(escape);
      expect(actions.open).toBe(true);expect(escape.defaultPrevented).toBe(false);
      menu.style.display='none';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      expect(actions.open).toBe(false);expect(document.activeElement).toBe(actions.querySelector('summary'));
    } finally {menu.remove();}
  });
  it("lists every module and restores all six sections in original layout", () => {
    const sections=[...document.querySelectorAll('#ctl00_MainContent_classPlanPanel > section')];mount();
    expect([...document.querySelectorAll('.pl-workspace-nav-main button')].map(n=>n.textContent)).toEqual(['My classes','Find classes','Optimizer','Study list','Personal entries']);
    expect(document.querySelector('.pl-workspace-extras')).toBeNull();
    for(const module of ['classes','find','optimizer','study','personal']){
      document.querySelector<HTMLButtonElement>('button[data-pl-module="'+module+'"]')!.click();
      expect(document.querySelectorAll('.pl-workspace-main > section.pl-module-active')).toHaveLength(1);
      expect(document.querySelector('.pl-workspace-calendar.pl-module-active')).not.toBeNull();
    }
    document.querySelector<HTMLButtonElement>('.pl-workspace-original')!.click();expect([...document.querySelectorAll('#ctl00_MainContent_classPlanPanel > section')]).toEqual(sections);
    document.querySelector<HTMLButtonElement>('.pl-workspace-return')!.click();expect(document.querySelectorAll('.pl-workspace-main > section')).toHaveLength(5);
  });
  it.each([false,true])("temporarily discloses Plan actions for printing and restores its prior open=%s choice", open => {
    mount();
    const extras=document.querySelector<HTMLDetailsElement>('.pl-workspace-plan-actions')!;extras.open=open;
    const modules=[...extras.querySelectorAll('section')];
    window.dispatchEvent(new Event('beforeprint'));expect(extras.open).toBe(true);
    window.dispatchEvent(new Event('beforeprint'));expect(extras.open).toBe(true);
    window.dispatchEvent(new Event('afterprint'));expect(extras.open).toBe(open);
    window.dispatchEvent(new Event('afterprint'));expect(extras.open).toBe(open);
    expect([...extras.querySelectorAll('section')]).toEqual(modules);
  });
  it("restores the Plan actions choice and removes print handlers when disposing during printing", () => {
    mount();
    const extras=document.querySelector<HTMLDetailsElement>('.pl-workspace-plan-actions')!;
    window.dispatchEvent(new Event('beforeprint'));expect(extras.open).toBe(true);
    workspace.restore();expect(extras.open).toBe(false);
    window.dispatchEvent(new Event('beforeprint'));expect(extras.open).toBe(false);
    extras.open=true;window.dispatchEvent(new Event('afterprint'));expect(extras.open).toBe(true);
    expect(document.querySelectorAll('#ctl00_MainContent_classPlanPanel > section')).toHaveLength(6);
  });
  it.each([1920,960,390])("preserves native Details selection across modules and local Schedule at %ipx", width => {
    const descriptor=Object.getOwnPropertyDescriptor(window,'innerWidth');Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
    try {
      mount();const course=adapter.inspectContract().courses[0],row=course.node.children[2],parent=row.parentElement;
      const fields=[...row.querySelectorAll('input,select,button')],details=course.node.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!;details.click();
      const find=document.querySelector<HTMLButtonElement>('button[data-pl-module=find]')!;find.click();
      expect(details.getAttribute('aria-expanded')).toBe('true');expect(course.node.classList.contains('pl-preview-docked')).toBe(true);expect(document.activeElement).toBe(find);
      document.querySelector<HTMLButtonElement>('[data-pl-mobile-view=schedule]')!.click();expect(document.querySelector('.pl-show-schedule')).not.toBeNull();
      document.querySelector<HTMLButtonElement>('[data-pl-mobile-view=main]')!.click();expect(document.querySelector('.pl-show-schedule')).toBeNull();
      document.querySelector<HTMLButtonElement>('button[data-pl-module=classes]')!.click();expect(document.querySelector('.pl-has-docked-details')).not.toBeNull();
      expect(row.parentElement).toBe(parent);expect(fields.every(field=>row.contains(field))).toBe(true);
      document.querySelector<HTMLButtonElement>('.pl-workspace-preview-close')!.click();expect(document.activeElement).toBe(details);
    } finally {if(descriptor)Object.defineProperty(window,'innerWidth',descriptor);}
  });
  it("keeps the return to workspace control after an original-layout redraw", () => {
    mount();document.querySelector<HTMLButtonElement>('.pl-workspace-original')!.click();
    const replacement=new DOMParser().parseFromString(workspaceFixtureHtml(), 'text/html');
    document.querySelector('.classPlannerWrapper')!.replaceWith(document.importNode(replacement.querySelector('.classPlannerWrapper')!,true));
    mount();
    expect(document.querySelector('.pl-workspace-deck')).toBeNull();
    expect(document.querySelectorAll('.pl-workspace-return')).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('.pl-workspace-return')!.click();
    expect(document.querySelectorAll('.pl-workspace-main > section')).toHaveLength(5);
    expect(adapter.inspectContract().ok).toBe(true);
  });
  it.each([false,true])("does not reopen an unfamiliar empty plan from Original layout using previously empty=%s snapshots", empty => {
    if(empty)document.body.innerHTML=new DOMParser().parseFromString(emptyPlanFixtureHtml(),'text/html').body.innerHTML;
    const courses=adapter.inspectContract().courses;workspace.reconcile(document,courses);
    document.querySelector<HTMLButtonElement>('.pl-workspace-original')!.click();
    const next=new DOMParser().parseFromString(emptyPlanFixtureHtml(),'text/html').getElementById('panelPlan')!;
    next.querySelector('.no_data_text')!.className='unfamiliar_empty_marker';
    document.getElementById('panelPlan')!.replaceWith(document.importNode(next,true));
    workspace.reconcile(document,courses);
    const native=document.getElementById('panelPlan')!,html=native.innerHTML;
    document.querySelector<HTMLButtonElement>('.pl-workspace-return')!.click();
    expect(document.querySelector('.pl-workspace-host')).toBeNull();expect(document.querySelector('.pl-workspace-deck')).toBeNull();
    expect(native.isConnected).toBe(true);expect(native.innerHTML).toBe(html);expect(document.querySelector('tbody.courseItem')).toBeNull();
  });
  it("leaves an unknown native section structure untouched", () => {
    document.getElementById("classSearchTitle")!.id = "unexpectedSearchTitle";
    const original = document.body.innerHTML;
    mount();
    expect(document.body.innerHTML).toBe(original);
  });
  it.each([false,true])("falls back for an unknown native module added after mount=%s without losing its controls", mounted => {
    const panel=document.getElementById('ctl00_MainContent_classPlanPanel')!,sections=[...panel.querySelectorAll(':scope > section')];
    if(mounted)mount();
    const unknown=document.createElement('section');unknown.className='classPlanner_UnexpectedSection';
    const input=document.createElement('input'),button=document.createElement('button');button.type='button';input.value='Example native value';
    const handler=vi.fn();button.addEventListener('click',handler);unknown.append(input,button);panel.append(unknown);
    const original=document.body.innerHTML;
    if(mounted)expect(workspace.needsReconcile(document)).toBe(true);
    mount();
    expect(document.querySelector('.pl-workspace-deck')).toBeNull();expect(document.querySelector('.pl-workspace-host')).toBeNull();
    expect(unknown.parentElement).toBe(panel);expect(input.parentElement).toBe(unknown);expect(button.parentElement).toBe(unknown);
    expect(input.form).toBe(document.getElementById('aspnetForm'));expect(input.value).toBe('Example native value');
    expect([...panel.querySelectorAll(':scope > section')]).toEqual([...sections,unknown]);button.click();expect(handler).toHaveBeenCalledOnce();
    if(!mounted)expect(document.body.innerHTML).toBe(original);
    mount();expect(unknown.isConnected).toBe(true);expect(document.querySelector('.pl-workspace-deck')).toBeNull();
  });
  it("folds locally and reopens through the selected module without invoking native handlers", () => {
    const title=document.getElementById('plannerSectionClip')!,native=title.querySelector<HTMLButtonElement>('button.planSectionToggle')!,handler=vi.fn();native.addEventListener('click',handler);
    const body=document.getElementById('panelPlan')!,style=body.getAttribute('style');mount();
    const reopen=document.querySelector<HTMLButtonElement>('button[data-pl-module=classes]')!;native.click();
    expect(handler).not.toHaveBeenCalled();expect(body.parentElement!.classList.contains('pl-pane-collapsed')).toBe(true);expect(document.activeElement).toBe(reopen);
    reopen.click();expect(body.parentElement!.classList.contains('pl-pane-open')).toBe(true);expect(body.getAttribute('style')).toBe(style);
    workspace.restore();native.click();expect(handler).toHaveBeenCalledOnce();
  });
  it("places the complete plan menu in a disclosure without changing native control parents", () => {
    const menu=document.querySelector('.plannerTopMenuLinks')!,parent=menu.parentElement,next=menu.nextSibling;
    const controls=[...menu.querySelectorAll('button')],parents=controls.map(node=>node.parentElement),handlers=controls.map(()=>vi.fn());controls.forEach((node,i)=>node.addEventListener('click',handlers[i]));
    const term=document.getElementById('ctl00_MainContent_termSessionChooser')!,termParent=term.parentElement;mount();
    const actions=document.querySelector<HTMLDetailsElement>('.pl-workspace-plan-actions')!;expect(menu.parentElement).toBe(actions);expect(actions.hasAttribute('data-planner-lift-owned')).toBe(false);
    expect(controls.every((node,i)=>node.parentElement===parents[i])).toBe(true);actions.open=true;controls[0].click();expect(handlers[0]).toHaveBeenCalledOnce();
    expect(term.parentElement).toBe(termParent);workspace.restore();expect(menu.parentElement).toBe(parent);expect(menu.nextSibling).toBe(next);
  });
  it.each([false,true])("preserves an anonymous native menu replacement when reconciling=%s", reconcile => {
    const original=document.querySelector<HTMLElement>('.plannerTopMenuLinks')!,parent=original.parentElement,next=original.nextSibling;mount();
    const replacement=original.cloneNode(true) as HTMLElement,button=replacement.querySelector<HTMLButtonElement>('#aboutMenuEntry')!,handler=vi.fn();button.addEventListener('click',handler);original.replaceWith(replacement);
    expect(workspace.needsReconcile(document)).toBe(true);
    if(reconcile){mount();expect(document.querySelectorAll('.pl-workspace-plan-actions > .plannerTopMenuLinks')).toHaveLength(1);expect(workspace.needsReconcile(document)).toBe(false);}
    workspace.restore();expect(replacement.parentElement).toBe(parent);expect(replacement.nextSibling).toBe(next);expect(original.isConnected).toBe(false);
    button.click();expect(handler).toHaveBeenCalledOnce();expect(button.form).toBe(document.getElementById('aspnetForm'));
  });

  const planActionPanels=()=>{
    const host=document.querySelector<HTMLElement>('.classPlannerWrapper')!;
    const markup=`<div class="mobileloadmenupanel touchpanelmenu noprint" style="display:none"><div class="message"><ul><li><button type="button">Example saved plan</button></li></ul></div></div>
      <div id="AboutDragger" class="message info" style="display:none"><header><button class="link" onclick="$('#AboutDragger').hide(); $('#aboutMenuEntry').focus(); return false;">Close</button></header><div>Example help</div></div>
      <div id="SaveDragger" class="message info" style="display:none"><header><button class="link" onclick="$('#SaveDragger').hide(); return false;">Close</button></header><div class="row xsmall-collapse"><input id="planNameBox"><textarea aria-label="Example description"></textarea></div><div class="row xsmall-collapse"><input type="hidden"></div><div class="row xsmall-collapse"><input type="submit" id="ctl00_MainContent_SaveButton" onclick="gatherClientSaveValues();"></div></div>
      <div id="ResponseMessageDragger" style="position:absolute;z-index:1000;display:none"><table><tbody><tr><td><button class="link" onclick="$('#ResponseMessageDragger').hide(); return false;">Close</button></td></tr></tbody></table></div>`;
    host.insertAdjacentHTML('beforeend',markup);
    const load=host.querySelector<HTMLElement>('.mobileloadmenupanel')!,about=document.getElementById('AboutDragger')!,save=document.getElementById('SaveDragger')!,response=document.getElementById('ResponseMessageDragger')!;
    const controls=[...document.querySelectorAll<HTMLButtonElement>('.plannerTopMenuLinks > button')],handlers=controls.map(()=>vi.fn());
    const source=["showSave(false); return false;","triggerPostback('2'); return false;","showSave(true); return false;","confirm('Are you sure you want to delete this plan?') && triggerPostback('10'); return false;",'$(".mobileloadmenupanel").toggle(); return false;',"window.print && window.print(); return false;","showAbout(); return false;"];
    controls.forEach((button,index)=>{button.removeAttribute('type');button.setAttribute('onclick',source[index]);button.onclick=()=>{handlers[index]();if(index===0||index===2)save.style.display='block';if(index===4)load.style.display=load.style.display==='none'?'block':'none';if(index===6)about.style.display='block';return false;};});
    for(const panel of [about,save,response])panel.querySelector<HTMLButtonElement>('button.link')!.onclick=()=>{panel.style.display='none';if(panel===about)document.getElementById('aboutMenuEntry')!.focus();return false;};
    return {host,load,about,save,response,controls,handlers};
  };
  it("keeps every native Plan action handler and submitter intact with no automatic actions", () => {
    const {controls,handlers,save,load,about}=planActionPanels(),parents=controls.map(node=>node.parentElement),events=controls.map(node=>node.onclick),attrs=controls.map(node=>node.getAttribute('onclick'));
    const saveButton=document.getElementById('ctl00_MainContent_SaveButton')!,saveParent=saveButton.parentElement,submit=vi.fn();saveButton.addEventListener('click',submit);
    const panels=[save,load,about],panelParents=panels.map(node=>node.parentElement);mount();mount();
    expect(handlers.every(handler=>handler.mock.calls.length===0)).toBe(true);
    const extras=document.querySelector<HTMLDetailsElement>('.pl-workspace-plan-actions')!;extras.open=true;
    controls.forEach((node,index)=>{node.click();expect(handlers[index]).toHaveBeenCalledOnce();});
    expect(controls.every((node,index)=>node.parentElement===parents[index]&&node.onclick===events[index]&&node.getAttribute('onclick')===attrs[index]&&node.form===document.getElementById('aspnetForm'))).toBe(true);
    expect(panels.every((node,index)=>node.parentElement===panelParents[index])).toBe(true);expect(saveButton.parentElement).toBe(saveParent);expect(submit).not.toHaveBeenCalled();
    workspace.restore();expect(load.querySelector('.pl-plan-action-load-close')).toBeNull();expect(controls.every(node=>node.form===document.getElementById('aspnetForm'))).toBe(true);
    expect(panels.every(node=>!node.classList.contains('pl-plan-action-surface'))).toBe(true);
  });
  it.each(['renamePlan','savePlanAsMenuEntry','aboutMenuEntry','loadMenuEntry'])("dismisses %s before the action menu and returns focus to the original trigger", id => {
    const {save,load,about,handlers}=planActionPanels();mount();
    const extras=document.querySelector<HTMLDetailsElement>('.pl-workspace-plan-actions')!;extras.open=true;
    const trigger=document.getElementById(id)!;trigger.click();const panel=id==='loadMenuEntry'?load:id==='aboutMenuEntry'?about:save;
    expect(panel.classList.contains('pl-plan-action-surface-open')).toBe(true);expect(panel.contains(document.activeElement)).toBe(true);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(panel.style.display).toBe('none');expect(extras.open).toBe(true);expect(document.activeElement).toBe(trigger);
    expect(handlers[id==='loadMenuEntry'?4:id==='aboutMenuEntry'?6:id==='renamePlan'?0:2]).toHaveBeenCalledTimes(id==='loadMenuEntry'?2:1);
    trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(extras.open).toBe(false);
  });
  it("restores focus after the original Save close and leaves foreground native dialogs in control", () => {
    const {save}=planActionPanels();mount();const extras=document.querySelector<HTMLDetailsElement>('.pl-workspace-plan-actions')!;extras.open=true;
    document.getElementById('savePlanAsMenuEntry')!.click();const close=save.querySelector<HTMLButtonElement>('button.link')!;close.focus();close.click();
    expect(save.style.display).toBe('none');expect(document.activeElement).toBe(document.getElementById('savePlanAsMenuEntry'));
    document.getElementById('renamePlan')!.click();const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.innerHTML='<button type="button">Example native alert</button>';document.body.append(dialog);
    const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});dialog.firstElementChild!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);expect(save.style.display).toBe('block');expect(extras.open).toBe(true);dialog.remove();
  });
  it.each(['onclick','disabled','formaction','type','hidden','aria-hidden','display'])("does not forward an unrecognized or unavailable native close (%s)", kind => {
    const {save}=planActionPanels();mount();document.getElementById('renamePlan')!.click();const close=save.querySelector<HTMLButtonElement>('button.link')!,handler=vi.fn(()=>false);close.onclick=handler;
    if(kind==='onclick')close.setAttribute('onclick','unknownNativeAction()');else if(kind==='display')close.style.display='none';else close.setAttribute(kind,kind==='type'?'submit':kind==='aria-hidden'?'true':'');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(handler).not.toHaveBeenCalled();expect(save.style.display).toBe('block');
  });
  it("keeps Load close stable through observed mutations, native visibility and restoration", async () => {
    const {load,about,save}=planActionPanels();const native=load.innerHTML;mount();document.getElementById('loadMenuEntry')!.click();
    await new Promise(resolve=>setTimeout(resolve,0));expect(load.querySelectorAll('.pl-plan-action-load-close')).toHaveLength(1);
    expect(about.style.display).toBe('none');expect(save.style.display).toBe('none');load.querySelector<HTMLButtonElement>('.pl-plan-action-load-close')!.click();expect(load.style.display).toBe('none');
    workspace.restore();expect(load.innerHTML).toBe(native);expect(load.getAttribute('style')).toBe('display: none;');
  });
  it("dismisses a newly shown response before the underlying Save panel", async () => {
    const {save,response}=planActionPanels();mount();document.getElementById('renamePlan')!.click();response.style.display='block';
    await new Promise(resolve=>setTimeout(resolve,0));response.querySelector<HTMLButtonElement>('button')!.focus();
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(response.style.display).toBe('none');expect(save.style.display).toBe('block');expect(save.contains(document.activeElement)).toBe(true);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(save.style.display).toBe('none');
  });
  it("keeps secondary module conditions, help, fields and handlers native", () => {
    const section=document.querySelector<HTMLElement>('.classPlanner_ClassOptimizerSection')!,panel=document.getElementById('panelOptimizer')!,help=document.getElementById('HelpOptimizerDiv')!;
    const fields=[...section.querySelectorAll('input,select,button')],parents=fields.map(node=>node.parentElement),html=panel.innerHTML;
    const button=help.querySelector('button')!,handler=vi.fn();button.addEventListener('click',handler);
    section.querySelector('#ctl00_MainContent_toggleOptimizer')?.setAttribute('onclick','unknownOptimizerAction()');
    mount();document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!.click();
    expect(section.classList.contains('pl-module-active')).toBe(true);expect(section.querySelector('.pl-pane-toggle')).toBeNull();expect(panel.classList.contains('hidden')).toBe(true);
    expect(panel.innerHTML).toBe(html);expect(help.parentElement).toBe(section);expect(fields.every((field,i)=>field.parentElement===parents[i]&&field.closest('form')===document.getElementById('aspnetForm'))).toBe(true);
    button.click();expect(handler).toHaveBeenCalledOnce();expect(panel.classList.contains('hidden')).toBe(false);
    document.querySelector<HTMLButtonElement>('button[data-pl-module=personal]')!.click();document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!.click();expect(panel.classList.contains('hidden')).toBe(false);
  });
  it("opens Optimizer only on explicit navigation and preserves the native toggle and handler", () => {
    const native=optimizerToggle(),parent=native.parentElement!,html=native.outerHTML,panel=document.getElementById('panelOptimizer')!,handler=native.onclick;
    mount();mount();expect(optimizerPostback).not.toHaveBeenCalled();
    const nav=document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!;nav.click();
    expect(optimizerPostback).toHaveBeenCalledExactlyOnceWith('ctl00$MainContent$toggleOptimizer','');expect(panel.classList.contains('hidden')).toBe(false);
    expect(native.parentElement).toBe(parent);expect(native.getAttribute('onclick')).toBe("shrink('panelOptimizer'); __doPostBack('ctl00$MainContent$toggleOptimizer','')");
    expect(native.onclick).toBe(handler);
    nav.click();mount();expect(optimizerPostback).toHaveBeenCalledTimes(1);expect(document.querySelector('.pl-optimizer-state')).toBeNull();
    native.click();expect(panel.classList.contains('hidden')).toBe(true);expect(optimizerPostback).toHaveBeenCalledTimes(2);
    nav.click();expect(panel.classList.contains('hidden')).toBe(false);expect(optimizerPostback).toHaveBeenCalledTimes(3);
    native.click();expect(native.outerHTML).toBe(html);workspace.restore();mount();
    expect(document.querySelector('button[data-pl-module=optimizer]')!.getAttribute('aria-pressed')).toBe('true');
    expect(optimizerPostback).toHaveBeenCalledTimes(4);expect(panel.classList.contains('hidden')).toBe(true);
  });
  it("forwards keyboard navigation once and prevents a second click while native opening is pending", async () => {
    optimizerToggle();optimizerShrink.mockImplementation(()=>{});mount();
    const find=document.querySelector<HTMLButtonElement>('button[data-pl-module=find]')!,nav=document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!;
    find.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    expect(optimizerPostback).toHaveBeenCalledTimes(1);expect(document.activeElement).toBe(nav);expect(nav.getAttribute('aria-busy')).toBe('true');
    expect(document.querySelector('.pl-optimizer-state')!.textContent).toContain('Opening Plan Optimizer');
    nav.click();nav.click();mount();expect(optimizerPostback).toHaveBeenCalledTimes(1);
    document.getElementById('panelOptimizer')!.classList.remove('hidden');await Promise.resolve();
    expect(document.querySelector('.pl-optimizer-state')).toBeNull();expect(nav.hasAttribute('aria-busy')).toBe(false);
    nav.click();expect(optimizerPostback).toHaveBeenCalledTimes(1);
  });
  it("clears stale native optimizer loading on redraw without reopening automatically", async () => {
    const native=optimizerToggle();optimizerShrink.mockImplementation(()=>{});mount();
    document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!.click();expect(optimizerPostback).toHaveBeenCalledTimes(1);
    const replacement=native.cloneNode(true) as HTMLButtonElement;nativeOptimizerHandler(replacement);native.replaceWith(replacement);await Promise.resolve();
    expect(document.querySelector('.pl-optimizer-state')).toBeNull();mount();expect(optimizerPostback).toHaveBeenCalledTimes(1);
    document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!.click();expect(optimizerPostback).toHaveBeenCalledTimes(2);
    workspace.restore();expect(document.querySelector('.pl-optimizer-state')).toBeNull();expect(document.querySelector('[aria-busy]')).toBeNull();
    expect(replacement.isConnected).toBe(true);mount();expect(optimizerPostback).toHaveBeenCalledTimes(2);
  });
  it("does not reopen Optimizer when Information Close or Escape restores the selected module", () => {
    document.body.innerHTML=new DOMParser().parseFromString(introductionFixtureHtml(),'text/html').body.innerHTML;
    const native=optimizerToggle();mount();document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!.click();native.click();
    expect(document.getElementById('panelOptimizer')!.classList.contains('hidden')).toBe(true);expect(optimizerPostback).toHaveBeenCalledTimes(2);
    document.querySelector<HTMLButtonElement>('.pl-intro-info')!.click();document.querySelector<HTMLButtonElement>('.pl-intro-info-close')!.click();
    document.querySelector<HTMLButtonElement>('.pl-intro-info')!.click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(optimizerPostback).toHaveBeenCalledTimes(2);expect(document.querySelector('button[data-pl-module=optimizer]')!.getAttribute('aria-pressed')).toBe('true');
  });
  it("keeps empty-plan recognition valid while only owned optimizer loading is pending", () => {
    document.body.innerHTML=new DOMParser().parseFromString(emptyPlanFixtureHtml(),'text/html').body.innerHTML;
    optimizerToggle();optimizerShrink.mockImplementation(()=>{});mount();
    document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!.click();
    expect(optimizerPostback).toHaveBeenCalledTimes(1);expect(document.querySelector('.pl-optimizer-state')).not.toBeNull();
    expect(isKnownEmptyPlanner(document)).toBe(true);expect(workspace.needsReconcile(document)).toBe(false);
  });
  it.each(['handler','disabled','icon','type','foreign-form','foreign-button','extra-child','hidden','aria-hidden','display','visibility'])("keeps the native Optimizer fallback when its %s contract differs", kind => {
    const native=optimizerToggle();mount();
    if(kind==='handler')native.setAttribute('onclick','unknownOptimizerAction()');
    if(kind==='disabled')native.disabled=true;
    if(kind==='icon')native.children[0].className='icon-minus-sign';
    if(kind==='type')native.type='button';
    if(kind==='foreign-form')document.querySelector('form')!.action='https://example.invalid/ClassPlanner/ClassPlan.aspx';
    if(kind==='foreign-button')native.setAttribute('form','foreignForm');
    if(kind==='extra-child')native.append(document.createElement('span'));
    if(kind==='hidden')native.hidden=true;
    if(kind==='aria-hidden')native.setAttribute('aria-hidden','true');
    if(kind==='display')native.style.display='none';
    if(kind==='visibility')native.style.visibility='hidden';
    document.querySelector<HTMLButtonElement>('button[data-pl-module=optimizer]')!.click();
    expect(optimizerPostback).not.toHaveBeenCalled();expect(document.querySelector('.pl-optimizer-state')).toBeNull();
    expect(document.getElementById('panelOptimizer')!.classList.contains('hidden')).toBe(true);
    expect(native.isConnected).toBe(true);expect(native.parentElement!.id).toBe('classOptimizerTitle');
  });
  it("retains the selected module after a native redraw and rejects unknown primary bodies", () => {
    mount();document.querySelector<HTMLButtonElement>('button[data-pl-module=find]')!.click();
    const fixture=new DOMParser().parseFromString(workspaceFixtureHtml(),'text/html');const replacement=document.importNode(fixture.getElementById('ctl00_MainContent_classPlanPanel')!,true);
    document.getElementById('ctl00_MainContent_classPlanPanel')!.replaceWith(replacement);mount();
    expect(document.querySelector('button[data-pl-module=find]')!.getAttribute('aria-pressed')).toBe('true');expect(document.getElementById('ctl00_MainContent_classPlanPanel')).toBe(replacement);
    workspace.restore();document.querySelector('.classPlanner_ClassSearchSection')!.append(document.createElement('div'));
    const before=document.body.innerHTML;mount();expect(document.body.innerHTML).toBe(before);
  });
  it("reopens folded Find classes through navigation without duplicate controls", () => {
    mount();const find=document.querySelector<HTMLButtonElement>('button[data-pl-module=find]')!;find.click();
    document.querySelector<HTMLButtonElement>('.pl-workspace-search .pl-pane-toggle')!.click();expect(document.activeElement).toBe(find);
    find.click();expect(document.querySelector('.pl-workspace-search')!.classList.contains('pl-pane-open')).toBe(true);
    expect(document.querySelector('.pl-workspace-pane-switches')).toBeNull();expect(document.querySelector('.pl-browse-expand')).toBeNull();
  });
  it("keeps native details accessible if their recorded structure changes", () => {
    const header = document.querySelector("table.coursetable tr")!;
    const cell = header.lastElementChild!;
    cell.remove();
    const original = document.body.innerHTML;
    mount(); expect(document.body.innerHTML).toBe(original);
    header.append(cell); mount();
    expect(document.querySelector(".pl-workspace-deck")).not.toBeNull();
    cell.remove(); expect(workspace.needsReconcile(document)).toBe(true);
    mount();
    expect(document.querySelector(".pl-workspace-deck")).toBeNull();
    expect(document.querySelector("table.coursetable")).not.toBeNull();
  });
  it("restores root scrolling after an automatic remount temporarily shortens the page", () => {
    mount();
    let scrollY = 280;
    const scroll = vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    const restore = workspace.restore.bind(workspace);
    const restoreSpy = vi.spyOn(workspace, "restore").mockImplementation(() => {
      restore();
      // Simulate Chrome clamping scroll when removing the fixed workspace spacer.
      scrollY = 0;
    });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((options: ScrollToOptions | number) => {
      expect(document.querySelector(".pl-workspace-deck")).not.toBeNull();
      expect(document.querySelector<HTMLElement>(".pl-workspace-scroll-room")!.style.height).not.toBe("");
      scrollY = typeof options === "number" ? options : options.top || 0;
    });
    try {
      const next = new DOMParser().parseFromString(workspaceFixtureHtml(), "text/html");
      document.getElementById("ctl00_MainContent_classPlanPanel")!.replaceWith(document.importNode(next.getElementById("ctl00_MainContent_classPlanPanel")!, true));
      mount();
      expect(scrollY).toBe(280);
      expect(scrollTo).toHaveBeenCalledOnce();
      scrollTo.mockClear();
      document.querySelector<HTMLButtonElement>(".pl-workspace-original")!.click();
      expect(scrollTo).not.toHaveBeenCalled();
      expect(document.querySelector(".pl-workspace-deck")).toBeNull();
    } finally {
      restoreSpy.mockRestore(); scrollTo.mockRestore(); scroll.mockRestore();
    }
  });
  it("remounts a native panel redraw without reviving old sections", () => {
    mount(); document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!.click();
    const fixture = new DOMParser().parseFromString(workspaceFixtureHtml(), "text/html");
    const next = document.importNode(fixture.getElementById("ctl00_MainContent_classPlanPanel")!, true);
    document.getElementById("ctl00_MainContent_classPlanPanel")!.replaceWith(next);
    expect(workspace.needsReconcile(document)).toBe(true);
    mount();
    expect(document.querySelectorAll(".pl-workspace-deck")).toHaveLength(1);
    expect(document.querySelectorAll("#panelPlan")).toHaveLength(1);
    expect(document.querySelectorAll(".pl-workspace-preview")).toHaveLength(1);
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(true);
    expect(adapter.inspectContract().ok).toBe(true);
    expect(workspace.needsReconcile(document)).toBe(false);
  });
  it("compacts the known introduction without moving the term or changing UCLA navigation", () => {
    document.body.innerHTML = new DOMParser().parseFromString(introductionFixtureHtml(), "text/html").body.innerHTML;
    const original = document.body.innerHTML, nav = document.getElementById('fixture-native-navigation')!;
    const navHtml = nav.outerHTML, term = document.getElementById('ctl00_MainContent_termSessionChooser_TermChooser')!;
    const termParent = term.parentElement, fields = [...document.querySelectorAll('input,select')];
    const text = document.getElementById('page_title_text')!, textHtml = text.innerHTML;
    mount(); mount();
    expect(nav.outerHTML).toBe(navHtml); expect(term.parentElement).toBe(termParent);
    expect(new Set([...document.querySelectorAll('input,select')].filter(node=>!node.closest('[data-planner-lift-owned]')))).toEqual(new Set(fields));
    const about = document.querySelector<HTMLDetailsElement>('.pl-intro-about')!;
    expect(about.open).toBe(false); expect(text.parentElement).toBe(about); expect(text.innerHTML).toBe(textHtml);
    expect(document.querySelectorAll('.pl-intro-term-label')).toHaveLength(1);
    expect(document.querySelectorAll('.pl-intro-notice')).toHaveLength(2);
    workspace.restore(); expect(document.body.innerHTML).toBe(original);
  });
  it("keeps every sidebar widget accessible with close and Escape returning focus", () => {
    document.body.innerHTML = new DOMParser().parseFromString(introductionFixtureHtml(), "text/html").body.innerHTML;
    const sidebar = document.querySelector('right-sidebar')!, parent = sidebar.parentElement;
    const widgets = [...sidebar.children], help = sidebar.querySelector<HTMLButtonElement>('button')!, handler = vi.fn();
    help.addEventListener('click', handler); mount();
    const info = document.querySelector<HTMLButtonElement>('.pl-intro-info')!;
    document.querySelector<HTMLButtonElement>('button[data-pl-module=personal]')!.click();
    const main=document.querySelector<HTMLElement>('.pl-workspace-main')!,bounds=vi.spyOn(main,'getBoundingClientRect').mockReturnValue({left:188,top:140,width:660,height:580} as DOMRect);
    info.click(); expect(sidebar.classList.contains('pl-intro-sidebar-open')).toBe(true);
    expect(info.closest('.pl-workspace-nav-footer')).not.toBeNull();expect(info.getAttribute('aria-pressed')).toBe('true');
    expect((sidebar as HTMLElement).style.getPropertyValue('--pl-info-width')).toBe('660px');
    expect(info.getAttribute('aria-expanded')).toBe('true'); expect(sidebar.parentElement).toBe(parent);
    help.click(); expect(handler).toHaveBeenCalledOnce();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(document.querySelector('button[data-pl-module=personal]')!.getAttribute('aria-pressed')).toBe('true');
    expect(info.getAttribute('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(info);
    info.click(); document.querySelector<HTMLButtonElement>('.pl-intro-info-close')!.click();
    expect(document.activeElement).toBe(info);bounds.mockRestore(); workspace.restore(); expect([...sidebar.children]).toEqual(widgets);
    expect((sidebar as HTMLElement).getAttribute('style')).toBeNull();
  });
  it.each([false,true])("temporarily reveals original introduction text for printing then restores open=%s", open => {
    document.body.innerHTML=new DOMParser().parseFromString(introductionFixtureHtml(),'text/html').body.innerHTML;mount();
    const about=document.querySelector<HTMLDetailsElement>('.pl-intro-about')!;about.open=open;
    window.dispatchEvent(new Event('beforeprint'));window.dispatchEvent(new Event('beforeprint'));expect(about.open).toBe(true);
    window.dispatchEvent(new Event('afterprint'));expect(about.open).toBe(open);
    workspace.restore();about.open=false;window.dispatchEvent(new Event('beforeprint'));expect(about.open).toBe(false);
  });
  it("compacts and restores the banner by scrolling while preserving native navigation", () => {
    document.body.innerHTML = new DOMParser().parseFromString(introductionFixtureHtml(), "text/html").body.innerHTML;
    const nav = document.getElementById('fixture-native-navigation')!, navHtml = nav.outerHTML;
    const title = document.getElementById('titleText')!;
    let scrollY = 0;
    const scroll = vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
    const bounds = vi.spyOn(title, 'getBoundingClientRect').mockImplementation(() => ({top: 178 - scrollY}) as DOMRect);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((options: ScrollToOptions | number) => {
      scrollY = typeof options === 'number' ? options : options.top || 0;
      window.dispatchEvent(new Event('scroll'));
    });
    try {
      mount(); const button = document.querySelector<HTMLButtonElement>('.pl-intro-header-toggle')!;
      expect(button.type).toBe('button'); expect(button.textContent).toBe('Compact header');
      button.click(); expect(scrollY).toBe(166); expect(button.textContent).toBe('Show header');
      expect(button.getAttribute('aria-pressed')).toBe('true'); expect(document.activeElement).toBe(button);
      expect(nav.outerHTML).toBe(navHtml); expect(document.getElementById('fixture-native-navigation')).toBe(nav);
      button.click(); expect(scrollY).toBe(0); expect(button.textContent).toBe('Compact header');
      expect(nav.outerHTML).toBe(navHtml); workspace.restore(); expect(button.isConnected).toBe(false);
    } finally { scrollTo.mockRestore(); bounds.mockRestore(); scroll.mockRestore(); }
  });
  it("leaves unfamiliar introductions native and preserves replacement text on reconciliation", () => {
    document.body.innerHTML = new DOMParser().parseFromString(introductionFixtureHtml(), "text/html").body.innerHTML;
    const sidebar = document.querySelector('right-sidebar')!; sidebar.remove(); mount();
    expect(document.querySelector('.pl-intro-about')).toBeNull(); expect(document.querySelector('.pl-intro-info')).toBeNull();
    workspace.restore(); document.querySelector('layout-columnwrapper')!.append(sidebar); mount();
    const old = document.getElementById('page_title_text')!, next = old.cloneNode(true) as HTMLElement;
    next.textContent = 'New example introduction'; old.replaceWith(next);
    expect(workspace.needsReconcile(document)).toBe(true); mount();
    expect(document.getElementById('page_title_text')).toBe(next); expect(old.isConnected).toBe(false);
    workspace.restore(); expect(next.parentElement?.id).toBe('div_page_title_section2');
    expect(document.querySelectorAll('#page_title_text')).toHaveLength(1);
  });
});
