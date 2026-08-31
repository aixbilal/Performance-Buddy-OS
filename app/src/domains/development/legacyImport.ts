/**
 * One-time migration of the pre-2B Development KV blobs into the canonical
 * relational graph. Pure and fully testable.
 *
 * Legacy keys:
 *   pbos:development-projects   -> Project[]   (old shape: `skillIds: string[]`)
 *   pbos:development-skills     -> Skill[]
 *   pbos:development-milestones -> Milestone[] (old shape: `order`)
 *   pbos:development-evidence   -> SkillEvidence[]
 *
 * Guarantees:
 *   - parse safely; malformed rows reported, never silently dropped
 *   - preserve IDs
 *   - the legacy `Project.skillIds[]` reverse-array is resolved into
 *     `project_skill_links` (deduped, dangling entries reported)
 *   - dangling milestones / evidence (missing parent) reported + dropped
 *   - NO fabricated skill evidence or capability numbers
 */
import { newId } from "./ids";
import { isSkillLevel } from "./engine";
import {
  PROJECT_STATUSES,
  PROVENANCES,
  type DevGraph,
  type Milestone,
  type Project,
  type ProjectSkillLink,
  type ProjectStatus,
  type Provenance,
  type Skill,
  type SkillEvidence,
} from "./types";

export type DevLegacyReport = {
  parsed: { projects: number; skills: number; milestones: number; evidence: number };
  malformed: string[];
  repairs: string[];
};

export type DevLegacyResult = { graph: DevGraph; report: DevLegacyReport };

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

function coerceStatus(raw: unknown): ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(raw as string)
    ? (raw as ProjectStatus)
    : "active";
}
function coerceProvenance(raw: unknown, report: DevLegacyReport, where: string): Provenance {
  if ((PROVENANCES as readonly string[]).includes(raw as string)) return raw as Provenance;
  report.repairs.push(`${where}: unknown provenance ${JSON.stringify(raw)} → "ai-assisted"`);
  return "ai-assisted";
}

export function resolveLegacyDevelopment(raw: {
  projects: string | null;
  skills: string | null;
  milestones: string | null;
  evidence: string | null;
}): DevLegacyResult {
  const report: DevLegacyReport = {
    parsed: { projects: 0, skills: 0, milestones: 0, evidence: 0 },
    malformed: [],
    repairs: [],
  };

  const p = asArray(raw.projects);
  const s = asArray(raw.skills);
  const m = asArray(raw.milestones);
  const e = asArray(raw.evidence);
  if (p.malformed) report.malformed.push("pbos:development-projects");
  if (s.malformed) report.malformed.push("pbos:development-skills");
  if (m.malformed) report.malformed.push("pbos:development-milestones");
  if (e.malformed) report.malformed.push("pbos:development-evidence");

  // --- skills ---
  const skills: Skill[] = [];
  const skillIds = new Set<string>();
  for (const row of s.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a skill row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("skill");
    if (skillIds.has(id)) {
      report.repairs.push(`duplicate skill id ${id} skipped`);
      continue;
    }
    skillIds.add(id);
    const k = Number(r.knowledgePercent);
    const pr = Number(r.practicePercent);
    skills.push({
      id,
      title: typeof r.title === "string" ? r.title : "Untitled skill",
      category: typeof r.category === "string" ? r.category : "",
      knowledgePercent: Number.isFinite(k) ? clampPercent(k) : 0,
      practicePercent: Number.isFinite(pr) ? clampPercent(pr) : 0,
      roadmapPosition: Number.isInteger(r.roadmapPosition) ? (r.roadmapPosition as number) : null,
      roadmapTargetLevel: isSkillLevel(r.roadmapTargetLevel) ? r.roadmapTargetLevel : null,
      archived: r.archived === true,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.skills++;
  }

  // --- projects + links (from legacy Project.skillIds[]) ---
  const projects: Project[] = [];
  const projectIds = new Set<string>();
  const links: ProjectSkillLink[] = [];
  const linkKey = new Set<string>();
  for (const row of p.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a project row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("proj");
    if (projectIds.has(id)) {
      report.repairs.push(`duplicate project id ${id} skipped`);
      continue;
    }
    projectIds.add(id);
    projects.push({
      id,
      title: typeof r.title === "string" ? r.title : "Untitled project",
      status: coerceStatus(r.status),
      description: typeof r.description === "string" ? r.description : "",
      archived: r.archived === true,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.projects++;

    if (Array.isArray(r.skillIds)) {
      for (const sid of r.skillIds) {
        if (typeof sid !== "string") continue;
        if (!skillIds.has(sid)) {
          report.repairs.push(`project ${id} → skill link ${sid} dropped (skill not found)`);
          continue;
        }
        const key = `${id}::${sid}`;
        if (!linkKey.has(key)) {
          linkKey.add(key);
          links.push({ projectId: id, skillId: sid });
        }
      }
    }
  }

  // --- milestones --- (legacy `order` -> `position`)
  const milestones: Milestone[] = [];
  const milestoneIds = new Set<string>();
  const positionByProject = new Map<string, number>();
  const sorted = [...m.items]
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  for (const r of sorted) {
    const id = typeof r.id === "string" && r.id ? r.id : newId("ms");
    if (milestoneIds.has(id)) {
      report.repairs.push(`duplicate milestone id ${id} skipped`);
      continue;
    }
    const projectId = typeof r.projectId === "string" ? r.projectId : "";
    if (!projectIds.has(projectId)) {
      report.repairs.push(`milestone ${id} → missing project ${projectId || "(none)"} — dropped`);
      continue;
    }
    milestoneIds.add(id);
    const pos = positionByProject.get(projectId) ?? 0;
    positionByProject.set(projectId, pos + 1);
    milestones.push({
      id,
      projectId,
      title: typeof r.title === "string" ? r.title : "Untitled milestone",
      completed: r.completed === true,
      position: pos,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.milestones++;
  }

  // --- evidence ---
  const evidence: SkillEvidence[] = [];
  const evidenceIds = new Set<string>();
  for (const row of e.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("an evidence row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("sev");
    if (evidenceIds.has(id)) {
      report.repairs.push(`duplicate evidence id ${id} skipped`);
      continue;
    }
    const skillId = typeof r.skillId === "string" ? r.skillId : "";
    if (!skillIds.has(skillId)) {
      report.repairs.push(`evidence ${id} → missing skill ${skillId || "(none)"} — dropped`);
      continue;
    }
    evidenceIds.add(id);
    const projectId =
      typeof r.projectId === "string" && projectIds.has(r.projectId) ? r.projectId : null;
    if (typeof r.projectId === "string" && r.projectId && projectId === null) {
      report.repairs.push(`evidence ${id} → project ${r.projectId} not found; kept without a project`);
    }
    evidence.push({
      id,
      skillId,
      projectId,
      title: typeof r.title === "string" ? r.title : "Recorded evidence",
      provenance: coerceProvenance(r.provenance, report, `evidence ${id}`),
      date: typeof r.date === "string" ? r.date : "",
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.evidence++;
  }

  return { graph: { projects, skills, milestones, evidence, links }, report };
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}
