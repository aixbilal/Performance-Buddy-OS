import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useMoney } from "./store";
import {
  TransactionForm,
  emptyTransactionForm,
  type TransactionFormValues,
} from "./TransactionForm";
import type { Transaction, TransactionInput } from "./types";

const TYPE_TONE = {
  income: "success",
  expense: "neutral",
  "savings-transfer": "warning",
} as const;
const TYPE_LABEL = {
  income: "income",
  expense: "expense",
  "savings-transfer": "savings transfer",
} as const;

function toValues(t: Transaction): TransactionFormValues {
  return {
    date: t.date,
    type: t.type,
    amount: String(t.amount),
    category: t.category,
    description: t.description,
    savingsGoalId: t.savingsGoalId ?? "",
  };
}

export function TransactionsPage() {
  const money = useMoney();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = [...money.transactions].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  const goals = money.savingsGoals.map((g) => ({ id: g.id, title: g.title }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/money" className="text-text-muted text-xs hover:text-text-secondary">
            ← Money
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">Transactions</h2>
          <p className="text-text-muted text-sm">
            Money that actually moved. A savings transfer is a movement, never spending.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={money.saveState} />
          <button
            onClick={() => setAdding((a) => !a)}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            {adding ? "Close" : "Add Transaction"}
          </button>
        </div>
      </div>

      {adding && (
        <Card title="New transaction">
          <TransactionForm
            initial={emptyTransactionForm()}
            submitLabel="Add Transaction"
            savingsGoals={goals}
            busy={money.saveState === "saving"}
            onSubmit={async (input: TransactionInput) => {
              const res = await money.createTransaction(input);
              if (res.ok) setAdding(false);
              return res;
            }}
            onCancel={() => setAdding(false)}
          />
        </Card>
      )}

      <Card title={`All transactions (${rows.length})`}>
        {money.loaded && rows.length === 0 && !adding ? (
          <EmptyState
            icon="💸"
            title="No transactions yet"
            description="Record income, an expense, or a savings transfer. Nothing here means PBOS has nothing recorded — not that your bank balance is zero."
            primaryAction={{ label: "Add your first transaction", onClick: () => setAdding(true) }}
          />
        ) : (
          <div className="space-y-1">
            {rows.map((t) =>
              editingId === t.id ? (
                <div key={t.id} className="border border-border-subtle rounded-md p-3">
                  <TransactionForm
                    initial={toValues(t)}
                    submitLabel="Save"
                    savingsGoals={goals}
                    busy={money.saveState === "saving"}
                    onSubmit={async (input) => {
                      const res = await money.updateTransaction(t.id, input);
                      if (res.ok) setEditingId(null);
                      return res;
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
                >
                  <div>
                    <div className="text-text-primary text-sm">
                      {t.category || "—"}
                      {t.description ? (
                        <span className="text-text-muted text-xs"> · {t.description}</span>
                      ) : null}
                    </div>
                    <div className="text-text-disabled text-[11px]">{t.date}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={TYPE_TONE[t.type]}>{TYPE_LABEL[t.type]}</Badge>
                    <span
                      className={`text-sm tabular-nums ${
                        t.type === "income" ? "text-status-success" : "text-text-primary"
                      }`}
                    >
                      {t.type === "income" ? "+" : t.type === "expense" ? "−" : "→"} Rs{" "}
                      {t.amount.toLocaleString()}
                    </span>
                    <button
                      onClick={() => setEditingId(t.id)}
                      className="text-text-muted text-[11px] hover:text-text-secondary underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => money.deleteTransaction(t.id)}
                      aria-label={`Delete transaction ${t.category} ${t.date}`}
                      className="text-text-muted text-[11px] hover:text-status-danger underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
