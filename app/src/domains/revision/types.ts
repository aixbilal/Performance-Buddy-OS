/**
 * Performance Buddy OS — general cross-domain revision / audit event store.
 *
 * `docs/32` data class 3 (audit finding P1-20). ONE immutable row per
 * important user-visible change, in any domain. This is a history LOG the
 * user can inspect — it is never authoritative domain state (mastery,
 * grades, balances stay derived from their own canonical tables) and never
 * a full entity snapshot.
 */

export type RevisionDomain =
  | "performance"
  | "academic"
  | "knowledge"
  | "planning"
  | "routine"
  | "settings"
  | "development"
  | "fitness"
  | "language"
  | "money";

export type RevisionOperation =
  | "create"
  | "update"
  | "delete"
  | "status-change"
  | "apply"
  | "reschedule"
  | "check-in";

/** Who caused the change. `ai-applied` = an allowlisted AI Apply adapter. */
export type RevisionSource = "user" | "ai-applied" | "import" | "system";

export type RevisionEvent = {
  id: string;
  domain: RevisionDomain;
  entityType: string;
  entityId: string;
  operation: RevisionOperation;
  source: RevisionSource;
  /** Short human sentence — "Marked \"Read chapter 3\" done". */
  summary: string;
  /** Small targeted before/after, NOT a full entity dump. */
  metadata: Record<string, unknown>;
  createdAt: string;
};

/** What a caller passes to `recordRevision` — id + timestamp are filled in,
 *  and `metadata` is optional (defaults to `{}`). */
export type RevisionInput = Omit<RevisionEvent, "id" | "createdAt" | "metadata"> & {
  metadata?: Record<string, unknown>;
};

export type RevisionQuery = {
  domain?: RevisionDomain;
  entityType?: string;
  entityId?: string;
  limit?: number;
};
