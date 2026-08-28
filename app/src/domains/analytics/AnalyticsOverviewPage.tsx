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
  const { domainSnapshots, sleepFocusPattern, weeklyReviews, logWeeklyReview } = useAnalytics();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Analytics &amp; Reviews</h2>
        <p className="text-text-muted text-sm">
          How are your systems behaving, what changed, and where should you look?
        </p>
      </div>

      <div className="bg-surface-inset border border-border-subtle rounded-md px-4 py-3 text-xs text-text-muted">
        No single combined "performance score" is shown here on purpose — each domain below keeps its own
        unit (CGPA, %, Rs) rather than being mathematically merged into one fake percentage.
      </div>

      <Card title="Domain Snapshot">
        <div className="grid grid-cols-2 gap-3">
          {domainSnapshots.map((d) => (
            <div key={d.domain} className="bg-surface-inset border border-border-subtle rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-primary text-sm font-medium">{d.domain}</span>
                <div className="flex items-center gap-1.5">
                  <Badge tone={STATE_TONE[d.state]}>{d.state.replace("-", " ")}</Badge>
                  <Badge tone={CONFIDENCE_TONE[d.confidence]}>{d.confidence} confidence</Badge>
                </div>
              </div>
              <p className="text-text-secondary text-xs">{d.headline}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Patterns & Insights">
        <div className="bg-surface-inset border border-border-subtle rounded-md p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-text-primary text-sm">{sleepFocusPattern.title}</span>
            <Badge tone={CONFIDENCE_TONE[sleepFocusPattern.confidence]}>{sleepFocusPattern.confidence}</Badge>
          </div>
          <p className="text-text-disabled text-[11px]">
            Based on {sleepFocusPattern.sampleSize} days of evidence. Correlation, not causation — this
            describes an association only.
          </p>
        </div>
      </Card>

      <Card title="Weekly Review">
        <button
          onClick={() => logWeeklyReview(["Completed the planned Academic sessions"], ["Missed one hydration day"])}
          className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium mb-3"
        >
          Log This Week's Review
        </button>
        {weeklyReviews.length === 0 ? (
          <p className="text-text-muted text-xs">No reviews logged yet.</p>
        ) : (
          <div className="space-y-2">
            {weeklyReviews.map((r) => (
              <div key={r.id} className="border-b border-border-subtle last:border-0 py-2">
                <div className="text-text-primary text-sm">
                  {r.weekStart} → {r.weekEnd}
                </div>
                <div className="text-text-muted text-xs">
                  {r.domainSnapshots.length} domains snapshotted · {r.wins.length} wins · {r.friction.length} friction points
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-text-disabled text-[10px] mt-2">
          Once logged, a review is frozen — later changes to your data will never rewrite it.
        </p>
      </Card>
    </div>
  );
}
