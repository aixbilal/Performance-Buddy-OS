/**
 * Performance Buddy OS — the canonical GOAL → SYSTEM → ACTION spine.
 *
 * Semantics (docs 11.01–11.09):
 *   GOAL   = a desired outcome / sustained direction
 *   SYSTEM = a repeatable process that moves outcomes forward
 *   ACTION = a concrete executable piece of work with a stopping condition
 *
 * These are never blurred into one generic "progress". A Routine is not a Goal;
 * a Focus session is not an Action; a Scheduled Block is not an Action; an
 * Action completing does not complete its Goal or prove mastery.
 *
 * ONE source of truth per relationship:
 *   goal ↔ system : `GoalSystemLink[]` (many-to-many; a goal may have many
 *                   systems, a system may support many goals — or none)
 *   system → action : `Action.systemId` (the FK side; null = a direct
 *                   commitment with no parent system)
 * There are NO reverse-collection arrays (`systemIds`, `actionIds`) anywhere.
 * Derived state (health, progress, attention, next action) is computed in
 * `engine.ts` and is never stored.
 */

export type Domain =
  | "academic"
  | "development"
  | "fitness"
  | "knowledge"
  | "language"
  | "money"
  | "life";

export const DOMAINS: Domain[] = [
  "academic",
  "development",
  "fitness",
  "knowledge",
  "language",
  "money",
  "life",
];

/** docs 11.02 — how success and review are interpreted. */
export type GoalType =
  | "outcome"
  | "directional"
  | "maintenance"
  | "project"
  | "learning"
  | "constraint";

export const GOAL_TYPES: GoalType[] = [
  "outcome",
  "directional",
  "maintenance",
  "project",
  "learning",
  "constraint",
];

/** docs 11.09 — goal lifecycle (NOT occurrence-completion states). */
export type GoalLifecycle =
  | "draft"
  | "active"
  | "maintenance"
  | "paused"
  | "achieved"
  | "retired"
  | "cancelled";

/** docs 11.07 — user-set attention bands (an input to planning, not a score). */
export type PriorityBand = "critical" | "high" | "normal" | "low" | "paused";

export const PRIORITY_BANDS: PriorityBand[] = [
  "critical",
  "high",
  "normal",
  "low",
  "paused",
];

/**
 * Optional user-attested numeric progress. All three fields move together —
 * a goal either has a measurable target or it does not. Absence is represented
 * as `null`, never as `0` (Unknown ≠ Zero).
 */
export type GoalMetric = {
  current: number;
  target: number;
  unit: string; // e.g. "SGPA", "km", "cars", "%"
};

export type Goal = {
  id: string;
  title: string;
  type: GoalType;
  domain: Domain;
  lifecycle: GoalLifecycle;
  priority: PriorityBand;
  deadline: string | null; // ISO date (YYYY-MM-DD)
  metric: GoalMetric | null;
  detail: string; // "why this matters" / success-evidence note
  createdBy: "user" | "ai-approved";
  createdAt: string;
  updatedAt: string;
};

export type System = {
  id: string;
  title: string;
  description: string;
  domain: Domain;
  cadence: string; // free text, e.g. "Weekly", "Mon–Fri", "3× / week"
  tags: string[];
  starred: boolean;
  createdAt: string;
  updatedAt: string;
};

/** docs 11.04 — a small, clear lifecycle. Not a hidden click-cycle. */
export type ActionStatus =
  | "todo"
  | "in-progress"
  | "done"
  | "blocked"
  | "cancelled";

export const ACTION_STATUSES: ActionStatus[] = [
  "todo",
  "in-progress",
  "done",
  "blocked",
  "cancelled",
];

export type ActionPriority = "low" | "normal" | "high";
export const ACTION_PRIORITIES: ActionPriority[] = ["low", "normal", "high"];

export type Action = {
  id: string;
  systemId: string | null; // canonical FK; null = direct commitment
  title: string;
  context: string; // e.g. a course or topic
  status: ActionStatus;
  estMinutes: number | null;
  priority: ActionPriority;
  timing: string; // free-text trigger/timing, e.g. "Today · 2:30 PM"
  position: number; // per-system ordering, 0-based
  createdAt: string;
  updatedAt: string;
};

export type GoalSystemLink = { goalId: string; systemId: string };

export type PerfGraph = {
  goals: Goal[];
  systems: System[];
  actions: Action[];
  links: GoalSystemLink[];
};

// --- input shapes for create/edit (validated in engine.ts) --------------------

export type GoalInput = {
  title: string;
  type: GoalType;
  domain: Domain;
  priority: PriorityBand;
  deadline: string | null;
  metric: GoalMetric | null;
  detail: string;
};

export type SystemInput = {
  title: string;
  description: string;
  domain: Domain;
  cadence: string;
  tags: string[];
};

export type ActionInput = {
  title: string;
  context: string;
  status: ActionStatus;
  estMinutes: number | null;
  priority: ActionPriority;
  timing: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };
