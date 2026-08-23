---
title: "Phase 08 — Today & Adaptive Planning"
document_id: "P08-README"
phase: "08 - Today & Adaptive Planning"
status: "APPROVED"
baseline: "v1.0"
capability: "CORE"
owner: "Today & Adaptive Planning"
last_updated: "2026-08-17"
---

# Phase 08 — Today & Adaptive Planning

## Purpose

Define the deterministic daily planning system that turns current goals, commitments, constraints, and evidence into a living plan.

## Phase responsibility

Phase 08 owns the Today experience, day/plan lifecycle, feasibility, priority concepts, commitments, operating modes, reconciliation, recalculation, evening replanning, closure, and explanations. Phase 09 owns session execution; Phase 10 owns tracker mechanics; Phase 23 owns reusable deterministic-rule infrastructure.

## Core loop

```text
ORIENT → PLAN → VALIDATE → ACT → CAPTURE
       → RECONCILE → ADJUST → CLOSE → NEXT PLAN
```

CORE performs this loop offline using explicit records and rules. Adaptive does not mean autonomous AI. Rule-based recalculation can identify conflicts and produce candidate changes. The user confirms consequential changes. Later V1–V3 may propose alternatives but use the same validation and approval paths.

## Invariants

- Historical plans and actual results remain distinct.
- Protected constraints are validated before optional allocation.
- Fixed commitments cannot be displaced silently.
- Missing evidence remains unknown.
- Completion uses domain-appropriate evidence and state.
- Modes modify policies/configuration; they do not rewrite history or official rules.
- Every material plan change is attributable and explainable.

## Documents

`08.01–08.10` define the daily model; `08.11–08.15` define operating modes; `08.16–08.19` define reconciliation, replanning, closure, and explanation.

## Acceptance criteria

The day can be planned and reconciled offline, conflicts are visible, realistic alternatives preserve user control, and the system learns from reality without moralizing deviation.

