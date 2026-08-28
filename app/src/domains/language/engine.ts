/**
 * Deterministic Reading & Language Engine.
 *
 * The rule this file enforces (Day 9 Handoff §5.3, §5.6):
 *   "Lesson Completion ≠ Skill Evidence." "Pages Read ≠ Knowledge Gained."
 * Path/reading progress is pure mechanical arithmetic. It is NEVER treated
 * as evidence of understanding — that only comes from the Knowledge domain,
 * and only when a real recall check happened (see deriveSessionEffects).
 */

import type { Book, LanguageLesson, LanguageSession } from "./types";

export type PathProgress = { percent: number; completedCount: number; totalCount: number };

/** Mechanical lesson-completion percent — carries no claim about mastery. */
export function computePathProgress(lessons: LanguageLesson[]): PathProgress {
  if (lessons.length === 0) return { percent: 0, completedCount: 0, totalCount: 0 };
  const completedCount = lessons.filter((l) => l.completed).length;
  return { percent: Math.round((completedCount / lessons.length) * 100), completedCount, totalCount: lessons.length };
}

/** Mechanical page-position percent — carries no claim about knowledge gained. */
export function computeReadingProgress(book: Book): number {
  if (book.totalPages === 0) return 0;
  return Math.round((book.currentPage / book.totalPages) * 100);
}

export type SessionEffects = {
  lessonCompleted: boolean;
  /** Only set when the session included a real recall check — never from exercises alone. */
  knowledgeEvidence: { score: number; maxScore: number } | null;
  /** Practice duration always feeds the Routine engine, regardless of whether recall happened. */
  routinePracticeMinutes: number;
};

/**
 * The concrete implementation of §5.5 ("one learning event, multiple
 * relationships — do not force the user to log these separately") and
 * §5.3 ("Lesson Completion ≠ Skill Evidence") in one place:
 *
 *  - Finishing session content (duration > 0) can mark the lesson complete —
 *    mechanical, no evidence claim.
 *  - Routine practice minutes are always recorded — a Routine fact, not a
 *    knowledge fact.
 *  - Knowledge evidence is produced ONLY if `session.recallScore` is set —
 *    doing exercises without a recall check produces zero evidence, on purpose.
 *
 * This function only DESCRIBES the effects — it does not touch Knowledge or
 * Routine state itself. The caller (UI layer) applies each effect to the
 * correct domain's own store, so this domain never holds a reference to
 * another domain's state.
 */
export function deriveSessionEffects(session: LanguageSession, minMinutesToComplete: number): SessionEffects {
  return {
    lessonCompleted: session.durationMinutes >= minMinutesToComplete,
    knowledgeEvidence:
      session.recallScore !== null ? { score: session.recallScore, maxScore: session.recallMax } : null,
    routinePracticeMinutes: session.durationMinutes,
  };
}
