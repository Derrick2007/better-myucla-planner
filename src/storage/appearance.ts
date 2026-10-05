export const APPEARANCE_KEY = "plannerLift.appearance.v1";
export type AppearancePreference = "system" | "light" | "dark";

export function normalizeAppearance(value: unknown): AppearancePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export async function readAppearance(): Promise<AppearancePreference> {
  if (!globalThis.chrome?.storage?.local) return "system";
  try {
    const stored = await chrome.storage.local.get(APPEARANCE_KEY);
    return normalizeAppearance(stored[APPEARANCE_KEY]);
  } catch { return "system"; }
}

let writes: Promise<void> = Promise.resolve();
/** Preserve the order of rapid choices without persisting any page data. */
export function saveAppearance(value: AppearancePreference): Promise<void> {
  const preference = normalizeAppearance(value);
  const write = writes.catch(() => {}).then(async () => {
    if (globalThis.chrome?.storage?.local) await chrome.storage.local.set({ [APPEARANCE_KEY]: preference });
  });
  writes = write;
  return write;
}

export function watchAppearance(listener: (value: AppearancePreference) => void): () => void {
  if (!globalThis.chrome?.storage?.onChanged) return () => {};
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area === "local" && APPEARANCE_KEY in changes) listener(normalizeAppearance(changes[APPEARANCE_KEY]?.newValue));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
