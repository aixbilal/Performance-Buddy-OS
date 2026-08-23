---
document_id: P30-README
title: "Phase 30 - AI Governance Permissions & Explainability"
status: APPROVED
baseline: v1.0
capability: CORE
owner: AI Governance Permissions & Explainability
last_updated: 2026-08-21
---

# Phase 30 — AI Governance, Permissions, and Explainability

## Purpose

Phase 30 defines the enforceable governance layer for every AI capability in Performance Buddy OS. It controls who decides, what data AI may use, where processing may occur, which writes may be proposed, how recommendations are explained, and how behavior is tested and audited.

## Governing principle

`AI suggests → deterministic rules validate → human decides → owner domain commits → system audits`

AI output is probabilistic and non-authoritative. Structured output, local execution, high confidence, or a successful validation does not grant truth or write authority. CORE remains usable without AI.

## Permission model

Permissions are specific to user, AI application, purpose, domain/category, operation, execution location, provider, retention/memory, and time. Sync, backup, analytics, local AI, cloud AI, and memory consents are separate. The stricter applicable rule wins.

## Data zones

- **Eligible by policy:** still purpose-minimized and permission checked.
- **Local-only:** AI use may occur only through an approved local adapter.
- **Ask every time:** each run requires a fresh contextual decision.
- **Never-AI:** excluded from model context, retrieval, embeddings, memory, logs, and provider transfer.

## Acceptance criteria

- All 17 numbered documents exist with exact locked names.
- Enforcement exists in access control, context building, tools, validation, UI, and tests—not prompts alone.
- Meaningful writes require scoped approval and separate commit.
- Revocation stops future access and invalidates prohibited derived artifacts.

