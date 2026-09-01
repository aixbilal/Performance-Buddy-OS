/**
 * The ONE Goal builder body. Used by:
 *   - manual creation      (/goals/new, "Manual Build" tab)
 *   - AI proposal          (/goals/new, "AI Proposal" tab — same form, prefilled)
 *   - editing              (/goals/:goalId/edit)
 * There is deliberately no separate "AI Goal Builder".
 */
import { useState } from "react";
import { TextArea, TextField, SelectField } from "./formPrimitives";
import { FormActions } from "../../components/FormActions";
import {
  DOMAINS,
  GOAL_TYPES,
  PRIORITY_BANDS,
  type Domain,
  type GoalInput,
  type GoalType,
  type PriorityBand,
} from "./types";

export type GoalFormValues = {
  title: string;
  type: GoalType;
  domain: Domain;
  priority: PriorityBand;
  deadline: string; // "" = none
  metricCurrent: string;
  metricTarget: string;
  metricUnit: string;
  detail: string;
};

export const EMPTY_GOAL_FORM: GoalFormValues = {
  title: "",
  type: "outcome",
  domain: "academic",
  priority: "normal",
  deadline: "",
  metricCurrent: "",
  metricTarget: "",
  metricUnit: "",
  detail: "",
};

export function valuesToInput(v: GoalFormValues): GoalInput {
  const hasMetric =
    v.metricTarget.trim() !== "" || v.metricCurrent.trim() !== "" || v.metricUnit.trim() !== "";
  return {
    title: v.title,
    type: v.type,
    domain: v.domain,
    priority: v.priority,
    detail: v.detail,
    deadline: v.deadline.trim() === "" ? null : v.deadline.trim(),
    metric: hasMetric
      ? {
          current: Number(v.metricCurrent === "" ? 0 : v.metricCurrent),
          target: Number(v.metricTarget === "" ? NaN : v.metricTarget),
          unit: v.metricUnit,
        }
      : null,
  };
}

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function GoalForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: GoalFormValues;
  submitLabel: string;
  onSubmit: (input: GoalInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<GoalFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof GoalFormValues>(k: K, val: GoalFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    if (!res.ok) setErrors(res.errors ?? {});
    else setErrors({});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextField
        label="Goal name"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. Reach 3.7+ SGPA this semester"
        autoFocus
      />

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Domain"
          value={v.domain}
          options={DOMAINS}
          onChange={(x) => set("domain", x)}
          labelFor={TITLE_CASE}
          error={errors.domain}
        />
        <SelectField
          label="Goal type"
          value={v.type}
          options={GOAL_TYPES}
          onChange={(x) => set("type", x)}
          labelFor={TITLE_CASE}
          error={errors.type}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Priority"
          value={v.priority}
          options={PRIORITY_BANDS}
          onChange={(x) => set("priority", x)}
          labelFor={TITLE_CASE}
          error={errors.priority}
        />
        <TextField
          label="Deadline (optional)"
          type="date"
          value={v.deadline}
          onChange={(x) => set("deadline", x)}
          error={errors.deadline}
        />
      </div>

      <fieldset className="border border-border-subtle rounded-md p-3 space-y-3">
        <legend className="text-text-secondary text-xs px-1">
          Measurable target (optional — leave blank if this goal isn't a number)
        </legend>
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="Baseline"
            type="number"
            value={v.metricCurrent}
            onChange={(x) => set("metricCurrent", x)}
            error={errors.metricCurrent}
            placeholder="3.35"
          />
          <TextField
            label="Target"
            type="number"
            value={v.metricTarget}
            onChange={(x) => set("metricTarget", x)}
            error={errors.metricTarget}
            placeholder="3.7"
          />
          <TextField
            label="Unit"
            value={v.metricUnit}
            onChange={(x) => set("metricUnit", x)}
            error={errors.metricUnit}
            placeholder="SGPA"
          />
        </div>
      </fieldset>

      <TextArea
        label="Why this matters (optional)"
        value={v.detail}
        onChange={(x) => set("detail", x)}
        error={errors.detail}
        placeholder="The deeper reason and the impact this goal will create."
        rows={3}
      />

      {errors._ && <p className="t-small text-status-danger">{errors._}</p>}

      <FormActions submitLabel={submitLabel} busy={busy} onCancel={onCancel} />
    </form>
  );
}
