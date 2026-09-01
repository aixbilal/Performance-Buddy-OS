/** The ONE Training Plan form — /fitness/plans/new + /:planId/edit. */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import { TRAINING_PLAN_STATUSES, type PlanInput, type TrainingPlanStatus } from "./types";
import { FormActions } from "../../components/FormActions";

export type PlanFormValues = {
  title: string;
  status: TrainingPlanStatus;
  currentWeek: string;
  totalWeeks: string;
  daysPerWeek: string;
};

export const EMPTY_PLAN_FORM: PlanFormValues = {
  title: "",
  status: "active",
  currentWeek: "1",
  totalWeeks: "8",
  daysPerWeek: "3",
};

export function valuesToInput(v: PlanFormValues): PlanInput {
  const n = (s: string) => (s.trim() === "" ? NaN : Number(s));
  return {
    title: v.title,
    status: v.status,
    currentWeek: n(v.currentWeek),
    totalWeeks: n(v.totalWeeks),
    daysPerWeek: n(v.daysPerWeek),
  };
}

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PlanForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: PlanFormValues;
  submitLabel: string;
  onSubmit: (input: PlanInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<PlanFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof PlanFormValues>(k: K, val: PlanFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextField
        label="Plan name"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. Weekly Training"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Status"
          value={v.status}
          options={TRAINING_PLAN_STATUSES}
          onChange={(x) => set("status", x)}
          labelFor={TITLE_CASE}
          error={errors.status}
        />
        <TextField
          label="Days per week"
          type="number"
          value={v.daysPerWeek}
          onChange={(x) => set("daysPerWeek", x)}
          error={errors.daysPerWeek}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Current week"
          type="number"
          value={v.currentWeek}
          onChange={(x) => set("currentWeek", x)}
          error={errors.currentWeek}
        />
        <TextField
          label="Total weeks"
          type="number"
          value={v.totalWeeks}
          onChange={(x) => set("totalWeeks", x)}
          error={errors.totalWeeks}
        />
      </div>
      {errors._ && <p className="t-small text-status-danger">{errors._}</p>}
      <FormActions submitLabel={submitLabel} busy={busy} onCancel={onCancel} />
    </form>
  );
}
