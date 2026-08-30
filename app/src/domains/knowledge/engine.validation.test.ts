import { describe, it, expect } from "vitest";
import {
  deriveTopicView,
  validateEvidenceInput,
  validateReviewStateInput,
  validateSourceInput,
  validateTopicInput,
} from "./engine";
import type { Evidence } from "./types";

const ev = (id: string, score: number, maxScore: number, date: string): Evidence => ({
  id,
  topicId: "t1",
  type: "recall",
  title: `E ${id}`,
  score,
  maxScore,
  date,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("validateTopicInput", () => {
  it("accepts a well-formed topic and trims", () => {
    const r = validateTopicInput({
      title: "  Binary   Trees  ",
      category: "academic",
      context: " Data Structures ",
      relatedGoalId: null,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Binary Trees");
      expect(r.value.context).toBe("Data Structures");
    }
  });
  it("rejects empty title / bad category", () => {
    expect(validateTopicInput({ title: "", category: "academic", context: "", relatedGoalId: null }).ok).toBe(false);
    expect(validateTopicInput({ title: "X", category: "nope" as never, context: "", relatedGoalId: null }).ok).toBe(false);
  });
});

describe("validateSourceInput — a reference, never note content", () => {
  it("accepts a reference-only source", () => {
    const r = validateSourceInput({ type: "obsidian-note", title: "My Notes", reference: "Obsidian/DSA/Trees.md" });
    expect(r.ok).toBe(true);
  });
  it("rejects empty title / bad type", () => {
    expect(validateSourceInput({ type: "article", title: "  ", reference: "" }).ok).toBe(false);
    expect(validateSourceInput({ type: "scroll" as never, title: "X", reference: "" }).ok).toBe(false);
  });
});

describe("validateEvidenceInput — mastery only moves on real evidence", () => {
  it("accepts score ≤ maxScore", () => {
    expect(
      validateEvidenceInput({ type: "recall", title: "Drill", score: 9, maxScore: 10, date: "2026-08-13" }).ok,
    ).toBe(true);
  });
  it("rejects score > maxScore, negative score, non-positive maxScore", () => {
    expect(validateEvidenceInput({ type: "recall", title: "x", score: 11, maxScore: 10, date: "" }).ok).toBe(false);
    expect(validateEvidenceInput({ type: "recall", title: "x", score: -1, maxScore: 10, date: "" }).ok).toBe(false);
    expect(validateEvidenceInput({ type: "recall", title: "x", score: 1, maxScore: 0, date: "" }).ok).toBe(false);
  });
  it("rejects an empty title (an unlabeled score is not evidence)", () => {
    expect(validateEvidenceInput({ type: "recall", title: "", score: 5, maxScore: 10, date: "" }).ok).toBe(false);
  });
});

describe("validateReviewStateInput", () => {
  it("accepts null or valid ISO dates", () => {
    expect(validateReviewStateInput({ lastStudied: null, nextReviewDate: null }).ok).toBe(true);
    expect(validateReviewStateInput({ lastStudied: "2026-08-01", nextReviewDate: "2026-08-15" }).ok).toBe(true);
  });
  it("rejects a garbage date", () => {
    expect(validateReviewStateInput({ lastStudied: "soon", nextReviewDate: null }).ok).toBe(false);
  });
});

describe("deriveTopicView — insufficient evidence is explicit, not hidden behind 0", () => {
  it("no evidence → hasEvidence:false, mastery 0, state 'new'", () => {
    const v = deriveTopicView([]);
    expect(v).toEqual({ masteryPercent: 0, hasEvidence: false, state: "new" });
  });
  it("with evidence → hasEvidence:true and a recency-weighted mastery", () => {
    const v = deriveTopicView([ev("e1", 4, 10, "2026-01-01"), ev("e2", 9, 10, "2026-08-01")]);
    expect(v.hasEvidence).toBe(true);
    expect(v.masteryPercent).toBe(73);
    expect(v.state).toBe("developing");
  });
});
