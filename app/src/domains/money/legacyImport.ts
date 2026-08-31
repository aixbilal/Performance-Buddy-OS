/**
 * One-time migration of the pre-Batch-2 Money KV blobs into the canonical
 * relational graph. Pure and fully testable.
 *
 * Legacy keys + shapes:
 *   pbos:money-transactions     -> [{ id, type, amount, category, description, date }]
 *   pbos:money-planned-expenses -> [{ id, title, amount, category, dueDate, recordedTransactionId }]
 *   pbos:money-budgets          -> [{ id, category, period, limitAmount }]
 *   pbos:money-savings-goals    -> [{ id, title, targetAmount, currentAmount, monthlyTarget }]
 *
 * Guarantees: parse safely, preserve IDs, idempotent, non-destructive, drop
 * malformed / non-positive-amount rows (reported), NEVER convert a planned
 * expense into an actual transaction (its `recordedTransactionId` is carried
 * over as `transactionId` and `status` becomes "realized" only as a label),
 * NEVER fabricate transactions or savings. A legacy savings-goal
 * `currentAmount` is user-maintained data, so it is carried into
 * `openingAmount` (reported) — the new model then derives current progress as
 * openingAmount + linked savings transfers.
 */
import { newId } from "./ids";
import { isPlannedExpenseStatus, isSavingsGoalStatus, isTransactionType } from "./engine";
import type {
  Budget,
  MoneyGraph,
  PlannedExpense,
  PlannedExpenseStatus,
  SavingsGoal,
  Transaction,
  TransactionType,
} from "./types";

export type MoneyLegacyReport = {
  parsed: { transactions: number; plannedExpenses: number; budgets: number; savingsGoals: number };
  malformed: string[];
  repairs: string[];
};

export type MoneyLegacyResult = { graph: MoneyGraph; report: MoneyLegacyReport };

const NOW = () => new Date().toISOString();

function asArray(raw: string | null): { items: unknown[]; malformed: boolean } {
  if (raw == null) return { items: [], malformed: false };
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? { items: v, malformed: false } : { items: [], malformed: true };
  } catch {
    return { items: [], malformed: true };
  }
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : NaN);
const coerceType = (v: unknown): TransactionType => (isTransactionType(v) ? (v as TransactionType) : "expense");

export function resolveLegacyMoney(raw: {
  transactions: string | null;
  plannedExpenses: string | null;
  budgets: string | null;
  savingsGoals: string | null;
}): MoneyLegacyResult {
  const report: MoneyLegacyReport = {
    parsed: { transactions: 0, plannedExpenses: 0, budgets: 0, savingsGoals: 0 },
    malformed: [],
    repairs: [],
  };

  const txArr = asArray(raw.transactions);
  const peArr = asArray(raw.plannedExpenses);
  const bgArr = asArray(raw.budgets);
  const sgArr = asArray(raw.savingsGoals);
  if (txArr.malformed) report.malformed.push("pbos:money-transactions");
  if (peArr.malformed) report.malformed.push("pbos:money-planned-expenses");
  if (bgArr.malformed) report.malformed.push("pbos:money-budgets");
  if (sgArr.malformed) report.malformed.push("pbos:money-savings-goals");

  // --- savings goals (first — planned expenses / transactions may reference them) ---
  const savingsGoals: SavingsGoal[] = [];
  const goalIds = new Set<string>();
  for (const row of sgArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a savings goal row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("sg");
    if (goalIds.has(id)) {
      report.repairs.push(`duplicate savings goal id ${id} skipped`);
      continue;
    }
    const target = num(r.targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      report.repairs.push(`savings goal ${id} → invalid target amount — dropped`);
      continue;
    }
    goalIds.add(id);
    const opening = num(r.currentAmount);
    if (Number.isFinite(opening) && opening > 0) {
      report.repairs.push(
        `savings goal ${id}: legacy currentAmount ${opening} carried into openingAmount (progress now = opening + linked transfers)`,
      );
    }
    savingsGoals.push({
      id,
      title: typeof r.title === "string" ? r.title : "Savings goal",
      targetAmount: target,
      targetDate: typeof r.targetDate === "string" ? r.targetDate : null,
      monthlyTarget: Number.isFinite(num(r.monthlyTarget)) ? Math.max(0, num(r.monthlyTarget)) : 0,
      openingAmount: Number.isFinite(opening) ? Math.max(0, opening) : 0,
      status: isSavingsGoalStatus(r.status) ? (r.status as SavingsGoal["status"]) : "active",
      archived: r.archived === true,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.savingsGoals++;
  }

  // --- transactions ---
  const transactions: Transaction[] = [];
  const txIds = new Set<string>();
  for (const row of txArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a transaction row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("tx");
    if (txIds.has(id)) {
      report.repairs.push(`duplicate transaction id ${id} skipped`);
      continue;
    }
    const amount = num(r.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      report.repairs.push(`transaction ${id} → non-positive amount — dropped`);
      continue;
    }
    txIds.add(id);
    const type = coerceType(r.type);
    const linkedGoal =
      typeof r.savingsGoalId === "string" && r.savingsGoalId ? r.savingsGoalId : null;
    transactions.push({
      id,
      date: typeof r.date === "string" ? r.date.slice(0, 10) : "",
      type,
      amount,
      category: typeof r.category === "string" ? r.category : type === "savings-transfer" ? "Savings" : "General",
      description: typeof r.description === "string" ? r.description : "",
      savingsGoalId: type === "savings-transfer" ? linkedGoal : null,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.transactions++;
  }

  // --- planned expenses (never turned into actual transactions) ---
  const plannedExpenses: PlannedExpense[] = [];
  const peIds = new Set<string>();
  for (const row of peArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a planned expense row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("pe");
    if (peIds.has(id)) {
      report.repairs.push(`duplicate planned expense id ${id} skipped`);
      continue;
    }
    const amount = num(r.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      report.repairs.push(`planned expense ${id} → non-positive amount — dropped`);
      continue;
    }
    peIds.add(id);
    const linkedTx =
      typeof r.recordedTransactionId === "string" && r.recordedTransactionId
        ? r.recordedTransactionId
        : typeof r.transactionId === "string" && r.transactionId
          ? r.transactionId
          : null;
    const status: PlannedExpenseStatus = isPlannedExpenseStatus(r.status)
      ? (r.status as PlannedExpenseStatus)
      : linkedTx
        ? "realized"
        : "upcoming";
    plannedExpenses.push({
      id,
      title: typeof r.title === "string" ? r.title : "Planned expense",
      amount,
      category: typeof r.category === "string" ? r.category : "General",
      dueDate: typeof r.dueDate === "string" ? r.dueDate.slice(0, 10) : "",
      status,
      transactionId: linkedTx, // repo clears it if that transaction doesn't exist
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.plannedExpenses++;
  }

  // --- budgets ---
  const budgets: Budget[] = [];
  const bgIds = new Set<string>();
  for (const row of bgArr.items) {
    if (!row || typeof row !== "object") {
      report.malformed.push("a budget row");
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId("bg");
    if (bgIds.has(id)) {
      report.repairs.push(`duplicate budget id ${id} skipped`);
      continue;
    }
    const limit = num(r.limitAmount);
    if (!Number.isFinite(limit) || limit <= 0) {
      report.repairs.push(`budget ${id} → non-positive limit — dropped`);
      continue;
    }
    bgIds.add(id);
    budgets.push({
      id,
      category: typeof r.category === "string" ? r.category : "General",
      period: typeof r.period === "string" ? r.period : "",
      limitAmount: limit,
      createdAt: NOW(),
      updatedAt: NOW(),
    });
    report.parsed.budgets++;
  }

  return { graph: { transactions, plannedExpenses, budgets, savingsGoals }, report };
}
