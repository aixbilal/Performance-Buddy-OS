import type { ReactNode } from "react";

/**
 * PrimaryActionSurface — the single strong "what should I do now?" surface
 * (V1 Visual Correction §17–§18).
 *
 * Reads as more important than a normal Card without becoming a marketing hero:
 * a raised surface, larger radius/padding, and — adapting the Vengeance UI
 * Glow Border *concept* only — a faint, STATIC accent edge (`--color-accent-
 * glow` via a 1px inset ring + a soft low-alpha outer bloom). No neon, no
 * animation, no continuous motion. When `state="idle"` the edge drops back to
 * the plain subtle border so an empty day doesn't glow at the user.
 */
export function PrimaryActionSurface({
  eyebrow,
  state = "active",
  children,
  className = "",
}: {
  eyebrow?: ReactNode;
  state?: "active" | "idle";
  children: ReactNode;
  className?: string;
}) {
  const edge =
    state === "active"
      ? "border-border-selected/60 shadow-[var(--shadow-active-edge)]"
      : "border-border-subtle";

  return (
    <section
      aria-label="Current focus"
      className={`rounded-xl border bg-surface-raised p-6 ${edge} ${className}`}
    >
      {eyebrow && (
        <div className="t-label uppercase tracking-wide text-accent-primary mb-2">
          {eyebrow}
        </div>
      )}
      {children}
    </section>
  );
}
