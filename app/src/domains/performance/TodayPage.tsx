import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { StatCard } from "../../components/StatCard";
import { ProposalCard } from "../intelligence/ProposalCard";
import { usePerformance } from "./store";
import { usePlanning } from "../planning/store";
import { useAICoach } from "../intelligence/store";

/**
 * Day 18 fix: this page previously rendered MOCK_GLANCE / MOCK_PLAN /
 * MOCK_PROPOSAL — a textbook "competing task record" violation. It now
 * reads Today's Plan from the real Planning store's ScheduleBlocks
 * (filtered to today's day-of-week), resolves each block's linked
 * canonical Action via `actionId` where one exists, and shows the real
 * pending AI recommendation instead of a hardcoded proposal.
 *
 * HONEST LIMITATION: `Action` has no due-date field yet, so "today's plan"
 * is scoped to blocks whose day-of-week matches today, not a true date
 * match. Full date-based Actions are a real future improvement.
 */

const JS_DAY_TO_MONDAY_INDEX = [6, 0, 1, 2, 3, 4, 5]; // JS getDay(): 0=Sun..6=Sat -> our 0=Mon..6=Sun

export function TodayPage() {
  const { actions, systems, computeSystemHealth } = usePerformance();
  const { blocks } = usePlanning();
  const { visibleRecommendations } = useAICoach();

  const todayIndex = JS_DAY_TO_MONDAY_INDEX[new Date().getDay()];
  const todaysBlocks = blocks.filter((b) => b.day === todayIndex).sort((a, b) => a.startMinute - b.startMinute);

  const completedActions = actions.filter((a) => a.status === "completed").length;
  const primarySystem = systems[0];
  const primarySystemHealth = primarySystem ? computeSystemHealth(primarySystem.id) : null;

  const topRecommendation = visibleRecommendations[0] ?? null;

  const timeLabel = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${m.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Today</h2>
        <p className="text-text-muted text-sm">Real data from Goals/Systems/Actions and your Planner — not a mock.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Actions Completed" value={`${completedActions} / ${actions.length}`} />
        <StatCard label="Scheduled Today" value={`${todaysBlocks.length} block(s)`} />
        <StatCard
          label={primarySystem ? `${primarySystem.title} Health` : "System Health"}
          value={primarySystemHealth !== null ? `${primarySystemHealth}%` : "—"}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Today's Plan" className="col-span-2">
          {todaysBlocks.length === 0 ? (
            <div className="text-text-muted text-xs">Nothing scheduled for today yet.</div>
          ) : (
            <div className="space-y-2">
              {todaysBlocks.map((block) => {
                const linkedAction = block.actionId ? actions.find((a) => a.id === block.actionId) : null;
                return (
                  <div
                    key={block.id}
                    className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted text-xs w-12">{timeLabel(block.startMinute)}</span>
                      <div>
                        <div className="text-text-primary text-sm">{block.title}</div>
                        <div className="text-text-muted text-xs">
                          {block.domain}
                          {linkedAction && ` · linked to Action: ${linkedAction.title}`}
                        </div>
                      </div>
                    </div>
                    <Badge tone={block.type === "fixed" ? "neutral" : "success"}>{block.type}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="AI Coach">
          {topRecommendation ? (
            <ProposalCard
              proposal={{
                id: topRecommendation.id,
                recommendation: topRecommendation.title,
                reason: topRecommendation.generatedFrom,
                evidence: topRecommendation.evidence,
                confidence:
                  topRecommendation.confidence === "moderate"
                    ? "medium"
                    : topRecommendation.confidence === "limited"
                      ? "low"
                      : "high",
              }}
              onApprove={() => {}}
              onModify={() => {}}
              onReject={() => {}}
            />
          ) : (
            <div className="text-text-muted text-xs">No changes recommended right now.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
