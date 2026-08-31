/**
 * Daily Check-In — the low-friction execution surface (V1 Day 08 spec).
 * Fast state capture for every routine due today, without opening Detail.
 * A missed routine is neutral — no shame / streak-loss UI.
 */
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useRoutine } from "./store";
import { RoutineCheckIn } from "./RoutineCheckIn";
import type { CompletionState } from "./types";

export function DailyCheckInPage() {
  const navigate = useNavigate();
  const rt = useRoutine();
  const due = rt.getDueToday();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/routine" className="text-text-muted text-xs hover:text-text-secondary">
            ← Routines
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">Daily Check-In</h2>
          <p className="text-text-muted text-sm">
            Record what actually happened today. It writes to the routine's history immediately.
          </p>
        </div>
        <SaveIndicator state={rt.saveState} />
      </div>

      {rt.loaded && rt.routines.filter((r) => !r.archived).length === 0 ? (
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
        <Card>
          <div className="space-y-4">
            {due.map((r) => {
              const state = rt.getRoutineTodayState(r.id);
              const pick = (s: CompletionState) => rt.setTodayState(r.id, s);
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
                    <span className="text-text-muted text-xs">
                      {r.category || r.timeWindow}
                    </span>
                  </div>
                  <RoutineCheckIn routineTitle={r.title} current={state.state} onPick={pick} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
