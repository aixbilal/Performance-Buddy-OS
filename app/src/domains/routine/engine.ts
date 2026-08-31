/**
 * Deterministic Routine Engine.
 *
 * V1 Day 08: "Prefer 7-day / 30-day consistency ... over a fragile streak
 * count." `deriveRoutineConsistency` is the enforcement of that — it counts
 * COMPLETED vs EXPECTED opportunities from the schedule, never a streak, and
 * never treats *today* (not yet finished) or days before the routine existed
 * as a failure. There is no streak counter in this module.
 */

import {
  CHECK_IN_STATES,
  COMPLETION_STATES,
  COMPLETION_TYPES,
  PRIORITIES,
  SCHEDULE_TYPES,
  TIME_WINDOWS,
  WEEKDAY_LABELS,
  type CheckInInput,
  type CompletionState,
  type CompletionType,
  type Routine,
  type RoutineInput,
  type RoutineLog,
  type ScheduleType,
  type Validated,
} from "./types";

// ---------------------------------------------------------------------------
// Completion-state derivation (unchanged public contract — Language depends on it)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// All calendar math is done in UTC so day-walking and weekday lookup stay
// consistent regardless of the running machine's timezone.
function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}
function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** 0 = Monday .. 6 = Sunday (JS `getUTCDay()` is 0 = Sunday). */
export function mondayIndex(iso: string): number {
  return (toDate(iso).getUTCDay() + 6) % 7;
}

/** Is this routine scheduled to happen on `iso`? (Ignores paused/archived — see `deriveTodayState`.) */
export function isScheduledOn(routine: Routine, iso: string): boolean {
  switch (routine.scheduleType) {
    case "daily":
      return true;
    case "weekly-days":
      return routine.scheduleDays.includes(mondayIndex(iso));
    case "times-per-week":
      // Every day is an opportunity; the target is measured per ISO week in
      // `deriveRoutineConsistency`.
      return true;
  }
}

export function scheduleLabel(routine: Routine): string {
  switch (routine.scheduleType) {
    case "daily":
      return "Every day";
    case "weekly-days":
      return routine.scheduleDays.length === 0
        ? "No days selected"
        : [...routine.scheduleDays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ");
    case "times-per-week":
      return `${routine.scheduleTarget ?? 0}× per week`;
  }
}

/** ISO-week key like `2026-W05`, Monday-based (UTC). */
function isoWeekKey(iso: string): string {
  const d = toDate(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / DAY_MS -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

export type TodayState = {
  scheduledToday: boolean;
  state: CompletionState;
  logged: boolean;
};

export function deriveTodayState(
  routine: Routine,
  logs: RoutineLog[],
  today: string,
): TodayState {
  const log = logs.find((l) => l.routineId === routine.id && l.date === today);
  return {
    scheduledToday:
      !routine.paused && !routine.archived && isScheduledOn(routine, today),
    state: log?.state ?? "pending",
    logged: !!log,
  };
}

// ---------------------------------------------------------------------------
// Consistency — schedule-aware, expected vs completed (no streak)
// ---------------------------------------------------------------------------

export type RoutineConsistency = {
  /** null when there is no completed opportunity yet — never a fabricated number. */
  percent: number | null;
  expected: number;
  completed: number;
  /** rest / skipped days — excused, removed from `expected`, not a miss. */
  excused: number;
  windowDays: number;
};

const COMPLETE_SET: ReadonlySet<CompletionState> = new Set(["complete", "partial"]);
const EXCUSED_SET: ReadonlySet<CompletionState> = new Set(["rest", "skipped"]);

/**
 * Consistency over a rolling window ending `today`. Only counts opportunities
 * that (a) fall on/after the routine's creation date, (b) are actually
 * scheduled, and (c) are in the past OR already have a log — *today with no
 * log yet is not a miss*. rest/skipped are excused.
 */
export function deriveRoutineConsistency(
  routine: Routine,
  logs: RoutineLog[],
  opts: { today: string; windowDays?: number },
): RoutineConsistency {
  const windowDays = opts.windowDays ?? 30;
  const today = opts.today.slice(0, 10);
  const createdDay = routine.createdAt.slice(0, 10);
  const windowStartTs = toDate(today).getTime() - (windowDays - 1) * DAY_MS;
  const startTs = Math.max(windowStartTs, toDate(createdDay).getTime());
  const todayTs = toDate(today).getTime();

  const mine = logs.filter((l) => l.routineId === routine.id);
  const stateByDate = new Map<string, CompletionState>();
  for (const l of mine) {
    if (l.date >= isoOf(new Date(startTs)) && l.date <= today) stateByDate.set(l.date, l.state);
  }

  if (startTs > todayTs) {
    return { percent: null, expected: 0, completed: 0, excused: 0, windowDays };
  }

  if (routine.scheduleType === "times-per-week") {
    return timesPerWeekConsistency(routine, stateByDate, startTs, todayTs, windowDays);
  }

  let expected = 0;
  let completed = 0;
  let excused = 0;
  for (let ts = startTs; ts <= todayTs; ts += DAY_MS) {
    const iso = isoOf(new Date(ts));
    if (!isScheduledOn(routine, iso)) continue;
    const st = stateByDate.get(iso);
    // today with nothing recorded yet is not (yet) a failure
    if (iso === today && st === undefined) continue;
    if (st && EXCUSED_SET.has(st)) {
      excused += 1;
      continue;
    }
    expected += 1;
    if (st && COMPLETE_SET.has(st)) completed += 1;
  }

  const percent = expected === 0 ? null : Math.round((completed / expected) * 100);
  return { percent, expected, completed, excused, windowDays };
}

function timesPerWeekConsistency(
  routine: Routine,
  stateByDate: Map<string, CompletionState>,
  startTs: number,
  todayTs: number,
  windowDays: number,
): RoutineConsistency {
  const target = Math.max(1, routine.scheduleTarget ?? 1);
  const currentWeek = isoWeekKey(isoOf(new Date(todayTs)));
  const weeks = new Map<string, number>(); // week -> completions
  const seenWeeks = new Set<string>();
  for (let ts = startTs; ts <= todayTs; ts += DAY_MS) {
    const iso = isoOf(new Date(ts));
    const wk = isoWeekKey(iso);
    seenWeeks.add(wk);
    const st = stateByDate.get(iso);
    if (st && COMPLETE_SET.has(st)) weeks.set(wk, (weeks.get(wk) ?? 0) + 1);
  }
  // Only fully-elapsed past weeks are "expected"; the current (partial) week is
  // not counted as a shortfall.
  let expected = 0;
  let completed = 0;
  for (const wk of seenWeeks) {
    if (wk === currentWeek) continue;
    expected += target;
    completed += Math.min(target, weeks.get(wk) ?? 0);
  }
  const percent = expected === 0 ? null : Math.round((completed / expected) * 100);
  return { percent, expected, completed, excused: 0, windowDays };
}

// ---------------------------------------------------------------------------
// Legacy consistency (kept for Analytics back-compat — logged-days basis)
// ---------------------------------------------------------------------------

export type ConsistencyResult = {
  percent: number | null;
  loggedDays: number;
  completeDays: number;
};

/** @deprecated pre-2B logged-days consistency. New surfaces use `deriveRoutineConsistency`. */
export function computeConsistency(logs: RoutineLog[], windowDays: number = 30): ConsistencyResult {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const withinWindow = logs.filter((l) => new Date(l.date) >= cutoff);
  if (withinWindow.length === 0) return { percent: null, loggedDays: 0, completeDays: 0 };

  const countable = withinWindow.filter((l) => l.state !== "rest" && l.state !== "skipped");
  if (countable.length === 0) return { percent: null, loggedDays: 0, completeDays: 0 };

  const completeDays = countable.filter((l) => l.state === "complete" || l.state === "partial").length;
  return {
    percent: Math.round((completeDays / countable.length) * 100),
    loggedDays: countable.length,
    completeDays,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_TITLE = 140;
const MAX_CATEGORY = 60;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function isCompletionState(v: unknown): v is CompletionState {
  return (COMPLETION_STATES as readonly string[]).includes(v as string);
}
export function isScheduleType(v: unknown): v is ScheduleType {
  return (SCHEDULE_TYPES as readonly string[]).includes(v as string);
}
export function isCompletionType(v: unknown): v is CompletionType {
  return (COMPLETION_TYPES as readonly string[]).includes(v as string);
}

export function validateRoutineInput(input: RoutineInput): Validated<RoutineInput> {
  const errors: Record<string, string> = {};

  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the routine a name.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the name under ${MAX_TITLE} characters.`;

  const category = clean(input.category);
  if (category.length > MAX_CATEGORY) errors.category = `Keep the category under ${MAX_CATEGORY} characters.`;

  if (!(TIME_WINDOWS as readonly string[]).includes(input.timeWindow)) {
    errors.timeWindow = "Choose when in the day.";
  }
  if (!(PRIORITIES as readonly string[]).includes(input.priority)) {
    errors.priority = "Choose a priority.";
  }

  // --- schedule ---
  let days: number[] = [];
  let timesPerWeek: number | null = null;
  if (!isScheduleType(input.schedule.type)) {
    errors.schedule = "Choose a cadence.";
  } else if (input.schedule.type === "weekly-days") {
    days = [...new Set(input.schedule.days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    days.sort((a, b) => a - b);
    if (days.length === 0) errors.schedule = "Pick at least one day of the week.";
  } else if (input.schedule.type === "times-per-week") {
    const n = input.schedule.timesPerWeek;
    if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > 7) {
      errors.schedule = "Times per week must be a whole number 1–7.";
    } else {
      timesPerWeek = n as number;
    }
  }

  // --- completion type + its target ---
  let targetQuantity: number | null = null;
  let targetUnit: string | null = null;
  let targetDurationMinutes: number | null = null;
  if (!isCompletionType(input.completionType)) {
    errors.completionType = "Choose how completion is measured.";
  } else if (input.completionType === "quantity") {
    const q = Number(input.targetQuantity);
    if (!Number.isFinite(q) || q <= 0) errors.targetQuantity = "Enter a target amount greater than 0.";
    else targetQuantity = q;
    const u = clean(input.targetUnit ?? "");
    if (u.length === 0) errors.targetUnit = "Add a unit (e.g. ml, pages, glasses).";
    else targetUnit = u;
  } else if (input.completionType === "duration") {
    const m = Number(input.targetDurationMinutes);
    if (!Number.isInteger(m) || m <= 0) errors.targetDurationMinutes = "Enter target minutes greater than 0.";
    else targetDurationMinutes = m;
  }

  const relatedSystemId =
    typeof input.relatedSystemId === "string" && input.relatedSystemId.trim() !== ""
      ? input.relatedSystemId
      : null;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      category,
      timeWindow: input.timeWindow,
      schedule: { type: input.schedule.type, days, timesPerWeek },
      completionType: input.completionType,
      targetQuantity,
      targetUnit,
      targetDurationMinutes,
      priority: input.priority,
      relatedSystemId,
    },
  };
}

export function validateCheckInInput(input: CheckInInput): Validated<CheckInInput> {
  const errors: Record<string, string> = {};
  if (input.date && (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date)))) {
    errors.date = "Date must be a valid date.";
  }
  if (!(CHECK_IN_STATES as readonly string[]).includes(input.state)) {
    errors.state = "Choose completed / partial / missed / skipped / rest.";
  }
  if (
    input.quantityCompleted !== null &&
    (!Number.isFinite(input.quantityCompleted) || (input.quantityCompleted as number) < 0)
  ) {
    errors.quantityCompleted = "Amount can't be negative.";
  }
  if (
    input.durationCompletedMinutes !== null &&
    (!Number.isFinite(input.durationCompletedMinutes) || (input.durationCompletedMinutes as number) < 0)
  ) {
    errors.durationCompletedMinutes = "Minutes can't be negative.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: input };
}
