/** The ONE Routine form body — /routine/new + /routine/:routineId/edit. */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import {
  COMPLETION_TYPES,
  PRIORITIES,
  SCHEDULE_TYPES,
  TIME_WINDOWS,
  WEEKDAY_LABELS,
  type CompletionType,
  type Priority,
  type RoutineInput,
  type ScheduleType,
  type TimeWindow,
} from "./types";

export type RoutineFormValues = {
  title: string;
  category: string;
  timeWindow: TimeWindow;
  scheduleType: ScheduleType;
  scheduleDays: number[];
  timesPerWeek: string;
  completionType: CompletionType;
  targetQuantity: string;
  targetUnit: string;
  targetDurationMinutes: string;
  priority: Priority;
  relatedSystemId: string;
};

export const EMPTY_ROUTINE_FORM: RoutineFormValues = {
  title: "",
  category: "",
  timeWindow: "morning",
  scheduleType: "daily",
  scheduleDays: [],
  timesPerWeek: "3",
  completionType: "boolean",
  targetQuantity: "",
  targetUnit: "",
  targetDurationMinutes: "",
  priority: "important",
  relatedSystemId: "",
};

export function valuesToInput(v: RoutineFormValues): RoutineInput {
  const n = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    title: v.title,
    category: v.category,
    timeWindow: v.timeWindow,
    schedule: {
      type: v.scheduleType,
      days: v.scheduleDays,
      timesPerWeek: v.scheduleType === "times-per-week" ? n(v.timesPerWeek) : null,
    },
    completionType: v.completionType,
    targetQuantity: v.completionType === "quantity" ? n(v.targetQuantity) : null,
    targetUnit: v.completionType === "quantity" ? v.targetUnit : null,
    targetDurationMinutes: v.completionType === "duration" ? n(v.targetDurationMinutes) : null,
    priority: v.priority,
    relatedSystemId: v.relatedSystemId || null,
  };
}

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

export function RoutineForm({
  initial,
  submitLabel,
  systems,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: RoutineFormValues;
  submitLabel: string;
  systems: { id: string; title: string }[];
  onSubmit: (input: RoutineInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<RoutineFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof RoutineFormValues>(k: K, val: RoutineFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const toggleDay = (d: number) =>
    setV((p) => ({
      ...p,
      scheduleDays: p.scheduleDays.includes(d)
        ? p.scheduleDays.filter((x) => x !== d)
        : [...p.scheduleDays, d].sort((a, b) => a - b),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextField
        label="Routine name"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. Morning Mobility"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Category (optional)"
          value={v.category}
          onChange={(x) => set("category", x)}
          error={errors.category}
          placeholder="e.g. Personal Care, Prayer, Reading"
        />
        <SelectField
          label="When in the day"
          value={v.timeWindow}
          options={TIME_WINDOWS}
          onChange={(x) => set("timeWindow", x)}
          labelFor={TITLE_CASE}
          error={errors.timeWindow}
        />
      </div>

      {/* --- cadence --- */}
      <div className="space-y-2">
        <SelectField
          label="Cadence"
          value={v.scheduleType}
          options={SCHEDULE_TYPES}
          onChange={(x) => set("scheduleType", x)}
          labelFor={TITLE_CASE}
          error={errors.schedule}
          hint="The semantic schedule. Reminders are configured separately."
        />
        {v.scheduleType === "weekly-days" && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
            {WEEKDAY_LABELS.map((label, d) => {
              const on = v.scheduleDays.includes(d);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  aria-label={label}
                  onClick={() => toggleDay(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                    on
                      ? "bg-action-primary text-text-inverse border-transparent"
                      : "bg-surface-inset text-text-secondary border-border-subtle"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {v.scheduleType === "times-per-week" && (
          <TextField
            label="Times per week"
            type="number"
            value={v.timesPerWeek}
            onChange={(x) => set("timesPerWeek", x)}
            error={errors.schedule}
          />
        )}
      </div>

      {/* --- completion method --- */}
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Completion is measured by"
          value={v.completionType}
          options={COMPLETION_TYPES}
          onChange={(x) => set("completionType", x)}
          labelFor={TITLE_CASE}
          error={errors.completionType}
        />
        <SelectField
          label="Priority"
          value={v.priority}
          options={PRIORITIES}
          onChange={(x) => set("priority", x)}
          labelFor={TITLE_CASE}
          error={errors.priority}
        />
      </div>
      {v.completionType === "quantity" && (
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Target amount"
            type="number"
            value={v.targetQuantity}
            onChange={(x) => set("targetQuantity", x)}
            error={errors.targetQuantity}
          />
          <TextField
            label="Unit"
            value={v.targetUnit}
            onChange={(x) => set("targetUnit", x)}
            error={errors.targetUnit}
            placeholder="ml / pages / glasses"
          />
        </div>
      )}
      {v.completionType === "duration" && (
        <TextField
          label="Target minutes"
          type="number"
          value={v.targetDurationMinutes}
          onChange={(x) => set("targetDurationMinutes", x)}
          error={errors.targetDurationMinutes}
        />
      )}

      <SelectField
        label="Related System (optional)"
        value={v.relatedSystemId}
        options={["", ...systems.map((s) => s.id)]}
        onChange={(x) => set("relatedSystemId", x)}
        labelFor={(id) => (id === "" ? "— none —" : (systems.find((s) => s.id === id)?.title ?? id))}
        hint="A reference only — the routine never copies System or Action data, and does not require a Goal."
      />

      {errors._ && <p className="text-status-danger text-xs">{errors._}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
