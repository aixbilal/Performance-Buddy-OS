---
document_id: P23-README
title: "README"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Deterministic Rules & Decision Engine
last_updated: 2026-08-17
---

# Phase 23 — Deterministic Rules & Decision Engine

## Purpose

Phase 23 defines the offline enforcement layer that evaluates constraints, calculations, schedules, budgets, recommendations, conflicts, overrides, reason codes, and rule versions. It validates decisions proposed by users, planners, imports, or AI; it does not replace domain ownership.

## Document map

| Range | Responsibility |
|---|---|
| 23.01–23.03 | Engine model, logic boundary, rule priority |
| 23.04–23.06 | Protected, sleep, and fixed constraints |
| 23.07–23.09 | Academic, scheduling, and budget rules |
| 23.10–23.15 | Validation, recommendations, conflicts, overrides, reasons, versions |

## Invariants

1. Given identical inputs and rule versions, `CORE` returns identical results.
2. Domain owners define meaning; Phase 23 executes registered rules and never invents policy.
3. Safety and protected constraints filter before ranking or optimization.
4. Unknown critical inputs block or explicitly downgrade the result.
5. AI output is untrusted input until schema, permission, domain, and constraint validation pass.
6. No rule silently mutates source records or a confirmed plan.
7. Every consequential result includes reason codes, input snapshot, rule versions, and approval requirements.
8. Overrides cannot grant new data permissions or create false official facts.

