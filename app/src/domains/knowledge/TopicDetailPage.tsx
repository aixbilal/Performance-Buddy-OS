import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { TextField } from "../../components/FormFields";
import { useKnowledge } from "./store";
import { useAcademic } from "../academic/store";
import { EMPTY_SOURCE_FORM, SourceForm } from "./SourceForm";
import { EVIDENCE_TYPES, type EvidenceType, type SourceType } from "./types";

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
  const { getTopic, getSourcesForTopic, getEvidenceForTopic, saveState } = knowledge;

  const topic = getTopic(topicId ?? "");
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
          <h2 className="text-text-primary text-xl font-semibold mt-1">{topic.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{topic.category}</Badge>
            {topic.context && <span className="text-text-muted text-xs">{topic.context}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <button
            onClick={() => navigate(`/knowledge/${topic.id}/edit`)}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Edit Topic
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Current State</div>
          <div className="flex items-center gap-2">
            <Badge tone={STATE_TONE[topic.state]}>{topic.state}</Badge>
            {reviewDue && <Badge tone="warning">Review Due</Badge>}
          </div>
          <p className="text-text-disabled text-[10px] mt-1">
            "Strong" and "Review Due" can both be true — tracked separately.
          </p>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Mastery</div>
          <div className="text-text-primary text-lg font-semibold">
            {topic.hasEvidence ? `${topic.masteryPercent}%` : "—"}
          </div>
          <p className="text-text-disabled text-[10px] mt-1">
            {topic.hasEvidence ? "Derived from evidence below." : "No mastery evidence yet."}
          </p>
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
          <p className="text-text-disabled text-[10px] mb-2">
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
          <p className="text-text-disabled text-[10px] mb-2">
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
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
              >
                Record Evidence
              </button>
            </form>
          )}

          {evidenceList.length === 0 && !addingEvidence ? (
            <div className="text-text-muted text-xs">
              No evidence recorded yet — mastery is unknown until it is.
            </div>
          ) : (
            <div className="space-y-2">
              {evidenceList.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
                >
                  <div>
                    <div className="text-text-primary text-sm">{e.title}</div>
                    <div className="text-text-muted text-xs capitalize">
                      {e.type}
                      {e.date && ` · ${e.date}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary text-xs">
                      {e.score} / {e.maxScore}
                    </span>
                    <button
                      onClick={() => knowledge.deleteEvidence(e.id)}
                      className="text-text-muted text-[11px] hover:text-status-danger underline"
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
    </div>
  );
}
