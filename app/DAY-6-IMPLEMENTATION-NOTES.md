# Day 6 — Development OS — Implementation Notes

## What was built

- `src/domains/development/types.ts` — `Project`, `Milestone`, `Skill`
  (Knowledge/Practice percentages stored directly; Evidence deliberately
  NOT stored directly — see below), `SkillEvidence` with `Provenance`.
- `src/domains/development/engine.ts` — `derivePercentToLevel` and
  `computeEvidenceScore`, the provenance-aware evidence calculation.
- `src/domains/development/engine.test.ts` — **9 real tests**, including the
  centerpiece case: a skill with 3 pieces of unreviewed AI-assisted evidence
  shows **0% independent evidence**, not inflated by the fact that work
  technically exists.
- `DevelopmentOverviewPage` (Projects + Skills with all three K/P/E numbers
  shown separately) and `SkillDetailPage` (full breakdown + evidence list
  with provenance visible per item).

## The rule this domain is built around

Master Handoff §14, stated directly: *"AI built feature does not
automatically mean user independently understands skill."*

`computeEvidenceScore` enforces this as actual logic, not a comment: only
evidence marked `independent` or `ai-assisted-reviewed` counts toward the
Evidence score. Pure `ai-assisted` (AI wrote it, not reviewed or explained
back) is **excluded from the score** — but not hidden. Skill Detail shows a
direct warning when this happens: *"AI writing code does not automatically
count as you independently understanding it."*

This matters concretely for your own Day 6 seed data: the Le Grain OS
evidence is `ai-assisted` (unreviewed), so it's visible in the evidence list
but does not inflate the REST APIs skill's Evidence percentage. The other
four pieces of evidence are `independent` or `ai-assisted-reviewed`, so they
do count.

## Verified, not just claimed

- `npx tsc --noEmit` — zero errors
- **`npx vitest run` — 32/32 tests pass across all three engines** (12
  academic + 11 knowledge + 9 development)
- `npm run build` — succeeds
- `npm run lint` — 0 errors, 4 harmless known warnings (same pattern as
  every store so far)

## Explicitly not built (flagged, not skipped by accident)

- Separate `ProjectDetailPage` and `LearningPathPage` — Projects are shown
  in the Overview with milestone progress; a dedicated detail page and the
  full learning-path roadmap visualization are deferred, same reasoning as
  Day 4's deferred Scenario Simulator — real UI work on top of a data model
  that's already correct, not urgent to the core rule this domain protects.
- Capability Gaps / Independence Check / Next Actions panels from the
  approved reference — these are AI-generated planning suggestions layered
  on top of the K/P/E numbers, not part of the deterministic engine itself.
- Competency-level breakdown table (the reference shows 11 sub-competencies
  per skill, e.g. "HTTP Fundamentals," "REST Principles") — this domain
  currently tracks Skill as one level; sub-competencies would reuse the same
  Skill shape rather than needing new types, left for when a real skill
  actually needs that granularity.

## Next: Day 7 — Fitness & Recovery

Base Plan vs Prescription vs Actual (three separate records, history never
overwritten), Recovery states (Push/Normal/Reduced Load/Recovery) without
false precision when data is thin.
