import { describe, it, expect } from "vitest";
import { derivePercentToLevel, computeEvidenceScore } from "./engine";
import type { SkillEvidence } from "./types";

describe("derivePercentToLevel", () => {
  it("maps 0 to not-started", () => {
    expect(derivePercentToLevel(0)).toBe("not-started");
  });
  it("maps 39 to learning (boundary)", () => {
    expect(derivePercentToLevel(39)).toBe("learning");
  });
  it("maps 40 to developing (boundary)", () => {
    expect(derivePercentToLevel(40)).toBe("developing");
  });
  it("maps 75 to strong (boundary)", () => {
    expect(derivePercentToLevel(75)).toBe("strong");
  });
});

describe("computeEvidenceScore — provenance honesty (Master Handoff §14)", () => {
  it("returns 0 with no evidence, never a fabricated number", () => {
    const result = computeEvidenceScore([]);
    expect(result.evidencePercent).toBe(0);
    expect(result.countedCount).toBe(0);
    expect(result.excludedCount).toBe(0);
  });

  it("counts independent evidence fully", () => {
    const evidence: SkillEvidence[] = [
      { id: "e1", skillId: "s1", projectId: null, title: "Built CRUD API alone", provenance: "independent", date: "2026-08-01" },
      { id: "e2", skillId: "s1", projectId: null, title: "Debugged auth bug", provenance: "independent", date: "2026-08-05" },
    ];
    const result = computeEvidenceScore(evidence);
    expect(result.evidencePercent).toBe(100);
    expect(result.countedCount).toBe(2);
    expect(result.excludedCount).toBe(0);
  });

  it("excludes pure AI-assisted evidence from the score, but still reports it exists", () => {
    const evidence: SkillEvidence[] = [
      { id: "e1", skillId: "s1", projectId: "p1", title: "Independent CRUD implementation", provenance: "independent", date: "2026-08-01" },
      { id: "e2", skillId: "s1", projectId: "p1", title: "AI wrote the auth flow, not reviewed", provenance: "ai-assisted", date: "2026-08-10" },
    ];
    const result = computeEvidenceScore(evidence);
    // Only 1 of 2 counts -> 50%, not 100%, even though 2 pieces of evidence exist
    expect(result.evidencePercent).toBe(50);
    expect(result.countedCount).toBe(1);
    expect(result.excludedCount).toBe(1);
  });

  it("treats ai-assisted-reviewed as counting, unlike raw ai-assisted", () => {
    const evidence: SkillEvidence[] = [
      { id: "e1", skillId: "s1", projectId: "p1", title: "AI-assisted but reviewed and explained", provenance: "ai-assisted-reviewed", date: "2026-08-01" },
    ];
    const result = computeEvidenceScore(evidence);
    expect(result.evidencePercent).toBe(100);
    expect(result.countedCount).toBe(1);
    expect(result.excludedCount).toBe(0);
  });

  it("a project built entirely with unreviewed AI assistance shows near-zero independent evidence, not inflated", () => {
    const evidence: SkillEvidence[] = [
      { id: "e1", skillId: "s1", projectId: "p1", title: "AI wrote feature A", provenance: "ai-assisted", date: "2026-08-01" },
      { id: "e2", skillId: "s1", projectId: "p1", title: "AI wrote feature B", provenance: "ai-assisted", date: "2026-08-02" },
      { id: "e3", skillId: "s1", projectId: "p1", title: "AI wrote feature C", provenance: "ai-assisted", date: "2026-08-03" },
    ];
    const result = computeEvidenceScore(evidence);
    expect(result.evidencePercent).toBe(0);
    expect(result.excludedCount).toBe(3);
  });
});
