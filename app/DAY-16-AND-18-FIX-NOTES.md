# Day 16 (Search/Commands/Capture) + Day 18 Core Fix — Changelog

## Day 16 — Global Search, Commands & Quick Capture

**Built**
- `domains/search/` — `types.ts`, `engine.ts` (matchType tiering, rankResults
  with bounded boost, rebuildIndex), `store.tsx` (index built live from
  Performance/Academic/Knowledge/Development/Routine stores — genuinely
  derived, per §10), `engine.test.ts` — 11 tests.
- `domains/capture/` — `types.ts`, `engine.ts` (deterministic rule-based
  classifier, honestly labeled as a stand-in for real AI interpretation —
  no AI provider is wired anywhere in this codebase), `store.tsx` (routes
  confirmed captures into the **existing** `addAction`/`addTransaction`
  functions — no new creation path built), `CaptureInboxPage.tsx`,
  `engine.test.ts` — 8 tests.
- `shell/CommandPalette.tsx` — real Ctrl+K listener, arrow-key navigation,
  Enter opens the canonical route (never a duplicate detail view, per §12),
  Esc closes without navigating away from wherever the user was.
- Route: `/capture-inbox` (not in main sidebar nav, same pattern as
  `/onboarding` — reachable, not yet a polished nav destination).

**Verified:** 19 new tests (11 search + 8 capture), all passing.

## Day 18 — the concrete fix identified in the prior audit

- `ScheduleBlock.actionId` added — a real link from Planner back to the
  canonical Action. One seed block (`blk-ds-mastery`) is now genuinely
  linked to Day 3's `act-1` ("Revise Binary Trees") as a live demonstration.
- `rescheduleBlock()` added — proves "moving scheduled time ≠ new Action"
  (§59) with a test that checks `actionId` survives a reschedule unchanged.
- `PerformanceProvider.addAction` added — the real creation path Quick
  Capture (and any future creation UI) routes through.
- **`TodayPage` no longer uses `MOCK_GLANCE`/`MOCK_PLAN`/`MOCK_PROPOSAL`.**
  It now reads real Actions, real Planner blocks (filtered to today's
  day-of-week), and the real pending AI recommendation. This was the single
  biggest finding from the audit — three disconnected task-like data
  sources are now down to one canonical Action referenced from Planner and
  displayed on Today.

**Honest limitation stated in the code, not hidden:** `Action` has no
due-date field yet, so "Today's Plan" matches by day-of-week, not by actual
date. A real date-based Action model is a genuine future improvement.

## Two real mistakes caught by the full verification pass, fixed before packaging

1. `TodayPage`'s recommendation confidence type (`"moderate"/"limited"`)
   didn't match `ProposalCard`'s expected type (`"medium"/"low"`) — caught
   by `tsc -b`, mapped explicitly rather than silently widening the type.
2. The search engine's `.filter()` type predicate was structurally invalid
   TypeScript (filtering nulls out of a union that included `null` doesn't
   narrow the way I'd written it) — rewritten as an explicit loop instead
   of a map+filter, which is both correct and easier to read.

## Verified

- `npx tsc --noEmit` — clean
- `npx vitest run` — **137/137 tests pass**, 14 test files
- `npm run build` — clean
- `npm run lint` — 0 errors, 16 known harmless warnings

## Explicitly not done this pass (continuing next)

- **Day 17 — Resilience & Edge States** — not started yet, next in sequence
- **The missing Focus/Study/Mastery domain** — still genuinely absent,
  flagged in the prior audit, not addressed in this pass
- Day 18's full simplification pass (repeated cards, duplicate presentation
  audit) — not started; today's work was the highest-value structural fix,
  not the full checklist
