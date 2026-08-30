import { describe, it, expect } from "vitest";
import { resolveLegacyPerformance } from "./legacyImport";
import { LEGACY_KV } from "./mockData";

describe("resolveLegacyPerformance — Batch 0 KV → canonical graph", () => {
  const result = resolveLegacyPerformance({
    goals: LEGACY_KV["pbos:performance-goals"],
    systems: LEGACY_KV["pbos:performance-systems"],
    actions: LEGACY_KV["pbos:performance-actions"],
  });

  it("preserves existing IDs", () => {
    expect(result.graph.goals.map((g) => g.id).sort()).toEqual(["goal-run5k", "goal-sgpa"]);
    expect(result.graph.systems.map((s) => s.id)).toEqual(["sys-weekly-study"]);
    expect(result.graph.actions.map((a) => a.id).sort()).toEqual(["act-1", "act-2", "act-orphan"]);
  });

  it("maps legacy status → lifecycle and legacy priority → action priority", () => {
    const sgpa = result.graph.goals.find((g) => g.id === "goal-sgpa")!;
    expect(sgpa.lifecycle).toBe("active"); // "on-track"
    const run = result.graph.goals.find((g) => g.id === "goal-run5k")!;
    expect(run.lifecycle).toBe("active"); // "needs-focus" is an attention signal, not a lifecycle
    const a1 = result.graph.actions.find((a) => a.id === "act-1")!;
    expect(a1.status).toBe("in-progress");
    expect(a1.priority).toBe("high");
    const a2 = result.graph.actions.find((a) => a.id === "act-2")!;
    expect(a2.status).toBe("todo"); // "not-started"
  });

  it("keeps a well-formed legacy metric, drops fabricated consistency/streak numbers", () => {
    const sgpa = result.graph.goals.find((g) => g.id === "goal-sgpa")!;
    expect(sgpa.metric).toEqual({ current: 3.35, target: 3.7, unit: "SGPA" });
    expect(sgpa).not.toHaveProperty("consistency7d");
    expect(JSON.stringify(sgpa)).not.toMatch(/streak/i);
  });

  it("resolves the duelling goal↔system relationship into ONE link list (union, deduped)", () => {
    // legacy: Goal.systemIds = ["sys-weekly-study"] AND System.goalId = "goal-sgpa"
    expect(result.graph.links).toEqual([{ goalId: "goal-sgpa", systemId: "sys-weekly-study" }]);
  });

  it("Action.systemId wins over a disagreeing System.actionIds, and reports the repair", () => {
    // System.actionIds listed "act-ghost" (no such action) — reported, not imported.
    expect(result.report.repairs.join(" ")).toMatch(/act-ghost/);
  });

  it("an action pointing at a missing system becomes a direct commitment (+ reported)", () => {
    const orphan = result.graph.actions.find((a) => a.id === "act-orphan")!;
    expect(orphan.systemId).toBeNull();
    expect(result.report.repairs.join(" ")).toMatch(/act-orphan/);
  });

  it("per-system action positions are 0-based and follow legacy order", () => {
    const inSystem = result.graph.actions
      .filter((a) => a.systemId === "sys-weekly-study")
      .sort((a, b) => a.position - b.position);
    expect(inSystem.map((a) => a.id)).toEqual(["act-1", "act-2"]);
    expect(inSystem.map((a) => a.position)).toEqual([0, 1]);
  });

  it("reports malformed blobs instead of throwing", () => {
    const r = resolveLegacyPerformance({ goals: "{not json", systems: null, actions: "[]" });
    expect(r.report.malformed).toContain("pbos:performance-goals");
    expect(r.graph.goals).toEqual([]);
  });

  it("empty input yields an empty graph (fresh profile)", () => {
    const r = resolveLegacyPerformance({ goals: null, systems: null, actions: null });
    expect(r.graph).toEqual({ goals: [], systems: [], actions: [], links: [] });
  });
});
