# Money OS — Design References

## Purpose
Day 10 defines a lightweight manual personal-finance tracker for awareness, budgets, savings, transactions, and evidence-based review. It is not a full accounting or banking platform.

## Approved assets in this package
- `PBOS-Money-Overview-v1-REFERENCE.png` — monthly money snapshot and quick capture.
- `PBOS-Money-Transactions-v1-REFERENCE.png` — transaction history, filters, and fast entry.
- `PBOS-Money-Insights-Review-v1-REFERENCE.png` — evidence-based weekly/monthly financial review and insights.

## Known missing reference
`PBOS-Money-Budget-Savings-v1-REFERENCE.png` was generated in the conversation, but its runtime filename was later reused by another generated image. The original remains referenced in the conversation/File Library, but the exact PNG binary was not recoverable into this ZIP. **Do not substitute another screen for it.**

## Product / UX intent
- Actual transaction ≠ planned expense.
- Savings transfer ≠ expense.
- PBOS-calculated balance ≠ verified bank balance in manual-tracking V1.
- Budgets, totals, projections, and percentages are deterministic calculations; AI only explains/recommends.
- Money remains separate from any overall PBOS performance score.

## Asset route after extraction
`C:\Performance Buddy OS\Design Assets\11 - Money OS\Approved\`

## Global implementation rules
- These PNGs are **V1 structural / functional visual references**, not permanent pixel-perfect final UI.
- Product behavior and architecture come from the main Performance Buddy OS documentation; these images communicate hierarchy, interaction intent, and approximate composition.
- The locked Design System remains authoritative for typography, color, spacing, radii, borders, shadows, and global tokens. Accidental colors in generated images must not become new global tokens.
- Keep business/domain logic separate from layout components so the later usage-driven UI redesign is recomposition/styling, not a rebuild.
- AI suggestions are advisory; deterministic rules and structured local data remain authoritative where applicable.

## Versioning
`Working → Review → Approved → Implementation`. When an Approved reference is superseded, move the old reference to `Archive` rather than deleting it.
