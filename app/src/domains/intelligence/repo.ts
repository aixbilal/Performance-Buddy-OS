/**
 * Durable persistence for the AI decision loop.
 *
 *   store.tsx  ->  AIRepo  ->  { ai_* Tauri commands -> Rust -> SQLite }
 *                         \->  { localStorage JSON }  (browser dev only)
 *
 * Decision events are append-only. Recommendations are upserted (status is the
 * current state). Provider config never carries a secret.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AIProviderConfig } from "../ai/types";
import type { DecisionEvent, DomainPermissions, Recommendation } from "./types";

export type AIGraph = {
  config: AIProviderConfig | null;
  permissions: DomainPermissions;
  recommendations: Recommendation[];
  decisionEvents: DecisionEvent[];
};

const EMPTY: AIGraph = {
  config: null,
  permissions: {},
  recommendations: [],
  decisionEvents: [],
};

export interface AIRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<AIGraph>;
  credentialsPresent(): Promise<boolean>;
  setConfig(config: AIProviderConfig): Promise<void>;
  setPermission(domain: string, level: string): Promise<void>;
  upsertRecommendation(rec: Recommendation): Promise<void>;
  appendDecisionEvent(ev: DecisionEvent): Promise<void>;
}

// --- helpers -------------------------------------------------------------

type WireRec = Omit<Recommendation, "evidence" | "proposedParams" | "currentParams" | "validation" | "appliedResult"> & {
  evidence: string;
  proposedParams: string;
  currentParams: string;
  validation: string | null;
  appliedResult: string | null;
};

function toWire(r: Recommendation): WireRec {
  return {
    ...r,
    evidence: JSON.stringify(r.evidence ?? []),
    proposedParams: JSON.stringify(r.proposedParams ?? {}),
    currentParams: JSON.stringify(r.currentParams ?? {}),
    validation: r.validation ? JSON.stringify(r.validation) : null,
    appliedResult: r.appliedResult ? JSON.stringify(r.appliedResult) : null,
  };
}
function fromWire(w: WireRec): Recommendation {
  const j = <T,>(s: string | null, fb: T): T => {
    if (!s) return fb;
    try {
      return JSON.parse(s) as T;
    } catch {
      return fb;
    }
  };
  return {
    ...w,
    evidence: j<string[]>(w.evidence, []),
    proposedParams: j<Record<string, unknown>>(w.proposedParams, {}),
    currentParams: j<Record<string, unknown>>(w.currentParams, {}),
    validation: w.validation ? j(w.validation, null) : null,
    appliedResult: w.appliedResult ? j(w.appliedResult, null) : null,
  } as Recommendation;
}

// --- Tauri / SQLite ---------------------------------------------------------

class SqliteRepo implements AIRepo {
  readonly kind = "sqlite" as const;
  async load(): Promise<AIGraph> {
    const g = await invoke<{
      config: AIProviderConfig | null;
      permissions: { domain: string; level: string }[];
      recommendations: WireRec[];
      decisionEvents: { id: string; recommendationId: string; event: string; detail: string; createdAt: string }[];
    }>("ai_load");
    const permissions: DomainPermissions = {};
    for (const p of g.permissions) permissions[p.domain] = p.level as DomainPermissions[string];
    return {
      config: g.config,
      permissions,
      recommendations: (g.recommendations ?? []).map(fromWire),
      decisionEvents: (g.decisionEvents ?? []).map((e) => ({
        id: e.id,
        recommendationId: e.recommendationId,
        event: e.event as DecisionEvent["event"],
        detail: (() => {
          try {
            return JSON.parse(e.detail) as Record<string, unknown>;
          } catch {
            return {};
          }
        })(),
        createdAt: e.createdAt,
      })),
    };
  }
  async credentialsPresent() {
    try {
      const s = await invoke<{ credentialsPresent: boolean }>("ai_status");
      return !!s.credentialsPresent;
    } catch {
      return false;
    }
  }
  async setConfig(config: AIProviderConfig) {
    const now = new Date().toISOString();
    await invoke("ai_config_set", { config: { ...config, createdAt: now, updatedAt: now } });
  }
  async setPermission(domain: string, level: string) {
    await invoke("ai_permission_set", {
      permission: { domain, level, updatedAt: new Date().toISOString() },
    });
  }
  async upsertRecommendation(rec: Recommendation) {
    await invoke("ai_recommendation_upsert", { recommendation: toWire(rec) });
  }
  async appendDecisionEvent(ev: DecisionEvent) {
    await invoke("ai_decision_event_append", {
      event: { ...ev, detail: JSON.stringify(ev.detail ?? {}) },
    });
  }
}

// --- localStorage (browser dev fallback) --------------------------------

const K_GRAPH = "pbos:ai-loop-v1";

export class LocalRepo implements AIRepo {
  readonly kind = "localStorage" as const;
  private read(): AIGraph {
    try {
      const raw = window.localStorage.getItem(K_GRAPH);
      if (!raw) return { ...EMPTY };
      const g = JSON.parse(raw) as AIGraph;
      return {
        config: g.config ?? null,
        permissions: g.permissions ?? {},
        recommendations: g.recommendations ?? [],
        decisionEvents: g.decisionEvents ?? [],
      };
    } catch {
      return { ...EMPTY };
    }
  }
  private write(g: AIGraph) {
    window.localStorage.setItem(K_GRAPH, JSON.stringify(g));
  }
  async load() {
    return this.read();
  }
  async credentialsPresent() {
    return false; // browser dev has no env-var credential boundary
  }
  async setConfig(config: AIProviderConfig) {
    const g = this.read();
    g.config = config;
    this.write(g);
  }
  async setPermission(domain: string, level: string) {
    const g = this.read();
    g.permissions = { ...g.permissions, [domain]: level as DomainPermissions[string] };
    this.write(g);
  }
  async upsertRecommendation(rec: Recommendation) {
    const g = this.read();
    const i = g.recommendations.findIndex((r) => r.id === rec.id);
    if (i >= 0) g.recommendations[i] = { ...rec, createdAt: g.recommendations[i].createdAt };
    else g.recommendations = [rec, ...g.recommendations];
    this.write(g);
  }
  async appendDecisionEvent(ev: DecisionEvent) {
    const g = this.read();
    if (!g.recommendations.some((r) => r.id === ev.recommendationId)) {
      throw new Error(`no recommendation "${ev.recommendationId}" for this event`);
    }
    g.decisionEvents = [...g.decisionEvents, ev];
    this.write(g);
  }
}

export function makeAIRepo(): AIRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
