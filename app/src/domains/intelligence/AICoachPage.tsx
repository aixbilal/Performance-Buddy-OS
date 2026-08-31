import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { RecommendationCard } from "../../components/RecommendationCard";
import { useAICoach } from "./store";
import { useAnalytics } from "../analytics/store";

const AVAIL_TONE = {
  ready: "success",
  disabled: "neutral",
  "not-configured": "warning",
  unavailable: "danger",
} as const;

const AVAIL_COPY: Record<string, string> = {
  ready: "A provider is configured and reachable.",
  disabled: "AI is switched off. Analytics, Reviews and deterministic insights all still work.",
  "not-configured": "No AI provider is configured yet. PBOS works fully without it — set one up in the workspace.",
  unavailable: "The last request to the provider failed. Deterministic features are unaffected.",
};

function minutesLabel(mins: number) {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${mins < 0 ? "-" : ""}${h}h${m > 0 ? ` ${m}m` : ""}`;
}

export function AICoachPage() {
  const coach = useAICoach();
  const analytics = useAnalytics();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">AI Coach</h2>
          <p className="text-text-muted text-sm">
            AI proposes. You decide. PBOS validates deterministically. Only then do systems change.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/ai-coach/workspace"
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Open Workspace
          </Link>
          <Link
            to="/ai-coach/permissions"
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Permissions
          </Link>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-text-secondary text-xs mb-1">AI Availability</div>
            <Badge tone={AVAIL_TONE[coach.aiAvailability]}>
              {coach.aiAvailability === "not-configured" ? "Not configured" : coach.aiAvailability}
            </Badge>
            <p className="text-text-secondary text-[11px] mt-1 max-w-lg">
              {AVAIL_COPY[coach.aiAvailability]}
              {coach.providerFailure && coach.aiAvailability === "unavailable" && (
                <> Reason: {coach.providerFailure}.</>
              )}
            </p>
          </div>
          <button
            onClick={() => coach.setEnabled(!coach.config.enabled)}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            {coach.config.enabled ? "Disable AI" : "Enable AI"}
          </button>
        </div>
      </Card>

      <Card title="Deterministic insights (no AI needed)">
        <ul className="space-y-1.5">
          {analytics.domainSnapshots.map((s) => (
            <li
              key={s.domain}
              className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0 text-sm"
            >
              <span className="text-text-primary">{s.domain}</span>
              <span className="text-text-secondary text-xs">{s.headline}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-3 mt-2 text-xs">
          <Link to="/analytics" className="text-text-secondary underline hover:text-text-primary">
            Analytics
          </Link>
          <Link to="/analytics/weekly" className="text-text-secondary underline hover:text-text-primary">
            Weekly Review
          </Link>
          <Link to="/analytics/patterns" className="text-text-secondary underline hover:text-text-primary">
            Patterns
          </Link>
        </div>
      </Card>

      {coach.filteredOutCount > 0 && (
        <div
          role="note"
          className="bg-surface-inset border border-border-subtle rounded-md px-4 py-3 text-xs text-text-secondary"
        >
          {coach.filteredOutCount} recommendation(s) exist for domains you haven't set to Read +
          Recommend — hidden until you enable that domain. This is correct, not a bug.
        </div>
      )}

      <Card title={`Recommendations (${coach.visibleRecommendations.length} awaiting your decision)`}>
        {coach.visibleRecommendations.length === 0 ? (
          <p className="text-text-muted text-xs">
            Nothing awaiting a decision. Generate proposals from the Workspace or a Review.
          </p>
        ) : (
          <div className="space-y-3">
            {coach.visibleRecommendations.map((r) => (
              <RecommendationCard
                key={r.id}
                rec={r}
                applyCtx={coach.applyCtx}
                busy={busy}
                onDecide={(id, d, p) => run(() => coach.decide(id, d, p))}
                onApply={(id) => run(() => coach.apply(id))}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="Combined capacity impact">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Metric label="Current load" value={minutesLabel(coach.combinedImpact.currentLoadMinutes)} />
          <Metric
            label="With accepted changes"
            value={minutesLabel(coach.combinedImpact.withAcceptedChangesMinutes)}
          />
          <Metric label="Weekly capacity" value={minutesLabel(coach.combinedImpact.weeklyCapacityMinutes)} />
        </div>
        {coach.combinedImpact.exceedsCapacity && (
          <div
            role="alert"
            className="bg-status-warning/10 border border-status-warning/30 rounded-md px-3 py-2 mt-3 text-xs text-status-warning"
          >
            Accepting everything currently accepted would exceed your weekly capacity — validated as a
            combined set, not one at a time.
          </div>
        )}
      </Card>

      <Card title={`Decision history (${coach.decisionHistory.length})`}>
        {coach.decisionHistory.length === 0 ? (
          <p className="text-text-muted text-xs">No decisions yet. Rejected proposals stay here too.</p>
        ) : (
          <div className="space-y-2">
            {coach.decisionHistory.map((r) => (
              <div
                key={r.id}
                className="py-1.5 border-b border-border-subtle last:border-0"
                data-testid={`history-${r.id}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">{r.title}</span>
                  <Badge
                    tone={
                      r.status === "applied"
                        ? "success"
                        : r.status === "rejected" || r.status === "apply-failed"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {r.status.replace("-", " ")}
                  </Badge>
                </div>
                <div className="text-text-muted text-[11px]">
                  {coach.eventsFor(r.id).map((e) => e.event).join(" → ")}
                  {r.status === "apply-failed" && r.validation && ` — ${r.validation.message}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-secondary text-xs">{label}</div>
      <div className="text-text-primary">{value}</div>
    </div>
  );
}
