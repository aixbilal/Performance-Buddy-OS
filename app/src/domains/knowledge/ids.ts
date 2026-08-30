/**
 * Collision-resistant ids for the Knowledge domain. `crypto.randomUUID()` is
 * available in every environment PBOS runs in (WebView2 / Chromium, jsdom 30,
 * Node 24). NOT `Date.now()`.
 */
export type KnowledgeIdPrefix = "kt" | "ks" | "ke";

export function newId(prefix: KnowledgeIdPrefix): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
