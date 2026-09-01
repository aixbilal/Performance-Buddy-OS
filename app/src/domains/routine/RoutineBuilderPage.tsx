/** Routine builder — /routine/new and /routine/:routineId/edit. */
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { usePerformance } from "../performance/store";
import { useRoutine } from "./store";
import { EMPTY_ROUTINE_FORM, RoutineForm, type RoutineFormValues } from "./RoutineForm";
import type { RoutineInput } from "./types";

export function RoutineBuilderPage() {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { getRoutine, createRoutine, updateRoutine, saveState } = useRoutine();
  const { systems } = usePerformance();

  const editing = routineId ? getRoutine(routineId) : undefined;
  const isEdit = Boolean(routineId);

  const initial = useMemo<RoutineFormValues>(() => {
    if (editing) {
      return {
        title: editing.title,
        category: editing.category,
        timeWindow: editing.timeWindow,
        scheduleType: editing.scheduleType,
        scheduleDays: editing.scheduleDays,
        timesPerWeek: editing.scheduleTarget !== null ? String(editing.scheduleTarget) : "3",
        completionType: editing.completionType,
        targetQuantity: editing.targetQuantity !== null ? String(editing.targetQuantity) : "",
        targetUnit: editing.targetUnit ?? "",
        targetDurationMinutes:
          editing.targetDurationMinutes !== null ? String(editing.targetDurationMinutes) : "",
        priority: editing.priority,
        relatedSystemId: editing.relatedSystemId ?? "",
      };
    }
    return EMPTY_ROUTINE_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId]);

  if (isEdit && !editing) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => navigate("/routine")}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← Routines
        </button>
        <p className="text-text-muted text-sm">That routine doesn't exist.</p>
      </div>
    );
  }

  const submit = async (input: RoutineInput) => {
    const res =
      isEdit && routineId ? await updateRoutine(routineId, input) : await createRoutine(input);
    if (res.ok) navigate(`/routine/${res.id}`);
    return res;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button
          onClick={() => navigate(isEdit ? `/routine/${routineId}` : "/routine")}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← {isEdit ? "Routine" : "Routines"}
        </button>
        <h2 className="t-h2 text-text-primary mt-1">
          {isEdit ? "Edit Routine" : "New Routine"}
        </h2>
        <p className="text-text-muted text-sm">
          A repeatable personal behavior. It can exist on its own — no Goal required.
        </p>
      </div>
      <Card>
        <RoutineForm
          initial={initial}
          submitLabel={isEdit ? "Save Routine" : "Create Routine"}
          systems={systems}
          busy={saveState === "saving"}
          onSubmit={submit}
          onCancel={() => navigate(isEdit ? `/routine/${routineId}` : "/routine")}
        />
      </Card>
    </div>
  );
}
