/**
 * Daily Check-In — the low-friction execution surface (V1 Day 08 spec).
 * Fast state capture for every routine due today, without opening Detail.
 * A missed routine is neutral — no shame / streak-loss UI.
 *
 * V1 Visual Correction (§22–§24): recomposed to use the horizontal workspace
 * intentionally instead of a small card floating in an empty pane — a
 * progress/context header, full-width check-in rows, and a compact secondary
 * "today so far" summary. The interaction itself is unchanged (one click per
 * routine via <RoutineCheckIn>); nothing is gamified — no streaks, XP, rings
 * or badges.
 */
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { useRoutine } from "./store";
import { RoutineCheckIn, CHECK_IN_STATE_LABEL } from "./RoutineCheckIn";
import type { CompletionState } from "./types";

const SUMMARY_ORDER: CompletionState[] = ["complete", "partial", "skipped", "rest", "missed", "pending"];

export function DailyCheckInPage() {
  const navigate = useNavigate();
  const rt = useRoutine();
  const due = rt.getDueToday();

  if (!rt.loaded) return <LoadingState label="Loading today's routines…" />;

  const noRoutines = rt.routines.filter((r) => !r.archived).length === 0;

  const states = due.map((r) => rt.getRoutineTodayState(r.id));
  const recorded = states.filter((s) => s.logged).length;
  const counts = SUMMARY_ORDER.map((state) => ({
    state,
    n: states.filter((s) => s.logged && s.state === state).length,
  })).filter((c) => c.n > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/routine" className="text-text-muted text-xs hover:text-text-secondary">
            ← Routines
          </Link>
          <h2 className="t-h2 text-text-primary mt-1">Daily Check-In</h2>
          <p className="text-text-muted text-sm">
            Record what actually happened today. It writes to the routine's history immediately.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {due.length > 0 && (
            <div className="text-right">
              <div className="t-metric-md text-text-primary">
                {recorded}
                <span className="t-small text-text-muted"> / {due.length}</span>
              </div>
              <div className="t-label uppercase text-text-muted">Recorded today</div>
            </div>
          )}
          <SaveIndicator state={rt.saveState} />
        </div>
      </div>

      {noRoutines ? (
        <Card>
          <EmptyState
            icon="🔁"
            title="No routines to check in"
            description="Create a routine first — it will then show up here on the days it's scheduled."
            primaryAction={{ label: "New Routine", onClick: () => navigate("/routine/new") }}
          />
        </Card>
      ) : due.length === 0 ? (
        <Card>
          <div className="text-text-muted text-sm">
            Nothing scheduled for today. Nothing to record — this is not a miss.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-4 items-start">
          <Card emphasis="secondary" padding="md">
            <ul className="divide-y divide-border-subtle">
              {due.map((r) => {
                const state = rt.getRoutineTodayState(r.id);
                const pick = (s: CompletionState) => rt.setTodayState(r.id, s);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/routine/${r.id}`}
                        className="text-text-primary text-sm font-medium hover:text-text-secondary"
                      >
                        {r.title}
                      </Link>
                      <div className="text-text-muted text-xs truncate">
                        {(r.category || r.timeWindow)} · {rt.scheduleLabel(r)}
                        {state.logged && ` · recorded ${CHECK_IN_STATE_LABEL[state.state]}`}
                      </div>
                    </div>
                    <RoutineCheckIn routineTitle={r.title} current={state.state} onPick={pick} />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card emphasis="tertiary" padding="md">
            <div className="t-label uppercase text-text-muted mb-2">Today so far</div>
            {recorded === 0 ? (
              <p className="text-text-muted text-xs">Nothing recorded yet.</p>
            ) : (
              <dl className="space-y-1.5 text-sm">
                {counts.map((c) => (
                  <div key={c.state} className="flex items-center justify-between gap-2">
                    <dt className="text-text-secondary">{CHECK_IN_STATE_LABEL[c.state]}</dt>
                    <dd className="text-text-primary tabular-nums">{c.n}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-1.5">
                  <dt className="text-text-muted">Remaining</dt>
                  <dd className="text-text-primary tabular-nums">{due.length - recorded}</dd>
                </div>
              </dl>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
