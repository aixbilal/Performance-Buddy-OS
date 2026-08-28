import { describe, it, expect } from "vitest";
import { deriveCompletionState, computeConsistency } from "./engine";
import type { Routine, RoutineLog } from "./types";

const hydrationRoutine: Routine = {
  id: "r1",
  title: "Hydration",
  category: "Hydration",
  timeWindow: "day",
  completionType: "quantity",
  targetQuantity: 2500,
  targetUnit: "ml",
  targetDurationMinutes: null,
  priority: "important",
  relatedSystemId: null,
};

describe("deriveCompletionState", () => {
  it("marks quantity routine complete once target is met", () => {
    expect(deriveCompletionState(hydrationRoutine, 2500)).toBe("complete");
  });
  it("marks quantity routine complete even if exceeded", () => {
    expect(deriveCompletionState(hydrationRoutine, 3000)).toBe("complete");
  });
  it("marks quantity routine partial when below target but nonzero", () => {
    expect(deriveCompletionState(hydrationRoutine, 1400)).toBe("partial");
  });
  it("marks quantity routine pending when nothing logged yet", () => {
    expect(deriveCompletionState(hydrationRoutine, 0)).toBe("pending");
  });
});

describe("computeConsistency — no streaks (Day 8 §5)", () => {
  it("returns null percent with no logs at all, never a fabricated number", () => {
    const result = computeConsistency([]);
    expect(result.percent).toBeNull();
  });

  it("computes correct percent for a simple complete/missed mix", () => {
    const today = new Date();
    const logs: RoutineLog[] = [
      { id: "l1", routineId: "r1", date: iso(today, -1), state: "complete", quantityCompleted: 2500, durationCompletedMinutes: null, completedAt: null },
      { id: "l2", routineId: "r1", date: iso(today, -2), state: "missed", quantityCompleted: 0, durationCompletedMinutes: null, completedAt: null },
      { id: "l3", routineId: "r1", date: iso(today, -3), state: "complete", quantityCompleted: 2600, durationCompletedMinutes: null, completedAt: null },
      { id: "l4", routineId: "r1", date: iso(today, -4), state: "complete", quantityCompleted: 2500, durationCompletedMinutes: null, completedAt: null },
    ];
    // 3 complete / 4 countable = 75%
    const result = computeConsistency(logs);
    expect(result.percent).toBe(75);
    expect(result.loggedDays).toBe(4);
  });

  it("does not penalize legitimate rest/skipped days", () => {
    const today = new Date();
    const logs: RoutineLog[] = [
      { id: "l1", routineId: "r1", date: iso(today, -1), state: "complete", quantityCompleted: null, durationCompletedMinutes: 30, completedAt: null },
      { id: "l2", routineId: "r1", date: iso(today, -2), state: "rest", quantityCompleted: null, durationCompletedMinutes: null, completedAt: null },
      { id: "l3", routineId: "r1", date: iso(today, -3), state: "complete", quantityCompleted: null, durationCompletedMinutes: 35, completedAt: null },
    ];
    // Only 2 countable days (rest excluded), both complete -> 100%, not penalized for the rest day
    const result = computeConsistency(logs);
    expect(result.percent).toBe(100);
    expect(result.loggedDays).toBe(2);
  });

  it("only counts logs within the requested window", () => {
    const today = new Date();
    const logs: RoutineLog[] = [
      { id: "l1", routineId: "r1", date: iso(today, -1), state: "complete", quantityCompleted: null, durationCompletedMinutes: null, completedAt: null },
      { id: "l2", routineId: "r1", date: iso(today, -40), state: "missed", quantityCompleted: null, durationCompletedMinutes: null, completedAt: null },
    ];
    // 40-day-old missed log is outside a 30-day window -> only the recent complete counts
    const result = computeConsistency(logs, 30);
    expect(result.percent).toBe(100);
    expect(result.loggedDays).toBe(1);
  });
});

function iso(base: Date, dayOffset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}
