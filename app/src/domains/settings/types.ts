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

// ---------------------------------------------------------------------------
// Batch 7 — the canonical persisted aggregate (mirrors settings_config)
// ---------------------------------------------------------------------------

export type SettingsConfig = {
  baseConfig: BaseConfig;
  /** The active operating mode. The one canonical mode truth for the app. */
  mode: OperatingMode;
  /** 0..n; each has its own expiry. Never a permanent baseline change. */
  temporaryOverrides: TemporaryOverride[];
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
};

/** The deterministically-derived value — computed at read time, never stored. */
export type EffectiveConfig = {
  weekdayAcademicCapacityMinutes: number;
  protectedSleepHours: number;
  /** A plain-language trace of how the effective number was reached. */
  precedence: {
    base: number;
    modeDelta: number;
    temporaryDelta: number;
    activeTemporaryOverrides: TemporaryOverride[];
  };
};

export const DEFAULT_BASE_CONFIG: BaseConfig = {
  weekdayAcademicCapacityMinutes: 90,
  weekendAcademicCapacityMinutes: 120,
  developmentCapacityMinutes: 120,
  languageBaselineMinutes: 30,
  protectedSleepHours: 8,
  planningBufferPercent: 10,
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  masterEnabled: true,
  categories: {
    academics: true,
    planner: true,
    routines: true,
    fitness: true,
    reviews: true,
    ai: false,
  },
  focusSuppression: true,
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  density: "comfortable",
  reducedMotion: false,
};

export const DEFAULT_SETTINGS: SettingsConfig = {
  baseConfig: DEFAULT_BASE_CONFIG,
  mode: "normal",
  temporaryOverrides: [],
  notifications: DEFAULT_NOTIFICATIONS,
  appearance: DEFAULT_APPEARANCE,
};

/** Mode → the delta it adds to the weekday academic baseline. Mode never edits the base. */
export const MODE_WEEKDAY_DELTA: Record<OperatingMode, number> = {
  normal: 0,
  midterm: 45,
  final: 90,
  recovery: -30,
};
