---
document_id: P44-README
title: "Technical Research & Architecture Decisions"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Technical Research & Architecture Decisions
last_updated: 2026-08-21
---

# Phase 44 — Technical Research & Architecture Decisions

## Purpose

This phase turns unresolved technology choices into reproducible research and approved architecture decisions without confusing references, prototypes, or vendor claims with project authority.

## Status

Desktop/frontend frameworks, database, mobile/cloud/sync stacks, models, embeddings, vector search, AI SDK/orchestration, UI/chart libraries, encryption, and provider costs remain `RESEARCH REQUIRED`. This phase defines how to decide; it does not select them.

## Invariants

- Requirements and product boundaries choose technology, not the reverse.
- Primary/current sources support volatile or consequential claims.
- Candidates run equivalent risk-focused prototypes and tests.
- Security, offline behavior, accessibility, data integrity, portability, maintainability, and exit cost outweigh popularity.
- Research is `RESEARCH_REFERENCE`; only an approved ADR becomes project authority.
- Prices, quotas, versions, licenses, and terms carry capture dates and review triggers.

## Documents

Documents 44.01–44.18 define research tracks. `ADR/README.md` governs decision-record storage and lifecycle.

## Acceptance criteria

- All 20 locked files exist, including nested `ADR/README.md`.
- Every recommendation separates facts, tests, inference, assumptions, and decision.
- No candidate is approved without an ADR and Phase 00 decision-log linkage.
