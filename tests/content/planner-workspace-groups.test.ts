// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {PlannerWorkspace} from "../../src/content/planner-workspace";
import {MyUclaPlannerAdapter} from "../../src/adapters/myucla-adapter";
import {createDefaultGroups,mergeWorkspaceTab,selectWorkspaceTab,type WorkspacePanelId} from "../../src/content/workspace-groups";
import {normalizeWorkspaceLayout} from "../../src/storage/workspace-layout";
// @ts-expect-error Shared production-browser fixture is JavaScript.
import {introductionFixtureHtml} from "../../harness/workspace-fixture.mjs";

describe("native planner tab groups",()=>{
  let workspace:PlannerWorkspace,adapter:MyUclaPlannerAdapter;
  const save=vi.fn(),nativeAction=vi.fn();
  const el=(selector:string)=>document.querySelector<HTMLElement>(selector)!;
  const click=(selector:string)=>(el(selector) as HTMLButtonElement).click();
  const tab=(id:WorkspacePanelId)=>el(`[data-pl-tab=${id}]`);
  const active=(id:WorkspacePanelId)=>tab(id).getAttribute('aria-selected')==='true';
  const pane=(id:WorkspacePanelId)=>el(`[data-pl-panel-placement]:has(> .pl-pane-title [data-pl-panel-handle=${id}])`);
  const rect=(left:number,top:number,width:number,height:number)=>({left,top,width,height,right:left+width,bottom:top+height,x:left,y:top,toJSON(){}});
  const mount=()=>{
    workspace.reconcile(document,adapter.inspectContract().courses);
    const deck=el('.pl-workspace-deck');
    Object.defineProperty(deck,'clientWidth',{value:1400,configurable:true});
    vi.spyOn(deck,'getBoundingClientRect').mockReturnValue(rect(180,120,1400,700));
    window.dispatchEvent(new Event('resize'));
  };
  const key=(id:WorkspacePanelId,key:string,options:KeyboardEventInit={})=>tab(id).dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));
  const pointer=(node:EventTarget,type:string,x:number,y:number)=>{
    const event=new MouseEvent(type,{button:0,clientX:x,clientY:y,bubbles:true,cancelable:true});
    Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true}});node.dispatchEvent(event);
  };
  beforeEach(()=>{
    document.body.innerHTML=new DOMParser().parseFromString(introductionFixtureHtml(),'text/html').body.innerHTML;
    vi.stubGlobal('innerWidth',1700);save.mockClear();nativeAction.mockClear();
    document.querySelectorAll('button,input,a').forEach(control=>control.addEventListener('click',nativeAction));
    document.querySelector('form')!.addEventListener('submit',event=>event.preventDefault());
    workspace=new PlannerWorkspace(()=>{},save);adapter=new MyUclaPlannerAdapter(document);
  });
  afterEach(()=>{workspace.restore();vi.restoreAllMocks();vi.unstubAllGlobals();});

  it('opens one native pane per dock while switching sibling tabs without replacing controls',()=>{
    const controls=[...document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')];
    const parents=controls.map(control=>control.parentElement),forms=controls.map(control=>control.form);
    mount();expect(active('classes')).toBe(true);expect(active('find')).toBe(false);expect(active('schedule')).toBe(true);
    expect([...document.querySelectorAll<HTMLElement>('.pl-workspace-group-strip')].filter(strip=>!strip.hidden).map(strip=>strip.dataset.plGroup)).toEqual(['main','right']);
    click('[data-pl-tab=find]');expect(active('find')).toBe(true);expect(active('classes')).toBe(false);
    expect(pane('find').classList.contains('pl-module-active')).toBe(true);expect(pane('classes').classList.contains('pl-group-inactive')).toBe(true);
    expect(pane('schedule').classList.contains('pl-module-active')).toBe(true);
    click('[data-pl-tab=classes]');expect(active('classes')).toBe(true);
    expect([...document.querySelectorAll('input,select')].filter(control=>!control.closest('[data-planner-lift-owned]'))).toEqual(controls);
    expect(controls.every((control,index)=>control.parentElement===parents[index]&&control.form===forms[index])).toBe(true);
    expect(nativeAction).not.toHaveBeenCalled();expect(adapter.inspectContract().ok).toBe(true);
  });

  it('reopens migrated Find beside Classes repeatedly without making a third dock or evicting Schedule',async()=>{
    workspace.setSavedLayout(normalizeWorkspaceLayout({version:1,panels:[{id:'classes',placement:'right'},{id:'find',placement:'main',hidden:true},{id:'schedule',placement:'left'}],module:'classes',mainModule:'classes'}));
    mount();
    for(let n=0;n<3;n++){
      click('button[data-pl-module=find]');expect(pane('find').dataset.plPanelPlacement).toBe('right');expect(active('find')).toBe(true);expect(active('classes')).toBe(false);
      expect(pane('schedule').dataset.plPanelPlacement).toBe('left');expect(active('schedule')).toBe(true);
      expect([...document.querySelectorAll<HTMLElement>('.pl-workspace-group-strip')].filter(strip=>!strip.hidden)).toHaveLength(2);
      click('[data-pl-tab-close=find]');expect(active('classes')).toBe(true);
    }
    await Promise.resolve();expect(save.mock.calls.at(-1)![0].groups.panels.find).toEqual({placement:'right',open:false});
    expect(nativeAction).not.toHaveBeenCalled();
  });

  it('restores active grouped tabs without expanding a closed native Optimizer or changing native values',async()=>{
    const groups=selectWorkspaceTab(createDefaultGroups(),'optimizer');
    workspace.setSavedLayout(normalizeWorkspaceLayout({version:2,groups,panels:[],module:'optimizer',mainModule:'optimizer'}));
    const input=el('#searchTier0') as HTMLInputElement;input.value='Fictional pending search';
    el('#classOptimizerTitle').innerHTML='<button id="ctl00_MainContent_toggleOptimizer" class="planSectionToggle link" onclick="shrink(\'panelOptimizer\'); __doPostBack(\'ctl00$MainContent$toggleOptimizer\',\'\')"><i class="icon-plus-sign"></i><label>Plan Optimizer</label></button>';
    const toggle=el('#ctl00_MainContent_toggleOptimizer') as HTMLButtonElement;
    toggle.onclick=()=>{nativeAction();return false;};
    const optimizer=el('#panelOptimizer'),parent=optimizer.parentElement,handler=toggle.onclick;optimizer.classList.add('hidden');
    mount();await Promise.resolve();
    expect(active('optimizer')).toBe(true);expect(pane('optimizer').classList.contains('pl-module-active')).toBe(true);
    expect(optimizer.classList.contains('hidden')).toBe(true);expect(optimizer.parentElement).toBe(parent);
    expect((el('#ctl00_MainContent_toggleOptimizer') as HTMLButtonElement).onclick).toBe(handler);
    expect(input.value).toBe('Fictional pending search');expect(nativeAction).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
  });

  it('closes an active tab to its sibling and preserves keyboard focus and reopening',()=>{
    mount();click('[data-pl-tab=find]');tab('find').focus();key('find','Delete');
    expect(active('classes')).toBe(true);expect(pane('find').classList.contains('pl-panel-hidden')).toBe(true);
    expect(document.activeElement?.closest('[hidden],.pl-panel-hidden')).toBeNull();
    click('button[data-pl-module=find]');expect(active('find')).toBe(true);
    key('find','ArrowLeft');expect(document.activeElement).toBe(tab('classes'));expect(active('classes')).toBe(true);
    key('classes','End');expect(document.activeElement).toBe(tab('find'));expect(active('find')).toBe(true);
    expect(nativeAction).not.toHaveBeenCalled();
  });

  it('cancels tab detachment before a frame and never saves the transient group selection',async()=>{
    mount();click('.pl-navigation-toggle');await Promise.resolve();const before=save.mock.calls.at(-1)![0].groups;save.mockClear();
    pointer(tab('find'),'pointerdown',300,130);pointer(document,'pointermove',330,165);
    expect(pane('find').dataset.plPanelPlacement).toBe('floating');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(pane('find').dataset.plPanelPlacement).toBe('main');expect(active('classes')).toBe(true);expect(active('find')).toBe(false);
    await Promise.resolve();expect(save).not.toHaveBeenCalled();
    click('.pl-navigation-toggle');await Promise.resolve();expect(save.mock.calls.at(-1)![0].groups).toEqual(before);
    expect(nativeAction).not.toHaveBeenCalled();
  });

  it('conceals projected details behind sibling tabs and Information while retaining their native rows',()=>{
    mount();const course=adapter.inspectContract().courses[0],row=course.node.children[2],parent=row.parentElement;
    click('[data-pl-workspace-details]');expect(course.node.classList.contains('pl-details-concealed')).toBe(false);
    click('[data-pl-tab=find]');expect(course.node.classList.contains('pl-details-concealed')).toBe(true);
    click('[data-pl-tab=classes]');expect(course.node.classList.contains('pl-details-concealed')).toBe(false);
    click('.pl-intro-info');expect(course.node.classList.contains('pl-details-concealed')).toBe(true);
    click('.pl-intro-info-close');expect(course.node.classList.contains('pl-details-concealed')).toBe(false);
    expect(course.node.children[2]).toBe(row);expect(row.parentElement).toBe(parent);expect(document.querySelectorAll('.pl-workspace-detail-space')).toHaveLength(1);
    expect(nativeAction).not.toHaveBeenCalled();
  });

  it('retains floating Details when Classes becomes an inactive sibling',()=>{
    mount();click('[data-pl-workspace-details]');
    el('.pl-panel-details-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'f',altKey:true,shiftKey:true,bubbles:true,cancelable:true}));
    click('[data-pl-tab=find]');const course=adapter.inspectContract().courses[0];
    expect(el('.pl-workspace-details-frame').dataset.plPanelPlacement).toBe('floating');
    expect(course.node.classList.contains('pl-details-concealed')).toBe(false);expect(pane('classes').classList.contains('pl-details-only')).toBe(true);
    expect(nativeAction).not.toHaveBeenCalled();
  });

  it('Default layout restores the quiet default tab groups without resetting native selections',async()=>{
    const groups=mergeWorkspaceTab(selectWorkspaceTab(createDefaultGroups(),'personal'),'classes','right');
    workspace.setSavedLayout(normalizeWorkspaceLayout({version:2,groups,panels:[],module:'personal',mainModule:'personal',navigationCollapsed:true,dockSizes:{right:710}}));
    const input=el('#searchTier0') as HTMLInputElement;input.value='Fictional pending selection';const parent=input.parentElement;
    mount();click('.pl-workspace-default');await Promise.resolve();
    expect(save.mock.calls.at(-1)![0].groups).toEqual(createDefaultGroups());
    expect([...document.querySelectorAll<HTMLElement>('[data-pl-tab]')].filter(tab=>!tab.parentElement!.hidden).map(tab=>tab.dataset.plTab)).toEqual(['classes','find','schedule']);
    expect(active('classes')).toBe(true);expect(active('schedule')).toBe(true);expect(input.value).toBe('Fictional pending selection');expect(input.parentElement).toBe(parent);
    expect(nativeAction).not.toHaveBeenCalled();
  });
});
