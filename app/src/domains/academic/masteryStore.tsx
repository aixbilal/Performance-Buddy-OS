/**
 * Mastery Check store (Batch 4) — the ONE place personal learning checks live.
 *
 * - Durable via `MasteryRepo` (SQLite / localStorage).
 * - A completed check produces exactly ONE Knowledge Evidence row, and only on
 *   an explicit `recordEvidence` call. `check.evidenceId` (set once, never
 *   overwritten — enforced in Rust and the LocalRepo) makes the handoff
 *   idempotent across refresh / double-click.
 * - No academic mastery is ever written. Knowledge OS owns mastery.
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
import type { SaveState } from "../resilience/types";
import { useKnowledge } from "../knowledge/store";
import { buildSelfCheckItems, isCheckComplete, scoreMasteryCheck } from "./masteryEngine";
import { makeMasteryRepo, type MasteryRepo } from "./masteryRepo";
import type { MasteryCheck, MasteryItem } from "./masteryTypes";

const nowIso = () => new Date().toISOString();
const newId = () =>
  `mc_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

export type StartCheckInput = {
  academicTopicId: string | null;
  knowledgeTopicId: string | null;
  courseId: string | null;
  topicTitle: string;
  /** Defaults to "self-check". "recall" is a governed Generate-Recall session. */
  kind?: "self-check" | "recall";
  /** Prompt strings for a "recall" check. Ignored for "self-check". */
  recallPrompts?: string[];
};

export type RecordEvidenceResult =
  | { ok: true; evidenceId: string; alreadyRecorded: boolean }
  | { ok: false; reason: "no-knowledge-link" | "not-completed" | "not-found" | "write-failed"; message: string };

type MasteryContextValue = {
  loaded: boolean;
  saveState: SaveState;
  backend: "sqlite" | "localStorage";
  checks: MasteryCheck[];

  getCheck: (id: string) => MasteryCheck | undefined;
  getChecksForAcademicTopic: (academicTopicId: string) => MasteryCheck[];

  startCheck: (input: StartCheckInput) => Promise<string>;
  submitCheck: (id: string, items: MasteryItem[]) => Promise<{ ok: boolean; error?: string }>;
  deleteCheck: (id: string) => Promise<void>;
  /** Explicit, idempotent handoff of a completed check to Knowledge OS. */
  recordEvidence: (id: string) => Promise<RecordEvidenceResult>;
};

const MasteryContext = createContext<MasteryContextValue | null>(null);

export function MasteryProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<MasteryRepo>(makeMasteryRepo());
  const [checks, setChecks] = useState<MasteryCheck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const { addEvidence, deleteEvidence } = useKnowledge();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await repoRef.current.load();
        if (!cancelled) {
          setChecks(rows);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
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
    } catch {
      setSaveState("failed");
    }
  }

  const upsertLocal = (c: MasteryCheck) =>
    setChecks((prev) => {
      const i = prev.findIndex((x) => x.id === c.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = c;
        return next;
      }
      return [c, ...prev];
    });

  const getCheck = (id: string) => checks.find((c) => c.id === id);
  const getChecksForAcademicTopic = (academicTopicId: string) =>
    checks.filter((c) => c.academicTopicId === academicTopicId);

  const startCheck = async (input: StartCheckInput): Promise<string> => {
    const kind = input.kind ?? "self-check";
    const items: MasteryItem[] =
      kind === "recall" && (input.recallPrompts?.length ?? 0) > 0
        ? input.recallPrompts!.map((prompt, i) => ({ id: `it_${i}`, prompt, rating: null }))
        : buildSelfCheckItems();
    const check: MasteryCheck = {
      id: newId(),
      academicTopicId: input.academicTopicId,
      knowledgeTopicId: input.knowledgeTopicId,
      courseId: input.courseId,
      topicTitle: input.topicTitle,
      kind,
      items,
      score: 0,
      maxScore: items.length,
      status: "in-progress",
      evidenceId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    };
    upsertLocal(check);
    await persist(() => repoRef.current.upsert(check));
    return check.id;
  };

  const submitCheck = async (
    id: string,
    items: MasteryItem[],
  ): Promise<{ ok: boolean; error?: string }> => {
    const existing = getCheck(id);
    if (!existing) return { ok: false, error: "Check not found." };
    if (!isCheckComplete(items)) return { ok: false, error: "Rate every prompt before submitting." };
    const s = scoreMasteryCheck(items);
    const updated: MasteryCheck = {
      ...existing,
      items,
      score: s.score,
      maxScore: s.maxScore,
      status: "completed",
      completedAt: nowIso(),
      updatedAt: nowIso(),
    };
    upsertLocal(updated);
    await persist(() => repoRef.current.upsert(updated));
    return { ok: true };
  };

  const deleteCheck = async (id: string) => {
    setChecks((prev) => prev.filter((c) => c.id !== id));
    await persist(() => repoRef.current.remove(id));
  };

  const recordEvidence = async (id: string): Promise<RecordEvidenceResult> => {
    const check = getCheck(id);
    if (!check) return { ok: false, reason: "not-found", message: "Check not found." };
    if (check.status !== "completed")
      return { ok: false, reason: "not-completed", message: "Complete the check first." };
    if (check.evidenceId) {
      return { ok: true, evidenceId: check.evidenceId, alreadyRecorded: true };
    }
    if (!check.knowledgeTopicId) {
      return {
        ok: false,
        reason: "no-knowledge-link",
        message: "This topic has no linked Knowledge concept — link one first.",
      };
    }
    const ev = await addEvidence(check.knowledgeTopicId, {
      type: "quiz",
      title: `Mastery Check — ${check.topicTitle}`,
      score: check.score,
      maxScore: check.maxScore,
      date: new Date().toISOString().slice(0, 10),
    });
    if (!ev.ok) {
      return { ok: false, reason: "write-failed", message: ev.reason };
    }
    // Idempotent link: the repo sets `evidenceId` only if it was null and
    // returns the EFFECTIVE id (the pre-existing one if a race already set it).
    // If that differs from ours, our fresh evidence row is a duplicate — delete
    // it so exactly one evidence record survives.
    const effective = await repoRef.current.linkEvidence(id, ev.id);
    const evidenceId = effective ?? ev.id;
    if (evidenceId !== ev.id) {
      await deleteEvidence(ev.id);
    }
    const linked: MasteryCheck = { ...check, evidenceId, updatedAt: nowIso() };
    upsertLocal(linked);
    await persist(() => repoRef.current.upsert(linked));
    return { ok: true, evidenceId, alreadyRecorded: false };
  };

  const value = useMemo<MasteryContextValue>(
    () => ({
      loaded,
      saveState,
      backend: repoRef.current.kind,
      checks,
      getCheck,
      getChecksForAcademicTopic,
      startCheck,
      submitCheck,
      deleteCheck,
      recordEvidence,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checks, loaded, saveState],
  );

  return <MasteryContext.Provider value={value}>{children}</MasteryContext.Provider>;
}

export function useMastery() {
  const ctx = useContext(MasteryContext);
  if (!ctx) throw new Error("useMastery must be used within MasteryProvider");
  return ctx;
}
