/**
 * Canonical relational persistence for the Fitness & Recovery domain.
 *
 *   store.tsx  ->  FitnessRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                              \->  { localStorage JSON }  (browser dev only)
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  FitnessGraph,
  PlannedSession,
  RecoveryCheckIn,
  TrainingPlan,
  WorkoutSession,
} from "./types";

export type FitImportReport = {
  ran: boolean;
  plansImported: number;
  plannedSessionsImported: number;
  workoutSessionsImported: number;
  checkinsImported: number;
};

export interface FitnessRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<FitnessGraph>;
  planUpsert(plan: TrainingPlan): Promise<void>;
  planDelete(id: string): Promise<void>;
  plannedSessionUpsert(session: PlannedSession): Promise<void>;
  plannedSessionDelete(id: string): Promise<void>;
  workoutUpsert(workout: WorkoutSession): Promise<void>;
  workoutDelete(id: string): Promise<void>;
  checkinUpsert(checkin: RecoveryCheckIn): Promise<void>;
  checkinDelete(id: string): Promise<void>;
  importGraph(graph: FitnessGraph): Promise<FitImportReport>;
}

const EMPTY: FitnessGraph = {
  plans: [],
  plannedSessions: [],
  workoutSessions: [],
  checkins: [],
};

function normReport(r: Record<string, unknown>): FitImportReport {
  const num = (a: unknown, b: unknown) => Number(a ?? b ?? 0);
  return {
    ran: !!r.ran,
    plansImported: num(r.plansImported, r.plans_imported),
    plannedSessionsImported: num(r.plannedSessionsImported, r.planned_sessions_imported),
    workoutSessionsImported: num(r.workoutSessionsImported, r.workout_sessions_imported),
    checkinsImported: num(r.checkinsImported, r.checkins_imported),
  };
}

/** Rust stores exercise arrays as JSON strings; the TS boundary uses arrays. */
type Wire<T> = Omit<
  T,
  "exercises" | "exercisesPerformed"
> & { exercises?: string; exercisesPerformed?: string };

function planSessionToWire(s: PlannedSession): Wire<PlannedSession> {
  const { exercises, ...rest } = s;
  return { ...rest, exercises: JSON.stringify(exercises) };
}
function planSessionFromWire(w: Record<string, unknown>): PlannedSession {
  return { ...(w as unknown as PlannedSession), exercises: safeArr(w.exercises) };
}
function workoutToWire(w: WorkoutSession): Wire<WorkoutSession> {
  const { exercisesPerformed, ...rest } = w;
  return { ...rest, exercisesPerformed: JSON.stringify(exercisesPerformed) };
}
function workoutFromWire(w: Record<string, unknown>): WorkoutSession {
  return {
    ...(w as unknown as WorkoutSession),
    exercisesPerformed: safeArr(w.exercisesPerformed),
  };
}
function safeArr<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? (p as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// --- Tauri / SQLite --------------------------------------------------------

class SqliteRepo implements FitnessRepo {
  readonly kind = "sqlite" as const;
  async load() {
    const g = await invoke<{
      plans: TrainingPlan[];
      plannedSessions: Record<string, unknown>[];
      workoutSessions: Record<string, unknown>[];
      checkins: RecoveryCheckIn[];
    }>("fit_load");
    return {
      plans: g.plans,
      plannedSessions: g.plannedSessions.map(planSessionFromWire),
      workoutSessions: g.workoutSessions.map(workoutFromWire),
      checkins: g.checkins,
    };
  }
  async planUpsert(plan: TrainingPlan) {
    await invoke("fit_plan_upsert", { plan });
  }
  async planDelete(id: string) {
    await invoke("fit_plan_delete", { id });
  }
  async plannedSessionUpsert(session: PlannedSession) {
    await invoke("fit_planned_session_upsert", { session: planSessionToWire(session) });
  }
  async plannedSessionDelete(id: string) {
    await invoke("fit_planned_session_delete", { id });
  }
  async workoutUpsert(workout: WorkoutSession) {
    await invoke("fit_workout_upsert", { workout: workoutToWire(workout) });
  }
  async workoutDelete(id: string) {
    await invoke("fit_workout_delete", { id });
  }
  async checkinUpsert(checkin: RecoveryCheckIn) {
    await invoke("fit_checkin_upsert", { checkin });
  }
  async checkinDelete(id: string) {
    await invoke("fit_checkin_delete", { id });
  }
  async importGraph(graph: FitnessGraph) {
    return normReport(
      await invoke("fit_import_graph", {
        import: {
          plans: graph.plans,
          plannedSessions: graph.plannedSessions.map(planSessionToWire),
          workoutSessions: graph.workoutSessions.map(workoutToWire),
          checkins: graph.checkins,
        },
      }),
    );
  }
}

// --- localStorage (browser dev fallback) ---------------------------------

const LS_KEY = "pbos:fitness-v2";
const LS_IMPORT_MARK = "pbos:fitness-v2-imported";

export class LocalRepo implements FitnessRepo {
  readonly kind = "localStorage" as const;

  private read(): FitnessGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { ...EMPTY };
      const g = JSON.parse(raw) as FitnessGraph;
      return {
        plans: g.plans ?? [],
        plannedSessions: g.plannedSessions ?? [],
        workoutSessions: g.workoutSessions ?? [],
        checkins: g.checkins ?? [],
      };
    } catch {
      return { ...EMPTY };
    }
  }
  private write(g: FitnessGraph) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(g));
  }
  private upsert<T extends { id: string; createdAt: string }>(arr: T[], row: T): T[] {
    const i = arr.findIndex((x) => x.id === row.id);
    if (i >= 0) {
      const next = [...arr];
      next[i] = { ...row, createdAt: arr[i].createdAt };
      return next;
    }
    return [...arr, row];
  }

  async load() {
    return this.read();
  }
  async planUpsert(plan: TrainingPlan) {
    const g = this.read();
    g.plans = this.upsert(g.plans, plan);
    this.write(g);
  }
  async planDelete(id: string) {
    const g = this.read();
    g.plans = g.plans.filter((p) => p.id !== id);
    g.plannedSessions = g.plannedSessions.filter((s) => s.planId !== id); // CASCADE
    g.workoutSessions = g.workoutSessions.map((w) =>
      w.planId === id ? { ...w, planId: null } : w,
    ); // SET NULL — history kept
    this.write(g);
  }
  async plannedSessionUpsert(session: PlannedSession) {
    const g = this.read();
    if (!g.plans.some((p) => p.id === session.planId)) return; // FK
    g.plannedSessions = this.upsert(g.plannedSessions, session);
    this.write(g);
  }
  async plannedSessionDelete(id: string) {
    const g = this.read();
    g.plannedSessions = g.plannedSessions.filter((s) => s.id !== id);
    g.workoutSessions = g.workoutSessions.map((w) =>
      w.plannedSessionId === id ? { ...w, plannedSessionId: null } : w,
    );
    this.write(g);
  }
  async workoutUpsert(workout: WorkoutSession) {
    const g = this.read();
    const planId = workout.planId && g.plans.some((p) => p.id === workout.planId) ? workout.planId : null;
    g.workoutSessions = this.upsert(g.workoutSessions, { ...workout, planId });
    this.write(g);
  }
  async workoutDelete(id: string) {
    const g = this.read();
    g.workoutSessions = g.workoutSessions.filter((w) => w.id !== id);
    this.write(g);
  }
  async checkinUpsert(checkin: RecoveryCheckIn) {
    const g = this.read();
    g.checkins = this.upsert(g.checkins, checkin);
    this.write(g);
  }
  async checkinDelete(id: string) {
    const g = this.read();
    g.checkins = g.checkins.filter((c) => c.id !== id);
    this.write(g);
  }
  async importGraph(graph: FitnessGraph): Promise<FitImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return {
        ran: false,
        plansImported: 0,
        plannedSessionsImported: 0,
        workoutSessionsImported: 0,
        checkinsImported: 0,
      };
    }
    const g = this.read();
    const has = (arr: { id: string }[], id: string) => arr.some((x) => x.id === id);
    const report: FitImportReport = {
      ran: true,
      plansImported: 0,
      plannedSessionsImported: 0,
      workoutSessionsImported: 0,
      checkinsImported: 0,
    };
    for (const p of graph.plans)
      if (!has(g.plans, p.id)) {
        g.plans.push(p);
        report.plansImported++;
      }
    for (const s of graph.plannedSessions) {
      if (has(g.plannedSessions, s.id) || !has(g.plans, s.planId)) continue;
      g.plannedSessions.push(s);
      report.plannedSessionsImported++;
    }
    for (const w of graph.workoutSessions) {
      if (has(g.workoutSessions, w.id)) continue;
      const planId = w.planId && has(g.plans, w.planId) ? w.planId : null;
      g.workoutSessions.push({ ...w, planId });
      report.workoutSessionsImported++;
    }
    for (const c of graph.checkins)
      if (!has(g.checkins, c.id)) {
        g.checkins.push(c);
        report.checkinsImported++;
      }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makeFitnessRepo(): FitnessRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
