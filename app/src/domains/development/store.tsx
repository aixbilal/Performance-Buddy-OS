import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Milestone, Project, Skill, SkillEvidence } from "./types";
import { computeEvidenceScore } from "./engine";
import { SEED_EVIDENCE, SEED_MILESTONES, SEED_PROJECTS, SEED_SKILLS } from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";
import type { SaveState } from "../resilience/types";

type DevelopmentContextValue = {
  projects: Project[];
  skills: Skill[];
  getMilestonesForProject: (projectId: string) => Milestone[];
  getEvidenceForSkill: (skillId: string) => SkillEvidence[];
  getProjectsForSkill: (skillId: string) => Project[];
  getSkillEvidenceScore: (skillId: string) => ReturnType<typeof computeEvidenceScore>;
  evidenceSaveState: SaveState;
};

const DevelopmentContext = createContext<DevelopmentContextValue | null>(null);

export function DevelopmentProvider({ children }: { children: ReactNode }) {
  const [projects] = usePersistedState<Project[]>("development-projects", SEED_PROJECTS);
  const [milestones] = usePersistedState<Milestone[]>("development-milestones", SEED_MILESTONES);
  const [skills] = usePersistedState<Skill[]>("development-skills", SEED_SKILLS);
  // Real persistence, ready for when a real "add evidence" UI exists —
  // there's no creation path yet, but the data now survives a restart
  // the moment one is added, with zero changes needed here.
  const [evidence, , evidenceSaveState] = usePersistedState<SkillEvidence[]>("development-evidence", SEED_EVIDENCE);

  const getMilestonesForProject = (projectId: string) =>
    milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.order - b.order);

  const getEvidenceForSkill = (skillId: string) =>
    evidence.filter((e) => e.skillId === skillId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getProjectsForSkill = (skillId: string) => projects.filter((p) => p.skillIds.includes(skillId));

  const getSkillEvidenceScore = (skillId: string) => computeEvidenceScore(getEvidenceForSkill(skillId));

  const value = useMemo(
    () => ({
      projects,
      skills,
      getMilestonesForProject,
      getEvidenceForSkill,
      getProjectsForSkill,
      getSkillEvidenceScore,
      evidenceSaveState,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, milestones, skills, evidence, evidenceSaveState]
  );

  return <DevelopmentContext.Provider value={value}>{children}</DevelopmentContext.Provider>;
}

export function useDevelopment() {
  const ctx = useContext(DevelopmentContext);
  if (!ctx) throw new Error("useDevelopment must be used within DevelopmentProvider");
  return ctx;
}
