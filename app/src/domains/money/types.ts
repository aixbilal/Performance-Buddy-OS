/**
 * Performance Buddy OS — Money OS domain model (Master Batch 2: relational).
 *
 * V1 Day 10 product locks, enforced by the shape here:
 *   ACTUAL TRANSACTION ≠ PLANNED EXPENSE — separate types; a planned expense
 *     may link to the actual transaction that realised it (`transactionId`)
 *     but is never rewritten into one, and planned amounts never enter a
 *     spending total.
 *   SAVINGS TRANSFER ≠ EXPENSE — a distinct transaction `type`; engine.ts
 *     keeps it out of every spending / budget total.
 *   PBOS BALANCE ≠ VERIFIED BANK BALANCE — the tracked balance is derived,
 *     never asserted as bank-verified.
 *   BUDGET ≠ ACCOUNT BALANCE, SAVINGS GOAL ≠ AVAILABLE CASH.
 *   Savings-goal progress has ONE truth: `openingAmount` (user-entered) + the
 *     sum of linked `savings-transfer` transactions.
 *   Money is NEVER part of any performance score.
 */

export type TransactionType = "income" | "expense" | "savings-transfer";
export const TRANSACTION_TYPES: readonly TransactionType[] = [
  "income",
  "expense",
  "savings-transfer",
];

export type PlannedExpenseStatus = "upcoming" | "realized" | "cancelled";
export const PLANNED_EXPENSE_STATUSES: readonly PlannedExpenseStatus[] = [
  "upcoming",
  "realized",
  "cancelled",
];

export type SavingsGoalStatus = "active" | "achieved" | "archived";
export const SAVINGS_GOAL_STATUSES: readonly SavingsGoalStatus[] = [
  "active",
  "achieved",
  "archived",
];

export type BudgetStatus = "within-budget" | "approaching-limit" | "over-budget";

// ---------------------------------------------------------------------------
// Canonical persisted rows (shape matches app/src-tauri/src/money.rs)
// ---------------------------------------------------------------------------

/** Money that ACTUALLY moved. */
export type Transaction = {
  id: string;
  date: string; // ISO date
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  /** Only meaningful for a `savings-transfer` — the goal it feeds. */
  savingsGoalId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A future intention — never a historical fact until an actual Transaction records it. */
export type PlannedExpense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  dueDate: string;
  status: PlannedExpenseStatus;
  /** The ACTUAL transaction that realised this plan, if any. The rows stay distinct. */
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Budget = {
  id: string;
  category: string;
  period: string; // "YYYY-MM"
  limitAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type SavingsGoal = {
  id: string;
  title: string;
  targetAmount: number;
  targetDate: string | null;
  monthlyTarget: number;
  /** Money already put toward the goal before tracking started (user-entered, not fabricated). */
  openingAmount: number;
  status: SavingsGoalStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MoneyGraph = {
  transactions: Transaction[];
  plannedExpenses: PlannedExpense[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
};

// ---------------------------------------------------------------------------
// Form inputs + validation result
// ---------------------------------------------------------------------------

export type TransactionInput = {
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  savingsGoalId: string | null;
};

export type PlannedExpenseInput = {
  title: string;
  amount: number;
  category: string;
  dueDate: string;
  status: PlannedExpenseStatus;
};

export type BudgetInput = {
  category: string;
  period: string;
  limitAmount: number;
};

export type SavingsGoalInput = {
  title: string;
  targetAmount: number;
  targetDate: string | null;
  monthlyTarget: number;
  openingAmount: number;
  status: SavingsGoalStatus;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };
