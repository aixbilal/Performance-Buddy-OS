import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useRoutine } from "./store";
import type { CompletionState, TimeWindow } from "./types";

const WINDOWS: { key: TimeWindow; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "day", label: "Day" },
  { key: "evening", label: "Evening" },
];

const STATE_TONE = {
  complete: "success",
  partial: "warning",
  pending: "neutral",
  missed: "danger",
  rest: "neutral",
  skipped: "neutral",
} as const;

function nextState(current: CompletionState): CompletionState {
  return current === "complete" ? "pending" : "complete";
}

export function RoutinesOverviewPage() {
  const { getByWindow, getTodayLog, getConsistency, setTodayState } = useRoutine();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Routines</h2>
        <p className="text-text-muted text-sm">What personal routines matter today, what's done, and what still needs attention.</p>
      </div>

      {WINDOWS.map(({ key, label }) => {
        const routines = getByWindow(key);
        if (routines.length === 0) return null;
        return (
          <Card key={key} title={label}>
            <div className="space-y-1">
              {routines.map((r) => {
                const log = getTodayLog(r.id);
                const state = log?.state ?? "pending";
                const consistency = getConsistency(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => setTodayState(r.id, nextState(state))}
                    className="w-full flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md text-left"
                  >
                    <div>
                      <div className="text-text-primary text-sm">{r.title}</div>
                      <div className="text-text-muted text-xs">
                        {r.category}
                        {consistency.percent !== null && ` · ${consistency.percent}% (30d)`}
                      </div>
                    </div>
                    <Badge tone={STATE_TONE[state]}>{state}</Badge>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
