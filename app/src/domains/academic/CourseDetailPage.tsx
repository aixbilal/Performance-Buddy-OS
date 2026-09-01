import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useAcademic } from "./store";
import { useKnowledge } from "../knowledge/store";
import { analyzeAssessmentWeighting } from "./engine";
import { AssessmentForm, EMPTY_ASSESSMENT_FORM, type AssessmentFormValues } from "./AssessmentForm";
import { EMPTY_TOPIC_FORM, TopicForm, type TopicFormValues } from "./TopicForm";
import { COVERAGE_STATUSES, GRADE_LETTERS, type CoverageStatus, type Topic } from "./types";
import { Button } from "../../components/Button";

const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  "not-taught": "Not Taught",
  "in-progress": "In Progress",
  taught: "Taught",
};
const COVERAGE_TONE = {
  "not-taught": "neutral",
  "in-progress": "warning",
  taught: "success",
} as const;

function masteryTone(percent: number): "danger" | "warning" | "success" {
  if (percent < 50) return "danger";
  if (percent < 75) return "warning";
  return "success";
}

export function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const academic = useAcademic();
  const knowledge = useKnowledge();
  const {
    courses,
    getTopicsForCourse,
    getAssessmentsForCourse,
    getAttemptsForCourse,
    getCourseWeightedScore,
    saveState,
  } = academic;

  const course = courses.find((c) => c.id === courseId);
  const [addingTopic, setAddingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [addingAssessment, setAddingAssessment] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft] = useState("");
  const [termDraft, setTermDraft] = useState("");

  if (!course) {
    return (
      <div className="space-y-3">
        <Link to="/academics" className="text-text-muted text-xs hover:text-text-secondary">
          ← Academics
        </Link>
        <p className="text-text-muted text-sm">Course not found.</p>
      </div>
    );
  }

  const topics = getTopicsForCourse(course.id);
  const assessments = getAssessmentsForCourse(course.id);
  const attempts = getAttemptsForCourse(course.id);
  const weightedScore = getCourseWeightedScore(course.id);
  const weighting = analyzeAssessmentWeighting(
    assessments.map((a) => ({ weightPercent: a.weightPercent, obtainedMarks: a.obtainedMarks })),
  );

  const topicMastery = (knowledgeTopicId: string | null) => {
    if (!knowledgeTopicId) return null;
    const kt = knowledge.getTopic(knowledgeTopicId);
    if (!kt) return null;
    return { percent: kt.masteryPercent, hasEvidence: kt.hasEvidence };
  };

  const avgPersonalStudy = Math.round(
    topics.reduce((s, t) => s + t.personalStudyPercent, 0) / (topics.length || 1),
  );
  const taughtCount = topics.filter((t) => t.professorCoverage === "taught").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/academics" className="text-text-muted text-xs hover:text-text-secondary">
            ← Academics
          </Link>
          <h2 className="t-h2 text-text-primary mt-1">
            {course.title}
            {course.code && <span className="text-text-muted text-base"> ({course.code})</span>}
            {course.archived && (
              <span className="ml-2">
                <Badge>archived</Badge>
              </span>
            )}
          </h2>
          <p className="text-text-muted text-sm">
            {course.professorName || "No instructor set"} · {course.creditHours} Credit Hours
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <Button variant="secondary" onClick={() => navigate(`/academics/${course.id}/edit`)}>
            Edit Course
          </Button>
          <Button variant="ghost" onClick={() => academic.archiveCourse(course.id, !course.archived)}>
            {course.archived ? "Unarchive" : "Archive"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Syllabus Coverage</div>
          <div className="text-text-primary text-lg font-semibold">
            {taughtCount} / {topics.length}
          </div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Personal Study (avg)</div>
          <div className="text-text-primary text-lg font-semibold">{avgPersonalStudy}%</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Weighted Score So Far</div>
          <div className="text-text-primary text-lg font-semibold">{weightedScore.toFixed(1)}%</div>
        </Card>
      </div>

      {weighting.isConfigurationProblem && weighting.message && (
        <div
          role="status"
          className="bg-status-warning/10 border border-status-warning/30 rounded-md px-4 py-3 text-xs text-status-warning"
        >
          {weighting.message}
        </div>
      )}

      {/* ---- Topics ---- */}
      <Card
        title="Syllabus & Topic Progress"
        action={
          <button
            onClick={() => {
              setAddingTopic((v) => !v);
              setEditingTopicId(null);
            }}
            className="px-2.5 py-1 rounded-md bg-action-primary text-text-inverse text-[11px] font-medium"
          >
            {addingTopic ? "Close" : "Add Topic"}
          </button>
        }
      >
        <p className="text-text-muted text-[11px] mb-3">
          Professor coverage, personal study, and mastery are tracked separately and never collapsed
          into one number. Mastery is read from the linked Knowledge concept's evidence — not stored
          here.
        </p>

        {addingTopic && (
          <div className="mb-4 border border-border-subtle rounded-md p-3">
            <TopicForm
              initial={EMPTY_TOPIC_FORM}
              submitLabel="Add Topic"
              busy={saveState === "saving"}
              onCancel={() => setAddingTopic(false)}
              onSubmit={async (input) => {
                const res = await academic.createTopic(course.id, input);
                if (res.ok) setAddingTopic(false);
                return res;
              }}
            />
          </div>
        )}

        {topics.length === 0 && !addingTopic ? (
          <div className="text-text-muted text-xs py-2">No topics yet. Add one to track coverage.</div>
        ) : (
          <div className="space-y-2">
            {topics.map((t) => (
              <TopicRow
                key={t.id}
                topic={t}
                editing={editingTopicId === t.id}
                mastery={topicMastery(t.knowledgeTopicId)}
                knowledgeOptions={knowledge.topics.map((k) => ({ id: k.id, title: k.title }))}
                onEditToggle={() =>
                  setEditingTopicId((id) => (id === t.id ? null : t.id))
                }
                onCoverage={(c) => academic.setProfessorCoverage(t.id, c)}
                onPersonalStudy={(p) => academic.setPersonalStudyCoverage(t.id, p)}
                onLink={(kid) => academic.linkTopicToKnowledge(t.id, kid)}
                onUnlink={() => academic.unlinkTopicFromKnowledge(t.id)}
                onDelete={() => academic.deleteTopic(t.id)}
                onSubmitEdit={async (input) => {
                  const res = await academic.updateTopic(t.id, input);
                  if (res.ok) setEditingTopicId(null);
                  return res;
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ---- Assessments ---- */}
      <Card
        title={`Assessments (${assessments.length}) · weights total ${weighting.totalWeight}%`}
        action={
          <button
            onClick={() => {
              setAddingAssessment((v) => !v);
              setEditingAssessmentId(null);
            }}
            className="px-2.5 py-1 rounded-md bg-action-primary text-text-inverse text-[11px] font-medium"
          >
            {addingAssessment ? "Close" : "Add Assessment"}
          </button>
        }
      >
        {weighting.status === "empty" && (
          <div className="text-text-muted text-xs mb-3">
            No assessments configured yet — the weighted score above is 0% because nothing is set up,
            not because you scored 0.
          </div>
        )}

        {addingAssessment && (
          <div className="mb-4 border border-border-subtle rounded-md p-3">
            <AssessmentForm
              initial={EMPTY_ASSESSMENT_FORM}
              submitLabel="Add Assessment"
              busy={saveState === "saving"}
              onCancel={() => setAddingAssessment(false)}
              onSubmit={async (input) => {
                const res = await academic.createAssessment(course.id, input);
                if (res.ok) setAddingAssessment(false);
                return res;
              }}
            />
          </div>
        )}

        <div className="space-y-1">
          {assessments.map((a) =>
            editingAssessmentId === a.id ? (
              <div key={a.id} className="border border-border-subtle rounded-md p-3 my-2">
                <AssessmentForm
                  initial={
                    {
                      category: a.category,
                      title: a.title,
                      totalMarks: String(a.totalMarks),
                      weightPercent: String(a.weightPercent),
                      date: a.date,
                      obtainedMarks: a.obtainedMarks === null ? "" : String(a.obtainedMarks),
                    } satisfies AssessmentFormValues
                  }
                  submitLabel="Save Assessment"
                  busy={saveState === "saving"}
                  onCancel={() => setEditingAssessmentId(null)}
                  onSubmit={async (input) => {
                    const res = await academic.updateAssessment(a.id, input);
                    if (res.ok) setEditingAssessmentId(null);
                    return res;
                  }}
                />
              </div>
            ) : (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
              >
                <div>
                  <div className="text-text-primary text-sm">{a.title}</div>
                  <div className="text-text-muted text-xs capitalize">
                    {a.category} · {a.weightPercent}% weight
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-text-muted text-[11px]">
                    <span className="sr-only">Obtained marks for {a.title}</span>
                    <input
                      type="number"
                      defaultValue={a.obtainedMarks ?? ""}
                      aria-label={`Obtained marks for ${a.title}`}
                      className="w-16 bg-surface-inset border border-border-subtle rounded px-1.5 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        academic.setAssessmentMarks(a.id, raw === "" ? null : Number(raw));
                      }}
                    />
                    <span className="ml-1">/ {a.totalMarks}</span>
                  </label>
                  <button
                    onClick={() => {
                      setEditingAssessmentId(a.id);
                      setAddingAssessment(false);
                    }}
                    className="text-text-muted text-[11px] hover:text-text-secondary underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => academic.deleteAssessment(a.id)}
                    className="text-text-muted text-[11px] hover:text-status-danger underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ),
          )}
          {assessments.length === 0 && !addingAssessment && (
            <div className="py-2 text-text-muted text-xs">No assessments configured yet.</div>
          )}
        </div>
      </Card>

      {/* ---- Attempt / final grade ---- */}
      <Card title="Attempt & Final Grade">
        <p className="text-text-muted text-[11px] mb-3">
          A score is never converted to a letter grade automatically — the institution's scale isn't
          verified. Enter the official grade yourself, or leave it blank while the course is in
          progress.
        </p>
        {attempts.map((at) => (
          <div key={at.id} className="text-text-secondary text-xs mb-1">
            Attempt {at.attemptNumber} · {at.term || "term not set"} ·{" "}
            {at.finalGrade ? (
              <Badge tone="success">{at.finalGrade}</Badge>
            ) : (
              <span className="text-text-muted">in progress (no grade)</span>
            )}
          </div>
        ))}
        <div className="flex items-end gap-2 mt-2">
          <label className="text-text-secondary text-xs">
            Term
            <input
              value={termDraft}
              onChange={(e) => setTermDraft(e.target.value)}
              aria-label="Attempt term"
              placeholder="e.g. Fall 2026"
              className="block mt-1 w-40 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Final grade
            <select
              value={gradeDraft}
              onChange={(e) => setGradeDraft(e.target.value)}
              aria-label="Final grade"
              className="block mt-1 w-28 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <option value="">— none —</option>
              {GRADE_LETTERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" onClick={async () => { const existing = attempts[0]; await academic.upsertAttempt( course.id, { attemptNumber: existing?.attemptNumber ?? 1, term: termDraft, finalGrade: (gradeDraft || null) as never, }, existing?.id, ); setGradeDraft(""); setTermDraft(""); }}>
            Save attempt
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TopicRow({
  topic,
  editing,
  mastery,
  knowledgeOptions,
  onEditToggle,
  onCoverage,
  onPersonalStudy,
  onLink,
  onUnlink,
  onDelete,
  onSubmitEdit,
}: {
  topic: Topic;
  editing: boolean;
  mastery: { percent: number; hasEvidence: boolean } | null;
  knowledgeOptions: { id: string; title: string }[];
  onEditToggle: () => void;
  onCoverage: (c: CoverageStatus) => void;
  onPersonalStudy: (p: number) => void;
  onLink: (knowledgeTopicId: string) => void;
  onUnlink: () => void;
  onDelete: () => void;
  onSubmitEdit: (input: import("./types").TopicInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
}) {
  const [linkSel, setLinkSel] = useState("");

  if (editing) {
    return (
      <div className="border border-border-subtle rounded-md p-3">
        <TopicForm
          initial={
            {
              title: topic.title,
              professorCoverage: topic.professorCoverage,
              personalStudyPercent: String(topic.personalStudyPercent),
            } satisfies TopicFormValues
          }
          submitLabel="Save Topic"
          onCancel={onEditToggle}
          onSubmit={onSubmitEdit}
        />
      </div>
    );
  }

  return (
    <div className="border-t border-border-subtle pt-2 first:border-0 first:pt-0">
      <div className="flex items-center justify-between">
        <div className="text-text-primary text-sm">{topic.title}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEditToggle}
            className="text-text-muted text-[11px] hover:text-text-secondary underline"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-text-muted text-[11px] hover:text-status-danger underline"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-2 items-center">
        <label className="text-text-muted text-[11px]">
          Professor coverage
          <select
            value={topic.professorCoverage}
            aria-label={`Professor coverage for ${topic.title}`}
            onChange={(e) => onCoverage(e.target.value as CoverageStatus)}
            className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {COVERAGE_STATUSES.map((c) => (
              <option key={c} value={c}>
                {COVERAGE_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-text-muted text-[11px]">
          Personal study %
          <input
            type="number"
            defaultValue={topic.personalStudyPercent}
            key={topic.personalStudyPercent}
            aria-label={`Personal study percent for ${topic.title}`}
            onBlur={(e) => onPersonalStudy(Number(e.target.value))}
            className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
        </label>
        <div className="text-text-muted text-[11px]">
          Mastery (Knowledge)
          <div className="mt-1">
            {mastery === null ? (
              <Badge>{topic.knowledgeTopicId ? "Concept missing" : "Not linked"}</Badge>
            ) : !mastery.hasEvidence ? (
              <Badge>No evidence yet</Badge>
            ) : (
              <Badge tone={masteryTone(mastery.percent)}>{mastery.percent}%</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-text-muted text-[11px]">
          <Badge tone={COVERAGE_TONE[topic.professorCoverage]}>
            {COVERAGE_LABEL[topic.professorCoverage]}
          </Badge>
        </span>
        {topic.knowledgeTopicId ? (
          <button
            onClick={onUnlink}
            className="text-text-muted text-[11px] hover:text-text-secondary underline"
          >
            Unlink Knowledge concept
          </button>
        ) : knowledgeOptions.length > 0 ? (
          <span className="flex items-center gap-1">
            <label className="sr-only" htmlFor={`link-${topic.id}`}>
              Link {topic.title} to a Knowledge concept
            </label>
            <select
              id={`link-${topic.id}`}
              value={linkSel}
              onChange={(e) => setLinkSel(e.target.value)}
              className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <option value="">Link Knowledge concept…</option>
              {knowledgeOptions.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
            <button
              disabled={!linkSel}
              onClick={() => linkSel && onLink(linkSel)}
              className="px-2 py-1 rounded bg-action-secondary text-text-primary text-[11px] font-medium disabled:opacity-50"
            >
              Link
            </button>
          </span>
        ) : (
          <span className="text-text-muted text-[11px]">
            Create a Knowledge concept to link mastery evidence.
          </span>
        )}
      </div>
    </div>
  );
}
