# Fitness & Recovery

## Purpose

This area covers Fitness Overview, Training Plan Detail, Active Workout, and Recovery/Readiness across the flow `Fitness Goal → Training Plan → Workout Session → Performance Evidence → Adaptation`.

## Status

All current assets are approved V1 references. They guide functional structure and visual direction; a later dedicated UI redesign may refine presentation.

## Assets in This Folder

- `Approved/PBOS-Fitness-Overview-v1-REFERENCE.png` — fitness overview reference.
- `Approved/PBOS-Fitness-Training-Plan-Detail-v1-REFERENCE.png` — training-plan detail reference.
- `Approved/PBOS-Fitness-Workout-Active-v1-REFERENCE.png` — active workout reference.
- `Approved/PBOS-Fitness-Recovery-Readiness-v1-REFERENCE.png` — recovery and readiness reference.

## Product / UX Intent

Connect goals, planning, execution evidence and adaptation while keeping Base Plan, Today’s Prescription and Actual Session distinct. Recovery guidance should be calm, evidence-aware and transparent about uncertainty.

## Implementation Guidance

Model the Base Plan, Today’s Prescription and Actual Session separately, retaining provenance when adaptation occurs. Use recorded evidence for readiness and recovery recommendations. AI may suggest and explain but must not fabricate medical certainty; deterministic validation and user decisions remain authoritative.

## What Is Locked

- The end-to-end fitness flow and three-way plan/prescription/session distinction.
- Evidence and uncertainty boundaries for recovery guidance.
- Approved references and Design System token authority.

## What Is NOT Permanently Locked

Exact charts, readiness visualization, sample data, workout controls, layout and decorative styling may evolve. Accidental strong semantic colors do not become global tokens.

## Source-of-Truth Rules

Documentation defines fitness behavior, evidence and safety boundaries; the Design System defines tokens; these images communicate visual/UX intent; code implements. Generated screens never override requirements or constitute medical authority.

## Naming / Versioning

Do not rename existing assets. Follow `Working → Review → Approved → Implementation`; archive replaced approvals. Prefer `PBOS-Fitness-Recovery-[Screen]-v#-REFERENCE.png` or `...-PRIMARY.png`.

## Notes for Future Design

Refine active-workout usability, readiness explainability, evidence density and accessible state/color treatment during final redesign.
