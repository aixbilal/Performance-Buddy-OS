import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useAcademic } from "./store";
import { useKnowledge } from "../knowledge/store";
import { useSettings } from "../settings/store";
import { useFocus } from "../focus/store";
import { useMastery } from "./masteryStore";
import { isReviewDue } from "../knowledge/engine";
import {
  STUDY_REASON_LABEL,
  selectStudyTargets,
  type StudyMode,
  type StudyTopicInput,
} from "./studyEngine";
import type { OperatingMode } from "../settings/types";
import { Button } from "../../components/Button";

const MODE_TABS: { key: StudyMode; label: string; hint: string; operating: OperatingMode }[] = [
  { key: "normal", label: "Normal", hint: "Balanced progression and review.", operating: "normal" },
  { key: "exam", label: "Exam", hint: "Prioritise covered-but-not-nailed topics.", operating: "midterm" },
  { key: "recovery", label: "Recovery", hint: "Smallest useful restart — weak topics only.", operating: "recovery" },
];

function toStudyMode(m: OperatingMode): StudyMode {
  if (m === "recovery") return "recovery";
  if (m === "midterm" || m === "final") return "exam";
  return "normal";
}

const COVERAGE_LABEL: Record<string, string> = {
  "not-taught": "Not taught",
  "in-progress": "In progress",
  taught: "Taught",
};

export function NormalStudyPage() {
  const navigate = useNavigate();
  const { courses, topics, getCourse, setPersonalStudyCoverage, loaded } = useAcademic();
  const { getTopic } = useKnowledge();
  const { mode, setMode } = useSettings();
  const { startWith, getSessionsForAcademicTopic } = useFocus();
  const { startCheck, getChecksForAcademicTopic } = useMastery();

  const studyMode = toStudyMode(mode);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [studyPct, setStudyPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const activeCourses = useMemo(() => courses.filter((c) => !c.archived), [courses]);
  const activeCourseIds = useMemo(() => new Set(activeCourses.map((c) => c.id)), [activeCourses]);

  const inputs: StudyTopicInput[] = useMemo(() => {
    return topics
      .filter((t) => activeCourseIds.has(t.courseId))
      .map((t) => {
        const kt = t.knowledgeTopicId ? getTopic(t.knowledgeTopicId) : undefined;
        return {
          academicTopicId: t.id,
          courseId: t.courseId,
          courseTitle: getCourse(t.courseId)?.title ?? "Course",
          topicTitle: t.title,
          professorCoverage: t.professorCoverage,
          personalStudyPercent: t.personalStudyPercent,
          knowledgeTopicId: t.knowledgeTopicId,
          knowledge: kt
            ? {
                state: kt.state,
                hasEvidence: kt.hasEvidence,
                reviewDue: isReviewDue(kt.nextReviewDate),
              }
            : null,
        };
      });
  }, [topics, activeCourseIds, getCourse, getTopic]);

  const targets = useMemo(() => selectStudyTargets(inputs, studyMode), [inputs, studyMode]);

  const selected = selectedId ? inputs.find((t) => t.academicTopicId === selectedId) ?? null : null;
  const selectedAcademicTopic = selected ? topics.find((t) => t.id === selected.academicTopicId) : undefined;
  const lastFocus = selected ? getSessionsForAcademicTopic(selected.academicTopicId)[0] : undefined;
  const lastCheck = selected ? getChecksForAcademicTopic(selected.academicTopicId)[0] : undefined;

  const startFocus = () => {
    if (!selected) return;
    startWith({
      title: `Study: ${selected.topicTitle}`,
      method: "university-study",
      targetMinutes: 25,
      linkedAcademicTopicId: selected.academicTopicId,
      linkedCourseId: selected.courseId,
      linkedTopicId: selected.knowledgeTopicId,
      returnTo: "/academics/study",
    });
    navigate("/focus");
  };

  const startMastery = async () => {
    if (!selected) return;
    const id = await startCheck({
      academicTopicId: selected.academicTopicId,
      knowledgeTopicId: selected.knowledgeTopicId,
      courseId: selected.courseId,
      topicTitle: selected.topicTitle,
    });
    navigate(`/academics/mastery/${id}`);
  };

  const markStudied = async () => {
    if (!selected || studyPct == null) return;
    setMsg(null);
    const res = await setPersonalStudyCoverage(selected.academicTopicId, studyPct);
    setMsg(res.ok ? `Marked ${studyPct}% personally studied. Professor coverage and mastery are unchanged.` : "Could not save.");
    setStudyPct(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="t-h2 text-text-primary">Normal Study</h2>
          <p className="text-text-muted text-sm">
            What to study, why, and what happens next — from real coverage and Knowledge state, never a guess.
          </p>
        </div>
        <button
          onClick={() => navigate("/academics")}
          className="px-3 py-1 rounded-md border border-border-subtle text-text-secondary text-xs hover:bg-surface-inset"
        >
          Back to Academics
        </button>
      </div>

      {/* mode selector — reuses the canonical operating mode, changed explicitly */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Study mode">
        {MODE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setMode(t.operating)}
            aria-pressed={studyMode === t.key}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
              studyMode === t.key
                ? "bg-surface-selected text-text-primary border-border-focus"
                : "border-border-subtle text-text-secondary hover:bg-surface-inset"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="text-text-muted text-[11px] self-center">
          {MODE_TABS.find((t) => t.key === studyMode)?.hint} Mode changes ordering only — no course, topic or evidence
          data is touched.
        </span>
      </div>

      {loaded && activeCourses.length === 0 ? (
        <Card>
          <EmptyState
            icon="🎓"
            title="No courses yet"
            description="Add a course and some topics first — study targets come from real academic data."
            primaryAction={{ label: "Add a course", onClick: () => navigate("/academics/new") }}
          />
        </Card>
      ) : loaded && inputs.length === 0 ? (
        <Card>
          <EmptyState
            icon="📚"
            title="No topics to study"
            description="Your active courses have no topics yet. Add topics on a course to see study targets here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card title={`Study targets (${targets.length})`} className="col-span-2">
            {targets.length === 0 ? (
              <p className="text-text-muted text-xs">
                {studyMode === "recovery"
                  ? "Nothing flagged for a recovery restart right now — every topic is either fresh or already solid."
                  : "No topics need attention in this mode."}
              </p>
            ) : (
              <ul className="space-y-1">
                {targets.map((t) => (
                  <li key={t.academicTopicId}>
                    <button
                      onClick={() => {
                        setSelectedId(t.academicTopicId);
                        setMsg(null);
                        setStudyPct(null);
                      }}
                      aria-label={`Study ${t.topicTitle} (${t.courseTitle})`}
                      className={`w-full text-left rounded-md px-3 py-2 border text-sm ${
                        selectedId === t.academicTopicId
                          ? "border-border-focus bg-surface-inset"
                          : "border-border-subtle hover:bg-surface-inset"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-text-primary">{t.topicTitle}</span>
                        <span className="text-text-muted text-xs">{t.courseTitle}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.reasons.map((r) => (
                          <span
                            key={r}
                            className="text-[10px] rounded-sm bg-surface-overlay border border-border-subtle px-1.5 py-0.5 text-text-secondary"
                          >
                            {STUDY_REASON_LABEL[r]}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Selected topic">
            {!selected ? (
              <p className="text-text-muted text-xs">Pick a topic to see its state and start studying.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-text-primary font-medium">{selected.topicTitle}</div>
                  <div className="text-text-muted text-xs">{selected.courseTitle}</div>
                </div>

                <div className="text-xs space-y-1">
                  <div className="text-text-secondary">
                    Professor coverage: <b>{COVERAGE_LABEL[selected.professorCoverage]}</b>
                  </div>
                  <div className="text-text-secondary">
                    Personal study: <b>{selected.personalStudyPercent}%</b>
                  </div>
                  <div className="text-text-secondary">
                    Knowledge:{" "}
                    {selected.knowledge ? (
                      <>
                        <Badge tone={selected.knowledge.state === "strong" ? "success" : "neutral"}>
                          {selected.knowledge.hasEvidence ? selected.knowledge.state : "no evidence yet"}
                        </Badge>
                        {selected.knowledge.reviewDue && <Badge tone="warning">review due</Badge>}
                      </>
                    ) : (
                      <span className="text-text-muted">not linked to a Knowledge concept</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button variant="primary" onClick={startFocus}>
                    Start Focus
                  </Button>
                  <button
                    onClick={startMastery}
                    className="px-3 py-1.5 rounded-md border border-border-subtle text-text-secondary text-xs font-medium hover:bg-surface-inset"
                  >
                    Start Mastery Check
                  </button>
                </div>

                <div className="border-t border-border-subtle pt-2">
                  <div className="text-text-muted text-[11px] mb-1">Mark personally studied (explicit — not from a timer)</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[0, 25, 50, 75, 100].map((p) => (
                      <button
                        key={p}
                        onClick={() => setStudyPct(p)}
                        aria-pressed={studyPct === p}
                        className={`px-2 py-1 rounded-md text-[11px] border ${
                          studyPct === p
                            ? "border-border-focus bg-surface-selected text-text-primary"
                            : "border-border-subtle text-text-secondary"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                    <button
                      onClick={markStudied}
                      disabled={studyPct == null}
                      className="px-2 py-1 rounded-md bg-action-primary text-text-inverse text-[11px] disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                  {msg && <p className="text-text-secondary text-[11px] mt-1" role="status">{msg}</p>}
                </div>

                <div className="border-t border-border-subtle pt-2 text-[11px] text-text-muted space-y-0.5">
                  <div>
                    Last Focus:{" "}
                    {lastFocus
                      ? `${lastFocus.durationMinutes} min${lastFocus.recallScore != null ? ` · recall ${lastFocus.recallScore}/${lastFocus.recallMax}` : " · activity only"}`
                      : "none yet"}
                  </div>
                  <div>
                    Last Mastery Check:{" "}
                    {lastCheck ? (
                      <button className="underline" onClick={() => navigate(`/academics/mastery/${lastCheck.id}`)}>
                        {lastCheck.status === "completed"
                          ? `${lastCheck.score}/${lastCheck.maxScore}`
                          : "in progress"}
                      </button>
                    ) : (
                      "none yet"
                    )}
                  </div>
                  {selectedAcademicTopic && !selectedAcademicTopic.knowledgeTopicId && (
                    <div className="text-text-muted">
                      Link a Knowledge concept on the course page to record mastery evidence.
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
