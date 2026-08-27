import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PlannedSession, Prescription, RecoveryCheckIn, TrainingPlan } from "./types";
import { deriveReadiness } from "./engine";
import { SEED_PLAN, SEED_PRESCRIPTIONS, SEED_RECOVERY_CHECKINS, SEED_SESSIONS } from "./mockData";

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
};

const FitnessContext = createContext<FitnessContextValue | null>(null);

export function FitnessProvider({ children }: { children: ReactNode }) {
  const [plan] = useState<TrainingPlan>(SEED_PLAN);
  const [sessions] = useState<PlannedSession[]>(SEED_SESSIONS);
  const [prescriptions] = useState<Prescription[]>(SEED_PRESCRIPTIONS);
  const [checkIns, setCheckIns] = useState<RecoveryCheckIn[]>(SEED_RECOVERY_CHECKINS);

  const readiness = deriveReadiness(checkIns);

  const getPrescriptionForSession = (sessionId: string) =>
    prescriptions.find((p) => p.plannedSessionId === sessionId);

  const addCheckIn = (checkIn: Omit<RecoveryCheckIn, "id">) => {
    setCheckIns((prev) => [...prev, { ...checkIn, id: `ci-${Date.now()}` }]);
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, sessions, prescriptions, checkIns]
  );

  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
}

export function useFitness() {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error("useFitness must be used within FitnessProvider");
  return ctx;
}
