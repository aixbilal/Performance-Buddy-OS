import { useState } from "react";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useCapture } from "./store";
import type { CaptureType } from "./types";

const STATUS_TONE = { unprocessed: "warning", proposed: "neutral", resolved: "success" } as const;
const RECLASSIFY_TYPES: CaptureType[] = ["action", "expense", "routine-checkin", "note"];

/**
 * Owns unresolved raw captures ONLY — not a second Action database, not a notes
 * app. Confirming routes a capture into its real domain engine; the row is then
 * marked resolved and the real data lives in that domain, not here.
 */
export function CaptureInboxPage() {
  const { loaded, backend, unresolved, confirmItem, reclassify, dismissItem, deleteItem } = useCapture();
  const [message, setMessage] = useState<string | null>(null);

  const onConfirm = async (id: string) => {
    setMessage(null);
    const res = await confirmItem(id);
    setMessage(
      res.ok
        ? `Confirmed — sent to ${res.target}${res.entityId ? "" : " (no id returned)"}.`
        : res.error,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="t-h2 text-text-primary">Capture Inbox</h2>
        <p className="text-text-muted text-sm">
          Unresolved raw captures only — confirmed items move into their real domain and leave this list.
          Stored durably ({backend}); nothing is lost on reload.
        </p>
      </div>

      {message && (
        <div className="bg-surface-inset border border-border-subtle rounded-md p-3 text-text-secondary text-sm">
          {message}
        </div>
      )}

      <Card title={`Unresolved (${unresolved.length})`}>
        {!loaded ? (
          <div className="text-text-muted text-xs">Loading…</div>
        ) : unresolved.length === 0 ? (
          <EmptyState
            icon="✓"
            tone="positive"
            title="You're all caught up"
            description="No captures are waiting. Type anything into Quick Capture (Ctrl/⌘-K) and it lands here."
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
                    Proposed: <b className="capitalize">{item.proposal.type.replace("-", " ")}</b> ·{" "}
                    {item.proposal.confidence} confidence
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onConfirm(item.id)}
                    className="px-3 py-1 rounded-md bg-action-primary text-text-inverse text-xs"
                  >
                    Confirm
                  </button>
                  <span className="text-text-muted text-[10px]">reclassify:</span>
                  {RECLASSIFY_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => reclassify(item.id, t)}
                      className={`px-2 py-1 rounded-md text-[11px] ${
                        item.proposal?.type === t
                          ? "bg-surface-selected text-text-primary"
                          : "text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {t.replace("-", " ")}
                    </button>
                  ))}
                  <button
                    onClick={() => dismissItem(item.id)}
                    className="px-3 py-1 rounded-md text-text-muted text-xs hover:text-status-danger"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="px-3 py-1 rounded-md text-text-muted text-xs hover:text-status-danger"
                  >
                    Delete
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
