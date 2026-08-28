import { useState } from "react";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useMoney } from "./store";
import type { TransactionType } from "./types";

const STATUS_TONE = {
  "within-budget": "success",
  "approaching-limit": "warning",
  "over-budget": "danger",
} as const;

export function MoneyOverviewPage() {
  const {
    balance,
    unallocated,
    incomeTotal,
    expenseTotal,
    categoryTotals,
    budgets,
    getBudgetResult,
    savingsGoals,
    getSavingsProgress,
    plannedExpenses,
    plannedTotal,
    addTransaction,
  } = useMoney();

  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("Food & Dining");
  const [type, setType] = useState<TransactionType>("expense");

  const submit = () => {
    if (amount <= 0) return;
    addTransaction({ type, amount, category, description: "", date: new Date().toISOString().slice(0, 10) });
    setAmount(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Money</h2>
        <p className="text-text-muted text-sm">Manual tracking — this is your recorded balance, not a verified bank figure.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Tracked Balance</div>
          <div className="text-text-primary text-lg font-semibold">Rs {balance.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Income (recorded)</div>
          <div className="text-text-primary text-lg font-semibold">Rs {incomeTotal.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Spent (recorded)</div>
          <div className="text-text-primary text-lg font-semibold">Rs {expenseTotal.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Currently Unallocated</div>
          <div className="text-text-primary text-lg font-semibold">Rs {unallocated.toLocaleString()}</div>
          <p className="text-text-disabled text-[10px] mt-1">Not "safe to spend" — only what's recorded.</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Spending by Category">
          <div className="space-y-1">
            {categoryTotals.map((c) => (
              <div key={c.category} className="flex items-center justify-between py-1 text-sm">
                <span className="text-text-secondary">{c.category}</span>
                <span className="text-text-primary">Rs {c.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Planned Expenses (not yet spent)">
          <p className="text-text-disabled text-[10px] mb-2">
            Excluded from spending totals until an actual transaction is recorded for it — per the locked rule.
          </p>
          <div className="space-y-1">
            {plannedExpenses.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1 text-sm">
                <span className="text-text-secondary">
                  {p.title} <span className="text-text-muted text-xs">· {p.dueDate}</span>
                </span>
                <span className="text-text-primary">Rs {p.amount.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-sm font-medium">
              <span className="text-text-secondary">Planned total</span>
              <span className="text-status-warning">Rs {plannedTotal.toLocaleString()}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Monthly Budgets">
        <div className="space-y-3">
          {budgets.map((b) => {
            const result = getBudgetResult(b);
            return (
              <div key={b.id}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-text-primary">{b.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary text-xs">
                      Rs {result.spent.toLocaleString()} / {b.limitAmount.toLocaleString()}
                    </span>
                    <Badge tone={STATUS_TONE[result.status]}>{result.status.replace("-", " ")}</Badge>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-inset overflow-hidden">
                  <div
                    className="h-full bg-action-primary"
                    style={{ width: `${Math.min(100, result.percentUsed)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Savings Goals">
        {savingsGoals.map((g) => {
          const progress = getSavingsProgress(g);
          return (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="text-text-primary">{g.title}</span>
                <span className="text-text-secondary text-xs">
                  Rs {g.currentAmount.toLocaleString()} / {g.targetAmount.toLocaleString()} · {progress.percent}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-inset overflow-hidden mb-1">
                <div className="h-full bg-action-primary" style={{ width: `${progress.percent}%` }} />
              </div>
              {progress.estimatedMonthsRemaining !== null && (
                <p className="text-text-disabled text-[10px]">
                  ~{progress.estimatedMonthsRemaining} months remaining at current monthly target
                </p>
              )}
            </div>
          );
        })}
      </Card>

      <Card title="Quick Add Transaction">
        <div className="grid grid-cols-4 gap-3 mb-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
            className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="savings-transfer">Savings Transfer</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={amount || ""}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-sm"
          />
          <button onClick={submit} className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium">
            Save Transaction
          </button>
        </div>
        <p className="text-text-disabled text-[10px]">
          A Savings Transfer never appears in your spending total — try adding one and watch "Spent" stay unchanged.
        </p>
      </Card>
    </div>
  );
}
