import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  AppearanceSettings,
  NotificationCategory,
  NotificationSettings,
  OperatingMode,
  TemporaryOverride,
} from "./types";
import { computeEffectiveWeekdayCapacity, resolveResetScope } from "./engine";
import { MODE_OVERRIDES, SEED_APPEARANCE, SEED_BASE_CONFIG, SEED_NOTIFICATIONS, SEED_TEMPORARY_OVERRIDES } from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";

type SettingsContextValue = {
  baseConfig: typeof SEED_BASE_CONFIG;
  mode: OperatingMode;
  setMode: (m: OperatingMode) => void;
  temporaryOverrides: TemporaryOverride[];
  addTemporaryOverride: (o: Omit<TemporaryOverride, "id">) => void;
  effectiveWeekdayCapacity: number;
  notifications: NotificationSettings;
  toggleCategory: (c: NotificationCategory) => void;
  appearance: AppearanceSettings;
  setReducedMotion: (v: boolean) => void;
  restoreInterfaceDefaults: () => void;
  lastResetResult: ReturnType<typeof resolveResetScope> | null;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [baseConfig] = useState(SEED_BASE_CONFIG);
  // Real persistence: operating mode, overrides, notifications, and
  // appearance (including Reduced Motion) now genuinely survive an app
  // restart — these are exactly the kind of user preference that should.
  const [mode, setMode] = usePersistedState<OperatingMode>("settings-mode", "normal");
  const [temporaryOverrides, setTemporaryOverrides] = usePersistedState<TemporaryOverride[]>(
    "settings-temporary-overrides",
    SEED_TEMPORARY_OVERRIDES
  );
  const [notifications, setNotifications] = usePersistedState<NotificationSettings>(
    "settings-notifications",
    SEED_NOTIFICATIONS
  );
  const [appearance, setAppearance] = usePersistedState<AppearanceSettings>("settings-appearance", SEED_APPEARANCE);
  // Transient UI feedback only — deliberately NOT persisted (it's meaningless after a restart).
  const [lastResetResult, setLastResetResult] = useState<ReturnType<typeof resolveResetScope> | null>(null);

  const effectiveWeekdayCapacity = computeEffectiveWeekdayCapacity(baseConfig, MODE_OVERRIDES[mode], temporaryOverrides);

  const addTemporaryOverride = (o: Omit<TemporaryOverride, "id">) => {
    setTemporaryOverrides([...temporaryOverrides, { ...o, id: `temp-${Date.now()}` }]);
  };

  const toggleCategory = (c: NotificationCategory) => {
    setNotifications({ ...notifications, categories: { ...notifications.categories, [c]: !notifications.categories[c] } });
  };

  const setReducedMotion = (v: boolean) => setAppearance({ ...appearance, reducedMotion: v });

  const restoreInterfaceDefaults = () => {
    const result = resolveResetScope("interface");
    setNotifications(SEED_NOTIFICATIONS);
    setAppearance(SEED_APPEARANCE);
    // Deliberately does NOT touch baseConfig, mode, or temporaryOverrides —
    // those are planning/domain data, outside interface scope, per §19.
    setLastResetResult(result);
  };

  const value = useMemo(
    () => ({
      baseConfig,
      mode,
      setMode,
      temporaryOverrides,
      addTemporaryOverride,
      effectiveWeekdayCapacity,
      notifications,
      toggleCategory,
      appearance,
      setReducedMotion,
      restoreInterfaceDefaults,
      lastResetResult,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseConfig, mode, temporaryOverrides, notifications, appearance, lastResetResult]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
