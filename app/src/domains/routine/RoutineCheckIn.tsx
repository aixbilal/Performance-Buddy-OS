/**
 * Shared low-friction check-in control — accessible buttons for the five
 * pickable states. Used on the Overview, Daily Check-In and Routine Detail
 * surfaces so there is ONE check-in interaction, not three.
 *
 * Missing a routine never triggers shame/streak-loss UI — the states are
 * neutral and a "missed" pick is just data.
 */
import { CHECK_IN_STATES, type CompletionState } from "./types";

const STATE_LABEL: Record<CompletionState, string> = {
  complete: "Done",
  partial: "Partial",
  skipped: "Skipped",
  rest: "Rest",
  missed: "Missed",
  pending: "Not yet",
};

const STATE_TONE: Record<CompletionState, string> = {
  complete: "bg-status-success/15 text-status-success border-status-success/30",
  partial: "bg-status-warning/15 text-status-warning border-status-warning/30",
  skipped: "bg-surface-inset text-text-secondary border-border-subtle",
  rest: "bg-surface-inset text-text-secondary border-border-subtle",
  missed: "bg-status-danger/10 text-status-danger border-status-danger/30",
  pending: "bg-surface-inset text-text-muted border-border-subtle",
};

export function RoutineCheckIn({
  routineTitle,
  current,
  onPick,
  disabled,
}: {
  routineTitle: string;
  current: CompletionState;
  onPick: (state: CompletionState) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label={`Check-in for ${routineTitle}`}
    >
      {CHECK_IN_STATES.map((s) => {
        const active = current === s;
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={`Mark ${routineTitle} ${STATE_LABEL[s]}`}
            onClick={() => onPick(s)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-50 ${
              active ? STATE_TONE[s] : "bg-surface-inset text-text-muted border-border-subtle hover:text-text-secondary"
            }`}
          >
            {STATE_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

export { STATE_LABEL as CHECK_IN_STATE_LABEL };
