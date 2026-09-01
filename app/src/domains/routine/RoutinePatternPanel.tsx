/**
 * Routine pattern surface (V2 Phase H).
 *
 * Shows deterministic, evidence-gated pattern candidates (below the threshold →
 * nothing shows). Each is a PROPOSAL: Accept & apply runs the matching
 * Phase-C `adjust-routine-*` mutation through the shared engine (deterministic
 * validation, one canonical `updateRoutine` call, a revision row). No streaks,
 * no scoring, no auto-apply.
 */
import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { useRoutine } from "./store";
import { useMutationContext } from "../mutations/useMutationContext";
import { runMutation } from "../mutations/registry";
import { recordRevision } from "../revision/recorder";
import { deriveOpportunities, derivePatternCandidates, PATTERN_CONFIG } from "./patternEngine";
import type { Routine } from "./types";

const WINDOW_DAYS = 63;

export function RoutinePatternPanel({ routine }: { routine: Routine }) {
  const { getLogsForRoutine } = useRoutine();
  const ctx = useMutationContext();
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
    const opps = deriveOpportunities(routine, getLogsForRoutine(routine.id), start, today);
    return { list: derivePatternCandidates(routine, opps), opportunities: opps.length };
  }, [routine, getLogsForRoutine]);

  const visible = candidates.list.filter((c) => !dismissed.has(c.kind));

  const apply = async (kind: string, mutation: { kind: string; params: Record<string, unknown> }) => {
    setBusy(kind);
    setResult(null);
    const out = await runMutation(mutation.kind, mutation.params, ctx);
    if (out.ok) {
      recordRevision({
        domain: "routine",
        entityType: "routine",
        entityId: routine.id,
        operation: "update",
        source: "user",
        summary: `Applied a routine pattern change (${mutation.kind})`,
        metadata: { patternKind: kind, mutationKind: mutation.kind },
      });
      setResult("Applied.");
      setDismissed((d) => new Set(d).add(kind));
    } else {
      setResult(`Not applied: ${out.message}`);
    }
    setBusy(null);
  };

  if (candidates.opportunities < PATTERN_CONFIG.MIN_OPPORTUNITIES) {
    return (
      <p className="t-caption text-text-muted">
        Not enough comparable history yet ({candidates.opportunities}/
        {PATTERN_CONFIG.MIN_OPPORTUNITIES}) to suggest a structural change.
      </p>
    );
  }
  if (visible.length === 0) {
    return <p className="t-caption text-text-muted">No structural pattern needs attention.</p>;
  }

  return (
    <div className="space-y-3">
      {visible.map((c) => (
        <div key={c.kind} className="rounded-md border border-border-subtle bg-surface-inset p-3">
          <p className="text-sm text-text-primary">{c.summary}</p>
          <ul className="t-caption text-text-muted list-disc pl-4 mt-1 space-y-0.5">
            {c.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <div className="flex items-center gap-2 mt-2">
            {c.suggestedMutation ? (
              <Button
                size="sm"
                onClick={() => void apply(c.kind, c.suggestedMutation!)}
                disabled={busy !== null}
              >
                Accept &amp; apply
              </Button>
            ) : (
              <span className="t-caption text-text-muted">No safe automatic change — adjust manually.</span>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed((d) => new Set(d).add(c.kind))}
              disabled={busy !== null}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
      {result && <p className="t-caption text-text-secondary">{result}</p>}
    </div>
  );
}
