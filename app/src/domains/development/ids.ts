/**
 * Collision-resistant ids for the Development domain. `crypto.randomUUID()` is
 * available in every environment PBOS runs in. NOT `Date.now()`.
 */
export type DevIdPrefix = "proj" | "skill" | "ms" | "sev";

export function newId(prefix: DevIdPrefix): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
