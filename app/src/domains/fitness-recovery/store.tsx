/**
 * Fitness & Recovery store.
 *
 * - Canonical persistence is relational SQLite via `FitnessRepo` (Batch 2B).
 * - No seed data. Fresh profile is empty; a returning user's pre-2B KV blobs
 *   are imported once (idempotent, non-destructive; legacy prescriptions are
 *   dropped — advisory only in V1).
 * - BASE PLAN (`plans` + `plannedSessions`) ≠ ACTUAL SESSION
 *   (`workoutSessions`). Completing a workout NEVER edits the plan; editing the
 *   plan NEVER edits past workouts. Readiness is derived from check-ins, never
 *   stored, and is `insufficient-data` when inputs are thin.
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
  deriveReadiness,
  validateCheckInInput,
  validatePlanInput,
  validatePlannedSessionInput,
  type ReadinessResult,
} from "./engine";
import { newId } from "./ids";
import { resolveLegacyFitness, type FitLegacyReport } from "./legacyImport";
import { makeFitnessRepo, type FitnessRepo } from "./repo";
import type {
  CheckInInput,
  ExerciseActual,
  FitnessGraph,
  PlanInput,
  PlannedSession,
  PlannedSessionInput,
  RecoveryCheckIn,
  TrainingPlan,
  TrainingPlanStatus,
  WorkoutSession,
} from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FitnessContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  /** Back-compat alias — pre-2B consumers read `checkInsSaveState`. */
  checkInsSaveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: FitLegacyReport | null;

  plans: TrainingPlan[];
  plannedSessions: PlannedSession[];
  workoutSessions: WorkoutSession[];
  checkIns: RecoveryCheckIn[];

  /** Back-compat: the single active plan, or null on a fresh profile. */
  plan: TrainingPlan | null;
  /** Back-compat alias for `plannedSessions`. */
  sessions: PlannedSession[];
  readiness: ReadinessResult;
  dayLabel: (dayOfWeek: number) => string;

  // reads
  getPlan: (id: string) => TrainingPlan | undefined;
  getPlannedSessionsForPlan: (planId: string) => PlannedSession[];
  getWorkoutsForPlan: (planId: string) => WorkoutSession[];
  getRecentWorkouts: (limit?: number) => WorkoutSession[];
  getTodayCheckIn: () => RecoveryCheckIn | undefined;

  // plan CRUD
  createPlan: (input: PlanInput) => Promise<MutResult>;
  updatePlan: (id: string, input: PlanInput) => Promise<MutResult>;
  setPlanStatus: (id: string, status: TrainingPlanStatus) => Promise<void>;
  archivePlan: (id: string, archived?: boolean) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;

  // planned session CRUD
  createPlannedSession: (planId: string, input: PlannedSessionInput) => Promise<MutResult>;
  updatePlannedSession: (id: string, input: PlannedSessionInput) => Promise<MutResult>;
  deletePlannedSession: (id: string) => Promise<void>;

  // actual workout (independent of the plan)
  startWorkout: (opts: { plannedSessionId?: string | null; title: string }) => Promise<MutResult>;
  recordWorkout: (
    id: string,
    patch: { exercisesPerformed?: ExerciseActual[]; notes?: string },
  ) => Promise<MutResult>;
  completeWorkout: (id: string) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;

  // recovery
  addCheckIn: (input: CheckInInput) => Promise<MutResult>;
  updateCheckIn: (id: string, input: CheckInInput) => Promise<MutResult>;
  deleteCheckIn: (id: string) => Promise<void>;
};

const FitnessContext = createContext<FitnessContextValue | null>(null);

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY: FitnessGraph = { plans: [], plannedSessions: [], workoutSessions: [], checkins: [] };

export function FitnessProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<FitnessRepo>(makeFitnessRepo());
  const [graph, setGraph] = useState<FitnessGraph>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<FitLegacyReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const legacy = resolveLegacyFitness({
          plan: cacheAdapter.getItem("pbos:fitness-plan"),
          sessions: cacheAdapter.getItem("pbos:fitness-sessions"),
          prescriptions: cacheAdapter.getItem("pbos:fitness-prescriptions"),
          checkins: cacheAdapter.getItem("pbos:fitness-checkins"),
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

  // --- reads --------------------------------------------------------
  const getPlan = (id: string) => graph.plans.find((p) => p.id === id);
  const activePlan =
    graph.plans.find((p) => !p.archived && p.status === "active") ??
    graph.plans.find((p) => !p.archived) ??
    null;
  const getPlannedSessionsForPlan = (planId: string) =>
    graph.plannedSessions
      .filter((s) => s.planId === planId)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const getWorkoutsForPlan = (planId: string) =>
    graph.workoutSessions
      .filter((w) => w.planId === planId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const getRecentWorkouts = (limit = 10) =>
    [...graph.workoutSessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  const getTodayCheckIn = () => graph.checkins.find((c) => c.date === todayIso());
  const readiness = deriveReadiness(graph.checkins);

  // --- plan CRUD -------------------------------------------------
  const createPlan = async (input: PlanInput): Promise<MutResult> => {
    const v = validatePlanInput(input);
    if (!v.ok) return v;
    const plan: TrainingPlan = {
      id: newId("plan"),
      ...v.value,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, plans: [...g.plans, plan] }));
    await persist(() => repoRef.current.planUpsert(plan));
    return { ok: true, id: plan.id };
  };

  const updatePlan = async (id: string, input: PlanInput): Promise<MutResult> => {
    const existing = getPlan(id);
    if (!existing) return { ok: false, errors: { _: "Plan not found." } };
    const v = validatePlanInput(input);
    if (!v.ok) return v;
    const plan: TrainingPlan = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, plans: g.plans.map((p) => (p.id === id ? plan : p)) }));
    await persist(() => repoRef.current.planUpsert(plan));
    return { ok: true, id };
  };

  const setPlanStatus = async (id: string, status: TrainingPlanStatus) => {
    const existing = getPlan(id);
    if (!existing) return;
    const plan: TrainingPlan = { ...existing, status, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, plans: g.plans.map((p) => (p.id === id ? plan : p)) }));
    await persist(() => repoRef.current.planUpsert(plan));
  };

  const archivePlan = async (id: string, archived = true) => {
    const existing = getPlan(id);
    if (!existing) return;
    const plan: TrainingPlan = { ...existing, archived, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, plans: g.plans.map((p) => (p.id === id ? plan : p)) }));
    await persist(() => repoRef.current.planUpsert(plan));
  };

  const deletePlan = async (id: string) => {
    setGraph((g) => ({
      ...g,
      plans: g.plans.filter((p) => p.id !== id),
      plannedSessions: g.plannedSessions.filter((s) => s.planId !== id),
      workoutSessions: g.workoutSessions.map((w) => (w.planId === id ? { ...w, planId: null } : w)),
    }));
    await persist(() => repoRef.current.planDelete(id));
  };

  // --- planned session CRUD --------------------------------
  const createPlannedSession = async (
    planId: string,
    input: PlannedSessionInput,
  ): Promise<MutResult> => {
    if (!getPlan(planId)) return { ok: false, errors: { _: "Plan not found." } };
    const v = validatePlannedSessionInput(input);
    if (!v.ok) return v;
    const session: PlannedSession = {
      id: newId("psess"),
      planId,
      ...v.value,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, plannedSessions: [...g.plannedSessions, session] }));
    await persist(() => repoRef.current.plannedSessionUpsert(session));
    return { ok: true, id: session.id };
  };

  const updatePlannedSession = async (
    id: string,
    input: PlannedSessionInput,
  ): Promise<MutResult> => {
    const existing = graph.plannedSessions.find((s) => s.id === id);
    if (!existing) return { ok: false, errors: { _: "Session not found." } };
    const v = validatePlannedSessionInput(input);
    if (!v.ok) return v;
    const session: PlannedSession = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({
      ...g,
      plannedSessions: g.plannedSessions.map((s) => (s.id === id ? session : s)),
    }));
    await persist(() => repoRef.current.plannedSessionUpsert(session));
    return { ok: true, id };
  };

  const deletePlannedSession = async (id: string) => {
    setGraph((g) => ({
      ...g,
      plannedSessions: g.plannedSessions.filter((s) => s.id !== id),
      workoutSessions: g.workoutSessions.map((w) =>
        w.plannedSessionId === id ? { ...w, plannedSessionId: null } : w,
      ),
    }));
    await persist(() => repoRef.current.plannedSessionDelete(id));
  };

  // --- actual workout (its own record) -----------------------
  const startWorkout = async (opts: {
    plannedSessionId?: string | null;
    title: string;
  }): Promise<MutResult> => {
    const title = opts.title.replace(/\s+/g, " ").trim();
    if (title.length === 0) return { ok: false, errors: { title: "Give the workout a title." } };
    const planned = opts.plannedSessionId
      ? graph.plannedSessions.find((s) => s.id === opts.plannedSessionId)
      : undefined;
    // Pre-fill actuals FROM the plan (a snapshot) — the plan itself is untouched.
    const exercisesPerformed: ExerciseActual[] = (planned?.exercises ?? []).map((e) => ({
      name: e.name,
      setsCompleted: 0,
      repsCompleted: "",
    }));
    const workout: WorkoutSession = {
      id: newId("wsess"),
      planId: planned?.planId ?? activePlan?.id ?? null,
      plannedSessionId: planned?.id ?? null,
      date: todayIso(),
      title,
      exercisesPerformed,
      notes: "",
      completed: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, workoutSessions: [...g.workoutSessions, workout] }));
    await persist(() => repoRef.current.workoutUpsert(workout));
    return { ok: true, id: workout.id };
  };

  const recordWorkout = async (
    id: string,
    patch: { exercisesPerformed?: ExerciseActual[]; notes?: string },
  ): Promise<MutResult> => {
    const existing = graph.workoutSessions.find((w) => w.id === id);
    if (!existing) return { ok: false, errors: { _: "Workout not found." } };
    const workout: WorkoutSession = {
      ...existing,
      exercisesPerformed: patch.exercisesPerformed ?? existing.exercisesPerformed,
      notes: patch.notes ?? existing.notes,
      updatedAt: nowIso(),
    };
    setGraph((g) => ({
      ...g,
      workoutSessions: g.workoutSessions.map((w) => (w.id === id ? workout : w)),
    }));
    await persist(() => repoRef.current.workoutUpsert(workout));
    return { ok: true, id };
  };

  const completeWorkout = async (id: string) => {
    const existing = graph.workoutSessions.find((w) => w.id === id);
    if (!existing) return;
    const workout: WorkoutSession = { ...existing, completed: true, updatedAt: nowIso() };
    setGraph((g) => ({
      ...g,
      workoutSessions: g.workoutSessions.map((w) => (w.id === id ? workout : w)),
    }));
    await persist(() => repoRef.current.workoutUpsert(workout));
  };

  const deleteWorkout = async (id: string) => {
    setGraph((g) => ({ ...g, workoutSessions: g.workoutSessions.filter((w) => w.id !== id) }));
    await persist(() => repoRef.current.workoutDelete(id));
  };

  // --- recovery ---------------------------------------------
  const addCheckIn = async (input: CheckInInput): Promise<MutResult> => {
    const v = validateCheckInInput(input);
    if (!v.ok) return v;
    const date = v.value.date || todayIso();
    const existingForDate = graph.checkins.find((c) => c.date === date);
    if (existingForDate) {
      return updateCheckIn(existingForDate.id, { ...v.value, date });
    }
    const checkin: RecoveryCheckIn = {
      id: newId("ci"),
      ...v.value,
      date,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, checkins: [...g.checkins, checkin] }));
    await persist(() => repoRef.current.checkinUpsert(checkin));
    return { ok: true, id: checkin.id };
  };

  const updateCheckIn = async (id: string, input: CheckInInput): Promise<MutResult> => {
    const existing = graph.checkins.find((c) => c.id === id);
    if (!existing) return { ok: false, errors: { _: "Check-in not found." } };
    const v = validateCheckInInput(input);
    if (!v.ok) return v;
    const checkin: RecoveryCheckIn = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, checkins: g.checkins.map((c) => (c.id === id ? checkin : c)) }));
    await persist(() => repoRef.current.checkinUpsert(checkin));
    return { ok: true, id };
  };

  const deleteCheckIn = async (id: string) => {
    setGraph((g) => ({ ...g, checkins: g.checkins.filter((c) => c.id !== id) }));
    await persist(() => repoRef.current.checkinDelete(id));
  };

  const value = useMemo<FitnessContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      checkInsSaveState: saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      plans: graph.plans,
      plannedSessions: graph.plannedSessions,
      workoutSessions: graph.workoutSessions,
      checkIns: graph.checkins,
      plan: activePlan,
      sessions: graph.plannedSessions,
      readiness,
      dayLabel: (d: number) => DAY_LABELS[d] ?? "?",
      getPlan,
      getPlannedSessionsForPlan,
      getWorkoutsForPlan,
      getRecentWorkouts,
      getTodayCheckIn,
      createPlan,
      updatePlan,
      setPlanStatus,
      archivePlan,
      deletePlan,
      createPlannedSession,
      updatePlannedSession,
      deletePlannedSession,
      startWorkout,
      recordWorkout,
      completeWorkout,
      deleteWorkout,
      addCheckIn,
      updateCheckIn,
      deleteCheckIn,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, saveError, legacyImport],
  );

  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
}

export function useFitness() {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error("useFitness must be used within FitnessProvider");
  return ctx;
}
