/**
 * Performance Buddy OS — Knowledge OS domain model.
 *
 * Per Master Handoff §13 and Design Assets/06 - Knowledge & Notes/README.md,
 * one rule is locked above all others here:
 *
 *   "Obsidian owns long-form Markdown note bodies. PBOS owns
 *    relationships/context/intelligence... Avoid two independent
 *    authoritative copies of the same note body."
 *
 * So `Source` below stores a REFERENCE (path, title, provenance) — never the
 * actual note content. Reading/writing real Obsidian vault files needs real
 * filesystem access from the Tauri/Rust side, which is NOT built yet (see
 * DAY-5-IMPLEMENTATION-NOTES.md) — sources here are metadata only.
 */

export type KnowledgeCategory = "academic" | "development" | "general" | "reading" | "language" | "other";

/**
 * Per Master Handoff §5: "Strong + Review Due is valid. Do not reset
 * everything to weak just because time passed." State and recency are
 * tracked as separate facts, not collapsed into one score.
 */
export type KnowledgeState = "new" | "learning" | "developing" | "strong";

export type Topic = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  context: string; // e.g. "Data Structures", "Cars"
  masteryPercent: number; // 0-100, evidence-derived — see engine.ts
  lastStudied: string | null; // ISO date
  nextReviewDate: string | null; // ISO date, null = no review scheduled
  /** Optional link back to a Day 3 Goal/System — knowledge can support a goal without duplicating it. */
  relatedGoalId: string | null;
};

export type SourceType = "obsidian-note" | "professor-material" | "book" | "article" | "video" | "ai-note";

export type Source = {
  id: string;
  topicId: string;
  type: SourceType;
  title: string;
  /** A path/reference only — never the note body itself. See file header note. */
  reference: string;
  addedDate: string;
};

export type EvidenceType = "test" | "quiz" | "recall" | "practice";

export type Evidence = {
  id: string;
  topicId: string;
  type: EvidenceType;
  title: string;
  score: number; // out of 10, matching the approved reference's scoring convention
  maxScore: number;
  date: string;
};
