/**
 * The ONE Knowledge Topic form body. Used by:
 *   - manual creation  (/knowledge/new)
 *   - editing          (/knowledge/:topicId/edit)
 *
 * There is deliberately NO user-editable mastery field — mastery is derived
 * from recorded Evidence (engine `deriveTopicView`).
 */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory, type TopicInput } from "./types";

export type KnowledgeTopicFormValues = {
  title: string;
  category: KnowledgeCategory;
  context: string;
};

export const EMPTY_KNOWLEDGE_TOPIC_FORM: KnowledgeTopicFormValues = {
  title: "",
  category: "general",
  context: "",
};

export function valuesToInput(v: KnowledgeTopicFormValues): TopicInput {
  return {
    title: v.title,
    category: v.category,
    context: v.context,
    relatedGoalId: null,
  };
}

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function KnowledgeTopicForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: KnowledgeTopicFormValues;
  submitLabel: string;
  onSubmit: (input: TopicInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<KnowledgeTopicFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof KnowledgeTopicFormValues>(k: K, val: KnowledgeTopicFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          label="Category"
          value={v.category}
          options={KNOWLEDGE_CATEGORIES}
          onChange={(x) => set("category", x)}
          labelFor={TITLE_CASE}
          error={errors.category}
        />
        <TextField
          label="Context (optional)"
          value={v.context}
          onChange={(x) => set("context", x)}
          error={errors.context}
          placeholder="e.g. Data Structures"
        />
      </div>
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
