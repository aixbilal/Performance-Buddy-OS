/**
 * TEST / DEMO FIXTURES ONLY — never loaded as user data.
 *
 * The Reading & Language store starts empty on a fresh profile (Batch 2).
 */
import type { Book, LanguagePath, LanguageUnit } from "./types";

const TS = "2026-01-01T00:00:00.000Z";

export const FIXTURE_PATH: LanguagePath = {
  id: "lpath-german",
  language: "German",
  title: "German · A1 Foundations",
  targetLevel: "A2",
  status: "active",
  relatedRoutineId: null,
  archived: false,
  createdAt: TS,
  updatedAt: TS,
};

export const FIXTURE_UNITS: LanguageUnit[] = [
  {
    id: "lunit-1",
    pathId: "lpath-german",
    title: "Greetings",
    kind: "lesson",
    position: 0,
    completed: true,
    knowledgeTopicId: null,
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: "lunit-2",
    pathId: "lpath-german",
    title: "Separable Verbs",
    kind: "grammar",
    position: 1,
    completed: false,
    knowledgeTopicId: null,
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_BOOK: Book = {
  id: "book-atomic-habits",
  title: "Atomic Habits",
  author: "James Clear",
  status: "reading",
  currentPage: 124,
  totalPages: 320,
  currentChapter: 6,
  startedDate: TS,
  finishedDate: null,
  knowledgeTopicId: null,
  noteRef: "",
  archived: false,
  createdAt: TS,
  updatedAt: TS,
};
