---
document_id: P37-README
title: "Integrations APIs & Services"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Integrations APIs & Services
last_updated: 2026-08-21
---

# Phase 37 — Integrations APIs & Services

## Purpose

This phase defines stable boundaries between Performance Buddy OS and files, calendars, Obsidian, AI and embedding providers, cloud sync, import/export, internal APIs, events, and background services.

## Architecture position

Integrations are adapters around application and domain contracts. They may transport, translate, or project data, but cannot redefine domain meaning, source authority, permissions, or deterministic validation. CORE remains usable when every optional external integration is unavailable.

## Locked invariants

- Connections are explicit, least-privilege, purpose-scoped, revocable, and auditable.
- Imported values retain raw form, normalized form, provenance, verification, and revision.
- External payloads and callbacks are untrusted until authenticated, parsed, bounded, and validated.
- Network work is idempotent, retry-bounded, observable, and compatible with offline queues.
- Provider-specific fields end at adapters.
- Events describe facts; commands request change.

## Documents

Documents 37.01–37.13 cover architecture, permissions, provider and platform interfaces, internal contracts, events, jobs, and the future registry.

## Acceptance criteria

- All 14 locked Phase 37 files exist with approved metadata.
- Contracts align with Phases 00, 16, 24, 30, 32–35, and domain owners.
- No future provider or integration is represented as already committed.
