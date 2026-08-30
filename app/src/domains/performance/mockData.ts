/**
 * TEST / DEV FIXTURES ONLY — not imported by the store or any page.
 *
 * `LEGACY_KV` reproduces the exact Batch 0 `pbos:performance-*` JSON blob
 * shape (the pre-Batch-1 model: `Goal.systemIds` + `System.goalId`,
 * `System.actionIds` + `Action.systemId`, stored `healthPercent` /
 * `activeStreakDays`, `status: "on-track"` etc.) so `legacyImport.test.ts`
 * can prove the migration + relationship-conflict repair.
 *
 * A fresh production PBOS profile has NONE of this — the honest empty state.
 */

export const LEGACY_KV = {
  "pbos:performance-goals": JSON.stringify([
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
  ]),
  "pbos:performance-systems": JSON.stringify([
    {
      id: "sys-weekly-study",
      goalId: "goal-sgpa",
      title: "Weekly Study System",
      description: "A repeatable engine for weekly academic study.",
      domain: "academic",
      tags: ["Academic", "Core"],
      healthPercent: 0,
      consistencyPercent: 87,
      activeStreakDays: 14,
      isStarred: true,
      // deliberately disagrees with reality: a2 actually belongs to another id below
      actionIds: ["act-1", "act-2", "act-ghost"],
    },
  ]),
  "pbos:performance-actions": JSON.stringify([
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
      id: "act-orphan",
      systemId: "sys-does-not-exist",
      title: "Update formula sheet",
      context: "Calculus",
      status: "completed",
      estMinutes: 20,
      priority: "low",
      triggerTiming: "Weekend Review",
      order: 3,
    },
  ]),
} as const;
