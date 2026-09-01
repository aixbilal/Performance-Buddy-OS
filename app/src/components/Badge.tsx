type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "ai";

/**
 * Status chip. Semantic tone must MEAN something (success / warning / danger /
 * info / ai) — not a per-domain decorative colour. Never colour-only: the text
 * label always carries the meaning, and `dot` adds a non-colour cue where a
 * badge sits among same-shaped siblings.
 */
const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-overlay text-text-secondary border-border-subtle",
  success: "bg-status-success/15 text-status-success border-status-success/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  danger: "bg-status-danger/15 text-status-danger border-status-danger/30",
  info: "bg-status-info/15 text-status-info border-status-info/30",
  ai: "bg-ai-surface text-text-primary border-border-focus",
};

const DOT_CLASSES: Record<Tone, string> = {
  neutral: "bg-text-muted",
  success: "bg-status-success",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
  info: "bg-status-info",
  ai: "bg-accent-primary",
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border t-label ${TONE_CLASSES[tone]}`}
    >
      {dot && (
        <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      )}
      {children}
    </span>
  );
}
