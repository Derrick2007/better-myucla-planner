// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {PlannerWorkspace} from "../../src/content/planner-workspace";
import {MyUclaPlannerAdapter} from "../../src/adapters/myucla-adapter";
// @ts-expect-error Shared fictional production-browser fixture.
import {introductionFixtureHtml} from "../../harness/workspace-fixture.mjs";

describe("open course detail navigation",()=>{
  let workspace:PlannerWorkspace,adapter:MyUclaPlannerAdapter;
  const native=vi.fn(),save=vi.fn();
  const el=(selector:string)=>document.querySelector<HTMLElement>(selector)!;
  const buttons=()=>[...document.querySelectorAll<HTMLButtonElement>(".pl-workspace-detail-jump")];
  const rect=(top:number,height:number)=>({left:600,top,width:500,height,right:1100,bottom:top+height,x:600,y:top,toJSON(){}});
  beforeEach(()=>{
    document.body.innerHTML=new DOMParser().parseFromString(introductionFixtureHtml(),"text/html").body.innerHTML;
    vi.stubGlobal("innerWidth",1700);vi.stubGlobal("innerHeight",1000);native.mockClear();save.mockClear();
    document.querySelectorAll("button,input,a").forEach(node=>node.addEventListener("click",native));
    document.querySelector("form")!.addEventListener("submit",event=>event.preventDefault());
    workspace=new PlannerWorkspace(()=>{},save);adapter=new MyUclaPlannerAdapter(document);
    workspace.reconcile(document,adapter.inspectContract().courses);
  });
  afterEach(()=>{workspace.restore();vi.restoreAllMocks();vi.unstubAllGlobals();});
  const open=(index:number)=>document.querySelectorAll<HTMLButtonElement>("[data-pl-workspace-details]")[index].click();

  it("shows navigation only for multiple details and scrolls the existing stack without native actions",async()=>{
    const courses=adapter.inspectContract().courses,rows=courses.slice(0,2).map(c=>c.node.children[2]),parents=rows.map(row=>row.parentElement);
    open(0);expect(el(".pl-workspace-detail-index").hidden).toBe(true);
    open(1);expect(el(".pl-workspace-detail-index").hidden).toBe(false);expect(buttons()).toHaveLength(2);
    const slot=el(".pl-workspace-details-slot"),spaces=[...document.querySelectorAll<HTMLElement>(".pl-workspace-detail-space")];
    vi.spyOn(slot,"getBoundingClientRect").mockReturnValue(rect(200,500));
    vi.spyOn(spaces[0],"getBoundingClientRect").mockImplementation(()=>rect(200-slot.scrollTop,300));
    vi.spyOn(spaces[1],"getBoundingClientRect").mockImplementation(()=>rect(500-slot.scrollTop,300));
    buttons()[1].click();expect(slot.scrollTop).toBe(300);
    buttons()[0].click();expect(slot.scrollTop).toBe(0);expect(buttons()[0].getAttribute("aria-current")).toBe("true");
    expect(rows.every((row,i)=>row.parentElement===parents[i])).toBe(true);
    expect(document.querySelectorAll(".pl-preview-docked")).toHaveLength(2);
    await Promise.resolve();expect(native).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
  });

  it("supports keyboard navigation and removes obsolete buttons when courses close",()=>{
    open(0);open(1);open(2);const first=buttons()[0];first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown",{key:"End",bubbles:true,cancelable:true}));
    expect(document.activeElement).toBe(buttons()[2]);expect(buttons()[2].getAttribute("aria-current")).toBe("true");
    buttons()[2].dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true,cancelable:true}));
    expect(document.activeElement).toBe(first);
    document.querySelectorAll<HTMLButtonElement>(".pl-workspace-preview-close")[1].click();
    expect(buttons()).toHaveLength(2);expect(buttons()[0]).toBe(first);
    document.querySelectorAll<HTMLButtonElement>(".pl-workspace-preview-close")[1].click();
    expect(buttons()).toHaveLength(1);expect(el(".pl-workspace-detail-index").hidden).toBe(true);
    expect(native).not.toHaveBeenCalled();
    workspace.restore();expect(document.querySelector(".pl-workspace-detail-index")).toBeNull();
    expect(adapter.inspectContract().ok).toBe(true);
  });

  it("retains the selected course and local scroll across replacement native course rows",()=>{
    open(0);open(1);buttons()[0].click();const selected=buttons()[0].textContent;
    el(".pl-workspace-details-slot").scrollTop=87;
    const nativeFixture=new DOMParser().parseFromString(introductionFixtureHtml(),"text/html");
    el("#panelPlan #div_landing > table").replaceWith(nativeFixture.querySelector("#panelPlan #div_landing > table")!);
    workspace.reconcile(document,adapter.inspectContract().courses);
    expect(buttons()).toHaveLength(2);expect(buttons().find(button=>button.getAttribute("aria-current")==="true")?.textContent).toBe(selected);
    expect(el(".pl-workspace-details-slot").scrollTop).toBe(87);expect(native).not.toHaveBeenCalled();
  });

  it("returns focus to the same open-course jump after a workspace remount",()=>{
    open(0);open(1);const first=buttons()[0];first.click();first.focus();const selected=first.textContent;
    const menu=el(".plannerTopMenuLinks");menu.replaceWith(menu.cloneNode(true));
    workspace.reconcile(document,adapter.inspectContract().courses);
    expect(document.activeElement).not.toBe(first);
    expect(document.activeElement?.classList.contains("pl-workspace-detail-jump")).toBe(true);
    expect(document.activeElement?.textContent).toBe(selected);expect(document.activeElement?.getAttribute("aria-current")).toBe("true");
    expect(native).not.toHaveBeenCalled();
  });
});
