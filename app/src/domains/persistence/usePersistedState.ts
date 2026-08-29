import { useEffect, useRef, useState } from "react";
import { attemptLoad, attemptSave } from "./engine";
import { getStorageAdapter } from "./testControls";
import type { SaveState } from "../resilience/types";

const STORAGE_PREFIX = "pbos:";

/**
 * Real persistence — backed by actual `window.localStorage` (via
 * `getStorageAdapter`, which also allows the honest "simulate failure" test
 * control — see testControls.ts). Genuinely survives an app restart in the
 * real Tauri window (webviews persist localStorage to disk).
 *
 * §36: on save failure, the in-memory `value` the caller sees is NEVER
 * reverted or cleared — only `saveState` reflects the failure. The draft
 * is never lost, per the locked rule.
 */
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T) => void, SaveState, string | null] {
  const fullKey = STORAGE_PREFIX + key;
  const [loadError] = useState<string | null>(() => attemptLoad<T>(window.localStorage, fullKey, initialValue).error);
  const [value, setValueState] = useState<T>(() => attemptLoad<T>(window.localStorage, fullKey, initialValue).value);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return; // don't "save" the value we just loaded — only save real changes
    }
    setSaveState("saving");
    const result = attemptSave(getStorageAdapter(), fullKey, value);
    setSaveState(result.success ? "saved" : "failed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const setValue = (next: T) => setValueState(next);

  return [value, setValue, saveState, loadError];
}
