import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { usePerformance } from "./store";
import { goalTransitionsFrom } from "./engine";
import type { GoalLifecycle } from "./types";
import { Button, buttonClass } from "../../components/Button";

const LIFECYCLE_LABEL: Record<GoalLifecycle, string> = {
  draft: "Draft",
  active: "Active",
  maintenance: "Maintenance",
  paused: "Paused",
  achieved: "Achieved",
  retired: "Retired",
  cancelled: "Cancelled",
};

function daysUntil(iso: string): number {
  return Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
}

export function GoalDetailPage() {
  const { goalId } = useParams();
  const navigate = useNavigate();
  const {
    loaded,
    getGoal,
    systems,
    systemsForGoal,
    goalProgress,
    goalAttention,
    systemHealth,
    actionsForSystem,
    setGoalSystemLink,
    transitionGoal,
    deleteGoal,
    saveState,
  } = usePerformance();

  const [linkOpen, setLinkOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!loaded) return <LoadingState label="Loading…" />;

  const goal = goalId ? getGoal(goalId) : undefined;
  if (!goal) {
    return (
      <div className="space-y-3">
        <Link to="/goals" className="text-text-muted text-xs hover:text-text-secondary">
          ← Goals
        </Link>
        <p className="text-text-muted text-sm">That goal doesn't exist (it may have been deleted).</p>
      </div>
    );
  }

  const linked = systemsForGoal(goal.id);
  const linkedIds = new Set(linked.map((s) => s.id));
  const progress = goalProgress(goal.id);
  const attention = goalAttention(goal.id);
  const transitions = goalTransitionsFrom(goal.lifecycle);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/goals" className="text-text-muted text-xs hover:text-text-secondary">
            ← Goals
          </Link>
          <div className="text-text-muted text-[11px] uppercase mt-1 capitalize">{goal.domain} goal</div>
          <h2 className="t-h2 text-text-primary">{goal.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{LIFECYCLE_LABEL[goal.lifecycle]}</Badge>
            <Badge tone={attention.state === "needs-attention" ? "warning" : attention.state === "on-track" ? "success" : "neutral"}>
              {attention.state === "needs-attention"
                ? "Needs attention"
                : attention.state === "on-track"
                  ? "On track"
                  : "No signal yet"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <Button variant="secondary" onClick={() => navigate(`/goals/${goal.id}/edit`)}>
            Edit Goal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Progress</div>
          {progress.kind === "metric" ? (
            <>
              <div className="text-text-primary text-lg font-semibold">{progress.percent}%</div>
              <div className="text-text-secondary text-xs">
                {progress.current} / {progress.target} {progress.unit}
              </div>
            </>
          ) : (
            <div className="text-text-muted text-sm">No measurable target</div>
          )}
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Deadline</div>
          {goal.deadline ? (
            <>
              <div className="text-text-primary text-sm font-semibold">{goal.deadline}</div>
              <div className="text-text-secondary text-xs">
                {daysUntil(goal.deadline) >= 0
                  ? `${daysUntil(goal.deadline)} days left`
                  : `${-daysUntil(goal.deadline)} days ago`}
              </div>
            </>
          ) : (
            <div className="text-text-muted text-sm">None</div>
          )}
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Priority</div>
          <div className="text-text-primary text-sm font-semibold capitalize">{goal.priority}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Type</div>
          <div className="text-text-primary text-sm font-semibold capitalize">{goal.type}</div>
        </Card>
      </div>

      {goal.detail && (
        <Card title="Why this goal?">
          <p className="text-text-secondary text-sm whitespace-pre-wrap">{goal.detail}</p>
        </Card>
      )}

      <Card title="Linked Systems">
        <div className="flex items-center justify-between mb-2">
          <p className="text-text-muted text-xs">
            Repeatable processes that move this outcome forward. System adherence and goal progress are
            separate measures.
          </p>
          <button
            onClick={() => setLinkOpen((o) => !o)}
            className={`shrink-0 ml-3 ${buttonClass("secondary")}`}
          >
            Manage Systems
          </button>
        </div>

        {linkOpen && (
          <div className="mb-3 bg-surface-inset border border-border-subtle rounded-md p-3 space-y-2">
            <div className="text-text-muted text-xs">Link an existing system, or create a new one.</div>
            {systems.length === 0 && (
              <div className="text-text-muted text-xs">No systems exist yet.</div>
            )}
            {systems.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={linkedIds.has(s.id)}
                  onChange={(e) => setGoalSystemLink(goal.id, s.id, e.target.checked)}
                />
                <span className="text-text-secondary">{s.title}</span>
                <span className="text-text-muted text-xs capitalize">{s.domain}</span>
              </label>
            ))}
            <button
              onClick={() => navigate(`/systems?newFor=${goal.id}`)}
              className="mt-1 px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
            >
              + Create a system for this goal
            </button>
          </div>
        )}

        {linked.length === 0 ? (
          <div className="text-text-muted text-xs">No systems linked yet.</div>
        ) : (
          <div className="space-y-1">
            {linked.map((s) => {
              const h = systemHealth(s.id);
              return (
                <Link
                  key={s.id}
                  to={`/systems/${s.id}`}
                  className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md"
                >
                  <div>
                    <div className="text-text-primary text-sm">{s.title}</div>
                    <div className="text-text-muted text-xs">
                      {s.description || s.cadence || `${actionsForSystem(s.id).length} action(s)`}
                    </div>
                  </div>
                  <span
                    className={`text-xs ${
                      h.state === "at-risk"
                        ? "text-status-danger"
                        : h.state === "drifting"
                          ? "text-status-warning"
                          : h.state === "healthy"
                            ? "text-status-success"
                            : "text-text-muted"
                    }`}
                  >
                    {h.ratio === null ? h.label : `${Math.round(h.ratio * 100)}% · ${h.label}`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Actions from linked systems">
        {linked.length === 0 ? (
          <div className="text-text-muted text-xs">Link a system to see its actions here.</div>
        ) : (
          (() => {
            const rows = linked.flatMap((s) =>
              actionsForSystem(s.id).map((a) => ({ system: s.title, action: a })),
            );
            if (rows.length === 0) return <div className="text-text-muted text-xs">No actions yet.</div>;
            return (
              <div className="space-y-1">
                {rows.slice(0, 12).map(({ system, action }) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm"
                  >
                    <span className="text-text-secondary">
                      {action.title}
                      <span className="text-text-muted text-xs"> · {system}</span>
                    </span>
                    <Badge tone={action.status === "done" ? "success" : "neutral"}>{action.status}</Badge>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </Card>

      <Card title="Status">
        <div className="flex flex-wrap items-center gap-2">
          {transitions.length === 0 ? (
            <span className="text-text-muted text-xs">No further transitions from “{goal.lifecycle}”.</span>
          ) : (
            transitions.map((to) => (
              <button
                key={to}
                onClick={() => transitionGoal(goal.id, to)}
                className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium capitalize"
              >
                Move to {LIFECYCLE_LABEL[to]}
              </button>
            ))
          )}
          <span className="flex-1" />
          {confirmDelete ? (
            <>
              <span className="text-status-danger text-xs">Delete this goal and its links?</span>
              <button
                onClick={async () => {
                  await deleteGoal(goal.id);
                  navigate("/goals");
                }}
                className="px-3 py-1.5 rounded-md bg-status-danger/20 text-status-danger text-xs font-medium"
              >
                Confirm delete
              </button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-md text-text-muted text-xs font-medium hover:text-status-danger"
            >
              Delete Goal
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
