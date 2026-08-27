import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { usePerformance } from "./store";

export function GoalDetailPage() {
  const { goalId } = useParams();
  const { goals, getSystemsForGoal } = usePerformance();
  const goal = goals.find((g) => g.id === goalId);

  if (!goal) {
    return <div className="text-text-muted text-sm">Goal not found.</div>;
  }

  const linkedSystems = getSystemsForGoal(goal.id);
  const progressPercent = Math.min(100, Math.round((goal.progress.current / goal.progress.target) * 100));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/goals" className="text-text-muted text-xs hover:text-text-secondary">
          ← Goals
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">{goal.title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <Badge>{goal.domain}</Badge>
          <span className="text-text-muted text-xs">
            {goal.progress.current} / {goal.progress.target} {goal.progress.unit !== "%" ? goal.progress.unit : ""}
          </span>
        </div>
      </div>

      <Card title="Progress">
        <div className="w-full h-2 rounded-full bg-surface-inset overflow-hidden mb-2">
          <div
            className="h-full bg-action-primary"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-text-secondary text-xs">{progressPercent}% toward target</div>
      </Card>

      <Card title="Linked Systems">
        {linkedSystems.length === 0 ? (
          <div className="text-text-muted text-xs">No systems linked to this goal yet.</div>
        ) : (
          <div className="space-y-2">
            {linkedSystems.map((s) => (
              <Link
                key={s.id}
                to={`/systems/${s.id}`}
                className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md"
              >
                <div>
                  <div className="text-text-primary text-sm">{s.title}</div>
                  <div className="text-text-muted text-xs">{s.description}</div>
                </div>
                <span className="text-text-secondary text-xs">{s.consistencyPercent}% consistent</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
