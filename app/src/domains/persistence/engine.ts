/**
 * Deterministic Persistence Engine. Save/load logic is pure and testable
 * via an injectable `StorageAdapter` — no real browser needed for tests,
 * but the SAME code runs against real `window.localStorage` in the app.
 */

import type { LoadResult, SaveResult, StorageAdapter } from "./types";

/**
 * §36: "KEEP DRAFT... Do NOT clear the form... silently lose user input."
 * This function only ever reports success/failure — it never touches or
 * clears the caller's in-memory value. The caller (usePersistedState)
 * keeps the draft regardless of what this returns.
 */
export function attemptSave(adapter: StorageAdapter, key: string, value: unknown): SaveResult {
  try {
    const serialized = JSON.stringify(value);
    adapter.setItem(key, serialized);
    return { success: true, error: null };
  } catch (e) {
    // Real failure modes this actually catches: localStorage quota
    // exceeded, storage disabled (e.g. some private-browsing modes),
    // or a value that can't be serialized (e.g. contains a circular
    // reference) — not a fabricated error.
    const message = e instanceof Error ? e.message : "Unknown storage error";
    return { success: false, error: message };
  }
}

/**
 * §47/§48: distinguishes "key never existed" (true empty, not an error)
 * from "key existed but is corrupted" (a real error, per §17's Unknown ≠
 * Zero) — both return the fallback, but only the second sets `error`.
 */
export function attemptLoad<T>(adapter: StorageAdapter, key: string, fallback: T): LoadResult<T> {
  const raw = adapter.getItem(key);
  if (raw === null) {
    return { value: fallback, error: null, wasEmpty: true };
  }
  try {
    const parsed = JSON.parse(raw) as T;
    return { value: parsed, error: null, wasEmpty: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Corrupted stored data";
    return { value: fallback, error: message, wasEmpty: false };
  }
}
