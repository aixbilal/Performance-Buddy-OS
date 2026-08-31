/**
 * Deterministic Settings Engine. Configuration precedence is pure
 * arithmetic — no AI is ever involved in computing an effective value.
 */

import type {
  BaseConfig,
  EffectiveConfig,
  ModeOverride,
  OperatingMode,
  ResetScope,
  ResetScopeResult,
  SettingsConfig,
  TemporaryOverride,
} from "./types";
import { MODE_WEEKDAY_DELTA } from "./types";

/**
 * §5: Base → Mode → Temporary → Effective. Matches the handoff's own
 * worked example exactly: 90 (base) + 45 (midterm mode) + 15 (temporary,
 * not expired) = 150 minutes (2h30). Expired temporary overrides are
 * excluded — the effective value falls back correctly once they lapse.
 * The base value passed in is never mutated; this always returns a new number.
 */
export function computeEffectiveWeekdayCapacity(
  base: BaseConfig,
  modeOverride: ModeOverride | null,
  temporaryOverrides: TemporaryOverride[],
  now: Date = new Date()
): number {
  const modeDelta = modeOverride?.weekdayAcademicDeltaMinutes ?? 0;
  const activeTempDelta = temporaryOverrides
    .filter((t) => new Date(t.expiresAt) > now)
    .reduce((s, t) => s + t.weekdayAcademicDeltaMinutes, 0);

  return base.weekdayAcademicCapacityMinutes + modeDelta + activeTempDelta;
}

/** The delta a mode applies — a pure lookup, never a write to the baseline. */
export function modeDeltaFor(mode: OperatingMode): number {
  return MODE_WEEKDAY_DELTA[mode] ?? 0;
}

/** True when the override is still in effect at `now`. */
export function isTemporaryOverrideActive(o: TemporaryOverride, now: Date = new Date()): boolean {
  const t = new Date(o.expiresAt).getTime();
  return !Number.isNaN(t) && t > now.getTime();
}

/**
 * §5/§6 — Base → Mode → Temporary → Effective, deterministic, with an explicit
 * precedence trace. `temporary > mode > base`, but:
 *   - computing the effective value NEVER mutates base / mode / overrides;
 *   - an expired temporary override drops out automatically;
 *   - with no mode and no active override, effective === base.
 */
export function resolveEffectiveConfig(
  config: SettingsConfig,
  now: Date = new Date(),
): EffectiveConfig {
  const base = config.baseConfig.weekdayAcademicCapacityMinutes;
  const modeDelta = modeDeltaFor(config.mode);
  const activeTemporaryOverrides = config.temporaryOverrides.filter((o) =>
    isTemporaryOverrideActive(o, now),
  );
  const temporaryDelta = activeTemporaryOverrides.reduce(
    (s, o) => s + o.weekdayAcademicDeltaMinutes,
    0,
  );
  return {
    weekdayAcademicCapacityMinutes: base + modeDelta + temporaryDelta,
    protectedSleepHours: config.baseConfig.protectedSleepHours,
    precedence: { base, modeDelta, temporaryDelta, activeTemporaryOverrides },
  };
}

const INTERFACE_SCOPE_FIELDS = ["notifications", "appearance", "sidebarState", "windowState", "startupDestination"];
const NEVER_RESET_BY_INTERFACE = [
  "academicRecords",
  "goals",
  "actions",
  "routines",
  "schedule",
  "aiPermissions",
  "userDatabase",
];

/**
 * §19: "Restore Interface Defaults must reset interface/notification/app
 * behavior configuration only. It must NOT delete academic records, Goals,
 * Actions, routines, schedule, AI permissions... or user database." This
 * function makes that boundary a real, checkable list rather than a promise
 * — a test asserts none of the protected fields ever appear in an
 * "interface" scope's `affects` list.
 */
export function resolveResetScope(scope: ResetScope): ResetScopeResult {
  if (scope === "interface") {
    return { scope, affects: [...INTERFACE_SCOPE_FIELDS], neverAffects: [...NEVER_RESET_BY_INTERFACE] };
  }
  // "full" reset is intentionally not implemented with real destructive
  // behavior in this build — see DAY-14 notes. Returning an explicit,
  // clearly-labeled scope rather than silently doing nothing.
  return { scope, affects: [...INTERFACE_SCOPE_FIELDS, ...NEVER_RESET_BY_INTERFACE], neverAffects: [] };
}
