// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeDevelopmentRepo } from "./repo";
import type { Milestone, Project, Skill, SkillEvidence } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
const project = (id: string): Project => ({
  id,
  title: `Project ${id}`,
  status: "active",
  description: "",
  archived: false,
  createdAt: TS,
  updatedAt: TS,
});
const skill = (id: string): Skill => ({
  id,
  title: `Skill ${id}`,
  category: "",
  knowledgePercent: 10,
  practicePercent: 10,
  roadmapPosition: null,
  roadmapTargetLevel: null,
  knowledgeTopicId: null,
  archived: false,
  createdAt: TS,
  updatedAt: TS,
});
const milestone = (id: string, projectId: string): Milestone => ({
  id,
  projectId,
  title: `MS ${id}`,
  completed: false,
  position: 0,
  createdAt: TS,
  updatedAt: TS,
});
const evidence = (id: string, skillId: string, projectId: string | null): SkillEvidence => ({
  id,
  skillId,
  projectId,
  title: `Ev ${id}`,
  provenance: "independent",
  date: "2026-08-01",
  knowledgeEvidenceId: null,
  createdAt: TS,
  updatedAt: TS,
});

beforeEach(() => window.localStorage.clear());

describe("makeDevelopmentRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeDevelopmentRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — CRUD + relationships + restart persistence", () => {
  it("round-trips the graph and survives a fresh instance", async () => {
    const repo = new LocalRepo();
    await repo.projectUpsert(project("p1"));
    await repo.skillUpsert(skill("s1"));
    await repo.milestoneUpsert(milestone("m1", "p1"));
    await repo.evidenceUpsert(evidence("e1", "s1", "p1"));
    await repo.linkSet("p1", "s1", true);

    const g = await new LocalRepo().load();
    expect(g.projects).toHaveLength(1);
    expect(g.skills).toHaveLength(1);
    expect(g.milestones).toHaveLength(1);
    expect(g.evidence).toHaveLength(1);
    expect(g.links).toEqual([{ projectId: "p1", skillId: "s1" }]);
  });

  it("preserves createdAt on update", async () => {
    const repo = new LocalRepo();
    await repo.projectUpsert(project("p1"));
    await repo.projectUpsert({ ...project("p1"), title: "renamed", createdAt: "2099-01-01" });
    const g = await repo.load();
    expect(g.projects[0].title).toBe("renamed");
    expect(g.projects[0].createdAt).toBe(TS);
  });

  it("deleting a project cascades milestones + links, and NULLs evidence.projectId", async () => {
    const repo = new LocalRepo();
    await repo.projectUpsert(project("p1"));
    await repo.skillUpsert(skill("s1"));
    await repo.milestoneUpsert(milestone("m1", "p1"));
    await repo.evidenceUpsert(evidence("e1", "s1", "p1"));
    await repo.linkSet("p1", "s1", true);

    await repo.projectDelete("p1");
    const g = await repo.load();
    expect(g.projects).toHaveLength(0);
    expect(g.milestones).toHaveLength(0);
    expect(g.links).toHaveLength(0);
    expect(g.evidence).toHaveLength(1);
    expect(g.evidence[0].projectId).toBeNull();
  });

  it("deleting a skill cascades its evidence and links", async () => {
    const repo = new LocalRepo();
    await repo.projectUpsert(project("p1"));
    await repo.skillUpsert(skill("s1"));
    await repo.evidenceUpsert(evidence("e1", "s1", "p1"));
    await repo.linkSet("p1", "s1", true);
    await repo.skillDelete("s1");
    const g = await repo.load();
    expect(g.evidence).toHaveLength(0);
    expect(g.links).toHaveLength(0);
  });

  it("refuses a milestone / evidence whose parent does not exist (FK)", async () => {
    const repo = new LocalRepo();
    await repo.milestoneUpsert(milestone("m1", "ghost"));
    await repo.evidenceUpsert(evidence("e1", "ghost", null));
    const g = await repo.load();
    expect(g.milestones).toHaveLength(0);
    expect(g.evidence).toHaveLength(0);
  });

  it("refuses a link to a non-existent project or skill", async () => {
    const repo = new LocalRepo();
    await repo.projectUpsert(project("p1"));
    await repo.linkSet("p1", "ghost", true);
    expect((await repo.load()).links).toHaveLength(0);
  });

  it("importGraph is idempotent, drops orphans, never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importGraph({
      projects: [project("p1")],
      skills: [skill("s1")],
      milestones: [milestone("m1", "p1"), milestone("m-ghost", "no-project")],
      evidence: [evidence("e1", "s1", "p1"), evidence("e2", "no-skill", null)],
      links: [
        { projectId: "p1", skillId: "s1" },
        { projectId: "p1", skillId: "ghost" },
      ],
    });
    expect(r1.ran).toBe(true);
    expect(r1.milestonesImported).toBe(1);
    expect(r1.evidenceImported).toBe(1);
    expect(r1.linksImported).toBe(1);

    await repo.projectUpsert({ ...project("p1"), title: "EDITED" });
    const r2 = await repo.importGraph({
      projects: [project("p1")],
      skills: [],
      milestones: [],
      evidence: [],
      links: [],
    });
    expect(r2.ran).toBe(false);
    expect((await repo.load()).projects[0].title).toBe("EDITED");
  });
});
