import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CompletionState, Routine, RoutineLog, TimeWindow } from "./types";
import { computeConsistency } from "./engine";
import { SEED_LOGS, SEED_ROUTINES } from "./mockData";

type RoutineContextValue = {
  routines: Routine[];
  getByWindow: (window: TimeWindow) => Routine[];
  getTodayLog: (routineId: string) => RoutineLog | undefined;
  getConsistency: (routineId: string) => ReturnType<typeof computeConsistency>;
  setTodayState: (routineId: string, state: CompletionState) => void;
};

const RoutineContext = createContext<RoutineContextValue | null>(null);
const today = new Date().toISOString().slice(0, 10);

export function RoutineProvider({ children }: { children: ReactNode }) {
  const [routines] = useState<Routine[]>(SEED_ROUTINES);
  const [logs, setLogs] = useState<RoutineLog[]>(SEED_LOGS);

  const getByWindow = (window: TimeWindow) => routines.filter((r) => r.timeWindow === window);
  const getLogsForRoutine = (routineId: string) => logs.filter((l) => l.routineId === routineId);
  const getTodayLog = (routineId: string) => logs.find((l) => l.routineId === routineId && l.date === today);
  const getConsistency = (routineId: string) => computeConsistency(getLogsForRoutine(routineId));

  const setTodayState = (routineId: string, state: CompletionState) => {
    setLogs((prev) => {
      const existing = prev.find((l) => l.routineId === routineId && l.date === today);
      if (existing) {
        return prev.map((l) => (l.id === existing.id ? { ...l, state } : l));
      }
      return [
        ...prev,
        { id: `lg-${Date.now()}`, routineId, date: today, state, quantityCompleted: null, durationCompletedMinutes: null, completedAt: null },
      ];
    });
  };

  const value = useMemo(
    () => ({ routines, getByWindow, getTodayLog, getConsistency, setTodayState }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routines, logs]
  );

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>;
}

export function useRoutine() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error("useRoutine must be used within RoutineProvider");
  return ctx;
}
