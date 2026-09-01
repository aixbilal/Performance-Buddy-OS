/** Collision-resistant ids for revision events (`crypto.randomUUID()`). */
export function newRevisionId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `rev_${uuid}`;
}
