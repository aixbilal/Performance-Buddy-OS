/**
 * One-time migration of the pre-2B Fitness KV blobs into the canonical
 * relational graph. Pure and fully testable.
 *
 * Legacy keys:
 *   pbos:fitness-plan          -> TrainingPlan   (a single object, not an array)
 *   pbos:fitness-sessions      -> PlannedSession[]
 *   pbos:fitness-prescriptions -> Prescription[] (DROPPED — advisory only in V1,
 *                                 never persisted; reported, not imported)
 *   pbos:fitness-checkins      -> RecoveryCheckIn[]
 *
 * Guarantees: parse safely, preserve IDs, idempotent, non-destructive, drop
 * dangling planned sessions (missing plan) with a report, no fabricated
 * workout history, no fabricated readiness.
 */
import { newId } from "./ids";
import {
  LEVEL3S,
  SORENESS_LEVELS,
  TRAINING_PLAN_STATUSES,
  type ExercisePrescription,
  type FitnessGraph,
  type Level3,
  type PlannedSession,
  type RecoveryCheckIn,
  type SorenessLevel,
  type TrainingPlan,
  type TrainingPlanStatus,
} from "./types";

export type FitLegacyReport = {
  parsed: { plans: number; plannedSessions: number; checkins: number };
  malformed: string[];
  repairs: string[];
};

export type FitLegacyResult = { graph: FitnessGraph; report: FitLegacyReport };

const NOW = () => new Date().toISOString();

function asArray(raw: string | null): { items: unknown[]; malformed: boolean } {
  if (raw == null) return { items: [], malformed: false };
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? { items: v, malformed: false } : { items: [], malformed: true };
  } catch {
    return { items: [], malformed: true };
  }
}
function asObject(raw: string | null): { value: Record<string, unknown> | null; malformed: boolean } {
  if (raw == null) return { value: null, malformed: false };
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v)
      ? { value: v as Record<string, unknown>, malformed: false }
      : { value: null, malformed: true };
  } catch {
    return { value: null, malformed: true };
  }
}
const int = (v: unknown, dflt: number) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : dflt);
function coerceStatus(v: unknown): TrainingPlanStatus {
  return (TRAINING_PLAN_STATUSES as readonly string[]).includes(v as string)
    ? (v as TrainingPlanStatus)
    : "active";
}
function coerceLevel(v: unknown): Level3 {
  return (LEVEL3S as readonly string[]).includes(v as string) ? (v as Level3) : "normal";
}
function coerceSoreness(v: unknown): SorenessLevel {
  return (SORENESS_LEVELS as readonly string[]).includes(v as string) ? (v as SorenessLevel) : "none";
}
function coerceExercises(v: unknown): ExercisePrescription[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      name: typeof x.name === "string" ? x.name : "Exercise",
      sets: int(x.sets, 1),
      reps: typeof x.reps === "string" ? x.reps : String(x.reps ?? ""),
    }));
}

export function resolveLegacyFitness(raw: {
  plan: string | null;
  sessions: string | null;
  prescriptions: string | null;
  checkins: string | null;
}): FitLegacyResult {
  const report: FitLegacyReport = {
    parsed: { plans: 0, plannedSessions: 0, checkins: 0 },
    malformed: [],
    repairs: [],
  };

  const planObj = asObject(raw.plan);
  const sessArr = asArray(raw.sessions);
  const presArr = asArray(raw.prescriptions);
  const ciArr = asArray(raw.checkins);
  if (planObj.malformed) report.malformed.push("pbos:fitness-plan");
  if (sessArr.malformed) report.malformed.push("pbos:fitness-sessions");
  if (presArr.malformed) report.malformed.push("pbos:fitness-prescriptions");
  if (ciArr.malformed) report.malformed.push("pbos:fitness-checkins");
  if (presArr.items.length > 0) {
    report.repairs.push(
      `${presArr.items.length} legacy prescription(s) dropped — Today's Prescription is advisory-only in V1, never persisted`,
    );
  }

  // --- plan (single) ---
  const plans: TrainingPlan[] = [];
  const planIds = new Set<string>();
  if (planObj.value) {
    const r = planObj.value;
    const id = typeof r.id === "string" && r.id ? r.id : newId("plan");
    planIds.add(id);
    plans.push({
      id,
      title: typeof r.title === "string" ? r.title : "Training Plan",
      status: coerceStatus(r.status),
      currentWeek: Math.max(1, int(r.currentWeek, 1)),
      totalWeeks: Math.max(1, int(r.totalWeeks, 1)),
      daysPerWeek: Math.min(7, Math.max(1, int(r.daysPerWeek, 3))),
      archived: r.archived === true,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.plans++;
  }

  // --- planned sessions ---
  const plannedSessions: PlannedSession[] = [];
  const sessIds = new Set<string>();
  for (const row of sessArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a planned session row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("psess");
    if (sessIds.has(id)) {
      report.repairs.push(`duplicate planned session id ${id} skipped`);
      continue;
    }
    const planId = typeof r.planId === "string" ? r.planId : "";
    if (!planIds.has(planId)) {
      report.repairs.push(`planned session ${id} → missing plan ${planId || "(none)"} — dropped`);
      continue;
    }
    sessIds.add(id);
    plannedSessions.push({
      id,
      planId,
      dayOfWeek: Math.min(6, Math.max(0, int(r.dayOfWeek, 0))),
      title: typeof r.title === "string" ? r.title : "Session",
      exercises: coerceExercises(r.exercises),
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.plannedSessions++;
  }

  // --- recovery check-ins ---
  const checkins: RecoveryCheckIn[] = [];
  const ciIds = new Set<string>();
  for (const row of ciArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a check-in row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("ci");
    if (ciIds.has(id)) {
      report.repairs.push(`duplicate check-in id ${id} skipped`);
      continue;
    }
    ciIds.add(id);
    const sleep = Number(r.sleepHours);
    checkins.push({
      id,
      date: typeof r.date === "string" ? r.date : "",
      sleepHours: Number.isFinite(sleep) ? Math.min(24, Math.max(0, sleep)) : 0,
      soreness: coerceSoreness(r.soreness),
      energy: coerceLevel(r.energy),
      motivation: coerceLevel(r.motivation),
      stressLevel: coerceLevel(r.stressLevel),
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.checkins++;
  }

  return { graph: { plans, plannedSessions, workoutSessions: [], checkins }, report };
}
