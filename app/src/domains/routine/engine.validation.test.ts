import { describe, it, expect } from "vitest";
import { validateCheckInInput, validateRoutineInput } from "./engine";
import type { RoutineInput } from "./types";

function base(over: Partial<RoutineInput> = {}): RoutineInput {
  return {
    title: "Morning Mobility",
    category: "Personal Care",
    timeWindow: "morning",
    schedule: { type: "daily", days: [], timesPerWeek: null },
    completionType: "boolean",
    targetQuantity: null,
    targetUnit: null,
    targetDurationMinutes: null,
    priority: "important",
    relatedSystemId: null,
    ...over,
  };
}

describe("validateRoutineInput", () => {
  it("accepts a well-formed daily boolean routine and trims", () => {
    const r = validateRoutineInput(base({ title: "  Stretch  ", category: "  Care " }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Stretch");
      expect(r.value.category).toBe("Care");
      expect(r.value.schedule).toEqual({ type: "daily", days: [], timesPerWeek: null });
    }
  });

  it("requires a name", () => {
    expect(validateRoutineInput(base({ title: "   " })).ok).toBe(false);
  });

  it("rejects a weekly-days schedule with no days, and dedupes/sorts valid days", () => {
    expect(
      validateRoutineInput(base({ schedule: { type: "weekly-days", days: [], timesPerWeek: null } })).ok,
    ).toBe(false);
    const r = validateRoutineInput(
      base({ schedule: { type: "weekly-days", days: [4, 0, 0, 2], timesPerWeek: null } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.schedule.days).toEqual([0, 2, 4]);
  });

  it("rejects an out-of-range times-per-week and keeps a valid one", () => {
    expect(
      validateRoutineInput(base({ schedule: { type: "times-per-week", days: [], timesPerWeek: 0 } })).ok,
    ).toBe(false);
    expect(
      validateRoutineInput(base({ schedule: { type: "times-per-week", days: [], timesPerWeek: 9 } })).ok,
    ).toBe(false);
    const r = validateRoutineInput(
      base({ schedule: { type: "times-per-week", days: [], timesPerWeek: 3 } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.schedule.timesPerWeek).toBe(3);
  });

  it("requires an amount + unit for a quantity routine", () => {
    expect(
      validateRoutineInput(
        base({ completionType: "quantity", targetQuantity: 0, targetUnit: "ml" }),
      ).ok,
    ).toBe(false);
    expect(
      validateRoutineInput(
        base({ completionType: "quantity", targetQuantity: 2500, targetUnit: "  " }),
      ).ok,
    ).toBe(false);
    const r = validateRoutineInput(
      base({ completionType: "quantity", targetQuantity: 2500, targetUnit: "ml" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.targetQuantity).toBe(2500);
      expect(r.value.targetUnit).toBe("ml");
    }
  });

  it("requires positive minutes for a duration routine and nulls unrelated targets", () => {
    expect(
      validateRoutineInput(base({ completionType: "duration", targetDurationMinutes: 0 })).ok,
    ).toBe(false);
    const r = validateRoutineInput(
      base({
        completionType: "duration",
        targetDurationMinutes: 30,
        targetQuantity: 999,
        targetUnit: "ml",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.targetDurationMinutes).toBe(30);
      expect(r.value.targetQuantity).toBeNull();
      expect(r.value.targetUnit).toBeNull();
    }
  });

  it("normalises an empty relatedSystemId to null (no forced Goal/System)", () => {
    const r = validateRoutineInput(base({ relatedSystemId: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.relatedSystemId).toBeNull();
  });
});

describe("validateCheckInInput", () => {
  it("accepts a plain completed check-in", () => {
    const r = validateCheckInInput({
      date: "2026-08-31",
      state: "complete",
      quantityCompleted: null,
      durationCompletedMinutes: null,
    });
    expect(r.ok).toBe(true);
  });
  it("rejects 'pending' as a picked state and a bad date", () => {
    expect(
      validateCheckInInput({
        date: "",
        state: "pending",
        quantityCompleted: null,
        durationCompletedMinutes: null,
      }).ok,
    ).toBe(false);
    expect(
      validateCheckInInput({
        date: "31-08-2026",
        state: "complete",
        quantityCompleted: null,
        durationCompletedMinutes: null,
      }).ok,
    ).toBe(false);
  });
  it("rejects negative recorded amounts", () => {
    expect(
      validateCheckInInput({
        date: "",
        state: "partial",
        quantityCompleted: -5,
        durationCompletedMinutes: null,
      }).ok,
    ).toBe(false);
  });
});
