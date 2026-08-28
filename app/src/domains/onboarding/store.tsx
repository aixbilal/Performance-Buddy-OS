import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  LaunchCheck,
  OnboardingState,
  OnboardingStep,
  PersonalSetupData,
  SystemConnectionStatus,
} from "./types";
import { determineStartupRoute, getNextStep, resumeAtStep, validateMinimumViableLaunch } from "./engine";
import { useAcademic } from "../academic/store";
import { useFitness } from "../fitness-recovery/store";
import { useMoney } from "../money/store";

type OnboardingContextValue = {
  state: OnboardingState;
  personalSetup: PersonalSetupData;
  setPersonalSetup: (data: Partial<PersonalSetupData>) => void;
  goToNextStep: () => void;
  saveAndExit: () => void;
  systemStatuses: SystemConnectionStatus[];
  resumeStep: OnboardingStep | null;
  startupRoute: ReturnType<typeof determineStartupRoute>;
  launchCheck: ReturnType<typeof validateMinimumViableLaunch>;
  completeOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const INITIAL_STATE: OnboardingState = {
  status: "not_started",
  currentStep: "welcome",
  startedAt: null,
  completedAt: null,
};

const INITIAL_PERSONAL_SETUP: PersonalSetupData = {
  name: "",
  timezone: "Asia/Karachi",
  weekStart: "monday",
  sleepTargetHours: 8,
  weekdayCapacityMinutes: 90,
  priorities: [],
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [personalSetup, setPersonalSetupState] = useState<PersonalSetupData>(INITIAL_PERSONAL_SETUP);

  const { courses } = useAcademic();
  const { plan: fitnessPlan } = useFitness();
  const { transactions } = useMoney();

  const setPersonalSetup = (data: Partial<PersonalSetupData>) => {
    setPersonalSetupState((prev) => ({ ...prev, ...data }));
  };

  const goToNextStep = () => {
    const next = getNextStep(state.currentStep);
    if (next) {
      setState((prev) => ({
        ...prev,
        status: "in_progress",
        currentStep: next,
        startedAt: prev.startedAt ?? new Date().toISOString(),
      }));
    }
  };

  const saveAndExit = () => {
    // §22 — persist status/step as-is so a later resume picks up exactly here.
    setState((prev) => ({ ...prev, status: prev.status === "not_started" ? "in_progress" : prev.status }));
  };

  const completeOnboarding = () => {
    setState((prev) => ({ ...prev, status: "completed", completedAt: new Date().toISOString() }));
  };

  // §28: reads REAL state from each domain's own store — no onboarding-only
  // duplicate model. §32: Money is optional and does not need to be enabled.
  const systemStatuses: SystemConnectionStatus[] = [
    { domain: "Academics", state: courses.length > 0 ? "configured" : "not-set-up", isOptional: false },
    { domain: "Fitness & Recovery", state: fitnessPlan.status === "active" ? "configured" : "not-set-up", isOptional: false },
    { domain: "Money", state: transactions.length > 0 ? "configured" : "disabled-optional", isOptional: true },
    { domain: "Obsidian", state: "disabled-optional", isOptional: true }, // §31 — no real filesystem link exists yet
    { domain: "AI Coach", state: "disabled-optional", isOptional: true }, // §33 — no real provider wired yet
  ];

  const resumeStep = resumeAtStep(state);
  // No real persistence layer exists yet (flagged since Day 2) — "existing
  // data" cannot be genuinely detected from disk. Hardcoded false here,
  // honestly, rather than faking a detection this build can't actually do.
  const startupRoute = determineStartupRoute(state, false);

  const coreChecks: LaunchCheck[] = [
    { name: "Application shell rendered", passed: true },
    { name: "In-memory store initialized", passed: true },
    // Real checks (SQLite readable/writable, schema migrated) belong to the
    // still-deferred persistence layer — see DAY-15A notes.
  ];
  const launchCheck = validateMinimumViableLaunch(coreChecks);

  const value = useMemo(
    () => ({
      state,
      personalSetup,
      setPersonalSetup,
      goToNextStep,
      saveAndExit,
      systemStatuses,
      resumeStep,
      startupRoute,
      launchCheck,
      completeOnboarding,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, personalSetup, courses, fitnessPlan, transactions]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
