# PBOS — Knowledge Overview

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 05  
**Screen / State:** Knowledge Overview  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Knowledge-Overview-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 05 Shared Context
- Knowledge asks: **What do I know, what am I learning, what am I forgetting, and what should I review next?**
- It spans Academic, Development, General Knowledge, Reading, Language and other learning contexts.
- There is **no universal Knowledge Score**.
- Avoid duplicate topic records: one concept such as Binary Trees can connect an Academic Course Topic, a Knowledge record, evidence, notes and review state rather than becoming unrelated duplicate entities.
- Knowledge lifecycle: **New → Learning → Developing → Strong → Review Due**. Strong knowledge can still become Review Due.
- Saved/read material is not proof of mastery. Evidence and recall must distinguish exposure from demonstrated understanding.
- Monthly themes are allowed (for example Cars 18/30) without turning them into a fake mastery percentage.
- Obsidian is authoritative for Markdown note bodies. PBOS stores metadata/path/relationships/sources/timestamps and intelligence around the note, not a duplicate body.
- V1 intentionally excludes mature vector search/RAG across the entire vault.

## Purpose
Knowledge Overview answers what the user knows, is learning, is forgetting and should review next across domains.

## Locked Decisions
- No universal Knowledge Score.
- Organize by topics/states/evidence/review need rather than one giant completion metric.
- Knowledge states: New, Learning, Developing, Strong, Review Due.
- Review Due can apply even to a previously Strong topic.
- Distinguish captured/read information from demonstrated recall/evidence.
- Cross-domain topics should link rather than duplicate.
- Review Queue is simple in V1.
- Monthly themes are supported as themes/progress, not mastery.

## Expected Areas
- Current learning/topics.
- Review queue.
- Strong/review-due items.
- Recent evidence.
- Monthly theme/current exploration.
- Links to notes and source domains.

## Final-Audit Checks
- Search/filter opens canonical Knowledge Topic.
- Review state can be explained by evidence/recency.
- No fake combined score.

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
