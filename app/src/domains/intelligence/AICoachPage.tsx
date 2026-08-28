import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useAICoach } from "./store";
import type { PermissionLevel } from "./types";

const IMPACT_TONE = { high: "danger", medium: "warning", low: "neutral" } as const;
const CONFIDENCE_TONE = { high: "success", moderate: "warning", limited: "neutral" } as const;
const STATUS_TONE = { accepted: "success", modified: "warning", rejected: "danger", pending: "neutral" } as const;

function minutesLabel(mins: number) {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${mins < 0 ? "-" : ""}${h}h${m > 0 ? ` ${m}m` : ""}`;
}

export function AICoachPage() {
  const { permissions, setPermission, visibleRecommendations, filteredOutCount, decideRecommendation, combinedImpact, decisionHistory } =
    useAICoach();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">AI Coach</h2>
        <p className="text-text-muted text-sm">AI proposes. You decide. PBOS validates. Systems change.</p>
      </div>

      <Card title="Domain Access">
        <p className="text-text-disabled text-[11px] mb-3">
          Money defaults to No Access — sensitive by default, matching the locked product rule. AI can only
          use data from domains you enable, and can only recommend where Read + Recommend is set.
        </p>
        <div className="space-y-1">
          {Object.entries(permissions).map(([domain, level]) => (
            <div key={domain} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
              <span className="text-text-primary text-sm">{domain}</span>
              <select
                value={level}
                onChange={(e) => setPermission(domain, e.target.value as PermissionLevel)}
                className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1 text-text-secondary text-xs"
              >
                <option value="no-access">No Access</option>
                <option value="read">Read</option>
                <option value="read-recommend">Read + Recommend</option>
              </select>
            </div>
          ))}
        </div>
      </Card>

      {filteredOutCount > 0 && (
        <div className="bg-surface-inset border border-border-subtle rounded-md px-4 py-3 text-xs text-text-muted">
          {filteredOutCount} candidate recommendation(s) exist for domains without Read + Recommend access —
          they are not shown, and never will be until you enable that domain. This is correct behavior, not a bug.
        </div>
      )}

      <Card title={`Recommendations (${visibleRecommendations.length} pending)`}>
        {visibleRecommendations.length === 0 ? (
          <p className="text-text-muted text-xs">
            No changes recommended right now — a real "nothing to suggest" state, not an empty-by-accident one.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleRecommendations.map((r) => (
              <div key={r.id} className="bg-surface-inset border border-border-subtle rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text-primary text-sm font-medium">{r.title}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={IMPACT_TONE[r.impact]}>{r.impact} impact</Badge>
                    <Badge tone={CONFIDENCE_TONE[r.confidence]}>{r.confidence}</Badge>
                  </div>
                </div>
                <p className="text-text-muted text-xs mb-1">{r.domain} · Generated from {r.generatedFrom}</p>
                <ul className="text-text-secondary text-xs mb-2 list-disc list-inside">
                  {r.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button onClick={() => decideRecommendation(r.id, "accepted")} className="px-3 py-1 rounded-md bg-action-primary text-text-inverse text-xs">
                    Accept
                  </button>
                  <button onClick={() => decideRecommendation(r.id, "modified")} className="px-3 py-1 rounded-md bg-action-secondary text-text-primary text-xs">
                    Modify
                  </button>
                  <button onClick={() => decideRecommendation(r.id, "rejected")} className="px-3 py-1 rounded-md text-text-muted text-xs hover:text-status-danger">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Combined Capacity Impact">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-text-muted text-xs">Current Load</div>
            <div className="text-text-primary">{minutesLabel(combinedImpact.currentLoadMinutes)}</div>
          </div>
          <div>
            <div className="text-text-muted text-xs">With Accepted Changes</div>
            <div className="text-text-primary">{minutesLabel(combinedImpact.withAcceptedChangesMinutes)}</div>
          </div>
          <div>
            <div className="text-text-muted text-xs">Weekly Capacity</div>
            <div className="text-text-primary">{minutesLabel(combinedImpact.weeklyCapacityMinutes)}</div>
          </div>
        </div>
        {combinedImpact.exceedsCapacity && (
          <div className="bg-status-warning/10 border border-status-warning/30 rounded-md px-3 py-2 mt-3 text-xs text-status-warning">
            Accepting all currently-accepted changes together exceeds your configured weekly capacity —
            validated as a combined set, not just individually.
          </div>
        )}
      </Card>

      <Card title={`Decision History (${decisionHistory.length})`}>
        {decisionHistory.length === 0 ? (
          <p className="text-text-muted text-xs">No decisions made yet.</p>
        ) : (
          <div className="space-y-1">
            {decisionHistory.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm">
                <span className="text-text-primary">{r.title}</span>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
