import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/StateViews";
import { SaveIndicator } from "../../components/SaveIndicator";
import { usePerformance } from "./store";
import type { GoalAttention } from "./engine";

const LIFECYCLE_TONE = {
  draft: "neutral",
  active: "success",
  maintenance: "neutral",
  paused: "neutral",
  achieved: "success",
  retired: "neutral",
  cancelled: "neutral",
} as const;

const ATTENTION_TONE: Record<GoalAttention["state"], "success" | "warning" | "neutral"> = {
  "on-track": "success",
  "needs-attention": "warning",
  "no-signal": "neutral",
};

const ATTENTION_LABEL: Record<GoalAttention["state"], string> = {
  "on-track": "On track",
  "needs-attention": "Needs attention",
  "no-signal": "No signal yet",
};

const ACTIVE_LIFECYCLES = ["draft", "active", "maintenance", "paused"];

export function GoalsOverviewPage() {
  const {
    loaded,
    goals,
    goalProgress,
    goalAttention,
    systemsForGoal,
    saveState,
    saveError,
  } = usePerformance();
  const navigate = useNavigate();

  if (!loaded) {
    return <LoadingState label="Loading your goals…" />;
  }

  if (goals.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="No goals yet"
        description="A goal is a desired outcome. PBOS connects it to repeatable systems and concrete actions. Create your first one."
        primaryAction={{ label: "Create Goal", onClick: () => navigate("/goals/new") }}
      />
    );
  }

  const active = goals.filter((g) => ACTIVE_LIFECYCLES.includes(g.lifecycle));
  const other = goals.filter((g) => !ACTIVE_LIFECYCLES.includes(g.lifecycle));
  const needingAttention = active.filter((g) => goalAttention(g.id).state === "needs-attention");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Goals</h2>
          <p className="text-text-muted text-sm">
            Desired outcomes across every domain — what's active, progressing, or needs attention.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <button
            onClick={() => navigate("/goals/new")}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            + Create Goal
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-status-danger/10 border border-status-danger/30 rounded-md px-4 py-2 text-xs text-status-danger">
          Last change couldn't be saved: {saveError}. Your edit is still here — it will retry on the next change.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Active Goals</div>
          <div className="text-text-primary text-lg font-semibold">{active.length}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Needing Attention</div>
          <div className="text-text-primary text-lg font-semibold">{needingAttention.length}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Completed / Retired</div>
          <div className="text-text-primary text-lg font-semibold">{other.length}</div>
        </Card>
      </div>

      <Card title="Active Goals">
        {active.length === 0 ? (
          <div className="text-text-muted text-xs">No active goals — everything is paused, achieved or retired.</div>
        ) : (
          <div className="space-y-1">
            {active.map((goal) => {
              const p = goalProgress(goal.id);
              const att = goalAttention(goal.id);
              return (
                <Link
                  key={goal.id}
                  to={`/goals/${goal.id}`}
                  className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md"
                >
                  <div>
                    <div className="text-text-primary text-sm">{goal.title}</div>
                    <div className="text-text-muted text-xs capitalize">
                      {goal.domain} · {goal.type} · {systemsForGoal(goal.id).length} system(s)
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-text-secondary text-xs">
                      {p.kind === "metric"
                        ? `${p.current} / ${p.target} ${p.unit} · ${p.percent}%`
                        : "No measurable target"}
                    </span>
                    <Badge tone={ATTENTION_TONE[att.state]}>{ATTENTION_LABEL[att.state]}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {needingAttention.length > 0 && (
        <Card title="Goals Needing Attention">
          <div className="space-y-2">
            {needingAttention.map((g) => (
              <div key={g.id} className="text-sm">
                <Link to={`/goals/${g.id}`} className="text-text-primary hover:underline">
                  {g.title}
                </Link>
                <ul className="text-text-muted text-xs list-disc list-inside">
                  {goalAttention(g.id).reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {other.length > 0 && (
        <Card title="Completed / Retired / Paused">
          <div className="space-y-1">
            {other.map((g) => (
              <Link
                key={g.id}
                to={`/goals/${g.id}`}
                className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md"
              >
                <span className="text-text-secondary text-sm">{g.title}</span>
                <Badge tone={LIFECYCLE_TONE[g.lifecycle]}>{g.lifecycle}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card title="Suggested by AI">
        <p className="text-text-secondary text-xs mb-2">
          PBOS can propose a micro-goal from your patterns. A proposal is never created automatically —
          you review it in the builder first.
        </p>
        <button
          onClick={() => navigate("/goals/new?tab=ai")}
          className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
        >
          Review AI proposal
        </button>
      </Card>
    </div>
  );
}
