/**
 * Canonical relational persistence for the Knowledge domain.
 *
 *   store.tsx  ->  KnowledgeRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                                \->  { localStorage JSON }  (browser dev only)
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Evidence, KnowledgeGraph, Source, KnowledgeTopic } from "./types";

export type KnowledgeImportReport = {
  ran: boolean;
  topicsImported: number;
  sourcesImported: number;
  evidenceImported: number;
};

export interface KnowledgeRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<KnowledgeGraph>;
  topicUpsert(topic: KnowledgeTopic): Promise<void>;
  topicDelete(id: string): Promise<void>;
  sourceUpsert(source: Source): Promise<void>;
  sourceDelete(id: string): Promise<void>;
  evidenceUpsert(evidence: Evidence): Promise<void>;
  evidenceDelete(id: string): Promise<void>;
  importGraph(graph: KnowledgeGraph): Promise<KnowledgeImportReport>;
}

const EMPTY: KnowledgeGraph = { topics: [], sources: [], evidence: [] };

function normReport(r: Record<string, unknown>): KnowledgeImportReport {
  const num = (a: unknown, b: unknown) => Number(a ?? b ?? 0);
  return {
    ran: !!r.ran,
    topicsImported: num(r.topicsImported, r.topics_imported),
    sourcesImported: num(r.sourcesImported, r.sources_imported),
    evidenceImported: num(r.evidenceImported, r.evidence_imported),
  };
}

// --- Tauri / SQLite --------------------------------------------------------

class SqliteRepo implements KnowledgeRepo {
  readonly kind = "sqlite" as const;
  async load() {
    return await invoke<KnowledgeGraph>("know_load");
  }
  async topicUpsert(topic: KnowledgeTopic) {
    await invoke("know_topic_upsert", { topic });
  }
  async topicDelete(id: string) {
    await invoke("know_topic_delete", { id });
  }
  async sourceUpsert(source: Source) {
    await invoke("know_source_upsert", { source });
  }
  async sourceDelete(id: string) {
    await invoke("know_source_delete", { id });
  }
  async evidenceUpsert(evidence: Evidence) {
    await invoke("know_evidence_upsert", { evidence });
  }
  async evidenceDelete(id: string) {
    await invoke("know_evidence_delete", { id });
  }
  async importGraph(graph: KnowledgeGraph) {
    return normReport(await invoke("know_import_graph", { import: graph }));
  }
}

// --- localStorage (browser dev fallback) ---------------------------------

const LS_KEY = "pbos:knowledge-v2";
const LS_IMPORT_MARK = "pbos:knowledge-v2-imported";

export class LocalRepo implements KnowledgeRepo {
  readonly kind = "localStorage" as const;

  private read(): KnowledgeGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { ...EMPTY };
      const g = JSON.parse(raw) as KnowledgeGraph;
      return {
        topics: g.topics ?? [],
        sources: g.sources ?? [],
        evidence: g.evidence ?? [],
      };
    } catch {
      return { ...EMPTY };
    }
  }
  private write(g: KnowledgeGraph) {
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
  async topicUpsert(topic: KnowledgeTopic) {
    const g = this.read();
    g.topics = this.upsert(g.topics, topic);
    this.write(g);
  }
  async topicDelete(id: string) {
    const g = this.read();
    g.topics = g.topics.filter((t) => t.id !== id);
    g.sources = g.sources.filter((s) => s.topicId !== id); // CASCADE
    g.evidence = g.evidence.filter((e) => e.topicId !== id); // CASCADE
    this.write(g);
  }
  async sourceUpsert(source: Source) {
    const g = this.read();
    if (!g.topics.some((t) => t.id === source.topicId)) return; // FK
    g.sources = this.upsert(g.sources, source);
    this.write(g);
  }
  async sourceDelete(id: string) {
    const g = this.read();
    g.sources = g.sources.filter((s) => s.id !== id);
    this.write(g);
  }
  async evidenceUpsert(evidence: Evidence) {
    const g = this.read();
    if (!g.topics.some((t) => t.id === evidence.topicId)) return; // FK
    g.evidence = this.upsert(g.evidence, evidence);
    this.write(g);
  }
  async evidenceDelete(id: string) {
    const g = this.read();
    g.evidence = g.evidence.filter((e) => e.id !== id);
    this.write(g);
  }
  async importGraph(graph: KnowledgeGraph): Promise<KnowledgeImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return { ran: false, topicsImported: 0, sourcesImported: 0, evidenceImported: 0 };
    }
    const g = this.read();
    const has = (arr: { id: string }[], id: string) => arr.some((x) => x.id === id);
    const report: KnowledgeImportReport = {
      ran: true,
      topicsImported: 0,
      sourcesImported: 0,
      evidenceImported: 0,
    };
    for (const t of graph.topics) {
      if (!has(g.topics, t.id)) {
        g.topics.push(t);
        report.topicsImported++;
      }
    }
    for (const s of graph.sources) {
      if (has(g.sources, s.id)) continue;
      if (!has(g.topics, s.topicId)) continue;
      report.sourcesImported++;
      g.sources.push(s);
    }
    for (const e of graph.evidence) {
      if (has(g.evidence, e.id)) continue;
      if (!has(g.topics, e.topicId)) continue;
      report.evidenceImported++;
      g.evidence.push(e);
    }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makeKnowledgeRepo(): KnowledgeRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
