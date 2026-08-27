# Day 3 — Goals / Systems / Actions — Implementation Notes

## What was built

- `src/domains/performance/types.ts` — the real domain model: `Goal`, `System`,
  `Action`, plus `ProgressMetric` (deliberately not a single generic percent —
  SGPA, km, and currency goals shouldn't be squashed into the same shape).
- `src/domains/performance/store.tsx` — a React Context store with real
  behavior, not just static data: `setActionStatus`, `getSystemsForGoal`,
  `getActionsForSystem`, `getGoalForSystem`, and `computeSystemHealth`
  (deterministic — real completed/total, per Master Handoff §20: AI is never
  the source of truth for completion).
- `src/domains/performance/mockData.ts` — seed data, values taken directly
  from your approved `Goals-Overview` and `System-Detail-Actions` reference
  screenshots so what renders can be checked against the real design.
- Four real pages: `GoalsOverviewPage`, `GoalDetailPage`, `SystemsOverviewPage`,
  `SystemDetailPage` — all reading from the shared store, not separate mock data
  per page.
- Reused the existing `ProposalCard` from Day 2 for both the Goals-overview
  "AI Recommendation" and the System-detail one — per Master Handoff §19,
  did not build a second proposal component.
- Routing: `/goals`, `/goals/:goalId`, `/systems`, `/systems/:systemId` —
  wired into the same single `navigation.ts` source used by the sidebar.

## What actually works, not just renders

- Clicking an Action in System Detail **really changes its status**
  (not-started → in-progress → completed → back to not-started) — this
  updates real React state, and System Health recalculates live from it.
- Approving/Modifying/Rejecting an AI proposal really closes that card —
  proved out the Day 2 `ProposalCard` component actually functions as a
  reusable piece, not a one-off.

## Verified, not just claimed

- `npx tsc --noEmit` — zero errors
- `npm run build` — succeeds
- `npm run lint` (oxlint) — 0 errors, 1 harmless fast-refresh style warning
  (store.tsx exports both a component and a hook from the same file — a very
  common, safe React pattern; flagged honestly rather than silently ignored,
  not worth splitting into two files at this stage)

## Persistence — flag, not a blocker

Everything above lives in React state only. **Nothing survives an app
restart yet.** This was a deliberate choice, not an oversight — real
persistence (SQLite via the Rust layer from ADR-0001) is a separate, larger
piece of work. The store is written with explicit named actions
(`setActionStatus`, etc.) rather than direct array mutation specifically so
that swapping in real persistence later doesn't require rewriting the pages
that consume it — only the inside of `store.tsx` changes.

## UI ↔ ARCHITECTURE REVIEW REQUIRED — now a THIRD sidebar variant

`PBOS-System-Detail-Actions-v1-REFERENCE.png` uses a third different sidebar
structure (Today/Goals/Systems/Actions/Focus/Learn/Test/Routines/Analytics/
AI Tutor/Notes) — different again from both Day 1 references. Not resolved
here. "Systems" is reachable through a Goal's linked systems and via
`/systems` directly, but was deliberately **not** added as its own sidebar
item, to avoid guessing at a fourth structure. This — plus the two earlier
nav conflicts — should get one combined design review, not three separate
patches.

## Explicitly not done (correctly out of scope for Day 3)

- Real persistence (see above)
- Goal Builder AI-Proposal screen (a full guided flow) — the AI Recommendation
  card pattern was implemented and reused instead of a separate builder wizard,
  since the underlying proposal mechanism is identical
- Systems/Actions linking to Academic, Development, or Fitness domains —
  those domains don't exist yet (Days 4/6/7)

## Next: Day 4 — Academic OS

Per the Master Handoff, this is the heaviest remaining day — deterministic
SGPA/CGPA engine, Professor Coverage vs Personal Study vs Mastery kept as
separate fields (not collapsed into one number), configurable assessment
categories. Real test cases with known-correct answers will be written for
the grade math specifically, not just "it compiles."
