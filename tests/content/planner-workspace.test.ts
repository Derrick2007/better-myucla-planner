// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerWorkspace } from "../../src/content/planner-workspace";
import { MyUclaPlannerAdapter } from "../../src/adapters/myucla-adapter";
// @ts-expect-error Shared browser fixture is plain JavaScript.
import { workspaceFixtureHtml, introductionFixtureHtml } from "../../harness/workspace-fixture.mjs";

describe("one-page native planner workspace", () => {
  let workspace: PlannerWorkspace;
  let adapter: MyUclaPlannerAdapter;
  const mount = () => workspace.reconcile(document, adapter.inspectContract().courses);
  beforeEach(() => {
    const fixture = new DOMParser().parseFromString(workspaceFixtureHtml(), "text/html");
    document.body.innerHTML = fixture.body.innerHTML;
    workspace = new PlannerWorkspace(); adapter = new MyUclaPlannerAdapter(document);
    expect(adapter.inspectContract().ok).toBe(true);
  });
  afterEach(() => workspace.restore());

  it("keeps the original form, inputs, course order and native handlers", () => {
    const form = document.querySelector("form");
    const fields = [...document.querySelectorAll("input,select")];
    const commands = [...document.querySelectorAll(".OrderingButtons button")];
    const courses = adapter.inspectContract().courses;
    mount(); mount();
    expect(document.querySelectorAll(".pl-workspace-deck > section")).toHaveLength(3);
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
    const find=document.querySelector<HTMLButtonElement>('[data-pl-task-view="find"]')!;find.click();
    expect(actions.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(find);
    document.querySelector<HTMLButtonElement>('[data-pl-task-view="plan"]')!.click();actions.click();
    document.querySelector<HTMLButtonElement>('.pl-workspace-plan .pl-pane-toggle')!.click();
    expect(actions.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(document.querySelector('.pl-workspace-pane-switches button'));
  });
  it.each(['actions','details'] as const)("dismisses foreground Tools before the background class %s", kind => {
    mount();
    const trigger=document.querySelector<HTMLButtonElement>(kind==='actions'?'[data-pl-workspace-actions]':'[data-pl-workspace-details]')!;trigger.click();
    const tools=document.querySelector<HTMLDetailsElement>('.pl-workspace-extras')!,summary=tools.querySelector('summary')!;
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
  it.each(['body','section'] as const)("reveals newly opened Details in the scrolling Plan %s without moving the document", kind => {
    mount();
    const section=document.querySelector<HTMLElement>('.pl-workspace-plan')!;
    const body=document.getElementById('panelPlan')!;
    const container=kind==='body'?body:section;
    container.style.overflowY='auto';container.scrollTop=40;
    const preview=document.querySelector<HTMLElement>('.pl-workspace-preview')!;
    const close=preview.querySelector<HTMLElement>('.pl-workspace-preview-close')!;
    const head=preview.querySelector<HTMLElement>('.pl-workspace-preview-head')!;
    const rect=(top:number,bottom:number)=>({top,bottom,height:bottom-top,left:0,right:320,width:320,x:0,y:top,toJSON:()=>({})}) as DOMRect;
    const spies=[
      vi.spyOn(container,'clientHeight','get').mockReturnValue(200),
      vi.spyOn(container,'scrollHeight','get').mockReturnValue(600),
      vi.spyOn(container,'getBoundingClientRect').mockReturnValue(rect(100,300)),
      vi.spyOn(document.getElementById('plannerSectionClip')!,'getBoundingClientRect').mockReturnValue(rect(100,140)),
      vi.spyOn(head,'getBoundingClientRect').mockReturnValue(rect(280,316)),
      vi.spyOn(close,'getBoundingClientRect').mockReturnValue(rect(288,324)),
      vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
    ];
    try {
      const details=document.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!;details.click();
      expect(container.scrollTop).toBe(72);expect(document.activeElement).toBe(close);
      expect(spies[spies.length-1]).not.toHaveBeenCalled();
      container.scrollTop=120;window.dispatchEvent(new Event('resize'));
      expect(container.scrollTop).toBe(120);
      close.click();expect(document.activeElement).toBe(details);
    } finally {spies.forEach(spy=>spy.mockRestore());}
  });
  it("restores native sections, term and tools exactly", () => {
    const original = document.body.innerHTML;
    mount(); document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!.click(); workspace.restore();
    expect(document.body.innerHTML).toBe(original);
  });
  it("keeps the schedule and original navigation interactive while details are inline", () => {
    mount();
    const details = document.querySelector<HTMLButtonElement>("[data-pl-workspace-details]")!;
    const native = document.querySelector<HTMLButtonElement>('#fixture-native-navigation button')!;
    const handler = vi.fn(); native.addEventListener('click', handler);
    details.click(); native.click();
    expect(handler).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(false);
    expect(document.querySelector('.pl-workspace-detail-backdrop')).toBeNull();
    document.querySelector<HTMLButtonElement>('.pl-workspace-pane-switches button:nth-child(2)')!.click();
    expect(document.querySelector<HTMLElement>(".pl-workspace-preview")!.hidden).toBe(false);
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
    expect(separators[0].getAttribute('aria-valuenow')).toBe('376');
    separators[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
    expect(separators[0].getAttribute('aria-valuenow')).toBe('480');
    separators[0].dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
    expect(separators[0].getAttribute('aria-valuenow')).toBe('360');
    expect([...document.querySelectorAll(".ClassSearchWidget input,.ClassSearchWidget select")]).toEqual(controls);
    expect(controls.every(node=>node.closest('form')===document.getElementById('aspnetForm'))).toBe(true);
    workspace.restore(); expect(document.querySelector('[role="separator"]')).toBeNull();
  });
  it("changes tasks without replacing native inputs or submitting, and restores focus with Escape", () => {
    mount();
    const plan=document.querySelector<HTMLButtonElement>('[data-pl-task-view="plan"]')!;
    const find=document.querySelector<HTMLButtonElement>('[data-pl-task-view="find"]')!;
    const nativeForm=document.querySelector('form')!,input=document.querySelector<HTMLInputElement>('#searchTier0')!;
    const controls=[...document.querySelectorAll('.ClassSearchWidget input,.ClassSearchWidget select')];
    input.value='Example query';
    const submit=vi.fn();nativeForm.addEventListener('submit',submit);
    expect(plan.getAttribute('aria-pressed')).toBe('true');expect(find.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.pl-workspace-deck')!.classList.contains('pl-task-plan')).toBe(true);
    expect(document.querySelector('.pl-workspace-top > .pl-workspace-pane-switches')).toBeNull();
    expect(document.querySelector('.pl-browse-expand')).toBeNull();
    expect(document.querySelector('.pl-workspace-original')!.closest('.pl-workspace-extra-content')).not.toBeNull();
    find.click();
    expect(document.querySelector('.pl-workspace-deck')!.classList.contains('pl-task-find')).toBe(true);
    expect(plan.getAttribute('aria-pressed')).toBe('false');expect(find.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector<HTMLElement>('[role="separator"]')!.hidden).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(document.querySelector('.pl-workspace-deck')!.classList.contains('pl-task-plan')).toBe(true);
    expect(document.activeElement).toBe(find);expect(input.value).toBe('Example query');
    expect([...document.querySelectorAll('.ClassSearchWidget input,.ClassSearchWidget select')]).toEqual(controls);
    expect(controls.every(control=>control.closest('form')===nativeForm)).toBe(true);
    expect(submit).not.toHaveBeenCalled();expect(adapter.inspectContract().ok).toBe(true);
  });
  it("supports task keyboard navigation and respects a native consumed Escape", () => {
    mount();
    const plan=document.querySelector<HTMLButtonElement>('[data-pl-task-view="plan"]')!;
    const find=document.querySelector<HTMLButtonElement>('[data-pl-task-view="find"]')!;
    plan.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    expect(find.getAttribute('aria-pressed')).toBe('true');expect(document.activeElement).toBe(find);
    const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});escape.preventDefault();
    document.dispatchEvent(escape);expect(find.getAttribute('aria-pressed')).toBe('true');
    find.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
    expect(plan.getAttribute('aria-pressed')).toBe('true');expect(document.activeElement).toBe(plan);
  });
  it("leaves the first Escape to an open native autocomplete", () => {
    mount();
    const find=document.querySelector<HTMLButtonElement>('[data-pl-task-view="find"]')!;find.click();
    const input=document.querySelector<HTMLInputElement>('#searchTier0')!;
    const menu=document.createElement('ul');menu.className='ui-autocomplete';menu.innerHTML='<li>Example subject</li>';document.body.append(menu);
    try {
      const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});input.dispatchEvent(escape);
      expect(find.getAttribute('aria-pressed')).toBe('true');expect(escape.defaultPrevented).toBe(false);
      menu.style.display='none';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      expect(find.getAttribute('aria-pressed')).toBe('false');expect(document.activeElement).toBe(find);
    } finally {menu.remove();}
  });
  it("lists all three other native sections and restores every section in original layout", () => {
    const sections = [...document.querySelectorAll("#ctl00_MainContent_classPlanPanel > section")];
    mount();
    expect(document.querySelector(".pl-workspace-extras > summary")!.textContent).toBe("Tools (3)");
    expect([...document.querySelectorAll(".pl-workspace-section-links button")].map(n=>n.textContent)).toEqual(["Plan Optimizer","Study list outside this plan","Personal Entries"]);
    const extras = document.querySelector<HTMLDetailsElement>(".pl-workspace-extras")!;
    extras.open = true;
    document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true}));
    expect(extras.open).toBe(false);
    document.querySelector<HTMLButtonElement>(".pl-workspace-original")!.click();
    expect([...document.querySelectorAll("#ctl00_MainContent_classPlanPanel > section")]).toEqual(sections);
    document.querySelector<HTMLButtonElement>(".pl-workspace-return")!.click();
    expect(document.querySelectorAll(".pl-workspace-deck > section")).toHaveLength(3);
    expect(document.querySelectorAll(".pl-workspace-extra-content > section")).toHaveLength(3);
  });
  it.each([false,true])("temporarily discloses Tools for printing and restores its prior open=%s choice", open => {
    mount();
    const extras=document.querySelector<HTMLDetailsElement>('.pl-workspace-extras')!;extras.open=open;
    const modules=[...extras.querySelectorAll('section')];
    window.dispatchEvent(new Event('beforeprint'));expect(extras.open).toBe(true);
    window.dispatchEvent(new Event('beforeprint'));expect(extras.open).toBe(true);
    window.dispatchEvent(new Event('afterprint'));expect(extras.open).toBe(open);
    window.dispatchEvent(new Event('afterprint'));expect(extras.open).toBe(open);
    expect([...extras.querySelectorAll('section')]).toEqual(modules);
  });
  it("restores the Tools choice and removes print handlers when disposing during printing", () => {
    mount();
    const extras=document.querySelector<HTMLDetailsElement>('.pl-workspace-extras')!;
    window.dispatchEvent(new Event('beforeprint'));expect(extras.open).toBe(true);
    workspace.restore();expect(extras.open).toBe(false);
    window.dispatchEvent(new Event('beforeprint'));expect(extras.open).toBe(false);
    extras.open=true;window.dispatchEvent(new Event('afterprint'));expect(extras.open).toBe(true);
    expect(document.querySelectorAll('#ctl00_MainContent_classPlanPanel > section')).toHaveLength(6);
  });
  it.each([1920,960,390])("keeps native details inline at %ipx and closes them before Find classes", width => {
    const descriptor=Object.getOwnPropertyDescriptor(window,'innerWidth');
    Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
    try {
      mount();
      const course=adapter.inspectContract().courses[0],row=course.node.children[2],parent=row.parentElement;
      const nativeFields=[...row.querySelectorAll('input,select,button')];
      course.node.querySelector<HTMLButtonElement>('[data-pl-workspace-details]')!.click();
      const preview=document.querySelector<HTMLElement>('.pl-workspace-preview')!;
      expect(preview.hidden).toBe(false);expect(row.contains(preview)).toBe(true);
      expect(course.node.classList.contains('pl-preview-inline')).toBe(true);
      expect(document.querySelector('.pl-workspace-calendar')!.classList.contains('pl-pane-open')).toBe(true);
      expect(document.querySelector('.pl-workspace-deck')!.classList.contains('pl-task-plan')).toBe(true);
      const find=document.querySelector<HTMLButtonElement>('[data-pl-task-view="find"]')!;find.click();
      expect(preview.hidden).toBe(true);expect(document.querySelector('.pl-workspace-preview-card')).toBeNull();
      expect(document.querySelector('.pl-workspace-deck')!.classList.contains('pl-task-find')).toBe(true);
      expect(row.parentElement).toBe(parent);expect([...row.querySelectorAll('input,select,button')]).toEqual(nativeFields);
      expect(document.activeElement).toBe(find);
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
    expect(document.querySelectorAll('.pl-workspace-deck > section')).toHaveLength(3);
    expect(adapter.inspectContract().ok).toBe(true);
  });
  it("leaves an unknown native section structure untouched", () => {
    document.getElementById("classSearchTitle")!.id = "unexpectedSearchTitle";
    const original = document.body.innerHTML;
    mount();
    expect(document.body.innerHTML).toBe(original);
  });
  it("folds locally once, reclaims columns and keeps a keyboard-accessible reopening route", () => {
    const title = document.getElementById("plannerSectionClip")!;
    const native = title.querySelector<HTMLButtonElement>("button.planSectionToggle")!;
    const handler = vi.fn(); native.addEventListener("click", handler);
    const body = document.getElementById("panelPlan")!;
    const bodyStyle = body.getAttribute("style");
    mount();
    const reopen = document.querySelector<HTMLButtonElement>('.pl-workspace-pane-switches button:nth-child(1)')!;
    native.click();
    expect(handler).not.toHaveBeenCalled();
    expect(body.parentElement!.classList.contains("pl-pane-collapsed")).toBe(true);
    expect(document.activeElement).toBe(reopen);
    expect(reopen.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector<HTMLElement>(".pl-workspace-deck")!.style.getPropertyValue("--pl-workspace-columns")).not.toContain("360px");
    reopen.click();
    expect(body.parentElement!.classList.contains("pl-pane-open")).toBe(true);
    expect(body.getAttribute("style")).toBe(bodyStyle);
    expect(native.getAttribute("onclick")).toBeNull();
    workspace.restore(); native.click(); expect(handler).toHaveBeenCalledOnce();
  });
  it("can reopen both Plan panes after closing them and keeps the native top menus in place", () => {
    const term = document.getElementById("ctl00_MainContent_termSessionChooser")!;
    const menu = document.querySelector(".plannerTopMenuLinks")!;
    const menuParent = menu.parentElement, termParent = term.parentElement;
    const menuNext = menu.nextSibling, termNext = term.nextSibling;
    mount();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".pl-workspace-pane-switches button")];
    buttons.forEach(button=>button.click());
    expect(document.querySelector<HTMLElement>(".pl-workspace-empty")!.hidden).toBe(false);
    expect(document.querySelectorAll(".pl-workspace-deck > section.pl-pane-collapsed")).toHaveLength(2);
    buttons.forEach(button=>button.click());
    expect(document.querySelector<HTMLElement>(".pl-workspace-empty")!.hidden).toBe(true);
    expect(document.querySelectorAll(".pl-workspace-deck > section.pl-pane-open")).toHaveLength(3);
    expect(menu.parentElement).toBe(menuParent); expect(term.parentElement).toBe(termParent);
    expect(menu.nextSibling).not.toBe(menuNext); // Only the owned control row was inserted before the panel.
    workspace.restore(); expect(menu.nextSibling).toBe(menuNext); expect(term.nextSibling).toBe(termNext);
  });
  it("opens a folded secondary module through its shortcut without invoking native handlers", () => {
    const section = document.querySelector<HTMLElement>(".classPlanner_PersonalTimeBlocksSection")!;
    const body = section.children[1] as HTMLElement; body.style.display = "none";
    mount();
    const toggle = section.querySelector<HTMLButtonElement>(".pl-pane-toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    document.querySelector<HTMLButtonElement>(".pl-workspace-section-links button:last-child")!.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(toggle);
    toggle.click(); expect(toggle.getAttribute("aria-expanded")).toBe("false");
    workspace.restore(); expect(body.style.display).toBe("none");
  });
  it("retains the task and folded Plan panes after a native redraw and rejects unknown body shapes", () => {
    mount();
    document.querySelector<HTMLButtonElement>('.pl-workspace-pane-switches button:first-child')!.click();
    document.querySelector<HTMLButtonElement>('[data-pl-task-view="find"]')!.click();
    const fixture=new DOMParser().parseFromString(workspaceFixtureHtml(),"text/html");
    document.getElementById("ctl00_MainContent_classPlanPanel")!.replaceWith(document.importNode(fixture.getElementById("ctl00_MainContent_classPlanPanel")!,true));
    mount();
    expect(document.querySelector('.pl-workspace-deck')!.classList.contains('pl-task-find')).toBe(true);
    expect(document.querySelector('[data-pl-task-view="find"]')!.getAttribute('aria-pressed')).toBe('true');
    document.querySelector<HTMLButtonElement>('[data-pl-task-view="plan"]')!.click();
    expect(document.querySelector('.pl-workspace-plan')!.classList.contains('pl-pane-collapsed')).toBe(true);
    expect(document.querySelector('.pl-workspace-calendar')!.classList.contains('pl-pane-open')).toBe(true);
    workspace.restore();
    document.querySelector('.classPlanner_ClassSearchSection')!.append(document.createElement('div'));
    const before=document.body.innerHTML;mount();expect(document.body.innerHTML).toBe(before);
  });
  it("reopens a folded search using Find classes without exposing a duplicate Browse control", () => {
    mount();
    const find=document.querySelector<HTMLButtonElement>('[data-pl-task-view="find"]')!;find.click();
    document.querySelector<HTMLButtonElement>('.pl-workspace-search .pl-pane-toggle')!.click();
    expect(document.activeElement).toBe(find);
    expect(document.querySelector<HTMLElement>('.pl-workspace-empty')!.hidden).toBe(false);
    expect(document.querySelector<HTMLDetailsElement>('.pl-workspace-extras')!.open).toBe(false);
    expect(find.getAttribute('aria-pressed')).toBe('true');
    find.click();
    expect(document.querySelector<HTMLElement>('.pl-workspace-empty')!.hidden).toBe(true);
    expect(document.querySelector('.pl-workspace-search')!.classList.contains('pl-pane-open')).toBe(true);
    expect([...document.querySelectorAll('.pl-workspace-pane-switches button')].map(button=>button.textContent)).toEqual(['My classes','Schedule']);
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
    info.click(); expect(sidebar.classList.contains('pl-intro-sidebar-open')).toBe(true);
    expect(info.getAttribute('aria-expanded')).toBe('true'); expect(sidebar.parentElement).toBe(parent);
    help.click(); expect(handler).toHaveBeenCalledOnce();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(info.getAttribute('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(info);
    info.click(); document.querySelector<HTMLButtonElement>('.pl-intro-info-close')!.click();
    expect(document.activeElement).toBe(info); workspace.restore(); expect([...sidebar.children]).toEqual(widgets);
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
