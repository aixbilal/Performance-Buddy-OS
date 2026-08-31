import { describe, it, expect } from "vitest";
import { selectStudyTargets, nextStudyTarget, type StudyTopicInput } from "./studyEngine";

const t = (over: Partial<StudyTopicInput> & { academicTopicId: string }): StudyTopicInput => ({
  courseId: "c1",
  courseTitle: "Data Structures",
  topicTitle: over.academicTopicId,
  professorCoverage: "not-taught",
  personalStudyPercent: 0,
  knowledgeTopicId: null,
  knowledge: null,
  ...over,
});

describe("selectStudyTargets — explainable reason codes, no priority score", () => {
  it("normal mode ranks review-due above professor-covered above not-started", () => {
    const topics = [
      t({ academicTopicId: "not-started" }),
      t({
        academicTopicId: "covered",
        professorCoverage: "taught",
        personalStudyPercent: 40,
        knowledgeTopicId: "k1",
        knowledge: { state: "learning", hasEvidence: true, reviewDue: false },
      }),
      t({
        academicTopicId: "review",
        knowledgeTopicId: "k2",
        professorCoverage: "taught",
        personalStudyPercent: 80,
        knowledge: { state: "strong", hasEvidence: true, reviewDue: true },
      }),
    ];
    const ranked = selectStudyTargets(topics, "normal");
    expect(ranked.map((r) => r.academicTopicId)).toEqual(["review", "covered", "not-started"]);
    expect(ranked[0].reasons).toContain("review-due");
    expect(ranked[1].reasons).toContain("professor-covered-not-studied");
  });

  it("a topic with no linked concept still shows honest coverage reasons", () => {
    const [only] = selectStudyTargets([t({ academicTopicId: "x", professorCoverage: "in-progress" })], "normal");
    expect(only.knowledge).toBeNull();
    expect(only.reasons).toEqual(expect.arrayContaining(["professor-covered-not-studied", "not-started"]));
    expect(only.reasons).not.toContain("evidence-weak"); // never invents Knowledge state
  });

  it("exam mode surfaces professor-covered-but-not-nailed topics first", () => {
    const topics = [
      t({ academicTopicId: "review-only", knowledgeTopicId: "k1", knowledge: { state: "strong", hasEvidence: true, reviewDue: true } }),
      t({
        academicTopicId: "exam-gap",
        professorCoverage: "taught",
        personalStudyPercent: 30,
        knowledgeTopicId: "k2",
        knowledge: { state: "new", hasEvidence: false, reviewDue: false },
      }),
    ];
    expect(nextStudyTarget(topics, "exam")?.academicTopicId).toBe("exam-gap");
  });

  it("recovery mode only lists the weakest topics (smallest useful restart)", () => {
    const topics = [
      t({
        academicTopicId: "strong-solid",
        personalStudyPercent: 100,
        knowledgeTopicId: "k1",
        knowledge: { state: "strong", hasEvidence: true, reviewDue: false },
      }),
      t({
        academicTopicId: "weak",
        personalStudyPercent: 20,
        professorCoverage: "taught",
        knowledgeTopicId: "k2",
        knowledge: { state: "learning", hasEvidence: true, reviewDue: false },
      }),
    ];
    const ranked = selectStudyTargets(topics, "recovery");
    expect(ranked.map((r) => r.academicTopicId)).toEqual(["weak"]);
  });

  it("ordering is deterministic and stable (course then topic title on a rank tie)", () => {
    const topics = [
      t({ academicTopicId: "b", courseTitle: "Zed", personalStudyPercent: 0 }),
      t({ academicTopicId: "a", courseTitle: "Alpha", personalStudyPercent: 0 }),
    ];
    expect(selectStudyTargets(topics, "normal").map((r) => r.courseTitle)).toEqual(["Alpha", "Zed"]);
  });
});
