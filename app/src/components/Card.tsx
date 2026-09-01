import type { ReactNode } from "react";

/**
 * Panel primitive. Batch 9 adds Day-18 emphasis tiers so a screen can express
 * hierarchy (PRIMARY = current state / attention / next action, SECONDARY =
 * why / evidence / progress, TERTIARY = history / advanced / config) through
 * surface weight instead of giving every group an identical outlined box.
 * Defaults are unchanged, so existing callers render exactly as before.
 */
const EMPHASIS = {
  primary: "bg-surface-raised border border-border-subtle",
  secondary: "bg-surface border border-border-subtle",
  tertiary: "bg-transparent border border-border-divider",
} as const;

const PAD = { sm: "p-4", md: "p-5", lg: "p-6" } as const;

export function Card({
  title,
  action,
  children,
  className = "",
  emphasis = "primary",
  padding = "sm",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  emphasis?: keyof typeof EMPHASIS;
  padding?: keyof typeof PAD;
}) {
  return (
    <div className={`${EMPHASIS[emphasis]} ${PAD[padding]} rounded-lg ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <h3 className="t-label uppercase text-text-muted">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
