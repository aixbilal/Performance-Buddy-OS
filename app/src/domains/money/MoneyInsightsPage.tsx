import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useMoney } from "./store";

const CONFIDENCE_LABEL = {
  none: "no data",
  limited: "limited data",
  moderate: "moderate confidence",
} as const;

export function MoneyInsightsPage() {
  const money = useMoney();
  const { insights, confidence } = money.getInsights();

  return (
    <div className="space-y-6">
      <div>
        <Link to="/money" className="text-text-muted text-xs hover:text-text-secondary">
          ← Money
        </Link>
        <h2 className="t-h2 text-text-primary mt-1">Insights &amp; Review</h2>
        <p className="text-text-muted text-sm">
          Deterministic statements from your recorded data. No advice, no financial-health score, no
          performance judgement.
        </p>
      </div>

      <Card
        title="What the data says"
        action={
          <Badge tone={confidence === "none" ? "warning" : "neutral"}>
            {CONFIDENCE_LABEL[confidence]}
          </Badge>
        }
      >
        {insights.length === 0 ? (
          <div className="text-text-muted text-sm">
            Nothing to review yet — record some transactions first. An empty ledger is not "0 financial
            behaviour".
          </div>
        ) : (
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge tone={ins.kind === "fact" ? "neutral" : "warning"}>
                  {ins.kind === "fact" ? "FACT" : "DERIVATION"}
                </Badge>
                <span className="text-text-secondary">{ins.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="How to read this">
        <ul className="text-text-muted text-[11px] space-y-1">
          <li>
            <b>FACT</b> — a value read directly from your recorded transactions, budgets or goals.
          </li>
          <li>
            <b>DERIVATION</b> — deterministic arithmetic on those facts (ratios, totals). Still not
            advice.
          </li>
          <li>Partial data lowers confidence — that is stated, never hidden.</li>
          <li>Money is kept entirely separate from any academic / productivity score.</li>
        </ul>
      </Card>
    </div>
  );
}
