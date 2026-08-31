/**
 * AI Coach store — the deterministic orchestrator of the decision loop.
 *
 *   permitted context → provider.complete() → parse/allowlist proposals →
 *   durable Recommendation (status "proposed") → user decide → deterministic
 *   validate → allowlisted canonical Apply → append-only decision events.
 *
 * The provider never touches a store. Every canonical mutation goes through an
 * Apply adapter that validates first. Decisions + recommendations are durable.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { deriveAIAvailability } from "../resilience/engine";
import type { AIAvailability } from "../resilience/types";
import { buildContextManifest, describeContextManifest } from "../ai/context";
import { makeAIProvider, type AIProvider } from "../ai/index";
import type { AIFailureClass, AIMessage, AIProviderConfig } from "../ai/types";
import { DEFAULT_AI_CONFIG } from "../ai/types";
import { usePerformance } from "../performance/store";
import { usePlanning } from "../planning/store";
import { useKnowledge } from "../knowledge/store";
import { useRoutine } from "../routine/store";
import { useAnalytics } from "../analytics/store";
import { computeCombinedImpact, parseProposals } from "./engine";
import { getAdapter, type ApplyContext } from "./applyAdapters";
import { makeAIRepo, type AIRepo } from "./repo";
import {
  DEFAULT_PERMISSIONS,
  type DecisionEvent,
  type DomainPermissions,
  type PermissionLevel,
  type Recommendation,
  type RecommendationSource,
} from "./types";

const nowIso = () => new Date().toISOString();
const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

export type GenerateResult = {
  ok: boolean;
  created: Recommendation[];
  rejected: { title: string; reason: string }[];
  failure?: AIFailureClass;
  message: string;
};

export type ApplyResult = {
  ok: boolean;
  status: Recommendation["status"];
  message: string;
  triggersReplan: boolean;
};

type AICoachContextValue = {
  loaded: boolean;
  backend: "sqlite" | "localStorage";
  config: AIProviderConfig;
  credentialsPresent: boolean;
  aiAvailability: AIAvailability;
  providerFailure: AIFailureClass | null;

  permissions: DomainPermissions;
  setPermission: (domain: string, level: PermissionLevel) => void;
  setConfig: (patch: Partial<AIProviderConfig>) => void;
  setEnabled: (v: boolean) => void;

  recommendations: Recommendation[];
  visibleRecommendations: Recommendation[];
  decisionHistory: Recommendation[];
  decisionEvents: DecisionEvent[];
  eventsFor: (recId: string) => DecisionEvent[];
  filteredOutCount: number;
  combinedImpact: ReturnType<typeof computeCombinedImpact>;

  /** Deterministic bullet facts per domain (feeds context + previews). */
  domainFacts: Record<string, string[]>;
  contextPreview: (domains: string[]) => { included: string[]; excluded: string[] };
  /** Live store bundle the shared RecommendationCard uses for previews/validation. */
  applyCtx: ApplyContext;

  generate: (
    source: RecommendationSource,
    domains: string[],
    userMessages?: AIMessage[],
  ) => Promise<GenerateResult>;
  decide: (
    id: string,
    decision: "accepted" | "modified" | "rejected",
    modifiedParams?: Record<string, unknown>,
  ) => Promise<void>;
  apply: (id: string) => Promise<ApplyResult>;

  // legacy alias kept for Today
  userEnabled: boolean;
  setUserEnabled: (v: boolean) => void;
};

const AICoachContext = createContext<AICoachContextValue | null>(null);
const CURRENT_WEEKLY_LOAD_MINUTES = 1260;
const WEEKLY_CAPACITY_MINUTES = 1260;

export function AICoachProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<AIRepo>(makeAIRepo());
  const perf = usePerformance();
  const planning = usePlanning();
  const knowledge = useKnowledge();
  const routine = useRoutine();
  const analytics = useAnalytics();

  const [loaded, setLoaded] = useState(false);
  const [config, setConfigState] = useState<AIProviderConfig>(DEFAULT_AI_CONFIG);
  const [credentialsPresent, setCredentialsPresent] = useState(false);
  const [permissions, setPermissions] = useState<DomainPermissions>(DEFAULT_PERMISSIONS);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [decisionEvents, setDecisionEvents] = useState<DecisionEvent[]>([]);
  const [providerFailure, setProviderFailure] = useState<AIFailureClass | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const [g, creds] = await Promise.all([repo.load(), repo.credentialsPresent()]);
        if (cancelled) return;
        setCredentialsPresent(creds);
        if (g.config) setConfigState(g.config);
        if (Object.keys(g.permissions).length > 0) {
          setPermissions({ ...DEFAULT_PERMISSIONS, ...g.permissions });
        }
        setRecommendations(g.recommendations);
        setDecisionEvents(g.decisionEvents);
      } catch {
        /* honest empty — deterministic core still works */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const provider: AIProvider = useMemo(
    () => makeAIProvider(config, credentialsPresent),
    [config, credentialsPresent],
  );

  const providerConfigured =
    config.providerId === "fake" ? true : credentialsPresent && !!config.baseUrl;
  const aiAvailability: AIAvailability = deriveAIAvailability({
    userEnabled: config.enabled,
    providerConfigured,
    lastRequestFailed: providerFailure !== null,
  });

  // --- deterministic domain facts (no raw JSON, no marks, no note bodies) ---
  const domainFacts = useMemo<Record<string, string[]>>(() => {
    const facts: Record<string, string[]> = {};
    // Knowledge — review-due + no-evidence concepts
    const kFacts: string[] = [];
    for (const t of knowledge.topics) {
      const due = t.nextReviewDate && new Date(t.nextReviewDate) <= new Date();
      if (due) kFacts.push(`${t.title} is review-due`);
      else if (!t.hasEvidence) kFacts.push(`${t.title} has no evidence yet`);
    }
    if (kFacts.length) facts.Knowledge = kFacts.slice(0, 6);
    // Planning — capacity headroom
    const scheduled = planning.blocks.reduce((s, b) => s + (b.endMinute - b.startMinute), 0);
    facts.Planning = [
      `weekly scheduled ${Math.round(scheduled / 60)}h of ${Math.round(
        planning.capacity.weeklyCapacityMinutes / 60,
      )}h capacity`,
    ];
    // Academics — from analytics snapshot (deterministic, already computed)
    const acad = analytics.domainSnapshots.find((s) => s.domain === "Academics");
    if (acad) facts.Academics = [acad.headline];
    // Routines — low consistency
    const rFacts: string[] = [];
    for (const r of routine.routines) {
      const c = routine.getConsistency(r.id);
      if (c.percent !== null && c.percent < 60) {
        rFacts.push(`${r.title} consistency has been low (${c.percent}%)`);
      }
    }
    if (rFacts.length) facts.Routines = rFacts.slice(0, 4);
    // Today — a synthesis line so a general coach chat has something
    facts.Today = [
      `${knowledge.getReviewQueue().length} Knowledge concepts due for review`,
    ];
    return facts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledge.topics, planning.blocks, planning.capacity, routine.routines, analytics.domainSnapshots]);

  const applyCtx: ApplyContext = useMemo(
    () => ({
      performance: { systems: perf.systems, createAction: perf.createAction },
      planning: {
        blocks: planning.blocks,
        capacity: planning.capacity,
        checkFit: planning.checkFit,
        createBlock: planning.createBlock,
      },
      knowledge: {
        topics: knowledge.topics.map((t) => ({
          id: t.id,
          title: t.title,
          nextReviewDate: t.nextReviewDate,
          lastStudied: t.lastStudied,
        })),
        updateReviewState: knowledge.updateReviewState,
      },
      routine: { routines: routine.routines, updateRoutine: routine.updateRoutine },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perf.systems, planning.blocks, planning.capacity, knowledge.topics, routine.routines],
  );

  // --- persistence helpers ------------------------------------------------
  async function persistRec(rec: Recommendation) {
    setRecommendations((prev) => {
      const i = prev.findIndex((r) => r.id === rec.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = rec;
        return next;
      }
      return [rec, ...prev];
    });
    try {
      await repoRef.current.upsertRecommendation(rec);
    } catch {
      /* keep optimistic state; surfaced via SaveIndicator elsewhere if wired */
    }
  }
  async function appendEvent(recId: string, event: DecisionEvent["event"], detail: Record<string, unknown>) {
    const ev: DecisionEvent = {
      id: rid("evt"),
      recommendationId: recId,
      event,
      detail,
      createdAt: nowIso(),
    };
    setDecisionEvents((prev) => [...prev, ev]);
    try {
      await repoRef.current.appendDecisionEvent(ev);
    } catch {
      /* ignore */
    }
  }

  // --- config / permissions --------------------------------------------
  const setPermission = (domain: string, level: PermissionLevel) => {
    setPermissions((prev) => ({ ...prev, [domain]: level }));
    void repoRef.current.setPermission(domain, level);
  };
  const setConfig = (patch: Partial<AIProviderConfig>) => {
    const next = { ...config, ...patch };
    setConfigState(next);
    void repoRef.current.setConfig(next);
  };
  const setEnabled = (v: boolean) => setConfig({ enabled: v });

  // --- context preview -----------------------------------------------
  const contextPreview = (domains: string[]) =>
    describeContextManifest(buildContextManifest(domains, permissions, domainFacts));

  // --- generate -----------------------------------------------------
  const generate = async (
    source: RecommendationSource,
    domains: string[],
    userMessages: AIMessage[] = [],
  ): Promise<GenerateResult> => {
    const manifest = buildContextManifest(domains, permissions, domainFacts);
    const wantRecommendations = userMessages.length === 0 || source !== "workspace";
    const res = await provider.complete({
      task: `${source}-recommendations`,
      messages:
        userMessages.length > 0
          ? userMessages
          : [{ role: "user", content: `Suggest changes based on this ${source}.` }],
      context: manifest,
      wantRecommendations: true,
    });
    if (!res.ok) {
      setProviderFailure(res.failure);
      return { ok: false, created: [], rejected: [], failure: res.failure, message: res.message };
    }
    setProviderFailure(null);
    void wantRecommendations;

    const parsed = parseProposals(res.proposals, permissions);
    const created: Recommendation[] = [];
    for (const p of parsed.valid) {
      const adapter = getAdapter(p.kind);
      const rec: Recommendation = {
        id: rid("rec"),
        kind: p.kind as Recommendation["kind"],
        domain: p.domain,
        title: p.title,
        rationale: p.rationale,
        evidence: p.evidence,
        confidence: p.confidence,
        source,
        generatedFrom:
          source === "workspace"
            ? "AI Coach Workspace"
            : `${source === "weekly-review" ? "Weekly" : source === "monthly-review" ? "Monthly" : "Analytics"} · ${nowIso().slice(0, 10)}`,
        proposedParams: p.proposedParams,
        currentParams: adapter ? adapter.describeCurrent(p.proposedParams, applyCtx) : {},
        status: "proposed",
        validation: null,
        appliedResult: null,
        createdAt: nowIso(),
        decidedAt: null,
        appliedAt: null,
      };
      created.push(rec);
      await persistRec(rec);
      await appendEvent(rec.id, "proposed", { text: res.text.slice(0, 200) });
    }
    return {
      ok: true,
      created,
      rejected: parsed.rejected.map((r) => ({ title: r.proposal.title || r.proposal.kind, reason: r.reason })),
      message: res.text,
    };
  };

  // --- decide -----------------------------------------------------
  const decide = async (
    id: string,
    decision: "accepted" | "modified" | "rejected",
    modifiedParams?: Record<string, unknown>,
  ) => {
    const rec = recommendations.find((r) => r.id === id);
    if (!rec) return;
    const next: Recommendation = {
      ...rec,
      status: decision,
      proposedParams:
        decision === "modified" && modifiedParams ? { ...rec.proposedParams, ...modifiedParams } : rec.proposedParams,
      decidedAt: nowIso(),
    };
    await persistRec(next);
    await appendEvent(id, decision, decision === "modified" ? { modifiedParams: modifiedParams ?? {} } : {});
  };

  // --- apply (deterministic validation, then ONE canonical mutation) ----
  const apply = async (id: string): Promise<ApplyResult> => {
    const rec = recommendations.find((r) => r.id === id);
    if (!rec) return { ok: false, status: "apply-failed", message: "Recommendation not found.", triggersReplan: false };
    if (rec.status !== "accepted" && rec.status !== "modified") {
      return {
        ok: false,
        status: rec.status,
        message: "Only an accepted or modified recommendation can be applied.",
        triggersReplan: false,
      };
    }
    const adapter = getAdapter(rec.kind);
    if (!adapter) {
      const failedRec: Recommendation = {
        ...rec,
        status: "apply-failed",
        validation: { ok: false, reasonCodes: ["UNKNOWN_KIND"], message: `No Apply adapter for "${rec.kind}".` },
      };
      await persistRec(failedRec);
      await appendEvent(id, "apply-failed", { reasonCodes: ["UNKNOWN_KIND"] });
      return { ok: false, status: "apply-failed", message: failedRec.validation!.message, triggersReplan: false };
    }

    const validation = adapter.validate(rec.proposedParams, applyCtx);
    if (!validation.ok) {
      const failedRec: Recommendation = { ...rec, status: "apply-failed", validation };
      await persistRec(failedRec);
      await appendEvent(id, "apply-failed", { reasonCodes: validation.reasonCodes });
      return { ok: false, status: "apply-failed", message: validation.message, triggersReplan: false };
    }

    const outcome = await adapter.apply(rec.proposedParams, applyCtx);
    if (!outcome.ok) {
      const failedRec: Recommendation = {
        ...rec,
        status: "apply-failed",
        validation: { ok: false, reasonCodes: ["APPLY_ERROR"], message: outcome.message },
      };
      await persistRec(failedRec);
      await appendEvent(id, "apply-failed", { reasonCodes: ["APPLY_ERROR"], message: outcome.message });
      return { ok: false, status: "apply-failed", message: outcome.message, triggersReplan: false };
    }

    const appliedRec: Recommendation = {
      ...rec,
      status: "applied",
      validation,
      appliedResult: outcome.result,
      appliedAt: nowIso(),
    };
    await persistRec(appliedRec);
    await appendEvent(id, "applied", { result: outcome.result });
    return { ok: true, status: "applied", message: outcome.message, triggersReplan: adapter.triggersReplan };
  };

  // --- projections ------------------------------------------------
  const permittedRecs = useMemo(
    () =>
      recommendations.filter(
        (r) => (permissions[r.domain] ?? "no-access") === "read-recommend" || r.status !== "proposed",
      ),
    [recommendations, permissions],
  );
  const visibleRecommendations = permittedRecs.filter((r) => r.status === "proposed");
  const decisionHistory = permittedRecs.filter((r) => r.status !== "proposed");
  const filteredOutCount = recommendations.filter(
    (r) => r.status === "proposed" && (permissions[r.domain] ?? "no-access") !== "read-recommend",
  ).length;
  const combinedImpact = computeCombinedImpact(
    CURRENT_WEEKLY_LOAD_MINUTES,
    permittedRecs,
    WEEKLY_CAPACITY_MINUTES,
  );
  const eventsFor = (recId: string) =>
    decisionEvents.filter((e) => e.recommendationId === recId);

  const value = useMemo<AICoachContextValue>(
    () => ({
      loaded,
      backend: repoRef.current.kind,
      config,
      credentialsPresent,
      aiAvailability,
      providerFailure,
      permissions,
      setPermission,
      setConfig,
      setEnabled,
      recommendations: permittedRecs,
      visibleRecommendations,
      decisionHistory,
      decisionEvents,
      eventsFor,
      filteredOutCount,
      combinedImpact,
      domainFacts,
      contextPreview,
      applyCtx,
      generate,
      decide,
      apply,
      userEnabled: config.enabled,
      setUserEnabled: setEnabled,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      loaded,
      config,
      credentialsPresent,
      aiAvailability,
      providerFailure,
      permissions,
      recommendations,
      decisionEvents,
      domainFacts,
    ],
  );

  return <AICoachContext.Provider value={value}>{children}</AICoachContext.Provider>;
}

export function useAICoach() {
  const ctx = useContext(AICoachContext);
  if (!ctx) throw new Error("useAICoach must be used within AICoachProvider");
  return ctx;
}
