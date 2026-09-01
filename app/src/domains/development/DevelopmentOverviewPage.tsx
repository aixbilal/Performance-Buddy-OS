import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { useDevelopment } from "./store";

const STATUS_TONE = {
  active: "success",
  paused: "warning",
  completed: "neutral",
} as const;

export function DevelopmentOverviewPage() {
  const navigate = useNavigate();
  const {
    projects,
    skills,
    getProjectProgress,
    getSkillEvidenceScore,
    saveState,
    loaded,
  } = useDevelopment();

  if (!loaded) return <LoadingState label="Loading development…" />;

  const activeProjects = projects.filter((p) => !p.archived);
  const activeSkills = skills.filter((s) => !s.archived);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Development</h2>
          <p className="text-text-muted text-sm">
            Projects, skills, and evidence of real capability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <Link
            to="/development/learning-path"
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Learning Path
          </Link>
          <button
            onClick={() => navigate("/development/skills/new")}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Add Skill
          </button>
          <button
            onClick={() => navigate("/development/projects/new")}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Add Project
          </button>
        </div>
      </div>

      {loaded && activeProjects.length === 0 && activeSkills.length === 0 ? (
        <Card>
          <EmptyState
            icon="🛠️"
            title="Nothing here yet"
            description="Add a project (an outcome you're building) or a skill (a capability you're growing). They're tracked separately — project progress is not skill capability."
            primaryAction={{
              label: "Add your first project",
              onClick: () => navigate("/development/projects/new"),
            }}
            secondaryAction={{
              label: "Add a skill",
              onClick: () => navigate("/development/skills/new"),
            }}
          />
        </Card>
      ) : (
        <>
          <Card title={`Projects (${activeProjects.length})`}>
            {activeProjects.length === 0 ? (
              <div className="text-text-muted text-xs py-1">No active projects.</div>
            ) : (
              <div className="space-y-1">
                {activeProjects.map((p) => {
                  const prog = getProjectProgress(p.id);
                  return (
                    <Link
                      key={p.id}
                      to={`/development/projects/${p.id}`}
                      className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md"
                    >
                      <div>
                        <div className="text-text-primary text-sm">{p.title}</div>
                        <div className="text-text-muted text-xs">
                          {p.description || "No description"} ·{" "}
                          {prog.total === 0
                            ? "no milestones yet"
                            : `${prog.completed}/${prog.total} milestones`}
                        </div>
                      </div>
                      <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title={`Skills (${activeSkills.length})`}>
            <p className="text-text-disabled text-[11px] mb-3">
              Knowledge, Practice, and Evidence are tracked separately — never collapsed into one
              score. Evidence is derived from what you record, weighted by provenance.
            </p>
            {activeSkills.length === 0 ? (
              <div className="text-text-muted text-xs py-1">No skills yet.</div>
            ) : (
              <div className="space-y-3">
                {activeSkills.map((s) => {
                  const ev = getSkillEvidenceScore(s.id);
                  return (
                    <Link
                      key={s.id}
                      to={`/development/skills/${s.id}`}
                      className="block hover:bg-surface-inset -mx-2 px-2 py-2 rounded-md"
                    >
                      <div className="text-text-primary text-sm font-medium mb-2">
                        {s.title}
                        {s.category && <span className="text-text-muted text-xs"> · {s.category}</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <Axis label="Knowledge" value={`${s.knowledgePercent}%`} />
                        <Axis label="Practice" value={`${s.practicePercent}%`} />
                        <Axis
                          label="Evidence"
                          value={ev.countedCount === 0 && ev.excludedCount === 0 ? "—" : `${ev.evidencePercent}%`}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Axis({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-muted mb-0.5">{label}</div>
      <div className="text-text-secondary">{value}</div>
    </div>
  );
}
