/**
 * Deterministic Academic Engine.
 *
 * Per Master Handoff §20 and docs/13.09: AI never calculates these numbers,
 * never guesses a grade, never picks a repeat-inclusion rule by convenience.
 * Every function here is pure — same input, same output, always — and is
 * covered by engine.test.ts with known-correct answers, not just "it runs."
 */

import { GRADE_POINTS, type Course, type CourseAttempt, type GradeLetter } from "./types";

export type WeightedScoreInput = {
  obtainedMarks: number;
  totalMarks: number;
  weightPercent: number;
};

/** Weighted contribution of one assessment toward a course's final score, in percentage points. */
export function calculateWeightedScore(assessments: WeightedScoreInput[]): number {
  return assessments.reduce((sum, a) => {
    if (a.totalMarks === 0) return sum;
    const scorePercent = a.obtainedMarks / a.totalMarks;
    return sum + scorePercent * a.weightPercent;
  }, 0);
}

/** SGPA for one semester: credit-hour-weighted average of grade points across the given courses. */
export function calculateSGPA(courses: { creditHours: number; grade: GradeLetter | null }[]): number | null {
  const graded = courses.filter((c) => c.grade !== null) as { creditHours: number; grade: GradeLetter }[];
  if (graded.length === 0) return null;
  const totalCredits = graded.reduce((s, c) => s + c.creditHours, 0);
  if (totalCredits === 0) return null;
  const totalPoints = graded.reduce((s, c) => s + c.creditHours * GRADE_POINTS[c.grade], 0);
  return round2(totalPoints / totalCredits);
}

export type CGPAInclusionResult = {
  cgpa: number | null;
  totalCreditsCounted: number;
  /** Per docs/13.10: unresolved repeat policy blocks the affected calculation rather than guessing. */
  blockedByUnresolvedRepeatPolicy: boolean;
  excludedCourseIds: string[];
};

/**
 * Resolves which attempts count toward CGPA WITHOUT assuming a "best grade
 * wins" replacement rule, because docs/13.10 explicitly marks that rule as
 * RESEARCH REQUIRED for this user's actual institution policy. Courses with
 * more than one attempt are excluded from the CGPA total and reported in
 * `excludedCourseIds` — the UI must show this exclusion, not hide it.
 *
 * This is a deliberate, documented deviation from the approved reference
 * screenshot (which shows automatic "Replace (Better Grade)" behavior) —
 * see the note in types.ts and the UI ↔ ARCHITECTURE flag in
 * DAY-4-IMPLEMENTATION-NOTES.md.
 */
export function calculateCGPA(
  courses: Pick<Course, "id" | "creditHours">[],
  attemptsByCourseId: Record<string, CourseAttempt[]>,
  /**
   * Already-settled historical credits/points from semesters completed
   * before this app existed (e.g. an official transcript import). This is
   * NOT a repeat-policy decision — it's just prior arithmetic already
   * finalized by the institution, so it's safe to fold in directly.
   */
  priorRecord?: { credits: number; points: number }
): CGPAInclusionResult {
  let totalCredits = priorRecord?.credits ?? 0;
  let totalPoints = priorRecord?.points ?? 0;
  const excludedCourseIds: string[] = [];
  let blockedByUnresolvedRepeatPolicy = false;

  for (const course of courses) {
    const attempts = (attemptsByCourseId[course.id] ?? []).filter((a) => a.finalGrade !== null);
    if (attempts.length === 0) continue; // ungraded, not part of CGPA yet — not an error

    if (attempts.length > 1) {
      // Multiple graded attempts exist for this course — repeat-inclusion
      // policy is unresolved, so this course is excluded rather than guessed.
      excludedCourseIds.push(course.id);
      blockedByUnresolvedRepeatPolicy = true;
      continue;
    }

    const grade = attempts[0].finalGrade as GradeLetter;
    totalCredits += course.creditHours;
    totalPoints += course.creditHours * GRADE_POINTS[grade];
  }

  return {
    cgpa: totalCredits > 0 ? round2(totalPoints / totalCredits) : null,
    totalCreditsCounted: totalCredits,
    blockedByUnresolvedRepeatPolicy,
    excludedCourseIds,
  };
}

/**
 * Given a target SGPA and a set of courses where some grades are already
 * fixed and others are still projected/editable, computes the average grade
 * points needed across the *remaining* (non-fixed) courses to hit the target.
 * Returns null if the target is mathematically unreachable (e.g. would
 * require > 4.0 average) rather than silently clamping to a false number.
 */
export function calculateRequiredAverageForTarget(
  courses: { creditHours: number; grade: GradeLetter | null; isFixed: boolean }[],
  targetSGPA: number
): { requiredAverage: number | null; reachable: boolean } {
  const totalCredits = courses.reduce((s, c) => s + c.creditHours, 0);
  if (totalCredits === 0) return { requiredAverage: null, reachable: false };

  const fixedPoints = courses
    .filter((c) => c.isFixed && c.grade !== null)
    .reduce((s, c) => s + c.creditHours * GRADE_POINTS[c.grade as GradeLetter], 0);

  const remaining = courses.filter((c) => !c.isFixed);
  const remainingCredits = remaining.reduce((s, c) => s + c.creditHours, 0);

  if (remainingCredits === 0) {
    // everything is fixed — target is already determined, not "required"
    return { requiredAverage: null, reachable: fixedPoints / totalCredits >= targetSGPA };
  }

  const requiredTotalPoints = targetSGPA * totalCredits;
  const requiredRemainingPoints = requiredTotalPoints - fixedPoints;
  const requiredAverage = round2(requiredRemainingPoints / remainingCredits);

  return { requiredAverage, reachable: requiredAverage <= 4.0 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
