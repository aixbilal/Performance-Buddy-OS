/**
 * ContextualInsight — a calm, compact "why this / what next" strip (V2).
 *
 * NOT a card and NOT an AI hero. It shows a short deterministic explanation
 * inline, an optional "Why this?" disclosure for the full reason list, and at
 * most one or two subordinate actions (e.g. "Explore alternatives", "Generate
 * Recall"). Intelligence stays subordinate to execution and state — this sits
 * *beneath* the primary content of a screen, never above it.
 *
 * It renders nothing when there is no headline (so a screen with no material
 * signal shows no AI surface at all).
 */
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Button } from "./Button";

export type ContextualInsightAction = {
  label: string;
  onClick: () => void;
  /** Falls back to a quiet ghost button. */
  variant?: "secondary" | "ghost";
  disabled?: boolean;
  title?: string;
};

export function ContextualInsight({
  headline,
  reasons = [],
  actions = [],
  note,
  children,
}: {
  /** One short sentence. Empty / undefined ⇒ the component renders nothing. */
  headline?: string | null;
  /** The full reason list, shown under a "Why this?" toggle. */
  reasons?: string[];
  actions?: ContextualInsightAction[];
  /** A muted addendum, e.g. an honest "AI unavailable" line. */
  note?: string | null;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!headline) return null;

  return (
    <div className="mt-3 rounded-md border border-border-divider bg-surface-inset/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-text-secondary">{headline}</p>
        {reasons.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="t-caption text-text-muted underline hover:text-text-secondary"
          >
            {open ? "Hide why" : "Why this?"}
          </button>
        )}
      </div>

      {open && reasons.length > 0 && (
        <ul id={panelId} className="mt-1.5 t-caption text-text-muted list-disc pl-4 space-y-0.5">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {children}

      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {actions.map((a, i) => (
            <Button
              key={i}
              size="sm"
              variant={a.variant ?? "ghost"}
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.title}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {note && <p className="mt-1.5 t-caption text-text-muted">{note}</p>}
    </div>
  );
}
