/**
 * Performance Buddy OS — Routines & Daily Life domain model.
 *
 * Per Day 8 Supplementary Handoff §3: ONE configurable Routine engine, not
 * separate hydration/prayer/skincare/reading trackers. Every routine below
 * is the same shape regardless of what it tracks — only the config differs.
 *
 * Per §5: "Consistency > fragile streaks" — see engine.ts computeConsistency.
 * Per §14: A Routine may link to a Day 3 System/Goal WITHOUT duplicating it —
 * `relatedSystemId` is a reference, never a copy of System/Action data.
 */

export type CompletionType = "boolean" | "quantity" | "duration";
export type TimeWindow = "morning" | "day" | "evening" | "anytime";
export type Priority = "essential" | "important" | "flexible" | "optional";

/** Per §4: not every routine needs every state — a log just records what actually applied. */
export type CompletionState = "complete" | "partial" | "skipped" | "rest" | "missed" | "pending";

export type Routine = {
  id: string;
  title: string;
  category: string; // e.g. "Hydration", "Prayer", "Reading" — a label, not a hardcoded engine
  timeWindow: TimeWindow;
  completionType: CompletionType;
  targetQuantity: number | null; // for "quantity" type, e.g. 2500 (ml)
  targetUnit: string | null; // e.g. "ml", "pages"
  targetDurationMinutes: number | null; // for "duration" type
  priority: Priority;
  /** Links to a Day 3 System — reference only, never a duplicate of System/Action data. */
  relatedSystemId: string | null;
};

export type RoutineLog = {
  id: string;
  routineId: string;
  date: string; // ISO date
  state: CompletionState;
  quantityCompleted: number | null;
  durationCompletedMinutes: number | null;
  completedAt: string | null; // ISO datetime, null if not completed
};
