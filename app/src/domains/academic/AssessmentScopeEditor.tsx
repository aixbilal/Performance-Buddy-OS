/**
 * Assessment ↔ Topic scope editor (V2 Phase E).
 *
 * Explicit scope only — the checklist offers ONLY topics that belong to this
 * assessment's own course (the store + Rust both reject a cross-course topic).
 * An empty scope means "unknown", never "no topics" — the study engine reads it
 * that way. Collapsed by default so it does not add visual noise.
 */
import { useState } from "react";
import { useAcademic } from "./store";

export function AssessmentScopeEditor({
  courseId,
  assessmentId,
}: {
  courseId: string;
  assessmentId: string;
}) {
  const academic = useAcademic();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courseTopics = academic.getTopicsForCourse(courseId);
  const scoped = new Set(academic.getAssessmentScopeTopicIds(assessmentId));

  const toggle = async (topicId: string) => {
    setError(null);
    if (scoped.has(topicId)) {
      await academic.removeAssessmentScopeTopic(assessmentId, topicId);
      return;
    }
    const res = await academic.addAssessmentScopeTopic(assessmentId, topicId);
    if (!res.ok) setError(Object.values(res.errors)[0] ?? "Could not update scope.");
  };

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="t-caption text-text-muted hover:text-text-secondary underline"
      >
        Scope:{" "}
        {scoped.size === 0 ? "not set" : `${scoped.size} topic${scoped.size === 1 ? "" : "s"}`}
        {" · "}
        {open ? "hide" : "edit"}
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border-subtle bg-surface-inset p-2">
          {courseTopics.length === 0 ? (
            <p className="t-caption text-text-muted">
              This course has no topics yet — add topics before setting an assessment's scope.
            </p>
          ) : (
            <ul className="space-y-1">
              {courseTopics.map((t) => (
                <li key={t.id}>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={scoped.has(t.id)}
                      onChange={() => void toggle(t.id)}
                    />
                    {t.title}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="t-caption text-status-danger mt-1">{error}</p>}
          <p className="t-caption text-text-muted mt-1.5">
            Only topics explicitly checked here count as on this assessment. Nothing is assumed.
          </p>
        </div>
      )}
    </div>
  );
}
