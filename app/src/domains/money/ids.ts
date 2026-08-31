/**
 * Collision-resistant ids for the Money domain.
 * `crypto.randomUUID()` — NOT `Date.now()`.
 */
export type MoneyIdPrefix = "tx" | "pe" | "bg" | "sg";

export function newId(prefix: MoneyIdPrefix): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}
