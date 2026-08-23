---
document_id: P25-README
title: "Phase 25 - Local AI"
status: APPROVED
baseline: v1.0
capability: LOCAL
owner: Local AI
last_updated: 2026-08-17
---

# Phase 25 — Local AI

## Purpose

Phase 25 defines optional intelligence executed on the user's device. It turns the `LOCAL` capability in Phase 02 and the provider-neutral controls in Phase 24 into implementable boundaries for model selection, hardware adaptation, inference, command parsing, classification, extraction, retrieval, benchmarking, and fallback.

## Authority

Local execution changes where inference occurs; it does not make model output deterministic or authoritative. Phase 23 remains the authority for rules and validation, Phase 24 governs every AI run, domain phases own their records, and Phase 16 owns vault access and indexes. A local model never writes trusted state directly.

## Core promise

Performance Buddy OS must start and remain useful without loading a model. Disabling or failing `LOCAL` leaves deterministic `CORE` data readable and editable. No network, remote account, or remote model is required for committed CORE workflows.

## Scope map

This phase specifies responsibilities, the local/cloud decision, evaluation and hardware criteria, runtime abstraction, three bounded task families, local retrieval, structured reliability, benchmarks, and fallbacks. Exact runtime, model, quantization, embedding model, and supported hardware tiers remain `RESEARCH REQUIRED` until measured.

## Non-negotiable flow

`authorized input → minimized local context → bounded inference → schema and confidence checks → deterministic validation → preview/approval when required → separate domain command`

## Acceptance criteria

- All 13 numbered documents exist with exact locked names.
- Local processing is permission-aware, measurable, replaceable, and optional.
- Hardware weakness or model failure cannot corrupt data or block CORE workflows.
- Claims about privacy, offline operation, and quality are backed by tests.

