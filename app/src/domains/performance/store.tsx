/**
 * Performance spine store — the ONE place Goal/System/Action state lives.
 *
 * - Canonical persistence is relational SQLite via `PerformanceRepo` (Batch 1).
 *   The in-memory graph here is a projection loaded once on mount; every
 *   mutation writes through to the repo and updates the projection.
 * - No seed data. A fresh profile is genuinely empty; a returning user's
 *   Batch 0 KV blobs are imported once (idempotent, non-destructive).
 * - Relationship truth lives in `links` (goal↔system) and `Action.systemId`
 *   (system→action). Nothing bidirectional. Health/progress/attention are
 *   derived on read via `engine.ts`, never stored.
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
import { cacheAdapter } from "../persistence/cache";
import type { SaveState } from "../resilience/types";
import {
  actionsForSystem as engineActionsForSystem,
  deriveGoalAttention,
  deriveGoalProgress,
  deriveSystemHealth,
  goalsForSystem as engineGoalsForSystem,
  canTransitionGoal,
  nextActionForSystem,
  systemsForGoal as engineSystemsForGoal,
  validateActionInput,
  validateGoalInput,
  validateSystemInput,
} from "./engine";
import { newId } from "./ids";
import { consumeLoadDelay } from "../persistence/testControls";
import { recordRevision } from "../revision/recorder";
import { resolveLegacyPerformance, type LegacyImportReport } from "./legacyImport";
import { makePerformanceRepo, type PerformanceRepo } from "./repo";
import type {
  Action,
  ActionInput,
  ActionStatus,
  Goal,
  GoalInput,
  GoalLifecycle,
  GoalSystemLink,
  PerfGraph,
  System,
  SystemInput,
} from "./types";

type MutResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

type PerformanceContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: LegacyImportReport | null;

  goals: Goal[];
  systems: System[];
  actions: Action[];
  links: GoalSystemLink[];

  // reads / derived
  getGoal: (id: string) => Goal | undefined;
  getSystem: (id: string) => System | undefined;
  getAction: (id: string) => Action | undefined;
  systemsForGoal: (goalId: string) => System[];
  goalsForSystem: (systemId: string) => Goal[];
  actionsForSystem: (systemId: string) => Action[];
  systemHealth: (systemId: string) => ReturnType<typeof deriveSystemHealth>;
  goalProgress: (goalId: string) => ReturnType<typeof deriveGoalProgress>;
  goalAttention: (goalId: string) => ReturnType<typeof deriveGoalAttention>;
  nextAction: (systemId: string) => Action | null;

  // goal CRUD
  createGoal: (input: GoalInput, createdBy?: Goal["createdBy"]) => Promise<MutResult>;
  updateGoal: (id: string, input: GoalInput) => Promise<MutResult>;
  transitionGoal: (id: string, to: GoalLifecycle) => Promise<MutResult>;
  deleteGoal: (id: string) => Promise<void>;

  // system CRUD
  createSystem: (input: SystemInput) => Promise<MutResult>;
  updateSystem: (id: string, input: SystemInput) => Promise<MutResult>;
  toggleSystemStar: (id: string) => Promise<void>;
  deleteSystem: (id: string) => Promise<void>;

  // link
  setGoalSystemLink: (goalId: string, systemId: string, linked: boolean) => Promise<void>;

  // action CRUD
  createAction: (systemId: string | null, input: ActionInput) => Promise<MutResult>;
  updateAction: (id: string, input: ActionInput) => Promise<MutResult>;
  setActionStatus: (id: string, status: ActionStatus) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
  reorderActions: (systemId: string, orderedIds: string[]) => Promise<void>;

  /** Back-compat shim for Quick Capture (`domains/capture/store`). */
  addAction: (partial: {
    systemId?: string | null;
    title: string;
    context?: string;
    estMinutes?: number;
    priority?: "low" | "medium" | "normal" | "high";
    triggerTiming?: string;
  }) => Promise<Action | null>;
};

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<PerformanceRepo>(makePerformanceRepo());
  const [graph, setGraph] = useState<PerfGraph>({ goals: [], systems: [], actions: [], links: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<LegacyImportReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        await consumeLoadDelay(); // dev/test-only: makes the LOADING state observable (no-op in production)
        // One-time, idempotent import of the Batch 0 KV blobs.
        const legacy = resolveLegacyPerformance({
          goals: cacheAdapter.getItem("pbos:performance-goals"),
          systems: cacheAdapter.getItem("pbos:performance-systems"),
          actions: cacheAdapter.getItem("pbos:performance-actions"),
        });
        const report = await repo.importGraph(legacy.graph);
        if (report.ran) setLegacyImport(legacy.report);

        const g = await repo.load();
        if (!cancelled) {
          setGraph(g);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- write-through helper --------------------------------------------------
  async function persist(fn: () => Promise<void>) {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      setSaveError(null);
    } catch (e) {
      setSaveState("failed");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  // --- reads --------------------------------------------------------------
  const getGoal = (id: string) => graph.goals.find((g) => g.id === id);
  const getSystem = (id: string) => graph.systems.find((s) => s.id === id);
  const getAction = (id: string) => graph.actions.find((a) => a.id === id);
  const systemsForGoal = (goalId: string) => engineSystemsForGoal(goalId, graph.links, graph.systems);
  const goalsForSystem = (systemId: string) => engineGoalsForSystem(systemId, graph.links, graph.goals);
  const actionsForSystem = (systemId: string) => engineActionsForSystem(systemId, graph.actions);
  const systemHealth = (systemId: string) => deriveSystemHealth(actionsForSystem(systemId));
  const goalProgress = (goalId: string) => {
    const g = getGoal(goalId);
    return g ? deriveGoalProgress(g) : ({ kind: "none" } as const);
  };
  const goalAttention = (goalId: string): ReturnType<typeof deriveGoalAttention> => {
    const g = getGoal(goalId);
    if (!g) return { state: "no-signal", reasons: [] };
    const linked = systemsForGoal(goalId);
    const bySystem = new Map(linked.map((s) => [s.id, actionsForSystem(s.id)]));
    return deriveGoalAttention(g, linked, bySystem, todayIso());
  };
  const nextAction = (systemId: string) => nextActionForSystem(systemId, graph.actions);

  // --- goal CRUD -------------------------------------------------------------
  const createGoal = async (input: GoalInput, createdBy: Goal["createdBy"] = "user"): Promise<MutResult> => {
    const v = validateGoalInput(input);
    if (!v.ok) return v;
    const goal: Goal = {
      id: newId("goal"),
      ...v.value,
      lifecycle: "active",
      createdBy,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, goals: [...g.goals, goal] }));
    await persist(() => repoRef.current.goalUpsert(goal));
    recordRevision({
      domain: "performance",
      entityType: "goal",
      entityId: goal.id,
      operation: "create",
      source: createdBy === "ai-approved" ? "ai-applied" : "user",
      summary: `Created goal "${goal.title}"`,
    });
    return { ok: true, id: goal.id };
  };

  const updateGoal = async (id: string, input: GoalInput): Promise<MutResult> => {
    const existing = getGoal(id);
    if (!existing) return { ok: false, errors: { _: "Goal not found." } };
    const v = validateGoalInput(input);
    if (!v.ok) return v;
    const goal: Goal = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, goals: g.goals.map((x) => (x.id === id ? goal : x)) }));
    await persist(() => repoRef.current.goalUpsert(goal));
    return { ok: true, id };
  };

  const transitionGoal = async (id: string, to: GoalLifecycle): Promise<MutResult> => {
    const existing = getGoal(id);
    if (!existing) return { ok: false, errors: { _: "Goal not found." } };
    if (!canTransitionGoal(existing.lifecycle, to)) {
      return { ok: false, errors: { _: `Can't move a ${existing.lifecycle} goal to ${to}.` } };
    }
    const goal: Goal = { ...existing, lifecycle: to, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, goals: g.goals.map((x) => (x.id === id ? goal : x)) }));
    await persist(() => repoRef.current.goalUpsert(goal));
    recordRevision({
      domain: "performance",
      entityType: "goal",
      entityId: id,
      operation: "status-change",
      source: "user",
      summary: `Goal "${existing.title}" moved ${existing.lifecycle} → ${to}`,
      metadata: { before: existing.lifecycle, after: to },
    });
    return { ok: true, id };
  };

  const deleteGoal = async (id: string) => {
    setGraph((g) => ({
      ...g,
      goals: g.goals.filter((x) => x.id !== id),
      links: g.links.filter((l) => l.goalId !== id),
    }));
    await persist(() => repoRef.current.goalDelete(id));
  };

  // --- system CRUD --------------------------------------------------------
  const createSystem = async (input: SystemInput): Promise<MutResult> => {
    const v = validateSystemInput(input);
    if (!v.ok) return v;
    const system: System = {
      id: newId("sys"),
      ...v.value,
      starred: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, systems: [...g.systems, system] }));
    await persist(() => repoRef.current.systemUpsert(system));
    return { ok: true, id: system.id };
  };

  const updateSystem = async (id: string, input: SystemInput): Promise<MutResult> => {
    const existing = getSystem(id);
    if (!existing) return { ok: false, errors: { _: "System not found." } };
    const v = validateSystemInput(input);
    if (!v.ok) return v;
    const system: System = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, systems: g.systems.map((x) => (x.id === id ? system : x)) }));
    await persist(() => repoRef.current.systemUpsert(system));
    return { ok: true, id };
  };

  const toggleSystemStar = async (id: string) => {
    const existing = getSystem(id);
    if (!existing) return;
    const system: System = { ...existing, starred: !existing.starred, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, systems: g.systems.map((x) => (x.id === id ? system : x)) }));
    await persist(() => repoRef.current.systemUpsert(system));
  };

  const deleteSystem = async (id: string) => {
    setGraph((g) => ({
      ...g,
      systems: g.systems.filter((x) => x.id !== id),
      links: g.links.filter((l) => l.systemId !== id),
      actions: g.actions.map((a) => (a.systemId === id ? { ...a, systemId: null } : a)),
    }));
    await persist(() => repoRef.current.systemDelete(id));
  };

  // --- link -------------------------------------------------------------
  const setGoalSystemLink = async (goalId: string, systemId: string, linked: boolean) => {
    setGraph((g) => {
      const exists = g.links.some((l) => l.goalId === goalId && l.systemId === systemId);
      if (linked && !exists) return { ...g, links: [...g.links, { goalId, systemId }] };
      if (!linked && exists)
        return { ...g, links: g.links.filter((l) => !(l.goalId === goalId && l.systemId === systemId)) };
      return g;
    });
    await persist(() => repoRef.current.linkSet(goalId, systemId, linked));
  };

  // --- action CRUD -----------------------------------------------------
  const createAction = async (systemId: string | null, input: ActionInput): Promise<MutResult> => {
    const v = validateActionInput(input);
    if (!v.ok) return v;
    const position =
      systemId === null
        ? graph.actions.filter((a) => a.systemId === null).length
        : engineActionsForSystem(systemId, graph.actions).length;
    const action: Action = {
      id: newId("act"),
      systemId,
      ...v.value,
      position,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, actions: [...g.actions, action] }));
    await persist(() => repoRef.current.actionUpsert(action));
    recordRevision({
      domain: "performance",
      entityType: "action",
      entityId: action.id,
      operation: "create",
      source: "user",
      summary: `Created action "${action.title}"`,
    });
    return { ok: true, id: action.id };
  };

  const updateAction = async (id: string, input: ActionInput): Promise<MutResult> => {
    const existing = getAction(id);
    if (!existing) return { ok: false, errors: { _: "Action not found." } };
    const v = validateActionInput(input);
    if (!v.ok) return v;
    const action: Action = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, actions: g.actions.map((x) => (x.id === id ? action : x)) }));
    await persist(() => repoRef.current.actionUpsert(action));
    return { ok: true, id };
  };

  const setActionStatus = async (id: string, status: ActionStatus) => {
    const existing = getAction(id);
    if (!existing) return;
    const action: Action = { ...existing, status, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, actions: g.actions.map((x) => (x.id === id ? action : x)) }));
    await persist(() => repoRef.current.actionUpsert(action));
    recordRevision({
      domain: "performance",
      entityType: "action",
      entityId: id,
      operation: "status-change",
      source: "user",
      summary: `Action "${existing.title}" ${existing.status} → ${status}`,
      metadata: { before: existing.status, after: status },
    });
  };

  const deleteAction = async (id: string) => {
    setGraph((g) => ({ ...g, actions: g.actions.filter((x) => x.id !== id) }));
    await persist(() => repoRef.current.actionDelete(id));
  };

  const reorderActions = async (systemId: string, orderedIds: string[]) => {
    setGraph((g) => ({
      ...g,
      actions: g.actions.map((a) => {
        if (a.systemId !== systemId) return a;
        const pos = orderedIds.indexOf(a.id);
        return pos >= 0 ? { ...a, position: pos } : a;
      }),
    }));
    await persist(() => repoRef.current.actionsReorder(systemId, orderedIds));
  };

  const addAction: PerformanceContextValue["addAction"] = async (partial) => {
    const res = await createAction(partial.systemId ?? null, {
      title: partial.title,
      context: partial.context ?? "Quick Capture",
      status: "todo",
      estMinutes: partial.estMinutes ?? null,
      priority:
        partial.priority === "medium" || partial.priority === undefined
          ? "normal"
          : (partial.priority as "low" | "normal" | "high"),
      timing: partial.triggerTiming ?? "",
    });
    return res.ok ? (getAction(res.id) ?? null) : null;
  };

  const value = useMemo<PerformanceContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      goals: graph.goals,
      systems: graph.systems,
      actions: graph.actions,
      links: graph.links,
      getGoal,
      getSystem,
      getAction,
      systemsForGoal,
      goalsForSystem,
      actionsForSystem,
      systemHealth,
      goalProgress,
      goalAttention,
      nextAction,
      createGoal,
      updateGoal,
      transitionGoal,
      deleteGoal,
      createSystem,
      updateSystem,
      toggleSystemStar,
      deleteSystem,
      setGoalSystemLink,
      createAction,
      updateAction,
      setActionStatus,
      deleteAction,
      reorderActions,
      addAction,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, saveError, legacyImport],
  );

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

export function usePerformance() {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error("usePerformance must be used within PerformanceProvider");
  return ctx;
}
