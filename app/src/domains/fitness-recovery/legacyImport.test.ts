import { describe, it, expect } from "vitest";
import { resolveLegacyFitness } from "./legacyImport";

const LEGACY = {
  plan: JSON.stringify({
    id: "plan-1",
    title: "General Fitness",
    status: "active",
    currentWeek: 4,
    totalWeeks: 8,
    daysPerWeek: 5,
  }),
  sessions: JSON.stringify([
    {
      id: "s-mon",
      planId: "plan-1",
      dayOfWeek: 0,
      title: "Upper Body",
      exercises: [{ name: "Push-ups", sets: 4, reps: "15-20" }],
    },
    { id: "s-ghost", planId: "no-plan", dayOfWeek: 1, title: "Orphan", exercises: [] },
  ]),
  prescriptions: JSON.stringify([
    { id: "presc-1", plannedSessionId: "s-mon", date: "2026-08-27", exercises: [], modified: true },
  ]),
  checkins: JSON.stringify([
    { id: "ci-1", date: "2026-08-21", sleepHours: 7.5, soreness: "none", energy: "high", motivation: "high", stressLevel: "normal" },
    { id: "ci-1", date: "2026-08-22", sleepHours: 8, soreness: "mild", energy: "normal", motivation: "high", stressLevel: "normal" },
  ]),
};

describe("resolveLegacyFitness", () => {
  const { graph, report } = resolveLegacyFitness(LEGACY);

  it("imports the single legacy plan object (not an array) and preserves its ID", () => {
    expect(graph.plans.map((p) => p.id)).toEqual(["plan-1"]);
    expect(graph.plans[0].currentWeek).toBe(4);
  });

  it("drops planned sessions whose plan is missing, and reports it", () => {
    expect(graph.plannedSessions.map((s) => s.id)).toEqual(["s-mon"]);
    expect(report.repairs.join(" ")).toMatch(/s-ghost .* dropped/);
  });

  it("DROPS legacy prescriptions entirely — advisory only in V1, never persisted", () => {
    // there is no prescriptions field on the graph at all
    expect("prescriptions" in graph).toBe(false);
    expect(report.repairs.join(" ")).toMatch(/prescription\(s\) dropped/);
  });

  it("starts workout history empty — no fabricated actual sessions", () => {
    expect(graph.workoutSessions).toEqual([]);
  });

  it("skips a duplicate check-in id", () => {
    expect(graph.checkins.map((c) => c.date)).toEqual(["2026-08-21"]);
    expect(report.repairs.join(" ")).toMatch(/duplicate check-in id/);
  });

  it("reports malformed blobs instead of throwing", () => {
    const r = resolveLegacyFitness({ plan: "{bad", sessions: null, prescriptions: null, checkins: "[]" });
    expect(r.report.malformed).toContain("pbos:fitness-plan");
    expect(r.graph.plans).toEqual([]);
  });

  it("empty input yields an empty graph", () => {
    const r = resolveLegacyFitness({ plan: null, sessions: null, prescriptions: null, checkins: null });
    expect(r.graph).toEqual({ plans: [], plannedSessions: [], workoutSessions: [], checkins: [] });
  });
});
