# Academic & Focus

## Purpose

This area covers the learning, focused execution and mastery-evidence workflow. Normal Study supports everyday learning; Focus supports targeted uninterrupted execution; Test/Mastery provides evidence of understanding.

## Status

Mixed status. Normal Study and Focus assets are approved. Mastery Assessment and Mastery Results remain in `Review` and must not be treated as approved, partly because stronger semantic colors may need reconciliation with the Design System. Final visual refinement remains planned.

## Assets in This Folder

- `Approved/PBOS-Normal-Study-v1-PRIMARY.png` — approved Normal Study reference.
- `Approved/PBOS-Normal-Study-v1-PRIMARY 2.png` — separate approved Normal Study asset currently present; its relationship to the other version is unresolved and must not be guessed.
- `Approved/PBOS-Focus-Active-v1-PRIMARY.png` — approved active focus-session reference.
- `Approved/PBOS-Focus-Complete-v1-PRIMARY.png` — approved focus completion and test-handoff reference.
- `Review/PBOS-Mastery-Assessment-v1-PRIMARY.png` — review-only mastery assessment reference.
- `Review/PBOS-Mastery-Results-v1-PRIMARY.png` — review-only mastery results reference.

## Product / UX Intent

Keep learning, uninterrupted execution and assessment related but distinct. The interface should make session state, evidence, completion and handoff clear without turning study into a distracting dashboard.

## Implementation Guidance

Build separate reusable flows and state models for Normal Study, Focus Active, Focus Complete/Test Handoff, Mastery Assessment and Mastery Results. Use approved assets for V1 direction; use review assets only as provisional input. Derive timers, assessment rules, mastery logic and writes from documentation and deterministic services.

## What Is Locked

- The three product modes and their conceptual boundaries.
- Approved asset status and the Design System’s global tokens.
- Focus should protect uninterrupted execution.

## What Is NOT Permanently Locked

Review assets, strong semantic colors, exact layouts, illustrative data and decorative treatments are not permanently locked. The duplicate Normal Study relationship requires a future explicit decision.

## Source-of-Truth Rules

Documentation owns learning, focus and assessment behavior; the Design System owns tokens; assets express visual/UX intent; code implements. Generated screenshots cannot override requirements or create new global colors.

## Naming / Versioning

Do not rename current files. Use `Working → Review → Approved → Implementation`; archive replaced approved assets. Future names should follow `PBOS-Academic-Focus-[Screen]-v#-REFERENCE.png` or `...-PRIMARY.png`.

## Notes for Future Design

Resolve the two Normal Study variants explicitly and review mastery colors, accessibility, evidence display and transition clarity before approval.
