---
document_id: P12-README
title: "README"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Academic OS
last_updated: 2026-08-17
---

# Phase 12 — Academic OS

## Purpose

Phase 12 defines the authoritative academic structure for university, program, curriculum, semesters, courses, attempts, credit hours, prerequisites, enrollment, imports, and dashboard projections. It does not define assessment mathematics or study-allocation intelligence.

## Document map

| Range | Responsibility |
|---|---|
| 12.01–12.06 | Academic hierarchy and versioned structure |
| 12.07–12.09 | Credits, attempts, and outcomes |
| 12.10–12.11 | Prerequisite graph and risk |
| 12.12–12.13 | Enrollment and course lifecycle |
| 12.14–12.16 | Official and personal record imports |
| 12.17 | Academic dashboard contract |

## Authority boundary

Official CUI material is authoritative for institution-wide curriculum and policy. Imported personal records describe the user’s history but do not create general rules. Phase 13 owns deterministic grade, GPA, and CGPA calculations; Phase 14 owns academic planning and study intelligence; Phase 15 owns knowledge evidence.

## Current evidence status

The exact CUI curriculum and policy versions applicable to the user remain `RESEARCH REQUIRED` under OQ-003 and ASM-006. This phase defines how verified facts will be stored and validated; it does not fill that gap with assumed course lists, thresholds, replacement rules, or prerequisite rules.

## Invariants

1. Every policy-dependent fact retains source, applicable version, and effective dates.
2. Historical attempts are immutable facts corrected only through audited revisions.
3. Unknown and conflicting policy block consequential calculations.
4. Personal academic data is sensitive and offline-first.
5. AI may extract or explain drafts but cannot establish official truth.

