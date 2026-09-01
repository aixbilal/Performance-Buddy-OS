/**
 * Shared accessible form primitives (Batch 2A: promoted from the Performance
 * domain — it was already domain-neutral). Used by Performance, Academic and
 * Knowledge forms. Every field: real <label htmlFor>, aria-invalid, error text
 * wired via aria-describedby, visible focus ring from the design tokens.
 *
 * Batch 9: normalized to the canonical control scale — 40px input/select
 * height, `.t-label` labels, `.t-small` hint/error text, canonical spacing.
 * Keyboard focus comes from the global `:focus-visible` ring in index.css.
 *
 * `domains/performance/formPrimitives.tsx` re-exports this module so Batch 1
 * imports keep working unchanged — there is exactly ONE implementation.
 */
import { useId, type ReactNode } from "react";

const fieldBase =
  "w-full bg-surface-inset border rounded-md px-3 text-text-primary text-sm " +
  "outline-none disabled:opacity-50 disabled:cursor-not-allowed";
const lineHeight = "h-10"; // canonical 40px control height
const baseInput = `${fieldBase} ${lineHeight}`;
const baseArea = `${fieldBase} py-2 min-h-[80px] leading-normal`;

function Wrap({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}) {
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block t-label text-text-secondary">
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && !error && (
        <p id={hintId} className="t-small text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="t-small text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  type?: "text" | "number" | "date";
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const rid = useId();
  return (
    <Wrap id={rid} label={props.label} error={props.error} hint={props.hint}>
      {({ id, describedBy }) => (
        <input
          id={id}
          type={props.type ?? "text"}
          value={props.value}
          placeholder={props.placeholder}
          autoFocus={props.autoFocus}
          disabled={props.disabled}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value)}
          className={`${baseInput} ${props.error ? "border-status-danger" : "border-border-subtle"}`}
        />
      )}
    </Wrap>
  );
}

export function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  rows?: number;
}) {
  const rid = useId();
  return (
    <Wrap id={rid} label={props.label} error={props.error} hint={props.hint}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          rows={props.rows ?? 3}
          value={props.value}
          placeholder={props.placeholder}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value)}
          className={`${baseArea} ${props.error ? "border-status-danger" : "border-border-subtle"}`}
        />
      )}
    </Wrap>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labelFor?: (v: T) => string;
  error?: string;
  hint?: string;
}) {
  const rid = useId();
  return (
    <Wrap id={rid} label={props.label} error={props.error} hint={props.hint}>
      {({ id, describedBy }) => (
        <select
          id={id}
          value={props.value}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value as T)}
          className={`${baseInput} capitalize ${props.error ? "border-status-danger" : "border-border-subtle"}`}
        >
          {props.options.map((o) => (
            <option key={o} value={o}>
              {props.labelFor ? props.labelFor(o) : o}
            </option>
          ))}
        </select>
      )}
    </Wrap>
  );
}
