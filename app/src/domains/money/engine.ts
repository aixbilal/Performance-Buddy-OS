/**
 * Deterministic Money Engine. AI only explains these numbers, per §6.6 —
 * nothing here is ever computed by an AI call.
 */

import type { Budget, BudgetStatus, SavingsGoal, Transaction } from "./types";

/** §6.3: Savings Transfer ≠ Expense — explicitly excluded here. */
export function computeExpenseTotal(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
}

export function computeIncomeTotal(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
}

export function computeSavingsTransferredTotal(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === "savings-transfer").reduce((s, t) => s + t.amount, 0);
}

/** Cumulative tracked balance — explicitly manual/tracked, never a verified bank figure (§6.5). */
export function computeBalance(transactions: Transaction[]): number {
  return (
    computeIncomeTotal(transactions) - computeExpenseTotal(transactions) - computeSavingsTransferredTotal(transactions)
  );
}

/**
 * §6.8: "Currently Unallocated," not "Safe to Spend" — this is only ever
 * computed from transactions actually passed in (e.g. this month's), never
 * from an assumption about the future.
 */
export function computeUnallocated(periodTransactions: Transaction[]): number {
  return computeBalance(periodTransactions);
}

export function computeCategoryTotals(transactions: Transaction[], type: Transaction["type"] = "expense") {
  const totals = new Map<string, number>();
  transactions
    .filter((t) => t.type === type)
    .forEach((t) => totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount));
  return Array.from(totals.entries()).map(([category, amount]) => ({ category, amount }));
}

export type BudgetResult = {
  spent: number;
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
};

/**
 * Thresholds match the locked product convention shown directly in the
 * approved reference's own legend: "Approaching Limit (80%+)" — not a
 * guessed cutoff.
 */
export function computeBudgetStatus(budget: Budget, categoryExpenseTransactions: Transaction[]): BudgetResult {
  const spent = categoryExpenseTransactions
    .filter((t) => t.type === "expense" && t.category === budget.category)
    .reduce((s, t) => s + t.amount, 0);
  const percentUsed = budget.limitAmount > 0 ? Math.round((spent / budget.limitAmount) * 100) : 0;

  let status: BudgetStatus = "within-budget";
  if (percentUsed >= 100) status = "over-budget";
  else if (percentUsed >= 80) status = "approaching-limit";

  return { spent, remaining: budget.limitAmount - spent, percentUsed, status };
}

export type SavingsProgress = {
  percent: number;
  estimatedMonthsRemaining: number | null; // null when no monthly target is set — never a fabricated ETA
};

export function computeSavingsProgress(goal: SavingsGoal): SavingsProgress {
  const percent = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
  const remaining = goal.targetAmount - goal.currentAmount;
  const estimatedMonthsRemaining =
    goal.monthlyTarget > 0 ? Math.ceil(Math.max(0, remaining) / goal.monthlyTarget) : null;
  return { percent, estimatedMonthsRemaining };
}
