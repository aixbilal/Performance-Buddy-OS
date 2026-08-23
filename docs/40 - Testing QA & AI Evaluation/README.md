---
document_id: P40-README
title: "Testing QA & AI Evaluation"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Testing QA & AI Evaluation
last_updated: 2026-08-21
---

# Phase 40 — Testing QA & AI Evaluation

## Purpose

This phase defines release-gating verification for deterministic behavior, integrations, complete user journeys, offline operation, synchronization, academic calculations, adaptive planning, AI quality/safety, UX, performance, and regression control.

## Quality contract

Tests derive from approved requirements and preserve source, rule, schema, model, prompt, provider, dataset, and environment versions. A passing demonstration is not evidence of general reliability. Consequence determines coverage, independence, thresholds, and human review.

## Invariants

- Deterministic CORE results are exactly reproducible.
- Rejected or failed commands cause no hidden writes.
- Offline, retry, replay, migration, and recovery paths receive first-class testing.
- AI schema validity, grounding, recommendation value, safety, privacy, and cost are measured separately.
- Critical permission, secret, approval, data-integrity, unsafe-advice, or false-completion defects block promotion.
- Flaky tests are defects, not acceptable release evidence.

## Documents

Documents 40.01–40.19 define the strategy and specialized suites.

## Acceptance criteria

- All 20 locked Phase 40 files exist with `CORE` metadata.
- Every release requirement maps to reproducible evidence and an owner.
- Waivers are scoped, time-bounded, reviewable, and cannot bypass product invariants.
