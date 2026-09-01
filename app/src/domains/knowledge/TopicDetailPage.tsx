import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { TextField } from "../../components/FormFields";
import { EvidenceList, type EvidenceView } from "../../components/EvidenceList";
import { useKnowledge } from "./store";
import { useAcademic } from "../academic/store";
import { useObsidian } from "../obsidian/store";
import { EMPTY_SOURCE_FORM, SourceForm } from "./SourceForm";
import { GenerateRecallButton } from "./GenerateRecallButton";
import { ContextualInsight } from "../../components/ContextualInsight";
import { EVIDENCE_TYPES, type EvidenceType, type SourceType } from "./types";
import { Button } from "../../components/Button";

const STATE_TONE = {
  new: "neutral",
  learning: "warning",
  developing: "warning",
  strong: "success",
} as const;

const SOURCE_LABEL: Record<SourceType, string> = {
  "obsidian-note": "Obsidian Note",
  "professor-material": "Professor Material",
  book: "Book",
  article: "Article / Web",
  video: "Video",
  "ai-note": "AI Note",
};

export function TopicDetailPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const knowledge = useKnowledge();
  const academic = useAcademic();
  const obs = useObsidian();
  const { getTopic, getSourcesForTopic, getEvidenceForTopic, saveState } = knowledge;

  const topic = getTopic(topicId ?? "");
  const [notePick, setNotePick] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [evForm, setEvForm] = useState({
    type: "recall" as EvidenceType,
    title: "",
    score: "",
    maxScore: "10",
    date: "",
  });
  const [evError, setEvError] = useState<string | null>(null);

  if (!topic) {
    return (
      <div className="space-y-3">
        <Link to="/knowledge" className="text-text-muted text-xs hover:text-text-secondary">
          ← Knowledge
        </Link>
        <p className="text-text-muted text-sm">Topic not found.</p>
      </div>
    );
  }

  const sources = getSourcesForTopic(topic.id);
  const evidenceList = getEvidenceForTopic(topic.id);
  const reviewDue = topic.nextReviewDate ? new Date(topic.nextReviewDate) <= new Date() : false;
  const linkedAcademicTopics = academic.topics.filter((t) => t.knowledgeTopicId === topic.id);
  const linkedCourseName = (courseId: string) =>
    academic.getCourse(courseId)?.title ?? "a course";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/knowledge" className="text-text-muted text-xs hover:text-text-secondary">
            ← Knowledge
          </Link>
          <h2 className="t-h2 text-text-primary mt-1">{topic.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{topic.category}</Badge>
            {topic.context && <span className="text-text-muted text-xs">{topic.context}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <Button variant="secondary" onClick={() => navigate(`/knowledge/${topic.id}/edit`)}>
            Edit Topic
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Current State</div>
          <div className="flex items-center gap-2">
            <Badge tone={STATE_TONE[topic.state]}>{topic.state}</Badge>
            {reviewDue && <Badge tone="warning">Review Due</Badge>}
          </div>
          <p className="text-text-muted text-[10px] mt-1">
            "Strong" and "Review Due" can both be true — tracked separately.
          </p>
          <button
            onClick={() => knowledge.markReviewed(topic.id)}
            className="mt-2 px-2.5 py-1 rounded-md bg-action-secondary text-text-primary text-[11px] font-medium"
          >
            Mark reviewed
          </button>
          <p className="text-text-muted text-[10px] mt-1">
            Updates the review schedule only — never mastery.
          </p>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Mastery</div>
          <div className="text-text-primary text-lg font-semibold">
            {topic.hasEvidence ? `${topic.masteryPercent}%` : "—"}
          </div>
          <p className="text-text-muted text-[10px] mt-1 mb-2">
            {topic.hasEvidence ? "Derived from evidence below." : "No mastery evidence yet."}
          </p>
          <GenerateRecallButton
            knowledgeTopicId={topic.id}
            topicTitle={topic.title}
            linkedSourceTitles={sources.map((s) => s.title)}
          />
        </Card>
        <Card>
          <TextField
            label="Last studied"
            type="date"
            value={topic.lastStudied ?? ""}
            onChange={(x) =>
              knowledge.updateReviewState(topic.id, {
                lastStudied: x || null,
                nextReviewDate: topic.nextReviewDate,
              })
            }
          />
        </Card>
        <Card>
          <TextField
            label="Next review"
            type="date"
            value={topic.nextReviewDate ?? ""}
            onChange={(x) =>
              knowledge.updateReviewState(topic.id, {
                lastStudied: topic.lastStudied,
                nextReviewDate: x || null,
              })
            }
          />
        </Card>
      </div>

      {linkedAcademicTopics.length > 0 && (
        <div className="bg-surface-inset border border-border-subtle rounded-md px-4 py-3 text-xs text-text-secondary">
          Linked from Academics:{" "}
          {linkedAcademicTopics
            .map((t) => `${t.title} (${linkedCourseName(t.courseId)})`)
            .join(", ")}
          . The course reads this concept's mastery — it does not store its own.
        </div>
      )}

      <ContextualInsight
        headline={
          !topic.hasEvidence
            ? "No mastery evidence yet — use “Generate Recall” above to run a governed check."
            : reviewDue
              ? "This concept is due for review (tracked separately from mastery)."
              : evidenceList.length === 1
                ? "Mastery here rests on a single piece of evidence — another check would firm it up."
                : null
        }
        reasons={[
          !topic.hasEvidence
            ? "Mastery is evidence-derived: a completed, evaluated recall/self check is what moves it. Adding a source or reading a note does not."
            : `${evidenceList.length} evidence record(s); current state is "${topic.state}".`,
          reviewDue
            ? "A review occurring does not raise mastery — it only reschedules the next review."
            : "Review is not currently due.",
        ]}
      />


      <div className="grid grid-cols-2 gap-4">
        {/* ---- Sources ---- */}
        <Card
          title={`Notes & Sources (${sources.length})`}
          action={
            <button
              onClick={() => {
                setAddingSource((v) => !v);
                setEditingSourceId(null);
              }}
              className="px-2.5 py-1 rounded-md bg-action-primary text-text-inverse text-[11px] font-medium"
            >
              {addingSource ? "Close" : "Add Source"}
            </button>
          }
        >
          <p className="text-text-muted text-[10px] mb-2">
            References only — the actual note content lives in Obsidian, not duplicated here. Adding a
            source is not evidence of understanding.
          </p>

          {addingSource && (
            <div className="mb-3 border border-border-subtle rounded-md p-3">
              <SourceForm
                initial={EMPTY_SOURCE_FORM}
                submitLabel="Add Source"
                busy={saveState === "saving"}
                onCancel={() => setAddingSource(false)}
                onSubmit={async (input) => {
                  const res = await knowledge.createSource(topic.id, input);
                  if (res.ok) setAddingSource(false);
                  return res;
                }}
              />
            </div>
          )}

          {sources.length === 0 && !addingSource ? (
            <div className="text-text-muted text-xs">No sources linked yet.</div>
          ) : (
            <div className="space-y-2">
              {sources.map((s) =>
                editingSourceId === s.id ? (
                  <div key={s.id} className="border border-border-subtle rounded-md p-3">
                    <SourceForm
                      initial={{ type: s.type, title: s.title, reference: s.reference }}
                      submitLabel="Save Source"
                      busy={saveState === "saving"}
                      onCancel={() => setEditingSourceId(null)}
                      onSubmit={async (input) => {
                        const res = await knowledge.updateSource(s.id, input);
                        if (res.ok) setEditingSourceId(null);
                        return res;
                      }}
                    />
                  </div>
                ) : (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
                  >
                    <div>
                      <div className="text-text-primary text-sm">{s.title}</div>
                      <div className="text-text-muted text-xs">{s.reference || "no reference"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{SOURCE_LABEL[s.type]}</Badge>
                      <button
                        onClick={() => setEditingSourceId(s.id)}
                        className="text-text-muted text-[11px] hover:text-text-secondary underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => knowledge.deleteSource(s.id)}
                        className="text-text-muted text-[11px] hover:text-status-danger underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </Card>

        {/* ---- Evidence ---- */}
        <Card
          title={`Evidence / Recall (${evidenceList.length})`}
          action={
            <button
              onClick={() => setAddingEvidence((v) => !v)}
              className="px-2.5 py-1 rounded-md bg-action-primary text-text-inverse text-[11px] font-medium"
            >
              {addingEvidence ? "Close" : "Record Evidence"}
            </button>
          }
        >
          <p className="text-text-muted text-[10px] mb-2">
            Mastery above is derived from this evidence. Professor coverage, personal study and saving
            a source never create evidence.
          </p>

          {addingEvidence && (
            <form
              className="mb-3 border border-border-subtle rounded-md p-3 space-y-2"
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await knowledge.addEvidence(topic.id, {
                  type: evForm.type,
                  title: evForm.title,
                  score: evForm.score.trim() === "" ? NaN : Number(evForm.score),
                  maxScore: evForm.maxScore.trim() === "" ? NaN : Number(evForm.maxScore),
                  date: evForm.date.trim(),
                });
                if (res.ok) {
                  setAddingEvidence(false);
                  setEvForm({ type: "recall", title: "", score: "", maxScore: "10", date: "" });
                  setEvError(null);
                } else {
                  setEvError(res.reason);
                }
              }}
            >
              <TextField
                label="What was it?"
                value={evForm.title}
                onChange={(x) => setEvForm((p) => ({ ...p, title: x }))}
                placeholder="e.g. Inorder traversal drill"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-text-secondary text-xs">
                  Type
                  <select
                    value={evForm.type}
                    onChange={(e) =>
                      setEvForm((p) => ({ ...p, type: e.target.value as EvidenceType }))
                    }
                    aria-label="Evidence type"
                    className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    {EVIDENCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Date (optional)"
                  type="date"
                  value={evForm.date}
                  onChange={(x) => setEvForm((p) => ({ ...p, date: x }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  label="Score"
                  type="number"
                  value={evForm.score}
                  onChange={(x) => setEvForm((p) => ({ ...p, score: x }))}
                />
                <TextField
                  label="Out of"
                  type="number"
                  value={evForm.maxScore}
                  onChange={(x) => setEvForm((p) => ({ ...p, maxScore: x }))}
                />
              </div>
              {evError && <p className="text-status-danger text-[11px]">{evError}</p>}
              <Button variant="primary" type="submit">
                Record Evidence
              </Button>
            </form>
          )}

          {evidenceList.length === 0 && !addingEvidence ? (
            <div className="text-text-muted text-xs">
              No evidence recorded yet — mastery is unknown until it is.
            </div>
          ) : (
            <EvidenceList
              items={evidenceList.map<EvidenceView>((e) => ({
                id: e.id,
                title: e.title,
                kind: e.type,
                date: e.date || null,
                result: `${e.score} / ${e.maxScore}`,
                onDelete: () => knowledge.deleteEvidence(e.id),
              }))}
              emptyLabel="No evidence recorded yet — mastery is unknown until it is."
            />
          )}
        </Card>
      </div>

      <Card
        title={`Linked Notes — Obsidian (${obs.linksForTopic(topic.id).length})`}
        action={
          <Link
            to="/knowledge/notes"
            className="text-text-secondary text-[11px] underline hover:text-text-primary"
          >
            Notes Hub
          </Link>
        }
      >
        <p className="text-text-muted text-[10px] mb-2">
          References to note files in your Obsidian vault. Obsidian owns the note bodies; linking a
          note is not evidence of understanding and never changes mastery.
        </p>

        {obs.hubState !== "indexed" && obs.hubState !== "empty" ? (
          <div className="text-text-muted text-xs">
            No vault connected. <Link to="/knowledge/notes" className="underline">Connect one in the Notes Hub</Link> to
            link notes.
          </div>
        ) : (
          <>
            {obs.linksForTopic(topic.id).length === 0 ? (
              <div className="text-text-muted text-xs mb-2">No notes linked to this topic yet.</div>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {obs.linksForTopic(topic.id).map((l) => {
                  const state = obs.resolveLinkState(l);
                  return (
                    <li
                      key={l.id}
                      className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="text-text-primary text-sm truncate">{l.title}</div>
                        <div className="text-text-muted text-xs truncate">{l.relativePath}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {state === "ok" && <Badge tone="success">in vault</Badge>}
                        {state === "stale" && <Badge tone="danger">missing / stale</Badge>}
                        {state === "unindexed" && <Badge tone="warning">not indexed</Badge>}
                        <button
                          onClick={() => obs.openNote(l.relativePath)}
                          aria-label={`Open ${l.title} in Obsidian`}
                          disabled={state !== "ok"}
                          className="text-text-secondary text-[11px] underline hover:text-text-primary disabled:opacity-40 disabled:no-underline"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => obs.unlinkNote(l.id)}
                          aria-label={`Unlink ${l.title} from ${topic.title}`}
                          className="text-text-muted text-[11px] hover:text-status-danger underline"
                        >
                          Unlink
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="topic-note-link" className="sr-only">
                Link an indexed note to {topic.title}
              </label>
              <select
                id="topic-note-link"
                value={notePick}
                onChange={(e) => setNotePick(e.target.value)}
                className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <option value="">Link an indexed note…</option>
                {obs.notes
                  .filter(
                    (n) =>
                      n.existsOnDisk &&
                      !obs.linksForTopic(topic.id).some((l) => l.relativePath === n.relativePath),
                  )
                  .map((n) => (
                    <option key={n.id} value={n.relativePath}>
                      {n.title} — {n.relativePath}
                    </option>
                  ))}
              </select>
              <button
                onClick={async () => {
                  if (!notePick) return;
                  const res = await obs.linkNote(topic.id, notePick);
                  if (res.ok) setNotePick("");
                }}
                disabled={!notePick}
                className="px-2 py-1 rounded bg-action-primary text-text-inverse text-[11px] font-medium disabled:opacity-40"
              >
                Link note
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
