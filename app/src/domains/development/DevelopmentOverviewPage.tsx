import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useDevelopment } from "./store";

const STATUS_TONE = {
  active: "success",
  paused: "warning",
  completed: "neutral",
} as const;

export function DevelopmentOverviewPage() {
  const { projects, skills, getMilestonesForProject, getSkillEvidenceScore } = useDevelopment();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Development</h2>
        <p className="text-text-muted text-sm">Projects, skills, and evidence of real capability.</p>
      </div>

      <Card title="Projects">
        <div className="space-y-2">
          {projects.map((p) => {
            const milestones = getMilestonesForProject(p.id);
            const completed = milestones.filter((m) => m.completed).length;
            return (
              <div key={p.id} className="py-2 border-b border-border-subtle last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-text-primary text-sm">{p.title}</div>
                    <div className="text-text-muted text-xs">{p.description}</div>
                  </div>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                </div>
                {milestones.length > 0 && (
                  <div className="text-text-secondary text-xs mt-1">
                    {completed} / {milestones.length} milestones
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Skills">
        <p className="text-text-disabled text-[11px] mb-3">
          Knowledge, Practice, and Evidence are tracked separately — never collapsed into one score.
        </p>
        <div className="space-y-3">
          {skills.map((s) => {
            const evidenceScore = getSkillEvidenceScore(s.id);
            return (
              <Link
                key={s.id}
                to={`/development/skills/${s.id}`}
                className="block hover:bg-surface-inset -mx-2 px-2 py-2 rounded-md"
              >
                <div className="text-text-primary text-sm font-medium mb-2">
                  {s.title} <span className="text-text-muted text-xs">· {s.category}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-text-muted mb-0.5">Knowledge</div>
                    <div className="text-text-secondary">{s.knowledgePercent}%</div>
                  </div>
                  <div>
                    <div className="text-text-muted mb-0.5">Practice</div>
                    <div className="text-text-secondary">{s.practicePercent}%</div>
                  </div>
                  <div>
                    <div className="text-text-muted mb-0.5">Evidence</div>
                    <div className="text-text-secondary">{evidenceScore.evidencePercent}%</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
