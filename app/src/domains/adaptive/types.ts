/**
 * Performance Buddy OS — V2 ADAPTIVE INTELLIGENCE persistence foundation types
 * (schema v11). See `docs/27 - V2 Adaptive Coach/V2 Master Blueprint -
 * 2026-09-01/07 - Consolidated V2 Master Blueprint.md` §6.
 *
 * These are the durable slices only. Derived state (Today's current/next block,
 * planning fit, course attention, mastery) is NEVER persisted here — it is
 * computed by the deterministic engines every render.
 *
 * Wire contract: every field below is the camelCase name the Rust `#[serde]`
 * structs emit/accept (`capture.rs`, `academic.rs`, `planning.rs`, `today.rs`).
 * The repo tests assert the exact JSON.
 */

// --- §4.1 / §6.2 Capture Proposal ------------------------------------------

/** "You said" vs "PBOS interpreted". Never "PBOS recommends" (that is an
 *  Intelligence Recommendation). */
export type CaptureProposalClass = "fact" | "interpretation";

/** Qualitative only — there is no fake numeric confidence. */
export type CaptureProposalConfidence = "clear" | "needs-review" | "ambiguous";

export type CaptureProposalStatus =
  | "proposed"
  | "accepted"
  | "modified"
  | "rejected"
  | "applied"
  | "apply-failed";

/** One reviewable proposal owned by a `capture_inbox` row (CASCADE). The
 *  applied change goes through the shared canonical mutation registry — this
 *  record only keeps the decision + validation + result trail. */
export type CaptureProposalRecord = {
  id: string;
  captureId: string;
  proposalClass: CaptureProposalClass;
  domain: string;
  mutationKind: string;
  title: string;
  sourceText: string;
  confidence: CaptureProposalConfidence;
  ambiguityReason: string | null;
  rationale: string;
  /** JSON string[] — short human evidence lines. */
  evidenceJson: string;
  /** Opaque JSON — params as first proposed. */
  originalParamsJson: string;
  /** Opaque JSON — params after any user edit (what Apply uses). */
  effectiveParamsJson: string;
  status: CaptureProposalStatus;
  validationJson: string | null;
  appliedResultJson: string | null;
  createdAt: string;
  decidedAt: string | null;
  appliedAt: string | null;
};

// --- §6.1 / §9.1 Assessment ↔ Topic scope --------------------------------

export type AssessmentScopeSource = "user" | "capture-approved" | "ai-applied";

/** Explicit "this topic is on this assessment". Absence = unknown, NOT "out of
 *  scope". Only topics from the assessment's own course are valid. */
export type AssessmentTopicLink = {
  assessmentId: string;
  topicId: string;
  source: AssessmentScopeSource;
  createdAt: string;
};

// --- §6.3 Action scheduling constraints ---------------------------------

export type PreferredTimeWindow = "morning" | "day" | "evening" | "anytime";

/** Structured scheduling metadata attached 1:1 to a canonical Action (CASCADE).
 *  Not a task list; `Action.estMinutes` stays the total estimate. */
export type ActionSchedulingConstraint = {
  actionId: string;
  requiredBefore: string | null;
  earliestDate: string | null;
  preferredTimeWindow: PreferredTimeWindow | null;
  minimumBlockMinutes: number | null;
  /** Default false — work is never assumed fragmentable. */
  splittable: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
};

// --- §6.4 Recurring occurrence exceptions ------------------------------

export type OccurrenceState = "skipped" | "done" | "deferred";

/** The state of ONE date of a recurring `planning_blocks` row, without mutating
 *  the recurring template. A one-off move points `replacementBlockId` at a
 *  concrete date-pinned block (nulled if that block is deleted). */
export type PlanningOccurrenceException = {
  id: string;
  blockId: string;
  occurrenceDate: string;
  state: OccurrenceState;
  replacementBlockId: string | null;
  source: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

// --- §6.5 Planning change sets (durable Planning Diff) ----------------

export type PlanningChangeSetScope = "micro" | "day" | "week";

export type PlanningChangeSetStatus =
  | "proposed"
  | "applied"
  | "rejected"
  | "apply-failed"
  | "undone";

/** The durable Planning Diff — proposed + inverse changes for review / audit /
 *  undo ONLY. Not a second copy of the schedule. `changesJson` /
 *  `inverseChangesJson` are validated at this TS boundary (see
 *  `PlanningDiffChange`) even though Rust stores them opaque. */
export type PlanningChangeSet = {
  id: string;
  scope: PlanningChangeSetScope;
  status: PlanningChangeSetStatus;
  targetStartDate: string | null;
  targetEndDate: string | null;
  rationale: string;
  /** JSON string[] of reason codes. */
  reasonCodesJson: string;
  /** JSON `PlanningDiffChange[]`. */
  changesJson: string;
  /** JSON `PlanningDiffChange[]` — the inverse, for practical Undo. */
  inverseChangesJson: string;
  source: string;
  createdAt: string;
  decidedAt: string | null;
  appliedAt: string | null;
  undoneAt: string | null;
};

/** The typed change vocabulary (§10.6). `could-not-fit` is explanatory output,
 *  never an applied mutation, so it is not in this union. `remove-block` and
 *  `clear-occurrence` exist only as the inverse of `add` and of an occurrence
 *  change, for a practical Undo. */
export type PlanningDiffChange =
  | { kind: "keep"; blockId: string }
  | { kind: "add"; block: Record<string, unknown> }
  | { kind: "move"; blockId: string; toDate?: string | null; toDay?: number; toStartMinute: number }
  | { kind: "shorten"; blockId: string; toEndMinute: number }
  | { kind: "defer"; blockId: string; occurrenceDate: string; toDate: string }
  | { kind: "drop-occurrence"; blockId: string; occurrenceDate: string }
  | { kind: "mark-occurrence-done"; blockId: string; occurrenceDate: string }
  | { kind: "mark-occurrence-skipped"; blockId: string; occurrenceDate: string }
  | { kind: "remove-block"; blockId: string }
  | { kind: "clear-occurrence"; blockId: string; occurrenceDate: string };

const DIFF_KINDS: ReadonlySet<string> = new Set([
  "keep",
  "add",
  "move",
  "shorten",
  "defer",
  "drop-occurrence",
  "mark-occurrence-done",
  "mark-occurrence-skipped",
  "remove-block",
  "clear-occurrence",
]);

// --- Transactional Planning Diff apply (V2 hardening) --------------------

/** A block whose (start, end) must still match, or the apply is refused as
 *  stale. Snapshotted at diff-review time. */
export type ExpectedBlock = { id: string; startMinute: number; endMinute: number };

/**
 * The typed op the renderer sends to the Rust `plan_apply_change_set` /
 * `plan_undo_change_set` transaction. Richer than `PlanningDiffChange`: it
 * carries the fully-resolved occurrence-exception and replacement-block rows so
 * Rust never has to look anything up beyond validation. Serde on the Rust side
 * rejects any unknown `kind` (fails closed).
 */
export type PlanChangeOp =
  | { kind: "keep"; blockId: string }
  | { kind: "add"; block: Record<string, unknown> }
  | { kind: "move"; blockId: string; toStartMinute: number }
  | { kind: "shorten"; blockId: string; toEndMinute: number }
  | { kind: "remove-block"; blockId: string }
  | { kind: "defer"; exception: PlanningOccurrenceException; replacement: Record<string, unknown> }
  | { kind: "drop-occurrence"; exception: PlanningOccurrenceException }
  | { kind: "mark-occurrence-done"; exception: PlanningOccurrenceException }
  | { kind: "mark-occurrence-skipped"; exception: PlanningOccurrenceException }
  | { kind: "clear-occurrence"; blockId: string; occurrenceDate: string };

export type ApplyChangeSetRequest = {
  changeSet: PlanningChangeSet;
  ops: PlanChangeOp[];
  expected: ExpectedBlock[];
  now: string;
};

export type UndoChangeSetRequest = {
  changeSetId: string;
  ops: PlanChangeOp[];
  now: string;
};

export type ChangeSetApplyReport = { ok: boolean; changeSetId: string; appliedOps: number };

/** Parse + validate a `changesJson` / `inverseChangesJson` blob. Returns `null`
 *  on any malformed entry rather than a partially-trusted list. */
export function parsePlanningDiffChanges(json: string): PlanningDiffChange[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const out: PlanningDiffChange[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const kind = (entry as { kind?: unknown }).kind;
    if (typeof kind !== "string" || !DIFF_KINDS.has(kind)) return null;
    out.push(entry as PlanningDiffChange);
  }
  return out;
}

// --- §6.6 / §11.5 Today subjective operating state ------------------

export type TodayCapacityLevel = "low" | "normal" | "high";
export type TodayCapacitySource = "user" | "capture-approved";

/** The ONLY persisted Today slice: one row per ISO date, the subjective daily
 *  capacity. Default (no row) is read as Normal by the engine — never inferred
 *  from the clock. Does not touch persistent Planner capacity. */
export type TodayOperatingState = {
  date: string;
  capacityLevel: TodayCapacityLevel;
  source: TodayCapacitySource;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_TODAY_CAPACITY: TodayCapacityLevel = "normal";
