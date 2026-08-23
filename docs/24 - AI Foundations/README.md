---
document_id: P24-README
title: "Phase 24 - AI Foundations"
status: APPROVED
baseline: v1.0
capability: CORE
owner: AI Foundations
last_updated: 2026-08-17
---

# Phase 24 — AI Foundations

## Purpose

This phase defines the provider-neutral foundation for optional AI capabilities in Performance Buddy OS. It governs how models receive context, retrieve evidence, call tools, use memory, produce structured results, consume resources, run in the background, and pass evaluation gates.

## Authority and boundaries

Phase 24 owns AI orchestration contracts—not academic, fitness, routine, money, or other domain facts. Phase 23 remains authoritative for deterministic rules, protected constraints, validation, reason codes, and user overrides. AI output is probabilistic and non-authoritative until validated; a successful schema check never proves semantic truth.

The deterministic CORE must remain useful without a model or network connection. Capability labels follow `02 - Capability & Version Architecture`: `LOCAL`, `V1`, `V2`, `V3`, `CLOUD`, `MOBILE`, and `FUTURE` are never silently promoted into `CORE`.

## Documents

The documents cover architecture, application composition, context/data/tool/memory rules, capability boundaries, structured outputs, tool calling, prompts, retrieval, memory, run lifecycle, providers, failures, cost, rate limits, background work, and evaluation gates.

## Non-negotiable flow

`request → permission check → context/retrieval → model → output validation → Phase 23 validation → user approval when required → separate commit → audit`

No model response may bypass permissions, protected constraints, deterministic calculations, or approval requirements.

## Acceptance criteria

- All 17 numbered documents exist and use baseline v1.0 terminology.
- AI remains optional, explainable, permission-bound, and reversible.
- Sensitive data and meaningful writes require explicit governance.
- Provider failure leaves CORE workflows available and trusted data unchanged.

