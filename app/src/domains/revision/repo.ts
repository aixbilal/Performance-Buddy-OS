/**
 * Durable persistence for the general revision / audit event store.
 *
 *   recorder.ts / store.tsx  ->  RevisionRepo  ->  { Tauri -> Rust -> SQLite }
 *                                              \->  { localStorage JSON }  (browser dev only)
 *
 * Append-only: the repo exposes `append` and `load` — never update-one or
 * delete-one. A retried `append` with the same id is a no-op on both
 * backends (the Rust side does INSERT OR IGNORE; the LocalRepo checks the id).
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { RevisionEvent, RevisionQuery } from "./types";

export interface RevisionRepo {
  readonly kind: "sqlite" | "localStorage";
  /** Returns true if a new row was written, false if the id already existed. */
  append(event: RevisionEvent): Promise<boolean>;
  load(query?: RevisionQuery): Promise<RevisionEvent[]>;
}

// --- wire row (matches revision.rs RevisionEventRow) -------------------

type RevisionRow = {
  id: string;
  domain: string;
  entityType: string;
  entityId: string;
  operation: string;
  source: string;
  summary: string;
  metadata: string; // JSON string on the wire
  createdAt: string;
};

function toRow(e: RevisionEvent): RevisionRow {
  return {
    id: e.id,
    domain: e.domain,
    entityType: e.entityType,
    entityId: e.entityId,
    operation: e.operation,
    source: e.source,
    summary: e.summary,
    metadata: JSON.stringify(e.metadata ?? {}),
    createdAt: e.createdAt,
  };
}

function fromRow(r: RevisionRow): RevisionEvent {
  let metadata: Record<string, unknown> = {};
  try {
    const p = r.metadata ? JSON.parse(r.metadata) : {};
    if (p && typeof p === "object" && !Array.isArray(p)) metadata = p as Record<string, unknown>;
  } catch {
    /* corrupt metadata — keep the event, drop the blob */
  }
  return {
    id: r.id,
    domain: r.domain as RevisionEvent["domain"],
    entityType: r.entityType,
    entityId: r.entityId,
    operation: r.operation as RevisionEvent["operation"],
    source: (r.source as RevisionEvent["source"]) || "user",
    summary: r.summary,
    metadata,
    createdAt: r.createdAt,
  };
}

// --- Tauri / SQLite ---------------------------------------------------

class SqliteRepo implements RevisionRepo {
  readonly kind = "sqlite" as const;
  async append(event: RevisionEvent) {
    return (await invoke<boolean>("revision_append", { event: toRow(event) })) ?? true;
  }
  async load(query?: RevisionQuery) {
    const rows = await invoke<RevisionRow[]>("revision_load", {
      query: query
        ? {
            domain: query.domain ?? null,
            entityType: query.entityType ?? null,
            entityId: query.entityId ?? null,
            limit: query.limit ?? null,
          }
        : null,
    });
    return rows.map(fromRow);
  }
}

// --- localStorage (browser dev fallback) ----------------------------

const LS_KEY = "pbos:revision-events";

export class LocalRepo implements RevisionRepo {
  readonly kind = "localStorage" as const;

  private read(): RevisionEvent[] {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as RevisionRow[]).map(fromRow) : [];
    } catch {
      return [];
    }
  }
  private write(events: RevisionEvent[]) {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(events.map(toRow)));
    } catch {
      /* quota / disabled storage — an audit-log write must never surface as
         a user-facing failure. The in-memory recorder still has it. */
    }
  }

  async append(event: RevisionEvent) {
    const events = this.read();
    if (events.some((e) => e.id === event.id)) return false; // idempotent
    events.push(event);
    this.write(events);
    return true;
  }
  async load(query?: RevisionQuery) {
    let events = this.read();
    if (query?.domain) events = events.filter((e) => e.domain === query.domain);
    if (query?.entityType) events = events.filter((e) => e.entityType === query.entityType);
    if (query?.entityId) events = events.filter((e) => e.entityId === query.entityId);
    events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return typeof query?.limit === "number" ? events.slice(0, query.limit) : events;
  }
}

export function makeRevisionRepo(): RevisionRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
