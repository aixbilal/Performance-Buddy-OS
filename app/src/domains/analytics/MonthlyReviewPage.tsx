import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { LoadingState } from "../../components/StateViews";
import { useAnalytics } from "./store";
import { monthBounds } from "./engine";

const CMP_TONE = {
  improved: "success",
  declined: "warning",
  flat: "neutral",
  insufficient: "neutral",
} as const;

/**
 * Monthly Review (docs 22.05). Calendar-month scope. Comparisons only when a
 * compatible prior window exists — otherwise "insufficient comparison", never a
 * fabricated 0%. Logged reviews are immutable snapshots.
 */
export function MonthlyReviewPage() {
  const analytics = useAnalytics();
  const navigate = useNavigate();
  const b = monthBounds(new Date().toISOString().slice(0, 10));
  const comparisons = analytics.monthlyComparisons();
  const [observations, setObservations] = useState("");

  // LOADING ≠ EMPTY.
  if (!analytics.loaded) return <LoadingState label="Loading this month…" />;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/analytics" className="text-text-muted text-xs hover:text-text-secondary">
          ← Analytics
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">Monthly Review</h2>
        <p className="text-text-muted text-sm">
          Calendar month {b.start} → {b.end}. Longer patterns and system effectiveness. Volume growth
          is not automatically improvement.
        </p>
      </div>

      <Card title="Domain trajectory this month">
        <div className="grid grid-cols-2 gap-3">
          {analytics.domainSnapshots.map((d) => (
            <div key={d.domain} className="bg-surface-inset border border-border-subtle rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-primary text-sm font-medium">{d.domain}</span>
                <Badge tone={d.confidence === "high" ? "success" : d.confidence === "moderate" ? "warning" : "neutral"}>
                  {d.confidence}
                </Badge>
              </div>
              <p className="text-text-secondary text-xs">{d.headline}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="This month vs prior month">
        <ul className="space-y-1.5 text-sm">
          {comparisons.map((c) => (
            <li
              key={c.metric}
              className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0"
            >
              <span className="text-text-primary">{c.metric}</span>
              <span className="flex items-center gap-2 text-xs">
                {c.status === "insufficient" ? (
                  <span className="text-text-muted">
                    insufficient comparison — no complete prior month yet
                  </span>
                ) : (
                  <span className="text-text-secondary">
                    {c.prior}
                    {c.unit} → {c.current}
                    {c.unit} ({c.delta! >= 0 ? "+" : ""}
                    {c.delta}
                    {c.unit})
                  </span>
                )}
                <Badge tone={CMP_TONE[c.status]}>{c.status}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Observations (kept separate from the data)">
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={4}
          aria-label="Monthly observations"
          placeholder="One observation per line…"
          className="w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        />
        <button
          onClick={async () => {
            await analytics.logMonthlyReview(
              observations.split("\n").map((x) => x.trim()).filter(Boolean),
            );
            navigate("/analytics");
          }}
          className="mt-3 px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
        >
          Log this month's review
        </button>
      </Card>

      <Card title={`Past monthly reviews (${analytics.monthlyReviews.length})`}>
        {analytics.monthlyReviews.length === 0 ? (
          <p className="text-text-muted text-xs">None logged yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {analytics.monthlyReviews.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0 text-sm"
              >
                <span className="text-text-primary">
                  {r.monthStart} → {r.monthEnd}
                </span>
                <span className="text-text-muted text-xs">
                  {r.comparisons.length} comparison(s) · {r.observations.length} observation(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
