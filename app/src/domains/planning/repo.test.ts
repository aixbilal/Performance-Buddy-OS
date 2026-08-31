// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makePlanningRepo } from "./repo";
import { DEFAULT_CAPACITY, type PlanningBlock } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
const block = (id: string, over: Partial<PlanningBlock> = {}): PlanningBlock => ({
  id,
  title: `Block ${id}`,
  domain: "Academics",
  actionId: null,
  day: 2,
  date: null,
  startMinute: 600,
  endMinute: 660,
  type: "flexible",
  locked: false,
  source: "manual",
  status: "scheduled",
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

beforeEach(() => window.localStorage.clear());

describe("makePlanningRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makePlanningRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — no seed, CRUD, persistence", () => {
  it("a fresh profile has zero blocks and the default capacity", async () => {
    const g = await new LocalRepo().load();
    expect(g.blocks).toEqual([]);
    expect(g.capacity).toEqual(DEFAULT_CAPACITY);
  });

  it("round-trips a block and survives a fresh instance (persistence)", async () => {
    const repo = new LocalRepo();
    await repo.blockUpsert(block("b1", { actionId: "act-1" }));
    const g = await new LocalRepo().load();
    expect(g.blocks).toHaveLength(1);
    expect(g.blocks[0].actionId).toBe("act-1");
  });

  it("preserves createdAt on update", async () => {
    const repo = new LocalRepo();
    await repo.blockUpsert(block("b1"));
    await repo.blockUpsert(block("b1", { title: "Renamed", createdAt: "2099-01-01" }));
    const g = await repo.load();
    expect(g.blocks[0].title).toBe("Renamed");
    expect(g.blocks[0].createdAt).toBe(TS);
  });

  it("deletes a block", async () => {
    const repo = new LocalRepo();
    await repo.blockUpsert(block("b1"));
    await repo.blockDelete("b1");
    expect((await repo.load()).blocks).toHaveLength(0);
  });

  it("persists a capacity change", async () => {
    const repo = new LocalRepo();
    await repo.capacitySet({ dailyCapacityMinutes: 180, weeklyCapacityMinutes: 900 });
    expect((await new LocalRepo().load()).capacity.dailyCapacityMinutes).toBe(180);
  });

  it("importGraph is idempotent and never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importGraph({
      blocks: [block("b1"), block("b2")],
      capacity: DEFAULT_CAPACITY,
    });
    expect(r1.ran).toBe(true);
    expect(r1.blocksImported).toBe(2);

    await repo.blockUpsert(block("b1", { title: "EDITED" }));
    const r2 = await repo.importGraph({ blocks: [block("b1")], capacity: DEFAULT_CAPACITY });
    expect(r2.ran).toBe(false);
    expect((await repo.load()).blocks.find((b) => b.id === "b1")!.title).toBe("EDITED");
  });
});
