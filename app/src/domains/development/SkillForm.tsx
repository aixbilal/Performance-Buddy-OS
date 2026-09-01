/**
 * The ONE Skill form body — /development/skills/new + /:skillId/edit.
 * Knowledge and Practice are self-assessed axes. Evidence is NOT here — it is
 * derived from recorded evidence with provenance (Skill Detail).
 */
import { useState } from "react";
import { TextField } from "../../components/FormFields";
import type { SkillInput } from "./types";
import { FormActions } from "../../components/FormActions";

export type SkillFormValues = {
  title: string;
  category: string;
  knowledgePercent: string;
  practicePercent: string;
};

export const EMPTY_SKILL_FORM: SkillFormValues = {
  title: "",
  category: "",
  knowledgePercent: "0",
  practicePercent: "0",
};

export function valuesToInput(v: SkillFormValues): SkillInput {
  return {
    title: v.title,
    category: v.category,
    knowledgePercent: v.knowledgePercent.trim() === "" ? NaN : Number(v.knowledgePercent),
    practicePercent: v.practicePercent.trim() === "" ? NaN : Number(v.practicePercent),
  };
}

export function SkillForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: SkillFormValues;
  submitLabel: string;
  onSubmit: (input: SkillInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<SkillFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof SkillFormValues>(k: K, val: SkillFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextField
        label="Skill name"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. React"
        autoFocus
      />
      <TextField
        label="Category (optional)"
        value={v.category}
        onChange={(x) => set("category", x)}
        error={errors.category}
        placeholder="e.g. Frontend · UI"
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Knowledge %"
          type="number"
          value={v.knowledgePercent}
          onChange={(x) => set("knowledgePercent", x)}
          error={errors.knowledgePercent}
          hint="Can you explain it clearly?"
        />
        <TextField
          label="Practice %"
          type="number"
          value={v.practicePercent}
          onChange={(x) => set("practicePercent", x)}
          error={errors.practicePercent}
          hint="Have you done it, help allowed?"
        />
      </div>
      {errors._ && <p className="t-small text-status-danger">{errors._}</p>}
      <FormActions submitLabel={submitLabel} busy={busy} onCancel={onCancel} />
    </form>
  );
}
