// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeLanguageRepo } from "./repo";
import type { Book, LanguagePath, LanguageSession, LanguageUnit, ReadingSession } from "./types";

const TS = "2026-01-01T00:00:00.000Z";

const path = (id: string, o: Partial<LanguagePath> = {}): LanguagePath => ({
  id,
  language: "German",
  title: `Path ${id}`,
  targetLevel: "A2",
  status: "active",
  relatedRoutineId: null,
  archived: false,
  createdAt: TS,
  updatedAt: TS,
  ...o,
});
const unit = (id: string, pathId: string, o: Partial<LanguageUnit> = {}): LanguageUnit => ({
  id,
  pathId,
  title: `Unit ${id}`,
  kind: "lesson",
  position: 0,
  completed: false,
  knowledgeTopicId: null,
  createdAt: TS,
  updatedAt: TS,
  ...o,
});
const session = (id: string, pathId: string, unitId: string | null): LanguageSession => ({
  id,
  pathId,
  unitId,
  date: "2026-08-01",
  durationMinutes: 30,
  activity: "lesson",
  notes: "",
  recallScore: null,
  recallMax: 10,
  completed: true,
  createdAt: TS,
  updatedAt: TS,
});
const book = (id: string, o: Partial<Book> = {}): Book => ({
  id,
  title: `Book ${id}`,
  author: "A",
  status: "reading",
  currentPage: 10,
  totalPages: 200,
  currentChapter: 1,
  startedDate: null,
  finishedDate: null,
  knowledgeTopicId: null,
  noteRef: "",
  archived: false,
  createdAt: TS,
  updatedAt: TS,
  ...o,
});
const rsession = (id: string, bookId: string): ReadingSession => ({
  id,
  bookId,
  date: "2026-08-01",
  fromPage: 10,
  toPage: 30,
  durationMinutes: 20,
  notes: "",
  createdAt: TS,
  updatedAt: TS,
});

beforeEach(() => window.localStorage.clear());

describe("makeLanguageRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeLanguageRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — CRUD, cascade, persistence", () => {
  it("round-trips the whole graph and survives a fresh instance", async () => {
    const repo = new LocalRepo();
    await repo.pathUpsert(path("p1"));
    await repo.unitUpsert(unit("u1", "p1", { knowledgeTopicId: "kt1" }));
    await repo.sessionUpsert(session("s1", "p1", "u1"));
    await repo.bookUpsert(book("b1"));
    await repo.readingSessionUpsert(rsession("rs1", "b1"));
    const g = await new LocalRepo().load();
    expect(g.paths).toHaveLength(1);
    expect(g.units).toHaveLength(1);
    expect(g.sessions).toHaveLength(1);
    expect(g.books).toHaveLength(1);
    expect(g.readingSessions).toHaveLength(1);
  });

  it("preserves createdAt on update", async () => {
    const repo = new LocalRepo();
    await repo.bookUpsert(book("b1"));
    await repo.bookUpsert(book("b1", { title: "Renamed", createdAt: "2099-01-01" }));
    const g = await repo.load();
    expect(g.books[0].title).toBe("Renamed");
    expect(g.books[0].createdAt).toBe(TS);
  });

  it("deleting a path CASCADEs units and sessions", async () => {
    const repo = new LocalRepo();
    await repo.pathUpsert(path("p1"));
    await repo.unitUpsert(unit("u1", "p1"));
    await repo.sessionUpsert(session("s1", "p1", "u1"));
    await repo.pathDelete("p1");
    const g = await repo.load();
    expect(g.paths).toHaveLength(0);
    expect(g.units).toHaveLength(0);
    expect(g.sessions).toHaveLength(0);
  });

  it("deleting a unit keeps its sessions but NULLs the unitId", async () => {
    const repo = new LocalRepo();
    await repo.pathUpsert(path("p1"));
    await repo.unitUpsert(unit("u1", "p1"));
    await repo.sessionUpsert(session("s1", "p1", "u1"));
    await repo.unitDelete("u1");
    const g = await repo.load();
    expect(g.sessions).toHaveLength(1);
    expect(g.sessions[0].unitId).toBeNull();
  });

  it("deleting a book CASCADEs its reading sessions", async () => {
    const repo = new LocalRepo();
    await repo.bookUpsert(book("b1"));
    await repo.readingSessionUpsert(rsession("rs1", "b1"));
    await repo.bookDelete("b1");
    const g = await repo.load();
    expect(g.books).toHaveLength(0);
    expect(g.readingSessions).toHaveLength(0);
  });

  it("refuses a unit / reading session whose parent does not exist (FK)", async () => {
    const repo = new LocalRepo();
    await repo.unitUpsert(unit("u1", "ghost"));
    await repo.readingSessionUpsert(rsession("rs1", "ghost"));
    const g = await repo.load();
    expect(g.units).toHaveLength(0);
    expect(g.readingSessions).toHaveLength(0);
  });

  it("importGraph is idempotent and never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importGraph({
      paths: [path("p1")],
      units: [unit("u1", "p1"), unit("u-ghost", "no-path")],
      sessions: [session("s1", "p1", "u1"), session("s-ghost", "no-path", null)],
      books: [book("b1")],
      readingSessions: [rsession("rs1", "b1"), rsession("rs-ghost", "no-book")],
    });
    expect(r1.ran).toBe(true);
    expect(r1.pathsImported).toBe(1);
    expect(r1.unitsImported).toBe(1); // u-ghost dropped
    expect(r1.sessionsImported).toBe(1); // s-ghost dropped
    expect(r1.readingSessionsImported).toBe(1); // rs-ghost dropped

    await repo.pathUpsert(path("p1", { title: "EDITED" }));
    const r2 = await repo.importGraph({
      paths: [path("p1")],
      units: [],
      sessions: [],
      books: [],
      readingSessions: [],
    });
    expect(r2.ran).toBe(false);
    expect((await repo.load()).paths[0].title).toBe("EDITED");
  });
});
