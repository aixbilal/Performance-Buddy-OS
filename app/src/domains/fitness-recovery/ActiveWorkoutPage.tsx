import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useFitness } from "./store";
import type { ExerciseActual } from "./types";

export function ActiveWorkoutPage() {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const fit = useFitness();
  const workout = fit.workoutSessions.find((w) => w.id === workoutId);

  const planned = workout?.plannedSessionId
    ? fit.sessions.find((s) => s.id === workout.plannedSessionId)
    : undefined;

  const [rows, setRows] = useState<ExerciseActual[]>(workout?.exercisesPerformed ?? []);
  const [notes, setNotes] = useState(workout?.notes ?? "");

  // Keep local rows in sync if the workout loads after first render.
  useEffect(() => {
    if (workout) {
      setRows(workout.exercisesPerformed);
      setNotes(workout.notes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, workout?.id]);

  if (!workout) {
    return (
      <div className="space-y-3">
        <Link to="/fitness" className="text-text-muted text-xs hover:text-text-secondary">
          ← Fitness
        </Link>
        <p className="text-text-muted text-sm">Workout not found.</p>
      </div>
    );
  }

  const save = () => fit.recordWorkout(workout.id, { exercisesPerformed: rows, notes });
  const prescriptionFor = (name: string) =>
    planned?.exercises.find((e) => e.name === name);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/fitness" className="text-text-muted text-xs hover:text-text-secondary">
            ← Fitness
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">{workout.title}</h2>
          <p className="text-text-muted text-sm">
            {workout.date} · recording the ACTUAL session
            {planned && " (started from the plan — the plan is not changed)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={fit.saveState} />
          <Badge tone={workout.completed ? "success" : "warning"}>
            {workout.completed ? "completed" : "in progress"}
          </Badge>
        </div>
      </div>

      <Card title="Exercise Results (actual)">
        {rows.length === 0 ? (
          <p className="text-text-muted text-xs mb-2">
            This workout had no planned exercises — add what you did.
          </p>
        ) : null}
        <div className="space-y-2">
          {rows.map((r, i) => {
            const rx = prescriptionFor(r.name);
            return (
              <div key={i} className="grid grid-cols-[1fr_80px_1fr_auto] gap-2 items-center">
                <input
                  value={r.name}
                  onChange={(e) =>
                    setRows((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  aria-label={`Result ${i + 1} exercise`}
                  className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
                <input
                  type="number"
                  value={r.setsCompleted}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((x, j) =>
                        j === i ? { ...x, setsCompleted: Number(e.target.value) || 0 } : x,
                      ),
                    )
                  }
                  aria-label={`${r.name || `Result ${i + 1}`} sets completed`}
                  className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
                <input
                  value={r.repsCompleted}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((x, j) => (j === i ? { ...x, repsCompleted: e.target.value } : x)),
                    )
                  }
                  aria-label={`${r.name || `Result ${i + 1}`} reps completed`}
                  placeholder="15,14,11"
                  className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
                <span className="text-text-disabled text-[10px]">
                  {rx ? `plan: ${rx.sets}×${rx.reps}` : ""}
                </span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            setRows((p) => [...p, { name: "", setsCompleted: 0, repsCompleted: "" }])
          }
          className="text-text-secondary text-[11px] underline hover:text-text-primary mt-2"
        >
          + Add exercise
        </button>

        <label className="block text-text-secondary text-xs mt-3">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label="Workout notes"
            rows={2}
            className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
        </label>

        <div className="flex gap-2 mt-3">
          <button
            onClick={save}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Save Progress
          </button>
          {!workout.completed && (
            <button
              onClick={async () => {
                await save();
                await fit.completeWorkout(workout.id);
              }}
              className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
            >
              Complete Workout
            </button>
          )}
          <button
            onClick={async () => {
              await fit.deleteWorkout(workout.id);
              navigate("/fitness");
            }}
            className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-status-danger"
          >
            Abandon
          </button>
        </div>
      </Card>

      {planned && (
        <Card title="Plan prescription (unchanged)">
          <ul className="text-text-muted text-xs space-y-0.5">
            {planned.exercises.map((e, i) => (
              <li key={i}>
                {e.name} — {e.sets} × {e.reps}
              </li>
            ))}
          </ul>
          <Link
            to={`/fitness/plans/${planned.planId}`}
            className="text-text-secondary text-[11px] underline hover:text-text-primary mt-2 inline-block"
          >
            Open the plan
          </Link>
        </Card>
      )}
    </div>
  );
}
