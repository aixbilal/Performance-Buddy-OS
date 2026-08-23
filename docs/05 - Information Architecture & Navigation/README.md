---
title: "Phase 05 — Information Architecture & Navigation"
document_id: "P05-README"
phase: "05 - Information Architecture & Navigation"
status: "APPROVED"
baseline: "v1.0"
capability: "CORE"
owner: "Information Architecture & Navigation"
last_updated: "2026-08-17"
---

# Phase 05 — Information Architecture & Navigation

## Purpose

Define how users find, understand, and move among Performance Buddy OS domains, entities, actions, and capability states.

## Phase responsibility

Phase 05 owns the application’s content hierarchy, navigation concepts, search entry points, command discovery, contextual links, entity-detail structure, dashboard role, and progressive disclosure. Phase 06 owns detailed interaction behavior and accessibility patterns; Phase 07 owns visual treatment and design tokens.

## Navigation promise

The desktop application is the primary command center. Navigation should support the daily loop—orient, act, capture, reconcile, close—while making deeper domain work reachable without turning every screen into a dashboard.

## Primary destinations

```text
Today / Command Center
Goals & Paths
Academics
Knowledge
Development
Fitness & Recovery
Routines & Language
Money
Analytics & Reviews
Settings / Data / Permissions
```

Names are information-architecture concepts; final UI labels may be refined by later UX work without renaming locked documentation or changing domain ownership.

## Cross-cutting entry points

Global search finds permitted entities and content. The command palette starts navigation and registered actions. Contextual navigation preserves the current entity and domain. Notifications and AI suggestions link to evidence and a safe next step rather than becoming separate sources of truth.

## Capability boundaries

CORE navigation works fully offline. LOCAL/V1–V3 enhancements are labeled and optional. MOBILE is a later capture companion with a smaller hierarchy. CLOUD status is visible but never required to access local CORE records.

## Acceptance criteria

Common destinations are predictable; users can identify location and return path; sensitive content remains permissioned; search and commands preserve domain ownership; and complexity is progressively disclosed.

