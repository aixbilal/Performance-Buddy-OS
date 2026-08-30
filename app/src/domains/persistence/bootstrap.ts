/**
 * One-time persistence bootstrap. `initPersistence()` MUST resolve before the
 * React tree renders (domain stores read the cache in their first render).
 *
 * Steps:
 *   1. pick a backend for this environment (sqlite in Tauri; localStorage in
 *      browser dev; memory as an explicit last resort)
 *   2. if sqlite and the one-time localStorage import has not run: read legacy
 *      `pbos:*` from localStorage, validate, hand the eligible entries to Rust
 *      (which is itself idempotent and never overwrites newer SQLite rows)
 *   3. load the whole store into the synchronous cache
 *   4. record a truthful status for diagnostics / the loading gate
 *
 * If the chosen sqlite backend fails at any point we fall back to
 * localStorage — but the status object says so plainly (`degradedFrom`), it is
 * never a silent switch to volatile memory.
 */
import {
  makeBackend,
  selectBackendName,
  type BackendName,
  type MigrationReport,
  type PersistenceBackend,
} from "./backend";
import { primeCache } from "./cache";
import {
  LS_MIGRATED_MARKER,
  planLocalStorageMigration,
  readLegacyLocalStorage,
} from "./migration";

export type PersistencePhase = "idle" | "loading" | "loaded" | "failed";

export type PersistenceStatus = {
  phase: PersistencePhase;
  backend: BackendName;
  /** Set when the intended backend failed and we dropped to a lesser one. */
  degradedFrom: BackendName | null;
  durable: boolean;
  schemaVersion: number;
  keyCount: number;
  migration: (MigrationReport & { invalidKeys: string[] }) | null;
  error: string | null;
};

let status: PersistenceStatus = {
  phase: "idle",
  backend: "memory",
  degradedFrom: null,
  durable: false,
  schemaVersion: 0,
  keyCount: 0,
  migration: null,
  error: null,
};

let started: Promise<PersistenceStatus> | null = null;

export function getPersistenceStatus(): PersistenceStatus {
  return status;
}

/** Idempotent — repeated calls return the same in-flight/settled promise. */
export function initPersistence(): Promise<PersistenceStatus> {
  if (started) return started;
  started = run();
  return started;
}

/** Test hook. */
export function __resetPersistenceBootstrapForTests(): void {
  started = null;
  status = {
    phase: "idle",
    backend: "memory",
    degradedFrom: null,
    durable: false,
    schemaVersion: 0,
    keyCount: 0,
    migration: null,
    error: null,
  };
}

async function run(): Promise<PersistenceStatus> {
  status = { ...status, phase: "loading" };
  const intended = selectBackendName();

  try {
    const result = await bringUp(makeBackend(intended));
    status = { ...result, degradedFrom: null };
    return status;
  } catch (primary) {
    const primaryMsg = primary instanceof Error ? primary.message : String(primary);

    // Only sqlite is worth falling back from; localStorage/memory failing is terminal-ish.
    if (intended === "sqlite") {
      try {
        const fallback = await bringUp(makeBackend("localStorage"));
        status = {
          ...fallback,
          degradedFrom: "sqlite",
          error: `SQLite unavailable (${primaryMsg}); using localStorage`,
        };
        return status;
      } catch (secondary) {
        const secMsg = secondary instanceof Error ? secondary.message : String(secondary);
        status = {
          ...status,
          phase: "failed",
          backend: "memory",
          degradedFrom: "sqlite",
          durable: false,
          error: `SQLite (${primaryMsg}) and localStorage (${secMsg}) both failed`,
        };
        primeCache([], makeBackend("memory"));
        return status;
      }
    }

    status = { ...status, phase: "failed", backend: intended, error: primaryMsg };
    primeCache([], makeBackend("memory"));
    return status;
  }
}

async function bringUp(backend: PersistenceBackend): Promise<PersistenceStatus> {
  let migration: (MigrationReport & { invalidKeys: string[] }) | null = null;

  if (backend.name === "sqlite") {
    const s = await backend.status();
    if (!s.localstorageMigrated) {
      const legacy = safeReadLegacy();
      const plan = planLocalStorageMigration(legacy, false);
      const report = await backend.migrateFromLocalStorage(plan.eligible);
      const invalidKeys = [
        ...plan.invalid.map((i) => i.key),
        ...report.skippedInvalid.map((i) => i.key),
      ];
      migration = { ...report, invalidKeys: [...new Set(invalidKeys)] };
      // Belt-and-braces marker; legacy keys are intentionally NOT deleted
      // (backup path — see V1-COMPLETION-TRACKER cleanup note).
      try {
        window.localStorage.setItem(LS_MIGRATED_MARKER, new Date().toISOString());
      } catch {
        /* non-fatal */
      }
    } else {
      migration = {
        ran: false,
        imported: 0,
        skippedExisting: 0,
        skippedInvalid: [],
        schemaVersion: s.schemaVersion,
        invalidKeys: [],
      };
    }
  }

  const entries = await backend.loadAll();
  primeCache(entries, backend);
  const s = await backend.status();

  return {
    phase: "loaded",
    backend: backend.name,
    degradedFrom: null,
    durable: backend.durable,
    schemaVersion: s.schemaVersion,
    keyCount: entries.length,
    migration,
    error: null,
  };
}

function safeReadLegacy() {
  try {
    return readLegacyLocalStorage(window.localStorage);
  } catch {
    return [];
  }
}
