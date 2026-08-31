/**
 * Deterministic Fitness & Recovery Engine.
 *
 * Per Master Handoff §15: "If data is insufficient: PBOS should say
 * Insufficient / Limited data rather than fabricate 81% readiness."
 * `deriveReadiness` enforces this as a real early-return, not a comment.
 */

import {
  LEVEL3S,
  SORENESS_LEVELS,
  TRAINING_PLAN_STATUSES,
  type CheckInInput,
  type ExercisePrescription,
  type PlanInput,
  type PlannedSession,
  type PlannedSessionInput,
  type Prescription,
  type RecoveryCheckIn,
  type ReadinessState,
  type Validated,
} from "./types";

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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_TITLE = 140;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function validatePlanInput(input: PlanInput): Validated<PlanInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the plan a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;
  if (!(TRAINING_PLAN_STATUSES as readonly string[]).includes(input.status)) {
    errors.status = "Choose a plan status.";
  }
  for (const [k, v, lo, hi] of [
    ["totalWeeks", input.totalWeeks, 1, 104],
    ["daysPerWeek", input.daysPerWeek, 1, 7],
    ["currentWeek", input.currentWeek, 1, 104],
  ] as const) {
    if (!Number.isInteger(v) || v < lo || v > hi) errors[k] = `Must be a whole number ${lo}–${hi}.`;
  }
  if (!errors.currentWeek && !errors.totalWeeks && input.currentWeek > input.totalWeeks) {
    errors.currentWeek = "Current week can't be past the total.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, title } };
}

export function validateExercisePrescription(
  ex: ExercisePrescription,
): Validated<ExercisePrescription> {
  const errors: Record<string, string> = {};
  const name = clean(ex.name);
  if (name.length === 0) errors.name = "Name the exercise.";
  if (!Number.isInteger(ex.sets) || ex.sets < 1 || ex.sets > 50) errors.sets = "Sets must be 1–50.";
  if (clean(ex.reps).length === 0) errors.reps = "Add a target (e.g. 8-12, AMRAP, 2.5 km).";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, sets: ex.sets, reps: clean(ex.reps) } };
}

export function validatePlannedSessionInput(
  input: PlannedSessionInput,
): Validated<PlannedSessionInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the session a title.";
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    errors.dayOfWeek = "Day of week must be 0–6.";
  }
  const exercises: ExercisePrescription[] = [];
  for (const ex of input.exercises) {
    const v = validateExercisePrescription(ex);
    if (!v.ok) {
      errors.exercises = Object.values(v.errors)[0] ?? "An exercise is invalid.";
      break;
    }
    exercises.push(v.value);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, dayOfWeek: input.dayOfWeek, exercises } };
}

export function validateCheckInInput(input: CheckInInput): Validated<CheckInInput> {
  const errors: Record<string, string> = {};
  if (input.date && (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date)))) {
    errors.date = "Date must be a valid date.";
  }
  if (!Number.isFinite(input.sleepHours) || input.sleepHours < 0 || input.sleepHours > 24) {
    errors.sleepHours = "Sleep hours must be between 0 and 24.";
  }
  if (!(SORENESS_LEVELS as readonly string[]).includes(input.soreness)) {
    errors.soreness = "Choose a soreness level.";
  }
  for (const k of ["energy", "motivation", "stressLevel"] as const) {
    if (!(LEVEL3S as readonly string[]).includes(input[k])) errors[k] = "Choose low / normal / high.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: input };
}
