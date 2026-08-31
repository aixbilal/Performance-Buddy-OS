/**
 * One-time migration of the pre-Batch-3 Planning KV blobs into the canonical
 * relational graph. Pure and fully testable.
 *
 * Legacy keys:
 *   pbos:planning-blocks   -> ScheduleBlock[]  (old shape: no date / source / status / timestamps)
 *   pbos:planning-capacity -> CapacityConfig
 *
 * Guarantees: parse safely, preserve IDs, default missing provenance to
 * 'manual' and missing status to 'scheduled', keep an Action reference as-is
 * (the repo clears it if the Action is gone and reports that), drop malformed
 * rows with a report, idempotent, non-destructive, never fabricate blocks.
 */
import { newId } from "./ids";
import { DEFAULT_CAPACITY, type BlockType, type CapacityConfig, type PlanningBlock, type PlanningGraph } from "./types";

export type PlanningLegacyReport = {
  parsed: { blocks: number };
  malformed: string[];
  repairs: string[];
};

export type PlanningLegacyResult = { graph: PlanningGraph; report: PlanningLegacyReport };

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

const intOr = (v: unknown, fallback: number): number =>
  Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback;

function coerceType(v: unknown): BlockType {
  return v === "fixed" ? "fixed" : "flexible";
}

function parseCapacity(raw: string | null, report: PlanningLegacyReport): CapacityConfig {
  if (raw == null) return { ...DEFAULT_CAPACITY };
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const daily = intOr(v.dailyCapacityMinutes, DEFAULT_CAPACITY.dailyCapacityMinutes);
    const weekly = intOr(v.weeklyCapacityMinutes, DEFAULT_CAPACITY.weeklyCapacityMinutes);
    return { dailyCapacityMinutes: daily, weeklyCapacityMinutes: weekly };
  } catch {
    report.malformed.push("pbos:planning-capacity");
    return { ...DEFAULT_CAPACITY };
  }
}

export function resolveLegacyPlanning(raw: {
  blocks: string | null;
  capacity: string | null;
}): PlanningLegacyResult {
  const report: PlanningLegacyReport = { parsed: { blocks: 0 }, malformed: [], repairs: [] };

  const blocksArr = asArray(raw.blocks);
  if (blocksArr.malformed) report.malformed.push("pbos:planning-blocks");

  const blocks: PlanningBlock[] = [];
  const seen = new Set<string>();
  for (const row of blocksArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a planning block row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("blk");
    if (seen.has(id)) {
      report.repairs.push(`duplicate block id ${id} skipped`);
      continue;
    }
    seen.add(id);

    const start = intOr(r.startMinute, 0);
    const end = intOr(r.endMinute, start);
    if (end <= start) {
      report.repairs.push(`block ${id}: non-positive duration — dropped`);
      continue;
    }

    blocks.push({
      id,
      title: typeof r.title === "string" ? r.title : "Untitled block",
      domain: typeof r.domain === "string" ? r.domain : "",
      actionId: typeof r.actionId === "string" && r.actionId ? r.actionId : null,
      day: Math.max(0, Math.min(6, intOr(r.day, 0))),
      date: typeof r.date === "string" && r.date ? r.date.slice(0, 10) : null,
      startMinute: start,
      endMinute: end,
      type: coerceType(r.type),
      locked: r.locked === true,
      source: r.source === "generated" ? "generated" : "manual",
      status: r.status === "done" ? "done" : r.status === "skipped" ? "skipped" : "scheduled",
      createdAt: typeof r.createdAt === "string" ? r.createdAt : NOW(),
      updatedAt: NOW(),
    });
    report.parsed.blocks++;
  }

  return { graph: { blocks, capacity: parseCapacity(raw.capacity, report) }, report };
}
