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
  const [mode, setMode] = useState<OperatingMode>("normal");
  const [temporaryOverrides, setTemporaryOverrides] = useState<TemporaryOverride[]>(SEED_TEMPORARY_OVERRIDES);
  const [notifications, setNotifications] = useState<NotificationSettings>(SEED_NOTIFICATIONS);
  const [appearance, setAppearance] = useState<AppearanceSettings>(SEED_APPEARANCE);
  const [lastResetResult, setLastResetResult] = useState<ReturnType<typeof resolveResetScope> | null>(null);

  const effectiveWeekdayCapacity = computeEffectiveWeekdayCapacity(baseConfig, MODE_OVERRIDES[mode], temporaryOverrides);

  const addTemporaryOverride = (o: Omit<TemporaryOverride, "id">) => {
    setTemporaryOverrides((prev) => [...prev, { ...o, id: `temp-${Date.now()}` }]);
  };

  const toggleCategory = (c: NotificationCategory) => {
    setNotifications((prev) => ({ ...prev, categories: { ...prev.categories, [c]: !prev.categories[c] } }));
  };

  const setReducedMotion = (v: boolean) => setAppearance((prev) => ({ ...prev, reducedMotion: v }));

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
