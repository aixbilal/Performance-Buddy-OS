/**
 * Canonical relational persistence for the Money OS domain.
 *
 *   store.tsx  ->  MoneyRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                            \->  { localStorage JSON }  (browser dev only)
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { assertRepoWritable } from "../persistence/testControls";
import type { Budget, MoneyGraph, PlannedExpense, SavingsGoal, Transaction } from "./types";

export type MoneyImportReport = {
  ran: boolean;
  transactionsImported: number;
  plannedExpensesImported: number;
  budgetsImported: number;
  savingsGoalsImported: number;
  goalLinksCleared: number;
  transactionLinksCleared: number;
};

export interface MoneyRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<MoneyGraph>;
  transactionUpsert(t: Transaction): Promise<void>;
  transactionDelete(id: string): Promise<void>;
  plannedUpsert(p: PlannedExpense): Promise<void>;
  plannedDelete(id: string): Promise<void>;
  budgetUpsert(b: Budget): Promise<void>;
  budgetDelete(id: string): Promise<void>;
  savingsGoalUpsert(g: SavingsGoal): Promise<void>;
  savingsGoalDelete(id: string): Promise<void>;
  importGraph(graph: MoneyGraph): Promise<MoneyImportReport>;
}

const EMPTY: MoneyGraph = { transactions: [], plannedExpenses: [], budgets: [], savingsGoals: [] };

function normReport(r: Record<string, unknown>): MoneyImportReport {
  const n = (a: unknown, b: unknown) => Number(a ?? b ?? 0);
  return {
    ran: !!r.ran,
    transactionsImported: n(r.transactionsImported, r.transactions_imported),
    plannedExpensesImported: n(r.plannedExpensesImported, r.planned_expenses_imported),
    budgetsImported: n(r.budgetsImported, r.budgets_imported),
    savingsGoalsImported: n(r.savingsGoalsImported, r.savings_goals_imported),
    goalLinksCleared: n(r.goalLinksCleared, r.goal_links_cleared),
    transactionLinksCleared: n(r.transactionLinksCleared, r.transaction_links_cleared),
  };
}

// --- Tauri / SQLite --------------------------------------------------------

class SqliteRepo implements MoneyRepo {
  readonly kind = "sqlite" as const;
  async load() {
    return await invoke<MoneyGraph>("money_load");
  }
  async transactionUpsert(t: Transaction) {
    await invoke("money_transaction_upsert", { transaction: t });
  }
  async transactionDelete(id: string) {
    await invoke("money_transaction_delete", { id });
  }
  async plannedUpsert(p: PlannedExpense) {
    await invoke("money_planned_upsert", { planned: p });
  }
  async plannedDelete(id: string) {
    await invoke("money_planned_delete", { id });
  }
  async budgetUpsert(b: Budget) {
    await invoke("money_budget_upsert", { budget: b });
  }
  async budgetDelete(id: string) {
    await invoke("money_budget_delete", { id });
  }
  async savingsGoalUpsert(g: SavingsGoal) {
    await invoke("money_savings_goal_upsert", { goal: g });
  }
  async savingsGoalDelete(id: string) {
    await invoke("money_savings_goal_delete", { id });
  }
  async importGraph(graph: MoneyGraph) {
    return normReport(await invoke("money_import_graph", { import: graph }));
  }
}

// --- localStorage (browser dev fallback) ---------------------------------

const LS_KEY = "pbos:money-v2";
const LS_IMPORT_MARK = "pbos:money-v2-imported";

export class LocalRepo implements MoneyRepo {
  readonly kind = "localStorage" as const;

  private read(): MoneyGraph {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return { ...EMPTY };
      const g = JSON.parse(raw) as MoneyGraph;
      return {
        transactions: g.transactions ?? [],
        plannedExpenses: g.plannedExpenses ?? [],
        budgets: g.budgets ?? [],
        savingsGoals: g.savingsGoals ?? [],
      };
    } catch {
      return { ...EMPTY };
    }
  }
  private write(g: MoneyGraph) {
    assertRepoWritable(); // dev/test-only save-failure injection (no-op in production)
    window.localStorage.setItem(LS_KEY, JSON.stringify(g));
  }
  private upsert<T extends { id: string; createdAt: string }>(arr: T[], row: T): T[] {
    const i = arr.findIndex((x) => x.id === row.id);
    if (i >= 0) {
      const next = [...arr];
      next[i] = { ...row, createdAt: arr[i].createdAt };
      return next;
    }
    return [...arr, row];
  }

  async load() {
    return this.read();
  }
  async transactionUpsert(t: Transaction) {
    const g = this.read();
    const savingsGoalId =
      t.savingsGoalId && g.savingsGoals.some((x) => x.id === t.savingsGoalId)
        ? t.savingsGoalId
        : null;
    g.transactions = this.upsert(g.transactions, { ...t, savingsGoalId });
    this.write(g);
  }
  async transactionDelete(id: string) {
    const g = this.read();
    g.transactions = g.transactions.filter((t) => t.id !== id);
    // The planned row survives; its realising-transaction link is cleared and it
    // returns to "upcoming" (it is no longer realised). planned ≠ actual.
    g.plannedExpenses = g.plannedExpenses.map((p) =>
      p.transactionId === id
        ? { ...p, transactionId: null, status: p.status === "realized" ? "upcoming" : p.status }
        : p,
    );
    this.write(g);
  }
  async plannedUpsert(p: PlannedExpense) {
    const g = this.read();
    const transactionId =
      p.transactionId && g.transactions.some((x) => x.id === p.transactionId)
        ? p.transactionId
        : null;
    g.plannedExpenses = this.upsert(g.plannedExpenses, { ...p, transactionId });
    this.write(g);
  }
  async plannedDelete(id: string) {
    const g = this.read();
    g.plannedExpenses = g.plannedExpenses.filter((p) => p.id !== id);
    this.write(g);
  }
  async budgetUpsert(b: Budget) {
    const g = this.read();
    g.budgets = this.upsert(g.budgets, b);
    this.write(g);
  }
  async budgetDelete(id: string) {
    const g = this.read();
    g.budgets = g.budgets.filter((b) => b.id !== id);
    this.write(g);
  }
  async savingsGoalUpsert(goal: SavingsGoal) {
    const g = this.read();
    g.savingsGoals = this.upsert(g.savingsGoals, goal);
    this.write(g);
  }
  async savingsGoalDelete(id: string) {
    const g = this.read();
    g.savingsGoals = g.savingsGoals.filter((x) => x.id !== id);
    g.transactions = g.transactions.map((t) =>
      t.savingsGoalId === id ? { ...t, savingsGoalId: null } : t,
    ); // SET NULL — transfers survive
    this.write(g);
  }
  async importGraph(graph: MoneyGraph): Promise<MoneyImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) {
      return {
        ran: false,
        transactionsImported: 0,
        plannedExpensesImported: 0,
        budgetsImported: 0,
        savingsGoalsImported: 0,
        goalLinksCleared: 0,
        transactionLinksCleared: 0,
      };
    }
    const g = this.read();
    const has = (arr: { id: string }[], id: string) => arr.some((x) => x.id === id);
    const report: MoneyImportReport = {
      ran: true,
      transactionsImported: 0,
      plannedExpensesImported: 0,
      budgetsImported: 0,
      savingsGoalsImported: 0,
      goalLinksCleared: 0,
      transactionLinksCleared: 0,
    };
    for (const goal of graph.savingsGoals)
      if (!has(g.savingsGoals, goal.id)) {
        g.savingsGoals.push(goal);
        report.savingsGoalsImported++;
      }
    for (const t of graph.transactions) {
      if (has(g.transactions, t.id)) continue;
      const savingsGoalId = t.savingsGoalId && has(g.savingsGoals, t.savingsGoalId) ? t.savingsGoalId : null;
      if (t.savingsGoalId && savingsGoalId === null) report.goalLinksCleared++;
      g.transactions.push({ ...t, savingsGoalId });
      report.transactionsImported++;
    }
    for (const p of graph.plannedExpenses) {
      if (has(g.plannedExpenses, p.id)) continue;
      const transactionId = p.transactionId && has(g.transactions, p.transactionId) ? p.transactionId : null;
      if (p.transactionId && transactionId === null) report.transactionLinksCleared++;
      g.plannedExpenses.push({ ...p, transactionId });
      report.plannedExpensesImported++;
    }
    for (const b of graph.budgets)
      if (!has(g.budgets, b.id)) {
        g.budgets.push(b);
        report.budgetsImported++;
      }
    this.write(g);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return report;
  }
}

export function makeMoneyRepo(): MoneyRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
