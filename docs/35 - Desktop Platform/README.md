---
document_id: P35-README
title: "Desktop Platform"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Desktop Platform
last_updated: 2026-08-21
---

# Phase 35 — Desktop Platform

## Purpose

This phase defines the primary desktop command-center platform for Performance Buddy OS. It translates approved domain, UX, offline-first, security, and intelligence contracts into desktop runtime requirements without selecting technology prematurely.

## Authority and boundaries

Phase 35 owns the desktop shell, operating-system integration, process boundaries, windows, background execution, tray behavior, desktop notifications, shortcuts, and packaging. Domain meaning remains with its owning phase; visual patterns remain in Phase 07; storage, AI, filesystem, sync, and security rules remain authoritative in their respective phases.

## Invariants

- `CORE` opens and remains useful without network, cloud account, or AI.
- The desktop is the primary command center, while shared domain contracts remain surface-neutral.
- OS integration uses least privilege, explicit consent, and recoverable failure behavior.
- Background or secondary windows cannot bypass validation, approval, or one-authoritative-edit rules.
- Electron and Tauri remain candidates until evidence supports an approved decision.

## Document map

Documents 35.01–35.15 cover responsibilities, architecture, framework research, filesystem/database/AI adapters, windows, background processes, tray capture, notifications, shortcuts, and packaging.

## Acceptance criteria

- All 16 locked Phase 35 files exist and use approved capability labels.
- Desktop contracts align with Phases 02, 05–07, 16, 25, 30, 33, and 34.
- Unresolved implementation choices are marked `RESEARCH REQUIRED`.
