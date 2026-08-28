/**
 * Deterministic Analytics Engine. No domain state, correlation, or
 * confidence level here is ever produced by an AI call — AI only
 * interprets/explains these already-computed numbers (§7.1, §8.1).
 */

import type { ConfidenceLevel, DomainSnapshot, DomainState, WeeklyReview } from "./types";

const MIN_EVIDENCE_FOR_MODERATE = 3;
const MIN_EVIDENCE_FOR_HIGH = 8;
const TREND_THRESHOLD = 5; // percentage points — small moves don't count as a real trend

/**
 * Trend-based domain state. Deliberately does NOT invent "on-track" or
 * "drifting" without a target value — those need domain-specific context
 * this generic function doesn't have (see DAY-11 notes for what's deferred).
 */
export function deriveDomainState(
  current: number,
  previous: number | null,
  evidenceCount: number
): { state: DomainState; confidence: ConfidenceLevel } {
  const confidence: ConfidenceLevel =
    evidenceCount >= MIN_EVIDENCE_FOR_HIGH ? "high" : evidenceCount >= MIN_EVIDENCE_FOR_MODERATE ? "moderate" : "limited";

  if (previous === null) {
    // No prior data point — direction genuinely cannot be known, so this
    // never claims "improving" or "drifting" without a baseline.
    return { state: "stable", confidence: "limited" };
  }

  const delta = current - previous;
  if (delta >= TREND_THRESHOLD) return { state: "improving", confidence };
  if (delta <= -TREND_THRESHOLD) return { state: "needs-attention", confidence };
  return { state: "stable", confidence };
}

export type CorrelationResult = {
  r: number | null; // Pearson coefficient, null if sample size is too small to report at all
  direction: "positive" | "negative" | "none";
  confidence: ConfidenceLevel;
};

const MIN_SAMPLE_SIZE = 5;

/**
 * Real Pearson correlation — not a guess. Per §7.6/§7.7: below the minimum
 * sample size, `r` is null and confidence is "limited" regardless of what
 * the raw numbers might suggest — reporting a precise-looking coefficient
 * from 2-3 data points would be fake precision.
 */
export function computeCorrelation(seriesA: number[], seriesB: number[]): CorrelationResult {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < MIN_SAMPLE_SIZE) {
    return { r: null, direction: "none", confidence: "limited" };
  }

  const meanA = seriesA.reduce((s, v) => s + v, 0) / n;
  const meanB = seriesB.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = seriesA[i] - meanA;
    const db = seriesB[i] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  const denominator = Math.sqrt(denomA * denomB);
  const r = denominator === 0 ? 0 : numerator / denominator;
  const rounded = Math.round(r * 100) / 100;

  const direction = rounded > 0.1 ? "positive" : rounded < -0.1 ? "negative" : "none";
  const confidence: ConfidenceLevel = n >= MIN_EVIDENCE_FOR_HIGH ? "high" : n >= 6 ? "moderate" : "limited";

  return { r: rounded, direction, confidence };
}

/**
 * Deep-copies its inputs so a WeeklyReview snapshot is truly immutable —
 * mutating the caller's arrays after this returns must NOT change the
 * stored review. This is the concrete enforcement of §11's historical-
 * integrity rule, proven by a test, not just promised.
 */
export function buildWeeklyReview(
  weekStart: string,
  weekEnd: string,
  domainSnapshots: DomainSnapshot[],
  wins: string[],
  friction: string[]
): WeeklyReview {
  return {
    id: `wr-${weekStart}`,
    weekStart,
    weekEnd,
    domainSnapshots: domainSnapshots.map((d) => ({ ...d })),
    wins: [...wins],
    friction: [...friction],
    createdAt: new Date().toISOString(),
  };
}
