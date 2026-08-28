# Day 8 — Routines & Daily Life — Changelog

**Built**
- One shared `Routine`/`RoutineLog` engine — boolean, quantity, and duration
  types all use the same shape (Day 8 §3: no separate hydration/prayer/
  skincare engines).
- `deriveCompletionState` — quantity/duration progress → complete/partial/
  pending, from real recorded values only.
- `computeConsistency` — **no streak counter anywhere in this domain** (§5).
  Rolling-window %, rest/skipped days excluded from the denominator (not
  penalized), returns `null` (not 0%) when there's no log history yet.
- `RoutinesOverviewPage` — grouped by Morning/Day/Evening, click to toggle
  today's completion, live 30-day consistency shown per routine.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **8/8 new tests, 47/47 total** across all 5 domains
- `npm run build` — clean
- `npm run lint` — 0 errors, 6 known harmless warnings (unchanged pattern)

**Workflow change this time:** `router.tsx`/`App.tsx` were edited
incrementally (targeted `str_replace`), not fully regenerated — per your
token-saving note last message.

**Deferred, not forgotten**
- Routine Builder (create/edit UI) — routines are seeded, not yet
  user-creatable from the app itself
- Linking a routine to a Day 3 System (`relatedSystemId` field exists,
  no UI to set it yet)
- AI Routine Brief / pattern suggestions — advisory layer on top of
  already-correct consistency data, same reasoning as prior days' deferred
  AI panels

**Next:** Day 9 — Reading & Language Learning (per the addendum you provided) —
keeping Routine (consistency), Language/Reading (curriculum), and Knowledge
(retention) as three separate, linked, non-duplicated systems.
