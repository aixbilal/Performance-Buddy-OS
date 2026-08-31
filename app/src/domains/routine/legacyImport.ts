/**
 * One-time migration of the pre-2B Routine KV blobs into the canonical
 * relational graph. Pure and fully testable.
 *
 * Legacy keys:
 *   pbos:routine-definitions -> Routine[]    (old shape: no schedule / archived / timestamps)
 *   pbos:routine-logs        -> RoutineLog[] (old shape: no created/updated timestamps)
 *
 * Guarantees: parse safely, preserve IDs, default a missing cadence to "daily",
 * drop dangling logs (missing routine) with a report, collapse duplicate
 * (routine, date) logs deterministically (keep the first), keep a System
 * reference as-is (the Rust/local repo clears it if the System is gone and
 * reports that), idempotent, non-destructive, never fabricate history or
 * consistency.
 */
import { newId } from "./ids";
import { isCompletionState, isCompletionType, isScheduleType } from "./engine";
import {
  PRIORITIES,
  TIME_WINDOWS,
  type CompletionState,
  type CompletionType,
  type Priority,
  type Routine,
  type RoutineGraph,
  type RoutineLog,
  type ScheduleType,
  type TimeWindow,
} from "./types";

export type RoutineLegacyReport = {
  parsed: { routines: number; logs: number };
  malformed: string[];
  repairs: string[];
};

export type RoutineLegacyResult = { graph: RoutineGraph; report: RoutineLegacyReport };

const NOW = () => new Date().toISOString();

function asArray(raw: string | null): { items: unknown[]; malformed: boolean } {
  if (raw == null) return { items: [], malformed: false };
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? { items: v, malformed: false } : { items: [], malformed: true };
  } catch {
    return { items: [], malformed: true };
  }
}

const numOrNull = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null);
const intOrNull = (v: unknown): number | null =>
  Number.isFinite(Number(v)) ? Math.round(Number(v)) : null;

function coerceTimeWindow(v: unknown): TimeWindow {
  return (TIME_WINDOWS as readonly string[]).includes(v as string) ? (v as TimeWindow) : "anytime";
}
function coercePriority(v: unknown): Priority {
  return (PRIORITIES as readonly string[]).includes(v as string) ? (v as Priority) : "important";
}
function coerceCompletionType(v: unknown): CompletionType {
  return isCompletionType(v) ? (v as CompletionType) : "boolean";
}
function coerceScheduleType(v: unknown): ScheduleType {
  return isScheduleType(v) ? (v as ScheduleType) : "daily";
}
function coerceState(v: unknown): CompletionState {
  return isCompletionState(v) ? (v as CompletionState) : "pending";
}

export function resolveLegacyRoutine(raw: {
  definitions: string | null;
  logs: string | null;
}): RoutineLegacyResult {
  const report: RoutineLegacyReport = {
    parsed: { routines: 0, logs: 0 },
    malformed: [],
    repairs: [],
  };

  const defs = asArray(raw.definitions);
  const logsArr = asArray(raw.logs);
  if (defs.malformed) report.malformed.push("pbos:routine-definitions");
  if (logsArr.malformed) report.malformed.push("pbos:routine-logs");

  // --- routines ---
  const routines: Routine[] = [];
  const routineIds = new Set<string>();
  for (const row of defs.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a routine row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("rt");
    if (routineIds.has(id)) {
      report.repairs.push(`duplicate routine id ${id} skipped`);
      continue;
    }
    routineIds.add(id);

    const scheduleType = coerceScheduleType(r.scheduleType);
    let scheduleDays: number[] = [];
    if (Array.isArray(r.scheduleDays)) {
      scheduleDays = [...new Set(r.scheduleDays)]
        .filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
        .sort((a, b) => a - b);
    }
    const scheduleTarget = intOrNull(r.scheduleTarget);
    if (scheduleType === "daily" && !("scheduleType" in r)) {
      report.repairs.push(`routine ${id}: no cadence recorded — defaulted to "daily"`);
    }

    routines.push({
      id,
      title: typeof r.title === "string" ? r.title : "Untitled routine",
      category: typeof r.category === "string" ? r.category : "",
      timeWindow: coerceTimeWindow(r.timeWindow),
      scheduleType,
      scheduleDays: scheduleType === "weekly-days" ? scheduleDays : [],
      scheduleTarget: scheduleType === "times-per-week" ? scheduleTarget : null,
      completionType: coerceCompletionType(r.completionType),
      targetQuantity: numOrNull(r.targetQuantity),
      targetUnit: typeof r.targetUnit === "string" ? r.targetUnit : null,
      targetDurationMinutes: intOrNull(r.targetDurationMinutes),
      priority: coercePriority(r.priority),
      relatedSystemId: typeof r.relatedSystemId === "string" && r.relatedSystemId ? r.relatedSystemId : null,
      paused: r.paused === true,
      archived: r.archived === true,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.routines++;
  }

  // --- logs --- (drop dangling; collapse duplicate (routine,date), keep first)
  const logs: RoutineLog[] = [];
  const logIds = new Set<string>();
  const seenRoutineDate = new Set<string>();
  for (const row of logsArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a routine log row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("rtlog");
    if (logIds.has(id)) {
      report.repairs.push(`duplicate log id ${id} skipped`);
      continue;
    }
    const routineId = typeof r.routineId === "string" ? r.routineId : "";
    if (!routineIds.has(routineId)) {
      report.repairs.push(`log ${id} → missing routine ${routineId || "(none)"} — dropped`);
      continue;
    }
    const date = typeof r.date === "string" ? r.date.slice(0, 10) : "";
    const key = `${routineId}::${date}`;
    if (date && seenRoutineDate.has(key)) {
      report.repairs.push(`log ${id} → duplicate entry for ${routineId} on ${date} — collapsed`);
      continue;
    }
    if (date) seenRoutineDate.add(key);
    logIds.add(id);
    logs.push({
      id,
      routineId,
      date,
      state: coerceState(r.state),
      quantityCompleted: numOrNull(r.quantityCompleted),
      durationCompletedMinutes: intOrNull(r.durationCompletedMinutes),
      completedAt: typeof r.completedAt === "string" ? r.completedAt : null,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.logs++;
  }

  return { graph: { routines, logs }, report };
}
