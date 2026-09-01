import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";

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
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="t-body text-text-primary">{proposal.recommendation}</p>
        <Badge tone={confidenceTone}>{proposal.confidence} confidence</Badge>
      </div>
      <p className="t-small text-text-secondary mb-2">{proposal.reason}</p>
      {proposal.evidence.length > 0 && (
        <ul className="t-small text-text-muted mb-3 list-disc list-inside space-y-0.5">
          {proposal.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => onApprove(proposal.id)}>
          Approve
        </Button>
        <Button variant="secondary" onClick={() => onModify(proposal.id)}>
          Modify
        </Button>
        <Button variant="ghost" onClick={() => onReject(proposal.id)}>
          Not now
        </Button>
      </div>
    </Card>
  );
}
