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
export function rebuildUnlockedBlocks(existingBlocks: ScheduleBlock[], proposedUnlockedBlocks: ScheduleBlock[]): ScheduleBlock[] {
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
