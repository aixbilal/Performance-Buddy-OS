/** The ONE Project form body — /development/projects/new + /:projectId/edit. */
import { useState } from "react";
import { SelectField, TextArea, TextField } from "../../components/FormFields";
import { PROJECT_STATUSES, type ProjectInput, type ProjectStatus } from "./types";

export type ProjectFormValues = {
  title: string;
  status: ProjectStatus;
  description: string;
};

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  title: "",
  status: "active",
  description: "",
};

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: ProjectFormValues;
  submitLabel: string;
  onSubmit: (input: ProjectInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<ProjectFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ProjectFormValues>(k: K, val: ProjectFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit({ title: v.title, status: v.status, description: v.description });
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextField
        label="Project name"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. Performance Buddy OS"
        autoFocus
      />
      <SelectField
        label="Status"
        value={v.status}
        options={PROJECT_STATUSES}
        onChange={(x) => set("status", x)}
        labelFor={TITLE_CASE}
        error={errors.status}
      />
      <TextArea
        label="Description (optional)"
        value={v.description}
        onChange={(x) => set("description", x)}
        error={errors.description}
        placeholder="What this project is and what it produces."
        rows={2}
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
