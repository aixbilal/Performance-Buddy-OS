/**
 * TEST / DEMO FIXTURES ONLY — Batch 2A.
 *
 * These are NOT loaded as user data. A fresh production profile starts empty
 * (see store.tsx: no seed, relational SQLite is authoritative). These fixtures
 * exist so engine/repo tests and E2E have a known "Binary Trees" concept with
 * real evidence to assert evidence-derived mastery against.
 *
 * Nothing in `src/` imports this file outside `*.test.*`.
 */
import type { Evidence, KnowledgeTopic, Source } from "./types";

const TS = "2026-01-01T00:00:00.000Z";

export const FIXTURE_TOPICS: KnowledgeTopic[] = [
  {
    id: "topic-binary-trees",
    title: "Binary Trees",
    category: "academic",
    context: "Data Structures",
    lastStudied: "2026-08-26",
    nextReviewDate: "2026-08-29",
    relatedGoalId: null,
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_SOURCES: Source[] = [
  {
    id: "src-1",
    topicId: "topic-binary-trees",
    type: "professor-material",
    title: "DSA Lecture 08 - Trees",
    reference: "Slides/DSA-Lecture-08.pdf",
    addedDate: "2026-08-20",
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_EVIDENCE: Evidence[] = [
  {
    id: "ev-1",
    topicId: "topic-binary-trees",
    type: "recall",
    title: "Inorder Traversal Drill",
    score: 9,
    maxScore: 10,
    date: "2026-08-13",
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: "ev-2",
    topicId: "topic-binary-trees",
    type: "quiz",
    title: "Binary Trees Quiz",
    score: 8,
    maxScore: 10,
    date: "2026-08-19",
    createdAt: TS,
    updatedAt: TS,
  },
];
