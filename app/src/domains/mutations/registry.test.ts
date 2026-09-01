import { describe, it, expect, vi } from "vitest";
import {
  MUTATION_REGISTRY,
  MUTATION_KINDS,
  getMutation,
  runMutation,
  isMutationKind,
} from "./registry";
import type { MutationContext } from "./types";

// -------------------------------------------------------------------------
// A full mock context — every slice records its calls.
// -------------------------------------------------------------------------

type Calls = Record<string, unknown[][]>;

function makeCtx(over: Partial<MutationContext> = {}): { ctx: MutationContext; calls: Calls } {
  const calls: Calls = {};
  const rec =
    (name: string, ret: unknown = { ok: true, id: `${name}-id` }) =>
    (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
      return Promise.resolve(ret);
    };

  const routine = (over_: Record<string, unknown>) => ({
    id: "rt",
    title: "R",
    category: "C",
    timeWindow: "evening",
    scheduleType: "daily",
    scheduleDays: [0, 1, 2, 3, 4],
    scheduleTarget: null,
    completionType: "boolean",
    targetQuantity: null,
    targetUnit: null,
    targetDurationMinutes: null,
    priority: "important",
    relatedSystemId: null,
    paused: false,
    archived: false,
    createdAt: "t",
    updatedAt: "t",
    ...over_,
  });

  const raw = {
    performance: {
      systems: [{ id: "sys1", title: "Deep Work" }],
      createAction: rec("createAction"),
    },
    planning: {
      blocks: [],
      capacity: { dailyCapacityMinutes: 300, weeklyCapacityMinutes: 1260 },
      checkFit: (c: { startMinute: number }) =>
        c.startMinute < 0
          ? { fits: false, reason: "Would exceed weekly capacity by 30 minutes." }
          : { fits: true, reason: null },
      createBlock: rec("createBlock"),
    },
    knowledge: {
      topics: [{ id: "kt1", title: "Binary Trees", nextReviewDate: null, lastStudied: null }],
      updateReviewState: rec("updateReviewState"),
    },
    routine: {
      routines: [
        routine({ id: "rt1", title: "Evening Review", category: "Review", timeWindow: "evening", scheduleType: "daily" }),
        routine({
          id: "rt2",
          title: "Morning Run",
          category: "Fitness",
          timeWindow: "morning",
          scheduleType: "weekly-days",
          scheduleDays: [0, 2, 4],
          completionType: "duration",
          targetDurationMinutes: 30,
        }),
      ],
      updateRoutine: rec("updateRoutine"),
      checkInRoutine: rec("checkInRoutine"),
    },
    money: {
      categories: ["Groceries", "Transport", "Rent"],
      createTransaction: rec("createTransaction"),
    },
    academic: {
      courses: [
        { id: "c1", title: "Data Structures", code: "CSE 201" },
        { id: "c2", title: "Operating Systems", code: "CSE 305" },
      ],
      topics: [
        { id: "t1", courseId: "c1", title: "AVL Trees", professorCoverage: "in-progress", personalStudyPercent: 20 },
        { id: "t2", courseId: "c1", title: "Heaps", professorCoverage: "not-taught", personalStudyPercent: 0 },
        { id: "t3", courseId: "c2", title: "Paging", professorCoverage: "taught", personalStudyPercent: 50 },
      ],
      assessments: [
        { id: "a1", courseId: "c1", title: "Midterm 1", category: "midterm", obtainedMarks: null, totalMarks: 50, weightPercent: 25, date: "2026-10-01" },
      ],
      setProfessorCoverage: rec("setProfessorCoverage"),
      setPersonalStudyCoverage: rec("setPersonalStudyCoverage"),
      createAssessment: rec("createAssessment"),
      updateAssessment: rec("updateAssessment"),
      scopeTopicIds: () => [] as string[],
      setAssessmentScope: rec("setAssessmentScope", undefined),
    },
    language: {
      paths: [{ id: "lp1", language: "German", title: "A1 Foundations" }],
      logSession: rec("logSession", { ok: true }),
    },
    today: {
      getCapacity: () => null,
      setCapacity: rec("setCapacity", undefined),
    },
    ...over,
  };
  return { ctx: raw as unknown as MutationContext, calls };
}

// -------------------------------------------------------------------------
// Registry shape
// -------------------------------------------------------------------------

describe("MUTATION_REGISTRY", () => {
  it("covers exactly the 16 blueprint kinds and nothing generic", () => {
    expect(Object.keys(MUTATION_REGISTRY).sort()).toEqual([...MUTATION_KINDS].sort());
    for (const generic of ["apply-patch", "write-table", "run-command", "exec-sql", "update-entity"]) {
      expect(getMutation(generic)).toBeNull();
      expect(isMutationKind(generic)).toBe(false);
    }
  });

  it("every descriptor names its kind, domain and a revision domain", () => {
    for (const [key, d] of Object.entries(MUTATION_REGISTRY)) {
      expect(d.kind).toBe(key);
      expect(d.domain.length).toBeGreaterThan(0);
      expect(d.revisionDomain.length).toBeGreaterThan(0);
      expect(typeof d.validate).toBe("function");
      expect(typeof d.apply).toBe("function");
    }
  });

  it("getMutation fails closed; runMutation reports UNKNOWN_KIND without throwing", async () => {
    expect(getMutation("nope")).toBeNull();
    const { ctx } = makeCtx();
    const out = await runMutation("nope", {}, ctx);
    expect(out.ok).toBe(false);
    expect(out.reasonCodes).toEqual(["UNKNOWN_KIND"]);
  });
});

// -------------------------------------------------------------------------
// V1 kinds — behaviour preserved
// -------------------------------------------------------------------------

describe("create-action", () => {
  it("validates title + System then calls performance.createAction once", async () => {
    const { ctx, calls } = makeCtx();
    expect(MUTATION_REGISTRY["create-action"].validate({ title: "Review AVL" }, ctx).ok).toBe(true);
    const out = await MUTATION_REGISTRY["create-action"].apply({ title: "Review AVL" }, ctx);
    expect(out.ok).toBe(true);
    expect(calls.createAction[0][0]).toBe("sys1");
  });
  it("fails NO_SYSTEM and applies nothing", () => {
    const { ctx } = makeCtx({ performance: { systems: [], createAction: vi.fn() as never } });
    const v = MUTATION_REGISTRY["create-action"].validate({ title: "x" }, ctx);
    expect(v.ok).toBe(false);
    expect(v.reasonCodes).toContain("NO_SYSTEM");
  });
});

describe("schedule-block", () => {
  it("passes a fitting block to planning.createBlock", async () => {
    const { ctx, calls } = makeCtx();
    const params = { title: "Study", day: 1, startMinute: 17 * 60, durationMinutes: 60 };
    expect(MUTATION_REGISTRY["schedule-block"].validate(params, ctx).ok).toBe(true);
    await MUTATION_REGISTRY["schedule-block"].apply(params, ctx);
    expect((calls.createBlock[0][0] as { endMinute: number }).endMinute).toBe(17 * 60 + 60);
  });
  it("blocks a non-fitting block with CAPACITY_EXCEEDED / CONFLICT / INVALID_TIME", () => {
    const { ctx } = makeCtx();
    const v = MUTATION_REGISTRY["schedule-block"].validate({ title: "x", day: 1, startMinute: -1, durationMinutes: 60 }, ctx);
    expect(v.ok).toBe(false);
    expect(["CAPACITY_EXCEEDED", "CONFLICT", "INVALID_TIME"]).toContain(v.reasonCodes[0]);
  });
});

describe("set-knowledge-review — schedule only, never mastery", () => {
  it("resolves by title, writes a future review date", async () => {
    const { ctx, calls } = makeCtx();
    const params = { topicTitle: "Binary Trees", inDays: 3 };
    expect(MUTATION_REGISTRY["set-knowledge-review"].validate(params, ctx).ok).toBe(true);
    await MUTATION_REGISTRY["set-knowledge-review"].apply(params, ctx);
    const [topicId, review] = calls.updateReviewState[0] as [string, { nextReviewDate: string }];
    expect(topicId).toBe("kt1");
    expect(review.nextReviewDate > new Date().toISOString().slice(0, 10)).toBe(true);
  });
  it("fails NO_TOPIC / INVALID_DATE", () => {
    const { ctx } = makeCtx();
    expect(MUTATION_REGISTRY["set-knowledge-review"].validate({ topicTitle: "Nope", inDays: 3 }, ctx).reasonCodes).toContain("NO_TOPIC");
    expect(MUTATION_REGISTRY["set-knowledge-review"].validate({ topicTitle: "Binary Trees", inDays: 9999 }, ctx).reasonCodes).toContain("INVALID_DATE");
  });
});

describe("adjust-routine-cadence", () => {
  it("switches a routine to times-per-week", async () => {
    const { ctx, calls } = makeCtx();
    const params = { match: "evening", timesPerWeek: 3 };
    expect(MUTATION_REGISTRY["adjust-routine-cadence"].validate(params, ctx).ok).toBe(true);
    await MUTATION_REGISTRY["adjust-routine-cadence"].apply(params, ctx);
    const [id, input] = calls.updateRoutine[0] as [string, { schedule: { type: string; timesPerWeek: number } }];
    expect(id).toBe("rt1");
    expect(input.schedule.type).toBe("times-per-week");
    expect(input.schedule.timesPerWeek).toBe(3);
  });
  it("fails INVALID_CADENCE outside 1–14", () => {
    const { ctx } = makeCtx();
    expect(MUTATION_REGISTRY["adjust-routine-cadence"].validate({ match: "evening", timesPerWeek: 99 }, ctx).reasonCodes).toContain("INVALID_CADENCE");
  });
});

// -------------------------------------------------------------------------
// New V2 kinds
// -------------------------------------------------------------------------

describe("adjust-routine-window / -duration / -days", () => {
  it("window: rejects an unknown window and a no-op, applies a real move", async () => {
    const { ctx, calls } = makeCtx();
    expect(MUTATION_REGISTRY["adjust-routine-window"].validate({ routineId: "rt1", timeWindow: "space" }, ctx).reasonCodes).toContain("INVALID_WINDOW");
    expect(MUTATION_REGISTRY["adjust-routine-window"].validate({ routineId: "rt1", timeWindow: "evening" }, ctx).reasonCodes).toContain("NO_CHANGE");
    expect(MUTATION_REGISTRY["adjust-routine-window"].validate({ routineId: "rt1", timeWindow: "morning" }, ctx).ok).toBe(true);
    await MUTATION_REGISTRY["adjust-routine-window"].apply({ routineId: "rt1", timeWindow: "morning" }, ctx);
    expect((calls.updateRoutine[0][1] as { timeWindow: string }).timeWindow).toBe("morning");
  });
  it("duration: only for duration routines, 1–1440 range", async () => {
    const { ctx, calls } = makeCtx();
    expect(MUTATION_REGISTRY["adjust-routine-duration"].validate({ routineId: "rt1", targetDurationMinutes: 20 }, ctx).reasonCodes).toContain("NOT_DURATION_ROUTINE");
    expect(MUTATION_REGISTRY["adjust-routine-duration"].validate({ routineId: "rt2", targetDurationMinutes: 5000 }, ctx).reasonCodes).toContain("INVALID_DURATION");
    expect(MUTATION_REGISTRY["adjust-routine-duration"].validate({ routineId: "rt2", targetDurationMinutes: 45 }, ctx).ok).toBe(true);
    await MUTATION_REGISTRY["adjust-routine-duration"].apply({ routineId: "rt2", targetDurationMinutes: 45 }, ctx);
    expect((calls.updateRoutine[0][1] as { targetDurationMinutes: number }).targetDurationMinutes).toBe(45);
  });
  it("days: rejects out-of-range / duplicate / empty, applies weekly-days", async () => {
    const { ctx, calls } = makeCtx();
    expect(MUTATION_REGISTRY["adjust-routine-days"].validate({ routineId: "rt1", days: [] }, ctx).reasonCodes).toContain("INVALID_DAYS");
    expect(MUTATION_REGISTRY["adjust-routine-days"].validate({ routineId: "rt1", days: [1, 1, 9] }, ctx).reasonCodes).toContain("INVALID_DAYS");
    expect(MUTATION_REGISTRY["adjust-routine-days"].validate({ routineId: "rt1", days: [0, 2, 4] }, ctx).ok).toBe(true);
    await MUTATION_REGISTRY["adjust-routine-days"].apply({ routineId: "rt1", days: [0, 2, 4] }, ctx);
    const input = calls.updateRoutine[0][1] as { schedule: { type: string; days: number[] } };
    expect(input.schedule.type).toBe("weekly-days");
    expect(input.schedule.days).toEqual([0, 2, 4]);
  });
});

describe("routine-checkin", () => {
  it("records a valid check-in and rejects a future date / bad state / missing slice", async () => {
    const { ctx, calls } = makeCtx();
    const d = MUTATION_REGISTRY["routine-checkin"];
    expect(d.validate({ routineId: "rt1", state: "flying" }, ctx).reasonCodes).toContain("INVALID_STATE");
    expect(d.validate({ routineId: "rt1", state: "complete", date: "2999-01-01" }, ctx).reasonCodes).toContain("FUTURE_DATE");
    expect(d.validate({ routineId: "rt1", state: "complete", date: "2026-08-30" }, ctx).ok).toBe(true);
    await d.apply({ routineId: "rt1", state: "complete", date: "2026-08-30" }, ctx);
    expect((calls.checkInRoutine[0][1] as { state: string }).state).toBe("complete");

    const noSlice = makeCtx({ routine: { routines: ctx.routine.routines, updateRoutine: ctx.routine.updateRoutine } });
    expect(d.validate({ routineId: "rt1", state: "complete" }, noSlice.ctx).reasonCodes).toContain("UNAVAILABLE");
  });
});

describe("create-expense — category never guessed to a total", () => {
  it("resolves a known category, rejects an unknown one and a bad amount", async () => {
    const { ctx, calls } = makeCtx();
    const d = MUTATION_REGISTRY["create-expense"];
    expect(d.validate({ amount: -5, category: "Groceries" }, ctx).reasonCodes).toContain("INVALID_AMOUNT");
    expect(d.validate({ amount: 1200, category: "" }, ctx).reasonCodes).toContain("UNKNOWN_CATEGORY");
    expect(d.validate({ amount: 1200, category: "groc", date: "2026-08-30" }, ctx).ok).toBe(true);
    await d.apply({ amount: 1200, category: "groc", date: "2026-08-30" }, ctx);
    const tx = calls.createTransaction[0][0] as { type: string; category: string; amount: number };
    expect(tx.type).toBe("expense");
    expect(tx.category).toBe("Groceries");
    expect(tx.amount).toBe(1200);
  });
  it("is UNAVAILABLE when Money is not in context (permission-gated)", () => {
    const { ctx } = makeCtx({ money: undefined });
    expect(MUTATION_REGISTRY["create-expense"].validate({ amount: 10, category: "x" }, ctx).reasonCodes).toContain("UNAVAILABLE");
  });
});

describe("academic coverage + study kinds", () => {
  it("set-professor-coverage resolves one topic, rejects unknown coverage + no-op", async () => {
    const { ctx, calls } = makeCtx();
    const d = MUTATION_REGISTRY["set-professor-coverage"];
    expect(d.validate({ topicId: "t1", coverage: "sideways" }, ctx).reasonCodes).toContain("INVALID_COVERAGE");
    expect(d.validate({ topicId: "t1", coverage: "in-progress" }, ctx).reasonCodes).toContain("NO_CHANGE");
    expect(d.validate({ topicId: "t1", coverage: "taught" }, ctx).ok).toBe(true);
    await d.apply({ topicId: "t1", coverage: "taught" }, ctx);
    expect(calls.setProfessorCoverage[0]).toEqual(["t1", "taught"]);
  });
  it("set-personal-study clamps to 0–100", () => {
    const { ctx } = makeCtx();
    expect(MUTATION_REGISTRY["set-personal-study"].validate({ topicId: "t1", percent: 140 }, ctx).reasonCodes).toContain("INVALID_PERCENT");
    expect(MUTATION_REGISTRY["set-personal-study"].validate({ topicId: "t1", percent: 60 }, ctx).ok).toBe(true);
  });
  it("ambiguous topic title does not resolve", () => {
    const { ctx } = makeCtx();
    const withDup = makeCtx({
      academic: {
        ...ctx.academic!,
        topics: [
          { id: "t1", courseId: "c1", title: "Trees", professorCoverage: "not-taught", personalStudyPercent: 0 },
          { id: "t9", courseId: "c1", title: "Trees", professorCoverage: "not-taught", personalStudyPercent: 0 },
        ],
      },
    });
    expect(MUTATION_REGISTRY["set-professor-coverage"].validate({ topicTitle: "Trees", coverage: "taught" }, withDup.ctx).reasonCodes).toContain("NO_TOPIC");
  });
});

describe("assessment kinds", () => {
  it("create-assessment needs a resolvable course + title", async () => {
    const { ctx, calls } = makeCtx();
    const d = MUTATION_REGISTRY["create-assessment"];
    expect(d.validate({ courseTitle: "Nonexistent", title: "Q1" }, ctx).reasonCodes).toContain("NO_COURSE");
    expect(d.validate({ courseId: "c1", title: "" }, ctx).reasonCodes).toContain("MISSING_TITLE");
    expect(d.validate({ courseId: "c1", title: "Quiz 1", category: "quiz", date: "2026-09-20" }, ctx).ok).toBe(true);
    await d.apply({ courseId: "c1", title: "Quiz 1", category: "quiz", date: "2026-09-20" }, ctx);
    expect(calls.createAssessment[0][0]).toBe("c1");
  });
  it("update-assessment-date moves an existing assessment and triggers replan", async () => {
    const { ctx, calls } = makeCtx();
    const d = MUTATION_REGISTRY["update-assessment-date"];
    expect(d.triggersReplan).toBe(true);
    expect(d.validate({ assessmentId: "a1", date: "not-a-date" }, ctx).reasonCodes).toContain("INVALID_DATE");
    expect(d.validate({ assessmentId: "a1", date: "2026-10-01" }, ctx).reasonCodes).toContain("NO_CHANGE");
    expect(d.validate({ assessmentId: "a1", date: "2026-10-15" }, ctx).ok).toBe(true);
    await d.apply({ assessmentId: "a1", date: "2026-10-15" }, ctx);
    const [id, input] = calls.updateAssessment[0] as [string, { date: string; title: string }];
    expect(id).toBe("a1");
    expect(input.date).toBe("2026-10-15");
    expect(input.title).toBe("Midterm 1");
  });
  it("update-assessment-scope rejects a cross-course topic and applies a same-course set", async () => {
    const { ctx, calls } = makeCtx();
    const d = MUTATION_REGISTRY["update-assessment-scope"];
    expect(d.validate({ assessmentId: "a1", topicIds: ["t1", "t3"] }, ctx).reasonCodes).toContain("CROSS_COURSE_SCOPE");
    expect(d.validate({ assessmentId: "a1", topicIds: [] }, ctx).reasonCodes).toContain("EMPTY_SCOPE");
    expect(d.validate({ assessmentId: "a1", topicIds: ["t1", "t2"] }, ctx).ok).toBe(true);
    await d.apply({ assessmentId: "a1", topicIds: ["t1", "t2"] }, ctx);
    const [aid, topicIds, source] = calls.setAssessmentScope[0] as [string, string[], string];
    expect(aid).toBe("a1");
    expect(topicIds).toEqual(["t1", "t2"]);
    expect(source).toBe("capture-approved");
  });
});

describe("create-language-session", () => {
  it("resolves a path by language, validates duration + activity", async () => {
    const { ctx, calls } = makeCtx();
    const d = MUTATION_REGISTRY["create-language-session"];
    expect(d.validate({ language: "Klingon", durationMinutes: 25 }, ctx).reasonCodes).toContain("NO_PATH");
    expect(d.validate({ language: "German", durationMinutes: 0 }, ctx).reasonCodes).toContain("INVALID_DURATION");
    expect(d.validate({ language: "German", durationMinutes: 25, activity: "vibing" }, ctx).reasonCodes).toContain("INVALID_ACTIVITY");
    expect(d.validate({ language: "German", durationMinutes: 25, activity: "vocab", date: "2026-08-30" }, ctx).ok).toBe(true);
    await d.apply({ language: "German", durationMinutes: 25, activity: "vocab", date: "2026-08-30" }, ctx);
    expect(calls.logSession[0][0]).toBe("lp1");
    expect((calls.logSession[0][1] as { durationMinutes: number }).durationMinutes).toBe(25);
  });
});

describe("set-today-capacity — subjective only", () => {
  it("accepts low/normal/high, rejects anything else, writes capture-approved source", async () => {
    const { ctx, calls } = makeCtx();
    const d = MUTATION_REGISTRY["set-today-capacity"];
    expect(d.validate({ capacityLevel: "wrecked", date: "2026-09-01" }, ctx).reasonCodes).toContain("INVALID_LEVEL");
    expect(d.validate({ capacityLevel: "low", date: "2026-09-01" }, ctx).ok).toBe(true);
    await d.apply({ capacityLevel: "low", date: "2026-09-01" }, ctx);
    const row = calls.setCapacity[0][0] as { capacityLevel: string; source: string; date: string };
    expect(row.capacityLevel).toBe("low");
    expect(row.source).toBe("capture-approved");
    expect(row.date).toBe("2026-09-01");
  });
});

// -------------------------------------------------------------------------
// runMutation end-to-end
// -------------------------------------------------------------------------

describe("runMutation", () => {
  it("validates then applies, surfacing reason codes without throwing", async () => {
    const { ctx, calls } = makeCtx();
    const bad = await runMutation("create-expense", { amount: -1, category: "Groceries" }, ctx);
    expect(bad.ok).toBe(false);
    expect(bad.reasonCodes).toContain("INVALID_AMOUNT");
    expect(calls.createTransaction).toBeUndefined();

    const good = await runMutation("create-expense", { amount: 500, category: "Transport", date: "2026-08-30" }, ctx);
    expect(good.ok).toBe(true);
    expect(calls.createTransaction).toHaveLength(1);
  });
});
