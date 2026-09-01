import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState, ErrorState } from "../../components/StateViews";
import { PrimaryActionSurface } from "../../components/PrimaryActionSurface";
import { ValueTransition } from "../../components/motion/ValueTransition";
import { ProposalCard } from "../intelligence/ProposalCard";
import { usePerformance } from "./store";
import { usePlanning } from "../planning/store";
import { useAICoach } from "../intelligence/store";
import { useFocus } from "../focus/store";
import { deriveTodayState } from "./todayEngine";
import { useTodayCapacity } from "./useTodayCapacity";
import { isoDateOf } from "../planning/engine";
import type { PlanningBlock } from "../planning/types";
import type { Action } from "./types";
import type { TodayCapacityLevel } from "../adaptive/types";

/**
 * Today reads the canonical Planning store's `todaysBlocks` — there is no
 * Today-specific schedule array. A block with an absolute `date` matches that
 * date exactly; an undated block recurs weekly on its weekday.
 *
 * V1 Visual Correction (§16–§21): the surface is recomposed into an OPERATING
 * hierarchy, not a dashboard. One primary "what should I do now?" surface
 * (current-or-next block) sits above a secondary NOW/NEXT/LATER/EARLIER
 * timeline and the advisory AI panel; the three summary metrics are preserved
 * but demoted to a compact tertiary strip. No data or capability is removed —
 * the featured block is simply lifted out of the timeline, and each block's
 * real linked-Action status is still read live (starting Focus never marks an
 * Action done — completion stays Action-owned).
 */

function timeLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function durationLabel(block: PlanningBlock) {
  const mins = Math.max(0, block.endMinute - block.startMinute);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** One timeline row — a scheduled block with its live linked-Action status. */
function Row({
  block,
  action,
  onStartFocus,
  muted,
}: {
  block: PlanningBlock;
  action: Action | null;
  onStartFocus: () => void;
  muted?: boolean;
}) {
  const actionDeleted = !!block.actionId && !action;
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
            {action && (
              <>
                {" · Action: "}
                <span className={action.status === "done" ? "line-through" : ""}>{action.title}</span>
                {" ("}
                <b>{action.status}</b>
                {")"}
              </>
            )}
            {actionDeleted && " · linked Action deleted — kept as history"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge tone={block.type === "fixed" ? "neutral" : "success"}>{block.type}</Badge>
        {action && action.status !== "done" && (
          <button
            onClick={onStartFocus}
            className="px-2 py-1 rounded-md border border-border-subtle text-xs text-text-secondary hover:bg-surface-inset"
          >
            Start Focus
          </button>
        )}
        {action && action.status === "done" && <Badge tone="success">Action done</Badge>}
      </div>
    </div>
  );
}

function TimelineGroup({
  label,
  blocks,
  actionFor,
  onStartFocus,
  muted,
}: {
  label: string;
  blocks: PlanningBlock[];
  actionFor: (b: PlanningBlock) => Action | null;
  onStartFocus: () => void;
  muted?: boolean;
}) {
  if (blocks.length === 0) return null;
  return (
    <div>
      <div className="text-text-muted text-[10px] uppercase tracking-wide mb-1">{label}</div>
      {blocks.map((b) => (
        <Row key={b.id} block={b} action={actionFor(b)} onStartFocus={onStartFocus} muted={muted} />
      ))}
    </div>
  );
}

export function TodayPage() {
  const { actions, systems, systemHealth, loaded: perfLoaded, loadError: perfError } = usePerformance();
  const {
    todaysBlocks,
    todayIso,
    capacity,
    weeklyScheduledMinutes,
    occurrenceStateFor,
    resolveOccurrence,
    loaded: planLoaded,
    loadError: planError,
  } = usePlanning();
  const { visibleRecommendations } = useAICoach();
  const focus = useFocus();
  const capIso = todayIso ?? isoDateOf(new Date());
  const { level: capacityLevel, setLevel: setCapacityLevel } = useTodayCapacity(capIso);
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
  const healthPct =
    primarySystemHealth == null || primarySystemHealth.ratio === null
      ? null
      : Math.round(primarySystemHealth.ratio * 100);
  const topRecommendation = visibleRecommendations[0] ?? null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...todaysBlocks].sort((a, b) => a.startMinute - b.startMinute);
  const current = sorted.filter((b) => b.startMinute <= nowMin && nowMin < b.endMinute);
  const upcoming = sorted.filter((b) => b.startMinute > nowMin);
  const earlier = sorted.filter((b) => b.endMinute <= nowMin);

  const actionFor = (b: PlanningBlock) => (b.actionId ? actions.find((a) => a.id === b.actionId) ?? null : null);

  // The single featured block: whatever is running now, else the next thing up.
  const featured = current[0] ?? upcoming[0] ?? null;
  const featuredIsCurrent = !!featured && current[0]?.id === featured.id;
  const rest = (list: PlanningBlock[]) => list.filter((b) => b.id !== featured?.id);
  const restNext = rest(featuredIsCurrent ? upcoming : upcoming.slice(1));
  const restEarlier = rest(earlier);
  const restCurrent = featuredIsCurrent ? [] : rest(current);
  const timelineCount = restCurrent.length + restNext.length + restEarlier.length;

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const featuredAction = featured ? actionFor(featured) : null;

  // --- Adaptive Today derivation (pure engine, `now` passed in) --------
  const focusMinutesForBlock = (blockId: string) =>
    focus.history
      .filter((r) => r.planningBlockId === blockId && r.completedAt?.slice(0, 10) === capIso)
      .reduce((s, r) => s + r.durationMinutes, 0);
  const todayState = deriveTodayState({
    nowMinute: nowMin,
    nowIso: capIso,
    blocksToday: todaysBlocks,
    occurrenceStateFor: (id, iso) => occurrenceStateFor(id, iso),
    focusMinutesForBlock,
    actionStatusFor: (id) => actions.find((a) => a.id === id)?.status ?? null,
    dailyCapacityMinutes: capacity.dailyCapacityMinutes,
    weeklyCapacityMinutes: capacity.weeklyCapacityMinutes,
    weeklyScheduledMinutes,
    capacityLevel,
  });

  const startFocus = () => {
    if (featured) {
      focus.startWith({
        title: featured.title,
        linkedBlockId: featured.id,
        linkedActionId: featured.actionId,
        targetMinutes: Math.max(0, featured.endMinute - featured.startMinute),
        returnTo: "/",
      });
    }
    navigate("/focus");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="t-h2 text-text-primary">Today</h2>
          <p className="text-text-muted text-sm">
            {dateLabel} · {todaysBlocks.length} block{todaysBlocks.length === 1 ? "" : "s"} planned ·{" "}
            {completedActions} action{completedActions === 1 ? "" : "s"} done
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" role="group" aria-label="Today's operating capacity">
            <span className="t-caption text-text-muted mr-1">Capacity</span>
            {(["low", "normal", "high"] as TodayCapacityLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                aria-pressed={capacityLevel === lvl}
                onClick={() => void setCapacityLevel(lvl)}
                className={`h-7 px-2 rounded text-[0.75rem] border capitalize ${
                  capacityLevel === lvl
                    ? "bg-surface-selected text-text-primary border-border-focus"
                    : "text-text-muted border-border-subtle hover:text-text-secondary"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("pbos:open-natural-capture"))}
            className="h-8 px-3 rounded-md text-[0.8125rem] bg-action-secondary text-text-primary border border-border-subtle hover:border-border-strong"
          >
            Capture what happened
          </button>
        </div>
      </div>

      {/* PRIMARY — one strong "what should I do now?" surface (§17–§18). */}
      {todaysBlocks.length === 0 ? (
        <PrimaryActionSurface state="idle" eyebrow="Today">
          <EmptyState
            icon="🌤"
            title="Your day is open"
            description="Nothing is scheduled yet — that's not a miss. Plan a block, or capture what's on your mind."
            primaryAction={{ label: "Open Planner", onClick: () => navigate("/planner") }}
            secondaryAction={{ label: "Open Calendar", onClick: () => navigate("/calendar") }}
          />
        </PrimaryActionSurface>
      ) : featured ? (
        <PrimaryActionSurface eyebrow={featuredIsCurrent ? "Now" : "Next"}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="t-h3 text-text-primary">{featured.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-text-muted text-sm">
                <span>{durationLabel(featured)}</span>
                <span aria-hidden>·</span>
                <span>{timeLabel(featured.startMinute)}–{timeLabel(featured.endMinute)}</span>
                <span aria-hidden>·</span>
                <span className="truncate">{featured.domain}</span>
              </div>
              {featuredAction && (
                <div className="mt-1 text-text-muted text-sm truncate">
                  Action:{" "}
                  <span className={featuredAction.status === "done" ? "line-through" : "text-text-secondary"}>
                    {featuredAction.title}
                  </span>{" "}
                  (<b>{featuredAction.status}</b>)
                </div>
              )}
            </div>
            <div className="shrink-0">
              {featuredAction && featuredAction.status === "done" ? (
                <Badge tone="success">Action done</Badge>
              ) : (
                <Button variant="primary" size="md" onClick={startFocus}>
                  Start Focus
                </Button>
              )}
            </div>
          </div>
        </PrimaryActionSurface>
      ) : (
        <PrimaryActionSurface state="idle" eyebrow="Today">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-text-secondary text-sm">
              Nothing left on today's plan — the rest of the day is yours.
            </p>
            <Button variant="ghost" onClick={() => navigate("/planner")}>
              Open Planner
            </Button>
          </div>
        </PrimaryActionSurface>
      )}

      {/* CONDITIONAL — ADAPTATION. Shown only on material divergence (§11.1). */}
      {todayState.mode === "adaptation-needed" && (
        <Card title="Adaptation needed" emphasis="secondary">
          <ul className="space-y-1 text-sm text-text-secondary">
            {todayState.adaptationReasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-status-warning">•</span>
                {r}
              </li>
            ))}
          </ul>
          {todayState.elapsedUnresolved.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="t-caption text-text-muted uppercase tracking-wide">
                Passed, still unresolved
              </p>
              {todayState.elapsedUnresolved.map((v) => (
                <div
                  key={v.block.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-inset px-3 py-2"
                >
                  <div className="text-sm text-text-primary">
                    {v.block.title}{" "}
                    <span className="text-text-muted text-xs">
                      · {timeLabel(v.block.startMinute)}–{timeLabel(v.block.endMinute)}
                      {v.actualFocusMinutes > 0 && ` · ${v.actualFocusMinutes} min focused`}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        void resolveOccurrence(v.block.id, capIso, "done")
                      }
                      className="px-2 py-1 rounded text-[11px] border border-border-subtle text-text-secondary hover:text-text-primary"
                    >
                      Mark done
                    </button>
                    <button
                      onClick={() =>
                        void resolveOccurrence(v.block.id, capIso, "skipped")
                      }
                      className="px-2 py-1 rounded text-[11px] border border-border-subtle text-text-secondary hover:text-text-primary"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => navigate("/planner")}
                      className="px-2 py-1 rounded text-[11px] border border-border-subtle text-text-secondary hover:text-text-primary"
                    >
                      Re-plan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate("/planner")}>
              Review the plan
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("pbos:open-natural-capture"))}
            >
              Capture what changed
            </Button>
          </div>
        </Card>
      )}

      {/* SECONDARY — the timeline + the advisory AI panel (§20–§21). */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Today's Plan" emphasis="secondary" className="lg:col-span-2">
          {todaysBlocks.length === 0 ? (
            <p className="text-text-muted text-sm">Plan a block to see your timeline here.</p>
          ) : timelineCount === 0 ? (
            <p className="text-text-muted text-sm">
              {featured ? "Nothing else scheduled around this." : "Nothing else on today's timeline."}
            </p>
          ) : (
            <div className="space-y-4">
              <TimelineGroup label="Now" blocks={restCurrent} actionFor={actionFor} onStartFocus={startFocus} />
              <TimelineGroup label="Next" blocks={restNext} actionFor={actionFor} onStartFocus={startFocus} />
              <TimelineGroup label="Earlier" blocks={restEarlier} actionFor={actionFor} onStartFocus={startFocus} muted />
            </div>
          )}
        </Card>

        <Card title="AI Coach" emphasis="secondary">
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

      {/* TERTIARY — the same three metrics, demoted to a compact strip (§19). */}
      <div className="flex flex-wrap items-stretch gap-x-8 gap-y-3 rounded-lg border border-border-divider px-4 py-3">
        <div className="min-w-[8rem]">
          <div className="t-label uppercase text-text-muted">Actions Completed</div>
          <ValueTransition
            className="t-metric-md text-text-primary"
            value={completedActions}
            format={(n) => `${Math.round(n)} / ${actions.length}`}
          />
        </div>
        <div className="min-w-[8rem]">
          <div className="t-label uppercase text-text-muted">Scheduled Today</div>
          <div className="t-metric-md text-text-primary">
            {todaysBlocks.length} block{todaysBlocks.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="min-w-[8rem]">
          <div className="t-label uppercase text-text-muted">
            {primarySystem ? `${primarySystem.title} Health` : "System Health"}
          </div>
          {healthPct == null ? (
            <div className="t-metric-md text-text-primary">—</div>
          ) : (
            <ValueTransition
              className="t-metric-md text-text-primary"
              value={healthPct}
              format={(n) => `${Math.round(n)}%`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
