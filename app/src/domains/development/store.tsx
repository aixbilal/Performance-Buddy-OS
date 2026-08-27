import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Milestone, Project, Skill, SkillEvidence } from "./types";
import { computeEvidenceScore } from "./engine";
import { SEED_EVIDENCE, SEED_MILESTONES, SEED_PROJECTS, SEED_SKILLS } from "./mockData";

type DevelopmentContextValue = {
  projects: Project[];
  skills: Skill[];
  getMilestonesForProject: (projectId: string) => Milestone[];
  getEvidenceForSkill: (skillId: string) => SkillEvidence[];
  getProjectsForSkill: (skillId: string) => Project[];
  getSkillEvidenceScore: (skillId: string) => ReturnType<typeof computeEvidenceScore>;
};

const DevelopmentContext = createContext<DevelopmentContextValue | null>(null);

export function DevelopmentProvider({ children }: { children: ReactNode }) {
  const [projects] = useState<Project[]>(SEED_PROJECTS);
  const [milestones] = useState<Milestone[]>(SEED_MILESTONES);
  const [skills] = useState<Skill[]>(SEED_SKILLS);
  const [evidence] = useState<SkillEvidence[]>(SEED_EVIDENCE);

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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, milestones, skills, evidence]
  );

  return <DevelopmentContext.Provider value={value}>{children}</DevelopmentContext.Provider>;
}

export function useDevelopment() {
  const ctx = useContext(DevelopmentContext);
  if (!ctx) throw new Error("useDevelopment must be used within DevelopmentProvider");
  return ctx;
}
