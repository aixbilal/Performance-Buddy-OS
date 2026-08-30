import { useState } from "react";
import { attemptLoad } from "./engine";
import { cacheAdapter, mirrorWrite } from "./cache";
import type { SaveState } from "../resilience/types";

const STORAGE_PREFIX = "pbos:";

/**
 * Durable persistence for a single domain slice. Backed by SQLite in the real
 * Tauri app (via the async backend behind `cache.ts`), or localStorage in
 * browser dev — see `bootstrap.ts` / `backend.ts`.
 *
 * The signature is unchanged from the localStorage-era hook so no domain store
 * needs to change:  `[value, setValue, saveState, loadError]`.
 *
 * - First render reads the synchronous cache (pre-warmed by `initPersistence`).
 *   `attemptLoad` still distinguishes "key never existed" (no error) from
 *   "key existed but is corrupted" (`loadError` set) — §47/§48.
 * - `setValue` updates the in-memory value AND the cache immediately (the
 *   draft is never lost), then mirrors to the durable backend asynchronously.
 *   `saveState` reflects the REAL mirror outcome: "saving" -> "saved" | "failed".
 *   On "failed" the value the caller sees is never reverted — §36.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void, SaveState, string | null] {
  const fullKey = STORAGE_PREFIX + key;

  const [loadError] = useState<string | null>(
    () => attemptLoad<T>(cacheAdapter, fullKey, initialValue).error,
  );
  const [value, setValueState] = useState<T>(
    () => attemptLoad<T>(cacheAdapter, fullKey, initialValue).value,
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const setValue = (next: T) => {
    setValueState(next);
    // Synchronous local commit — cache is the immediate source of truth and
    // the draft is safe even if the durable write below fails.
    try {
      cacheAdapter.setItem(fullKey, JSON.stringify(next));
    } catch {
      /* serialization failure is surfaced by the mirror below */
    }
    setSaveState("saving");
    void (async () => {
      try {
        await mirrorWrite(fullKey, JSON.stringify(next));
        setSaveState("saved");
      } catch {
        setSaveState("failed");
      }
    })();
  };

  return [value, setValue, saveState, loadError];
}
