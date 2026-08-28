/**
 * Performance Buddy OS — Settings & Preferences domain model.
 *
 * Per Day 14 Handoff §5, the defining architecture:
 *   Base Configuration → Mode Override → Temporary Override → Effective Configuration
 * "Never overwrite the baseline merely because a mode or temporary override
 * is active. When the override expires, effective configuration should
 * fall back correctly." — enforced in engine.ts, proven by tests using the
 * handoff's own worked example (90 base + 45 mode + 15 temp = 150).
 *
 * Per §3: Settings configure existing systems, never duplicate them —
 * Planner owns schedules, Settings owns planning constraints/preferences only.
 */

export type OperatingMode = "normal" | "midterm" | "final" | "recovery";

export type BaseConfig = {
  weekdayAcademicCapacityMinutes: number;
  weekendAcademicCapacityMinutes: number;
  developmentCapacityMinutes: number;
  languageBaselineMinutes: number;
  protectedSleepHours: number;
  planningBufferPercent: number;
};

/** A mode adds a delta on top of the baseline — it never replaces or edits the baseline itself. */
export type ModeOverride = {
  mode: OperatingMode;
  weekdayAcademicDeltaMinutes: number;
};

/** Always has an expiry — nothing here is a silent permanent change to the baseline. */
export type TemporaryOverride = {
  id: string;
  label: string;
  weekdayAcademicDeltaMinutes: number;
  expiresAt: string; // ISO date
};

export type NotificationCategory = "academics" | "planner" | "routines" | "fitness" | "reviews" | "ai";

export type NotificationSettings = {
  masterEnabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  focusSuppression: boolean;
};

export type AppearanceSettings = {
  density: "comfortable" | "compact";
  reducedMotion: boolean;
};

export type ResetScope = "interface" | "full";

/** What a given reset scope is allowed to touch — see engine.ts resolveResetScope. */
export type ResetScopeResult = {
  scope: ResetScope;
  affects: string[];
  neverAffects: string[];
};
