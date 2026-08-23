---
document_id: P29-README
title: "Phase 29 - Context Routing & Orchestration"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Context Routing & Orchestration
last_updated: 2026-08-21
---

# Phase 29 — Context Routing and Orchestration

## Purpose

Phase 29 defines the deterministic control plane that routes AI applications, builds minimum permissioned context, coordinates bounded model/tool steps, preserves provenance, and resumes safe runs. It supports `LOCAL`, `V1`, `V2`, and `V3` without making any model mandatory for `CORE`.

## Authority

This phase owns routing and orchestration contracts, not domain facts, permissions, AI memory, model policy, or writes. Phase 24 governs AI applications and runs; Phase 23 validates actions; domain services remain sources of record; Phases 26–28 define capability behavior. Context is temporary evidence, never authority.

## Default architecture

Use the least complex workflow that meets evaluated requirements:

1. deterministic/no-model path where sufficient;
2. one bounded model call;
3. native sequential tool/model pipeline;
4. deep specialists only after explicit eligibility and evaluation;
5. an external orchestration framework only when native control is demonstrably inadequate.

## Non-negotiable flow

`request → intent/application route → permission and capability gate → context manifest → model route → bounded execution → output and CORE validation → approval if needed → separate commit → audit/cleanup`

## Acceptance criteria

- All 16 numbered documents exist with exact locked names.
- Every context item has purpose, permission, source, freshness, and retention.
- Routing cannot weaken privacy, capability, budget, validation, or approval.
- Failure/cancellation leaves trusted state unchanged and lower-capability workflows available.

