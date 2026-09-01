/**
 * Collision-resistant ids for the Planning domain.
 * `crypto.randomUUID()` — NOT `Date.now()`.
 */
export type PlanningIdPrefix = "blk" | "occ" | "cs";

export function newId(prefix: PlanningIdPrefix): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
