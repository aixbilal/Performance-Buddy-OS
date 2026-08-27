import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { ProposalCard, type Proposal } from "../intelligence/ProposalCard";
import { usePerformance } from "./store";
import type { ActionStatus } from "./types";
import { useState } from "react";

const STATUS_LABEL: Record<ActionStatus, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  completed: "Completed",
};

const PRIORITY_TONE = {
  high: "danger",
  medium: "warning",
  low: "neutral",
} as const;

// Cycles a click through the real lifecycle rather than a single toggle,
// since Actions have three states, not two.
const NEXT_STATUS: Record<ActionStatus, ActionStatus> = {
  "not-started": "in-progress",
  "in-progress": "completed",
  completed: "not-started",
};

export function SystemDetailPage() {
  const { systemId } = useParams();
  const { systems, getActionsForSystem, getGoalForSystem, setActionStatus, computeSystemHealth } =
    usePerformance();
  const system = systems.find((s) => s.id === systemId);
  const [proposalHandled, setProposalHandled] = useState(false);

  if (!system) {
    return <div className="text-text-muted text-sm">System not found.</div>;
  }

  const linkedGoal = getGoalForSystem(system.id);
  const systemActions = getActionsForSystem(system.id);
  const health = computeSystemHealth(system.id);

  const proposal: Proposal = {
    id: `system-proposal-${system.id}`,
    recommendation: "Consider completing 2 more practice sets this week to strengthen weak areas.",
    reason: "You have an upcoming assessment and current mastery evidence is below target.",
    evidence: ["Recent action completion rate: 86%", "Weak-topic pattern detected in Calculus"],
    confidence: "medium",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/systems" className="text-text-muted text-xs hover:text-text-secondary">
          ← Systems Overview
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">{system.title}</h2>
        <p className="text-text-muted text-sm">{system.description}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">System Health</div>
          <div className="text-text-primary text-lg font-semibold">{health}%</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Consistency</div>
          <div className="text-text-primary text-lg font-semibold">{system.consistencyPercent}%</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Active Streak</div>
          <div className="text-text-primary text-lg font-semibold">{system.activeStreakDays} days</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Actions</div>
          <div className="text-text-primary text-lg font-semibold">{systemActions.length}</div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title={`Actions (${systemActions.length})`} className="col-span-2">
          <div className="space-y-1">
            {systemActions.map((action) => (
              <button
                key={action.id}
                onClick={() => setActionStatus(action.id, NEXT_STATUS[action.status])}
                className="w-full flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md text-left"
              >
                <div>
                  <div className="text-text-primary text-sm">{action.title}</div>
                  <div className="text-text-muted text-xs">
                    {action.context} · {action.estMinutes}m · {action.triggerTiming}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={PRIORITY_TONE[action.priority]}>{action.priority}</Badge>
                  <Badge tone={action.status === "completed" ? "success" : "neutral"}>
                    {STATUS_LABEL[action.status]}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
          <p className="text-text-disabled text-[11px] mt-3">Click an action to advance its status.</p>
        </Card>

        <div className="space-y-4">
          {linkedGoal && (
            <Card title="Linked Goal">
              <Link to={`/goals/${linkedGoal.id}`} className="text-text-primary text-sm hover:underline">
                {linkedGoal.title}
              </Link>
              <div className="text-text-muted text-xs mt-1">
                {linkedGoal.progress.current} / {linkedGoal.progress.target}{" "}
                {linkedGoal.progress.unit !== "%" ? linkedGoal.progress.unit : ""}
              </div>
            </Card>
          )}

          <Card title="AI Recommendation">
            {proposalHandled ? (
              <div className="text-text-muted text-xs">Handled — this proposal is closed.</div>
            ) : (
              <ProposalCard
                proposal={proposal}
                onApprove={() => setProposalHandled(true)}
                onModify={() => setProposalHandled(true)}
                onReject={() => setProposalHandled(true)}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
