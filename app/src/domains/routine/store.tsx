import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CompletionState, Routine, RoutineLog, TimeWindow } from "./types";
import { computeConsistency } from "./engine";
import { SEED_LOGS, SEED_ROUTINES } from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";
import type { SaveState } from "../resilience/types";

type RoutineContextValue = {
  routines: Routine[];
  getByWindow: (window: TimeWindow) => Routine[];
  getTodayLog: (routineId: string) => RoutineLog | undefined;
  getConsistency: (routineId: string) => ReturnType<typeof computeConsistency>;
  setTodayState: (routineId: string, state: CompletionState) => void;
  /** Real persistence status for the logs — genuinely backed by localStorage now, not just in-memory. */
  saveState: SaveState;
  loadError: string | null;
};

const RoutineContext = createContext<RoutineContextValue | null>(null);
const today = new Date().toISOString().slice(0, 10);

export function RoutineProvider({ children }: { children: ReactNode }) {
  // Routine definitions stay in-memory seed data (a deliberate scope choice —
  // only the frequently-changing logs are persisted for now).
  const [routines] = useState<Routine[]>(SEED_ROUTINES);

  // Real persistence: routine logs now genuinely survive an app restart —
  // see domains/persistence for the honest scope note on why this is
  // localStorage-backed rather than the eventual SQLite architecture.
  const [logs, setLogs, saveState, loadError] = usePersistedState<RoutineLog[]>("routine-logs", SEED_LOGS);

  const getByWindow = (window: TimeWindow) => routines.filter((r) => r.timeWindow === window);
  const getLogsForRoutine = (routineId: string) => logs.filter((l) => l.routineId === routineId);
  const getTodayLog = (routineId: string) => logs.find((l) => l.routineId === routineId && l.date === today);
  const getConsistency = (routineId: string) => computeConsistency(getLogsForRoutine(routineId));

  const setTodayState = (routineId: string, state: CompletionState) => {
    const existing = logs.find((l) => l.routineId === routineId && l.date === today);
    if (existing) {
      setLogs(logs.map((l) => (l.id === existing.id ? { ...l, state } : l)));
    } else {
      setLogs([
        ...logs,
        { id: `lg-${Date.now()}`, routineId, date: today, state, quantityCompleted: null, durationCompletedMinutes: null, completedAt: null },
      ]);
    }
  };

  const value = useMemo(
    () => ({ routines, getByWindow, getTodayLog, getConsistency, setTodayState, saveState, loadError }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routines, logs, saveState, loadError]
  );

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>;
}

export function useRoutine() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error("useRoutine must be used within RoutineProvider");
  return ctx;
}
