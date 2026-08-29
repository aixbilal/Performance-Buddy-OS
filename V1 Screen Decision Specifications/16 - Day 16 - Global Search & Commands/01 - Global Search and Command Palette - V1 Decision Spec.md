# PBOS — Global Search & Command Palette

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 16  
**Screen / State:** Global Search & Command Palette  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Global-Search-Command-Palette-v1-REFERENCE.png`

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
Universal PBOS access layer for quickly finding existing information, navigating, creating through existing flows and executing safe commands.

## Invocation / Interaction
- Primary shortcut: `Ctrl + K`.
- Also accessible from shell search/command control.
- Centered floating overlay; current workspace remains visible/subdued.
- `Esc` closes and returns exactly to previous context.
- `↑/↓` navigate results.
- `Enter` opens/executes selected result.
- `Tab` moves through controls where needed.
- Placeholder: **“Search PBOS or run a command…”**
- Default state shows Recent + Quick Commands + footer shortcuts.

## Search Scope
Core: Actions, Goals, Systems.
Academics: Courses, Topics, Assessments, events/deadlines.
Knowledge: Topics, review items, PBOS-known note metadata.
Development: Projects, milestones/modules, skills, topics.
Fitness: plans and useful workout/session records.
Routines.
Reading/Language.
Money: useful transaction/category metadata.
Application: pages, Settings destinations, commands.
Do not index every row merely because it exists.

## Search Architecture
Searchable projection typically contains:
`id, entity_type, title, subtitle, keywords/tags, domain, status, canonical_route, updated_at` plus minimal type metadata.
Index is local, rebuildable and not authoritative.
Ranking: exact title → prefix → title contains → keyword/tag → metadata → recency → context boost.
No fake “92% search match” UI.

## Obsidian Boundary
V1 searches PBOS-known metadata/title/path/tags/relationships, not unrestricted full-vault semantic/RAG search.

## Command Registry
Conceptual fields:
`id, title, keywords, category, shortcut?, availability(), execute(), safetyLevel`.
Categories:
- Navigate
- Create
- Execute
- Application

Safety:
- Level 1 navigation immediate.
- Level 2 safe/reversible UI action immediate.
- Level 3 meaningful state change delegates to proper flow/confirmation.
- Destructive commands remain out of normal V1 palette discovery.

## Navigation Behavior
- Result opens canonical entity route.
- Search overlay itself should not pollute meaningful app history.
- Unsaved-work guards remain respected.
- Active Focus/workout/timer survives.
- Context may rank commands/results higher but never hides global access.
- Disabled commands can show reason.
- Search history/recent commands/opened entities are local, bounded (roughly 10–20 useful entries is sufficient) and clearable.

## Explicit V1 Exclusions
No vector DB, mature semantic/RAG, AI-first search dependency, universal chatbot, huge command library, plugin marketplace, terminal scripting, command chaining, destructive bypass or duplicate creation forms.

## Final-Audit Checks
- Search works with AI disabled/offline.
- Keystroke loop has no external AI/network dependency.
- Search result always opens real PBOS entity.

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
