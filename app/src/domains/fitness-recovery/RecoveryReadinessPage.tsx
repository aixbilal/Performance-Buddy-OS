import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useFitness } from "./store";
import { useState } from "react";
import type { Level3, SorenessLevel } from "./types";

const STATE_TONE = {
  push: "success",
  normal: "success",
  "reduced-load": "warning",
  recovery: "danger",
  "insufficient-data": "neutral",
} as const;

export function RecoveryReadinessPage() {
  const { readiness, checkIns, addCheckIn } = useFitness();
  const [sleepHours, setSleepHours] = useState(7.5);
  const [soreness, setSoreness] = useState<SorenessLevel>("none");
  const [energy, setEnergy] = useState<Level3>("normal");

  const submitCheckIn = () => {
    addCheckIn({
      date: new Date().toISOString().slice(0, 10),
      sleepHours,
      soreness,
      energy,
      motivation: "normal",
      stressLevel: "normal",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/fitness" className="text-text-muted text-xs hover:text-text-secondary">
          ← Fitness
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">Recovery & Readiness</h2>
        <p className="text-text-muted text-sm">Understand your recovery and get the best recommendation for today.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-text-muted text-xs mb-1">Today's Readiness</div>
            <div className="flex items-center gap-2">
              <Badge tone={STATE_TONE[readiness.state]}>{readiness.state.replace("-", " ")}</Badge>
            </div>
            <p className="text-text-secondary text-sm mt-2">{readiness.reason}</p>
          </div>
          {readiness.score !== null && (
            <div className="text-text-primary text-3xl font-semibold">{readiness.score}</div>
          )}
        </div>
        {readiness.state === "insufficient-data" && (
          <div className="bg-surface-inset border border-border-subtle rounded-md px-3 py-2 mt-3 text-xs text-text-muted">
            This is deliberate — PBOS will not guess a readiness percentage from too little data.
            Log a few more check-ins below.
          </div>
        )}
      </Card>

      <Card title="Log Today's Check-in">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-text-muted text-xs block mb-1">Sleep (hours)</label>
            <input
              type="number"
              step="0.1"
              value={sleepHours}
              onChange={(e) => setSleepHours(parseFloat(e.target.value))}
              className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-1">Soreness</label>
            <select
              value={soreness}
              onChange={(e) => setSoreness(e.target.value as SorenessLevel)}
              className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
            >
              <option value="none">None</option>
              <option value="mild">Mild</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="text-text-muted text-xs block mb-1">Energy</label>
            <select
              value={energy}
              onChange={(e) => setEnergy(e.target.value as Level3)}
              className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <button
          onClick={submitCheckIn}
          className="mt-3 px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
        >
          Submit Check-in
        </button>
      </Card>

      <Card title={`Recent Check-ins (${checkIns.length})`}>
        <div className="space-y-1">
          {[...checkIns]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                <span className="text-text-primary text-sm">{c.date}</span>
                <span className="text-text-secondary text-xs">
                  {c.sleepHours}h sleep · {c.soreness} soreness · {c.energy} energy
                </span>
              </div>
            ))}
        </div>
      </Card>

      <p className="text-text-disabled text-[11px]">
        Recommendations are based on available data and are not medical advice.
      </p>
    </div>
  );
}
