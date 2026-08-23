---
document_id: P36-README
title: "Mobile Platform"
status: APPROVED
baseline: v1.0
capability: MOBILE
owner: Mobile Platform
last_updated: 2026-08-21
---

# Phase 36 — Mobile Platform

## Purpose

This phase defines the optional Performance Buddy OS mobile companion: a low-friction, offline-capable surface for capture, lightweight review, university use, and notifications. It does not promise desktop parity or create a second semantic source of truth.

## Authority and boundaries

Phase 36 owns mobile presentation, device integration, local mobile persistence, and mobile-specific interaction. Domain phases retain business meaning and validation. Phase 34 owns synchronization semantics; Phase 30 owns AI permissions; Phase 05/06 own navigation and capture principles.

## Invariants

- Common captures save locally before any sync claim.
- Mobile uses shared domain commands and cannot redefine formulas, evidence, statuses, or permissions.
- Desktop remains the primary configuration, analysis, and command-center surface.
- Defaults never fabricate completion, marks, mastery, deadlines, or financial facts.
- Camera, voice, OCR, and AI extraction create reviewable drafts only.
- Sensitive content is minimized on lock screens, notifications, logs, and caches.

## Documents

Documents 36.01–36.14 define companion scope, capture flows, university functions, offline and sync requirements, and framework evaluation.

## Acceptance criteria

- All 15 locked Phase 36 files exist with `MOBILE` metadata.
- Capture, offline, provenance, privacy, and conflict contracts align with approved owners.
- Framework and implementation choices remain `RESEARCH REQUIRED` until evaluated.
