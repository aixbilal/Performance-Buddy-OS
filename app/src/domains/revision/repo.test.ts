// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeRevisionRepo } from "./repo";
import type { RevisionEvent } from "./types";

const ev = (id: string, over: Partial<RevisionEvent> = {}): RevisionEvent => ({
  id,
  domain: "performance",
  entityType: "action",
  entityId: "a1",
  operation: "create",
  source: "user",
  summary: `event ${id}`,
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => window.localStorage.clear());

describe("makeRevisionRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeRevisionRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — append-only revision log", () => {
  it("a fresh profile has no revision events", async () => {
    expect(await new LocalRepo().load()).toEqual([]);
  });

  it("appended events persist and reload newest-first", async () => {
    const repo = new LocalRepo();
    await repo.append(ev("r1", { createdAt: "2026-01-01T00:00:00.000Z" }));
    await repo.append(ev("r2", { createdAt: "2026-01-02T00:00:00.000Z", operation: "status-change" }));
    const rows = await new LocalRepo().load();
    expect(rows.map((r) => r.id)).toEqual(["r2", "r1"]);
  });

  it("append is idempotent on id and never overwrites the first write", async () => {
    const repo = new LocalRepo();
    expect(await repo.append(ev("r1", { summary: "original" }))).toBe(true);
    expect(await repo.append(ev("r1", { summary: "tampered", createdAt: "2099-01-01" }))).toBe(false);
    const rows = await repo.load();
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe("original");
    expect(rows[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("has no update-one or delete-one method on the interface", () => {
    const repo = new LocalRepo() as unknown as Record<string, unknown>;
    expect(repo.update).toBeUndefined();
    expect(repo.remove).toBeUndefined();
    expect(repo.delete).toBeUndefined();
  });

  it("filters by domain / entityType / entityId and respects limit", async () => {
    const repo = new LocalRepo();
    await repo.append(ev("r1", { domain: "performance", entityId: "a1", createdAt: "2026-01-01T00:00:00.000Z" }));
    await repo.append(ev("r2", { domain: "performance", entityId: "a2", createdAt: "2026-01-02T00:00:00.000Z" }));
    await repo.append(ev("r3", { domain: "money", entityType: "transaction", entityId: "t1", createdAt: "2026-01-03T00:00:00.000Z" }));

    expect((await repo.load({ domain: "performance" })).map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    expect((await repo.load({ domain: "performance", entityType: "action", entityId: "a1" })).map((r) => r.id)).toEqual(["r1"]);
    expect(await repo.load({ limit: 1 })).toHaveLength(1);
    expect((await repo.load({ limit: 1 }))[0].id).toBe("r3");
  });

  it("stores only a small targeted metadata blob — never a full entity snapshot", async () => {
    const repo = new LocalRepo();
    await repo.append(
      ev("r1", {
        operation: "status-change",
        summary: 'Action "Read ch.3" todo → done',
        metadata: { before: "todo", after: "done" },
      }),
    );
    const [e] = await repo.load();
    // A revision event is a LOG line, not event-sourcing: metadata is a couple
    // of scalars, not a serialized entity.
    expect(Object.keys(e.metadata)).toEqual(["before", "after"]);
    expect(JSON.stringify(e.metadata).length).toBeLessThan(120);
  });

  it("keeps a corrupt metadata blob from losing the event", async () => {
    window.localStorage.setItem(
      "pbos:revision-events",
      JSON.stringify([{ id: "r1", domain: "performance", entityType: "action", entityId: "a1", operation: "create", source: "user", summary: "s", metadata: "{not json", createdAt: "2026-01-01T00:00:00.000Z" }]),
    );
    const rows = await new LocalRepo().load();
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toEqual({});
  });
});
