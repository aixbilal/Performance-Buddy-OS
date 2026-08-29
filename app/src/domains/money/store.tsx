import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Budget, PlannedExpense, SavingsGoal, Transaction, TransactionType } from "./types";
import {
  computeBalance,
  computeBudgetStatus,
  computeCategoryTotals,
  computeExpenseTotal,
  computeIncomeTotal,
  computeSavingsProgress,
  computeUnallocated,
} from "./engine";
import { SEED_BUDGETS, SEED_PLANNED_EXPENSES, SEED_SAVINGS_GOALS, SEED_TRANSACTIONS } from "./mockData";
import { usePersistedState } from "../persistence/usePersistedState";
import type { SaveState } from "../resilience/types";

type MoneyContextValue = {
  transactions: Transaction[];
  plannedExpenses: PlannedExpense[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  balance: number;
  unallocated: number;
  incomeTotal: number;
  expenseTotal: number;
  categoryTotals: ReturnType<typeof computeCategoryTotals>;
  getBudgetResult: (budget: Budget) => ReturnType<typeof computeBudgetStatus>;
  getSavingsProgress: (goal: SavingsGoal) => ReturnType<typeof computeSavingsProgress>;
  addTransaction: (t: Omit<Transaction, "id">) => void;
  plannedTotal: number;
  transactionsSaveState: SaveState;
};

const MoneyContext = createContext<MoneyContextValue | null>(null);

export function MoneyProvider({ children }: { children: ReactNode }) {
  // Real persistence: your recorded transactions now genuinely survive an
  // app restart — see domains/persistence for the honest scope note.
  const [transactions, setTransactions, transactionsSaveState] = usePersistedState<Transaction[]>(
    "money-transactions",
    SEED_TRANSACTIONS
  );
  const [plannedExpenses] = usePersistedState<PlannedExpense[]>("money-planned-expenses", SEED_PLANNED_EXPENSES);
  const [budgets] = usePersistedState<Budget[]>("money-budgets", SEED_BUDGETS);
  const [savingsGoals] = usePersistedState<SavingsGoal[]>("money-savings-goals", SEED_SAVINGS_GOALS);

  const balance = computeBalance(transactions);
  const unallocated = computeUnallocated(transactions); // this month's transactions only, in this seed
  const incomeTotal = computeIncomeTotal(transactions);
  const expenseTotal = computeExpenseTotal(transactions);
  const categoryTotals = computeCategoryTotals(transactions, "expense");
  const plannedTotal = plannedExpenses
    .filter((p) => p.recordedTransactionId === null) // §6.4 — not yet recorded, still just an intention
    .reduce((s, p) => s + p.amount, 0);

  const getBudgetResult = (budget: Budget) => computeBudgetStatus(budget, transactions);
  const getSavingsProgress = (goal: SavingsGoal) => computeSavingsProgress(goal);

  const addTransaction = (t: Omit<Transaction, "id">) => {
    setTransactions([...transactions, { ...t, id: `tx-${Date.now()}` }]);
  };

  const value = useMemo(
    () => ({
      transactions,
      plannedExpenses,
      budgets,
      savingsGoals,
      balance,
      unallocated,
      incomeTotal,
      expenseTotal,
      categoryTotals,
      getBudgetResult,
      getSavingsProgress,
      addTransaction,
      plannedTotal,
      transactionsSaveState,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, plannedExpenses, budgets, savingsGoals, transactionsSaveState]
  );

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  const ctx = useContext(MoneyContext);
  if (!ctx) throw new Error("useMoney must be used within MoneyProvider");
  return ctx;
}

export type { TransactionType };
