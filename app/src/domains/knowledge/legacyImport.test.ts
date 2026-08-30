import { describe, it, expect } from "vitest";
import { resolveLegacyKnowledge } from "./legacyImport";

const LEGACY = {
  topics: JSON.stringify([
    {
      id: "topic-binary-trees",
      title: "Binary Trees",
      category: "academic",
      context: "Data Structures",
      masteryPercent: 62, // legacy stored number — must be DROPPED
      lastStudied: "2026-08-26",
      nextReviewDate: "2026-08-29",
      relatedGoalId: null,
    },
    { id: "topic-binary-trees", title: "dupe" }, // duplicate id
  ]),
  sources: JSON.stringify([
    { id: "s1", topicId: "topic-binary-trees", type: "obsidian-note", title: "Notes", reference: "O/BT.md", addedDate: "2026-08-24" },
    { id: "s-ghost", topicId: "no-such-topic", type: "article", title: "Orphan", reference: "", addedDate: "" },
  ]),
  evidence: JSON.stringify([
    { id: "e1", topicId: "topic-binary-trees", type: "recall", title: "Drill", score: 9, maxScore: 10, date: "2026-08-13" },
    { id: "e-ghost", topicId: "no-such-topic", type: "quiz", title: "Orphan", score: 1, maxScore: 2, date: "" },
    { id: "e-bad", topicId: "topic-binary-trees", type: "quiz", title: "Bad", score: 1, maxScore: 0, date: "" },
  ]),
};

describe("resolveLegacyKnowledge", () => {
  const { graph, report } = resolveLegacyKnowledge(LEGACY);

  it("preserves topic IDs and skips a duplicate", () => {
    expect(graph.topics.map((t) => t.id)).toEqual(["topic-binary-trees"]);
    expect(report.repairs.join(" ")).toMatch(/duplicate topic id/);
  });

  it("DROPS the legacy stored masteryPercent — mastery is evidence-derived now", () => {
    const t = graph.topics[0];
    expect("masteryPercent" in t).toBe(false);
    expect(report.repairs.join(" ")).toMatch(/dropped stored masteryPercent/);
  });

  it("keeps review metadata (lastStudied / nextReviewDate) as independent facts", () => {
    expect(graph.topics[0].lastStudied).toBe("2026-08-26");
    expect(graph.topics[0].nextReviewDate).toBe("2026-08-29");
  });

  it("drops dangling sources / evidence (missing topic) and reports them", () => {
    expect(graph.sources.map((s) => s.id)).toEqual(["s1"]);
    expect(graph.evidence.map((e) => e.id)).toEqual(["e1"]);
    expect(report.repairs.join(" ")).toMatch(/s-ghost .* dropped/);
    expect(report.repairs.join(" ")).toMatch(/e-ghost .* dropped/);
  });

  it("drops evidence with an unusable score/maxScore rather than inventing one", () => {
    expect(graph.evidence.find((e) => e.id === "e-bad")).toBeUndefined();
    expect(report.repairs.join(" ")).toMatch(/e-bad: unusable/);
  });

  it("reports malformed blobs instead of throwing", () => {
    const r = resolveLegacyKnowledge({ topics: "{bad", sources: null, evidence: "[]" });
    expect(r.report.malformed).toContain("pbos:knowledge-topics");
    expect(r.graph.topics).toEqual([]);
  });

  it("empty input yields an empty graph (fresh profile)", () => {
    const r = resolveLegacyKnowledge({ topics: null, sources: null, evidence: null });
    expect(r.graph).toEqual({ topics: [], sources: [], evidence: [] });
  });
});
