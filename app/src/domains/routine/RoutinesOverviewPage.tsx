import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { useRoutine } from "./store";
import { RoutineCheckIn } from "./RoutineCheckIn";
import type { CompletionState, TimeWindow } from "./types";
import { Button, buttonClass } from "../../components/Button";

const WINDOWS: { key: TimeWindow; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "day", label: "Day" },
  { key: "evening", label: "Evening" },
  { key: "anytime", label: "Anytime" },
];

export function RoutinesOverviewPage() {
  const navigate = useNavigate();
  const rt = useRoutine();

  if (!rt.loaded) return <LoadingState label="Loading routines…" />;

  const activeRoutines = rt.routines.filter((r) => !r.archived);
  const dueToday = rt.getDueToday();
  const doneToday = dueToday.filter((r) => {
    const s = rt.getRoutineTodayState(r.id).state;
    return s === "complete" || s === "partial";
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="t-h2 text-text-primary">Routines</h2>
          <p className="text-text-muted text-sm">
            Repeated personal systems and what needs attention today — consistency, not streak pressure.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={rt.saveState} />
          {activeRoutines.length > 0 && (
            <Link
              to="/routine/check-in"
              className={buttonClass("secondary")}
            >
              Daily Check-In
            </Link>
          )}
          <Button variant="primary" onClick={() => navigate("/routine/new")}>
            New Routine
          </Button>
        </div>
      </div>

      {rt.loadError && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-md px-4 py-3 text-xs text-status-warning">
          Your saved routine data couldn't be read ({rt.loadError}). Nothing was deleted.
        </div>
      )}

      {rt.loaded && activeRoutines.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔁"
            title="No routines yet"
            description="Add a repeatable behavior — prayer, hydration, skincare, a morning routine. It can stand on its own without a Goal."
            primaryAction={{ label: "Create your first routine", onClick: () => navigate("/routine/new") }}
          />
        </Card>
      ) : (
        <>
          <Card title="Today">
            {dueToday.length === 0 ? (
              <div className="text-text-muted text-xs">Nothing scheduled for today.</div>
            ) : (
              <div className="text-text-secondary text-sm">
                {doneToday.length} of {dueToday.length} due routines recorded ·{" "}
                <Link to="/routine/check-in" className="underline hover:text-text-primary">
                  open Daily Check-In
                </Link>
              </div>
            )}
          </Card>

          {WINDOWS.map(({ key, label }) => {
            const routines = activeRoutines.filter((r) => r.timeWindow === key);
            if (routines.length === 0) return null;
            return (
              <Card key={key} title={label}>
                <div className="space-y-3">
                  {routines.map((r) => {
                    const today = rt.getRoutineTodayState(r.id);
                    const consistency = rt.getRoutineConsistency(r.id);
                    const pick = (state: CompletionState) => rt.setTodayState(r.id, state);
                    return (
                      <div
                        key={r.id}
                        className="py-2 border-b border-border-subtle last:border-0 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/routine/${r.id}`}
                            className="text-text-primary text-sm hover:text-text-secondary underline"
                          >
                            {r.title}
                          </Link>
                          <div className="flex items-center gap-2">
                            {r.paused && <Badge>paused</Badge>}
                            <span className="text-text-muted text-xs">
                              {rt.scheduleLabel(r)}
                              {consistency.percent !== null
                                ? ` · ${consistency.percent}% (${consistency.windowDays}d)`
                                : " · no history yet"}
                            </span>
                          </div>
                        </div>
                        {today.scheduledToday ? (
                          <RoutineCheckIn
                            routineTitle={r.title}
                            current={today.state}
                            onPick={pick}
                          />
                        ) : (
                          <div className="text-text-muted text-[11px]">Not scheduled today.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
