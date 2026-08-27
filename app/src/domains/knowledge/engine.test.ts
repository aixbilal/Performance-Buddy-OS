import { describe, it, expect } from "vitest";
import { deriveKnowledgeState, isReviewDue, computeMasteryFromEvidence } from "./engine";
import type { Evidence } from "./types";

describe("deriveKnowledgeState", () => {
  it("maps 0% to new", () => {
    expect(deriveKnowledgeState(0)).toBe("new");
  });
  it("maps low mastery to learning", () => {
    expect(deriveKnowledgeState(35)).toBe("learning");
  });
  it("maps mid mastery to developing", () => {
    expect(deriveKnowledgeState(55)).toBe("developing");
  });
  it("maps high mastery to strong", () => {
    expect(deriveKnowledgeState(85)).toBe("strong");
  });
  it("boundary: exactly 75 counts as strong, not developing", () => {
    expect(deriveKnowledgeState(75)).toBe("strong");
  });
});

describe("isReviewDue", () => {
  it("is false when there is no scheduled review", () => {
    expect(isReviewDue(null)).toBe(false);
  });
  it("is true when the review date is in the past", () => {
    expect(isReviewDue("2020-01-01")).toBe(true);
  });
  it("is false when the review date is in the future", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isReviewDue(future.toISOString())).toBe(false);
  });
});

describe("computeMasteryFromEvidence", () => {
  it("returns 0 with no evidence, never a fabricated number", () => {
    expect(computeMasteryFromEvidence([])).toBe(0);
  });

  it("computes a simple average correctly for equal single-item case", () => {
    const evidence: Evidence[] = [
      { id: "e1", topicId: "t1", type: "quiz", title: "Q1", score: 8, maxScore: 10, date: "2026-08-01" },
    ];
    expect(computeMasteryFromEvidence(evidence)).toBe(80);
  });

  it("weights more recent evidence more heavily than older evidence", () => {
    // Old: 40% (weight 1). New: 90% (weight 2).
    // Weighted = (40*1 + 90*2) / (1+2) = (40+180)/3 = 220/3 = 73.33 -> rounds to 73
    const evidence: Evidence[] = [
      { id: "e1", topicId: "t1", type: "quiz", title: "Old", score: 4, maxScore: 10, date: "2026-01-01" },
      { id: "e2", topicId: "t1", type: "quiz", title: "New", score: 9, maxScore: 10, date: "2026-08-01" },
    ];
    expect(computeMasteryFromEvidence(evidence)).toBe(73);
  });
});
