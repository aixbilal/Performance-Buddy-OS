/**
 * Deterministic Money Engine (Master Batch 2). AI only *explains* these
 * numbers — nothing here is ever computed by an AI call.
 *
 * The rules this file enforces:
 *   SAVINGS TRANSFER ≠ EXPENSE — excluded from every spending / budget total.
 *   PLANNED EXPENSE ≠ ACTUAL SPEND — `PlannedExpense` is never read by any
 *     spending function; it only ever contributes to "upcoming".
 *   No fabricated bank balance — the balance is `income − expenses − transfers`
 *     over the transactions actually passed in, labelled "tracked".
 *   Missing data → honest empty result, not a confident zero.
 */

import {
  PLANNED_EXPENSE_STATUSES,
  SAVINGS_GOAL_STATUSES,
  TRANSACTION_TYPES,
  type Budget,
  type BudgetInput,
  type BudgetStatus,
  type MoneyGraph,
  type PlannedExpense,
  type PlannedExpenseInput,
  type SavingsGoal,
  type SavingsGoalInput,
  type Transaction,
  type TransactionInput,
  type Validated,
} from "./types";

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

export function computeExpenseTotal(transactions: Transaction[]): number {
  return sum(transactions.filter((t) => t.type === "expense"));
}
export function computeIncomeTotal(transactions: Transaction[]): number {
  return sum(transactions.filter((t) => t.type === "income"));
}
/** Savings Transfer ≠ Expense — this is a *movement*, reported separately. */
export function computeSavingsTransferredTotal(transactions: Transaction[]): number {
  return sum(transactions.filter((t) => t.type === "savings-transfer"));
}

/** Tracked cash flow — income minus actual expenses minus transfers to savings. Never a bank figure. */
export function computeBalance(transactions: Transaction[]): number {
  return (
    computeIncomeTotal(transactions) -
    computeExpenseTotal(transactions) -
    computeSavingsTransferredTotal(transactions)
  );
}
/** Clearer alias used by the Insights surface. */
export const deriveNetCashFlow = computeBalance;

/** "Currently Unallocated," never "Safe to Spend" — only from transactions actually passed in. */
export function computeUnallocated(periodTransactions: Transaction[]): number {
  return computeBalance(periodTransactions);
}

export function computeCategoryTotals(
  transactions: Transaction[],
  type: Transaction["type"] = "expense",
): { category: string; amount: number }[] {
  const totals = new Map<string, number>();
  transactions
    .filter((t) => t.type === type)
    .forEach((t) => totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount));
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Budgets — usage derives ONLY from actual expense transactions
// ---------------------------------------------------------------------------

export type BudgetResult = {
  spent: number;
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
  hasData: boolean;
};

export function computeBudgetStatus(
  budget: Budget,
  transactions: Transaction[],
): BudgetResult {
  const matching = transactions.filter(
    (t) => t.type === "expense" && t.category === budget.category,
  );
  const spent = sum(matching);
  const percentUsed = budget.limitAmount > 0 ? Math.round((spent / budget.limitAmount) * 100) : 0;
  let status: BudgetStatus = "within-budget";
  if (percentUsed >= 100) status = "over-budget";
  else if (percentUsed >= 80) status = "approaching-limit";
  return {
    spent,
    remaining: budget.limitAmount - spent,
    percentUsed,
    status,
    hasData: matching.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Savings — ONE truth: openingAmount + linked savings-transfer transactions
// ---------------------------------------------------------------------------

export function deriveSavingsGoalCurrent(
  goal: SavingsGoal,
  transactions: Transaction[],
): number {
  const linked = sum(
    transactions.filter((t) => t.type === "savings-transfer" && t.savingsGoalId === goal.id),
  );
  return goal.openingAmount + linked;
}

export type SavingsProgress = {
  currentAmount: number;
  percent: number | null; // null when there is no target set — never a fabricated ratio
  remaining: number;
  estimatedMonthsRemaining: number | null; // null when no monthly target — never a fabricated ETA
};

export function computeSavingsProgress(
  goal: SavingsGoal,
  transactions: Transaction[],
): SavingsProgress {
  const currentAmount = deriveSavingsGoalCurrent(goal, transactions);
  const percent =
    goal.targetAmount > 0 ? Math.round((currentAmount / goal.targetAmount) * 100) : null;
  const remaining = Math.max(0, goal.targetAmount - currentAmount);
  const estimatedMonthsRemaining =
    goal.monthlyTarget > 0 ? Math.ceil(remaining / goal.monthlyTarget) : null;
  return { currentAmount, percent, remaining, estimatedMonthsRemaining };
}

// ---------------------------------------------------------------------------
// Planned expenses — an intention, never a spend
// ---------------------------------------------------------------------------

/** The still-open plans (not yet realised / cancelled). Their total is never a spend. */
export function derivePendingPlannedTotal(planned: PlannedExpense[]): number {
  return sum(planned.filter((p) => p.status === "upcoming"));
}

export function deriveUpcomingPlannedExpenses(
  planned: PlannedExpense[],
  opts: { today: string; withinDays?: number },
): PlannedExpense[] {
  const today = opts.today.slice(0, 10);
  const horizon = new Date(`${today}T00:00:00Z`).getTime() + (opts.withinDays ?? 30) * 86_400_000;
  return planned
    .filter((p) => p.status === "upcoming" && p.dueDate)
    .filter((p) => {
      const due = new Date(`${p.dueDate.slice(0, 10)}T00:00:00Z`).getTime();
      return due <= horizon;
    })
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Insights — deterministic FACT / DERIVATION statements, no advice
// ---------------------------------------------------------------------------

export type MoneyInsight = { kind: "fact" | "derivation"; text: string };

export function deriveMoneyInsights(
  graph: MoneyGraph,
  opts: { today: string },
): { insights: MoneyInsight[]; confidence: "none" | "limited" | "moderate" } {
  const { transactions, budgets, savingsGoals, plannedExpenses } = graph;
  const insights: MoneyInsight[] = [];

  if (transactions.length === 0) {
    return { insights: [], confidence: "none" };
  }

  const income = computeIncomeTotal(transactions);
  const expense = computeExpenseTotal(transactions);
  const transferred = computeSavingsTransferredTotal(transactions);

  insights.push({
    kind: "fact",
    text: `You recorded ${transactions.length} transaction(s): income ${income.toLocaleString()}, actual spending ${expense.toLocaleString()}, moved to savings ${transferred.toLocaleString()}.`,
  });
  insights.push({
    kind: "derivation",
    text: `Tracked net cash flow is ${deriveNetCashFlow(transactions).toLocaleString()} (income − expenses − transfers). This is not a verified bank balance.`,
  });

  const cats = computeCategoryTotals(transactions, "expense");
  if (cats.length > 0) {
    insights.push({
      kind: "fact",
      text: `Largest spending category: ${cats[0].category} (${cats[0].amount.toLocaleString()}).`,
    });
  }

  for (const b of budgets) {
    const r = computeBudgetStatus(b, transactions);
    if (!r.hasData) {
      insights.push({
        kind: "fact",
        text: `Budget "${b.category}" (${b.period}) has no matching expense transactions yet.`,
      });
    } else if (r.status !== "within-budget") {
      insights.push({
        kind: "derivation",
        text: `"${b.category}" used ${r.percentUsed}% of its configured ${b.limitAmount.toLocaleString()} budget.`,
      });
    }
  }

  for (const g of savingsGoals.filter((x) => !x.archived)) {
    const p = computeSavingsProgress(g, transactions);
    insights.push({
      kind: "derivation",
      text:
        p.percent === null
          ? `Savings goal "${g.title}" has ${p.currentAmount.toLocaleString()} tracked; no target amount is set.`
          : `Savings goal "${g.title}" is at ${p.percent}% (${p.currentAmount.toLocaleString()} of ${g.targetAmount.toLocaleString()}).`,
    });
  }

  const upcoming = deriveUpcomingPlannedExpenses(plannedExpenses, { today: opts.today, withinDays: 14 });
  if (upcoming.length > 0) {
    insights.push({
      kind: "fact",
      text: `${upcoming.length} planned expense(s) due within 14 days, totalling ${sum(upcoming).toLocaleString()}. Planned expenses are not counted as spending.`,
    });
  }

  const confidence = transactions.length >= 8 ? "moderate" : "limited";
  return { insights, confidence };
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export const isTransactionType = (v: unknown): v is Transaction["type"] =>
  (TRANSACTION_TYPES as readonly string[]).includes(v as string);
export const isPlannedExpenseStatus = (v: unknown): v is PlannedExpense["status"] =>
  (PLANNED_EXPENSE_STATUSES as readonly string[]).includes(v as string);
export const isSavingsGoalStatus = (v: unknown): v is SavingsGoal["status"] =>
  (SAVINGS_GOAL_STATUSES as readonly string[]).includes(v as string);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_TITLE = 140;
const MAX_NOTE = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-\d{2}$/;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const money = (n: number) => Number.isFinite(n) && n > 0 && n <= 1_000_000_000;

export function validateTransactionInput(input: TransactionInput): Validated<TransactionInput> {
  const errors: Record<string, string> = {};
  if (!input.date || !ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date))) {
    errors.date = "Pick a valid date.";
  }
  if (!isTransactionType(input.type)) errors.type = "Choose income / expense / savings transfer.";
  if (!money(input.amount)) errors.amount = "Amount must be a positive number.";
  const category = clean(input.category);
  if (input.type !== "savings-transfer" && category.length === 0) {
    errors.category = "Add a category.";
  } else if (category.length > MAX_TITLE) {
    errors.category = "Category is too long.";
  }
  if (clean(input.description).length > MAX_NOTE) errors.description = "Note is too long.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      date: input.date,
      type: input.type,
      amount: Math.round(input.amount * 100) / 100,
      category: category || (input.type === "savings-transfer" ? "Savings" : category),
      description: clean(input.description),
      savingsGoalId:
        input.type === "savings-transfer" &&
        typeof input.savingsGoalId === "string" &&
        input.savingsGoalId.trim() !== ""
          ? input.savingsGoalId
          : null,
    },
  };
}

export function validatePlannedExpenseInput(
  input: PlannedExpenseInput,
): Validated<PlannedExpenseInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the planned expense a title.";
  else if (title.length > MAX_TITLE) errors.title = "Title is too long.";
  if (!money(input.amount)) errors.amount = "Amount must be a positive number.";
  if (clean(input.category).length === 0) errors.category = "Add a category.";
  if (!input.dueDate || !ISO_DATE.test(input.dueDate) || Number.isNaN(Date.parse(input.dueDate))) {
    errors.dueDate = "Pick a valid due date.";
  }
  if (!isPlannedExpenseStatus(input.status)) errors.status = "Choose a status.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      amount: Math.round(input.amount * 100) / 100,
      category: clean(input.category),
      dueDate: input.dueDate,
      status: input.status,
    },
  };
}

export function validateBudgetInput(input: BudgetInput): Validated<BudgetInput> {
  const errors: Record<string, string> = {};
  if (clean(input.category).length === 0) errors.category = "Add a category.";
  if (!PERIOD.test(input.period)) errors.period = "Period must be YYYY-MM.";
  if (!money(input.limitAmount)) errors.limitAmount = "Limit must be a positive number.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      category: clean(input.category),
      period: input.period,
      limitAmount: Math.round(input.limitAmount * 100) / 100,
    },
  };
}

export function validateSavingsGoalInput(input: SavingsGoalInput): Validated<SavingsGoalInput> {
  const errors: Record<string, string> = {};
  const title = clean(input.title);
  if (title.length === 0) errors.title = "Give the goal a title.";
  else if (title.length > MAX_TITLE) errors.title = "Title is too long.";
  if (!money(input.targetAmount)) errors.targetAmount = "Target must be a positive number.";
  if (
    input.targetDate &&
    (!ISO_DATE.test(input.targetDate) || Number.isNaN(Date.parse(input.targetDate)))
  ) {
    errors.targetDate = "Target date must be a valid date.";
  }
  if (!Number.isFinite(input.monthlyTarget) || input.monthlyTarget < 0) {
    errors.monthlyTarget = "Monthly target can't be negative.";
  }
  if (!Number.isFinite(input.openingAmount) || input.openingAmount < 0) {
    errors.openingAmount = "Opening amount can't be negative.";
  }
  if (!isSavingsGoalStatus(input.status)) errors.status = "Choose a status.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      targetAmount: Math.round(input.targetAmount * 100) / 100,
      targetDate: input.targetDate || null,
      monthlyTarget: Math.round(input.monthlyTarget * 100) / 100,
      openingAmount: Math.round(input.openingAmount * 100) / 100,
      status: input.status,
    },
  };
}
