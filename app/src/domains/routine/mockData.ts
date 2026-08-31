/**
 * TEST / DEMO FIXTURES ONLY — never loaded as user data.
 *
 * The Routine store starts empty on a fresh profile (Batch 2B). These shapes
 * exist so tests and Storybook-style previews have realistic data without
 * seeding the running app.
 */
import type { Routine, RoutineLog } from "./types";

const TS = "2026-01-01T00:00:00.000Z";

export const FIXTURE_ROUTINES: Routine[] = [
  {
    id: "rt-hydration",
    title: "Hydration",
    category: "Hydration",
    timeWindow: "day",
    scheduleType: "daily",
    scheduleDays: [],
    scheduleTarget: null,
    completionType: "quantity",
    targetQuantity: 2500,
    targetUnit: "ml",
    targetDurationMinutes: null,
    priority: "important",
    relatedSystemId: null,
    paused: false,
    archived: false,
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: "rt-german",
    title: "German Practice",
    category: "Language",
    timeWindow: "evening",
    scheduleType: "weekly-days",
    scheduleDays: [0, 1, 2, 3, 4],
    scheduleTarget: null,
    completionType: "duration",
    targetQuantity: null,
    targetUnit: null,
    targetDurationMinutes: 30,
    priority: "important",
    relatedSystemId: null,
    paused: false,
    archived: false,
    createdAt: TS,
    updatedAt: TS,
  },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const FIXTURE_LOGS: RoutineLog[] = [
  {
    id: "lg1",
    routineId: "rt-hydration",
    date: daysAgo(1),
    state: "complete",
    quantityCompleted: 2600,
    durationCompletedMinutes: null,
    completedAt: TS,
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: "lg2",
    routineId: "rt-hydration",
    date: daysAgo(2),
    state: "missed",
    quantityCompleted: 0,
    durationCompletedMinutes: null,
    completedAt: null,
    createdAt: TS,
    updatedAt: TS,
  },
];
