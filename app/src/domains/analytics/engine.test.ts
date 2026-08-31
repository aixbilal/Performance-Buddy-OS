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

// --- Batch 6 additions -----------------------------------------------------
import {
  comparePeriods,
  completionRate,
  derivePatterns,
  deriveDataSufficiency,
  isoInWindow,
  monthBounds,
  startOfWeekIso,
} from "./engine";

describe("date windows", () => {
  it("isoInWindow is inclusive on both ends", () => {
    expect(isoInWindow("2026-03-10", "2026-03-01", "2026-03-31")).toBe(true);
    expect(isoInWindow("2026-03-01", "2026-03-01", "2026-03-31")).toBe(true);
    expect(isoInWindow("2026-04-01", "2026-03-01", "2026-03-31")).toBe(false);
  });
  it("startOfWeekIso returns the Monday", () => {
    // 2026-03-11 is a Wednesday
    expect(startOfWeekIso("2026-03-11")).toBe("2026-03-09");
  });
  it("monthBounds gives first + last calendar day", () => {
    expect(monthBounds("2026-02-15")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("completionRate", () => {
  it("is null with no logs (unknown ≠ zero)", () => {
    expect(completionRate([]).rate).toBeNull();
  });
  it("counts completed/done states", () => {
    const r = completionRate([{ state: "completed" }, { state: "done" }, { state: "skipped" }, { state: "missed" }]);
    expect(r).toEqual({ rate: 50, completed: 2, total: 4 });
  });
});

describe("comparePeriods — insufficient when the prior window is missing", () => {
  it("returns insufficient (not 0%) when prior is null", () => {
    const c = comparePeriods("Routine completion", "%", 60, null);
    expect(c.status).toBe("insufficient");
    expect(c.delta).toBeNull();
  });
  it("classifies improved / declined / flat by threshold", () => {
    expect(comparePeriods("m", "%", 80, 60).status).toBe("improved");
    expect(comparePeriods("m", "%", 40, 60).status).toBe("declined");
    expect(comparePeriods("m", "%", 62, 60).status).toBe("flat");
  });
});

describe("deriveDataSufficiency", () => {
  it("insufficient / thin / sufficient bands", () => {
    expect(deriveDataSufficiency(1)).toBe("insufficient");
    expect(deriveDataSufficiency(5)).toBe("thin");
    expect(deriveDataSufficiency(12)).toBe("sufficient");
  });
});

describe("derivePatterns — honest INSUFFICIENT EVIDENCE (docs 22.14)", () => {
  it("with fewer than two usable series, returns one insufficient pattern", () => {
    const out = derivePatterns([{ label: "A", days: [{ date: "2026-03-01", completed: true }] }]);
    expect(out).toHaveLength(1);
    expect(out[0].insufficient).toBe(true);
  });
  it("with two series but few overlapping days, the pair pattern is insufficient (no fake coefficient)", () => {
    const days = (n: number, every: number) =>
      Array.from({ length: n }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, "0")}`,
        completed: i % every === 0,
      }));
    const out = derivePatterns([
      { label: "Hydration", days: days(4, 2) },
      { label: "Reading", days: days(4, 2) },
    ]);
    expect(out[0].insufficient).toBe(true);
  });
  it("with enough overlapping days, describes a correlation as association, not cause", () => {
    const days = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      completed: i % 2 === 0,
    }));
    const out = derivePatterns([
      { label: "Hydration", days },
      { label: "Reading", days: days.map((d) => ({ ...d })) },
    ]);
    expect(out[0].insufficient).toBe(false);
    expect(out[0].direction).toBe("positive");
    expect(out[0].title.toLowerCase()).toContain("association, not cause");
  });
});
