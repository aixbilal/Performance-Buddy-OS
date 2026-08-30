import { describe, it, expect } from "vitest";
import { resolveLegacyAcademic } from "./legacyImport";

const LEGACY = {
  courses: JSON.stringify([
    {
      id: "dsa",
      code: "CSE 201",
      title: "Data Structures",
      creditHours: 4,
      semesterId: "sem-3",
      professorName: "Prof. Sharma",
      status: "at-risk",
      targetGrade: "A-",
      projectedGrade: "B+",
    },
    { id: "dsa", title: "dupe", creditHours: 3 }, // duplicate id
  ]),
  topics: JSON.stringify([
    {
      id: "t-trees",
      courseId: "dsa",
      title: "Trees",
      order: 2,
      professorCoverage: "taught",
      personalStudyPercent: 30,
      masteryPercent: 55, // legacy stored number
    },
    { id: "t-arrays", courseId: "dsa", title: "Arrays", order: 1, professorCoverage: "taught", personalStudyPercent: 100, masteryPercent: 80 },
    { id: "t-ghost", courseId: "no-such-course", title: "Orphan", order: 3 },
  ]),
  assessments: JSON.stringify([
    { id: "as1", courseId: "dsa", category: "quiz", title: "Quiz 1", obtainedMarks: 18, totalMarks: 20, weightPercent: 10, date: "2026-04-10" },
    { id: "as-ghost", courseId: "no-such-course", category: "quiz", title: "Orphan", obtainedMarks: 1, totalMarks: 2, weightPercent: 5, date: "" },
  ]),
  attempts: JSON.stringify({
    dsa: [{ id: "att-1", courseId: "dsa", attemptNumber: 1, term: "Fall 2026", finalGrade: null }],
    "no-such-course": [{ id: "att-ghost", courseId: "no-such-course", attemptNumber: 1, term: "x", finalGrade: "A" }],
  }),
};

describe("resolveLegacyAcademic", () => {
  const { graph, report } = resolveLegacyAcademic(LEGACY);

  it("preserves IDs and skips a duplicate course id", () => {
    expect(graph.courses.map((c) => c.id)).toEqual(["dsa"]);
    expect(report.repairs.join(" ")).toMatch(/duplicate course id dsa/);
  });

  it("synthesises a semester from the courses' semesterId and marks it current", () => {
    expect(graph.semesters.map((s) => s.id)).toEqual(["sem-3"]);
    expect(graph.semesters[0].isCurrent).toBe(true);
  });

  it("maps legacy `order` → `position` and sorts topics by it", () => {
    const forDsa = graph.topics.filter((t) => t.courseId === "dsa");
    expect(forDsa.map((t) => t.title)).toEqual(["Arrays", "Trees"]);
    expect(forDsa.map((t) => t.position)).toEqual([0, 1]);
  });

  it("preserves legacy masteryPercent ONLY as masterySelfAssessed — never as mastery truth", () => {
    const trees = graph.topics.find((t) => t.id === "t-trees")!;
    expect(trees.masterySelfAssessed).toBe(55);
    expect("masteryPercent" in trees).toBe(false);
    expect(trees.knowledgeTopicId).toBeNull();
  });

  it("drops rows whose parent course is missing and reports them", () => {
    expect(graph.topics.find((t) => t.id === "t-ghost")).toBeUndefined();
    expect(graph.assessments.find((a) => a.id === "as-ghost")).toBeUndefined();
    expect(graph.attempts.find((a) => a.id === "att-ghost")).toBeUndefined();
    expect(report.repairs.join(" ")).toMatch(/t-ghost .* dropped/);
    expect(report.repairs.join(" ")).toMatch(/att-ghost .* dropped/);
  });

  it("flattens the legacy attempts MAP into a flat array", () => {
    expect(graph.attempts.map((a) => a.id)).toEqual(["att-1"]);
    expect(graph.attempts[0].finalGrade).toBeNull();
  });

  it("does not invent grades — an unrecognised grade becomes null and is reported", () => {
    const { graph: g, report: r } = resolveLegacyAcademic({
      ...LEGACY,
      courses: JSON.stringify([{ id: "x", title: "X", creditHours: 3, projectedGrade: "PASS" }]),
    });
    expect(g.courses[0].projectedGrade).toBeNull();
    expect(r.repairs.join(" ")).toMatch(/unrecognised grade/);
  });

  it("reports malformed blobs instead of throwing", () => {
    const r = resolveLegacyAcademic({ courses: "{not json", topics: null, assessments: "[]", attempts: null });
    expect(r.report.malformed).toContain("pbos:academic-courses");
    expect(r.graph.courses).toEqual([]);
  });

  it("empty input yields an empty graph (fresh profile)", () => {
    const r = resolveLegacyAcademic({ courses: null, topics: null, assessments: null, attempts: null });
    expect(r.graph).toEqual({ semesters: [], courses: [], topics: [], assessments: [], attempts: [] });
  });
});
