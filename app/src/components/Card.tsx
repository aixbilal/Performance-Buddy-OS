import type { ReactNode } from "react";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface-raised border border-border-subtle rounded-lg p-4 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h3 className="text-xs uppercase tracking-wide text-text-muted font-medium">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
