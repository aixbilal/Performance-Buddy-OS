/**
 * Deterministic Knowledge Engine.
 *
 * Per Master Handoff §5 and §16-17: knowledge state comes from real recorded
 * evidence, never fabricated, and "Covered does not mean Mastered" (§5).
 *
 * The honest rule this file enforces:
 *   saving a source ≠ mastery
 *   reading / studying ≠ mastery
 *   professor coverage ≠ mastery
 *   personal study ≠ mastery
 *   completing an action ≠ mastery
 * Only recorded Evidence moves mastery. No Evidence → `hasEvidence: false`.
 */

import {
  EVIDENCE_TYPES,
  KNOWLEDGE_CATEGORIES,
  SOURCE_TYPES,
  type Evidence,
  type EvidenceInput,
  type KnowledgeState,
  type ReviewStateInput,
  type SourceInput,
  type TopicInput,
  type Validated,
} from "./types";

const MAX_TITLE = 160;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function clean(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

/**
 * Mastery percent → state. Thresholds are a documented product decision (not a
 * hidden cutoff), kept in one place.
 */
export function deriveKnowledgeState(masteryPercent: number): KnowledgeState {
  if (masteryPercent <= 0) return "new";
  if (masteryPercent < 40) return "learning";
  if (masteryPercent < 75) return "developing";
  return "strong";
}

/**
 * A topic can be "Strong" AND "Review Due" at once — two independent facts, per
 * Master Handoff §5, never one collapsed flag.
 */
export function isReviewDue(nextReviewDate: string | null, today: Date = new Date()): boolean {
  if (!nextReviewDate) return false;
  const t = new Date(nextReviewDate).getTime();
  if (Number.isNaN(t)) return false;
  return t <= today.getTime();
}

/**
 * Recomputes mastery from real evidence — a transparent recency-weighted
 * average (newest counts most). No evidence → 0, never invented.
 */
export function computeMasteryFromEvidence(evidence: Evidence[]): number {
  if (evidence.length === 0) return 0;
  const sorted = [...evidence].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  let weightedSum = 0;
  let weightTotal = 0;
  sorted.forEach((e, i) => {
    const weight = i + 1;
    const percent = e.maxScore > 0 ? (e.score / e.maxScore) * 100 : 0;
    weightedSum += percent * weight;
    weightTotal += weight;
  });
  return Math.round(weightedSum / weightTotal);
}

export type TopicView = {
  masteryPercent: number;
  hasEvidence: boolean;
  state: KnowledgeState;
};

/** The evidence-derived view of a topic — the ONE place "insufficient evidence" is decided. */
export function deriveTopicView(evidence: Evidence[]): TopicView {
  const hasEvidence = evidence.length > 0;
  const masteryPercent = computeMasteryFromEvidence(evidence);
  return { masteryPercent, hasEvidence, state: deriveKnowledgeState(masteryPercent) };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateTopicInput(input: TopicInput): Validated<TopicInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  const context = clean(input.context);

  if (title.length === 0) errors.title = "Give the topic a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;

  if (!(KNOWLEDGE_CATEGORIES as readonly string[]).includes(input.category)) {
    errors.category = "Choose a category.";
  }
  if (context.length > MAX_TITLE) errors.context = "Context is too long.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, title, context } };
}

export function validateSourceInput(input: SourceInput): Validated<SourceInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  const reference = input.reference.trim();

  if (title.length === 0) errors.title = "Give the source a title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;

  if (!(SOURCE_TYPES as readonly string[]).includes(input.type)) {
    errors.type = "Choose a source type.";
  }
  if (reference.length > 500) errors.reference = "Reference path is too long.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, title, reference } };
}

export function validateEvidenceInput(input: EvidenceInput): Validated<EvidenceInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);

  if (title.length === 0) errors.title = "Describe the evidence (e.g. 'Recall drill').";
  else if (title.length > MAX_TITLE) errors.title = `Keep it under ${MAX_TITLE} characters.`;

  if (!(EVIDENCE_TYPES as readonly string[]).includes(input.type)) {
    errors.type = "Choose an evidence type.";
  }

  if (!Number.isFinite(input.maxScore) || input.maxScore <= 0) {
    errors.maxScore = "Max score must be greater than zero.";
  }
  if (!Number.isFinite(input.score) || input.score < 0) {
    errors.score = "Score can't be negative.";
  } else if (Number.isFinite(input.maxScore) && input.score > input.maxScore) {
    errors.score = "Score can't exceed the max score.";
  }

  if (input.date && (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date)))) {
    errors.date = "Date must be a valid date.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, title } };
}

export function validateReviewStateInput(input: ReviewStateInput): Validated<ReviewStateInput> {
  const errors: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== null && (!ISO_DATE.test(v) || Number.isNaN(Date.parse(v)))) {
      errors[k] = "Must be a valid date or empty.";
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: input };
}
