# Day 7 — Fitness & Recovery — Implementation Notes

## What was built

- `src/domains/fitness-recovery/types.ts` — `TrainingPlan`, `PlannedSession`
  (Base Plan), `Prescription` (today's actual instruction — a separate
  record, not an edit to the base), `ActualSession` (what really happened),
  `RecoveryCheckIn`, `ReadinessState`.
- `src/domains/fitness-recovery/engine.ts` — `deriveReadiness` (honest
  insufficient-data handling) and `buildPrescription` (proves the
  immutability rule in code).
- `src/domains/fitness-recovery/engine.test.ts` — **7 real tests**, including
  one that explicitly snapshots the Base Plan's exercises before and after
  building a modified prescription and asserts they're byte-for-byte
  identical — not just "probably fine."
- `FitnessOverviewPage` (weekly plan + readiness summary) and
  `RecoveryReadinessPage` (full readiness state + check-in logging).

## The two rules this domain is built around

**1. "Never overwrite history" (Master Handoff §15).** The seed data
includes the exact example from your own product doc: Base Plan says
"3.5 km," today's Prescription says "2.5 km easy" with a stated reason —
and `buildPrescription`'s test proves the base plan object is never mutated
to produce that. If you (or the AI) build a real `ActualSession` for it
later, that becomes a third, separate record too — no record is ever edited
to match a later one.

**2. "Insufficient data rather than fabricate 81% readiness" (§15).**
`deriveReadiness` requires at least 3 recent check-ins before it will
compute a score at all — below that, `score` is `null` and the state is
literally `"insufficient-data"`, not a low-confidence guess. This is visible
on screen, not just in the return type: the Readiness card shows a direct
note when this happens, and the check-in form is right there so it's easy to
fix by logging real data, not by the engine pretending to know.

## Verified, not just claimed

- `npx tsc --noEmit` — zero errors
- **`npx vitest run` — 39/39 tests pass across all four engines** (12
  academic + 11 knowledge + 9 development + 7 fitness)
- `npm run build` — succeeds
- `npm run lint` — 0 errors, 5 harmless known warnings (same pattern as
  every store so far)

## Explicitly not built (flagged, not skipped by accident)

- `ActualSession` recording UI — the type and store hook points exist, but
  there's no "log what I actually did" screen yet. The Base→Prescription
  link is real and tested; closing the loop with a logged Actual session is
  a UI task on top of an already-correct model, deferred same as prior days'
  lower-priority screens.
- Active Workout screen (live set/rep tracking during a session) — a
  meaningfully separate, more complex UI (timers, in-session state) from the
  planning/readiness model built today.
- Body-area recovery map, training-load charts, AI Recovery Brief from the
  approved reference — presentation layers on top of the same check-in data,
  not new data needs.
- Exercise progression tracking (e.g. "4×15-20 → next: 4×22") — a
  reasonable future addition once real ActualSession data exists to base
  progression on; building it now would mean guessing at progression rules
  with no real performance data yet.

## Where things stand after 4 domains with a deterministic engine + tests

Academic, Knowledge, Development, and Fitness now all follow the same
pattern: a small, honest, tested calculation core underneath a real UI —
each with at least one place where the engine deliberately refuses to
guess (unresolved grade policy, zero mastery with no evidence, unreviewed
AI evidence excluded, insufficient readiness data). That consistency is
worth noticing — it's the same discipline applied four times, not four
different levels of care.

## Next: Day 8 — Personal Routines & Daily Life OS

Per the supplementary handoff: one shared, configurable Routine/Tracker
engine (not five separate ones for prayer/hydration/skincare/etc.),
consistency-over-streaks, and routines linking to — but never duplicating —
Goals/Systems from Day 3.
