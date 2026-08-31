// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeFitnessRepo } from "./repo";
import type { PlannedSession, RecoveryCheckIn, TrainingPlan, WorkoutSession } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
const plan = (id: string): TrainingPlan => ({
  id,
  title: `Plan ${id}`,
  status: "active",
  currentWeek: 1,
  totalWeeks: 8,
  daysPerWeek: 3,
  archived: false,
  createdAt: TS,
  updatedAt: TS,
});
const planned = (id: string, planId: string, exercises: PlannedSession["exercises"]): PlannedSession => ({
  id,
  planId,
  dayOfWeek: 0,
  title: `Session ${id}`,
  exercises,
  createdAt: TS,
  updatedAt: TS,
});
const workout = (id: string, planId: string | null): WorkoutSession => ({
  id,
  planId,
  plannedSessionId: null,
  date: "2026-08-01",
  title: "Upper Body",
  exercisesPerformed: [{ name: "Push-ups", setsCompleted: 3, repsCompleted: "15,14,11" }],
  notes: "",
  completed: true,
  createdAt: TS,
  updatedAt: TS,
});
const checkin = (id: string): RecoveryCheckIn => ({
  id,
  date: "2026-08-01",
  sleepHours: 7.5,
  soreness: "none",
  energy: "high",
  motivation: "high",
  stressLevel: "normal",
  createdAt: TS,
  updatedAt: TS,
});

beforeEach(() => window.localStorage.clear());

describe("makeFitnessRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeFitnessRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — plan vs actual separation + persistence", () => {
  it("round-trips the graph and survives a fresh instance", async () => {
    const repo = new LocalRepo();
    await repo.planUpsert(plan("p1"));
    await repo.plannedSessionUpsert(planned("s1", "p1", [{ name: "Push-ups", sets: 3, reps: "15" }]));
    await repo.workoutUpsert(workout("w1", "p1"));
    await repo.checkinUpsert(checkin("c1"));
    const g = await new LocalRepo().load();
    expect(g.plans).toHaveLength(1);
    expect(g.plannedSessions).toHaveLength(1);
    expect(g.workoutSessions).toHaveLength(1);
    expect(g.checkins).toHaveLength(1);
  });

  it("recording an actual workout NEVER changes the planned session's prescription", async () => {
    const repo = new LocalRepo();
    await repo.planUpsert(plan("p1"));
    const base = [{ name: "Push-ups", sets: 3, reps: "15" }];
    await repo.plannedSessionUpsert(planned("s1", "p1", base));

    // record an actual that differs
    await repo.workoutUpsert({
      ...workout("w1", "p1"),
      plannedSessionId: "s1",
      exercisesPerformed: [{ name: "Push-ups", setsCompleted: 3, repsCompleted: "15,14,11" }],
    });

    const g = await repo.load();
    expect(g.plannedSessions[0].exercises).toEqual(base); // unchanged
    expect(g.workoutSessions[0].exercisesPerformed[0].repsCompleted).toBe("15,14,11");
  });

  it("preserves createdAt on update", async () => {
    const repo = new LocalRepo();
    await repo.planUpsert(plan("p1"));
    await repo.planUpsert({ ...plan("p1"), title: "renamed", createdAt: "2099-01-01" });
    const g = await repo.load();
    expect(g.plans[0].title).toBe("renamed");
    expect(g.plans[0].createdAt).toBe(TS);
  });

  it("deleting a plan CASCADEs planned sessions but KEEPS workout history (SET NULL)", async () => {
    const repo = new LocalRepo();
    await repo.planUpsert(plan("p1"));
    await repo.plannedSessionUpsert(planned("s1", "p1", []));
    await repo.workoutUpsert(workout("w1", "p1"));
    await repo.planDelete("p1");
    const g = await repo.load();
    expect(g.plans).toHaveLength(0);
    expect(g.plannedSessions).toHaveLength(0);
    expect(g.workoutSessions).toHaveLength(1);
    expect(g.workoutSessions[0].planId).toBeNull();
  });

  it("refuses a planned session whose plan does not exist (FK)", async () => {
    const repo = new LocalRepo();
    await repo.plannedSessionUpsert(planned("s1", "ghost", []));
    expect((await repo.load()).plannedSessions).toHaveLength(0);
  });

  it("importGraph is idempotent and never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importGraph({
      plans: [plan("p1")],
      plannedSessions: [planned("s1", "p1", []), planned("s-ghost", "no-plan", [])],
      workoutSessions: [workout("w1", "p1"), workout("w2", "ghost")],
      checkins: [checkin("c1")],
    });
    expect(r1.ran).toBe(true);
    expect(r1.plannedSessionsImported).toBe(1); // s-ghost dropped
    expect(r1.workoutSessionsImported).toBe(2); // w2 kept, planId nulled

    await repo.planUpsert({ ...plan("p1"), title: "EDITED" });
    const r2 = await repo.importGraph({
      plans: [plan("p1")],
      plannedSessions: [],
      workoutSessions: [],
      checkins: [],
    });
    expect(r2.ran).toBe(false);
    expect((await repo.load()).plans[0].title).toBe("EDITED");
  });
});
