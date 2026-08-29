# PBOS — Goals Overview

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 03  
**Screen / State:** Goals Overview  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Goals-Overview-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 03 Shared Context
- Goals are global across PBOS domains, not an Academic-only concept.
- **Goal = desired outcome. System = repeatable process. Action = executable task.**
- Not every routine needs a Goal. Example: hydration may simply be a Routine/System; a temporary Goal can exist only when restoring hydration consistency is an actual desired outcome.
- AI may suggest a Goal or micro-goal, but the user must be able to **Accept / Modify / Reject** it.
- Manual creation and AI proposals use the same underlying Goal builder.
- Systems contain cadence, Actions, rules/triggers, evidence, health/compliance, next action and AI recommendations.
- Actions are shared across Today, Focus, Goals, Systems and domains. **No duplicate task engine.**
- Goal hierarchy remains **GOAL → SYSTEM → ACTION**, with milestones/paths where appropriate.

## Purpose
Goals Overview presents desired outcomes across all PBOS domains and makes it clear which outcomes are active, progressing, blocked, completed or inactive.

## Locked Decisions
- Goals are global, not Academic-only.
- The overview should prioritize active Goals and useful progress/state over decorative totals.
- Each Goal should expose its linked Systems and relevant next Action/context.
- Completed/inactive Goals remain accessible without competing visually with active Goals.
- AI may surface suggested micro-goals, but suggestions remain proposals with Accept/Modify/Reject.
- Progress must come from real evidence/system/action state rather than arbitrary percentage filling.
- The overview is a navigation/control surface, not where every Goal is deeply edited.
- Future manual redesign may use a Bento-like composition based on domain importance; current geometry is not locked.

## Primary Actions
- Create Goal.
- Open Goal Detail.
- Review suggested Goal proposal where applicable.
- Filter/view active/completed/inactive.

## Final-Audit Checks
- Goal cards lead to canonical detail.
- Goal progress is evidence-grounded.
- Routines are not automatically forced into Goals.

## Global PBOS Rules That Apply to This Screen

- PBOS is a **private, desktop-first, offline-first Personal Performance Operating System**.
- Core loop: **PLAN → ACTION → RESULT → EVIDENCE → ANALYSIS → ADJUSTMENT → NEXT PLAN**.
- Product logic follows **Goal → System → Action**.
- Evidence matters more than raw time; consistency matters more than fragile streaks.
- AI may interpret, explain, recommend and propose. **Deterministic rules validate and the user decides.**
- Deterministic systems remain authoritative for calculations, validation, scheduling constraints, mastery state and other rule-based outcomes.
- The local PBOS application must remain useful when AI is disabled or unavailable.
- Avoid duplicate engines. A new surface should call the existing Action, Goal, System, Session, Note, Assessment, Planner, Transaction, Routine or other authoritative engine rather than create a second implementation.
- Obsidian remains authoritative for long-form Markdown note bodies; PBOS is the control/intelligence/context layer around them.
- Generated screen references are **structural/functional V1 references**, not pixel-perfect final UI. The locked Design System and Visual Identity are authoritative.
- Later manual redesign may simplify or rearrange surfaces based on actual usage, but should not silently delete underlying capabilities or domain logic.
- Do not prematurely introduce mature V2/V3, multi-agent orchestration, mobile/cloud systems, complex RAG, vector databases, SaaS infrastructure or enterprise abstractions into V1.
- When a genuine UI/product decision conflicts with implementation architecture, flag: **`UI ↔ ARCHITECTURE REVIEW REQUIRED`**.

## Locked Visual System Reminder

- Fonts: **Space Grotesk** for hierarchy/display, **Inter** for primary UI/body, **JetBrains Mono** for Focus timer and selected technical readouts.
- Core palette: `#0A0C0F` base, `#111419` surface, `#171B21` raised, `#1D2229` soft, `#252B33` subtle border, `#343C46` strong border, `#F2F4F7` primary text, `#A9B0B9` secondary text, `#6F7883` muted text, `#8FA8C1` primary accent.
- Semantic colors stay muted: success `#6FA58A`, warning `#C6A76A`, danger `#C97878`, info `#7D9DBD`.
- Matte black / graphite / gunmetal, restrained silver-blue illumination, subtle depth and glow, low visual noise.
- No gaming RGB, neon-cyan cyberpunk, purple-pink gradients, rainbow analytics, excessive glassmorphism, huge bubbly cards, aggressive motivational styling or decorative fake technical data.
- Main cards are normally solid; glass is reserved for overlays/command palette/floating intelligence surfaces.
- Desktop grid and shell remain consistent with the locked design tokens. Motion clarifies state changes and remains restrained.

## Archive Purpose

This file is part of the **66-screen V1 Decision Archive**. It is intended for the final implementation audit: compare this specification, the approved/generated reference, and the live application. Anything decided here but missing or materially different in implementation should be reviewed and fixed rather than silently reinterpreted.
