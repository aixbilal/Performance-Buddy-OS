import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useAnalytics } from "./store";

const STATE_TONE = {
  improving: "success",
  "on-track": "success",
  stable: "neutral",
  "needs-attention": "warning",
  drifting: "warning",
} as const;
const CONFIDENCE_TONE = { high: "success", moderate: "warning", limited: "neutral" } as const;

export function AnalyticsOverviewPage() {
  const { domainSnapshots, patterns, weeklyReviews, monthlyReviews, weeklySnapshot } = useAnalytics();
  const snap = weeklySnapshot();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Analytics &amp; Reviews</h2>
          <p className="text-text-muted text-sm">
            How are your systems behaving, what changed, and where should you look?
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/analytics/weekly"
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Weekly Review
          </Link>
          <Link
            to="/analytics/monthly"
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Monthly Review
          </Link>
          <Link
            to="/analytics/patterns"
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Patterns
          </Link>
        </div>
      </div>

      <div
        role="note"
        className="bg-surface-inset border border-border-subtle rounded-md px-4 py-3 text-xs text-text-secondary"
      >
        No single combined "performance score" is shown here on purpose — each domain keeps its own
        unit (CGPA, %, Rs). Activity ≠ outcome ≠ mastery. Missing data lowers confidence; it is never
        counted as zero.
      </div>

      <Card title="Domain snapshot">
        <div className="grid grid-cols-2 gap-3">
          {domainSnapshots.map((d) => (
            <div key={d.domain} className="bg-surface-inset border border-border-subtle rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-primary text-sm font-medium">{d.domain}</span>
                <div className="flex items-center gap-1.5">
                  <Badge tone={STATE_TONE[d.state]}>{d.state.replace("-", " ")}</Badge>
                  <Badge tone={CONFIDENCE_TONE[d.confidence]}>{d.confidence}</Badge>
                </div>
              </div>
              <p className="text-text-secondary text-xs">{d.headline}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="This week so far">
        <div className="text-sm text-text-primary">
          {snap.weekStart} → {snap.weekEnd}
        </div>
        <p className="text-text-secondary text-xs mt-1">
          Routine completion:{" "}
          {snap.routineCompletion.rate === null
            ? "no logged days yet"
            : `${snap.routineCompletion.rate}% (${snap.routineCompletion.completed}/${snap.routineCompletion.total})`}{" "}
          · data sufficiency: <span className="capitalize">{snap.dataSufficiency}</span>
        </p>
      </Card>

      <Card title="Patterns & insights">
        <div className="space-y-2">
          {patterns.map((p) => (
            <div key={p.id} className="bg-surface-inset border border-border-subtle rounded-md p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-text-primary text-sm">{p.title}</span>
                <Badge tone={p.insufficient ? "neutral" : CONFIDENCE_TONE[p.confidence]}>
                  {p.insufficient ? "insufficient evidence" : p.confidence}
                </Badge>
              </div>
              {!p.insufficient && (
                <p className="text-text-secondary text-[11px]">
                  Based on {p.sampleSize} overlapping days. Correlation, not causation — an
                  association only.
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Reviews">
        <p className="text-text-secondary text-xs">
          {weeklyReviews.length} weekly · {monthlyReviews.length} monthly logged. Once logged, a
          review is a frozen snapshot — later data changes never rewrite it.
        </p>
      </Card>
    </div>
  );
}
