/**
 * Performance Buddy OS — Analytics & Reviews domain model.
 *
 * Per Day 11 Handoff, three rules matter most:
 *   §7.1 — No universal Performance Score. Domains are never mathematically
 *          combined into one fake percentage. Every DomainSnapshot below
 *          keeps its own unit.
 *   §7.6 — Correlation ≠ causation. Patterns are described as "associated
 *          with," never "caused by" — see engine.ts computeCorrelation.
 *   §7.7 — Confidence is qualitative (High/Moderate/Limited), never fake
 *          precision like "94.73%." Missing/thin data lowers confidence.
 */

export type DomainState = "improving" | "stable" | "needs-attention" | "on-track" | "drifting";
export type ConfidenceLevel = "high" | "moderate" | "limited";

export type DomainSnapshot = {
  domain: string; // e.g. "Academics", "Fitness" — a label, not a hardcoded enum tying this to one domain's internals
  state: DomainState;
  confidence: ConfidenceLevel;
  headline: string;
  evidenceCount: number;
};

/**
 * Per Master Handoff §11: "completed weekly/monthly reviews should retain
 * historical snapshots." Once created, a WeeklyReview is never edited to
 * match later data — see engine.ts buildWeeklyReview, which deep-copies
 * its inputs.
 */
export type WeeklyReview = {
  id: string;
  weekStart: string;
  weekEnd: string;
  domainSnapshots: DomainSnapshot[];
  wins: string[];
  friction: string[];
  createdAt: string;
};

export type CorrelationDirection = "positive" | "negative" | "none";

export type Pattern = {
  id: string;
  title: string; // phrased as association, e.g. "Higher sleep associated with longer Focus sessions"
  direction: CorrelationDirection;
  confidence: ConfidenceLevel;
  sampleSize: number;
};
