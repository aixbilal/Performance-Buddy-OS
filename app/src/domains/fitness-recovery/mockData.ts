import type { PlannedSession, Prescription, RecoveryCheckIn, TrainingPlan } from "./types";

/** Values below match PBOS-Fitness-Training-Plan-Detail and PBOS-Fitness-Recovery-Readiness approved references. */

export const SEED_PLAN: TrainingPlan = {
  id: "plan-general-fitness",
  title: "General Fitness + Calisthenics",
  status: "active",
  currentWeek: 4,
  totalWeeks: 8,
  daysPerWeek: 5,
};

export const SEED_SESSIONS: PlannedSession[] = [
  {
    id: "sess-mon",
    planId: "plan-general-fitness",
    dayOfWeek: 0,
    title: "Upper Body",
    exercises: [
      { name: "Push-ups", sets: 4, reps: "15-20" },
      { name: "Pull-ups", sets: 4, reps: "6-10" },
      { name: "Dips", sets: 3, reps: "8-12" },
      { name: "Core (Plank/Abs)", sets: 1, reps: "10 min" },
    ],
  },
  {
    id: "sess-tue",
    planId: "plan-general-fitness",
    dayOfWeek: 1,
    title: "Easy Run",
    exercises: [{ name: "Run", sets: 1, reps: "3.5 km" }],
  },
  {
    id: "sess-wed",
    planId: "plan-general-fitness",
    dayOfWeek: 2,
    title: "Lower Body + Core",
    exercises: [
      { name: "Squats", sets: 4, reps: "12-15" },
      { name: "Lunges", sets: 3, reps: "10 each leg" },
    ],
  },
];

// This is the concrete Base -> Prescription -> Actual example from the
// product doc: "3.5 km -> Today's modified prescription 2.5 km easy".
export const SEED_PRESCRIPTIONS: Prescription[] = [
  {
    id: "presc-sess-tue-today",
    plannedSessionId: "sess-tue",
    date: "2026-08-27",
    exercises: [{ name: "Run", sets: 1, reps: "2.5 km easy" }],
    modified: true,
    modificationReason: "Leg fatigue is mild and running load is above weekly average — reduced distance.",
  },
];

export const SEED_RECOVERY_CHECKINS: RecoveryCheckIn[] = [
  { id: "ci-1", date: "2026-08-21", sleepHours: 7.5, soreness: "none", energy: "high", motivation: "high", stressLevel: "normal" },
  { id: "ci-2", date: "2026-08-23", sleepHours: 7.8, soreness: "mild", energy: "normal", motivation: "high", stressLevel: "normal" },
  { id: "ci-3", date: "2026-08-25", sleepHours: 7.8, soreness: "mild", energy: "normal", motivation: "high", stressLevel: "normal" },
  { id: "ci-4", date: "2026-08-26", sleepHours: 7.8, soreness: "mild", energy: "normal", motivation: "high", stressLevel: "normal" },
];
