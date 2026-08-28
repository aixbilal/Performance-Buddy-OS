/**
 * Performance Buddy OS — AI Coach & Intelligence domain model.
 *
 * Per Day 12 Handoff §8.1, the full pipeline this domain implements:
 *   PBOS structured state → deterministic rules/evidence → context selection
 *   → permission check → AI interpretation → recommendation/proposal →
 *   USER DECISION → deterministic validation → PBOS mutation.
 *
 * This build implements every deterministic stage of that pipeline — context
 * selection, permission enforcement, recommendation/decision lifecycle,
 * combined-impact validation. It does NOT wire a real external AI provider
 * call (no API key handling exists yet) — recommendations here are example
 * candidates, standing in for what a real AI call would eventually produce.
 * The `ProposalCard` component (built Day 2) is the reusable UI piece that
 * would render either source identically — nothing here duplicates it.
 */

export type PermissionLevel = "no-access" | "read" | "read-recommend";

/** Domain names match the labels used across the app — not a new enum tied to internals. */
export type DomainPermissions = Record<string, PermissionLevel>;

export type ImpactLevel = "high" | "medium" | "low";
export type RecommendationStatus = "pending" | "accepted" | "modified" | "rejected";

export type Recommendation = {
  id: string;
  title: string;
  domain: string;
  impact: ImpactLevel;
  status: RecommendationStatus;
  confidence: "high" | "moderate" | "limited";
  evidence: string[];
  generatedFrom: string; // e.g. "Weekly Review (Aug 27)" — traceable source, never unexplained
  /** Signed minutes this change would add (+) or remove (-) from weekly load, for combined-impact validation. */
  impactMinutes: number;
  decidedAt: string | null;
};

export type CombinedImpactResult = {
  currentLoadMinutes: number;
  withAcceptedChangesMinutes: number;
  weeklyCapacityMinutes: number;
  exceedsCapacity: boolean;
};
