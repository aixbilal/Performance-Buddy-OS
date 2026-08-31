/**
 * Deterministic Mastery Check engine. Pure arithmetic — no AI, no fabricated
 * question bank. A self-check turns explicit user ratings into a score; the
 * outcome band is check-local advice, never a stored Academic mastery value.
 */
import type { MasteryBand, MasteryItem, MasteryRating } from "./masteryTypes";

/** The fixed self-check probes. Deterministic, source-neutral, not AI-generated. */
export const SELF_CHECK_PROMPTS: readonly string[] = [
  "Explain the core idea in your own words, without notes.",
  "Work a representative problem end to end.",
  "Recall the key definitions and terms after a short distraction.",
  "Connect it to another topic or something you already know.",
];

export function buildSelfCheckItems(): MasteryItem[] {
  return SELF_CHECK_PROMPTS.map((prompt, i) => ({ id: `p${i}`, prompt, rating: null }));
}

const RATING_VALUE: Record<MasteryRating, number> = { confident: 1, partial: 0.5, unsure: 0 };

export type MasteryScore = {
  score: number;
  maxScore: number;
  percent: number;
  answered: number;
  /** Items rated below "confident" — the deterministic weak spots. */
  weak: MasteryItem[];
};

export function scoreMasteryCheck(items: MasteryItem[]): MasteryScore {
  const rated = items.filter((i) => i.rating !== null);
  const score = rated.reduce((s, i) => s + RATING_VALUE[i.rating as MasteryRating], 0);
  const maxScore = items.length;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return {
    score,
    maxScore,
    percent,
    answered: rated.length,
    weak: items.filter((i) => i.rating === "partial" || i.rating === "unsure"),
  };
}

export function isCheckComplete(items: MasteryItem[]): boolean {
  return items.length > 0 && items.every((i) => i.rating !== null);
}

export type MasteryOutcome = {
  band: MasteryBand;
  /** A suggested review interval — advisory, never auto-applied. */
  nextReviewInDays: number;
  message: string;
};

/**
 * Check-local outcome. Thresholds mirror the Knowledge state cutoffs so the two
 * views agree, but this produces ADVICE, not a stored number. Neutral language:
 * a low result is "needs reinforcement", never "failed".
 */
export function deriveMasteryOutcome(percent: number): MasteryOutcome {
  if (percent < 40) {
    return {
      band: "needs-reinforcement",
      nextReviewInDays: 2,
      message: "Needs reinforcement — revisit the weak points soon and check again.",
    };
  }
  if (percent < 75) {
    return {
      band: "developing",
      nextReviewInDays: 5,
      message: "Developing — solid start; a short review in a few days will help it stick.",
    };
  }
  return {
    band: "strong",
    nextReviewInDays: 14,
    message: "Strong — keep it warm with a lighter review in about two weeks.",
  };
}
