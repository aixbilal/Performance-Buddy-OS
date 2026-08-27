/**
 * Deterministic Knowledge Engine.
 *
 * Per Master Handoff §5 and §16-17: knowledge state comes from real recorded
 * evidence, never fabricated, and "Covered does not mean Mastered" (§5) —
 * so state is derived from mastery percent (evidence-driven), NOT from
 * whether a source was merely added/read.
 */

import type { Evidence, KnowledgeState } from "./types";

/**
 * Mastery percent → state. Thresholds are a straightforward, documented
 * product decision (not a guessed/hidden cutoff) — kept in one place so
 * they're easy to find and change.
 */
export function deriveKnowledgeState(masteryPercent: number): KnowledgeState {
  if (masteryPercent === 0) return "new";
  if (masteryPercent < 40) return "learning";
  if (masteryPercent < 75) return "developing";
  return "strong";
}

/**
 * A topic can be "Strong" and still "Review Due" at the same time — these
 * are two independent facts, per Master Handoff §5, not one collapsed flag.
 */
export function isReviewDue(nextReviewDate: string | null, today: Date = new Date()): boolean {
  if (!nextReviewDate) return false;
  return new Date(nextReviewDate).getTime() <= today.getTime();
}

/**
 * Recomputes mastery from real evidence records — a simple, transparent,
 * recency-weighted average (most recent evidence counts more), not a
 * fabricated number. If there's no evidence yet, mastery is 0 (state: "new"),
 * never invented.
 */
export function computeMasteryFromEvidence(evidence: Evidence[]): number {
  if (evidence.length === 0) return 0;

  const sorted = [...evidence].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  // Linear recency weight: oldest = weight 1, newest = weight sorted.length.
  let weightedSum = 0;
  let weightTotal = 0;
  sorted.forEach((e, i) => {
    const weight = i + 1;
    const percent = (e.score / e.maxScore) * 100;
    weightedSum += percent * weight;
    weightTotal += weight;
  });

  return Math.round(weightedSum / weightTotal);
}
