# Day 9 — Reading & Language Learning — Changelog

**Built**
- `LanguageUnit`/`LanguageLesson`/`Book` types — Path progress and reading
  progress are pure mechanical arithmetic, never treated as mastery (§5.3, §5.6).
- **Reuses `topic-german-vocab` from Day 5's Knowledge domain directly** —
  no duplicate skill/mastery tracking created (Master Handoff §19).
- `deriveSessionEffects` — the core Day 9 rule as real, tested logic:
  completing exercises can mark a lesson done and always logs Routine
  practice minutes, but **Knowledge evidence is only added if a real recall
  score was recorded**. Exercises alone produce zero evidence, on purpose.
- `ReadingLanguageOverviewPage` — Path progress shown separately from the
  reused Knowledge skill state, plus a working "Complete Session" form that
  applies effects to all three domains (Language, Knowledge, Routine) —
  each via that domain's own store, so Language never holds another
  domain's state directly.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **7/7 new tests, 54/54 total** across all 6 domains
  (includes a test matching your product doc's exact example: page 124/320
  → 39%, confirmed by the code, not just described)
- `npm run build` — clean
- `npm run lint` — 0 errors, 8 known harmless warnings

**Deferred, not forgotten**
- Reading session logging UI (pages read → progress update) — `Book`/
  `ReadingSession` types exist, no "log a reading session" form yet
- Multiple language paths / full unit tree — one active unit shown, matching
  lean-scope pattern from prior days
- AI Learning Brief — advisory layer, same reasoning as every prior day's
  deferred AI panel

**Next:** Day 10 — Money OS, per the addendum — deterministic income/expense/
budget math, with savings transfers explicitly never counted as spending.
