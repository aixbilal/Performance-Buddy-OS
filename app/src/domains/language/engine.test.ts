import { describe, it, expect } from "vitest";
import { computePathProgress, computeReadingProgress, deriveSessionEffects } from "./engine";
import type { Book, LanguageLesson, LanguageSession } from "./types";

describe("computePathProgress — mechanical only, no mastery claim", () => {
  it("returns 0 with no lessons", () => {
    expect(computePathProgress([]).percent).toBe(0);
  });

  it("computes correct percent for a mixed set", () => {
    const lessons: LanguageLesson[] = [
      { id: "l1", unitId: "u1", title: "A", order: 1, completed: true, skillTopicId: "t1" },
      { id: "l2", unitId: "u1", title: "B", order: 2, completed: true, skillTopicId: "t1" },
      { id: "l3", unitId: "u1", title: "C", order: 3, completed: false, skillTopicId: "t1" },
      { id: "l4", unitId: "u1", title: "D", order: 4, completed: false, skillTopicId: "t1" },
      { id: "l5", unitId: "u1", title: "E", order: 5, completed: false, skillTopicId: "t1" },
    ];
    // 2/5 complete = 40%
    const result = computePathProgress(lessons);
    expect(result.percent).toBe(40);
    expect(result.completedCount).toBe(2);
  });
});

describe("computeReadingProgress — pages read, not knowledge gained", () => {
  it("matches the product doc's exact example: page 124 of 320", () => {
    const book: Book = { id: "b1", title: "Atomic Habits", author: "James Clear", status: "reading", currentPage: 124, totalPages: 320, currentChapter: 6, skillTopicId: null };
    // 124/320 = 38.75% -> rounds to 39
    expect(computeReadingProgress(book)).toBe(39);
  });

  it("does not divide by zero for a book with no page count set", () => {
    const book: Book = { id: "b1", title: "X", author: "Y", status: "reading", currentPage: 0, totalPages: 0, currentChapter: 1, skillTopicId: null };
    expect(computeReadingProgress(book)).toBe(0);
  });
});

describe("deriveSessionEffects — the core Day 9 rule (§5.3, §5.5)", () => {
  const baseSession: LanguageSession = {
    id: "s1",
    lessonId: "l1",
    date: "2026-08-27",
    durationMinutes: 30,
    recallScore: null,
    recallMax: 10,
  };

  it("exercises alone (no recall check) produce NO knowledge evidence, even with full duration", () => {
    const effects = deriveSessionEffects(baseSession, 30);
    expect(effects.lessonCompleted).toBe(true); // mechanical completion is fine
    expect(effects.knowledgeEvidence).toBeNull(); // but no evidence without a real recall check
    expect(effects.routinePracticeMinutes).toBe(30); // routine practice still counts
  });

  it("a real recall check produces knowledge evidence with the actual score", () => {
    const session = { ...baseSession, recallScore: 8 };
    const effects = deriveSessionEffects(session, 30);
    expect(effects.knowledgeEvidence).toEqual({ score: 8, maxScore: 10 });
  });

  it("short session does not mark the lesson complete, but still logs routine practice", () => {
    const session = { ...baseSession, durationMinutes: 10 };
    const effects = deriveSessionEffects(session, 30);
    expect(effects.lessonCompleted).toBe(false);
    expect(effects.routinePracticeMinutes).toBe(10);
  });
});
