import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useFitness } from "./store";
import type { ExercisePrescription } from "./types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ExRow = { name: string; sets: string; reps: string };
const emptyEx = (): ExRow => ({ name: "", sets: "3", reps: "" });

export function TrainingPlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const fit = useFitness();
  const plan = fit.getPlan(planId ?? "");

  const [addOpen, setAddOpen] = useState(false);
  const [sTitle, setSTitle] = useState("");
  const [sDay, setSDay] = useState(0);
  const [sEx, setSEx] = useState<ExRow[]>([emptyEx()]);
  const [sErr, setSErr] = useState<string | null>(null);

  if (!plan) {
    return (
      <div className="space-y-3">
        <Link to="/fitness" className="text-text-muted text-xs hover:text-text-secondary">
          ← Fitness
        </Link>
        <p className="text-text-muted text-sm">Training plan not found.</p>
      </div>
    );
  }

  const sessions = fit.getPlannedSessionsForPlan(plan.id);
  const workouts = fit.getWorkoutsForPlan(plan.id);

  const toExercises = (rows: ExRow[]): ExercisePrescription[] =>
    rows
      .filter((r) => r.name.trim() !== "")
      .map((r) => ({ name: r.name, sets: Number(r.sets) || 0, reps: r.reps }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/fitness" className="text-text-muted text-xs hover:text-text-secondary">
            ← Fitness
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">
            {plan.title}
            {plan.archived && (
              <span className="ml-2">
                <Badge>archived</Badge>
              </span>
            )}
          </h2>
          <p className="text-text-muted text-sm">
            Week {plan.currentWeek} of {plan.totalWeeks} · {plan.daysPerWeek} days/week — this is the
            BASE PLAN.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={fit.saveState} />
          <Badge tone={plan.status === "active" ? "success" : "neutral"}>{plan.status}</Badge>
          <button
            onClick={() => navigate(`/fitness/plans/${plan.id}/edit`)}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Edit Plan
          </button>
          <button
            onClick={() => fit.archivePlan(plan.id, !plan.archived)}
            className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-text-secondary"
          >
            {plan.archived ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>

      {/* ---- Planned (base) sessions ---- */}
      <Card
        title="Planned Sessions (the prescription)"
        action={
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="px-2.5 py-1 rounded-md bg-action-primary text-text-inverse text-[11px] font-medium"
          >
            {addOpen ? "Close" : "Add Session"}
          </button>
        }
      >
        {addOpen && (
          <form
            className="mb-4 border border-border-subtle rounded-md p-3 space-y-2"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fit.createPlannedSession(plan.id, {
                title: sTitle,
                dayOfWeek: sDay,
                exercises: toExercises(sEx),
              });
              if (res.ok) {
                setAddOpen(false);
                setSTitle("");
                setSDay(0);
                setSEx([emptyEx()]);
                setSErr(null);
              } else {
                setSErr(res.errors._ ?? Object.values(res.errors)[0] ?? "Invalid session.");
              }
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <label className="text-text-secondary text-xs">
                Session title
                <input
                  value={sTitle}
                  onChange={(e) => setSTitle(e.target.value)}
                  aria-label="Session title"
                  placeholder="e.g. Upper Body"
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
              </label>
              <label className="text-text-secondary text-xs">
                Day
                <select
                  value={sDay}
                  onChange={(e) => setSDay(Number(e.target.value))}
                  aria-label="Day of week"
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-1">
              <div className="text-text-secondary text-xs">Exercises</div>
              {sEx.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_1fr_auto] gap-2 items-center">
                  <input
                    value={row.name}
                    onChange={(e) =>
                      setSEx((p) => p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                    aria-label={`Exercise ${i + 1} name`}
                    placeholder="Push-ups"
                    className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  />
                  <input
                    value={row.sets}
                    onChange={(e) =>
                      setSEx((p) => p.map((r, j) => (j === i ? { ...r, sets: e.target.value } : r)))
                    }
                    aria-label={`Exercise ${i + 1} sets`}
                    type="number"
                    className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  />
                  <input
                    value={row.reps}
                    onChange={(e) =>
                      setSEx((p) => p.map((r, j) => (j === i ? { ...r, reps: e.target.value } : r)))
                    }
                    aria-label={`Exercise ${i + 1} target`}
                    placeholder="8-12 / 2.5 km"
                    className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  />
                  <button
                    type="button"
                    onClick={() => setSEx((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))}
                    className="text-text-muted text-[11px] hover:text-status-danger"
                    aria-label={`Remove exercise ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSEx((p) => [...p, emptyEx()])}
                className="text-text-secondary text-[11px] underline hover:text-text-primary"
              >
                + Add exercise
              </button>
            </div>
            {sErr && <p className="text-status-danger text-[11px]">{sErr}</p>}
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
            >
              Add Session
            </button>
          </form>
        )}

        {sessions.length === 0 && !addOpen ? (
          <div className="text-text-muted text-xs">No sessions in this plan yet.</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="py-2 border-b border-border-subtle last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div className="text-text-primary text-sm">
                    {DAYS[s.dayOfWeek]} · {s.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        fit.startWorkout({ plannedSessionId: s.id, title: s.title }).then((r) => {
                          if (r.ok) navigate(`/fitness/workout/${r.id}`);
                        })
                      }
                      className="px-2.5 py-1 rounded bg-action-primary text-text-inverse text-[11px] font-medium"
                    >
                      Start Workout
                    </button>
                    <button
                      onClick={() => fit.deletePlannedSession(s.id)}
                      className="text-text-muted text-[11px] hover:text-status-danger underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <ul className="text-text-muted text-xs mt-1 space-y-0.5">
                  {s.exercises.map((e, i) => (
                    <li key={i}>
                      {e.name} — {e.sets} × {e.reps}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---- Actual history ---- */}
      <Card title={`Workout History (${workouts.length})`}>
        <p className="text-text-disabled text-[11px] mb-2">
          What you actually did. Separate from the plan above — editing the plan never rewrites these,
          and completing one never rewrites the plan.
        </p>
        {workouts.length === 0 ? (
          <div className="text-text-muted text-xs">No workout history yet.</div>
        ) : (
          <div className="space-y-1">
            {workouts.map((w) => (
              <Link
                key={w.id}
                to={`/fitness/workout/${w.id}`}
                className="flex items-center justify-between py-1.5 hover:bg-surface-inset -mx-2 px-2 rounded-md"
              >
                <span className="text-text-primary text-sm">
                  {w.title} <span className="text-text-muted text-xs">· {w.date}</span>
                </span>
                <Badge tone={w.completed ? "success" : "warning"}>
                  {w.completed ? "done" : "in progress"}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
