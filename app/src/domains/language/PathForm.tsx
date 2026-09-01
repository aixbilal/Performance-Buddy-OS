/** The ONE Language Path form — /language/paths/new + /:pathId/edit. */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import {
  LANGUAGE_PATH_STATUSES,
  type LanguagePathStatus,
  type PathInput,
} from "./types";
import { FormActions } from "../../components/FormActions";

export type PathFormValues = {
  language: string;
  title: string;
  targetLevel: string;
  status: LanguagePathStatus;
  relatedRoutineId: string;
};

export const EMPTY_PATH_FORM: PathFormValues = {
  language: "",
  title: "",
  targetLevel: "",
  status: "active",
  relatedRoutineId: "",
};

export function valuesToInput(v: PathFormValues): PathInput {
  return {
    language: v.language,
    title: v.title,
    targetLevel: v.targetLevel,
    status: v.status,
    relatedRoutineId: v.relatedRoutineId || null,
  };
}

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PathForm({
  initial,
  submitLabel,
  routines,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: PathFormValues;
  submitLabel: string;
  routines: { id: string; title: string }[];
  onSubmit: (input: PathInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<PathFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof PathFormValues>(k: K, val: PathFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Language"
          value={v.language}
          onChange={(x) => set("language", x)}
          error={errors.language}
          placeholder="e.g. German"
          autoFocus
        />
        <TextField
          label="Target level (optional)"
          value={v.targetLevel}
          onChange={(x) => set("targetLevel", x)}
          error={errors.targetLevel}
          placeholder="e.g. A2, Conversational"
        />
      </div>
      <TextField
        label="Path title"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. A1 Foundations"
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Status"
          value={v.status}
          options={LANGUAGE_PATH_STATUSES}
          onChange={(x) => set("status", x)}
          labelFor={TITLE_CASE}
          error={errors.status}
        />
        <SelectField
          label="Practice Routine (optional)"
          value={v.relatedRoutineId}
          options={["", ...routines.map((r) => r.id)]}
          onChange={(x) => set("relatedRoutineId", x)}
          labelFor={(id) =>
            id === "" ? "— none —" : (routines.find((r) => r.id === id)?.title ?? id)
          }
          hint="A reference — the routine owns when/how often you practise; this path owns curriculum progress."
        />
      </div>
      {errors._ && <p className="t-small text-status-danger">{errors._}</p>}
      <FormActions submitLabel={submitLabel} busy={busy} onCancel={onCancel} />
    </form>
  );
}
