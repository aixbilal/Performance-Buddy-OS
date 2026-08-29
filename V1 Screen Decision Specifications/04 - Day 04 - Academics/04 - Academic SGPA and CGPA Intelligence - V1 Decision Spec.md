# PBOS — Academic SGPA & CGPA Intelligence

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 04  
**Screen / State:** Academic SGPA & CGPA Intelligence  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Academic-SGPA-CGPA-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 04 Shared Context
- Academics must separate **Professor Coverage**, **Personal Study Coverage**, and **Mastery**. Never collapse these into one misleading percentage.
- Materials can include professor slides/notes, peer material, the user's own notes, Obsidian links, AI notes and past papers.
- Assessment structures must be configurable. Institution defaults may exist, but course-level overrides are required; do not hardcode one universal assignment/quiz/mid/final formula.
- Academic calculations are deterministic: weighted marks, grade projection, SGPA, CGPA, repeat handling and scenarios. LLMs only explain/recommend.
- Course/degree data can include university, program, curriculum version, semester, course attempt, credit hours, prerequisites and enrollment state.
- Reference values shown in generated images are illustrative and must never be hardcoded as institutional policy.

## Purpose
This screen provides deterministic semester/cumulative GPA intelligence and scenario planning.

## Locked Information
- Current CGPA.
- Projected/target SGPA.
- Long-term CGPA trajectory.
- Credit hours.
- Course projections.
- Target feasibility.
- Scenario simulator.
- Repeat-course configuration.
- Leverage/risk explanations.

## Rules
- All GPA/grade mathematics is deterministic.
- AI may explain results, tradeoffs and recommendations only.
- Repeat handling and grade replacement must be configurable/source-grounded; do not infer institutional policy from a generated reference.
- Scenario changes are simulations until explicitly applied to planning assumptions.
- Generated numeric examples are illustrative and must not be hardcoded.
- No universal “performance score” is introduced here.

## Final-Audit Checks
- Verify formulas and repeat scenarios with tests.
- Verify unknown/missing academic policy shows configuration state rather than silent assumptions.
- Verify scenario simulator does not mutate authoritative marks.

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
