import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Action, ActionStatus, Goal, System } from "./types";
import { SEED_GOALS, SEED_SYSTEMS, SEED_ACTIONS } from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";
import type { SaveState } from "../resilience/types";

/**
 * PERSISTENCE STATUS: Goals, Systems, and Actions are now ALL genuinely
 * persisted via domains/persistence (localStorage-backed — see that
 * domain's honest scope note on why this isn't the eventual SQLite
 * architecture yet). This domain's persistence is now complete.
 */

type PerformanceState = {
  goals: Goal[];
  systems: System[];
  actions: Action[];
};

type PerformanceContextValue = PerformanceState & {
  getSystemsForGoal: (goalId: string) => System[];
  getActionsForSystem: (systemId: string) => Action[];
  getGoalForSystem: (systemId: string) => Goal | undefined;
  setActionStatus: (actionId: string, status: ActionStatus) => void;
  addAction: (action: Omit<Action, "id" | "order">) => Action;
  /** Deterministic — recomputed from real action state, never guessed by AI. */
  computeSystemHealth: (systemId: string) => number;
  actionsSaveState: SaveState;
  actionsLoadError: string | null;
};

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [goals] = usePersistedState<Goal[]>("performance-goals", SEED_GOALS);
  const [systems] = usePersistedState<System[]>("performance-systems", SEED_SYSTEMS);
  const [actions, setActions, actionsSaveState, actionsLoadError] = usePersistedState<Action[]>(
    "performance-actions",
    SEED_ACTIONS
  );

  const setActionStatus = (actionId: string, status: ActionStatus) => {
    setActions(actions.map((a) => (a.id === actionId ? { ...a, status } : a)));
  };

  const addAction = (action: Omit<Action, "id" | "order">): Action => {
    const newAction: Action = { ...action, id: `action-${Date.now()}`, order: actions.length + 1 };
    setActions([...actions, newAction]);
    return newAction;
  };

  const getActionsForSystem = (systemId: string) =>
    actions.filter((a) => a.systemId === systemId).sort((a, b) => a.order - b.order);

  const getSystemsForGoal = (goalId: string) => systems.filter((s) => s.goalId === goalId);

  const getGoalForSystem = (systemId: string) => {
    const system = systems.find((s) => s.id === systemId);
    if (!system?.goalId) return undefined;
    return goals.find((g) => g.id === system.goalId);
  };

  /**
   * Deterministic completion-rate calculation — per Master Handoff §20 ("AI
   * should not become the source of truth for... project completion") this
   * has no AI involvement. Real completion / total actions, nothing guessed.
   */
  const computeSystemHealth = (systemId: string) => {
    const systemActions = getActionsForSystem(systemId);
    if (systemActions.length === 0) return 0;
    const completed = systemActions.filter((a) => a.status === "completed").length;
    return Math.round((completed / systemActions.length) * 100);
  };

  const value = useMemo(
    () => ({
      goals,
      systems,
      actions,
      getSystemsForGoal,
      getActionsForSystem,
      getGoalForSystem,
      setActionStatus,
      addAction,
      computeSystemHealth,
      actionsSaveState,
      actionsLoadError,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals, systems, actions, actionsSaveState, actionsLoadError]
  );

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

export function usePerformance() {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error("usePerformance must be used within PerformanceProvider");
  return ctx;
}
