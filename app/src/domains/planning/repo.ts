/**
 * Canonical relational persistence for the Planning & Calendar domain.
 *
 *   store.tsx  ->  PlanningRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                               \->  { localStorage JSON }  (browser dev only)
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { DEFAULT_CAPACITY, type CapacityConfig, type PlanningBlock, type PlanningGraph } from "./types";

export type PlanningImportReport = {
  ran: boolean;
  blocksImported: number;
  actionLinksCleared: number;
  capacityImported: boolean;
};

export interface PlanningRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<PlanningGraph>;
  blockUpsert(block: PlanningBlock): Promise<void>;
  blockDelete(id: string): Promise<void>;
  capacitySet(capacity: CapacityConfig): Promise<void>;
  importGraph(graph: PlanningGraph): Promise<PlanningImportReport>;
}

const EMPTY: PlanningGraph = { blocks: [], capacity: { ...DEFAULT_CAPACITY } };

function normReport(r: Record<string, unknown>): PlanningImportReport {
  const n = (a: unknown, b: unknown) => Number(a ?? b ?? 0);
  return {
    ran: !!r.ran,
    blocksImported: n(r.blocksImported, r.blocks_imported),
    actionLinksCleared: n(r.actionLinksCleared, r.action_links_cleared),
    capacityImported: !!(r.capacityImported ?? r.capacity_imported),
  };
}

// Rust CapacityRow <-> TS CapacityConfig field-name mapping.
type WireCapacity = { dailyMinutes: number; weeklyMinutes: number };
const capToWire = (c: CapacityConfig): WireCapacity => ({
  dailyMinutes: c.dailyCapacityMinutes,
  weeklyMinutes: c.weeklyCapacityMinutes,
});
const capFromWire = (w: Partial<WireCapacity> | null | undefined): CapacityConfig => ({
  dailyCapacityMinutes: Number(w?.dailyMinutes ?? DEFAULT_CAPACITY.dailyCapacityMinutes),
  weeklyCapacityMinutes: Number(w?.weeklyMinutes ?? DEFAULT_CAPACITY.weeklyCapacityMinutes),
});

// --- Tauri / SQLite ------------------------------------------------------

class SqliteRepo implements PlanningRepo {
  readonly kind = "sqlite" as const;
  async load() {
    const g = await invoke<{ blocks: PlanningBlock[]; capacity: WireCapacity }>("plan_load");
    return { blocks: g.blocks, capacity: capFromWire(g.capacity) };
  }
  async blockUpsert(block: PlanningBlock) {
    await invoke("plan_block_upsert", { block });
  }
  async blockDelete(id: string) {
    await invoke("plan_block_delete", { id });
  }
  async capacitySet(capacity: CapacityConfig) {
    await invoke("plan_capacity_set", { capacity: capToWire(capacity), now: new Date().toISOString() });
  }
  async importGraph(graph: PlanningGraph) {
    return normReport(
      await invoke("plan_import_graph", {
        import: { blocks: graph.blocks, capacity: capToWire(graph.capacity) },
      }),
    );
  }
}

// --- localStorage (browser dev fallback) -------------------------------

const LS_KEY = "pbos:planning-v2";
const LS_IMPORT_MARK = "pbos:planning-v2-imported";

export class LocalRepo implements PlanningRepo {
  readonly kind = "localStorage" as const;

  private read(): PlanningGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { blocks: [], capacity: { ...DEFAULT_CAPACITY } };
      const g = JSON.parse(raw) as PlanningGraph;
      return {
        blocks: g.blocks ?? [],
        capacity: g.capacity ?? { ...DEFAULT_CAPACITY },
      };
    } catch {
      return { blocks: [], capacity: { ...DEFAULT_CAPACITY } };
    }
  }
  private write(g: PlanningGraph) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(g));
  }

  async load() {
    return this.read();
  }
  async blockUpsert(block: PlanningBlock) {
    const g = this.read();
    const i = g.blocks.findIndex((b) => b.id === block.id);
    if (i >= 0) g.blocks[i] = { ...block, createdAt: g.blocks[i].createdAt };
    else g.blocks.push(block);
    this.write(g);
  }
  async blockDelete(id: string) {
    const g = this.read();
    g.blocks = g.blocks.filter((b) => b.id !== id);
    this.write(g);
  }
  async capacitySet(capacity: CapacityConfig) {
    const g = this.read();
    g.capacity = capacity;
    this.write(g);
  }
  async importGraph(graph: PlanningGraph): Promise<PlanningImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return { ran: false, blocksImported: 0, actionLinksCleared: 0, capacityImported: false };
    }
    const g = this.read();
    const has = (id: string) => g.blocks.some((b) => b.id === id);
    const report: PlanningImportReport = {
      ran: true,
      blocksImported: 0,
      actionLinksCleared: 0,
      capacityImported: false,
    };
    for (const b of graph.blocks) {
      if (has(b.id)) continue;
      g.blocks.push(b);
      report.blocksImported++;
    }
    // Only seed capacity if the user has never set one.
    if (window.localStorage.getItem(LS_KEY) === null) {
      g.capacity = graph.capacity;
      report.capacityImported = true;
    }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makePlanningRepo(): PlanningRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}

export { EMPTY as EMPTY_PLANNING_GRAPH };
