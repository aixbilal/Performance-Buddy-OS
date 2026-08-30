/**
 * Knowledge OS store — the ONE place Topic/Source/Evidence state lives.
 *
 * - Canonical persistence is relational SQLite via `KnowledgeRepo` (Batch 2A).
 * - No seed data. A fresh profile is genuinely empty; a returning user's
 *   pre-2A KV blobs are imported once (idempotent, non-destructive).
 * - Mastery is EVIDENCE-DERIVED here (engine `deriveTopicView`), never stored.
 *   `addEvidence` for a topic that does not exist returns an honest
 *   `{ ok: false }` — it never silently invents a topic and never throws.
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
import { cacheAdapter } from "../persistence/cache";
import type { SaveState } from "../resilience/types";
import {
  deriveKnowledgeState,
  deriveTopicView,
  isReviewDue,
  validateEvidenceInput,
  validateReviewStateInput,
  validateSourceInput,
  validateTopicInput,
} from "./engine";
import { newId } from "./ids";
import { resolveLegacyKnowledge, type KnowledgeLegacyReport } from "./legacyImport";
import { makeKnowledgeRepo, type KnowledgeRepo } from "./repo";
import type {
  Evidence,
  EvidenceInput,
  KnowledgeGraph,
  KnowledgeState,
  KnowledgeTopic,
  ReviewStateInput,
  Source,
  SourceInput,
  Topic,
  TopicInput,
} from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };
type EvidenceResult = { ok: true; id: string } | { ok: false; reason: string };

type KnowledgeContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  /** Back-compat alias — pages/consumers pre-2A read `evidenceSaveState`. */
  evidenceSaveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: KnowledgeLegacyReport | null;

  topics: Topic[];
  sources: Source[];
  evidence: Evidence[];

  // reads
  getTopic: (id: string) => Topic | undefined;
  getSourcesForTopic: (topicId: string) => Source[];
  getEvidenceForTopic: (topicId: string) => Evidence[];
  getTopicState: (topic: { masteryPercent: number }) => KnowledgeState;
  getReviewQueue: () => Topic[];

  // topic CRUD
  createTopic: (input: TopicInput) => Promise<MutResult>;
  updateTopic: (id: string, input: TopicInput) => Promise<MutResult>;
  deleteTopic: (id: string) => Promise<void>;
  updateReviewState: (topicId: string, input: ReviewStateInput) => Promise<MutResult>;

  // source CRUD
  createSource: (topicId: string, input: SourceInput) => Promise<MutResult>;
  updateSource: (id: string, input: SourceInput) => Promise<MutResult>;
  deleteSource: (id: string) => Promise<void>;
  /** Move a source to a different topic (V1: a source always belongs to exactly one topic). */
  linkSourceToTopic: (sourceId: string, topicId: string) => Promise<MutResult>;

  // evidence
  addEvidence: (topicId: string, input: EvidenceInput) => Promise<EvidenceResult>;
  deleteEvidence: (id: string) => Promise<void>;
};

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY: KnowledgeGraph = { topics: [], sources: [], evidence: [] };

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<KnowledgeRepo>(makeKnowledgeRepo());
  const [graph, setGraph] = useState<KnowledgeGraph>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<KnowledgeLegacyReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const legacy = resolveLegacyKnowledge({
          topics: cacheAdapter.getItem("pbos:knowledge-topics"),
          sources: cacheAdapter.getItem("pbos:knowledge-sources"),
          evidence: cacheAdapter.getItem("pbos:knowledge-evidence"),
        });
        const report = await repo.importGraph(legacy.graph);
        if (report.ran) setLegacyImport(legacy.report);

        const g = await repo.load();
        if (!cancelled) {
          setGraph(g);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(fn: () => Promise<void>) {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      setSaveError(null);
    } catch (e) {
      setSaveState("failed");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  // --- projection ------------------------------------------------------
  const evidenceByTopic = useMemo(() => {
    const map: Record<string, Evidence[]> = {};
    for (const e of graph.evidence) (map[e.topicId] ??= []).push(e);
    return map;
  }, [graph.evidence]);

  const topics: Topic[] = useMemo(
    () =>
      graph.topics.map((t) => {
        const view = deriveTopicView(evidenceByTopic[t.id] ?? []);
        return { ...t, ...view };
      }),
    [graph.topics, evidenceByTopic],
  );

  // --- reads ---------------------------------------------------------
  const getTopic = (id: string) => topics.find((t) => t.id === id);
  const getSourcesForTopic = (topicId: string) =>
    graph.sources.filter((s) => s.topicId === topicId);
  const getEvidenceForTopic = (topicId: string) =>
    graph.evidence
      .filter((e) => e.topicId === topicId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const getTopicState = (topic: { masteryPercent: number }) =>
    deriveKnowledgeState(topic.masteryPercent);
  const getReviewQueue = () => topics.filter((t) => isReviewDue(t.nextReviewDate));

  // --- topic CRUD --------------------------------------------------
  const createTopic = async (input: TopicInput): Promise<MutResult> => {
    const v = validateTopicInput(input);
    if (!v.ok) return v;
    const topic: KnowledgeTopic = {
      id: newId("kt"),
      ...v.value,
      lastStudied: null,
      nextReviewDate: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, topics: [...g.topics, topic] }));
    await persist(() => repoRef.current.topicUpsert(topic));
    return { ok: true, id: topic.id };
  };

  const updateTopic = async (id: string, input: TopicInput): Promise<MutResult> => {
    const existing = graph.topics.find((t) => t.id === id);
    if (!existing) return { ok: false, errors: { _: "Topic not found." } };
    const v = validateTopicInput(input);
    if (!v.ok) return v;
    const topic: KnowledgeTopic = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, topics: g.topics.map((t) => (t.id === id ? topic : t)) }));
    await persist(() => repoRef.current.topicUpsert(topic));
    return { ok: true, id };
  };

  const deleteTopic = async (id: string) => {
    setGraph((g) => ({
      ...g,
      topics: g.topics.filter((t) => t.id !== id),
      sources: g.sources.filter((s) => s.topicId !== id),
      evidence: g.evidence.filter((e) => e.topicId !== id),
    }));
    await persist(() => repoRef.current.topicDelete(id));
  };

  const updateReviewState = async (
    topicId: string,
    input: ReviewStateInput,
  ): Promise<MutResult> => {
    const existing = graph.topics.find((t) => t.id === topicId);
    if (!existing) return { ok: false, errors: { _: "Topic not found." } };
    const v = validateReviewStateInput(input);
    if (!v.ok) return v;
    const topic: KnowledgeTopic = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, topics: g.topics.map((t) => (t.id === topicId ? topic : t)) }));
    await persist(() => repoRef.current.topicUpsert(topic));
    return { ok: true, id: topicId };
  };

  // --- source CRUD ----------------------------------------------
  const createSource = async (topicId: string, input: SourceInput): Promise<MutResult> => {
    if (!graph.topics.some((t) => t.id === topicId)) {
      return { ok: false, errors: { _: "Topic not found." } };
    }
    const v = validateSourceInput(input);
    if (!v.ok) return v;
    const source: Source = {
      id: newId("ks"),
      topicId,
      ...v.value,
      addedDate: todayIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, sources: [...g.sources, source] }));
    await persist(() => repoRef.current.sourceUpsert(source));
    return { ok: true, id: source.id };
  };

  const updateSource = async (id: string, input: SourceInput): Promise<MutResult> => {
    const existing = graph.sources.find((s) => s.id === id);
    if (!existing) return { ok: false, errors: { _: "Source not found." } };
    const v = validateSourceInput(input);
    if (!v.ok) return v;
    const source: Source = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, sources: g.sources.map((s) => (s.id === id ? source : s)) }));
    await persist(() => repoRef.current.sourceUpsert(source));
    return { ok: true, id };
  };

  const deleteSource = async (id: string) => {
    setGraph((g) => ({ ...g, sources: g.sources.filter((s) => s.id !== id) }));
    await persist(() => repoRef.current.sourceDelete(id));
  };

  const linkSourceToTopic = async (sourceId: string, topicId: string): Promise<MutResult> => {
    const existing = graph.sources.find((s) => s.id === sourceId);
    if (!existing) return { ok: false, errors: { _: "Source not found." } };
    if (!graph.topics.some((t) => t.id === topicId)) {
      return { ok: false, errors: { _: "Target topic not found." } };
    }
    const source: Source = { ...existing, topicId, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, sources: g.sources.map((s) => (s.id === sourceId ? source : s)) }));
    await persist(() => repoRef.current.sourceUpsert(source));
    return { ok: true, id: sourceId };
  };

  // --- evidence -----------------------------------------------
  const addEvidence = async (
    topicId: string,
    input: EvidenceInput,
  ): Promise<EvidenceResult> => {
    if (!graph.topics.some((t) => t.id === topicId)) {
      // Honest no-op: do NOT invent a topic, do NOT throw. A consumer (Focus,
      // Language) may reference a topic that a fresh profile has not created.
      return {
        ok: false,
        reason: `No Knowledge topic "${topicId}" exists — evidence was not recorded.`,
      };
    }
    const v = validateEvidenceInput(input);
    if (!v.ok) return { ok: false, reason: Object.values(v.errors)[0] ?? "Invalid evidence." };
    const evidence: Evidence = {
      id: newId("ke"),
      topicId,
      ...v.value,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, evidence: [...g.evidence, evidence] }));
    await persist(() => repoRef.current.evidenceUpsert(evidence));
    return { ok: true, id: evidence.id };
  };

  const deleteEvidence = async (id: string) => {
    setGraph((g) => ({ ...g, evidence: g.evidence.filter((e) => e.id !== id) }));
    await persist(() => repoRef.current.evidenceDelete(id));
  };

  const value = useMemo<KnowledgeContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      evidenceSaveState: saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      topics,
      sources: graph.sources,
      evidence: graph.evidence,
      getTopic,
      getSourcesForTopic,
      getEvidenceForTopic,
      getTopicState,
      getReviewQueue,
      createTopic,
      updateTopic,
      deleteTopic,
      updateReviewState,
      createSource,
      updateSource,
      deleteSource,
      linkSourceToTopic,
      addEvidence,
      deleteEvidence,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, topics, loaded, loadError, saveState, saveError, legacyImport],
  );

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error("useKnowledge must be used within KnowledgeProvider");
  return ctx;
}
