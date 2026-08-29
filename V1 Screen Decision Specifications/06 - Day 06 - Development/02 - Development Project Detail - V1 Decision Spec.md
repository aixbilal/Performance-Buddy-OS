# PBOS — Development Project Detail

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 06  
**Screen / State:** Development Project Detail  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Development-Project-Detail-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 06 Shared Context
- Development asks: **What am I building, what am I learning, what can I actually do, and what should I do next?**
- Keep four concepts distinct: **Project Progress = built**, **Skill Progress = learned/demonstrated**, **Knowledge = concepts/notes/resources**, **Actions = executable work**.
- Project hierarchy: **Project → phases/milestones → modules → Actions**. Use the shared Action engine.
- **Blocker**, **Decision Required**, and **Dependency** are different states.
- Evidence may include feature/build/test/commit/architecture/coding/debug/project usage/technical explanation.
- Skills use progression such as **Not Started → Learning → Practicing → Demonstrated → Needs Refresh**.
- Capability is evaluated across **Knowledge (can explain), Practice (has used), Evidence (proves capability)**.
- Exposure ≠ learning ≠ practice ≠ demonstrated.
- AI-assisted coding is allowed and not punished, but AI-built work is not automatically evidence of independent understanding. Evidence provenance can record AI-assisted, personally reviewed, can explain, independently implemented and test verified.

## Purpose
Project Detail is the canonical operational view of one development project.

## Hierarchy
**Project → phases/milestones → modules → Actions**

## Locked Decisions
- Use shared Action engine.
- Separate **Blocker**, **Decision Required**, and **Dependency**.
- Track project evidence such as builds, features, tests, commits, architecture decisions, debugging and verified usage.
- Project completion/progress describes what is built, not what the user independently understands.
- Link relevant skills and Knowledge topics.
- AI-assisted work can be recorded with provenance rather than disqualifying the work.
- Next Action should be concrete and connected to current milestone/module.

## Final-Audit Checks
- Milestone/module/action hierarchy is real.
- Evidence can prove project work without falsely proving skill independence.
- Status terms are not collapsed into one “blocked” bucket.

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
