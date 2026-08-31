import { useState } from "react";
import { Badge } from "./Badge";
import { getAdapter } from "../domains/intelligence/applyAdapters";
import type { ApplyContext } from "../domains/intelligence/applyAdapters";
import type { Recommendation } from "../domains/intelligence/types";

/**
 * Shared recommendation surface (docs §38). Renders the proposal, its reason,
 * the before → after preview, deterministic validation status, and unambiguous
 * Accept / Modify / Reject / Apply controls. Nothing here mutates a store — it
 * calls the handlers the AI Coach store passes in, which run the allowlisted
 * Apply pipeline.
 */

const CONF_TONE = { high: "success", moderate: "warning", limited: "neutral" } as const;
const STATUS_TONE = {
  proposed: "neutral",
  accepted: "success",
  modified: "warning",
  rejected: "danger",
  applied: "success",
  "apply-failed": "danger",
} as const;

export function RecommendationCard({
  rec,
  applyCtx,
  onDecide,
  onApply,
  busy = false,
}: {
  rec: Recommendation;
  applyCtx: ApplyContext;
  onDecide: (
    id: string,
    decision: "accepted" | "modified" | "rejected",
    modifiedParams?: Record<string, unknown>,
  ) => void | Promise<void>;
  onApply: (id: string) => void | Promise<void>;
  busy?: boolean;
}) {
  const adapter = getAdapter(rec.kind);
  const preview = adapter ? adapter.preview(rec.proposedParams, applyCtx) : null;
  const liveValidation = adapter ? adapter.validate(rec.proposedParams, applyCtx) : null;

  const numericParams = Object.entries(rec.proposedParams).filter(
    ([, v]) => typeof v === "number",
  ) as [string, number][];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(numericParams.map(([k, v]) => [k, String(v)])),
  );

  const canApply = rec.status === "accepted" || rec.status === "modified";
  const decided = rec.status !== "proposed";

  return (
    <div className="bg-surface-inset border border-border-subtle rounded-md p-3" data-testid={`rec-${rec.id}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-text-primary text-sm font-medium">{rec.title}</div>
          <div className="text-text-secondary text-xs">
            {rec.domain} · {adapter?.label ?? rec.kind} · from {rec.generatedFrom}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge tone={CONF_TONE[rec.confidence]}>{rec.confidence}</Badge>
          <Badge tone={STATUS_TONE[rec.status]}>{rec.status.replace("-", " ")}</Badge>
        </div>
      </div>

      {rec.rationale && <p className="text-text-secondary text-xs mb-1.5">{rec.rationale}</p>}
      {rec.evidence.length > 0 && (
        <ul className="text-text-secondary text-xs mb-2 list-disc list-inside space-y-0.5">
          {rec.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="text-text-secondary text-xs bg-surface-raised border border-border-subtle rounded px-2 py-1.5 mb-2">
          <span className="text-text-muted">Proposed change:</span> {preview.before}{" "}
          <span aria-hidden>→</span> <span className="text-text-primary">{preview.after}</span>
        </div>
      )}

      {/* deterministic validation status */}
      {(() => {
        const v = rec.validation ?? liveValidation;
        if (!v) return null;
        return v.ok ? (
          <p className="text-status-success text-[11px] mb-2" role="status">
            ✓ Validation: {v.message}
          </p>
        ) : (
          <p className="text-status-danger text-[11px] mb-2" role="alert">
            ✗ Validation: {v.message}
            {v.reasonCodes.length > 0 && ` [${v.reasonCodes.join(", ")}]`}
          </p>
        );
      })()}

      {rec.status === "applied" && rec.appliedResult && (
        <p className="text-status-success text-[11px] mb-2" role="status">
          Applied — {JSON.stringify(rec.appliedResult)}
        </p>
      )}

      {editing && numericParams.length > 0 && (
        <div className="border border-border-subtle rounded p-2 mb-2 space-y-1.5">
          {numericParams.map(([k]) => (
            <label key={k} className="flex items-center justify-between gap-2 text-xs text-text-secondary">
              {k}
              <input
                type="number"
                value={draft[k] ?? ""}
                aria-label={`Modify ${k}`}
                onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))}
                className="w-24 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </label>
          ))}
          <button
            onClick={() => {
              const modified: Record<string, unknown> = {};
              for (const [k] of numericParams) {
                const n = Number(draft[k]);
                if (Number.isFinite(n)) modified[k] = n;
              }
              onDecide(rec.id, "modified", modified);
              setEditing(false);
            }}
            className="px-2.5 py-1 rounded bg-action-primary text-text-inverse text-[11px] font-medium"
          >
            Save modified proposal
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!decided && (
          <>
            <button
              onClick={() => onDecide(rec.id, "accepted")}
              disabled={busy}
              className="px-3 py-1 rounded-md bg-action-primary text-text-inverse text-xs disabled:opacity-40"
            >
              Accept
            </button>
            {numericParams.length > 0 && (
              <button
                onClick={() => setEditing((v) => !v)}
                className="px-3 py-1 rounded-md bg-action-secondary text-text-primary text-xs"
              >
                {editing ? "Cancel edit" : "Modify"}
              </button>
            )}
            <button
              onClick={() => onDecide(rec.id, "rejected")}
              disabled={busy}
              className="px-3 py-1 rounded-md text-text-secondary text-xs hover:text-status-danger disabled:opacity-40"
            >
              Reject
            </button>
          </>
        )}
        {canApply && (
          <button
            onClick={() => onApply(rec.id)}
            disabled={busy}
            className="px-3 py-1 rounded-md bg-action-primary text-text-inverse text-xs font-medium disabled:opacity-40"
          >
            Apply
          </button>
        )}
        {rec.status === "apply-failed" && numericParams.length > 0 && (
          <button
            onClick={() => setEditing((v) => !v)}
            className="px-3 py-1 rounded-md bg-action-secondary text-text-primary text-xs"
          >
            {editing ? "Cancel edit" : "Modify & retry"}
          </button>
        )}
        {rec.status === "apply-failed" && (
          <button
            onClick={() => onApply(rec.id)}
            disabled={busy}
            className="px-3 py-1 rounded-md bg-action-secondary text-text-primary text-xs disabled:opacity-40"
          >
            Retry apply
          </button>
        )}
      </div>
    </div>
  );
}
