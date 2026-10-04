/** In-memory presentation only. Native panels and controls never change parent. */
export type PanelDock = "main" | "left" | "right" | "bottom";
export type PanelPlacement = PanelDock | "floating";
export interface PanelBox { left: number; top: number; width: number; height: number; }
export interface PanelLayoutSnapshot { panels: { id: string; placement: PanelPlacement; box?: PanelBox }[]; }
export interface PanelRegistration {
  id: string; label: string; element: HTMLElement; handle: HTMLElement; defaultDock: PanelDock;
  allowedDocks?: readonly PanelDock[];
  /** Explicit user intent only; never called by snapshot restoration or resize. */
  onActivate?: () => void;
}
type Change = (id: string, placement: PanelPlacement, reason: "placement" | "geometry" | "reset") => void;
interface HandleState {
  node: HTMLElement; title: string | null; tabIndex: string | null; marker: string | null; hadClass: boolean; hadClassAttribute: boolean;
  down: (event: PointerEvent) => void; key: (event: KeyboardEvent) => void;
  double: (event: MouseEvent) => void; context: (event: MouseEvent) => void;
}
interface Panel extends PanelRegistration {
  placement: PanelPlacement; box?: PanelBox; handles: HandleState[]; resize: HTMLButtonElement;
  originalPlacement: string | null; originalFloating: boolean;
  hadStyle: boolean; hadClassAttribute: boolean;
  styles: { name: string; value: string; priority: string }[];
}
interface Gesture {
  panel: Panel; pointerId: number; source: HTMLElement; startX: number; startY: number;
  x: number; y: number; original: PanelBox; resize: boolean; started: boolean;
  ghost?: HTMLElement; overlay?: HTMLElement; target?: PanelDock;
}
const OWNED = "data-planner-lift-owned";
const DOCKS: readonly PanelDock[] = ["main", "left", "right", "bottom"];
const BOX_PROPERTIES = ["--pl-panel-left", "--pl-panel-top", "--pl-panel-width", "--pl-panel-height", "--pl-panel-z"];
const LABELS: Record<PanelDock, string> = { main: "Main workspace", left: "Left side", right: "Right side", bottom: "Bottom" };
const INTERACTIVE = "button,input,select,textarea,a,summary,[contenteditable]:not([contenteditable='false'])";

export class PanelLayoutController {
  private panels = new Map<string, Panel>();
  private gesture: Gesture | null = null;
  private menu: HTMLElement | null = null;
  private menuTrigger: HTMLElement | null = null;
  private clickSuppression: { node: HTMLElement; until: number } | null = null;
  private layer = 0;
  private disposed = false;
  constructor(private doc: Document, private host: HTMLElement, private onChange: Change = () => {}) {
    doc.addEventListener("pointermove", this.move, { passive: false });
    doc.addEventListener("pointerup", this.up);
    doc.addEventListener("pointercancel", this.cancelPointer);
    doc.addEventListener("keydown", this.escape, true);
    doc.addEventListener("pointerdown", this.outside, true);
    doc.addEventListener("click", this.suppressClick, true);
    doc.defaultView?.addEventListener("resize", this.viewportResize);
    doc.defaultView?.addEventListener("blur", this.cancel);
  }

  addPanel(registration: PanelRegistration): void {
    if (this.disposed || registration.element.ownerDocument !== this.doc || registration.handle.ownerDocument !== this.doc) return;
    this.removePanel(registration.id);
    const resize = this.doc.createElement("button");
    resize.type = "button"; resize.className = "pl-panel-resize"; resize.setAttribute(OWNED, "");
    resize.setAttribute("aria-label", `Resize ${registration.label}`);
    resize.title = "Drag to resize. Use arrow keys to resize with the keyboard.";
    resize.hidden = true;
    const panel: Panel = { ...registration, placement: registration.defaultDock, handles: [], resize,
      originalPlacement: registration.element.getAttribute("data-pl-panel-placement"),
      originalFloating: registration.element.classList.contains("pl-floating-panel"),
      hadStyle: registration.element.hasAttribute("style"), hadClassAttribute: registration.element.hasAttribute("class"),
      styles: BOX_PROPERTIES.map(name => ({ name, value: registration.element.style.getPropertyValue(name), priority: registration.element.style.getPropertyPriority(name) })) };
    this.panels.set(registration.id, panel);
    registration.element.setAttribute("data-pl-panel-placement", registration.defaultDock);
    registration.element.append(resize);
    resize.addEventListener("pointerdown", event => this.begin(panel, resize, event, true));
    resize.addEventListener("keydown", event => {
      if (!panel.box || panel.placement !== "floating" || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const step = event.shiftKey ? 40 : 16;
      const box = { ...panel.box };
      box.width += event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      box.height += event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      this.applyBox(panel, box); this.onChange(panel.id, panel.placement, "geometry");
    });
    this.addHandle(registration.id, registration.handle);
  }

  addHandle(id: string, node: HTMLElement): void {
    const panel = this.panels.get(id);
    if (!panel || panel.handles.some(handle => handle.node === node) || node.ownerDocument !== this.doc) return;
    const state: HandleState = { node, title: node.getAttribute("title"), tabIndex: node.getAttribute("tabindex"),
      marker: node.getAttribute("data-pl-panel-handle"), hadClass: node.classList.contains("pl-panel-handle"), hadClassAttribute: node.hasAttribute("class"),
      down: event => this.begin(panel, node, event, false),
      key: event => this.handleKey(panel, node, event),
      double: event => {
        if (event.button !== 0 || !this.isHandleTarget(node, event.target)) return;
        event.preventDefault(); event.stopPropagation(); this.toggle(panel);
      },
      context: event => {
        if (!this.isHandleTarget(node, event.target)) return;
        event.preventDefault(); event.stopPropagation(); this.openMenu(panel, node, event.clientX, event.clientY);
      }
    };
    node.classList.add("pl-panel-handle"); node.setAttribute("data-pl-panel-handle", id);
    node.title = `${panel.label}: drag to move; double-click to float or dock; right-click for layout options.`;
    if (!node.matches(INTERACTIVE) && !node.hasAttribute("tabindex")) node.tabIndex = 0;
    node.addEventListener("pointerdown", state.down); node.addEventListener("keydown", state.key);
    node.addEventListener("dblclick", state.double); node.addEventListener("contextmenu", state.context);
    panel.handles.push(state);
  }

  removePanel(id: string): void {
    const panel = this.panels.get(id); if (!panel) return;
    if (this.gesture?.panel === panel) this.cancel();
    if (this.menu?.dataset.plPanelMenu === id) this.closeMenu(false);
    for (const handle of panel.handles) {
      handle.node.removeEventListener("pointerdown", handle.down); handle.node.removeEventListener("keydown", handle.key);
      handle.node.removeEventListener("dblclick", handle.double); handle.node.removeEventListener("contextmenu", handle.context);
      if (!handle.hadClass) handle.node.classList.remove("pl-panel-handle");
      if (!handle.hadClassAttribute && !handle.node.className) handle.node.removeAttribute("class");
      this.restoreAttribute(handle.node, "title", handle.title); this.restoreAttribute(handle.node, "tabindex", handle.tabIndex);
      this.restoreAttribute(handle.node, "data-pl-panel-handle", handle.marker);
    }
    panel.resize.remove(); this.restoreAttribute(panel.element, "data-pl-panel-placement", panel.originalPlacement);
    panel.element.classList.toggle("pl-floating-panel", panel.originalFloating);
    if (!panel.hadClassAttribute && !panel.element.className) panel.element.removeAttribute("class");
    for (const style of panel.styles) {
      if (style.value) panel.element.style.setProperty(style.name, style.value, style.priority);
      else panel.element.style.removeProperty(style.name);
    }
    if (!panel.hadStyle && !panel.element.style.cssText) panel.element.removeAttribute("style");
    this.panels.delete(id);
  }

  getPlacement(id: string): PanelPlacement | undefined { return this.panels.get(id)?.placement; }
  isFloating(id: string): boolean { return this.getPlacement(id) === "floating"; }
  bringToFront(id: string): void {
    const panel = this.panels.get(id); if (!panel || panel.placement !== "floating") return;
    this.raise(panel); this.onChange(id, "floating", "geometry");
  }
  floatPanel(id: string, requested?: PanelBox, activate = true): void {
    const panel = this.panels.get(id); if (!panel) return;
    if (activate) panel.onActivate?.();
    if (this.panels.get(id) !== panel || !panel.element.isConnected) return;
    const box = this.validBox(requested) ? requested : panel.box ?? this.initialBox(panel);
    panel.placement = "floating"; panel.element.classList.add("pl-floating-panel");
    panel.element.setAttribute("data-pl-panel-placement", "floating"); panel.resize.hidden = false;
    this.applyBox(panel, box); this.raise(panel); this.onChange(id, "floating", "placement");
  }
  dockPanel(id: string, placement: PanelDock = "main", activate = true): void {
    const panel = this.panels.get(id); if (!panel || !this.allowed(panel).includes(placement)) return;
    if (activate) panel.onActivate?.();
    if (this.panels.get(id) !== panel || !panel.element.isConnected) return;
    panel.placement = placement; panel.element.classList.remove("pl-floating-panel"); panel.resize.hidden = true;
    panel.element.setAttribute("data-pl-panel-placement", placement);
    this.onChange(id, placement, "placement");
  }
  snapshot(): PanelLayoutSnapshot {
    return { panels: [...this.panels.values()].map(panel => ({ id: panel.id, placement: panel.placement, ...(panel.box ? { box: { ...panel.box } } : {}) })) };
  }
  restoreSnapshot(snapshot: PanelLayoutSnapshot): void {
    for (const state of snapshot.panels) {
      if (!this.panels.has(state.id)) continue;
      if (state.placement === "floating") this.floatPanel(state.id, this.validBox(state.box) ? state.box : undefined, false);
      else if (DOCKS.includes(state.placement)) this.dockPanel(state.id, state.placement, false);
    }
  }
  reset(): void {
    this.cancel(); this.closeMenu(false);
    for (const panel of this.panels.values()) {
      panel.box = undefined; panel.placement = panel.defaultDock;
      panel.element.classList.remove("pl-floating-panel"); panel.resize.hidden = true;
      panel.element.setAttribute("data-pl-panel-placement", panel.defaultDock);
    }
    this.onChange("", "main", "reset");
  }
  cancelActiveDrag(): void { this.cancel(); }
  restore(): void {
    if (this.disposed) return;
    this.cancel(); this.closeMenu(false);
    for (const id of [...this.panels.keys()]) this.removePanel(id);
    this.doc.removeEventListener("pointermove", this.move); this.doc.removeEventListener("pointerup", this.up);
    this.doc.removeEventListener("pointercancel", this.cancelPointer); this.doc.removeEventListener("keydown", this.escape, true);
    this.doc.removeEventListener("pointerdown", this.outside, true); this.doc.removeEventListener("click", this.suppressClick, true);
    this.doc.defaultView?.removeEventListener("resize", this.viewportResize); this.doc.defaultView?.removeEventListener("blur", this.cancel);
    this.disposed = true;
  }

  private allowed(panel: Panel): readonly PanelDock[] { return panel.allowedDocks ?? DOCKS; }
  private restoreAttribute(node: HTMLElement, name: string, value: string | null): void {
    if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
  }
  private isHandleTarget(handle: HTMLElement, target: EventTarget | null): boolean {
    if (!(target instanceof Element) || !handle.contains(target)) return false;
    const interactive = target.closest(INTERACTIVE);
    return !interactive || interactive === handle;
  }
  private handleKey(panel: Panel, handle: HTMLElement, event: KeyboardEvent): void {
    if (!this.isHandleTarget(handle, event.target)) return;
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault(); event.stopPropagation();
      const box = handle.getBoundingClientRect(); this.openMenu(panel, handle, box.left, box.bottom); return;
    }
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const destinations: Record<string, PanelDock> = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "bottom", ArrowUp: "main" };
    if (event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault(); event.stopPropagation(); this.toggle(panel);
    } else if (!event.shiftKey && destinations[event.key] && this.allowed(panel).includes(destinations[event.key])) {
      event.preventDefault(); event.stopPropagation(); this.dockPanel(panel.id, destinations[event.key]);
    }
  }
  private toggle(panel: Panel): void {
    if (panel.placement === "floating") this.dockPanel(panel.id, panel.defaultDock); else this.floatPanel(panel.id);
  }
  private begin(panel: Panel, source: HTMLElement, event: PointerEvent, resize: boolean): void {
    if (this.gesture || event.button !== 0 || event.isPrimary === false || !panel.element.isConnected || !this.isHandleTarget(source, event.target)) return;
    if (resize && panel.placement !== "floating") return;
    this.closeMenu(false);
    this.gesture = { panel, pointerId: event.pointerId, source, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, original: panel.box ?? this.initialBox(panel), resize, started: false };
    if (panel.placement === "floating") this.raise(panel);
  }
  private move = (event: PointerEvent): void => {
    const gesture = this.gesture; if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!gesture.panel.element.isConnected || !gesture.source.isConnected) { this.cancel(); return; }
    gesture.x = event.clientX; gesture.y = event.clientY;
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    if (!gesture.started && Math.hypot(dx, dy) < 6) return;
    event.preventDefault();
    if (!gesture.started) {
      gesture.started = true;
      if (!gesture.resize) gesture.panel.onActivate?.();
      if (this.gesture !== gesture || !gesture.panel.element.isConnected || !gesture.source.isConnected) { this.cancel(); return; }
      try { gesture.source.setPointerCapture(event.pointerId); } catch { /* Unsupported or cancelled pointer. */ }
      if (!gesture.resize) this.createDragPreview(gesture);
    }
    if (gesture.resize) {
      this.applyBox(gesture.panel, { ...gesture.original, width: gesture.original.width + dx, height: gesture.original.height + dy });
      this.onChange(gesture.panel.id, "floating", "geometry");
    } else {
      if (gesture.ghost) { gesture.ghost.style.left = `${event.clientX + 14}px`; gesture.ghost.style.top = `${event.clientY + 14}px`; }
      gesture.target = this.dockAt(gesture, event.clientX, event.clientY);
      for (const target of gesture.overlay?.querySelectorAll<HTMLElement>("[data-pl-dock-target]") ?? []) {
        target.classList.toggle("pl-panel-drop-active", target.dataset.plDockTarget === gesture.target);
      }
    }
  };
  private up = (event: PointerEvent): void => {
    const gesture = this.gesture; if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!gesture.panel.element.isConnected || !gesture.source.isConnected) { this.cancel(); return; }
    if (gesture.started) {
      this.clickSuppression = { node: gesture.source, until: Date.now() + 500 };
      if (!gesture.resize) {
        const target = this.dockAt(gesture, event.clientX, event.clientY);
        if (target) this.dockPanel(gesture.panel.id, target, false);
        else this.floatPanel(gesture.panel.id, { ...gesture.original,
          left: gesture.panel.placement === "floating" ? gesture.original.left + event.clientX - gesture.startX : event.clientX - Math.min(gesture.original.width / 2, 120),
          top: gesture.panel.placement === "floating" ? gesture.original.top + event.clientY - gesture.startY : event.clientY - 22 }, false);
      }
    }
    this.finishGesture();
  };
  private cancelPointer = (event: PointerEvent): void => { if (event.pointerId === this.gesture?.pointerId) this.cancel(); };
  private cancel = (): void => {
    const gesture = this.gesture;
    if (gesture?.started && gesture.resize) { this.applyBox(gesture.panel, gesture.original); this.onChange(gesture.panel.id, gesture.panel.placement, "geometry"); }
    if (gesture?.started) this.clickSuppression = { node: gesture.source, until: Date.now() + 500 };
    this.finishGesture();
  };
  private finishGesture(): void {
    const gesture = this.gesture; if (!gesture) return;
    gesture.ghost?.remove(); gesture.overlay?.remove();
    try { gesture.source.releasePointerCapture(gesture.pointerId); } catch { /* No active capture. */ }
    this.gesture = null;
  }
  private createDragPreview(gesture: Gesture): void {
    const overlay = this.doc.createElement("div"); overlay.className = "pl-panel-drop-overlay";
    overlay.setAttribute(OWNED, ""); overlay.setAttribute("aria-hidden", "true");
    for (const dock of this.allowed(gesture.panel)) {
      const target = this.doc.createElement("div"); target.className = "pl-panel-drop-target";
      target.dataset.plDockTarget = dock; target.textContent = LABELS[dock];
      const rect = this.targetBox(dock);
      Object.assign(target.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      overlay.append(target);
    }
    const ghost = this.doc.createElement("div"); ghost.className = "pl-panel-drag-ghost"; ghost.textContent = gesture.panel.label;
    ghost.setAttribute(OWNED, ""); ghost.setAttribute("aria-hidden", "true");
    this.doc.body.append(overlay, ghost); gesture.overlay = overlay; gesture.ghost = ghost;
  }
  private targetBox(dock: PanelDock): PanelBox {
    const viewport = this.viewport(); const host = this.host.getBoundingClientRect();
    const left = Math.max(12, Math.min(host.left, viewport.width - 48));
    const top = Math.max(12, Math.min(host.top, viewport.height - 48));
    const width = Math.max(24, Math.min(host.width || viewport.width - 24, viewport.width - left - 12));
    const height = Math.max(24, Math.min(host.height || viewport.height - 24, viewport.height - top - 12));
    const edgeWidth = Math.min(132, width * .22), edgeHeight = Math.min(86, height * .24);
    if (dock === "left") return { left, top: top + height * .22, width: edgeWidth, height: height * .46 };
    if (dock === "right") return { left: left + width - edgeWidth, top: top + height * .22, width: edgeWidth, height: height * .46 };
    if (dock === "bottom") return { left: left + width * .27, top: top + height - edgeHeight, width: width * .46, height: edgeHeight };
    return { left: left + width * .34, top: top + height * .3, width: width * .32, height: height * .28 };
  }
  private dockAt(gesture: Gesture, x: number, y: number): PanelDock | undefined {
    return this.allowed(gesture.panel).find(dock => { const box = this.targetBox(dock); return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height; });
  }
  private initialBox(panel: Panel): PanelBox {
    const rect = panel.element.getBoundingClientRect(), viewport = this.viewport();
    return this.bound({ left: Math.max(32, rect.left), top: Math.max(32, rect.top), width: rect.width || Math.min(600, viewport.width * .65), height: rect.height || Math.min(520, viewport.height * .7) });
  }
  private validBox(box: PanelBox | undefined): box is PanelBox { return !!box && [box.left, box.top, box.width, box.height].every(Number.isFinite); }
  private viewport(): { width: number; height: number } {
    return { width: Math.max(48, this.doc.defaultView?.innerWidth ?? 1024), height: Math.max(48, this.doc.defaultView?.innerHeight ?? 768) };
  }
  private bound(box: PanelBox): PanelBox {
    const viewport = this.viewport(), maxWidth = viewport.width - 24, maxHeight = viewport.height - 24;
    const width = Math.max(Math.min(280, maxWidth), Math.min(box.width, maxWidth));
    const height = Math.max(Math.min(180, maxHeight), Math.min(box.height, maxHeight));
    return { left: Math.max(12, Math.min(box.left, viewport.width - width - 12)), top: Math.max(12, Math.min(box.top, viewport.height - height - 12)), width, height };
  }
  private applyBox(panel: Panel, requested: PanelBox): void {
    panel.box = this.bound(requested);
    for (const key of ["left", "top", "width", "height"] as const) panel.element.style.setProperty(`--pl-panel-${key}`, `${panel.box[key]}px`);
  }
  private raise(panel: Panel): void {
    if (this.layer >= 79) {
      const floating = [...this.panels.values()].filter(item => item.placement === "floating").sort((a, b) =>
        Number(a.element.style.getPropertyValue("--pl-panel-z")) - Number(b.element.style.getPropertyValue("--pl-panel-z")));
      this.layer = 0;
      for (const item of floating) item.element.style.setProperty("--pl-panel-z", String(130 + this.layer++));
    }
    panel.element.style.setProperty("--pl-panel-z", String(130 + this.layer++));
  }
  private viewportResize = (): void => {
    this.cancel(); this.closeMenu(false);
    for (const panel of this.panels.values()) if (panel.placement === "floating" && panel.box) {
      this.applyBox(panel, panel.box); this.onChange(panel.id, "floating", "geometry");
    }
  };
  private suppressClick = (event: MouseEvent): void => {
    const suppression = this.clickSuppression;
    if (!suppression || suppression.until < Date.now()) { this.clickSuppression = null; return; }
    if (event.target instanceof Node && suppression.node.contains(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); this.clickSuppression = null;
    }
  };
  private outside = (event: PointerEvent): void => {
    if (this.menu && event.target instanceof Node && !this.menu.contains(event.target)) this.closeMenu(false);
    if (event.target instanceof Node) for (const panel of this.panels.values()) {
      if (panel.placement === "floating" && panel.element.contains(event.target)) {
        this.raise(panel); this.onChange(panel.id, "floating", "geometry");
      }
    }
  };
  private escape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || (!this.gesture && !this.menu)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (this.gesture) this.cancel(); else this.closeMenu(true);
  };
  private openMenu(panel: Panel, trigger: HTMLElement, x: number, y: number): void {
    this.cancel(); this.closeMenu(false);
    const menu = this.doc.createElement("div"); menu.className = "pl-panel-layout-menu"; menu.dataset.plPanelMenu = panel.id;
    menu.setAttribute(OWNED, ""); menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", `${panel.label} layout`);
    const add = (label: string, action: () => void, current = false) => {
      const button = this.doc.createElement("button"); button.type = "button"; button.textContent = label;
      button.setAttribute("role", "menuitemradio"); button.setAttribute("aria-checked", String(current));
      button.addEventListener("click", () => { this.closeMenu(true); action(); }); menu.append(button);
    };
    add("Float panel", () => this.floatPanel(panel.id), panel.placement === "floating");
    for (const dock of this.allowed(panel)) add(`Dock: ${LABELS[dock]}`, () => this.dockPanel(panel.id, dock), panel.placement === dock);
    add("Reset layout", () => this.reset());
    const reset = menu.lastElementChild!; reset.setAttribute("role", "menuitem"); reset.removeAttribute("aria-checked");
    menu.addEventListener("keydown", event => {
      const buttons = [...menu.querySelectorAll<HTMLButtonElement>("button")], index = buttons.indexOf(this.doc.activeElement as HTMLButtonElement);
      if (event.key === "Tab") { this.closeMenu(true); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus({ preventScroll: true });
    });
    const viewport = this.viewport();
    menu.style.left = `${Math.max(12, Math.min(x, viewport.width - 244))}px`;
    menu.style.top = `${Math.max(12, Math.min(y, viewport.height - 300))}px`;
    this.doc.body.append(menu); this.menu = menu; this.menuTrigger = trigger;
    menu.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }
  private closeMenu(focus: boolean): void {
    const trigger = this.menuTrigger; this.menu?.remove(); this.menu = null; this.menuTrigger = null;
    if (focus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  }
}
