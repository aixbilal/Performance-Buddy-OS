/**
 * The shared MutationKind registry (V2 Phase C).
 *
 * Every entry maps a `MutationKind` to exactly one canonical domain operation
 * with deterministic validation. `getMutation` fails closed — an unknown kind
 * returns `null` and therefore cannot be applied. There is no generic write
 * path anywhere in this file.
 *
 * The four AI-allowlisted V1 kinds (`create-action`, `schedule-block`,
 * `set-knowledge-review`, `adjust-routine-cadence`) are authored here; the old
 * `intelligence/applyAdapters` module now projects them back out unchanged.
 */
import type { RoutineInput } from "../routine/types";
import { CHECK_IN_STATES } from "../routine/types";
import { COVERAGE_STATUSES } from "../academic/types";
import type { AssessmentInput } from "../academic/types";
import { SESSION_ACTIVITIES } from "../language/types";
import {
  addDaysIso,
  arr,
  DAY_LABELS,
  fail,
  hhmm,
  isIsoDate,
  isMutationKind,
  MUTATION_KINDS,
  num,
  ok,
  str,
  todayIso,
  type MutationContext,
  type MutationDescriptor,
  type MutationKind,
} from "./types";
import type { ScheduleBlock } from "../planning/types";

// =======================================================================
// create-action  (V1 AI kind)
// =======================================================================

function resolveSystem(params: Record<string, unknown>, ctx: MutationContext) {
  const byId = ctx.performance.systems.find((s) => s.id === str(params.systemId));
  if (byId) return byId;
  const t = str(params.systemTitle).toLowerCase();
  if (t) {
    const byTitle = ctx.performance.systems.find((s) => s.title.toLowerCase().includes(t));
    if (byTitle) return byTitle;
  }
  return ctx.performance.systems[0] ?? null;
}

const createAction: MutationDescriptor = {
  kind: "create-action",
  domain: "Goals & Systems",
  label: "Create an Action",
  triggersReplan: false,
  revisionDomain: "performance",
  validate(params, ctx) {
    const title = str(params.title);
    if (!title) return fail("MISSING_TITLE", "The proposed Action has no title.");
    if (ctx.performance.systems.length === 0) {
      return fail("NO_SYSTEM", "There is no System to attach the Action to. Create a System first.");
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

// =======================================================================
// schedule-block  (V1 AI kind — the deterministic planning gate)
// =======================================================================

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

const scheduleBlock: MutationDescriptor = {
  kind: "schedule-block",
  domain: "Planning",
  label: "Schedule a Planning Block",
  triggersReplan: true,
  revisionDomain: "planning",
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
      weeklyScheduledMinutes: ctx.planning.blocks.reduce((s, b) => s + (b.endMinute - b.startMinute), 0),
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

// =======================================================================
// set-knowledge-review  (V1 AI kind — schedule only, never mastery)
// =======================================================================

function resolveTopic(params: Record<string, unknown>, ctx: MutationContext) {
  const byId = ctx.knowledge.topics.find((t) => t.id === str(params.topicId));
  if (byId) return byId;
  const t = str(params.topicTitle).toLowerCase();
  if (t) return ctx.knowledge.topics.find((x) => x.title.toLowerCase() === t) ?? null;
  return null;
}

const setKnowledgeReview: MutationDescriptor = {
  kind: "set-knowledge-review",
  domain: "Knowledge",
  label: "Set a Knowledge review date",
  triggersReplan: false,
  revisionDomain: "knowledge",
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
    return { ok: true, result: { topicId: topic.id, nextReviewDate }, message: "Review date set." };
  },
};

// =======================================================================
// Routine resolution + the four routine adjustment kinds
// =======================================================================

function resolveRoutine(params: Record<string, unknown>, ctx: MutationContext) {
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

/** Rebuild a full RoutineInput from a routine + a patch — every routine
 *  adjustment goes through the one canonical `updateRoutine`. */
function routineInputFrom(
  r: NonNullable<ReturnType<typeof resolveRoutine>>,
  patch: Partial<{
    timeWindow: RoutineInput["timeWindow"];
    targetDurationMinutes: number | null;
    scheduleType: RoutineInput["schedule"]["type"];
    scheduleDays: number[];
    timesPerWeek: number | null;
  }>,
): RoutineInput {
  return {
    title: r.title,
    category: r.category,
    timeWindow: patch.timeWindow ?? r.timeWindow,
    schedule: {
      type: patch.scheduleType ?? r.scheduleType,
      days: patch.scheduleDays ?? r.scheduleDays,
      timesPerWeek: patch.timesPerWeek ?? r.scheduleTarget,
    },
    completionType: r.completionType,
    targetQuantity: r.targetQuantity,
    targetUnit: r.targetUnit,
    targetDurationMinutes:
      patch.targetDurationMinutes !== undefined ? patch.targetDurationMinutes : r.targetDurationMinutes,
    priority: r.priority,
    relatedSystemId: r.relatedSystemId,
  };
}

const adjustRoutineCadence: MutationDescriptor = {
  kind: "adjust-routine-cadence",
  domain: "Routines",
  label: "Adjust a Routine's weekly cadence",
  triggersReplan: false,
  revisionDomain: "routine",
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
    const res = await ctx.routine.updateRoutine(
      routine.id,
      routineInputFrom(routine, { scheduleType: "times-per-week", timesPerWeek }),
    );
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not update the Routine." };
    }
    return { ok: true, result: { routineId: routine.id, timesPerWeek }, message: "Routine cadence updated." };
  },
};

const ROUTINE_WINDOWS = ["morning", "day", "evening", "anytime"] as const;

const adjustRoutineWindow: MutationDescriptor = {
  kind: "adjust-routine-window",
  domain: "Routines",
  label: "Move a Routine to a different time window",
  triggersReplan: false,
  revisionDomain: "routine",
  validate(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine) return fail("NO_ROUTINE", "No matching Routine was found.");
    const window = str(params.timeWindow);
    if (!(ROUTINE_WINDOWS as readonly string[]).includes(window)) {
      return fail("INVALID_WINDOW", "The time window must be morning, day, evening, or anytime.");
    }
    if (window === routine.timeWindow) {
      return fail("NO_CHANGE", `${routine.title} is already in the ${window} window.`);
    }
    return ok(`Will move ${routine.title} to the ${window} window.`);
  },
  describeCurrent(params, ctx) {
    return { currentWindow: resolveRoutine(params, ctx)?.timeWindow ?? null };
  },
  preview(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    return { before: routine?.timeWindow ?? "unknown", after: str(params.timeWindow) || "unknown" };
  },
  async apply(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine) return { ok: false, result: {}, message: "Routine not found." };
    const timeWindow = str(params.timeWindow) as RoutineInput["timeWindow"];
    const res = await ctx.routine.updateRoutine(routine.id, routineInputFrom(routine, { timeWindow }));
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not update the Routine." };
    }
    return { ok: true, result: { routineId: routine.id, timeWindow }, message: "Routine time window updated." };
  },
};

const adjustRoutineDuration: MutationDescriptor = {
  kind: "adjust-routine-duration",
  domain: "Routines",
  label: "Adjust a Routine's target duration",
  triggersReplan: false,
  revisionDomain: "routine",
  validate(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine) return fail("NO_ROUTINE", "No matching Routine was found.");
    if (routine.completionType !== "duration") {
      return fail("NOT_DURATION_ROUTINE", `${routine.title} is not a duration-based routine.`);
    }
    const minutes = num(params.targetDurationMinutes);
    if (minutes === null || minutes < 1 || minutes > 24 * 60) {
      return fail("INVALID_DURATION", "The target duration must be 1–1440 minutes.");
    }
    return ok(`Will set ${routine.title}'s target to ${minutes} minutes.`);
  },
  describeCurrent(params, ctx) {
    return { currentTargetDurationMinutes: resolveRoutine(params, ctx)?.targetDurationMinutes ?? null };
  },
  preview(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    return {
      before: routine?.targetDurationMinutes ? `${routine.targetDurationMinutes} min` : "no target",
      after: `${num(params.targetDurationMinutes) ?? 0} min`,
    };
  },
  async apply(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine) return { ok: false, result: {}, message: "Routine not found." };
    const targetDurationMinutes = num(params.targetDurationMinutes);
    const res = await ctx.routine.updateRoutine(
      routine.id,
      routineInputFrom(routine, { targetDurationMinutes }),
    );
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not update the Routine." };
    }
    return {
      ok: true,
      result: { routineId: routine.id, targetDurationMinutes },
      message: "Routine target duration updated.",
    };
  },
};

const adjustRoutineDays: MutationDescriptor = {
  kind: "adjust-routine-days",
  domain: "Routines",
  label: "Adjust a Routine's scheduled days",
  triggersReplan: false,
  revisionDomain: "routine",
  validate(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine) return fail("NO_ROUTINE", "No matching Routine was found.");
    const days = arr(params.days)
      .map((d) => num(d))
      .filter((d): d is number => d !== null);
    if (days.length !== arr(params.days).length || days.length === 0) {
      return fail("INVALID_DAYS", "Provide a non-empty list of weekday numbers 0–6 (Mon–Sun).");
    }
    if (days.some((d) => d < 0 || d > 6) || new Set(days).size !== days.length) {
      return fail("INVALID_DAYS", "Weekday numbers must be 0–6 and unique.");
    }
    return ok(`Will set ${routine.title} to run on ${days.map((d) => DAY_LABELS[d]).join(", ")}.`);
  },
  describeCurrent(params, ctx) {
    return {
      currentScheduleType: resolveRoutine(params, ctx)?.scheduleType ?? null,
      currentDays: resolveRoutine(params, ctx)?.scheduleDays ?? null,
    };
  },
  preview(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    const days = arr(params.days)
      .map((d) => num(d))
      .filter((d): d is number => d !== null && d >= 0 && d <= 6);
    return {
      before: routine ? (routine.scheduleDays.map((d) => DAY_LABELS[d]).join(", ") || routine.scheduleType) : "unknown",
      after: `weekly-days (${days.map((d) => DAY_LABELS[d]).join(", ")})`,
    };
  },
  async apply(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine) return { ok: false, result: {}, message: "Routine not found." };
    const scheduleDays = arr(params.days)
      .map((d) => num(d))
      .filter((d): d is number => d !== null && d >= 0 && d <= 6);
    const res = await ctx.routine.updateRoutine(
      routine.id,
      routineInputFrom(routine, { scheduleType: "weekly-days", scheduleDays }),
    );
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not update the Routine." };
    }
    return { ok: true, result: { routineId: routine.id, scheduleDays }, message: "Routine scheduled days updated." };
  },
};

// =======================================================================
// routine-checkin  (Natural Capture — "I did my evening review")
// =======================================================================

const routineCheckin: MutationDescriptor = {
  kind: "routine-checkin",
  domain: "Routines",
  label: "Record a Routine check-in",
  triggersReplan: false,
  revisionDomain: "routine",
  revisionEntityType: "routine-log",
  validate(params, ctx) {
    if (!ctx.routine.checkInRoutine) {
      return fail("UNAVAILABLE", "Routine check-in is not available in this context.");
    }
    const routine = resolveRoutine(params, ctx);
    if (!routine) return fail("NO_ROUTINE", "No matching Routine was found.");
    const state = str(params.state);
    if (!(CHECK_IN_STATES as readonly string[]).includes(state)) {
      return fail("INVALID_STATE", "The check-in state must be complete, partial, skipped, rest, or missed.");
    }
    const date = str(params.date, todayIso());
    if (!isIsoDate(date)) return fail("INVALID_DATE", "The check-in date must be an ISO date.");
    if (date > todayIso()) return fail("FUTURE_DATE", "A check-in cannot be recorded for a future date.");
    return ok(`Will record ${routine.title} as "${state}" on ${date}.`);
  },
  describeCurrent(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    return { routineId: routine?.id ?? null, date: str(params.date, todayIso()) };
  },
  preview(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    return {
      before: `${routine?.title ?? "routine"} — not checked in for ${str(params.date, todayIso())}`,
      after: `${routine?.title ?? "routine"} — ${str(params.state)} on ${str(params.date, todayIso())}`,
    };
  },
  async apply(params, ctx) {
    const routine = resolveRoutine(params, ctx);
    if (!routine || !ctx.routine.checkInRoutine) {
      return { ok: false, result: {}, message: "Routine check-in unavailable." };
    }
    const res = await ctx.routine.checkInRoutine(routine.id, {
      date: str(params.date, todayIso()),
      state: str(params.state) as "complete",
      quantityCompleted: num(params.quantityCompleted),
      durationCompletedMinutes: num(params.durationCompletedMinutes),
    });
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not record the check-in." };
    }
    return {
      ok: true,
      result: { routineId: routine.id, date: str(params.date, todayIso()), state: str(params.state) },
      message: "Routine check-in recorded.",
    };
  },
};

// =======================================================================
// create-expense  (Natural Capture — "spent 1200 on groceries")
// =======================================================================

function resolveCategory(params: Record<string, unknown>, ctx: MutationContext): string | null {
  const raw = str(params.category).toLowerCase();
  if (!raw) return null;
  const known = ctx.money?.categories ?? [];
  const exact = known.find((c) => c.toLowerCase() === raw);
  if (exact) return exact;
  const partial = known.find((c) => c.toLowerCase().includes(raw) || raw.includes(c.toLowerCase()));
  return partial ?? str(params.category);
}

const createExpense: MutationDescriptor = {
  kind: "create-expense",
  domain: "Money",
  label: "Record an expense",
  triggersReplan: false,
  revisionDomain: "money",
  revisionEntityType: "transaction",
  validate(params, ctx) {
    if (!ctx.money) return fail("UNAVAILABLE", "Money is not available in this context.");
    const amount = num(params.amount);
    if (amount === null || amount <= 0) return fail("INVALID_AMOUNT", "The expense amount must be a positive number.");
    const date = str(params.date, todayIso());
    if (!isIsoDate(date)) return fail("INVALID_DATE", "The expense date must be an ISO date.");
    if (!resolveCategory(params, ctx)) {
      return fail("UNKNOWN_CATEGORY", "This expense has no category — pick one before recording it.");
    }
    return ok(`Will record an expense of ${amount} in "${resolveCategory(params, ctx)}" on ${date}.`);
  },
  describeCurrent() {
    return { exists: false };
  },
  preview(params, ctx) {
    return {
      before: "no such transaction",
      after: `expense ${num(params.amount) ?? "?"} · ${resolveCategory(params, ctx) ?? "uncategorised"} · ${str(params.date, todayIso())}`,
    };
  },
  async apply(params, ctx) {
    if (!ctx.money) return { ok: false, result: {}, message: "Money unavailable." };
    const category = resolveCategory(params, ctx);
    if (!category) return { ok: false, result: {}, message: "Expense category is unknown." };
    const res = await ctx.money.createTransaction({
      date: str(params.date, todayIso()),
      type: "expense",
      amount: num(params.amount) ?? 0,
      category,
      description: str(params.description),
      savingsGoalId: null,
    });
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not record the expense." };
    }
    return { ok: true, result: { transactionId: res.id, category }, message: "Expense recorded." };
  },
};

// =======================================================================
// Academic topic + assessment kinds
// =======================================================================

function resolveAcademicTopic(params: Record<string, unknown>, ctx: MutationContext) {
  const topics = ctx.academic?.topics ?? [];
  const byId = topics.find((t) => t.id === str(params.topicId));
  if (byId) return byId;
  const title = str(params.topicTitle).toLowerCase();
  const courseId = str(params.courseId);
  const pool = courseId ? topics.filter((t) => t.courseId === courseId) : topics;
  if (title) {
    const exact = pool.filter((t) => t.title.toLowerCase() === title);
    if (exact.length === 1) return exact[0];
    const partial = pool.filter((t) => t.title.toLowerCase().includes(title));
    if (partial.length === 1) return partial[0];
  }
  return null;
}

function resolveAssessment(params: Record<string, unknown>, ctx: MutationContext) {
  const assessments = ctx.academic?.assessments ?? [];
  const byId = assessments.find((a) => a.id === str(params.assessmentId));
  if (byId) return byId;
  const title = str(params.assessmentTitle).toLowerCase();
  if (title) {
    const exact = assessments.filter((a) => a.title.toLowerCase() === title);
    if (exact.length === 1) return exact[0];
  }
  return null;
}

const setProfessorCoverage: MutationDescriptor = {
  kind: "set-professor-coverage",
  domain: "Academics",
  label: "Update professor coverage for a topic",
  triggersReplan: false,
  revisionDomain: "academic",
  revisionEntityType: "topic",
  validate(params, ctx) {
    if (!ctx.academic) return fail("UNAVAILABLE", "Academics is not available in this context.");
    const topic = resolveAcademicTopic(params, ctx);
    if (!topic) return fail("NO_TOPIC", "No single matching academic topic was found — select one.");
    const coverage = str(params.coverage);
    if (!(COVERAGE_STATUSES as readonly string[]).includes(coverage)) {
      return fail("INVALID_COVERAGE", "Coverage must be not-taught, in-progress, or taught.");
    }
    if (coverage === topic.professorCoverage) {
      return fail("NO_CHANGE", `${topic.title} coverage is already "${coverage}".`);
    }
    return ok(`Will set ${topic.title} professor coverage to "${coverage}".`);
  },
  describeCurrent(params, ctx) {
    return { currentCoverage: resolveAcademicTopic(params, ctx)?.professorCoverage ?? null };
  },
  preview(params, ctx) {
    const topic = resolveAcademicTopic(params, ctx);
    return { before: topic?.professorCoverage ?? "unknown", after: str(params.coverage) || "unknown" };
  },
  async apply(params, ctx) {
    const topic = resolveAcademicTopic(params, ctx);
    if (!topic || !ctx.academic) return { ok: false, result: {}, message: "Topic not found." };
    const coverage = str(params.coverage) as "taught";
    const res = await ctx.academic.setProfessorCoverage(topic.id, coverage);
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not update coverage." };
    }
    return { ok: true, result: { topicId: topic.id, coverage }, message: "Professor coverage updated." };
  },
};

const setPersonalStudy: MutationDescriptor = {
  kind: "set-personal-study",
  domain: "Academics",
  label: "Update personal study coverage for a topic",
  triggersReplan: false,
  revisionDomain: "academic",
  revisionEntityType: "topic",
  validate(params, ctx) {
    if (!ctx.academic) return fail("UNAVAILABLE", "Academics is not available in this context.");
    const topic = resolveAcademicTopic(params, ctx);
    if (!topic) return fail("NO_TOPIC", "No single matching academic topic was found — select one.");
    const percent = num(params.percent);
    if (percent === null || percent < 0 || percent > 100) {
      return fail("INVALID_PERCENT", "Personal study percent must be 0–100.");
    }
    return ok(`Will set ${topic.title} personal study to ${percent}%.`);
  },
  describeCurrent(params, ctx) {
    return { currentPersonalStudyPercent: resolveAcademicTopic(params, ctx)?.personalStudyPercent ?? null };
  },
  preview(params, ctx) {
    const topic = resolveAcademicTopic(params, ctx);
    return {
      before: topic ? `${topic.personalStudyPercent}%` : "unknown",
      after: `${num(params.percent) ?? 0}%`,
    };
  },
  async apply(params, ctx) {
    const topic = resolveAcademicTopic(params, ctx);
    if (!topic || !ctx.academic) return { ok: false, result: {}, message: "Topic not found." };
    const percent = num(params.percent) ?? 0;
    const res = await ctx.academic.setPersonalStudyCoverage(topic.id, percent);
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not update personal study." };
    }
    return { ok: true, result: { topicId: topic.id, percent }, message: "Personal study coverage updated." };
  },
};

const ASSESSMENT_CATEGORIES = ["quiz", "assignment", "lab", "midterm", "final", "project"] as const;

function assessmentInputFrom(
  params: Record<string, unknown>,
  base?: { category: AssessmentInput["category"]; totalMarks: number; weightPercent: number; date: string; obtainedMarks: number | null },
): AssessmentInput {
  const category = str(params.category) as AssessmentInput["category"];
  return {
    category: (ASSESSMENT_CATEGORIES as readonly string[]).includes(category)
      ? category
      : base?.category ?? "quiz",
    title: str(params.title, base ? "" : "Assessment"),
    obtainedMarks: base ? base.obtainedMarks : null,
    totalMarks: num(params.totalMarks) ?? base?.totalMarks ?? 100,
    weightPercent: num(params.weightPercent) ?? base?.weightPercent ?? 0,
    date: isIsoDate(params.date) ? (params.date as string) : base?.date ?? "",
  };
}

const createAssessment: MutationDescriptor = {
  kind: "create-assessment",
  domain: "Academics",
  label: "Create an assessment",
  triggersReplan: false,
  revisionDomain: "academic",
  revisionEntityType: "assessment",
  validate(params, ctx) {
    if (!ctx.academic) return fail("UNAVAILABLE", "Academics is not available in this context.");
    const course = ctx.academic.courses.find(
      (c) => c.id === str(params.courseId) || c.title.toLowerCase() === str(params.courseTitle).toLowerCase() || c.code.toLowerCase() === str(params.courseCode).toLowerCase(),
    );
    if (!course) return fail("NO_COURSE", "No matching course was found for this assessment.");
    if (!str(params.title)) return fail("MISSING_TITLE", "The assessment needs a title.");
    const category = str(params.category);
    if (category && !(ASSESSMENT_CATEGORIES as readonly string[]).includes(category)) {
      return fail("INVALID_CATEGORY", "Unknown assessment category.");
    }
    if (params.date !== undefined && !isIsoDate(params.date)) {
      return fail("INVALID_DATE", "The assessment date must be an ISO date.");
    }
    return ok(`Will create assessment "${str(params.title)}" in ${course.title}.`);
  },
  describeCurrent() {
    return { exists: false };
  },
  preview(params) {
    return {
      before: "no such assessment",
      after: `${str(params.category) || "quiz"} "${str(params.title)}"${isIsoDate(params.date) ? ` on ${params.date}` : " (no date)"}`,
    };
  },
  async apply(params, ctx) {
    if (!ctx.academic) return { ok: false, result: {}, message: "Academics unavailable." };
    const course = ctx.academic.courses.find(
      (c) => c.id === str(params.courseId) || c.title.toLowerCase() === str(params.courseTitle).toLowerCase() || c.code.toLowerCase() === str(params.courseCode).toLowerCase(),
    );
    if (!course) return { ok: false, result: {}, message: "Course not found." };
    const res = await ctx.academic.createAssessment(course.id, assessmentInputFrom(params));
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not create the assessment." };
    }
    return { ok: true, result: { assessmentId: res.id, courseId: course.id }, message: "Assessment created." };
  },
};

const updateAssessmentDate: MutationDescriptor = {
  kind: "update-assessment-date",
  domain: "Academics",
  label: "Change an assessment date",
  triggersReplan: true,
  revisionDomain: "academic",
  revisionEntityType: "assessment",
  validate(params, ctx) {
    if (!ctx.academic) return fail("UNAVAILABLE", "Academics is not available in this context.");
    const assessment = resolveAssessment(params, ctx);
    if (!assessment) return fail("NO_ASSESSMENT", "No single matching assessment was found — select one.");
    if (!isIsoDate(params.date)) return fail("INVALID_DATE", "Provide the new date as an ISO date.");
    if (params.date === assessment.date) return fail("NO_CHANGE", "That is already the assessment date.");
    return ok(`Will move "${assessment.title}" to ${params.date as string}.`);
  },
  describeCurrent(params, ctx) {
    return { currentDate: resolveAssessment(params, ctx)?.date ?? null };
  },
  preview(params, ctx) {
    const assessment = resolveAssessment(params, ctx);
    return {
      before: assessment?.date ? `date ${assessment.date}` : "no date set",
      after: `date ${isIsoDate(params.date) ? (params.date as string) : "?"}`,
    };
  },
  async apply(params, ctx) {
    const assessment = resolveAssessment(params, ctx);
    if (!assessment || !ctx.academic) return { ok: false, result: {}, message: "Assessment not found." };
    const res = await ctx.academic.updateAssessment(
      assessment.id,
      assessmentInputFrom({ ...params, title: assessment.title }, assessment),
    );
    if (!res.ok) {
      return { ok: false, result: {}, message: Object.values(res.errors)[0] ?? "Could not update the assessment." };
    }
    return { ok: true, result: { assessmentId: assessment.id, date: params.date }, message: "Assessment date updated." };
  },
};

const updateAssessmentScope: MutationDescriptor = {
  kind: "update-assessment-scope",
  domain: "Academics",
  label: "Update an assessment's topic scope",
  triggersReplan: false,
  revisionDomain: "academic",
  revisionEntityType: "assessment-scope",
  validate(params, ctx) {
    if (!ctx.academic) return fail("UNAVAILABLE", "Academics is not available in this context.");
    const assessment = resolveAssessment(params, ctx);
    if (!assessment) return fail("NO_ASSESSMENT", "No single matching assessment was found — select one.");
    const topicIds = arr(params.topicIds).map((t) => str(t)).filter(Boolean);
    if (topicIds.length === 0) return fail("EMPTY_SCOPE", "Provide at least one topic id for the scope.");
    const inCourse = new Set(
      ctx.academic.topics.filter((t) => t.courseId === assessment.courseId).map((t) => t.id),
    );
    const foreign = topicIds.filter((id) => !inCourse.has(id));
    if (foreign.length > 0) {
      return fail(
        "CROSS_COURSE_SCOPE",
        `Assessment scope can only include topics from its own course (offending: ${foreign.join(", ")}).`,
      );
    }
    return ok(`Will set "${assessment.title}" scope to ${topicIds.length} topic(s).`);
  },
  describeCurrent(params, ctx) {
    const assessment = resolveAssessment(params, ctx);
    return { currentScopeTopicIds: assessment ? ctx.academic?.scopeTopicIds(assessment.id) ?? [] : [] };
  },
  preview(params, ctx) {
    const assessment = resolveAssessment(params, ctx);
    const current = assessment ? ctx.academic?.scopeTopicIds(assessment.id) ?? [] : [];
    const next = arr(params.topicIds).map((t) => str(t)).filter(Boolean);
    return { before: `${current.length} topic(s) in scope`, after: `${next.length} topic(s) in scope` };
  },
  async apply(params, ctx) {
    const assessment = resolveAssessment(params, ctx);
    if (!assessment || !ctx.academic) return { ok: false, result: {}, message: "Assessment not found." };
    const topicIds = arr(params.topicIds).map((t) => str(t)).filter(Boolean);
    const source = str(params.source, "capture-approved");
    await ctx.academic.setAssessmentScope(assessment.id, topicIds, source, new Date().toISOString());
    return { ok: true, result: { assessmentId: assessment.id, topicIds }, message: "Assessment scope updated." };
  },
};

// =======================================================================
// create-language-session  (Natural Capture — "did 25 min of German")
// =======================================================================

function resolveLanguagePath(params: Record<string, unknown>, ctx: MutationContext) {
  const paths = ctx.language?.paths ?? [];
  const byId = paths.find((p) => p.id === str(params.pathId));
  if (byId) return byId;
  const q = str(params.language || params.pathTitle || params.match).toLowerCase();
  if (q) {
    const exact = paths.filter(
      (p) => p.language.toLowerCase() === q || p.title.toLowerCase() === q,
    );
    if (exact.length === 1) return exact[0];
    const partial = paths.filter(
      (p) => p.language.toLowerCase().includes(q) || p.title.toLowerCase().includes(q),
    );
    if (partial.length === 1) return partial[0];
  }
  return null;
}

const createLanguageSession: MutationDescriptor = {
  kind: "create-language-session",
  domain: "Reading & Language",
  label: "Log a language study session",
  triggersReplan: false,
  revisionDomain: "language",
  revisionEntityType: "language-session",
  validate(params, ctx) {
    if (!ctx.language) return fail("UNAVAILABLE", "Reading & Language is not available in this context.");
    const path = resolveLanguagePath(params, ctx);
    if (!path) return fail("NO_PATH", "No single matching language path was found — select one.");
    const minutes = num(params.durationMinutes);
    if (minutes === null || minutes <= 0 || minutes > 24 * 60) {
      return fail("INVALID_DURATION", "The session duration must be 1–1440 minutes.");
    }
    const activity = str(params.activity, "lesson");
    if (!(SESSION_ACTIVITIES as readonly string[]).includes(activity)) {
      return fail("INVALID_ACTIVITY", "Unknown session activity.");
    }
    const date = str(params.date, todayIso());
    if (!isIsoDate(date)) return fail("INVALID_DATE", "The session date must be an ISO date.");
    return ok(`Will log a ${minutes}-minute ${activity} session on ${path.language}.`);
  },
  describeCurrent(params, ctx) {
    return { pathId: resolveLanguagePath(params, ctx)?.id ?? null };
  },
  preview(params, ctx) {
    const path = resolveLanguagePath(params, ctx);
    return {
      before: "no such session",
      after: `${num(params.durationMinutes) ?? "?"} min · ${str(params.activity, "lesson")} · ${path?.language ?? "language"}`,
    };
  },
  async apply(params, ctx) {
    const path = resolveLanguagePath(params, ctx);
    if (!path || !ctx.language) return { ok: false, result: {}, message: "Language path not found." };
    const recallScore = num(params.recallScore);
    const res = await ctx.language.logSession(path.id, {
      unitId: null,
      date: str(params.date, todayIso()),
      durationMinutes: num(params.durationMinutes) ?? 0,
      activity: str(params.activity, "lesson") as "lesson",
      notes: str(params.notes),
      recallScore,
      recallMax: num(params.recallMax) ?? 10,
    });
    if (!res.ok) {
      return { ok: false, result: {}, message: "Could not log the language session." };
    }
    return { ok: true, result: { pathId: path.id }, message: "Language session logged." };
  },
};

// =======================================================================
// set-today-capacity  (Natural Capture / Today — subjective only)
// =======================================================================

const CAPACITY_LEVELS = ["low", "normal", "high"] as const;

const setTodayCapacity: MutationDescriptor = {
  kind: "set-today-capacity",
  domain: "Today",
  label: "Set today's operating capacity",
  triggersReplan: false,
  revisionDomain: "planning",
  revisionEntityType: "today-capacity",
  validate(params, ctx) {
    if (!ctx.today) return fail("UNAVAILABLE", "Today capacity is not available in this context.");
    const level = str(params.capacityLevel);
    if (!(CAPACITY_LEVELS as readonly string[]).includes(level)) {
      return fail("INVALID_LEVEL", "Capacity must be low, normal, or high.");
    }
    const date = str(params.date, todayIso());
    if (!isIsoDate(date)) return fail("INVALID_DATE", "The date must be an ISO date.");
    return ok(`Will set ${date} operating capacity to ${level}.`);
  },
  describeCurrent(params, ctx) {
    const date = str(params.date, todayIso());
    return { date, currentCapacity: ctx.today?.getCapacity(date) ?? null };
  },
  preview(params, ctx) {
    const date = str(params.date, todayIso());
    return {
      before: ctx.today?.getCapacity(date) ?? "normal (default)",
      after: str(params.capacityLevel) || "normal",
    };
  },
  async apply(params, ctx) {
    if (!ctx.today) return { ok: false, result: {}, message: "Today capacity unavailable." };
    const date = str(params.date, todayIso());
    const now = new Date().toISOString();
    await ctx.today.setCapacity({
      date,
      capacityLevel: str(params.capacityLevel) as "normal",
      source: str(params.source, "capture-approved") as "capture-approved",
      note: str(params.note),
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, result: { date, capacityLevel: str(params.capacityLevel) }, message: "Today capacity set." };
  },
};

// =======================================================================
// The registry
// =======================================================================

export const MUTATION_REGISTRY: Record<MutationKind, MutationDescriptor> = {
  "create-action": createAction,
  "create-expense": createExpense,
  "routine-checkin": routineCheckin,
  "set-professor-coverage": setProfessorCoverage,
  "set-personal-study": setPersonalStudy,
  "create-assessment": createAssessment,
  "update-assessment-date": updateAssessmentDate,
  "update-assessment-scope": updateAssessmentScope,
  "create-language-session": createLanguageSession,
  "set-today-capacity": setTodayCapacity,
  "schedule-block": scheduleBlock,
  "set-knowledge-review": setKnowledgeReview,
  "adjust-routine-cadence": adjustRoutineCadence,
  "adjust-routine-window": adjustRoutineWindow,
  "adjust-routine-duration": adjustRoutineDuration,
  "adjust-routine-days": adjustRoutineDays,
};

/** Fails closed — an unknown kind returns `null` and cannot be applied. */
export function getMutation(kind: string): MutationDescriptor | null {
  if (!isMutationKind(kind)) return null;
  return MUTATION_REGISTRY[kind] ?? null;
}

/**
 * Validate → apply one mutation, returning a uniform outcome. This is the ONLY
 * entry point callers (Capture, AI Coach, engines) should use. It never throws
 * for a bad kind or bad params.
 */
export async function runMutation(
  kind: string,
  params: Record<string, unknown>,
  ctx: MutationContext,
): Promise<{ ok: boolean; reasonCodes: string[]; message: string; result: Record<string, unknown> }> {
  const descriptor = getMutation(kind);
  if (!descriptor) {
    return { ok: false, reasonCodes: ["UNKNOWN_KIND"], message: `No mutation for "${kind}".`, result: {} };
  }
  const validation = descriptor.validate(params, ctx);
  if (!validation.ok) {
    return { ok: false, reasonCodes: validation.reasonCodes, message: validation.message, result: {} };
  }
  const outcome = await descriptor.apply(params, ctx);
  return {
    ok: outcome.ok,
    reasonCodes: outcome.ok ? [] : ["APPLY_ERROR"],
    message: outcome.message,
    result: outcome.result,
  };
}

export { MUTATION_KINDS, isMutationKind };
export type { MutationDescriptor, MutationKind, MutationContext } from "./types";
