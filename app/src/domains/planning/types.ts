/**
 * Performance Buddy OS — Planning & Calendar domain model (Batch 3).
 *
 * These stay semantically separate — not one generic Event model:
 *   Action        = what needs doing (Batch 1, canonical)
 *   PlanningBlock  = when you plan to do it (this file)
 *   Focus Session  = actual targeted execution
 *   Deadline       = a date/time requirement, NEVER a scheduled work block
 *
 * PRODUCT LOCKS:
 *   ACTION ≠ PLANNING BLOCK ≠ CALENDAR EVENT ≠ COMPLETION.
 *   - A PlanningBlock MAY reference the canonical Action it schedules
 *     (`actionId`) — nullable, since a fixed lecture needs no Action. An Action
 *     has zero or more blocks. Deleting the Action keeps planning history
 *     (`actionId` is SET NULL, block survives).
 *   - `status` here is block-local ('scheduled' | 'done' | 'skipped'). It is
 *     NOT Action completion — scheduling an Action never marks it done, and
 *     completing an Action does not delete its planning history.
 *   - The block never stores an authoritative copy of Action title / status /
 *     deadline; linked Action data is read live.
 *   - `locked` marks a manual decision that MUST survive plan regeneration.
 *   - `source` is provenance: 'manual' (user placed it) or 'generated' (from a
 *     proposal the user applied).
 *
 * Conflict (direct time overlap) and Capacity (total load vs limit) are
 * different problems — engine.ts checks them separately, never merged.
 * Both are DERIVED; nothing here is stored.
 */

export type BlockType = "fixed" | "flexible";
export type BlockSource = "manual" | "generated";
export type BlockStatus = "scheduled" | "done" | "skipped";

/**
 * The structural shape the deterministic engine reads. `PlanningBlock`
 * satisfies it — kept as its own type so `engine.ts` and its tests are
 * unaffected by the persistence fields added for Batch 3.
 */
export type ScheduleBlock = {
  id: string;
  title: string;
  domain: string;
  /** 0 = Monday .. 6 = Sunday — drives the weekly Calendar grid and the engine. */
  day: number;
  /** Minutes from midnight, e.g. 14:00 = 840. */
  startMinute: number;
  endMinute: number;
  type: BlockType;
  /** A locked block survives plan regeneration untouched (§9.12). */
  locked: boolean;
  /** Canonical Action this block schedules. Null = no linked Action. */
  actionId: string | null;
};

/** The canonical, persisted scheduled-block record. ONE scheduled-block truth. */
export type PlanningBlock = ScheduleBlock & {
  /**
   * Optional absolute yyyy-mm-dd pin. Null = "recurs weekly on `day`".
   * A value = "this specific date" (what Today matches on).
   */
  date: string | null;
  source: BlockSource;
  status: BlockStatus;
  createdAt: string;
  updatedAt: string;
};

export type PlanningBlockInput = {
  title: string;
  domain: string;
  actionId: string | null;
  day: number;
  date: string | null;
  startMinute: number;
  endMinute: number;
  type: BlockType;
  locked: boolean;
  source: BlockSource;
  status: BlockStatus;
};

/** Same limit applied per day, kept deliberately simple. Empty time ≠ capacity. */
export type CapacityConfig = {
  dailyCapacityMinutes: number;
  weeklyCapacityMinutes: number;
};

export type PlanningGraph = {
  blocks: PlanningBlock[];
  capacity: CapacityConfig;
};

/** Per §9.7: a deadline is a requirement, never itself a scheduled work block. */
export type Deadline = {
  id: string;
  title: string;
  dueDate: string;
  relatedDomain: string;
};

export type Conflict = {
  blockAId: string;
  blockBId: string;
  day: number;
  overlapMinutes: number;
};

export type CapacityViolation = {
  scope: "day" | "week";
  day: number | null; // null when scope is "week"
  scheduledMinutes: number;
  capacityMinutes: number;
  overMinutes: number;
};

export type FragilityState = "valid" | "valid-fragile" | "exceeds";

export const DEFAULT_CAPACITY: CapacityConfig = {
  dailyCapacityMinutes: 150,
  weeklyCapacityMinutes: 14 * 60,
};
