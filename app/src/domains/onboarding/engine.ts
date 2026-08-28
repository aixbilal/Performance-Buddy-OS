/**
 * Deterministic Onboarding Engine. Routing and launch-readiness decisions
 * are pure logic — no AI involvement anywhere in this file.
 */

import type { LaunchCheck, LaunchValidationResult, OnboardingState, OnboardingStep, StartupRoute } from "./types";

const STEP_ORDER: OnboardingStep[] = ["welcome", "personal-setup", "connect-systems", "review-launch"];

export function getNextStep(current: OnboardingStep): OnboardingStep | null {
  const idx = STEP_ORDER.indexOf(current);
  return idx >= 0 && idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : null;
}

/**
 * §20/§22: "If onboarding is interrupted: resume rather than restart."
 * Resumes at the SAVED step, not step one — proven by a test.
 */
export function resumeAtStep(state: OnboardingState): OnboardingStep | null {
  if (state.status === "completed" || state.status === "skipped") return null; // nothing to resume — go straight to Today
  if (state.status === "not_started") return "welcome";
  return state.currentStep; // in_progress — resume exactly where it left off
}

/**
 * §21: the three required routing outcomes, plus §39's "existing data
 * detected" case — starting fresh must be deliberate, never automatic,
 * so this is a DISTINCT outcome from a genuine first install, not folded
 * into it.
 */
export function determineStartupRoute(state: OnboardingState, hasExistingData: boolean): StartupRoute {
  if (state.status === "completed" || state.status === "skipped") return "today";
  if (state.status === "in_progress") return "continue-setup";
  // not_started from here on
  if (hasExistingData) return "existing-data-choice"; // §39 — never silently overwrite
  return "first-install-welcome";
}

/**
 * §38: core failures may block launch; optional failures never do. This
 * function's signature only accepts `LaunchCheck[]` for CORE requirements —
 * there is no parameter for "optional checks" at all, so an optional
 * failure structurally cannot reach this function's blocking logic. The
 * caller (store.tsx) is responsible for never passing AI/Obsidian/Money
 * availability in here — see the test that documents this boundary.
 */
export function validateMinimumViableLaunch(coreChecks: LaunchCheck[]): LaunchValidationResult {
  const blockers = coreChecks.filter((c) => !c.passed).map((c) => c.name);
  return { canLaunch: blockers.length === 0, blockers };
}
