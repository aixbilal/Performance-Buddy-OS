# PBOS — Error & Recovery States

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 17  
**Screen / State:** Error & Recovery States  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Error-Recovery-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 17 Shared Context
- Day 17 defines reusable resilience behavior rather than one-off bespoke designs.
- State distinctions are mandatory:
  **Unknown ≠ Zero**
  **Empty ≠ Loading**
  **Empty ≠ Error**
  **Empty ≠ Disabled**
  **Empty ≠ Not Configured**
  **Offline ≠ Broken**
  **AI Disabled ≠ Error**
  **AI Failure ≠ PBOS Failure**
  **Failed Save ≠ Lost Draft**
  **Failed Component ≠ Failed Application**
  **Broken Search Index ≠ Lost PBOS Data**
  **Partial ≠ Failed**
  **Stale ≠ Current**
  **Slow ≠ Failed**
  **AI Waiting ≠ Application Blocked**
- Failures and loading should affect the smallest safe surface.
- Preserve user data, drafts and context; keep unaffected capabilities available.

## Purpose
Contain failures, preserve work and offer the safest meaningful recovery path.

## Error Scope
- Inline error.
- Component error.
- Domain/capability error.
- Critical application/storage error.
Fail at the smallest reasonable surface.

## Recovery Questions
Every meaningful error should answer:
1. What failed?
2. Is my data safe?
3. What can I do now?
4. What happens if I retry?

## Representative States
### Save Failed
`Couldn't save this Action` — draft remains intact.
Actions: Try Again / Keep Editing.
Never clear form or claim success before persistence.

### Component Failed
One Analytics chart can fail while other metrics remain visible.

### Search Index Problem
`Search needs to be rebuilt` — authoritative PBOS data unaffected.
Action: Rebuild Search Index.

### Obsidian Folder Missing
Metadata remains; linked note files cannot open.
Actions: Locate Folder / Open Obsidian Settings.
Do not silently create a new vault/rewrite paths/delete metadata.

### Invalid Academic Configuration
`Grade projection unavailable` when weights/inputs are invalid.
Action: Review Setup.
Do not guess.

### Critical Local Storage Failure
`PBOS couldn't open your local data`.
Data is not reset/overwritten.
Actions may include Try Again / Recovery Options / Open Backup Folder.
Never create an empty replacement DB and pretend it is the user's data.

## Diagnostics / Retry
- Technical details behind `View Details`.
- Severity: Informational / Warning / Error / Critical.
- Retry must avoid duplicate Actions/transactions/assessments/captures/planning mutations.

## Final-Audit Checks
- Failed save preserves draft.
- Critical storage path never performs silent destructive reset.

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
