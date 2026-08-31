/** The ONE Book form — /language/books/new + /:bookId/edit. */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import { BOOK_STATUSES, type BookInput, type BookStatus } from "./types";

export type BookFormValues = {
  title: string;
  author: string;
  status: BookStatus;
  currentPage: string;
  totalPages: string;
  currentChapter: string;
  knowledgeTopicId: string;
  noteRef: string;
};

export const EMPTY_BOOK_FORM: BookFormValues = {
  title: "",
  author: "",
  status: "to-read",
  currentPage: "0",
  totalPages: "",
  currentChapter: "0",
  knowledgeTopicId: "",
  noteRef: "",
};

export function valuesToInput(v: BookFormValues): BookInput {
  const n = (s: string) => (s.trim() === "" ? NaN : Number(s));
  return {
    title: v.title,
    author: v.author,
    status: v.status,
    currentPage: Number.isFinite(n(v.currentPage)) ? n(v.currentPage) : 0,
    totalPages: v.totalPages.trim() === "" ? null : n(v.totalPages),
    currentChapter: Number.isFinite(n(v.currentChapter)) ? n(v.currentChapter) : 0,
    knowledgeTopicId: v.knowledgeTopicId || null,
    noteRef: v.noteRef,
  };
}

const STATUS_LABEL = (s: string) =>
  s === "to-read" ? "To read" : s.charAt(0).toUpperCase() + s.slice(1);

export function BookForm({
  initial,
  submitLabel,
  topics,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: BookFormValues;
  submitLabel: string;
  topics: { id: string; title: string }[];
  onSubmit: (input: BookInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<BookFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof BookFormValues>(k: K, val: BookFormValues[K]) =>
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
          label="Title"
          value={v.title}
          onChange={(x) => set("title", x)}
          error={errors.title}
          placeholder="e.g. Atomic Habits"
          autoFocus
        />
        <TextField
          label="Author (optional)"
          value={v.author}
          onChange={(x) => set("author", x)}
          error={errors.author}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SelectField
          label="Status"
          value={v.status}
          options={BOOK_STATUSES}
          onChange={(x) => set("status", x)}
          labelFor={STATUS_LABEL}
          error={errors.status}
        />
        <TextField
          label="Current page"
          type="number"
          value={v.currentPage}
          onChange={(x) => set("currentPage", x)}
          error={errors.currentPage}
        />
        <TextField
          label="Total pages (blank = unknown)"
          type="number"
          value={v.totalPages}
          onChange={(x) => set("totalPages", x)}
          error={errors.totalPages}
          hint="Leave blank if you don't know it — progress will show as “not tracked”, not 0%."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Current chapter (optional)"
          type="number"
          value={v.currentChapter}
          onChange={(x) => set("currentChapter", x)}
          error={errors.currentChapter}
        />
        <SelectField
          label="Knowledge concept (optional)"
          value={v.knowledgeTopicId}
          options={["", ...topics.map((t) => t.id)]}
          onChange={(x) => set("knowledgeTopicId", x)}
          labelFor={(id) => (id === "" ? "— none —" : (topics.find((t) => t.id === id)?.title ?? id))}
          hint="Reading owns page progress; Knowledge owns understanding. This is a reference only."
        />
      </div>
      <TextField
        label="Note reference (optional)"
        value={v.noteRef}
        onChange={(x) => set("noteRef", x)}
        error={errors.noteRef}
        placeholder="e.g. path or link to your own notes"
        hint="A plain pointer. PBOS does not read or index any note file."
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
