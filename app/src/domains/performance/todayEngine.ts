/**
 * Adaptive Today — the pure, deterministic derivation layer (V2 Phase G).
 *
 * No React, no clock of its own — `nowMinute` and `nowIso` are passed in. It
 * turns the canonical plan + Focus evidence + subjective capacity into a single
 * "what should I do now?" answer plus a Follow-Plan / Adaptation-Needed verdict.
 *
 * Laws it keeps (blueprint 07 §11):
 *   - Today NEVER owns a schedule. It reads `blocksToday` (already resolved from
 *     the ONE Planning store) and `occurrenceStateFor`.
 *   - Passing a block's end time is NOT "missed" — it is `elapsed-unresolved`
 *     until the user resolves it or Focus evidence covers it. Unknown stays
 *     unknown.
 *   - A free gap may stay a buffer. No auto-fill.
 *   - Precedence: fixed commitment > locked/protected user intent > canonical
 *     completion/evidence > explicit user instruction > deterministic
 *     urgency/capacity > AI-assisted prioritisation > generic recommendation.
 *   - Daily capacity is subjective (low|normal|high, default normal) and never
 *     inferred from the clock; it changes the recommendation, never the stored
 *     Planner capacity.
 *   - Focus duration is evidence of activity — it never implies Action-done,
 *     mastery, or a personal-study %.
 */
import type { PlanningBlock } from "../planning/types";
import { computePlanFragility } from "../planning/engine";

export type OccurrenceStateExt =
  | "planned"
  | "active"
  | "done"
  | "elapsed-unresolved"
  | "skipped"
  | "deferred";

export type TodayCapacityLevel = "low" | "normal" | "high";

export type TodayBlockView = {
  block: PlanningBlock;
  state: OccurrenceStateExt;
  plannedMinutes: number;
  actualFocusMinutes: number;
  actionStatus: string | null;
  protectedByLock: boolean;
  isFixed: boolean;
};

export type NowSurface =
  | { kind: "fixed"; title: string; blockId: string; startMinute: number; endMinute: number; reason: string | null }
  | { kind: "planned"; title: string; blockId: string; startMinute: number; endMinute: number; reason: string | null }
  | { kind: "next"; title: string; blockId: string; startMinute: number; endMinute: number; reason: string | null }
  | { kind: "buffer"; title: string; gapMinutes: number; reason: string }
  | { kind: "clear"; title: string; reason: string };

export type TodayState = {
  nowMinute: number;
  nowIso: string;
  blocks: TodayBlockView[];
  currentFixed: TodayBlockView | null;
  currentPlanned: TodayBlockView | null;
  nextPlanned: TodayBlockView | null;
  earlier: TodayBlockView[];
  elapsedUnresolved: TodayBlockView[];
  freeGapMinutes: number;
  remainingPlannedMinutes: number;
  remainingActualMinutes: number;
  capacityLevel: TodayCapacityLevel;
  dayFragility: ReturnType<typeof computePlanFragility>;
  weeklyFragility: ReturnType<typeof computePlanFragility>;
  now: NowSurface;
  mode: "follow-plan" | "adaptation-needed";
  adaptationReasons: string[];
};

export type TodayEngineInput = {
  nowMinute: number;
  nowIso: string;
  blocksToday: PlanningBlock[];
  /** Persisted per-date occurrence state for a block (skipped|done|deferred). */
  occurrenceStateFor: (blockId: string, iso: string) => "skipped" | "done" | "deferred" | null;
  /** Completed Focus minutes linked to a planning block, for today. */
  focusMinutesForBlock: (blockId: string) => number;
  actionStatusFor: (actionId: string) => string | null;
  dailyCapacityMinutes: number;
  weeklyCapacityMinutes: number;
  weeklyScheduledMinutes: number;
  capacityLevel: TodayCapacityLevel;
  /** Set by an approved Natural Capture that changed today's fixed commitments. */
  fixedCommitmentChanged?: boolean;
  /** A newly-added assessment/deadline that materially shifts priorities. */
  newDeadlineSignal?: boolean;
  /** The user explicitly asked to rework today. */
  reworkRequested?: boolean;
};

const MIN_FOCUS_TO_COVER_RATIO = 0.75;

export function deriveTodayState(input: TodayEngineInput): TodayState {
  const {
    nowMinute,
    nowIso,
    blocksToday,
    occurrenceStateFor,
    focusMinutesForBlock,
    actionStatusFor,
    weeklyCapacityMinutes,
    weeklyScheduledMinutes,
    capacityLevel,
  } = input;

  const sorted = [...blocksToday].sort((a, b) => a.startMinute - b.startMinute);

  const views: TodayBlockView[] = sorted.map((block) => {
    const plannedMinutes = Math.max(0, block.endMinute - block.startMinute);
    const actualFocusMinutes = focusMinutesForBlock(block.id);
    const actionStatus = block.actionId ? actionStatusFor(block.actionId) : null;
    const persisted = occurrenceStateFor(block.id, nowIso);

    let state: OccurrenceStateExt;
    if (persisted === "skipped") state = "skipped";
    else if (persisted === "deferred") state = "deferred";
    else if (persisted === "done" || block.status === "done") state = "done";
    else if (nowMinute >= block.startMinute && nowMinute < block.endMinute) state = "active";
    else if (nowMinute < block.startMinute) state = "planned";
    else {
      // past its end and not resolved: covered by Focus evidence, or unresolved.
      const covered =
        plannedMinutes > 0 && actualFocusMinutes >= plannedMinutes * MIN_FOCUS_TO_COVER_RATIO;
      state = covered ? "done" : "elapsed-unresolved";
    }

    return {
      block,
      state,
      plannedMinutes,
      actualFocusMinutes,
      actionStatus,
      protectedByLock: block.locked,
      isFixed: block.type === "fixed",
    };
  });

  const active = views.filter((v) => v.state === "active");
  const currentFixed = active.find((v) => v.isFixed) ?? null;
  const currentPlanned = active.find((v) => !v.isFixed) ?? null;
  const nextPlanned =
    views.find((v) => v.state === "planned") ?? null;
  const earlier = views.filter(
    (v) => v.block.endMinute <= nowMinute && v.state !== "planned",
  );
  const elapsedUnresolved = views.filter((v) => v.state === "elapsed-unresolved");

  const freeGapMinutes = currentFixed || currentPlanned
    ? 0
    : nextPlanned
      ? Math.max(0, nextPlanned.block.startMinute - nowMinute)
      : Math.max(0, 24 * 60 - nowMinute);

  const remainingViews = views.filter(
    (v) => v.state === "planned" || v.state === "active",
  );
  const remainingPlannedMinutes = remainingViews.reduce((s, v) => {
    if (v.state === "active") return s + Math.max(0, v.block.endMinute - nowMinute);
    return s + v.plannedMinutes;
  }, 0);
  const remainingActualMinutes = remainingViews.reduce((s, v) => s + v.actualFocusMinutes, 0);

  const minutesLeftInDay = Math.max(0, 24 * 60 - nowMinute);
  // Feasibility is against the CLOCK time left, not the soft capacity budget —
  // an already-scheduled block that is running now is not "doesn't fit".
  const dayFragility = computePlanFragility(remainingPlannedMinutes, minutesLeftInDay);
  const weeklyFragility = computePlanFragility(weeklyScheduledMinutes, weeklyCapacityMinutes);

  // --- Adaptation verdict (§11.1) — material divergence only ----------
  const adaptationReasons: string[] = [];
  if (elapsedUnresolved.length > 0) {
    adaptationReasons.push(
      `${elapsedUnresolved.length} block(s) have passed without being resolved or covered by Focus.`,
    );
  }
  if (dayFragility === "exceeds") {
    adaptationReasons.push("The rest of today's plan no longer fits the time left.");
  }
  if (capacityLevel === "low" && remainingPlannedMinutes > minutesLeftInDay * 0.6) {
    adaptationReasons.push("You marked today low-capacity and a lot of plan remains.");
  }
  if (input.fixedCommitmentChanged) {
    adaptationReasons.push("A fixed commitment changed through an approved capture.");
  }
  if (input.newDeadlineSignal) {
    adaptationReasons.push("A new assessment or deadline changes what matters today.");
  }
  if (input.reworkRequested) {
    adaptationReasons.push("You asked to rework today.");
  }
  const mode: TodayState["mode"] =
    adaptationReasons.length > 0 ? "adaptation-needed" : "follow-plan";

  // --- NOW surface (precedence order) --------------------------------
  let now: NowSurface;
  if (currentFixed) {
    now = {
      kind: "fixed",
      title: currentFixed.block.title,
      blockId: currentFixed.block.id,
      startMinute: currentFixed.block.startMinute,
      endMinute: currentFixed.block.endMinute,
      reason: "A fixed commitment is running now.",
    };
  } else if (currentPlanned) {
    now = {
      kind: "planned",
      title: currentPlanned.block.title,
      blockId: currentPlanned.block.id,
      startMinute: currentPlanned.block.startMinute,
      endMinute: currentPlanned.block.endMinute,
      reason: mode === "adaptation-needed" ? "Still the current plan — review the changes below." : null,
    };
  } else if (nextPlanned && nextPlanned.block.startMinute - nowMinute <= 45) {
    now = {
      kind: "next",
      title: nextPlanned.block.title,
      blockId: nextPlanned.block.id,
      startMinute: nextPlanned.block.startMinute,
      endMinute: nextPlanned.block.endMinute,
      reason: `Starts in ${nextPlanned.block.startMinute - nowMinute} min.`,
    };
  } else if (nextPlanned) {
    now = {
      kind: "buffer",
      title: `Free until ${hhmm(nextPlanned.block.startMinute)}`,
      gapMinutes: freeGapMinutes,
      reason:
        elapsedUnresolved.length > 0
          ? "Resolve the passed blocks, or keep this as buffer."
          : "No urgent work needs this gap — keeping the buffer is a valid choice.",
    };
  } else {
    now = {
      kind: "clear",
      title: "Nothing more is scheduled",
      reason:
        elapsedUnresolved.length > 0
          ? "Some earlier blocks are still unresolved."
          : "The rest of the day is open. That is not a miss.",
    };
  }

  return {
    nowMinute,
    nowIso,
    blocks: views,
    currentFixed,
    currentPlanned,
    nextPlanned,
    earlier,
    elapsedUnresolved,
    freeGapMinutes,
    remainingPlannedMinutes,
    remainingActualMinutes,
    capacityLevel,
    dayFragility,
    weeklyFragility,
    now,
    mode,
    adaptationReasons,
  };
}

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
