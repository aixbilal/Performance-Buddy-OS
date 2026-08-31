/**
 * Performance Buddy OS — Routines & Daily Life domain model (Batch 2B: relational).
 *
 * V1 Day 08 decision specs:
 *   ONE configurable Routine engine, not separate hydration/prayer/skincare
 *   trackers — every routine is the same shape, only the config differs.
 *
 *   ROUTINE ≠ ACTION ≠ SYSTEM ≠ GOAL. A Routine is a repeatable personal
 *   behavior. It MAY reference a canonical System (`relatedSystemId`) but never
 *   duplicates System/Action data, and a check-in never creates an Action.
 *
 *   Consistency is DERIVED (engine.deriveRoutineConsistency) from the schedule
 *   + actual `RoutineLog` history — never stored. There is NO streak counter
 *   anywhere in this domain ("consistency > fragile streaks").
 *
 * Persisted-row shapes below match `app/src-tauri/src/routine.rs`.
 */

export type CompletionType = "boolean" | "quantity" | "duration";
export const COMPLETION_TYPES: readonly CompletionType[] = ["boolean", "quantity", "duration"];

export type TimeWindow = "morning" | "day" | "evening" | "anytime";
export const TIME_WINDOWS: readonly TimeWindow[] = ["morning", "day", "evening", "anytime"];

export type Priority = "essential" | "important" | "flexible" | "optional";
export const PRIORITIES: readonly Priority[] = ["essential", "important", "flexible", "optional"];

/** Semantic cadence (not a reminder layer, which V1 keeps separate). */
export type ScheduleType = "daily" | "weekly-days" | "times-per-week";
export const SCHEDULE_TYPES: readonly ScheduleType[] = ["daily", "weekly-days", "times-per-week"];

/**
 * A log records what actually applied on a day. `pending` means "scheduled,
 * nothing recorded yet"; `rest` / `skipped` are honest non-failure states and
 * are excluded from consistency (they are not counted as a miss).
 */
export type CompletionState = "complete" | "partial" | "skipped" | "rest" | "missed" | "pending";
export const COMPLETION_STATES: readonly CompletionState[] = [
  "complete",
  "partial",
  "skipped",
  "rest",
  "missed",
  "pending",
];
/** The states a user can pick in a check-in (`pending` is only an absence marker). */
export const CHECK_IN_STATES: readonly CompletionState[] = [
  "complete",
  "partial",
  "skipped",
  "rest",
  "missed",
];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// ---------------------------------------------------------------------------
// Canonical persisted rows
// ---------------------------------------------------------------------------

export type Routine = {
  id: string;
  title: string;
  category: string; // a label ("Hydration", "Prayer", "Reading") — not a hardcoded engine
  timeWindow: TimeWindow;
  scheduleType: ScheduleType;
  scheduleDays: number[]; // weekdays 0=Mon..6=Sun — used by "weekly-days"
  scheduleTarget: number | null; // per-ISO-week count — used by "times-per-week"
  completionType: CompletionType;
  targetQuantity: number | null;
  targetUnit: string | null;
  targetDurationMinutes: number | null;
  priority: Priority;
  /** Reference to a Day 3 System — NEVER a copy of System/Action data. */
  relatedSystemId: string | null;
  paused: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

/** The ACTUAL history — one canonical row per routine per date. */
export type RoutineLog = {
  id: string;
  routineId: string;
  date: string; // ISO date (YYYY-MM-DD)
  state: CompletionState;
  quantityCompleted: number | null;
  durationCompletedMinutes: number | null;
  completedAt: string | null; // ISO datetime, null if not completed
  createdAt: string;
  updatedAt: string;
};

export type RoutineGraph = {
  routines: Routine[];
  logs: RoutineLog[];
};

// ---------------------------------------------------------------------------
// Form inputs + validation result
// ---------------------------------------------------------------------------

export type RoutineScheduleInput = {
  type: ScheduleType;
  days: number[];
  timesPerWeek: number | null;
};

export type RoutineInput = {
  title: string;
  category: string;
  timeWindow: TimeWindow;
  schedule: RoutineScheduleInput;
  completionType: CompletionType;
  targetQuantity: number | null;
  targetUnit: string | null;
  targetDurationMinutes: number | null;
  priority: Priority;
  relatedSystemId: string | null;
};

export type CheckInInput = {
  date: string;
  state: CompletionState;
  quantityCompleted: number | null;
  durationCompletedMinutes: number | null;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };
