import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { usePerformance } from "../performance/store";
import { useRoutine } from "./store";
import { RoutineCheckIn, CHECK_IN_STATE_LABEL } from "./RoutineCheckIn";
import type { CompletionState } from "./types";

const COMPLETION_LABEL: Record<string, string> = {
  boolean: "done / not done",
  quantity: "an amount",
  duration: "minutes",
};

export function RoutineDetailPage() {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const rt = useRoutine();
  const { systems } = usePerformance();
  const routine = rt.getRoutine(routineId ?? "");

  if (!routine) {
    return (
      <div className="space-y-3">
        <Link to="/routine" className="text-text-muted text-xs hover:text-text-secondary">
          ← Routines
        </Link>
        <p className="text-text-muted text-sm">Routine not found.</p>
      </div>
    );
  }

  const today = rt.getRoutineTodayState(routine.id);
  const consistency = rt.getRoutineConsistency(routine.id);
  const history = rt.getRoutineHistory(routine.id, 30);
  const linkedSystem = routine.relatedSystemId
    ? systems.find((s) => s.id === routine.relatedSystemId)
    : undefined;

  const pick = (state: CompletionState) => rt.setTodayState(routine.id, state);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/routine" className="text-text-muted text-xs hover:text-text-secondary">
            ← Routines
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">
            {routine.title}
            {routine.paused && (
              <span className="ml-2">
                <Badge>paused</Badge>
              </span>
            )}
            {routine.archived && (
              <span className="ml-2">
                <Badge>archived</Badge>
              </span>
            )}
          </h2>
          <p className="text-text-muted text-sm">
            {routine.category || "Uncategorised"} · {routine.timeWindow} · {rt.scheduleLabel(routine)} ·
            completion by {COMPLETION_LABEL[routine.completionType]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={rt.saveState} />
          <button
            onClick={() => navigate(`/routine/${routine.id}/edit`)}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => rt.pauseRoutine(routine.id, !routine.paused)}
            className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-text-secondary"
          >
            {routine.paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => rt.archiveRoutine(routine.id, !routine.archived)}
            className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-text-secondary"
          >
            {routine.archived ? "Unarchive" : "Archive"}
          </button>
          <button
            onClick={() => {
              rt.deleteRoutine(routine.id);
              navigate("/routine");
            }}
            className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-status-danger"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Today">
          {today.scheduledToday ? (
            <div className="space-y-2">
              <div className="text-text-muted text-xs">
                {today.logged ? "Recorded as" : "Scheduled — not recorded yet"}
              </div>
              <RoutineCheckIn routineTitle={routine.title} current={today.state} onPick={pick} />
            </div>
          ) : (
            <div className="text-text-muted text-xs">
              Not scheduled today ({rt.scheduleLabel(routine)}). This is not a miss.
            </div>
          )}
        </Card>

        <Card title="Consistency">
          {consistency.percent === null ? (
            <div className="text-text-muted text-xs">
              No history yet — consistency appears once there is a completed opportunity. This is
              not 0%.
            </div>
          ) : (
            <>
              <div className="text-text-primary text-lg font-semibold">{consistency.percent}%</div>
              <p className="text-text-disabled text-[11px] mt-1">
                {consistency.completed} of {consistency.expected} scheduled opportunities in the last{" "}
                {consistency.windowDays} days
                {consistency.excused > 0 ? ` · ${consistency.excused} rest/skipped excused` : ""}. No
                streak — a single miss doesn't reset it.
              </p>
            </>
          )}
        </Card>
      </div>

      <Card title="Related System">
        {linkedSystem ? (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to={`/systems/${linkedSystem.id}`}
                className="text-text-primary hover:text-text-secondary underline"
              >
                {linkedSystem.title}
              </Link>
              <p className="text-text-disabled text-[11px] mt-0.5">
                A reference only. The routine keeps its own identity, history and completion.
              </p>
            </div>
            <button
              onClick={() => rt.unlinkRoutineFromSystem(routine.id)}
              className="text-text-muted text-[11px] hover:text-text-secondary underline"
            >
              Unlink
            </button>
          </div>
        ) : routine.relatedSystemId ? (
          <div className="text-text-muted text-xs">
            Linked system no longer exists — the link was cleared. The routine is unaffected.
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="rtn-link-system">
              Link a System to {routine.title}
            </label>
            <select
              id="rtn-link-system"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) rt.linkRoutineToSystem(routine.id, e.target.value);
              }}
              className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <option value="">Link a System…</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <span className="text-text-disabled text-[11px]">Optional — no Goal required.</span>
          </div>
        )}
      </Card>

      <Card title={`History (${history.length})`}>
        {history.length === 0 ? (
          <div className="text-text-muted text-xs">No check-ins recorded yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted text-left">
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 font-medium">State</th>
                <th className="py-1 font-medium">Recorded</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {history.map((l) => (
                <tr key={l.id} className="border-t border-border-subtle">
                  <td className="py-1.5 text-text-primary">{l.date}</td>
                  <td className="py-1.5">
                    <Badge
                      tone={
                        l.state === "complete"
                          ? "success"
                          : l.state === "partial"
                            ? "warning"
                            : l.state === "missed"
                              ? "danger"
                              : "neutral"
                      }
                    >
                      {CHECK_IN_STATE_LABEL[l.state]}
                    </Badge>
                  </td>
                  <td className="py-1.5 text-text-muted">
                    {l.quantityCompleted !== null
                      ? `${l.quantityCompleted} ${routine.targetUnit ?? ""}`.trim()
                      : l.durationCompletedMinutes !== null
                        ? `${l.durationCompletedMinutes} min`
                        : "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => rt.deleteCheckIn(l.id)}
                      aria-label={`Delete check-in for ${l.date}`}
                      className="text-text-muted text-[11px] hover:text-status-danger underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
