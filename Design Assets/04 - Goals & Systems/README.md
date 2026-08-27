# Goals & Systems

## Purpose

This area visualizes the global PBOS model `Goal → System → Actions`, including overview, detail and AI-assisted proposal experiences. Goals span all domains and are not Academic-only.

## Status

All current assets are approved V1 references. They establish structural and interaction direction, not permanent pixel-perfect screens. A final UI redesign is expected later.

## Assets in This Folder

- `Approved/PBOS-Goals-Overview-v1-REFERENCE.png` — goals overview reference.
- `Approved/PBOS-Goal-Detail-v1-REFERENCE.png` — individual goal detail reference.
- `Approved/PBOS-Goal-Builder-AI-Proposal-v1-REFERENCE.png` — AI-assisted goal-builder proposal reference.
- `Approved/PBOS-Systems-Overview-v1-REFERENCE.png` — systems overview reference.
- `Approved/PBOS-System-Detail-Actions-v1-REFERENCE.png` — system detail and actions reference.

## Product / UX Intent

Make long-term intent actionable by connecting goals to repeatable systems and concrete actions. Users should see progress and relationships without conflating the three entity types or allowing AI proposals to become automatic commitments.

## Implementation Guidance

Implement Goal, System and Action as distinct linked entities and reusable views. AI-generated proposals must remain proposals: validate them with deterministic rules and require user review. Keep domain-neutral components so goals can connect to academics, development, fitness and other areas.

## What Is Locked

- The `Goal → System → Actions` model.
- Goals are global across domains.
- Current approved assets and locked Design System tokens guide V1.

## What Is NOT Permanently Locked

Exact card arrangements, example content, charts, copy, icons and decorative styling may evolve during final redesign.

## Source-of-Truth Rules

Documentation owns entity semantics, behavior and validation; the Design System owns tokens; these images communicate hierarchy and UX direction; application code implements. Screenshots never override explicit requirements.

## Naming / Versioning

Preserve existing names. Future assets follow `Working → Review → Approved → Implementation`; replaced approvals move to `Archive`. Prefer `PBOS-Goals-Systems-[Screen]-v#-REFERENCE.png` or `...-PRIMARY.png`.

## Notes for Future Design

Test cross-domain scanning, relationship clarity, proposal review and action density with real data during final refinement.
