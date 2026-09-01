import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { useFitness } from "./store";
import { Button, buttonClass } from "../../components/Button";

const READINESS_TONE = {
  push: "success",
  normal: "neutral",
  "reduced-load": "warning",
  recovery: "danger",
  "insufficient-data": "neutral",
} as const;

export function FitnessOverviewPage() {
  const navigate = useNavigate();
  const { plans, plan, getRecentWorkouts, readiness, checkIns, saveState, loaded, dayLabel } =
    useFitness();

  if (!loaded) return <LoadingState label="Loading fitness…" />;

  const activePlans = plans.filter((p) => !p.archived);
  const recent = getRecentWorkouts(5);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="t-h2 text-text-primary">Fitness &amp; Recovery</h2>
          <p className="text-text-muted text-sm">
            Your training plan, what you actually did, and how recovered you are.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <Link
            to="/fitness/recovery"
            className={buttonClass("secondary")}
          >
            Recovery
          </Link>
          <Button variant="primary" onClick={() => navigate("/fitness/plans/new")}>
            Create Training Plan
          </Button>
        </div>
      </div>

      {loaded && activePlans.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏋️"
            title="No training plan yet"
            description="Create a plan — your intended weekly structure. Workouts you log are recorded separately and never rewrite the plan."
            primaryAction={{
              label: "Create your first plan",
              onClick: () => navigate("/fitness/plans/new"),
            }}
          />
        </Card>
      ) : (
        <>
          {plan && (
            <Card
              title="Active Plan"
              action={
                <Link
                  to={`/fitness/plans/${plan.id}`}
                  className="text-text-secondary text-xs underline hover:text-text-primary"
                >
                  Open
                </Link>
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary text-sm font-medium">{plan.title}</div>
                  <div className="text-text-muted text-xs">
                    Week {plan.currentWeek} of {plan.totalWeeks} · {plan.daysPerWeek} days/week
                  </div>
                </div>
                <Badge tone="success">{plan.status}</Badge>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card title="Recent Workouts">
              {recent.length === 0 ? (
                <div className="text-text-muted text-xs">
                  No workout history yet — start one from a plan.
                </div>
              ) : (
                <div className="space-y-1">
                  {recent.map((w) => (
                    <Link
                      key={w.id}
                      to={`/fitness/workout/${w.id}`}
                      className="flex items-center justify-between py-1.5 hover:bg-surface-inset -mx-2 px-2 rounded-md"
                    >
                      <div>
                        <div className="text-text-primary text-sm">{w.title}</div>
                        <div className="text-text-muted text-xs">{w.date || "no date"}</div>
                      </div>
                      <Badge tone={w.completed ? "success" : "warning"}>
                        {w.completed ? "done" : "in progress"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Recovery">
              <div className="flex items-center gap-2 mb-1">
                <Badge tone={READINESS_TONE[readiness.state]}>{readiness.state}</Badge>
                {readiness.score !== null && (
                  <span className="text-text-secondary text-sm font-semibold">
                    {readiness.score}
                  </span>
                )}
              </div>
              <p className="text-text-muted text-xs">{readiness.reason}</p>
              <div className="text-text-muted text-[11px] mt-2">
                {checkIns.length} check-in(s) recorded ·{" "}
                <Link to="/fitness/recovery" className="underline hover:text-text-secondary">
                  add today's
                </Link>
              </div>
            </Card>
          </div>

          <Card title="Planned Sessions">
            <PlannedSessionSummary />
          </Card>
        </>
      )}
    </div>
  );

  function PlannedSessionSummary() {
    const { getPlannedSessionsForPlan } = useFitness();
    if (!plan) return <div className="text-text-muted text-xs">No active plan.</div>;
    const sessions = getPlannedSessionsForPlan(plan.id);
    if (sessions.length === 0)
      return (
        <div className="text-text-muted text-xs">
          No sessions in this plan yet —{" "}
          <Link
            to={`/fitness/plans/${plan.id}`}
            className="underline hover:text-text-secondary"
          >
            add one
          </Link>
          .
        </div>
      );
    return (
      <div className="space-y-1">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
          >
            <span className="text-text-primary text-sm">
              {dayLabel(s.dayOfWeek)} · {s.title}
            </span>
            <span className="text-text-muted text-xs">{s.exercises.length} exercises</span>
          </div>
        ))}
      </div>
    );
  }
}
