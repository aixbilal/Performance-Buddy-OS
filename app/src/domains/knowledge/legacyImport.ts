/**
 * One-time migration of the pre-2A Knowledge KV blobs into the canonical
 * relational graph. Pure and fully testable.
 *
 * Legacy keys (see the old `usePersistedState` calls in store.tsx):
 *   pbos:knowledge-topics   -> Topic[]     (old shape: had a stored `masteryPercent`)
 *   pbos:knowledge-sources  -> Source[]
 *   pbos:knowledge-evidence -> Evidence[]
 *
 * Guarantees (batch §10):
 *   - parse safely; malformed rows are reported, never thrown away silently
 *   - preserve existing IDs
 *   - the legacy stored `masteryPercent` is DROPPED — mastery is now derived
 *     from evidence, and a stored number would be a fabricated second truth.
 *     No evidence or mastery is invented. No Obsidian data is invented.
 *   - dangling sources / evidence (topicId not among imported topics) are
 *     reported and dropped, never attached to a guessed topic.
 */
import { newId } from "./ids";
import {
  EVIDENCE_TYPES,
  KNOWLEDGE_CATEGORIES,
  SOURCE_TYPES,
  type Evidence,
  type EvidenceType,
  type KnowledgeCategory,
  type KnowledgeGraph,
  type KnowledgeTopic,
  type Source,
  type SourceType,
} from "./types";

export type KnowledgeLegacyReport = {
  parsed: { topics: number; sources: number; evidence: number };
  malformed: string[];
  repairs: string[];
};

export type KnowledgeLegacyResult = { graph: KnowledgeGraph; report: KnowledgeLegacyReport };

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

function coerceCategory(raw: unknown): KnowledgeCategory {
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(raw as string)
    ? (raw as KnowledgeCategory)
    : "general";
}
function coerceSourceType(raw: unknown): SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(raw as string)
    ? (raw as SourceType)
    : "article";
}
function coerceEvidenceType(raw: unknown): EvidenceType {
  return (EVIDENCE_TYPES as readonly string[]).includes(raw as string)
    ? (raw as EvidenceType)
    : "recall";
}

export function resolveLegacyKnowledge(raw: {
  topics: string | null;
  sources: string | null;
  evidence: string | null;
}): KnowledgeLegacyResult {
  const report: KnowledgeLegacyReport = {
    parsed: { topics: 0, sources: 0, evidence: 0 },
    malformed: [],
    repairs: [],
  };

  const t = asArray(raw.topics);
  const s = asArray(raw.sources);
  const e = asArray(raw.evidence);
  if (t.malformed) report.malformed.push("pbos:knowledge-topics");
  if (s.malformed) report.malformed.push("pbos:knowledge-sources");
  if (e.malformed) report.malformed.push("pbos:knowledge-evidence");

  // --- topics --- (stored masteryPercent is intentionally discarded)
  const topics: KnowledgeTopic[] = [];
  const topicIds = new Set<string>();
  for (const row of t.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a topic row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("kt");
    if (topicIds.has(id)) {
      report.repairs.push(`duplicate topic id ${id} skipped`);
      continue;
    }
    if (r.masteryPercent !== undefined) {
      report.repairs.push(
        `topic ${id}: dropped stored masteryPercent (${String(r.masteryPercent)}) — mastery is now evidence-derived`,
      );
    }
    topicIds.add(id);
    topics.push({
      id,
      title: typeof r.title === "string" ? r.title : "Untitled topic",
      category: coerceCategory(r.category),
      context: typeof r.context === "string" ? r.context : "",
      lastStudied: typeof r.lastStudied === "string" && r.lastStudied ? r.lastStudied : null,
      nextReviewDate:
        typeof r.nextReviewDate === "string" && r.nextReviewDate ? r.nextReviewDate : null,
      relatedGoalId: typeof r.relatedGoalId === "string" && r.relatedGoalId ? r.relatedGoalId : null,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.topics++;
  }

  // --- sources ---
  const sources: Source[] = [];
  const sourceIds = new Set<string>();
  for (const row of s.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a source row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("ks");
    if (sourceIds.has(id)) {
      report.repairs.push(`duplicate source id ${id} skipped`);
      continue;
    }
    const topicId = typeof r.topicId === "string" ? r.topicId : "";
    if (!topicIds.has(topicId)) {
      report.repairs.push(`source ${id} → missing topic ${topicId || "(none)"} — dropped`);
      continue;
    }
    sourceIds.add(id);
    sources.push({
      id,
      topicId,
      type: coerceSourceType(r.type),
      title: typeof r.title === "string" ? r.title : "Untitled source",
      reference: typeof r.reference === "string" ? r.reference : "",
      addedDate: typeof r.addedDate === "string" ? r.addedDate : "",
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.sources++;
  }

  // --- evidence ---
  const evidence: Evidence[] = [];
  const evidenceIds = new Set<string>();
  for (const row of e.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("an evidence row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("ke");
    if (evidenceIds.has(id)) {
      report.repairs.push(`duplicate evidence id ${id} skipped`);
      continue;
    }
    const topicId = typeof r.topicId === "string" ? r.topicId : "";
    if (!topicIds.has(topicId)) {
      report.repairs.push(`evidence ${id} → missing topic ${topicId || "(none)"} — dropped`);
      continue;
    }
    const score = Number(r.score);
    const maxScore = Number(r.maxScore);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
      report.repairs.push(`evidence ${id}: unusable score/maxScore — dropped`);
      continue;
    }
    evidenceIds.add(id);
    evidence.push({
      id,
      topicId,
      type: coerceEvidenceType(r.type),
      title: typeof r.title === "string" ? r.title : "Recorded evidence",
      score,
      maxScore,
      date: typeof r.date === "string" ? r.date : "",
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.evidence++;
  }

  return { graph: { topics, sources, evidence }, report };
}
