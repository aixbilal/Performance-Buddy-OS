import { useFocus } from "./store";

/**
 * §19 reference adoption of the App Shell context rail.
 *
 * Focus is the quietest execution surface, so its rail stays a small honest
 * digest — today's finished focus time and the active session's method/target.
 * It never repeats the running timer (that is the page's job) and never shows a
 * mastery number (Focus time is not mastery).
 */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function FocusContextRail() {
  const { session, history } = useFocus();

  const today = history.filter((r) => isToday(r.completedAt ?? r.createdAt));
  const todayMinutes = today.reduce((sum, r) => sum + r.durationMinutes, 0);

  return (
    <>
      <div>
        <div className="t-label uppercase text-text-muted mb-1">Today</div>
        <div className="t-metric-md text-text-primary">
          {todayMinutes}
          <span className="t-small text-text-muted"> min focused</span>
        </div>
        <div className="t-small text-text-muted mt-0.5">
          {today.length} finished session{today.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <div className="t-label uppercase text-text-muted mb-1">This session</div>
        {session.status === "idle" ? (
          <p className="t-small text-text-muted">Not started.</p>
        ) : (
          <dl className="space-y-1.5 t-small">
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Method</dt>
              <dd className="text-text-secondary capitalize truncate">
                {session.method || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Target</dt>
              <dd className="text-text-secondary">
                {session.targetMinutes ? `${session.targetMinutes} min` : "—"}
              </dd>
            </div>
            {session.title && (
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">On</dt>
                <dd className="text-text-secondary truncate">{session.title}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </>
  );
}
