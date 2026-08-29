/**
 * Performance Buddy OS — Quick Capture domain model.
 *
 * Per Day 16 Handoff §18/§19: Raw Text → Interpretation → Structured
 * Proposal → Deterministic Validation → User Confirmation → Existing
 * Authoritative Domain Engine. Interpretation must never auto-commit.
 *
 * HONEST NOTE: no real AI provider is wired anywhere in this codebase
 * (flagged since Day 12). "Interpretation" here is a deterministic,
 * rule-based classifier standing in for where a real AI call would
 * eventually go — same honest boundary as Day 12's AI Coach recommendations.
 */

export type CaptureType = "action" | "expense" | "routine-checkin" | "unclassified";

export type CaptureStatus = "unprocessed" | "proposed" | "resolved";

export type CaptureProposal = {
  type: CaptureType;
  confidence: "high" | "low"; // deterministic classifier — never a fabricated precise number
  fields: Record<string, string | number>;
};

/** Owns unresolved raw capture only — never a second Action/task database (§20). */
export type CaptureInboxItem = {
  id: string;
  rawText: string;
  status: CaptureStatus;
  proposal: CaptureProposal | null;
  createdAt: string;
};
