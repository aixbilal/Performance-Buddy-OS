/**
 * Performance Buddy OS — Quick Capture domain model (Batch 3: made durable).
 *
 * Pipeline (Global Quick Capture / Capture Inbox decision specs):
 *   RAW TEXT -> INTERPRETATION -> STRUCTURED PROPOSAL -> DETERMINISTIC
 *   VALIDATION -> USER CONFIRMATION -> EXISTING AUTHORITATIVE DOMAIN ENGINE
 *   -> CANONICAL ENTITY.
 *
 * Quick Capture OWNS NOTHING downstream. It does not own Actions, Transactions,
 * Knowledge topics or Routine logs — a confirmed capture is delegated to the
 * existing canonical domain store, and the inbox row is marked resolved.
 *
 * It must work WITHOUT AI: an unclassifiable capture is still persisted to the
 * durable Capture Inbox for later manual classification. No input loss, and no
 * fake AI interpretation.
 *
 * HONEST NOTE: no real AI provider is wired anywhere (Batch 6). "Interpretation"
 * is a deterministic, rule-based classifier standing in for where a real AI
 * call will eventually go — the same honest boundary the AI Coach uses.
 */

/** V1 capture types. `unclassified` = persisted raw, awaiting manual triage. */
export type CaptureType = "action" | "expense" | "routine-checkin" | "note" | "unclassified";

export type CaptureStatus = "unprocessed" | "proposed" | "resolved";

export type CaptureProposal = {
  type: CaptureType;
  /** deterministic classifier — never a fabricated precise number */
  confidence: "high" | "low";
  fields: Record<string, string | number>;
};

/** How a capture left the inbox — recorded on the row, not a second entity. */
export type CaptureResolution =
  | { kind: "confirmed"; target: CaptureType; entityId: string | null }
  | { kind: "dismissed" };

/** Owns unresolved raw capture only — never a second Action/task database. */
export type CaptureInboxItem = {
  id: string;
  rawText: string;
  status: CaptureStatus;
  proposal: CaptureProposal | null;
  resolution: CaptureResolution | null;
  createdAt: string;
  updatedAt: string;
};
