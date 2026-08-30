/**
 * Synchronous read-through / write-behind cache in front of the async
 * persistence backend.
 *
 * Domain stores keep calling `usePersistedState` synchronously. This cache is
 * pre-warmed by `initPersistence()` before React renders, so first-render
 * reads are synchronous. Writes update the cache synchronously (the draft is
 * never lost, per the locked §36 rule) and are mirrored to the durable
 * backend asynchronously; the mirror's real outcome drives `SaveState`.
 */
import type { PersistenceBackend } from "./backend";
import type { StorageAdapter } from "./types";
import { isSimulatingFailure } from "./testControls";

const cache = new Map<string, string>();
let backend: PersistenceBackend | null = null;

/** Called once by `initPersistence()` after the backend has loaded. */
export function primeCache(entries: { key: string; value: string }[], activeBackend: PersistenceBackend): void {
  cache.clear();
  for (const { key, value } of entries) cache.set(key, value);
  backend = activeBackend;
}

/** Test/reset hook. */
export function __resetCacheForTests(): void {
  cache.clear();
  backend = null;
}

/**
 * A synchronous `StorageAdapter` view over the cache — this is what
 * `usePersistedState` reads and what `attemptLoad`/`attemptSave` operate on,
 * so the existing corruption-detection engine and its tests are unchanged.
 */
export const cacheAdapter: StorageAdapter = {
  getItem: (key) => (cache.has(key) ? (cache.get(key) as string) : null),
  setItem: (key, value) => {
    cache.set(key, value);
  },
};

/**
 * Mirror a committed cache write to the durable backend. Resolves on a real
 * successful persist, rejects on a real failure — callers surface that as
 * `SaveState` "saved" / "failed" and NEVER revert the in-memory value.
 */
export async function mirrorWrite(key: string, rawValue: string): Promise<void> {
  if (isSimulatingFailure()) {
    throw new Error("Simulated storage failure (dev/test control enabled)");
  }
  if (!backend) {
    // No backend wired => we are not actually persisting. Represent that
    // honestly rather than pretending success.
    throw new Error("Persistence backend unavailable");
  }
  await backend.set(key, rawValue);
}

export async function mirrorDelete(key: string): Promise<void> {
  cache.delete(key);
  if (isSimulatingFailure()) throw new Error("Simulated storage failure (dev/test control enabled)");
  if (!backend) throw new Error("Persistence backend unavailable");
  await backend.delete(key);
}
