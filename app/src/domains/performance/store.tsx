import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Action, ActionStatus, Goal, System } from "./types";
import { SEED_GOALS, SEED_SYSTEMS, SEED_ACTIONS } from "./mockData";

/**
 * PERSISTENCE NOTE (flag, not a blocker):
 * This is an in-memory store (React state) — nothing survives a restart yet.
 * Real local persistence (SQLite via the Rust data-access layer, per ADR-0001)
 * is a separate, larger piece of work not built as part of Day 3. Keeping the
 * shape below close to how a real repository/service layer would look
 * (explicit actions, not direct array mutation) means swapping in real
 * persistence later should not require rewriting the domains that consume it.
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
};

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [goals] = useState<Goal[]>(SEED_GOALS);
  const [systems] = useState<System[]>(SEED_SYSTEMS);
  const [actions, setActions] = useState<Action[]>(SEED_ACTIONS);

  const setActionStatus = (actionId: string, status: ActionStatus) => {
    setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, status } : a)));
  };

  const addAction = (action: Omit<Action, "id" | "order">): Action => {
    const newAction: Action = { ...action, id: `action-${Date.now()}`, order: actions.length + 1 };
    setActions((prev) => [...prev, newAction]);
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals, systems, actions]
  );

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

export function usePerformance() {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error("usePerformance must be used within PerformanceProvider");
  return ctx;
}
