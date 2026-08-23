---
document_id: P38-README
title: "Security & Privacy"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Security & Privacy
last_updated: 2026-08-21
---

# Phase 38 — Security & Privacy

## Purpose

This phase defines security and privacy requirements for local data, files, databases, secrets, AI exposure, cloud services, devices, logs, redaction, authentication, and incident recovery.

## Authority and posture

Security is a cross-cutting constraint applied consistently to CORE, LOCAL, AI, CLOUD, MOBILE, integrations, jobs, and recovery. Domain owners retain business meaning; this phase defines protective controls and assurance expectations.

## Invariants

- Collect, expose, retain, and privilege the minimum necessary.
- Local-first does not mean automatically secure; local threats are explicitly modeled.
- Mandatory secrets are `NEVER_AI` and never enter ordinary logs or records.
- Data-zone policy follows content and derivatives across caches, exports, prompts, sync, backups, and diagnostics.
- Encryption uses vetted libraries and managed keys; no custom cryptography.
- Security failure is contained, visible, auditable, and recoverable without fabricating safe state.

## Documents

Documents 38.01–38.15 define philosophy, threats, storage and key controls, provider exposure, zones, cloud/auth/device security, privacy-safe diagnostics, incident handling, and review gates.

## Acceptance criteria

- All 16 locked Phase 38 files exist with approved capability metadata.
- Requirements align with Phases 30, 32–37 and preserve offline-first operation.
- Unselected technologies, algorithms, durations, and identity systems remain `RESEARCH REQUIRED`.
