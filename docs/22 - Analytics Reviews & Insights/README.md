---
document_id: P22-README
title: "README"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Analytics Reviews & Insights
last_updated: 2026-08-17
---

# Phase 22 — Analytics Reviews & Insights

## Purpose

Phase 22 defines trustworthy metrics, review periods, trends, friction, risk signals, time allocation, domain views, and carefully bounded cross-domain insight. Analytics is a derived projection layer, never a competing source of truth.

## Document map

| Range | Responsibility |
|---|---|
| 22.01–22.02 | Philosophy and metric contracts |
| 22.03–22.06 | Daily through semester reviews |
| 22.07–22.12 | Domain-specific analytics |
| 22.13–22.17 | Cross-domain, trend, friction, risk, and time |
| 22.18 | Review language |

## Invariants

1. Every metric declares source records, scope, formula/version, window/timezone, exclusions, and missing-data treatment.
2. Derived results never modify source facts.
3. Missing is unknown, not zero or failure.
4. Correlation is not causation; a signal is not a diagnosis or automatic plan change.
5. Time spent is not equivalent to learning, output quality, spiritual quality, fitness benefit, or progress.
6. Money, prayer, reflection, and health-adjacent data cannot form a universal score.
7. `CORE` produces deterministic analytics offline; `V2`/`V3` narratives remain evidence-linked proposals.

## Privacy

Analytics inherits the strictest source permission. Aggregation must not reveal restricted details through small groups, snippets, labels, exports, or model context.

