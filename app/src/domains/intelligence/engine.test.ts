import { describe, it, expect } from "vitest";
import {
  filterContextByPermission,
  canRecommendForDomain,
  filterRecommendationsByPermission,
  computeCombinedImpact,
} from "./engine";
import type { DomainPermissions, Recommendation } from "./types";

const permissions: DomainPermissions = {
  Academics: "read-recommend",
  Routines: "read-recommend",
  Money: "no-access", // matches the approved reference's default — sensitive by default
  Fitness: "read", // read-only, no recommendations allowed
};

describe("filterContextByPermission — §8.9/§8.10", () => {
  it("excludes no-access domains from context sent anywhere", () => {
    const result = filterContextByPermission(["Academics", "Money", "Fitness"], permissions);
    expect(result).toEqual(["Academics", "Fitness"]);
  });

  it("excludes domains with no explicit permission set (treated as no-access, never assumed open)", () => {
    const result = filterContextByPermission(["Development"], permissions);
    expect(result).toEqual([]);
  });
});

describe("canRecommendForDomain — Read alone is not enough (§8.9)", () => {
  it("is true only for read-recommend", () => {
    expect(canRecommendForDomain("Academics", permissions)).toBe(true);
  });
  it("is false for read-only access", () => {
    expect(canRecommendForDomain("Fitness", permissions)).toBe(false);
  });
  it("is false for no-access", () => {
    expect(canRecommendForDomain("Money", permissions)).toBe(false);
  });
});

describe("filterRecommendationsByPermission — AI may recommend nothing (§8.8)", () => {
  const candidates: Recommendation[] = [
    { id: "r1", title: "Add mastery session", domain: "Academics", impact: "high", status: "pending", confidence: "high", evidence: [], generatedFrom: "Weekly Review", impactMinutes: 90, decidedAt: null },
    { id: "r2", title: "Categorize transactions", domain: "Money", impact: "low", status: "pending", confidence: "high", evidence: [], generatedFrom: "Money System", impactMinutes: 0, decidedAt: null },
  ];

  it("filters out a candidate for a no-access domain, even a plausible-looking one", () => {
    const result = filterRecommendationsByPermission(candidates, permissions);
    expect(result.map((r) => r.id)).toEqual(["r1"]);
  });

  it("returns an empty array when nothing has read-recommend permission — a valid outcome, not an error", () => {
    const noRecommendPermissions: DomainPermissions = { Academics: "read", Money: "no-access" };
    const result = filterRecommendationsByPermission(candidates, noRecommendPermissions);
    expect(result).toEqual([]);
  });
});

describe("computeCombinedImpact — §8.7 combined validation, not isolated", () => {
  it("sums only accepted/modified recommendations, ignoring pending and rejected", () => {
    const recs: Recommendation[] = [
      { id: "r1", title: "A", domain: "Academics", impact: "high", status: "accepted", confidence: "high", evidence: [], generatedFrom: "", impactMinutes: 90, decidedAt: "2026-08-27" },
      { id: "r2", title: "B", domain: "Routines", impact: "medium", status: "modified", confidence: "moderate", evidence: [], generatedFrom: "", impactMinutes: -10, decidedAt: "2026-08-27" },
      { id: "r3", title: "C", domain: "Academics", impact: "low", status: "pending", confidence: "high", evidence: [], generatedFrom: "", impactMinutes: 200, decidedAt: null },
      { id: "r4", title: "D", domain: "Fitness", impact: "low", status: "rejected", confidence: "high", evidence: [], generatedFrom: "", impactMinutes: 60, decidedAt: "2026-08-26" },
    ];
    // Current 1260 (21h) + accepted 90 + modified -10 = 1340. Pending/rejected ignored.
    const result = computeCombinedImpact(1260, recs, 1260);
    expect(result.withAcceptedChangesMinutes).toBe(1340);
    expect(result.exceedsCapacity).toBe(true);
  });

  it("does not flag exceedsCapacity when the combined total stays within capacity", () => {
    const recs: Recommendation[] = [
      { id: "r1", title: "A", domain: "Academics", impact: "low", status: "accepted", confidence: "high", evidence: [], generatedFrom: "", impactMinutes: 20, decidedAt: "2026-08-27" },
    ];
    const result = computeCombinedImpact(1200, recs, 1260);
    expect(result.withAcceptedChangesMinutes).toBe(1220);
    expect(result.exceedsCapacity).toBe(false);
  });
});
