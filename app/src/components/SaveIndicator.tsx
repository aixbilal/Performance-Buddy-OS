import { saveStateLabel } from "../domains/resilience/engine";
import type { SaveState } from "../domains/resilience/types";

const TONE: Record<SaveState, string> = {
  idle: "text-text-disabled",
  saving: "text-text-muted",
  saved: "text-status-success",
  failed: "text-status-danger",
};

/**
 * §50: truthful persistence state only — never claims "Saved" before the
 * real save actually succeeded. Reused wherever `usePersistedState` is used,
 * per §25's "one reusable component" rule.
 */
export function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry?: () => void }) {
  const label = saveStateLabel(state);
  if (!label) return null;

  return (
    <div className={`flex items-center gap-2 text-[11px] ${TONE[state]}`}>
      <span>{label}</span>
      {state === "failed" && onRetry && (
        <button onClick={onRetry} className="underline hover:text-text-secondary">
          Retry
        </button>
      )}
    </div>
  );
}
