# PBOS — System Detail & Actions

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 03  
**Screen / State:** System Detail & Actions  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-System-Detail-Actions-v1-REFERENCE.png`

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
System Detail explains exactly how one repeatable System works and what executable Actions it produces.

## Locked Information
- System purpose.
- Linked Goal(s) if any.
- Cadence.
- Rules/triggers.
- Current/next Actions.
- Evidence.
- Consistency/health.
- Relevant recommendations.

## Locked Behavior
- Actions use the shared global Action engine.
- Rules/triggers define repeatable behavior; they are not duplicated Planner automation.
- The screen may show why a System is healthy/drifting and what the next useful adjustment is.
- Changes to cadence/rules are explicit user decisions.
- System can remain useful even without a formal Goal.
- The detail surface should connect to Today/Planner where Actions are scheduled or executed.

## Final-Audit Checks
- Goal/System/Action semantics remain separate.
- Actions created here appear correctly elsewhere in PBOS.

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
