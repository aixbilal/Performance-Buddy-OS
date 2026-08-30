/**
 * Collision-resistant ids for the Academic domain. `crypto.randomUUID()` is
 * available in every environment PBOS runs in (WebView2 / Chromium, jsdom 30,
 * Node 24). NOT `Date.now()` (audit + docs 11.01 "Links use stable IDs").
 */
export type AcademicIdPrefix = "course" | "topic" | "assess" | "attempt" | "sem";

export function newId(prefix: AcademicIdPrefix): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
