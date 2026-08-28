# Day 10 — Money OS — Changelog

**Built**
- `Transaction`/`PlannedExpense`/`Budget`/`SavingsGoal` types.
- Deterministic engine: `computeBalance`, `computeUnallocated` ("Currently
  Unallocated," never "Safe to Spend" — §6.8), `computeBudgetStatus`
  (Within/Approaching/Over, using the **80% threshold printed directly in
  your approved reference's own legend** — not a guessed cutoff),
  `computeSavingsProgress`.
- `MoneyOverviewPage` — snapshot, category breakdown, planned expenses
  (explicitly excluded from spending totals), budgets, savings goal, and a
  working Quick Add form across all 3 transaction types.

**The two rules enforced as tested code, not just comments**
- **§6.3 Savings Transfer ≠ Expense** — test proves a Rs 5,000 transfer to
  savings does not appear in the expense total.
- **§6.4 Planned ≠ Actual** — `plannedTotal` is computed from
  `PlannedExpense` records only; it structurally cannot affect
  `computeExpenseTotal`, which only ever reads real `Transaction` records.

**A caught mistake, fixed before packaging:** `npx vitest run` alone passed
even with an unused import in the test file — `tsc -b` (used by `npm run
build`) caught it as a real error. Fixed, re-verified clean. Same lesson as
Day 4: run every check, not just one.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **8/8 new, 62/62 total**, including exact matches to
  your reference's own numbers (Rs 13,450 unallocated, Rs 32,500/100,000
  savings progress)
- `npm run build` — clean
- `npm run lint` — 0 errors, 9 known harmless warnings

**Deferred, not forgotten**
- Money Insights / pattern detection page (recurring-expense detection,
  trend charts) — advisory/analysis layer on top of already-correct
  transaction data
- Transaction editing with dependent-total recalculation (§6 validation
  point) — add-only for now; edit/delete would reuse the same engine
  functions, just needs the UI action
- The Budget & Savings reference image itself is missing from your repo
  (per the addendum's own note) — built from the written spec in §6.7–6.8
  instead, not guessed

**Next:** Day 11 — Analytics & Reviews — cross-domain metrics with **no
universal fake performance score** (§7.1), confidence explicitly lowered
when data is thin.
