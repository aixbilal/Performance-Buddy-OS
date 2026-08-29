# PBOS — Language Learning Path Detail

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 09  
**Screen / State:** Language Learning Path Detail  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Language-Learning-Path-Detail-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 09 Shared Context
- Boundaries are locked:
  - **Routine** = when/how consistently practice happens.
  - **Reading & Language** = what was read/learned and curriculum/path progress.
  - **Knowledge/Mastery** = evidence of understanding and retention.
  - **Obsidian** = authoritative long-form notes.
  - **Goal** = desired outcome.
- Lesson completion, pages read and time spent are activity/progress signals, not automatic mastery.
- Reading and Language share a higher-level domain but retain different detail/session semantics.

## Purpose
Language Path Detail shows curriculum progression, current level/topic and what to practice next.

## Locked Decisions
- Path can organize modules/topics/vocabulary/grammar or other curriculum units.
- Progress reflects curriculum/path completion plus evidence where relevant, not only daily minutes.
- Routine defines when/how often practice happens.
- Knowledge/Mastery may store retention/evidence for vocabulary/concepts.
- Notes can link to Obsidian without duplicating note bodies.
- The user may maintain a practical 30–40 minute daily practice pattern, but the screen should not hardcode personal targets as universal product rules.
- Next lesson/session is actionable.

## Final-Audit Checks
- Path progression and mastery are not conflated.
- Routine linkage does not duplicate scheduling engines.

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
