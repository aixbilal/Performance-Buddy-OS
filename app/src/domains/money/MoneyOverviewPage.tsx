import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { StatCard } from "../../components/StatCard";
import { useMoney } from "./store";

const STATUS_TONE = {
  "within-budget": "success",
  "approaching-limit": "warning",
  "over-budget": "danger",
} as const;

export function MoneyOverviewPage() {
  const navigate = useNavigate();
  const money = useMoney();

  const hasAnything =
    money.transactions.length > 0 ||
    money.budgets.length > 0 ||
    money.savingsGoals.length > 0 ||
    money.plannedExpenses.length > 0;
  const upcoming = money.getUpcomingPlannedExpenses(30);
  const activeGoals = money.savingsGoals.filter((g) => !g.archived);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Money</h2>
          <p className="text-text-muted text-sm">
            Manual tracking. Figures below are your recorded totals — not a verified bank balance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={money.saveState} />
          <Link
            to="/money/insights"
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Insights
          </Link>
          <Link
            to="/money/budget"
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Budget &amp; Savings
          </Link>
          <button
            onClick={() => navigate("/money/transactions")}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Transactions
          </button>
        </div>
      </div>

      {money.loadError && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-md px-4 py-3 text-xs text-status-warning">
          Your saved money data couldn't be read ({money.loadError}). Nothing was deleted.
        </div>
      )}

      {money.loaded && !hasAnything ? (
        <Card>
          <EmptyState
            icon="💰"
            title="Nothing tracked yet"
            description="Record a transaction, set a category budget, or add a savings goal. An empty ledger means PBOS has nothing recorded — it does not mean your bank balance is zero."
            primaryAction={{
              label: "Add a transaction",
              onClick: () => navigate("/money/transactions"),
            }}
            secondaryAction={{ label: "Set a budget", onClick: () => navigate("/money/budget") }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Tracked net" value={`Rs ${money.balance.toLocaleString()}`} />
            <StatCard label="Income (recorded)" value={`Rs ${money.incomeTotal.toLocaleString()}`} />
            <StatCard label="Spent (recorded)" value={`Rs ${money.expenseTotal.toLocaleString()}`} />
            <StatCard
              label="Moved to savings"
              value={`Rs ${money.savingsTransferredTotal.toLocaleString()}`}
              sub={
                <span className="text-text-disabled text-[10px]">
                  A movement, not spending.
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card
              title="Spending by category"
              action={
                <Link
                  to="/money/transactions"
                  className="text-text-secondary text-xs underline hover:text-text-primary"
                >
                  All transactions
                </Link>
              }
            >
              {money.categoryTotals.length === 0 ? (
                <div className="text-text-muted text-xs">No expense transactions recorded yet.</div>
              ) : (
                <div className="space-y-1">
                  {money.categoryTotals.map((c) => (
                    <div
                      key={c.category}
                      className="flex items-center justify-between py-1 text-sm"
                    >
                      <span className="text-text-secondary">{c.category}</span>
                      <span className="text-text-primary tabular-nums">
                        Rs {c.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Upcoming planned expenses">
              <p className="text-text-disabled text-[10px] mb-2">
                Not counted in "Spent" until an actual transaction records each one.
              </p>
              {upcoming.length === 0 ? (
                <div className="text-text-muted text-xs">Nothing planned in the next 30 days.</div>
              ) : (
                <div className="space-y-1">
                  {upcoming.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-text-secondary">
                        {p.title} <span className="text-text-muted text-xs">· {p.dueDate}</span>
                      </span>
                      <span className="text-status-warning tabular-nums">
                        Rs {p.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-sm font-medium">
                    <span className="text-text-secondary">Planned (pending) total</span>
                    <span className="text-status-warning tabular-nums">
                      Rs {money.pendingPlannedTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card
            title="Budgets"
            action={
              <Link
                to="/money/budget"
                className="text-text-secondary text-xs underline hover:text-text-primary"
              >
                Manage
              </Link>
            }
          >
            {money.budgets.length === 0 ? (
              <div className="text-text-muted text-xs">
                No budgets configured — a setup gap, not "0 budget".
              </div>
            ) : (
              <div className="space-y-3">
                {money.budgets.map((b) => {
                  const r = money.getBudgetResult(b);
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className="text-text-primary">
                          {b.category}{" "}
                          <span className="text-text-disabled text-[11px]">· {b.period}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary text-xs tabular-nums">
                            Rs {r.spent.toLocaleString()} / {b.limitAmount.toLocaleString()}
                          </span>
                          <Badge tone={r.hasData ? STATUS_TONE[r.status] : "neutral"}>
                            {r.hasData ? r.status.replace("-", " ") : "no data"}
                          </Badge>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-inset overflow-hidden">
                        <div
                          className="h-full bg-action-primary"
                          style={{ width: `${Math.min(100, r.percentUsed)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title="Savings goals"
            action={
              <Link
                to="/money/budget"
                className="text-text-secondary text-xs underline hover:text-text-primary"
              >
                Manage
              </Link>
            }
          >
            {activeGoals.length === 0 ? (
              <div className="text-text-muted text-xs">No savings goals yet.</div>
            ) : (
              activeGoals.map((g) => {
                const p = money.getSavingsProgress(g);
                return (
                  <div key={g.id} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-text-primary">{g.title}</span>
                      <span className="text-text-secondary text-xs tabular-nums">
                        Rs {p.currentAmount.toLocaleString()} / {g.targetAmount.toLocaleString()}
                        {p.percent !== null ? ` · ${p.percent}%` : ""}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-inset overflow-hidden">
                      <div
                        className="h-full bg-action-primary"
                        style={{ width: `${Math.min(100, p.percent ?? 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </>
      )}
    </div>
  );
}
