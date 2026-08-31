import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useAnalytics } from "./store";
import { useAICoach } from "../intelligence/store";

/**
 * Weekly Review (docs 22.04). Deterministic FACTS first, then optional AI
 * interpretation — the two are never blended. Logging freezes a snapshot.
 */
export function WeeklyReviewPage() {
  const analytics = useAnalytics();
  const coach = useAICoach();
  const navigate = useNavigate();
  const snap = analytics.weeklySnapshot();
  const [wins, setWins] = useState("");
  const [friction, setFriction] = useState("");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lines = (s: string) =>
    s.split("\n").map((x) => x.trim()).filter(Boolean);

  const askCoach = async () => {
    setBusy(true);
    try {
      const res = await coach.generate("weekly-review", ["Knowledge", "Planning", "Routines", "Academics"]);
      setAiNote(
        res.ok
          ? `${res.message}${res.created.length ? ` (${res.created.length} recommendation${res.created.length > 1 ? "s" : ""} added — decide on the AI Coach page)` : ""}`
          : `AI interpretation unavailable (${res.failure}). The facts above are unaffected.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/analytics" className="text-text-muted text-xs hover:text-text-secondary">
          ← Analytics
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">Weekly Review</h2>
        <p className="text-text-muted text-sm">
          {snap.weekStart} → {snap.weekEnd}. Facts first; your notes and any AI interpretation stay
          separate.
        </p>
      </div>

      <Card title="What happened (deterministic facts)">
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center justify-between border-b border-border-subtle pb-1.5">
            <span className="text-text-primary">Routine completion</span>
            <span className="text-text-secondary text-xs">
              {snap.routineCompletion.rate === null
                ? "no logged days this week"
                : `${snap.routineCompletion.rate}% (${snap.routineCompletion.completed}/${snap.routineCompletion.total})`}
            </span>
          </li>
          {snap.domainSnapshots.map((d) => (
            <li
              key={d.domain}
              className="flex items-center justify-between border-b border-border-subtle last:border-0 pb-1.5"
            >
              <span className="text-text-primary">{d.domain}</span>
              <span className="text-text-secondary text-xs">{d.headline}</span>
            </li>
          ))}
        </ul>
        <p className="text-text-secondary text-[11px] mt-2">
          Data sufficiency this week: <span className="capitalize">{snap.dataSufficiency}</span>. One
          difficult week is not a trend.
        </p>
      </Card>

      <Card title="Your notes (separate from the facts)">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-text-secondary">
            What worked (one per line)
            <textarea
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              rows={4}
              aria-label="What worked"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-xs text-text-secondary">
            Friction (one per line)
            <textarea
              value={friction}
              onChange={(e) => setFriction(e.target.value)}
              rows={4}
              aria-label="Friction"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
        </div>
        <button
          onClick={async () => {
            await analytics.logWeeklyReview(lines(wins), lines(friction));
            navigate("/analytics");
          }}
          className="mt-3 px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
        >
          Log this week's review
        </button>
      </Card>

      <Card title="Optional: ask the coach to interpret">
        <div className="flex items-center gap-2">
          <button
            onClick={askCoach}
            disabled={busy || coach.aiAvailability !== "ready"}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium disabled:opacity-40"
          >
            Ask AI Coach
          </button>
          <Badge tone={coach.aiAvailability === "ready" ? "success" : "warning"}>
            {coach.aiAvailability === "not-configured" ? "not configured" : coach.aiAvailability}
          </Badge>
        </div>
        {aiNote && (
          <p className="text-text-secondary text-xs mt-2" role="status">
            <span className="text-text-muted">AI interpretation:</span> {aiNote}
          </p>
        )}
      </Card>

      <Card title={`Past reviews (${analytics.weeklyReviews.length})`}>
        {analytics.weeklyReviews.length === 0 ? (
          <p className="text-text-muted text-xs">None logged yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {analytics.weeklyReviews.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0 text-sm"
              >
                <span className="text-text-primary">
                  {r.weekStart} → {r.weekEnd}
                </span>
                <span className="text-text-muted text-xs">
                  {r.wins.length} wins · {r.friction.length} friction
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
