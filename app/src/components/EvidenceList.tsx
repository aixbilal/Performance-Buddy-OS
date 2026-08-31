import type { ReactNode } from "react";
import { Badge } from "./Badge";

/**
 * Shared Evidence presentation (Batch 5, audit P1-17).
 *
 * Presentational ONLY — it owns no state and derives no score. Each caller maps
 * its own canonical records (Knowledge `Evidence`, Development `SkillEvidence`,
 * a Mastery Check result, …) into `EvidenceView[]`. There is deliberately no
 * "universal evidence score": every domain keeps its own derivation.
 */
export type EvidenceTone = "success" | "warning" | "neutral" | "danger";

export type EvidenceView = {
  id: string;
  /** What the evidence was. */
  title: string;
  /** e.g. "recall", "quiz", "practice", "self-check". */
  kind: string;
  /** ISO date or free text; omitted when unknown (never shown as a fake 0). */
  date?: string | null;
  /** e.g. "8 / 10", "90%", "strong" — a human-readable result, not a number to sum. */
  result?: string | null;
  /** Origin / trust context, e.g. "Independent", "AI-assisted (unreviewed)". */
  provenance?: string | null;
  provenanceTone?: EvidenceTone;
  /** Where it came from: a course, a project, "personal self-check". */
  context?: string | null;
  onDelete?: () => void;
  /** Optional caller-supplied control (e.g. a cross-domain "hand off" button). */
  action?: ReactNode;
};

export function EvidenceList({
  items,
  emptyLabel = "No evidence recorded yet — nothing is inferred until there is.",
}: {
  items: EvidenceView[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <div className="text-text-muted text-xs">{emptyLabel}</div>;
  }
  return (
    <ul className="space-y-2">
      {items.map((e) => (
        <li
          key={e.id}
          className="flex items-center justify-between gap-3 py-1.5 border-b border-border-subtle last:border-0"
        >
          <div className="min-w-0">
            <div className="text-text-primary text-sm truncate">{e.title}</div>
            <div className="text-text-muted text-xs capitalize">
              {e.kind}
              {e.date ? ` · ${e.date}` : ""}
              {e.context ? ` · ${e.context}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {e.result && <span className="text-text-secondary text-xs">{e.result}</span>}
            {e.provenance && (
              <Badge tone={e.provenanceTone ?? "neutral"}>{e.provenance}</Badge>
            )}
            {e.action}
            {e.onDelete && (
              <button
                onClick={e.onDelete}
                aria-label={`Delete evidence: ${e.title}`}
                className="text-text-muted text-[11px] hover:text-status-danger underline"
              >
                Delete
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
