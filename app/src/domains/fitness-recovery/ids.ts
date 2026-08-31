/**
 * Collision-resistant ids for the Fitness & Recovery domain.
 * `crypto.randomUUID()` — NOT `Date.now()`.
 */
export type FitIdPrefix = "plan" | "psess" | "wsess" | "ci";

export function newId(prefix: FitIdPrefix): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
