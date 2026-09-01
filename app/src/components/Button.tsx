import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Canonical button primitive (Batch 9 — §12 Shared Button Normalization).
 *
 * ONE place for variant + size + state, mapped to the locked tokens. Screens
 * should reach for this instead of hand-writing `px-3 py-1.5 rounded-md bg-…`
 * strings. Keyboard focus comes from the global `:focus-visible` rule in
 * index.css, so it is consistent with every other interactive element.
 *
 *   variant: primary | secondary | ghost | danger | icon
 *   size:    sm (32) | md (40) | lg (44)   — icon ignores size, is square-36
 *   state:   default · hover · disabled · loading (all handled here)
 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium " +
  "transition-colors select-none disabled:opacity-50 disabled:pointer-events-none " +
  "whitespace-nowrap";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-action-primary text-text-on-accent hover:bg-action-primary-hover",
  secondary:
    "bg-action-secondary text-text-primary border border-border-subtle hover:border-border-strong",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-raised",
  danger:
    "bg-transparent text-status-danger border border-status-danger/40 hover:bg-status-danger/10",
  icon: "text-text-secondary hover:text-text-primary hover:bg-surface-raised",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

/**
 * The Button visual as a bare class string — for the handful of places that
 * must stay a real navigation `<a>`/`<Link>` (routing, right-click-open) but
 * should look identical to a Button. Keeps one source of truth for the tokens.
 */
export function buttonClass(variant: Variant = "secondary", size: Size = "sm") {
  const sizeClass = variant === "icon" ? "h-9 w-9 p-0" : SIZE[size];
  return `${BASE} ${VARIANT[variant]} ${sizeClass}`;
}

export function Button({
  variant = "secondary",
  size = "sm",
  loading = false,
  leadingIcon,
  className = "",
  children,
  disabled,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeClass = variant === "icon" ? "h-9 w-9 p-0" : SIZE[size];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANT[variant]} ${sizeClass} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="w-3 h-3 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
        />
      )}
      {!loading && leadingIcon}
      {children}
    </button>
  );
}
