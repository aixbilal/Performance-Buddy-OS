import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PlannedSession, Prescription, RecoveryCheckIn, TrainingPlan } from "./types";
import { deriveReadiness } from "./engine";
import { SEED_PLAN, SEED_PRESCRIPTIONS, SEED_RECOVERY_CHECKINS, SEED_SESSIONS } from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";
import type { SaveState } from "../resilience/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FitnessContextValue = {
  plan: TrainingPlan;
  sessions: PlannedSession[];
  prescriptions: Prescription[];
  checkIns: RecoveryCheckIn[];
  readiness: ReturnType<typeof deriveReadiness>;
  getPrescriptionForSession: (sessionId: string) => Prescription | undefined;
  addCheckIn: (checkIn: Omit<RecoveryCheckIn, "id">) => void;
  dayLabel: (dayOfWeek: number) => string;
  checkInsSaveState: SaveState;
};

const FitnessContext = createContext<FitnessContextValue | null>(null);

export function FitnessProvider({ children }: { children: ReactNode }) {
  const [plan] = usePersistedState<TrainingPlan>("fitness-plan", SEED_PLAN);
  const [sessions] = usePersistedState<PlannedSession[]>("fitness-sessions", SEED_SESSIONS);
  const [prescriptions] = usePersistedState<Prescription[]>("fitness-prescriptions", SEED_PRESCRIPTIONS);
  // Real persistence: your logged recovery check-ins now genuinely survive
  // an app restart — readiness is derived from this, so it's the
  // highest-value piece of Fitness domain state to persist.
  const [checkIns, setCheckIns, checkInsSaveState] = usePersistedState<RecoveryCheckIn[]>(
    "fitness-checkins",
    SEED_RECOVERY_CHECKINS
  );

  const readiness = deriveReadiness(checkIns);

  const getPrescriptionForSession = (sessionId: string) =>
    prescriptions.find((p) => p.plannedSessionId === sessionId);

  const addCheckIn = (checkIn: Omit<RecoveryCheckIn, "id">) => {
    setCheckIns([...checkIns, { ...checkIn, id: `ci-${Date.now()}` }]);
  };

  const dayLabel = (dayOfWeek: number) => DAY_LABELS[dayOfWeek] ?? "?";

  const value = useMemo(
    () => ({
      plan,
      sessions,
      prescriptions,
      checkIns,
      readiness,
      getPrescriptionForSession,
      addCheckIn,
      dayLabel,
      checkInsSaveState,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, sessions, prescriptions, checkIns, checkInsSaveState]
  );

  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
}

export function useFitness() {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error("useFitness must be used within FitnessProvider");
  return ctx;
}
