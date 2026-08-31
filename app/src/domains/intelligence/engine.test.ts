import { describe, it, expect } from "vitest";
import {
  canReadDomain,
  canRecommendForDomain,
  computeCombinedImpact,
  filterContextByPermission,
  parseProposals,
  recommendationLoadMinutes,
} from "./engine";
import type { DomainPermissions } from "../ai/context";
import type { ProposedRecommendation } from "../ai/types";
import type { Recommendation } from "./types";

const permissions: DomainPermissions = {
  Academics: "read-recommend",
  Routines: "read-recommend",
  Planning: "read-recommend",
  Money: "no-access",
  "Fitness & Recovery": "read",
};

describe("permission gates (docs 30.05)", () => {
  it("context includes read + read-recommend, excludes no-access and unset", () => {
    expect(
      filterContextByPermission(["Academics", "Money", "Fitness & Recovery", "Development"], permissions),
    ).toEqual(["Academics", "Fitness & Recovery"]);
  });
  it("canRecommendForDomain is true only for read-recommend", () => {
    expect(canRecommendForDomain("Academics", permissions)).toBe(true);
    expect(canRecommendForDomain("Fitness & Recovery", permissions)).toBe(false);
    expect(canRecommendForDomain("Money", permissions)).toBe(false);
    expect(canRecommendForDomain("Nope", permissions)).toBe(false);
  });
  it("canReadDomain treats an unset domain as no-access", () => {
    expect(canReadDomain("Development", permissions)).toBe(false);
  });
});

describe("parseProposals — model output is untrusted (docs 23 invariant 5)", () => {
  const p = (over: Partial<ProposedRecommendation>): ProposedRecommendation => ({
    kind: "schedule-block",
    domain: "Planning",
    title: "Schedule a study block",
    rationale: "",
    evidence: [],
    confidence: "moderate",
    proposedParams: {},
    ...over,
  });

  it("keeps only allowlisted kinds with a title and read-recommend permission", () => {
    const { valid, rejected } = parseProposals(
      [
        p({}),
        p({ kind: "DROP TABLE actions" }),
        p({ kind: "create-action", domain: "Money", title: "x" }),
        p({ kind: "set-knowledge-review", domain: "Academics", title: "" }),
      ],
      permissions,
    );
    expect(valid.map((v) => v.kind)).toEqual(["schedule-block"]);
    expect(rejected.map((r) => r.reason)).toEqual([
      'unknown recommendation kind "DROP TABLE actions"',
      'domain "Money" is not set to Read + Recommend',
      "proposal has no title",
    ]);
  });

  it("returning zero valid proposals is a normal outcome, not an error", () => {
    const { valid } = parseProposals([p({ kind: "nonsense" })], permissions);
    expect(valid).toEqual([]);
  });
});

describe("combined capacity impact (§8.7)", () => {
  const rec = (over: Partial<Recommendation>): Recommendation => ({
    id: "r",
    kind: "schedule-block",
    domain: "Planning",
    title: "t",
    rationale: "",
    evidence: [],
    confidence: "moderate",
    source: "workspace",
    generatedFrom: "",
    proposedParams: { durationMinutes: 60 },
    currentParams: {},
    status: "accepted",
    validation: null,
    appliedResult: null,
    createdAt: "",
    decidedAt: null,
    appliedAt: null,
    ...over,
  });

  it("sums only accepted/modified schedule-blocks; ignores proposed/rejected", () => {
    const recs = [
      rec({ id: "a", status: "accepted", proposedParams: { durationMinutes: 90 } }),
      rec({ id: "b", status: "modified", proposedParams: { durationMinutes: 30 } }),
      rec({ id: "c", status: "proposed", proposedParams: { durationMinutes: 200 } }),
      rec({ id: "d", status: "rejected", proposedParams: { durationMinutes: 60 } }),
      rec({ id: "e", status: "accepted", kind: "create-action", proposedParams: {} }),
    ];
    const r = computeCombinedImpact(1260, recs, 1260);
    expect(r.withAcceptedChangesMinutes).toBe(1380);
    expect(r.exceedsCapacity).toBe(true);
  });

  it("create-action and set-knowledge-review add no scheduled load", () => {
    expect(recommendationLoadMinutes({ kind: "create-action", proposedParams: {} })).toBe(0);
    expect(
      recommendationLoadMinutes({ kind: "set-knowledge-review", proposedParams: { inDays: 3 } }),
    ).toBe(0);
  });
});
