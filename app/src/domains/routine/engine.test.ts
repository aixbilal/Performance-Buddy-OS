import { describe, it, expect } from "vitest";
import {
  computeConsistency,
  deriveCompletionState,
  deriveRoutineConsistency,
  deriveTodayState,
  isScheduledOn,
  scheduleLabel,
} from "./engine";
import type { Routine, RoutineLog } from "./types";

const TS = "2026-01-01T00:00:00.000Z";

function routine(over: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
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
    createdAt: "2025-01-01T00:00:00.000Z", // old enough not to clip the window
    updatedAt: TS,
    ...over,
  };
}

function log(id: string, date: string, sub: Partial<RoutineLog>): RoutineLog {
  return {
    id,
    routineId: "r1",
    date,
    state: "complete",
    quantityCompleted: null,
    durationCompletedMinutes: null,
    completedAt: null,
    createdAt: TS,
    updatedAt: TS,
    ...sub,
  };
}

function iso(base: Date, dayOffset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

describe("deriveCompletionState", () => {
  const hydration = routine();
  it("marks quantity routine complete once target is met (or exceeded)", () => {
    expect(deriveCompletionState(hydration, 2500)).toBe("complete");
    expect(deriveCompletionState(hydration, 3000)).toBe("complete");
  });
  it("marks quantity routine partial when below target but nonzero", () => {
    expect(deriveCompletionState(hydration, 1400)).toBe("partial");
  });
  it("marks quantity routine pending when nothing logged yet", () => {
    expect(deriveCompletionState(hydration, 0)).toBe("pending");
  });
  it("derives from minutes for a duration routine", () => {
    const r = routine({ completionType: "duration", targetDurationMinutes: 30, targetQuantity: null });
    expect(deriveCompletionState(r, 30)).toBe("complete");
    expect(deriveCompletionState(r, 10)).toBe("partial");
  });
});

describe("isScheduledOn / scheduleLabel", () => {
  it("daily is scheduled every day", () => {
    expect(isScheduledOn(routine(), "2026-08-31")).toBe(true);
    expect(scheduleLabel(routine())).toBe("Every day");
  });
  it("weekly-days matches only the selected Monday-indexed weekdays", () => {
    // 2026-08-31 is a Monday → index 0
    const monWed = routine({ scheduleType: "weekly-days", scheduleDays: [0, 2] });
    expect(isScheduledOn(monWed, "2026-08-31")).toBe(true); // Mon
    expect(isScheduledOn(monWed, "2026-09-01")).toBe(false); // Tue
    expect(isScheduledOn(monWed, "2026-09-02")).toBe(true); // Wed
    expect(scheduleLabel(monWed)).toBe("Mon, Wed");
  });
  it("times-per-week treats every day as an opportunity", () => {
    const r = routine({ scheduleType: "times-per-week", scheduleTarget: 3 });
    expect(isScheduledOn(r, "2026-08-31")).toBe(true);
    expect(scheduleLabel(r)).toBe("3× per week");
  });
});

describe("deriveTodayState", () => {
  it("reports scheduled + not-logged for a fresh daily routine", () => {
    const s = deriveTodayState(routine(), [], "2026-08-31");
    expect(s).toEqual({ scheduledToday: true, state: "pending", logged: false });
  });
  it("reflects a recorded state and is not scheduled when paused", () => {
    const logs = [log("l1", "2026-08-31", { state: "partial" })];
    expect(deriveTodayState(routine(), logs, "2026-08-31").state).toBe("partial");
    expect(deriveTodayState(routine({ paused: true }), logs, "2026-08-31").scheduledToday).toBe(false);
  });
  it("is not scheduled today when the weekday doesn't match", () => {
    const tue = routine({ scheduleType: "weekly-days", scheduleDays: [1] });
    expect(deriveTodayState(tue, [], "2026-08-31").scheduledToday).toBe(false); // Mon
  });
});

describe("deriveRoutineConsistency — expected vs completed, no streak", () => {
  const today = new Date();
  const T = today.toISOString().slice(0, 10);

  it("returns null (No history yet) for a brand-new routine with no logs — never 0%", () => {
    const r = routine({ createdAt: `${T}T00:00:00.000Z` });
    const c = deriveRoutineConsistency(r, [], { today: T });
    expect(c.percent).toBeNull();
    expect(c.expected).toBe(0);
  });

  it("does not count today (no log yet) as a miss", () => {
    // created 2 days ago, logged complete yesterday, nothing today
    const r = routine({ createdAt: `${iso(today, -2)}T00:00:00.000Z` });
    const logs = [log("l1", iso(today, -1), { state: "complete" })];
    const c = deriveRoutineConsistency(r, logs, { today: T });
    // opportunities: 2 days ago (miss), yesterday (complete). today excluded.
    expect(c.expected).toBe(2);
    expect(c.completed).toBe(1);
    expect(c.percent).toBe(50);
  });

  it("excludes unscheduled weekdays from expected", () => {
    // weekly-days Mon only, 14-day window → ~2 Mondays, both complete → 100%,
    // the ~12 non-Mondays are never counted
    const r = routine({
      scheduleType: "weekly-days",
      scheduleDays: [0],
      createdAt: `${iso(today, -20)}T00:00:00.000Z`,
    });
    const logs: RoutineLog[] = [];
    for (let d = 1; d <= 14; d++) {
      const day = iso(today, -d);
      if ((new Date(`${day}T00:00:00`).getDay() + 6) % 7 === 0)
        logs.push(log(`l${d}`, day, { state: "complete" }));
    }
    const c = deriveRoutineConsistency(r, logs, { today: T, windowDays: 14 });
    expect(c.percent).toBe(100);
    expect(c.expected).toBe(c.completed);
    expect(c.expected).toBeLessThanOrEqual(3);
  });

  it("treats rest / skipped as excused — removed from expected, not a miss", () => {
    const r = routine({ createdAt: `${iso(today, -4)}T00:00:00.000Z` });
    const logs = [
      log("l1", iso(today, -1), { state: "complete" }),
      log("l2", iso(today, -2), { state: "rest" }),
      log("l3", iso(today, -3), { state: "complete" }),
    ];
    const c = deriveRoutineConsistency(r, logs, { today: T });
    // opportunities in [-4..-1]: -4 miss, -3 complete, -2 excused, -1 complete
    expect(c.excused).toBe(1);
    expect(c.expected).toBe(3);
    expect(c.completed).toBe(2);
    expect(c.percent).toBe(67);
  });

  it("does not penalise days before the routine existed", () => {
    const r = routine({ createdAt: `${iso(today, -1)}T00:00:00.000Z` });
    const logs = [log("l1", iso(today, -1), { state: "complete" })];
    const c = deriveRoutineConsistency(r, logs, { today: T, windowDays: 30 });
    expect(c.expected).toBe(1); // only the single day since creation, excl. today
    expect(c.percent).toBe(100);
  });

  it("times-per-week measures target per fully-elapsed ISO week", () => {
    // target 3/week, created 20 days ago. Two full past weeks: one with 3
    // completions (100%), one with 1 (→ capped 1/3). Current partial week excluded.
    const r = routine({
      scheduleType: "times-per-week",
      scheduleTarget: 3,
      createdAt: `${iso(today, -20)}T00:00:00.000Z`,
    });
    const logs = [
      log("a1", iso(today, -8), { state: "complete" }),
      log("a2", iso(today, -9), { state: "complete" }),
      log("a3", iso(today, -10), { state: "complete" }),
      log("b1", iso(today, -15), { state: "complete" }),
    ];
    const c = deriveRoutineConsistency(r, logs, { today: T, windowDays: 30 });
    expect(c.expected).toBeGreaterThanOrEqual(6);
    expect(c.completed).toBeGreaterThanOrEqual(4);
    expect(c.percent).not.toBeNull();
    expect(c.percent).toBeLessThan(100);
  });
});

describe("computeConsistency (legacy, logged-days) — kept for Analytics", () => {
  const today = new Date();
  it("returns null percent with no logs", () => {
    expect(computeConsistency([]).percent).toBeNull();
  });
  it("computes a complete/missed ratio and does not penalise rest days", () => {
    const logs: RoutineLog[] = [
      log("l1", iso(today, -1), { state: "complete" }),
      log("l2", iso(today, -2), { state: "missed" }),
      log("l3", iso(today, -3), { state: "complete" }),
      log("l4", iso(today, -4), { state: "rest" }),
    ];
    const r = computeConsistency(logs);
    expect(r.percent).toBe(67); // 2 of 3 countable (rest excluded)
    expect(r.loggedDays).toBe(3);
  });
});
