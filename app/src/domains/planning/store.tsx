import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CapacityConfig, ScheduleBlock } from "./types";
import { computePlanFragility, detectCapacityViolations, detectConflicts, tryFitBlock } from "./engine";
import { SEED_BLOCKS, SEED_CAPACITY } from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";

type PlanningContextValue = {
  blocks: ScheduleBlock[];
  capacity: CapacityConfig;
  conflicts: ReturnType<typeof detectConflicts>;
  violations: ReturnType<typeof detectCapacityViolations>;
  weeklyScheduledMinutes: number;
  fragility: ReturnType<typeof computePlanFragility>;
  checkFit: (candidate: ScheduleBlock) => ReturnType<typeof tryFitBlock>;
};

const PlanningContext = createContext<PlanningContextValue | null>(null);

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [blocks] = usePersistedState<ScheduleBlock[]>("planning-blocks", SEED_BLOCKS);
  const [capacity] = usePersistedState<CapacityConfig>("planning-capacity", SEED_CAPACITY);

  const conflicts = detectConflicts(blocks);
  const violations = detectCapacityViolations(blocks, capacity.dailyCapacityMinutes, capacity.weeklyCapacityMinutes);
  const weeklyScheduledMinutes = blocks.reduce((s, b) => s + (b.endMinute - b.startMinute), 0);
  const fragility = computePlanFragility(weeklyScheduledMinutes, capacity.weeklyCapacityMinutes);

  const checkFit = (candidate: ScheduleBlock) => tryFitBlock(candidate, blocks, capacity.dailyCapacityMinutes, capacity.weeklyCapacityMinutes);

  const value = useMemo(
    () => ({ blocks, capacity, conflicts, violations, weeklyScheduledMinutes, fragility, checkFit }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks, capacity]
  );

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
}

export function usePlanning() {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error("usePlanning must be used within PlanningProvider");
  return ctx;
}
