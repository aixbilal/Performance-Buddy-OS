/**
 * TEST / DEMO FIXTURES ONLY — Batch 2B. NOT loaded as user data (store has no
 * seed; relational SQLite is authoritative). Nothing in `src/` imports this
 * outside `*.test.*`.
 */
import type {
  PlannedSession,
  RecoveryCheckIn,
  TrainingPlan,
  WorkoutSession,
} from "./types";

const TS = "2026-01-01T00:00:00.000Z";

export const FIXTURE_PLAN: TrainingPlan = {
  id: "plan-1",
  title: "Weekly Training",
  status: "active",
  currentWeek: 1,
  totalWeeks: 8,
  daysPerWeek: 3,
  archived: false,
  createdAt: TS,
  updatedAt: TS,
};

export const FIXTURE_PLANNED_SESSIONS: PlannedSession[] = [
  {
    id: "psess-mon",
    planId: "plan-1",
    dayOfWeek: 0,
    title: "Upper Body",
    exercises: [
      { name: "Push-ups", sets: 3, reps: "15" },
      { name: "Pull-ups", sets: 3, reps: "6-10" },
    ],
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_WORKOUTS: WorkoutSession[] = [
  {
    id: "wsess-1",
    planId: "plan-1",
    plannedSessionId: "psess-mon",
    date: "2026-08-25",
    title: "Upper Body",
    exercisesPerformed: [{ name: "Push-ups", setsCompleted: 3, repsCompleted: "15,14,11" }],
    notes: "",
    completed: true,
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_CHECKINS: RecoveryCheckIn[] = [
  {
    id: "ci-1",
    date: "2026-08-24",
    sleepHours: 7.8,
    soreness: "mild",
    energy: "normal",
    motivation: "high",
    stressLevel: "normal",
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: "ci-2",
    date: "2026-08-25",
    sleepHours: 8,
    soreness: "none",
    energy: "high",
    motivation: "high",
    stressLevel: "low",
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: "ci-3",
    date: "2026-08-26",
    sleepHours: 7.5,
    soreness: "none",
    energy: "high",
    motivation: "high",
    stressLevel: "normal",
    createdAt: TS,
    updatedAt: TS,
  },
];
