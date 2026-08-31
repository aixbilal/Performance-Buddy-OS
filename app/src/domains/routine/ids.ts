/**
 * Collision-resistant ids for the Routines domain.
 * `crypto.randomUUID()` — NOT `Date.now()`.
 */
export type RoutineIdPrefix = "rt" | "rtlog";

export function newId(prefix: RoutineIdPrefix): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
