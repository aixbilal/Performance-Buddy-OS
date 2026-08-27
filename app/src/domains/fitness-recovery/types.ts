/**
 * Performance Buddy OS — Fitness & Recovery domain model.
 *
 * Per Master Handoff §15 and Design Assets/08 - Fitness & Recovery/README.md,
 * the defining rule of this domain — three separate, immutable records:
 *
 *   "Base Plan (3.5 km) -> Today's modified prescription (2.5 km easy)
 *    -> Actual session (2.7 km). Never overwrite history. Store all three
 *    appropriately."
 *
 * The second rule, equally important: recovery guidance must not fabricate
 * medical certainty. When there isn't enough recorded data, the engine says
 * so explicitly rather than inventing a confident-sounding number — see
 * engine.ts `deriveReadiness`.
 */

export type ExercisePrescription = {
  name: string;
  sets: number;
  reps: string; // free text — "8-12", "AMRAP", "2.5 km", etc. Not every exercise is sets×reps.
};

export type TrainingPlanStatus = "active" | "paused" | "completed";

export type TrainingPlan = {
  id: string;
  title: string;
  status: TrainingPlanStatus;
  currentWeek: number;
  totalWeeks: number;
  daysPerWeek: number;
};

/** The Base Plan — the stable, weekly-recurring template. Never edited by a single day's adjustment. */
export type PlannedSession = {
  id: string;
  planId: string;
  dayOfWeek: number; // 0 = Monday .. 6 = Sunday
  title: string;
  exercises: ExercisePrescription[];
};

/**
 * Today's actual prescription — may differ from the Base Plan (e.g. reduced
 * due to recovery state). Always a NEW record, linked back to the
 * PlannedSession it came from — the base is never mutated to match it.
 */
export type Prescription = {
  id: string;
  plannedSessionId: string;
  date: string; // ISO date
  exercises: ExercisePrescription[];
  modified: boolean;
  modificationReason: string | null;
};

export type ExerciseActual = {
  name: string;
  setsCompleted: number;
  repsCompleted: string;
};

/** What actually happened — recorded once, never rewritten by a later plan change. */
export type ActualSession = {
  id: string;
  prescriptionId: string;
  date: string;
  exercisesPerformed: ExerciseActual[];
  notes: string;
};

export type Level3 = "low" | "normal" | "high";
export type SorenessLevel = "none" | "mild" | "high";

/** Subjective daily inputs — recorded as-is, not adjusted or second-guessed by the engine. */
export type RecoveryCheckIn = {
  id: string;
  date: string;
  sleepHours: number;
  soreness: SorenessLevel;
  energy: Level3;
  motivation: Level3;
  stressLevel: Level3;
};

export type ReadinessState = "push" | "normal" | "reduced-load" | "recovery";
