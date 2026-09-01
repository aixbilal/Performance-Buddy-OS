/**
 * Planning Diff review surface (V2 Phase J).
 *
 * Shows a reviewed `PlanningDiff` as: What changes · Why · What is protected ·
 * What could not fit · Apply. Apply lands the whole diff as one unit (the store
 * rolls back on any failure) and persists it + its inverse for a practical Undo.
 * `could-not-fit` is explanation, never an applied change.
 */
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import type { PlanningDiff } from "./adaptiveEngine";
import type { PlanningDiffChange } from "../adaptive/types";

const KIND_LABEL: Record<string, string> = {
  keep: "Keep",
  add: "Add",
  move: "Move",
  shorten: "Shorten",
  defer: "Defer occurrence",
  "drop-occurrence": "Skip occurrence",
  "mark-occurrence-done": "Mark occurrence done",
  "mark-occurrence-skipped": "Skip occurrence",
  "remove-block": "Remove",
  "clear-occurrence": "Clear occurrence",
};

function describe(c: PlanningDiffChange): string {
  switch (c.kind) {
    case "keep":
      return `Block ${c.blockId} stays exactly as it is.`;
    case "add": {
      const b = c.block as Record<string, unknown>;
      return `“${String(b.title ?? "Study block")}” on ${String(b.date ?? "?")} ${mins(b.startMinute)}–${mins(b.endMinute)}.`;
    }
    case "move":
      return `Block ${c.blockId} moves to start at ${mins(c.toStartMinute)}.`;
    case "shorten":
      return `Block ${c.blockId} ends earlier, at ${mins(c.toEndMinute)}.`;
    case "defer":
      return `${c.occurrenceDate} of ${c.blockId} moves to ${c.toDate}; the weekly block stays.`;
    case "drop-occurrence":
    case "mark-occurrence-skipped":
      return `${c.occurrenceDate} of ${c.blockId} is skipped; the weekly block stays.`;
    case "mark-occurrence-done":
      return `${c.occurrenceDate} of ${c.blockId} is marked done.`;
    case "remove-block":
      return `Block ${c.blockId} is removed.`;
    case "clear-occurrence":
      return `The ${c.occurrenceDate} exception on ${c.blockId} is cleared.`;
  }
}

function mins(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "?";
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

export function PlanningDiffReview({
  diff,
  busy = false,
  onApply,
  onDiscard,
}: {
  diff: PlanningDiff;
  busy?: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const protectedChanges = diff.changes.filter((c) => c.kind === "keep");
  const realChanges = diff.changes.filter((c) => c.kind !== "keep");

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-inset p-4 space-y-4">
      <div>
        <h3 className="t-title text-text-primary">Proposed plan changes</h3>
        <p className="t-caption text-text-muted">
          Nothing is written until you Apply. Locked, fixed and manual blocks are never moved by this.
        </p>
      </div>

      <section>
        <p className="t-caption text-text-muted uppercase tracking-wide mb-1">
          What changes ({realChanges.length})
        </p>
        {realChanges.length === 0 ? (
          <p className="text-sm text-text-secondary">No changes — the current plan already holds.</p>
        ) : (
          <ul className="space-y-1">
            {realChanges.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge tone="info">{KIND_LABEL[c.kind] ?? c.kind}</Badge>
                <span className="text-text-secondary">{describe(c)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {diff.reasonCodes.length > 0 && (
        <section>
          <p className="t-caption text-text-muted uppercase tracking-wide mb-1">Why</p>
          <div className="flex flex-wrap gap-1.5">
            {diff.reasonCodes.map((r) => (
              <Badge key={r} tone="neutral">
                {r.replace(/_/g, " ").toLowerCase()}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {protectedChanges.length > 0 && (
        <section>
          <p className="t-caption text-text-muted uppercase tracking-wide mb-1">
            Protected ({protectedChanges.length})
          </p>
          <p className="t-caption text-text-muted">
            {protectedChanges.length} block(s) explicitly left untouched.
          </p>
        </section>
      )}

      {diff.couldNotFit.length > 0 && (
        <section>
          <p className="t-caption text-status-warning uppercase tracking-wide mb-1">
            Could not fit ({diff.couldNotFit.length})
          </p>
          <ul className="space-y-1">
            {diff.couldNotFit.map((c, i) => (
              <li key={i} className="text-sm text-text-secondary">
                <span className="text-text-primary">{c.title}</span> — {c.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={onApply} disabled={busy || realChanges.length === 0}>
          {busy ? "Applying…" : "Apply changes"}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={busy}>
          Discard
        </Button>
      </div>
    </div>
  );
}
