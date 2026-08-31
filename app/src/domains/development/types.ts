/**
 * Performance Buddy OS — Development OS domain model (Batch 2B: relational).
 *
 * Per Master Handoff §14 and Design Assets/07 - Development/README.md:
 *
 *   - Project progress ≠ Skill capability ≠ Knowledge mastery ≠ Action.
 *   - A Skill has THREE independent axes: Knowledge / Practice / Evidence —
 *     never collapsed into one score.
 *   - "AI built feature does not automatically mean user independently
 *     understands skill." Evidence carries a `provenance`; `evidencePercent`
 *     is DERIVED from provenance-weighted evidence (engine.ts) and is never
 *     stored.
 *
 * Relationship truth: `project_skill_links` (many-to-many) — no `skillIds[]`
 * array on the project row.
 */

export type SkillLevel = "not-started" | "learning" | "developing" | "strong";
export const SKILL_LEVELS: readonly SkillLevel[] = [
  "not-started",
  "learning",
  "developing",
  "strong",
];

export type ProjectStatus = "active" | "paused" | "completed";
export const PROJECT_STATUSES: readonly ProjectStatus[] = ["active", "paused", "completed"];

/**
 * Per Master Handoff §14: the three provenance values that materially change
 * whether evidence counts toward INDEPENDENT capability.
 */
export type Provenance = "independent" | "ai-assisted-reviewed" | "ai-assisted";
export const PROVENANCES: readonly Provenance[] = [
  "independent",
  "ai-assisted-reviewed",
  "ai-assisted",
];

// ---------------------------------------------------------------------------
// Canonical persisted rows (shape matches app/src-tauri/src/development.rs)
// ---------------------------------------------------------------------------

export type Project = {
  id: string;
  title: string;
  status: ProjectStatus;
  description: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Skill = {
  id: string;
  title: string;
  category: string;
  knowledgePercent: number; // "can explain it"
  practicePercent: number; // "has done it, help allowed"
  // evidencePercent is NOT stored — derived from SkillEvidence by the engine.
  /** Learning Path / Skill Roadmap: null = not on the path. */
  roadmapPosition: number | null;
  roadmapTargetLevel: SkillLevel | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Milestone = {
  id: string;
  projectId: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type SkillEvidence = {
  id: string;
  skillId: string;
  projectId: string | null;
  title: string;
  provenance: Provenance;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSkillLink = { projectId: string; skillId: string };

export type DevGraph = {
  projects: Project[];
  skills: Skill[];
  milestones: Milestone[];
  evidence: SkillEvidence[];
  links: ProjectSkillLink[];
};

// ---------------------------------------------------------------------------
// Form inputs + validation result
// ---------------------------------------------------------------------------

export type ProjectInput = {
  title: string;
  status: ProjectStatus;
  description: string;
};

export type SkillInput = {
  title: string;
  category: string;
  knowledgePercent: number;
  practicePercent: number;
};

export type MilestoneInput = { title: string };

export type EvidenceInput = {
  title: string;
  provenance: Provenance;
  projectId: string | null;
  date: string;
};

export type RoadmapInput = {
  onPath: boolean;
  targetLevel: SkillLevel | null;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };
