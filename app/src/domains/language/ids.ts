/**
 * Collision-resistant ids for the Reading & Language domain.
 * `crypto.randomUUID()` — NOT `Date.now()`.
 */
export type LanguageIdPrefix = "lpath" | "lunit" | "lsess" | "book" | "rsess";

export function newId(prefix: LanguageIdPrefix): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
