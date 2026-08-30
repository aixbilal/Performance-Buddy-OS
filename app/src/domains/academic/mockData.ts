/**
 * TEST / DEMO FIXTURES ONLY — Batch 2A.
 *
 * These are NOT loaded as user data. A fresh production profile starts empty
 * (see store.tsx: no seed, relational SQLite is authoritative). These fixtures
 * exist so engine/repo tests and Playwright/native E2E have a known, canonical
 * "Data Structures → Binary Trees" scenario to assert against.
 *
 * Nothing in `src/` imports this file outside `*.test.*`.
 */
import type {
  Assessment,
  Course,
  CourseAttempt,
  Semester,
  Topic,
} from "./types";

const TS = "2026-01-01T00:00:00.000Z";

export const FIXTURE_SEMESTER: Semester = {
  id: "sem-3",
  label: "Semester 3 - Fall 2026",
  position: 0,
  isCurrent: true,
  createdAt: TS,
  updatedAt: TS,
};

export const FIXTURE_COURSES: Course[] = [
  {
    id: "dsa",
    semesterId: "sem-3",
    code: "CSE 201",
    title: "Data Structures",
    creditHours: 4,
    professorName: "Prof. Neeraj Sharma",
    status: "at-risk",
    targetGrade: "A-",
    projectedGrade: null,
    archived: false,
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_TOPICS: Topic[] = [
  {
    id: "t-binary-trees",
    courseId: "dsa",
    title: "Binary Trees",
    position: 0,
    professorCoverage: "taught",
    personalStudyPercent: 40,
    knowledgeTopicId: null,
    masterySelfAssessed: null,
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_ASSESSMENTS: Assessment[] = [
  {
    id: "as-quiz-1",
    courseId: "dsa",
    category: "quiz",
    title: "Quiz 1",
    obtainedMarks: 18,
    totalMarks: 20,
    weightPercent: 100,
    date: "2026-04-10",
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_ATTEMPTS: CourseAttempt[] = [
  {
    id: "att-dsa-1",
    courseId: "dsa",
    attemptNumber: 1,
    term: "Fall 2026",
    finalGrade: null,
    createdAt: TS,
    updatedAt: TS,
  },
];
