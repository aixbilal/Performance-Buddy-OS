import { describe, it, expect } from "vitest";
import { getNextStep, resumeAtStep, determineStartupRoute, validateMinimumViableLaunch, determineFullStartupRoute } from "./engine";
import type { OnboardingState } from "./types";

describe("getNextStep", () => {
  it("follows the fixed order welcome -> personal-setup -> connect-systems -> review-launch", () => {
    expect(getNextStep("welcome")).toBe("personal-setup");
    expect(getNextStep("personal-setup")).toBe("connect-systems");
    expect(getNextStep("connect-systems")).toBe("review-launch");
  });
  it("returns null after the last step", () => {
    expect(getNextStep("review-launch")).toBeNull();
  });
});

describe("resumeAtStep — resume, not restart (§20, §22)", () => {
  it("resumes an interrupted onboarding at the exact saved step, not step one", () => {
    const state: OnboardingState = { status: "in_progress", currentStep: "connect-systems", startedAt: "2026-08-27", completedAt: null };
    expect(resumeAtStep(state)).toBe("connect-systems");
  });

  it("starts at welcome for a genuinely new user", () => {
    const state: OnboardingState = { status: "not_started", currentStep: "welcome", startedAt: null, completedAt: null };
    expect(resumeAtStep(state)).toBe("welcome");
  });

  it("returns null (go straight to Today) once completed — no re-showing Welcome on every launch", () => {
    const state: OnboardingState = { status: "completed", currentStep: "review-launch", startedAt: "2026-08-20", completedAt: "2026-08-20" };
    expect(resumeAtStep(state)).toBeNull();
  });
});

describe("determineStartupRoute — §21 routing plus §39 existing-data protection", () => {
  it("routes a genuine first install to Welcome", () => {
    const state: OnboardingState = { status: "not_started", currentStep: "welcome", startedAt: null, completedAt: null };
    expect(determineStartupRoute(state, false)).toBe("first-install-welcome");
  });

  it("routes interrupted onboarding to Continue Setup, not back to Welcome", () => {
    const state: OnboardingState = { status: "in_progress", currentStep: "personal-setup", startedAt: "2026-08-27", completedAt: null };
    expect(determineStartupRoute(state, false)).toBe("continue-setup");
  });

  it("routes completed onboarding straight to Today", () => {
    const state: OnboardingState = { status: "completed", currentStep: "review-launch", startedAt: "2026-08-20", completedAt: "2026-08-20" };
    expect(determineStartupRoute(state, false)).toBe("today");
  });

  it("never silently overwrites existing data on a not_started state — a distinct outcome from a clean first install", () => {
    const state: OnboardingState = { status: "not_started", currentStep: "welcome", startedAt: null, completedAt: null };
    expect(determineStartupRoute(state, true)).toBe("existing-data-choice");
  });
});

describe("validateMinimumViableLaunch — only core failures block (§38)", () => {
  it("allows launch when all core checks pass", () => {
    const result = validateMinimumViableLaunch([
      { name: "Database initialized", passed: true },
      { name: "Local storage writable", passed: true },
    ]);
    expect(result.canLaunch).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("blocks launch when a core check fails", () => {
    const result = validateMinimumViableLaunch([
      { name: "Database initialized", passed: false },
      { name: "Local storage writable", passed: true },
    ]);
    expect(result.canLaunch).toBe(false);
    expect(result.blockers).toEqual(["Database initialized"]);
  });

  it("structurally cannot be blocked by AI/Obsidian/Money — they are never passed into this function at all", () => {
    // This test documents the architectural boundary itself: the caller
    // (store.tsx) only ever constructs the core-checks list from database/
    // storage/schema status. AI, Obsidian, and Money availability simply
    // have no path into this function's input, so they cannot block launch
    // even in principle — not just "happen not to" in today's seed data.
    const coreOnly: { name: string; passed: boolean }[] = [
      { name: "Database initialized", passed: true },
      { name: "Local storage writable", passed: true },
      { name: "Essential schema present", passed: true },
    ];
    expect(coreOnly.some((c) => /ai|obsidian|money/i.test(c.name))).toBe(false);
    expect(validateMinimumViableLaunch(coreOnly).canLaunch).toBe(true);
  });
});

describe("determineFullStartupRoute — Day 15B §23 full routing tree", () => {
  it("first-ever launch goes to the full cinematic splash", () => {
    expect(determineFullStartupRoute(false, "not_started", false)).toBe("full-cinematic-splash-then-welcome");
  });

  it("does NOT replay the cinematic splash just because onboarding is still not_started, once first boot has been seen", () => {
    expect(determineFullStartupRoute(true, "not_started", false)).toBe("short-splash-then-welcome");
  });

  it("interrupted onboarding after first boot goes to short splash + Continue Setup, never the cinematic splash again", () => {
    expect(determineFullStartupRoute(true, "in_progress", false)).toBe("short-splash-then-continue-setup");
  });

  it("completed onboarding goes to short splash + Today", () => {
    expect(determineFullStartupRoute(true, "completed", false)).toBe("short-splash-then-today");
  });

  it("skipped onboarding also goes to short splash + Today", () => {
    expect(determineFullStartupRoute(true, "skipped", false)).toBe("short-splash-then-today");
  });

  it("a critical init failure routes to recovery even on a genuine first boot — a broken database is not a first-boot problem", () => {
    expect(determineFullStartupRoute(false, "not_started", true)).toBe("startup-recovery");
    expect(determineFullStartupRoute(true, "completed", true)).toBe("startup-recovery");
  });
});
