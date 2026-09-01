# PERFORMANCE BUDDY OS — V2 MASTER BLUEPRINT

Date: 2026-09-01  
Status: Discovery Passes 1–6 LOCKED  
V1 status: Frozen at v1.0.0-rc.2  
Implementation status: NOT STARTED

## Purpose

This folder captures the six product-discovery passes completed before V2 implementation. These documents are authoritative V2 design inputs unless a later Master Blueprint consolidation explicitly supersedes a decision.

The purpose of V2 is:

> I use PBOS more, but I operate PBOS less.

V2 should reduce duplicate/manual operation while keeping PBOS trustworthy, deterministic where appropriate, offline-first, evidence-based, permission-aware, and user-controlled.

## Core architectural law

AI suggests.  
Deterministic rules validate.  
The user decides.  
Canonical PBOS domain systems apply.  
SQLite remains authoritative.  
Meaningful changes remain auditable/reversible where practical.

## Six locked discovery passes

1. Real-Life Operating Model
2. Natural Capture
3. Adaptive Today
4. Adaptive Planning
5. Academic Intelligence
6. Knowledge Intelligence + Routine Intelligence + AI Coach Boundaries

## Central V2 operating model

GOAL
→ SYSTEM
→ ACTION
→ PLANNER
→ CALENDAR
→ TODAY
→ EXECUTION
→ EVIDENCE
→ DOMAIN STATE
→ ANALYTICS
→ REVIEW
→ INTELLIGENCE
→ RECOMMENDATION
→ USER DECISION
→ VALIDATED APPLY
→ RE-PLANNING

Natural Capture becomes the primary low-friction external-reality input.
Adaptive Today becomes the primary execution decision surface.
Evidence propagation prevents PBOS-native activity from being re-entered manually.
Adaptive Planning turns prioritized requirements into realistic schedule proposals.
Domain intelligence remains contextual; AI Coach is for deeper reasoning.

## Important invariants carried from V1

- Action ≠ Planning Block ≠ Completion.
- Activity ≠ Outcome ≠ Mastery.
- Professor coverage ≠ Personal study ≠ Mastery.
- Unknown ≠ Zero.
- Correlation ≠ Causation.
- AI recommendation ≠ truth.
- Planning owns one canonical schedule.
- Knowledge mastery is evidence-derived.
- Obsidian owns authoritative long-form Markdown note bodies.
- Routine consistency is preferred over streak gamification.
- AI receives only permission-approved context.
- AI has no generic direct database-write authority.
- Provider failure must not disable core PBOS.

## What happens after these documents are placed in the repo

Do NOT immediately ask Claude Code to build screens.

Next product step:

### V2 Master Blueprint Consolidation

Consolidate these six passes into:

1. exact V2 scope and acceptance definition
2. schema/data additions and migrations
3. cross-domain relationships
4. Capture Proposal model
5. Intelligence Recommendation model
6. Planning Diff model
7. evidence propagation rules
8. permission/context model
9. explainability/reversibility rules
10. offline/provider-failure behavior
11. screen impact matrix
12. exact new/modified screens and components
13. testing + Tauri wire-contract requirements
14. implementation order / engineering batches

Only after that consolidation is locked should implementation prompts be produced for Claude Code.

## Repo grounding used during discovery

Key current implementation areas reviewed while locking these passes:

- `app/src/domains/performance/TodayPage.tsx`
- `app/src/domains/planning/engine.ts`
- `app/src/domains/planning/store.tsx`
- `app/src/domains/planning/types.ts`
- `app/src/domains/academic/types.ts`
- `app/src/domains/academic/engine.ts`
- `app/src/domains/academic/studyEngine.ts`
- `app/src/domains/knowledge/types.ts`
- `app/src/domains/knowledge/engine.ts`
- `app/src/domains/obsidian/types.ts`
- `app/src/domains/routine/types.ts`
- `app/src/domains/routine/engine.ts`
- `app/src/domains/ai/context.ts`
- `app/src/domains/intelligence/types.ts`
- `app/src/domains/intelligence/applyAdapters.ts`
- `app/src/domains/intelligence/AICoachPage.tsx`
- `app/src/domains/intelligence/AICoachWorkspacePage.tsx`

## Status

Discovery Passes 1–6: LOCKED.  
Master Blueprint Consolidation: NEXT.  
Claude Code V2 implementation: AFTER consolidation.
