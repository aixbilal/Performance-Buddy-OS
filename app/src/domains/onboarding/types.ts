/**
 * Performance Buddy OS — Onboarding & Initial Setup domain model.
 *
 * Per Day 15A Handoff §22: onboarding state must be resumable — status,
 * current step, and any entered configuration persist so an interruption
 * resumes rather than restarts (§20, §22).
 *
 * Per §28: onboarding reuses the SAME domain services Settings/domain
 * screens use later — no onboarding-only Goal/Routine/Academic/AI-permission
 * engine exists anywhere in this file. "Connect Your Systems" reads real
 * state from each domain's own store (see store.tsx), never a duplicate model.
 */

export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped";
export type OnboardingStep = "welcome" | "personal-setup" | "connect-systems" | "review-launch";

export type OnboardingState = {
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  startedAt: string | null;
  completedAt: string | null;
};

/** Minimum useful baseline only — per §25, not a full configuration of every domain. */
export type PersonalSetupData = {
  name: string;
  timezone: string;
  weekStart: "monday" | "sunday";
  sleepTargetHours: number;
  weekdayCapacityMinutes: number;
  /** Priorities affect Planner/onboarding prominence only — they do NOT disable other domains (§26). */
  priorities: string[];
};

export type SystemConnectionState = "configured" | "partial" | "not-set-up" | "disabled-optional";

export type SystemConnectionStatus = {
  domain: string;
  state: SystemConnectionState;
  isOptional: boolean;
};

/** Only core failures may block launch (§38) — this type structurally cannot represent an optional blocker. */
export type LaunchCheck = { name: string; passed: boolean };
export type LaunchValidationResult = { canLaunch: boolean; blockers: string[] };

export type StartupRoute = "first-install-welcome" | "continue-setup" | "existing-data-choice" | "today";
