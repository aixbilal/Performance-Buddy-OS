import { describe, it, expect } from "vitest";
import { deriveReadiness, buildPrescription } from "./engine";
import type { Level3, PlannedSession, RecoveryCheckIn, SorenessLevel } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
type CiSub = { sleepHours: number; soreness: SorenessLevel; energy: Level3; motivation: Level3; stressLevel: Level3 };
const ci = (id: string, date: string, sub: CiSub): RecoveryCheckIn => ({ id, date, ...sub, createdAt: TS, updatedAt: TS });

describe("deriveReadiness — honesty about thin data (Master Handoff §15)", () => {
  it("returns insufficient-data with 0 check-ins, never a fabricated score", () => {
    const result = deriveReadiness([]);
    expect(result.state).toBe("insufficient-data");
    expect(result.score).toBeNull();
  });

  it("returns insufficient-data with only 2 check-ins (below the minimum of 3)", () => {
    const g: CiSub = { sleepHours: 8, soreness: "none", energy: "high", motivation: "high", stressLevel: "low" };
    const checkIns = [ci("c1", "2026-08-25", g), ci("c2", "2026-08-26", g)];
    const result = deriveReadiness(checkIns);
    expect(result.state).toBe("insufficient-data");
    expect(result.score).toBeNull();
  });

  it("recommends push with strong recovery indicators across enough check-ins", () => {
    const good: CiSub = { sleepHours: 8, soreness: "none", energy: "high", motivation: "high", stressLevel: "low" };
    const checkIns = [ci("c1", "2026-08-24", good), ci("c2", "2026-08-25", good), ci("c3", "2026-08-26", good)];
    const result = deriveReadiness(checkIns);
    expect(result.state).toBe("push");
    expect(result.score).not.toBeNull();
    expect(result.score as number).toBeGreaterThanOrEqual(80);
  });

  it("recommends recovery when soreness is high and sleep is poor across enough check-ins", () => {
    const bad: CiSub = { sleepHours: 5, soreness: "high", energy: "low", motivation: "low", stressLevel: "high" };
    const checkIns = [ci("c1", "2026-08-24", bad), ci("c2", "2026-08-25", bad), ci("c3", "2026-08-26", bad)];
    const result = deriveReadiness(checkIns);
    expect(result.state).toBe("recovery");
    expect(result.score as number).toBeLessThan(30);
  });

  it("only considers the most recent 7 check-ins, not the full history", () => {
    const bad: CiSub = { sleepHours: 5, soreness: "high", energy: "low", motivation: "low", stressLevel: "high" };
    const good: CiSub = { sleepHours: 8, soreness: "none", energy: "high", motivation: "high", stressLevel: "low" };
    const oldBad = Array.from({ length: 10 }, (_, i) => ci(`old-${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`, bad));
    const recentGood = Array.from({ length: 7 }, (_, i) => ci(`new-${i}`, `2026-08-${String(i + 1).padStart(2, "0")}`, good));
    const result = deriveReadiness([...oldBad, ...recentGood]);
    expect(result.state).toBe("push");
  });
});

describe("buildPrescription — Base Plan is never mutated (Master Handoff §15)", () => {
  const basePlan: PlannedSession = {
    id: "session-1",
    planId: "plan-1",
    dayOfWeek: 2,
    title: "Easy Run",
    exercises: [{ name: "Run", sets: 1, reps: "3.5 km" }],
    createdAt: TS,
    updatedAt: TS,
  };

  it("returns the base exercises unmodified when no override is given", () => {
    const prescription = buildPrescription(basePlan, "2026-08-27");
    expect(prescription.exercises).toEqual(basePlan.exercises);
    expect(prescription.modified).toBe(false);
  });

  it("builds a modified prescription without touching the original base plan object", () => {
    const originalExercisesSnapshot = JSON.stringify(basePlan.exercises);
    const prescription = buildPrescription(
      basePlan,
      "2026-08-27",
      [{ name: "Run", sets: 1, reps: "2.5 km easy" }],
      "Recovery state: reduced-load"
    );
    expect(prescription.exercises).toEqual([{ name: "Run", sets: 1, reps: "2.5 km easy" }]);
    expect(prescription.modified).toBe(true);
    expect(prescription.modificationReason).toBe("Recovery state: reduced-load");
    // The base plan itself must be byte-for-byte unchanged after building a modified prescription.
    expect(JSON.stringify(basePlan.exercises)).toBe(originalExercisesSnapshot);
  });
});
