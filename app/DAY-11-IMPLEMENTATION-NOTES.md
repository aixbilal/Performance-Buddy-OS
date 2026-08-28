# Day 11 — Analytics & Reviews — Changelog

**Built**
- `DomainSnapshot`/`WeeklyReview`/`Pattern` types.
- `deriveDomainState` — trend-based state (improving/stable/needs-attention),
  confidence scales with real evidence count, never guesses a direction
  without a prior data point.
- `computeCorrelation` — **real Pearson correlation math**, not a guess.
  Below 5 data points, `r` is `null` and confidence is forced to "limited" —
  reporting a precise coefficient from 2-3 points would be fake precision.
- `buildWeeklyReview` — deep-copies its inputs; a test proves mutating the
  original arrays *after* building a review does not change the stored
  snapshot (§11 historical integrity, proven not promised).
- `AnalyticsOverviewPage` — reads **live data from Academic, Fitness, Money,
  and Routine's own stores directly** (no new mock numbers invented for
  domain states), shows one real correlation pattern, and a working "Log
  Weekly Review" button.

**The rule most worth noting: no fake combined score (§7.1)**
The page states this directly, not just avoids it by omission: *"No single
combined 'performance score' is shown here on purpose."* Academics shows
CGPA, Fitness shows a readiness state, Money shows Rs — never merged into
one percentage.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **10/10 new, 72/72 total** across all 8 domains
- `npm run build` — clean
- `npm run lint` — 0 errors, 10 known harmless warnings

**Deferred, not forgotten**
- Weekly/Monthly Review as separate dedicated pages with plan-vs-actual
  detail — the engine and immutable snapshot storage are real and tested;
  a fuller review UI is presentation work on top of already-correct data
- Patterns library beyond the one sleep/focus example — same engine,
  more series to feed it
- Analytics Overview visual reference is missing from your repo (flagged in
  the addendum itself) — built from the written §7.2 spec, not guessed

**Next:** Day 12 — AI Coach & Intelligence — the proposal/approval
architecture this whole build has been quietly preparing for since Day 2's
`ProposalCard`.
