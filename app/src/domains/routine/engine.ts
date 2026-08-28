/**
 * Deterministic Routine Engine.
 *
 * Per Day 8 Supplementary Handoff §5: "Prefer 7-day consistency, 30-day
 * consistency... over a fragile streak count as the main motivational
 * system." `computeConsistency` is the enforcement of that — no streak
 * counter exists anywhere in this domain.
 */

import type { CompletionState, Routine, RoutineLog } from "./types";

/** For quantity/duration routines, derives state from actual recorded progress — never guessed. */
export function deriveCompletionState(routine: Routine, quantityOrDuration: number): CompletionState {
  if (routine.completionType === "quantity" && routine.targetQuantity) {
    const pct = quantityOrDuration / routine.targetQuantity;
    if (pct >= 1) return "complete";
    if (pct > 0) return "partial";
    return "pending";
  }
  if (routine.completionType === "duration" && routine.targetDurationMinutes) {
    const pct = quantityOrDuration / routine.targetDurationMinutes;
    if (pct >= 1) return "complete";
    if (pct > 0) return "partial";
    return "pending";
  }
  return "pending";
}

export type ConsistencyResult = {
  percent: number | null; // null when there's no logged history at all — never fabricated
  loggedDays: number;
  completeDays: number;
};

/**
 * Consistency over a rolling window, counted only from days that actually
 * have a log entry — a routine that started 5 days ago is not penalized for
 * the 25 days before it existed. This is the deliberate alternative to a
 * streak counter (§5).
 */
export function computeConsistency(logs: RoutineLog[], windowDays: number = 30): ConsistencyResult {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const withinWindow = logs.filter((l) => new Date(l.date) >= cutoff);
  if (withinWindow.length === 0) {
    return { percent: null, loggedDays: 0, completeDays: 0 };
  }

  // "Rest" and "skipped" (excused) days don't count against consistency —
  // per §4 a legitimate rest day is not a failure. Only complete/partial
  // vs missed reflects actual consistency.
  const countable = withinWindow.filter((l) => l.state !== "rest" && l.state !== "skipped");
  if (countable.length === 0) {
    return { percent: null, loggedDays: 0, completeDays: 0 };
  }

  const completeDays = countable.filter((l) => l.state === "complete" || l.state === "partial").length;
  const percent = Math.round((completeDays / countable.length) * 100);

  return { percent, loggedDays: countable.length, completeDays };
}
