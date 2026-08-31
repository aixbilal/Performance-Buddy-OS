/**
 * TEST / DEMO FIXTURES ONLY — never loaded as user data.
 *
 * The Money store starts empty on a fresh profile (Batch 2).
 */
import type { Budget, PlannedExpense, SavingsGoal, Transaction } from "./types";

const TS = "2026-01-01T00:00:00.000Z";

export const FIXTURE_SAVINGS_GOAL: SavingsGoal = {
  id: "sg-laptop",
  title: "New Laptop",
  targetAmount: 100000,
  targetDate: null,
  monthlyTarget: 7500,
  openingAmount: 27500,
  status: "active",
  archived: false,
  createdAt: TS,
  updatedAt: TS,
};

export const FIXTURE_TRANSACTIONS: Transaction[] = [
  { id: "tx-inc", date: "2026-08-01", type: "income", amount: 50000, category: "Freelance", description: "Project", savingsGoalId: null, createdAt: TS, updatedAt: TS },
  { id: "tx-exp", date: "2026-08-10", type: "expense", amount: 10000, category: "Food & Dining", description: "Groceries", savingsGoalId: null, createdAt: TS, updatedAt: TS },
  { id: "tx-sav", date: "2026-08-15", type: "savings-transfer", amount: 15000, category: "Savings", description: "Monthly", savingsGoalId: "sg-laptop", createdAt: TS, updatedAt: TS },
];

export const FIXTURE_PLANNED_EXPENSES: PlannedExpense[] = [
  { id: "pe-net", title: "Internet", amount: 5000, category: "Utilities", dueDate: "2026-09-05", status: "upcoming", transactionId: null, createdAt: TS, updatedAt: TS },
];

export const FIXTURE_BUDGETS: Budget[] = [
  { id: "bg-food", category: "Food & Dining", period: "2026-08", limitAmount: 12000, createdAt: TS, updatedAt: TS },
];
