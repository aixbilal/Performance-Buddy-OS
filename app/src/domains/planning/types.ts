/**
 * Performance Buddy OS — Planning & Calendar domain model.
 *
 * Per Day 13 Handoff §9.1, these stay semantically separate — not one
 * generic Event model:
 *   Action = what needs doing (Day 3)
 *   ScheduleBlock (this file) = when you plan to do it
 *   Focus Session = actual targeted execution (Day 2)
 *   Deadline = date/time requirement, NOT a work block (§9.7)
 *
 * §9.13: Conflict (direct time overlap) and Capacity (total load vs limit)
 * are different problems — engine.ts checks them separately, never merges
 * them into one combined flag.
 */

export type BlockType = "fixed" | "flexible";

export type ScheduleBlock = {
  id: string;
  title: string;
  domain: string;
  day: number; // 0 = Monday .. 6 = Sunday
  startMinute: number; // minutes from midnight, e.g. 14:00 = 840
  endMinute: number;
  type: BlockType;
  /** Per §9.12: a locked block must survive plan regeneration untouched. */
  locked: boolean;
};

/** Per §9.7: a deadline is a requirement, never itself a scheduled work block. */
export type Deadline = {
  id: string;
  title: string;
  dueDate: string;
  relatedDomain: string;
};

export type CapacityConfig = {
  dailyCapacityMinutes: number; // same limit applied per day, kept simple on purpose
  weeklyCapacityMinutes: number;
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
