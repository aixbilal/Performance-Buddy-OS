/**
 * Performance Buddy OS — Academic OS domain model (Batch 2A: relational).
 *
 * IMPORTANT — read before touching the engine (engine.ts):
 *
 * docs/13.09 - Grade Policy Model.md states explicitly:
 *   "No common 4.0-scale assumption may substitute for verified CUI policy."
 *   "The engine cannot guess a grade from an unverified scale."
 * docs/13.10 - Grade Replacement Model.md states explicitly:
 *   "CUI replacement... rules... are RESEARCH REQUIRED. No behavior is assumed."
 *   "Unknown policy blocks affected CGPA rather than selecting latest,
 *    highest, or average by convenience."
 *
 * So this model:
 *   - stores a user-entered letter grade or NULL — it never derives a letter
 *     from a score%,
 *   - stores every attempt immutably and NEVER auto-selects a repeat-inclusion
 *     rule,
 *   - keeps Professor Coverage, Personal Study Coverage and Mastery as THREE
 *     independent facts. Mastery is NOT stored here at all: an Academic Topic
 *     optionally links (`knowledgeTopicId`) to the canonical Knowledge concept,
 *     and mastery is READ from that concept's evidence — never a second copy.
 *
 * What IS safe as plain arithmetic: the letter→grade-point table from the
 * approved reference footer (A=4.00 … F=0.00) — used once a letter is known.
 */

export type GradeLetter = "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D" | "F";

export const GRADE_LETTERS: readonly GradeLetter[] = [
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "D",
  "F",
];

/** Sourced directly from the approved reference footer — arithmetic, not a policy decision. */
export const GRADE_POINTS: Record<GradeLetter, number> = {
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  D: 1.0,
  F: 0.0,
};

export type CoverageStatus = "not-taught" | "in-progress" | "taught";
export const COVERAGE_STATUSES: readonly CoverageStatus[] = ["not-taught", "in-progress", "taught"];

export type CourseStatus = "on-track" | "at-risk" | "off-track";
export const COURSE_STATUSES: readonly CourseStatus[] = ["on-track", "at-risk", "off-track"];

export type AssessmentCategory = "quiz" | "assignment" | "lab" | "midterm" | "final" | "project";
export const ASSESSMENT_CATEGORIES: readonly AssessmentCategory[] = [
  "quiz",
  "assignment",
  "lab",
  "midterm",
  "final",
  "project",
];

// ---------------------------------------------------------------------------
// Canonical persisted rows (shape matches app/src-tauri/src/academic.rs)
// ---------------------------------------------------------------------------

export type Semester = {
  id: string;
  label: string;
  position: number;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Course = {
  id: string;
  semesterId: string | null;
  code: string;
  title: string;
  creditHours: number;
  professorName: string;
  status: CourseStatus;
  /** User-declared. NEVER auto-derived from a score. */
  targetGrade: GradeLetter | null;
  /**
   * User's own estimate of where this course is heading. Deliberately NOT
   * auto-computed from the weighted score — turning score% into a letter needs
   * the interval policy docs/13.09 marks unverified.
   */
  projectedGrade: GradeLetter | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Topic = {
  id: string;
  courseId: string;
  title: string;
  position: number;
  /** What the professor/course has actually covered. Independent of the two below. */
  professorCoverage: CoverageStatus;
  /** What the user has personally studied — 0-100. Independent of coverage and mastery. */
  personalStudyPercent: number;
  /** The ONE cross-domain link. NULL = not linked to a Knowledge concept. */
  knowledgeTopicId: string | null;
  /**
   * Legacy self-assessment migrated from the pre-2A seed model. Never edited
   * in-app, never aggregated into a deterministic result. Superseded entirely
   * by the linked Knowledge concept's evidence when one is present. Kept only
   * so a returning user's old number is not silently destroyed.
   */
  masterySelfAssessed: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Assessment = {
  id: string;
  courseId: string;
  category: AssessmentCategory;
  title: string;
  obtainedMarks: number | null; // null = not graded yet
  totalMarks: number;
  weightPercent: number; // weight toward the course's final score
  date: string; // ISO date
  createdAt: string;
  updatedAt: string;
};

/**
 * Every attempt is stored immutably (docs 13.10). Repeat-inclusion is NEVER
 * auto-decided — see engine.ts `calculateCGPA`.
 */
export type CourseAttempt = {
  id: string;
  courseId: string;
  attemptNumber: number;
  term: string; // e.g. "Fall 2026"
  finalGrade: GradeLetter | null; // null = in progress, not yet graded
  createdAt: string;
  updatedAt: string;
};

export type AcademicGraph = {
  semesters: Semester[];
  courses: Course[];
  topics: Topic[];
  assessments: Assessment[];
  attempts: CourseAttempt[];
};

// ---------------------------------------------------------------------------
// Form inputs + validation result
// ---------------------------------------------------------------------------

export type CourseInput = {
  code: string;
  title: string;
  creditHours: number;
  professorName: string;
  status: CourseStatus;
  targetGrade: GradeLetter | null;
  projectedGrade: GradeLetter | null;
  semesterId: string | null;
};

export type TopicInput = {
  title: string;
  professorCoverage: CoverageStatus;
  personalStudyPercent: number;
};

export type AssessmentInput = {
  category: AssessmentCategory;
  title: string;
  obtainedMarks: number | null;
  totalMarks: number;
  weightPercent: number;
  date: string;
};

export type AttemptInput = {
  attemptNumber: number;
  term: string;
  finalGrade: GradeLetter | null;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };
