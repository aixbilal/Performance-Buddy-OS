# Day 5 — Knowledge OS — Implementation Notes

## What was built

- `src/domains/knowledge/types.ts` — `Topic`, `Source` (reference-only, see
  below), `Evidence`.
- `src/domains/knowledge/engine.ts` — deterministic, tested functions:
  `deriveKnowledgeState` (mastery% → New/Learning/Developing/Strong),
  `isReviewDue` (independent of state — a topic can be Strong AND Review Due
  at once, per Master Handoff §5), `computeMasteryFromEvidence`
  (recency-weighted average of real evidence, never fabricated).
- `src/domains/knowledge/engine.test.ts` — **11 real tests**, including a
  hand-checked recency-weighting example (40% old + 90% new → 73%, verified
  by the test, not assumed).
- `KnowledgeOverviewPage` (Currently Learning cards + Review Queue + All
  Topics) and `TopicDetailPage` (state/mastery, Notes & Sources, Evidence).
- `KnowledgeProvider` store, wired alongside Days 3–4's providers.

## The locked rule this domain is built around

Design Assets/06 README states plainly: *"Obsidian owns long-form Markdown
note bodies. PBOS owns relationships/context/intelligence... Avoid two
independent authoritative copies of the same note body."*

`Source.reference` is a path string only (e.g.
`"Obsidian/DSA/Binary Trees.md"`) — **the actual note content is never
stored, fetched, or duplicated here.** This is visible in the UI itself, not
just a code comment: Topic Detail's Sources card says outright *"the actual
note content lives in Obsidian, not duplicated here."*

**Honest limitation, not hidden:** real Obsidian vault file access (reading
the actual files on disk) needs real filesystem permissions from the
Tauri/Rust side, which hasn't been built. Sources right now are metadata you
enter, not files PBOS has actually opened and verified exist. That's a
real, separate piece of future work — filesystem integration, not
Knowledge-domain logic.

## Verified, not just claimed

- `npx tsc --noEmit` — zero errors
- **`npx vitest run` — 23/23 tests pass across both domains** (12 academic +
  11 knowledge)
- `npm run build` — succeeds
- `npm run lint` — 0 errors, 3 harmless known warnings (same
  component+hook-per-file pattern as every store so far)

## Why mastery is 0% with no evidence, not a guess

Per Master Handoff §5 and §16: *"AI should not fabricate behavior history."*
A brand-new topic with no test/quiz/recall evidence yet shows exactly that —
0% mastery, state "new" — instead of an invented starting number. The UI
says this directly: *"No evidence recorded yet — mastery is 0% until it is."*

## Explicitly not built (flagged, not skipped by accident)

- Real Obsidian vault file reading/writing (filesystem access) — see above
- Knowledge Map / Relationships graph visualization from the approved
  reference — a real graph UI is a meaningfully separate piece of work from
  the data model; deferred rather than faking a static picture
- Monthly Knowledge Theme ("Cars: 18/30 explored") — a presentation feature
  on top of the same Topic data, not a new data need; can be added later
  without touching the engine
- Subtopic-level breakdown table (seen in the Topic Detail reference) — this
  domain tracks Topics at one level for now; sub-topics would reuse the same
  Topic shape recursively rather than needing a new type, left for when it's
  actually needed

## Next: Day 6 — Development OS

Project Progress vs Skill Progress vs Knowledge kept separate (same
separation discipline as Days 4–5), Knowledge/Practice/Evidence model,
AI-assisted-coding provenance tracking.
