import type { ReactNode } from "react";

/**
 * §25/§26/§27: ONE reusable component for every empty/setup/error/loading
 * presentation — domains supply contextual copy and actions, the visual
 * structure (icon → title → explanation → action) is shared, not
 * hand-rebuilt per screen. This directly answers the Duplication Audit's
 * "duplicated resilience components" simplification target.
 */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tone = "neutral",
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneColor =
    tone === "positive" ? "text-status-success" : tone === "warning" ? "text-status-warning" : tone === "danger" ? "text-status-danger" : "text-text-muted";

  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      {icon && <div className={`text-3xl mb-3 ${toneColor}`}>{icon}</div>}
      <h3 className="text-text-primary text-sm font-medium mb-1">{title}</h3>
      <p className="text-text-muted text-xs max-w-xs mb-4">{description}</p>
      <div className="flex gap-2">
        {primaryAction && (
          <button onClick={primaryAction.onClick} className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium">
            {primaryAction.label}
          </button>
        )}
        {secondaryAction && (
          <button onClick={secondaryAction.onClick} className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-text-secondary">
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
