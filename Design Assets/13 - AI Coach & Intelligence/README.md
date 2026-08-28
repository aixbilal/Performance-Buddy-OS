# AI Coach & Intelligence — Design References

## Purpose
Day 12 defines V1 AI as a transparent intelligence layer over structured PBOS data and deterministic engines—not a generic chatbot and not an autonomous agent system.

## Approved assets
- `PBOS-AI-Coach-Overview-v1-REFERENCE.png` — central context-aware AI brief and entry point.
- `PBOS-AI-Coach-Workspace-v1-REFERENCE.png` — conversation workspace with explicit context, evidence, and structured proposals.
- `PBOS-AI-Recommendations-Decisions-v1-REFERENCE.png` — authoritative inbox for AI-proposed changes and user decisions.
- `PBOS-AI-Context-Permissions-v1-REFERENCE.png` — domain access, context minimization, provider transparency, memory, and permissions.

## Product / UX intent
`Structured PBOS data → deterministic rules → minimized permitted AI context → AI interpretation/proposal → user decision → PBOS validation → applied change`.

- Recommendation ≠ action.
- Conversation ≠ database mutation.
- No unrestricted AI write access in V1.
- Missing evidence should be stated rather than guessed.
- Local-first PBOS does not imply cloud AI requests remain on-device.
- AI failure must not disable deterministic PBOS functionality.

## Asset route after extraction
`C:\Performance Buddy OS\Design Assets\13 - AI Coach & Intelligence\Approved\`

## Global implementation rules
- These PNGs are **V1 structural / functional visual references**, not permanent pixel-perfect final UI.
- Product behavior and architecture come from the main Performance Buddy OS documentation; these images communicate hierarchy, interaction intent, and approximate composition.
- The locked Design System remains authoritative for typography, color, spacing, radii, borders, shadows, and global tokens. Accidental colors in generated images must not become new global tokens.
- Keep business/domain logic separate from layout components so the later usage-driven UI redesign is recomposition/styling, not a rebuild.
- AI suggestions are advisory; deterministic rules and structured local data remain authoritative where applicable.

## Versioning
`Working → Review → Approved → Implementation`. When an Approved reference is superseded, move the old reference to `Archive` rather than deleting it.
