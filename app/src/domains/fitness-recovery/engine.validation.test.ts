import { describe, it, expect } from "vitest";
import {
  buildPrescription,
  validateCheckInInput,
  validateExercisePrescription,
  validatePlanInput,
  validatePlannedSessionInput,
} from "./engine";
import type { PlannedSession } from "./types";

describe("validatePlanInput", () => {
  const base = { title: "Weekly", status: "active" as const, currentWeek: 1, totalWeeks: 8, daysPerWeek: 3 };
  it("accepts a well-formed plan", () => {
    expect(validatePlanInput(base).ok).toBe(true);
  });
  it("rejects empty title / bad status", () => {
    expect(validatePlanInput({ ...base, title: "  " }).ok).toBe(false);
    expect(validatePlanInput({ ...base, status: "x" as never }).ok).toBe(false);
  });
  it("rejects out-of-range weeks / days", () => {
    expect(validatePlanInput({ ...base, daysPerWeek: 0 }).ok).toBe(false);
    expect(validatePlanInput({ ...base, daysPerWeek: 8 }).ok).toBe(false);
    expect(validatePlanInput({ ...base, totalWeeks: 0 }).ok).toBe(false);
  });
  it("rejects currentWeek past totalWeeks", () => {
    expect(validatePlanInput({ ...base, currentWeek: 9, totalWeeks: 8 }).ok).toBe(false);
  });
});

describe("validateExercisePrescription / validatePlannedSessionInput", () => {
  it("requires a name, 1–50 sets, and a target", () => {
    expect(validateExercisePrescription({ name: "", sets: 3, reps: "10" }).ok).toBe(false);
    expect(validateExercisePrescription({ name: "Push-ups", sets: 0, reps: "10" }).ok).toBe(false);
    expect(validateExercisePrescription({ name: "Push-ups", sets: 3, reps: " " }).ok).toBe(false);
    expect(validateExercisePrescription({ name: "Push-ups", sets: 3, reps: "8-12" }).ok).toBe(true);
  });
  it("validates a planned session and its exercises together", () => {
    const ok = validatePlannedSessionInput({
      title: "Upper",
      dayOfWeek: 0,
      exercises: [{ name: "Push-ups", sets: 3, reps: "15" }],
    });
    expect(ok.ok).toBe(true);
    const bad = validatePlannedSessionInput({
      title: "Upper",
      dayOfWeek: 0,
      exercises: [{ name: "", sets: 3, reps: "15" }],
    });
    expect(bad.ok).toBe(false);
    expect(validatePlannedSessionInput({ title: " ", dayOfWeek: 0, exercises: [] }).ok).toBe(false);
    expect(validatePlannedSessionInput({ title: "x", dayOfWeek: 9, exercises: [] }).ok).toBe(false);
  });
});

describe("validateCheckInInput — no data ≠ 0 readiness, but inputs are still bounded", () => {
  const base = {
    date: "2026-08-01",
    sleepHours: 7.5,
    soreness: "none" as const,
    energy: "high" as const,
    motivation: "high" as const,
    stressLevel: "low" as const,
  };
  it("accepts valid subjective inputs", () => {
    expect(validateCheckInInput(base).ok).toBe(true);
  });
  it("rejects sleep outside 0–24 and bad levels", () => {
    expect(validateCheckInInput({ ...base, sleepHours: 30 }).ok).toBe(false);
    expect(validateCheckInInput({ ...base, sleepHours: -1 }).ok).toBe(false);
    expect(validateCheckInInput({ ...base, energy: "maximum" as never }).ok).toBe(false);
    expect(validateCheckInInput({ ...base, soreness: "extreme" as never }).ok).toBe(false);
  });
});

describe("buildPrescription — the BASE PLAN is never mutated by an adjustment", () => {
  const plan: PlannedSession = {
    id: "s1",
    planId: "p1",
    dayOfWeek: 2,
    title: "Easy Run",
    exercises: [{ name: "Run", sets: 1, reps: "3.5 km" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  it("an override prescription leaves the plan's exercises byte-for-byte unchanged", () => {
    const snap = JSON.stringify(plan.exercises);
    const p = buildPrescription(plan, "2026-08-27", [{ name: "Run", sets: 1, reps: "2.5 km easy" }], "reduced-load");
    expect(p.modified).toBe(true);
    expect(p.exercises).toEqual([{ name: "Run", sets: 1, reps: "2.5 km easy" }]);
    expect(JSON.stringify(plan.exercises)).toBe(snap);
  });
});
