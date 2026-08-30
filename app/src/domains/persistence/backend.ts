/**
 * Performance Buddy OS — persistence backend abstraction.
 *
 * A backend is the durable store behind every domain's `usePersistedState`.
 * All backend operations are async (SQLite goes over the Tauri IPC boundary);
 * the synchronous in-memory cache (`cache.ts`) sits in front so domain stores
 * keep their existing synchronous shape.
 *
 * Selection order (see `bootstrap.ts`):
 *   1. `sqlite`       — real Tauri app. Authoritative production store.
 *   2. `localStorage` — browser dev (`npm run dev`) or a Tauri IPC failure.
 *   3. `memory`       — last resort; explicitly surfaced, never silent.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";

export type BackendName = "sqlite" | "localStorage" | "memory";

export type KvEntry = { key: string; value: string };

export type BackendStatus = {
  schemaVersion: number;
  kvCount: number;
  localstorageMigrated: boolean;
  localstorageMigration: unknown | null;
};

export type MigrationReport = {
  ran: boolean;
  imported: number;
  skippedExisting: number;
  skippedInvalid: { key: string; reason: string }[];
  schemaVersion: number;
};

export interface PersistenceBackend {
  readonly name: BackendName;
  /** True durable persistence (survives an OS-level app restart). */
  readonly durable: boolean;
  loadAll(): Promise<KvEntry[]>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  status(): Promise<BackendStatus>;
  /** Only meaningful for `sqlite`; others return a no-op report. */
  migrateFromLocalStorage(entries: KvEntry[]): Promise<MigrationReport>;
}

const noopReport: MigrationReport = {
  ran: false,
  imported: 0,
  skippedExisting: 0,
  skippedInvalid: [],
  schemaVersion: 0,
};

// ---------------------------------------------------------------------------

export class SqliteBackend implements PersistenceBackend {
  readonly name = "sqlite" as const;
  readonly durable = true;

  async loadAll(): Promise<KvEntry[]> {
    return await invoke<KvEntry[]>("kv_get_all");
  }
  async set(key: string, value: string): Promise<void> {
    await invoke("kv_set", { key, value });
  }
  async delete(key: string): Promise<void> {
    await invoke("kv_delete", { key });
  }
  async status(): Promise<BackendStatus> {
    const s = await invoke<{
      schema_version: number;
      kv_count: number;
      localstorage_migrated: boolean;
      localstorage_migration: unknown;
    }>("db_status");
    return {
      schemaVersion: s.schema_version,
      kvCount: s.kv_count,
      localstorageMigrated: s.localstorage_migrated,
      localstorageMigration: s.localstorage_migration ?? null,
    };
  }
  async migrateFromLocalStorage(entries: KvEntry[]): Promise<MigrationReport> {
    const r = await invoke<{
      ran: boolean;
      imported: number;
      skipped_existing: number;
      skipped_invalid: { key: string; reason: string }[];
      schema_version: number;
    }>("migrate_from_localstorage", { entries });
    return {
      ran: r.ran,
      imported: r.imported,
      skippedExisting: r.skipped_existing,
      skippedInvalid: r.skipped_invalid,
      schemaVersion: r.schema_version,
    };
  }
}

// ---------------------------------------------------------------------------

const LS_PREFIX = "pbos:";

export class LocalStorageBackend implements PersistenceBackend {
  readonly name = "localStorage" as const;
  readonly durable = true; // survives restart in a browser; NOT the production target

  async loadAll(): Promise<KvEntry[]> {
    const out: KvEntry[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(LS_PREFIX)) {
        const value = window.localStorage.getItem(key);
        if (value !== null) out.push({ key, value });
      }
    }
    return out;
  }
  async set(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  }
  async delete(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }
  async status(): Promise<BackendStatus> {
    const entries = await this.loadAll();
    return {
      schemaVersion: 0,
      kvCount: entries.length,
      localstorageMigrated: false,
      localstorageMigration: null,
    };
  }
  async migrateFromLocalStorage(): Promise<MigrationReport> {
    return noopReport;
  }
}

// ---------------------------------------------------------------------------

export class MemoryBackend implements PersistenceBackend {
  readonly name = "memory" as const;
  readonly durable = false;
  private store = new Map<string, string>();

  async loadAll(): Promise<KvEntry[]> {
    return [...this.store].map(([key, value]) => ({ key, value }));
  }
  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  async status(): Promise<BackendStatus> {
    return {
      schemaVersion: 0,
      kvCount: this.store.size,
      localstorageMigrated: false,
      localstorageMigration: null,
    };
  }
  async migrateFromLocalStorage(): Promise<MigrationReport> {
    return noopReport;
  }
}

// ---------------------------------------------------------------------------

/** Which backend this environment should use, before any async probing. */
export function selectBackendName(): BackendName {
  try {
    if (isTauri()) return "sqlite";
  } catch {
    /* isTauri can throw in exotic contexts */
  }
  try {
    const probe = "__pbos_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return "localStorage";
  } catch {
    return "memory";
  }
}

export function makeBackend(name: BackendName): PersistenceBackend {
  switch (name) {
    case "sqlite":
      return new SqliteBackend();
    case "localStorage":
      return new LocalStorageBackend();
    case "memory":
      return new MemoryBackend();
  }
}
