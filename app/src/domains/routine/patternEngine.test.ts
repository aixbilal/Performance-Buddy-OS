import { describe, it, expect } from "vitest";
import {
  PATTERN_CONFIG,
  derivePatternCandidates,
  deriveOpportunities,
  type RoutineOpportunity,
} from "./patternEngine";
import type { CompletionState, Routine, RoutineLog } from "./types";

function routine(over: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    title: "Evening review",
    category: "Review",
    timeWindow: "evening",
    scheduleType: "daily",
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    scheduleTarget: null,
    completionType: "boolean",
    targetQuantity: null,
    targetUnit: null,
    targetDurationMinutes: null,
    priority: "important",
    relatedSystemId: null,
    paused: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function log(date: string, state: CompletionState): RoutineLog {
  return {
    id: `l_${date}`,
    routineId: "r1",
    date,
    state,
    quantityCompleted: null,
    durationCompletedMinutes: null,
    completedAt: state === "complete" ? `${date}T20:00:00.000Z` : null,
    createdAt: `${date}T20:00:00.000Z`,
    updatedAt: `${date}T20:00:00.000Z`,
  };
}

function opp(over: Partial<RoutineOpportunity> = {}): RoutineOpportunity {
  const state = over.state ?? "complete";
  return {
    iso: "2026-02-02",
    weekday: 0,
    state,
    completed: state === "complete" || state === "partial",
    partial: state === "partial",
    ...over,
  };
}

describe("deriveOpportunities", () => {
  it("excludes excused (rest/skipped) days and today; counts pending as a missed opportunity", () => {
    const logs = [
      log("2026-02-02", "complete"),
      log("2026-02-03", "rest"),
      log("2026-02-04", "skipped"),
      log("2026-02-05", "missed"),
    ];
    const opps = deriveOpportunities(routine(), logs, "2026-02-02", "2026-02-06");
    expect(opps.map((o) => o.iso)).toEqual(["2026-02-02", "2026-02-05"]); // rest/skipped dropped, 06 is "today"
    expect(opps.find((o) => o.iso === "2026-02-05")?.completed).toBe(false);
  });

  it("does not count days before the routine existed", () => {
    const r = routine({ createdAt: "2026-02-04T00:00:00.000Z" });
    const opps = deriveOpportunities(r, [], "2026-02-01", "2026-02-07");
    expect(opps.every((o) => o.iso >= "2026-02-04")).toBe(true);
  });
});

describe("derivePatternCandidates — evidence threshold", () => {
  it("returns nothing below MIN_OPPORTUNITIES comparable opportunities", () => {
    const opps = Array.from({ length: PATTERN_CONFIG.MIN_OPPORTUNITIES - 1 }, () =>
      opp({ state: "missed" }),
    );
    expect(derivePatternCandidates(routine(), opps)).toEqual([]);
  });

  it("flags an unrealistic cadence once there is enough evidence", () => {
    const opps = [
      ...Array.from({ length: 3 }, () => opp({ state: "complete" })),
      ...Array.from({ length: 7 }, () => opp({ state: "missed" })),
    ];
    const cands = derivePatternCandidates(routine({ scheduleType: "times-per-week", scheduleTarget: 7 }), opps);
    const cadence = cands.find((c) => c.kind === "cadence-too-aggressive");
    expect(cadence).toBeTruthy();
    expect(cadence!.suggestedMutation?.kind).toBe("adjust-routine-cadence");
    expect(Number(cadence!.suggestedMutation?.params.timesPerWeek)).toBeLessThan(7);
  });

  it("a weekday comparison needs >= MIN_PER_BUCKET in EACH bucket", () => {
    // Monday: 3 opportunities (below MIN_PER_BUCKET) all missed; rest fine.
    const opps = [
      ...Array.from({ length: 3 }, () => opp({ weekday: 0, state: "missed" })),
      ...Array.from({ length: 8 }, () => opp({ weekday: 2, state: "complete" })),
    ];
    const cands = derivePatternCandidates(routine(), opps);
    expect(cands.find((c) => c.kind === "weekday-underperformance")).toBeUndefined();
  });

  it("flags a weekday that clearly underperforms when both buckets qualify", () => {
    const opps = [
      ...Array.from({ length: 5 }, () => opp({ weekday: 0, state: "missed" })),
      ...Array.from({ length: 8 }, () => opp({ weekday: 2, state: "complete" })),
    ];
    const cands = derivePatternCandidates(
      routine({ scheduleType: "weekly-days", scheduleDays: [0, 2] }),
      opps,
    );
    const wd = cands.find((c) => c.kind === "weekday-underperformance");
    expect(wd).toBeTruthy();
    expect(wd!.suggestedMutation?.kind).toBe("adjust-routine-days");
    expect(wd!.suggestedMutation?.params.days).toEqual([2]);
  });

  it("flags a duration target that is repeatedly only partially met", () => {
    const r = routine({ completionType: "duration", targetDurationMinutes: 40 });
    const opps = [
      ...Array.from({ length: 6 }, () => opp({ state: "partial" })),
      ...Array.from({ length: 2 }, () => opp({ state: "complete" })),
    ];
    const cands = derivePatternCandidates(r, opps);
    const dur = cands.find((c) => c.kind === "duration-target-mismatch");
    expect(dur).toBeTruthy();
    expect(Number(dur!.suggestedMutation?.params.targetDurationMinutes)).toBeLessThan(40);
  });

  it("a healthy routine produces no structural candidates", () => {
    const opps = Array.from({ length: 20 }, (_, i) => opp({ weekday: i % 7, state: "complete" }));
    expect(derivePatternCandidates(routine(), opps)).toEqual([]);
  });

  it("rest and skipped are never treated as misses (they are excused upstream)", () => {
    // deriveOpportunities already drops them; a pattern built only from
    // completed + a few missed should still be evidence-gated correctly.
    const opps = Array.from({ length: 6 }, () => opp({ state: "complete" }));
    expect(derivePatternCandidates(routine(), opps)).toEqual([]);
  });
});
