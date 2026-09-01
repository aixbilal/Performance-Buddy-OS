import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useDevelopment } from "./store";
import { Button } from "../../components/Button";

const STATUS_TONE = { active: "success", paused: "warning", completed: "neutral" } as const;

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const dev = useDevelopment();
  const project = dev.getProject(projectId ?? "");

  const [newMilestone, setNewMilestone] = useState("");
  const [editingMs, setEditingMs] = useState<string | null>(null);
  const [editMsTitle, setEditMsTitle] = useState("");
  const [linkSel, setLinkSel] = useState("");

  if (!project) {
    return (
      <div className="space-y-3">
        <Link to="/development" className="text-text-muted text-xs hover:text-text-secondary">
          ← Development
        </Link>
        <p className="text-text-muted text-sm">Project not found.</p>
      </div>
    );
  }

  const milestones = dev.getMilestonesForProject(project.id);
  const progress = dev.getProjectProgress(project.id);
  const linkedSkills = dev.getSkillsForProject(project.id);
  const linkableSkills = dev.skills.filter(
    (s) => !s.archived && !linkedSkills.some((l) => l.id === s.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/development" className="text-text-muted text-xs hover:text-text-secondary">
            ← Development
          </Link>
          <h2 className="t-h2 text-text-primary mt-1">
            {project.title}
            {project.archived && (
              <span className="ml-2">
                <Badge>archived</Badge>
              </span>
            )}
          </h2>
          <p className="text-text-muted text-sm">{project.description || "No description"}</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={dev.saveState} />
          <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
          <Button variant="secondary" onClick={() => navigate(`/development/projects/${project.id}/edit`)}>
            Edit Project
          </Button>
          <Button variant="ghost" onClick={() => dev.archiveProject(project.id, !project.archived)}>
            {project.archived ? "Unarchive" : "Archive"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Project progress (milestones)</div>
          <div className="text-text-primary text-lg font-semibold">
            {progress.total === 0 ? "—" : `${progress.percent}%`}
          </div>
          <p className="text-text-muted text-[10px] mt-1">
            {progress.total === 0
              ? "No milestones yet — not 0%."
              : `${progress.completed} of ${progress.total} complete. This is project work, not skill capability.`}
          </p>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Skills exercised</div>
          <div className="text-text-primary text-lg font-semibold">{linkedSkills.length}</div>
          <p className="text-text-muted text-[10px] mt-1">
            Linking a skill does not raise its capability — evidence does.
          </p>
        </Card>
      </div>

      <Card title="Milestones">
        <form
          className="flex gap-2 mb-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await dev.createMilestone(project.id, { title: newMilestone });
            if (res.ok) setNewMilestone("");
          }}
        >
          <input
            value={newMilestone}
            onChange={(e) => setNewMilestone(e.target.value)}
            aria-label="New milestone title"
            placeholder="Add a milestone…"
            className="flex-1 bg-surface-inset border border-border-subtle rounded-md px-3 py-2 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
          <Button variant="primary" type="submit">
            Add Milestone
          </Button>
        </form>

        {milestones.length === 0 ? (
          <div className="text-text-muted text-xs">No milestones yet.</div>
        ) : (
          <div className="space-y-1">
            {milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 py-2 border-b border-border-subtle last:border-0"
              >
                <input
                  type="checkbox"
                  checked={m.completed}
                  aria-label={`Mark ${m.title} complete`}
                  onChange={() => dev.toggleMilestone(m.id)}
                  className="accent-action-primary"
                />
                {editingMs === m.id ? (
                  <form
                    className="flex-1 flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await dev.updateMilestone(m.id, { title: editMsTitle });
                      if (res.ok) setEditingMs(null);
                    }}
                  >
                    <input
                      value={editMsTitle}
                      onChange={(e) => setEditMsTitle(e.target.value)}
                      aria-label={`Edit milestone ${m.title}`}
                      className="flex-1 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    />
                    <button
                      type="submit"
                      className="text-text-secondary text-[11px] underline hover:text-text-primary"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <>
                    <span
                      className={`flex-1 text-sm ${m.completed ? "text-text-muted line-through" : "text-text-primary"}`}
                    >
                      {m.title}
                    </span>
                    <button
                      onClick={() => {
                        setEditingMs(m.id);
                        setEditMsTitle(m.title);
                      }}
                      className="text-text-muted text-[11px] hover:text-text-secondary underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => dev.deleteMilestone(m.id)}
                      className="text-text-muted text-[11px] hover:text-status-danger underline"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Skills Exercised">
        {linkableSkills.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <label className="sr-only" htmlFor="link-skill">
              Link a skill to {project.title}
            </label>
            <select
              id="link-skill"
              value={linkSel}
              onChange={(e) => setLinkSel(e.target.value)}
              className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <option value="">Link a skill…</option>
              {linkableSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <button
              disabled={!linkSel}
              onClick={() => {
                if (linkSel) {
                  dev.linkProjectSkill(project.id, linkSel);
                  setLinkSel("");
                }
              }}
              className="px-2.5 py-1 rounded bg-action-secondary text-text-primary text-[11px] font-medium disabled:opacity-50"
            >
              Link
            </button>
          </div>
        )}
        {linkedSkills.length === 0 ? (
          <div className="text-text-muted text-xs">No skills linked to this project yet.</div>
        ) : (
          <div className="space-y-1">
            {linkedSkills.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
              >
                <Link
                  to={`/development/skills/${s.id}`}
                  className="text-text-primary text-sm hover:text-text-secondary underline"
                >
                  {s.title}
                </Link>
                <button
                  onClick={() => dev.unlinkProjectSkill(project.id, s.id)}
                  className="text-text-muted text-[11px] hover:text-text-secondary underline"
                >
                  Unlink
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
