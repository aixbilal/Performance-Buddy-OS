/**
 * Routine Intelligence — deterministic pattern-candidate derivation (V2 Phase H).
 *
 * Pure. It looks at expected-vs-actual opportunities from the schedule + logs
 * and, ONLY when there is enough comparable evidence, surfaces a structural
 * pattern the user might want to change. It proposes nothing on its own — a
 * candidate becomes a change only through an Accept / Modify / Reject decision
 * that runs a Phase-C `adjust-routine-*` mutation.
 *
 * Conservative evidence rule (blueprint 07 §13):
 *   - no structural recommendation from fewer than MIN_OPPORTUNITIES comparable
 *     expected opportunities,
 *   - a direct bucket comparison (e.g. Monday vs the rest) needs at least
 *     MIN_PER_BUCKET comparable opportunities in EACH compared bucket.
 * Both thresholds live here as one constant and are covered by tests.
 *
 * rest / skipped are excused (removed from "expected"); a still-pending TODAY is
 * never a miss; schedule passage is never completion.
 */
import { isScheduledOn, mondayIndex } from "./engine";
import { WEEKDAY_LABELS, type CompletionState, type Routine, type RoutineLog } from "./types";

export const PATTERN_CONFIG = {
  /** Comparable expected opportunities needed for ANY structural pattern. */
  MIN_OPPORTUNITIES: 6,
  /** Comparable opportunities needed in EACH bucket of a direct comparison. */
  MIN_PER_BUCKET: 4,
  /** Overall completion rate at/below this is "consistently underperforming". */
  UNDERPERFORMANCE_RATE: 0.5,
  /** A weekday bucket this far below the routine's overall rate is notable. */
  BUCKET_GAP: 0.25,
  /** `partial` share at/above this (of completed) means the target may be too high. */
  PARTIAL_DOMINANCE_RATE: 0.5,
} as const;

const DAY_MS = 86_400_000;
const COMPLETED: ReadonlySet<CompletionState> = new Set(["complete", "partial"]);
const EXCUSED: ReadonlySet<CompletionState> = new Set(["rest", "skipped"]);

export type RoutineOpportunity = {
  iso: string;
  weekday: number; // 0 = Mon .. 6 = Sun
  /** The recorded state, or "pending" when never logged. */
  state: CompletionState;
  completed: boolean;
  partial: boolean;
};

function isoAdd(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS,
  );
}

/**
 * Expected opportunities for `routine` from `windowStartIso` up to (but not
 * including) `todayIso`. Excused days (rest/skipped) and days before the routine
 * existed are dropped; today is excluded because a pending today is not a miss.
 */
export function deriveOpportunities(
  routine: Routine,
  logs: RoutineLog[],
  windowStartIso: string,
  todayIso: string,
): RoutineOpportunity[] {
  const start =
    daysBetween(routine.createdAt.slice(0, 10), windowStartIso) >= 0
      ? windowStartIso
      : routine.createdAt.slice(0, 10);
  const out: RoutineOpportunity[] = [];
  for (let iso = start; iso < todayIso; iso = isoAdd(iso, 1)) {
    if (!isScheduledOn(routine, iso)) continue;
    const log = logs.find((l) => l.routineId === routine.id && l.date === iso);
    const state: CompletionState = log?.state ?? "pending";
    if (EXCUSED.has(state)) continue; // excused — not an expected opportunity
    out.push({
      iso,
      weekday: mondayIndex(iso),
      state,
      completed: COMPLETED.has(state),
      partial: state === "partial",
    });
  }
  return out;
}

export type PatternCandidateKind =
  | "cadence-too-aggressive"
  | "weekday-underperformance"
  | "duration-target-mismatch";

export type PatternCandidate = {
  routineId: string;
  kind: PatternCandidateKind;
  /** Human-readable, evidence-based. No moral scoring. */
  summary: string;
  evidence: string[];
  /** The mutation a user could Accept/Modify/Reject. Never auto-applied. */
  suggestedMutation: { kind: string; params: Record<string, unknown> } | null;
};

const RATE = (num: number, den: number) => (den === 0 ? 0 : num / den);

export function derivePatternCandidates(
  routine: Routine,
  opportunities: RoutineOpportunity[],
): PatternCandidate[] {
  const out: PatternCandidate[] = [];
  const n = opportunities.length;
  if (n < PATTERN_CONFIG.MIN_OPPORTUNITIES) return out; // not enough comparable evidence

  const completed = opportunities.filter((o) => o.completed).length;
  const overallRate = RATE(completed, n);

  // --- cadence consistently unrealistic ------------------------------
  if (overallRate <= PATTERN_CONFIG.UNDERPERFORMANCE_RATE) {
    const suggestedTimesPerWeek =
      routine.scheduleType === "times-per-week"
        ? Math.max(1, Math.round((routine.scheduleTarget ?? 3) * Math.max(overallRate, 0.34)))
        : Math.max(1, Math.round(7 * Math.max(overallRate, 0.34)));
    out.push({
      routineId: routine.id,
      kind: "cadence-too-aggressive",
      summary: `Completed ${completed} of ${n} expected times (${Math.round(overallRate * 100)}%) — the current cadence may be more than is sustainable right now.`,
      evidence: [
        `${n} comparable expected opportunities`,
        `${completed} completed / ${n - completed} missed`,
      ],
      suggestedMutation: {
        kind: "adjust-routine-cadence",
        params: { routineId: routine.id, timesPerWeek: suggestedTimesPerWeek },
      },
    });
  }

  // --- specific scheduled weekday(s) repeatedly underperform ---------
  // Only a DIRECT comparison with >= MIN_PER_BUCKET in each bucket.
  const byWeekday = new Map<number, RoutineOpportunity[]>();
  for (const o of opportunities) {
    if (!byWeekday.has(o.weekday)) byWeekday.set(o.weekday, []);
    byWeekday.get(o.weekday)!.push(o);
  }
  for (const [weekday, dayOpps] of byWeekday) {
    const rest = opportunities.filter((o) => o.weekday !== weekday);
    if (dayOpps.length < PATTERN_CONFIG.MIN_PER_BUCKET) continue;
    if (rest.length < PATTERN_CONFIG.MIN_PER_BUCKET) continue;
    const dayRate = RATE(dayOpps.filter((o) => o.completed).length, dayOpps.length);
    const restRate = RATE(rest.filter((o) => o.completed).length, rest.length);
    if (restRate - dayRate >= PATTERN_CONFIG.BUCKET_GAP) {
      out.push({
        routineId: routine.id,
        kind: "weekday-underperformance",
        summary: `${WEEKDAY_LABELS[weekday]} runs at ${Math.round(dayRate * 100)}% vs ${Math.round(restRate * 100)}% on other days — that day may not be a good fit.`,
        evidence: [
          `${WEEKDAY_LABELS[weekday]}: ${dayOpps.filter((o) => o.completed).length}/${dayOpps.length}`,
          `other days: ${rest.filter((o) => o.completed).length}/${rest.length}`,
        ],
        suggestedMutation:
          routine.scheduleType === "weekly-days"
            ? {
                kind: "adjust-routine-days",
                params: {
                  routineId: routine.id,
                  days: routine.scheduleDays.filter((d) => d !== weekday),
                },
              }
            : null,
      });
    }
  }

  // --- duration target repeatedly only partially completed ----------
  if (routine.completionType === "duration" && routine.targetDurationMinutes) {
    const completedOpps = opportunities.filter((o) => o.completed);
    if (completedOpps.length >= PATTERN_CONFIG.MIN_OPPORTUNITIES) {
      const partialShare = RATE(
        completedOpps.filter((o) => o.partial).length,
        completedOpps.length,
      );
      if (partialShare >= PATTERN_CONFIG.PARTIAL_DOMINANCE_RATE) {
        out.push({
          routineId: routine.id,
          kind: "duration-target-mismatch",
          summary: `${Math.round(partialShare * 100)}% of completed sessions fell short of the ${routine.targetDurationMinutes}-minute target — the target may be set too high.`,
          evidence: [
            `${completedOpps.length} completed sessions`,
            `${completedOpps.filter((o) => o.partial).length} were partial`,
          ],
          suggestedMutation: {
            kind: "adjust-routine-duration",
            params: {
              routineId: routine.id,
              targetDurationMinutes: Math.max(
                5,
                Math.round((routine.targetDurationMinutes * 0.75) / 5) * 5,
              ),
            },
          },
        });
      }
    }
  }

  return out;
}
