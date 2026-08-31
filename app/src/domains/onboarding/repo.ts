/**
 * Canonical persistence for the first-run onboarding state (Batch 7).
 *
 *   store.tsx  ->  OnboardingRepo  ->  { setup_* Tauri commands -> Rust -> SQLite }
 *                                 \->  { localStorage JSON }  (browser dev only)
 *
 * ONE row (`onboarding_state`). `resetOnboarding` clears only this row — never
 * any domain data.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { PersistedOnboarding } from "./types";

const DEFAULT_PERSONAL_SETUP: PersistedOnboarding["personalSetup"] = {
  name: "",
  timezone: "Asia/Karachi",
  weekStart: "monday",
  sleepTargetHours: 8,
  weekdayCapacityMinutes: 90,
  defaultMode: "normal",
  priorities: [],
};

export type OnboardingLoad = {
  onboarding: PersistedOnboarding | null;
  existingUserMarker: boolean;
};

export interface OnboardingRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<OnboardingLoad>;
  save(o: PersistedOnboarding): Promise<void>;
  reset(): Promise<void>;
}

type WireRow = {
  status: string;
  currentStep: string;
  firstBootExperienceSeen: boolean;
  flowVersion: number;
  personalSetup: string;
  systemChoices: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseObj<T>(s: string, fb: T): T {
  try {
    return { ...fb, ...(JSON.parse(s) as object) } as T;
  } catch {
    return fb;
  }
}

function fromWire(w: WireRow): PersistedOnboarding {
  return {
    status: w.status as PersistedOnboarding["status"],
    currentStep: w.currentStep as PersistedOnboarding["currentStep"],
    firstBootExperienceSeen: !!w.firstBootExperienceSeen,
    flowVersion: w.flowVersion ?? 1,
    personalSetup: parseObj(w.personalSetup, DEFAULT_PERSONAL_SETUP),
    systemChoices: parseObj(w.systemChoices, { obsidian: "not-set", ai: "not-set" }),
    startedAt: w.startedAt,
    completedAt: w.completedAt,
  };
}

class SqliteRepo implements OnboardingRepo {
  readonly kind = "sqlite" as const;
  async load(): Promise<OnboardingLoad> {
    const g = await invoke<{ onboarding: WireRow | null; existingUserMarker: boolean }>("setup_load");
    return {
      onboarding: g.onboarding ? fromWire(g.onboarding) : null,
      existingUserMarker: !!g.existingUserMarker,
    };
  }
  async save(o: PersistedOnboarding) {
    const now = new Date().toISOString();
    await invoke("setup_onboarding_upsert", {
      onboarding: {
        status: o.status,
        currentStep: o.currentStep,
        firstBootExperienceSeen: o.firstBootExperienceSeen,
        flowVersion: o.flowVersion,
        personalSetup: JSON.stringify(o.personalSetup),
        systemChoices: JSON.stringify(o.systemChoices),
        startedAt: o.startedAt,
        completedAt: o.completedAt,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  async reset() {
    await invoke("setup_reset_onboarding");
  }
}

const K = "pbos:onboarding-state-v1";

export class LocalRepo implements OnboardingRepo {
  readonly kind = "localStorage" as const;
  async load(): Promise<OnboardingLoad> {
    // In the browser there is no migrated-user marker.
    try {
      const raw = window.localStorage.getItem(K);
      return { onboarding: raw ? (JSON.parse(raw) as PersistedOnboarding) : null, existingUserMarker: false };
    } catch {
      return { onboarding: null, existingUserMarker: false };
    }
  }
  async save(o: PersistedOnboarding) {
    window.localStorage.setItem(K, JSON.stringify(o));
  }
  async reset() {
    window.localStorage.removeItem(K);
  }
}

export function makeOnboardingRepo(): OnboardingRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
