// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }));

import { invoke, isTauri } from "@tauri-apps/api/core";
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

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(isTauri).mockReturnValue(false);
  vi.mocked(invoke).mockReset();
});

describe("makePlanningRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makePlanningRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("SqliteRepo — the Tauri wire contract (RC1 release-blocker regression)", () => {
  /**
   * A stateful stand-in for Rust + SQLite. It enforces the SAME field
   * contract as `PlanningBlockRow` in `src-tauri/src/planning.rs`: every key
   * must be present with the canonical frontend names (`day`, `type`, …). A
   * missing key is exactly the serde "missing field" error that made
   * `plan_block_upsert` a no-op in RC1, so a block silently never reached
   * SQLite and was gone on the next launch. The `store` closure persists
   * across repo instances — that models the SQLite file surviving a relaunch.
   */
  function installFakeSqlite() {
    const store = new Map<string, Record<string, unknown>>();
    let capacity = { dailyMinutes: 150, weeklyMinutes: 840 };
    const REQUIRED = [
      "id", "title", "domain", "actionId", "day", "date", "startMinute",
      "endMinute", "type", "locked", "source", "status", "createdAt", "updatedAt",
    ];
    vi.mocked(invoke).mockImplementation((async (cmd: string, rawArgs?: unknown) => {
      const args = (rawArgs ?? {}) as Record<string, unknown>;
      switch (cmd) {
        case "plan_block_upsert": {
          const b = args.block as Record<string, unknown>;
          for (const k of REQUIRED) {
            if (!(k in b)) throw new Error(`invalid args: missing field \`${k}\``);
          }
          const prev = store.get(b.id as string);
          store.set(b.id as string, { ...b, createdAt: prev?.createdAt ?? b.createdAt });
          return undefined;
        }
        case "plan_block_delete":
          store.delete(args.id as string);
          return undefined;
        case "plan_capacity_set":
          capacity = args.capacity as typeof capacity;
          return undefined;
        case "plan_import_graph":
          return { ran: false, blocksImported: 0, actionLinksCleared: 0, capacityImported: false };
        case "plan_load":
          return { blocks: [...store.values()], capacity };
        default:
          throw new Error(`unexpected command ${cmd}`);
      }
    }) as typeof invoke);
    return store;
  }

  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(true);
    installFakeSqlite();
  });

  it("makePlanningRepo picks the sqlite repo under Tauri", () => {
    expect(makePlanningRepo().kind).toBe("sqlite");
  });

  it("a created block survives a fresh repo instance (models native relaunch)", async () => {
    await makePlanningRepo().blockUpsert(block("b1", { day: 3, type: "fixed" }));

    const g = await makePlanningRepo().load();
    expect(g.blocks).toHaveLength(1);
    expect(g.blocks[0].id).toBe("b1");
    expect(g.blocks[0].day).toBe(3);
    expect(g.blocks[0].type).toBe("fixed");
  });

  it("a locked block stays locked across a fresh repo instance", async () => {
    const repo = makePlanningRepo();
    await repo.blockUpsert(block("b1"));
    await repo.blockUpsert({ ...block("b1"), locked: true });

    const g = await makePlanningRepo().load();
    expect(g.blocks[0].locked).toBe(true);
    expect(g.blocks[0].source).toBe("manual");
  });

  it("blockUpsert sends every field the Rust wire struct requires", async () => {
    await makePlanningRepo().blockUpsert(block("b1"));
    const [, args] = vi.mocked(invoke).mock.calls.find(([c]) => c === "plan_block_upsert")!;
    const sent = (args as { block: Record<string, unknown> }).block;
    for (const k of ["id", "title", "domain", "actionId", "day", "date", "startMinute", "endMinute", "type", "locked", "source", "status", "createdAt", "updatedAt"]) {
      expect(sent, `payload is missing \`${k}\``).toHaveProperty(k);
    }
    // The bug shape: never send the Rust column names instead of the model names.
    expect(sent).not.toHaveProperty("dayOfWeek");
    expect(sent).not.toHaveProperty("blockType");
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
