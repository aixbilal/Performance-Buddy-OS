/**
 * Collision-resistant ids for the Quick Capture domain.
 * `crypto.randomUUID()` — NOT `Date.now()` (which collided on fast entry).
 */
export function newCaptureId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `cap_${uuid}`;
}
