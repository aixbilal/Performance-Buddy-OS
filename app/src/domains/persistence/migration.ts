/**
 * Legacy `localStorage` -> SQLite migration planning.
 *
 * Pure and testable: no `window`, no Tauri. The orchestration in
 * `bootstrap.ts` reads legacy state, calls `planLocalStorageMigration`, and
 * hands the eligible entries to the SQLite backend (which does its own
 * idempotency + non-overwrite guarantees in Rust as defence in depth).
 */
import type { KvEntry } from "./backend";

export const LS_PREFIX = "pbos:";

/** Marker written to localStorage after a successful SQLite import (belt-and-braces). */
export const LS_MIGRATED_MARKER = "pbos.__sqlite_migrated__";

export type MigrationPlan = {
  /** Valid JSON blobs eligible to import. */
  eligible: KvEntry[];
  /** Present-but-unparseable legacy values — reported, never dropped or reset. */
  invalid: { key: string; reason: string }[];
  /** True when there is nothing legacy to migrate. */
  empty: boolean;
};

/**
 * @param legacy      every `pbos:*` entry currently in localStorage
 * @param alreadyDone whether SQLite already recorded a completed import
 */
export function planLocalStorageMigration(
  legacy: KvEntry[],
  alreadyDone: boolean,
): MigrationPlan {
  if (alreadyDone) {
    return { eligible: [], invalid: [], empty: true };
  }
  const eligible: KvEntry[] = [];
  const invalid: { key: string; reason: string }[] = [];

  for (const entry of legacy) {
    if (!entry.key.startsWith(LS_PREFIX)) continue;
    if (entry.key === LS_MIGRATED_MARKER) continue;
    try {
      JSON.parse(entry.value);
      eligible.push(entry);
    } catch {
      invalid.push({ key: entry.key, reason: "value is not valid JSON" });
    }
  }

  return {
    eligible,
    invalid,
    empty: eligible.length === 0 && invalid.length === 0,
  };
}

/** Read every `pbos:*` pair straight out of a Storage-like object. */
export function readLegacyLocalStorage(storage: Pick<Storage, "length" | "key" | "getItem">): KvEntry[] {
  const out: KvEntry[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(LS_PREFIX) && key !== LS_MIGRATED_MARKER) {
      const value = storage.getItem(key);
      if (value !== null) out.push({ key, value });
    }
  }
  return out;
}
