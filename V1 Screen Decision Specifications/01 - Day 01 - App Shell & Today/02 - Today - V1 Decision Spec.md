# PBOS — Today

**Archive:** V1 Screen Decision Archive  
**Design Part:** Day 01  
**Screen / State:** Today  
**Status:** PRODUCT/UI DECIDED — V1  
**Reference:** `PBOS-Today-v1-PRIMARY.png`

> This file consolidates the locked product/UI decisions available for this screen/state so it can be audited against the implemented application in the final phase. It does not intentionally introduce new feature scope.

### Day 01 Shared Context
- Day 01 locked the overall visual direction and the first two product references: Application Shell and Today.
- The shell is not permanent dashboard content; domain pages replace placeholders.
- Today is the daily operating surface and first normal destination after startup.
- The visual feeling is premium, private, engineered, calm and futuristic: approximately 70% premium productivity software, 20% precision instrument, 10% cinematic sci-fi.
- The original foundation sprint described the shell as sidebar + top bar + page container + context rail + command/search + notifications + companion entry point, with responsive desktop and collapsed navigation states.
- The Today hierarchy established in the early foundation was: **Today → Highest Priority → Schedule → Progress → Routines → Context / Recommendation**.

## Purpose
Today is the daily operating surface: the fastest answer to **what has happened, what matters now, what remains, what is at risk, and what should happen next?**

## Locked Information Hierarchy
- Today-at-a-glance / daily performance overview.
- What is completed.
- Current study/syllabus state where relevant.
- What remains.
- Highest-value next action.
- Risks, upcoming deadlines and timed routine prompts.
- Current Focus / active session.
- AI Coach brief/recommendation area.
- Domain summaries.
- Quick Capture.
- Primary, Secondary and On-Demand information layers.

## Collapse Model
All information levels can collapse with restrained motion:
- **Primary** → compact horizontal strip/icons.
- **Secondary** → compact summary visuals.
- **On-Demand** → icon/tab only.
This prevents the home surface from becoming permanently overloaded.

## Opening / Startup Behavior
- Normal startup ultimately lands on Today.
- First-ever install goes through onboarding before Today.
- Today must use real local data. No fake activity is inserted to make it look populated.
- Empty, overloaded and completed-day states must be understandable.

## Planning Semantics
- Planned work and completed work remain distinct.
- Today displays the current plan; it does not replace Planner/Calendar.
- A deadline is not automatically a scheduled work block.
- If the day is empty, use the Day 17 `Your day is open` behavior rather than fabricated recommendations.
- AI may propose plan changes, but recommendations are not silently applied.

## AI / Companion
- V1 AI presence is an icon/tab/panel entry, not a permanently dominant avatar.
- Later companion/avatar behavior may hang near the AI entry point and surface important information, but that is not required for V1.
- AI explanations are grounded in permitted PBOS context and cannot rewrite data without approval.

## Final-Audit Checks
- Confirm Today answers the daily decision quickly.
- Confirm completed/planned/remaining are not conflated.
- Confirm domain summaries link to canonical domain surfaces.
- Confirm Quick Capture uses the shared capture engine.
- Confirm collapsed states actually reduce density.

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
