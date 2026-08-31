import { describe, it, expect, vi } from "vitest";
import { APPLY_ADAPTERS, getAdapter, type ApplyContext } from "./applyAdapters";
import type { ScheduleBlock } from "../planning/types";

function ctx(over: Partial<ApplyContext> = {}): { ctx: ApplyContext; calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {};
  const rec = (name: string) =>
    vi.fn(async (...args: unknown[]) => {
      calls[name] = args;
      return { ok: true, id: `${name}-id` } as const;
    });
  const base: ApplyContext = {
    performance: {
      systems: [{ id: "sys1", title: "Deep Work" }],
      createAction: rec("createAction"),
    },
    planning: {
      blocks: [],
      capacity: { dailyCapacityMinutes: 300, weeklyCapacityMinutes: 1260 },
      checkFit: (c: ScheduleBlock) =>
        c.startMinute < 0 ? { fits: false, reason: "Would exceed weekly capacity by 30 minutes." } : { fits: true, reason: null },
      createBlock: rec("createBlock"),
    },
    knowledge: {
      topics: [
        { id: "kt1", title: "Binary Trees", nextReviewDate: null, lastStudied: null },
      ],
      updateReviewState: rec("updateReviewState"),
    },
    routine: {
      routines: [
        {
          id: "rt1",
          title: "Evening Review",
          category: "Review",
          timeWindow: "evening",
          scheduleType: "daily",
          scheduleDays: [0, 1, 2, 3, 4],
          scheduleTarget: null,
          completionType: "boolean",
          targetQuantity: null,
          targetUnit: null,
          targetDurationMinutes: null,
          priority: "normal",
          relatedSystemId: null,
          paused: false,
          archived: false,
          createdAt: "t",
          updatedAt: "t",
        } as unknown as ApplyContext["routine"]["routines"][number],
      ],
      updateRoutine: rec("updateRoutine"),
    },
  };
  return { ctx: { ...base, ...over }, calls };
}

describe("APPLY_ADAPTERS allowlist", () => {
  it("has exactly the four V1 kinds and nothing generic", () => {
    expect(Object.keys(APPLY_ADAPTERS).sort()).toEqual([
      "adjust-routine-cadence",
      "create-action",
      "schedule-block",
      "set-knowledge-review",
    ]);
    expect(getAdapter("apply-json-patch")).toBeNull();
    expect(getAdapter("run-command")).toBeNull();
  });
});

describe("create-action adapter", () => {
  it("validates a title + a System, then calls performance.createAction once", async () => {
    const { ctx: c, calls } = ctx();
    const a = APPLY_ADAPTERS["create-action"];
    expect(a.validate({ title: "Review Binary Trees" }, c).ok).toBe(true);
    const out = await a.apply({ title: "Review Binary Trees" }, c);
    expect(out.ok).toBe(true);
    expect(calls.createAction[0]).toBe("sys1");
    expect((calls.createAction[1] as { title: string }).title).toBe("Review Binary Trees");
  });
  it("fails NO_SYSTEM when there is no System, and applies nothing", async () => {
    const { ctx: c, calls } = ctx({
      performance: { systems: [], createAction: vi.fn() as never },
    });
    const v = APPLY_ADAPTERS["create-action"].validate({ title: "x" }, c);
    expect(v.ok).toBe(false);
    expect(v.reasonCodes).toContain("NO_SYSTEM");
    expect(calls.createAction).toBeUndefined();
  });
});

describe("schedule-block adapter — the deterministic planning gate", () => {
  it("validates a fitting block then calls planning.createBlock", async () => {
    const { ctx: c, calls } = ctx();
    const a = APPLY_ADAPTERS["schedule-block"];
    const params = { title: "Study", day: 1, startMinute: 17 * 60, durationMinutes: 60 };
    expect(a.validate(params, c).ok).toBe(true);
    const out = await a.apply(params, c);
    expect(out.ok).toBe(true);
    expect((calls.createBlock[0] as { endMinute: number }).endMinute).toBe(17 * 60 + 60);
  });
  it("blocks CAPACITY_EXCEEDED / CONFLICT from the planning engine — no mutation", async () => {
    const { ctx: c, calls } = ctx();
    const v = APPLY_ADAPTERS["schedule-block"].validate(
      { title: "x", day: 1, startMinute: -1, durationMinutes: 60 },
      c,
    );
    expect(v.ok).toBe(false);
    expect(["CAPACITY_EXCEEDED", "CONFLICT", "INVALID_TIME"]).toContain(v.reasonCodes[0]);
    expect(calls.createBlock).toBeUndefined();
  });
  it("rejects an impossible time range", () => {
    const { ctx: c } = ctx();
    const v = APPLY_ADAPTERS["schedule-block"].validate(
      { title: "x", day: 9, startMinute: 100, durationMinutes: 60 },
      c,
    );
    expect(v.ok).toBe(false);
    expect(v.reasonCodes).toContain("INVALID_TIME");
  });
});

describe("set-knowledge-review adapter — schedule only, never mastery", () => {
  it("resolves a topic by title and sets a future review date", async () => {
    const { ctx: c, calls } = ctx();
    const a = APPLY_ADAPTERS["set-knowledge-review"];
    const params = { topicTitle: "Binary Trees", inDays: 3 };
    expect(a.validate(params, c).ok).toBe(true);
    const out = await a.apply(params, c);
    expect(out.ok).toBe(true);
    const [topicId, review] = calls.updateReviewState as [string, { nextReviewDate: string }];
    expect(topicId).toBe("kt1");
    expect(review.nextReviewDate > new Date().toISOString().slice(0, 10)).toBe(true);
  });
  it("fails NO_TOPIC for an unknown concept", () => {
    const { ctx: c } = ctx();
    const v = APPLY_ADAPTERS["set-knowledge-review"].validate({ topicTitle: "Nope", inDays: 3 }, c);
    expect(v.ok).toBe(false);
    expect(v.reasonCodes).toContain("NO_TOPIC");
  });
  it("fails INVALID_DATE for an out-of-range interval", () => {
    const { ctx: c } = ctx();
    expect(
      APPLY_ADAPTERS["set-knowledge-review"].validate({ topicTitle: "Binary Trees", inDays: 9999 }, c).reasonCodes,
    ).toContain("INVALID_DATE");
  });
});

describe("adjust-routine-cadence adapter", () => {
  it("matches a routine by substring and switches it to times-per-week", async () => {
    const { ctx: c, calls } = ctx();
    const a = APPLY_ADAPTERS["adjust-routine-cadence"];
    const params = { match: "evening", timesPerWeek: 3 };
    expect(a.validate(params, c).ok).toBe(true);
    await a.apply(params, c);
    const [id, input] = calls.updateRoutine as [string, { schedule: { type: string; timesPerWeek: number } }];
    expect(id).toBe("rt1");
    expect(input.schedule.type).toBe("times-per-week");
    expect(input.schedule.timesPerWeek).toBe(3);
  });
  it("fails INVALID_CADENCE outside 1–14", () => {
    const { ctx: c } = ctx();
    expect(
      APPLY_ADAPTERS["adjust-routine-cadence"].validate({ match: "evening", timesPerWeek: 99 }, c).reasonCodes,
    ).toContain("INVALID_CADENCE");
  });
});
