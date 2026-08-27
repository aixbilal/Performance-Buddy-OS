type Tone = "neutral" | "success" | "warning" | "danger" | "ai";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-overlay text-text-secondary border-border-subtle",
  success: "bg-status-success/15 text-status-success border-status-success/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  danger: "bg-status-danger/15 text-status-danger border-status-danger/30",
  ai: "bg-ai-surface text-text-primary border-border-focus",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
