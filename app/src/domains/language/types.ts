/**
 * Performance Buddy OS — Reading & Language Learning domain model.
 *
 * Per Day 9 Handoff §5.1, four domains stay separate and linked, never merged:
 *   Routine OS = did I practice consistently?
 *   Reading & Language OS (this file) = what did I actually read/learn?
 *   Knowledge OS = what do I understand/retain? (existing domain — REUSED below, not duplicated)
 *   Goals OS = what outcome am I working toward?
 *
 * Concretely: `LanguageLesson.skillTopicId` and `Book.skillTopicId` point at
 * an existing Knowledge `Topic` (see src/domains/knowledge). Mastery/skill
 * state is never recomputed here — it's read from Knowledge, exactly once,
 * per "avoid duplicate knowledge" (Master Handoff §19).
 *
 * Per §5.3: "Path Progress ≠ Language Mastery. Lesson Completion ≠ Skill
 * Evidence." — enforced in engine.ts, not just stated here.
 */

export type LanguageUnit = {
  id: string;
  languageName: string; // e.g. "German"
  pathTitle: string; // e.g. "A1"
  title: string; // e.g. "Daily Life"
  order: number;
};

export type LanguageLesson = {
  id: string;
  unitId: string;
  title: string;
  order: number;
  completed: boolean; // mechanical — did the user finish the lesson content
  /** Links to a Knowledge Topic — mastery lives there, never duplicated here. */
  skillTopicId: string;
};

export type LanguageSession = {
  id: string;
  lessonId: string;
  date: string;
  durationMinutes: number;
  /**
   * Only present if the session included an actual recall/test check.
   * Per §5.3: exercises alone don't produce Knowledge evidence — only a
   * genuine recall check does. See engine.ts deriveSessionEffects.
   */
  recallScore: number | null; // out of 10
  recallMax: number;
};

export type BookStatus = "reading" | "completed" | "paused";

export type Book = {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  currentPage: number;
  totalPages: number;
  currentChapter: number;
  /** Optional — a book can (but doesn't have to) link to a Knowledge Topic for captured concepts. */
  skillTopicId: string | null;
};

export type ReadingSession = {
  id: string;
  bookId: string;
  date: string;
  fromPage: number;
  toPage: number;
  durationMinutes: number;
};
