// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { LocalRepo, makeMoneyRepo } from "./repo";
import type { Budget, PlannedExpense, SavingsGoal, Transaction } from "./types";

const TS = "2026-01-01T00:00:00.000Z";
const tx = (id: string, type: Transaction["type"], amount: number, goalId: string | null = null): Transaction => ({
  id,
  date: "2026-08-10",
  type,
  amount,
  category: "General",
  description: "",
  savingsGoalId: goalId,
  createdAt: TS,
  updatedAt: TS,
});
const goal = (id: string): SavingsGoal => ({
  id,
  title: "Laptop",
  targetAmount: 100000,
  targetDate: null,
  monthlyTarget: 7500,
  openingAmount: 0,
  status: "active",
  archived: false,
  createdAt: TS,
  updatedAt: TS,
});
const planned = (id: string, txId: string | null = null): PlannedExpense => ({
  id,
  title: "Internet",
  amount: 1500,
  category: "Utilities",
  dueDate: "2026-09-05",
  status: txId ? "realized" : "upcoming",
  transactionId: txId,
  createdAt: TS,
  updatedAt: TS,
});
const budget = (id: string): Budget => ({
  id,
  category: "Food",
  period: "2026-08",
  limitAmount: 5000,
  createdAt: TS,
  updatedAt: TS,
});

beforeEach(() => window.localStorage.clear());

describe("makeMoneyRepo", () => {
  it("falls back to LocalRepo when not under Tauri", () => {
    expect(makeMoneyRepo()).toBeInstanceOf(LocalRepo);
  });
});

describe("LocalRepo — CRUD, relationships, persistence", () => {
  it("round-trips the graph and survives a fresh instance", async () => {
    const repo = new LocalRepo();
    await repo.savingsGoalUpsert(goal("g1"));
    await repo.transactionUpsert(tx("t1", "income", 50000));
    await repo.transactionUpsert(tx("t2", "savings-transfer", 15000, "g1"));
    await repo.plannedUpsert(planned("p1"));
    await repo.budgetUpsert(budget("b1"));
    const g = await new LocalRepo().load();
    expect(g.transactions).toHaveLength(2);
    expect(g.savingsGoals).toHaveLength(1);
    expect(g.plannedExpenses).toHaveLength(1);
    expect(g.budgets).toHaveLength(1);
  });

  it("preserves createdAt on update", async () => {
    const repo = new LocalRepo();
    await repo.budgetUpsert(budget("b1"));
    await repo.budgetUpsert({ ...budget("b1"), limitAmount: 9999, createdAt: "2099-01-01" });
    const g = await repo.load();
    expect(g.budgets[0].limitAmount).toBe(9999);
    expect(g.budgets[0].createdAt).toBe(TS);
  });

  it("deleting a savings goal keeps its transfers but NULLs the link", async () => {
    const repo = new LocalRepo();
    await repo.savingsGoalUpsert(goal("g1"));
    await repo.transactionUpsert(tx("t1", "savings-transfer", 15000, "g1"));
    await repo.savingsGoalDelete("g1");
    const g = await repo.load();
    expect(g.savingsGoals).toHaveLength(0);
    expect(g.transactions).toHaveLength(1);
    expect(g.transactions[0].savingsGoalId).toBeNull();
  });

  it("deleting a transaction keeps a linked planned expense and clears its link", async () => {
    const repo = new LocalRepo();
    await repo.transactionUpsert(tx("t1", "expense", 1500));
    await repo.plannedUpsert(planned("p1", "t1"));
    await repo.transactionDelete("t1");
    const g = await repo.load();
    expect(g.plannedExpenses).toHaveLength(1);
    expect(g.plannedExpenses[0].transactionId).toBeNull();
    expect(g.plannedExpenses[0].status).toBe("upcoming");
  });

  it("a dangling savingsGoalId is stored as null, not kept", async () => {
    const repo = new LocalRepo();
    await repo.transactionUpsert(tx("t1", "savings-transfer", 100, "ghost"));
    expect((await repo.load()).transactions[0].savingsGoalId).toBeNull();
  });

  it("importGraph is idempotent and never overwrites newer records", async () => {
    const repo = new LocalRepo();
    const r1 = await repo.importGraph({
      savingsGoals: [goal("g1")],
      transactions: [tx("t1", "income", 50000), tx("t2", "savings-transfer", 15000, "ghost")],
      plannedExpenses: [planned("p1"), planned("p2", "ghost-tx")],
      budgets: [budget("b1")],
    });
    expect(r1.ran).toBe(true);
    expect(r1.transactionsImported).toBe(2);
    expect(r1.goalLinksCleared).toBe(1);
    expect(r1.transactionLinksCleared).toBe(1);

    await repo.transactionUpsert({ ...tx("t1", "income", 50000), amount: 99999 });
    const r2 = await repo.importGraph({
      savingsGoals: [],
      transactions: [tx("t1", "income", 50000)],
      plannedExpenses: [],
      budgets: [],
    });
    expect(r2.ran).toBe(false);
    expect((await repo.load()).transactions.find((t) => t.id === "t1")!.amount).toBe(99999);
  });
});
