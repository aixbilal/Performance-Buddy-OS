// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeKnowledgeRepo } from "./repo";
import type { Evidence, KnowledgeTopic, Source } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
const topic = (id: string): KnowledgeTopic => ({
  id,
  title: `Topic ${id}`,
  category: "academic",
  context: "Data Structures",
  lastStudied: null,
  nextReviewDate: null,
  relatedGoalId: null,
  createdAt: TS,
  updatedAt: TS,
});
const source = (id: string, topicId: string): Source => ({
  id,
  topicId,
  type: "article",
  title: `S ${id}`,
  reference: "path",
  addedDate: "2026-08-01",
  createdAt: TS,
  updatedAt: TS,
});
const evidence = (id: string, topicId: string, score = 8): Evidence => ({
  id,
  topicId,
  type: "recall",
  title: `E ${id}`,
  score,
  maxScore: 10,
  date: "2026-08-13",
  createdAt: TS,
  updatedAt: TS,
});

beforeEach(() => window.localStorage.clear());

describe("makeKnowledgeRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeKnowledgeRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — CRUD + relationship integrity + restart persistence", () => {
  it("round-trips topics/sources/evidence and survives a fresh instance", async () => {
    const repo = new LocalRepo();
    await repo.topicUpsert(topic("t1"));
    await repo.sourceUpsert(source("s1", "t1"));
    await repo.evidenceUpsert(evidence("e1", "t1"));
    const g = await new LocalRepo().load();
    expect(g.topics).toHaveLength(1);
    expect(g.sources).toHaveLength(1);
    expect(g.evidence).toHaveLength(1);
  });

  it("preserves createdAt on update", async () => {
    const repo = new LocalRepo();
    await repo.topicUpsert(topic("t1"));
    await repo.topicUpsert({ ...topic("t1"), title: "renamed", createdAt: "2099-01-01" });
    const g = await repo.load();
    expect(g.topics[0].title).toBe("renamed");
    expect(g.topics[0].createdAt).toBe(TS);
  });

  it("deleting a topic cascades its sources and evidence", async () => {
    const repo = new LocalRepo();
    await repo.topicUpsert(topic("t1"));
    await repo.sourceUpsert(source("s1", "t1"));
    await repo.evidenceUpsert(evidence("e1", "t1"));
    await repo.topicDelete("t1");
    const g = await repo.load();
    expect(g.topics).toHaveLength(0);
    expect(g.sources).toHaveLength(0);
    expect(g.evidence).toHaveLength(0);
  });

  it("refuses a source / evidence whose topic does not exist (FK)", async () => {
    const repo = new LocalRepo();
    await repo.sourceUpsert(source("s1", "ghost"));
    await repo.evidenceUpsert(evidence("e1", "ghost"));
    const g = await repo.load();
    expect(g.sources).toHaveLength(0);
    expect(g.evidence).toHaveLength(0);
  });

  it("moving a source to another topic keeps exactly one owning relationship", async () => {
    const repo = new LocalRepo();
    await repo.topicUpsert(topic("t1"));
    await repo.topicUpsert(topic("t2"));
    await repo.sourceUpsert(source("s1", "t1"));
    await repo.sourceUpsert({ ...source("s1", "t1"), topicId: "t2" });
    const g = await repo.load();
    expect(g.sources).toHaveLength(1);
    expect(g.sources[0].topicId).toBe("t2");
  });

  it("importGraph is idempotent, drops dangling children, never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importGraph({
      topics: [topic("t1")],
      sources: [source("s1", "t1"), source("s-ghost", "no-topic")],
      evidence: [evidence("e1", "t1"), evidence("e-ghost", "no-topic")],
    });
    expect(r1.ran).toBe(true);
    expect(r1.topicsImported).toBe(1);
    expect(r1.sourcesImported).toBe(1);
    expect(r1.evidenceImported).toBe(1);

    await repo.topicUpsert({ ...topic("t1"), title: "EDITED" });
    const r2 = await repo.importGraph({ topics: [topic("t1")], sources: [], evidence: [] });
    expect(r2.ran).toBe(false);
    const g = await repo.load();
    expect(g.topics[0].title).toBe("EDITED");
  });
});
