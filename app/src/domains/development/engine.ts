/**
 * Deterministic Development Engine.
 *
 * The one rule that matters most here (Master Handoff §14):
 *   "AI built feature does not automatically mean user independently
 *    understands skill."
 *
 * So `computeEvidenceScore` does NOT treat all evidence equally. Pure
 * `ai-assisted` work (not reviewed, not explained back) does not count
 * toward independent-evidence score — it's tracked and shown, but excluded
 * from the number, with the exclusion visible in the return value so the UI
 * can say so honestly instead of hiding it.
 */

import type { Provenance, SkillEvidence, SkillLevel } from "./types";

const LEVEL_THRESHOLDS: { max: number; level: SkillLevel }[] = [
  { max: 0, level: "not-started" },
  { max: 39, level: "learning" },
  { max: 74, level: "developing" },
  { max: 100, level: "strong" },
];

export function derivePercentToLevel(percent: number): SkillLevel {
  if (percent <= 0) return "not-started";
  for (const t of LEVEL_THRESHOLDS) {
    if (percent <= t.max) return t.level;
  }
  return "strong";
}

/** Only these provenance values count as independent evidence, per Master Handoff §14. */
const COUNTS_AS_INDEPENDENT: Provenance[] = ["independent", "ai-assisted-reviewed"];

export type EvidenceScoreResult = {
  evidencePercent: number;
  countedCount: number;
  excludedCount: number; // pure ai-assisted, not reviewed — excluded from the score, not hidden
};

export function computeEvidenceScore(evidence: SkillEvidence[]): EvidenceScoreResult {
  if (evidence.length === 0) {
    return { evidencePercent: 0, countedCount: 0, excludedCount: 0 };
  }

  const counted = evidence.filter((e) => COUNTS_AS_INDEPENDENT.includes(e.provenance));
  const excluded = evidence.length - counted.length;

  // Simple, transparent rule: percent of all recorded evidence that counts
  // as independently demonstrated. Not a guess — every input is a real,
  // dated evidence record.
  const evidencePercent = Math.round((counted.length / evidence.length) * 100);

  return { evidencePercent, countedCount: counted.length, excludedCount: excluded };
}
