/**
 * Performance Buddy OS — Global Search domain model.
 *
 * Per Day 16 Handoff §10: "SEARCH INDEX ≠ SOURCE OF TRUTH. It is derived.
 * It must be safe to rebuild." `SearchResult` below is never stored as an
 * authoritative record anywhere — see store.tsx `buildSearchIndex`, which
 * is called fresh from other domains' real state, not persisted separately.
 */

export type SearchEntityType =
  | "goal"
  | "system"
  | "action"
  | "course"
  | "knowledge-topic"
  | "project"
  | "skill"
  | "routine"
  | "language-unit"
  | "setting-page";

export type SearchResult = {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle: string;
  domain: string;
  canonicalRoute: string; // §12 — search must open the REAL route, never a duplicate detail screen
  keywords: string[];
  updatedAt: string;
};

export type MatchType = "exact" | "prefix" | "contains" | "metadata" | "none";

export type RankedResult = {
  result: SearchResult;
  matchType: MatchType;
  score: number;
};
