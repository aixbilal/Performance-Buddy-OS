import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/StateViews";
import { SaveIndicator } from "../../components/SaveIndicator";
import { usePerformance } from "./store";
import { SystemForm, emptySystemForm } from "./SystemForm";
import { DOMAINS, type Domain } from "./types";

export function SystemsOverviewPage() {
  const {
    loaded,
    systems,
    systemHealth,
    actionsForSystem,
    goalsForSystem,
    createSystem,
    setGoalSystemLink,
    getGoal,
    saveState,
    saveError,
  } = usePerformance();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const newForGoalId = params.get("newFor");

  const [creating, setCreating] = useState<boolean>(Boolean(newForGoalId));
  const [domainFilter, setDomainFilter] = useState<Domain | "all">("all");

  const newForGoal = newForGoalId ? getGoal(newForGoalId) : undefined;

  const filtered = useMemo(
    () => (domainFilter === "all" ? systems : systems.filter((s) => s.domain === domainFilter)),
    [systems, domainFilter],
  );

  if (!loaded) return <LoadingState label="Loading your systems…" />;

  const createPanel = (
    <Card title={newForGoal ? `New system for “${newForGoal.title}”` : "New System"}>
      <SystemForm
        initial={emptySystemForm(newForGoal?.domain)}
        submitLabel="Create System"
        busy={saveState === "saving"}
        onCancel={() => {
          setCreating(false);
          if (newForGoalId) {
            params.delete("newFor");
            setParams(params);
          }
        }}
        onSubmit={async (input) => {
          const res = await createSystem(input);
          if (res.ok) {
            if (newForGoalId) await setGoalSystemLink(newForGoalId, res.id, true);
            navigate(`/systems/${res.id}`);
          }
          return res;
        }}
      />
    </Card>
  );

  if (systems.length === 0 && !creating) {
    return (
      <EmptyState
        icon="⚙️"
        title="No systems yet"
        description="A system is a repeatable process — a study cycle, a training program, a review cadence. It's how goals actually get done."
        primaryAction={{ label: "Create System", onClick: () => setCreating(true) }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Systems</h2>
          <p className="text-text-muted text-sm">Your repeatable engines. A system can support several goals — or none.</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <button
            onClick={() => setCreating((c) => !c)}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            + Create System
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-status-danger/10 border border-status-danger/30 rounded-md px-4 py-2 text-xs text-status-danger">
          Last change couldn't be saved: {saveError}
        </div>
      )}

      {creating && createPanel}

      <div className="flex items-center gap-1 text-xs" role="tablist" aria-label="Filter by domain">
        {(["all", ...DOMAINS] as const).map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={domainFilter === d}
            onClick={() => setDomainFilter(d)}
            className={`px-2.5 py-1 rounded-md capitalize ${
              domainFilter === d ? "bg-surface-selected text-text-primary" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-text-muted text-xs">No systems in this domain.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((s) => {
            const h = systemHealth(s.id);
            const goals = goalsForSystem(s.id);
            return (
              <Link key={s.id} to={`/systems/${s.id}`}>
                <Card>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-text-primary text-sm font-medium">
                        {s.title} {s.starred && <span className="text-accent-primary">★</span>}
                      </div>
                      {s.description && <div className="text-text-muted text-xs mt-1">{s.description}</div>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge>{s.domain}</Badge>
                    {s.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={
                        h.state === "at-risk"
                          ? "text-status-danger"
                          : h.state === "drifting"
                            ? "text-status-warning"
                            : h.state === "healthy"
                              ? "text-status-success"
                              : "text-text-muted"
                      }
                    >
                      {h.ratio === null ? h.label : `${Math.round(h.ratio * 100)}% health · ${h.label}`}
                    </span>
                    <span className="text-text-muted">
                      {actionsForSystem(s.id).length} action(s)
                      {goals.length > 0 && ` · ${goals.length} goal(s)`}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
