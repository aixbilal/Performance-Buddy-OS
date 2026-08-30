/**
 * Inline Assessment form (add + edit). Weights are NEVER silently rescaled —
 * Course Detail surfaces `analyzeAssessmentWeighting` as a truthful
 * empty / under / over state. `obtainedMarks` may be left blank (not graded yet).
 */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import { ASSESSMENT_CATEGORIES, type AssessmentCategory, type AssessmentInput } from "./types";

export type AssessmentFormValues = {
  category: AssessmentCategory;
  title: string;
  totalMarks: string;
  weightPercent: string;
  date: string;
  obtainedMarks: string; // "" = not graded yet
};

export const EMPTY_ASSESSMENT_FORM: AssessmentFormValues = {
  category: "quiz",
  title: "",
  totalMarks: "100",
  weightPercent: "0",
  date: "",
  obtainedMarks: "",
};

export function valuesToInput(v: AssessmentFormValues): AssessmentInput {
  return {
    category: v.category,
    title: v.title,
    totalMarks: v.totalMarks.trim() === "" ? NaN : Number(v.totalMarks),
    weightPercent: v.weightPercent.trim() === "" ? NaN : Number(v.weightPercent),
    date: v.date.trim(),
    obtainedMarks: v.obtainedMarks.trim() === "" ? null : Number(v.obtainedMarks),
  };
}

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function AssessmentForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: AssessmentFormValues;
  submitLabel: string;
  onSubmit: (input: AssessmentInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<AssessmentFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof AssessmentFormValues>(k: K, val: AssessmentFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Assessment title"
          value={v.title}
          onChange={(x) => set("title", x)}
          error={errors.title}
          placeholder="e.g. Quiz 1"
          autoFocus
        />
        <SelectField
          label="Category"
          value={v.category}
          options={ASSESSMENT_CATEGORIES}
          onChange={(x) => set("category", x)}
          labelFor={TITLE_CASE}
          error={errors.category}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TextField
          label="Total marks"
          type="number"
          value={v.totalMarks}
          onChange={(x) => set("totalMarks", x)}
          error={errors.totalMarks}
        />
        <TextField
          label="Weight %"
          type="number"
          value={v.weightPercent}
          onChange={(x) => set("weightPercent", x)}
          error={errors.weightPercent}
        />
        <TextField
          label="Date (optional)"
          type="date"
          value={v.date}
          onChange={(x) => set("date", x)}
          error={errors.date}
        />
      </div>
      <TextField
        label="Obtained marks (leave blank if not graded yet)"
        type="number"
        value={v.obtainedMarks}
        onChange={(x) => set("obtainedMarks", x)}
        error={errors.obtainedMarks}
      />
      {errors._ && <p className="text-status-danger text-xs">{errors._}</p>}
      <div className="flex gap-2">
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
