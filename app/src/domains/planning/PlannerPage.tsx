import { useState } from "react";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { usePlanning } from "./store";
import { DAY_LABELS } from "./mockData";
import type { ScheduleBlock } from "./types";

const FRAGILITY_LABEL = {
  valid: "Healthy buffer",
  "valid-fragile": "Valid, but fragile — very little buffer",
  exceeds: "Exceeds capacity",
} as const;

const FRAGILITY_TONE = { valid: "success", "valid-fragile": "warning", exceeds: "danger" } as const;

function timeLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function PlannerPage() {
  const { blocks, capacity, conflicts, violations, weeklyScheduledMinutes, fragility, checkFit } = usePlanning();
  const [testResult, setTestResult] = useState<string | null>(null);

  const dayViolations = violations.filter((v) => v.scope === "day");
  const weekViolation = violations.find((v) => v.scope === "week");

  const tryAddOverloadedBlock = () => {
    const candidate: ScheduleBlock = {
      id: "test-candidate",
      title: "New Test Block",
      domain: "Development",
      day: 5, // Saturday — already has 2 overlapping blocks in the seed data
      startMinute: 14 * 60 + 15,
      endMinute: 15 * 60,
      type: "flexible",
      locked: false,
      actionId: null,
    };
    const result = checkFit(candidate);
    setTestResult(result.fits ? "Fits cleanly — no conflict or capacity issue." : `Could Not Fit: ${result.reason}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Conflict &amp; Capacity</h2>
        <p className="text-text-muted text-sm">Find scheduling problems before they become execution problems.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Conflicts (direct overlap)</div>
          <div className="text-text-primary text-lg font-semibold">{conflicts.length}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Capacity Violations</div>
          <div className="text-text-primary text-lg font-semibold">{violations.length}</div>
          <p className="text-text-disabled text-[10px] mt-1">A different problem from conflicts — checked separately.</p>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Weekly Flexible Load</div>
          <div className="text-text-primary text-lg font-semibold">
            {timeLabel(weeklyScheduledMinutes)} / {timeLabel(capacity.weeklyCapacityMinutes)}
          </div>
          <Badge tone={FRAGILITY_TONE[fragility]}>{FRAGILITY_LABEL[fragility]}</Badge>
        </Card>
      </div>

      {conflicts.length > 0 && (
        <Card title="Direct Conflicts">
          {conflicts.map((c, i) => {
            const a = blocks.find((b) => b.id === c.blockAId);
            const b = blocks.find((b) => b.id === c.blockBId);
            return (
              <div key={i} className="bg-status-danger/10 border border-status-danger/30 rounded-md p-3 mb-2 text-sm">
                <span className="text-text-primary">{DAY_LABELS[c.day]} · </span>
                <span className="text-text-secondary">
                  {a?.title} and {b?.title} overlap by {c.overlapMinutes} minutes
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {(dayViolations.length > 0 || weekViolation) && (
        <Card title="Capacity Violations">
          {dayViolations.map((v, i) => (
            <div key={i} className="bg-status-warning/10 border border-status-warning/30 rounded-md p-3 mb-2 text-sm">
              <span className="text-text-primary">{DAY_LABELS[v.day as number]} · </span>
              <span className="text-text-secondary">
                Over daily capacity by {v.overMinutes} minutes ({timeLabel(v.scheduledMinutes)} scheduled /{" "}
                {timeLabel(v.capacityMinutes)} capacity)
              </span>
            </div>
          ))}
          {weekViolation && (
            <div className="bg-status-warning/10 border border-status-warning/30 rounded-md p-3 text-sm">
              <span className="text-text-primary">Week · </span>
              <span className="text-text-secondary">
                Over weekly capacity by {weekViolation.overMinutes} minutes — rescheduling individual blocks
                cannot fix this; capacity must intentionally change, or work must be reduced.
              </span>
            </div>
          )}
        </Card>
      )}

      <Card title="This Week">
        <div className="space-y-1">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm">
              <span className="text-text-primary">
                {DAY_LABELS[b.day]} {timeLabel(b.startMinute)}–{timeLabel(b.endMinute)} · {b.title}
              </span>
              <div className="flex items-center gap-1.5">
                {b.locked && <Badge tone="neutral">Locked</Badge>}
                <Badge>{b.type}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Try Adding a Block (demonstrates 'Could Not Fit')">
        <p className="text-text-disabled text-[11px] mb-3">
          Attempts to add a new block on Saturday, where two blocks already overlap in the seed data.
        </p>
        <button onClick={tryAddOverloadedBlock} className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium">
          Try Fit
        </button>
        {testResult && <p className="text-text-secondary text-xs mt-3">{testResult}</p>}
      </Card>
    </div>
  );
}
