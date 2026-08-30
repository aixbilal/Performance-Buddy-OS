import { describe, it, expect } from "vitest";
import {
  analyzeAssessmentWeighting,
  validateAssessmentInput,
  validateAttemptInput,
  validateCourseInput,
  validateTopicInput,
} from "./engine";
import type { AssessmentInput, CourseInput, TopicInput } from "./types";

const courseInput = (over: Partial<CourseInput> = {}): CourseInput => ({
  code: "CSE 201",
  title: "Data Structures",
  creditHours: 4,
  professorName: "Prof. Sharma",
  status: "on-track",
  targetGrade: "A",
  projectedGrade: null,
  semesterId: null,
  ...over,
});

const topicInput = (over: Partial<TopicInput> = {}): TopicInput => ({
  title: "Binary Trees",
  professorCoverage: "taught",
  personalStudyPercent: 40,
  ...over,
});

const assessmentInput = (over: Partial<AssessmentInput> = {}): AssessmentInput => ({
  category: "quiz",
  title: "Quiz 1",
  obtainedMarks: 18,
  totalMarks: 20,
  weightPercent: 10,
  date: "2026-04-10",
  ...over,
});

describe("validateCourseInput", () => {
  it("accepts a well-formed course and trims text", () => {
    const r = validateCourseInput(courseInput({ title: "  Data   Structures  ", code: " CSE 201 " }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Data Structures");
      expect(r.value.code).toBe("CSE 201");
    }
  });

  it("rejects an empty title", () => {
    const r = validateCourseInput(courseInput({ title: "   " }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.title).toBeDefined();
  });

  it("rejects credit hours outside 0.5–12", () => {
    expect(validateCourseInput(courseInput({ creditHours: 0 })).ok).toBe(false);
    expect(validateCourseInput(courseInput({ creditHours: 20 })).ok).toBe(false);
    expect(validateCourseInput(courseInput({ creditHours: Number.NaN })).ok).toBe(false);
  });

  it("rejects a non-letter grade but allows null", () => {
    expect(validateCourseInput(courseInput({ targetGrade: "Z" as never })).ok).toBe(false);
    expect(validateCourseInput(courseInput({ targetGrade: null })).ok).toBe(true);
  });
});

describe("validateTopicInput — Professor / Personal are independent, no mastery here", () => {
  it("accepts independent coverage + personal-study values", () => {
    const r = validateTopicInput(topicInput({ professorCoverage: "not-taught", personalStudyPercent: 90 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.professorCoverage).toBe("not-taught");
      expect(r.value.personalStudyPercent).toBe(90);
    }
  });

  it("has no mastery field on the validated shape", () => {
    const r = validateTopicInput(topicInput());
    expect(r.ok).toBe(true);
    if (r.ok) expect("masteryPercent" in r.value).toBe(false);
  });

  it("rejects personal study outside 0–100 (UNKNOWN ≠ silently clamped)", () => {
    expect(validateTopicInput(topicInput({ personalStudyPercent: -5 })).ok).toBe(false);
    expect(validateTopicInput(topicInput({ personalStudyPercent: 150 })).ok).toBe(false);
  });

  it("rejects an invalid coverage state", () => {
    expect(validateTopicInput(topicInput({ professorCoverage: "done" as never })).ok).toBe(false);
  });
});

describe("validateAssessmentInput — marks bounds", () => {
  it("accepts obtained ≤ total", () => {
    expect(validateAssessmentInput(assessmentInput({ obtainedMarks: 20, totalMarks: 20 })).ok).toBe(true);
  });
  it("rejects obtained > total", () => {
    const r = validateAssessmentInput(assessmentInput({ obtainedMarks: 25, totalMarks: 20 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.obtainedMarks).toBeDefined();
  });
  it("rejects negative obtained and non-positive total", () => {
    expect(validateAssessmentInput(assessmentInput({ obtainedMarks: -1 })).ok).toBe(false);
    expect(validateAssessmentInput(assessmentInput({ totalMarks: 0 })).ok).toBe(false);
  });
  it("rejects weight outside 0–100", () => {
    expect(validateAssessmentInput(assessmentInput({ weightPercent: 120 })).ok).toBe(false);
  });
  it("allows a not-yet-graded assessment (obtainedMarks null)", () => {
    expect(validateAssessmentInput(assessmentInput({ obtainedMarks: null })).ok).toBe(true);
  });
});

describe("validateAttemptInput — no invented grade rules", () => {
  it("stores a user-entered letter verbatim, or null", () => {
    const r = validateAttemptInput({ attemptNumber: 1, term: "Fall 2026", finalGrade: "B+" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.finalGrade).toBe("B+");
    expect(validateAttemptInput({ attemptNumber: 1, term: "x", finalGrade: null }).ok).toBe(true);
  });
  it("rejects attemptNumber < 1", () => {
    expect(validateAttemptInput({ attemptNumber: 0, term: "x", finalGrade: null }).ok).toBe(false);
  });
});

describe("analyzeAssessmentWeighting — a configuration problem, never a silent fix", () => {
  it("reports 'empty' with no assessments (not a problem, just unconfigured)", () => {
    const a = analyzeAssessmentWeighting([]);
    expect(a.status).toBe("empty");
    expect(a.isConfigurationProblem).toBe(false);
  });

  it("reports 'ok' when weights sum to 100", () => {
    const a = analyzeAssessmentWeighting([
      { weightPercent: 40, obtainedMarks: 10 },
      { weightPercent: 60, obtainedMarks: null },
    ]);
    expect(a.status).toBe("ok");
    expect(a.totalWeight).toBe(100);
  });

  it("flags 'under' without normalizing the numbers", () => {
    const a = analyzeAssessmentWeighting([
      { weightPercent: 30, obtainedMarks: 10 },
      { weightPercent: 40, obtainedMarks: null },
    ]);
    expect(a.status).toBe("under");
    expect(a.isConfigurationProblem).toBe(true);
    expect(a.totalWeight).toBe(70); // NOT rescaled to 100
    expect(a.message).toMatch(/70%/);
  });

  it("flags 'over' when weights exceed 100", () => {
    const a = analyzeAssessmentWeighting([
      { weightPercent: 70, obtainedMarks: 10 },
      { weightPercent: 50, obtainedMarks: 10 },
    ]);
    expect(a.status).toBe("over");
    expect(a.isConfigurationProblem).toBe(true);
    expect(a.totalWeight).toBe(120);
  });
});
