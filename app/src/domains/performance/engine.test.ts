import { describe, it, expect } from "vitest";
import {
  actionsForSystem,
  canTransitionGoal,
  deriveGoalAttention,
  deriveGoalProgress,
  deriveSystemHealth,
  goalTransitionsFrom,
  goalsForSystem,
  nextActionForSystem,
  normalizeActionStatus,
  systemsForGoal,
  validateActionInput,
  validateGoalInput,
  validateSystemInput,
} from "./engine";
import type { Action, Goal, GoalInput, GoalSystemLink, System } from "./types";

const goalInput = (o: Partial<GoalInput> = {}): GoalInput => ({
  title: "Reach 3.7 SGPA",
  type: "outcome",
  domain: "academic",
  priority: "normal",
  deadline: null,
  metric: null,
  detail: "",
  ...o,
});

describe("validateGoalInput", () => {
  it("accepts a well-formed goal and trims the title", () => {
    const r = validateGoalInput(goalInput({ title: "  Reach   3.7  SGPA " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.title).toBe("Reach 3.7 SGPA");
  });

  it("rejects an empty title", () => {
    const r = validateGoalInput(goalInput({ title: "   " }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.title).toBeTruthy();
  });

  it("rejects an invalid domain / type / priority", () => {
    const r = validateGoalInput(goalInput({ domain: "x" as never, type: "y" as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.domain).toBeTruthy();
      expect(r.errors.type).toBeTruthy();
    }
  });

  it("rejects a metric with a zero target (Unknown ≠ Zero — leave it blank instead)", () => {
    const r = validateGoalInput(goalInput({ metric: { current: 0, target: 0, unit: "%" } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.metricTarget).toMatch(/zero/i);
  });

  it("accepts a valid metric and normalizes the unit", () => {
    const r = validateGoalInput(goalInput({ metric: { current: 3.3, target: 3.7, unit: " SGPA " } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.metric).toEqual({ current: 3.3, target: 3.7, unit: "SGPA" });
  });

  it("rejects a malformed deadline", () => {
    const r = validateGoalInput(goalInput({ deadline: "31/12/2026" }));
    expect(r.ok).toBe(false);
  });
});

describe("validateSystemInput / validateActionInput", () => {
  it("system needs a title and a real domain", () => {
    expect(validateSystemInput({ title: "", description: "", domain: "academic", cadence: "", tags: [] }).ok).toBe(false);
    const ok = validateSystemInput({ title: "Weekly Study", description: "", domain: "academic", cadence: "", tags: ["a", " "] });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.tags).toEqual(["a"]);
  });

  it("action estimate must be a positive integer when given", () => {
    const bad = validateActionInput({ title: "x", context: "", status: "todo", estMinutes: -5, priority: "normal", timing: "" });
    expect(bad.ok).toBe(false);
    const ok = validateActionInput({ title: "x", context: "", status: "todo", estMinutes: null, priority: "normal", timing: "" });
    expect(ok.ok).toBe(true);
  });
});

describe("goal lifecycle transitions (docs 11.09)", () => {
  it("allows active → paused and paused → active, rejects achieved → paused", () => {
    expect(canTransitionGoal("active", "paused")).toBe(true);
    expect(canTransitionGoal("paused", "active")).toBe(true);
    expect(canTransitionGoal("achieved", "paused")).toBe(false);
  });
  it("a cancelled goal has no onward transitions", () => {
    expect(goalTransitionsFrom("cancelled")).toEqual([]);
  });
});

describe("relationship resolution — one source of truth", () => {
  const systems: System[] = [
    { id: "s1", title: "S1", description: "", domain: "academic", cadence: "", tags: [], starred: false, createdAt: "1", updatedAt: "1" },
    { id: "s2", title: "S2", description: "", domain: "fitness", cadence: "", tags: [], starred: false, createdAt: "1", updatedAt: "1" },
  ];
  const goals: Goal[] = [
    { id: "g1", title: "G1", type: "outcome", domain: "academic", lifecycle: "active", priority: "normal", deadline: null, metric: null, detail: "", createdBy: "user", createdAt: "1", updatedAt: "1" },
  ];
  const links: GoalSystemLink[] = [
    { goalId: "g1", systemId: "s1" },
    { goalId: "g1", systemId: "s2" },
  ];

  it("systemsForGoal / goalsForSystem read only from the link list", () => {
    expect(systemsForGoal("g1", links, systems).map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(goalsForSystem("s2", links, goals).map((g) => g.id)).toEqual(["g1"]);
    expect(systemsForGoal("gX", links, systems)).toEqual([]);
  });

  it("actionsForSystem uses Action.systemId (the FK) and sorts by position", () => {
    const actions: Action[] = [
      { id: "a2", systemId: "s1", title: "A2", context: "", status: "todo", estMinutes: null, priority: "normal", timing: "", position: 1, createdAt: "1", updatedAt: "1" },
      { id: "a1", systemId: "s1", title: "A1", context: "", status: "todo", estMinutes: null, priority: "normal", timing: "", position: 0, createdAt: "1", updatedAt: "1" },
      { id: "a3", systemId: null, title: "direct", context: "", status: "todo", estMinutes: null, priority: "normal", timing: "", position: 0, createdAt: "1", updatedAt: "1" },
    ];
    expect(actionsForSystem("s1", actions).map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(nextActionForSystem("s1", actions)?.id).toBe("a1");
  });
});

describe("derived state — Unknown ≠ Zero", () => {
  const mk = (status: Action["status"]): Action => ({
    id: crypto.randomUUID(),
    systemId: "s1",
    title: "a",
    context: "",
    status,
    estMinutes: null,
    priority: "normal",
    timing: "",
    position: 0,
    createdAt: "1",
    updatedAt: "1",
  });

  it("a system with no actions is insufficient-data, ratio null — NOT 0%", () => {
    const h = deriveSystemHealth([]);
    expect(h.state).toBe("insufficient-data");
    expect(h.ratio).toBeNull();
  });

  it("health is the done-ratio of non-cancelled actions", () => {
    const h = deriveSystemHealth([mk("done"), mk("done"), mk("todo"), mk("cancelled")]);
    expect(h.ratio).toBeCloseTo(2 / 3);
    expect(h.state).toBe("drifting");
    expect(h.sampleSize).toBe(3);
  });

  it("goal progress with no metric is kind 'none', never 0%", () => {
    const g: Goal = { id: "g", title: "g", type: "directional", domain: "life", lifecycle: "active", priority: "normal", deadline: null, metric: null, detail: "", createdBy: "user", createdAt: "1", updatedAt: "1" };
    expect(deriveGoalProgress(g)).toEqual({ kind: "none" });
  });

  it("goal progress with a metric is a clamped percent", () => {
    const g: Goal = { id: "g", title: "g", type: "outcome", domain: "life", lifecycle: "active", priority: "normal", deadline: null, metric: { current: 5, target: 4, unit: "x" }, detail: "", createdBy: "user", createdAt: "1", updatedAt: "1" };
    const p = deriveGoalProgress(g);
    expect(p).toEqual({ kind: "metric", percent: 100, current: 5, target: 4, unit: "x" });
  });

  it("goal attention is 'no-signal' with no systems and no metric — not a fake status", () => {
    const g: Goal = { id: "g", title: "g", type: "directional", domain: "life", lifecycle: "active", priority: "normal", deadline: null, metric: null, detail: "", createdBy: "user", createdAt: "1", updatedAt: "1" };
    expect(deriveGoalAttention(g, [], new Map(), "2026-01-01").state).toBe("no-signal");
  });

  it("goal attention flags a passed deadline", () => {
    const g: Goal = { id: "g", title: "g", type: "outcome", domain: "life", lifecycle: "active", priority: "normal", deadline: "2025-01-01", metric: { current: 1, target: 10, unit: "x" }, detail: "", createdBy: "user", createdAt: "1", updatedAt: "1" };
    const att = deriveGoalAttention(g, [], new Map(), "2026-01-01");
    expect(att.state).toBe("needs-attention");
    expect(att.reasons.join(" ")).toMatch(/deadline/i);
  });
});

describe("normalizeActionStatus", () => {
  it("maps the legacy vocabulary", () => {
    expect(normalizeActionStatus("not-started")).toBe("todo");
    expect(normalizeActionStatus("completed")).toBe("done");
    expect(normalizeActionStatus("in-progress")).toBe("in-progress");
    expect(normalizeActionStatus("garbage")).toBe("todo");
  });
});
