import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { StatCard } from "../../components/StatCard";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState, ErrorState } from "../../components/StateViews";
import { ProposalCard } from "../intelligence/ProposalCard";
import { usePerformance } from "./store";
import { usePlanning } from "../planning/store";
import { useAICoach } from "../intelligence/store";
import type { PlanningBlock } from "../planning/types";

/**
 * Today reads the canonical Planning store's `todaysBlocks` — there is no
 * Today-specific schedule array. A block with an absolute `date` matches that
 * date exactly; an undated block recurs weekly on its weekday.
 *
 * Blocks are grouped NOW / NEXT / LATER / EARLIER by the current time. A block
 * linked to an Action shows the Action's REAL status (read live, never copied);
 * starting Focus never marks the Action done — completion stays Action-owned.
 * If the linked Action was deleted, the block still shows honestly as history.
 */

function timeLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function TodayPage() {
  const { actions, systems, systemHealth, loaded: perfLoaded, loadError: perfError } = usePerformance();
  const { todaysBlocks, loaded: planLoaded, loadError: planError } = usePlanning();
  const { visibleRecommendations } = useAICoach();
  const navigate = useNavigate();

  // Day-17: LOADING ≠ EMPTY. Never flash "your day is open" while the canonical
  // Planning / Performance data is still resolving. An AI Coach failure does
  // NOT gate Today — that stays local to the AI surface below.
  if (perfError || planError) {
    return (
      <ErrorState
        title="Today couldn't load"
        detail={perfError ?? planError ?? undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (!perfLoaded || !planLoaded) {
    return <LoadingState label="Loading today…" />;
  }

  const completedActions = actions.filter((a) => a.status === "done").length;
  const primarySystem = systems.find((s) => s.starred) ?? systems[0];
  const primarySystemHealth = primarySystem ? systemHealth(primarySystem.id) : null;
  const topRecommendation = visibleRecommendations[0] ?? null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...todaysBlocks].sort((a, b) => a.startMinute - b.startMinute);
  const current = sorted.filter((b) => b.startMinute <= nowMin && nowMin < b.endMinute);
  const upcoming = sorted.filter((b) => b.startMinute > nowMin);
  const earlier = sorted.filter((b) => b.endMinute <= nowMin);
  const next = upcoming.slice(0, 1);
  const later = upcoming.slice(1);

  const actionFor = (b: PlanningBlock) => (b.actionId ? actions.find((a) => a.id === b.actionId) ?? null : null);

  const Row = ({ block, muted }: { block: PlanningBlock; muted?: boolean }) => {
    const a = actionFor(block);
    const actionDeleted = !!block.actionId && !a;
    return (
      <div
        className={`flex items-center justify-between py-2 border-b border-border-subtle last:border-0 ${
          muted ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-text-muted text-xs w-12 shrink-0">{timeLabel(block.startMinute)}</span>
          <div className="min-w-0">
            <div className="text-text-primary text-sm truncate">{block.title}</div>
            <div className="text-text-muted text-xs truncate">
              {block.domain}
              {a && (
                <>
                  {" · Action: "}
                  <span className={a.status === "done" ? "line-through" : ""}>{a.title}</span>
                  {" ("}
                  <b>{a.status}</b>
                  {")"}
                </>
              )}
              {actionDeleted && " · linked Action deleted — kept as history"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge tone={block.type === "fixed" ? "neutral" : "success"}>{block.type}</Badge>
          {a && a.status !== "done" && (
            <button
              onClick={() => navigate("/focus")}
              className="px-2 py-1 rounded-md border border-border-subtle text-xs text-text-secondary hover:bg-surface-inset"
            >
              Start Focus
            </button>
          )}
          {a && a.status === "done" && <Badge tone="success">Action done</Badge>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="t-h2 text-text-primary">Today</h2>
        <p className="text-text-muted text-sm">Real data from Goals/Systems/Actions and your Planner — not a mock.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Actions Completed" value={`${completedActions} / ${actions.length}`} />
        <StatCard label="Scheduled Today" value={`${todaysBlocks.length} block(s)`} />
        <StatCard
          label={primarySystem ? `${primarySystem.title} Health` : "System Health"}
          value={
            primarySystemHealth == null || primarySystemHealth.ratio === null
              ? "—"
              : `${Math.round(primarySystemHealth.ratio * 100)}%`
          }
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Today's Plan" className="col-span-2">
          {todaysBlocks.length === 0 ? (
            <EmptyState
              icon="🌤"
              title="Your day is open"
              description="Nothing is scheduled yet — that's not a miss. Plan a block, or capture what's on your mind."
              primaryAction={{ label: "Open Planner", onClick: () => navigate("/planner") }}
              secondaryAction={{ label: "Open Calendar", onClick: () => navigate("/calendar") }}
            />
          ) : (
            <div className="space-y-4">
              {current.length > 0 && (
                <div>
                  <div className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Now</div>
                  {current.map((b) => (
                    <Row key={b.id} block={b} />
                  ))}
                </div>
              )}
              {next.length > 0 && (
                <div>
                  <div className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Next</div>
                  {next.map((b) => (
                    <Row key={b.id} block={b} />
                  ))}
                </div>
              )}
              {later.length > 0 && (
                <div>
                  <div className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Later today</div>
                  {later.map((b) => (
                    <Row key={b.id} block={b} />
                  ))}
                </div>
              )}
              {earlier.length > 0 && (
                <div>
                  <div className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Earlier</div>
                  {earlier.map((b) => (
                    <Row key={b.id} block={b} muted />
                  ))}
                </div>
              )}
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
