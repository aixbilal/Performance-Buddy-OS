// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeRoutineRepo } from "./repo";
import type { Routine, RoutineLog } from "./types";

const TS = "2026-01-01T00:00:00.000Z";

const routine = (id: string, over: Partial<Routine> = {}): Routine => ({
  id,
  title: `Routine ${id}`,
  category: "Care",
  timeWindow: "morning",
  scheduleType: "daily",
  scheduleDays: [],
  scheduleTarget: null,
  completionType: "boolean",
  targetQuantity: null,
  targetUnit: null,
  targetDurationMinutes: null,
  priority: "important",
  relatedSystemId: null,
  paused: false,
  archived: false,
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

const log = (id: string, routineId: string, date: string, state: RoutineLog["state"] = "complete"): RoutineLog => ({
  id,
  routineId,
  date,
  state,
  quantityCompleted: null,
  durationCompletedMinutes: null,
  completedAt: null,
  createdAt: TS,
  updatedAt: TS,
});

beforeEach(() => window.localStorage.clear());

describe("makeRoutineRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeRoutineRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — routine + log CRUD, cascade, persistence", () => {
  it("round-trips the graph and survives a fresh instance", async () => {
    const repo = new LocalRepo();
    await repo.routineUpsert(routine("r1", { scheduleType: "weekly-days", scheduleDays: [0, 2, 4] }));
    await repo.logUpsert(log("l1", "r1", "2026-08-30"));
    const g = await new LocalRepo().load();
    expect(g.routines).toHaveLength(1);
    expect(g.routines[0].scheduleDays).toEqual([0, 2, 4]);
    expect(g.logs).toHaveLength(1);
  });

  it("preserves createdAt on update", async () => {
    const repo = new LocalRepo();
    await repo.routineUpsert(routine("r1"));
    await repo.routineUpsert(routine("r1", { title: "Renamed", createdAt: "2099-01-01" }));
    const g = await repo.load();
    expect(g.routines[0].title).toBe("Renamed");
    expect(g.routines[0].createdAt).toBe(TS);
  });

  it("deleting a routine CASCADEs its logs", async () => {
    const repo = new LocalRepo();
    await repo.routineUpsert(routine("r1"));
    await repo.logUpsert(log("l1", "r1", "2026-08-30"));
    await repo.logUpsert(log("l2", "r1", "2026-08-29"));
    await repo.routineDelete("r1");
    const g = await repo.load();
    expect(g.routines).toHaveLength(0);
    expect(g.logs).toHaveLength(0);
  });

  it("refuses a log whose routine does not exist (FK)", async () => {
    const repo = new LocalRepo();
    await repo.logUpsert(log("l1", "ghost", "2026-08-30"));
    expect((await repo.load()).logs).toHaveLength(0);
  });

  it("log upsert by id updates the state without creating a duplicate", async () => {
    const repo = new LocalRepo();
    await repo.routineUpsert(routine("r1"));
    await repo.logUpsert(log("l1", "r1", "2026-08-30", "partial"));
    await repo.logUpsert({ ...log("l1", "r1", "2026-08-30", "complete"), createdAt: "2099-01-01" });
    const g = await repo.load();
    expect(g.logs).toHaveLength(1);
    expect(g.logs[0].state).toBe("complete");
    expect(g.logs[0].createdAt).toBe(TS);
  });

  it("importGraph is idempotent and never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importGraph({
      routines: [routine("r1"), routine("r2")],
      logs: [log("l1", "r1", "2026-08-30"), log("l-ghost", "no-routine", "2026-08-30")],
    });
    expect(r1.ran).toBe(true);
    expect(r1.routinesImported).toBe(2);
    expect(r1.logsImported).toBe(1); // dangling log dropped

    await repo.routineUpsert(routine("r1", { title: "EDITED" }));
    const r2 = await repo.importGraph({ routines: [routine("r1")], logs: [] });
    expect(r2.ran).toBe(false);
    expect((await repo.load()).routines.find((r) => r.id === "r1")!.title).toBe("EDITED");
  });
});
