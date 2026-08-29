# Recheck + Persistence Extension + AI Availability — Changelog

## Recheck first, per your request

Before building anything new, I verified every piece from the last two
turns actually still exists on disk — given the earlier consistency issue.
**Everything held this time**: Focus domain, persistence domain, all
`App.tsx` providers, `ScheduleBlock.actionId`, `TodayPage`'s real data,
`addAction`, the `AppShell` wiring (CommandPalette/ConnectivityBanner/
RouteErrorBoundary), Routine persistence, and the `GoalsOverviewPage`
`EmptyState`. Confirmed with `npx tsc --noEmit` + `npx vitest run` (168/168)
before touching anything further.

## Persistence extended to two more real domains

- **`performance/store.tsx`** — `Action` records (status, new captures via
  Quick Capture) are now genuinely persisted. `Goal`/`System` remain
  in-memory seed data this pass — a visible, deliberate scope line, not an
  oversight: Actions change constantly and were the highest-value target.
- **`money/store.tsx`** — `Transaction` records now genuinely persist.
  Budgets/Planned Expenses/Savings Goals remain seed data for now.
- Both pages (`MoneyOverviewPage`) now show the real `SaveIndicator`.

**Now 3 domains have real persistence: Routines, Actions, Money
Transactions** — the three most frequently-written, highest-value pieces
of data in the app.

## AI Availability — wired for real, honestly

`AICoachPage` now shows a real availability badge using the already-tested
`deriveAIAvailability` engine from Day 17. Since **no real AI provider is
wired anywhere in this codebase** (flagged consistently since Day 12),
`providerConfigured` is honestly `false` — so the badge correctly reads
"Not Configured," with a plain explanation that this is the true state, not
an error, and that PBOS works fully without it. A real "Enable/Disable AI"
toggle exists and genuinely changes the badge between "Disabled" and "Not
Configured" — both true statements about this build's actual state.

## A judgment call, stated rather than hidden

I found ~9 other small "nothing here yet" text lines scattered across
Knowledge, Goals, Today, and AI Coach (e.g. "No sources linked yet" inside
an otherwise-populated Topic Detail page). I did **not** convert these to
the full `EmptyState` component. These are small contextual notes inside
cards that already show plenty of other real data — promoting each one to
a full icon+title+description+action treatment would be over-decorating a
one-line note, which runs against §26's own "keep empty states calm" guidance
and §72's "don't add capability nobody asked for." The two real page-level
empty states (Goals Overview with zero goals, Capture Inbox with zero
items) are exactly the cases `EmptyState` was built for, and both are wired.

## Verified

- `npx tsc --noEmit` — clean
- `npx vitest run` — **168/168 tests**, unchanged count (this pass was
  integration wiring, not new engine logic, so no new tests were needed —
  the underlying `usePersistedState` and `deriveAIAvailability` were already
  tested when built)
- `npm run build` — clean
- **Confirmed in the real compiled `dist/` bundle**: "Not Configured",
  "money-transactions", and "performance-actions" (the real localStorage
  keys) are all genuinely present in the built output
- `npm run lint` — 0 errors, 17 known harmless warnings

## Still genuinely open

- Goals/Systems, Academic marks, Knowledge evidence, Development skills,
  Fitness data — still reset on restart (same mechanical pattern as
  Routines/Actions/Money to extend, just not done yet for these)
- Real SQLite/Rust persistence layer — still not buildable in this sandbox
- The rest of Day 18's simplification sweep
