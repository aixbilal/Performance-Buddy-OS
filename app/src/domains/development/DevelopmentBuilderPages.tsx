/**
 * Project + Skill builder routes:
 *   /development/projects/new · /development/projects/:projectId/edit
 *   /development/skills/new   · /development/skills/:skillId/edit
 */
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { useDevelopment } from "./store";
import { EMPTY_PROJECT_FORM, ProjectForm, type ProjectFormValues } from "./ProjectForm";
import { EMPTY_SKILL_FORM, SkillForm, type SkillFormValues } from "./SkillForm";
import type { ProjectInput, SkillInput } from "./types";

export function ProjectBuilderPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { getProject, createProject, updateProject, saveState } = useDevelopment();

  const editing = projectId ? getProject(projectId) : undefined;
  const isEdit = Boolean(projectId);

  const initial = useMemo<ProjectFormValues>(() => {
    if (editing) {
      return { title: editing.title, status: editing.status, description: editing.description };
    }
    return EMPTY_PROJECT_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (isEdit && !editing) {
    return <NotFound to="/development" label="Development" msg="That project doesn't exist." />;
  }

  const submit = async (input: ProjectInput) => {
    const res =
      isEdit && projectId ? await updateProject(projectId, input) : await createProject(input);
    if (res.ok) navigate(`/development/projects/${res.id}`);
    return res;
  };

  return (
    <BuilderShell
      back={isEdit ? `/development/projects/${projectId}` : "/development"}
      backLabel={isEdit ? "Project" : "Development"}
      title={isEdit ? "Edit Project" : "Add Project"}
      subtitle={
        isEdit
          ? "Update this project. Progress is derived from its milestones — never a Skill number."
          : "A project is an outcome/work container. It appears in Development immediately."
      }
    >
      <ProjectForm
        initial={initial}
        submitLabel={isEdit ? "Save Project" : "Add Project"}
        busy={saveState === "saving"}
        onSubmit={submit}
        onCancel={() =>
          navigate(isEdit ? `/development/projects/${projectId}` : "/development")
        }
      />
    </BuilderShell>
  );
}

export function SkillBuilderPage() {
  const { skillId } = useParams();
  const navigate = useNavigate();
  const { getSkill, createSkill, updateSkill, saveState } = useDevelopment();

  const editing = skillId ? getSkill(skillId) : undefined;
  const isEdit = Boolean(skillId);

  const initial = useMemo<SkillFormValues>(() => {
    if (editing) {
      return {
        title: editing.title,
        category: editing.category,
        knowledgePercent: String(editing.knowledgePercent),
        practicePercent: String(editing.practicePercent),
      };
    }
    return EMPTY_SKILL_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId]);

  if (isEdit && !editing) {
    return <NotFound to="/development" label="Development" msg="That skill doesn't exist." />;
  }

  const submit = async (input: SkillInput) => {
    const res = isEdit && skillId ? await updateSkill(skillId, input) : await createSkill(input);
    if (res.ok) navigate(`/development/skills/${res.id}`);
    return res;
  };

  return (
    <BuilderShell
      back={isEdit ? `/development/skills/${skillId}` : "/development"}
      backLabel={isEdit ? "Skill" : "Development"}
      title={isEdit ? "Edit Skill" : "Add Skill"}
      subtitle={
        isEdit
          ? "Knowledge and Practice are self-assessed. Evidence is derived from what you record, with provenance."
          : "A skill is a capability. It has three independent axes — Knowledge, Practice, Evidence."
      }
    >
      <SkillForm
        initial={initial}
        submitLabel={isEdit ? "Save Skill" : "Add Skill"}
        busy={saveState === "saving"}
        onSubmit={submit}
        onCancel={() => navigate(isEdit ? `/development/skills/${skillId}` : "/development")}
      />
    </BuilderShell>
  );
}

function BuilderShell({
  back,
  backLabel,
  title,
  subtitle,
  children,
}: {
  back: string;
  backLabel: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button
          onClick={() => navigate(back)}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← {backLabel}
        </button>
        <h2 className="t-h2 text-text-primary mt-1">{title}</h2>
        <p className="text-text-muted text-sm">{subtitle}</p>
      </div>
      <Card>{children}</Card>
    </div>
  );
}

function NotFound({ to, label, msg }: { to: string; label: string; msg: string }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <button
        onClick={() => navigate(to)}
        className="text-text-muted text-xs hover:text-text-secondary"
      >
        ← {label}
      </button>
      <p className="text-text-muted text-sm">{msg}</p>
    </div>
  );
}
