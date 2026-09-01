/** The ONE Transaction form — used for add + inline edit on the Transactions screen. */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import { FormActions } from "../../components/FormActions";
import { TRANSACTION_TYPES, type TransactionInput, type TransactionType } from "./types";

export type TransactionFormValues = {
  date: string;
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  savingsGoalId: string;
};

export const emptyTransactionForm = (): TransactionFormValues => ({
  date: new Date().toISOString().slice(0, 10),
  type: "expense",
  amount: "",
  category: "",
  description: "",
  savingsGoalId: "",
});

export function valuesToInput(v: TransactionFormValues): TransactionInput {
  return {
    date: v.date,
    type: v.type,
    amount: v.amount.trim() === "" ? NaN : Number(v.amount),
    category: v.category,
    description: v.description,
    savingsGoalId: v.type === "savings-transfer" ? v.savingsGoalId || null : null,
  };
}

const TYPE_LABEL: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  "savings-transfer": "Savings transfer",
};

export function TransactionForm({
  initial,
  submitLabel,
  savingsGoals,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: TransactionFormValues;
  submitLabel: string;
  savingsGoals: { id: string; title: string }[];
  onSubmit: (input: TransactionInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<TransactionFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof TransactionFormValues>(k: K, val: TransactionFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    if (res.ok) {
      setErrors({});
      setV(emptyTransactionForm());
    } else {
      setErrors(res.errors ?? {});
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Type"
          value={v.type}
          options={TRANSACTION_TYPES}
          onChange={(x) => set("type", x)}
          labelFor={(t) => TYPE_LABEL[t as TransactionType]}
          error={errors.type}
        />
        <TextField
          label="Amount"
          type="number"
          value={v.amount}
          onChange={(x) => set("amount", x)}
          error={errors.amount}
          placeholder="0"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={v.type === "savings-transfer" ? "Category (optional)" : "Category"}
          value={v.category}
          onChange={(x) => set("category", x)}
          error={errors.category}
          placeholder="e.g. Food & Dining"
        />
        <TextField
          label="Date"
          type="date"
          value={v.date}
          onChange={(x) => set("date", x)}
          error={errors.date}
        />
      </div>
      {v.type === "savings-transfer" && (
        <SelectField
          label="Toward savings goal (optional)"
          value={v.savingsGoalId}
          options={["", ...savingsGoals.map((g) => g.id)]}
          onChange={(x) => set("savingsGoalId", x)}
          labelFor={(id) =>
            id === "" ? "— unassigned —" : (savingsGoals.find((g) => g.id === id)?.title ?? id)
          }
          hint="A savings transfer is a movement, never spending. Linking a goal lets its progress derive from your transfers."
        />
      )}
      <TextField
        label="Note (optional)"
        value={v.description}
        onChange={(x) => set("description", x)}
        error={errors.description}
      />
      {errors._ && <p className="t-small text-status-danger">{errors._}</p>}
      <FormActions submitLabel={submitLabel} busy={busy} onCancel={onCancel} />
    </form>
  );
}
