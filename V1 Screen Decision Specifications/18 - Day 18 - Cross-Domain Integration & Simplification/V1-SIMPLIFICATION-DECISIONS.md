# PBOS V1 — Simplification Decisions

**Day:** 18  
**Status:** V1 LOCKED  
**Reference:** `PBOS-Simplification-Audit-v1-REFERENCE.png`

---

# 1. Purpose

This document converts the Day 18 simplification audit into implementation decisions for PBOS V1.

The goal is not to remove useful capability.

The goal is:

**Simplify the surface. Preserve the capability.**

PBOS should remain powerful underneath while becoming calmer, clearer, easier to scan, and easier to operate.

---

# 2. Final Simplification Classifications

Every V1 simplification decision must use one of these classifications:

## KEEP

Preserve the distinction or capability because it protects truthful data, correct behavior, or an important workflow.

## SIMPLIFY

Keep the capability but reduce visual weight, repeated controls, duplicated summaries, or excessive information density.

## MERGE PRESENTATION

Keep underlying entities/engines separate where needed, but consolidate repeated UI presentation into shared components or a single surface.

## REUSE SHARED ENGINE

Multiple domains may use a capability, but the underlying engine must remain singular and canonical.

## DEFER V2+

Useful idea, but unnecessary for a focused, finishable V1.

---

# 3. Global Rule

PBOS must not confuse minimalism with deletion.

The default decision order is:

1. Remove duplicate presentation.
2. Reuse existing components.
3. Improve information hierarchy.
4. Collapse secondary information.
5. Defer non-V1 complexity.
6. Only then consider removing capability.

Capability removal is the last option.

---

# 4. Semantic Distinctions — KEEP

The following distinctions are mandatory and must not be simplified away:

- Goal ≠ System ≠ Action
- Action ≠ Scheduled Block ≠ Completion
- Planner ≠ Calendar ≠ Today
- Normal Study ≠ Focus
- Study ≠ Mastery/Test
- Workout Session ≠ Focus Session
- Routine Check-in ≠ Action Completion
- Project Progress ≠ Skill Progress
- Reading Progress ≠ Knowledge Mastery
- Professor Coverage ≠ Personal Study Coverage ≠ Mastery
- Fitness Base Plan ≠ Today’s Prescription ≠ Actual Session
- Analytics ≠ Review
- Weekly Review ≠ Monthly Review
- AI Recommendation ≠ Applied Change
- PBOS note metadata ≠ Obsidian note body
- Empty ≠ Loading ≠ Error ≠ Offline ≠ Disabled ≠ Not Configured
- Unknown ≠ Zero
- Partial ≠ Failed
- Stale ≠ Current
- Money ≠ Performance Score

Semantic correctness takes priority over visual minimalism.

---

# 5. Information Hierarchy — LOCK

Every major PBOS screen should prioritize information using:

## PRIMARY

What needs attention now?

Typical content:

- current state
- active risk
- current work
- next action
- immediate decision

## SECONDARY

Why does it matter?

Typical content:

- evidence
- progress
- explanation
- recent change
- supporting metrics

## TERTIARY

What deeper context exists?

Typical content:

- history
- configuration
- advanced analysis
- complete logs
- detailed evidence

Do not give all information equal visual weight.

---

# 6. Progressive Disclosure — LOCK

Preferred hierarchy:

**Overview → Detail → Advanced / History / Evidence**

Secondary and tertiary information should remain accessible without overwhelming the first view.

PBOS should prefer collapsible sections, compact summaries, drill-down detail, and contextual expansion rather than placing every capability on one screen.

---

# 7. Shared Engines — REUSE

PBOS V1 must reuse:

- one Goal Engine
- one System Engine
- one Action Engine
- one Planning/Scheduling Architecture
- one Evidence Infrastructure
- one Knowledge Relationship Layer
- one Search Index
- one Quick Capture Pipeline
- one AI Recommendation / Decision Flow
- one Effective Configuration System
- one Resilience Component System

Domains plug into these systems.

They do not recreate them.

---

# 8. Today — SIMPLIFY

Today must remain the operational home screen.

Its core question is:

**What happened, what matters, what remains, and what should I do next?**

KEEP:

- Today-at-a-glance
- current plan
- current focus
- important risks/deadlines
- meaningful routine status
- compact domain summaries
- Quick Capture
- contextual AI guidance

SIMPLIFY:

- excessive domain metrics
- repeated large recommendation cards
- duplicate progress summaries
- too many equal-sized modules

Use priority bands:

- Primary
- Secondary
- On Demand

Collapsed information should remain accessible.

Today must not become a dashboard containing every PBOS feature.

---

# 9. Goals & Systems — SIMPLIFY + MERGE PRESENTATION

KEEP:

- Goal and System as separate concepts
- Goal Detail
- System Detail
- Action relationships
- evidence
- progress
- user-controlled AI proposals

MERGE PRESENTATION:

- repeated progress summaries
- repeated Action lists
- repeated evidence summaries
- repeated AI recommendation presentation

Prefer:

**Goal State → Systems & Actions → Evidence / Intelligence → More**

rather than a wall of equally weighted cards.

Goal and System engines remain separate where semantics differ.

---

# 10. Academics — KEEP CORE DISTINCTIONS, SIMPLIFY OVERVIEW

KEEP:

- semester overview
- course detail
- assessments
- SGPA/CGPA intelligence
- Professor Coverage
- Personal Study Coverage
- Mastery
- deterministic grade calculations
- configurable assessment structure

SIMPLIFY:

- repeated course summary cards
- redundant progress indicators
- excessive academic metrics on overview
- multiple visualizations that answer the same question

Academics Overview should prioritize:

**Semester State → Courses Needing Attention → Upcoming Work → Next Academic Action**

Detailed calculations belong deeper.

---

# 11. Knowledge & Obsidian — KEEP BOUNDARY, SIMPLIFY SURFACES

KEEP:

- Knowledge Overview
- Topic Detail
- Notes Hub
- Learning/Capture
- canonical topic relationships
- evidence and review state
- Obsidian as authoritative Markdown body

SIMPLIFY:

- repeated note metadata blocks
- repeated evidence widgets
- excessive relationship visualization
- repeated “what I know” indicators that communicate the same thing

Use shared evidence and state components.

Do not create a second full note editor inside PBOS.

---

# 12. Development — SIMPLIFY WITHOUT LOSING CAPABILITY

KEEP:

- Development Overview
- Project Detail
- Learning Path
- Skill Detail
- Project Progress ≠ Skill Progress
- Knowledge / Practice / Evidence distinction
- AI-assisted evidence provenance

SIMPLIFY:

- repeated project progress cards
- repeated skill widgets
- redundant evidence panels
- excessive capability scoring

Prefer:

**Current Build → Current Learning → Capability Gaps → Next Action**

Detailed evidence belongs behind drill-down.

---

# 13. Fitness & Recovery — KEEP TRUTHFUL STATES

KEEP:

- Fitness Overview
- Training Plan Detail
- Active Workout
- Recovery/Readiness
- Base Plan
- Today’s Prescription
- Actual Session
- evidence
- adaptation history

SIMPLIFY:

- excessive readiness indicators
- repeated progress metrics
- redundant workout summaries
- unnecessary dashboard-style visualization

Fitness Overview should answer:

**What should I do today, how am I progressing, and should I push, maintain, or recover?**

Do not simplify away planned-versus-actual truth.

---

# 14. Routines & Daily Life — SIMPLIFY

KEEP:

- Routine Overview
- Daily Check-in
- Routine Detail
- Routine Builder
- cadence
- reminders
- evidence
- compliance/consistency

SIMPLIFY:

- repeated routine cards
- large analytics sections
- unnecessary “goal-like” presentation
- over-gamification

Routine UI should remain fast and low-friction.

Routine check-in must not become an Action by default.

---

# 15. Reading & Language Learning — KEEP DOMAIN MEANING

KEEP:

- overview
- language path
- learning session
- book detail/progress
- curriculum progress
- Knowledge links
- mastery distinction

SIMPLIFY:

- repeated session statistics
- repeated progress cards
- excessive vocabulary/book metrics on overview

Prefer:

**Current Learning → Progress → Next Session → Evidence / Review**

Completion must not imply mastery.

---

# 16. Money OS — KEEP LIGHTWEIGHT

KEEP:

- Money Overview
- Transactions
- Budget/Savings
- Insights/Review
- transaction semantics
- savings semantics
- deterministic totals

SIMPLIFY:

- advanced accounting presentation
- excessive charts
- finance-dashboard density
- performance-style scoring

Money remains awareness-oriented and separate from PBOS performance scoring.

---

# 17. Analytics & Reviews — SIMPLIFY + PROGRESSIVE DISCLOSURE

KEEP:

- Analytics Overview
- Weekly Review
- Monthly Review
- Patterns & Insights
- evidence-based interpretation
- confidence/missing-data awareness

SIMPLIFY:

- excessive charts
- repeated domain summaries
- duplicate insight cards
- fake aggregate scoring
- secondary analysis shown too early

Analytics should prioritize:

**Important Pattern → Why It Matters → Evidence → Recommended Attention**

Detailed evidence and historical charts can expand on demand.

---

# 18. AI Coach & Intelligence — SIMPLIFY PRESENCE

KEEP:

- AI Coach Overview
- AI Workspace
- Recommendations/Decisions
- Context/Permissions
- proposal flow
- user approval
- activity traceability

SIMPLIFY:

- large AI cards on every domain screen
- duplicated AI explanations
- repeated recommendation surfaces
- unnecessary AI-first navigation

Preferred behavior:

- small contextual recommendation where useful
- AI icon/entry where appropriate
- full AI workspace when intentionally opened

AI remains advisory.

AI does not become the main navigation system.

---

# 19. Planner & Calendar — KEEP PURPOSES DISTINCT

KEEP:

- Planner Overview
- Calendar Week
- Plan Builder
- Conflict/Capacity view
- Action ≠ Scheduled Block
- capacity constraints
- protected time
- user approval

MERGE PRESENTATION:

- duplicate scheduling summaries
- repeated Action information
- repeated conflict explanation components

Planner and Calendar remain separate because they answer different questions.

Do not merge them into one screen merely to reduce screen count.

---

# 20. Settings & Preferences — SIMPLIFY OVERVIEW

KEEP:

- Settings Overview
- Performance/Planning
- AI/Privacy/Data
- Notifications/Appearance
- Base → Mode → Temporary → Effective configuration

SIMPLIFY:

- advanced settings on overview
- destructive controls at top level
- provider-level details where not immediately needed
- repeated configuration explanations

Settings Overview should show:

**Current Configuration → Setup Attention → Major Categories**

Advanced configuration stays deeper.

---

# 21. Onboarding — KEEP CALM AND SHORT

KEEP:

- Welcome
- Personal Setup
- Connect Systems
- Review & Launch
- resumable onboarding
- partial setup
- optional AI
- no login wall
- first-boot vs normal-boot distinction

SIMPLIFY:

- unnecessary domain setup
- too many optional questions
- advanced settings
- detailed analytics
- long explanations

Onboarding should create a usable baseline, not configure every PBOS capability.

---

# 22. Search / Commands — KEEP FAST

KEEP:

- Ctrl+K
- grouped search results
- canonical routing
- command safety levels
- local deterministic ranking
- AI-optional interpretation

SIMPLIFY:

- huge command libraries
- deeply nested command interfaces
- destructive commands in normal discovery
- unnecessary search analytics

Search is for access and speed.

It is not another AI Coach.

---

# 23. Quick Capture — KEEP MINIMAL

KEEP V1 types:

- Action
- Academic event/deadline
- Knowledge item
- Quick Note
- Expense
- Routine check-in

SIMPLIFY:

- complex universal forms
- full domain builders inside capture
- excessive AI conversation

Quick Capture should capture first, then route into authoritative engines.

When uncertain, preserve raw input in Capture Inbox.

---

# 24. Resilience & Edge States — MERGE PRESENTATION

Use one reusable state system for:

- Empty
- First Use / Setup Required
- Filtered Empty
- Positive Empty
- Offline
- AI Disabled
- AI Not Configured
- AI Unavailable
- Request Failed
- Inline Error
- Component Error
- Domain Error
- Critical Error
- Loading
- Partial Data
- Stale Data
- Background Processing

Each domain provides contextual copy and actions.

The component architecture should be shared.

Do not independently redesign these states for every screen.

---

# 25. Repeated Recommendation Surfaces — MERGE PRESENTATION

Recommendations may appear in:

- Today
- Academics
- Development
- Fitness
- Analytics
- Reviews
- Planner
- AI Coach

Use a shared Recommendation presentation pattern.

The underlying recommendation should remain canonical where appropriate.

Preferred compact states:

- Suggested
- Needs Review
- Accepted
- Modified
- Rejected
- Applied

Do not create different AI recommendation UI systems per domain.

---

# 26. Evidence Presentation — MERGE PRESENTATION

Use reusable Evidence components.

Domain-specific evidence content remains intact.

Common presentation may support:

- source
- timestamp
- evidence type
- linked entity
- strength/status
- provenance
- details

Do not invent separate evidence-card systems in every domain.

---

# 27. Progress / State Components — MERGE PRESENTATION

Reuse common primitives where meaning is comparable.

Examples:

- status chips
- progress bars
- state labels
- confidence indicators
- attention indicators
- review-due state

However, do not force semantically different metrics into a common numeric scale.

Shared visual primitive ≠ shared meaning.

---

# 28. Create / Add Controls — SIMPLIFY

Avoid repeated inline creation buttons everywhere.

Preferred hierarchy:

1. Screen-specific primary action when context requires it.
2. Ctrl+K command.
3. Quick Capture for lightweight capture.
4. Full builder for complex creation.

Do not duplicate full forms inside multiple modules.

---

# 29. Navigation — SIMPLIFY WITHOUT HIDING PRODUCT

Sidebar provides discoverability.

Ctrl+K provides speed.

Domain navigation provides context.

Quick Capture provides capture.

Do not overload one of these systems to replace all others.

Avoid repeated navigation controls inside cards where normal navigation already solves the problem.

---

# 30. Visual Complexity — SIMPLIFY

Across V1:

Avoid:

- equal-card grids everywhere
- excessive glow
- too many charts
- unnecessary tiny labels
- redundant headings
- repeated metrics
- excessive glass
- gaming/cyberpunk styling
- constant animation

Prefer:

- hierarchy
- whitespace
- calm surfaces
- strong grouping
- progressive disclosure
- restrained state illumination
- meaningful typography

PBOS should feel engineered, not busy.

---

# 31. Deferred to V2+

The following are explicitly outside focused V1:

- autonomous multi-agent orchestration
- AI direct mutation without approval
- mature vector database
- mature semantic/RAG across all PBOS data
- full Obsidian semantic ingestion
- cloud-first architecture
- general multi-device synchronization platform
- mobile application architecture
- plugin marketplace
- workflow scripting
- command chaining
- universal performance score
- complex predictive modeling
- social/community features
- unnecessary gamification
- huge customization framework
- advanced accounting
- complex financial planning
- advanced experimental analytics
- excessive autonomous automation

Deferral protects V1 clarity and finishability.

---

# 32. What Must Never Be Simplified Away

Do not simplify away:

- source-of-truth boundaries
- planned vs actual
- study vs mastery
- goal vs system
- action vs scheduled block
- recommendation vs applied state
- project progress vs skill capability
- fitness prescription vs actual performance
- unknown vs zero
- empty vs error
- activity vs outcome
- user approval
- deterministic calculations
- data safety
- resilience boundaries
- AI permissions

If a simplification damages truth, it is rejected.

---

# 33. Implementation Rule

When Claude encounters a visually dense screen:

Do not immediately remove features.

Use this order:

1. Identify duplicate presentation.
2. Reuse existing components.
3. establish primary/secondary/tertiary hierarchy.
4. collapse secondary information.
5. move advanced detail deeper.
6. reuse canonical records.
7. preserve domain semantics.
8. remove capability only when explicitly decided.

---

# 34. Implementation Conflict Rule

If the implementation differs from these decisions because architecture currently assumes another model:

**UI ↔ ARCHITECTURE REVIEW REQUIRED**

Claude must not silently rewrite product semantics just to match a reference image.

---

# 35. Claude Simplification Audit Checklist

- [ ] No useful capability was removed merely to reduce visual density.
- [ ] Primary information is obvious on every major screen.
- [ ] Secondary information is visually subordinate.
- [ ] Tertiary detail is progressively disclosed.
- [ ] Today is not overloaded with every domain metric.
- [ ] Goals and Systems preserve meaning while reusing summary components.
- [ ] Academics preserves Coverage / Study / Mastery distinctions.
- [ ] Knowledge does not duplicate Obsidian note bodies.
- [ ] Development preserves Project / Skill / Knowledge distinctions.
- [ ] Fitness preserves Base / Prescription / Actual.
- [ ] Routines remain low-friction.
- [ ] Reading/Language completion does not imply mastery.
- [ ] Money remains lightweight and outside performance scoring.
- [ ] Analytics prioritizes meaningful patterns instead of chart volume.
- [ ] AI is contextual rather than visually dominant everywhere.
- [ ] Planner and Calendar retain separate purposes.
- [ ] Settings Overview is not overloaded with advanced configuration.
- [ ] Onboarding creates a baseline rather than configuring the entire product.
- [ ] Search remains fast and deterministic.
- [ ] Quick Capture remains minimal.
- [ ] Resilience uses reusable components.
- [ ] Recommendation UI is reused across domains.
- [ ] Evidence presentation is reused across domains.
- [ ] Shared progress/state primitives are reused without merging incompatible meaning.
- [ ] Duplicate Add/Create controls were reduced where appropriate.
- [ ] Existing canonical engines are reused.
- [ ] No V2+ complexity has been added during simplification.
- [ ] Any genuine semantic/architecture conflict is marked UI ↔ ARCHITECTURE REVIEW REQUIRED.

---

# 36. Final V1 Simplification Lock

PBOS V1 follows:

**KEEP what protects meaning.**

**SIMPLIFY what overwhelms the user.**

**MERGE PRESENTATION where information repeats.**

**REUSE SHARED ENGINES where architecture is common.**

**DEFER complexity that V1 does not need.**

The final standard is:

> **Less UI complexity ≠ less PBOS capability.**

PBOS should remain one connected, powerful system with clear information, canonical records, deterministic truth, and user control.
