---
document_id: P34-README
title: "Cloud Sync & Multi-Device"
status: APPROVED
baseline: v1.0
capability: CLOUD
owner: Cloud Sync & Multi-Device
last_updated: 2026-08-21
---
# Phase 34 — Cloud Sync & Multi-Device

## Purpose

This phase defines optional, secure synchronization across trusted devices while preserving the offline-first architecture. Cloud services improve continuity and portability; they do not become a prerequisite for the deterministic core.

## Authority

This phase is subordinate to the frozen baseline, capability registry, AI governance rules, canonical data model, and offline-first architecture. It owns sync transport, device coordination, conflict handling, and provider evaluation. It does not redefine domain entities or source authority.

## Locked invariants

- `CLOUD` is opt-in; `CORE` remains useful without an account or network.
- A locally committed write is real and is not provisional pending server acknowledgement.
- The sync service transports and coordinates revisions; it is not semantic authority.
- Concurrent changes, deletes, and failures are preserved and surfaced rather than silently overwritten.
- Sync traffic is encrypted, permission-scoped, auditable, idempotent, and revocable.
- Sync is not backup.

## Documents

Documents 34.01–34.14 define philosophy, optionality, authority, state, change tracking, conflicts, reconciliation, devices, encryption, failures, backup separation, and provider selection.

## Acceptance criteria

- All 15 Phase 34 files exist with `CLOUD` capability metadata.
- The design remains compatible with Phases 02, 30, 32, and 33.
- No provider, protocol, or unresolved algorithm is presented as an approved fact.
