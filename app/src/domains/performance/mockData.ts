import type { Action, Goal, System } from "./types";

/**
 * Values below are taken directly from the approved reference screenshots
 * (Goals-Overview, System-Detail-Actions) where visible, so what renders on
 * screen can be checked against the actual approved design, not invented
 * numbers. This is placeholder data — see store.tsx persistence note.
 */

export const SEED_GOALS: Goal[] = [
  {
    id: "goal-sgpa",
    title: "Reach 3.7+ SGPA",
    domain: "academic",
    status: "on-track",
    progress: { current: 3.35, target: 3.7, unit: "SGPA" },
    deadline: "2026-06-30",
    consistency7d: 87,
    systemIds: ["sys-weekly-study"],
    createdBy: "user",
  },
  {
    id: "goal-pbos",
    title: "Complete PBOS Desktop V1",
    domain: "development",
    status: "on-track",
    progress: { current: 72, target: 100, unit: "%" },
    deadline: "2026-08-15",
    consistency7d: 74,
    systemIds: [],
    createdBy: "user",
  },
  {
    id: "goal-run5k",
    title: "Run 5 km continuously",
    domain: "fitness",
    status: "needs-focus",
    progress: { current: 3.2, target: 5.0, unit: "km" },
    deadline: "2026-06-15",
    consistency7d: 58,
    systemIds: [],
    createdBy: "user",
  },
  {
    id: "goal-cars",
    title: "Learn 30 important cars this month",
    domain: "knowledge",
    status: "needs-focus",
    progress: { current: 14, target: 30, unit: "cars" },
    deadline: "2026-05-31",
    consistency7d: 61,
    systemIds: [],
    createdBy: "user",
  },
];

export const SEED_SYSTEMS: System[] = [
  {
    id: "sys-weekly-study",
    goalId: "goal-sgpa",
    title: "Weekly Study System",
    description: "A repeatable engine for weekly academic study, classes, assignments, and revision.",
    domain: "academic",
    tags: ["Academic", "Core"],
    healthPercent: 0, // recomputed deterministically by store.computeSystemHealth
    consistencyPercent: 87,
    activeStreakDays: 14,
    isStarred: true,
    actionIds: ["act-1", "act-2", "act-3", "act-4", "act-5"],
  },
];

export const SEED_ACTIONS: Action[] = [
  {
    id: "act-1",
    systemId: "sys-weekly-study",
    title: "Revise Binary Trees",
    context: "Data Structures",
    status: "in-progress",
    estMinutes: 45,
    priority: "high",
    triggerTiming: "Daily · Evening Block",
    order: 1,
  },
  {
    id: "act-2",
    systemId: "sys-weekly-study",
    title: "Solve Calculus set",
    context: "Calculus",
    status: "not-started",
    estMinutes: 60,
    priority: "high",
    triggerTiming: "Today · 2:30 PM",
    order: 2,
  },
  {
    id: "act-3",
    systemId: "sys-weekly-study",
    title: "Review class notes",
    context: "DBMS",
    status: "completed",
    estMinutes: 30,
    priority: "medium",
    triggerTiming: "Today · Morning Block",
    order: 3,
  },
  {
    id: "act-4",
    systemId: "sys-weekly-study",
    title: "Take short mastery test",
    context: "Operating Systems",
    status: "not-started",
    estMinutes: 25,
    priority: "medium",
    triggerTiming: "Tomorrow · 10:00 AM",
    order: 4,
  },
  {
    id: "act-5",
    systemId: "sys-weekly-study",
    title: "Update formula sheet",
    context: "Calculus",
    status: "not-started",
    estMinutes: 20,
    priority: "low",
    triggerTiming: "Weekend Review",
    order: 5,
  },
];
