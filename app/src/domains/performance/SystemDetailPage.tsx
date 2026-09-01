import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { usePerformance } from "./store";
import {
  ActionForm,
  emptyActionForm,
  ACTION_STATUS_LABEL,
  type ActionFormValues,
} from "./ActionForm";
import { SystemForm } from "./SystemForm";
import { ACTION_STATUSES, type Action, type ActionStatus } from "./types";

const PRIORITY_TONE = { high: "danger", normal: "warning", low: "neutral" } as const;

function ActionRow({
  action,
  index,
  count,
  onStatus,
  onEdit,
  onDelete,
  onMove,
}: {
  action: Action;
  index: number;
  count: number;
  onStatus: (s: ActionStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex flex-col">
          <button
            aria-label={`Move ${action.title} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="text-text-disabled hover:text-text-secondary disabled:opacity-30 text-[10px] leading-none"
          >
            ▲
          </button>
          <button
            aria-label={`Move ${action.title} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            className="text-text-disabled hover:text-text-secondary disabled:opacity-30 text-[10px] leading-none"
          >
            ▼
          </button>
        </div>
        <div className="min-w-0">
          <div className="text-text-primary text-sm truncate">{action.title}</div>
          <div className="text-text-muted text-xs truncate">
            {[action.context, action.estMinutes ? `${action.estMinutes}m` : null, action.timing]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge tone={PRIORITY_TONE[action.priority]}>{action.priority}</Badge>
        <label className="sr-only" htmlFor={`st-${action.id}`}>
          Status for {action.title}
        </label>
        <select
          id={`st-${action.id}`}
          value={action.status}
          onChange={(e) => onStatus(e.target.value as ActionStatus)}
          className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          {ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ACTION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button onClick={onEdit} className="text-text-muted hover:text-text-secondary text-xs">
          Edit
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${action.title}`}
          className="text-text-muted hover:text-status-danger text-xs"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function SystemDetailPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const {
    loaded,
    getSystem,
    goalsForSystem,
    actionsForSystem,
    systemHealth,
    updateSystem,
    deleteSystem,
    toggleSystemStar,
    createAction,
    updateAction,
    setActionStatus,
    deleteAction,
    reorderActions,
    saveState,
    saveError,
  } = usePerformance();

  const [editingSystem, setEditingSystem] = useState(false);
  const [addingAction, setAddingAction] = useState(false);
  const [editActionId, setEditActionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!loaded) return <LoadingState label="Loading…" />;

  const system = systemId ? getSystem(systemId) : undefined;
  if (!system) {
    return (
      <div className="space-y-3">
        <Link to="/systems" className="text-text-muted text-xs hover:text-text-secondary">
          ← Systems Overview
        </Link>
        <p className="text-text-muted text-sm">That system doesn't exist.</p>
      </div>
    );
  }

  const actions = actionsForSystem(system.id);
  const goals = goalsForSystem(system.id);
  const health = systemHealth(system.id);

  const move = (a: Action, dir: -1 | 1) => {
    const ids = actions.map((x) => x.id);
    const i = ids.indexOf(a.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderActions(system.id, ids);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-text-muted text-xs">
            <Link to="/systems" className="hover:text-text-secondary">
              Systems Overview
            </Link>{" "}
            / {system.title}
          </div>
          <h2 className="text-text-primary text-xl font-semibold mt-1">
            {system.title}{" "}
            <button
              onClick={() => toggleSystemStar(system.id)}
              aria-label={system.starred ? "Unstar system" : "Star system"}
              className={system.starred ? "text-accent-primary" : "text-text-disabled hover:text-text-secondary"}
            >
              ★
            </button>
          </h2>
          {system.description && <p className="text-text-muted text-sm">{system.description}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge>{system.domain}</Badge>
            {system.cadence && <Badge>{system.cadence}</Badge>}
            {system.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <button
            onClick={() => setEditingSystem((e) => !e)}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Edit System
          </button>
          <button
            onClick={() => setAddingAction(true)}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            + Add Action
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-status-danger/10 border border-status-danger/30 rounded-md px-4 py-2 text-xs text-status-danger">
          Last change couldn't be saved: {saveError}
        </div>
      )}

      {editingSystem && (
        <Card title="Edit System">
          <SystemForm
            initial={{
              title: system.title,
              description: system.description,
              domain: system.domain,
              cadence: system.cadence,
              tags: system.tags.join(", "),
            }}
            submitLabel="Save System"
            busy={saveState === "saving"}
            onCancel={() => setEditingSystem(false)}
            onSubmit={async (input) => {
              const res = await updateSystem(system.id, input);
              if (res.ok) setEditingSystem(false);
              return res;
            }}
          />
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">System Health</div>
          {health.ratio === null ? (
            <div className="text-text-muted text-sm">{health.label}</div>
          ) : (
            <>
              <div className="text-text-primary text-lg font-semibold">{Math.round(health.ratio * 100)}%</div>
              <div className="text-text-secondary text-xs">
                {health.label} · from {health.sampleSize} action(s)
              </div>
            </>
          )}
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Actions</div>
          <div className="text-text-primary text-lg font-semibold">{actions.length}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Linked Goals</div>
          {goals.length === 0 ? (
            <div className="text-text-muted text-sm">None (that's fine)</div>
          ) : (
            <div className="space-y-0.5">
              {goals.map((g) => (
                <Link key={g.id} to={`/goals/${g.id}`} className="block text-text-secondary text-xs hover:underline">
                  {g.title}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title={`Actions (${actions.length})`}>
        {addingAction && (
          <div className="mb-3">
            <ActionForm
              initial={emptyActionForm()}
              submitLabel="Add Action"
              busy={saveState === "saving"}
              onCancel={() => setAddingAction(false)}
              onSubmit={async (input) => {
                const res = await createAction(system.id, input);
                if (res.ok) setAddingAction(false);
                return res;
              }}
            />
          </div>
        )}

        {actions.length === 0 && !addingAction ? (
          <div className="text-text-muted text-xs">
            No actions yet. Add the first concrete piece of work this system produces.
          </div>
        ) : (
          <div className="space-y-0">
            {actions.map((a, i) =>
              editActionId === a.id ? (
                <div key={a.id} className="py-2">
                  <ActionForm
                    initial={
                      {
                        title: a.title,
                        context: a.context,
                        status: a.status,
                        estMinutes: a.estMinutes ? String(a.estMinutes) : "",
                        priority: a.priority,
                        timing: a.timing,
                      } as ActionFormValues
                    }
                    submitLabel="Save Action"
                    busy={saveState === "saving"}
                    onCancel={() => setEditActionId(null)}
                    onSubmit={async (input) => {
                      const res = await updateAction(a.id, input);
                      if (res.ok) setEditActionId(null);
                      return res;
                    }}
                  />
                </div>
              ) : (
                <ActionRow
                  key={a.id}
                  action={a}
                  index={i}
                  count={actions.length}
                  onStatus={(s) => setActionStatus(a.id, s)}
                  onEdit={() => setEditActionId(a.id)}
                  onDelete={() => deleteAction(a.id)}
                  onMove={(dir) => move(a, dir)}
                />
              ),
            )}
          </div>
        )}
      </Card>

      <Card title="Danger zone">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-status-danger text-xs">
              Delete this system? Its actions become unlinked (not deleted); goal links are removed.
            </span>
            <button
              onClick={async () => {
                await deleteSystem(system.id);
                navigate("/systems");
              }}
              className="px-3 py-1.5 rounded-md bg-status-danger/20 text-status-danger text-xs font-medium"
            >
              Confirm delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
            >
              Keep
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-text-muted text-xs hover:text-status-danger"
          >
            Delete System
          </button>
        )}
      </Card>
    </div>
  );
}
