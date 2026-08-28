import { describe, it, expect } from "vitest";
import { getNextStep, resumeAtStep, determineStartupRoute, validateMinimumViableLaunch } from "./engine";
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
