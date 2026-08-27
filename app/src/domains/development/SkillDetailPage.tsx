import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useDevelopment } from "./store";
import { derivePercentToLevel } from "./engine";
import type { Provenance } from "./types";

const PROVENANCE_LABEL: Record<Provenance, string> = {
  independent: "Independent",
  "ai-assisted-reviewed": "AI-assisted + Reviewed",
  "ai-assisted": "AI-assisted (unreviewed)",
};

const PROVENANCE_TONE = {
  independent: "success",
  "ai-assisted-reviewed": "success",
  "ai-assisted": "warning",
} as const;

const LEVEL_TONE = {
  "not-started": "neutral",
  learning: "warning",
  developing: "warning",
  strong: "success",
} as const;

export function SkillDetailPage() {
  const { skillId } = useParams();
  const { skills, getEvidenceForSkill, getProjectsForSkill, getSkillEvidenceScore } = useDevelopment();
  const skill = skills.find((s) => s.id === skillId);

  if (!skill) {
    return <div className="text-text-muted text-sm">Skill not found.</div>;
  }

  const evidenceList = getEvidenceForSkill(skill.id);
  const evidenceScore = getSkillEvidenceScore(skill.id);
  const projects = getProjectsForSkill(skill.id);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/development" className="text-text-muted text-xs hover:text-text-secondary">
          ← Development
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">{skill.title}</h2>
        <p className="text-text-muted text-sm">{skill.category}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Knowledge</div>
          <Badge tone={LEVEL_TONE[derivePercentToLevel(skill.knowledgePercent)]}>
            {derivePercentToLevel(skill.knowledgePercent)}
          </Badge>
          <div className="text-text-primary text-lg font-semibold mt-1">{skill.knowledgePercent}%</div>
          <p className="text-text-disabled text-[10px] mt-1">Can explain it clearly.</p>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Practice</div>
          <Badge tone={LEVEL_TONE[derivePercentToLevel(skill.practicePercent)]}>
            {derivePercentToLevel(skill.practicePercent)}
          </Badge>
          <div className="text-text-primary text-lg font-semibold mt-1">{skill.practicePercent}%</div>
          <p className="text-text-disabled text-[10px] mt-1">Has done it, help allowed.</p>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Evidence</div>
          <Badge tone={LEVEL_TONE[derivePercentToLevel(evidenceScore.evidencePercent)]}>
            {derivePercentToLevel(evidenceScore.evidencePercent)}
          </Badge>
          <div className="text-text-primary text-lg font-semibold mt-1">{evidenceScore.evidencePercent}%</div>
          <p className="text-text-disabled text-[10px] mt-1">Independently demonstrated.</p>
        </Card>
      </div>

      {evidenceScore.excludedCount > 0 && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-md px-4 py-3 text-xs text-status-warning">
          {evidenceScore.excludedCount} of {evidenceList.length} evidence record(s) are AI-assisted but not yet
          reviewed/explained back — these are shown below but excluded from the Evidence score above. AI writing
          code does not automatically count as you independently understanding it.
        </div>
      )}

      <Card title={`Evidence (${evidenceList.length})`}>
        <div className="space-y-2">
          {evidenceList.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
              <div>
                <div className="text-text-primary text-sm">{e.title}</div>
                <div className="text-text-muted text-xs">{e.date}</div>
              </div>
              <Badge tone={PROVENANCE_TONE[e.provenance]}>{PROVENANCE_LABEL[e.provenance]}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {projects.length > 0 && (
        <Card title="Projects Using This Skill">
          <div className="space-y-1">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1.5">
                <span className="text-text-primary text-sm">{p.title}</span>
                <span className="text-text-muted text-xs">{p.description}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
