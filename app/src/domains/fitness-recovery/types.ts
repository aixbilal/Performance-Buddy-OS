/**
 * Performance Buddy OS — Fitness & Recovery domain model (Batch 2B: relational).
 *
 * Master Handoff §15 — three separate, immutable records:
 *   BASE PLAN (`TrainingPlan` + `PlannedSession`)
 *     ≠ TODAY'S PRESCRIPTION (advisory only — `engine.buildPrescription`, not persisted)
 *     ≠ ACTUAL SESSION (`WorkoutSession` — an independent record; editing the
 *       plan never rewrites it and completing a workout never rewrites the plan)
 * Recovery guidance never fabricates certainty — `engine.deriveReadiness`
 * returns `insufficient-data` when inputs are thin. No readiness score is stored.
 */

export type ExercisePrescription = {
  name: string;
  sets: number;
  reps: string; // free text — "8-12", "AMRAP", "2.5 km"
};

export type TrainingPlanStatus = "active" | "paused" | "completed";
export const TRAINING_PLAN_STATUSES: readonly TrainingPlanStatus[] = ["active", "paused", "completed"];

export type Level3 = "low" | "normal" | "high";
export const LEVEL3S: readonly Level3[] = ["low", "normal", "high"];
export type SorenessLevel = "none" | "mild" | "high";
export const SORENESS_LEVELS: readonly SorenessLevel[] = ["none", "mild", "high"];

export type ReadinessState = "push" | "normal" | "reduced-load" | "recovery";

// ---------------------------------------------------------------------------
// Canonical persisted rows (shape matches app/src-tauri/src/fitness.rs)
// ---------------------------------------------------------------------------

export type TrainingPlan = {
  id: string;
  title: string;
  status: TrainingPlanStatus;
  currentWeek: number;
  totalWeeks: number;
  daysPerWeek: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

/** The BASE PLAN — a stable, weekly-recurring template. Never edited by a single day's adjustment. */
export type PlannedSession = {
  id: string;
  planId: string;
  dayOfWeek: number; // 0 = Monday .. 6 = Sunday
  title: string;
  exercises: ExercisePrescription[];
  createdAt: string;
  updatedAt: string;
};

export type ExerciseActual = {
  name: string;
  setsCompleted: number;
  repsCompleted: string;
};

/** What ACTUALLY happened — its own record, never rewritten by a later plan change. */
export type WorkoutSession = {
  id: string;
  planId: string | null;
  plannedSessionId: string | null;
  date: string;
  title: string;
  exercisesPerformed: ExerciseActual[];
  notes: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Subjective daily inputs — recorded as-is, not second-guessed by the engine. */
export type RecoveryCheckIn = {
  id: string;
  date: string;
  sleepHours: number;
  soreness: SorenessLevel;
  energy: Level3;
  motivation: Level3;
  stressLevel: Level3;
  createdAt: string;
  updatedAt: string;
};

/** Advisory only — produced by `engine.buildPrescription`, NEVER persisted. */
export type Prescription = {
  id: string;
  plannedSessionId: string;
  date: string;
  exercises: ExercisePrescription[];
  modified: boolean;
  modificationReason: string | null;
};

export type FitnessGraph = {
  plans: TrainingPlan[];
  plannedSessions: PlannedSession[];
  workoutSessions: WorkoutSession[];
  checkins: RecoveryCheckIn[];
};

// ---------------------------------------------------------------------------
// Form inputs + validation result
// ---------------------------------------------------------------------------

export type PlanInput = {
  title: string;
  status: TrainingPlanStatus;
  currentWeek: number;
  totalWeeks: number;
  daysPerWeek: number;
};

export type PlannedSessionInput = {
  title: string;
  dayOfWeek: number;
  exercises: ExercisePrescription[];
};

export type CheckInInput = {
  date: string;
  sleepHours: number;
  soreness: SorenessLevel;
  energy: Level3;
  motivation: Level3;
  stressLevel: Level3;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };
