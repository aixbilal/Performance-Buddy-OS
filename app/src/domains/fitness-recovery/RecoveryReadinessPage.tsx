import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { useFitness } from "./store";
import { LEVEL3S, SORENESS_LEVELS, type Level3, type SorenessLevel } from "./types";
import { Button } from "../../components/Button";

const READINESS_TONE = {
  push: "success",
  normal: "neutral",
  "reduced-load": "warning",
  recovery: "danger",
  "insufficient-data": "neutral",
} as const;

export function RecoveryReadinessPage() {
  const fit = useFitness();
  const today = fit.getTodayCheckIn();

  const [form, setForm] = useState({
    sleepHours: String(today?.sleepHours ?? "7.5"),
    soreness: (today?.soreness ?? "none") as SorenessLevel,
    energy: (today?.energy ?? "normal") as Level3,
    motivation: (today?.motivation ?? "normal") as Level3,
    stressLevel: (today?.stressLevel ?? "normal") as Level3,
  });
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const history = [...fit.checkIns].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const r = fit.readiness;

  // LOADING ≠ EMPTY — "insufficient data" readiness must not stand in for "loading".
  if (!fit.loaded) return <LoadingState label="Loading recovery data…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/fitness" className="text-text-muted text-xs hover:text-text-secondary">
            ← Fitness
          </Link>
          <h2 className="t-h2 text-text-primary mt-1">Recovery &amp; Readiness</h2>
          <p className="text-text-muted text-sm">
            Log how you actually feel. Readiness is derived from your check-ins — never a fabricated
            number.
          </p>
        </div>
        <SaveIndicator state={fit.saveState} />
      </div>

      <Card title="Readiness">
        <div className="flex items-center gap-3 mb-1">
          <Badge tone={READINESS_TONE[r.state]}>{r.state}</Badge>
          {r.score !== null ? (
            <span className="text-text-primary text-lg font-semibold">{r.score}</span>
          ) : (
            <span className="text-text-muted text-sm">no score</span>
          )}
        </div>
        <p className="text-text-secondary text-xs">{r.reason}</p>
        {r.state === "insufficient-data" && (
          <p className="text-text-muted text-[11px] mt-1">
            This is an honest "not enough data" state — not 0 readiness.
          </p>
        )}
      </Card>

      <Card title={today ? "Update Today's Check-In" : "Add Today's Check-In"}>
        <form
          className="space-y-3"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fit.addCheckIn({
              date: "",
              sleepHours: form.sleepHours.trim() === "" ? NaN : Number(form.sleepHours),
              soreness: form.soreness,
              energy: form.energy,
              motivation: form.motivation,
              stressLevel: form.stressLevel,
            });
            if (res.ok) {
              setErr(null);
              setSaved(true);
            } else {
              setErr(res.errors._ ?? Object.values(res.errors)[0] ?? "Invalid check-in.");
              setSaved(false);
            }
          }}
        >
          <label className="block text-text-secondary text-xs">
            Sleep (hours)
            <input
              type="number"
              step="0.1"
              value={form.sleepHours}
              onChange={(e) => setForm((p) => ({ ...p, sleepHours: e.target.value }))}
              aria-label="Sleep hours"
              className="block mt-1 w-40 bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <div className="grid grid-cols-4 gap-3">
            <Sel
              label="Soreness"
              value={form.soreness}
              options={SORENESS_LEVELS}
              onChange={(v) => setForm((p) => ({ ...p, soreness: v as SorenessLevel }))}
            />
            <Sel
              label="Energy"
              value={form.energy}
              options={LEVEL3S}
              onChange={(v) => setForm((p) => ({ ...p, energy: v as Level3 }))}
            />
            <Sel
              label="Motivation"
              value={form.motivation}
              options={LEVEL3S}
              onChange={(v) => setForm((p) => ({ ...p, motivation: v as Level3 }))}
            />
            <Sel
              label="Stress"
              value={form.stressLevel}
              options={LEVEL3S}
              onChange={(v) => setForm((p) => ({ ...p, stressLevel: v as Level3 }))}
            />
          </div>
          {err && <p className="text-status-danger text-[11px]">{err}</p>}
          {saved && !err && <p className="text-status-success text-[11px]">Check-in saved.</p>}
          <Button variant="primary" type="submit">
            {today ? "Update Check-In" : "Save Check-In"}
          </Button>
        </form>
      </Card>

      <Card title={`Check-In History (${history.length})`}>
        {history.length === 0 ? (
          <div className="text-text-muted text-xs">No check-ins yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs text-left">
                <th className="font-normal pb-2">Date</th>
                <th className="font-normal pb-2">Sleep</th>
                <th className="font-normal pb-2">Soreness</th>
                <th className="font-normal pb-2">Energy</th>
                <th className="font-normal pb-2" />
              </tr>
            </thead>
            <tbody>
              {history.map((c) => (
                <tr key={c.id} className="border-t border-border-subtle">
                  <td className="py-2 text-text-primary">{c.date}</td>
                  <td className="py-2 text-text-secondary">{c.sleepHours}h</td>
                  <td className="py-2 text-text-secondary capitalize">{c.soreness}</td>
                  <td className="py-2 text-text-secondary capitalize">{c.energy}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => fit.deleteCheckIn(c.id)}
                      className="text-text-muted text-[11px] hover:text-status-danger underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Sel({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-text-secondary text-xs">
      {label}
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
