import { describe, it, expect } from "vitest";
import { deriveReadiness, buildPrescription } from "./engine";
import type { PlannedSession, RecoveryCheckIn } from "./types";

describe("deriveReadiness — honesty about thin data (Master Handoff §15)", () => {
  it("returns insufficient-data with 0 check-ins, never a fabricated score", () => {
    const result = deriveReadiness([]);
    expect(result.state).toBe("insufficient-data");
    expect(result.score).toBeNull();
  });

  it("returns insufficient-data with only 2 check-ins (below the minimum of 3)", () => {
    const checkIns: RecoveryCheckIn[] = [
      { id: "c1", date: "2026-08-25", sleepHours: 8, soreness: "none", energy: "high", motivation: "high", stressLevel: "low" },
      { id: "c2", date: "2026-08-26", sleepHours: 8, soreness: "none", energy: "high", motivation: "high", stressLevel: "low" },
    ];
    const result = deriveReadiness(checkIns);
    expect(result.state).toBe("insufficient-data");
    expect(result.score).toBeNull();
  });

  it("recommends push with strong recovery indicators across enough check-ins", () => {
    const good = { sleepHours: 8, soreness: "none" as const, energy: "high" as const, motivation: "high" as const, stressLevel: "low" as const };
    const checkIns: RecoveryCheckIn[] = [
      { id: "c1", date: "2026-08-24", ...good },
      { id: "c2", date: "2026-08-25", ...good },
      { id: "c3", date: "2026-08-26", ...good },
    ];
    const result = deriveReadiness(checkIns);
    expect(result.state).toBe("push");
    expect(result.score).not.toBeNull();
    expect(result.score as number).toBeGreaterThanOrEqual(80);
  });

  it("recommends recovery when soreness is high and sleep is poor across enough check-ins", () => {
    const bad = { sleepHours: 5, soreness: "high" as const, energy: "low" as const, motivation: "low" as const, stressLevel: "high" as const };
    const checkIns: RecoveryCheckIn[] = [
      { id: "c1", date: "2026-08-24", ...bad },
      { id: "c2", date: "2026-08-25", ...bad },
      { id: "c3", date: "2026-08-26", ...bad },
    ];
    const result = deriveReadiness(checkIns);
    expect(result.state).toBe("recovery");
    expect(result.score as number).toBeLessThan(30);
  });

  it("only considers the most recent 7 check-ins, not the full history", () => {
    const bad = { sleepHours: 5, soreness: "high" as const, energy: "low" as const, motivation: "low" as const, stressLevel: "high" as const };
    const good = { sleepHours: 8, soreness: "none" as const, energy: "high" as const, motivation: "high" as const, stressLevel: "low" as const };
    // 10 old bad check-ins, then 7 recent good ones — result should reflect the recent good ones.
    const oldBad: RecoveryCheckIn[] = Array.from({ length: 10 }, (_, i) => ({
      id: `old-${i}`,
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      ...bad,
    }));
    const recentGood: RecoveryCheckIn[] = Array.from({ length: 7 }, (_, i) => ({
      id: `new-${i}`,
      date: `2026-08-${String(i + 1).padStart(2, "0")}`,
      ...good,
    }));
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
