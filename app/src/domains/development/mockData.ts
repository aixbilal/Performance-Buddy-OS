/**
 * TEST / DEMO FIXTURES ONLY — Batch 2B.
 *
 * NOT loaded as user data. A fresh production profile starts empty (store.tsx:
 * no seed, relational SQLite authoritative). These fixtures give engine/repo
 * tests and E2E a known "PBOS project + React skill" scenario.
 *
 * Nothing in `src/` imports this file outside `*.test.*`.
 */
import type { Milestone, Project, ProjectSkillLink, Skill, SkillEvidence } from "./types";

const TS = "2026-01-01T00:00:00.000Z";

export const FIXTURE_PROJECTS: Project[] = [
  {
    id: "proj-pbos",
    title: "Performance Buddy OS",
    status: "active",
    description: "Academic & Knowledge APIs",
    archived: false,
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_SKILLS: Skill[] = [
  {
    id: "skill-react",
    title: "React",
    category: "Frontend",
    knowledgePercent: 70,
    practicePercent: 55,
    roadmapPosition: null,
    roadmapTargetLevel: null,
    knowledgeTopicId: null,
    archived: false,
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_MILESTONES: Milestone[] = [
  {
    id: "m1",
    projectId: "proj-pbos",
    title: "Build dashboard",
    completed: false,
    position: 0,
    createdAt: TS,
    updatedAt: TS,
  },
];

export const FIXTURE_LINKS: ProjectSkillLink[] = [{ projectId: "proj-pbos", skillId: "skill-react" }];

export const FIXTURE_EVIDENCE: SkillEvidence[] = [
  {
    id: "sev-1",
    skillId: "skill-react",
    projectId: "proj-pbos",
    title: "Built the dashboard layout myself",
    provenance: "independent",
    date: "2026-08-18",
    knowledgeEvidenceId: null,
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: "sev-2",
    skillId: "skill-react",
    projectId: "proj-pbos",
    title: "AI wrote the data hook, not reviewed",
    provenance: "ai-assisted",
    date: "2026-08-20",
    knowledgeEvidenceId: null,
    createdAt: TS,
    updatedAt: TS,
  },
];
