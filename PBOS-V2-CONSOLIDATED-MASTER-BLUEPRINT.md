# PERFORMANCE BUDDY OS V2 — CONSOLIDATED MASTER BLUEPRINT

Date: 2026-09-01
Status: IMPLEMENTATION-READY PRODUCT/ARCHITECTURE BLUEPRINT
V1: frozen at v1.0.0-rc.2
Target: V2 adaptive intelligence foundation and primary user flows

## 1. Product objective

V2 exists to reduce manual PBOS operation without reducing trust.

Primary success statement:

> I use PBOS more, but I operate PBOS less.

Canonical operating flow:

GOAL
→ SYSTEM
→ ACTION
→ PLANNER
→ CALENDAR
→ TODAY
→ EXECUTION
→ EVIDENCE
→ DOMAIN STATE
→ ANALYTICS
→ REVIEW
→ INTELLIGENCE
→ RECOMMENDATION
→ USER DECISION
→ VALIDATED APPLY
→ RE-PLANNING

External reality enters primarily through Natural Capture.
PBOS-native activity propagates from canonical execution evidence.
Today is the operational decision surface.
Planner is the canonical schedule authority.
Domain intelligence determines WHAT matters.
Deterministic engines determine facts, validity and fit.
AI explains/recommends; it does not become canonical truth.

## 2. Permanent invariants

- Action ≠ Planning Block ≠ Completion.
- Activity ≠ Outcome ≠ Mastery.
- Professor Coverage ≠ Personal Study ≠ Mastery.
- Unknown ≠ Zero.
- Correlation ≠ Causation.
- AI suggestion ≠ truth.
- Calendar is a view over canonical Planning, not a second schedule.
- One real-world event should not require repeated human entry.
- Knowledge mastery is evidence-derived.
- Obsidian owns authoritative Markdown note bodies.
- Routine consistency remains streak-free.
- AI context is permission-scoped.
- AI has no generic database write authority.
- Meaningful plan/routine/academic mutations require user decision.
- Provider failure must not disable core PBOS.

## 3. Consolidated semantic families

### Capture Proposal

Meaning:
“I think this is what you told PBOS happened.”

Persisted separately from AI recommendations.

Proposal class:
- fact
- interpretation

Reasoning beyond the user's literal statement is not applied as a Capture Proposal. A system-generated “you should…” item becomes an Intelligence Recommendation.

### Intelligence Recommendation

Meaning:
“PBOS thinks this change may help.”

Uses the existing durable AI recommendation/decision trail and explicit allowlisted mutation kinds.

### Planning Diff

Meaning:
“Here is how the canonical plan would change.”

A Planning Diff is a set of typed KEEP/ADD/MOVE/SHORTEN/DEFER/DROP/occurrence changes that is validated as one final state before Apply.

These three families may reuse visual primitives but must remain semantically distinct.

## 4. Shared mutation safety architecture

Capture and AI must not build separate unsafe write systems.

Create/reuse one explicit mutation registry:

structured proposal
→ explicit MutationKind
→ resolve canonical entity
→ deterministic validator
→ preview
→ apply exactly one canonical domain operation
→ revision/audit

No generic:
- applyPatch
- writeTable
- arbitrary SQL
- arbitrary Tauri command
- model-selected command name

Existing Intelligence Apply adapters should be migrated/reused through this registry rather than duplicated.

Initial mutation kinds should cover existing V1 behavior plus required V2 flows, such as:

- create-action
- create-expense
- routine-checkin
- set-professor-coverage
- set-personal-study
- create-assessment
- update-assessment-date
- update-assessment-scope
- create-language-session
- set-today-capacity
- schedule-block
- set-knowledge-review
- adjust-routine-cadence
- adjust-routine-window
- adjust-routine-duration
- adjust-routine-days

Only add a mutation kind when a canonical domain method exists or is intentionally added with deterministic validation.

## 5. Schema v11 — exact required additions

Keep all V1 tables. Do not destructively rewrite V1 data.

### 5.1 `academic_assessment_topics`

Purpose:
Explicit Assessment ↔ Academic Topic scope.

Suggested columns:
- assessment_id TEXT FK academic_assessments ON DELETE CASCADE
- topic_id TEXT FK academic_topics ON DELETE CASCADE
- source TEXT NOT NULL DEFAULT 'user'
- created_at TEXT NOT NULL
- PRIMARY KEY (assessment_id, topic_id)

Validation must enforce that assessment and topic belong to the same course.

### 5.2 `capture_proposals`

Purpose:
One Natural Capture inbox item can contain multiple reviewable fact/interpretation proposals.

Suggested columns:
- id TEXT PRIMARY KEY
- capture_id TEXT FK capture_inbox ON DELETE CASCADE
- proposal_class TEXT (`fact` | `interpretation`)
- domain TEXT
- mutation_kind TEXT
- title TEXT
- source_text TEXT
- confidence TEXT (`clear` | `needs-review` | `ambiguous`)
- ambiguity_reason TEXT NULL
- rationale TEXT
- evidence_json TEXT DEFAULT '[]'
- original_params_json TEXT DEFAULT '{}'
- effective_params_json TEXT DEFAULT '{}'
- status TEXT (`proposed` | `accepted` | `modified` | `rejected` | `applied` | `apply-failed`)
- validation_json TEXT NULL
- applied_result_json TEXT NULL
- created_at TEXT
- decided_at TEXT NULL
- applied_at TEXT NULL

Preserve existing `capture_inbox` rows and fields. Backward compatibility/backfill must be idempotent and non-destructive.

### 5.3 `action_scheduling_constraints`

Purpose:
Structured scheduling metadata for canonical Actions without turning Planner into a second task system.

Suggested columns:
- action_id TEXT PRIMARY KEY FK actions ON DELETE CASCADE
- required_before TEXT NULL
- earliest_date TEXT NULL
- preferred_time_window TEXT NULL (`morning` | `day` | `evening` | `anytime`)
- minimum_block_minutes INTEGER NULL
- splittable INTEGER NOT NULL DEFAULT 0
- source TEXT NOT NULL DEFAULT 'user'
- created_at TEXT
- updated_at TEXT

The Action's existing `est_minutes` remains the total estimate. Do not duplicate it here.

### 5.4 `planning_occurrence_exceptions`

Purpose:
Persist the state of one occurrence of a recurring PlanningBlock without mutating/deleting the recurring template.

Suggested columns:
- id TEXT PRIMARY KEY
- block_id TEXT FK planning_blocks ON DELETE CASCADE
- occurrence_date TEXT NOT NULL
- state TEXT (`skipped` | `done` | `deferred`)
- replacement_block_id TEXT NULL FK planning_blocks ON DELETE SET NULL
- source TEXT NOT NULL DEFAULT 'user'
- note TEXT NOT NULL DEFAULT ''
- created_at TEXT
- updated_at TEXT
- UNIQUE(block_id, occurrence_date)

This is an exception layer, not a second calendar store.

### 5.5 `planning_change_sets`

Purpose:
Durable Planning Diff + inverse change information for review, audit and practical undo.

Suggested columns:
- id TEXT PRIMARY KEY
- scope TEXT (`micro` | `day` | `week`)
- status TEXT (`proposed` | `applied` | `rejected` | `apply-failed` | `undone`)
- target_start_date TEXT NULL
- target_end_date TEXT NULL
- rationale TEXT
- reason_codes_json TEXT DEFAULT '[]'
- changes_json TEXT DEFAULT '[]'
- inverse_changes_json TEXT DEFAULT '[]'
- source TEXT
- created_at TEXT
- decided_at TEXT NULL
- applied_at TEXT NULL
- undone_at TEXT NULL

The schedule still lives only in `planning_blocks` + occurrence exceptions.

### 5.6 `today_operating_state`

Purpose:
Persist only subjective daily execution capacity.

Suggested columns:
- date TEXT PRIMARY KEY
- capacity_level TEXT (`low` | `normal` | `high`)
- source TEXT (`user` | `capture-approved`)
- note TEXT NOT NULL DEFAULT ''
- created_at TEXT
- updated_at TEXT

Do not persist current/next/gaps/fragility; they are derived.

## 6. Natural Capture architecture

Evolve the existing `domains/capture` implementation. Do not build a parallel capture subsystem.

Flow:

raw text
→ local safe pre-classification/segmentation
→ permission-aware optional remote parsing
→ entity resolution
→ multiple Capture Proposals
→ ambiguity/duplicate checks
→ Accept/Modify/Reject
→ shared mutation validation
→ canonical domain methods
→ audit
→ optional separate Intelligence Recommendations

Rules:
- Raw capture persists locally before any provider call.
- Provider failure cannot lose text.
- Existing canonical Focus/session evidence outranks approximate re-entry.
- Resolve existing entity before creating a new one.
- Multi-domain capture is allowed.
- Unknown fields stay unknown.
- No fake confidence percentages.
- Recommendations generated from a capture are stored as Intelligence Recommendations, not silently mixed into factual capture updates.

Privacy rule:
Do not send an entire mixed raw capture to a remote model when it may contain data from a no-access domain.
Use deterministic local segmentation/classification first.
Only remote-enhance segments that are mapped to domains with at least Read permission.
Unclassified/sensitive segments remain local and reviewable.
Money remains no-access by default.

UI:
Natural Capture is a global drawer/overlay reachable from:
- Today
- Command Palette
- keyboard shortcut
- contextual “Capture update”
Capture Inbox remains the durable unresolved/history route.

## 7. Evidence propagation

PBOS-generated activity is reused.

Focus session context should carry:
- actionId
- planningBlockId
- courseId
- academicTopicId
- knowledgeTopicId
- target duration
- origin

On completion:
- the Focus session is canonical activity evidence
- do not ask duration again
- Today derives actual-vs-planned state
- Academics can ask only unknown human truths
- Knowledge mastery changes only through governed evidence
- Action completion is never inferred merely from elapsed minutes
- recurring block occurrence may be resolved separately without mutating recurring template

No new duplicate “activity log” table is needed.

## 8. Adaptive Today

Create a deterministic `TodayState` derivation layer near the existing Today implementation.

It should derive:
- current fixed commitment
- current planned block
- next block
- earlier/elapsed blocks
- unresolved elapsed occurrences
- free gap duration
- remaining planned load
- remaining available/capacity context
- current day capacity level
- fragility/overload
- linked Focus evidence
- protected/locked state

Behavior:
- FOLLOW PLAN when reality still fits.
- ADAPT only on material divergence.
- passing time does not mark a block missed.
- buffer can be preserved.
- fixed/locked/user intent outranks AI.
- meaningful plan changes are emitted as Planning Diffs.
- Today never owns another schedule.

Primary UI:
NOW
→ next
→ changed/adaptation only when relevant
→ compact Natural Capture
→ tertiary state/metrics

## 9. Adaptive Planning

Keep current deterministic planning engine.

Add a concrete-date adaptive candidate/placement layer rather than asking an LLM for timestamps.

Transient `PlanningCandidate` / `StudyRequirement` can include:
- source domain/entity
- linked Action if present
- title/context
- total estimate
- required-before
- earliest date
- preferred time window
- minimum useful block
- splittable
- reason codes
- user priority

Do not persist a second task list.

When persistent user scheduling intent is needed:
- reuse/create canonical Action
- attach `action_scheduling_constraints`

Placement rules:
1. never overlap
2. never exceed daily/weekly capacity
3. respect fixed/locked/manual protection
4. satisfy required-before where possible
5. honor minimum contiguous duration
6. split only when explicitly splittable
7. prefer stable existing plan; minimize churn
8. prefer healthier capacity/buffer among equally valid choices
9. use concrete date-pinned generated blocks for one-off adaptive work
10. keep recurring semantics intentional

Adaptation scopes:
- micro
- day
- week

Prefer the smallest scope.

Could Not Fit is a valid outcome with explicit reason.

Planning Diff changes:
- KEEP
- ADD
- MOVE
- SHORTEN
- DEFER
- DROP FOR OCCURRENCE
- OCCURRENCE DONE/SKIPPED
- COULD NOT FIT (not applied)

Final selected/modified diff must be validated as a complete state before Apply.

## 10. Academic Intelligence

Extend existing `studyEngine.ts` reason-code approach.

New factual signals:
- assessment date
- explicit assessment scope
- weight
- professor coverage
- personal study
- Knowledge state/evidence/review due
- recent study/focus
- repeated unresolved weakness
- user priority

No universal opaque numeric priority score.

Assessment scope is explicit and never guessed.

Study target ranking should use inspectable ordering and direct date comparison rather than an arbitrary weighted formula.

Recommended categories:
- Learn
- Strengthen
- Review
- Verify

Academic Intelligence emits transient Study Requirements.
Planner decides where they fit.
Today decides whether one is appropriate now.

Grade/SGPA/CGPA math remains deterministic.
Do not guess grade intervals or repeat policy.

Course-level attention can be derived as:
- Immediate: upcoming assessment + relevant unresolved preparation risk
- Watch: meaningful covered-not-studied/review/evidence gap without immediate assessed pressure
- Stable: no current material attention signal

These derived states do not silently mutate stored Course.status.

## 11. Knowledge Intelligence

Keep mastery evidence-derived.

Add contextual capabilities:
- Generate Recall
- evidence-gap explanation
- review recommendation
- source recommendation
- method recommendation

Use existing `mastery_checks` for governed recall/practice sessions rather than creating a permanent AI question-bank table.

AI-generated questions alone are not evidence.
Only completed/evaluated checks can create Knowledge Evidence.

Obsidian:
- remains note-body authority
- note bodies are never put into generic AI domain facts
- selected note previews may be used for a user-triggered Knowledge action only when permission allows
- no silent note rewrite

No heavy RAG/vector system for core V2.

## 12. Routine Intelligence

Keep streak-free 7/30-day schedule-aware consistency.

Add deterministic pattern candidate derivation.

Conservative evidence rule:
- do not create a structural recommendation from fewer than 6 comparable expected opportunities
- for direct time-window/day-bucket comparisons, require at least 4 comparable opportunities in each compared bucket
- keep these thresholds centralized/constants and visible in tests

Potential pattern reasons:
- repeated miss/partial cluster by time window
- cadence consistently unrealistic
- duration target appears mismatched
- certain schedule days repeatedly underperform

AI may explain/suggest structural changes.
Apply only through explicit mutation kinds.
No schedule passage → automatic completion/miss inference.

## 13. AI Coach

AI Coach becomes deep exploration, not the only AI entry point.

Keep:
- provider abstraction
- permissions
- context preview
- durable recommendations
- decision events
- combined impact validation

Expand recommendation sources for contextual V2 use as needed:
- contextual
- capture
- adaptive-today
- academic
- knowledge
- routine
- planning
while preserving current sources for compatibility.

Use deterministic derived facts in AI context.
Do not ask AI to recompute mastery, conflicts, capacity or GPA.

Provider failure must leave all deterministic core features operational.

## 14. Screen Impact Matrix

### Major evolution
- Today
- Capture Inbox
- Planner
- Academics Overview
- Course Detail
- Normal Study
- Knowledge Topic Detail
- AI Coach
- Weekly Review

### Moderate evolution
- Calendar
- Mastery Check
- Knowledge Overview
- Notes Hub
- Routines Overview
- Routine Detail
- AI Workspace
- AI Permissions
- Focus
- Analytics Overview / Patterns
- Settings AI section
- Command Palette

### Minor / contextual integration
- Goals / Goal Detail
- Development
- Fitness
- Language
- Money
- Daily Routine Check-In
- SGPA/CGPA
- Course/Topic builders
- Onboarding only if necessary to expose existing AI permission/provider choices

### Keep
- Splash visual identity / startup behavior unless a real V2 integration requirement appears.

No mass rewrite of all routes.

## 15. Reusable V2 UI primitives

Prefer existing PBOS components. Add only what is needed, such as:

- NaturalCaptureDrawer
- CaptureProposalBundle
- CaptureProposalItem
- ProposalOriginLabel (“You said” / “PBOS interpreted”)
- ReasonList / WhyThis
- PlanningDiffReview
- PlanningDiffRow
- AdaptiveNowSurface
- ContextualInsight
- AttentionSignal
- ConfidenceLabel (qualitative)
- ChangePreview
- Undo/Restore action surface

All must obey DESIGN.md:
- primary/secondary/tertiary hierarchy
- no equal-card dashboard regression
- no neon/cyberpunk
- no giant AI orb/chatbot styling
- no raw hex colors
- reduced-motion support
- accessible labels/focus/keyboard behavior

## 16. Testing contract

### Baseline first
Before modification, record actual:
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`
- `cargo test --manifest-path src-tauri/Cargo.toml`

Do not assume old counts.

### Required new unit/engine tests

Natural Capture:
- multi-domain proposal bundle
- ambiguity
- unknown stays unknown
- duplicate evidence detection
- entity resolution
- permission-limited remote parsing
- provider unavailable preserves raw capture
- separate recommendation semantics

Academics:
- scope same-course enforcement
- unknown scope not guessed
- scoped weak topic outranks irrelevant topic
- mode does not invent scope
- repeated weakness method reason

Planning:
- concrete-date fit
- locked/manual preservation
- smallest-scope adaptation
- change-cost/stability
- splittable vs contiguous
- Could Not Fit reasons
- occurrence exception semantics
- final selected diff combined validation
- inverse/undo correctness

Today:
- valid plan → no adaptation
- fixed/current precedence
- free-gap fit
- elapsed unresolved ≠ missed
- daily capacity not invented
- buffer preservation
- Focus evidence reuse
- recurring occurrence resolution without corrupting template

Knowledge:
- generated questions alone do not move mastery
- completed governed check can create evidence
- selected Obsidian content only used under permission/action boundary

Routine:
- no pattern below evidence threshold
- supported pattern above threshold
- rest/skipped/pending not treated as misses
- structural change requires approved mutation

Mutation registry:
- every kind validates
- unknown kind cannot apply
- no generic write path
- combined changes validated

### Rust / persistence
- schema migrates v10 → v11
- migration is idempotent
- old data survives
- new tables round-trip
- close/reopen SQLite persistence
- FK behavior
- exact Tauri command wire shapes

### Browser E2E
At minimum:
1. Natural Capture mixed update → review → selective apply
2. Assessment scope → academic recommendation
3. Adaptive Planner diff → apply → reload
4. recurring block occurrence defer/skip → template survives
5. Today valid-plan and adaptation-needed paths
6. AI unavailable deterministic fallback
7. permissions prevent disallowed AI context
8. Knowledge recall → explicit evidence path
9. routine structural recommendation path

### Accessibility
Run axe on materially changed major screens.
Keyboard-test drawer/dialog/proposal controls.
Status cannot rely on color alone.

### Final checks
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --release --manifest-path src-tauri/Cargo.toml`
- `npm run tauri:build` if the environment supports it after all migrations are finalized
- native E2E only after the migration is stable; report known infrastructure limitations truthfully

## 17. Git/release rules

- Do not modify or rewrite V1 release history.
- Do not create a “V1 Batch 11”.
- Do not change/tag the production release version merely because V2 code exists.
- No force push.
- No destructive reset.
- Preserve user/untracked work.
- Local commits by coherent V2 phase are encouraged.
- Do not push unless explicitly authorized.
- Keep V1 tag/history intact.

## 18. Implementation order

A. Read/verify baseline and commit blueprint docs.
B. Schema v11 + Rust/TS repos/wire tests.
C. Shared explicit mutation engine.
D. Natural Capture V2.
E. Assessment Scope + Academic Intelligence.
F. Adaptive Planning + occurrence exceptions + Planning Diff.
G. Adaptive Today + Focus/evidence integration.
H. Knowledge/Routine contextual intelligence.
I. AI Coach contextualization/permissions integration.
J. Screen refinement + Playwright/Agent Browser audit.
K. Full regression + release-quality implementation report.

Do not cosmetically redesign screens before their behavior/state architecture is correct.

## 19. Completion definition

V2 is not “done” because pages render.

A completed implementation must demonstrate:

- durable migration
- no duplicate canonical stores
- Natural Capture multi-domain review/apply
- evidence reuse
- assessment scope
- explainable academic study prioritization
- deterministic adaptive planning with diffs
- Today follow-plan/adapt behavior
- recurring occurrence correctness
- Knowledge recall/evidence boundary
- evidence-backed Routine recommendations
- permission-scoped contextual AI
- provider failure fallback
- user approval for meaningful change
- audit/reversibility where specified
- full relevant tests/build/lint/E2E passing
- visual consistency with DESIGN.md
