/**
 * Performance Buddy OS — Knowledge OS domain model (Batch 2A: relational).
 *
 * Per Master Handoff §13 and Design Assets/06 - Knowledge & Notes/README.md:
 *
 *   "Obsidian owns long-form Markdown note bodies. PBOS owns
 *    relationships/context/intelligence... Avoid two independent
 *    authoritative copies of the same note body."
 *
 * So `Source` stores a REFERENCE (path, title, provenance) — never the note
 * content. There is NO Obsidian filesystem integration in Batch 2A; a source
 * is metadata only.
 *
 * Mastery is EVIDENCE-DERIVED, never stored. Saving a source, reading, or
 * studying an Academic topic is not evidence of understanding (docs/15.08).
 * The persisted `KnowledgeTopic` has no mastery field; the store projects a
 * `Topic` with `masteryPercent` computed from recorded `Evidence`.
 */

export type KnowledgeCategory =
  | "academic"
  | "development"
  | "general"
  | "reading"
  | "language"
  | "other";
export const KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = [
  "academic",
  "development",
  "general",
  "reading",
  "language",
  "other",
];

/**
 * Per Master Handoff §5: "Strong + Review Due is valid." State and recency are
 * separate facts, never collapsed into one score.
 */
export type KnowledgeState = "new" | "learning" | "developing" | "strong";

export type SourceType =
  | "obsidian-note"
  | "professor-material"
  | "book"
  | "article"
  | "video"
  | "ai-note";
export const SOURCE_TYPES: readonly SourceType[] = [
  "obsidian-note",
  "professor-material",
  "book",
  "article",
  "video",
  "ai-note",
];

export type EvidenceType = "test" | "quiz" | "recall" | "practice";
export const EVIDENCE_TYPES: readonly EvidenceType[] = ["test", "quiz", "recall", "practice"];

// ---------------------------------------------------------------------------
// Canonical persisted rows (shape matches app/src-tauri/src/knowledge.rs)
// ---------------------------------------------------------------------------

export type KnowledgeTopic = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  context: string; // e.g. "Data Structures", "Cars"
  lastStudied: string | null;
  nextReviewDate: string | null; // null = no review scheduled
  /** Optional link back to a Performance Goal — supports it without duplicating it. */
  relatedGoalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Source = {
  id: string;
  topicId: string;
  type: SourceType;
  /** A path/reference only — never the note body itself. See file header. */
  title: string;
  reference: string;
  addedDate: string;
  createdAt: string;
  updatedAt: string;
};

export type Evidence = {
  id: string;
  topicId: string;
  type: EvidenceType;
  title: string;
  score: number;
  maxScore: number;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeGraph = {
  topics: KnowledgeTopic[];
  sources: Source[];
  evidence: Evidence[];
};

/**
 * Store projection: a persisted topic + its evidence-derived view. `hasEvidence`
 * makes the honest "insufficient evidence" state explicit rather than hiding it
 * behind a 0.
 */
export type Topic = KnowledgeTopic & {
  masteryPercent: number;
  hasEvidence: boolean;
  state: KnowledgeState;
};

// ---------------------------------------------------------------------------
// Form inputs + validation result
// ---------------------------------------------------------------------------

export type TopicInput = {
  title: string;
  category: KnowledgeCategory;
  context: string;
  relatedGoalId: string | null;
};

export type SourceInput = {
  type: SourceType;
  title: string;
  reference: string;
};

export type EvidenceInput = {
  type: EvidenceType;
  title: string;
  score: number;
  maxScore: number;
  date: string;
};

export type ReviewStateInput = {
  lastStudied: string | null;
  nextReviewDate: string | null;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };
