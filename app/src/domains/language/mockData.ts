import type { Book, LanguageLesson, LanguageUnit } from "./types";

/** Reuses "topic-german-vocab" from src/domains/knowledge/mockData.ts — not a new/duplicate topic. */
const GERMAN_SKILL_TOPIC_ID = "topic-german-vocab";

export const SEED_UNITS: LanguageUnit[] = [
  { id: "unit-1", languageName: "German", pathTitle: "A1", title: "Introductions", order: 1 },
  { id: "unit-4", languageName: "German", pathTitle: "A1", title: "Daily Life", order: 4 },
];

export const SEED_LESSONS: LanguageLesson[] = [
  { id: "lsn-1", unitId: "unit-1", title: "Greetings", order: 1, completed: true, skillTopicId: GERMAN_SKILL_TOPIC_ID },
  { id: "lsn-2", unitId: "unit-1", title: "Numbers", order: 2, completed: true, skillTopicId: GERMAN_SKILL_TOPIC_ID },
  { id: "lsn-3", unitId: "unit-4", title: "Daily Routine Vocabulary", order: 3, completed: true, skillTopicId: GERMAN_SKILL_TOPIC_ID },
  { id: "lsn-4", unitId: "unit-4", title: "Separable Verbs", order: 4, completed: false, skillTopicId: GERMAN_SKILL_TOPIC_ID },
  { id: "lsn-5", unitId: "unit-4", title: "Modal Verbs", order: 5, completed: false, skillTopicId: GERMAN_SKILL_TOPIC_ID },
];

export const SEED_BOOKS: Book[] = [
  { id: "book-atomic-habits", title: "Atomic Habits", author: "James Clear", status: "reading", currentPage: 124, totalPages: 320, currentChapter: 6, skillTopicId: null },
];
