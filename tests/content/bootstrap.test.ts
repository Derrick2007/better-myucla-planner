// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx"}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  readEnabled: vi.fn(async () => false),
  constructed: vi.fn(),
  start: vi.fn(async () => {}),
  dispose: vi.fn()
}));
vi.mock("../../src/storage/settings", () => ({readEnabled: mock.readEnabled, watchEnabled: () => () => {}}));
vi.mock("../../src/content/session-keep", () => ({publishSessionSettings: () => {}}));
vi.mock("../../src/content/boot-hold", () => ({applyBootHold: () => {}, releaseBootHold: () => {}}));
vi.mock("../../src/content/myucla-controller", () => ({
  MyUclaPlannerController: class {
    constructor() { mock.constructed(); }
    start = mock.start;
    dispose = mock.dispose;
  }
}));

describe("extension bootstrap cancellation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mock.readEnabled.mockResolvedValue(false);
    delete window.__plannerLiftController;
    delete window.__plannerLiftWatching;
  });
  afterEach(() => {
    delete window.__plannerLiftController;
    delete window.__plannerLiftWatching;
  });

  it("does not start after disabling while the enabled preference is loading", async () => {
    const bootstrap = await import("../../src/content/index");
    await Promise.resolve();
    let finish!: (enabled: boolean) => void;
    mock.readEnabled.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = bootstrap.startPlannerLift();
    bootstrap.stopPlannerLift();
    finish(true);
    expect(await pending).toBeNull();
    expect(mock.constructed).not.toHaveBeenCalled();
    expect(window.__plannerLiftController).toBeUndefined();
  });

  it("lets only the latest enabled request create a controller", async () => {
    const bootstrap = await import("../../src/content/index");
    await Promise.resolve();
    let finishOld!: (enabled: boolean) => void;
    mock.readEnabled.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    const oldRequest = bootstrap.startPlannerLift();
    mock.readEnabled.mockResolvedValueOnce(true);
    const latest = await bootstrap.startPlannerLift();
    finishOld(true);
    expect(await oldRequest).toBeNull();
    expect(mock.constructed).toHaveBeenCalledTimes(1);
    expect(window.__plannerLiftController).toBe(latest);
    expect(mock.dispose).not.toHaveBeenCalled();
  });
});
