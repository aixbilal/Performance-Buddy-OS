/**
 * Canonical persistence for the Settings config (Batch 7).
 *
 *   store.tsx  ->  SettingsRepo  ->  { setup_* Tauri commands -> Rust -> SQLite }
 *                               \->  { localStorage JSON }  (browser dev only)
 *
 * ONE row (`settings_config`). The EFFECTIVE value is derived by the engine at
 * read time and is never persisted.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { DEFAULT_SETTINGS, type SettingsConfig } from "./types";

export interface SettingsRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<SettingsConfig | null>;
  save(config: SettingsConfig): Promise<void>;
}

type WireRow = {
  baseConfig: string;
  mode: string;
  temporaryOverrides: string;
  notifications: string;
  appearance: string;
  createdAt: string;
  updatedAt: string;
};

function fromWire(w: WireRow): SettingsConfig {
  const j = <T,>(s: string, fb: T): T => {
    try {
      return { ...fb, ...(JSON.parse(s) as object) } as T;
    } catch {
      return fb;
    }
  };
  const arr = (s: string): SettingsConfig["temporaryOverrides"] => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  return {
    baseConfig: j(w.baseConfig, DEFAULT_SETTINGS.baseConfig),
    mode: (w.mode as SettingsConfig["mode"]) || "normal",
    temporaryOverrides: arr(w.temporaryOverrides),
    notifications: j(w.notifications, DEFAULT_SETTINGS.notifications),
    appearance: j(w.appearance, DEFAULT_SETTINGS.appearance),
  };
}

class SqliteRepo implements SettingsRepo {
  readonly kind = "sqlite" as const;
  async load(): Promise<SettingsConfig | null> {
    const g = await invoke<{ settings: WireRow | null }>("setup_load");
    return g.settings ? fromWire(g.settings) : null;
  }
  async save(config: SettingsConfig) {
    const now = new Date().toISOString();
    await invoke("setup_settings_upsert", {
      settings: {
        baseConfig: JSON.stringify(config.baseConfig),
        mode: config.mode,
        temporaryOverrides: JSON.stringify(config.temporaryOverrides),
        notifications: JSON.stringify(config.notifications),
        appearance: JSON.stringify(config.appearance),
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

const K = "pbos:settings-config-v1";

export class LocalRepo implements SettingsRepo {
  readonly kind = "localStorage" as const;
  async load(): Promise<SettingsConfig | null> {
    try {
      const raw = window.localStorage.getItem(K);
      if (!raw) return null;
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as SettingsConfig) };
    } catch {
      return null;
    }
  }
  async save(config: SettingsConfig) {
    window.localStorage.setItem(K, JSON.stringify(config));
  }
}

export function makeSettingsRepo(): SettingsRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
