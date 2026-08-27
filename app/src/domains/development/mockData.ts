import type { Milestone, Project, Skill, SkillEvidence } from "./types";

/** Values below match PBOS-Development-Overview and PBOS-Development-Skill-Detail approved references. */

export const SEED_PROJECTS: Project[] = [
  {
    id: "proj-pbos",
    title: "Performance Buddy OS",
    status: "active",
    description: "Academic & Knowledge APIs",
    skillIds: ["skill-rest-apis"],
  },
  {
    id: "proj-tinytots",
    title: "TinyTots OS",
    status: "active",
    description: "Product & Cart APIs",
    skillIds: ["skill-rest-apis"],
  },
  {
    id: "proj-legrain",
    title: "Le Grain OS",
    status: "paused",
    description: "Backend Integration",
    skillIds: ["skill-rest-apis"],
  },
];

export const SEED_MILESTONES: Milestone[] = [
  { id: "m1", projectId: "proj-pbos", title: "App Shell + Today", completed: true, order: 1 },
  { id: "m2", projectId: "proj-pbos", title: "Academic OS", completed: true, order: 2 },
  { id: "m3", projectId: "proj-pbos", title: "Knowledge OS", completed: true, order: 3 },
  { id: "m4", projectId: "proj-pbos", title: "Development OS", completed: false, order: 4 },
];

export const SEED_SKILLS: Skill[] = [
  {
    id: "skill-rest-apis",
    title: "REST APIs",
    category: "Backend · APIs",
    knowledgePercent: 85,
    practicePercent: 60,
  },
];

export const SEED_EVIDENCE: SkillEvidence[] = [
  {
    id: "sev-1",
    skillId: "skill-rest-apis",
    projectId: null,
    title: "REST API Theory Test — 9/10",
    provenance: "independent",
    date: "2026-08-18",
  },
  {
    id: "sev-2",
    skillId: "skill-rest-apis",
    projectId: null,
    title: "CRUD Exercise (JSON Server)",
    provenance: "independent",
    date: "2026-08-21",
  },
  {
    id: "sev-3",
    skillId: "skill-rest-apis",
    projectId: "proj-pbos",
    title: "Performance Buddy OS — Academic API",
    provenance: "ai-assisted-reviewed",
    date: "2026-08-26",
  },
  {
    id: "sev-4",
    skillId: "skill-rest-apis",
    projectId: "proj-tinytots",
    title: "TinyTots OS — Cart API",
    provenance: "ai-assisted-reviewed",
    date: "2026-08-20",
  },
  {
    id: "sev-5",
    skillId: "skill-rest-apis",
    projectId: "proj-legrain",
    title: "Le Grain OS — Partial Implementation",
    provenance: "ai-assisted",
    date: "2026-08-19",
  },
];
