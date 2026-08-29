# PBOS — Application Shell

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 01  
**Screen / State:** Application Shell  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-App-Shell-v1-PRIMARY.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 01 Shared Context
- Day 01 locked the overall visual direction and the first two product references: Application Shell and Today.
- The shell is not permanent dashboard content; domain pages replace placeholders.
- Today is the daily operating surface and first normal destination after startup.
- The visual feeling is premium, private, engineered, calm and futuristic: approximately 70% premium productivity software, 20% precision instrument, 10% cinematic sci-fi.
- The original foundation sprint described the shell as sidebar + top bar + page container + context rail + command/search + notifications + companion entry point, with responsive desktop and collapsed navigation states.
- The Today hierarchy established in the early foundation was: **Today → Highest Priority → Schedule → Progress → Routines → Context / Recommendation**.

## Purpose
The Application Shell is the persistent frame of PBOS. It establishes the product's identity, global navigation, workspace behavior and the visual grammar reused by every domain.

## Locked Decisions
- Persistent desktop shell with a collapsible left sidebar, top bar and main workspace.
- Sidebar width follows locked design tokens: expanded 248 px, collapsed 72 px; top bar 64 px.
- The shell supports active, hover, disabled, offline and notification-indicator states.
- It must work on laptop and larger desktop monitors without becoming a giant sparse dashboard.
- The shell should feel like a premium operating environment/precision instrument rather than a generic SaaS admin panel.
- Dark matte/glass language is restrained: main structural surfaces stay solid; floating overlays may use smoked/frosted treatment.
- The primary shell reference had a dark void/space atmosphere and matte glass treatment. That atmosphere is directional; do not turn the runtime into a cinematic poster.
- Navigation labels may evolve/group during simplification, but the visual language and global navigation model remain stable.
- Placeholder modules shown in early shell references are not permanent content.
- Global Search/Command access, notifications and the AI/companion entry point belong at shell level, while their mature behavior is defined later.
- Sidebar collapsing must preserve the current workspace and not reset domain state.
- Shell navigation must not terminate active Focus/workout/timer sessions.
- The shell is the host for Today and every domain page; domains should not build their own competing outer shells.

## Navigation / State Expectations
- Current location is visually clear.
- Collapsed mode remains understandable by icon/tooltips and preserves keyboard accessibility.
- Keyboard-navigation foundation is required.
- Offline or degraded external services may be indicated in the shell without falsely implying PBOS itself is unavailable.
- Temporary overlays (search, capture, dialogs) sit above and preserve the underlying workspace.

## Final-Audit Checks
- Confirm the live application uses one shared AppShell.
- Confirm domain pages do not reimplement sidebar/topbar.
- Confirm collapsed navigation, active state, keyboard navigation and session persistence work.
- Confirm visual treatment follows the locked graphite/silver-blue identity instead of generated-reference purple/RGB drift.

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
