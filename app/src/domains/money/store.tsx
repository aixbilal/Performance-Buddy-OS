/**
 * Money OS store — the ONE place Transaction / PlannedExpense / Budget /
 * SavingsGoal state lives.
 *
 * - Canonical persistence is relational SQLite via `MoneyRepo` (Batch 2).
 * - No seed data. Fresh profile is empty; a returning user's pre-2 KV blobs
 *   are imported once (idempotent, non-destructive).
 * - ACTUAL TRANSACTION ≠ PLANNED EXPENSE — realising a plan CREATES a new
 *   linked Transaction; the plan row is never rewritten into an expense.
 * - SAVINGS TRANSFER ≠ EXPENSE (engine excludes it from spending/budgets).
 * - The balance is derived + labelled "tracked", never a verified bank figure.
 * - Money never contributes to a performance score.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cacheAdapter } from "../persistence/cache";
import type { SaveState } from "../resilience/types";
import {
  computeBalance,
  computeBudgetStatus,
  computeCategoryTotals,
  computeExpenseTotal,
  computeIncomeTotal,
  computeSavingsProgress,
  computeSavingsTransferredTotal,
  computeUnallocated,
  deriveMoneyInsights,
  derivePendingPlannedTotal,
  deriveUpcomingPlannedExpenses,
  validateBudgetInput,
  validatePlannedExpenseInput,
  validateSavingsGoalInput,
  validateTransactionInput,
  type BudgetResult,
  type MoneyInsight,
  type SavingsProgress,
} from "./engine";
import { newId } from "./ids";
import { resolveLegacyMoney, type MoneyLegacyReport } from "./legacyImport";
import { makeMoneyRepo, type MoneyRepo } from "./repo";
import type {
  Budget,
  BudgetInput,
  MoneyGraph,
  PlannedExpense,
  PlannedExpenseInput,
  SavingsGoal,
  SavingsGoalInput,
  SavingsGoalStatus,
  Transaction,
  TransactionInput,
  TransactionType,
} from "./types";

type MutResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const EMPTY: MoneyGraph = { transactions: [], plannedExpenses: [], budgets: [], savingsGoals: [] };

type MoneyContextValue = {
  loaded: boolean;
  loadError: string | null;
  saveState: SaveState;
  /** Back-compat alias. */
  transactionsSaveState: SaveState;
  saveError: string | null;
  backend: "sqlite" | "localStorage";
  legacyImport: MoneyLegacyReport | null;

  transactions: Transaction[];
  plannedExpenses: PlannedExpense[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];

  // derived totals
  balance: number;
  unallocated: number;
  incomeTotal: number;
  expenseTotal: number;
  savingsTransferredTotal: number;
  categoryTotals: { category: string; amount: number }[];
  pendingPlannedTotal: number;

  // reads
  getTransaction: (id: string) => Transaction | undefined;
  getBudget: (id: string) => Budget | undefined;
  getSavingsGoal: (id: string) => SavingsGoal | undefined;
  getPlannedExpense: (id: string) => PlannedExpense | undefined;
  getBudgetResult: (budget: Budget) => BudgetResult;
  getSavingsProgress: (goal: SavingsGoal) => SavingsProgress;
  getUpcomingPlannedExpenses: (withinDays?: number) => PlannedExpense[];
  getInsights: () => { insights: MoneyInsight[]; confidence: "none" | "limited" | "moderate" };

  // transaction CRUD
  createTransaction: (input: TransactionInput) => Promise<MutResult>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<MutResult>;
  deleteTransaction: (id: string) => Promise<void>;
  /** Back-compat — fire-and-forget quick add (used by Quick Capture). */
  addTransaction: (t: {
    type: TransactionType;
    amount: number;
    category: string;
    description: string;
    date: string;
    savingsGoalId?: string | null;
  }) => void;

  // planned expense CRUD
  createPlannedExpense: (input: PlannedExpenseInput) => Promise<MutResult>;
  updatePlannedExpense: (id: string, input: PlannedExpenseInput) => Promise<MutResult>;
  deletePlannedExpense: (id: string) => Promise<void>;
  /** Records a NEW actual Transaction for a plan and links it — the two rows stay distinct. */
  realizePlannedExpense: (plannedId: string, date: string) => Promise<MutResult>;

  // budget CRUD
  createBudget: (input: BudgetInput) => Promise<MutResult>;
  updateBudget: (id: string, input: BudgetInput) => Promise<MutResult>;
  deleteBudget: (id: string) => Promise<void>;

  // savings goal CRUD
  createSavingsGoal: (input: SavingsGoalInput) => Promise<MutResult>;
  updateSavingsGoal: (id: string, input: SavingsGoalInput) => Promise<MutResult>;
  setSavingsGoalStatus: (id: string, status: SavingsGoalStatus) => Promise<void>;
  archiveSavingsGoal: (id: string, archived?: boolean) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
};

const MoneyContext = createContext<MoneyContextValue | null>(null);

export function MoneyProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<MoneyRepo>(makeMoneyRepo());
  const [graph, setGraph] = useState<MoneyGraph>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legacyImport, setLegacyImport] = useState<MoneyLegacyReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = repoRef.current;
        const legacy = resolveLegacyMoney({
          transactions: cacheAdapter.getItem("pbos:money-transactions"),
          plannedExpenses: cacheAdapter.getItem("pbos:money-planned-expenses"),
          budgets: cacheAdapter.getItem("pbos:money-budgets"),
          savingsGoals: cacheAdapter.getItem("pbos:money-savings-goals"),
        });
        const report = await repo.importGraph(legacy.graph);
        if (report.ran) setLegacyImport(legacy.report);
        const g = await repo.load();
        if (!cancelled) {
          setGraph(g);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(fn: () => Promise<void>) {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      setSaveError(null);
    } catch (e) {
      setSaveState("failed");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  // --- derived --------------------------------------------------------
  const balance = computeBalance(graph.transactions);
  const incomeTotal = computeIncomeTotal(graph.transactions);
  const expenseTotal = computeExpenseTotal(graph.transactions);
  const savingsTransferredTotal = computeSavingsTransferredTotal(graph.transactions);
  const categoryTotals = computeCategoryTotals(graph.transactions, "expense");
  const pendingPlannedTotal = derivePendingPlannedTotal(graph.plannedExpenses);

  // --- reads ---------------------------------------------------------
  const getTransaction = (id: string) => graph.transactions.find((t) => t.id === id);
  const getBudget = (id: string) => graph.budgets.find((b) => b.id === id);
  const getSavingsGoal = (id: string) => graph.savingsGoals.find((g) => g.id === id);
  const getPlannedExpense = (id: string) => graph.plannedExpenses.find((p) => p.id === id);
  const getBudgetResult = (budget: Budget) => computeBudgetStatus(budget, graph.transactions);
  const getSavingsProgress = (goal: SavingsGoal) =>
    computeSavingsProgress(goal, graph.transactions);
  const getUpcomingPlannedExpenses = (withinDays = 30) =>
    deriveUpcomingPlannedExpenses(graph.plannedExpenses, { today: todayIso(), withinDays });
  const getInsights = () => deriveMoneyInsights(graph, { today: todayIso() });

  // --- transaction CRUD --------------------------------------------
  const buildTransaction = (input: TransactionInput): Transaction => ({
    id: newId("tx"),
    ...input,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  const createTransaction = async (input: TransactionInput): Promise<MutResult> => {
    const v = validateTransactionInput(input);
    if (!v.ok) return v;
    const goalId =
      v.value.savingsGoalId && getSavingsGoal(v.value.savingsGoalId) ? v.value.savingsGoalId : null;
    const tx = buildTransaction({ ...v.value, savingsGoalId: goalId });
    setGraph((g) => ({ ...g, transactions: [...g.transactions, tx] }));
    await persist(() => repoRef.current.transactionUpsert(tx));
    return { ok: true, id: tx.id };
  };

  const updateTransaction = async (id: string, input: TransactionInput): Promise<MutResult> => {
    const existing = getTransaction(id);
    if (!existing) return { ok: false, errors: { _: "Transaction not found." } };
    const v = validateTransactionInput(input);
    if (!v.ok) return v;
    const goalId =
      v.value.savingsGoalId && getSavingsGoal(v.value.savingsGoalId) ? v.value.savingsGoalId : null;
    const tx: Transaction = { ...existing, ...v.value, savingsGoalId: goalId, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, transactions: g.transactions.map((t) => (t.id === id ? tx : t)) }));
    await persist(() => repoRef.current.transactionUpsert(tx));
    return { ok: true, id };
  };

  const deleteTransaction = async (id: string) => {
    setGraph((g) => ({
      ...g,
      transactions: g.transactions.filter((t) => t.id !== id),
      plannedExpenses: g.plannedExpenses.map((p) =>
        p.transactionId === id ? { ...p, transactionId: null, status: "upcoming" } : p,
      ),
    }));
    await persist(() => repoRef.current.transactionDelete(id));
  };

  const addTransaction: MoneyContextValue["addTransaction"] = (t) => {
    void createTransaction({
      date: t.date || todayIso(),
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      savingsGoalId: t.savingsGoalId ?? null,
    });
  };

  // --- planned expense CRUD --------------------------------------
  const createPlannedExpense = async (input: PlannedExpenseInput): Promise<MutResult> => {
    const v = validatePlannedExpenseInput(input);
    if (!v.ok) return v;
    const pe: PlannedExpense = {
      id: newId("pe"),
      ...v.value,
      transactionId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, plannedExpenses: [...g.plannedExpenses, pe] }));
    await persist(() => repoRef.current.plannedUpsert(pe));
    return { ok: true, id: pe.id };
  };

  const updatePlannedExpense = async (
    id: string,
    input: PlannedExpenseInput,
  ): Promise<MutResult> => {
    const existing = getPlannedExpense(id);
    if (!existing) return { ok: false, errors: { _: "Planned expense not found." } };
    const v = validatePlannedExpenseInput(input);
    if (!v.ok) return v;
    const pe: PlannedExpense = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({
      ...g,
      plannedExpenses: g.plannedExpenses.map((p) => (p.id === id ? pe : p)),
    }));
    await persist(() => repoRef.current.plannedUpsert(pe));
    return { ok: true, id };
  };

  const deletePlannedExpense = async (id: string) => {
    setGraph((g) => ({ ...g, plannedExpenses: g.plannedExpenses.filter((p) => p.id !== id) }));
    await persist(() => repoRef.current.plannedDelete(id));
  };

  const realizePlannedExpense = async (plannedId: string, date: string): Promise<MutResult> => {
    const pe = getPlannedExpense(plannedId);
    if (!pe) return { ok: false, errors: { _: "Planned expense not found." } };
    if (pe.transactionId) return { ok: false, errors: { _: "This plan is already realised." } };
    // Create a NEW actual expense transaction — the planned row is NOT mutated into it.
    const tx = buildTransaction({
      date: date || todayIso(),
      type: "expense",
      amount: pe.amount,
      category: pe.category,
      description: `Planned: ${pe.title}`,
      savingsGoalId: null,
    });
    const linked: PlannedExpense = {
      ...pe,
      status: "realized",
      transactionId: tx.id,
      updatedAt: nowIso(),
    };
    setGraph((g) => ({
      ...g,
      transactions: [...g.transactions, tx],
      plannedExpenses: g.plannedExpenses.map((p) => (p.id === plannedId ? linked : p)),
    }));
    await persist(async () => {
      await repoRef.current.transactionUpsert(tx);
      await repoRef.current.plannedUpsert(linked);
    });
    return { ok: true, id: tx.id };
  };

  // --- budget CRUD --------------------------------------------------
  const createBudget = async (input: BudgetInput): Promise<MutResult> => {
    const v = validateBudgetInput(input);
    if (!v.ok) return v;
    const b: Budget = { id: newId("bg"), ...v.value, createdAt: nowIso(), updatedAt: nowIso() };
    setGraph((g) => ({ ...g, budgets: [...g.budgets, b] }));
    await persist(() => repoRef.current.budgetUpsert(b));
    return { ok: true, id: b.id };
  };

  const updateBudget = async (id: string, input: BudgetInput): Promise<MutResult> => {
    const existing = getBudget(id);
    if (!existing) return { ok: false, errors: { _: "Budget not found." } };
    const v = validateBudgetInput(input);
    if (!v.ok) return v;
    const b: Budget = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, budgets: g.budgets.map((x) => (x.id === id ? b : x)) }));
    await persist(() => repoRef.current.budgetUpsert(b));
    return { ok: true, id };
  };

  const deleteBudget = async (id: string) => {
    setGraph((g) => ({ ...g, budgets: g.budgets.filter((b) => b.id !== id) }));
    await persist(() => repoRef.current.budgetDelete(id));
  };

  // --- savings goal CRUD -----------------------------------------
  const createSavingsGoal = async (input: SavingsGoalInput): Promise<MutResult> => {
    const v = validateSavingsGoalInput(input);
    if (!v.ok) return v;
    const goal: SavingsGoal = {
      id: newId("sg"),
      ...v.value,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setGraph((g) => ({ ...g, savingsGoals: [...g.savingsGoals, goal] }));
    await persist(() => repoRef.current.savingsGoalUpsert(goal));
    return { ok: true, id: goal.id };
  };

  const updateSavingsGoal = async (id: string, input: SavingsGoalInput): Promise<MutResult> => {
    const existing = getSavingsGoal(id);
    if (!existing) return { ok: false, errors: { _: "Savings goal not found." } };
    const v = validateSavingsGoalInput(input);
    if (!v.ok) return v;
    const goal: SavingsGoal = { ...existing, ...v.value, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, savingsGoals: g.savingsGoals.map((x) => (x.id === id ? goal : x)) }));
    await persist(() => repoRef.current.savingsGoalUpsert(goal));
    return { ok: true, id };
  };

  const patchGoal = async (id: string, patch: Partial<SavingsGoal>) => {
    const existing = getSavingsGoal(id);
    if (!existing) return;
    const goal: SavingsGoal = { ...existing, ...patch, updatedAt: nowIso() };
    setGraph((g) => ({ ...g, savingsGoals: g.savingsGoals.map((x) => (x.id === id ? goal : x)) }));
    await persist(() => repoRef.current.savingsGoalUpsert(goal));
  };
  const setSavingsGoalStatus = (id: string, status: SavingsGoalStatus) => patchGoal(id, { status });
  const archiveSavingsGoal = (id: string, archived = true) => patchGoal(id, { archived });

  const deleteSavingsGoal = async (id: string) => {
    setGraph((g) => ({
      ...g,
      savingsGoals: g.savingsGoals.filter((x) => x.id !== id),
      transactions: g.transactions.map((t) =>
        t.savingsGoalId === id ? { ...t, savingsGoalId: null } : t,
      ),
    }));
    await persist(() => repoRef.current.savingsGoalDelete(id));
  };

  const value = useMemo<MoneyContextValue>(
    () => ({
      loaded,
      loadError,
      saveState,
      transactionsSaveState: saveState,
      saveError,
      backend: repoRef.current.kind,
      legacyImport,
      transactions: graph.transactions,
      plannedExpenses: graph.plannedExpenses,
      budgets: graph.budgets,
      savingsGoals: graph.savingsGoals,
      balance,
      unallocated: computeUnallocated(graph.transactions),
      incomeTotal,
      expenseTotal,
      savingsTransferredTotal,
      categoryTotals,
      pendingPlannedTotal,
      getTransaction,
      getBudget,
      getSavingsGoal,
      getPlannedExpense,
      getBudgetResult,
      getSavingsProgress,
      getUpcomingPlannedExpenses,
      getInsights,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      addTransaction,
      createPlannedExpense,
      updatePlannedExpense,
      deletePlannedExpense,
      realizePlannedExpense,
      createBudget,
      updateBudget,
      deleteBudget,
      createSavingsGoal,
      updateSavingsGoal,
      setSavingsGoalStatus,
      archiveSavingsGoal,
      deleteSavingsGoal,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, loaded, loadError, saveState, saveError, legacyImport],
  );

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  const ctx = useContext(MoneyContext);
  if (!ctx) throw new Error("useMoney must be used within MoneyProvider");
  return ctx;
}

export type { TransactionType };
