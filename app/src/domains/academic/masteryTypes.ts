/**
 * Mastery Check domain model (Batch 4).
 *
 * A Mastery Check is a PERSONAL learning check — a self-check or recall probe.
 * It is NOT an official course Assessment and NEVER a grade. It produces a
 * score, and — only on an explicit user action — exactly one Knowledge Evidence
 * record against the linked Knowledge concept. The Academic Topic keeps no
 * mastery of its own; mastery lives in Knowledge OS (docs 14.09 / 17.10).
 */

export type MasteryCheckKind = "self-check" | "recall";
export const MASTERY_CHECK_KINDS: readonly MasteryCheckKind[] = ["self-check", "recall"];

/** Honest self-assessment ratings — separate from tested performance (docs 09.07). */
export type MasteryRating = "confident" | "partial" | "unsure";
export const MASTERY_RATINGS: readonly MasteryRating[] = ["confident", "partial", "unsure"];

export type MasteryItem = {
  id: string;
  prompt: string;
  rating: MasteryRating | null;
};

export type MasteryCheckStatus = "in-progress" | "completed";

export type MasteryCheck = {
  id: string;
  academicTopicId: string | null;
  knowledgeTopicId: string | null;
  courseId: string | null;
  topicTitle: string;
  kind: MasteryCheckKind;
  items: MasteryItem[];
  score: number;
  maxScore: number;
  status: MasteryCheckStatus;
  /** The ONE Knowledge Evidence row this check produced, if any. Set once. */
  evidenceId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type MasteryBand = "needs-reinforcement" | "developing" | "strong";
