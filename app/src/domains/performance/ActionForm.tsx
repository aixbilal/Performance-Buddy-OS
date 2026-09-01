import { useState } from "react";
import { SelectField, TextField } from "./formPrimitives";
import {
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  type ActionInput,
  type ActionPriority,
  type ActionStatus,
} from "./types";
import { FormActions } from "../../components/FormActions";

export type ActionFormValues = {
  title: string;
  context: string;
  status: ActionStatus;
  estMinutes: string;
  priority: ActionPriority;
  timing: string;
};

export const emptyActionForm = (): ActionFormValues => ({
  title: "",
  context: "",
  status: "todo",
  estMinutes: "",
  priority: "normal",
  timing: "",
});

export function actionValuesToInput(v: ActionFormValues): ActionInput {
  return {
    title: v.title,
    context: v.context,
    status: v.status,
    estMinutes: v.estMinutes.trim() === "" ? null : Number(v.estMinutes),
    priority: v.priority,
    timing: v.timing,
  };
}

const STATUS_LABEL: Record<ActionStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};
const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ActionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: ActionFormValues;
  submitLabel: string;
  onSubmit: (input: ActionInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ActionFormValues>(k: K, val: ActionFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await onSubmit(actionValuesToInput(v));
        setErrors(res.ok ? {} : res.errors ?? {});
      }}
      className="space-y-3 bg-surface-inset border border-border-subtle rounded-md p-3"
    >
      <TextField
        label="Action"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. Revise Binary Trees"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Context (optional)"
          value={v.context}
          onChange={(x) => set("context", x)}
          placeholder="Data Structures"
        />
        <TextField
          label="Estimate, minutes (optional)"
          type="number"
          value={v.estMinutes}
          onChange={(x) => set("estMinutes", x)}
          error={errors.estMinutes}
          placeholder="45"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SelectField
          label="Status"
          value={v.status}
          options={ACTION_STATUSES}
          onChange={(x) => set("status", x)}
          labelFor={(s) => STATUS_LABEL[s]}
          error={errors.status}
        />
        <SelectField
          label="Priority"
          value={v.priority}
          options={ACTION_PRIORITIES}
          onChange={(x) => set("priority", x)}
          labelFor={TITLE_CASE}
          error={errors.priority}
        />
        <TextField
          label="Timing (optional)"
          value={v.timing}
          onChange={(x) => set("timing", x)}
          placeholder="Today · 2:30 PM"
        />
      </div>
      {errors._ && <p className="t-small text-status-danger">{errors._}</p>}
      <FormActions submitLabel={submitLabel} busy={busy} onCancel={onCancel} />
    </form>
  );
}

export { STATUS_LABEL as ACTION_STATUS_LABEL };
