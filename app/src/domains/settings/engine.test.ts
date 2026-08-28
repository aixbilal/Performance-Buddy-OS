import { describe, it, expect } from "vitest";
import { computeEffectiveWeekdayCapacity, resolveResetScope } from "./engine";
import type { BaseConfig, ModeOverride, TemporaryOverride } from "./types";

const baseConfig: BaseConfig = {
  weekdayAcademicCapacityMinutes: 90, // 1h30, matches the handoff's own example exactly
  weekendAcademicCapacityMinutes: 120,
  developmentCapacityMinutes: 120,
  languageBaselineMinutes: 30,
  protectedSleepHours: 8,
  planningBufferPercent: 10,
};

describe("computeEffectiveWeekdayCapacity — §5 precedence, the handoff's own worked example", () => {
  it("matches exactly: 90 base + 45 midterm mode + 15 temporary = 150", () => {
    const mode: ModeOverride = { mode: "midterm", weekdayAcademicDeltaMinutes: 45 };
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const temp: TemporaryOverride = { id: "t1", label: "This week", weekdayAcademicDeltaMinutes: 15, expiresAt: future.toISOString() };

    const effective = computeEffectiveWeekdayCapacity(baseConfig, mode, [temp]);
    expect(effective).toBe(150);
  });

  it("falls back to base + mode once a temporary override has expired", () => {
    const mode: ModeOverride = { mode: "midterm", weekdayAcademicDeltaMinutes: 45 };
    const past = new Date("2020-01-01");
    const expiredTemp: TemporaryOverride = { id: "t1", label: "Old", weekdayAcademicDeltaMinutes: 15, expiresAt: past.toISOString() };

    const effective = computeEffectiveWeekdayCapacity(baseConfig, mode, [expiredTemp]);
    // Expired override excluded -> 90 + 45 = 135, not 150
    expect(effective).toBe(135);
  });

  it("falls back to base alone with no mode and no active overrides", () => {
    const effective = computeEffectiveWeekdayCapacity(baseConfig, null, []);
    expect(effective).toBe(90);
  });

  it("never mutates the base config object passed in", () => {
    const mode: ModeOverride = { mode: "final", weekdayAcademicDeltaMinutes: 60 };
    const snapshot = JSON.stringify(baseConfig);
    computeEffectiveWeekdayCapacity(baseConfig, mode, []);
    expect(JSON.stringify(baseConfig)).toBe(snapshot);
  });
});

describe("resolveResetScope — §19 safe reset boundaries", () => {
  it("an 'interface' reset never includes protected domain data", () => {
    const result = resolveResetScope("interface");
    const protectedFields = ["academicRecords", "goals", "actions", "routines", "schedule", "aiPermissions", "userDatabase"];
    for (const field of protectedFields) {
      expect(result.affects).not.toContain(field);
      expect(result.neverAffects).toContain(field);
    }
  });

  it("an 'interface' reset does affect notification/appearance settings", () => {
    const result = resolveResetScope("interface");
    expect(result.affects).toContain("notifications");
    expect(result.affects).toContain("appearance");
  });
});
