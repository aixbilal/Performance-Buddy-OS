/** Training Plan builder — /fitness/plans/new and /fitness/plans/:planId/edit. */
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { useFitness } from "./store";
import { EMPTY_PLAN_FORM, PlanForm, type PlanFormValues } from "./PlanForm";
import type { PlanInput } from "./types";

export function PlanBuilderPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { getPlan, createPlan, updatePlan, saveState } = useFitness();

  const editing = planId ? getPlan(planId) : undefined;
  const isEdit = Boolean(planId);

  const initial = useMemo<PlanFormValues>(() => {
    if (editing) {
      return {
        title: editing.title,
        status: editing.status,
        currentWeek: String(editing.currentWeek),
        totalWeeks: String(editing.totalWeeks),
        daysPerWeek: String(editing.daysPerWeek),
      };
    }
    return EMPTY_PLAN_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  if (isEdit && !editing) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => navigate("/fitness")}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← Fitness
        </button>
        <p className="text-text-muted text-sm">That plan doesn't exist.</p>
      </div>
    );
  }

  const submit = async (input: PlanInput) => {
    const res = isEdit && planId ? await updatePlan(planId, input) : await createPlan(input);
    if (res.ok) navigate(`/fitness/plans/${res.id}`);
    return res;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button
          onClick={() => navigate(isEdit ? `/fitness/plans/${planId}` : "/fitness")}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← {isEdit ? "Plan" : "Fitness"}
        </button>
        <h2 className="t-h2 text-text-primary mt-1">
          {isEdit ? "Edit Training Plan" : "Create Training Plan"}
        </h2>
        <p className="text-text-muted text-sm">
          This is the BASE PLAN — your intended structure. Recording a workout never changes it.
        </p>
      </div>
      <Card>
        <PlanForm
          initial={initial}
          submitLabel={isEdit ? "Save Plan" : "Create Plan"}
          busy={saveState === "saving"}
          onSubmit={submit}
          onCancel={() => navigate(isEdit ? `/fitness/plans/${planId}` : "/fitness")}
        />
      </Card>
    </div>
  );
}
