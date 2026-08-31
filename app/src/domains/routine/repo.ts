/**
 * Canonical relational persistence for the Routines & Daily Life domain.
 *
 *   store.tsx  ->  RoutineRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                              \->  { localStorage JSON }  (browser dev only)
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Routine, RoutineGraph, RoutineLog } from "./types";

export type RoutineImportReport = {
  ran: boolean;
  routinesImported: number;
  logsImported: number;
  systemLinksCleared: number;
};

export interface RoutineRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<RoutineGraph>;
  routineUpsert(routine: Routine): Promise<void>;
  routineDelete(id: string): Promise<void>;
  logUpsert(log: RoutineLog): Promise<void>;
  logDelete(id: string): Promise<void>;
  importGraph(graph: RoutineGraph): Promise<RoutineImportReport>;
}

const EMPTY: RoutineGraph = { routines: [], logs: [] };

function normReport(r: Record<string, unknown>): RoutineImportReport {
  const num = (a: unknown, b: unknown) => Number(a ?? b ?? 0);
  return {
    ran: !!r.ran,
    routinesImported: num(r.routinesImported, r.routines_imported),
    logsImported: num(r.logsImported, r.logs_imported),
    systemLinksCleared: num(r.systemLinksCleared, r.system_links_cleared),
  };
}

/** Rust stores `scheduleDays` as a JSON string; the TS boundary uses an array. */
type WireRoutine = Omit<Routine, "scheduleDays"> & { scheduleDays: string };

function routineToWire(r: Routine): WireRoutine {
  const { scheduleDays, ...rest } = r;
  return { ...rest, scheduleDays: JSON.stringify(scheduleDays) };
}
function routineFromWire(w: Record<string, unknown>): Routine {
  return { ...(w as unknown as Routine), scheduleDays: safeIntArr(w.scheduleDays) };
}
function safeIntArr(v: unknown): number[] {
  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? (() => {
          try {
            const p = JSON.parse(v);
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        })()
      : [];
  return arr.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6).sort((a, b) => a - b);
}

// --- Tauri / SQLite --------------------------------------------------------

class SqliteRepo implements RoutineRepo {
  readonly kind = "sqlite" as const;
  async load() {
    const g = await invoke<{ routines: Record<string, unknown>[]; logs: RoutineLog[] }>("rtn_load");
    return { routines: g.routines.map(routineFromWire), logs: g.logs };
  }
  async routineUpsert(routine: Routine) {
    await invoke("rtn_routine_upsert", { routine: routineToWire(routine) });
  }
  async routineDelete(id: string) {
    await invoke("rtn_routine_delete", { id });
  }
  async logUpsert(log: RoutineLog) {
    await invoke("rtn_log_upsert", { log });
  }
  async logDelete(id: string) {
    await invoke("rtn_log_delete", { id });
  }
  async importGraph(graph: RoutineGraph) {
    return normReport(
      await invoke("rtn_import_graph", {
        import: { routines: graph.routines.map(routineToWire), logs: graph.logs },
      }),
    );
  }
}

// --- localStorage (browser dev fallback) ---------------------------------

const LS_KEY = "pbos:routine-v2";
const LS_IMPORT_MARK = "pbos:routine-v2-imported";

export class LocalRepo implements RoutineRepo {
  readonly kind = "localStorage" as const;

  private read(): RoutineGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { ...EMPTY };
      const g = JSON.parse(raw) as RoutineGraph;
      return { routines: g.routines ?? [], logs: g.logs ?? [] };
    } catch {
      return { ...EMPTY };
    }
  }
  private write(g: RoutineGraph) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(g));
  }
  private upsert<T extends { id: string; createdAt: string }>(arr: T[], row: T): T[] {
    const i = arr.findIndex((x) => x.id === row.id);
    if (i >= 0) {
      const next = [...arr];
      next[i] = { ...row, createdAt: arr[i].createdAt };
      return next;
    }
    return [...arr, row];
  }

  async load() {
    return this.read();
  }
  async routineUpsert(routine: Routine) {
    const g = this.read();
    g.routines = this.upsert(g.routines, routine);
    this.write(g);
  }
  async routineDelete(id: string) {
    const g = this.read();
    g.routines = g.routines.filter((r) => r.id !== id);
    g.logs = g.logs.filter((l) => l.routineId !== id); // CASCADE
    this.write(g);
  }
  async logUpsert(log: RoutineLog) {
    const g = this.read();
    if (!g.routines.some((r) => r.id === log.routineId)) return; // FK
    g.logs = this.upsert(g.logs, log);
    this.write(g);
  }
  async logDelete(id: string) {
    const g = this.read();
    g.logs = g.logs.filter((l) => l.id !== id);
    this.write(g);
  }
  async importGraph(graph: RoutineGraph): Promise<RoutineImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return { ran: false, routinesImported: 0, logsImported: 0, systemLinksCleared: 0 };
    }
    const g = this.read();
    const has = (arr: { id: string }[], id: string) => arr.some((x) => x.id === id);
    const report: RoutineImportReport = {
      ran: true,
      routinesImported: 0,
      logsImported: 0,
      systemLinksCleared: 0,
    };
    for (const r of graph.routines)
      if (!has(g.routines, r.id)) {
        g.routines.push(r);
        report.routinesImported++;
      }
    for (const l of graph.logs) {
      if (has(g.logs, l.id) || !has(g.routines, l.routineId)) continue;
      g.logs.push(l);
      report.logsImported++;
    }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makeRoutineRepo(): RoutineRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
