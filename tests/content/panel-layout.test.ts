// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelLayoutController } from "../../src/content/panel-layout";

describe("native-preserving panel layout", () => {
  let layout: PanelLayoutController;
  let host: HTMLElement, panel: HTMLElement, handle: HTMLButtonElement, field: HTMLInputElement;
  let changed: ReturnType<typeof vi.fn>, activate: ReturnType<typeof vi.fn>;
  const rect = (left = 50, top = 60, width = 600, height = 400) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} });
  const pointer = (node: EventTarget, type: string, x: number, y: number, pointerId = 1) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperties(event, { pointerId: { value: pointerId }, isPrimary: { value: true } });
    node.dispatchEvent(event); return event;
  };
  const key = (node: HTMLElement, value: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
    node.dispatchEvent(event); return event;
  };
  const startDrag = (node: HTMLElement = handle) => { pointer(node, "pointerdown", 80, 80); pointer(document, "pointermove", 96, 98); };
  const dropOn = (dock: string) => {
    const target = document.querySelector<HTMLElement>(`[data-pl-dock-target='${dock}']`)!;
    const x = parseFloat(target.style.left) + parseFloat(target.style.width) / 2;
    const y = parseFloat(target.style.top) + parseFloat(target.style.height) / 2;
    pointer(document, "pointermove", x, y); pointer(document, "pointerup", x, y);
  };
  beforeEach(() => {
    document.body.innerHTML = '<form id="native"><div id="host"><section id="panel"><button type="button" id="handle">Schedule</button><div><input name="choice"><button type="button" id="native-action">Native action</button></div></section></div></form>';
    host = document.getElementById("host")!; panel = document.getElementById("panel")!;
    handle = document.getElementById("handle") as HTMLButtonElement; field = panel.querySelector("input")!;
    host.getBoundingClientRect = () => rect(20, 40, 960, 640); panel.getBoundingClientRect = () => rect();
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
    changed = vi.fn(); activate = vi.fn();
    layout = new PanelLayoutController(document, host, changed);
    layout.addPanel({ id: "schedule", label: "Weekly schedule", element: panel, handle, defaultDock: "right", onActivate: activate });
  });
  afterEach(() => { layout.restore(); vi.restoreAllMocks(); });

  it("keeps every native node, parent, handler, value and form association across docking", () => {
    const parent = panel.parentElement, fieldParent = field.parentElement, form = field.form;
    const native = document.getElementById("native-action")!, action = vi.fn(); native.addEventListener("click", action);
    field.value = "example chosen value";
    layout.floatPanel("schedule"); layout.dockPanel("schedule", "bottom"); layout.floatPanel("schedule"); layout.restore();
    expect(panel.parentElement).toBe(parent); expect(field.parentElement).toBe(fieldParent); expect(field.form).toBe(form);
    expect(field.value).toBe("example chosen value"); expect(document.getElementById("native-action")).toBe(native);
    expect(action).not.toHaveBeenCalled(); native.click(); expect(action).toHaveBeenCalledOnce();
    expect(document.querySelectorAll("[data-planner-lift-owned]")).toHaveLength(0);
  });
  it("does not activate or mutate layout during mounting or a click below the drag threshold", () => {
    const clicked = vi.fn(); handle.addEventListener("click", clicked);
    pointer(handle, "pointerdown", 80, 80); pointer(document, "pointermove", 82, 82); pointer(document, "pointerup", 82, 82); handle.click();
    expect(layout.getPlacement("schedule")).toBe("right"); expect(changed).not.toHaveBeenCalled(); expect(activate).not.toHaveBeenCalled();
    expect(clicked).toHaveBeenCalledOnce(); expect(document.querySelector(".pl-panel-drop-overlay")).toBeNull();
  });
  it.each(["left", "right", "bottom", "main"])("docks by an explicit pointer drop at %s without clicking the navigation handle", dock => {
    const clicked = vi.fn(); handle.addEventListener("click", clicked); startDrag();
    expect(document.querySelectorAll("[data-pl-dock-target]")).toHaveLength(4); dropOn(dock); handle.click();
    expect(layout.getPlacement("schedule")).toBe(dock); expect(panel.dataset.plPanelPlacement).toBe(dock);
    expect(activate).toHaveBeenCalledOnce(); expect(clicked).not.toHaveBeenCalled();
    expect(document.querySelector(".pl-panel-drop-overlay")).toBeNull(); expect(panel.parentElement).toBe(host);
  });
  it("moves the real panel with the pointer before dropping, without cloning or changing native controls", () => {
    const native = document.getElementById("native-action")!, action = vi.fn(), parent = field.parentElement, form = field.form;
    native.addEventListener("click", action); field.value = "fictional selection";
    const original = layout.snapshot(); startDrag();
    expect(document.querySelector(".pl-panel-drag-ghost")).toBeNull();
    expect(panel.classList.contains("pl-panel-dragging")).toBe(true);
    expect(panel.style.getPropertyValue("--pl-panel-left")).toBe("66px");
    expect(panel.style.getPropertyValue("--pl-panel-top")).toBe("78px");
    pointer(document, "pointermove", 160, 130);
    expect(panel.style.getPropertyValue("--pl-panel-left")).toBe("130px");
    expect(panel.style.getPropertyValue("--pl-panel-top")).toBe("110px");
    expect(changed.mock.calls.every(call => call[2] === "geometry")).toBe(true);
    expect(layout.snapshot()).toEqual(original); // Remounts must never preserve an uncommitted drag.
    expect(panel.parentElement).toBe(host); expect(field.parentElement).toBe(parent); expect(field.form).toBe(form);
    expect(field.value).toBe("fictional selection"); expect(field.disabled).toBe(false);
    expect(document.querySelectorAll("#native-action")).toHaveLength(1); expect(document.getElementById("native-action")).toBe(native);
    native.click(); expect(action).not.toHaveBeenCalled();
    pointer(document, "pointerup", 900, 70);
    expect(layout.isFloating("schedule")).toBe(true); expect(panel.classList.contains("pl-floating-panel")).toBe(true);
    expect(panel.classList.contains("pl-panel-dragging")).toBe(false);
    expect(panel.querySelector<HTMLButtonElement>(".pl-panel-resize")!.hidden).toBe(false);
    expect(parseFloat(panel.style.getPropertyValue("--pl-panel-left"))).toBeLessThanOrEqual(412);
    expect(activate).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenLastCalledWith("schedule", "floating", "placement");
    native.click(); expect(action).toHaveBeenCalledOnce();
  });
  it("moves an existing floating panel relative to its original position", () => {
    layout.floatPanel("schedule", { left: 100, top: 100, width: 300, height: 250 });
    pointer(handle, "pointerdown", 120, 120); pointer(document, "pointermove", 150, 140); pointer(document, "pointerup", 150, 140);
    expect(layout.snapshot().panels[0].box).toEqual({ left: 130, top: 120, width: 300, height: 250 });
  });
  it("Escape cancels a drag before any placement change and cannot close another UI", () => {
    const bubbling = vi.fn(); document.addEventListener("keydown", bubbling); startDrag();
    const event = key(handle, "Escape");
    expect(event.defaultPrevented).toBe(true); expect(layout.getPlacement("schedule")).toBe("right");
    expect(document.querySelector(".pl-panel-drag-ghost")).toBeNull(); expect(bubbling).not.toHaveBeenCalled();
    document.removeEventListener("keydown", bubbling);
  });
  it("ignores nested native buttons and fields in a header", () => {
    const header = document.createElement("div"), native = document.createElement("button"); native.type = "button"; header.append(native); panel.prepend(header);
    layout.addHandle("schedule", header);
    startDrag(native); pointer(document, "pointerup", 900, 70);
    native.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); key(native, "f", { altKey: true, shiftKey: true });
    expect(layout.getPlacement("schedule")).toBe("right"); expect(activate).not.toHaveBeenCalled();
  });
  it("allows a navigation proxy to float its panel", () => {
    const proxy = document.createElement("button"); proxy.type = "button"; host.prepend(proxy); layout.addHandle("schedule", proxy);
    startDrag(proxy); pointer(document, "pointerup", 900, 70);
    expect(layout.isFloating("schedule")).toBe(true); expect(activate).toHaveBeenCalledOnce();
  });
  it("anchors a proxy drag under the pointer instead of using the panel's former screen position", () => {
    const proxy = document.createElement("button"); proxy.type = "button"; host.prepend(proxy); layout.addHandle("schedule", proxy);
    layout.floatPanel("schedule", { left: 600, top: 400, width: 300, height: 220 });
    pointer(proxy, "pointerdown", 80, 80); pointer(document, "pointermove", 200, 130);
    expect(panel.style.getPropertyValue("--pl-panel-left")).toBe("80px");
    expect(panel.style.getPropertyValue("--pl-panel-top")).toBe("108px");
    pointer(document, "pointerup", 200, 130);
    expect(layout.snapshot().panels[0].box).toEqual({ left: 80, top: 108, width: 300, height: 220 });
  });
  it("keeps dock targets at their original bounds when the workspace shrinks during a drag", () => {
    startDrag();
    const target = document.querySelector<HTMLElement>("[data-pl-dock-target='right']")!, before = target.style.cssText;
    host.getBoundingClientRect = () => rect(400, 400, 200, 150);
    dropOn("right");
    expect(layout.getPlacement("schedule")).toBe("right"); expect(target.style.cssText).toBe(before);
  });
  it.each(["Escape", "pointercancel", "blur"])("restores placement, geometry and stacking when a real-panel drag is cancelled by %s", cancel => {
    layout.floatPanel("schedule", { left: 100, top: 100, width: 350, height: 250 });
    const before = layout.snapshot(), styles = panel.style.cssText;
    pointer(handle, "pointerdown", 130, 120); pointer(document, "pointermove", 200, 160);
    expect(panel.style.getPropertyValue("--pl-panel-left")).toBe("170px");
    if (cancel === "Escape") key(handle, "Escape");
    else if (cancel === "blur") window.dispatchEvent(new Event("blur"));
    else pointer(document, "pointercancel", 200, 160);
    expect(layout.snapshot()).toEqual(before); expect(panel.style.cssText).toBe(styles);
    expect(panel.classList.contains("pl-panel-dragging")).toBe(false);
    expect(document.querySelector(".pl-panel-drop-overlay")).toBeNull();
    expect(changed.mock.calls.filter(call => call[2] === "placement")).toHaveLength(1);
  });
  it("supports keyboard float/dock and double-click returning to its default dock", () => {
    key(handle, "f", { altKey: true, shiftKey: true }); expect(layout.isFloating("schedule")).toBe(true);
    key(handle, "ArrowLeft", { altKey: true }); expect(layout.getPlacement("schedule")).toBe("left");
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); expect(layout.isFloating("schedule")).toBe(true);
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); expect(layout.getPlacement("schedule")).toBe("right");
  });
  it("limits pointer, keyboard and menu destinations to the registered docks", () => {
    layout.removePanel("schedule"); layout.addPanel({ id: "schedule", label: "Schedule", element: panel, handle, defaultDock: "right", allowedDocks: ["right", "bottom"] });
    key(handle, "ArrowLeft", { altKey: true }); expect(layout.getPlacement("schedule")).toBe("right");
    startDrag(); expect(document.querySelectorAll("[data-pl-dock-target]")).toHaveLength(2); layout.cancelActiveDrag();
    key(handle, "F10", { shiftKey: true }); const menu = document.querySelector(".pl-panel-layout-menu")!;
    expect(menu.textContent).toContain("Dock: Right side"); expect(menu.textContent).not.toContain("Dock: Left side");
  });
  it("provides a focusable keyboard layout menu and restores focus on dismissal", () => {
    handle.focus(); key(handle, "F10", { shiftKey: true });
    const menu = document.querySelector<HTMLElement>(".pl-panel-layout-menu")!, buttons = [...menu.querySelectorAll<HTMLButtonElement>("button")];
    expect(document.activeElement).toBe(buttons[0]); expect(menu.getAttribute("role")).toBe("menu");
    key(buttons[0], "End"); expect(document.activeElement).toBe(buttons.at(-1));
    key(buttons.at(-1)!, "Escape"); expect(document.querySelector(".pl-panel-layout-menu")).toBeNull(); expect(document.activeElement).toBe(handle);
    key(handle, "ContextMenu"); document.querySelector<HTMLButtonElement>(".pl-panel-layout-menu button")!.click();
    expect(layout.isFloating("schedule")).toBe(true); expect(document.activeElement).toBe(handle);
  });
  it("resizes within the viewport and restores the original box when cancelled", () => {
    layout.floatPanel("schedule", { left: 30, top: 30, width: 360, height: 300 });
    const resize = panel.querySelector<HTMLButtonElement>(".pl-panel-resize")!;
    pointer(resize, "pointerdown", 390, 330); pointer(document, "pointermove", 500, 440);
    expect(layout.snapshot().panels[0].box?.width).toBe(470); key(resize, "Escape");
    expect(layout.snapshot().panels[0].box).toEqual({ left: 30, top: 30, width: 360, height: 300 });
    key(resize, "ArrowRight"); expect(layout.snapshot().panels[0].box?.width).toBe(376);
    key(resize, "ArrowDown", { shiftKey: true }); expect(layout.snapshot().panels[0].box?.height).toBe(340);
  });
  it("keeps floating panels reachable after a narrow viewport resize", () => {
    layout.floatPanel("schedule", { left: 900, top: 700, width: 2000, height: 2000 });
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true }); Object.defineProperty(window, "innerHeight", { value: 360, configurable: true });
    window.dispatchEvent(new Event("resize"));
    expect(layout.snapshot().panels[0].box).toEqual({ left: 12, top: 12, width: 366, height: 336 });
  });
  it("restores an in-memory snapshot without activating native disclosures", () => {
    layout.floatPanel("schedule", { left: 100, top: 100, width: 350, height: 300 }); const snapshot = layout.snapshot();
    layout.reset(); activate.mockClear(); layout.restoreSnapshot(snapshot);
    expect(activate).not.toHaveBeenCalled(); expect(layout.snapshot()).toEqual(snapshot);
    snapshot.panels[0].box!.width = 9999; expect(layout.snapshot().panels[0].box?.width).toBe(350);
  });
  it("hides and reopens a panel in its same place without modifying native visibility or activating it", () => {
    layout.floatPanel("schedule", { left: 100, top: 100, width: 350, height: 300 });
    const before = layout.snapshot().panels[0], parent = panel.parentElement, form = field.form;
    activate.mockClear(); changed.mockClear(); layout.hidePanel("schedule");
    expect(layout.isHidden("schedule")).toBe(true); expect(panel.classList.contains("pl-panel-hidden")).toBe(true);
    expect(panel.hasAttribute("hidden")).toBe(false); expect(field.form).toBe(form); expect(panel.parentElement).toBe(parent);
    expect(layout.snapshot().panels[0]).toEqual({ ...before, hidden: true });
    layout.showPanel("schedule"); expect(layout.snapshot().panels[0]).toEqual(before);
    expect(activate).not.toHaveBeenCalled();
    expect(changed.mock.calls).toEqual([["schedule", "floating", "visibility"], ["schedule", "floating", "visibility"]]);
  });
  it("restores hidden docked and floating panels from snapshots without activating a native disclosure", () => {
    layout.floatPanel("schedule", { left: 100, top: 100, width: 350, height: 300 }); layout.dockPanel("schedule", "bottom");
    layout.hidePanel("schedule"); const snapshot = layout.snapshot(); layout.reset(); activate.mockClear();
    layout.restoreSnapshot(snapshot); expect(layout.snapshot()).toEqual(snapshot); expect(activate).not.toHaveBeenCalled();
    layout.floatPanel("schedule", undefined, false); expect(layout.isHidden("schedule")).toBe(true);
    const floating = layout.snapshot(); layout.reset(); layout.restoreSnapshot(floating);
    expect(layout.snapshot()).toEqual(floating); expect(activate).not.toHaveBeenCalled();
    layout.floatPanel("schedule"); expect(layout.isHidden("schedule")).toBe(false); expect(activate).toHaveBeenCalledOnce();
  });
  it("cancels a hidden navigation-tab drag back to the original hidden layout", () => {
    const proxy = document.createElement("button"); proxy.type = "button"; host.prepend(proxy); layout.addHandle("schedule", proxy);
    layout.hidePanel("schedule"); const before = layout.snapshot(); startDrag(proxy);
    expect(layout.isHidden("schedule")).toBe(false); key(proxy, "Escape");
    expect(layout.snapshot()).toEqual(before); expect(layout.isHidden("schedule")).toBe(true);
  });
  it.each(["drag", "float", "dock"])("does not displace another pane from the old dock while activating a closed pane to %s", action => {
    const other = document.createElement("section"), otherHandle = document.createElement("button"), proxy = document.createElement("button");
    otherHandle.type = proxy.type = "button"; other.append(otherHandle); host.append(other, proxy);
    layout.addPanel({ id: "find", label: "Find", element: other, handle: otherHandle, defaultDock: "right" });
    layout.addHandle("schedule", proxy); layout.hidePanel("schedule");
    // The workspace's explicit navigation reveals a closed module; its collision
    // handler would move a neighbor if this emitted the stale dock as visible.
    activate.mockImplementation(() => layout.showPanel("schedule")); changed.mockClear();
    changed.mockImplementation((id, place, reason) => {
      if (id === "schedule" && place === "right" && reason === "visibility" && !layout.isHidden(id)) layout.dockPanel("find", "main", false);
    });
    const before = layout.snapshot();
    if (action === "drag") {
      startDrag(proxy); expect(layout.getPlacement("find")).toBe("right"); key(proxy, "Escape");
      expect(layout.snapshot()).toEqual(before);
    } else if (action === "float") layout.floatPanel("schedule");
    else layout.dockPanel("schedule", "left");
    expect(layout.getPlacement("find")).toBe("right");
    expect(changed.mock.calls.filter(call => call[2] === "visibility")).toHaveLength(0);
    expect(activate).toHaveBeenCalledOnce();
    if (action !== "drag") expect(changed).toHaveBeenCalledExactlyOnceWith("schedule", action === "float" ? "floating" : "left", "placement");
  });
  it("provides Hide and Show actions through the existing layout menu", () => {
    const proxy = document.createElement("button"); proxy.type = "button"; host.prepend(proxy); layout.addHandle("schedule", proxy);
    key(proxy, "ContextMenu");
    const hide = [...document.querySelectorAll<HTMLButtonElement>(".pl-panel-layout-menu button")].find(button => button.textContent === "Hide panel")!;
    expect(hide.getAttribute("role")).toBe("menuitem"); hide.click(); expect(layout.isHidden("schedule")).toBe(true);
    expect(activate).not.toHaveBeenCalled(); key(proxy, "ContextMenu");
    [...document.querySelectorAll<HTMLButtonElement>(".pl-panel-layout-menu button")].find(button => button.textContent === "Show panel")!.click();
    expect(layout.isHidden("schedule")).toBe(false); expect(activate).toHaveBeenCalledOnce();
  });
  it("reset returns all registered panels to their defaults without native actions", () => {
    const other = document.createElement("section"), otherHandle = document.createElement("button"); other.append(otherHandle); host.append(other);
    layout.addPanel({ id: "details", label: "Details", element: other, handle: otherHandle, defaultDock: "main", onActivate: activate });
    layout.floatPanel("schedule"); layout.floatPanel("details"); layout.hidePanel("schedule"); layout.hidePanel("details"); activate.mockClear(); layout.reset();
    expect(layout.getPlacement("schedule")).toBe("right"); expect(layout.getPlacement("details")).toBe("main"); expect(activate).not.toHaveBeenCalled();
    expect(layout.isHidden("schedule")).toBe(false); expect(layout.isHidden("details")).toBe(false);
  });
  it("cancels when a native redraw removes the original handle and never resurrects it", () => {
    startDrag(); const parent = panel.parentElement; panel.remove(); pointer(document, "pointermove", 200, 100); pointer(document, "pointerup", 200, 100);
    expect(panel.isConnected).toBe(false); expect(parent?.contains(panel)).toBe(false); expect(document.querySelector(".pl-panel-drag-ghost")).toBeNull();
    expect(changed.mock.calls).toEqual([["schedule", "floating", "geometry"]]);
  });
  it("cleans up only owned presentation while preserving preexisting styles and attributes", () => {
    layout.removePanel("schedule"); handle.setAttribute("title", "Existing title"); handle.tabIndex = 3;
    panel.style.setProperty("--pl-panel-width", "123px", "important"); panel.style.color = "red"; panel.dataset.plPanelPlacement = "original";
    panel.classList.add("pl-panel-hidden", "pl-panel-dragging");
    const originalPriority = panel.style.getPropertyPriority("--pl-panel-width"); // jsdom does not implement priority on custom properties.
    layout.addPanel({ id: "schedule", label: "Schedule", element: panel, handle, defaultDock: "right" }); layout.floatPanel("schedule"); layout.restore();
    expect(handle.title).toBe("Existing title"); expect(handle.tabIndex).toBe(3); expect(handle.hasAttribute("data-pl-panel-handle")).toBe(false);
    expect(panel.style.getPropertyValue("--pl-panel-width")).toBe("123px"); expect(panel.style.getPropertyPriority("--pl-panel-width")).toBe(originalPriority);
    expect(panel.style.color).toBe("red"); expect(panel.dataset.plPanelPlacement).toBe("original"); expect(panel.querySelector(".pl-panel-resize")).toBeNull();
    expect(panel.classList.contains("pl-panel-hidden")).toBe(true); expect(panel.classList.contains("pl-panel-dragging")).toBe(true);
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); expect(panel.classList.contains("pl-floating-panel")).toBe(false);
  });
  it("stops an explicit drag if activation synchronously redraws the native panel", () => {
    layout.removePanel("schedule"); layout.addPanel({ id: "schedule", label: "Schedule", element: panel, handle, defaultDock: "right", onActivate: () => panel.remove() });
    startDrag(); pointer(document, "pointerup", 900, 70);
    expect(panel.isConnected).toBe(false); expect(document.querySelector(".pl-panel-drag-ghost")).toBeNull(); expect(changed).not.toHaveBeenCalled();
  });
  it("resets layout in one callback after every panel is in its default place", () => {
    layout.floatPanel("schedule"); startDrag(); changed.mockClear(); layout.reset();
    expect(changed).toHaveBeenCalledExactlyOnceWith("", "main", "reset");
    expect(panel.dataset.plPanelPlacement).toBe("right");
  });
});
