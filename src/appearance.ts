import { readAppearance, watchAppearance, type AppearancePreference } from "./storage/appearance";

export type ResolvedAppearance = "light" | "dark";
export interface AppearanceState { preference: AppearancePreference; resolved: ResolvedAppearance; }

/** One subscription owns its media/storage listeners and ignores late reads. */
export function subscribeAppearance(listener: (state: AppearanceState) => void, view: Window = window): () => void {
  const media = typeof view.matchMedia === "function" ? view.matchMedia("(prefers-color-scheme: dark)") : null;
  let preference: AppearancePreference = "system", disposed = false, ready = false, revision = 0;
  const render = (): void => {
    if (!disposed && ready) listener({ preference, resolved: preference === "dark" || (preference === "system" && media?.matches) ? "dark" : "light" });
  };
  const stop = watchAppearance(value => { revision++; preference = value; ready = true; render(); });
  const mediaChange = (): void => { if (preference === "system") render(); };
  media?.addEventListener("change", mediaChange);
  const readRevision = revision;
  void readAppearance().then(value => {
    if (disposed || revision !== readRevision) return;
    preference = value; ready = true; render();
  });
  return () => {
    if (disposed) return;
    disposed = true; stop(); media?.removeEventListener("change", mediaChange);
  };
}
