/**
 * Deterministic Quick Capture Engine. Rule-based classification only — see
 * types.ts header note on why this stands in for AI interpretation honestly.
 */

import type { CaptureProposal, CaptureType } from "./types";

const EXPENSE_PATTERN = /\b(rs\.?|pkr|\$|spent|paid|bought)\b/i;
const AMOUNT_PATTERN = /(\d+(?:\.\d+)?)/;
const ROUTINE_KEYWORDS = ["hydration", "water", "prayer", "skincare", "workout done", "drank"];

/**
 * Classifies raw text into a structured proposal. Never returns a fabricated
 * high-confidence guess — falls back to "unclassified" + low confidence
 * rather than pretending certainty, per §19 ("interpretation must not
 * auto-commit").
 */
export function classifyCapture(rawText: string): CaptureProposal {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  if (EXPENSE_PATTERN.test(lower)) {
    const amountMatch = text.match(AMOUNT_PATTERN);
    return {
      type: "expense",
      confidence: amountMatch ? "high" : "low",
      fields: { description: text, amount: amountMatch ? parseFloat(amountMatch[1]) : 0 },
    };
  }

  if (ROUTINE_KEYWORDS.some((k) => lower.includes(k))) {
    return { type: "routine-checkin", confidence: "high", fields: { description: text } };
  }

  // Default: treat as a plain Action if it reads like a task (starts with a verb-ish word is too fragile to check reliably, so default low-confidence Action rather than false-labeling as unclassified).
  if (text.length > 0) {
    return { type: "action", confidence: "low", fields: { title: text } };
  }

  return { type: "unclassified", confidence: "low", fields: {} };
}

/** Only high-confidence proposals are safe to pre-fill for one-click confirm; low-confidence always needs review, never silently applied. */
export function requiresManualReview(proposal: CaptureProposal): boolean {
  return proposal.confidence === "low" || proposal.type === "unclassified";
}

export type CaptureType_ = CaptureType; // re-export convenience, no logic
