import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useDevelopment } from "./store";
import { derivePercentToLevel } from "./engine";
import type { SkillLevel } from "./types";

const LEVEL_TONE = {
  "not-started": "neutral",
  learning: "warning",
  developing: "warning",
  strong: "success",
} as const;

const LEVEL_ORDER: SkillLevel[] = ["not-started", "learning", "developing", "strong"];

export function LearningPathPage() {
  const dev = useDevelopment();
  const roadmap = dev.getRoadmapSkills();

  return (
    <div className="space-y-6">
      <div>
        <Link to="/development" className="text-text-muted text-xs hover:text-text-secondary">
          ← Development
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">Learning Path</h2>
        <p className="text-text-muted text-sm">
          The skills you're deliberately working through, in order — with your current level against
          the target you set. Derived from your Skills; no AI roadmap engine.
        </p>
      </div>

      {roadmap.length === 0 ? (
        <Card>
          <EmptyState
            icon="🗺️"
            title="No skills on the path yet"
            description="Open a Skill and toggle “On the learning path”, then set a target level. It will appear here in order."
          />
        </Card>
      ) : (
        <Card title={`Path (${roadmap.length})`}>
          <div className="space-y-2">
            {roadmap.map((s, i) => {
              const current = derivePercentToLevel(Math.max(s.knowledgePercent, s.practicePercent));
              const target = s.roadmapTargetLevel;
              const met =
                target !== null && LEVEL_ORDER.indexOf(current) >= LEVEL_ORDER.indexOf(target);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted text-xs w-5">{i + 1}.</span>
                    <Link
                      to={`/development/skills/${s.id}`}
                      className="text-text-primary text-sm hover:text-text-secondary underline"
                    >
                      {s.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={LEVEL_TONE[current]}>now: {current}</Badge>
                    {target && (
                      <Badge tone={met ? "success" : "neutral"}>
                        target: {target}
                        {met ? " ✓" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
