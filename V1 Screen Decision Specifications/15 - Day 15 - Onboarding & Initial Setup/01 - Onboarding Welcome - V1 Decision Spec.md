# PBOS — Onboarding Welcome

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 15  
**Screen / State:** Onboarding Welcome  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Onboarding-Welcome-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 15 Shared Context
- First install flow:
  **Launch PBOS → Full First-Boot Splash → Welcome → Personal Setup → Connect Systems → Review & Launch → Today**.
- Normal future launch:
  **Launch PBOS → Short Splash → Today**.
- Interrupted onboarding:
  **Short Splash → Continue Setup**.
- Welcome is not shown on every normal launch.
- Onboarding state persists as `not_started | in_progress | completed | skipped`.
- `first_boot_experience_seen: boolean` controls the full first-boot animation.
- Ready to launch does **not** mean every optional domain is configured. Partial setup is valid.
- AI is optional and there is no login wall.
- First plan is proposed/reviewed; onboarding must not silently create a schedule that appears user-approved.
- Full first-boot motion uses the approved PBOS video/frames; normal boot uses a short code-based splash rather than replaying the long video.

## Purpose
Welcome gives a calm first impression, explains PBOS, establishes privacy/control and starts setup without becoming a dashboard.

## Locked Copy / Concepts
Core message:
**“PBOS is your private system for turning goals into consistent action, evidence and improvement.”**

Hero:
**“Welcome to Performance Buddy OS”**
**“Plan clearly. Execute deliberately. Learn from evidence. Improve continuously.”**

Simplified loop:
**Plan → Act → Evidence → Understand → Adjust**

Three principles:
- Your System — Goals → Systems → Actions.
- Your Evidence — planned vs actual.
- Your Intelligence — AI interprets/recommends; user controls.

Privacy:
- Core data is local.
- Cloud/external AI may receive relevant permitted context.
- AI is optional.

## Actions / Startup
- `Set Up My PBOS`
- `Explore First`
- Existing data paths: Continue Existing PBOS / Restore Backup where appropriate.
- No login wall.
- Explore First must not inject fake history.
- Setup estimate ~3–5 minutes is acceptable.
- Welcome appears after full first-boot splash, not every normal launch.

## First-Boot Motion Context
- Full first boot ~5.13 sec approved sequence.
- 0–3.80 video; 3.80–4.25 app-rendered wordmark fade in; 4.25–4.85 hold; 4.85–5.13 fade out; then Welcome.
- Wordmark: `PERFORMANCE BUDDY OS`, Space Grotesk uppercase, restrained, centered below mark.
- Splash→Welcome crossfade about 280–360ms.
- No loop.

## Final-Audit Checks
- Welcome is visually sparse, no sidebar, no gaming/neon treatment.
- Returning completed users do not see it on every boot.

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
