/**
 * Routines & Daily Life store — the ONE place Routine + RoutineLog state lives.
 *
 * - Canonical persistence is relational SQLite via `RoutineRepo` (Batch 2B).
 * - No seed data. Fresh profile is empty; a returning user's pre-2B KV blobs
 *   are imported once (idempotent, non-destructive).
 * - ROUTINE ≠ ACTION ≠ SYSTEM ≠ GOAL. A check-in writes only a `RoutineLog`;
 *   it never creates an Action. `relatedSystemId` is a reference, never a copy.
 * - Consistency is DERIVED from the schedule + logs (`deriveRoutineConsistency`)
 *   — never stored, and there is no streak counter.
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
  computeConsistency,
  deriveRoutineConsistency,
  deriveTodayState,
  isScheduledOn,
  scheduleLabel,
  validateCheckInInput,
  validateRoutineInput,
  type ConsistencyResult,
  type RoutineConsistency,
  type TodayState,
} from "./engine";
import { newId } from "./ids";
import { recordRevision } from "../revision/recorder";
import { resolveLegacyRoutine, type RoutineLegacyReport } from "./legacyImport";
import { makeRoutineRepo, type RoutineRepo } from "./repo";
import type {
  CheckInInput,
  CompletionState,
  Routine,
  RoutineGraph,
  RoutineInput,
  RoutineLog,
  TimeWindow,
} from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY: RoutineGraph = { routines: [], logs: [] };

type RoutineContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  /** Back-compat alias. */
  checkInsSaveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: RoutineLegacyReport | null;

  routines: Routine[];
  logs: RoutineLog[];

  // reads
  getRoutine: (id: string) => Routine | undefined;
  getByWindow: (window: TimeWindow) => Routine[];
  getLogsForRoutine: (routineId: string) => RoutineLog[];
  getRoutineHistory: (routineId: string, limit?: number) => RoutineLog[];
  getTodayLog: (routineId: string) => RoutineLog | undefined;
  getRoutineTodayState: (routineId: string) => TodayState;
  getRoutineConsistency: (routineId: string, windowDays?: number) => RoutineConsistency;
  /** Pre-2B logged-days consistency — kept for Analytics. */
  getConsistency: (routineId: string) => ConsistencyResult;
  getDueToday: () => Routine[];
  scheduleLabel: (routine: Routine) => string;

  // routine CRUD
  createRoutine: (input: RoutineInput) => Promise<MutResult>;
  updateRoutine: (id: string, input: RoutineInput) => Promise<MutResult>;
  pauseRoutine: (id: string, paused?: boolean) => Promise<void>;
  archiveRoutine: (id: string, archived?: boolean) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;

  // canonical System link (a reference, never a copy)
  linkRoutineToSystem: (routineId: string, systemId: string) => Promise<void>;
  unlinkRoutineFromSystem: (routineId: string) => Promise<void>;

  // check-in / history
  checkInRoutine: (routineId: string, input: CheckInInput) => Promise<MutResult>;
  updateCheckIn: (id: string, input: CheckInInput) => Promise<MutResult>;
  deleteCheckIn: (id: string) => Promise<void>;
  /** Back-compat — set today's completion state, upserting one canonical log. */
  setTodayState: (routineId: string, state: CompletionState) => void;
};

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function RoutineProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<RoutineRepo>(makeRoutineRepo());
  const [graph, setGraph] = useState<RoutineGraph>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<RoutineLegacyReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const legacy = resolveLegacyRoutine({
          definitions: cacheAdapter.getItem("pbos:routine-definitions"),
          logs: cacheAdapter.getItem("pbos:routine-logs"),
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

  // --- reads -----------------------------------------------------------
  const getRoutine = (id: string) => graph.routines.find((r) => r.id === id);
  const activeRoutines = graph.routines.filter((r) => !r.archived);
  const getByWindow = (window: TimeWindow) => activeRoutines.filter((r) => r.timeWindow === window);
  const getLogsForRoutine = (routineId: string) =>
    graph.logs.filter((l) => l.routineId === routineId);
  const getRoutineHistory = (routineId: string, limit = 30) =>
    [...getLogsForRoutine(routineId)]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, limit);
  const getTodayLog = (routineId: string) =>
    graph.logs.find((l) => l.routineId === routineId && l.date === todayIso());
  const getRoutineTodayState = (routineId: string): TodayState => {
    const routine = getRoutine(routineId);
    if (!routine) return { scheduledToday: false, state: "pending", logged: false };
    return deriveTodayState(routine, graph.logs, todayIso());
  };
  const getRoutineConsistency = (routineId: string, windowDays = 30): RoutineConsistency => {
    const routine = getRoutine(routineId);
    if (!routine) return { percent: null, expected: 0, completed: 0, excused: 0, windowDays };
    return deriveRoutineConsistency(routine, graph.logs, { today: todayIso(), windowDays });
  };
  const getConsistency = (routineId: string): ConsistencyResult =>
    computeConsistency(getLogsForRoutine(routineId));
  const getDueToday = () => {
    const today = todayIso();
    return activeRoutines.filter(
      (r) => !r.paused && isScheduledOn(r, today),
    );
  };

  // --- routine CRUD --------------------------------------------------
  const createRoutine = async (input: RoutineInput): Promise<MutResult> => {
    const v = validateRoutineInput(input);
    if (!v.ok) return v;
    const routine: Routine = {
      id: newId("rt"),
      title: v.value.title,
      category: v.value.category,
      timeWindow: v.value.timeWindow,
      scheduleType: v.value.schedule.type,
      scheduleDays: v.value.schedule.days,
      scheduleTarget: v.value.schedule.timesPerWeek,
      completionType: v.value.completionType,
      targetQuantity: v.value.targetQuantity,
      targetUnit: v.value.targetUnit,
      targetDurationMinutes: v.value.targetDurationMinutes,
      priority: v.value.priority,
      relatedSystemId: v.value.relatedSystemId,
      paused: false,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, routines: [...g.routines, routine] }));
    await persist(() => repoRef.current.routineUpsert(routine));
    return { ok: true, id: routine.id };
  };

  const updateRoutine = async (id: string, input: RoutineInput): Promise<MutResult> => {
    const existing = getRoutine(id);
    if (!existing) return { ok: false, errors: { _: "Routine not found." } };
    const v = validateRoutineInput(input);
    if (!v.ok) return v;
    const routine: Routine = {
      ...existing,
      title: v.value.title,
      category: v.value.category,
      timeWindow: v.value.timeWindow,
      scheduleType: v.value.schedule.type,
      scheduleDays: v.value.schedule.days,
      scheduleTarget: v.value.schedule.timesPerWeek,
      completionType: v.value.completionType,
      targetQuantity: v.value.targetQuantity,
      targetUnit: v.value.targetUnit,
      targetDurationMinutes: v.value.targetDurationMinutes,
      priority: v.value.priority,
      relatedSystemId: v.value.relatedSystemId,
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, routines: g.routines.map((r) => (r.id === id ? routine : r)) }));
    await persist(() => repoRef.current.routineUpsert(routine));
    return { ok: true, id };
  };

  const patchRoutine = async (id: string, patch: Partial<Routine>) => {
    const existing = getRoutine(id);
    if (!existing) return;
    const routine: Routine = { ...existing, ...patch, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, routines: g.routines.map((r) => (r.id === id ? routine : r)) }));
    await persist(() => repoRef.current.routineUpsert(routine));
  };

  const pauseRoutine = (id: string, paused = true) => patchRoutine(id, { paused });
  const archiveRoutine = (id: string, archived = true) => patchRoutine(id, { archived });
  const linkRoutineToSystem = (routineId: string, systemId: string) =>
    patchRoutine(routineId, { relatedSystemId: systemId || null });
  const unlinkRoutineFromSystem = (routineId: string) =>
    patchRoutine(routineId, { relatedSystemId: null });

  const deleteRoutine = async (id: string) => {
    setGraph((g) => ({
      routines: g.routines.filter((r) => r.id !== id),
      logs: g.logs.filter((l) => l.routineId !== id), // CASCADE
    }));
    await persist(() => repoRef.current.routineDelete(id));
  };

  // --- check-in / history -----------------------------------------
  const checkInRoutine = async (routineId: string, input: CheckInInput): Promise<MutResult> => {
    if (!getRoutine(routineId)) return { ok: false, errors: { _: "Routine not found." } };
    const v = validateCheckInInput(input);
    if (!v.ok) return v;
    const date = v.value.date || todayIso();
    const existing = graph.logs.find((l) => l.routineId === routineId && l.date === date);
    if (existing) {
      return updateCheckIn(existing.id, { ...v.value, date });
    }
    const completed = v.value.state === "complete" || v.value.state === "partial";
    const log: RoutineLog = {
      id: newId("rtlog"),
      routineId,
      date,
      state: v.value.state,
      quantityCompleted: v.value.quantityCompleted,
      durationCompletedMinutes: v.value.durationCompletedMinutes,
      completedAt: completed ? nowIso() : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, logs: [...g.logs, log] }));
    await persist(() => repoRef.current.logUpsert(log));
    recordRevision({
      domain: "routine",
      entityType: "routine",
      entityId: routineId,
      operation: "check-in",
      source: "user",
      summary: `Checked in "${getRoutine(routineId)?.title ?? routineId}" — ${v.value.state} (${date})`,
      metadata: { logId: log.id, state: v.value.state, date },
    });
    return { ok: true, id: log.id };
  };

  const updateCheckIn = async (id: string, input: CheckInInput): Promise<MutResult> => {
    const existing = graph.logs.find((l) => l.id === id);
    if (!existing) return { ok: false, errors: { _: "Check-in not found." } };
    const v = validateCheckInInput(input);
    if (!v.ok) return v;
    const completed = v.value.state === "complete" || v.value.state === "partial";
    const log: RoutineLog = {
      ...existing,
      state: v.value.state,
      quantityCompleted: v.value.quantityCompleted,
      durationCompletedMinutes: v.value.durationCompletedMinutes,
      completedAt: completed ? (existing.completedAt ?? nowIso()) : null,
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, logs: g.logs.map((l) => (l.id === id ? log : l)) }));
    await persist(() => repoRef.current.logUpsert(log));
    return { ok: true, id };
  };

  const deleteCheckIn = async (id: string) => {
    setGraph((g) => ({ ...g, logs: g.logs.filter((l) => l.id !== id) }));
    await persist(() => repoRef.current.logDelete(id));
  };

  const setTodayState = (routineId: string, state: CompletionState) => {
    void checkInRoutine(routineId, {
      date: todayIso(),
      state,
      quantityCompleted: null,
      durationCompletedMinutes: null,
    });
  };

  const value = useMemo<RoutineContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      checkInsSaveState: saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      routines: graph.routines,
      logs: graph.logs,
      getRoutine,
      getByWindow,
      getLogsForRoutine,
      getRoutineHistory,
      getTodayLog,
      getRoutineTodayState,
      getRoutineConsistency,
      getConsistency,
      getDueToday,
      scheduleLabel,
      createRoutine,
      updateRoutine,
      pauseRoutine,
      archiveRoutine,
      deleteRoutine,
      linkRoutineToSystem,
      unlinkRoutineFromSystem,
      checkInRoutine,
      updateCheckIn,
      deleteCheckIn,
      setTodayState,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, saveError, legacyImport],
  );

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>;
}

export function useRoutine() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error("useRoutine must be used within RoutineProvider");
  return ctx;
}
