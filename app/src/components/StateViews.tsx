import type { ReactNode } from "react";
import { Button } from "./Button";

/**
 * Shared Day-17 resilience state views. These sit alongside `EmptyState`
 * (true/positive/filtered/setup-required empties) and cover the states the
 * audit flagged as MISSING: LOADING, ERROR, PARTIAL, STALE.
 *
 * Deliberately restrained — no cyberpunk shimmer, no fake progress %, no
 * giant illustrations (Day-17 §"Skeletons"/§"Loading & Partial-Data"). Each
 * carries the right ARIA role so assistive tech announces it once:
 *   - LoadingState / PartialDataNotice / StaleNotice → role="status" (polite)
 *   - ErrorState                                     → role="alert"  (assertive)
 *
 * State semantics stay explicit — a caller picks the component that matches
 * the real reason; nothing here collapses several reasons into one blob.
 */

/** LOADING ≠ EMPTY. A result is expected; show a calm placeholder, never "nothing here". */
export function LoadingState({ label = "Loading…", inline = false }: { label?: string; inline?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        inline
          ? "flex items-center gap-2 text-text-muted text-xs"
          : "flex items-center justify-center gap-2 py-10 text-text-muted text-sm"
      }
    >
      <span className="w-1.5 h-1.5 rounded-full bg-text-disabled motion-safe:animate-pulse" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/**
 * A local ERROR. Answers Day-17 §35's three questions: what failed, is my
 * data safe, what can I do. `onRetry` is shown only when a retry is actually
 * safe (idempotent) — the caller decides.
 */
export function ErrorState({
  title = "Something went wrong",
  detail,
  dataSafeNote = "Your saved data is safe — this only affects this view.",
  onRetry,
  retryLabel = "Try Again",
}: {
  title?: string;
  detail?: string;
  dataSafeNote?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center text-center py-10 px-6"
    >
      <div className="text-status-danger text-sm font-medium mb-1">{title}</div>
      {detail && <p className="text-text-muted text-xs max-w-sm mb-1">{detail}</p>}
      <p className="text-text-muted text-xs max-w-sm mb-4">{dataSafeNote}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * PARTIAL ≠ FAILED. Some real data is shown; this notes, honestly, what is
 * missing and why — it never turns the gap into a guessed value.
 */
export function PartialDataNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="bg-surface-inset border border-border-subtle rounded-md px-3 py-2 text-xs text-text-muted flex items-start gap-2"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-status-warning mt-1 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/**
 * STALE ≠ CURRENT. A previously-valid value is still visible but is known to
 * be out of date; use ONLY where real freshness semantics exist (e.g. an
 * Obsidian index whose file has since moved).
 */
export function StaleNotice({
  children,
  onRefresh,
  refreshLabel = "Refresh",
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshLabel?: string;
}) {
  return (
    <div
      role="status"
      className="bg-surface-inset border border-border-subtle rounded-md px-3 py-2 text-xs text-text-muted flex items-center justify-between gap-3"
    >
      <span className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-status-warning mt-1 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </span>
      {onRefresh && (
        <button onClick={onRefresh} className="underline hover:text-text-secondary shrink-0">
          {refreshLabel}
        </button>
      )}
    </div>
  );
}

/**
 * SAVE-FAILURE banner — a failed persist NEVER clears the draft (Day-17
 * §"Save Failed"). This just states it and offers a retry that re-runs the
 * same idempotent write.
 */
export function SaveErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="bg-status-danger/10 border border-status-danger/30 rounded-md px-4 py-2 text-xs text-status-danger flex items-center justify-between gap-3"
    >
      <span>Last change couldn't be saved: {error}. Your input is still here.</span>
      {onRetry && (
        <button onClick={onRetry} className="underline hover:text-status-danger/80 shrink-0">
          Retry
        </button>
      )}
    </div>
  );
}
