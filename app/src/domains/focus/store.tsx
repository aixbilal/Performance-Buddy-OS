import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FocusContext, FocusSession, FocusSessionRecord, FocusTransition } from "./types";
import { deriveFocusCompletionEffects, transitionFocusSession } from "./engine";
import { useKnowledge } from "../knowledge/store";
import { makeFocusRepo, type FocusRepo } from "./repo";
import type { SaveState } from "../resilience/types";

const nowIso = () => new Date().toISOString();

function idleSession(): FocusSession {
  return {
    id: `focus_${Math.random().toString(36).slice(2)}`,
    title: "Focus Session",
    method: "",
    linkedActionId: null,
    linkedTopicId: null,
    linkedCourseId: null,
    linkedAcademicTopicId: null,
    linkedBlockId: null,
    returnTo: null,
    status: "idle",
    targetMinutes: 25,
    elapsedSeconds: 0,
    startedAt: null,
    notes: "",
  };
}

export type FocusFinishResult = { durationMinutes: number; recorded: FocusSessionRecord; evidenceAdded: boolean };

type FocusContextValue = {
  session: FocusSession;
  error: string | null;
  history: FocusSessionRecord[];
  historyLoaded: boolean;
  saveState: SaveState;
  backend: "sqlite" | "localStorage";

  start: () => void;
  /** Configure the session with study context, then start it. */
  startWith: (ctx: FocusContext) => void;
  pause: () => void;
  resume: () => void;
  finish: (recallScore?: { score: number; maxScore: number }) => Promise<FocusFinishResult | null>;
  /** Return to a fresh idle session (keeps history). */
  reset: () => void;
  setNotes: (notes: string) => void;

  // reads
  getSessionsForKnowledgeTopic: (topicId: string) => FocusSessionRecord[];
  getSessionsForAcademicTopic: (academicTopicId: string) => FocusSessionRecord[];
};

const FocusCtx = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<FocusRepo>(makeFocusRepo());
  const [session, setSession] = useState<FocusSession>(idleSession);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<FocusSessionRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addEvidence } = useKnowledge();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await repoRef.current.load();
        if (!cancelled) {
          setHistory(rows);
          setHistoryLoaded(true);
        }
      } catch {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session.status === "active") {
      intervalRef.current = setInterval(() => {
        setSession((prev) => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session.status]);

  const applyTransition = (transition: FocusTransition) => {
    const result = transitionFocusSession(session, transition, nowIso());
    setSession(result.session);
    setError(result.error);
    return result;
  };

  const start = () => applyTransition("start");

  const startWith = (ctx: FocusContext) => {
    setSession({
      ...idleSession(),
      title: ctx.title?.trim() || "Focus Session",
      method: ctx.method ?? "",
      targetMinutes: ctx.targetMinutes && ctx.targetMinutes > 0 ? ctx.targetMinutes : 25,
      linkedActionId: ctx.linkedActionId ?? null,
      linkedTopicId: ctx.linkedTopicId ?? null,
      linkedCourseId: ctx.linkedCourseId ?? null,
      linkedAcademicTopicId: ctx.linkedAcademicTopicId ?? null,
      linkedBlockId: ctx.linkedBlockId ?? null,
      returnTo: ctx.returnTo ?? null,
      status: "active",
      startedAt: nowIso(),
    });
    setError(null);
  };

  const pause = () => applyTransition("pause");
  const resume = () => applyTransition("resume");

  const finish = async (
    recallScore?: { score: number; maxScore: number },
  ): Promise<FocusFinishResult | null> => {
    if (session.status !== "active" && session.status !== "paused") {
      setError(`Cannot finish a session that is ${session.status}.`);
      return null;
    }
    const effects = deriveFocusCompletionEffects(session.elapsedSeconds, recallScore);
    applyTransition("finish");

    const record: FocusSessionRecord = {
      id: session.id,
      title: session.title,
      status: "completed",
      method: session.method,
      courseId: session.linkedCourseId,
      academicTopicId: session.linkedAcademicTopicId,
      knowledgeTopicId: session.linkedTopicId,
      actionId: session.linkedActionId,
      planningBlockId: session.linkedBlockId,
      targetMinutes: session.targetMinutes,
      durationMinutes: effects.durationMinutes,
      recallScore: effects.masteryEvidence?.score ?? null,
      recallMax: effects.masteryEvidence?.maxScore ?? 10,
      notes: session.notes,
      startedAt: session.startedAt,
      completedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setHistory((h) => [record, ...h.filter((r) => r.id !== record.id)]);
    setSaveState("saving");
    try {
      await repoRef.current.upsert(record);
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }

    // Knowledge evidence ONLY when a real recall score was given — Focus never
    // writes evidence from time alone.
    let evidenceAdded = false;
    if (effects.masteryEvidence && session.linkedTopicId) {
      const res = await addEvidence(session.linkedTopicId, {
        type: "recall",
        title: `${session.title} — recall check`,
        score: effects.masteryEvidence.score,
        maxScore: effects.masteryEvidence.maxScore,
        date: new Date().toISOString().slice(0, 10),
      });
      evidenceAdded = res.ok;
    }
    return { durationMinutes: effects.durationMinutes, recorded: record, evidenceAdded };
  };

  const reset = () => {
    setSession(idleSession());
    setError(null);
  };
  const setNotes = (notes: string) => setSession((prev) => ({ ...prev, notes }));

  const getSessionsForKnowledgeTopic = (topicId: string) =>
    history.filter((r) => r.knowledgeTopicId === topicId);
  const getSessionsForAcademicTopic = (academicTopicId: string) =>
    history.filter((r) => r.academicTopicId === academicTopicId);

  const value = useMemo<FocusContextValue>(
    () => ({
      session,
      error,
      history,
      historyLoaded,
      saveState,
      backend: repoRef.current.kind,
      start,
      startWith,
      pause,
      resume,
      finish,
      reset,
      setNotes,
      getSessionsForKnowledgeTopic,
      getSessionsForAcademicTopic,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, error, history, historyLoaded, saveState],
  );

  return <FocusCtx.Provider value={value}>{children}</FocusCtx.Provider>;
}

export function useFocus() {
  const ctx = useContext(FocusCtx);
  if (!ctx) throw new Error("useFocus must be used within FocusProvider");
  return ctx;
}
