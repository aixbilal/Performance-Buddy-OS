/**
 * One-time migration of the Batch 0 transitional KV blobs
 * (`pbos:performance-goals|systems|actions`) into the canonical relational
 * shape. Pure and fully testable.
 *
 * Guarantees (batch §14):
 *   - parse safely; malformed rows are reported, never thrown away silently
 *   - preserve existing IDs
 *   - resolve the DUELLING relationship arrays deterministically:
 *       goal↔system : union of legacy `Goal.systemIds[]` and `System.goalId`
 *       system→action: `Action.systemId` is authoritative; a legacy
 *                      `System.actionIds` disagreement is repaired + reported
 *   - never invent metrics/streaks — legacy fabricated numbers are dropped
 */
import { newId } from "./ids";
import { isDomain, normalizeActionStatus } from "./engine";
import type {
  Action,
  ActionPriority,
  Domain,
  Goal,
  GoalLifecycle,
  GoalSystemLink,
  GoalType,
  PerfGraph,
  PriorityBand,
  System,
} from "./types";

export type LegacyImportReport = {
  parsed: { goals: number; systems: number; actions: number };
  malformed: string[];
  repairs: string[];
};

export type LegacyImportResult = { graph: PerfGraph; report: LegacyImportReport };

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

const LEGACY_GOAL_LIFECYCLE: Record<string, GoalLifecycle> = {
  "on-track": "active",
  "needs-focus": "active",
  behind: "active",
  completed: "achieved",
  paused: "paused",
};

const LEGACY_ACTION_PRIORITY: Record<string, ActionPriority> = {
  low: "low",
  medium: "normal",
  normal: "normal",
  high: "high",
};

function coerceDomain(raw: unknown): Domain {
  return isDomain(raw) ? raw : "life";
}

export function resolveLegacyPerformance(raw: {
  goals: string | null;
  systems: string | null;
  actions: string | null;
}): LegacyImportResult {
  const report: LegacyImportReport = {
    parsed: { goals: 0, systems: 0, actions: 0 },
    malformed: [],
    repairs: [],
  };

  const g = asArray(raw.goals);
  const s = asArray(raw.systems);
  const a = asArray(raw.actions);
  if (g.malformed) report.malformed.push("pbos:performance-goals");
  if (s.malformed) report.malformed.push("pbos:performance-systems");
  if (a.malformed) report.malformed.push("pbos:performance-actions");

  // --- systems ---
  const systems: System[] = [];
  const systemIds = new Set<string>();
  for (const row of s.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a system row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("sys");
    if (systemIds.has(id)) {
      report.repairs.push(`duplicate system id ${id} skipped`);
      continue;
    }
    systemIds.add(id);
    systems.push({
      id,
      title: typeof r.title === "string" ? r.title : "Untitled system",
      description: typeof r.description === "string" ? r.description : "",
      domain: coerceDomain(r.domain),
      cadence: typeof r.cadence === "string" ? r.cadence : "",
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
      starred: r.isStarred === true || r.starred === true,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.systems++;
  }

  // --- goals ---
  const goals: Goal[] = [];
  const goalIds = new Set<string>();
  const links: GoalSystemLink[] = [];
  const linkKey = new Set<string>();
  const addLink = (goalId: string, sysId: string) => {
    if (!goalIds.has(goalId) && !goals.some((x) => x.id === goalId)) return;
    if (!systemIds.has(sysId)) {
      report.repairs.push(`link ${goalId}→${sysId} dropped (system not found)`);
      return;
    }
    const k = `${goalId}::${sysId}`;
    if (!linkKey.has(k)) {
      linkKey.add(k);
      links.push({ goalId, systemId: sysId });
    }
  };

  for (const row of g.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a goal row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("goal");
    if (goalIds.has(id)) {
      report.repairs.push(`duplicate goal id ${id} skipped`);
      continue;
    }
    goalIds.add(id);

    // legacy `progress: {current,target,unit}` was a *stored* number. Keep it
    // as a user-attested metric ONLY if it is well-formed and target > 0.
    let metric = null as Goal["metric"];
    const p = r.progress as Record<string, unknown> | undefined;
    if (
      p &&
      Number.isFinite(p.current) &&
      Number.isFinite(p.target) &&
      (p.target as number) > 0 &&
      typeof p.unit === "string" &&
      p.unit.trim()
    ) {
      metric = { current: p.current as number, target: p.target as number, unit: (p.unit as string).trim() };
    }

    goals.push({
      id,
      title: typeof r.title === "string" ? r.title : "Untitled goal",
      type: (typeof r.type === "string" ? r.type : "outcome") as GoalType,
      domain: coerceDomain(r.domain),
      lifecycle: LEGACY_GOAL_LIFECYCLE[String(r.status)] ?? "active",
      priority: (["critical", "high", "normal", "low", "paused"].includes(String(r.priority))
        ? (r.priority as PriorityBand)
        : "normal"),
      deadline: typeof r.deadline === "string" && r.deadline ? r.deadline : null,
      metric,
      detail: typeof r.detail === "string" ? r.detail : "",
      createdBy: r.createdBy === "ai-approved" ? "ai-approved" : "user",
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.goals++;

    // legacy Goal.systemIds[]
    if (Array.isArray(r.systemIds)) {
      for (const sid of r.systemIds) if (typeof sid === "string") addLink(id, sid);
    }
  }

  // legacy System.goalId (the other half of the duelling relationship)
  for (const row of s.items) {
    const r = row as Record<string, unknown> | null;
    if (r && typeof r.id === "string" && typeof r.goalId === "string" && r.goalId) {
      addLink(r.goalId, r.id);
    }
  }

  // --- actions --- (Action.systemId is authoritative)
  const actions: Action[] = [];
  const actionIds = new Set<string>();
  const positionBySystem = new Map<string | null, number>();
  const sortedLegacyActions = [...a.items]
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .sort((x, y) => Number(x.order ?? 0) - Number(y.order ?? 0));

  for (const r of sortedLegacyActions) {
    const id = typeof r.id === "string" && r.id ? r.id : newId("act");
    if (actionIds.has(id)) {
      report.repairs.push(`duplicate action id ${id} skipped`);
      continue;
    }
    actionIds.add(id);

    let systemId: string | null =
      typeof r.systemId === "string" && systemIds.has(r.systemId) ? r.systemId : null;
    if (typeof r.systemId === "string" && r.systemId && systemId === null) {
      report.repairs.push(`action ${id} pointed at missing system ${r.systemId} → direct commitment`);
    }

    const pos = positionBySystem.get(systemId) ?? 0;
    positionBySystem.set(systemId, pos + 1);

    const est = Number(r.estMinutes);
    actions.push({
      id,
      systemId,
      title: typeof r.title === "string" ? r.title : "Untitled action",
      context: typeof r.context === "string" ? r.context : "",
      status: normalizeActionStatus(r.status),
      estMinutes: Number.isInteger(est) && est > 0 ? est : null,
      priority: LEGACY_ACTION_PRIORITY[String(r.priority)] ?? "normal",
      timing: typeof r.triggerTiming === "string" ? r.triggerTiming : typeof r.timing === "string" ? r.timing : "",
      position: pos,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.actions++;
  }

  // legacy System.actionIds disagreement check (Action.systemId already won)
  for (const row of s.items) {
    const r = row as Record<string, unknown> | null;
    if (r && Array.isArray(r.actionIds) && typeof r.id === "string") {
      for (const aid of r.actionIds) {
        const act = actions.find((x) => x.id === aid);
        if (!act) {
          report.repairs.push(`system ${r.id}.actionIds listed ${aid}, but no such action exists — dropped`);
        } else if (act.systemId !== r.id) {
          report.repairs.push(
            `system ${r.id}.actionIds listed ${aid}, but the action's own systemId (${act.systemId ?? "null"}) wins`,
          );
        }
      }
    }
  }

  return { graph: { goals, systems, actions, links }, report };
}
