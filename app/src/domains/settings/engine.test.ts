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

// --- Batch 7 — effective config precedence ------------------------------------
import { resolveEffectiveConfig, modeDeltaFor } from "./engine";
import { DEFAULT_SETTINGS, type SettingsConfig } from "./types";

const future = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};
const temp = (delta: number, expiresAt: string, id = "t1"): TemporaryOverride => ({
  id,
  label: "x",
  weekdayAcademicDeltaMinutes: delta,
  expiresAt,
});
const cfg = (over: Partial<SettingsConfig> = {}): SettingsConfig => ({
  ...DEFAULT_SETTINGS,
  baseConfig: { ...DEFAULT_SETTINGS.baseConfig, weekdayAcademicCapacityMinutes: 90 },
  ...over,
});

describe("resolveEffectiveConfig — temporary > mode > base, non-destructive", () => {
  it("base only: effective === base (90)", () => {
    const e = resolveEffectiveConfig(cfg());
    expect(e.weekdayAcademicCapacityMinutes).toBe(90);
    expect(e.precedence).toMatchObject({ base: 90, modeDelta: 0, temporaryDelta: 0 });
  });

  it("base + midterm mode: 90 + 45 = 135, base untouched", () => {
    const c = cfg({ mode: "midterm" });
    const e = resolveEffectiveConfig(c);
    expect(e.weekdayAcademicCapacityMinutes).toBe(135);
    expect(c.baseConfig.weekdayAcademicCapacityMinutes).toBe(90); // input not mutated
  });

  it("base + mode + active temporary: 90 + 45 + 15 = 150 (the handoff's worked example)", () => {
    const e = resolveEffectiveConfig(cfg({ mode: "midterm", temporaryOverrides: [temp(15, future(3))] }));
    expect(e.weekdayAcademicCapacityMinutes).toBe(150);
    expect(e.precedence.activeTemporaryOverrides).toHaveLength(1);
  });

  it("an EXPIRED temporary override drops out — effective falls back to mode+base", () => {
    const e = resolveEffectiveConfig(cfg({ mode: "midterm", temporaryOverrides: [temp(15, future(-1))] }));
    expect(e.weekdayAcademicCapacityMinutes).toBe(135);
    expect(e.precedence.temporaryDelta).toBe(0);
  });

  it("clearing the temporary override restores the mode/base-derived value", () => {
    const withTemp = cfg({ mode: "recovery", temporaryOverrides: [temp(20, future(2))] });
    expect(resolveEffectiveConfig(withTemp).weekdayAcademicCapacityMinutes).toBe(90 - 30 + 20); // 80
    const cleared = { ...withTemp, temporaryOverrides: [] };
    expect(resolveEffectiveConfig(cleared).weekdayAcademicCapacityMinutes).toBe(60); // recovery only
  });

  it("modeDeltaFor is a pure lookup", () => {
    expect(modeDeltaFor("normal")).toBe(0);
    expect(modeDeltaFor("midterm")).toBe(45);
    expect(modeDeltaFor("final")).toBe(90);
    expect(modeDeltaFor("recovery")).toBe(-30);
  });
});
