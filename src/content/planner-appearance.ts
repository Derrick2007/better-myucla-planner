import { plannerPageUrl } from "../adapters/myucla-adapter";
import { subscribeAppearance, type ResolvedAppearance } from "../appearance";

const ATTRIBUTE = "data-pl-appearance";

/** Theme only a recognized enhanced planner. Native layout stays authoritative. */
export class PlannerAppearance {
  private stopPreference: (() => void) | null = null;
  private observer: MutationObserver | null = null;
  private resolved: ResolvedAppearance | null = null;
  private original: string | null = null;
  private applied = false;
  private started = false;
  constructor(private readonly doc: Document = document) {}

  start(): void {
    const view = this.doc.defaultView;
    if (this.started || !view || !this.doc.body || view.location.origin + view.location.pathname !== plannerPageUrl) return;
    this.started = true;
    this.stopPreference = subscribeAppearance(state => { this.resolved = state.resolved; this.render(); }, view);
    this.observer = new MutationObserver(() => this.render());
    // The theme attribute is on HTML; the observer watches BODY class/child
    // changes only. Applying a theme cannot feed back into this observer.
    this.observer.observe(this.doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  }

  private enhanced(): boolean {
    return !!this.doc.querySelector("form#aspnetForm .classPlannerWrapper.pl-workspace-host .pl-workspace-deck, form#aspnetForm #layoutContentArea.pl-planner-introduction .pl-intro-toolbar[data-planner-lift-owned]");
  }

  private render(): void {
    if (!this.started) return;
    if (!this.resolved || !this.enhanced()) { this.restore(); return; }
    const root = this.doc.documentElement;
    if (!this.applied) { this.original = root.getAttribute(ATTRIBUTE); this.applied = true; }
    if (root.getAttribute(ATTRIBUTE) !== this.resolved) root.setAttribute(ATTRIBUTE, this.resolved);
  }

  private restore(): void {
    if (!this.applied) return;
    if (this.original === null) this.doc.documentElement.removeAttribute(ATTRIBUTE);
    else this.doc.documentElement.setAttribute(ATTRIBUTE, this.original);
    this.applied = false; this.original = null;
  }

  dispose(): void {
    this.started = false; this.observer?.disconnect(); this.observer = null;
    this.stopPreference?.(); this.stopPreference = null; this.resolved = null;
    this.restore();
  }
}
