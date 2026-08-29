# PBOS — Quick Capture & Create Command

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 16  
**Screen / State:** Quick Capture & Create Command  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Quick-Capture-v1-REFERENCE.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 16 Shared Context
- Day 16 turns PBOS into one connected OS through **Find → Navigate → Create → Execute**.
- `Ctrl + K` is the primary Global Search/Command Palette invocation.
- One input handles search and commands; no separate search and command interfaces.
- Search is local and deterministic in V1. AI is optional interpretation, never a dependency in the keystroke loop.
- Result ranking remains understandable: exact title → prefix → title contains → keyword/tag/metadata → recent usage → current-context boost.
- Context is a ranking signal, not a hard filter.
- Search Index is a rebuildable projection, **not a source of truth**.
- Canonical entity routes open the real domain screen; no duplicate search-specific detail pages.
- Command Registry is centralized; commands route into existing engines.
- Navigation principle: **Sidebar = discoverability; Ctrl+K = speed; Quick Capture = capture; domain navigation/breadcrumbs = context**.
- Temporary overlays preserve underlying workspace, unsaved-work protections and active sessions.

## Purpose
Low-friction universal inbox for capturing a thought and routing it to the correct existing PBOS engine.

## Entry
- `Ctrl + K → Quick Capture`.
- Create commands such as New Action.
- Optional shell entry.
- Context-specific entry can invoke the same engine.

## Two Paths
1. **Structured command** (`New Action`, etc.) → existing domain builder.
2. **Free capture** (`Quick Capture`) → compact universal capture overlay.

## V1 Capture Types
- Action
- Academic Event / Deadline
- Knowledge Item
- Quick Note
- Expense
- Routine Check-in

Complex Goals/Systems normally use their proper builders.

## Example
Raw:
`DSA quiz next Tuesday on binary trees`

Possible proposal:
- Academic Event — Quiz
- Course — Data Structures
- Topic — Binary Trees
- Resolved date
- Optional linked preparation Action

Nothing is persisted merely because AI interpreted it.

## Pipeline
**Raw input → interpretation → structured proposal → user review → deterministic validation → existing domain engine → authoritative record**

If AI is unavailable:
**Raw input → manual classification OR Capture Inbox**

Capture Inbox is deliberately lightweight:
`id, raw_text, created_at, source/context, processing_state`
with states such as Unprocessed / Proposed / Resolved.

## Completion Behavior
- `Save` → subtle confirmation → close → return to exactly previous workspace.
- Optional `Save & Open` → save and open canonical new entity.
- Preserve raw text/draft if interpretation or persistence fails.

## AI / Privacy
- AI interpretation only when permitted.
- Normal capture still works without AI.
- Query/input is not automatically sent to an external provider just because the overlay opened.

## Final-Audit Checks
- Quick Capture never creates a duplicate Action/Academic/Money/etc. engine.
- Uncertain input can always be preserved without guessing.

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
