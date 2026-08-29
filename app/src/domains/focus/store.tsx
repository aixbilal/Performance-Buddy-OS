import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FocusSession, FocusTransition } from "./types";
import { deriveFocusCompletionEffects, transitionFocusSession } from "./engine";
import { useKnowledge } from "../knowledge/store";

const IDLE_SESSION: FocusSession = {
  id: "focus-1",
  title: "Focus Session",
  linkedActionId: null,
  linkedTopicId: "topic-binary-trees", // demo default link — a real UI would let the user pick
  status: "idle",
  targetMinutes: 20,
  elapsedSeconds: 0,
  startedAt: null,
  notes: "",
};

type FocusContextValue = {
  session: FocusSession;
  error: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: (recallScore?: { score: number; maxScore: number }) => void;
  setNotes: (notes: string) => void;
};

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FocusSession>(IDLE_SESSION);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addEvidence } = useKnowledge();

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
    const result = transitionFocusSession(session, transition, new Date().toISOString());
    setSession(result.session);
    setError(result.error);
  };

  const start = () => applyTransition("start");
  const pause = () => applyTransition("pause");
  const resume = () => applyTransition("resume");

  const finish = (recallScore?: { score: number; maxScore: number }) => {
    const effects = deriveFocusCompletionEffects(session.elapsedSeconds, recallScore);
    applyTransition("finish");

    // Feeds Knowledge evidence ONLY if a real recall score was given — same
    // honest boundary as Language sessions. Focus never writes evidence itself.
    if (effects.masteryEvidence && session.linkedTopicId) {
      addEvidence(session.linkedTopicId, {
        type: "recall",
        title: `${session.title} — recall check`,
        score: effects.masteryEvidence.score,
        maxScore: effects.masteryEvidence.maxScore,
        date: new Date().toISOString().slice(0, 10),
      });
    }
  };

  const setNotes = (notes: string) => setSession((prev) => ({ ...prev, notes }));

  const value = useMemo(
    () => ({ session, error, start, pause, resume, finish, setNotes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, error]
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used within FocusProvider");
  return ctx;
}
