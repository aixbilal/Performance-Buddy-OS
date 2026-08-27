import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";

/**
 * Structural type for an AI proposal. This is a presentation-layer contract only —
 * it says nothing about how a recommendation is generated. Per ADR-0001, this
 * component only ever renders a Proposal object and reports the user's decision;
 * it never calls an AI provider directly and never writes to domain state itself.
 */
export type Proposal = {
  id: string;
  recommendation: string;
  reason: string;
  evidence: string[];
  confidence: "low" | "medium" | "high";
};

export function ProposalCard({
  proposal,
  onApprove,
  onModify,
  onReject,
}: {
  proposal: Proposal;
  onApprove: (id: string) => void;
  onModify: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const confidenceTone =
    proposal.confidence === "high" ? "success" : proposal.confidence === "medium" ? "warning" : "neutral";

  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <p className="text-text-primary text-sm">{proposal.recommendation}</p>
        <Badge tone={confidenceTone}>{proposal.confidence} confidence</Badge>
      </div>
      <p className="text-text-secondary text-xs mb-2">{proposal.reason}</p>
      {proposal.evidence.length > 0 && (
        <ul className="text-text-muted text-xs mb-3 list-disc list-inside space-y-0.5">
          {proposal.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(proposal.id)}
          className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
        >
          Approve
        </button>
        <button
          onClick={() => onModify(proposal.id)}
          className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
        >
          Modify
        </button>
        <button
          onClick={() => onReject(proposal.id)}
          className="px-3 py-1.5 rounded-md text-text-muted text-xs font-medium hover:text-text-secondary"
        >
          Not now
        </button>
      </div>
    </Card>
  );
}
