/**
 * Allowlisted Apply adapters (docs 26.06, 23).
 *
 * This is the ONLY place a recommendation becomes a canonical change. Each
 * adapter: (1) validates deterministically — no AI — producing Phase-23-style
 * reason codes; (2) if valid, calls exactly ONE canonical domain store method.
 * There is deliberately no generic `applyPatch` / `writeTable` / `runCommand`.
 * A recommendation whose `kind` is not in `APPLY_ADAPTERS` cannot be applied.
 */

import type { ActionInput } from "../performance/types";
import type { PlanningBlockInput, ScheduleBlock } from "../planning/types";
import type { RoutineInput, Routine } from "../routine/types";
import type { RecommendationKind, ValidationResult } from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

export type ApplyContext = {
  performance: {
    systems: { id: string; title: string }[];
    createAction: (systemId: string | null, input: ActionInput) => Promise<MutResult>;
  };
  planning: {
    blocks: ScheduleBlock[];
    capacity: { dailyCapacityMinutes: number; weeklyCapacityMinutes: number };
    checkFit: (candidate: ScheduleBlock) => { fits: boolean; reason: string | null };
    createBlock: (input: PlanningBlockInput) => Promise<MutResult>;
  };
  knowledge: {
    topics: { id: string; title: string; nextReviewDate: string | null; lastStudied: string | null }[];
    updateReviewState: (
      topicId: string,
      input: { lastStudied: string | null; nextReviewDate: string | null },
    ) => Promise<MutResult>;
  };
  routine: {
    routines: Routine[];
    updateRoutine: (id: string, input: RoutineInput) => Promise<MutResult>;
  };
};

export type ApplyOutcome = {
  ok: boolean;
  result: Record<string, unknown>;
  message: string;
};

export type ApplyAdapter = {
  kind: RecommendationKind;
  label: string;
  triggersReplan: boolean;
  validate: (params: Record<string, unknown>, ctx: ApplyContext) => ValidationResult;
  describeCurrent: (params: Record<string, unknown>, ctx: ApplyContext) => Record<string, unknown>;
  preview: (params: Record<string, unknown>, ctx: ApplyContext) => { before: string; after: string };
  apply: (params: Record<string, unknown>, ctx: ApplyContext) => Promise<ApplyOutcome>;
};

// --- coercion helpers --------------------------------------------------------

const str = (v: unknown, fb = "") => (typeof v === "string" ? v.trim() : fb);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function ok(message: string): ValidationResult {
  return { ok: true, reasonCodes: [], message };
}
function fail(code: string, message: string): ValidationResult {
  return { ok: false, reasonCodes: [code], message };
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// --- create-action ---------------------------------------------------------

const createAction: ApplyAdapter = {
  kind: "create-action",
  label: "Create an Action",
  triggersReplan: false,
  validate(params, ctx) {
    const title = str(params.title);
    if (!title) return fail("MISSING_TITLE", "The proposed Action has no title.");
    if (ctx.performance.systems.length === 0) {
      return fail(
        "NO_SYSTEM",
        "There is no System to attach the Action to. Create a System first.",
      );
    }
    return ok(`Will create the Action "${title}".`);
  },
  describeCurrent() {
    return { exists: false };
  },
  preview(params, ctx) {
    const sys = resolveSystem(params, ctx);
    return {
      before: "no such Action",
      after: `Action "${str(params.title)}" under ${sys ? sys.title : "the first System"} (status: todo)`,
    };
  },
  async apply(params, ctx) {
    const sys = resolveSystem(params, ctx);
    const res = await ctx.performance.createAction(sys ? sys.id : null, {
      title: str(params.title),
      context: str(params.context),
      status: "todo",
      estMinutes: num(params.estMinutes),
      priority: "normal",
      timing: str(params.timing),
    });
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not create the Action." };
    }
    return { ok: true, result: { actionId: res.id, systemId: sys?.id ?? null }, message: "Action created." };
  },
};

function resolveSystem(params: Record<string, unknown>, ctx: ApplyContext) {
  const byId = ctx.performance.systems.find((s) => s.id === str(params.systemId));
  if (byId) return byId;
  const t = str(params.systemTitle).toLowerCase();
  if (t) {
    const byTitle = ctx.performance.systems.find((s) => s.title.toLowerCase().includes(t));
    if (byTitle) return byTitle;
  }
  return ctx.performance.systems[0] ?? null;
}

// --- schedule-block (the re-planning link) --------------------------------

function candidateBlock(params: Record<string, unknown>): ScheduleBlock | null {
  const day = num(params.day);
  const startMinute = num(params.startMinute);
  const durationMinutes = num(params.durationMinutes);
  if (day === null || startMinute === null || durationMinutes === null) return null;
  return {
    id: "__candidate__",
    title: str(params.title, "Study block"),
    domain: str(params.domain, "planning"),
    day,
    startMinute,
    endMinute: startMinute + durationMinutes,
    type: "flexible",
    locked: false,
    actionId: str(params.actionId) || null,
  };
}

const scheduleBlock: ApplyAdapter = {
  kind: "schedule-block",
  label: "Schedule a Planning Block",
  triggersReplan: true,
  validate(params, ctx) {
    const cand = candidateBlock(params);
    if (!cand) return fail("INVALID_TIME", "The proposed block is missing a day, start, or duration.");
    if (cand.day < 0 || cand.day > 6) return fail("INVALID_TIME", "Day must be Mon–Sun.");
    if (cand.startMinute < 0 || cand.endMinute > 24 * 60 || cand.endMinute <= cand.startMinute) {
      return fail("INVALID_TIME", "The block's time range is impossible.");
    }
    const fit = ctx.planning.checkFit(cand);
    if (!fit.fits) {
      const code = /capacity/i.test(fit.reason ?? "") ? "CAPACITY_EXCEEDED" : "CONFLICT";
      return fail(code, fit.reason ?? "The block does not fit the current plan.");
    }
    return ok(
      `Fits: ${DAY_LABELS[cand.day]} ${hhmm(cand.startMinute)}–${hhmm(cand.endMinute)} is free and within capacity.`,
    );
  },
  describeCurrent(_params, ctx) {
    return {
      weeklyScheduledMinutes: ctx.planning.blocks.reduce(
        (s, b) => s + (b.endMinute - b.startMinute),
        0,
      ),
      weeklyCapacityMinutes: ctx.planning.capacity.weeklyCapacityMinutes,
    };
  },
  preview(params) {
    const cand = candidateBlock(params);
    return {
      before: "unscheduled",
      after: cand
        ? `${DAY_LABELS[cand.day]} ${hhmm(cand.startMinute)}–${hhmm(cand.endMinute)} · "${cand.title}"`
        : "invalid block",
    };
  },
  async apply(params, ctx) {
    const cand = candidateBlock(params);
    if (!cand) return { ok: false, result: {}, message: "Invalid block parameters." };
    const res = await ctx.planning.createBlock({
      title: cand.title,
      domain: cand.domain,
      actionId: cand.actionId,
      day: cand.day,
      date: null,
      startMinute: cand.startMinute,
      endMinute: cand.endMinute,
      type: "flexible",
      locked: false,
      source: "generated",
      status: "scheduled",
    });
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not schedule the block." };
    }
    return { ok: true, result: { blockId: res.id }, message: "Planning block scheduled." };
  },
};

// --- set-knowledge-review -----------------------------------------------

function resolveTopic(params: Record<string, unknown>, ctx: ApplyContext) {
  const byId = ctx.knowledge.topics.find((t) => t.id === str(params.topicId));
  if (byId) return byId;
  const t = str(params.topicTitle).toLowerCase();
  if (t) return ctx.knowledge.topics.find((x) => x.title.toLowerCase() === t) ?? null;
  return null;
}

const setKnowledgeReview: ApplyAdapter = {
  kind: "set-knowledge-review",
  label: "Set a Knowledge review date",
  triggersReplan: false,
  validate(params, ctx) {
    const topic = resolveTopic(params, ctx);
    if (!topic) return fail("NO_TOPIC", "No matching Knowledge concept was found.");
    const inDays = num(params.inDays);
    if (inDays === null || inDays < 1 || inDays > 365) {
      return fail("INVALID_DATE", "The review interval must be 1–365 days.");
    }
    return ok(`Will set ${topic.title}'s next review to ${addDaysIso(todayIso(), inDays)}.`);
  },
  describeCurrent(params, ctx) {
    const topic = resolveTopic(params, ctx);
    return { currentNextReview: topic?.nextReviewDate ?? null };
  },
  preview(params, ctx) {
    const topic = resolveTopic(params, ctx);
    const inDays = num(params.inDays) ?? 0;
    return {
      before: topic?.nextReviewDate ? `next review ${topic.nextReviewDate}` : "no review scheduled",
      after: `next review ${addDaysIso(todayIso(), inDays)}`,
    };
  },
  async apply(params, ctx) {
    const topic = resolveTopic(params, ctx);
    if (!topic) return { ok: false, result: {}, message: "Topic not found." };
    const inDays = num(params.inDays) ?? 3;
    const nextReviewDate = addDaysIso(todayIso(), inDays);
    const res = await ctx.knowledge.updateReviewState(topic.id, {
      lastStudied: topic.lastStudied,
      nextReviewDate,
    });
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not set the review date." };
    }
    // review scheduling ≠ mastery — no evidence is touched
    return { ok: true, result: { topicId: topic.id, nextReviewDate }, message: "Review date set." };
  },
};

// --- adjust-routine-cadence -------------------------------------------

function resolveRoutine(params: Record<string, unknown>, ctx: ApplyContext) {
  const byId = ctx.routine.routines.find((r) => r.id === str(params.routineId));
  if (byId) return byId;
  const m = str(params.match).toLowerCase();
  if (m) {
    return (
      ctx.routine.routines.find(
        (r) => r.title.toLowerCase().includes(m) || r.category.toLowerCase().includes(m),
      ) ?? null
    );
  }
  return null;
}

const adjustRoutineCadence: ApplyAdapter = {
  kind: "adjust-routine-cadence",
  label: "Adjust a Routine's weekly cadence",
  triggersReplan: false,
  validate(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine) return fail("NO_ROUTINE", "No matching Routine was found.");
    const timesPerWeek = num(params.timesPerWeek);
    if (timesPerWeek === null || timesPerWeek < 1 || timesPerWeek > 14) {
      return fail("INVALID_CADENCE", "The weekly target must be 1–14.");
    }
    return ok(`Will set ${routine.title} to ${timesPerWeek}×/week (times-per-week cadence).`);
  },
  describeCurrent(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    return {
      currentScheduleType: routine?.scheduleType ?? null,
      currentTarget: routine?.scheduleTarget ?? null,
    };
  },
  preview(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    const t = num(params.timesPerWeek) ?? 0;
    return {
      before: routine
        ? `${routine.scheduleType}${routine.scheduleTarget ? ` (${routine.scheduleTarget}×/wk)` : ""}`
        : "unknown",
      after: `times-per-week (${t}×/wk)`,
    };
  },
  async apply(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine) return { ok: false, result: {}, message: "Routine not found." };
    const timesPerWeek = num(params.timesPerWeek) ?? routine.scheduleTarget ?? 3;
    const res = await ctx.routine.updateRoutine(routine.id, {
      title: routine.title,
      category: routine.category,
      timeWindow: routine.timeWindow,
      schedule: { type: "times-per-week", days: routine.scheduleDays, timesPerWeek },
      completionType: routine.completionType,
      targetQuantity: routine.targetQuantity,
      targetUnit: routine.targetUnit,
      targetDurationMinutes: routine.targetDurationMinutes,
      priority: routine.priority,
      relatedSystemId: routine.relatedSystemId,
    });
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not update the Routine." };
    }
    return { ok: true, result: { routineId: routine.id, timesPerWeek }, message: "Routine cadence updated." };
  },
};

// --- the allowlist ---------------------------------------------------------

export const APPLY_ADAPTERS: Record<RecommendationKind, ApplyAdapter> = {
  "create-action": createAction,
  "schedule-block": scheduleBlock,
  "set-knowledge-review": setKnowledgeReview,
  "adjust-routine-cadence": adjustRoutineCadence,
};

export function getAdapter(kind: string): ApplyAdapter | null {
  return (APPLY_ADAPTERS as Record<string, ApplyAdapter>)[kind] ?? null;
}
