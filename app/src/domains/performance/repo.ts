/**
 * Canonical relational persistence for the Performance spine.
 *
 *   store.tsx  ->  PerformanceRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                                  \->  { localStorage JSON }  (browser dev only)
 *
 * The Tauri path is authoritative in the real app. The localStorage path is an
 * explicit dev fallback so `npm run dev` keeps working; it stores the same
 * canonical shape under one key and is clearly not the production target.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { assertRepoWritable } from "../persistence/testControls";
import type { Action, Goal, PerfGraph, System } from "./types";

export type PerfImportReport = {
  ran: boolean;
  goalsImported: number;
  systemsImported: number;
  actionsImported: number;
  linksImported: number;
  goalsSkippedExisting: number;
  systemsSkippedExisting: number;
  actionsSkippedExisting: number;
};

export interface PerformanceRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<PerfGraph>;
  goalUpsert(goal: Goal): Promise<void>;
  goalDelete(id: string): Promise<void>;
  systemUpsert(system: System): Promise<void>;
  systemDelete(id: string): Promise<void>;
  actionUpsert(action: Action): Promise<void>;
  actionDelete(id: string): Promise<void>;
  linkSet(goalId: string, systemId: string, linked: boolean): Promise<void>;
  actionsReorder(systemId: string, orderedIds: string[]): Promise<void>;
  importGraph(graph: PerfGraph): Promise<PerfImportReport>;
}
// NOTE: there is intentionally no `resetForTest` on the repo — native E2E calls
// the debug-only `perf_reset_for_test` Tauri command directly, so no test-only
// string ends up in the production bundle.

// --- Tauri / SQLite --------------------------------------------------------

/** Rust returns snake_case in the import report; normalize to camelCase. */
function normReport(r: Record<string, unknown>): PerfImportReport {
  return {
    ran: !!r.ran,
    goalsImported: Number(r.goalsImported ?? r.goals_imported ?? 0),
    systemsImported: Number(r.systemsImported ?? r.systems_imported ?? 0),
    actionsImported: Number(r.actionsImported ?? r.actions_imported ?? 0),
    linksImported: Number(r.linksImported ?? r.links_imported ?? 0),
    goalsSkippedExisting: Number(r.goalsSkippedExisting ?? r.goals_skipped_existing ?? 0),
    systemsSkippedExisting: Number(r.systemsSkippedExisting ?? r.systems_skipped_existing ?? 0),
    actionsSkippedExisting: Number(r.actionsSkippedExisting ?? r.actions_skipped_existing ?? 0),
  };
}

class SqliteRepo implements PerformanceRepo {
  readonly kind = "sqlite" as const;
  async load() {
    return await invoke<PerfGraph>("perf_load");
  }
  async goalUpsert(goal: Goal) {
    await invoke("perf_goal_upsert", { goal });
  }
  async goalDelete(id: string) {
    await invoke("perf_goal_delete", { id });
  }
  async systemUpsert(system: System) {
    await invoke("perf_system_upsert", { system });
  }
  async systemDelete(id: string) {
    await invoke("perf_system_delete", { id });
  }
  async actionUpsert(action: Action) {
    await invoke("perf_action_upsert", { action });
  }
  async actionDelete(id: string) {
    await invoke("perf_action_delete", { id });
  }
  async linkSet(goalId: string, systemId: string, linked: boolean) {
    await invoke("perf_link_set", { goalId, systemId, linked });
  }
  async actionsReorder(systemId: string, orderedIds: string[]) {
    await invoke("perf_actions_reorder", { systemId, orderedIds });
  }
  async importGraph(graph: PerfGraph) {
    return normReport(await invoke("perf_import_graph", { import: graph }));
  }
}

// --- localStorage (browser dev fallback) ----------------------------------

const LS_KEY = "pbos:performance-v2";
const LS_IMPORT_MARK = "pbos:performance-v2-imported";

export class LocalRepo implements PerformanceRepo {
  readonly kind = "localStorage" as const;

  private read(): PerfGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { goals: [], systems: [], actions: [], links: [] };
      const g = JSON.parse(raw) as PerfGraph;
      return {
        goals: g.goals ?? [],
        systems: g.systems ?? [],
        actions: g.actions ?? [],
        links: g.links ?? [],
      };
    } catch {
      return { goals: [], systems: [], actions: [], links: [] };
    }
  }
  private write(g: PerfGraph) {
    assertRepoWritable(); // dev/test-only save-failure injection (no-op in production)
    window.localStorage.setItem(LS_KEY, JSON.stringify(g));
  }

  async load() {
    return this.read();
  }
  async goalUpsert(goal: Goal) {
    const g = this.read();
    const i = g.goals.findIndex((x) => x.id === goal.id);
    if (i >= 0) g.goals[i] = { ...goal, createdAt: g.goals[i].createdAt };
    else g.goals.push(goal);
    this.write(g);
  }
  async goalDelete(id: string) {
    const g = this.read();
    g.goals = g.goals.filter((x) => x.id !== id);
    g.links = g.links.filter((l) => l.goalId !== id);
    this.write(g);
  }
  async systemUpsert(system: System) {
    const g = this.read();
    const i = g.systems.findIndex((x) => x.id === system.id);
    if (i >= 0) g.systems[i] = { ...system, createdAt: g.systems[i].createdAt };
    else g.systems.push(system);
    this.write(g);
  }
  async systemDelete(id: string) {
    const g = this.read();
    g.systems = g.systems.filter((x) => x.id !== id);
    g.links = g.links.filter((l) => l.systemId !== id);
    g.actions = g.actions.map((a) => (a.systemId === id ? { ...a, systemId: null } : a));
    this.write(g);
  }
  async actionUpsert(action: Action) {
    const g = this.read();
    const i = g.actions.findIndex((x) => x.id === action.id);
    if (i >= 0) g.actions[i] = { ...action, createdAt: g.actions[i].createdAt };
    else g.actions.push(action);
    this.write(g);
  }
  async actionDelete(id: string) {
    const g = this.read();
    g.actions = g.actions.filter((x) => x.id !== id);
    this.write(g);
  }
  async linkSet(goalId: string, systemId: string, linked: boolean) {
    const g = this.read();
    const exists = g.links.some((l) => l.goalId === goalId && l.systemId === systemId);
    if (linked && !exists && g.goals.some((x) => x.id === goalId) && g.systems.some((x) => x.id === systemId)) {
      g.links.push({ goalId, systemId });
    } else if (!linked) {
      g.links = g.links.filter((l) => !(l.goalId === goalId && l.systemId === systemId));
    }
    this.write(g);
  }
  async actionsReorder(systemId: string, orderedIds: string[]) {
    const g = this.read();
    g.actions = g.actions.map((a) => {
      if (a.systemId !== systemId) return a;
      const pos = orderedIds.indexOf(a.id);
      return pos >= 0 ? { ...a, position: pos } : a;
    });
    this.write(g);
  }
  async importGraph(graph: PerfGraph): Promise<PerfImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return {
        ran: false,
        goalsImported: 0,
        systemsImported: 0,
        actionsImported: 0,
        linksImported: 0,
        goalsSkippedExisting: 0,
        systemsSkippedExisting: 0,
        actionsSkippedExisting: 0,
      };
    }
    const g = this.read();
    const has = (arr: { id: string }[], id: string) => arr.some((x) => x.id === id);
    const report: PerfImportReport = {
      ran: true,
      goalsImported: 0,
      systemsImported: 0,
      actionsImported: 0,
      linksImported: 0,
      goalsSkippedExisting: 0,
      systemsSkippedExisting: 0,
      actionsSkippedExisting: 0,
    };
    for (const s of graph.systems) {
      if (has(g.systems, s.id)) report.systemsSkippedExisting++;
      else {
        g.systems.push(s);
        report.systemsImported++;
      }
    }
    for (const go of graph.goals) {
      if (has(g.goals, go.id)) report.goalsSkippedExisting++;
      else {
        g.goals.push(go);
        report.goalsImported++;
      }
    }
    for (const a of graph.actions) {
      if (has(g.actions, a.id)) report.actionsSkippedExisting++;
      else {
        g.actions.push(
          a.systemId && !g.systems.some((s) => s.id === a.systemId) ? { ...a, systemId: null } : a,
        );
        report.actionsImported++;
      }
    }
    for (const l of graph.links) {
      if (
        g.goals.some((x) => x.id === l.goalId) &&
        g.systems.some((x) => x.id === l.systemId) &&
        !g.links.some((x) => x.goalId === l.goalId && x.systemId === l.systemId)
      ) {
        g.links.push(l);
        report.linksImported++;
      }
    }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makePerformanceRepo(): PerformanceRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
