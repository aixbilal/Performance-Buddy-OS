import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useCapture } from "./store";

const STATUS_TONE = { unprocessed: "warning", proposed: "neutral", resolved: "success" } as const;

/**
 * §20: owns unresolved raw captures ONLY — not a second Action database,
 * not a notes app. Once resolved, the real data lives in whichever domain
 * engine actually processed it (Action, Transaction, etc.), not here.
 */
export function CaptureInboxPage() {
  const { inbox, confirmItem, dismissItem } = useCapture();
  const unresolved = inbox.filter((i) => i.status !== "resolved");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Capture Inbox</h2>
        <p className="text-text-muted text-sm">Unresolved raw captures only — resolved items move into their real domain and disappear from here.</p>
      </div>

      <Card title={`Unresolved (${unresolved.length})`}>
        {unresolved.length === 0 ? (
          <EmptyState
            icon="✓"
            tone="positive"
            title="You're all caught up"
            description="No captures are waiting to be processed. Great job staying on top of things."
          />
        ) : (
          <div className="space-y-3">
            {unresolved.map((item) => (
              <div key={item.id} className="bg-surface-inset border border-border-subtle rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text-primary text-sm">{item.rawText}</span>
                  <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                </div>
                {item.proposal && (
                  <p className="text-text-secondary text-xs mb-2">
                    Proposed: <b className="capitalize">{item.proposal.type}</b> · {item.proposal.confidence} confidence
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => confirmItem(item.id)} className="px-3 py-1 rounded-md bg-action-primary text-text-inverse text-xs">
                    Confirm
                  </button>
                  <button onClick={() => dismissItem(item.id)} className="px-3 py-1 rounded-md text-text-muted text-xs hover:text-status-danger">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
