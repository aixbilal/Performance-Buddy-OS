import type { ReactNode } from "react";
import { Button } from "./Button";

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
      <h3 className="t-card-title text-text-primary mb-1">{title}</h3>
      <p className="t-small text-text-muted max-w-xs mb-4">{description}</p>
      <div className="flex gap-2">
        {primaryAction && (
          <Button variant="primary" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="ghost" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
