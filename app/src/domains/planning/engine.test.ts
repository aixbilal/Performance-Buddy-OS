import { describe, it, expect } from "vitest";
import {
  detectConflicts,
  detectCapacityViolations,
  tryFitBlock,
  rebuildUnlockedBlocks,
  computePlanFragility,
  rescheduleBlock,
  blocksOnDate,
  addDaysIso,
  startOfWeekIso,
  weekDates,
  mondayIndexOf,
  isoDateOf,
  proposeSchedule,
} from "./engine";
import type { ScheduleBlock } from "./types";

function block(overrides: Partial<ScheduleBlock>): ScheduleBlock {
  return { id: "b", title: "Block", domain: "Academics", day: 0, startMinute: 480, endMinute: 540, type: "flexible", locked: false, actionId: null, ...overrides };
}

describe("detectConflicts — direct overlap only (§9.13)", () => {
  it("matches the approved reference's exact example: 14:00-16:00 and 14:30-16:00 overlap by 90 minutes", () => {
    const a = block({ id: "a", day: 5, startMinute: 14 * 60, endMinute: 16 * 60 });
    const b2 = block({ id: "b", day: 5, startMinute: 14 * 60 + 30, endMinute: 16 * 60 });
    const conflicts = detectConflicts([a, b2]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapMinutes).toBe(90);
  });

  it("reports no conflict for non-overlapping blocks on the same day", () => {
    const a = block({ id: "a", day: 0, startMinute: 480, endMinute: 540 });
    const b2 = block({ id: "b", day: 0, startMinute: 600, endMinute: 660 });
    expect(detectConflicts([a, b2])).toHaveLength(0);
  });

  it("reports no conflict for overlapping times on different days", () => {
    const a = block({ id: "a", day: 0, startMinute: 480, endMinute: 540 });
    const b2 = block({ id: "b", day: 1, startMinute: 480, endMinute: 540 });
    expect(detectConflicts([a, b2])).toHaveLength(0);
  });
});

describe("detectCapacityViolations — daily and weekly are independent (§9.14)", () => {
  it("flags a single overloaded day even when the week total is fine", () => {
    const blocks = [block({ id: "a", day: 0, startMinute: 0, endMinute: 600 })]; // 10h on Monday
    const violations = detectCapacityViolations(blocks, 480, 3000); // daily cap 8h, weekly cap way above
    expect(violations.some((v) => v.scope === "day" && v.day === 0)).toBe(true);
    expect(violations.some((v) => v.scope === "week")).toBe(false);
  });

  it("flags weekly overload even when no single day is individually overloaded", () => {
    // 7 days x 4h each = 28h, no single day exceeds an 8h daily cap, but weekly cap is 20h
    const blocks = Array.from({ length: 7 }, (_, day) => block({ id: `d${day}`, day, startMinute: 0, endMinute: 240 }));
    const violations = detectCapacityViolations(blocks, 480, 1200); // daily 8h, weekly 20h
    expect(violations.some((v) => v.scope === "day")).toBe(false);
    expect(violations.some((v) => v.scope === "week")).toBe(true);
  });
});

describe("tryFitBlock — Could Not Fit is a valid outcome (§9.11)", () => {
  const existing = [block({ id: "existing", day: 2, startMinute: 480, endMinute: 540 })];

  it("fits cleanly when there's no conflict and capacity allows it", () => {
    const candidate = block({ id: "new", day: 2, startMinute: 600, endMinute: 660 });
    const result = tryFitBlock(candidate, existing, 480, 3000);
    expect(result.fits).toBe(true);
  });

  it("does not fit when it directly conflicts with an existing block", () => {
    const candidate = block({ id: "new", day: 2, startMinute: 500, endMinute: 560 });
    const result = tryFitBlock(candidate, existing, 480, 3000);
    expect(result.fits).toBe(false);
    expect(result.reason).toContain("Overlaps");
  });

  it("does not fit when it would exceed daily capacity, even with no conflict", () => {
    const candidate = block({ id: "new", day: 3, startMinute: 0, endMinute: 600 }); // 10h block, different day, no overlap
    const result = tryFitBlock(candidate, existing, 480, 3000); // daily cap 8h — 10h clearly exceeds it
    expect(result.fits).toBe(false);
    expect(result.reason).toContain("capacity");
  });
});

describe("rebuildUnlockedBlocks — manual locks survive regeneration (§9.12)", () => {
  it("preserves a locked block's exact contents, untouched by regeneration", () => {
    const locked = block({ id: "locked-1", title: "Sunday Rest", locked: true, day: 6 });
    const unlocked = block({ id: "unlocked-1", title: "Old Flexible Block", locked: false, day: 1 });
    const existing = [locked, unlocked];

    const proposed = [block({ id: "new-flexible-1", title: "Regenerated Block", locked: false, day: 3 })];
    const result = rebuildUnlockedBlocks(existing, proposed);

    const survivingLocked = result.find((b) => b.id === "locked-1");
    expect(survivingLocked).toEqual(locked); // byte-for-byte identical, not regenerated
    expect(result.find((b) => b.id === "unlocked-1")).toBeUndefined(); // old unlocked block replaced
    expect(result.find((b) => b.id === "new-flexible-1")).toBeDefined(); // new proposal present
  });
});

describe("computePlanFragility — 'valid but fragile' (§9.18)", () => {
  it("matches the approved reference's own example: 14h capacity, 13h50 scheduled -> fragile", () => {
    const capacity = 14 * 60;
    const scheduled = 13 * 60 + 50;
    expect(computePlanFragility(scheduled, capacity)).toBe("valid-fragile");
  });

  it("reports valid with a comfortable buffer", () => {
    expect(computePlanFragility(600, 900)).toBe("valid");
  });

  it("reports exceeds when scheduled time is over capacity", () => {
    expect(computePlanFragility(1000, 900)).toBe("exceeds");
  });
});

describe("rescheduleBlock — moving time ≠ creating a new Action (Day 18 §59)", () => {
  it("carries id and actionId through unchanged when a block moves", () => {
    const original = block({ id: "blk-1", actionId: "act-1", day: 2, startMinute: 600, endMinute: 660 });
    const result = rescheduleBlock(original, 4, 900, 960);
    expect(result.id).toBe("blk-1");
    expect(result.actionId).toBe("act-1");
    expect(result.day).toBe(4);
    expect(result.startMinute).toBe(900);
  });
});

describe("blocksOnDate — the boundary Today reads", () => {
  const dated = (id: string, over: Partial<Parameters<typeof block>[0]> & { date: string | null }) => ({
    ...block({ id, ...over }),
    date: over.date,
  });

  it("a dated block matches only its exact calendar date", () => {
    const blocks = [
      dated("a", { date: "2026-08-25", day: 1, startMinute: 600, endMinute: 660 }),
      dated("b", { date: "2026-08-26", day: 2, startMinute: 600, endMinute: 660 }),
    ];
    expect(blocksOnDate(blocks, "2026-08-25", 1).map((b) => b.id)).toEqual(["a"]);
  });

  it("an undated block recurs weekly on its weekday index", () => {
    const blocks = [dated("recurring", { date: null, day: 1, startMinute: 600, endMinute: 660 })];
    expect(blocksOnDate(blocks, "2026-08-25", 1)).toHaveLength(1);
    expect(blocksOnDate(blocks, "2026-08-26", 2)).toHaveLength(0);
  });

  it("returns matches sorted by start time", () => {
    const blocks = [
      dated("late", { date: null, day: 3, startMinute: 900, endMinute: 960 }),
      dated("early", { date: null, day: 3, startMinute: 500, endMinute: 560 }),
    ];
    expect(blocksOnDate(blocks, "2026-08-27", 3).map((b) => b.id)).toEqual(["early", "late"]);
  });
});

describe("calendar date math — civil, no timezone drift", () => {
  it("mondayIndexOf: 2026-08-31 is a Monday (index 0), 2026-09-06 is Sunday (index 6)", () => {
    expect(mondayIndexOf("2026-08-31")).toBe(0);
    expect(mondayIndexOf("2026-09-06")).toBe(6);
  });

  it("startOfWeekIso snaps any day to that week's Monday", () => {
    expect(startOfWeekIso("2026-09-02")).toBe("2026-08-31"); // Wed -> Mon
    expect(startOfWeekIso("2026-08-31")).toBe("2026-08-31"); // Mon -> itself
    expect(startOfWeekIso("2026-09-06")).toBe("2026-08-31"); // Sun -> Mon
  });

  it("addDaysIso crosses month and year boundaries", () => {
    expect(addDaysIso("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("weekDates returns 7 consecutive civil dates from the Monday", () => {
    expect(weekDates("2026-08-31")).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });

  it("isoDateOf round-trips a local Date", () => {
    expect(isoDateOf(new Date(2026, 7, 5))).toBe("2026-08-05");
  });
});

describe("proposeSchedule — deterministic, respects blocks, reports Could Not Fit", () => {
  it("places an estimate-bearing Action into the first free slot", () => {
    const p = proposeSchedule(
      [{ actionId: "a1", title: "Revise Binary Trees", estMinutes: 60 }],
      [],
      8 * 60,
      40 * 60,
    );
    expect(p.proposed).toHaveLength(1);
    expect(p.proposed[0].actionId).toBe("a1");
    expect(p.proposed[0].endMinute - p.proposed[0].startMinute).toBe(60);
    expect(p.couldNotFit).toEqual([]);
  });

  it("never overlaps a respected block", () => {
    const respected = block({ id: "fixed1", day: 0, startMinute: 9 * 60, endMinute: 21 * 60, locked: true });
    const p = proposeSchedule(
      [{ actionId: "a1", title: "x", estMinutes: 60 }],
      [respected],
      12 * 60,
      40 * 60,
    );
    // Monday's window is fully blocked; it must land on another day, not overlap.
    expect(p.proposed).toHaveLength(1);
    expect(p.proposed[0].day).not.toBe(0);
  });

  it("reports Could Not Fit rather than silently dropping when nothing fits", () => {
    // 1 hour daily capacity, one candidate needing 2 hours
    const p = proposeSchedule([{ actionId: "a1", title: "Big task", estMinutes: 120 }], [], 60, 60);
    expect(p.proposed).toEqual([]);
    expect(p.couldNotFit).toHaveLength(1);
    expect(p.couldNotFit[0].actionId).toBe("a1");
    expect(p.couldNotFit[0].reason).toMatch(/capacity|slot/i);
  });
});
