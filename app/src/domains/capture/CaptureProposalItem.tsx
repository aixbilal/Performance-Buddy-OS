/**
 * One reviewable Natural Capture proposal (V2 Phase D).
 *
 * Shared by the Natural Capture drawer and the Capture Inbox. Renders the
 * origin label ("You said" = fact / "PBOS interpreted" = interpretation), a
 * qualitative confidence chip (never a percentage), the literal source text,
 * PBOS's rationale, any ambiguity note, and the evidence lines — then the
 * Accept & apply / Reject controls. An `ambiguous` proposal cannot be applied
 * until the user resolves it.
 */
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import type { CaptureProposalRecord } from "../adaptive/types";

export function ConfidenceChip({ confidence }: { confidence: CaptureProposalRecord["confidence"] }) {
  const tone = confidence === "clear" ? "success" : confidence === "ambiguous" ? "warning" : "neutral";
  const label =
    confidence === "clear" ? "Clear" : confidence === "ambiguous" ? "Needs a choice" : "Needs review";
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function CaptureProposalItem({
  proposal: p,
  busy = false,
  onAccept,
  onReject,
  compact = false,
}: {
  proposal: CaptureProposalRecord;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
  compact?: boolean;
}) {
  const evidence = safeJson<string[]>(p.evidenceJson, []);
  const validation = safeJson<{ ok: boolean; message: string } | null>(p.validationJson, null);
  const settled = p.status === "applied" || p.status === "rejected" || p.status === "apply-failed";

  return (
    <div className="bg-surface-inset border border-border-subtle rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone={p.proposalClass === "fact" ? "info" : "neutral"}>
          {p.proposalClass === "fact" ? "You said" : "PBOS interpreted"}
        </Badge>
        <ConfidenceChip confidence={p.confidence} />
        {p.status === "rejected" && <Badge tone="neutral">Rejected</Badge>}
        {p.status === "applied" && <Badge tone="success">Applied</Badge>}
      </div>

      <p className="text-sm text-text-primary">{p.title}</p>
      <p className="t-caption text-text-muted">“{p.sourceText}”</p>

      {!compact && <p className="t-caption text-text-secondary">{p.rationale}</p>}
      {p.ambiguityReason && <p className="t-caption text-status-warning">{p.ambiguityReason}</p>}
      {!compact && evidence.length > 0 && (
        <ul className="t-caption text-text-muted list-disc pl-4 space-y-0.5">
          {evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {p.status === "apply-failed" && validation && (
        <p className="t-caption text-status-danger">Could not apply: {validation.message}</p>
      )}

      {!settled && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            onClick={onAccept}
            disabled={busy || p.confidence === "ambiguous"}
            title={
              p.confidence === "ambiguous"
                ? "Resolve the ambiguity before this can be applied"
                : undefined
            }
          >
            Accept &amp; apply
          </Button>
          <Button variant="ghost" onClick={onReject} disabled={busy}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
