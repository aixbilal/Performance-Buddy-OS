import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { useMoney } from "./store";

const STATUS_TONE = {
  "within-budget": "success",
  "approaching-limit": "warning",
  "over-budget": "danger",
} as const;
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const todayIso = () => new Date().toISOString().slice(0, 10);

export function BudgetSavingsPage() {
  const money = useMoney();

  // budget add form
  const [bCat, setBCat] = useState("");
  const [bPeriod, setBPeriod] = useState(currentPeriod());
  const [bLimit, setBLimit] = useState("");
  const [bErr, setBErr] = useState<string | null>(null);

  // savings add form
  const [sTitle, setSTitle] = useState("");
  const [sTarget, setSTarget] = useState("");
  const [sMonthly, setSMonthly] = useState("");
  const [sOpening, setSOpening] = useState("0");
  const [sErr, setSErr] = useState<string | null>(null);

  // planned add form
  const [pTitle, setPTitle] = useState("");
  const [pAmount, setPAmount] = useState("");
  const [pCat, setPCat] = useState("");
  const [pDue, setPDue] = useState(todayIso());
  const [pErr, setPErr] = useState<string | null>(null);

  if (!money.loaded) return <LoadingState label="Loading budgets & savings…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/money" className="text-text-muted text-xs hover:text-text-secondary">
            ← Money
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">Budget &amp; Savings</h2>
          <p className="text-text-muted text-sm">
            Plans and targets. Budget usage counts only actual expense transactions — never planned
            expenses, income, or savings transfers.
          </p>
        </div>
        <SaveIndicator state={money.saveState} />
      </div>

      {/* ---------- Budgets ---------- */}
      <Card title="Category Budgets">
        <form
          className="grid grid-cols-[1fr_120px_120px_auto] gap-2 items-end mb-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await money.createBudget({
              category: bCat,
              period: bPeriod,
              limitAmount: bLimit.trim() === "" ? NaN : Number(bLimit),
            });
            if (res.ok) {
              setBCat("");
              setBLimit("");
              setBErr(null);
            } else setBErr(res.errors._ ?? Object.values(res.errors)[0] ?? "Invalid budget.");
          }}
        >
          <label className="text-text-secondary text-xs">
            Category
            <input
              value={bCat}
              onChange={(e) => setBCat(e.target.value)}
              aria-label="Budget category"
              placeholder="e.g. Food & Dining"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Period
            <input
              value={bPeriod}
              onChange={(e) => setBPeriod(e.target.value)}
              aria-label="Budget period"
              placeholder="YYYY-MM"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Limit
            <input
              value={bLimit}
              onChange={(e) => setBLimit(e.target.value)}
              aria-label="Budget limit"
              type="number"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Add Budget
          </button>
        </form>
        {bErr && <p className="text-status-danger text-[11px] mb-2">{bErr}</p>}

        {money.budgets.length === 0 ? (
          <div className="text-text-muted text-xs">
            No budgets configured — that's a setup gap, not "0 budget". Add one above.
          </div>
        ) : (
          <div className="space-y-3">
            {money.budgets.map((b) => {
              const r = money.getBudgetResult(b);
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="text-text-primary">
                      {b.category} <span className="text-text-disabled text-[11px]">· {b.period}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-text-secondary text-xs tabular-nums">
                        Rs {r.spent.toLocaleString()} / {b.limitAmount.toLocaleString()}
                      </span>
                      {r.hasData ? (
                        <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("-", " ")}</Badge>
                      ) : (
                        <Badge tone="neutral">no data</Badge>
                      )}
                      <button
                        onClick={() => money.deleteBudget(b.id)}
                        aria-label={`Delete budget ${b.category}`}
                        className="text-text-muted text-[11px] hover:text-status-danger underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-inset overflow-hidden">
                    <div
                      className="h-full bg-action-primary"
                      style={{ width: `${Math.min(100, r.percentUsed)}%` }}
                    />
                  </div>
                  {!r.hasData && (
                    <p className="text-text-disabled text-[10px] mt-1">
                      No matching actual expense recorded yet.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---------- Savings goals ---------- */}
      <Card title="Savings Goals">
        <form
          className="grid grid-cols-[1fr_110px_110px_110px_auto] gap-2 items-end mb-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await money.createSavingsGoal({
              title: sTitle,
              targetAmount: sTarget.trim() === "" ? NaN : Number(sTarget),
              targetDate: null,
              monthlyTarget: sMonthly.trim() === "" ? 0 : Number(sMonthly),
              openingAmount: sOpening.trim() === "" ? 0 : Number(sOpening),
              status: "active",
            });
            if (res.ok) {
              setSTitle("");
              setSTarget("");
              setSMonthly("");
              setSOpening("0");
              setSErr(null);
            } else setSErr(res.errors._ ?? Object.values(res.errors)[0] ?? "Invalid goal.");
          }}
        >
          <label className="text-text-secondary text-xs">
            Goal
            <input
              value={sTitle}
              onChange={(e) => setSTitle(e.target.value)}
              aria-label="Savings goal title"
              placeholder="e.g. New Laptop"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Target
            <input
              value={sTarget}
              onChange={(e) => setSTarget(e.target.value)}
              aria-label="Savings goal target amount"
              type="number"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Monthly
            <input
              value={sMonthly}
              onChange={(e) => setSMonthly(e.target.value)}
              aria-label="Savings goal monthly target"
              type="number"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Already saved
            <input
              value={sOpening}
              onChange={(e) => setSOpening(e.target.value)}
              aria-label="Savings goal opening amount"
              type="number"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Add Goal
          </button>
        </form>
        {sErr && <p className="text-status-danger text-[11px] mb-2">{sErr}</p>}

        {money.savingsGoals.filter((g) => !g.archived).length === 0 ? (
          <div className="text-text-muted text-xs">No savings goals yet.</div>
        ) : (
          <div className="space-y-3">
            {money.savingsGoals
              .filter((g) => !g.archived)
              .map((g) => {
                const p = money.getSavingsProgress(g);
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-text-primary">{g.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary text-xs tabular-nums">
                          Rs {p.currentAmount.toLocaleString()} / {g.targetAmount.toLocaleString()}
                          {p.percent !== null ? ` · ${p.percent}%` : ""}
                        </span>
                        <button
                          onClick={() => money.deleteSavingsGoal(g.id)}
                          aria-label={`Delete savings goal ${g.title}`}
                          className="text-text-muted text-[11px] hover:text-status-danger underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-inset overflow-hidden">
                      <div
                        className="h-full bg-action-primary"
                        style={{ width: `${Math.min(100, p.percent ?? 0)}%` }}
                      />
                    </div>
                    <p className="text-text-disabled text-[10px] mt-1">
                      Progress = opening amount + linked savings transfers. Expenses are never counted
                      as savings.
                      {p.estimatedMonthsRemaining !== null &&
                        ` ~${p.estimatedMonthsRemaining} month(s) left at the monthly target.`}
                    </p>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      {/* ---------- Planned expenses ---------- */}
      <Card title="Planned Expenses">
        <p className="text-text-disabled text-[11px] mb-3">
          Future intentions. They are never counted as actual spending. "Record actual" creates a
          separate real transaction and links it — the two rows stay distinct.
        </p>
        <form
          className="grid grid-cols-[1fr_110px_1fr_130px_auto] gap-2 items-end mb-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await money.createPlannedExpense({
              title: pTitle,
              amount: pAmount.trim() === "" ? NaN : Number(pAmount),
              category: pCat,
              dueDate: pDue,
              status: "upcoming",
            });
            if (res.ok) {
              setPTitle("");
              setPAmount("");
              setPCat("");
              setPErr(null);
            } else setPErr(res.errors._ ?? Object.values(res.errors)[0] ?? "Invalid planned expense.");
          }}
        >
          <label className="text-text-secondary text-xs">
            Title
            <input
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              aria-label="Planned expense title"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Amount
            <input
              value={pAmount}
              onChange={(e) => setPAmount(e.target.value)}
              aria-label="Planned expense amount"
              type="number"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Category
            <input
              value={pCat}
              onChange={(e) => setPCat(e.target.value)}
              aria-label="Planned expense category"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-xs">
            Due
            <input
              value={pDue}
              onChange={(e) => setPDue(e.target.value)}
              aria-label="Planned expense due date"
              type="date"
              className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Add Planned
          </button>
        </form>
        {pErr && <p className="text-status-danger text-[11px] mb-2">{pErr}</p>}

        {money.plannedExpenses.length === 0 ? (
          <div className="text-text-muted text-xs">No planned expenses.</div>
        ) : (
          <div className="space-y-1">
            {money.plannedExpenses.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
              >
                <div>
                  <div className="text-text-primary text-sm">
                    {p.title}{" "}
                    <span className="text-text-disabled text-[11px]">
                      · {p.category} · due {p.dueDate}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text-secondary text-sm tabular-nums">
                    Rs {p.amount.toLocaleString()}
                  </span>
                  <Badge
                    tone={
                      p.status === "realized"
                        ? "success"
                        : p.status === "cancelled"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {p.status}
                  </Badge>
                  {p.status === "upcoming" && (
                    <button
                      onClick={() => money.realizePlannedExpense(p.id, todayIso())}
                      className="text-text-secondary text-[11px] underline hover:text-text-primary"
                    >
                      Record actual
                    </button>
                  )}
                  <button
                    onClick={() => money.deletePlannedExpense(p.id)}
                    aria-label={`Delete planned expense ${p.title}`}
                    className="text-text-muted text-[11px] hover:text-status-danger underline"
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
