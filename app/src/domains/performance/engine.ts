/**
 * Performance spine — pure deterministic engine. No React, no persistence, no
 * AI. Every function here is total and testable in isolation.
 *
 * Owns: validation, normalization, safe lifecycle transitions, relationship
 * resolution, and DERIVED display state (health, progress, attention). Derived
 * state is computed here and never stored — the audit's "competing
 * authoritative storage" problem (C).
 */
import {
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  DOMAINS,
  GOAL_TYPES,
  PRIORITY_BANDS,
  type Action,
  type ActionInput,
  type ActionStatus,
  type Domain,
  type Goal,
  type GoalInput,
  type GoalLifecycle,
  type GoalMetric,
  type GoalSystemLink,
  type System,
  type SystemInput,
  type ValidationResult,
} from "./types";

const MAX_TITLE = 140;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// --- validation --------------------------------------------------------------

function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function validateGoalInput(input: GoalInput): ValidationResult<GoalInput> {
  const errors: Record<string, string> = {};
  const title = cleanTitle(input.title);

  if (title.length === 0) errors.title = "Give the goal a clear title.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;

  if (!DOMAINS.includes(input.domain)) errors.domain = "Choose a domain.";
  if (!GOAL_TYPES.includes(input.type)) errors.type = "Choose a goal type.";
  if (!PRIORITY_BANDS.includes(input.priority)) errors.priority = "Choose a priority.";

  if (input.deadline !== null) {
    if (!ISO_DATE.test(input.deadline) || Number.isNaN(Date.parse(input.deadline))) {
      errors.deadline = "Deadline must be a valid date.";
    }
  }

  let metric: GoalMetric | null = null;
  if (input.metric !== null) {
    const { current, target, unit } = input.metric;
    const unitClean = unit.trim();
    if (!Number.isFinite(current)) errors.metricCurrent = "Baseline must be a number.";
    if (!Number.isFinite(target)) errors.metricTarget = "Target must be a number.";
    else if (target === 0) errors.metricTarget = "Target can't be zero — leave the metric blank instead.";
    if (unitClean.length === 0) errors.metricUnit = "Add a unit (e.g. %, km, SGPA).";
    if (Object.keys(errors).every((k) => !k.startsWith("metric"))) {
      metric = { current, target, unit: unitClean };
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { ...input, title, detail: input.detail.trim(), metric },
  };
}

export function validateSystemInput(input: SystemInput): ValidationResult<SystemInput> {
  const errors: Record<string, string> = {};
  const title = cleanTitle(input.title);
  if (title.length === 0) errors.title = "Give the system a clear name.";
  else if (title.length > MAX_TITLE) errors.title = `Keep the name under ${MAX_TITLE} characters.`;
  if (!DOMAINS.includes(input.domain)) errors.domain = "Choose a domain.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...input,
      title,
      description: input.description.trim(),
      cadence: input.cadence.trim(),
      tags: input.tags.map((t) => t.trim()).filter(Boolean),
    },
  };
}

export function validateActionInput(input: ActionInput): ValidationResult<ActionInput> {
  const errors: Record<string, string> = {};
  const title = cleanTitle(input.title);
  if (title.length === 0) errors.title = "Describe the action.";
  else if (title.length > MAX_TITLE) errors.title = `Keep it under ${MAX_TITLE} characters.`;
  if (!ACTION_STATUSES.includes(input.status)) errors.status = "Invalid status.";
  if (!ACTION_PRIORITIES.includes(input.priority)) errors.priority = "Invalid priority.";
  if (input.estMinutes !== null) {
    if (!Number.isInteger(input.estMinutes) || input.estMinutes <= 0) {
      errors.estMinutes = "Estimate must be a whole number of minutes.";
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { ...input, title, context: input.context.trim(), timing: input.timing.trim() },
  };
}

// --- goal lifecycle transitions -------------------------------------------------

/** Allowed lifecycle moves (docs 11.09). Anything not listed is rejected. */
const GOAL_TRANSITIONS: Record<GoalLifecycle, GoalLifecycle[]> = {
  draft: ["active", "cancelled"],
  active: ["maintenance", "paused", "achieved", "retired", "cancelled"],
  maintenance: ["active", "paused", "retired", "cancelled"],
  paused: ["active", "maintenance", "retired", "cancelled"],
  achieved: ["active"], // reopen via an auditable decision
  retired: ["active"],
  cancelled: [],
};

export function canTransitionGoal(from: GoalLifecycle, to: GoalLifecycle): boolean {
  return GOAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function goalTransitionsFrom(from: GoalLifecycle): GoalLifecycle[] {
  return GOAL_TRANSITIONS[from] ?? [];
}

// --- relationship resolution (one source of truth: the link list + FK) --------

export function systemsForGoal(
  goalId: string,
  links: GoalSystemLink[],
  systems: System[],
): System[] {
  const ids = new Set(links.filter((l) => l.goalId === goalId).map((l) => l.systemId));
  return systems.filter((s) => ids.has(s.id));
}

export function goalsForSystem(systemId: string, links: GoalSystemLink[], goals: Goal[]): Goal[] {
  const ids = new Set(links.filter((l) => l.systemId === systemId).map((l) => l.goalId));
  return goals.filter((g) => ids.has(g.id));
}

export function actionsForSystem(systemId: string, actions: Action[]): Action[] {
  return actions
    .filter((a) => a.systemId === systemId)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export function directActions(actions: Action[]): Action[] {
  return actions.filter((a) => a.systemId === null);
}

/** The next non-terminal action in a system, by position. `null` when none. */
export function nextActionForSystem(systemId: string, actions: Action[]): Action | null {
  return (
    actionsForSystem(systemId, actions).find(
      (a) => a.status === "todo" || a.status === "in-progress" || a.status === "blocked",
    ) ?? null
  );
}

// --- derived state (NEVER stored) --------------------------------------------

export type SystemHealth = {
  /** `insufficient-data` when there is no evidence yet — Unknown ≠ Zero. */
  state: "healthy" | "drifting" | "at-risk" | "insufficient-data";
  /** completion ratio 0..1, or `null` when there is nothing to measure. */
  ratio: number | null;
  sampleSize: number; // actions that count toward the measure
  label: string;
};

/**
 * Deterministic system health from real action state. `cancelled` actions do
 * not count. Zero countable actions => insufficient-data (not 0%).
 */
export function deriveSystemHealth(systemActions: Action[]): SystemHealth {
  const counted = systemActions.filter((a) => a.status !== "cancelled");
  if (counted.length === 0) {
    return {
      state: "insufficient-data",
      ratio: null,
      sampleSize: 0,
      label: "Not enough activity yet",
    };
  }
  const done = counted.filter((a) => a.status === "done").length;
  const ratio = done / counted.length;
  const state = ratio >= 0.7 ? "healthy" : ratio >= 0.4 ? "drifting" : "at-risk";
  const label =
    state === "healthy" ? "On track" : state === "drifting" ? "Drifting" : "Needs attention";
  return { state, ratio, sampleSize: counted.length, label };
}

export type GoalProgress =
  | { kind: "metric"; percent: number; current: number; target: number; unit: string }
  | { kind: "none" }; // no measurable target — do NOT show 0%

export function deriveGoalProgress(goal: Goal): GoalProgress {
  if (!goal.metric) return { kind: "none" };
  const { current, target, unit } = goal.metric;
  const raw = target === 0 ? 0 : (current / target) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(raw)));
  return { kind: "metric", percent, current, target, unit };
}

export type GoalAttention = {
  state: "on-track" | "needs-attention" | "no-signal";
  reasons: string[];
};

/**
 * Derived "does this goal need attention right now?" — replaces the old stored
 * `status: needs-focus | behind`. Honest: with no systems and no metric, the
 * answer is "no-signal", not a fake status.
 */
export function deriveGoalAttention(
  goal: Goal,
  linkedSystems: System[],
  actionsBySystem: Map<string, Action[]>,
  today: string, // ISO date
): GoalAttention {
  if (goal.lifecycle === "achieved" || goal.lifecycle === "retired" || goal.lifecycle === "cancelled") {
    return { state: "no-signal", reasons: [] };
  }

  const reasons: string[] = [];

  if (goal.deadline && goal.deadline < today && goal.lifecycle !== "maintenance") {
    reasons.push("Deadline has passed");
  }

  const progress = deriveGoalProgress(goal);
  if (progress.kind === "metric" && progress.percent < 100 && goal.deadline) {
    // simple: behind if the deadline is close and progress is low
    const daysLeft = Math.round((Date.parse(goal.deadline) - Date.parse(today)) / 86_400_000);
    if (daysLeft <= 14 && progress.percent < 60) reasons.push("Behind pace for the deadline");
  }

  for (const s of linkedSystems) {
    const health = deriveSystemHealth(actionsBySystem.get(s.id) ?? []);
    if (health.state === "at-risk") reasons.push(`"${s.title}" needs attention`);
  }

  if (linkedSystems.length === 0 && progress.kind === "none") {
    return { state: "no-signal", reasons: ["No linked system or measurable target yet"] };
  }

  return reasons.length > 0
    ? { state: "needs-attention", reasons }
    : { state: "on-track", reasons: [] };
}

// --- normalization helpers used by store + repo -----------------------------

export function isDomain(x: unknown): x is Domain {
  return typeof x === "string" && (DOMAINS as string[]).includes(x);
}

export function normalizeActionStatus(raw: unknown): ActionStatus {
  const map: Record<string, ActionStatus> = {
    "not-started": "todo",
    todo: "todo",
    "in-progress": "in-progress",
    completed: "done",
    done: "done",
    blocked: "blocked",
    cancelled: "cancelled",
  };
  return (typeof raw === "string" && map[raw]) || "todo";
}
