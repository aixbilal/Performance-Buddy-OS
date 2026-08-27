/**
 * Performance Buddy OS — Goal / System / Action domain model.
 *
 * Per Master Handoff Section 11 and Design Assets/04 - Goals & Systems/README.md:
 *   Goal → System → Action
 * Goals are global across ALL life domains (not academic-only). A Routine is
 * NOT automatically a Goal (see Day 8 handoff, section 2) — Routines are a
 * separate engine (built on Day 8) that MAY link to a System, same as Actions do.
 *
 * This file defines the shape only. See store.tsx for state/behavior.
 */

export type Domain =
  | "academic"
  | "development"
  | "fitness"
  | "knowledge"
  | "language"
  | "money"
  | "life";

export type GoalStatus = "on-track" | "needs-focus" | "behind" | "completed" | "paused";

export type ActionStatus = "not-started" | "in-progress" | "completed";

export type Priority = "low" | "medium" | "high";

/**
 * A Goal's progress can be measured differently depending on domain
 * (SGPA is not the same shape as km run or currency saved). Keeping this
 * explicit instead of a single generic "percent" avoids silently lying
 * about precision — a currency goal and a percent-complete goal should not
 * be forced into the same number type.
 */
export type ProgressMetric = {
  current: number;
  target: number;
  unit: string; // e.g. "SGPA", "km", "₹", "cars", "%"
};

export type Goal = {
  id: string;
  title: string;
  domain: Domain;
  status: GoalStatus;
  progress: ProgressMetric;
  deadline: string | null; // ISO date, null = no deadline
  consistency7d: number; // 0-100
  systemIds: string[];
  /** Per Master Handoff §11: AI may propose goals but must never silently create them. */
  createdBy: "user" | "ai-approved";
};

export type System = {
  id: string;
  goalId: string | null; // a System may exist without a linked Goal
  title: string;
  description: string;
  domain: Domain;
  tags: string[]; // e.g. ["Academic", "Core"]
  healthPercent: number; // 0-100, deterministic — see store.tsx computeSystemHealth
  consistencyPercent: number; // 0-100, rolling 7-day
  activeStreakDays: number;
  isStarred: boolean;
  actionIds: string[];
};

export type Action = {
  id: string;
  systemId: string;
  title: string;
  context: string; // e.g. "Data Structures", "Calculus"
  status: ActionStatus;
  estMinutes: number;
  priority: Priority;
  triggerTiming: string; // free text per README — e.g. "Today · 2:30 PM"
  order: number;
};
