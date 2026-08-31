/**
 * Deterministic study-target selection (Batch 4).
 *
 * docs/14.04 (Study Allocation Model): "exact weights, normalization,
 * thresholds, and tie-breakers are PROVISIONAL / RESEARCH REQUIRED". So this
 * engine does NOT compute a universal priority score. It attaches EXPLAINABLE
 * reason codes to each topic and orders them by a small, fixed predicate list
 * that changes with the study mode. Every ordering decision is inspectable.
 *
 * Professor Coverage ≠ Personal Study ≠ Mastery are kept as three separate
 * signals. Mastery/review state is READ from the linked Knowledge concept —
 * never a second Academic number.
 */
import type { KnowledgeState } from "../knowledge/types";
import type { CoverageStatus } from "./types";

export type StudyMode = "normal" | "exam" | "recovery";

export type StudyReason =
  | "review-due"
  | "professor-covered-not-studied"
  | "evidence-weak"
  | "no-evidence"
  | "in-progress"
  | "not-started";

export const STUDY_REASON_LABEL: Record<StudyReason, string> = {
  "review-due": "Knowledge review due",
  "professor-covered-not-studied": "Professor covered · not personally completed",
  "evidence-weak": "Knowledge evidence weak",
  "no-evidence": "No mastery evidence yet",
  "in-progress": "Personal study in progress",
  "not-started": "Not personally started",
};

export type StudyTopicInput = {
  academicTopicId: string;
  courseId: string;
  courseTitle: string;
  topicTitle: string;
  professorCoverage: CoverageStatus;
  personalStudyPercent: number;
  knowledgeTopicId: string | null;
  /** From the canonical Knowledge concept, or null when unlinked. */
  knowledge: { state: KnowledgeState; hasEvidence: boolean; reviewDue: boolean } | null;
};

export type StudyTarget = StudyTopicInput & {
  reasons: StudyReason[];
  /** Lower = study sooner. Derived only from which predicate first matched. */
  rank: number;
};

function reasonsFor(t: StudyTopicInput): StudyReason[] {
  const out: StudyReason[] = [];
  const reviewDue = t.knowledge?.reviewDue ?? false;
  const weak = !!t.knowledge?.hasEvidence && (t.knowledge.state === "new" || t.knowledge.state === "learning");
  const noEvidence = !!t.knowledgeTopicId && !(t.knowledge?.hasEvidence ?? false);
  const covered = t.professorCoverage === "taught" || t.professorCoverage === "in-progress";

  if (reviewDue) out.push("review-due");
  if (covered && t.personalStudyPercent < 100) out.push("professor-covered-not-studied");
  if (weak) out.push("evidence-weak");
  if (noEvidence) out.push("no-evidence");
  if (t.personalStudyPercent > 0 && t.personalStudyPercent < 100) out.push("in-progress");
  if (t.personalStudyPercent === 0) out.push("not-started");
  return out;
}

// Ordered predicate lists — the FIRST predicate a topic matches sets its rank.
// The order differs by mode; nothing is a weighted sum.
const MODE_PREDICATES: Record<StudyMode, ((r: StudyReason[]) => boolean)[]> = {
  normal: [
    (r) => r.includes("review-due"),
    (r) => r.includes("professor-covered-not-studied"),
    (r) => r.includes("evidence-weak"),
    (r) => r.includes("no-evidence"),
    (r) => r.includes("in-progress"),
    (r) => r.includes("not-started"),
  ],
  // Exam: what the professor has covered but you haven't nailed comes first,
  // then review, then weak evidence. Not-started (never taught) drops last.
  exam: [
    (r) => r.includes("professor-covered-not-studied") && r.includes("no-evidence"),
    (r) => r.includes("professor-covered-not-studied") && r.includes("evidence-weak"),
    (r) => r.includes("professor-covered-not-studied"),
    (r) => r.includes("review-due"),
    (r) => r.includes("evidence-weak"),
    (r) => r.includes("no-evidence"),
    (r) => r.includes("in-progress"),
    (r) => r.includes("not-started"),
  ],
  // Recovery: smallest useful restart — only the weakest, ordered gently.
  recovery: [
    (r) => r.includes("evidence-weak"),
    (r) => r.includes("professor-covered-not-studied"),
    (r) => r.includes("no-evidence"),
    (r) => r.includes("not-started"),
  ],
};

export function selectStudyTargets(topics: StudyTopicInput[], mode: StudyMode): StudyTarget[] {
  const preds = MODE_PREDICATES[mode];
  const scored: StudyTarget[] = [];
  for (const t of topics) {
    const reasons = reasonsFor(t);
    let rank = preds.findIndex((p) => p(reasons));
    // Recovery mode only surfaces topics that match one of its predicates.
    if (rank === -1) {
      if (mode === "recovery") continue;
      rank = preds.length; // everything else, stable at the end
    }
    scored.push({ ...t, reasons, rank });
  }
  return scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.courseTitle.localeCompare(b.courseTitle) ||
      a.topicTitle.localeCompare(b.topicTitle),
  );
}

/** The single deterministic "study this next" pick, or null when nothing qualifies. */
export function nextStudyTarget(topics: StudyTopicInput[], mode: StudyMode): StudyTarget | null {
  return selectStudyTargets(topics, mode)[0] ?? null;
}
