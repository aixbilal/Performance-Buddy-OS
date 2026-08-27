import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useFitness } from "./store";

export function FitnessOverviewPage() {
  const { plan, sessions, getPrescriptionForSession, dayLabel, readiness } = useFitness();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Fitness</h2>
        <p className="text-text-muted text-sm">
          {plan.title} · Week {plan.currentWeek} of {plan.totalWeeks} · {plan.daysPerWeek} days/week
        </p>
      </div>

      <Link to="/fitness/recovery">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-text-muted text-xs mb-1">Today's Readiness</div>
              <div className="text-text-primary text-lg font-semibold capitalize">
                {readiness.state.replace("-", " ")}
              </div>
              <p className="text-text-secondary text-xs mt-1">{readiness.reason}</p>
            </div>
            {readiness.score !== null && (
              <div className="text-text-primary text-2xl font-semibold">{readiness.score}</div>
            )}
          </div>
        </Card>
      </Link>

      <Card title="This Week">
        <div className="space-y-1">
          {sessions.map((session) => {
            const prescription = getPrescriptionForSession(session.id);
            return (
              <div
                key={session.id}
                className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0"
              >
                <div>
                  <div className="text-text-primary text-sm">
                    {dayLabel(session.dayOfWeek)} · {session.title}
                  </div>
                  <div className="text-text-muted text-xs">
                    {session.exercises.map((e) => e.name).join(", ")}
                  </div>
                </div>
                {prescription?.modified && <Badge tone="warning">Adjusted Today</Badge>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
