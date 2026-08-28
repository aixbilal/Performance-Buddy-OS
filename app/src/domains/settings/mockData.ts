import type { AppearanceSettings, BaseConfig, ModeOverride, NotificationSettings, OperatingMode, TemporaryOverride } from "./types";

export const SEED_BASE_CONFIG: BaseConfig = {
  weekdayAcademicCapacityMinutes: 90,
  weekendAcademicCapacityMinutes: 120,
  developmentCapacityMinutes: 120,
  languageBaselineMinutes: 30,
  protectedSleepHours: 8,
  planningBufferPercent: 10,
};

export const MODE_OVERRIDES: Record<OperatingMode, ModeOverride | null> = {
  normal: null,
  midterm: { mode: "midterm", weekdayAcademicDeltaMinutes: 45 },
  final: { mode: "final", weekdayAcademicDeltaMinutes: 90 },
  recovery: { mode: "recovery", weekdayAcademicDeltaMinutes: -30 },
};

export const SEED_TEMPORARY_OVERRIDES: TemporaryOverride[] = [];

export const SEED_NOTIFICATIONS: NotificationSettings = {
  masterEnabled: true,
  categories: { academics: true, planner: true, routines: true, fitness: true, reviews: true, ai: false },
  focusSuppression: true,
};

export const SEED_APPEARANCE: AppearanceSettings = {
  density: "comfortable",
  reducedMotion: false,
};
