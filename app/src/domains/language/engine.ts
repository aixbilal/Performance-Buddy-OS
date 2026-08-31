/**
 * Deterministic Reading & Language Engine.
 *
 * The rules this file enforces (V1 Day 09 §5.3 / §5.6):
 *   "Lesson Completion ≠ Skill Evidence."   "Pages Read ≠ Knowledge Gained."
 * Path progress and reading progress are pure mechanical arithmetic. They are
 * NEVER treated as evidence of understanding — that only comes from the
 * Knowledge domain, and only when a real recall check happened.
 *
 * "No units yet" and "unknown page count" return a *null* percent, never 0%.
 */

import {
  BOOK_STATUSES,
  LANGUAGE_PATH_STATUSES,
  LANGUAGE_UNIT_KINDS,
  SESSION_ACTIVITIES,
  type BookInput,
  type BookStatus,
  type LanguagePathStatus,
  type LanguageUnitKind,
  type PathInput,
  type ReadingSessionInput,
  type SessionActivity,
  type SessionInput,
  type UnitInput,
  type Validated,
} from "./types";

// ---------------------------------------------------------------------------
// Progress derivation — mechanical only, never a mastery claim
// ---------------------------------------------------------------------------

export type PathProgress = {
  percent: number | null; // null = no units yet — NOT 0%
  completed: number;
  total: number;
};

export function derivePathProgress(units: { completed: boolean }[]): PathProgress {
  if (units.length === 0) return { percent: null, completed: 0, total: 0 };
  const completed = units.filter((u) => u.completed).length;
  return { percent: Math.round((completed / units.length) * 100), completed, total: units.length };
}

export type ReadingProgress = {
  percent: number | null; // null = unknown total pages — NOT 0%
  currentPage: number;
  totalPages: number | null;
};

export function deriveReadingProgress(book: {
  currentPage: number;
  totalPages: number | null;
}): ReadingProgress {
  const total = book.totalPages;
  if (total === null || !Number.isFinite(total) || total <= 0) {
    return { percent: null, currentPage: Math.max(0, book.currentPage), totalPages: total };
  }
  const clampedCurrent = Math.min(Math.max(0, book.currentPage), total);
  return {
    percent: Math.round((clampedCurrent / total) * 100),
    currentPage: clampedCurrent,
    totalPages: total,
  };
}

/** The next actionable unit — first incomplete by position, or null when the path is done/empty. */
export function deriveNextUnit<T extends { completed: boolean; position: number }>(
  units: T[],
): T | null {
  return [...units].sort((a, b) => a.position - b.position).find((u) => !u.completed) ?? null;
}

// ---------------------------------------------------------------------------
// Learning-session effects — the core §5.3 / §5.5 rule, in one place
// ---------------------------------------------------------------------------

export type SessionEffects = {
  /** Marking the linked unit complete is mechanical — it carries no mastery claim. */
  completesUnit: boolean;
  /** A Knowledge-evidence signal ONLY when a real recall check happened — never from minutes/exercises alone. */
  knowledgeEvidence: { score: number; maxScore: number } | null;
  /** Practice minutes — a fact for the Routine domain if the user links one; not a knowledge fact. */
  practiceMinutes: number;
};

/**
 * DESCRIBES what a completed session should cause. It does not touch Knowledge
 * or Routine state — the caller applies each effect to the owning domain's
 * store, so this domain never holds another domain's state.
 */
export function deriveSessionEffects(session: {
  durationMinutes: number;
  recallScore: number | null;
  recallMax: number;
  completed: boolean;
}): SessionEffects {
  return {
    completesUnit: session.completed,
    knowledgeEvidence:
      session.recallScore !== null && Number.isFinite(session.recallScore)
        ? { score: session.recallScore, maxScore: session.recallMax }
        : null,
    practiceMinutes: Math.max(0, session.durationMinutes),
  };
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export const isPathStatus = (v: unknown): v is LanguagePathStatus =>
  (LANGUAGE_PATH_STATUSES as readonly string[]).includes(v as string);
export const isUnitKind = (v: unknown): v is LanguageUnitKind =>
  (LANGUAGE_UNIT_KINDS as readonly string[]).includes(v as string);
export const isSessionActivity = (v: unknown): v is SessionActivity =>
  (SESSION_ACTIVITIES as readonly string[]).includes(v as string);
export const isBookStatus = (v: unknown): v is BookStatus =>
  (BOOK_STATUSES as readonly string[]).includes(v as string);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_TITLE = 160;
const MAX_NOTES = 2000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function validatePathInput(input: PathInput): Validated<PathInput> {
  const errors: Record<string, string> = {};
  const language = clean(input.language);
  const title = clean(input.title);
  const targetLevel = clean(input.targetLevel);
  if (language.length === 0) errors.language = "Name the language.";
  else if (language.length > 80) errors.language = "Keep the language under 80 characters.";
  if (title.length === 0) errors.title = "Give the path a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;
  if (targetLevel.length > 80) errors.targetLevel = "Keep the target under 80 characters.";
  if (!isPathStatus(input.status)) errors.status = "Choose a status.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      language,
      title,
      targetLevel,
      status: input.status,
      relatedRoutineId:
        typeof input.relatedRoutineId === "string" && input.relatedRoutineId.trim() !== ""
          ? input.relatedRoutineId
          : null,
    },
  };
}

export function validateUnitInput(input: UnitInput): Validated<UnitInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the unit a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;
  if (!isUnitKind(input.kind)) errors.kind = "Choose a unit kind.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      kind: input.kind,
      knowledgeTopicId:
        typeof input.knowledgeTopicId === "string" && input.knowledgeTopicId.trim() !== ""
          ? input.knowledgeTopicId
          : null,
    },
  };
}

export function validateSessionInput(input: SessionInput): Validated<SessionInput> {
  const errors: Record<string, string> = {};
  if (input.date && (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date)))) {
    errors.date = "Date must be a valid date.";
  }
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0 || input.durationMinutes > 1440) {
    errors.durationMinutes = "Minutes must be between 0 and 1440.";
  }
  if (!isSessionActivity(input.activity)) errors.activity = "Choose an activity.";
  if (clean(input.notes).length > MAX_NOTES) errors.notes = "Notes are too long.";
  const recallMax = Number.isFinite(input.recallMax) && input.recallMax > 0 ? input.recallMax : 10;
  if (input.recallScore !== null) {
    if (!Number.isFinite(input.recallScore) || input.recallScore < 0 || input.recallScore > recallMax) {
      errors.recallScore = `Recall score must be between 0 and ${recallMax}.`;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      unitId:
        typeof input.unitId === "string" && input.unitId.trim() !== "" ? input.unitId : null,
      date: input.date,
      durationMinutes: Math.round(input.durationMinutes),
      activity: input.activity,
      notes: clean(input.notes),
      recallScore: input.recallScore,
      recallMax,
    },
  };
}

export function validateBookInput(input: BookInput): Validated<BookInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  const author = clean(input.author);
  if (title.length === 0) errors.title = "Give the book a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;
  if (author.length > MAX_TITLE) errors.author = "Author is too long.";
  if (!isBookStatus(input.status)) errors.status = "Choose a status.";

  let totalPages: number | null = null;
  if (input.totalPages !== null && input.totalPages !== undefined && `${input.totalPages}` !== "") {
    if (!Number.isFinite(input.totalPages) || input.totalPages <= 0 || input.totalPages > 100000) {
      errors.totalPages = "Total pages must be a positive number (leave blank if unknown).";
    } else {
      totalPages = Math.round(input.totalPages);
    }
  }
  const currentPage = Number.isFinite(input.currentPage) ? Math.max(0, Math.round(input.currentPage)) : 0;
  if (totalPages !== null && currentPage > totalPages) {
    errors.currentPage = "Current page can't be past the total.";
  }
  const currentChapter = Number.isFinite(input.currentChapter)
    ? Math.max(0, Math.round(input.currentChapter))
    : 0;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      author,
      status: input.status,
      currentPage,
      totalPages,
      currentChapter,
      knowledgeTopicId:
        typeof input.knowledgeTopicId === "string" && input.knowledgeTopicId.trim() !== ""
          ? input.knowledgeTopicId
          : null,
      noteRef: clean(input.noteRef),
    },
  };
}

export function validateReadingSessionInput(
  input: ReadingSessionInput,
): Validated<ReadingSessionInput> {
  const errors: Record<string, string> = {};
  if (input.date && (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date)))) {
    errors.date = "Date must be a valid date.";
  }
  const from = Number.isFinite(input.fromPage) ? Math.max(0, Math.round(input.fromPage)) : 0;
  const to = Number.isFinite(input.toPage) ? Math.max(0, Math.round(input.toPage)) : 0;
  if (to < from) errors.toPage = "End page can't be before the start page.";
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0 || input.durationMinutes > 1440) {
    errors.durationMinutes = "Minutes must be between 0 and 1440.";
  }
  if (clean(input.notes).length > MAX_NOTES) errors.notes = "Notes are too long.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      date: input.date,
      fromPage: from,
      toPage: to,
      durationMinutes: Math.round(input.durationMinutes),
      notes: clean(input.notes),
    },
  };
}
