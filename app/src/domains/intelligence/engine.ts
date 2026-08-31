/**
 * Deterministic AI Coach engine. Zero AI involvement — permission checks,
 * proposal parsing/allowlisting, and capacity math are pure logic. Whether AI
 * may see or suggest something must never itself depend on an AI call.
 */

import { canReadDomain, canRecommendForDomain } from "../ai/context";
import type { DomainPermissions } from "../ai/context";
import type { ProposedRecommendation } from "../ai/types";
import {
  isRecommendationKind,
  type CombinedImpactResult,
  type Recommendation,
} from "./types";

export { canReadDomain, canRecommendForDomain };

/** §8.10 — send only requested domains that also have at least Read. */
export function filterContextByPermission(
  requestedDomains: string[],
  permissions: DomainPermissions,
): string[] {
  return requestedDomains.filter((d) => canReadDomain(d, permissions));
}

export type ParsedProposals = {
  valid: ProposedRecommendation[];
  rejected: { proposal: ProposedRecommendation; reason: string }[];
};

/**
 * A model reply is UNTRUSTED INPUT (docs 23 invariant 5). A proposal is kept
 * only if its `kind` is allowlisted, it has a title, and the target domain has
 * Read+Recommend permission. Everything else is rejected with a reason —
 * never silently applied, never silently dropped without a count.
 */
export function parseProposals(
  proposals: ProposedRecommendation[],
  permissions: DomainPermissions,
): ParsedProposals {
  const valid: ProposedRecommendation[] = [];
  const rejected: { proposal: ProposedRecommendation; reason: string }[] = [];
  for (const p of proposals) {
    if (!isRecommendationKind(p.kind)) {
      rejected.push({ proposal: p, reason: `unknown recommendation kind "${p.kind}"` });
      continue;
    }
    if (!p.title || !p.title.trim()) {
      rejected.push({ proposal: p, reason: "proposal has no title" });
      continue;
    }
    if (!canRecommendForDomain(p.domain, permissions)) {
      rejected.push({
        proposal: p,
        reason: `domain "${p.domain}" is not set to Read + Recommend`,
      });
      continue;
    }
    valid.push(p);
  }
  return { valid, rejected };
}

/** Signed minutes a recommendation adds to (+) or removes from (-) weekly load. */
export function recommendationLoadMinutes(rec: {
  kind: string;
  proposedParams: Record<string, unknown>;
}): number {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  switch (rec.kind) {
    case "schedule-block":
      return n(rec.proposedParams.durationMinutes);
    case "adjust-routine-cadence": {
      // treat a cadence reduction as a small load reduction, increase as addition
      const delta = n(rec.proposedParams.deltaMinutes);
      return delta;
    }
    default:
      return 0; // create-action / set-knowledge-review add no scheduled load by themselves
  }
}

/**
 * §8.7 — validate the COMBINED effect of every accepted/modified recommendation
 * together, not each in isolation.
 */
export function computeCombinedImpact(
  currentLoadMinutes: number,
  recommendations: Recommendation[],
  weeklyCapacityMinutes: number,
): CombinedImpactResult {
  const changeTotal = recommendations
    .filter((r) => r.status === "accepted" || r.status === "modified")
    .reduce((s, r) => s + recommendationLoadMinutes(r), 0);
  const withAcceptedChangesMinutes = currentLoadMinutes + changeTotal;
  return {
    currentLoadMinutes,
    withAcceptedChangesMinutes,
    weeklyCapacityMinutes,
    exceedsCapacity: withAcceptedChangesMinutes > weeklyCapacityMinutes,
  };
}
