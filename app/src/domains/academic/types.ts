/**
 * Performance Buddy OS — Academic OS domain model.
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
 * The approved reference screenshot (PBOS-Academic-SGPA-CGPA-v1) shows a
 * specific score→letter scale AND a "Replace (Better Grade)" repeat policy
 * as if both were settled. Per the docs above, NEITHER is verified. This is
 * a genuine UI ↔ ARCHITECTURE conflict — see the flag in engine.ts.
 *
 * What IS safe to treat as real: the letter→grade-point values printed in
 * the screenshot footer (A=4.00, A-=3.70, B+=3.30, B=3.00, B-=2.70, C+=2.30,
 * C=2.00, D=1.00, F=0.00) — these are just arithmetic once a letter grade is
 * known, not a policy judgment call, so they're used as-is below.
 */

export type GradeLetter = "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D" | "F";

/** Sourced directly from the approved reference screenshot footer — arithmetic, not a policy decision. */
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

export type Topic = {
  id: string;
  courseId: string;
  title: string;
  order: number;
  /** What the professor/course has actually covered — separate from personal study. Per Master Handoff §4. */
  professorCoverage: CoverageStatus;
  /** What the user has personally studied — 0-100, independent of professor coverage. */
  personalStudyPercent: number;
  /** What evidence/testing shows the user understands — 0-100, independent of the two above. */
  masteryPercent: number;
};

export type AssessmentCategory = "quiz" | "assignment" | "lab" | "midterm" | "final";

export type Assessment = {
  id: string;
  courseId: string;
  category: AssessmentCategory;
  title: string;
  obtainedMarks: number | null; // null = not graded yet
  totalMarks: number;
  weightPercent: number; // this assessment's weight toward the course's final score
  date: string; // ISO date
};

export type CourseStatus = "on-track" | "at-risk" | "off-track";

export type Course = {
  id: string;
  code: string;
  title: string;
  creditHours: number;
  semesterId: string;
  professorName: string;
  status: CourseStatus;
  /** User-declared, per attempt — see CourseAttempt for the deterministic-repeat-safe version. */
  targetGrade: GradeLetter | null;
  /**
   * User's own estimate of where this course is heading, given work still
   * to come. Deliberately NOT auto-computed from the current weighted score,
   * because turning a score% into a letter grade requires the score-interval
   * policy that docs/13.09 marks unverified — see engine.ts header note.
   */
  projectedGrade: GradeLetter | null;
};

/**
 * Every attempt is stored immutably (docs 13.10: "Every attempt remains
 * immutable and visible... Replacement changes derived inclusion, never the
 * historical grade."). `includedInCGPA` is NOT computed by guessing a
 * "best grade wins" rule — see engine.ts `resolveCGPAInclusion`.
 */
export type CourseAttempt = {
  id: string;
  courseId: string;
  attemptNumber: number;
  term: string; // e.g. "Spring 2026"
  finalGrade: GradeLetter | null; // null = in progress, not yet graded
};

export type Semester = {
  id: string;
  label: string; // e.g. "Semester 3 - Fall 2026"
  courseIds: string[];
};
