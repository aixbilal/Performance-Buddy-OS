/**
 * Development OS store — the ONE place Project/Skill/Milestone/Evidence state
 * lives.
 *
 * - Canonical persistence is relational SQLite via `DevelopmentRepo` (Batch 2B).
 * - No seed data. Fresh profile is empty; a returning user's pre-2B KV blobs
 *   are imported once (idempotent, non-destructive).
 * - Project progress (milestone-derived) ≠ Skill capability (three independent
 *   axes) ≠ Knowledge mastery. `evidencePercent` is DERIVED from
 *   provenance-weighted evidence, never stored. Pure unreviewed AI-assisted
 *   evidence is shown but excluded from the score (Master Handoff §14).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cacheAdapter } from "../persistence/cache";
import type { SaveState } from "../resilience/types";
import {
  computeEvidenceScore,
  deriveProjectProgress,
  knowledgeHandoffWeight,
  validateEvidenceInput,
  validateMilestoneInput,
  validateProjectInput,
  validateSkillInput,
  type EvidenceScoreResult,
  type ProjectProgress,
} from "./engine";
import { useKnowledge } from "../knowledge/store";
import { newId } from "./ids";
import { resolveLegacyDevelopment, type DevLegacyReport } from "./legacyImport";
import { makeDevelopmentRepo, type DevelopmentRepo } from "./repo";
import type {
  DevGraph,
  EvidenceInput,
  Milestone,
  MilestoneInput,
  Project,
  ProjectInput,
  ProjectStatus,
  RoadmapInput,
  Skill,
  SkillEvidence,
  SkillInput,
  SkillLevel,
} from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };
export type HandoffResult =
  | { ok: true; id: string; already: boolean }
  | { ok: false; reason: "not-found" | "no-knowledge-link" | "unreviewed-ai" | string };

type DevelopmentContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  /** Back-compat alias — consumers pre-2B read `evidenceSaveState`. */
  evidenceSaveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: DevLegacyReport | null;

  projects: Project[];
  skills: Skill[];
  milestones: Milestone[];
  evidence: SkillEvidence[];

  // reads
  getProject: (id: string) => Project | undefined;
  getSkill: (id: string) => Skill | undefined;
  getMilestonesForProject: (projectId: string) => Milestone[];
  getEvidenceForSkill: (skillId: string) => SkillEvidence[];
  getProjectsForSkill: (skillId: string) => Project[];
  getSkillsForProject: (projectId: string) => Skill[];
  getSkillEvidenceScore: (skillId: string) => EvidenceScoreResult;
  getProjectProgress: (projectId: string) => ProjectProgress;
  getRoadmapSkills: () => Skill[];

  // project CRUD
  createProject: (input: ProjectInput) => Promise<MutResult>;
  updateProject: (id: string, input: ProjectInput) => Promise<MutResult>;
  archiveProject: (id: string, archived?: boolean) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // skill CRUD
  createSkill: (input: SkillInput) => Promise<MutResult>;
  updateSkill: (id: string, input: SkillInput) => Promise<MutResult>;
  archiveSkill: (id: string, archived?: boolean) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  setSkillRoadmap: (id: string, input: RoadmapInput) => Promise<MutResult>;
  /** Batch 5 — set (topicId) or clear (null) a Skill's Knowledge concept reference. */
  linkSkillKnowledge: (skillId: string, topicId: string | null) => Promise<void>;
  /** Batch 5 — explicit, idempotent handoff of ONE skill-evidence row to Knowledge. */
  sendEvidenceToKnowledge: (evidenceId: string) => Promise<HandoffResult>;

  // milestone CRUD
  createMilestone: (projectId: string, input: MilestoneInput) => Promise<MutResult>;
  updateMilestone: (id: string, input: MilestoneInput) => Promise<MutResult>;
  toggleMilestone: (id: string) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  reorderMilestones: (projectId: string, orderedIds: string[]) => Promise<void>;

  // evidence
  addEvidence: (skillId: string, input: EvidenceInput) => Promise<MutResult>;
  updateEvidence: (id: string, input: EvidenceInput) => Promise<MutResult>;
  deleteEvidence: (id: string) => Promise<void>;

  // project <-> skill link
  linkProjectSkill: (projectId: string, skillId: string) => Promise<void>;
  unlinkProjectSkill: (projectId: string, skillId: string) => Promise<void>;
};

const DevelopmentContext = createContext<DevelopmentContextValue | null>(null);

const nowIso = () => new Date().toISOString();
const EMPTY: DevGraph = { projects: [], skills: [], milestones: [], evidence: [], links: [] };

export function DevelopmentProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<DevelopmentRepo>(makeDevelopmentRepo());
  const [graph, setGraph] = useState<DevGraph>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<DevLegacyReport | null>(null);
  const knowledge = useKnowledge();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const legacy = resolveLegacyDevelopment({
          projects: cacheAdapter.getItem("pbos:development-projects"),
          skills: cacheAdapter.getItem("pbos:development-skills"),
          milestones: cacheAdapter.getItem("pbos:development-milestones"),
          evidence: cacheAdapter.getItem("pbos:development-evidence"),
        });
        const report = await repo.importGraph(legacy.graph);
        if (report.ran) setLegacyImport(legacy.report);
        const g = await repo.load();
        if (!cancelled) {
          setGraph(g);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(fn: () => Promise<void>) {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      setSaveError(null);
    } catch (e) {
      setSaveState("failed");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  // A Skill's Knowledge reference resolves to null if that concept no longer
  // exists — same "dangling reference → none" posture the Rust FK enforces
  // (ON DELETE SET NULL), applied here so the browser-dev path matches.
  const resolvedSkills: Skill[] = useMemo(
    () =>
      graph.skills.map((s) =>
        s.knowledgeTopicId && !knowledge.getTopic(s.knowledgeTopicId)
          ? { ...s, knowledgeTopicId: null }
          : s,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph.skills, knowledge],
  );

  // --- reads ------------------------------------------------------------
  const getProject = (id: string) => graph.projects.find((p) => p.id === id);
  const getSkill = (id: string) => resolvedSkills.find((s) => s.id === id);
  const getMilestonesForProject = (projectId: string) =>
    graph.milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.position - b.position);
  const getEvidenceForSkill = (skillId: string) =>
    graph.evidence
      .filter((e) => e.skillId === skillId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const getProjectsForSkill = (skillId: string) => {
    const ids = new Set(graph.links.filter((l) => l.skillId === skillId).map((l) => l.projectId));
    return graph.projects.filter((p) => ids.has(p.id));
  };
  const getSkillsForProject = (projectId: string) => {
    const ids = new Set(graph.links.filter((l) => l.projectId === projectId).map((l) => l.skillId));
    return graph.skills.filter((s) => ids.has(s.id));
  };
  const getSkillEvidenceScore = (skillId: string) =>
    computeEvidenceScore(getEvidenceForSkill(skillId));
  const getProjectProgress = (projectId: string) =>
    deriveProjectProgress(getMilestonesForProject(projectId));
  const getRoadmapSkills = () =>
    graph.skills
      .filter((s) => s.roadmapPosition !== null && !s.archived)
      .sort((a, b) => (a.roadmapPosition as number) - (b.roadmapPosition as number));

  // --- project CRUD ---------------------------------------------------
  const createProject = async (input: ProjectInput): Promise<MutResult> => {
    const v = validateProjectInput(input);
    if (!v.ok) return v;
    const project: Project = {
      id: newId("proj"),
      ...v.value,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, projects: [...g.projects, project] }));
    await persist(() => repoRef.current.projectUpsert(project));
    return { ok: true, id: project.id };
  };

  const updateProject = async (id: string, input: ProjectInput): Promise<MutResult> => {
    const existing = getProject(id);
    if (!existing) return { ok: false, errors: { _: "Project not found." } };
    const v = validateProjectInput(input);
    if (!v.ok) return v;
    const project: Project = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, projects: g.projects.map((p) => (p.id === id ? project : p)) }));
    await persist(() => repoRef.current.projectUpsert(project));
    return { ok: true, id };
  };

  const archiveProject = async (id: string, archived = true) => {
    const existing = getProject(id);
    if (!existing) return;
    const project: Project = { ...existing, archived, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, projects: g.projects.map((p) => (p.id === id ? project : p)) }));
    await persist(() => repoRef.current.projectUpsert(project));
  };

  const deleteProject = async (id: string) => {
    setGraph((g) => ({
      ...g,
      projects: g.projects.filter((p) => p.id !== id),
      milestones: g.milestones.filter((m) => m.projectId !== id),
      links: g.links.filter((l) => l.projectId !== id),
      evidence: g.evidence.map((e) => (e.projectId === id ? { ...e, projectId: null } : e)),
    }));
    await persist(() => repoRef.current.projectDelete(id));
  };

  // --- skill CRUD ---------------------------------------------------
  const createSkill = async (input: SkillInput): Promise<MutResult> => {
    const v = validateSkillInput(input);
    if (!v.ok) return v;
    const skill: Skill = {
      id: newId("skill"),
      ...v.value,
      roadmapPosition: null,
      roadmapTargetLevel: null,
      knowledgeTopicId: null,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, skills: [...g.skills, skill] }));
    await persist(() => repoRef.current.skillUpsert(skill));
    return { ok: true, id: skill.id };
  };

  const updateSkill = async (id: string, input: SkillInput): Promise<MutResult> => {
    const existing = getSkill(id);
    if (!existing) return { ok: false, errors: { _: "Skill not found." } };
    const v = validateSkillInput(input);
    if (!v.ok) return v;
    const skill: Skill = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, skills: g.skills.map((s) => (s.id === id ? skill : s)) }));
    await persist(() => repoRef.current.skillUpsert(skill));
    return { ok: true, id };
  };

  const archiveSkill = async (id: string, archived = true) => {
    const existing = getSkill(id);
    if (!existing) return;
    const skill: Skill = { ...existing, archived, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, skills: g.skills.map((s) => (s.id === id ? skill : s)) }));
    await persist(() => repoRef.current.skillUpsert(skill));
  };

  const deleteSkill = async (id: string) => {
    setGraph((g) => ({
      ...g,
      skills: g.skills.filter((s) => s.id !== id),
      evidence: g.evidence.filter((e) => e.skillId !== id),
      links: g.links.filter((l) => l.skillId !== id),
    }));
    await persist(() => repoRef.current.skillDelete(id));
  };

  const setSkillRoadmap = async (id: string, input: RoadmapInput): Promise<MutResult> => {
    const existing = getSkill(id);
    if (!existing) return { ok: false, errors: { _: "Skill not found." } };
    const onPathCount = graph.skills.filter(
      (s) => s.roadmapPosition !== null && s.id !== id,
    ).length;
    const roadmapPosition: number | null = input.onPath
      ? (existing.roadmapPosition ?? onPathCount)
      : null;
    const roadmapTargetLevel: SkillLevel | null = input.onPath ? input.targetLevel : null;
    const skill: Skill = { ...existing, roadmapPosition, roadmapTargetLevel, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, skills: g.skills.map((s) => (s.id === id ? skill : s)) }));
    await persist(() => repoRef.current.skillUpsert(skill));
    return { ok: true, id };
  };

  // --- milestone CRUD -------------------------------------------
  const createMilestone = async (
    projectId: string,
    input: MilestoneInput,
  ): Promise<MutResult> => {
    if (!getProject(projectId)) return { ok: false, errors: { _: "Project not found." } };
    const v = validateMilestoneInput(input);
    if (!v.ok) return v;
    const milestone: Milestone = {
      id: newId("ms"),
      projectId,
      title: v.value.title,
      completed: false,
      position: getMilestonesForProject(projectId).length,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, milestones: [...g.milestones, milestone] }));
    await persist(() => repoRef.current.milestoneUpsert(milestone));
    return { ok: true, id: milestone.id };
  };

  const updateMilestone = async (id: string, input: MilestoneInput): Promise<MutResult> => {
    const existing = graph.milestones.find((m) => m.id === id);
    if (!existing) return { ok: false, errors: { _: "Milestone not found." } };
    const v = validateMilestoneInput(input);
    if (!v.ok) return v;
    const milestone: Milestone = { ...existing, title: v.value.title, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, milestones: g.milestones.map((m) => (m.id === id ? milestone : m)) }));
    await persist(() => repoRef.current.milestoneUpsert(milestone));
    return { ok: true, id };
  };

  const toggleMilestone = async (id: string) => {
    const existing = graph.milestones.find((m) => m.id === id);
    if (!existing) return;
    const milestone: Milestone = {
      ...existing,
      completed: !existing.completed,
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, milestones: g.milestones.map((m) => (m.id === id ? milestone : m)) }));
    await persist(() => repoRef.current.milestoneUpsert(milestone));
  };

  const deleteMilestone = async (id: string) => {
    setGraph((g) => ({ ...g, milestones: g.milestones.filter((m) => m.id !== id) }));
    await persist(() => repoRef.current.milestoneDelete(id));
  };

  const reorderMilestones = async (projectId: string, orderedIds: string[]) => {
    setGraph((g) => ({
      ...g,
      milestones: g.milestones.map((m) => {
        if (m.projectId !== projectId) return m;
        const pos = orderedIds.indexOf(m.id);
        return pos >= 0 ? { ...m, position: pos } : m;
      }),
    }));
    await persist(() => repoRef.current.milestonesReorder(projectId, orderedIds));
  };

  // --- evidence -----------------------------------------------
  const addEvidence = async (skillId: string, input: EvidenceInput): Promise<MutResult> => {
    if (!getSkill(skillId)) return { ok: false, errors: { _: "Skill not found." } };
    const v = validateEvidenceInput(input);
    if (!v.ok) return v;
    const projectId =
      v.value.projectId && getProject(v.value.projectId) ? v.value.projectId : null;
    const evidence: SkillEvidence = {
      id: newId("sev"),
      skillId,
      ...v.value,
      projectId,
      knowledgeEvidenceId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, evidence: [...g.evidence, evidence] }));
    await persist(() => repoRef.current.evidenceUpsert(evidence));
    return { ok: true, id: evidence.id };
  };

  const updateEvidence = async (id: string, input: EvidenceInput): Promise<MutResult> => {
    const existing = graph.evidence.find((e) => e.id === id);
    if (!existing) return { ok: false, errors: { _: "Evidence not found." } };
    const v = validateEvidenceInput(input);
    if (!v.ok) return v;
    const projectId =
      v.value.projectId && getProject(v.value.projectId) ? v.value.projectId : null;
    const evidence: SkillEvidence = { ...existing, ...v.value, projectId, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, evidence: g.evidence.map((e) => (e.id === id ? evidence : e)) }));
    await persist(() => repoRef.current.evidenceUpsert(evidence));
    return { ok: true, id };
  };

  const deleteEvidence = async (id: string) => {
    setGraph((g) => ({ ...g, evidence: g.evidence.filter((e) => e.id !== id) }));
    await persist(() => repoRef.current.evidenceDelete(id));
  };

  // --- link -----------------------------------------------
  const linkProjectSkill = async (projectId: string, skillId: string) => {
    setGraph((g) =>
      g.links.some((l) => l.projectId === projectId && l.skillId === skillId)
        ? g
        : { ...g, links: [...g.links, { projectId, skillId }] },
    );
    await persist(() => repoRef.current.linkSet(projectId, skillId, true));
  };

  const unlinkProjectSkill = async (projectId: string, skillId: string) => {
    setGraph((g) => ({
      ...g,
      links: g.links.filter((l) => !(l.projectId === projectId && l.skillId === skillId)),
    }));
    await persist(() => repoRef.current.linkSet(projectId, skillId, false));
  };

  // --- Batch 5: Development ↔ Knowledge --------------------------------
  const linkSkillKnowledge = async (skillId: string, topicId: string | null) => {
    const existing = getSkill(skillId);
    if (!existing) return;
    const resolved = topicId && knowledge.getTopic(topicId) ? topicId : null;
    setGraph((g) => ({
      ...g,
      skills: g.skills.map((s) =>
        s.id === skillId ? { ...s, knowledgeTopicId: resolved, updatedAt: nowIso() } : s,
      ),
    }));
    await persist(() => repoRef.current.skillLinkKnowledge(skillId, resolved));
  };

  const sendEvidenceToKnowledge = async (evidenceId: string): Promise<HandoffResult> => {
    const ev = graph.evidence.find((e) => e.id === evidenceId);
    if (!ev) return { ok: false, reason: "not-found" };
    if (ev.knowledgeEvidenceId) return { ok: true, id: ev.knowledgeEvidenceId, already: true };
    const skill = getSkill(ev.skillId);
    if (!skill?.knowledgeTopicId) return { ok: false, reason: "no-knowledge-link" };
    const weight = knowledgeHandoffWeight(ev.provenance);
    if (!weight) return { ok: false, reason: "unreviewed-ai" };

    const res = await knowledge.addEvidence(skill.knowledgeTopicId, {
      type: "practice",
      title: `Skill evidence — ${skill.title}: ${ev.title}`,
      score: weight.score,
      maxScore: weight.maxScore,
      date: ev.date || new Date().toISOString().slice(0, 10),
    });
    if (!res.ok) return { ok: false, reason: res.reason };

    const effective = await repoRef.current.skillEvidenceLinkKnowledge(evidenceId, res.id);
    const linkedId = effective ?? res.id;
    if (linkedId !== res.id) {
      // lost a race — drop the duplicate we just created
      await knowledge.deleteEvidence(res.id);
    }
    setGraph((g) => ({
      ...g,
      evidence: g.evidence.map((e) =>
        e.id === evidenceId ? { ...e, knowledgeEvidenceId: linkedId, updatedAt: nowIso() } : e,
      ),
    }));
    return { ok: true, id: linkedId, already: false };
  };

  const value = useMemo<DevelopmentContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      evidenceSaveState: saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      projects: graph.projects,
      skills: resolvedSkills,
      milestones: graph.milestones,
      evidence: graph.evidence,
      getProject,
      getSkill,
      getMilestonesForProject,
      getEvidenceForSkill,
      getProjectsForSkill,
      getSkillsForProject,
      getSkillEvidenceScore,
      getProjectProgress,
      getRoadmapSkills,
      createProject,
      updateProject,
      archiveProject,
      deleteProject,
      createSkill,
      updateSkill,
      archiveSkill,
      deleteSkill,
      setSkillRoadmap,
      linkSkillKnowledge,
      sendEvidenceToKnowledge,
      createMilestone,
      updateMilestone,
      toggleMilestone,
      deleteMilestone,
      reorderMilestones,
      addEvidence,
      updateEvidence,
      deleteEvidence,
      linkProjectSkill,
      unlinkProjectSkill,
    }),
    // `knowledge` is included so the cross-domain handoff closures never read a
    // stale Knowledge snapshot (this provider re-renders on Knowledge changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, saveError, legacyImport, knowledge, resolvedSkills],
  );

  return <DevelopmentContext.Provider value={value}>{children}</DevelopmentContext.Provider>;
}

export function useDevelopment() {
  const ctx = useContext(DevelopmentContext);
  if (!ctx) throw new Error("useDevelopment must be used within DevelopmentProvider");
  return ctx;
}

export type { ProjectStatus };
