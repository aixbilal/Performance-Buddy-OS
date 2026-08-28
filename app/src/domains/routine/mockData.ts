import type { Routine, RoutineLog } from "./types";

export const SEED_ROUTINES: Routine[] = [
  { id: "rt-morning", title: "Morning Routine", category: "Morning", timeWindow: "morning", completionType: "boolean", targetQuantity: null, targetUnit: null, targetDurationMinutes: null, priority: "important", relatedSystemId: null },
  { id: "rt-skincare-am", title: "Skincare", category: "Personal Care", timeWindow: "morning", completionType: "boolean", targetQuantity: null, targetUnit: null, targetDurationMinutes: null, priority: "flexible", relatedSystemId: null },
  { id: "rt-hydration", title: "Hydration", category: "Hydration", timeWindow: "day", completionType: "quantity", targetQuantity: 2500, targetUnit: "ml", targetDurationMinutes: null, priority: "important", relatedSystemId: null },
  { id: "rt-prayer-dhuhr", title: "Dhuhr", category: "Prayer", timeWindow: "day", completionType: "boolean", targetQuantity: null, targetUnit: null, targetDurationMinutes: null, priority: "essential", relatedSystemId: null },
  { id: "rt-reading", title: "Reading", category: "Self Growth", timeWindow: "day", completionType: "duration", targetQuantity: null, targetUnit: null, targetDurationMinutes: 30, priority: "flexible", relatedSystemId: null },
  { id: "rt-german", title: "German Practice", category: "Language", timeWindow: "evening", completionType: "duration", targetQuantity: null, targetUnit: null, targetDurationMinutes: 30, priority: "important", relatedSystemId: null },
  { id: "rt-skincare-pm", title: "Evening Skincare", category: "Personal Care", timeWindow: "evening", completionType: "boolean", targetQuantity: null, targetUnit: null, targetDurationMinutes: null, priority: "flexible", relatedSystemId: null },
];

// Last 4 days of logs for Hydration + German, enough to demonstrate real
// consistency math (>=3 days) without hand-waving a fake number.
export const SEED_LOGS: RoutineLog[] = [
  { id: "lg1", routineId: "rt-hydration", date: daysAgo(0), state: "partial", quantityCompleted: 1400, durationCompletedMinutes: null, completedAt: null },
  { id: "lg2", routineId: "rt-hydration", date: daysAgo(1), state: "complete", quantityCompleted: 2600, durationCompletedMinutes: null, completedAt: null },
  { id: "lg3", routineId: "rt-hydration", date: daysAgo(2), state: "complete", quantityCompleted: 2500, durationCompletedMinutes: null, completedAt: null },
  { id: "lg4", routineId: "rt-hydration", date: daysAgo(3), state: "missed", quantityCompleted: 0, durationCompletedMinutes: null, completedAt: null },
  { id: "lg5", routineId: "rt-german", date: daysAgo(1), state: "complete", quantityCompleted: null, durationCompletedMinutes: 30, completedAt: null },
  { id: "lg6", routineId: "rt-german", date: daysAgo(2), state: "missed", quantityCompleted: null, durationCompletedMinutes: 0, completedAt: null },
  { id: "lg7", routineId: "rt-german", date: daysAgo(3), state: "missed", quantityCompleted: null, durationCompletedMinutes: 0, completedAt: null },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
