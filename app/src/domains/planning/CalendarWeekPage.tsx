import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { LoadingState, ErrorState } from "../../components/StateViews";
import { usePlanning } from "./store";
import { usePerformance } from "../performance/store";
import { DAY_LABELS, DAY_LABELS_LONG, shortDate, timeLabel } from "./mockData";
import type { PlanningBlock } from "./types";

/**
 * Calendar Week — a VIEW over the canonical Planning store. It never owns a
 * CalendarEvent record: dated blocks appear on their exact date, undated blocks
 * recur on their weekday. Conflicts (overlap) and capacity (load vs limit) are
 * shown separately, never merged.
 */
export function CalendarWeekPage() {
  const {
    weekDays,
    weekStartIso,
    shiftWeek,
    goToCurrentWeek,
    todayIso,
    conflicts,
    violations,
    getBlock,
    toggleBlockLock,
    deleteBlock,
    moveBlock,
    blocks,
    loaded,
    loadError,
  } = usePlanning();
  const { actions } = usePerformance();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const conflictBlockIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) {
      s.add(c.blockAId);
      s.add(c.blockBId);
    }
    return s;
  }, [conflicts]);

  // Day-17: LOADING ≠ EMPTY.
  if (loadError) {
    return <ErrorState title="The calendar couldn't load" detail={loadError} onRetry={() => window.location.reload()} />;
  }
  if (!loaded) {
    return <LoadingState label="Loading your calendar…" />;
  }

  const selected = selectedId ? getBlock(selectedId) ?? null : null;
  const selectedAction =
    selected?.actionId ? actions.find((a) => a.id === selected.actionId) ?? null : null;

  const dayViolations = violations.filter((v) => v.scope === "day");
  const weekViolation = violations.find((v) => v.scope === "week");
  const rangeLabel = `${shortDate(weekStartIso)} – ${shortDate(weekDays[6].iso)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="t-h2 text-text-primary">Calendar</h2>
          <p className="text-text-muted text-sm">
            A view of your scheduled Planning Blocks. It never changes an Action's completion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
            className="px-2 py-1 rounded-md border border-border-subtle text-text-secondary text-sm hover:bg-surface-inset"
          >
            ‹
          </button>
          <button
            onClick={goToCurrentWeek}
            aria-label="Go to current week"
            className="px-3 py-1 rounded-md border border-border-subtle text-text-secondary text-xs hover:bg-surface-inset"
          >
            This week
          </button>
          <button
            onClick={() => shiftWeek(1)}
            aria-label="Next week"
            className="px-2 py-1 rounded-md border border-border-subtle text-text-secondary text-sm hover:bg-surface-inset"
          >
            ›
          </button>
        </div>
      </div>

      <div className="text-text-muted text-xs" aria-live="polite">
        Week of <span className="text-text-secondary">{rangeLabel}</span>
      </div>

      {(conflicts.length > 0 || violations.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <Card title="Conflicts — direct overlap">
            {conflicts.length === 0 ? (
              <p className="text-text-muted text-xs">None this plan.</p>
            ) : (
              conflicts.map((c, i) => {
                const a = blocks.find((b) => b.id === c.blockAId);
                const b2 = blocks.find((b) => b.id === c.blockBId);
                return (
                  <div key={i} className="text-status-danger text-xs mb-1">
                    {DAY_LABELS[c.day]}: “{a?.title}” overlaps “{b2?.title}” by {c.overlapMinutes} min
                  </div>
                );
              })
            )}
          </Card>
          <Card title="Capacity — load vs limit">
            {violations.length === 0 ? (
              <p className="text-text-muted text-xs">Within capacity.</p>
            ) : (
              <>
                {dayViolations.map((v, i) => (
                  <div key={i} className="text-status-warning text-xs mb-1">
                    {DAY_LABELS[v.day as number]}: {timeLabel(v.scheduledMinutes)} planned /{" "}
                    {timeLabel(v.capacityMinutes)} — over by {v.overMinutes} min
                  </div>
                ))}
                {weekViolation && (
                  <div className="text-status-warning text-xs">
                    Week: {timeLabel(weekViolation.scheduledMinutes)} planned /{" "}
                    {timeLabel(weekViolation.capacityMinutes)} — over by {weekViolation.overMinutes} min
                  </div>
                )}
              </>
            )}
            <p className="text-text-muted text-[10px] mt-2">
              Empty calendar space is not the same as available capacity.
            </p>
          </Card>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[840px]">
          {weekDays.map((d) => (
            <div
              key={d.iso}
              className={`rounded-lg border p-2 ${
                d.iso === todayIso ? "border-action-primary bg-surface-inset" : "border-border-subtle"
              }`}
            >
              <div className="mb-2">
                <div className="text-text-primary text-xs font-semibold">{DAY_LABELS[d.weekdayIndex]}</div>
                <div className="text-text-muted text-[10px]">{shortDate(d.iso).replace(/^\w+\s/, "")}</div>
              </div>
              {d.blocks.length === 0 ? (
                <div className="text-text-muted text-[10px] py-2">—</div>
              ) : (
                <ul className="space-y-1">
                  {d.blocks.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => setSelectedId(b.id)}
                        aria-label={`${b.title}, ${timeLabel(b.startMinute)} to ${timeLabel(b.endMinute)} on ${DAY_LABELS_LONG[d.weekdayIndex]}`}
                        className={`w-full text-left rounded-md px-2 py-1 border text-[11px] ${
                          conflictBlockIds.has(b.id)
                            ? "border-status-danger/50 bg-status-danger/10"
                            : b.type === "fixed"
                              ? "border-border-subtle bg-surface-raised"
                              : "border-border-subtle bg-surface-inset"
                        } ${selectedId === b.id ? "ring-2 ring-border-focus" : ""}`}
                      >
                        <div className="text-text-secondary">
                          {timeLabel(b.startMinute)}–{timeLabel(b.endMinute)}
                        </div>
                        <div className="text-text-primary truncate">{b.title}</div>
                        <div className="flex gap-1 mt-0.5">
                          <span className="text-text-muted">{b.type}</span>
                          {b.locked && <span className="text-text-muted">· locked</span>}
                          {b.actionId && <span className="text-text-muted">· action</span>}
                          {b.date == null && <span className="text-text-muted">· weekly</span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <BlockDetailPanel
          block={selected}
          actionTitle={selectedAction?.title ?? null}
          actionStatus={selectedAction?.status ?? null}
          actionDeleted={!!selected.actionId && !selectedAction}
          onClose={() => setSelectedId(null)}
          onToggleLock={() => toggleBlockLock(selected.id)}
          onDelete={async () => {
            await deleteBlock(selected.id);
            setSelectedId(null);
          }}
          onMove={(day, start, end) => moveBlock(selected.id, { day, startMinute: start, endMinute: end, date: null })}
          onOpenAction={() => selectedAction && navigate("/systems")}
        />
      )}
    </div>
  );
}

function BlockDetailPanel({
  block,
  actionTitle,
  actionStatus,
  actionDeleted,
  onClose,
  onToggleLock,
  onDelete,
  onMove,
  onOpenAction,
}: {
  block: PlanningBlock;
  actionTitle: string | null;
  actionStatus: string | null;
  actionDeleted: boolean;
  onClose: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onMove: (day: number, start: number, end: number) => void;
  onOpenAction: () => void;
}) {
  const [day, setDay] = useState(block.day);
  const [start, setStart] = useState(timeLabel(block.startMinute));
  const [end, setEnd] = useState(timeLabel(block.endMinute));
  const [err, setErr] = useState<string | null>(null);

  const parse = (v: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
    if (!m) return null;
    const mins = Number(m[1]) * 60 + Number(m[2]);
    return mins >= 0 && mins <= 24 * 60 ? mins : null;
  };

  return (
    <Card title="Block details" action={<button onClick={onClose} className="text-text-muted text-xs">Close</button>}>
      <div className="space-y-2 text-sm">
        <div className="text-text-primary font-medium">{block.title}</div>
        <div className="text-text-muted text-xs">
          {block.type} · {block.locked ? "locked" : "unlocked"} · {block.source} · status: {block.status}
        </div>
        {block.actionId ? (
          actionDeleted ? (
            <div className="text-text-muted text-xs">
              Linked Action was deleted — this block is kept as planning history (title shown above).
            </div>
          ) : (
            <div className="text-text-secondary text-xs">
              Linked Action: <span className="text-text-primary">{actionTitle}</span> — current status{" "}
              <b>{actionStatus}</b> (read live; not copied here).{" "}
              <button onClick={onOpenAction} className="underline">
                Open
              </button>
            </div>
          )
        ) : (
          <div className="text-text-muted text-xs">No linked Action.</div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-[11px]">Move to day</span>
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1 text-xs"
            >
              {DAY_LABELS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-[11px]">Start</span>
            <input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-[11px]">End</span>
            <input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1 text-xs"
            />
          </label>
        </div>
        {err && <p className="text-status-danger text-[11px]">{err}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => {
              const s = parse(start);
              const e2 = parse(end);
              if (s == null || e2 == null) return setErr("Times must be HH:MM.");
              if (e2 <= s) return setErr("End must be after start.");
              setErr(null);
              onMove(day, s, e2);
            }}
            className="px-3 py-1 rounded-md bg-action-primary text-text-inverse text-xs"
          >
            Move
          </button>
          <button onClick={onToggleLock} className="px-3 py-1 rounded-md border border-border-subtle text-xs">
            {block.locked ? "Unlock" : "Lock"}
          </button>
          <button onClick={onDelete} className="px-3 py-1 rounded-md text-text-muted text-xs hover:text-status-danger">
            Delete
          </button>
        </div>
        <p className="text-text-muted text-[10px]">
          Moving time never creates a new Action and never changes the Action's status.
        </p>
      </div>
    </Card>
  );
}
