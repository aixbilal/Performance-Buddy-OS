import { describe, it, expect } from "vitest";
import { resolveLegacyMoney } from "./legacyImport";

describe("resolveLegacyMoney", () => {
  it("returns an empty graph for empty input", () => {
    const { graph, report } = resolveLegacyMoney({
      transactions: null,
      plannedExpenses: null,
      budgets: null,
      savingsGoals: null,
    });
    expect(graph).toEqual({
      transactions: [],
      plannedExpenses: [],
      budgets: [],
      savingsGoals: [],
    });
    expect(report.parsed).toEqual({ transactions: 0, plannedExpenses: 0, budgets: 0, savingsGoals: 0 });
  });

  it("migrates transactions preserving ids and type, dropping non-positive amounts", () => {
    const { graph, report } = resolveLegacyMoney({
      transactions: JSON.stringify([
        { id: "tx1", type: "income", amount: 25000, category: "Freelance", description: "p", date: "2026-08-27" },
        { id: "tx2", type: "savings-transfer", amount: 5000, category: "Savings", description: "", date: "2026-08-25" },
        { id: "tx3", type: "expense", amount: 0, category: "X", description: "", date: "2026-08-01" },
      ]),
      plannedExpenses: null,
      budgets: null,
      savingsGoals: null,
    });
    expect(graph.transactions.map((t) => t.id)).toEqual(["tx1", "tx2"]);
    expect(graph.transactions[1].type).toBe("savings-transfer");
    expect(graph.transactions[0].savingsGoalId).toBeNull();
    expect(report.repairs.some((r) => r.includes("non-positive"))).toBe(true);
  });

  it("carries a legacy savings-goal currentAmount into openingAmount and reports it", () => {
    const { graph, report } = resolveLegacyMoney({
      transactions: null,
      plannedExpenses: null,
      budgets: null,
      savingsGoals: JSON.stringify([
        { id: "sg1", title: "New Laptop", targetAmount: 100000, currentAmount: 32500, monthlyTarget: 7500 },
      ]),
    });
    expect(graph.savingsGoals).toHaveLength(1);
    expect(graph.savingsGoals[0].openingAmount).toBe(32500);
    expect("currentAmount" in graph.savingsGoals[0]).toBe(false);
    expect(report.repairs.some((r) => r.includes("openingAmount"))).toBe(true);
  });

  it("migrates a planned expense WITHOUT turning it into an actual transaction", () => {
    const { graph } = resolveLegacyMoney({
      transactions: JSON.stringify([
        { id: "tx1", type: "expense", amount: 2000, category: "University", description: "", date: "2026-09-02" },
      ]),
      plannedExpenses: JSON.stringify([
        { id: "pe1", title: "University expense", amount: 2000, category: "University", dueDate: "2026-09-02", recordedTransactionId: "tx1" },
        { id: "pe2", title: "Internet", amount: 1500, category: "Utilities", dueDate: "2026-09-05", recordedTransactionId: null },
      ]),
      budgets: null,
      savingsGoals: null,
    });
    // still exactly one actual transaction — the planned rows did NOT become expenses
    expect(graph.transactions).toHaveLength(1);
    expect(graph.plannedExpenses).toHaveLength(2);
    expect(graph.plannedExpenses[0].status).toBe("realized");
    expect(graph.plannedExpenses[0].transactionId).toBe("tx1");
    expect(graph.plannedExpenses[1].status).toBe("upcoming");
    expect(graph.plannedExpenses[1].transactionId).toBeNull();
  });

  it("migrates budgets and reports malformed blobs without throwing", () => {
    const { graph, report } = resolveLegacyMoney({
      transactions: "{bad",
      plannedExpenses: null,
      budgets: JSON.stringify([{ id: "bg1", category: "Food & Dining", period: "2026-08", limitAmount: 5000 }]),
      savingsGoals: "also bad",
    });
    expect(graph.budgets).toHaveLength(1);
    expect(report.malformed).toEqual(
      expect.arrayContaining(["pbos:money-transactions", "pbos:money-savings-goals"]),
    );
  });
});
