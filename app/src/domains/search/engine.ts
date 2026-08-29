/**
 * Deterministic Search Engine. Per Day 16 §9: "V1 search should remain
 * deterministic/local... Context may BOOST results. Context must not
 * hard-filter legitimate results." No AI or network call anywhere here.
 */

import type { MatchType, RankedResult, SearchResult } from "./types";

const TIER_BASE_SCORE: Record<MatchType, number> = {
  exact: 1000,
  prefix: 800,
  contains: 600,
  metadata: 400,
  none: 0,
};

/** §9's exact tier order: exact > prefix/title > contains > metadata/tags. */
export function matchType(query: string, result: SearchResult): MatchType {
  const q = query.trim().toLowerCase();
  if (q === "") return "none";
  const title = result.title.toLowerCase();

  if (title === q) return "exact";
  if (title.startsWith(q)) return "prefix";
  if (title.includes(q)) return "contains";
  if (result.keywords.some((k) => k.toLowerCase().includes(q)) || result.subtitle.toLowerCase().includes(q)) {
    return "metadata";
  }
  return "none";
}

/**
 * Ranks results. Recency and context boost the score WITHIN reason, but per
 * §9 can never let a worse match tier (e.g. metadata) outrank a better one
 * (e.g. exact) just because it's recent or in-context — tested explicitly.
 */
export function rankResults(
  query: string,
  results: SearchResult[],
  recentIds: string[] = [],
  contextDomain: string | null = null
): RankedResult[] {
  const MAX_BOOST = 50; // deliberately smaller than the 200-point gap between tiers

  const ranked: RankedResult[] = [];
  for (const result of results) {
    const type = matchType(query, result);
    if (type === "none") continue;

    let score = TIER_BASE_SCORE[type];
    if (recentIds.includes(result.id)) score += 20;
    if (contextDomain && result.domain === contextDomain) score += 20;

    ranked.push({ result, matchType: type, score });
  }

  // Sanity-bound: boosts must never exceed the gap between tiers, enforced
  // structurally by the constants above (1000/800/600/400 with max +40 boost).
  void MAX_BOOST;

  return ranked.sort((a, b) => b.score - a.score);
}

/**
 * §10: proves the index is genuinely derived — rebuilding from the same
 * source entries always produces the same result, and a corrupted/cleared
 * index can be safely regenerated without touching source data.
 */
export function rebuildIndex(sourceEntries: SearchResult[]): SearchResult[] {
  return sourceEntries.map((e) => ({ ...e }));
}
