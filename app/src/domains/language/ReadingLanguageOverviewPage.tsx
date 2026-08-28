import { useState } from "react";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useLanguage } from "./store";
import { deriveSessionEffects } from "./engine";
import { useKnowledge } from "../knowledge/store";
import { useRoutine } from "../routine/store";
import { deriveCompletionState } from "../routine/engine";

const GERMAN_ROUTINE_ID = "rt-german"; // seeded in domains/routine/mockData.ts — reused, not duplicated
const GERMAN_TOPIC_ID = "topic-german-vocab"; // seeded in domains/knowledge/mockData.ts — reused, not duplicated
const SESSION_TARGET_MINUTES = 30;

export function ReadingLanguageOverviewPage() {
  const { units, getLessonsForUnit, pathProgress, books, getReadingProgress, markLessonCompleted } = useLanguage();
  const { topics, getTopicState } = useKnowledge();
  const { setTodayState, routines } = useRoutine();

  const activeUnit = units.find((u) => u.id === "unit-4")!;
  const lessons = getLessonsForUnit(activeUnit.id);
  const nextLesson = lessons.find((l) => !l.completed);
  const germanTopic = topics.find((t) => t.id === GERMAN_TOPIC_ID);
  const germanRoutine = routines.find((r) => r.id === GERMAN_ROUTINE_ID);

  const [duration, setDuration] = useState(30);
  const [recallScore, setRecallScore] = useState<number | "">("");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const { addEvidence } = useKnowledge();

  const completeSession = () => {
    if (!nextLesson) return;
    const effects = deriveSessionEffects(
      {
        id: `sess-${Date.now()}`,
        lessonId: nextLesson.id,
        date: new Date().toISOString().slice(0, 10),
        durationMinutes: duration,
        recallScore: recallScore === "" ? null : recallScore,
        recallMax: 10,
      },
      SESSION_TARGET_MINUTES
    );

    // Apply each effect to its OWN domain's store — Language never holds a
    // reference to Knowledge or Routine state, per the module boundary.
    if (effects.lessonCompleted) markLessonCompleted(nextLesson.id);
    if (effects.knowledgeEvidence) {
      addEvidence(GERMAN_TOPIC_ID, {
        type: "recall",
        title: `${nextLesson.title} — recall check`,
        score: effects.knowledgeEvidence.score,
        maxScore: effects.knowledgeEvidence.maxScore,
        date: new Date().toISOString().slice(0, 10),
      });
    }
    if (germanRoutine) {
      const state = deriveCompletionState(germanRoutine, effects.routinePracticeMinutes);
      setTodayState(GERMAN_ROUTINE_ID, state);
    }

    setLastResult(
      `Lesson ${effects.lessonCompleted ? "completed" : "not yet complete"} · ` +
        `Knowledge evidence ${effects.knowledgeEvidence ? "added" : "NOT added (no recall check)"} · ` +
        `Routine practice logged: ${effects.routinePracticeMinutes} min`
    );
    setRecallScore("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Reading &amp; Language</h2>
        <p className="text-text-muted text-sm">Build language fluency. Read deeply. Think clearly.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title={`${activeUnit.languageName} — ${activeUnit.pathTitle}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-muted text-xs">Path Progress (mechanical — not mastery)</span>
            <span className="text-text-primary text-lg font-semibold">{pathProgress.percent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-inset overflow-hidden mb-3">
            <div className="h-full bg-action-primary" style={{ width: `${pathProgress.percent}%` }} />
          </div>
          {germanTopic && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Skill state (from Knowledge domain)</span>
              <Badge tone={getTopicState(germanTopic) === "strong" ? "success" : "warning"}>
                {getTopicState(germanTopic)} · {germanTopic.masteryPercent}%
              </Badge>
            </div>
          )}
        </Card>

        <Card title="Currently Reading">
          {books.map((b) => (
            <div key={b.id}>
              <div className="text-text-primary text-sm font-medium">{b.title}</div>
              <div className="text-text-muted text-xs mb-2">
                {b.author} · Page {b.currentPage} / {b.totalPages}
              </div>
              <div className="w-full h-2 rounded-full bg-surface-inset overflow-hidden">
                <div className="h-full bg-action-primary" style={{ width: `${getReadingProgress(b.id)}%` }} />
              </div>
              <div className="text-text-secondary text-xs mt-1">{getReadingProgress(b.id)}% read</div>
            </div>
          ))}
        </Card>
      </div>

      <Card title={`Lessons — ${activeUnit.title}`}>
        <div className="space-y-1">
          {lessons.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
              <span className="text-text-primary text-sm">{l.title}</span>
              <Badge tone={l.completed ? "success" : "neutral"}>{l.completed ? "Completed" : "Pending"}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {nextLesson && (
        <Card title={`Complete Session — ${nextLesson.title}`}>
          <p className="text-text-disabled text-[11px] mb-3">
            Duration always logs Routine practice. A lesson can complete mechanically. Knowledge evidence is
            only added if you record a real recall score below — leaving it blank proves nothing was learned,
            per the locked rule.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="text-text-muted text-xs block mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
              />
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-1">Recall score (optional, out of 10)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={recallScore}
                onChange={(e) => setRecallScore(e.target.value === "" ? "" : parseInt(e.target.value))}
                className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
              />
            </div>
          </div>
          <button
            onClick={completeSession}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Complete Session
          </button>
          {lastResult && <p className="text-text-secondary text-xs mt-3">{lastResult}</p>}
        </Card>
      )}
    </div>
  );
}
