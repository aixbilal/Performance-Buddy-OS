import { describe, it, expect } from "vitest";
import {
  computeBalance,
  computeBudgetStatus,
  computeExpenseTotal,
  computeIncomeTotal,
  computeSavingsProgress,
  computeSavingsTransferredTotal,
  deriveMoneyInsights,
  derivePendingPlannedTotal,
  deriveSavingsGoalCurrent,
  deriveUpcomingPlannedExpenses,
} from "./engine";
import type { Budget, PlannedExpense, SavingsGoal, Transaction } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
const tx = (
  id: string,
  type: Transaction["type"],
  amount: number,
  over: Partial<Transaction> = {},
): Transaction => ({
  id,
  date: "2026-08-10",
  type,
  amount,
  category: over.category ?? (type === "savings-transfer" ? "Savings" : "General"),
  description: "",
  savingsGoalId: over.savingsGoalId ?? null,
  createdAt: TS,
  updatedAt: TS,
  ...over,
});
const budget = (over: Partial<Budget> = {}): Budget => ({
  id: "b1",
  category: "Food & Dining",
  period: "2026-08",
  limitAmount: 5000,
  createdAt: TS,
  updatedAt: TS,
  ...over,
});
const goal = (over: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: "g1",
  title: "New Laptop",
  targetAmount: 100000,
  targetDate: null,
  monthlyTarget: 7500,
  openingAmount: 0,
  status: "active",
  archived: false,
  createdAt: TS,
  updatedAt: TS,
  ...over,
});
const planned = (over: Partial<PlannedExpense> = {}): PlannedExpense => ({
  id: "p1",
  title: "Internet",
  amount: 1500,
  category: "Utilities",
  dueDate: "2026-09-05",
  status: "upcoming",
  transactionId: null,
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

describe("totals — Savings Transfer ≠ Expense", () => {
  const ledger = [
    tx("t1", "income", 50000),
    tx("t2", "expense", 10000),
    tx("t3", "savings-transfer", 15000),
  ];
  it("expense total excludes income AND savings transfers", () => {
    expect(computeExpenseTotal(ledger)).toBe(10000); // NOT 25000
  });
  it("income and transfer totals are separate", () => {
    expect(computeIncomeTotal(ledger)).toBe(50000);
    expect(computeSavingsTransferredTotal(ledger)).toBe(15000);
  });
  it("tracked balance = income − expenses − transfers", () => {
    expect(computeBalance(ledger)).toBe(25000);
  });
});

describe("computeBudgetStatus — actual expenses only", () => {
  it("ignores income, savings transfers and planned amounts; matches the 80% / 100% thresholds", () => {
    const b = budget({ limitAmount: 5000 });
    expect(
      computeBudgetStatus(b, [
        tx("t1", "expense", 3000, { category: "Food & Dining" }),
        tx("t2", "income", 9999, { category: "Food & Dining" }),
        tx("t3", "savings-transfer", 9999, { category: "Food & Dining" }),
      ]).spent,
    ).toBe(3000);
    expect(computeBudgetStatus(b, [tx("t1", "expense", 4000, { category: "Food & Dining" })]).status).toBe(
      "approaching-limit",
    );
    expect(computeBudgetStatus(b, [tx("t1", "expense", 5200, { category: "Food & Dining" })]).status).toBe(
      "over-budget",
    );
  });
  it("reports hasData=false when no matching expense exists (unknown ≠ 0% used)", () => {
    const r = computeBudgetStatus(budget(), [tx("t1", "expense", 4000, { category: "Transport" })]);
    expect(r.spent).toBe(0);
    expect(r.hasData).toBe(false);
  });
});

describe("savings progress — ONE truth: opening + linked transfers, never expenses", () => {
  it("derives current from opening amount + savings-transfer transactions linked to the goal", () => {
    const g = goal({ id: "g1", openingAmount: 20000 });
    const transactions = [
      tx("t1", "savings-transfer", 15000, { savingsGoalId: "g1" }),
      tx("t2", "savings-transfer", 5000, { savingsGoalId: "g2" }), // other goal — ignored
      tx("t3", "expense", 99999, { savingsGoalId: "g1" }), // an expense never counts as savings
    ];
    expect(deriveSavingsGoalCurrent(g, transactions)).toBe(35000);
    const p = computeSavingsProgress(g, transactions);
    expect(p.currentAmount).toBe(35000);
    expect(p.percent).toBe(35);
    expect(p.estimatedMonthsRemaining).toBe(Math.ceil((100000 - 35000) / 7500));
  });
  it("returns null percent when no target is set, and null ETA when no monthly target", () => {
    expect(computeSavingsProgress(goal({ targetAmount: 0 }), []).percent).toBeNull();
    expect(computeSavingsProgress(goal({ monthlyTarget: 0 }), []).estimatedMonthsRemaining).toBeNull();
  });
});

describe("planned expenses never enter a spend total", () => {
  it("pending planned total is separate and only counts 'upcoming'", () => {
    const list = [
      planned({ id: "p1", amount: 1500, status: "upcoming" }),
      planned({ id: "p2", amount: 800, status: "realized" }),
      planned({ id: "p3", amount: 400, status: "cancelled" }),
    ];
    expect(derivePendingPlannedTotal(list)).toBe(1500);
  });
  it("upcoming filter respects the horizon and status", () => {
    const list = [
      planned({ id: "p1", dueDate: "2026-08-12", status: "upcoming" }),
      planned({ id: "p2", dueDate: "2026-12-31", status: "upcoming" }),
      planned({ id: "p3", dueDate: "2026-08-13", status: "realized" }),
    ];
    const up = deriveUpcomingPlannedExpenses(list, { today: "2026-08-10", withinDays: 14 });
    expect(up.map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("deriveMoneyInsights — deterministic, traceable, no advice, no bank balance", () => {
  it("returns nothing with an empty ledger — never a fabricated financial-health statement", () => {
    const r = deriveMoneyInsights(
      { transactions: [], plannedExpenses: [], budgets: [], savingsGoals: [] },
      { today: "2026-08-10" },
    );
    expect(r.insights).toEqual([]);
    expect(r.confidence).toBe("none");
  });
  it("states facts + derivations from real data and never claims a verified balance", () => {
    const r = deriveMoneyInsights(
      {
        transactions: [
          tx("t1", "income", 50000),
          tx("t2", "expense", 10000, { category: "Food" }),
          tx("t3", "savings-transfer", 15000),
        ],
        plannedExpenses: [],
        budgets: [budget({ category: "Food", limitAmount: 8000 })],
        savingsGoals: [],
      },
      { today: "2026-08-10" },
    );
    const text = r.insights.map((i) => i.text).join(" | ");
    expect(text).toMatch(/actual spending 10,000/);
    expect(text).toMatch(/not a verified bank balance/i);
    expect(text).not.toMatch(/you should|invest|bad with money/i);
  });
});
