/**
 * Canonical relational persistence for the Development domain.
 *
 *   store.tsx  ->  DevelopmentRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                                  \->  { localStorage JSON }  (browser dev only)
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DevGraph, Milestone, Project, Skill, SkillEvidence } from "./types";

export type DevImportReport = {
  ran: boolean;
  projectsImported: number;
  skillsImported: number;
  milestonesImported: number;
  evidenceImported: number;
  linksImported: number;
};

export interface DevelopmentRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<DevGraph>;
  projectUpsert(project: Project): Promise<void>;
  projectDelete(id: string): Promise<void>;
  skillUpsert(skill: Skill): Promise<void>;
  skillDelete(id: string): Promise<void>;
  milestoneUpsert(milestone: Milestone): Promise<void>;
  milestoneDelete(id: string): Promise<void>;
  milestonesReorder(projectId: string, orderedIds: string[]): Promise<void>;
  evidenceUpsert(evidence: SkillEvidence): Promise<void>;
  evidenceDelete(id: string): Promise<void>;
  linkSet(projectId: string, skillId: string, linked: boolean): Promise<void>;
  /** Batch 5 — set/clear a Skill's Knowledge concept reference (dangling-safe). */
  skillLinkKnowledge(skillId: string, topicId: string | null): Promise<void>;
  /** Batch 5 — set-once handoff; returns the effective Knowledge Evidence id. */
  skillEvidenceLinkKnowledge(
    evidenceId: string,
    knowledgeEvidenceId: string,
  ): Promise<string | null>;
  importGraph(graph: DevGraph): Promise<DevImportReport>;
}

const EMPTY: DevGraph = { projects: [], skills: [], milestones: [], evidence: [], links: [] };

function normReport(r: Record<string, unknown>): DevImportReport {
  const num = (a: unknown, b: unknown) => Number(a ?? b ?? 0);
  return {
    ran: !!r.ran,
    projectsImported: num(r.projectsImported, r.projects_imported),
    skillsImported: num(r.skillsImported, r.skills_imported),
    milestonesImported: num(r.milestonesImported, r.milestones_imported),
    evidenceImported: num(r.evidenceImported, r.evidence_imported),
    linksImported: num(r.linksImported, r.links_imported),
  };
}

// --- Tauri / SQLite --------------------------------------------------------

class SqliteRepo implements DevelopmentRepo {
  readonly kind = "sqlite" as const;
  async load() {
    return await invoke<DevGraph>("dev_load");
  }
  async projectUpsert(project: Project) {
    await invoke("dev_project_upsert", { project });
  }
  async projectDelete(id: string) {
    await invoke("dev_project_delete", { id });
  }
  async skillUpsert(skill: Skill) {
    await invoke("dev_skill_upsert", { skill });
  }
  async skillDelete(id: string) {
    await invoke("dev_skill_delete", { id });
  }
  async milestoneUpsert(milestone: Milestone) {
    await invoke("dev_milestone_upsert", { milestone });
  }
  async milestoneDelete(id: string) {
    await invoke("dev_milestone_delete", { id });
  }
  async milestonesReorder(projectId: string, orderedIds: string[]) {
    await invoke("dev_milestones_reorder", { projectId, orderedIds });
  }
  async evidenceUpsert(evidence: SkillEvidence) {
    await invoke("dev_evidence_upsert", { evidence });
  }
  async evidenceDelete(id: string) {
    await invoke("dev_evidence_delete", { id });
  }
  async linkSet(projectId: string, skillId: string, linked: boolean) {
    await invoke("dev_link_set", { projectId, skillId, linked });
  }
  async skillLinkKnowledge(skillId: string, topicId: string | null) {
    await invoke("dev_skill_link_knowledge", { skillId, topicId });
  }
  async skillEvidenceLinkKnowledge(evidenceId: string, knowledgeEvidenceId: string) {
    return (
      (await invoke<string | null>("dev_skill_evidence_link_knowledge", {
        evidenceId,
        knowledgeEvidenceId,
      })) ?? null
    );
  }
  async importGraph(graph: DevGraph) {
    return normReport(await invoke("dev_import_graph", { import: graph }));
  }
}

// --- localStorage (browser dev fallback) ---------------------------------

const LS_KEY = "pbos:development-v2";
const LS_IMPORT_MARK = "pbos:development-v2-imported";

export class LocalRepo implements DevelopmentRepo {
  readonly kind = "localStorage" as const;

  private read(): DevGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { ...EMPTY };
      const g = JSON.parse(raw) as DevGraph;
      return {
        projects: g.projects ?? [],
        skills: g.skills ?? [],
        milestones: g.milestones ?? [],
        evidence: g.evidence ?? [],
        links: g.links ?? [],
      };
    } catch {
      return { ...EMPTY };
    }
  }
  private write(g: DevGraph) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(g));
  }
  private upsert<T extends { id: string; createdAt: string }>(arr: T[], row: T): T[] {
    const i = arr.findIndex((x) => x.id === row.id);
    if (i >= 0) {
      const next = [...arr];
      next[i] = { ...row, createdAt: arr[i].createdAt };
      return next;
    }
    return [...arr, row];
  }

  async load() {
    return this.read();
  }
  async projectUpsert(project: Project) {
    const g = this.read();
    g.projects = this.upsert(g.projects, project);
    this.write(g);
  }
  async projectDelete(id: string) {
    const g = this.read();
    g.projects = g.projects.filter((p) => p.id !== id);
    g.milestones = g.milestones.filter((m) => m.projectId !== id);
    g.links = g.links.filter((l) => l.projectId !== id);
    g.evidence = g.evidence.map((e) => (e.projectId === id ? { ...e, projectId: null } : e));
    this.write(g);
  }
  async skillUpsert(skill: Skill) {
    const g = this.read();
    // knowledgeTopicId is owned by skillLinkKnowledge — never clobbered by a
    // plain skill upsert (mirrors the Rust column ownership).
    const prev = g.skills.find((s) => s.id === skill.id);
    g.skills = this.upsert(g.skills, {
      ...skill,
      knowledgeTopicId: prev ? prev.knowledgeTopicId : (skill.knowledgeTopicId ?? null),
    });
    this.write(g);
  }
  async skillLinkKnowledge(skillId: string, topicId: string | null) {
    const g = this.read();
    const resolved = topicId && g.skills.length ? topicId : topicId; // adapter: no topics table
    g.skills = g.skills.map((s) =>
      s.id === skillId ? { ...s, knowledgeTopicId: resolved ?? null } : s,
    );
    this.write(g);
  }
  async skillEvidenceLinkKnowledge(evidenceId: string, knowledgeEvidenceId: string) {
    const g = this.read();
    const ev = g.evidence.find((e) => e.id === evidenceId);
    if (!ev) return null;
    if (ev.knowledgeEvidenceId) return ev.knowledgeEvidenceId; // set-once
    g.evidence = g.evidence.map((e) =>
      e.id === evidenceId ? { ...e, knowledgeEvidenceId } : e,
    );
    this.write(g);
    return knowledgeEvidenceId;
  }
  async skillDelete(id: string) {
    const g = this.read();
    g.skills = g.skills.filter((s) => s.id !== id);
    g.evidence = g.evidence.filter((e) => e.skillId !== id);
    g.links = g.links.filter((l) => l.skillId !== id);
    this.write(g);
  }
  async milestoneUpsert(milestone: Milestone) {
    const g = this.read();
    if (!g.projects.some((p) => p.id === milestone.projectId)) return; // FK
    g.milestones = this.upsert(g.milestones, milestone);
    this.write(g);
  }
  async milestoneDelete(id: string) {
    const g = this.read();
    g.milestones = g.milestones.filter((m) => m.id !== id);
    this.write(g);
  }
  async milestonesReorder(projectId: string, orderedIds: string[]) {
    const g = this.read();
    g.milestones = g.milestones.map((m) => {
      if (m.projectId !== projectId) return m;
      const pos = orderedIds.indexOf(m.id);
      return pos >= 0 ? { ...m, position: pos } : m;
    });
    this.write(g);
  }
  async evidenceUpsert(evidence: SkillEvidence) {
    const g = this.read();
    if (!g.skills.some((s) => s.id === evidence.skillId)) return; // FK
    const projectId =
      evidence.projectId && g.projects.some((p) => p.id === evidence.projectId)
        ? evidence.projectId
        : null;
    // knowledgeEvidenceId is set-once, owned by skillEvidenceLinkKnowledge.
    const prev = g.evidence.find((e) => e.id === evidence.id);
    g.evidence = this.upsert(g.evidence, {
      ...evidence,
      projectId,
      knowledgeEvidenceId: prev
        ? prev.knowledgeEvidenceId
        : (evidence.knowledgeEvidenceId ?? null),
    });
    this.write(g);
  }
  async evidenceDelete(id: string) {
    const g = this.read();
    g.evidence = g.evidence.filter((e) => e.id !== id);
    this.write(g);
  }
  async linkSet(projectId: string, skillId: string, linked: boolean) {
    const g = this.read();
    const exists = g.links.some((l) => l.projectId === projectId && l.skillId === skillId);
    if (
      linked &&
      !exists &&
      g.projects.some((p) => p.id === projectId) &&
      g.skills.some((s) => s.id === skillId)
    ) {
      g.links.push({ projectId, skillId });
    } else if (!linked) {
      g.links = g.links.filter((l) => !(l.projectId === projectId && l.skillId === skillId));
    }
    this.write(g);
  }
  async importGraph(graph: DevGraph): Promise<DevImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return {
        ran: false,
        projectsImported: 0,
        skillsImported: 0,
        milestonesImported: 0,
        evidenceImported: 0,
        linksImported: 0,
      };
    }
    const g = this.read();
    const has = (arr: { id: string }[], id: string) => arr.some((x) => x.id === id);
    const report: DevImportReport = {
      ran: true,
      projectsImported: 0,
      skillsImported: 0,
      milestonesImported: 0,
      evidenceImported: 0,
      linksImported: 0,
    };
    for (const p of graph.projects)
      if (!has(g.projects, p.id)) {
        g.projects.push(p);
        report.projectsImported++;
      }
    for (const s of graph.skills)
      if (!has(g.skills, s.id)) {
        g.skills.push(s);
        report.skillsImported++;
      }
    for (const m of graph.milestones) {
      if (has(g.milestones, m.id) || !has(g.projects, m.projectId)) continue;
      g.milestones.push(m);
      report.milestonesImported++;
    }
    for (const e of graph.evidence) {
      if (has(g.evidence, e.id) || !has(g.skills, e.skillId)) continue;
      const projectId = e.projectId && has(g.projects, e.projectId) ? e.projectId : null;
      g.evidence.push({ ...e, projectId });
      report.evidenceImported++;
    }
    for (const l of graph.links) {
      if (
        has(g.projects, l.projectId) &&
        has(g.skills, l.skillId) &&
        !g.links.some((x) => x.projectId === l.projectId && x.skillId === l.skillId)
      ) {
        g.links.push(l);
        report.linksImported++;
      }
    }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makeDevelopmentRepo(): DevelopmentRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
