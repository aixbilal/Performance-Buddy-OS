import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { ProposalCard, type Proposal } from "../intelligence/ProposalCard";
import { usePerformance } from "./store";
import { useState } from "react";

const STATUS_TONE = {
  "on-track": "success",
  "needs-focus": "warning",
  behind: "danger",
  completed: "neutral",
  paused: "neutral",
} as const;

const AI_MICRO_GOAL_PROPOSAL: Proposal = {
  id: "goal-proposal-1",
  recommendation: "Micro-goal: Learn 30 important cars this month.",
  reason: "Based on your knowledge goals and available time.",
  evidence: ["Knowledge domain has capacity this week", "Matches your recurring reading habit"],
  confidence: "medium",
};

export function GoalsOverviewPage() {
  const { goals } = usePerformance();
  const [proposalHandled, setProposalHandled] = useState(false);
  const navigate = useNavigate();

  const active = goals.filter((g) => g.status !== "completed" && g.status !== "paused");
  const needingAttention = goals.filter((g) => g.status === "needs-focus" || g.status === "behind");

  if (goals.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="No goals yet"
        description="Goals give PBOS a clear outcome to connect systems, actions, and your daily work."
        primaryAction={{ label: "Create Goal", onClick: () => navigate("/goals") }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Goals</h2>
          <p className="text-text-muted text-sm">
            Track and manage your goals across academics, development, fitness, knowledge, language, money, and life.
          </p>
        </div>
      </div>

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
          <div className="text-text-muted text-xs mb-1">Goal Consistency</div>
          <div className="text-text-primary text-lg font-semibold">
            {Math.round(goals.reduce((s, g) => s + g.consistency7d, 0) / (goals.length || 1))}%
          </div>
          <div className="text-text-secondary text-xs">7-day average</div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Active Goals" className="col-span-2">
          <div className="space-y-1">
            {active.map((goal) => (
              <Link
                key={goal.id}
                to={`/goals/${goal.id}`}
                className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md"
              >
                <div>
                  <div className="text-text-primary text-sm">{goal.title}</div>
                  <div className="text-text-muted text-xs capitalize">{goal.domain}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-text-secondary text-xs">
                    {goal.progress.current}
                    {goal.progress.unit === "%" ? "%" : ` ${goal.progress.unit}`} / {goal.progress.target}
                    {goal.progress.unit === "%" ? "%" : ` ${goal.progress.unit}`}
                  </span>
                  <Badge tone={STATUS_TONE[goal.status]}>{goal.status.replace("-", " ")}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Goals Needing Attention">
            <div className="space-y-2">
              {needingAttention.map((g) => (
                <div key={g.id} className="text-sm">
                  <div className="text-text-primary">{g.title}</div>
                  <div className="text-text-muted text-xs capitalize">{g.domain}</div>
                </div>
              ))}
              {needingAttention.length === 0 && (
                <div className="text-text-muted text-xs">Nothing needs attention right now.</div>
              )}
            </div>
          </Card>

          <Card title="AI Recommendation">
            {proposalHandled ? (
              <div className="text-text-muted text-xs">Handled — this proposal is closed.</div>
            ) : (
              <ProposalCard
                proposal={AI_MICRO_GOAL_PROPOSAL}
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
