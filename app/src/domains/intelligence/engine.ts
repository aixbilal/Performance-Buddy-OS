/**
 * Deterministic AI Coach Engine. Everything here runs with zero AI
 * involvement — permission checks, filtering, and capacity math are pure
 * logic. This is deliberate: whether AI is allowed to see or suggest
 * something must never itself depend on an AI call.
 */

import type { CombinedImpactResult, DomainPermissions, Recommendation } from "./types";

/** §8.10: send only domains the caller actually needs AND that have at least Read access. */
export function filterContextByPermission(requestedDomains: string[], permissions: DomainPermissions): string[] {
  return requestedDomains.filter((d) => {
    const level = permissions[d] ?? "no-access";
    return level === "read" || level === "read-recommend";
  });
}

/** §8.9: recommending requires Read+Recommend specifically — Read alone is not enough. */
export function canRecommendForDomain(domain: string, permissions: DomainPermissions): boolean {
  return (permissions[domain] ?? "no-access") === "read-recommend";
}

/**
 * §8.8: "AI is allowed to recommend nothing... Do not manufacture
 * recommendations to make the feature look active." This function proves
 * that rule structurally: a candidate whose domain lacks Read+Recommend
 * permission is filtered out entirely, and an empty result is a valid,
 * unremarkable outcome — not an error state.
 */
export function filterRecommendationsByPermission(
  candidates: Recommendation[],
  permissions: DomainPermissions
): Recommendation[] {
  return candidates.filter((r) => canRecommendForDomain(r.domain, permissions));
}

/**
 * §8.7: validate the COMBINED effect of every currently-accepted
 * recommendation, not each one in isolation. Deliberately minimal/standalone
 * — a full capacity/scheduling engine belongs to Day 13's Planner domain;
 * this only answers "would accepting everything currently accepted exceed
 * weekly capacity," which is the scope AI Coach actually needs today.
 */
export function computeCombinedImpact(
  currentLoadMinutes: number,
  acceptedRecommendations: Recommendation[],
  weeklyCapacityMinutes: number
): CombinedImpactResult {
  const changeTotal = acceptedRecommendations
    .filter((r) => r.status === "accepted" || r.status === "modified")
    .reduce((s, r) => s + r.impactMinutes, 0);
  const withAcceptedChangesMinutes = currentLoadMinutes + changeTotal;

  return {
    currentLoadMinutes,
    withAcceptedChangesMinutes,
    weeklyCapacityMinutes,
    exceedsCapacity: withAcceptedChangesMinutes > weeklyCapacityMinutes,
  };
}
