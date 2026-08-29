import { describe, it, expect } from "vitest";
import { classifyCapture, requiresManualReview } from "./engine";

describe("classifyCapture — deterministic rule-based classification (§18/§19)", () => {
  it("classifies an expense with a clear amount as high confidence", () => {
    const proposal = classifyCapture("Spent Rs 450 on lunch");
    expect(proposal.type).toBe("expense");
    expect(proposal.confidence).toBe("high");
    expect(proposal.fields.amount).toBe(450);
  });

  it("classifies an expense-like phrase without a parseable amount as low confidence, not fabricated", () => {
    const proposal = classifyCapture("Paid for something");
    expect(proposal.type).toBe("expense");
    expect(proposal.confidence).toBe("low");
  });

  it("classifies a routine keyword as a routine check-in", () => {
    const proposal = classifyCapture("Drank water, hydration done for the morning");
    expect(proposal.type).toBe("routine-checkin");
  });

  it("falls back to a low-confidence Action for ordinary task-like text, never a fabricated high confidence", () => {
    const proposal = classifyCapture("Review DSA notes before Friday");
    expect(proposal.type).toBe("action");
    expect(proposal.confidence).toBe("low");
  });

  it("classifies empty input as unclassified rather than guessing", () => {
    const proposal = classifyCapture("   ");
    expect(proposal.type).toBe("unclassified");
  });
});

describe("requiresManualReview — low confidence never auto-commits (§19)", () => {
  it("requires review for low-confidence proposals", () => {
    expect(requiresManualReview({ type: "action", confidence: "low", fields: {} })).toBe(true);
  });
  it("requires review for unclassified input regardless of confidence label", () => {
    expect(requiresManualReview({ type: "unclassified", confidence: "high", fields: {} })).toBe(true);
  });
  it("does not require review for a genuinely high-confidence expense", () => {
    expect(requiresManualReview({ type: "expense", confidence: "high", fields: { amount: 450 } })).toBe(false);
  });
});
