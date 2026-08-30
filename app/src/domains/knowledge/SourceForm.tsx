/**
 * Inline Source form (add + edit). A Source is a REFERENCE only — a path, URL
 * or provenance note. PBOS never claims the referenced file / web page /
 * Obsidian note was ingested.
 */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import { SOURCE_TYPES, type SourceInput, type SourceType } from "./types";

export type SourceFormValues = {
  type: SourceType;
  title: string;
  reference: string;
};

export const EMPTY_SOURCE_FORM: SourceFormValues = {
  type: "professor-material",
  title: "",
  reference: "",
};

const SOURCE_LABEL: Record<SourceType, string> = {
  "obsidian-note": "Obsidian note (reference)",
  "professor-material": "Professor material",
  book: "Book",
  article: "Article / web",
  video: "Video",
  "ai-note": "AI-assisted note",
};

export function SourceForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: SourceFormValues;
  submitLabel: string;
  onSubmit: (input: SourceInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<SourceFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof SourceFormValues>(k: K, val: SourceFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit({ type: v.type, title: v.title, reference: v.reference });
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Source title"
          value={v.title}
          onChange={(x) => set("title", x)}
          error={errors.title}
          placeholder="e.g. DSA Lecture 08 — Trees"
          autoFocus
        />
        <SelectField
          label="Type"
          value={v.type}
          options={SOURCE_TYPES}
          onChange={(x) => set("type", x)}
          labelFor={(s) => SOURCE_LABEL[s]}
          error={errors.type}
        />
      </div>
      <TextField
        label="Reference (path / URL — not the content)"
        value={v.reference}
        onChange={(x) => set("reference", x)}
        error={errors.reference}
        placeholder="e.g. Obsidian/DSA/Binary Trees.md"
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
