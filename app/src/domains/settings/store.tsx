/**
 * Settings store — the ONE canonical home of BASE config + active mode +
 * temporary overrides + notification/appearance preferences.
 *
 * - Persistence is relational SQLite via `SettingsRepo` (Batch 7); the browser
 *   dev fallback is a single localStorage row. There is no competing
 *   `usePersistedState` copy any more.
 * - EFFECTIVE config is DERIVED here by the engine (`resolveEffectiveConfig`),
 *   never stored. Changing a temporary override never touches mode or base;
 *   changing mode never touches base.
 * - Settings CONFIGURES canonical domains. It does not hold planning capacity,
 *   AI permissions, or the Obsidian vault path — those live in their own stores
 *   and Settings links out to them.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cacheAdapter } from "../persistence/cache";
import type { SaveState } from "../resilience/types";
import { resolveEffectiveConfig, resolveResetScope } from "./engine";
import { makeSettingsRepo, type SettingsRepo } from "./repo";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_SETTINGS,
  type AppearanceSettings,
  type BaseConfig,
  type EffectiveConfig,
  type NotificationCategory,
  type NotificationSettings,
  type OperatingMode,
  type SettingsConfig,
  type TemporaryOverride,
} from "./types";

type SettingsContextValue = {
  loaded: boolean;
  backend: "sqlite" | "localStorage";
  saveState: SaveState;

  config: SettingsConfig;
  baseConfig: BaseConfig;
  setBaseConfig: (patch: Partial<BaseConfig>) => void;

  mode: OperatingMode;
  setMode: (m: OperatingMode) => void;
  /** One atomic write used by onboarding — base capacity + sleep + starting mode. */
  applyOnboardingBaseline: (input: {
    weekdayAcademicCapacityMinutes: number;
    protectedSleepHours: number;
    mode: OperatingMode;
  }) => void;

  temporaryOverrides: TemporaryOverride[];
  addTemporaryOverride: (o: Omit<TemporaryOverride, "id">) => void;
  clearTemporaryOverride: (id: string) => void;
  clearAllTemporaryOverrides: () => void;

  effectiveConfig: EffectiveConfig;
  /** back-compat number used across the app. */
  effectiveWeekdayCapacity: number;

  notifications: NotificationSettings;
  toggleCategory: (c: NotificationCategory) => void;
  setMasterNotifications: (v: boolean) => void;

  appearance: AppearanceSettings;
  setReducedMotion: (v: boolean) => void;
  setDensity: (d: AppearanceSettings["density"]) => void;

  restoreInterfaceDefaults: () => void;
  lastResetResult: ReturnType<typeof resolveResetScope> | null;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);
const rid = () => `temp_${Math.random().toString(36).slice(2, 10)}`;

/** One-time import of the pre-Batch-7 `usePersistedState` keys. */
function importLegacy(): Partial<SettingsConfig> {
  const read = <T,>(key: string): T | undefined => {
    try {
      const raw = cacheAdapter.getItem(`pbos:${key}`);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  };
  const out: Partial<SettingsConfig> = {};
  const mode = read<OperatingMode>("settings-mode");
  if (mode) out.mode = mode;
  const temps = read<TemporaryOverride[]>("settings-temporary-overrides");
  if (Array.isArray(temps)) out.temporaryOverrides = temps;
  const notif = read<NotificationSettings>("settings-notifications");
  if (notif) out.notifications = notif;
  const appr = read<AppearanceSettings>("settings-appearance");
  if (appr) out.appearance = appr;
  return out;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<SettingsRepo>(makeSettingsRepo());
  const [config, setConfig] = useState<SettingsConfig>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastResetResult, setLastResetResult] =
    useState<ReturnType<typeof resolveResetScope> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await repoRef.current.load();
        if (cancelled) return;
        if (stored) {
          setConfig(stored);
        } else {
          const legacy = importLegacy();
          const merged = { ...DEFAULT_SETTINGS, ...legacy };
          setConfig(merged);
          if (Object.keys(legacy).length > 0) {
            void repoRef.current.save(merged);
          }
        }
      } catch {
        /* keep defaults — deterministic core still works */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function commit(next: SettingsConfig) {
    setConfig(next);
    setSaveState("saving");
    repoRef.current
      .save(next)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("failed")); // failure preserves the in-memory value
  }

  const setBaseConfig = (patch: Partial<BaseConfig>) =>
    commit({ ...config, baseConfig: { ...config.baseConfig, ...patch } });

  // mode change never touches base or overrides
  const setMode = (mode: OperatingMode) => commit({ ...config, mode });

  const applyOnboardingBaseline = (input: {
    weekdayAcademicCapacityMinutes: number;
    protectedSleepHours: number;
    mode: OperatingMode;
  }) =>
    commit({
      ...config,
      baseConfig: {
        ...config.baseConfig,
        weekdayAcademicCapacityMinutes: input.weekdayAcademicCapacityMinutes,
        protectedSleepHours: input.protectedSleepHours,
      },
      mode: input.mode,
    });

  const addTemporaryOverride = (o: Omit<TemporaryOverride, "id">) =>
    commit({ ...config, temporaryOverrides: [...config.temporaryOverrides, { ...o, id: rid() }] });
  const clearTemporaryOverride = (id: string) =>
    commit({ ...config, temporaryOverrides: config.temporaryOverrides.filter((t) => t.id !== id) });
  const clearAllTemporaryOverrides = () => commit({ ...config, temporaryOverrides: [] });

  const toggleCategory = (c: NotificationCategory) =>
    commit({
      ...config,
      notifications: {
        ...config.notifications,
        categories: { ...config.notifications.categories, [c]: !config.notifications.categories[c] },
      },
    });
  const setMasterNotifications = (v: boolean) =>
    commit({ ...config, notifications: { ...config.notifications, masterEnabled: v } });

  const setReducedMotion = (v: boolean) =>
    commit({ ...config, appearance: { ...config.appearance, reducedMotion: v } });
  const setDensity = (d: AppearanceSettings["density"]) =>
    commit({ ...config, appearance: { ...config.appearance, density: d } });

  const restoreInterfaceDefaults = () => {
    const result = resolveResetScope("interface");
    // interface scope only — mode, base config and temporary overrides are
    // planning/domain data and are deliberately left alone (§19).
    commit({
      ...config,
      notifications: DEFAULT_NOTIFICATIONS,
      appearance: DEFAULT_APPEARANCE,
    });
    setLastResetResult(result);
  };

  const effectiveConfig = useMemo(() => resolveEffectiveConfig(config), [config]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      loaded,
      backend: repoRef.current.kind,
      saveState,
      config,
      baseConfig: config.baseConfig,
      setBaseConfig,
      mode: config.mode,
      setMode,
      applyOnboardingBaseline,
      temporaryOverrides: config.temporaryOverrides,
      addTemporaryOverride,
      clearTemporaryOverride,
      clearAllTemporaryOverrides,
      effectiveConfig,
      effectiveWeekdayCapacity: effectiveConfig.weekdayAcademicCapacityMinutes,
      notifications: config.notifications,
      toggleCategory,
      setMasterNotifications,
      appearance: config.appearance,
      setReducedMotion,
      setDensity,
      restoreInterfaceDefaults,
      lastResetResult,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, saveState, config, effectiveConfig, lastResetResult],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
