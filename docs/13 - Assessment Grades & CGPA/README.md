---
document_id: P13-README
title: "README"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Assessment Grades & CGPA
last_updated: 2026-08-17
---

# Phase 13 — Assessment Grades & CGPA

## Purpose

Phase 13 owns deterministic assessment, weighted-score, grade, SGPA, CGPA, repeat-policy, and projection calculations. It consumes versioned courses, attempts, and credits from Phase 12 and exposes explainable results to planning and analytics.

## Current policy status

The exact CUI grading, assessment, and repeat/replacement policies applicable to the user remain `RESEARCH REQUIRED` under OQ-003 and ASM-006. This phase defines the calculation engine and source gates; it does not invent default weights, thresholds, grade points, rounding rules, or replacement behavior.

## Document map

| Range | Responsibility |
|---|---|
| 13.01–13.06 | Assessment model and templates |
| 13.07–13.10 | Marks, weighted scores, grades, repeats |
| 13.11–13.12 | SGPA and CGPA engines |
| 13.13–13.15 | Clearly labeled scenarios and projections |
| 13.16–13.17 | Explainability and validation |
| 13.18 | Legacy score-sheet migration contract |

## Invariants

1. Official results require an applicable verified policy and verified inputs.
2. Decimal arithmetic, precision, and rounding are explicit and versioned.
3. Historical attempts and source marks are never overwritten by recalculation.
4. Unknown or conflicting inputs block affected official calculations.
5. Projections are scenarios, not promises or university decisions.
6. AI may explain or draft inputs but never performs authoritative academic mathematics.

