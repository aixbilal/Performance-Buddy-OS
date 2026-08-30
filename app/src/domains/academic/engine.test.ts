import { describe, it, expect } from "vitest";
import {
  calculateWeightedScore,
  calculateSGPA,
  calculateCGPA,
  calculateRequiredAverageForTarget,
} from "./engine";
import type { CourseAttempt, GradeLetter } from "./types";

/** Test helper — attempts now carry timestamps; the calc functions ignore them. */
const att = (
  id: string,
  courseId: string,
  attemptNumber: number,
  term: string,
  finalGrade: GradeLetter | null,
): CourseAttempt => ({
  id,
  courseId,
  attemptNumber,
  term,
  finalGrade,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("calculateWeightedScore", () => {
  it("computes a single assessment correctly", () => {
    // 18/20 at 20% weight = 90% * 20 = 18 percentage points
    expect(calculateWeightedScore([{ obtainedMarks: 18, totalMarks: 20, weightPercent: 20 }])).toBe(18);
  });

  it("sums multiple weighted assessments correctly", () => {
    // Quiz: 18/20 @ 10% = 9
    // Assignment: 45/50 @ 20% = 18
    // Midterm: 70/100 @ 30% = 21
    // Total = 48
    const result = calculateWeightedScore([
      { obtainedMarks: 18, totalMarks: 20, weightPercent: 10 },
      { obtainedMarks: 45, totalMarks: 50, weightPercent: 20 },
      { obtainedMarks: 70, totalMarks: 100, weightPercent: 30 },
    ]);
    expect(result).toBe(48);
  });

  it("does not divide by zero when totalMarks is 0", () => {
    expect(calculateWeightedScore([{ obtainedMarks: 0, totalMarks: 0, weightPercent: 20 }])).toBe(0);
  });
});

describe("calculateSGPA", () => {
  it("matches the known-correct textbook example: 3 courses, mixed grades", () => {
    // (4cr * A(4.0)) + (3cr * B+(3.3)) + (3cr * B-(2.7))
    // = 16 + 9.9 + 8.1 = 34 / 10 credits = 3.40
    const sgpa = calculateSGPA([
      { creditHours: 4, grade: "A" },
      { creditHours: 3, grade: "B+" },
      { creditHours: 3, grade: "B-" },
    ]);
    expect(sgpa).toBe(3.4);
  });

  it("ignores ungraded courses rather than treating them as zero", () => {
    // Only the A- course counts: 3cr * 3.7 = 11.1 / 3 = 3.70
    const sgpa = calculateSGPA([
      { creditHours: 3, grade: "A-" },
      { creditHours: 4, grade: null },
    ]);
    expect(sgpa).toBe(3.7);
  });

  it("returns null when nothing is graded yet, not 0", () => {
    expect(calculateSGPA([{ creditHours: 3, grade: null }])).toBeNull();
  });
});

describe("calculateCGPA — repeat policy honesty (docs/13.10)", () => {
  it("computes CGPA normally when every course has exactly one attempt", () => {
    const result = calculateCGPA(
      [
        { id: "c1", creditHours: 4 },
        { id: "c2", creditHours: 3 },
      ],
      {
        c1: [att("a1", "c1", 1, "S1", "A")],
        c2: [att("a2", "c2", 1, "S1", "B")],
      }
    );
    // (4*4.0 + 3*3.0) / 7 = 25/7 = 3.5714... -> 3.57
    expect(result.cgpa).toBe(3.57);
    expect(result.blockedByUnresolvedRepeatPolicy).toBe(false);
    expect(result.excludedCourseIds).toEqual([]);
  });

  it("excludes a repeated course and flags the block, rather than silently picking the better grade", () => {
    const result = calculateCGPA(
      [
        { id: "c1", creditHours: 4 }, // repeated
        { id: "c2", creditHours: 3 }, // single attempt
      ],
      {
        c1: [att("a1", "c1", 1, "S1", "D"), att("a2", "c1", 2, "S2", "A-")],
        c2: [att("a3", "c2", 1, "S1", "B")],
      }
    );
    // c1 excluded entirely (repeat policy unresolved) — only c2 counts: 3*3.0/3 = 3.0
    expect(result.cgpa).toBe(3.0);
    expect(result.totalCreditsCounted).toBe(3);
    expect(result.blockedByUnresolvedRepeatPolicy).toBe(true);
    expect(result.excludedCourseIds).toEqual(["c1"]);
  });

  it("does not include ungraded attempts as zero", () => {
    const result = calculateCGPA(
      [{ id: "c1", creditHours: 4 }],
      { c1: [att("a1", "c1", 1, "S1", null)] }
    );
    expect(result.cgpa).toBeNull();
    expect(result.blockedByUnresolvedRepeatPolicy).toBe(false);
  });

  it("folds in a prior settled record correctly alongside live courses", () => {
    // Prior: 45 credits @ 2.64 CGPA = 118.8 points (already settled, not a repeat decision)
    // Live: 1 course, 4cr @ A(4.0) = 16 points
    // Total: (118.8 + 16) / (45 + 4) = 134.8 / 49 = 2.7510... -> 2.75
    const result = calculateCGPA(
      [{ id: "c1", creditHours: 4 }],
      { c1: [att("a1", "c1", 1, "S3", "A")] },
      { credits: 45, points: 2.64 * 45 }
    );
    expect(result.cgpa).toBe(2.75);
  });
});

describe("calculateRequiredAverageForTarget", () => {
  it("computes the exact average needed on remaining courses to hit a target SGPA", () => {
    // Total 10 credits. Fixed: 4cr @ B(3.0) = 12 points already locked in.
    // Target 3.70 SGPA over 10 credits = 37 total points needed.
    // Remaining 6 credits need 37 - 12 = 25 points / 6 credits = 4.1667 -> 4.17
    const result = calculateRequiredAverageForTarget(
      [
        { creditHours: 4, grade: "B", isFixed: true },
        { creditHours: 3, grade: null, isFixed: false },
        { creditHours: 3, grade: null, isFixed: false },
      ],
      3.7
    );
    expect(result.requiredAverage).toBe(4.17);
    expect(result.reachable).toBe(false); // >4.0 average is not achievable — correctly flagged
  });

  it("flags an achievable target as reachable", () => {
    // Fixed: 4cr @ A(4.0) = 16. Target 3.5 over 10 credits = 35 total.
    // Remaining 6cr need 19/6 = 3.1667 -> 3.17, which is achievable.
    const result = calculateRequiredAverageForTarget(
      [
        { creditHours: 4, grade: "A", isFixed: true },
        { creditHours: 6, grade: null, isFixed: false },
      ],
      3.5
    );
    expect(result.requiredAverage).toBe(3.17);
    expect(result.reachable).toBe(true);
  });
});
