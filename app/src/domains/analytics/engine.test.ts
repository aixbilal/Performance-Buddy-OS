import { describe, it, expect } from "vitest";
import { deriveDomainState, computeCorrelation, buildWeeklyReview } from "./engine";
import type { DomainSnapshot } from "./types";

describe("deriveDomainState — no fabricated direction (§7.1, §7.7)", () => {
  it("returns stable + limited confidence with no prior data point, never a guessed trend", () => {
    const result = deriveDomainState(70, null, 10);
    expect(result.state).toBe("stable");
    expect(result.confidence).toBe("limited");
  });

  it("reports improving when the rise exceeds the trend threshold", () => {
    const result = deriveDomainState(80, 70, 10);
    expect(result.state).toBe("improving");
  });

  it("reports needs-attention when the drop exceeds the trend threshold", () => {
    const result = deriveDomainState(60, 75, 10);
    expect(result.state).toBe("needs-attention");
  });

  it("reports stable for a small move within the threshold", () => {
    const result = deriveDomainState(72, 70, 10);
    expect(result.state).toBe("stable");
  });

  it("confidence scales with evidence count, not with the trend itself", () => {
    expect(deriveDomainState(80, 70, 2).confidence).toBe("limited");
    expect(deriveDomainState(80, 70, 5).confidence).toBe("moderate");
    expect(deriveDomainState(80, 70, 10).confidence).toBe("high");
  });
});

describe("computeCorrelation — real Pearson math, honest about thin data (§7.6, §7.7)", () => {
  it("returns null with fewer than the minimum sample size, never a fake-precise number", () => {
    const result = computeCorrelation([1, 2], [3, 4]);
    expect(result.r).toBeNull();
    expect(result.confidence).toBe("limited");
  });

  it("detects a strong positive correlation in a perfectly aligned series", () => {
    const a = [1, 2, 3, 4, 5, 6];
    const b = [2, 4, 6, 8, 10, 12];
    const result = computeCorrelation(a, b);
    expect(result.r).toBeCloseTo(1, 1);
    expect(result.direction).toBe("positive");
  });

  it("detects a strong negative correlation", () => {
    const a = [1, 2, 3, 4, 5, 6];
    const b = [12, 10, 8, 6, 4, 2];
    const result = computeCorrelation(a, b);
    expect(result.r).toBeLessThan(-0.9);
    expect(result.direction).toBe("negative");
  });

  it("detects no meaningful correlation in unrelated flat data", () => {
    const a = [5, 5, 5, 5, 5, 5];
    const b = [1, 8, 3, 9, 2, 7];
    const result = computeCorrelation(a, b);
    expect(result.direction).toBe("none");
  });
});

describe("buildWeeklyReview — historical integrity (Master Handoff §11)", () => {
  it("is unaffected by later mutation of the arrays passed into it", () => {
    const snapshots: DomainSnapshot[] = [
      { domain: "Academics", state: "improving", confidence: "high", headline: "SGPA trending up", evidenceCount: 10 },
    ];
    const wins = ["Finished DSA assignment early"];
    const friction = ["Missed one focus session"];

    const review = buildWeeklyReview("2026-08-24", "2026-08-30", snapshots, wins, friction);

    // Mutate the ORIGINAL arrays after the review was built.
    snapshots[0].state = "needs-attention";
    wins.push("A win added after the fact — must not appear in the review");
    friction.length = 0;

    // The stored review must reflect what was true at creation time, not now.
    expect(review.domainSnapshots[0].state).toBe("improving");
    expect(review.wins).toEqual(["Finished DSA assignment early"]);
    expect(review.friction).toEqual(["Missed one focus session"]);
  });
});
