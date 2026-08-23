---
title: "Phase 04 — Domain Architecture"
document_id: "P04-README"
phase: "04 - Domain Architecture"
status: "APPROVED"
baseline: "v1.0"
capability: "CORE"
owner: "Domain Architecture"
last_updated: "2026-08-17"
---

# Phase 04 — Domain Architecture

## Purpose

Define the bounded domains of Performance Buddy OS, their authoritative responsibilities, and the contracts through which they interact.

## Phase responsibility

Phase 04 is the ownership map for product meaning. It prevents a screen, database, analytics job, or AI feature from becoming a second authority for domain rules. Detailed models remain in their locked owning phases.

## Domains

| Domain | Primary responsibility |
|---|---|
| Performance | Goals, plans, execution, reconciliation, priority context |
| Academic | University structure, assessments, grades, study planning |
| Knowledge | Topics, sources, evidence, confidence, Obsidian links |
| Development | Technical learning paths, practice, projects, skill evidence |
| Fitness & Recovery | Training, load, rest, recovery, safety boundaries |
| Routine & Spiritual | Prayer and personal routines, reading, language, reflection |
| Money | Lightweight income, expense, balance, saving records |
| Analytics | Derived metrics, trends, reviews, and evidence windows |
| Intelligence | AI context, outputs, recommendations, approvals, evaluation |
| Platform | Local data, offline operation, security, sync, surfaces, recovery |

## Core rule

A domain owns its entities, invariants, lifecycle, vocabulary, and validation. Consumers reference stable contracts and provenance; they do not copy rules. Cross-domain coordination occurs through explicit references, events, derived views, and proposals.

## Capability boundary

CORE owns deterministic records and validation. LOCAL/V1/V2/V3 consume permission-scoped context and produce labeled outputs. CLOUD and MOBILE provide optional transport/surfaces without redefining domains.

## Acceptance criteria

Every major rule has one owner; interactions preserve provenance and privacy; failures remain contained; no universal performance score erases domain meaning; and later implementation can remain a simple modular application rather than premature distributed services.

