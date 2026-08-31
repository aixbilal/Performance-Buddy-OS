/**
 * Performance Buddy OS — Reading & Language Learning domain model
 * (Master Batch 2: relational).
 *
 * Boundaries are locked (V1 Day 09 decision specs):
 *   Routine    = WHEN / how often practice happens          (its own domain)
 *   Reading & Language (this file) = WHAT was read/learned + curriculum/path progress
 *   Knowledge  = evidence of understanding / retention      (its own domain)
 *   Obsidian   = authoritative long-form notes              (no integration yet)
 *   Goal       = desired outcome                             (its own domain)
 *
 * Path progress and reading progress are DERIVED arithmetic in engine.ts —
 * never a stored "mastery" number, and minutes/pages/completion never
 * automatically become Knowledge mastery. Cross-domain links
 * (`relatedRoutineId`, `knowledgeTopicId`) are references only.
 *
 * Row shapes match `app/src-tauri/src/language.rs`.
 */

export type LanguagePathStatus = "active" | "paused" | "completed";
export const LANGUAGE_PATH_STATUSES: readonly LanguagePathStatus[] = ["active", "paused", "completed"];

export type LanguageUnitKind = "lesson" | "vocabulary" | "grammar" | "module";
export const LANGUAGE_UNIT_KINDS: readonly LanguageUnitKind[] = [
  "lesson",
  "vocabulary",
  "grammar",
  "module",
];

export type SessionActivity = "lesson" | "vocab" | "speaking" | "listening" | "review";
export const SESSION_ACTIVITIES: readonly SessionActivity[] = [
  "lesson",
  "vocab",
  "speaking",
  "listening",
  "review",
];

export type BookStatus = "to-read" | "reading" | "completed" | "paused";
export const BOOK_STATUSES: readonly BookStatus[] = ["to-read", "reading", "completed", "paused"];

// ---------------------------------------------------------------------------
// Canonical persisted rows
// ---------------------------------------------------------------------------

export type LanguagePath = {
  id: string;
  language: string; // e.g. "German"
  title: string; // e.g. "A1 Foundations"
  targetLevel: string; // free text — "A2", "Conversational". No CEFR scoring logic.
  status: LanguagePathStatus;
  /** Reference to a canonical Routine — NEVER a copy of its schedule/history. */
  relatedRoutineId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LanguageUnit = {
  id: string;
  pathId: string;
  title: string;
  kind: LanguageUnitKind;
  position: number;
  completed: boolean; // mechanical — the user worked through this unit's content
  /** Reference to a Knowledge concept — mastery lives there, never duplicated here. */
  knowledgeTopicId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LanguageSession = {
  id: string;
  pathId: string;
  unitId: string | null;
  date: string;
  durationMinutes: number;
  activity: SessionActivity;
  notes: string;
  /** Only set when a genuine recall/test check happened — minutes alone are never mastery. */
  recallScore: number | null;
  recallMax: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  currentPage: number;
  /** null = unknown total. UNKNOWN ≠ 0% — the engine returns a null percent. */
  totalPages: number | null;
  currentChapter: number;
  startedDate: string | null;
  finishedDate: string | null;
  /** Optional reference to a Knowledge concept. Reading owns page progress, Knowledge owns mastery. */
  knowledgeTopicId: string | null;
  /** Free-text pointer to an external note. NOT an Obsidian integration — nothing is read. */
  noteRef: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReadingSession = {
  id: string;
  bookId: string;
  date: string;
  fromPage: number;
  toPage: number;
  durationMinutes: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LanguageGraph = {
  paths: LanguagePath[];
  units: LanguageUnit[];
  sessions: LanguageSession[];
  books: Book[];
  readingSessions: ReadingSession[];
};

// ---------------------------------------------------------------------------
// Form inputs + validation result
// ---------------------------------------------------------------------------

export type PathInput = {
  language: string;
  title: string;
  targetLevel: string;
  status: LanguagePathStatus;
  relatedRoutineId: string | null;
};

export type UnitInput = {
  title: string;
  kind: LanguageUnitKind;
  knowledgeTopicId: string | null;
};

export type SessionInput = {
  unitId: string | null;
  date: string;
  durationMinutes: number;
  activity: SessionActivity;
  notes: string;
  recallScore: number | null;
  recallMax: number;
};

export type BookInput = {
  title: string;
  author: string;
  status: BookStatus;
  currentPage: number;
  totalPages: number | null;
  currentChapter: number;
  knowledgeTopicId: string | null;
  noteRef: string;
};

export type ReadingSessionInput = {
  date: string;
  fromPage: number;
  toPage: number;
  durationMinutes: number;
  notes: string;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };
