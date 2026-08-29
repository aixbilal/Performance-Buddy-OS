# Focus/Study/Mastery Domain + Consistency Fix — Changelog

## An important thing I caught before packaging, not after

Before building anything new this turn, I checked whether last session's
edits had actually stuck — and several hadn't: `App.tsx` was missing the
Search/Capture provider wiring, `performance/store.tsx` was missing
`addAction`, `planning/types.ts` was missing `actionId`, `rescheduleBlock`
was gone from the planning engine, and both the `EmptyState`/
`CommandPalette` UI wirings had reverted. The new domain **folders**
(search, capture, resilience) had survived, but several **edits to existing
files** from that session had not.

I don't have full certainty on the exact cause, but the practical fix was
the same either way: re-verify everything against the actual files on disk
— not against what a prior tool result claimed — and redo whatever was
missing. All of it is now redone and, this time, **re-read from disk
immediately after writing**, not just assumed successful. The full build
output was also grepped directly to confirm the new code is genuinely
present in the compiled bundle, not just the source.

This is worth knowing about even though the fix is complete: if something
you pull in ever looks like it's missing a feature I said was done, tell me
and I'll verify against the actual files rather than assuming.

## Focus / Study & Mastery — the domain that was missing since Day 1

**Built**
- `domains/focus/` — `types.ts`, `engine.ts` (session lifecycle state
  machine: idle→active→paused→completed, with invalid transitions
  rejected rather than silently allowed), `store.tsx` (a real ticking
  timer via `setInterval`), `FocusPage.tsx`, `engine.test.ts` — 10 tests.

**The core rule, enforced as tested code:** completing a Focus session
always logs real duration, but produces Knowledge mastery evidence **only**
if you enter a genuine recall score before finishing — leave it blank and
it says so honestly ("duration logged, but NO mastery evidence added").
Identical honest pattern to Day 9's Language sessions, reusing the same
Knowledge domain's evidence system rather than building a second one.

**Wired into the real app:** the `/focus` nav item, a placeholder since
Day 1, now opens a genuinely working Focus timer.

## Also redone/fixed this turn (see prior notes for full context)

- `ScheduleBlock.actionId` + `rescheduleBlock()` — Planner↔Action link
- `PerformanceProvider.addAction` — the real creation path
- `TodayPage` — reads real Actions/Planner data, not mocks
- `CommandPalette` wired into `AppShell` — Ctrl+K now actually works
- `EmptyState` wired into `GoalsOverviewPage`

## Verified

- `npx tsc --noEmit` — clean
- `npx vitest run` — **10 new (Focus), 159/159 total**, 16 test files
- `npm run build` — clean, and the built `dist/` bundle was grepped
  directly to confirm "Focus Mode" and the new functions are genuinely
  compiled in, not just present in source
- `npm run lint` — 0 errors, 17 known harmless warnings

## Still genuinely open (unchanged from before)

- Offline detection — not built
- Error/recovery/save-failure screens — not built (need real failure
  conditions, which need the still-deferred persistence layer)
- Day 18's full simplification sweep beyond 3 screens — not done
- Real disk persistence — still in-memory only, unchanged since Day 2
