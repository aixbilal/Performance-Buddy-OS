# Day 14 — Settings & Preferences — Changelog

**First: created the two missing READMEs**
- `Design Assets/15 - Settings & Preferences/README.md`
- `Design Assets/16 - Onboarding & Initial Setup/README.md`

Both folders had **zero assets present** — no reference images, no folders
even existed on disk. Per the handoff's own rule ("do not invent missing
assets"), both READMEs document this honestly and list the *expected*
filenames as not-yet-present, rather than pretending a reference exists.
Day 14 engineering below proceeds from the written specification only —
same approach used for Money's missing Budget/Savings image and Analytics'
missing Overview image in earlier days.

**Built**
- `BaseConfig`/`ModeOverride`/`TemporaryOverride`/`ResetScopeResult` types.
- `computeEffectiveWeekdayCapacity` — the core §5 precedence rule. Test
  **matches the handoff's own worked example exactly**: 90 base + 45
  midterm-mode + 15 temporary = 150 minutes (2h30). A second test proves
  the fallback behavior — once the temporary override expires, effective
  capacity correctly drops back to 135 (base + mode only), not 150.
- `resolveResetScope` — the concrete enforcement of §19: an "interface"
  reset's `affects` list is tested to **never** contain academic records,
  goals, actions, routines, schedule, or AI permissions.
- `SettingsPage` — live mode switcher showing the full precedence chain
  update in real time, notification category toggles (AI defaults to off,
  per §17), reduced motion, and a working "Restore Interface Defaults"
  button that shows exactly what it did and did not touch.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **6/6 new, 99/99 total** across all 11 domains
- `npm run build` — clean
- `npm run lint` — 0 errors, 13 known harmless warnings

**Deferred, not forgotten**
- Performance & Planning settings beyond weekday capacity (weekend,
  development, language baseline are typed but not yet wired to their own
  UI controls — the precedence engine generalizes to them trivially)
- AI/Privacy/Data settings page — Day 12's permission model is the real
  data source; a dedicated settings view onto it is presentation work
- Backup/export/import — architecture only, no implementation (correctly
  out of scope per the handoff's own "V1 Settings should support
  architecture for" phrasing, not "must implement")
- "Full" reset scope — `resolveResetScope("full")` returns an explicit,
  clearly-labeled result but has no real destructive implementation wired
  to it; deliberately not built until real data-deletion safety review

**Day 15A (Onboarding) is next** — not started this turn, per the
one-day-at-a-time discipline this build has followed since Day 3.
