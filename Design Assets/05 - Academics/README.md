# Academics

## Purpose

This area covers Academics Overview, Course Detail, Marks and Assessments, and SGPA/CGPA intelligence.

## Status

All current assets are approved V1 references. They communicate functional hierarchy and visual direction; final pixel-level design remains open for the planned refinement phase.

## Assets in This Folder

- `Approved/PBOS-Academics-Overview-v1-REFERENCE.png` — academic portfolio overview reference.
- `Approved/PBOS-Academic-Course-Detail-v1-REFERENCE.png` — course detail reference.
- `Approved/PBOS-Academic-Marks-Assessments-v1-REFERENCE.png` — marks and assessment reference.
- `Approved/PBOS-Academic-SGPA-CGPA-v1-REFERENCE.png` — SGPA/CGPA intelligence reference.

## Product / UX Intent

Give a trustworthy view of academic structure, coverage, evidence and calculated outcomes. Professor coverage, personal study coverage and mastery are distinct measures and must remain visibly separate.

## Implementation Guidance

Build overview, course, assessment and GPA components on canonical academic data. Marks, weighted scores, SGPA and CGPA must be calculated by deterministic, testable logic—not by an LLM. AI may explain or suggest, but it cannot authoritatively calculate or silently change records.

## What Is Locked

- Separation of professor coverage, personal study coverage and mastery.
- Deterministic authority for academic calculations.
- Approved V1 reference status and Design System token authority.

## What Is NOT Permanently Locked

Exact visualization types, sample values, composition, labels, density and decorative details can evolve during final redesign.

## Source-of-Truth Rules

Main documentation defines academic entities and calculations; the Design System defines visual tokens; these images are visual/UX references; code implements and tests the rules. Generated screens never override product requirements.

## Naming / Versioning

Do not rename current assets. Use `Working → Review → Approved → Implementation`; archive superseded approvals. Prefer `PBOS-Academics-[Screen]-v#-REFERENCE.png` or `...-PRIMARY.png`.

## Notes for Future Design

Validate calculation explainability, uncertainty-free presentation, coverage distinctions, accessibility and realistic high-volume course data.
