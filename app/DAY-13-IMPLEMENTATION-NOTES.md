# Day 13 — Planning & Calendar — Changelog (final day of the addendum)

**Built**
- `ScheduleBlock`/`Deadline`/`CapacityConfig` types — kept deliberately
  separate from Action/Focus Session/Deadline per §9.1, not one generic Event.
- `detectConflicts` — direct time overlap only. Test matches your approved
  reference's own exact example: two blocks overlapping 14:00–16:00 and
  14:30–16:00 → 90 minutes, confirmed by the code.
- `detectCapacityViolations` — daily and weekly checked **independently**
  (§9.14): one test proves a single overloaded day doesn't trigger a weekly
  flag, another proves the reverse (7 evenly-loaded days can still blow the
  weekly total with no single day over its limit).
- `tryFitBlock` — the real **"Could Not Fit"** rule (§9.11): checks conflict,
  then daily capacity, then weekly capacity, and reports the first genuine
  problem instead of silently allowing overload.
- `rebuildUnlockedBlocks` — **manual locks survive regeneration** (§9.12),
  proven with a test asserting the locked block comes through byte-for-byte
  identical while only unlocked blocks get replaced.
- `computePlanFragility` — "valid but fragile" state (§9.18), test matches
  your reference's own example: 14h capacity, 13h50 scheduled → fragile,
  not just "valid."
- `PlannerPage` (Conflict & Capacity view) — live conflict/violation lists,
  the weekly load bar, and a working "Try Fit" button that demonstrates
  Could-Not-Fit against real seed data (two overlapping Saturday blocks).

**One test bug caught and fixed by me, not silently absorbed:** my first
version of the "exceeds daily capacity" test used a block sized wrong (6h40m
against an 8h cap — didn't actually exceed it). The test failed correctly,
I fixed the test's own numbers, re-ran, verified. Noted here rather than
just quietly re-running until green.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **12/12 new, 93/93 total** across all 10 domains built
  since Day 3
- `npm run build` — clean
- `npm run lint` — 0 errors, 12 known harmless warnings (same pattern every day)

**Deferred, not forgotten**
- Plan Builder (the Generate → Validate → Review → Apply wizard, §9.9) —
  the validation engine it would call (conflicts, capacity, fragility) is
  real and tested; the guided multi-step UI itself is separate work
- Full Calendar Week drag/drop view — `PlannerPage` shows the same
  underlying data as a list/summary, not a draggable weekly grid
- Override system (§9.19, temporary capacity overrides) — no override
  records exist yet, would extend `CapacityConfig` cleanly when needed

---

## Closing note — this finishes the Day 9–13 addendum

Ten domains now share the same discipline, each with a real deterministic
engine underneath, each with at least one place the engine deliberately
refuses to guess:

| Day | Domain | The one rule enforced as tested code |
|---|---|---|
| 4 | Academic | Unresolved grade/repeat policy → excluded, not guessed |
| 5 | Knowledge | Zero evidence → 0% mastery, never fabricated |
| 6 | Development | Unreviewed AI evidence excluded from the score |
| 7 | Fitness | <3 check-ins → "insufficient data," not a fake readiness % |
| 8 | Routines | No streak counter anywhere — consistency only |
| 9 | Language | Exercises alone ≠ Knowledge evidence — only a real recall check counts |
| 10 | Money | Savings transfer ≠ expense; planned ≠ actual |
| 11 | Analytics | No fake combined score; correlation ≠ causation; thin data → limited confidence |
| 12 | AI Coach | AI may recommend nothing; no-access domains never leak |
| 13 | Planning | Could Not Fit is a valid answer; locks survive regeneration |

**93 tests, all passing, across 10 real deterministic engines.** This is
genuinely the full skeleton across every domain from both handoffs — not
polished, not final UI, but real, verified, and honest about exactly where
each domain's edges are.
