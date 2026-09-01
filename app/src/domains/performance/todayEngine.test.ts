import { describe, it, expect } from "vitest";
import { deriveTodayState, type TodayEngineInput } from "./todayEngine";
import type { PlanningBlock } from "../planning/types";

function block(over: Partial<PlanningBlock> = {}): PlanningBlock {
  return {
    id: "b1",
    title: "Study graphs",
    domain: "Academics",
    actionId: null,
    day: 0,
    date: "2026-09-07",
    startMinute: 9 * 60,
    endMinute: 10 * 60,
    type: "flexible",
    locked: false,
    source: "manual",
    status: "scheduled",
    createdAt: "t",
    updatedAt: "t",
    ...over,
  };
}

function input(over: Partial<TodayEngineInput> = {}): TodayEngineInput {
  return {
    nowMinute: 9 * 60 + 30,
    nowIso: "2026-09-07",
    blocksToday: [block()],
    occurrenceStateFor: () => null,
    focusMinutesForBlock: () => 0,
    actionStatusFor: () => null,
    dailyCapacityMinutes: 240,
    weeklyCapacityMinutes: 1200,
    weeklyScheduledMinutes: 300,
    capacityLevel: "normal",
    ...over,
  };
}

describe("deriveTodayState", () => {
  it("a valid plan with the current block running → follow-plan, NOW = that block", () => {
    const s = deriveTodayState(input());
    expect(s.mode).toBe("follow-plan");
    expect(s.now.kind).toBe("planned");
    expect(s.currentPlanned?.block.id).toBe("b1");
    expect(s.adaptationReasons).toEqual([]);
  });

  it("a fixed commitment running now wins the NOW surface (precedence)", () => {
    const s = deriveTodayState(
      input({
        blocksToday: [
          block({ id: "flex", startMinute: 9 * 60, endMinute: 11 * 60 }),
          block({ id: "fx", type: "fixed", startMinute: 9 * 60, endMinute: 10 * 60, title: "Lecture" }),
        ],
      }),
    );
    expect(s.now.kind).toBe("fixed");
    expect(s.currentFixed?.block.id).toBe("fx");
  });

  it("a block past its end with no Focus evidence is elapsed-unresolved, NOT missed → adaptation", () => {
    const s = deriveTodayState(
      input({ nowMinute: 11 * 60, blocksToday: [block({ startMinute: 9 * 60, endMinute: 10 * 60 })] }),
    );
    expect(s.blocks[0].state).toBe("elapsed-unresolved");
    expect(s.elapsedUnresolved).toHaveLength(1);
    expect(s.mode).toBe("adaptation-needed");
    expect(s.adaptationReasons[0]).toMatch(/without being resolved/);
  });

  it("linked Focus evidence covers a passed block without a second log", () => {
    const s = deriveTodayState(
      input({
        nowMinute: 11 * 60,
        blocksToday: [block({ startMinute: 9 * 60, endMinute: 10 * 60 })],
        focusMinutesForBlock: () => 55, // >= 75% of 60
      }),
    );
    expect(s.blocks[0].state).toBe("done");
    expect(s.mode).toBe("follow-plan");
  });

  it("a persisted occurrence 'skipped' is respected and never counts as remaining work", () => {
    const s = deriveTodayState(
      input({
        nowMinute: 8 * 60,
        blocksToday: [block({ startMinute: 9 * 60, endMinute: 10 * 60 })],
        occurrenceStateFor: () => "skipped",
      }),
    );
    expect(s.blocks[0].state).toBe("skipped");
    expect(s.remainingPlannedMinutes).toBe(0);
  });

  it("a free gap can stay a buffer — the NOW surface says so, no auto-fill", () => {
    const s = deriveTodayState(
      input({
        nowMinute: 12 * 60,
        blocksToday: [block({ startMinute: 15 * 60, endMinute: 16 * 60 })],
      }),
    );
    expect(s.now.kind).toBe("buffer");
    expect(s.now.reason).toMatch(/valid choice/);
    expect(s.freeGapMinutes).toBe(3 * 60);
  });

  it("low capacity with a lot of plan left triggers adaptation, but does not touch Planner capacity", () => {
    const s = deriveTodayState(
      input({
        nowMinute: 20 * 60,
        capacityLevel: "low",
        blocksToday: [
          block({ id: "a", startMinute: 20 * 60 + 30, endMinute: 22 * 60 }),
          block({ id: "b", startMinute: 22 * 60, endMinute: 23 * 60 + 30 }),
        ],
      }),
    );
    expect(s.mode).toBe("adaptation-needed");
    expect(s.adaptationReasons.some((r) => /low-capacity/.test(r))).toBe(true);
    expect(s.capacityLevel).toBe("low"); // the engine only reads it
  });

  it("capacity defaults to normal and is never inferred from the clock", () => {
    const lateButNormal = deriveTodayState(input({ nowMinute: 23 * 60, blocksToday: [] }));
    expect(lateButNormal.capacityLevel).toBe("normal");
    expect(lateButNormal.mode).toBe("follow-plan");
  });

  it("does not create a schedule — it only reports views over blocksToday", () => {
    const s = deriveTodayState(input({ blocksToday: [] }));
    expect(s.blocks).toEqual([]);
    expect(s.now.kind).toBe("clear");
  });
});
