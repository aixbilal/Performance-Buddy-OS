// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makePerformanceRepo } from "./repo";
import type { Action, Goal, PerfGraph, System } from "./types";

const goal = (id: string): Goal => ({
  id, title: `Goal ${id}`, type: "outcome", domain: "academic", lifecycle: "active",
  priority: "normal", deadline: null, metric: null, detail: "", createdBy: "user",
  createdAt: "2026-01-01", updatedAt: "2026-01-01",
});
const system = (id: string): System => ({
  id, title: `System ${id}`, description: "", domain: "academic", cadence: "", tags: [],
  starred: false, createdAt: "2026-01-01", updatedAt: "2026-01-01",
});
const action = (id: string, systemId: string | null, position = 0): Action => ({
  id, systemId, title: `Action ${id}`, context: "", status: "todo", estMinutes: null,
  priority: "normal", timing: "", position, createdAt: "2026-01-01", updatedAt: "2026-01-01",
});

beforeEach(() => window.localStorage.clear());

describe("makePerformanceRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makePerformanceRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — CRUD + relationship integrity + restart persistence", () => {
  it("round-trips goals/systems/actions/links and survives a fresh repo instance", async () => {
    const repo = new LocalRepo();
    await repo.goalUpsert(goal("g1"));
    await repo.systemUpsert(system("s1"));
    await repo.actionUpsert(action("a1", "s1"));
    await repo.linkSet("g1", "s1", true);

    // a NEW instance reads the same store (== "survives restart" for the dev fallback)
    const g = await new LocalRepo().load();
    expect(g.goals).toHaveLength(1);
    expect(g.links).toEqual([{ goalId: "g1", systemId: "s1" }]);
  });

  it("preserves createdAt on update (upsert-by-id)", async () => {
    const repo = new LocalRepo();
    await repo.goalUpsert(goal("g1"));
    await repo.goalUpsert({ ...goal("g1"), title: "renamed", createdAt: "2099-01-01" });
    const g = await repo.load();
    expect(g.goals[0].title).toBe("renamed");
    expect(g.goals[0].createdAt).toBe("2026-01-01");
  });

  it("deleting a system CASCADEs its links and orphans its actions (direct commitments)", async () => {
    const repo = new LocalRepo();
    await repo.goalUpsert(goal("g1"));
    await repo.systemUpsert(system("s1"));
    await repo.actionUpsert(action("a1", "s1"));
    await repo.linkSet("g1", "s1", true);

    await repo.systemDelete("s1");
    const g = await repo.load();
    expect(g.systems).toHaveLength(0);
    expect(g.links).toHaveLength(0);
    expect(g.actions[0].systemId).toBeNull();
  });

  it("refuses a link to a non-existent goal or system (one relationship truth)", async () => {
    const repo = new LocalRepo();
    await repo.goalUpsert(goal("g1"));
    await repo.linkSet("g1", "ghost", true);
    expect((await repo.load()).links).toHaveLength(0);
  });

  it("reorder rewrites per-system positions only", async () => {
    const repo = new LocalRepo();
    await repo.systemUpsert(system("s1"));
    await repo.actionUpsert(action("a1", "s1", 0));
    await repo.actionUpsert(action("a2", "s1", 1));
    await repo.actionsReorder("s1", ["a2", "a1"]);
    const g = await repo.load();
    expect(g.actions.find((a) => a.id === "a2")!.position).toBe(0);
    expect(g.actions.find((a) => a.id === "a1")!.position).toBe(1);
  });

  it("importGraph is idempotent and never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const graph: PerfGraph = {
      goals: [goal("g1")],
      systems: [system("s1")],
      actions: [action("a1", "s1")],
      links: [{ goalId: "g1", systemId: "s1" }],
    };
    const r1 = await repo.importGraph(graph);
    expect(r1.ran).toBe(true);
    expect(r1.goalsImported).toBe(1);

    // mutate, then re-import: marker => no-op, newer data survives
    await repo.goalUpsert({ ...goal("g1"), title: "EDITED" });
    const r2 = await repo.importGraph(graph);
    expect(r2.ran).toBe(false);
    expect((await repo.load()).goals[0].title).toBe("EDITED");
  });
});
