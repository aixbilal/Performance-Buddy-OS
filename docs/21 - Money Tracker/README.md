---
document_id: P21-README
title: "README"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Money Tracker
last_updated: 2026-08-17
---

# Phase 21 — Money Tracker

## Purpose

Phase 21 provides lightweight, private personal tracking for income, expenses, categories, cash-flow balance, savings, recurring expenses, and calm weekly/monthly review. It helps the user understand records and make their own choices without becoming accounting, banking, tax, credit, investment, or regulated advice software.

## Document map

| Range | Responsibility |
|---|---|
| 21.01–21.02 | Scope and explicit non-goals |
| 21.03–21.09 | Core records and deterministic totals |
| 21.10–21.11 | Weekly and monthly review |
| 21.12–21.15 | AI, leisure, advice, and score boundaries |

## Evidence basis

The baseline follows the consumer-finance practice of recording income and expenses, comparing actual spending with a plan, and treating savings as a deliberate goal or budget item. Reference: [consumer.gov budget guidance](https://consumer.gov/your-money/making-budget) and the [CFPB Your Money, Your Goals toolkit](https://www.consumerfinance.gov/consumer-tools/educator-tools/your-money-your-goals/toolkit/).

## Invariants

1. All arithmetic is deterministic `CORE`; AI never fabricates or calculates authoritative totals.
2. Financial records are sensitive, local-first, and minimized.
3. Imported and manual records retain provenance and correction history.
4. Unknown, pending, duplicate, refunded, and estimated values remain distinct.
5. Leisure spending is legitimate and contextual, not automatically waste.
6. Money is excluded from any universal performance or moral score.

