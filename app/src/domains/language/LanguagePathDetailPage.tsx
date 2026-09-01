import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useKnowledge } from "../knowledge/store";
import { useRoutine } from "../routine/store";
import { useLanguage } from "./store";
import { LANGUAGE_UNIT_KINDS, type LanguageUnitKind } from "./types";
import { Button } from "../../components/Button";

const STATUS_TONE = { active: "success", paused: "warning", completed: "neutral" } as const;

export function LanguagePathDetailPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const lang = useLanguage();
  const { topics } = useKnowledge();
  const { routines } = useRoutine();
  const path = lang.getPath(pathId ?? "");

  const [uTitle, setUTitle] = useState("");
  const [uKind, setUKind] = useState<LanguageUnitKind>("lesson");
  const [uTopic, setUTopic] = useState("");
  const [uErr, setUErr] = useState<string | null>(null);

  if (!path) {
    return (
      <div className="space-y-3">
        <Link to="/language" className="text-text-muted text-xs hover:text-text-secondary">
          ← Reading &amp; Language
        </Link>
        <p className="text-text-muted text-sm">Language path not found.</p>
      </div>
    );
  }

  const units = lang.getUnitsForPath(path.id);
  const progress = lang.getPathProgress(path.id);
  const next = lang.getNextUnit(path.id);
  const sessions = lang.getSessionsForPath(path.id);
  const linkedRoutine = path.relatedRoutineId
    ? routines.find((r) => r.id === path.relatedRoutineId)
    : undefined;
  const topicTitle = (id: string | null) =>
    id ? (topics.find((t) => t.id === id)?.title ?? "unknown concept") : null;

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= units.length) return;
    const ids = units.map((u) => u.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    lang.reorderUnits(path.id, ids);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/language" className="text-text-muted text-xs hover:text-text-secondary">
            ← Reading &amp; Language
          </Link>
          <h2 className="t-h2 text-text-primary mt-1">
            {path.title}
            {path.archived && (
              <span className="ml-2">
                <Badge>archived</Badge>
              </span>
            )}
          </h2>
          <p className="text-text-muted text-sm">
            {path.language}
            {path.targetLevel ? ` → ${path.targetLevel}` : ""} · curriculum progress, not mastery
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={lang.saveState} />
          <Badge tone={STATUS_TONE[path.status]}>{path.status}</Badge>
          <Button variant="primary" onClick={() => navigate(`/language/paths/${path.id}/session`)}>
            Start Learning Session
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/language/paths/${path.id}/edit`)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => lang.archivePath(path.id, !path.archived)}>
            {path.archived ? "Unarchive" : "Archive"}
          </Button>
          <button
            onClick={() => {
              lang.deletePath(path.id);
              navigate("/language");
            }}
            className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-status-danger"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Path progress (units)</div>
          <div className="text-text-primary text-lg font-semibold">
            {progress.percent === null ? "—" : `${progress.percent}%`}
          </div>
          <p className="text-text-muted text-[11px] mt-1">
            {progress.percent === null
              ? "No units yet — not 0%."
              : `${progress.completed} of ${progress.total} units. Curriculum position, not skill evidence.`}
          </p>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Practice Routine</div>
          {linkedRoutine ? (
            <div>
              <div className="flex items-center justify-between">
                <Link
                  to={`/routine/${linkedRoutine.id}`}
                  className="text-text-primary text-sm underline hover:text-text-secondary"
                >
                  {linkedRoutine.title}
                </Link>
                <button
                  onClick={() => lang.unlinkPathRoutine(path.id)}
                  className="text-text-muted text-[11px] hover:text-text-secondary underline"
                >
                  Unlink
                </button>
              </div>
              <p className="text-text-muted text-[11px] mt-1">
                A reference only — the routine owns cadence and check-in history, this path owns
                curriculum progress.
              </p>
            </div>
          ) : path.relatedRoutineId ? (
            <p className="text-text-muted text-xs">
              Linked routine no longer exists — the link was cleared. This path is unaffected.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="path-link-routine">
                Link a Routine to {path.title}
              </label>
              <select
                id="path-link-routine"
                defaultValue=""
                onChange={(e) => e.target.value && lang.linkPathRoutine(path.id, e.target.value)}
                className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <option value="">No routine linked</option>
                {routines
                  .filter((r) => !r.archived)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </select>
              <span className="text-text-muted text-[11px]">Routine owns cadence, not progress.</span>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Units"
        action={next ? <span className="text-text-muted text-[11px]">next: {next.title}</span> : null}
      >
        <form
          className="mb-4 border border-border-subtle rounded-md p-3 space-y-2"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await lang.createUnit(path.id, {
              title: uTitle,
              kind: uKind,
              knowledgeTopicId: uTopic || null,
            });
            if (res.ok) {
              setUTitle("");
              setUKind("lesson");
              setUTopic("");
              setUErr(null);
            } else {
              setUErr(res.errors._ ?? Object.values(res.errors)[0] ?? "Invalid unit.");
            }
          }}
        >
          <div className="grid grid-cols-[1fr_130px_1fr_auto] gap-2 items-end">
            <label className="text-text-secondary text-xs">
              Unit title
              <input
                value={uTitle}
                onChange={(e) => setUTitle(e.target.value)}
                aria-label="Unit title"
                placeholder="e.g. Basic Introductions"
                className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </label>
            <label className="text-text-secondary text-xs">
              Kind
              <select
                value={uKind}
                onChange={(e) => setUKind(e.target.value as LanguageUnitKind)}
                aria-label="Unit kind"
                className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                {LANGUAGE_UNIT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-text-secondary text-xs">
              Knowledge concept (optional)
              <select
                value={uTopic}
                onChange={(e) => setUTopic(e.target.value)}
                aria-label="Unit knowledge concept"
                className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <option value="">— none —</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="primary" type="submit">
              Add Unit
            </Button>
          </div>
          {uErr && <p className="text-status-danger text-[11px]">{uErr}</p>}
        </form>

        {units.length === 0 ? (
          <div className="text-text-muted text-xs">No units yet.</div>
        ) : (
          <div className="space-y-1">
            {units.map((u, i) => (
              <div
                key={u.id}
                className="flex items-center gap-2 py-2 border-b border-border-subtle last:border-0"
              >
                <input
                  type="checkbox"
                  checked={u.completed}
                  aria-label={`Mark ${u.title} complete`}
                  onChange={() => lang.toggleUnit(u.id)}
                  className="accent-action-primary"
                />
                <span
                  className={`flex-1 text-sm ${u.completed ? "text-text-muted line-through" : "text-text-primary"}`}
                >
                  {u.title}{" "}
                  <span className="text-text-muted text-[11px]">
                    · {u.kind}
                    {u.knowledgeTopicId ? ` · ${topicTitle(u.knowledgeTopicId)}` : ""}
                  </span>
                </span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${u.title} up`}
                  className="text-text-muted text-[11px] hover:text-text-secondary disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === units.length - 1}
                  aria-label={`Move ${u.title} down`}
                  className="text-text-muted text-[11px] hover:text-text-secondary disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => lang.deleteUnit(u.id)}
                  className="text-text-muted text-[11px] hover:text-status-danger underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Learning Sessions (${sessions.length})`}>
        <p className="text-text-muted text-[11px] mb-2">
          Actual practice events. Minutes and completion are activity — they never mark language
          knowledge as mastered.
        </p>
        {sessions.length === 0 ? (
          <div className="text-text-muted text-xs">No sessions logged yet.</div>
        ) : (
          <div className="space-y-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
              >
                <span className="text-text-primary text-sm">
                  {s.date} · {s.activity}
                  {s.unitId ? (
                    <span className="text-text-muted text-[11px]">
                      {" "}
                      · {units.find((u) => u.id === s.unitId)?.title ?? "unit removed"}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-text-muted text-xs">
                  {s.durationMinutes} min
                  {s.recallScore !== null ? ` · recall ${s.recallScore}/${s.recallMax}` : ""}
                  <button
                    onClick={() => lang.deleteSession(s.id)}
                    aria-label={`Delete session on ${s.date}`}
                    className="text-[11px] hover:text-status-danger underline"
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
