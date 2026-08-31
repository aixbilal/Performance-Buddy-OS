import { describe, it, expect } from "vitest";
import {
  buildSelfCheckItems,
  deriveMasteryOutcome,
  isCheckComplete,
  scoreMasteryCheck,
} from "./masteryEngine";
import type { MasteryItem, MasteryRating } from "./masteryTypes";

const items = (ratings: (MasteryRating | null)[]): MasteryItem[] =>
  ratings.map((r, i) => ({ id: `p${i}`, prompt: `prompt ${i}`, rating: r }));

describe("scoreMasteryCheck — explicit ratings → deterministic score", () => {
  it("confident=1, partial=0.5, unsure=0; percent over the item count", () => {
    const s = scoreMasteryCheck(items(["confident", "partial", "unsure", "confident"]));
    expect(s.score).toBe(2.5);
    expect(s.maxScore).toBe(4);
    expect(s.percent).toBe(63);
    expect(s.weak.map((w) => w.id)).toEqual(["p1", "p2"]);
  });

  it("an all-confident check is 100%", () => {
    expect(scoreMasteryCheck(items(["confident", "confident", "confident", "confident"])).percent).toBe(100);
  });

  it("only rated items count toward `answered`", () => {
    const s = scoreMasteryCheck(items(["confident", null, null, null]));
    expect(s.answered).toBe(1);
  });
});

describe("isCheckComplete", () => {
  it("false until every prompt is rated", () => {
    expect(isCheckComplete(items(["confident", null]))).toBe(false);
    expect(isCheckComplete(items(["confident", "unsure"]))).toBe(true);
    expect(isCheckComplete([])).toBe(false);
  });
});

describe("deriveMasteryOutcome — neutral, advisory bands", () => {
  it("<40% → needs-reinforcement (never 'failed'), review soon", () => {
    const o = deriveMasteryOutcome(25);
    expect(o.band).toBe("needs-reinforcement");
    expect(o.nextReviewInDays).toBe(2);
    expect(o.message).not.toMatch(/fail/i);
  });
  it("40–74% → developing", () => {
    expect(deriveMasteryOutcome(60).band).toBe("developing");
  });
  it(">=75% → strong, longer review interval", () => {
    const o = deriveMasteryOutcome(90);
    expect(o.band).toBe("strong");
    expect(o.nextReviewInDays).toBe(14);
  });
});

describe("buildSelfCheckItems", () => {
  it("returns the fixed, deterministic prompt set with stable ids and no ratings", () => {
    const a = buildSelfCheckItems();
    const b = buildSelfCheckItems();
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(a.every((i) => i.rating === null)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(3);
  });
});
