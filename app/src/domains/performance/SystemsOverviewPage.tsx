import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { usePerformance } from "./store";

export function SystemsOverviewPage() {
  const { systems, computeSystemHealth } = usePerformance();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Systems</h2>
        <p className="text-text-muted text-sm">Repeatable engines that drive your goals forward.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {systems.map((s) => (
          <Link key={s.id} to={`/systems/${s.id}`}>
            <Card>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-text-primary text-sm font-medium">
                    {s.title} {s.isStarred && <span className="text-ai-accent">★</span>}
                  </div>
                  <div className="text-text-muted text-xs mt-1">{s.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                {s.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{computeSystemHealth(s.id)}% health</span>
                <span className="text-text-secondary">{s.activeStreakDays} day streak</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
