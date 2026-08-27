/**
 * Deterministic Fitness & Recovery Engine.
 *
 * Per Master Handoff §15: "If data is insufficient: PBOS should say
 * Insufficient / Limited data rather than fabricate 81% readiness."
 * `deriveReadiness` enforces this as a real early-return, not a comment.
 */

import type { ExercisePrescription, PlannedSession, Prescription, RecoveryCheckIn, ReadinessState } from "./types";

const MIN_CHECKINS_FOR_READINESS = 3;

export type ReadinessResult = {
  state: ReadinessState | "insufficient-data";
  score: number | null; // 0-100, null when insufficient data — never a fabricated number
  reason: string;
};

const SORENESS_SCORE: Record<string, number> = { none: 100, mild: 60, high: 20 };
const LEVEL_SCORE: Record<string, number> = { low: 20, normal: 60, high: 100 };
const SLEEP_TARGET_MIN = 7.5;
const SLEEP_TARGET_MAX = 8.5;

function sleepScore(hours: number): number {
  if (hours >= SLEEP_TARGET_MIN && hours <= SLEEP_TARGET_MAX) return 100;
  const distance = hours < SLEEP_TARGET_MIN ? SLEEP_TARGET_MIN - hours : hours - SLEEP_TARGET_MAX;
  return Math.max(0, 100 - distance * 25); // simple linear falloff, transparent and easy to audit
}

/**
 * Uses the most recent check-ins (up to 7) equally-weighted. Deliberately
 * simple and auditable — this is meant to be explainable in one sentence,
 * not a hidden model. Never invents a number when data is thin.
 */
export function deriveReadiness(checkIns: RecoveryCheckIn[]): ReadinessResult {
  if (checkIns.length < MIN_CHECKINS_FOR_READINESS) {
    return {
      state: "insufficient-data",
      score: null,
      reason: `Only ${checkIns.length} check-in(s) recorded — at least ${MIN_CHECKINS_FOR_READINESS} are needed for a reliable recommendation.`,
    };
  }

  const recent = [...checkIns]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  const scores = recent.map(
    (c) => (SORENESS_SCORE[c.soreness] + LEVEL_SCORE[c.energy] + sleepScore(c.sleepHours)) / 3
  );
  const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  let state: ReadinessState;
  let reason: string;
  if (avgScore >= 80) {
    state = "push";
    reason = "Recovery indicators are strong across recent check-ins.";
  } else if (avgScore >= 55) {
    state = "normal";
    reason = "Recovery indicators are stable — proceed with the planned session.";
  } else if (avgScore >= 30) {
    state = "reduced-load";
    reason = "Some recovery indicators (soreness, sleep, or energy) are below target.";
  } else {
    state = "recovery";
    reason = "Multiple recovery indicators are low — consider rest or light activity today.";
  }

  return { state, score: avgScore, reason };
}

/**
 * Builds a new Prescription from a Base PlannedSession WITHOUT mutating the
 * base. This is the concrete enforcement of "never overwrite history" —
 * callers get a new object; `session` is never touched.
 */
export function buildPrescription(
  session: PlannedSession,
  date: string,
  overrideExercises?: ExercisePrescription[],
  reason?: string
): Prescription {
  const modified = overrideExercises !== undefined;
  return {
    id: `presc-${session.id}-${date}`,
    plannedSessionId: session.id,
    date,
    exercises: modified ? overrideExercises! : session.exercises,
    modified,
    modificationReason: modified ? reason ?? null : null,
  };
}
