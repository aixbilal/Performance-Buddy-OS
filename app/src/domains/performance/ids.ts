/**
 * Collision-resistant ids for the Performance spine. `crypto.randomUUID()` is
 * available in every environment PBOS runs in (WebView2 / Chromium, jsdom 30,
 * Node 24). NOT `Date.now()` (audit + docs 11.01 "Links use stable IDs").
 */
export function newId(prefix: "goal" | "sys" | "act"): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : // extremely defensive fallback — still not time-only
        `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
