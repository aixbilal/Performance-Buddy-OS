import { describe, it, expect } from "vitest";
import {
  ATTENTION_CONFIG,
  deriveCourseAttention,
  nearestScopedAssessment,
  reasonsForSignal,
  selectStudyRequirements,
  type AcademicTopicSignal,
} from "./attentionEngine";

const NOW = new Date("2026-09-01T00:00:00.000Z");

function signal(over: Partial<AcademicTopicSignal> = {}): AcademicTopicSignal {
  return {
    academicTopicId: "t1",
    courseId: "c1",
    courseTitle: "Data Structures",
    topicTitle: "AVL Trees",
    professorCoverage: "not-taught",
    personalStudyPercent: 0,
    knowledgeTopicId: null,
    knowledge: null,
    scopedAssessments: [],
    daysSinceLastFocus: null,
    unresolvedWeaknessStreak: 0,
    userPriority: false,
    suggestedMinutes: null,
    ...over,
  };
}

describe("nearestScopedAssessment", () => {
  it("picks the soonest scoped assessment that is not in the past", () => {
    const t = signal({
      scopedAssessments: [
        { assessmentId: "a1", title: "Old", date: "2026-08-01", weightPercent: 10 },
        { assessmentId: "a2", title: "Mid", date: "2026-09-20", weightPercent: 30 },
        { assessmentId: "a3", title: "Final", date: "2026-12-01", weightPercent: 40 },
      ],
    });
    expect(nearestScopedAssessment(t, NOW)?.assessmentId).toBe("a2");
  });
  it("returns null with no scoped assessments (unknown scope, never inferred)", () => {
    expect(nearestScopedAssessment(signal(), NOW)).toBeNull();
  });
});

describe("reasonsForSignal", () => {
  it("a scoped, imminent, high-weight, unstudied taught topic collects the expected reasons", () => {
    const t = signal({
      professorCoverage: "taught",
      personalStudyPercent: 10,
      knowledgeTopicId: "k1",
      knowledge: { state: "learning", hasEvidence: true, reviewDue: false },
      scopedAssessments: [{ assessmentId: "a1", title: "Midterm", date: "2026-09-05", weightPercent: 30 }],
    });
    const r = reasonsForSignal(t, NOW);
    expect(r).toEqual(
      expect.arrayContaining([
        "in-assessment-scope",
        "assessment-imminent",
        "high-weight-assessment",
        "professor-covered-not-studied",
        "evidence-weak",
        "in-progress",
      ]),
    );
  });
  it("no evidence stays `no-evidence`, never a mastery number", () => {
    const r = reasonsForSignal(signal({ knowledgeTopicId: "k1", knowledge: { state: "new", hasEvidence: false, reviewDue: false } }), NOW);
    expect(r).toContain("no-evidence");
    expect(r).not.toContain("evidence-weak");
  });
  it("a distant assessment is in scope but not imminent", () => {
    const r = reasonsForSignal(
      signal({ scopedAssessments: [{ assessmentId: "a1", title: "Final", date: "2026-12-01", weightPercent: 40 }] }),
      NOW,
    );
    expect(r).toContain("in-assessment-scope");
    expect(r).not.toContain("assessment-imminent");
  });
  it("repeated weakness streak trips `repeated-unresolved-weakness`", () => {
    const r = reasonsForSignal(
      signal({
        knowledgeTopicId: "k1",
        knowledge: { state: "learning", hasEvidence: true, reviewDue: false },
        unresolvedWeaknessStreak: ATTENTION_CONFIG.repeatedWeaknessStreak,
      }),
      NOW,
    );
    expect(r).toContain("repeated-unresolved-weakness");
  });
});

describe("selectStudyRequirements", () => {
  it("exam mode puts a scoped, weak topic ahead of an unscoped weak topic", () => {
    const scopedWeak = signal({
      academicTopicId: "scoped",
      topicTitle: "Scoped Weak",
      professorCoverage: "taught",
      knowledgeTopicId: "k1",
      knowledge: { state: "learning", hasEvidence: true, reviewDue: false },
      scopedAssessments: [{ assessmentId: "a1", title: "Final", date: "2026-09-20", weightPercent: 40 }],
    });
    const unscopedWeak = signal({
      academicTopicId: "unscoped",
      topicTitle: "Unscoped Weak",
      professorCoverage: "taught",
      knowledgeTopicId: "k2",
      knowledge: { state: "learning", hasEvidence: true, reviewDue: false },
    });
    const reqs = selectStudyRequirements([unscopedWeak, scopedWeak], "exam", NOW);
    expect(reqs[0].academicTopicId).toBe("scoped");
    expect(reqs[0].reasons).toContain("in-assessment-scope");
    expect(reqs[0].requiredBefore).toBe("2026-09-20");
  });

  it("exam mode never invents scope — with no scoped assessments it still ranks by taught weakness", () => {
    const reqs = selectStudyRequirements(
      [
        signal({ academicTopicId: "a", topicTitle: "A", professorCoverage: "taught", knowledgeTopicId: "k1", knowledge: { state: "learning", hasEvidence: true, reviewDue: false } }),
        signal({ academicTopicId: "b", topicTitle: "B", professorCoverage: "not-taught" }),
      ],
      "exam",
      NOW,
    );
    expect(reqs.every((r) => !r.reasons.includes("in-assessment-scope"))).toBe(true);
    expect(reqs[0].academicTopicId).toBe("a");
  });

  it("repeated weakness produces a method-change suggestion, not a mastery change", () => {
    const reqs = selectStudyRequirements(
      [
        signal({
          professorCoverage: "taught",
          knowledgeTopicId: "k1",
          knowledge: { state: "learning", hasEvidence: true, reviewDue: false },
          unresolvedWeaknessStreak: 4,
        }),
      ],
      "normal",
      NOW,
    );
    expect(reqs[0].methodSuggestion).toMatch(/different method/i);
    expect(reqs[0].evidenceState).toBe("weak");
  });

  it("recovery mode surfaces only the weakest and skips healthy topics", () => {
    const reqs = selectStudyRequirements(
      [
        signal({ academicTopicId: "weak", professorCoverage: "taught", knowledgeTopicId: "k1", knowledge: { state: "new", hasEvidence: true, reviewDue: false } }),
        signal({ academicTopicId: "fine", personalStudyPercent: 100, knowledgeTopicId: "k2", knowledge: { state: "strong", hasEvidence: true, reviewDue: false } }),
      ],
      "recovery",
      NOW,
    );
    expect(reqs.map((r) => r.academicTopicId)).toEqual(["weak"]);
  });

  it("carries suggested + minimum block minutes without inventing an estimate", () => {
    const withEst = selectStudyRequirements([signal({ personalStudyPercent: 20, suggestedMinutes: 90 })], "normal", NOW)[0];
    expect(withEst.suggestedMinutes).toBe(90);
    expect(withEst.minimumBlockMinutes).toBe(ATTENTION_CONFIG.defaultMinimumBlockMinutes);
    const noEst = selectStudyRequirements([signal({ personalStudyPercent: 20 })], "normal", NOW)[0];
    expect(noEst.suggestedMinutes).toBe(ATTENTION_CONFIG.fallbackSuggestedMinutes);
  });
});

describe("deriveCourseAttention", () => {
  it("Immediate when a scoped topic is unresolved with an imminent assessment", () => {
    const att = deriveCourseAttention(
      "c1",
      [
        signal({
          professorCoverage: "taught",
          knowledgeTopicId: "k1",
          knowledge: { state: "new", hasEvidence: false, reviewDue: false },
          scopedAssessments: [{ assessmentId: "a1", title: "Midterm", date: "2026-09-04", weightPercent: 30 }],
        }),
      ],
      NOW,
    );
    expect(att.state).toBe("immediate");
  });

  it("Watch when there is a coverage/evidence gap but no imminent assessed pressure", () => {
    const att = deriveCourseAttention(
      "c1",
      [signal({ professorCoverage: "taught", personalStudyPercent: 20 })],
      NOW,
    );
    expect(att.state).toBe("watch");
    expect(att.reasons.join(" ")).toMatch(/covered but not studied/);
  });

  it("Stable when nothing is pressing", () => {
    const att = deriveCourseAttention(
      "c1",
      [signal({ personalStudyPercent: 100, knowledgeTopicId: "k1", knowledge: { state: "strong", hasEvidence: true, reviewDue: false } })],
      NOW,
    );
    expect(att.state).toBe("stable");
  });

  it("never returns a Course.status value — only a derived attention state", () => {
    const att = deriveCourseAttention("c1", [signal()], NOW);
    expect(["immediate", "watch", "stable"]).toContain(att.state);
  });
});
