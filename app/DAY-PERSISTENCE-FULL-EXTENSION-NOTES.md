# Persistence Extended to All Remaining Domains — Changelog

## Every domain flagged as "still open" now has real persistence

Following the exact same pattern established with Routines/Actions/Money:

| Domain | What's now persisted | Storage key |
|---|---|---|
| Academic | Assessments (entered marks) | `academic-assessments` |
| Knowledge | Evidence (recall/test scores — mastery derives from this) | `knowledge-evidence` |
| Development | Skill evidence (ready for when a creation UI exists) | `development-evidence` |
| Fitness | Recovery check-ins (readiness derives from this) | `fitness-checkins` |
| Performance | **Goals and Systems** (completing that domain — Actions were already done) | `performance-goals`, `performance-systems` |

**Every domain that had a real user-facing "add/edit" action now survives
an app restart.** Combined with the earlier Routines/Actions/Money work,
that's now **8 real persisted data types across 6 domains**.

## What's still honestly seed-only

- Course/Topic definitions (Academic), Book/Language unit definitions,
  Project/Skill definitions (Development), Training Plan/Sessions
  (Fitness), Budgets/Planned Expenses/Savings Goals (Money) — these are
  mostly *configuration* rather than *frequently-recorded activity*, and
  don't currently have creation UI in the app. Same honest reasoning as
  before: persisting was prioritized by what's actually written to
  regularly, not applied uniformly just to say "100% persisted."

## Save visibility added

`SaveIndicator` now also appears on the Academics and Recovery & Readiness
pages, alongside the ones already on Routines and Money.

## One real cleanup caught during this pass

`performance/store.tsx` no longer imports `useState` at all — with Goals,
Systems, and Actions all now going through `usePersistedState`, the
original import became dead code. Removed before it could become a lint
warning or a stale trap for a future edit.

## Verified

- `npx tsc --noEmit` — clean
- `npx vitest run` — **168/168 tests**, unchanged (integration wiring using
  already-tested `usePersistedState`, no new engine logic needed)
- `npm run build` — clean
- **Confirmed directly in the compiled `dist/` bundle** — all 6 new storage
  keys (`academic-assessments`, `knowledge-evidence`,
  `development-evidence`, `fitness-checkins`, `performance-goals`,
  `performance-systems`) are genuinely present in the built output
- `npm run lint` — 0 errors, 17 known harmless warnings

## What's left, genuinely

- The real SQLite/Rust persistence layer — still not buildable in this
  sandbox (no Rust toolchain)
- Configuration-style seed data (courses, projects, training plans, etc.)
  — no creation UI exists yet for most of these, so persisting them has no
  visible effect until that UI exists
- The rest of Day 18's simplification sweep
