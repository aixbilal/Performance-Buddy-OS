import { useState } from "react";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useFocus } from "./store";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function FocusPage() {
  const { session, error, start, pause, resume, finish, setNotes } = useFocus();
  const [recallScore, setRecallScore] = useState<number | "">("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const targetSeconds = session.targetMinutes * 60;
  const percent = Math.min(100, Math.round((session.elapsedSeconds / targetSeconds) * 100));

  const handleFinish = () => {
    const hasScore = recallScore !== "";
    finish(hasScore ? { score: recallScore as number, maxScore: 10 } : undefined);
    setLastResult(
      hasScore
        ? `Session complete — recall check recorded, Knowledge evidence added.`
        : `Session complete — duration logged, but NO mastery evidence added (no recall check was done).`
    );
    setRecallScore("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Focus Mode</h2>
        <p className="text-text-muted text-sm">Targeted, uninterrupted execution — not a generic timer, not the study engine.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <span className="text-text-primary text-sm font-medium">{session.title}</span>
          <Badge tone={session.status === "active" ? "success" : session.status === "paused" ? "warning" : "neutral"}>
            {session.status}
          </Badge>
        </div>

        <div className="text-center mb-4">
          <div className="text-text-primary text-5xl font-semibold tabular-nums">{formatTime(session.elapsedSeconds)}</div>
          <div className="text-text-muted text-xs mt-1">{percent}% of {session.targetMinutes}:00 target</div>
        </div>

        <div className="w-full h-1.5 rounded-full bg-surface-inset overflow-hidden mb-4">
          <div className="h-full bg-action-primary transition-all" style={{ width: `${percent}%` }} />
        </div>

        {error && <p className="text-status-danger text-xs mb-3">{error}</p>}

        <div className="flex gap-2 justify-center mb-4">
          {session.status === "idle" && (
            <button onClick={start} className="px-4 py-2 rounded-md bg-action-primary text-text-inverse text-sm font-medium">
              Start
            </button>
          )}
          {session.status === "active" && (
            <>
              <button onClick={pause} className="px-4 py-2 rounded-md bg-action-secondary text-text-primary text-sm font-medium">
                Pause
              </button>
              <button onClick={handleFinish} className="px-4 py-2 rounded-md bg-status-success/20 text-status-success text-sm font-medium">
                Finish
              </button>
            </>
          )}
          {session.status === "paused" && (
            <>
              <button onClick={resume} className="px-4 py-2 rounded-md bg-action-primary text-text-inverse text-sm font-medium">
                Resume
              </button>
              <button onClick={handleFinish} className="px-4 py-2 rounded-md bg-status-success/20 text-status-success text-sm font-medium">
                Finish
              </button>
            </>
          )}
        </div>

        {(session.status === "active" || session.status === "paused") && (
          <div className="bg-surface-inset border border-border-subtle rounded-md p-3">
            <label className="text-text-muted text-xs block mb-1">
              Optional recall check before finishing (out of 10) — leave blank to log time only, no mastery claim
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={recallScore}
              onChange={(e) => setRecallScore(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="w-24 bg-surface-raised border border-border-subtle rounded-md px-2 py-1 text-text-primary text-sm"
            />
          </div>
        )}

        {session.status === "completed" && lastResult && (
          <p className="text-text-secondary text-xs text-center">{lastResult}</p>
        )}
      </Card>

      <Card title="Quick Note">
        <textarea
          value={session.notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for this session…"
          className="w-full bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm h-20"
        />
      </Card>
    </div>
  );
}
