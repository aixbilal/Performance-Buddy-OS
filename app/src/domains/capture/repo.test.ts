// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeCaptureRepo } from "./repo";
import type { CaptureInboxItem } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
const item = (id: string, over: Partial<CaptureInboxItem> = {}): CaptureInboxItem => ({
  id,
  rawText: "Spent Rs 450 on lunch",
  status: "proposed",
  proposal: { type: "expense", confidence: "high", fields: { amount: 450, description: "lunch" } },
  resolution: null,
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

beforeEach(() => window.localStorage.clear());

describe("makeCaptureRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeCaptureRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — durable inbox", () => {
  it("a fresh profile has an empty inbox", async () => {
    expect(await new LocalRepo().load()).toEqual([]);
  });

  it("a raw capture persists and reloads across a fresh instance", async () => {
    const repo = new LocalRepo();
    await repo.upsert(item("c1"));
    const reloaded = await new LocalRepo().load();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].rawText).toBe("Spent Rs 450 on lunch");
    expect(reloaded[0].proposal?.type).toBe("expense");
    expect(reloaded[0].proposal?.fields.amount).toBe(450);
  });

  it("classify/update by id changes the row without creating a duplicate", async () => {
    const repo = new LocalRepo();
    await repo.upsert(item("c1", { status: "unprocessed" }));
    await repo.upsert(
      item("c1", {
        status: "resolved",
        resolution: { kind: "confirmed", target: "expense", entityId: "tx_1" },
        createdAt: "2099-01-01",
      }),
    );
    const rows = await repo.load();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("resolved");
    expect(rows[0].resolution).toEqual({ kind: "confirmed", target: "expense", entityId: "tx_1" });
    expect(rows[0].createdAt).toBe(TS); // preserved
  });

  it("deletes a row", async () => {
    const repo = new LocalRepo();
    await repo.upsert(item("c1"));
    await repo.remove("c1");
    expect(await repo.load()).toHaveLength(0);
  });

  it("import is idempotent", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importItems([item("c1"), item("c2")]);
    expect(r1.ran).toBe(true);
    expect(r1.itemsImported).toBe(2);
    const r2 = await repo.importItems([item("c3")]);
    expect(r2.ran).toBe(false);
    expect((await repo.load()).some((i) => i.id === "c3")).toBe(false);
  });
});
