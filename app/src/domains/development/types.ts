/**
 * Performance Buddy OS — Development OS domain model.
 *
 * Per Master Handoff §14 and Design Assets/07 - Development/README.md, the
 * defining rule of this domain: Knowledge, Practice, and Evidence are three
 * INDEPENDENT capability measures, never collapsed into one score.
 *
 *   "REST APIs — Knowledge: Strong, Practice: Developing, Evidence: Limited
 *    — Do not collapse into one arbitrary score."
 *
 * The second rule, equally important: *"AI built feature does not
 * automatically mean user independently understands skill."* — see
 * `Provenance` and engine.ts.
 */

export type SkillLevel = "not-started" | "learning" | "developing" | "strong";

export type ProjectStatus = "active" | "paused" | "completed";

export type Project = {
  id: string;
  title: string;
  status: ProjectStatus;
  description: string;
  skillIds: string[]; // skills exercised by this project
};

export type Milestone = {
  id: string;
  projectId: string;
  title: string;
  completed: boolean;
  order: number;
};

export type Skill = {
  id: string;
  title: string;
  category: string; // e.g. "Backend", "APIs"
  knowledgePercent: number; // "can explain it" — 0-100
  practicePercent: number; // "has done it, with help allowed" — 0-100
  // evidencePercent is NOT stored directly — it's derived from SkillEvidence
  // by the engine, specifically so it can't be quietly overstated. See engine.ts.
};

/**
 * How a piece of project work was actually produced. Per Master Handoff §14:
 * useful provenance values are "AI-assisted, personally reviewed, can
 * explain, independently implemented, test verified." Kept to the three
 * that materially change whether evidence counts toward independent mastery.
 */
export type Provenance = "independent" | "ai-assisted-reviewed" | "ai-assisted";

export type SkillEvidence = {
  id: string;
  skillId: string;
  projectId: string | null;
  title: string;
  provenance: Provenance;
  date: string;
};
