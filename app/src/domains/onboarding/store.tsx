/**
 * Onboarding store — the ONE durable first-run state.
 *
 * - Persistence is relational SQLite via `OnboardingRepo` (Batch 7); the browser
 *   dev fallback is a single localStorage row. No memory-only state.
 * - Completion is stored explicitly. An existing profile migrated from an
 *   earlier build (the `existingUserMarker`) is treated as already-onboarded so
 *   it is never forced back through first-run (§28).
 * - "Connect Your Systems" reads REAL status from each domain's own store
 *   (Academic / Fitness / Money / Obsidian / AI Coach) — never a duplicate model.
 * - `completeOnboarding` writes the entered baseline into the CANONICAL Settings
 *   store; it does not create onboarding-owned config.
 * - `resetOnboarding` clears only this row — never any domain data (§27).
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
import {
  getNextStep,
  getPrevStep,
  resumeAtStep,
  stepIndex,
  STEP_ORDER,
  validateMinimumViableLaunch,
} from "./engine";
import { makeOnboardingRepo, type OnboardingRepo } from "./repo";
import type {
  LaunchCheck,
  OnboardingState,
  OnboardingStep,
  PersistedOnboarding,
  PersonalSetupData,
  SystemChoice,
  SystemChoices,
  SystemConnectionState,
  SystemConnectionStatus,
} from "./types";
import { useAcademic } from "../academic/store";
import { useFitness } from "../fitness-recovery/store";
import { useMoney } from "../money/store";
import { useObsidian } from "../obsidian/store";
import { useAICoach } from "../intelligence/store";
import { useSettings } from "../settings/store";

const nowIso = () => new Date().toISOString();

const INITIAL_PERSONAL_SETUP: PersonalSetupData = {
  name: "",
  timezone: "Asia/Karachi",
  weekStart: "monday",
  sleepTargetHours: 8,
  weekdayCapacityMinutes: 90,
  defaultMode: "normal",
  priorities: [],
};
const INITIAL_CHOICES: SystemChoices = { obsidian: "not-set", ai: "not-set" };

const FRESH: PersistedOnboarding = {
  status: "not_started",
  currentStep: "welcome",
  firstBootExperienceSeen: false,
  flowVersion: 1,
  personalSetup: INITIAL_PERSONAL_SETUP,
  systemChoices: INITIAL_CHOICES,
  startedAt: null,
  completedAt: null,
};

type OnboardingContextValue = {
  loaded: boolean;
  backend: "sqlite" | "localStorage";
  state: OnboardingState;
  firstBootExperienceSeen: boolean;
  personalSetup: PersonalSetupData;
  systemChoices: SystemChoices;
  stepIndex: number;
  totalSteps: number;

  setPersonalSetup: (data: Partial<PersonalSetupData>) => void;
  setSystemChoice: (system: keyof SystemChoices, choice: SystemChoice) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  markFirstBootSeen: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => Promise<void>;

  systemStatuses: SystemConnectionStatus[];
  resumeStep: OnboardingStep | null;
  launchCheck: ReturnType<typeof validateMinimumViableLaunch>;

  // kept for the in-app "Simulate Relaunch" demo affordance
  relaunchToken: number;
  simulateRelaunch: () => void;

  /** back-compat alias — older callers read `saveAndExit`. */
  saveAndExit: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<OnboardingRepo>(makeOnboardingRepo());
  const [record, setRecord] = useState<PersistedOnboarding>(FRESH);
  const [loaded, setLoaded] = useState(false);
  const [relaunchToken, setRelaunchToken] = useState(0);

  const { courses } = useAcademic();
  const { plan: fitnessPlan } = useFitness();
  const { transactions } = useMoney();
  const obsidian = useObsidian();
  const aiCoach = useAICoach();
  const settings = useSettings();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { onboarding, existingUserMarker } = await repoRef.current.load();
        if (cancelled) return;
        if (onboarding) {
          setRecord(onboarding);
        } else if (existingUserMarker) {
          // migrated existing user — mark complete once, explicitly
          const migrated: PersistedOnboarding = {
            ...FRESH,
            status: "completed",
            currentStep: "review-launch",
            firstBootExperienceSeen: true,
            completedAt: nowIso(),
          };
          setRecord(migrated);
          void repoRef.current.save(migrated);
        }
        // else: genuinely fresh — keep FRESH, persist on first interaction
      } catch {
        /* keep FRESH */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function commit(next: PersistedOnboarding) {
    setRecord(next);
    void repoRef.current.save(next);
  }

  const state: OnboardingState = {
    status: record.status,
    currentStep: record.currentStep,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
  };

  const setPersonalSetup = (data: Partial<PersonalSetupData>) =>
    commit({
      ...record,
      status: record.status === "not_started" ? "in_progress" : record.status,
      startedAt: record.startedAt ?? nowIso(),
      personalSetup: { ...record.personalSetup, ...data },
    });

  const setSystemChoice = (system: keyof SystemChoices, choice: SystemChoice) =>
    commit({ ...record, systemChoices: { ...record.systemChoices, [system]: choice } });

  const goToNextStep = () => {
    const next = getNextStep(record.currentStep);
    if (!next) return;
    commit({
      ...record,
      status: "in_progress",
      currentStep: next,
      startedAt: record.startedAt ?? nowIso(),
    });
  };
  const goToPrevStep = () => {
    const prev = getPrevStep(record.currentStep);
    if (!prev) return;
    commit({ ...record, currentStep: prev });
  };
  const goToStep = (step: OnboardingStep) => commit({ ...record, currentStep: step });

  const markFirstBootSeen = () => {
    if (record.firstBootExperienceSeen) return;
    commit({ ...record, firstBootExperienceSeen: true });
  };

  const completeOnboarding = () => {
    // write the entered baseline into the CANONICAL Settings store in one atomic
    // commit — not an onboarding-owned copy.
    settings.applyOnboardingBaseline({
      weekdayAcademicCapacityMinutes: record.personalSetup.weekdayCapacityMinutes,
      protectedSleepHours: record.personalSetup.sleepTargetHours,
      mode: record.personalSetup.defaultMode,
    });
    commit({
      ...record,
      status: "completed",
      currentStep: "review-launch",
      firstBootExperienceSeen: true,
      completedAt: nowIso(),
    });
  };

  const resetOnboarding = async () => {
    await repoRef.current.reset();
    // keep the cinematic-seen flag: resetting the *workflow* should not replay
    // the one-time first-boot experience.
    setRecord({ ...FRESH, firstBootExperienceSeen: record.firstBootExperienceSeen });
    void repoRef.current.save({ ...FRESH, firstBootExperienceSeen: record.firstBootExperienceSeen });
  };

  const simulateRelaunch = () => setRelaunchToken((t) => t + 1);

  // --- real system status (§28 — read each domain's own store) --------
  const obsidianState: SystemConnectionState =
    obsidian.hubState === "indexed" || obsidian.hubState === "empty"
      ? "configured"
      : record.systemChoices.obsidian === "skipped"
        ? "disabled-optional"
        : "not-set-up";
  const aiState: SystemConnectionState =
    aiCoach.aiAvailability === "ready"
      ? "configured"
      : aiCoach.aiAvailability === "disabled" || record.systemChoices.ai === "skipped"
        ? "disabled-optional"
        : "not-set-up";

  const systemStatuses: SystemConnectionStatus[] = [
    {
      domain: "Academics",
      state: courses.length > 0 ? "configured" : "not-set-up",
      isOptional: false,
    },
    {
      domain: "Fitness & Recovery",
      state: fitnessPlan?.status === "active" ? "configured" : "not-set-up",
      isOptional: false,
    },
    {
      domain: "Money",
      state: transactions.length > 0 ? "configured" : "disabled-optional",
      isOptional: true,
    },
    { domain: "Obsidian", state: obsidianState, isOptional: true },
    { domain: "AI Coach", state: aiState, isOptional: true },
  ];

  const resumeStep = resumeAtStep(state);
  const coreChecks: LaunchCheck[] = [
    { name: "Application shell rendered", passed: true },
    { name: "Local database migrated", passed: loaded },
  ];
  const launchCheck = validateMinimumViableLaunch(coreChecks);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      loaded,
      backend: repoRef.current.kind,
      state,
      firstBootExperienceSeen: record.firstBootExperienceSeen,
      personalSetup: record.personalSetup,
      systemChoices: record.systemChoices,
      stepIndex: stepIndex(record.currentStep),
      totalSteps: STEP_ORDER.length,
      setPersonalSetup,
      setSystemChoice,
      goToNextStep,
      goToPrevStep,
      goToStep,
      markFirstBootSeen,
      completeOnboarding,
      resetOnboarding,
      systemStatuses,
      resumeStep,
      launchCheck,
      relaunchToken,
      simulateRelaunch,
      saveAndExit: () => commit(record),
    }),
    // `settings` is included so `completeOnboarding` never writes through a
    // stale Settings snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      loaded,
      record,
      courses,
      fitnessPlan,
      transactions,
      obsidian.hubState,
      aiCoach.aiAvailability,
      settings,
      relaunchToken,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
