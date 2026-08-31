/**
 * Durable persistence for completed Focus sessions (Batch 4 — session history).
 *
 *   store.tsx  ->  FocusRepo  ->  { study_* Tauri commands -> Rust -> SQLite }
 *                            \->  { localStorage JSON }  (browser dev only)
 *
 * A record is ACTIVITY evidence only — duration + method, plus an optional
 * `recallScore` when a genuine check was done. Never a mastery value.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { FocusSessionRecord } from "./types";

export interface FocusRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<FocusSessionRecord[]>;
  upsert(record: FocusSessionRecord): Promise<void>;
  remove(id: string): Promise<void>;
  importRecords(records: FocusSessionRecord[]): Promise<{ ran: boolean; imported: number }>;
}

// --- Tauri / SQLite ----------------------------------------------------

class SqliteRepo implements FocusRepo {
  readonly kind = "sqlite" as const;
  async load() {
    const g = await invoke<{ focusSessions: FocusSessionRecord[] }>("study_load");
    return g.focusSessions ?? [];
  }
  async upsert(record: FocusSessionRecord) {
    await invoke("study_focus_session_upsert", { session: record });
  }
  async remove(id: string) {
    await invoke("study_focus_session_delete", { id });
  }
  async importRecords(records: FocusSessionRecord[]) {
    const r = (await invoke("study_import_graph", {
      import: { focusSessions: records, masteryChecks: [] },
    })) as Record<string, unknown>;
    return {
      ran: !!r.ran,
      imported: Number(r.focusSessionsImported ?? r.focus_sessions_imported ?? 0),
    };
  }
}

// --- localStorage (browser dev fallback) -----------------------------

const LS_KEY = "pbos:focus-sessions-v2";

export class LocalRepo implements FocusRepo {
  readonly kind = "localStorage" as const;

  private read(): FocusSessionRecord[] {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as FocusSessionRecord[]) : [];
    } catch {
      return [];
    }
  }
  private write(rows: FocusSessionRecord[]) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(rows));
  }
  async load() {
    return this.read().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async upsert(record: FocusSessionRecord) {
    const rows = this.read();
    const i = rows.findIndex((r) => r.id === record.id);
    if (i >= 0) rows[i] = { ...record, createdAt: rows[i].createdAt };
    else rows.push(record);
    this.write(rows);
  }
  async remove(id: string) {
    this.write(this.read().filter((r) => r.id !== id));
  }
  async importRecords() {
    return { ran: false, imported: 0 };
  }
}

export function makeFocusRepo(): FocusRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
