# PBOS — Settings AI Privacy & Data

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 14  
**Screen / State:** Settings AI Privacy & Data  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Settings-AI-Privacy-Data-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 14 Shared Context
- Configuration layering is locked:
  **Base Configuration → Mode Override → Temporary Override → Effective Configuration**.
- Mode or temporary overrides must never silently overwrite baseline configuration.
- Settings should be simpler than operational dashboards.
- AI/privacy configuration must preserve local-first behavior, explicit permissions and no unrestricted writes.
- High-impact application changes use appropriate confirmation.
- Active sessions/timers survive ordinary navigation/minimize behavior.

## Purpose
Controls AI providers/permissions and local data/privacy/recovery behavior.

## Locked AI Controls
- AI Provider.
- Read / Recommend / Propose allowed as configured.
- Direct unrestricted write not allowed in V1.
- Domain access: No Access / Read / Read + Recommend (conceptual states).
- Context minimization and preview.
- Controlled memory; chat ≠ permanent memory.
- Memory categories/expiry.
- Explicit approvals.
- AI activity log.

## Locked Data Controls
- Local data information.
- Backup/recovery.
- Export/import/retention.
- Danger zone.
- Obsidian note bodies remain authoritative externally.
- Backup, export, import and restore are distinct operations.

## Rule
AI-disabled core PBOS still works.

## Final-Audit Checks
- External AI processing is disclosed honestly.
- Permissions are enforced.
- No mature RAG/agents are introduced here.

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
