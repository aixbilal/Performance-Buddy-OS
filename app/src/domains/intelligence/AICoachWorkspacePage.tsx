import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { RecommendationCard } from "../../components/RecommendationCard";
import { useAICoach } from "./store";
import { AI_DOMAINS } from "../ai/context";

/**
 * AI Coach Workspace — a task-scoped coaching surface. The conversation is
 * transient (docs 26.02: no memory just because it appeared in chat). Proposals
 * it produces are durable recommendations that flow through the same
 * decide → validate → Apply pipeline as everywhere else.
 */
export function AICoachWorkspacePage() {
  const coach = useAICoach();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(["Knowledge", "Planning", "Today"]);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ title: string; reason: string }[]>([]);
  const [lastIds, setLastIds] = useState<string[]>([]);

  const preview = useMemo(
    () => coach.contextPreview(selected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, coach.domainFacts],
  );

  const toggle = (d: string) =>
    setSelected((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const ask = async () => {
    setBusy(true);
    setReply(null);
    try {
      const res = await coach.generate(
        "workspace",
        selected,
        query.trim() ? [{ role: "user", content: query.trim() }] : undefined,
      );
      if (!res.ok) {
        setReply(`AI unavailable (${res.failure}): ${res.message}. Your question is kept above.`);
        setRejected([]);
        setLastIds([]);
        return;
      }
      setReply(res.message);
      setRejected(res.rejected);
      setLastIds(res.created.map((r) => r.id));
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const workspaceRecs = coach.recommendations.filter((r) => lastIds.includes(r.id));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/ai-coach" className="text-text-muted text-xs hover:text-text-secondary">
          ← AI Coach
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">Workspace</h2>
        <p className="text-text-muted text-sm">
          Ask a bounded coaching question. Nothing you type is remembered after you leave; any
          proposal it makes becomes a reviewable recommendation.
        </p>
      </div>

      <Card title="Context to send">
        <p className="text-text-secondary text-[11px] mb-2">
          Only domains you tick <em>and</em> have granted at least Read are included. Everything else
          is held back.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {AI_DOMAINS.map((d) => (
            <label
              key={d}
              className="flex items-center gap-1.5 text-xs text-text-secondary bg-surface-inset border border-border-subtle rounded px-2 py-1"
            >
              <input
                type="checkbox"
                checked={selected.includes(d)}
                onChange={() => toggle(d)}
                aria-label={`Include ${d} in the context`}
                className="accent-action-primary"
              />
              {d}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs" data-testid="context-preview">
          <div>
            <div className="text-status-success text-[11px] mb-1 font-medium">Included</div>
            <ul className="text-text-secondary list-disc list-inside space-y-0.5">
              {preview.included.length === 0 ? (
                <li className="text-text-muted list-none">nothing — no ticked domain is permitted</li>
              ) : (
                preview.included.map((f, i) => <li key={i}>{f}</li>)
              )}
            </ul>
          </div>
          <div>
            <div className="text-text-secondary text-[11px] mb-1 font-medium">Excluded</div>
            <ul className="text-text-secondary list-disc list-inside space-y-0.5">
              {preview.excluded.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <label htmlFor="coach-query" className="block text-text-secondary text-xs mb-1">
          Your question (optional — leave blank to just ask for suggestions)
        </label>
        <textarea
          id="coach-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="e.g. What should I prioritise this week?"
          className="w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={ask}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium disabled:opacity-40"
          >
            {busy ? "Asking…" : "Ask coach"}
          </button>
          <Badge tone={coach.aiAvailability === "ready" ? "success" : "warning"}>
            {coach.aiAvailability === "not-configured" ? "not configured" : coach.aiAvailability}
          </Badge>
        </div>
        {reply && (
          <p className="text-text-secondary text-sm mt-3 whitespace-pre-wrap" role="status">
            {reply}
          </p>
        )}
        {rejected.length > 0 && (
          <ul className="text-text-muted text-[11px] mt-2 list-disc list-inside">
            {rejected.map((r, i) => (
              <li key={i}>
                Discarded proposal “{r.title}” — {r.reason}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {workspaceRecs.length > 0 && (
        <Card title="Proposals from this question">
          <div className="space-y-3">
            {workspaceRecs.map((r) => (
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
        </Card>
      )}
    </div>
  );
}
