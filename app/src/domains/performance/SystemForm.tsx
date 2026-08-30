import { useState } from "react";
import { SelectField, TextArea, TextField } from "./formPrimitives";
import { DOMAINS, type Domain, type SystemInput } from "./types";

export type SystemFormValues = {
  title: string;
  description: string;
  domain: Domain;
  cadence: string;
  tags: string;
};

export const emptySystemForm = (domain: Domain = "academic"): SystemFormValues => ({
  title: "",
  description: "",
  domain,
  cadence: "",
  tags: "",
});

export function systemValuesToInput(v: SystemFormValues): SystemInput {
  return {
    title: v.title,
    description: v.description,
    domain: v.domain,
    cadence: v.cadence,
    tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
  };
}

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function SystemForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: SystemFormValues;
  submitLabel: string;
  onSubmit: (input: SystemInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof SystemFormValues>(k: K, val: SystemFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await onSubmit(systemValuesToInput(v));
        setErrors(res.ok ? {} : res.errors ?? {});
      }}
      className="space-y-3"
    >
      <TextField
        label="System name"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. Weekly DSA Study"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Domain"
          value={v.domain}
          options={DOMAINS}
          onChange={(x) => set("domain", x)}
          labelFor={TITLE_CASE}
          error={errors.domain}
        />
        <TextField
          label="Cadence (optional)"
          value={v.cadence}
          onChange={(x) => set("cadence", x)}
          placeholder="e.g. Mon–Fri, Weekly"
        />
      </div>
      <TextArea
        label="What this repeatable process is (optional)"
        value={v.description}
        onChange={(x) => set("description", x)}
        rows={2}
      />
      <TextField
        label="Tags (optional, comma-separated)"
        value={v.tags}
        onChange={(x) => set("tags", x)}
        placeholder="Core, Academic"
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
