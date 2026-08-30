/**
 * Small accessible form primitives for the Performance builders/forms.
 * Local to this domain (Batch 1) — a global form system is out of scope.
 * Every field: real <label htmlFor>, aria-invalid, error text wired via
 * aria-describedby, visible focus ring from the design tokens.
 */
import { useId, type ReactNode } from "react";

const baseInput =
  "w-full bg-surface-inset border rounded-md px-3 py-2 text-text-primary text-sm " +
  "outline-none focus-visible:ring-2 focus-visible:ring-border-focus " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

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
    <div className="space-y-1">
      <label htmlFor={id} className="block text-text-secondary text-xs font-medium">
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-text-muted text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-status-danger text-[11px]">
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
          rows={props.rows ?? 2}
          value={props.value}
          placeholder={props.placeholder}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value)}
          className={`${baseInput} ${props.error ? "border-status-danger" : "border-border-subtle"}`}
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
