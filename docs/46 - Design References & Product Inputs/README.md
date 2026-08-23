---
document_id: P46-README
title: "46 - Design References & Product Inputs"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Design References & Product Inputs
last_updated: 2026-08-22
---

# Design References & Product Inputs

## Purpose

Provide governed locations for external evidence, personal inputs, research, visual inspiration, and generated concepts used by Performance Buddy OS. Material in this phase informs work but does not become product authority merely because it is stored here.

## Authority boundary

`PERFORMANCE-BUDDY-OS-BLUEPRINT.md` controls this phase's structure. `00.02 - Source of Truth Rules.md` and `00.06 - Source Classification & Authority.md` control classification, provenance, conflict handling, and promotion. Approved product and domain documents remain authoritative within their ownership. Reference images never override usability, accessibility, privacy, security, or buildability.

## Folder map

| Path | Intended content | Default class |
|---|---|---|
| `01 - Academic References/` | Official CUI material, policies, and personal records | Varies by source |
| `02 - Marks References/` | Legacy score-sheet input | `IMPORTED_RECORD` only after supplied and verified |
| `03 - AI Architecture References/` | Provider and comparative research | `RESEARCH_REFERENCE` |
| `04 - UX References/` | Interaction examples and UX evidence | `RESEARCH_REFERENCE` |
| `05 - Visual References/` | Visual inspiration and screenshots | `RESEARCH_REFERENCE` |
| `06 - Generated Concepts/` | AI- or tool-generated explorations | `AI_INTERPRETATION` |
| `07 - Research Notes/` | Working notes, comparisons, and source leads | `RESEARCH_REFERENCE` or `PROVISIONAL_ASSUMPTION` |

## Required handling

Preserve originals, record provenance, minimize sensitive copies, and never edit a source in place to make it match an interpretation. Extracted or transformed artifacts remain linked to their originals. Promotion into approved documentation requires review through the owning phase and, where applicable, an ADR or Phase 00 decision.

`02 - Marks References/SCORE SHEET.xlsx` is currently an empty intake template, not an approved record and not evidence of any mark or CUI policy.

## Acceptance criteria

- Every locked directory and required file exists at its exact path.
- References remain distinguishable from approved decisions and official facts.
- Sensitive academic inputs have permission-aware, local-first handling.
- No empty folder implies approval, completeness, or source availability.

