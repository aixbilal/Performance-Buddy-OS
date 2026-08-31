import { describe, it, expect } from "vitest";
import { derivePercentToLevel, computeEvidenceScore } from "./engine";
import type { Provenance, SkillEvidence } from "./types";

const ev = (id: string, provenance: Provenance, projectId: string | null = null): SkillEvidence => ({
  id,
  skillId: "s1",
  projectId,
  title: `Evidence ${id}`,
  provenance,
  date: "2026-08-01",
  knowledgeEvidenceId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

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
    const evidence: SkillEvidence[] = [ev("e1", "independent"), ev("e2", "independent")];
    const result = computeEvidenceScore(evidence);
    expect(result.evidencePercent).toBe(100);
    expect(result.countedCount).toBe(2);
    expect(result.excludedCount).toBe(0);
  });

  it("excludes pure AI-assisted evidence from the score, but still reports it exists", () => {
    const evidence: SkillEvidence[] = [ev("e1", "independent", "p1"), ev("e2", "ai-assisted", "p1")];
    const result = computeEvidenceScore(evidence);
    // Only 1 of 2 counts -> 50%, not 100%, even though 2 pieces of evidence exist
    expect(result.evidencePercent).toBe(50);
    expect(result.countedCount).toBe(1);
    expect(result.excludedCount).toBe(1);
  });

  it("treats ai-assisted-reviewed as counting, unlike raw ai-assisted", () => {
    const evidence: SkillEvidence[] = [ev("e1", "ai-assisted-reviewed", "p1")];
    const result = computeEvidenceScore(evidence);
    expect(result.evidencePercent).toBe(100);
    expect(result.countedCount).toBe(1);
    expect(result.excludedCount).toBe(0);
  });

  it("a project built entirely with unreviewed AI assistance shows near-zero independent evidence, not inflated", () => {
    const evidence: SkillEvidence[] = [
      ev("e1", "ai-assisted", "p1"),
      ev("e2", "ai-assisted", "p1"),
      ev("e3", "ai-assisted", "p1"),
    ];
    const result = computeEvidenceScore(evidence);
    expect(result.evidencePercent).toBe(0);
    expect(result.excludedCount).toBe(3);
  });
});
