import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useFocus } from "./store";
import { useAcademic } from "../academic/store";
import { useKnowledge } from "../knowledge/store";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function FocusPage() {
  const { session, error, history, start, startWith, pause, resume, finish, reset, setNotes, backend } =
    useFocus();
  const { getCourse, topics: academicTopics } = useAcademic();
  const { getTopic } = useKnowledge();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [recallScore, setRecallScore] = useState<number | "">("");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const startedFromParams = useRef(false);

  // If launched from a study surface with context, configure + start once.
  useEffect(() => {
    if (startedFromParams.current) return;
    const topicId = params.get("topicId");
    const academicTopicId = params.get("academicTopicId");
    const courseId = params.get("courseId");
    const title = params.get("title");
    const target = Number(params.get("target"));
    const returnTo = params.get("returnTo");
    if (topicId || academicTopicId || title) {
      startedFromParams.current = true;
      startWith({
        title: title ?? undefined,
        method: params.get("method") ?? "study",
        targetMinutes: Number.isFinite(target) && target > 0 ? target : undefined,
        linkedTopicId: topicId,
        linkedAcademicTopicId: academicTopicId,
        linkedCourseId: courseId,
        returnTo,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetSeconds = session.targetMinutes * 60;
  const percent = Math.min(100, Math.round((session.elapsedSeconds / targetSeconds) * 100));

  const linkedCourse = session.linkedCourseId ? getCourse(session.linkedCourseId) : undefined;
  const linkedAcademicTopic = session.linkedAcademicTopicId
    ? academicTopics.find((t) => t.id === session.linkedAcademicTopicId)
    : undefined;
  const linkedKnowledge = session.linkedTopicId ? getTopic(session.linkedTopicId) : undefined;

  const handleFinish = async () => {
    const hasScore = recallScore !== "";
    const res = await finish(hasScore ? { score: recallScore as number, maxScore: 10 } : undefined);
    setLastResult(
      hasScore && res?.evidenceAdded
        ? `Session complete — ${res.durationMinutes} min logged, and a recall check was recorded as Knowledge evidence.`
        : hasScore
          ? `Session complete — ${res?.durationMinutes ?? 0} min logged. Recall score noted, but no linked Knowledge concept to record evidence against.`
          : `Session complete — ${res?.durationMinutes ?? 0} min of activity logged. NO mastery evidence added (no recall check was done).`,
    );
    setRecallScore("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Focus Mode</h2>
          <p className="text-text-muted text-sm">
            Targeted, uninterrupted execution — not a generic timer, not the study engine. Time logged is
            activity, never mastery.
          </p>
        </div>
        {session.returnTo && (
          <button
            onClick={() => navigate(session.returnTo as string)}
            className="px-3 py-1 rounded-md border border-border-subtle text-text-secondary text-xs hover:bg-surface-inset"
          >
            Back to study
          </button>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-primary text-sm font-medium">{session.title}</span>
          <Badge
            tone={
              session.status === "active"
                ? "success"
                : session.status === "paused"
                  ? "warning"
                  : "neutral"
            }
          >
            {session.status}
          </Badge>
        </div>

        {(linkedCourse || linkedAcademicTopic || linkedKnowledge) && (
          <div className="text-text-muted text-xs mb-3">
            Context:{" "}
            {[
              linkedCourse?.title,
              linkedAcademicTopic?.title,
              linkedKnowledge && `Knowledge: ${linkedKnowledge.title}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        <div className="text-center mb-4">
          <div className="text-text-primary text-5xl font-semibold tabular-nums">
            {formatTime(session.elapsedSeconds)}
          </div>
          <div className="text-text-muted text-xs mt-1">
            {percent}% of {session.targetMinutes}:00 target
          </div>
        </div>

        <div className="w-full h-1.5 rounded-full bg-surface-inset overflow-hidden mb-4">
          <div className="h-full bg-action-primary transition-all" style={{ width: `${percent}%` }} />
        </div>

        {error && <p className="text-status-danger text-xs mb-3">{error}</p>}

        <div className="flex gap-2 justify-center mb-4">
          {session.status === "idle" && (
            <button
              onClick={start}
              className="px-4 py-2 rounded-md bg-action-primary text-text-inverse text-sm font-medium"
            >
              Start
            </button>
          )}
          {session.status === "active" && (
            <>
              <button
                onClick={pause}
                className="px-4 py-2 rounded-md bg-action-secondary text-text-primary text-sm font-medium"
              >
                Pause
              </button>
              <button
                onClick={handleFinish}
                className="px-4 py-2 rounded-md bg-status-success/20 text-status-success text-sm font-medium"
              >
                Finish
              </button>
            </>
          )}
          {session.status === "paused" && (
            <>
              <button
                onClick={resume}
                className="px-4 py-2 rounded-md bg-action-primary text-text-inverse text-sm font-medium"
              >
                Resume
              </button>
              <button
                onClick={handleFinish}
                className="px-4 py-2 rounded-md bg-status-success/20 text-status-success text-sm font-medium"
              >
                Finish
              </button>
            </>
          )}
          {session.status === "completed" && (
            <button
              onClick={() => {
                reset();
                setLastResult(null);
              }}
              className="px-4 py-2 rounded-md bg-action-secondary text-text-primary text-sm font-medium"
            >
              Start another
            </button>
          )}
        </div>

        {(session.status === "active" || session.status === "paused") && (
          <div className="bg-surface-inset border border-border-subtle rounded-md p-3">
            <label htmlFor="focus-recall" className="text-text-muted text-xs block mb-1">
              Optional recall check before finishing (out of 10) — leave blank to log time only, no mastery claim
            </label>
            <input
              id="focus-recall"
              type="number"
              min={0}
              max={10}
              value={recallScore}
              onChange={(e) => setRecallScore(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="w-24 bg-surface-raised border border-border-subtle rounded-md px-2 py-1 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </div>
        )}

        {session.status === "completed" && lastResult && (
          <p className="text-text-secondary text-xs text-center">{lastResult}</p>
        )}
      </Card>

      <Card title="Quick Note">
        <label htmlFor="focus-notes" className="sr-only">
          Session notes
        </label>
        <textarea
          id="focus-notes"
          value={session.notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for this session…"
          className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm h-20 outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        />
      </Card>

      <Card title={`Recent Sessions (${history.length})`}>
        {history.length === 0 ? (
          <EmptyState
            icon="⏱"
            title="No sessions yet"
            description="Finished Focus sessions appear here — duration and method, never a mastery score."
          />
        ) : (
          <ul className="space-y-1">
            {history.slice(0, 10).map((r) => {
              const kt = r.knowledgeTopicId ? getTopic(r.knowledgeTopicId) : undefined;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm"
                >
                  <span className="text-text-primary truncate">
                    {r.title}
                    {kt && <span className="text-text-muted"> · {kt.title}</span>}
                  </span>
                  <span className="text-text-muted text-xs shrink-0">
                    {r.durationMinutes} min
                    {r.recallScore != null
                      ? ` · recall ${r.recallScore}/${r.recallMax}`
                      : " · activity only"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-text-disabled text-[10px] mt-2">Stored durably ({backend}).</p>
      </Card>
    </div>
  );
}
