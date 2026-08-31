/**
 * Deterministic Analytics Engine. No domain state, correlation, or
 * confidence level here is ever produced by an AI call — AI only
 * interprets/explains these already-computed numbers (§7.1, §8.1).
 */

import type {
  ConfidenceLevel,
  DataSufficiency,
  DomainSnapshot,
  DomainState,
  MonthlyReview,
  Pattern,
  PeriodComparison,
  WeeklyReview,
} from "./types";

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

// ---------------------------------------------------------------------------
// Batch 6 — date windows, comparisons, monthly review, patterns
// ---------------------------------------------------------------------------

/** Inclusive yyyy-mm-dd window test. */
export function isoInWindow(iso: string, startIso: string, endIso: string): boolean {
  const d = iso.slice(0, 10);
  return d >= startIso && d <= endIso;
}

export function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** First day of the ISO week (Monday) containing `iso`. Timezone-safe (UTC). */
export function startOfWeekIso(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** First / last calendar day of the month containing `iso`. */
export function monthBounds(iso: string): { start: string; end: string } {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  return { start, end: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

/** Completion rate over a set of log rows, where a "completed" state counts. */
export function completionRate(
  logs: { state: string }[],
  completedStates: readonly string[] = ["completed", "done"],
): { rate: number | null; completed: number; total: number } {
  const total = logs.length;
  if (total === 0) return { rate: null, completed: 0, total: 0 };
  const completed = logs.filter((l) => completedStates.includes(l.state)).length;
  return { rate: Math.round((completed / total) * 100), completed, total };
}

/**
 * this-period vs prior-period. A missing prior window yields `insufficient` —
 * never a "0%" or a fabricated "improved 100%".
 */
export function comparePeriods(
  metric: string,
  unit: string,
  current: number | null,
  prior: number | null,
  flatThreshold = 5,
): PeriodComparison {
  if (current === null || prior === null) {
    return { metric, unit, current, prior, delta: null, status: "insufficient" };
  }
  const delta = current - prior;
  const status = delta > flatThreshold ? "improved" : delta < -flatThreshold ? "declined" : "flat";
  return { metric, unit, current, prior, delta, status };
}

export function deriveDataSufficiency(
  count: number,
  minThin = 3,
  minSufficient = 8,
): DataSufficiency {
  if (count >= minSufficient) return "sufficient";
  if (count >= minThin) return "thin";
  return "insufficient";
}

export function buildMonthlyReview(
  monthStart: string,
  monthEnd: string,
  domainSnapshots: DomainSnapshot[],
  comparisons: PeriodComparison[],
  observations: string[],
): MonthlyReview {
  return {
    id: `mr-${monthStart}`,
    monthStart,
    monthEnd,
    domainSnapshots: domainSnapshots.map((d) => ({ ...d })),
    comparisons: comparisons.map((c) => ({ ...c })),
    observations: [...observations],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Deterministic correlation patterns between routine completion series. Requires
 * two routines each with >= MIN_SAMPLE_SIZE overlapping logged days, otherwise a
 * single honest INSUFFICIENT EVIDENCE pattern (docs 22.14). No causation claim.
 */
export function derivePatterns(
  series: { label: string; days: { date: string; completed: boolean }[] }[],
): Pattern[] {
  const usable = series.filter((s) => s.days.length >= 3);
  if (usable.length < 2) {
    return [
      {
        id: "pattern-insufficient",
        title:
          "Not enough logged history yet to describe a reliable pattern. Keep logging and this will fill in.",
        direction: "none",
        confidence: "limited",
        sampleSize: usable.reduce((m, s) => Math.max(m, s.days.length), 0),
        insufficient: true,
      },
    ];
  }
  const patterns: Pattern[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i];
      const b = usable[j];
      const bByDate = new Map(b.days.map((d) => [d.date, d.completed]));
      const pairs = a.days
        .filter((d) => bByDate.has(d.date))
        .map((d) => [d.completed ? 1 : 0, bByDate.get(d.date) ? 1 : 0] as const);
      const { r, direction, confidence } = computeCorrelation(
        pairs.map((p) => p[0]),
        pairs.map((p) => p[1]),
      );
      const insufficient = r === null;
      patterns.push({
        id: `pattern-${a.label}-${b.label}`.replace(/\s+/g, "-").toLowerCase(),
        title: insufficient
          ? `Not enough overlapping days between ${a.label} and ${b.label} to describe an association.`
          : direction === "positive"
            ? `On days you completed ${a.label}, ${b.label} was more often completed too (association, not cause).`
            : direction === "negative"
              ? `On days you completed ${a.label}, ${b.label} was less often completed (association, not cause).`
              : `No meaningful association found between ${a.label} and ${b.label}.`,
        direction,
        confidence,
        sampleSize: pairs.length,
        insufficient,
      });
    }
  }
  return patterns;
}
