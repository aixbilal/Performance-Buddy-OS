/**
 * Deterministic Focus Session Engine. Pure state transitions — no AI, no
 * timer side effects here (the store owns the actual interval/clock).
 */

import type { FocusCompletionEffects, FocusSession, FocusTransition } from "./types";

export type TransitionResult = { session: FocusSession; error: string | null };

const VALID_TRANSITIONS: Record<FocusSession["status"], FocusTransition[]> = {
  idle: ["start"],
  active: ["pause", "finish"],
  paused: ["resume", "finish"],
  completed: [],
};

/**
 * Validates and applies a lifecycle transition. Invalid transitions (e.g.
 * "pause" on an idle session) are rejected with a real error, not silently
 * accepted — a resilience-adjacent guarantee that the session state can
 * never end up inconsistent.
 */
export function transitionFocusSession(session: FocusSession, transition: FocusTransition, nowIso: string): TransitionResult {
  const allowed = VALID_TRANSITIONS[session.status];
  if (!allowed.includes(transition)) {
    return { session, error: `Cannot ${transition} a session that is ${session.status}.` };
  }

  switch (transition) {
    case "start":
      return { session: { ...session, status: "active", startedAt: nowIso, elapsedSeconds: 0 }, error: null };
    case "pause":
      return { session: { ...session, status: "paused" }, error: null };
    case "resume":
      return { session: { ...session, status: "active" }, error: null };
    case "finish":
      return { session: { ...session, status: "completed" }, error: null };
  }
}

/**
 * The core honest rule (Master Handoff §7-9, Day 18 §57): completing a
 * Focus session always produces real execution evidence (duration), but
 * mastery evidence is included ONLY if a genuine recall/test score is
 * provided. Time spent alone never proves understanding — identical
 * principle to domains/language/engine.ts's deriveSessionEffects.
 */
export function deriveFocusCompletionEffects(
  elapsedSeconds: number,
  recallScore?: { score: number; maxScore: number }
): FocusCompletionEffects {
  return {
    durationMinutes: Math.round(elapsedSeconds / 60),
    masteryEvidence: recallScore ?? null,
  };
}
