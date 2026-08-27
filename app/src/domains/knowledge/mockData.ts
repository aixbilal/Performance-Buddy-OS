import type { Evidence, Source, Topic } from "./types";

/** Values below match PBOS-Knowledge-Overview and PBOS-Knowledge-Topic-Detail approved references. */

export const SEED_TOPICS: Topic[] = [
  {
    id: "topic-binary-trees",
    title: "Binary Trees",
    category: "academic",
    context: "Data Structures",
    masteryPercent: 62,
    lastStudied: "2026-08-26",
    nextReviewDate: "2026-08-29",
    relatedGoalId: null,
  },
  {
    id: "topic-react-arch",
    title: "React Architecture",
    category: "development",
    context: "Frontend Engineering",
    masteryPercent: 47,
    lastStudied: "2026-08-25",
    nextReviewDate: null,
    relatedGoalId: "goal-pbos",
  },
  {
    id: "topic-porsche-911",
    title: "Porsche 911",
    category: "general",
    context: "Cars",
    masteryPercent: 72,
    lastStudied: "2026-08-24",
    nextReviewDate: "2026-08-27",
    relatedGoalId: "goal-cars",
  },
  {
    id: "topic-german-vocab",
    title: "German Travel Vocabulary",
    category: "language",
    context: "German",
    masteryPercent: 60,
    lastStudied: "2026-08-26",
    nextReviewDate: "2026-08-27",
    relatedGoalId: null,
  },
];

export const SEED_SOURCES: Source[] = [
  {
    id: "src-1",
    topicId: "topic-binary-trees",
    type: "obsidian-note",
    title: "Binary Trees - My Notes",
    reference: "Obsidian/DSA/Binary Trees.md",
    addedDate: "2026-08-24",
  },
  {
    id: "src-2",
    topicId: "topic-binary-trees",
    type: "professor-material",
    title: "DSA Lecture 08 - Trees",
    reference: "Slides/DSA-Lecture-08.pdf",
    addedDate: "2026-08-20",
  },
  {
    id: "src-3",
    topicId: "topic-binary-trees",
    type: "ai-note",
    title: "Binary Trees Summary",
    reference: "AI Notes/binary-trees-summary",
    addedDate: "2026-08-22",
  },
];

export const SEED_EVIDENCE: Evidence[] = [
  {
    id: "ev-1",
    topicId: "topic-binary-trees",
    type: "practice",
    title: "Traversal Practice Test",
    score: 7,
    maxScore: 10,
    date: "2026-08-23",
  },
  {
    id: "ev-2",
    topicId: "topic-binary-trees",
    type: "quiz",
    title: "Binary Trees Quiz",
    score: 8,
    maxScore: 10,
    date: "2026-08-19",
  },
  {
    id: "ev-3",
    topicId: "topic-binary-trees",
    type: "recall",
    title: "Inorder Traversal Drill",
    score: 9,
    maxScore: 10,
    date: "2026-08-13",
  },
];
