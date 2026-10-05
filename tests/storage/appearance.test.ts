// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { APPEARANCE_KEY, normalizeAppearance, readAppearance, saveAppearance, watchAppearance } from "../../src/storage/appearance";

afterEach(() => vi.unstubAllGlobals());

it("accepts only the three public choices and defaults malformed/missing preferences to System", async () => {
  for (const input of [undefined, null, 1, true, "DARK", {}, { preference: "dark" }, "system"]) {
    expect(normalizeAppearance(input)).toBe("system");
    vi.stubGlobal("chrome", { storage: { local: { get: async () => ({ [APPEARANCE_KEY]: input }) } } });
    expect(await readAppearance()).toBe("system");
  }
  expect(normalizeAppearance("light")).toBe("light"); expect(normalizeAppearance("dark")).toBe("dark");
  vi.stubGlobal("chrome", { storage: { local: { get: async () => { throw new Error("unavailable"); } } } });
  expect(await readAppearance()).toBe("system");
});

it("serializes rapid writes, storing only one validated appearance string", async () => {
  const writes: unknown[] = []; let release!: () => void;
  vi.stubGlobal("chrome", { storage: { local: { set: async (value: unknown) => {
    writes.push(value); if (writes.length === 1) await new Promise<void>(done => { release = done; });
  } } } });
  const first = saveAppearance("dark"), second = saveAppearance("light");
  await Promise.resolve(); await Promise.resolve(); expect(writes).toEqual([{ [APPEARANCE_KEY]: "dark" }]);
  release(); await Promise.all([first, second]);
  expect(writes).toEqual([{ [APPEARANCE_KEY]: "dark" }, { [APPEARANCE_KEY]: "light" }]);
});

it("watches local changes only, normalizes removal and cleans up its listener", () => {
  const handlers = new Set<(changes: Record<string, {newValue?: unknown}>, area: string) => void>();
  vi.stubGlobal("chrome", { storage: { onChanged: { addListener: (handler: never) => handlers.add(handler), removeListener: (handler: never) => handlers.delete(handler) } } });
  const listener = vi.fn(), stop = watchAppearance(listener), notify = [...handlers][0];
  notify({ [APPEARANCE_KEY]: { newValue: "dark" } }, "sync"); notify({ unrelated: { newValue: "dark" } }, "local"); expect(listener).not.toHaveBeenCalled();
  notify({ [APPEARANCE_KEY]: { newValue: "dark" } }, "local"); notify({ [APPEARANCE_KEY]: {} }, "local");
  expect(listener.mock.calls).toEqual([["dark"], ["system"]]); stop(); expect(handlers.size).toBe(0);
});
