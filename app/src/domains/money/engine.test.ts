import { describe, it, expect } from "vitest";
import {
  computeExpenseTotal,
  computeBalance,
  computeBudgetStatus,
  computeSavingsProgress,
} from "./engine";
import type { Budget, SavingsGoal, Transaction } from "./types";

describe("computeExpenseTotal — Savings Transfer ≠ Expense (§6.3)", () => {
  it("excludes savings-transfer transactions from the expense total", () => {
    const transactions: Transaction[] = [
      { id: "t1", type: "expense", amount: 450, category: "Food", description: "Lunch", date: "2026-08-28" },
      { id: "t2", type: "savings-transfer", amount: 5000, category: "Savings", description: "Laptop fund", date: "2026-08-27" },
    ];
    // Only the real expense counts — moving Rs 5,000 to savings must not appear as spending.
    expect(computeExpenseTotal(transactions)).toBe(450);
  });
});

describe("computeBalance", () => {
  it("matches a hand-calculated example: income minus expense minus savings transferred", () => {
    const transactions: Transaction[] = [
      { id: "t1", type: "income", amount: 25000, category: "Freelance", description: "", date: "2026-08-01" },
      { id: "t2", type: "expense", amount: 6550, category: "Various", description: "", date: "2026-08-15" },
      { id: "t3", type: "savings-transfer", amount: 5000, category: "Savings", description: "", date: "2026-08-20" },
    ];
    // 25000 - 6550 - 5000 = 13450
    expect(computeBalance(transactions)).toBe(13450);
  });
});

describe("computeBudgetStatus — locked 80% threshold from the approved reference legend", () => {
  const budget: Budget = { id: "b1", category: "Food & Dining", period: "2026-08", limitAmount: 5000 };

  it("is within-budget below 80% usage", () => {
    const transactions: Transaction[] = [
      { id: "t1", type: "expense", amount: 3000, category: "Food & Dining", description: "", date: "2026-08-10" },
    ];
    expect(computeBudgetStatus(budget, transactions).status).toBe("within-budget");
  });

  it("is approaching-limit at exactly 80%", () => {
    const transactions: Transaction[] = [
      { id: "t1", type: "expense", amount: 4000, category: "Food & Dining", description: "", date: "2026-08-10" },
    ];
    expect(computeBudgetStatus(budget, transactions).status).toBe("approaching-limit");
  });

  it("is over-budget at 100% or more", () => {
    const transactions: Transaction[] = [
      { id: "t1", type: "expense", amount: 5200, category: "Food & Dining", description: "", date: "2026-08-10" },
    ];
    const result = computeBudgetStatus(budget, transactions);
    expect(result.status).toBe("over-budget");
    expect(result.remaining).toBe(-200);
  });

  it("only counts transactions matching the budget's own category", () => {
    const transactions: Transaction[] = [
      { id: "t1", type: "expense", amount: 4000, category: "Transport", description: "", date: "2026-08-10" },
    ];
    expect(computeBudgetStatus(budget, transactions).spent).toBe(0);
  });
});

describe("computeSavingsProgress", () => {
  it("matches the approved reference's exact example: Rs 32,500 / Rs 100,000", () => {
    const goal: SavingsGoal = { id: "g1", title: "New Laptop", targetAmount: 100000, currentAmount: 32500, monthlyTarget: 5000 };
    const result = computeSavingsProgress(goal);
    expect(result.percent).toBe(33); // 32.5% rounds to 33
    // Remaining 67,500 / 5,000 per month = 13.5 -> 14 months (ceil, never understate time needed)
    expect(result.estimatedMonthsRemaining).toBe(14);
  });

  it("returns null months-remaining when there is no monthly contribution target, never a fabricated ETA", () => {
    const goal: SavingsGoal = { id: "g1", title: "Vague Goal", targetAmount: 10000, currentAmount: 1000, monthlyTarget: 0 };
    expect(computeSavingsProgress(goal).estimatedMonthsRemaining).toBeNull();
  });
});
