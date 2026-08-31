import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useMastery } from "./masteryStore";
import { deriveMasteryOutcome, scoreMasteryCheck } from "./masteryEngine";
import type { MasteryItem, MasteryRating } from "./masteryTypes";

/** `/academics/mastery` — a light log of past personal checks. */
export function MasteryIndexPage() {
  const navigate = useNavigate();
  const { loaded, checks } = useMastery();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Mastery Checks</h2>
          <p className="text-text-muted text-sm">Personal learning checks — practice evidence, never grades.</p>
        </div>
        <button
          onClick={() => navigate("/academics/study")}
          className="px-3 py-1 rounded-md border border-border-subtle text-text-secondary text-xs hover:bg-surface-inset"
        >
          Start from Normal Study
        </button>
      </div>
      <Card>
        {loaded && checks.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No checks yet"
            description="Start a Mastery Check for a topic from Normal Study. Results appear here."
            primaryAction={{ label: "Open Normal Study", onClick: () => navigate("/academics/study") }}
          />
        ) : (
          <ul className="space-y-1">
            {checks.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm"
              >
                <button className="text-text-primary underline text-left" onClick={() => navigate(`/academics/mastery/${c.id}`)}>
                  {c.topicTitle}
                </button>
                <span className="text-text-muted text-xs">
                  {c.status === "completed" ? `${c.score}/${c.maxScore}` : "in progress"}
                  {c.evidenceId ? " · evidence recorded" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const RATING_LABEL: Record<MasteryRating, string> = {
  confident: "Confident",
  partial: "Partial",
  unsure: "Unsure",
};
const RATINGS: MasteryRating[] = ["confident", "partial", "unsure"];

const BAND_TONE = {
  "needs-reinforcement": "warning",
  developing: "neutral",
  strong: "success",
} as const;

export function MasteryCheckPage() {
  const { checkId = "" } = useParams();
  const navigate = useNavigate();
  const { loaded, getCheck, submitCheck, recordEvidence } = useMastery();

  const check = getCheck(checkId);
  const [items, setItems] = useState<MasteryItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);

  useEffect(() => {
    if (check && check.status === "in-progress") setItems(check.items);
  }, [check?.id, check?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loaded && !check) {
    return (
      <Card>
        <p className="text-text-muted text-sm">
          That mastery check was not found.{" "}
          <button className="underline" onClick={() => navigate("/academics/study")}>
            Back to Normal Study
          </button>
        </p>
      </Card>
    );
  }
  if (!check) return <div className="text-text-muted text-sm">Loading…</div>;

  const rate = (id: string, rating: MasteryRating) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, rating } : i)));

  const submit = async () => {
    setErr(null);
    const res = await submitCheck(check.id, items);
    if (!res.ok) setErr(res.error ?? "Could not submit.");
  };

  const doRecord = async () => {
    setHandoff(null);
    const res = await recordEvidence(check.id);
    if (res.ok) {
      setHandoff(
        res.alreadyRecorded
          ? "Already recorded — one Knowledge evidence record exists for this check (not duplicated)."
          : "Recorded as one Knowledge evidence record. Knowledge mastery re-derives from it.",
      );
    } else {
      setHandoff(res.message);
    }
  };

  // ---- in-progress: run the self-check --------------------------------
  if (check.status === "in-progress") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Mastery Check — {check.topicTitle}</h2>
          <p className="text-text-muted text-sm">
            A personal self-check, not an official assessment and not a grade. Rate each prompt honestly.
          </p>
        </div>

        <Card>
          <fieldset className="space-y-4">
            <legend className="sr-only">Self-check prompts for {check.topicTitle}</legend>
            {items.map((it, idx) => (
              <div key={it.id} className="border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                <div className="text-text-primary text-sm mb-2">
                  {idx + 1}. {it.prompt}
                </div>
                <div className="flex gap-2" role="radiogroup" aria-label={`Rating for prompt ${idx + 1}`}>
                  {RATINGS.map((r) => (
                    <label
                      key={r}
                      className={`px-3 py-1 rounded-md border text-xs cursor-pointer ${
                        it.rating === r
                          ? "border-border-focus bg-surface-selected text-text-primary"
                          : "border-border-subtle text-text-secondary"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`rate-${it.id}`}
                        value={r}
                        checked={it.rating === r}
                        onChange={() => rate(it.id, r)}
                        className="sr-only"
                      />
                      {RATING_LABEL[r]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          {err && (
            <p className="text-status-danger text-xs mt-3" role="alert">
              {err}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={submit}
              className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
            >
              Submit check
            </button>
            <button
              onClick={() => navigate("/academics/study")}
              className="px-3 py-1.5 rounded-md border border-border-subtle text-text-secondary text-xs"
            >
              Cancel
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ---- completed: result -------------------------------------------
  const s = scoreMasteryCheck(check.items);
  const outcome = deriveMasteryOutcome(s.percent);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Mastery Result — {check.topicTitle}</h2>
          <p className="text-text-muted text-sm">Practice evidence, not a course grade.</p>
        </div>
        <button
          onClick={() => navigate("/academics/study")}
          className="px-3 py-1 rounded-md border border-border-subtle text-text-secondary text-xs hover:bg-surface-inset"
        >
          Back to Normal Study
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Score</div>
          <div className="text-text-primary text-2xl font-semibold">
            {check.score}/{check.maxScore}
          </div>
          <div className="text-text-muted text-xs">{s.percent}%</div>
        </Card>
        <Card className="col-span-2">
          <div className="text-text-muted text-xs mb-1">Outcome</div>
          <Badge tone={BAND_TONE[outcome.band]}>{outcome.band.replace("-", " ")}</Badge>
          <p className="text-text-secondary text-xs mt-2">{outcome.message}</p>
          <p className="text-text-disabled text-[11px] mt-1">
            Suggested next review in ~{outcome.nextReviewInDays} days (advisory — not applied automatically).
          </p>
        </Card>
      </div>

      <Card title="Prompt-by-prompt">
        <ul className="space-y-1 text-sm">
          {check.items.map((it, idx) => (
            <li key={it.id} className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0">
              <span className="text-text-primary">
                {idx + 1}. {it.prompt}
              </span>
              <span
                className={
                  it.rating === "confident"
                    ? "text-status-success text-xs"
                    : it.rating === "partial"
                      ? "text-status-warning text-xs"
                      : "text-status-danger text-xs"
                }
              >
                {it.rating ? RATING_LABEL[it.rating] : "—"}
              </span>
            </li>
          ))}
        </ul>
        {s.weak.length > 0 && (
          <p className="text-text-secondary text-xs mt-2">
            Focus your next study on: {s.weak.map((w) => `“${w.prompt}”`).join("; ")}
          </p>
        )}
      </Card>

      <Card title="Knowledge evidence">
        {check.evidenceId ? (
          <p className="text-status-success text-xs">
            Recorded as one Knowledge evidence record. Re-recording is blocked — no duplicates.
          </p>
        ) : !check.knowledgeTopicId ? (
          <div className="text-text-secondary text-xs space-y-1">
            <p>This topic has no linked Knowledge concept, so mastery evidence can’t be recorded yet.</p>
            <p className="text-text-disabled">
              Options: link an existing concept or create one via the course’s topic detail, then come back.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-text-secondary text-xs">
              Recording sends this result to the linked Knowledge concept as <b>one</b> evidence record. Knowledge
              mastery then re-derives from evidence — this page never stores an academic mastery number.
            </p>
            <button
              onClick={doRecord}
              className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
            >
              Record as Knowledge Evidence
            </button>
          </div>
        )}
        {handoff && (
          <p className="text-text-secondary text-xs mt-2" role="status">
            {handoff}
          </p>
        )}
      </Card>
    </div>
  );
}
