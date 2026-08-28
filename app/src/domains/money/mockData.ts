import type { Budget, PlannedExpense, SavingsGoal, Transaction } from "./types";

/** Values below match PBOS-Money-Overview approved reference exactly. */

export const SEED_TRANSACTIONS: Transaction[] = [
  { id: "tx1", type: "income", amount: 25000, category: "Freelance", description: "Project payment", date: "2026-08-27" },
  { id: "tx2", type: "expense", amount: 2450, category: "Food & Dining", description: "Groceries + dining", date: "2026-08-20" },
  { id: "tx3", type: "expense", amount: 1600, category: "Transport", description: "Fuel + transit", date: "2026-08-18" },
  { id: "tx4", type: "expense", amount: 1100, category: "University", description: "Supplies", date: "2026-08-15" },
  { id: "tx5", type: "expense", amount: 800, category: "Entertainment", description: "Outing", date: "2026-08-12" },
  { id: "tx6", type: "expense", amount: 600, category: "Other", description: "Misc", date: "2026-08-10" },
  { id: "tx7", type: "expense", amount: 450, category: "Food & Dining", description: "Lunch", date: "2026-08-28" },
  { id: "tx8", type: "expense", amount: 300, category: "Transport", description: "Transport", date: "2026-08-28" },
  { id: "tx9", type: "savings-transfer", amount: 5000, category: "New Laptop", description: "Monthly savings transfer", date: "2026-08-25" },
];

export const SEED_PLANNED_EXPENSES: PlannedExpense[] = [
  { id: "pe1", title: "University expense", amount: 2000, category: "University", dueDate: "2026-09-02", recordedTransactionId: null },
  { id: "pe2", title: "Internet", amount: 1500, category: "Utilities", dueDate: "2026-09-05", recordedTransactionId: null },
  { id: "pe3", title: "Hangout budget", amount: 700, category: "Entertainment", dueDate: "2026-09-07", recordedTransactionId: null },
];

export const SEED_BUDGETS: Budget[] = [
  { id: "bg1", category: "Food & Dining", period: "2026-08", limitAmount: 5000 },
  { id: "bg2", category: "Transport", period: "2026-08", limitAmount: 3000 },
  { id: "bg3", category: "Entertainment", period: "2026-08", limitAmount: 2000 },
];

export const SEED_SAVINGS_GOALS: SavingsGoal[] = [
  { id: "sg1", title: "New Laptop", targetAmount: 100000, currentAmount: 32500, monthlyTarget: 7500 },
];
