---
document_id: P10-README
title: "README"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Tracker & Routine Engine
last_updated: 2026-08-17
---

# Phase 10 — Tracker & Routine Engine

## Purpose

This phase defines the reusable offline engine for recording repeated actions, quantities, durations, checklists, milestones, and reflections. It owns tracker mechanics and shared calculations. Each domain retains ownership of what a tracked value means, which states are valid, and which privacy or safety rules apply.

## Documents

| Document | Responsibility |
|---|---|
| 10.01 | Engine scope and invariants |
| 10.02–10.08 | Canonical tracker types |
| 10.09 | Recurrence and occurrence generation |
| 10.10–10.12 | Completion, rest, excused, and partial semantics |
| 10.13 | Sustainable consistency metrics |
| 10.14 | Optional streak policy |
| 10.15 | Safe customization |

## Ownership boundary

The engine supplies schemas, validation, occurrences, records, and derived metrics. Routine & Spiritual, Fitness & Recovery, Academic, Development, Language Learning, and other owner domains define specialist intent and evidence. Analytics may consume tracker events but cannot rewrite them.

## Invariants

1. `CORE` operation is local, deterministic, and usable without AI or cloud access.
2. Missing data is `Unknown`, never silently incomplete.
3. Rest, excused, partial, maintenance, and not-applicable states remain honest outcomes.
4. A streak never overrides sleep, safety, recovery, faith context, or higher priorities.
5. Historical records retain the definition version used when captured.
6. AI may propose configurations or interpretations only with provenance and human approval.

## Dependencies

Phase 08 owns planning and reconciliation; Phase 09 owns session execution evidence; Phase 20 owns personal and spiritual routine semantics; Phase 22 owns analytical presentation. Phase 10 provides stable contracts to each.

