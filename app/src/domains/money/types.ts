/**
 * Performance Buddy OS — Money OS domain model.
 *
 * Per Day 10 Handoff §6, three rules matter most here:
 *   §6.3 — "Savings Transfer ≠ Expense." Moving money to savings is never
 *          counted as spending.
 *   §6.4 — "Planned Expense → Actual Transaction." A planned cost does not
 *          count as historical spending until an actual Transaction records it.
 *   §6.8 — Label projections honestly: "Currently Unallocated," never
 *          "Safe to Spend" (PBOS only knows recorded information).
 *   §6.10 — Money never feeds any overall performance score.
 */

export type TransactionType = "income" | "expense" | "savings-transfer";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO date
};

/**
 * A future intention, not a historical fact. `recordedTransactionId` is set
 * only once a real Transaction is created for it — until then it stays
 * excluded from every spending total, enforced by type separation (see
 * engine.ts — PlannedExpense is never read by computeExpenseTotal).
 */
export type PlannedExpense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  dueDate: string;
  recordedTransactionId: string | null;
};

export type BudgetStatus = "within-budget" | "approaching-limit" | "over-budget";

export type Budget = {
  id: string;
  category: string;
  period: string; // e.g. "2026-08" — the month this budget applies to
  limitAmount: number;
};

export type SavingsGoal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  monthlyTarget: number;
};
