/**
 * Deterministic Planning Engine. No AI is ever the scheduling authority
 * here (Handoff §14 instruction) — every function is pure arithmetic/logic.
 */

import type { CapacityViolation, Conflict, FragilityState, ScheduleBlock } from "./types";

/** §9.13: direct time overlap only — says nothing about capacity. */
export function detectConflicts(blocks: ScheduleBlock[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.day !== b.day) continue;
      const overlapStart = Math.max(a.startMinute, b.startMinute);
      const overlapEnd = Math.min(a.endMinute, b.endMinute);
      const overlapMinutes = overlapEnd - overlapStart;
      if (overlapMinutes > 0) {
        conflicts.push({ blockAId: a.id, blockBId: b.id, day: a.day, overlapMinutes });
      }
    }
  }
  return conflicts;
}

function minutesForDay(blocks: ScheduleBlock[], day: number): number {
  return blocks.filter((b) => b.day === day).reduce((s, b) => s + (b.endMinute - b.startMinute), 0);
}

function totalMinutes(blocks: ScheduleBlock[]): number {
  return blocks.reduce((s, b) => s + (b.endMinute - b.startMinute), 0);
}

/**
 * §9.14: daily AND weekly capacity are validated independently — a week can
 * have no single overloaded day yet still exceed weekly capacity, or vice
 * versa. Both are checked and returned separately, never merged into one flag.
 */
export function detectCapacityViolations(blocks: ScheduleBlock[], dailyCapacityMinutes: number, weeklyCapacityMinutes: number): CapacityViolation[] {
  const violations: CapacityViolation[] = [];

  for (let day = 0; day < 7; day++) {
    const scheduled = minutesForDay(blocks, day);
    if (scheduled > dailyCapacityMinutes) {
      violations.push({ scope: "day", day, scheduledMinutes: scheduled, capacityMinutes: dailyCapacityMinutes, overMinutes: scheduled - dailyCapacityMinutes });
    }
  }

  const weekScheduled = totalMinutes(blocks);
  if (weekScheduled > weeklyCapacityMinutes) {
    violations.push({ scope: "week", day: null, scheduledMinutes: weekScheduled, capacityMinutes: weeklyCapacityMinutes, overMinutes: weekScheduled - weeklyCapacityMinutes });
  }

  return violations;
}

export type FitResult = { fits: boolean; reason: string | null };

/**
 * §9.11: "PBOS should be allowed to return Could Not Fit rather than
 * silently overloading the week." Checks conflicts AND both capacity levels
 * before allowing a new block to be added — the first real problem found is
 * reported, not swallowed.
 */
export function tryFitBlock(
  candidate: ScheduleBlock,
  existingBlocks: ScheduleBlock[],
  dailyCapacityMinutes: number,
  weeklyCapacityMinutes: number
): FitResult {
  const withCandidate = [...existingBlocks, candidate];

  const conflicts = detectConflicts(withCandidate).filter((c) => c.blockAId === candidate.id || c.blockBId === candidate.id);
  if (conflicts.length > 0) {
    return { fits: false, reason: `Overlaps with an existing block by ${conflicts[0].overlapMinutes} minutes.` };
  }

  const violations = detectCapacityViolations(withCandidate, dailyCapacityMinutes, weeklyCapacityMinutes);
  const dayViolation = violations.find((v) => v.scope === "day" && v.day === candidate.day);
  if (dayViolation) {
    return { fits: false, reason: `Would exceed that day's capacity by ${dayViolation.overMinutes} minutes.` };
  }
  const weekViolation = violations.find((v) => v.scope === "week");
  if (weekViolation) {
    return { fits: false, reason: `Would exceed weekly capacity by ${weekViolation.overMinutes} minutes.` };
  }

  return { fits: true, reason: null };
}

/**
 * §9.12: "Manual locks survive regeneration." Locked blocks are copied
 * through UNCHANGED; only unlocked blocks are replaced by the proposed set.
 * This is proven by a test that checks reference equality of the locked
 * block's contents, not just "probably works."
 */
export function rebuildUnlockedBlocks<T extends ScheduleBlock>(existingBlocks: T[], proposedUnlockedBlocks: T[]): T[] {
  const lockedBlocks = existingBlocks.filter((b) => b.locked).map((b) => ({ ...b }));
  return [...lockedBlocks, ...proposedUnlockedBlocks];
}

/**
 * §9.18: "Valid but fragile" — a plan can technically fit yet leave almost
 * no buffer. 100% utilization is explicitly NOT the goal.
 */
export function computePlanFragility(scheduledMinutes: number, capacityMinutes: number, bufferThresholdMinutes = 30): FragilityState {
  const buffer = capacityMinutes - scheduledMinutes;
  if (buffer < 0) return "exceeds";
  if (buffer < bufferThresholdMinutes) return "valid-fragile";
  return "valid";
}

/**
 * Day 18 §59: "Moving scheduled time ≠ New Action." Rescheduling only ever
 * changes day/time — `id` and `actionId` carry through unchanged, and no
 * new block or Action is ever created.
 */
export function rescheduleBlock<T extends ScheduleBlock>(
  block: T,
  newDay: number,
  newStartMinute: number,
  newEndMinute: number
): T {
  return { ...block, day: newDay, startMinute: newStartMinute, endMinute: newEndMinute };
}

/**
 * Deterministic filter for "what is scheduled on a given calendar day".
 * A block with an absolute `date` matches that date exactly; a block with
 * `date == null` recurs weekly and matches when its `day` equals the target
 * weekday index (0 = Monday .. 6 = Sunday). This is the boundary Today uses.
 */
export function blocksOnDate<T extends ScheduleBlock & { date: string | null }>(
  blocks: T[],
  isoDate: string,
  weekdayIndex: number
): T[] {
  return blocks
    .filter((b) => (b.date != null ? b.date === isoDate : b.day === weekdayIndex))
    .sort((a, b) => a.startMinute - b.startMinute);
}

// ---------------------------------------------------------------------------
// Deterministic calendar-date math. All local-time, no timezone conversion —
// a `yyyy-mm-dd` string is treated as a wall-clock civil date, so the Calendar
// grid never drifts across a DST boundary.
// ---------------------------------------------------------------------------

/** JS `Date.getDay()` (0=Sun..6=Sat) -> PBOS weekday index (0=Mon..6=Sun). */
export const JS_DAY_TO_MONDAY_INDEX = [6, 0, 1, 2, 3, 4, 5] as const;

function civil(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local civil date -> `yyyy-mm-dd`. */
export function isoDateOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** PBOS weekday index (0=Mon..6=Sun) for a civil date string. */
export function mondayIndexOf(iso: string): number {
  const { y, m, d } = civil(iso);
  return JS_DAY_TO_MONDAY_INDEX[new Date(y, m - 1, d).getDay()];
}

/** `iso` shifted by `n` whole days (can be negative), as `yyyy-mm-dd`. */
export function addDaysIso(iso: string, n: number): string {
  const { y, m, d } = civil(iso);
  return isoDateOf(new Date(y, m - 1, d + n));
}

/** Monday (PBOS start-of-week) of the week containing `iso`. */
export function startOfWeekIso(iso: string): string {
  return addDaysIso(iso, -mondayIndexOf(iso));
}

/** The 7 civil dates Mon..Sun for the week starting at `mondayIso`. */
export function weekDates(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
}

export type ScheduleProposalItem = {
  actionId: string;
  title: string;
  day: number;
  startMinute: number;
  endMinute: number;
};
export type CouldNotFit = { actionId: string; title: string; reason: string };
export type ScheduleProposal = {
  proposed: ScheduleProposalItem[];
  couldNotFit: CouldNotFit[];
};

/**
 * DETERMINISTIC (NOT AI) proposal generator. For each candidate Action with an
 * estimate, it scans days Mon..Sun and 30-minute-aligned start times inside the
 * working window for the first slot that passes `tryFitBlock` against the
 * blocks that must be respected (locked/existing + already-proposed). Anything
 * that cannot be placed is reported as `couldNotFit` — never silently dropped,
 * never overlapped. Callers turn `proposed` into `source: "generated"` blocks
 * only on APPLY.
 */
export function proposeSchedule(
  candidates: { actionId: string; title: string; estMinutes: number | null }[],
  respectBlocks: ScheduleBlock[],
  dailyCapacityMinutes: number,
  weeklyCapacityMinutes: number,
  opts: { windowStartMinute?: number; windowEndMinute?: number; defaultMinutes?: number; stepMinutes?: number } = {}
): ScheduleProposal {
  const windowStart = opts.windowStartMinute ?? 9 * 60;
  const windowEnd = opts.windowEndMinute ?? 21 * 60;
  const step = opts.stepMinutes ?? 30;
  const fallback = opts.defaultMinutes ?? 30;

  const working: ScheduleBlock[] = respectBlocks.map((b) => ({ ...b }));
  const proposed: ScheduleProposalItem[] = [];
  const couldNotFit: CouldNotFit[] = [];

  for (const c of candidates) {
    const duration = c.estMinutes && c.estMinutes > 0 ? c.estMinutes : fallback;
    let placed = false;
    let lastReason = "No free slot inside the working window this week.";

    outer: for (let day = 0; day < 7 && !placed; day++) {
      for (let start = windowStart; start + duration <= windowEnd; start += step) {
        const candidate: ScheduleBlock = {
          id: `proposal-${c.actionId}`,
          title: c.title,
          domain: "Planning",
          day,
          startMinute: start,
          endMinute: start + duration,
          type: "flexible",
          locked: false,
          actionId: c.actionId,
        };
        const fit = tryFitBlock(candidate, working, dailyCapacityMinutes, weeklyCapacityMinutes);
        if (fit.fits) {
          working.push(candidate);
          proposed.push({ actionId: c.actionId, title: c.title, day, startMinute: start, endMinute: start + duration });
          placed = true;
          break outer;
        }
        lastReason = fit.reason ?? lastReason;
      }
    }

    if (!placed) couldNotFit.push({ actionId: c.actionId, title: c.title, reason: lastReason });
  }

  return { proposed, couldNotFit };
}
