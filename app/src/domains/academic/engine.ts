/**
 * Deterministic Academic Engine.
 *
 * Per Master Handoff §20 and docs/13.09: AI never calculates these numbers,
 * never guesses a grade, never picks a repeat-inclusion rule by convenience.
 * Every function here is pure — same input, same output, always — and is
 * covered by engine.test.ts with known-correct answers.
 *
 * UNKNOWN ≠ ZERO. An incomplete assessment weighting is reported as a
 * configuration problem; it is never silently normalized to make a number
 * appear.
 */

import {
  ASSESSMENT_CATEGORIES,
  COURSE_STATUSES,
  COVERAGE_STATUSES,
  GRADE_LETTERS,
  GRADE_POINTS,
  type AssessmentInput,
  type AttemptInput,
  type Course,
  type CourseAttempt,
  type CourseInput,
  type CoverageStatus,
  type GradeLetter,
  type TopicInput,
  type Validated,
} from "./types";

const MAX_TITLE = 140;
const MIN_CREDIT_HOURS = 0.5;
const MAX_CREDIT_HOURS = 12;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEIGHT_EPSILON = 0.01;

function clean(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isGradeLetter(v: unknown): v is GradeLetter {
  return typeof v === "string" && (GRADE_LETTERS as readonly string[]).includes(v);
}

export function isCoverageStatus(v: unknown): v is CoverageStatus {
  return typeof v === "string" && (COVERAGE_STATUSES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Validation — create + edit share the same rules
// ---------------------------------------------------------------------------

export function validateCourseInput(input: CourseInput): Validated<CourseInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  const code = clean(input.code);
  const professorName = clean(input.professorName);

  if (title.length === 0) errors.title = "Give the course a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;

  if (code.length > 40) errors.code = "Course code is too long.";

  if (!Number.isFinite(input.creditHours)) {
    errors.creditHours = "Credit hours must be a number.";
  } else if (input.creditHours < MIN_CREDIT_HOURS || input.creditHours > MAX_CREDIT_HOURS) {
    errors.creditHours = `Credit hours must be between ${MIN_CREDIT_HOURS} and ${MAX_CREDIT_HOURS}.`;
  }

  if (!(COURSE_STATUSES as readonly string[]).includes(input.status)) {
    errors.status = "Choose a course status.";
  }
  if (input.targetGrade !== null && !isGradeLetter(input.targetGrade)) {
    errors.targetGrade = "Invalid target grade.";
  }
  if (input.projectedGrade !== null && !isGradeLetter(input.projectedGrade)) {
    errors.projectedGrade = "Invalid projected grade.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { ...input, title, code, professorName },
  };
}

export function validateTopicInput(input: TopicInput): Validated<TopicInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);

  if (title.length === 0) errors.title = "Give the topic a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;

  if (!isCoverageStatus(input.professorCoverage)) {
    errors.professorCoverage = "Choose a professor-coverage state.";
  }

  if (!Number.isFinite(input.personalStudyPercent)) {
    errors.personalStudyPercent = "Personal study must be a number.";
  } else if (input.personalStudyPercent < 0 || input.personalStudyPercent > 100) {
    errors.personalStudyPercent = "Personal study must be between 0 and 100.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { ...input, title, personalStudyPercent: Math.round(input.personalStudyPercent) },
  };
}

export function validateAssessmentInput(input: AssessmentInput): Validated<AssessmentInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);

  if (title.length === 0) errors.title = "Give the assessment a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;

  if (!(ASSESSMENT_CATEGORIES as readonly string[]).includes(input.category)) {
    errors.category = "Choose an assessment category.";
  }

  if (!Number.isFinite(input.totalMarks) || input.totalMarks <= 0) {
    errors.totalMarks = "Total marks must be greater than zero.";
  }

  if (!Number.isFinite(input.weightPercent) || input.weightPercent < 0 || input.weightPercent > 100) {
    errors.weightPercent = "Weight must be between 0 and 100.";
  }

  if (input.obtainedMarks !== null) {
    if (!Number.isFinite(input.obtainedMarks) || input.obtainedMarks < 0) {
      errors.obtainedMarks = "Obtained marks can't be negative.";
    } else if (Number.isFinite(input.totalMarks) && input.obtainedMarks > input.totalMarks) {
      errors.obtainedMarks = "Obtained marks can't exceed the total.";
    }
  }

  if (input.date && (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date)))) {
    errors.date = "Date must be a valid date.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, title } };
}

export function validateAttemptInput(input: AttemptInput): Validated<AttemptInput> {
  const errors: Record<string, string> = {};
  const term = clean(input.term);

  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) {
    errors.attemptNumber = "Attempt number must be a whole number ≥ 1.";
  }
  if (input.finalGrade !== null && !isGradeLetter(input.finalGrade)) {
    errors.finalGrade = "Invalid grade.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, term } };
}

// ---------------------------------------------------------------------------
// Assessment weighting — a CONFIGURATION check, never a silent fix
// ---------------------------------------------------------------------------

export type WeightingAnalysis = {
  totalWeight: number;
  gradedWeight: number;
  /**
   *  "ok"     — weights sum to 100 (± epsilon)
   *  "empty"  — no assessments configured yet
   *  "under"  — weights sum to < 100 (course is under-specified)
   *  "over"   — weights sum to > 100 (course is mis-configured)
   */
  status: "ok" | "empty" | "under" | "over";
  /** True when the current weighted score is a partial/unreliable view. */
  isConfigurationProblem: boolean;
  message: string | null;
};

export function analyzeAssessmentWeighting(
  assessments: { weightPercent: number; obtainedMarks: number | null }[],
): WeightingAnalysis {
  if (assessments.length === 0) {
    return {
      totalWeight: 0,
      gradedWeight: 0,
      status: "empty",
      isConfigurationProblem: false,
      message: "No assessments configured yet.",
    };
  }
  const totalWeight = round2(assessments.reduce((s, a) => s + (a.weightPercent || 0), 0));
  const gradedWeight = round2(
    assessments.reduce((s, a) => s + (a.obtainedMarks !== null ? a.weightPercent || 0 : 0), 0),
  );

  let status: WeightingAnalysis["status"] = "ok";
  let message: string | null = null;
  if (totalWeight > 100 + WEIGHT_EPSILON) {
    status = "over";
    message = `Assessment weights add up to ${totalWeight}%, which is over 100%. Fix the configuration — the score below is not reliable.`;
  } else if (totalWeight < 100 - WEIGHT_EPSILON) {
    status = "under";
    message = `Assessment weights add up to ${totalWeight}%, not 100%. The weighted score below only reflects the ${totalWeight}% that is configured.`;
  }

  return {
    totalWeight,
    gradedWeight,
    status,
    isConfigurationProblem: status === "over" || status === "under",
    message,
  };
}

// ---------------------------------------------------------------------------
// Deterministic calculations (unchanged from Batch 1 — verified by tests)
// ---------------------------------------------------------------------------

export type WeightedScoreInput = {
  obtainedMarks: number;
  totalMarks: number;
  weightPercent: number;
};

/** Weighted contribution of graded assessments toward a course's final score, in percentage points. */
export function calculateWeightedScore(assessments: WeightedScoreInput[]): number {
  return assessments.reduce((sum, a) => {
    if (a.totalMarks === 0) return sum;
    const scorePercent = a.obtainedMarks / a.totalMarks;
    return sum + scorePercent * a.weightPercent;
  }, 0);
}

/** SGPA for one semester: credit-hour-weighted average of grade points. */
export function calculateSGPA(
  courses: { creditHours: number; grade: GradeLetter | null }[],
): number | null {
  const graded = courses.filter((c) => c.grade !== null) as {
    creditHours: number;
    grade: GradeLetter;
  }[];
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
 * wins" replacement rule (docs/13.10 marks that RESEARCH REQUIRED). Courses
 * with more than one graded attempt are excluded and reported — the UI must
 * show this exclusion, not hide it.
 */
export function calculateCGPA(
  courses: Pick<Course, "id" | "creditHours">[],
  attemptsByCourseId: Record<string, CourseAttempt[]>,
  priorRecord?: { credits: number; points: number },
): CGPAInclusionResult {
  let totalCredits = priorRecord?.credits ?? 0;
  let totalPoints = priorRecord?.points ?? 0;
  const excludedCourseIds: string[] = [];
  let blockedByUnresolvedRepeatPolicy = false;

  for (const course of courses) {
    const attempts = (attemptsByCourseId[course.id] ?? []).filter((a) => a.finalGrade !== null);
    if (attempts.length === 0) continue;

    if (attempts.length > 1) {
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
 * Average grade points needed across the remaining (non-fixed) courses to hit
 * a target SGPA. Returns null / reachable:false rather than clamping to a
 * false number when the target is mathematically unreachable.
 */
export function calculateRequiredAverageForTarget(
  courses: { creditHours: number; grade: GradeLetter | null; isFixed: boolean }[],
  targetSGPA: number,
): { requiredAverage: number | null; reachable: boolean } {
  const totalCredits = courses.reduce((s, c) => s + c.creditHours, 0);
  if (totalCredits === 0) return { requiredAverage: null, reachable: false };

  const fixedPoints = courses
    .filter((c) => c.isFixed && c.grade !== null)
    .reduce((s, c) => s + c.creditHours * GRADE_POINTS[c.grade as GradeLetter], 0);

  const remaining = courses.filter((c) => !c.isFixed);
  const remainingCredits = remaining.reduce((s, c) => s + c.creditHours, 0);

  if (remainingCredits === 0) {
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
