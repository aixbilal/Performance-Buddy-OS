import { useId, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState, ErrorState } from "../../components/StateViews";
import { TextField } from "../../components/FormFields";
import { usePlanning } from "./store";
import { usePerformance } from "../performance/store";
import { DAY_LABELS, timeLabel } from "./mockData";
import type { PlanningBlockInput } from "./types";
import type { ScheduleProposal } from "./engine";
import { Button } from "../../components/Button";

const FRAGILITY_LABEL = {
  valid: "Healthy buffer",
  "valid-fragile": "Valid, but fragile — very little buffer",
  exceeds: "Exceeds capacity",
} as const;
const FRAGILITY_TONE = { valid: "success", "valid-fragile": "warning", exceeds: "danger" } as const;

function parseTime(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins <= 24 * 60 ? mins : null;
}
const isoOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

type BlockForm = {
  title: string;
  day: number;
  useDate: boolean;
  date: string;
  start: string;
  end: string;
  type: "fixed" | "flexible";
  actionId: string;
};
const EMPTY_FORM: BlockForm = {
  title: "",
  day: 0,
  useDate: false,
  date: "",
  start: "14:00",
  end: "15:00",
  type: "flexible",
  actionId: "",
};

function LabeledSelect(props: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-text-secondary text-xs font-medium">
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="bg-surface-inset border border-border-subtle rounded-md px-3 py-2 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        {props.children}
      </select>
    </div>
  );
}

export function PlannerPage() {
  const {
    blocks,
    capacity,
    conflicts,
    violations,
    weeklyScheduledMinutes,
    fragility,
    checkFit,
    createBlock,
    deleteBlock,
    toggleBlockLock,
    setCapacity,
    generateProposal,
    applyProposal,
    todayIso,
    loaded,
    loadError,
  } = usePlanning();
  const { actions } = usePerformance();
  const navigate = useNavigate();

  const [form, setForm] = useState<BlockForm>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);

  // capacity editor local state (hours)
  const [dailyH, setDailyH] = useState(String(capacity.dailyCapacityMinutes / 60));
  const [weeklyH, setWeeklyH] = useState(String(capacity.weeklyCapacityMinutes / 60));
  const [capMsg, setCapMsg] = useState<string | null>(null);

  // proposal (transient UI state — NOT persisted until Apply)
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const dayViolations = violations.filter((v) => v.scope === "day");
  const weekViolation = violations.find((v) => v.scope === "week");

  const scheduledActionIds = useMemo(
    () => new Set(blocks.map((b) => b.actionId).filter(Boolean) as string[]),
    [blocks],
  );
  const schedulableActions = useMemo(
    () => actions.filter((a) => a.status !== "done" && a.status !== "cancelled"),
    [actions],
  );
  const unscheduledActions = useMemo(
    () => schedulableActions.filter((a) => !scheduledActionIds.has(a.id)),
    [schedulableActions, scheduledActionIds],
  );

  // Day-17: LOADING ≠ EMPTY — never render an empty planner grid while the
  // canonical Planning store is still resolving.
  if (loadError) {
    return <ErrorState title="The planner couldn't load" detail={loadError} onRetry={() => window.location.reload()} />;
  }
  if (!loaded) {
    return <LoadingState label="Loading your plan…" />;
  }

  const submit = async () => {
    setFeedback(null);
    const start = parseTime(form.start);
    const end = parseTime(form.end);
    if (!form.title.trim()) return setFeedback("Give the block a title.");
    if (form.useDate && !isoOk(form.date)) return setFeedback("Date must be YYYY-MM-DD.");
    if (start == null || end == null) return setFeedback("Times must be HH:MM.");
    if (end <= start) return setFeedback("End time must be after the start time.");

    const linked = form.actionId ? actions.find((a) => a.id === form.actionId) ?? null : null;
    const candidate = {
      id: "candidate",
      title: form.title.trim(),
      domain: linked ? "Linked Action" : "Planning",
      day: Number(form.day),
      startMinute: start,
      endMinute: end,
      type: form.type,
      locked: false,
      actionId: form.actionId || null,
    };
    const fit = checkFit(candidate);
    if (!fit.fits) return setFeedback(`Could Not Fit: ${fit.reason}`);

    const input: PlanningBlockInput = {
      title: candidate.title,
      domain: candidate.domain,
      actionId: candidate.actionId,
      day: candidate.day,
      date: form.useDate ? form.date : null,
      startMinute: start,
      endMinute: end,
      type: form.type,
      locked: false,
      source: "manual",
      status: "scheduled",
    };
    const res = await createBlock(input);
    if (!res.ok) return setFeedback(Object.values(res.errors)[0] ?? "Could not create block.");
    setForm(EMPTY_FORM);
    setFeedback("Block added.");
  };

  const scheduleForToday = async (actionId: string, title: string, estMinutes: number | null) => {
    const dur = estMinutes && estMinutes > 0 ? estMinutes : 45;
    // first free 30-min-aligned slot 8:00–22:00 today
    for (let start = 8 * 60; start + dur <= 22 * 60; start += 30) {
      const fit = checkFit({
        id: "candidate",
        title,
        domain: "Linked Action",
        day: 0,
        startMinute: start,
        endMinute: start + dur,
        type: "flexible",
        locked: false,
        actionId,
      });
      if (fit.fits) {
        await createBlock({
          title,
          domain: "Linked Action",
          actionId,
          day: 0,
          date: todayIso,
          startMinute: start,
          endMinute: start + dur,
          type: "flexible",
          locked: false,
          source: "manual",
          status: "scheduled",
        });
        setFeedback(`Scheduled “${title}” for today at ${timeLabel(start)}.`);
        return;
      }
    }
    setFeedback(`Could Not Fit “${title}” today — free some time or adjust capacity.`);
  };

  const saveCapacity = async () => {
    const d = Number(dailyH);
    const w = Number(weeklyH);
    if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(w) || w <= 0) {
      return setCapMsg("Enter positive hour values.");
    }
    if (d * 60 > w * 60) return setCapMsg("Daily capacity cannot exceed weekly capacity.");
    await setCapacity({ dailyCapacityMinutes: Math.round(d * 60), weeklyCapacityMinutes: Math.round(w * 60) });
    setCapMsg("Capacity saved.");
  };

  const runGenerate = () => {
    const candidates = unscheduledActions
      .filter((a) => picked.has(a.id))
      .map((a) => ({ actionId: a.id, title: a.title, estMinutes: a.estMinutes }));
    if (candidates.length === 0) {
      setProposal({ proposed: [], couldNotFit: [] });
      return;
    }
    setProposal(generateProposal(candidates));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="t-h2 text-text-primary">Planner</h2>
          <p className="text-text-muted text-sm">
            Decide when work happens. Scheduling a block never marks its Action done — that stays Action-owned.
          </p>
        </div>
        <button
          onClick={() => navigate("/calendar")}
          className="px-3 py-1 rounded-md border border-border-subtle text-text-secondary text-xs hover:bg-surface-inset"
        >
          Open Calendar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Conflicts (direct overlap)</div>
          <div className="text-text-primary text-lg font-semibold" data-testid="conflict-count">
            {conflicts.length}
          </div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Capacity Violations</div>
          <div className="text-text-primary text-lg font-semibold" data-testid="violation-count">
            {violations.length}
          </div>
          <p className="text-text-muted text-[10px] mt-1">A different problem from conflicts — checked separately.</p>
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
            const b2 = blocks.find((b) => b.id === c.blockBId);
            return (
              <div key={i} className="bg-status-danger/10 border border-status-danger/30 rounded-md p-3 mb-2 text-sm">
                <span className="text-text-primary">{DAY_LABELS[c.day]} · </span>
                <span className="text-text-secondary">
                  {a?.title} and {b2?.title} overlap by {c.overlapMinutes} minutes
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

      {/* --- Work needing placement --- */}
      <Card title="Work needing placement">
        {unscheduledActions.length === 0 ? (
          <p className="text-text-muted text-xs">
            Every non-done Action has at least one Planning Block. Create Actions under a System to plan more.
          </p>
        ) : (
          <ul className="space-y-1">
            {unscheduledActions.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm"
              >
                <label className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={picked.has(a.id)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(a.id);
                      else next.delete(a.id);
                      setPicked(next);
                    }}
                    aria-label={`Include ${a.title} in the generated plan`}
                  />
                  <span className="text-text-primary truncate">{a.title}</span>
                  <span className="text-text-muted text-xs">{a.estMinutes ? `${a.estMinutes}m` : "no estimate"}</span>
                </label>
                <button
                  onClick={() => scheduleForToday(a.id, a.title, a.estMinutes)}
                  className="px-2 py-1 rounded-md border border-border-subtle text-xs text-text-secondary hover:bg-surface-inset shrink-0"
                >
                  Schedule today
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={runGenerate} disabled={picked.size === 0}>
            Generate proposal
          </Button>
          <span className="text-text-muted text-[10px]">
            Deterministic — no AI. Fills flexible slots around your fixed &amp; locked blocks.
          </span>
        </div>
      </Card>

      {proposal && (
        <Card
          title="Proposed changes — review before applying"
          action={
            <button onClick={() => setProposal(null)} className="text-text-muted text-xs">
              Discard
            </button>
          }
        >
          <p className="text-text-secondary text-xs mb-2">
            {blocks.filter((b) => b.source === "manual" || b.locked).length} manual/locked block(s) kept unchanged.
            {" "}
            {proposal.proposed.length} block(s) proposed.
          </p>
          {proposal.proposed.length > 0 && (
            <ul className="space-y-1 mb-2">
              {proposal.proposed.map((p, i) => (
                <li key={i} className="text-text-primary text-xs">
                  + {DAY_LABELS[p.day]} {timeLabel(p.startMinute)}–{timeLabel(p.endMinute)} · {p.title}
                </li>
              ))}
            </ul>
          )}
          {proposal.couldNotFit.length > 0 && (
            <div className="bg-status-warning/10 border border-status-warning/30 rounded-md p-2 mb-2">
              <div className="text-status-warning text-xs font-medium">Could Not Fit</div>
              {proposal.couldNotFit.map((c, i) => (
                <div key={i} className="text-text-secondary text-[11px]">
                  {c.title} — {c.reason}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="primary" onClick={async () => { await applyProposal(proposal); setProposal(null); setPicked(new Set()); setFeedback("Proposal applied. Locked & manual blocks were preserved."); }} disabled={proposal.proposed.length === 0}>
              Apply
            </Button>
            <Button variant="secondary" onClick={() => setProposal(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* --- Plan Builder --- */}
      <Card title="Add a Block (Plan Builder)">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <TextField
              label="Block title"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="e.g. DS Mastery session"
            />
          </div>
          <LabeledSelect
            label="Link an Action"
            value={form.actionId}
            onChange={(v) => {
              const a = actions.find((x) => x.id === v);
              setForm({ ...form, actionId: v, title: form.title || (a ? a.title : "") });
            }}
          >
            <option value="">— none —</option>
            {schedulableActions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </LabeledSelect>
          <LabeledSelect
            label="Block type"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v as "fixed" | "flexible" })}
          >
            <option value="flexible">flexible</option>
            <option value="fixed">fixed (protected)</option>
          </LabeledSelect>
          <label className="col-span-2 flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={form.useDate}
              onChange={(e) => setForm({ ...form, useDate: e.target.checked })}
            />
            Pin to a specific date (otherwise it repeats every week on the day you pick)
          </label>
          {form.useDate ? (
            <TextField
              label="Block date"
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
              placeholder={todayIso}
              hint="YYYY-MM-DD"
            />
          ) : (
            <LabeledSelect
              label="Weekday"
              value={form.day}
              onChange={(v) => setForm({ ...form, day: Number(v) })}
            >
              {DAY_LABELS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </LabeledSelect>
          )}
          <div />
          <TextField
            label="Start time"
            value={form.start}
            onChange={(v) => setForm({ ...form, start: v })}
            hint="HH:MM"
          />
          <TextField
            label="End time"
            value={form.end}
            onChange={(v) => setForm({ ...form, end: v })}
            hint="HH:MM"
          />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Button variant="primary" type="submit">
            Add Block
          </Button>
          {feedback && (
            <span className="text-text-secondary text-xs" role="status" data-testid="planner-feedback">
              {feedback}
            </span>
          )}
        </div>
        </form>
      </Card>

      {/* --- Capacity editor --- */}
      <Card title="Capacity">
        <p className="text-text-muted text-xs mb-2">
          Planning owns your planning capacity. Empty calendar space is not the same as available capacity —
          the planner refuses work past these limits with an explicit “Could Not Fit”.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveCapacity();
          }}
        >
          <div className="grid grid-cols-2 gap-3 text-sm max-w-sm">
            <TextField
              label="Daily capacity in hours"
              value={dailyH}
              onChange={setDailyH}
            />
            <TextField
              label="Weekly capacity in hours"
              value={weeklyH}
              onChange={setWeeklyH}
            />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <Button variant="primary" type="submit">
              Save capacity
            </Button>
            {capMsg && (
              <span className="text-text-secondary text-xs" role="status">
                {capMsg}
              </span>
            )}
          </div>
        </form>
      </Card>

      {/* --- This week --- */}
      <Card title="This Week">
        {blocks.length === 0 ? (
          <EmptyState
            icon="🗓"
            title="No scheduled work yet"
            description="Your week is open. Add a block below, or pick Actions above and generate a plan."
            primaryAction={{ label: "Open Calendar", onClick: () => navigate("/calendar") }}
          />
        ) : (
          <div className="space-y-1">
            {blocks.map((b) => (
              <div
                key={b.id}
                data-testid={`week-row-${b.id}`}
                className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-sm"
              >
                <span className="text-text-primary">
                  {b.date ?? DAY_LABELS[b.day]} {timeLabel(b.startMinute)}–{timeLabel(b.endMinute)} · {b.title}
                </span>
                <div className="flex items-center gap-1.5">
                  {b.actionId && <Badge tone="neutral">linked</Badge>}
                  {b.source === "generated" && <Badge tone="neutral">generated</Badge>}
                  {b.locked && <Badge tone="neutral">Locked</Badge>}
                  <Badge>{b.type}</Badge>
                  <button
                    onClick={() => toggleBlockLock(b.id)}
                    aria-label={`${b.locked ? "Unlock" : "Lock"} ${b.title}`}
                    className="text-text-muted text-xs hover:text-text-secondary"
                  >
                    {b.locked ? "Unlock" : "Lock"}
                  </button>
                  <button
                    onClick={() => deleteBlock(b.id)}
                    aria-label={`Delete ${b.title}`}
                    className="text-text-muted text-xs hover:text-status-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
