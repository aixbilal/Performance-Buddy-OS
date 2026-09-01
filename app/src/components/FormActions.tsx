import type { ReactNode } from "react";
import { Button } from "./Button";

/**
 * Canonical builder/form footer (Batch 9). One consistent submit + cancel row
 * for every `*Form` — canonical control height, spacing, focus ring, and
 * disabled/loading semantics, instead of a hand-written `<button className="px-3
 * py-1.5 …">` pair per form.
 *
 *   <FormActions submitLabel="Save Goal" busy={busy} onCancel={onCancel} />
 *
 * `submit` renders a type="submit" button (works inside <form onSubmit>);
 * pass `onSubmit` only for non-form flows.
 */
export function FormActions({
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
  busy = false,
  destructive = false,
  extra,
  align = "start",
}: {
  submitLabel: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  extra?: ReactNode;
  align?: "start" | "end" | "between";
}) {
  return (
    <div
      className={`flex items-center gap-2 pt-1 ${
        align === "end"
          ? "justify-end"
          : align === "between"
            ? "justify-between"
            : "justify-start"
      }`}
    >
      {extra}
      <Button
        type={onSubmit ? "button" : "submit"}
        variant={destructive ? "danger" : "primary"}
        size="md"
        loading={busy}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" size="md" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
    </div>
  );
}
