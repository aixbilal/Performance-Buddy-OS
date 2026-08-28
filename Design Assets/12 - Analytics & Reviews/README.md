# Analytics & Reviews — Design References

## Purpose
Day 11 combines domain evidence into review and pattern-detection layers without inventing a universal life/performance score.

## Approved assets in this package
- `PBOS-Analytics-Weekly-Review-v1-REFERENCE.png` — tactical weekly reflection and next-week adjustment.
- `PBOS-Analytics-Monthly-Review-v1-REFERENCE.png` — strategic monthly Goals/Systems review and next-month priorities.
- `PBOS-Analytics-Patterns-Insights-v1-REFERENCE.png` — recurring patterns, confidence, bottlenecks, protective patterns, and experiments.

## Known missing reference
`PBOS-Analytics-Overview-v1-REFERENCE.png` was fully decided/spec'd but **was never generated** before the design track moved to Weekly Review. It is intentionally absent rather than being fabricated for this package.

## Product / UX intent
- No universal Performance Score.
- Activity ≠ outcome ≠ mastery.
- Raw units across domains are not directly comparable.
- Correlation/association must not be presented as causation.
- Missing/incomplete data lowers insight confidence.
- Important insights should expose underlying evidence / “Why?”.
- Weekly Review is tactical; Monthly Review is strategic.

## Asset route after extraction
`C:\Performance Buddy OS\Design Assets\12 - Analytics & Reviews\Approved\`

## Global implementation rules
- These PNGs are **V1 structural / functional visual references**, not permanent pixel-perfect final UI.
- Product behavior and architecture come from the main Performance Buddy OS documentation; these images communicate hierarchy, interaction intent, and approximate composition.
- The locked Design System remains authoritative for typography, color, spacing, radii, borders, shadows, and global tokens. Accidental colors in generated images must not become new global tokens.
- Keep business/domain logic separate from layout components so the later usage-driven UI redesign is recomposition/styling, not a rebuild.
- AI suggestions are advisory; deterministic rules and structured local data remain authoritative where applicable.

## Versioning
`Working → Review → Approved → Implementation`. When an Approved reference is superseded, move the old reference to `Archive` rather than deleting it.
