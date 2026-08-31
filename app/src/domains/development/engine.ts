/**
 * Deterministic Development Engine.
 *
 * The rule that matters most (Master Handoff §14): "AI built feature does not
 * automatically mean user independently understands skill." So
 * `computeEvidenceScore` does NOT treat all evidence equally — pure
 * `ai-assisted` work (not reviewed, not explained back) is tracked and shown
 * but EXCLUDED from the score, with the exclusion visible in the return value.
 *
 * Project progress is derived from milestones — it is Project-owned and is
 * never the same number as any Skill axis.
 */

import {
  PROJECT_STATUSES,
  PROVENANCES,
  SKILL_LEVELS,
  type EvidenceInput,
  type MilestoneInput,
  type ProjectInput,
  type Provenance,
  type SkillInput,
  type SkillLevel,
  type Validated,
} from "./types";

const MAX_TITLE = 140;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function clean(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

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

/** Only these provenance values count as independent evidence (§14). */
const COUNTS_AS_INDEPENDENT: Provenance[] = ["independent", "ai-assisted-reviewed"];

/**
 * Batch 5 — the deterministic strength a Skill-evidence row carries when it is
 * explicitly handed to Knowledge as `practice` evidence. Raw `ai-assisted`
 * evidence is not handoff-eligible at all (returns null): "AI writing code is
 * not you independently understanding it" (§14 / docs 18.08).
 */
export function knowledgeHandoffWeight(
  provenance: Provenance,
): { score: number; maxScore: number } | null {
  switch (provenance) {
    case "independent":
      return { score: 1, maxScore: 1 };
    case "ai-assisted-reviewed":
      return { score: 0.7, maxScore: 1 };
    default:
      return null; // ai-assisted (unreviewed) — never independent proof
  }
}

export type EvidenceScoreResult = {
  evidencePercent: number;
  countedCount: number;
  excludedCount: number; // pure ai-assisted, not reviewed — excluded, not hidden
};

export function computeEvidenceScore<E extends { provenance: Provenance }>(
  evidence: E[],
): EvidenceScoreResult {
  if (evidence.length === 0) {
    return { evidencePercent: 0, countedCount: 0, excludedCount: 0 };
  }
  const counted = evidence.filter((e) => COUNTS_AS_INDEPENDENT.includes(e.provenance));
  const excluded = evidence.length - counted.length;
  const evidencePercent = Math.round((counted.length / evidence.length) * 100);
  return { evidencePercent, countedCount: counted.length, excludedCount: excluded };
}

export type ProjectProgress = {
  completed: number;
  total: number;
  /** null when there are no milestones — a project with no milestones is not "0% done". */
  percent: number | null;
};

export function deriveProjectProgress<M extends { completed: boolean }>(
  milestones: M[],
): ProjectProgress {
  const total = milestones.length;
  if (total === 0) return { completed: 0, total: 0, percent: null };
  const completed = milestones.filter((m) => m.completed).length;
  return { completed, total, percent: Math.round((completed / total) * 100) };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function pct(errors: Record<string, string>, key: string, v: number, label: string) {
  if (!Number.isFinite(v)) errors[key] = `${label} must be a number.`;
  else if (v < 0 || v > 100) errors[key] = `${label} must be between 0 and 100.`;
}

export function validateProjectInput(input: ProjectInput): Validated<ProjectInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the project a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;
  if (!(PROJECT_STATUSES as readonly string[]).includes(input.status)) {
    errors.status = "Choose a project status.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, title, description: input.description.trim() } };
}

export function validateSkillInput(input: SkillInput): Validated<SkillInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the skill a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;
  pct(errors, "knowledgePercent", input.knowledgePercent, "Knowledge");
  pct(errors, "practicePercent", input.practicePercent, "Practice");
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...input,
      title,
      category: input.category.trim(),
      knowledgePercent: Math.round(input.knowledgePercent),
      practicePercent: Math.round(input.practicePercent),
    },
  };
}

export function validateMilestoneInput(input: MilestoneInput): Validated<MilestoneInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the milestone a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep it under ${MAX_TITLE} characters.`;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title } };
}

export function validateEvidenceInput(input: EvidenceInput): Validated<EvidenceInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Describe what you did.";
  else if (title.length > MAX_TITLE) errors.title = `Keep it under ${MAX_TITLE} characters.`;
  if (!(PROVENANCES as readonly string[]).includes(input.provenance)) {
    errors.provenance = "Choose how this was produced.";
  }
  if (input.date && (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date)))) {
    errors.date = "Date must be a valid date.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, title } };
}

export function isSkillLevel(v: unknown): v is SkillLevel {
  return typeof v === "string" && (SKILL_LEVELS as readonly string[]).includes(v);
}
