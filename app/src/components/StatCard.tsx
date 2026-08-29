import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * Day 18 §72-74 simplification: this exact label/value pattern was
 * hand-repeated 40 times across the app (Today, Academics, Money, SGPA,
 * Planner, Fitness...). One reusable component now, per §72's rule
 * "Remove duplicate presentation → Reuse existing components" — the
 * FIRST step in the simplification order, before touching hierarchy or
 * removing anything.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const valueColor =
    tone === "success" ? "text-status-success" : tone === "warning" ? "text-status-warning" : tone === "danger" ? "text-status-danger" : "text-text-primary";

  return (
    <Card>
      <div className="text-text-muted text-xs mb-1">{label}</div>
      <div className={`text-lg font-semibold ${valueColor}`}>{value}</div>
      {sub && <div className="text-text-secondary text-xs mt-0.5">{sub}</div>}
    </Card>
  );
}
