/**
 * Inline Academic Topic form (add + edit). Professor Coverage and Personal
 * Study Coverage are SEPARATE controls — changing one never touches the other,
 * and neither produces mastery. Mastery is read from a linked Knowledge concept
 * elsewhere in Course Detail.
 */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import { COVERAGE_STATUSES, type CoverageStatus, type TopicInput } from "./types";
import { FormActions } from "../../components/FormActions";

export type TopicFormValues = {
  title: string;
  professorCoverage: CoverageStatus;
  personalStudyPercent: string;
};

export const EMPTY_TOPIC_FORM: TopicFormValues = {
  title: "",
  professorCoverage: "not-taught",
  personalStudyPercent: "0",
};

export function valuesToInput(v: TopicFormValues): TopicInput {
  return {
    title: v.title,
    professorCoverage: v.professorCoverage,
    personalStudyPercent: v.personalStudyPercent.trim() === "" ? NaN : Number(v.personalStudyPercent),
  };
}

const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  "not-taught": "Not taught",
  "in-progress": "In progress",
  taught: "Taught",
};

export function TopicForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: TopicFormValues;
  submitLabel: string;
  onSubmit: (input: TopicInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<TopicFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof TopicFormValues>(k: K, val: TopicFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <TextField
        label="Topic title"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. Binary Trees"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Professor coverage"
          value={v.professorCoverage}
          options={COVERAGE_STATUSES}
          onChange={(x) => set("professorCoverage", x)}
          labelFor={(s) => COVERAGE_LABEL[s]}
          error={errors.professorCoverage}
          hint="What the course has covered — independent of your study."
        />
        <TextField
          label="Personal study %"
          type="number"
          value={v.personalStudyPercent}
          onChange={(x) => set("personalStudyPercent", x)}
          error={errors.personalStudyPercent}
          hint="How much you've studied it — independent of coverage and mastery."
        />
      </div>
      {errors._ && <p className="t-small text-status-danger">{errors._}</p>}
      <FormActions submitLabel={submitLabel} busy={busy} onCancel={onCancel} />
    </form>
  );
}
