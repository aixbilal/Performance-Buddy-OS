# Day 4 — Academic OS — Implementation Notes

## What was built

- `src/domains/academic/types.ts` — `Course`, `Topic` (with Professor
  Coverage / Personal Study / Mastery kept as three separate fields, per
  Master Handoff §4 — never collapsed into one number), `Assessment`,
  `CourseAttempt` (immutable, one record per attempt), `Semester`.
- `src/domains/academic/engine.ts` — the deterministic calculation core:
  `calculateWeightedScore`, `calculateSGPA`, `calculateCGPA`,
  `calculateRequiredAverageForTarget`. Pure functions, no AI involvement
  anywhere in this file, per Master Handoff §20 and docs/13.09.
- `src/domains/academic/engine.test.ts` — **12 real tests with known-correct
  answers**, not placeholder tests. Includes hand-worked examples (e.g. a
  3-course SGPA calculated by hand to 3.40, verified the function returns
  exactly that) — see "Verified" below.
- Three real pages: `AcademicsOverviewPage`, `CourseDetailPage` (the
  Professor/Personal/Mastery topic table), `SgpaCgpaPage`.
- `AcademicProvider` store, wired alongside the Day 3 `PerformanceProvider`.

## The most important thing in this update — a real policy conflict, handled honestly

Your own documentation directly contradicts two things the approved
reference screenshot shows as settled:

1. **docs/13.09** states: *"No common 4.0-scale assumption may substitute for
   verified CUI policy... the engine cannot guess a grade from an unverified
   scale."* The reference screenshot implies a score→letter mapping (what %
   makes an A vs A-) exists. **It doesn't, per your own docs.** So this
   engine never converts a percentage score into a letter grade automatically.
   Grades are entered as a deliberate judgment (`projectedGrade`,
   `targetGrade`) — never silently computed from an unverified scale. The
   letter→grade-points table (A=4.00, A-=3.70, etc.) IS used, because that's
   arithmetic printed directly in your approved reference, not a policy
   guess.

2. **docs/13.10** states: *"CUI replacement... rules are RESEARCH REQUIRED.
   No behavior is assumed... Unknown policy blocks affected CGPA rather than
   selecting latest, highest, or average by convenience."* The reference
   screenshot shows automatic "Replace (Better Grade)" behavior for repeats.
   **This engine does not do that.** If a course has more than one graded
   attempt, it is excluded from the CGPA calculation entirely, and the UI
   shows exactly why (`AcademicsOverviewPage` — the warning banner) rather
   than silently picking the better grade.

**`UI ↔ ARCHITECTURE REVIEW REQUIRED`** — both of these need your actual CUI
policy documents before they can be resolved correctly. This isn't a small
detail: implementing the reference screenshot's implied behavior as-is would
have meant guessing at your real grade calculations, which is exactly what
your own docs say never to do.

## Verified, not just claimed

- `npx tsc --noEmit` — zero errors
- **`npx vitest run` — 12/12 tests pass**, including:
  - Weighted score math (hand-calculated: 9 + 18 + 21 = 48, confirmed)
  - SGPA (hand-calculated: (16 + 9.9 + 8.1)/10 = 3.40, confirmed)
  - CGPA with a clean single-attempt case
  - CGPA correctly **excluding** a repeated course and flagging it, instead
    of guessing a replacement rule
  - CGPA correctly folding in a prior settled record (45 credits @ 2.64)
  - Required-average-for-target math, including correctly identifying an
    unreachable target (>4.0 needed) rather than pretending it's fine
- `npm run build` — succeeds
- `npm run lint` — 0 errors, 2 harmless known warnings (same
  component+hook-in-one-file pattern as Day 3's store, intentional)

## An honest mistake, caught before it reached you

While editing `mockData.ts` partway through, one of my edits accidentally
deleted the `export const SEED_ASSESSMENTS = [` line, leaving a syntax error.
**`npx tsc --noEmit` did not catch it on its own** (likely a caching quirk
with TypeScript's incremental build info) — it was `npm run build`, which
rebuilds from scratch, that caught it. Fixed and re-verified before this
package was put together. Flagging this so you know the "run every check,
not just one" discipline isn't decorative — it's the reason this got caught
before it reached you instead of showing up as a confusing error on your
machine.

## Explicitly not built (flagged, not skipped by accident)

- Interactive Scenario Simulator, Risk/Leverage Analyzer, CGPA Trajectory
  chart from the approved reference — these are planning tools layered on
  top of the verified engine, not the calculation engine itself. Deferred
  deliberately to keep Day 4 focused on getting the math right first.
- A separate cross-course "Marks & Assessments" screen — the assessment list
  is shown inside Course Detail instead, to avoid a near-duplicate view of
  the same data (per Master Handoff's "avoid duplicate engines" rule).
- Score-to-letter-grade automation — see the policy conflict above.
- Automatic repeat-grade replacement — see the policy conflict above.

## Next: Day 5 — Knowledge OS

Cross-domain knowledge states, Obsidian ownership boundary (Obsidian owns
note bodies, PBOS owns relationships/evidence only), evidence/recall
distinct from "read it once."
