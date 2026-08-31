import { describe, it, expect } from "vitest";
import {
  validateBookInput,
  validatePathInput,
  validateReadingSessionInput,
  validateSessionInput,
  validateUnitInput,
} from "./engine";
import type { BookInput, PathInput, SessionInput } from "./types";

const path = (o: Partial<PathInput> = {}): PathInput => ({
  language: "German",
  title: "A1 Foundations",
  targetLevel: "A2",
  status: "active",
  relatedRoutineId: null,
  ...o,
});
const book = (o: Partial<BookInput> = {}): BookInput => ({
  title: "Atomic Habits",
  author: "James Clear",
  status: "reading",
  currentPage: 40,
  totalPages: 320,
  currentChapter: 2,
  knowledgeTopicId: null,
  noteRef: "",
  ...o,
});
const session = (o: Partial<SessionInput> = {}): SessionInput => ({
  unitId: null,
  date: "2026-08-31",
  durationMinutes: 30,
  activity: "lesson",
  notes: "",
  recallScore: null,
  recallMax: 10,
  ...o,
});

describe("validatePathInput", () => {
  it("accepts a well-formed path and trims", () => {
    const r = validatePathInput(path({ language: "  German  ", title: "  A1 " }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.language).toBe("German");
      expect(r.value.title).toBe("A1");
    }
  });
  it("requires a language and a title, and normalises an empty routine link to null", () => {
    expect(validatePathInput(path({ language: "" })).ok).toBe(false);
    expect(validatePathInput(path({ title: "  " })).ok).toBe(false);
    const r = validatePathInput(path({ relatedRoutineId: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.relatedRoutineId).toBeNull();
  });
});

describe("validateUnitInput", () => {
  it("requires a title and a valid kind", () => {
    expect(validateUnitInput({ title: "", kind: "lesson", knowledgeTopicId: null }).ok).toBe(false);
    expect(
      validateUnitInput({ title: "Verbs", kind: "bogus" as never, knowledgeTopicId: null }).ok,
    ).toBe(false);
    expect(validateUnitInput({ title: "Verbs", kind: "grammar", knowledgeTopicId: null }).ok).toBe(true);
  });
});

describe("validateSessionInput — minutes are not mastery", () => {
  it("accepts a session with no recall score", () => {
    const r = validateSessionInput(session());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.recallScore).toBeNull();
  });
  it("rejects a recall score above the max", () => {
    expect(validateSessionInput(session({ recallScore: 12, recallMax: 10 })).ok).toBe(false);
  });
  it("rejects an absurd duration and a bad date", () => {
    expect(validateSessionInput(session({ durationMinutes: 5000 })).ok).toBe(false);
    expect(validateSessionInput(session({ date: "31/08/2026" })).ok).toBe(false);
  });
});

describe("validateBookInput", () => {
  it("accepts a book with a known total, trims the title", () => {
    const r = validateBookInput(book({ title: "  Deep Work  " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.title).toBe("Deep Work");
  });
  it("keeps total pages NULL when left blank (unknown ≠ 0)", () => {
    const r = validateBookInput(book({ totalPages: null, currentPage: 80 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.totalPages).toBeNull();
  });
  it("rejects a current page past a known total, and a non-positive total", () => {
    expect(validateBookInput(book({ currentPage: 400, totalPages: 320 })).ok).toBe(false);
    expect(validateBookInput(book({ totalPages: 0 })).ok).toBe(false);
    expect(validateBookInput(book({ totalPages: -5 })).ok).toBe(false);
  });
  it("requires a title", () => {
    expect(validateBookInput(book({ title: "   " })).ok).toBe(false);
  });
});

describe("validateReadingSessionInput", () => {
  it("rejects an end page before the start page", () => {
    expect(
      validateReadingSessionInput({ date: "", fromPage: 100, toPage: 80, durationMinutes: 20, notes: "" }).ok,
    ).toBe(false);
  });
  it("accepts a normal range", () => {
    const r = validateReadingSessionInput({
      date: "2026-08-31",
      fromPage: 40,
      toPage: 62,
      durationMinutes: 25,
      notes: " read ch.3 ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.notes).toBe("read ch.3");
  });
});
