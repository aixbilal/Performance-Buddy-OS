/**
 * Performance Buddy OS — AI Coach / Intelligence domain model (Batch 6).
 *
 * The full pipeline (docs 23 / 24 / 26 / 30):
 *   Analytics facts → permitted context → AI PROPOSAL → user decision →
 *   deterministic Phase-23-style validation → allowlisted canonical Apply →
 *   optional re-plan. Every stage is a separate recorded event.
 *
 *   AI has NO direct write credential. A `Recommendation` is a proposal; it
 *   only changes canonical data through an allowlisted Apply adapter that
 *   validates first and then calls a domain store. Decision history is
 *   append-only and durable.
 */

import type { DomainPermissions, PermissionLevel } from "../ai/context";
import type { ProposalConfidence } from "../ai/types";

export type { DomainPermissions, PermissionLevel };

/** The allowlist. Anything a provider proposes outside this set is rejected. */
export type RecommendationKind =
  | "create-action"
  | "schedule-block"
  | "set-knowledge-review"
  | "adjust-routine-cadence";

export const RECOMMENDATION_KINDS: readonly RecommendationKind[] = [
  "create-action",
  "schedule-block",
  "set-knowledge-review",
  "adjust-routine-cadence",
];

export function isRecommendationKind(v: unknown): v is RecommendationKind {
  return typeof v === "string" && (RECOMMENDATION_KINDS as readonly string[]).includes(v);
}

export type RecommendationStatus =
  | "proposed"
  | "accepted"
  | "modified"
  | "rejected"
  | "applied"
  | "apply-failed";

export type RecommendationSource =
  | "weekly-review"
  | "monthly-review"
  | "analytics"
  | "workspace"
  | "manual";

export type ValidationResult = {
  ok: boolean;
  reasonCodes: string[];
  message: string;
};

/** One canonical model — NOT one table per domain. */
export type Recommendation = {
  id: string;
  kind: RecommendationKind;
  domain: string;
  title: string;
  rationale: string;
  evidence: string[];
  confidence: ProposalConfidence;
  source: RecommendationSource;
  /** Human-readable provenance, e.g. "Weekly Review · 2026-01-05". */
  generatedFrom: string;
  /** The change to apply — validated by the adapter, never executed raw. */
  proposedParams: Record<string, unknown>;
  /** Before-values for the impact preview. */
  currentParams: Record<string, unknown>;
  status: RecommendationStatus;
  validation: ValidationResult | null;
  appliedResult: Record<string, unknown> | null;
  createdAt: string;
  decidedAt: string | null;
  appliedAt: string | null;
};

export type DecisionEventType =
  | "proposed"
  | "accepted"
  | "modified"
  | "rejected"
  | "applied"
  | "apply-failed";

/** Append-only trail. The recommendation's `status` is the current state; these are the history. */
export type DecisionEvent = {
  id: string;
  recommendationId: string;
  event: DecisionEventType;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type CombinedImpactResult = {
  currentLoadMinutes: number;
  withAcceptedChangesMinutes: number;
  weeklyCapacityMinutes: number;
  exceedsCapacity: boolean;
};

/** DEFAULT: everything read+recommend EXCEPT Money (sensitive — docs 30.05). */
export const DEFAULT_PERMISSIONS: DomainPermissions = {
  Today: "read-recommend",
  Academics: "read-recommend",
  "Goals & Systems": "read-recommend",
  Knowledge: "read-recommend",
  Development: "read-recommend",
  "Fitness & Recovery": "read-recommend",
  Routines: "read-recommend",
  "Reading & Language": "read-recommend",
  Planning: "read-recommend",
  Money: "no-access",
};
