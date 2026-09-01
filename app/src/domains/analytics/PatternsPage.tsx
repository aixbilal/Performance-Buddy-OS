import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { LoadingState } from "../../components/StateViews";
import { useAnalytics } from "./store";

const CONFIDENCE_TONE = { high: "success", moderate: "warning", limited: "neutral" } as const;

/**
 * Patterns & Insights (docs 22.14). Deterministic associations between routine
 * completion series. Every pattern shows a confidence tier and is worded as
 * correlation, never causation. Sparse data yields INSUFFICIENT EVIDENCE.
 */
export function PatternsPage() {
  const { patterns, loaded } = useAnalytics();

  // LOADING ≠ EMPTY — don't show "no patterns" before the history has resolved.
  if (!loaded) return <LoadingState label="Loading patterns…" />;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/analytics" className="text-text-muted text-xs hover:text-text-secondary">
          ← Analytics
        </Link>
        <h2 className="t-h2 text-text-primary mt-1">Patterns &amp; Insights</h2>
        <p className="text-text-muted text-sm">
          Associations found in your logged history. An association is not a cause and does not
          predict the future.
        </p>
      </div>

      <div
        role="note"
        className="bg-surface-inset border border-border-subtle rounded-md px-4 py-3 text-xs text-text-secondary"
      >
        These are computed with a fixed deterministic method (Pearson correlation over daily
        completion, minimum 5 overlapping days). Below the minimum, the pattern reads "insufficient
        evidence" rather than showing a precise-looking number.
      </div>

      <Card title={`Patterns (${patterns.length})`}>
        <div className="space-y-2">
          {patterns.map((p) => (
            <div
              key={p.id}
              className="bg-surface-inset border border-border-subtle rounded-md p-3"
              data-testid={`pattern-${p.id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-text-primary text-sm">{p.title}</span>
                <Badge tone={p.insufficient ? "neutral" : CONFIDENCE_TONE[p.confidence]}>
                  {p.insufficient ? "insufficient evidence" : `${p.confidence} confidence`}
                </Badge>
              </div>
              <p className="text-text-secondary text-[11px]">
                {p.insufficient
                  ? "Not enough overlapping logged days to describe this reliably yet."
                  : `Direction: ${p.direction}. Sample: ${p.sampleSize} days. Correlation, not causation.`}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
