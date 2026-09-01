/**
 * Adaptive Planning — the concrete-date candidate-placement engine (V2 Phase F).
 *
 * Pure and deterministic. It works over a real ISO-date horizon, NOT the weekly
 * grid. No LLM ever chooses a timestamp; this function does, by the fixed rules
 * in blueprint 07 §10.3:
 *
 *   1  never overlap                         9  place one-off work date-pinned
 *   2  daily capacity must hold             10 respect earliest date
 *   3  weekly capacity must hold            11 honour minimum useful duration
 *   4  fixed blocks are never moved         12 split only when splittable
 *   5  locked blocks survive                13 honour preferred window if feasible
 *   6  manual blocks survive by default     14 minimise plan churn
 *   7  only *released* manual may move      15 prefer healthier buffer among ties
 *   8  generated-flexible may be nudged     16 "Could Not Fit" is a valid result
 *
 * The output is a set of placements + Could-Not-Fit reasons + (when a nudge was
 * needed) the moves that made room. `buildPlanningDiff` turns that into a typed
 * change list with its inverse for review / apply / undo.
 */
import { tryFitBlock, computePlanFragility, mondayIndexOf } from "./engine";
import type { ScheduleBlock } from "./types";
import type { PlanningDiffChange } from "../adaptive/types";

// -------------------------------------------------------------------------
// Inputs
// -------------------------------------------------------------------------

export type PreferredTimeWindow = "morning" | "day" | "evening" | "anytime";

/** A transient unit of work to place. NEVER persisted as its own table. */
export type PlanningCandidate = {
  id: string;
  sourceDomain: string;
  sourceEntityType: string;
  sourceEntityId: string | null;
  actionId: string | null;
  title: string;
  context: string;
  estMinutes: number;
  requiredBefore: string | null;
  earliestDate: string | null;
  preferredTimeWindow: PreferredTimeWindow | null;
  minimumBlockMinutes: number | null;
  splittable: boolean;
  reasonCodes: string[];
  /** Lower = placed first. */
  priority: number;
};

/** One block instance resolved onto a specific calendar date. */
export type DatedBlock = ScheduleBlock & {
  date: string;
  /** 'manual' blocks are protected unless their id is in `releasedManualIds`. */
  origin: "manual" | "generated";
};

export type AdaptiveScope = "micro" | "day" | "week";

export type PlacementInput = {
  candidates: PlanningCandidate[];
  /** Inclusive ISO date range to consider. */
  horizonStartIso: string;
  horizonEndIso: string;
  /** Blocks already on the calendar, resolved per date. */
  datedBlocks: DatedBlock[];
  dailyCapacityMinutes: number;
  weeklyCapacityMinutes: number;
  scope: AdaptiveScope;
  /** Manual blocks the user explicitly released for movement. */
  releasedManualIds?: string[];
  /** Working-window bounds (minutes from midnight) + step. */
  windowStartMinute?: number;
  windowEndMinute?: number;
  stepMinutes?: number;
  /** For a "day" scope: the single date it is allowed to touch. */
  onlyDate?: string;
};

export type Placement = {
  candidateId: string;
  actionId: string | null;
  title: string;
  date: string;
  startMinute: number;
  endMinute: number;
  reasonCodes: string[];
  /** Contiguous piece n of m (splittable candidates only). */
  part?: { index: number; of: number };
};

export type Nudge = {
  blockId: string;
  fromStartMinute: number;
  toStartMinute: number;
  date: string;
};

export type CouldNotFit = { candidateId: string; title: string; reason: string };

export type AdaptivePlan = {
  placements: Placement[];
  nudges: Nudge[];
  couldNotFit: CouldNotFit[];
};

// -------------------------------------------------------------------------
// Date helpers
// -------------------------------------------------------------------------

function civ(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function isoAdd(iso: string, n: number): string {
  const d = new Date(civ(iso) + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
function datesInRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  for (let t = civ(startIso); t <= civ(endIso); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
function isoWeekKey(iso: string): string {
  // Monday-of-week as the key (matches PBOS start-of-week).
  return isoAdd(iso, -mondayIndexOf(iso));
}

/** Sizes to try for a splittable piece: from `max` down to `min` in `step`s. */
function sizeLadder(max: number, min: number, step: number): number[] {
  const out: number[] = [];
  for (let s = max; s >= min; s -= step) out.push(s);
  if (out[out.length - 1] !== min && min <= max) out.push(min);
  return out;
}

const WINDOW_BOUNDS: Record<PreferredTimeWindow, [number, number]> = {
  morning: [5 * 60, 12 * 60],
  day: [12 * 60, 17 * 60],
  evening: [17 * 60, 23 * 60],
  anytime: [0, 24 * 60],
};

// -------------------------------------------------------------------------
// Placement
// -------------------------------------------------------------------------

export function placeCandidates(input: PlacementInput): AdaptivePlan {
  const winStart = input.windowStartMinute ?? 8 * 60;
  const winEnd = input.windowEndMinute ?? 22 * 60;
  const step = input.stepMinutes ?? 30;
  const released = new Set(input.releasedManualIds ?? []);

  // Mutable working copy of the calendar, keyed by date.
  const byDate = new Map<string, DatedBlock[]>();
  for (const b of input.datedBlocks) {
    if (!byDate.has(b.date)) byDate.set(b.date, []);
    byDate.get(b.date)!.push({ ...b });
  }

  const allDates =
    input.scope === "day" && input.onlyDate
      ? [input.onlyDate]
      : datesInRange(input.horizonStartIso, input.horizonEndIso);

  const placements: Placement[] = [];
  const nudges: Nudge[] = [];
  const couldNotFit: CouldNotFit[] = [];

  // Candidates in caller-priority order; stable.
  const ordered = [...input.candidates].sort((a, b) => a.priority - b.priority);

  for (const c of ordered) {
    const minBlock = Math.max(
      c.minimumBlockMinutes ?? c.estMinutes,
      1,
    );
    const feasibleDates = allDates.filter((iso) => {
      if (c.earliestDate && iso < c.earliestDate) return false;
      if (c.requiredBefore && iso >= c.requiredBefore) return false;
      return true;
    });
    if (feasibleDates.length === 0) {
      couldNotFit.push({
        candidateId: c.id,
        title: c.title,
        reason: c.requiredBefore
          ? `No date between its earliest date and its ${c.requiredBefore} deadline.`
          : "No feasible date in the horizon.",
      });
      continue;
    }

    // A candidate is placed as one contiguous block, or — only when splittable —
    // as the fewest contiguous pieces of >= minBlock that sum to estMinutes.
    let remaining = c.estMinutes;
    const pieces: Placement[] = [];
    let lastReason = "No free slot inside the working window.";

    for (const iso of feasibleDates) {
      if (remaining <= 0) break;
      const weekday = mondayIndexOf(iso);
      const existing = (byDate.get(iso) ?? []).map((b) => toSchedule(b, weekday));

      // Unsplittable: exactly `remaining` or nothing. Splittable: try the
      // largest piece that fits this day, down to `minBlock`.
      const sizes = c.splittable
        ? sizeLadder(Math.min(remaining, c.estMinutes), minBlock, step)
        : [remaining];
      let want = 0;
      let slot: { start: number } | null = null;
      for (const size of sizes) {
        slot = firstFittingSlot(
          c,
          size,
          iso,
          weekday,
          existing,
          input.dailyCapacityMinutes,
          input.weeklyCapacityMinutes,
          byDate,
          winStart,
          winEnd,
          step,
        );
        if (slot) {
          want = size;
          break;
        }
      }

      if (slot) {
        const piece: Placement = {
          candidateId: c.id,
          actionId: c.actionId,
          title: c.title,
          date: iso,
          startMinute: slot.start,
          endMinute: slot.start + want,
          reasonCodes: c.reasonCodes,
        };
        pieces.push(piece);
        registerWorking(byDate, iso, piece, c.actionId);
        remaining -= want;
        if (!c.splittable) break;
      } else {
        // Try nudging a single reconsiderable block on this date to open room.
        const nudgeWant = c.splittable ? Math.min(remaining, Math.max(minBlock, c.estMinutes)) : remaining;
        const nudge = tryNudge(
          c,
          nudgeWant,
          iso,
          weekday,
          byDate,
          released,
          input.dailyCapacityMinutes,
          input.weeklyCapacityMinutes,
          winStart,
          winEnd,
          step,
        );
        if (nudge) {
          want = nudgeWant;
          nudges.push(nudge.nudge);
          const piece: Placement = {
            candidateId: c.id,
            actionId: c.actionId,
            title: c.title,
            date: iso,
            startMinute: nudge.slotStart,
            endMinute: nudge.slotStart + want,
            reasonCodes: [...c.reasonCodes, "MADE_ROOM_BY_NUDGE"],
          };
          pieces.push(piece);
          registerWorking(byDate, iso, piece, c.actionId);
          remaining -= want;
          if (!c.splittable) break;
        }
      }
    }

    if (remaining > 0) {
      // roll back partial pieces so a splittable candidate is all-or-nothing
      for (const p of pieces) unregisterWorking(byDate, p);
      couldNotFit.push({ candidateId: c.id, title: c.title, reason: lastReason });
      continue;
    }
    if (pieces.length === 1) {
      placements.push(pieces[0]);
    } else {
      pieces.forEach((p, i) => placements.push({ ...p, part: { index: i + 1, of: pieces.length } }));
    }
  }

  // Rule 15: annotate whether the resulting week keeps a healthy buffer.
  return { placements, nudges, couldNotFit };
}

function toSchedule(b: DatedBlock, weekday: number): ScheduleBlock {
  return {
    id: b.id,
    title: b.title,
    domain: b.domain,
    day: weekday,
    startMinute: b.startMinute,
    endMinute: b.endMinute,
    type: b.type,
    locked: b.locked,
    actionId: b.actionId,
  };
}

function weekMinutes(byDate: Map<string, DatedBlock[]>, weekKey: string): number {
  let total = 0;
  for (const [iso, blocks] of byDate) {
    if (isoWeekKey(iso) !== weekKey) continue;
    for (const b of blocks) total += b.endMinute - b.startMinute;
  }
  return total;
}

function firstFittingSlot(
  c: PlanningCandidate,
  want: number,
  iso: string,
  weekday: number,
  existing: ScheduleBlock[],
  daily: number,
  weekly: number,
  byDate: Map<string, DatedBlock[]>,
  winStart: number,
  winEnd: number,
  step: number,
): { start: number } | null {
  const [prefLo, prefHi] = c.preferredTimeWindow
    ? WINDOW_BOUNDS[c.preferredTimeWindow]
    : WINDOW_BOUNDS.anytime;
  // Two passes: honour the preferred window first (rule 13), then anywhere.
  const passes = c.preferredTimeWindow && c.preferredTimeWindow !== "anytime"
    ? [[Math.max(winStart, prefLo), Math.min(winEnd, prefHi)], [winStart, winEnd]]
    : [[winStart, winEnd]];

  const weekKey = isoWeekKey(iso);
  const currentWeek = weekMinutes(byDate, weekKey);
  if (currentWeek + want > weekly) return null; // rule 3

  for (const [lo, hi] of passes) {
    for (let start = lo; start + want <= hi; start += step) {
      const cand: ScheduleBlock = {
        id: `__cand_${c.id}`,
        title: c.title,
        domain: "Planning",
        day: weekday,
        startMinute: start,
        endMinute: start + want,
        type: "flexible",
        locked: false,
        actionId: c.actionId,
      };
      const fit = tryFitBlock(cand, existing, daily, weekly);
      if (fit.fits) return { start };
    }
  }
  return null;
}

function registerWorking(
  byDate: Map<string, DatedBlock[]>,
  iso: string,
  p: Placement,
  actionId: string | null,
) {
  if (!byDate.has(iso)) byDate.set(iso, []);
  byDate.get(iso)!.push({
    id: `__placed_${p.candidateId}_${p.startMinute}`,
    title: p.title,
    domain: "Planning",
    day: mondayIndexOf(iso),
    date: iso,
    startMinute: p.startMinute,
    endMinute: p.endMinute,
    type: "flexible",
    locked: false,
    actionId,
    origin: "generated",
  });
}
function unregisterWorking(byDate: Map<string, DatedBlock[]>, p: Placement) {
  const list = byDate.get(p.date);
  if (!list) return;
  byDate.set(
    p.date,
    list.filter((b) => b.id !== `__placed_${p.candidateId}_${p.startMinute}`),
  );
}

/** Rules 7/8/14: nudge exactly one reconsiderable block (generated-flexible, or
 *  a released manual one) earlier/later on the same date to open `want` minutes.
 *  Never moves it to another date; never touches fixed/locked/manual blocks. */
function tryNudge(
  c: PlanningCandidate,
  want: number,
  iso: string,
  weekday: number,
  byDate: Map<string, DatedBlock[]>,
  released: Set<string>,
  daily: number,
  weekly: number,
  winStart: number,
  winEnd: number,
  step: number,
): { nudge: Nudge; slotStart: number } | null {
  const dayBlocks = byDate.get(iso) ?? [];
  const movable = dayBlocks.filter(
    (b) =>
      b.type !== "fixed" &&
      !b.locked &&
      (b.origin === "generated" || released.has(b.id)),
  );

  for (const m of movable) {
    const originalStart = m.startMinute;
    const others = dayBlocks
      .filter((b) => b.id !== m.id)
      .map((b) => toSchedule(b, weekday));
    const mDur = m.endMinute - originalStart;
    for (let newStart = winStart; newStart + mDur <= winEnd; newStart += step) {
      if (newStart === originalStart) continue;
      const movedM: ScheduleBlock = {
        ...toSchedule(m, weekday),
        startMinute: newStart,
        endMinute: newStart + mDur,
      };
      if (!tryFitBlock(movedM, others, daily, weekly).fits) continue;
      const withMoved = [...others, movedM];
      for (let s = winStart; s + want <= winEnd; s += step) {
        const cand: ScheduleBlock = {
          id: `__cand_${c.id}`,
          title: c.title,
          domain: "Planning",
          day: weekday,
          startMinute: s,
          endMinute: s + want,
          type: "flexible",
          locked: false,
          actionId: c.actionId,
        };
        if (tryFitBlock(cand, withMoved, daily, weekly).fits) {
          m.startMinute = newStart;
          m.endMinute = newStart + mDur;
          return {
            nudge: { blockId: m.id, fromStartMinute: originalStart, toStartMinute: newStart, date: iso },
            slotStart: s,
          };
        }
      }
    }
  }
  return null;
}

// -------------------------------------------------------------------------
// Planning Diff
// -------------------------------------------------------------------------

export type OccurrenceResolution = {
  blockId: string;
  occurrenceDate: string;
  kind: "skip" | "done" | "defer";
  /** For "defer": the concrete date the replacement lands on. */
  toDate?: string;
};

export type PlanningDiff = {
  changes: PlanningDiffChange[];
  inverseChanges: PlanningDiffChange[];
  reasonCodes: string[];
  couldNotFit: CouldNotFit[];
};

/**
 * Turn placements + nudges + occurrence resolutions into a typed change list
 * plus its inverse. `keep` entries are emitted for protected blocks so the diff
 * UI can show "what will not move". `could-not-fit` is explanatory output and is
 * carried on the diff, never as a change.
 */
export function buildPlanningDiff(
  plan: AdaptivePlan,
  occurrenceResolutions: OccurrenceResolution[] = [],
  protectedBlockIds: string[] = [],
): PlanningDiff {
  const changes: PlanningDiffChange[] = [];
  const inverse: PlanningDiffChange[] = [];
  const reasonCodes = new Set<string>();

  for (const id of protectedBlockIds) changes.push({ kind: "keep", blockId: id });

  for (const p of plan.placements) {
    changes.push({
      kind: "add",
      block: {
        title: p.title,
        domain: "Planning",
        actionId: p.actionId,
        date: p.date,
        day: mondayIndexOf(p.date),
        startMinute: p.startMinute,
        endMinute: p.endMinute,
        type: "flexible",
        locked: false,
        source: "generated",
        status: "scheduled",
        __candidateId: p.candidateId,
      },
    });
    // the inverse of an add is a drop of the same candidate's block
    inverse.push({ kind: "drop-occurrence", blockId: `__candidate:${p.candidateId}`, occurrenceDate: p.date });
    p.reasonCodes.forEach((r) => reasonCodes.add(r));
  }

  for (const n of plan.nudges) {
    changes.push({ kind: "move", blockId: n.blockId, toStartMinute: n.toStartMinute });
    inverse.push({ kind: "move", blockId: n.blockId, toStartMinute: n.fromStartMinute });
    reasonCodes.add("MADE_ROOM_BY_NUDGE");
  }

  for (const o of occurrenceResolutions) {
    if (o.kind === "skip") {
      changes.push({ kind: "drop-occurrence", blockId: o.blockId, occurrenceDate: o.occurrenceDate });
      inverse.push({ kind: "mark-occurrence-done", blockId: o.blockId, occurrenceDate: o.occurrenceDate }); // no-op restore marker
      reasonCodes.add("OCCURRENCE_SKIPPED");
    } else if (o.kind === "done") {
      changes.push({ kind: "mark-occurrence-done", blockId: o.blockId, occurrenceDate: o.occurrenceDate });
      inverse.push({ kind: "drop-occurrence", blockId: o.blockId, occurrenceDate: o.occurrenceDate });
      reasonCodes.add("OCCURRENCE_DONE");
    } else {
      changes.push({
        kind: "defer",
        blockId: o.blockId,
        occurrenceDate: o.occurrenceDate,
        toDate: o.toDate ?? o.occurrenceDate,
      });
      inverse.push({ kind: "mark-occurrence-done", blockId: o.blockId, occurrenceDate: o.occurrenceDate });
      reasonCodes.add("OCCURRENCE_DEFERRED");
    }
  }

  return {
    changes,
    inverseChanges: inverse,
    reasonCodes: [...reasonCodes],
    couldNotFit: plan.couldNotFit,
  };
}

/** Rule 15 helper — is the resulting week comfortably buffered? */
export function planBufferHealth(
  weeklyScheduledMinutes: number,
  weeklyCapacityMinutes: number,
): ReturnType<typeof computePlanFragility> {
  return computePlanFragility(weeklyScheduledMinutes, weeklyCapacityMinutes);
}
