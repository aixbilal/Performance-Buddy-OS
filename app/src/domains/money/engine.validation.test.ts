import { describe, it, expect } from "vitest";
import {
  validateBudgetInput,
  validatePlannedExpenseInput,
  validateSavingsGoalInput,
  validateTransactionInput,
} from "./engine";
import type {
  BudgetInput,
  PlannedExpenseInput,
  SavingsGoalInput,
  TransactionInput,
} from "./types";

const txIn = (o: Partial<TransactionInput> = {}): TransactionInput => ({
  date: "2026-08-10",
  type: "expense",
  amount: 1000,
  category: "Food",
  description: "",
  savingsGoalId: null,
  ...o,
});

describe("validateTransactionInput", () => {
  it("accepts a well-formed expense and rounds the amount", () => {
    const r = validateTransactionInput(txIn({ amount: 12.345 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.amount).toBe(12.35);
  });
  it("rejects a non-positive amount and a bad date", () => {
    expect(validateTransactionInput(txIn({ amount: 0 })).ok).toBe(false);
    expect(validateTransactionInput(txIn({ amount: -5 })).ok).toBe(false);
    expect(validateTransactionInput(txIn({ date: "10/08/2026" })).ok).toBe(false);
  });
  it("requires a category for income/expense but not for a savings transfer", () => {
    expect(validateTransactionInput(txIn({ type: "expense", category: "  " })).ok).toBe(false);
    const r = validateTransactionInput(txIn({ type: "savings-transfer", category: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe("Savings");
  });
  it("only keeps a savingsGoalId for a savings transfer", () => {
    const a = validateTransactionInput(txIn({ type: "expense", savingsGoalId: "g1" }));
    if (a.ok) expect(a.value.savingsGoalId).toBeNull();
    const b = validateTransactionInput(txIn({ type: "savings-transfer", savingsGoalId: "g1" }));
    if (b.ok) expect(b.value.savingsGoalId).toBe("g1");
  });
});

describe("validatePlannedExpenseInput", () => {
  const base: PlannedExpenseInput = {
    title: "Internet",
    amount: 1500,
    category: "Utilities",
    dueDate: "2026-09-05",
    status: "upcoming",
  };
  it("accepts a well-formed plan", () => {
    expect(validatePlannedExpenseInput(base).ok).toBe(true);
  });
  it("requires a title, positive amount, category and valid due date", () => {
    expect(validatePlannedExpenseInput({ ...base, title: " " }).ok).toBe(false);
    expect(validatePlannedExpenseInput({ ...base, amount: 0 }).ok).toBe(false);
    expect(validatePlannedExpenseInput({ ...base, category: "" }).ok).toBe(false);
    expect(validatePlannedExpenseInput({ ...base, dueDate: "soon" }).ok).toBe(false);
  });
});

describe("validateBudgetInput", () => {
  const base: BudgetInput = { category: "Food", period: "2026-08", limitAmount: 5000 };
  it("accepts a well-formed budget", () => {
    expect(validateBudgetInput(base).ok).toBe(true);
  });
  it("rejects a bad period format and a non-positive limit", () => {
    expect(validateBudgetInput({ ...base, period: "2026/08" }).ok).toBe(false);
    expect(validateBudgetInput({ ...base, period: "August" }).ok).toBe(false);
    expect(validateBudgetInput({ ...base, limitAmount: 0 }).ok).toBe(false);
  });
});

describe("validateSavingsGoalInput", () => {
  const base: SavingsGoalInput = {
    title: "Laptop",
    targetAmount: 100000,
    targetDate: null,
    monthlyTarget: 7500,
    openingAmount: 0,
    status: "active",
  };
  it("accepts a well-formed goal", () => {
    expect(validateSavingsGoalInput(base).ok).toBe(true);
  });
  it("rejects a non-positive target and negative monthly / opening amounts", () => {
    expect(validateSavingsGoalInput({ ...base, targetAmount: 0 }).ok).toBe(false);
    expect(validateSavingsGoalInput({ ...base, monthlyTarget: -1 }).ok).toBe(false);
    expect(validateSavingsGoalInput({ ...base, openingAmount: -1 }).ok).toBe(false);
  });
  it("normalises an empty target date to null", () => {
    const r = validateSavingsGoalInput({ ...base, targetDate: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.targetDate).toBeNull();
  });
});
