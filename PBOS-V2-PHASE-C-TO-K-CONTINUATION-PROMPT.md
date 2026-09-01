# PBOS V2 — CONTINUATION MASTER PROMPT
## Resume from SAFE CHECKPOINT: Phase C → K

You are continuing an already-started PBOS V2 implementation.

Do **not** restart the V2 project from scratch.

The previous autonomous run completed a clean checkpoint:

- Branch: `v2/adaptive-intelligence-foundation`
- V1 `main` remained untouched at `c1e82a3`
- Phase A completed and committed
- Phase B completed and committed
- Schema migrated from v10 → v11
- Persistence foundation and wire contracts are already implemented
- Working tree was reported clean
- Full regression at checkpoint was reported passing:
  - Vitest: 693 pass / 87 files
  - Cargo: 138 pass
  - Playwright: 63 pass
  - lint: exit 0
  - build: exit 0
  - cargo check --release: exit 0
- `PBOS-V2-IMPLEMENTATION-REPORT.md` exists and contains the exact checkpoint state and resume plan

Your task is to **resume from Phase C** and continue autonomously through as much of Phases C–K as can be completed safely and coherently.

# 0. FIRST ACTIONS — VERIFY, DO NOT REDO

Before editing anything:

1. Read completely:
   - `CLAUDE.md`
   - `DESIGN.md`
   - `PBOS-V2-IMPLEMENTATION-REPORT.md`
   - `PBOS-V2-CLAUDE-CODE-MASTER-GIGA-PROMPT.md`
   - `docs/27 - V2 Adaptive Coach/V2 Master Blueprint - 2026-09-01/07 - Consolidated V2 Master Blueprint.md`
   - Passes 1–6 in that blueprint folder

2. Verify:
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse HEAD`
   - `git log -8 --oneline`

3. Confirm the current branch is the existing V2 feature branch and the prior Phase A/B commits are present.

4. Inspect the actual Phase B implementation:
   - schema v11 migration
   - new Rust commands
   - `app/src/domains/adaptive/`
   - exact TS/Rust wire contracts
   - tests added in Phase B

5. Run a quick checkpoint verification, not a full redesign:
   - targeted Phase B tests
   - `npm run build`
   - `cargo test --manifest-path src-tauri/Cargo.toml`

If the checkpoint is intact, immediately proceed to Phase C.

Do not recreate schema v11, rewrite Phase A/B docs, or redesign the persistence foundation merely because you would have implemented it differently.

Only modify Phase B if a concrete bug blocks subsequent work.

# 1. AUTONOMOUS CONTINUATION RULE

Continue using:

**inspect → implement → test → diagnose → fix → retest → commit**

Do not stop after one phase unless:
- a genuine blocker requires the product owner
- continuing would require unsafe/destructive assumptions
- context/tool budget requires a safe checkpoint

Do not use “this is a multi-week project” as a reason to stop early.

The goal is not to estimate how long V2 would take manually.
The goal is to complete as much verified implementation as possible in the current autonomous run.

If you cannot finish all phases, finish the current coherent phase and leave a verified safe checkpoint.

# 2. PHASE C — SHARED EXPLICIT MUTATION ENGINE

This is the immediate next phase.

The current repo has:
- V1 AI allowlisted Apply adapters
- V1 Quick Capture direct domain-store delegation
- Phase B adaptive persistence

Unify canonical proposal application without creating generic write authority.

Create/reuse a shared mutation registry under an appropriate domain path such as:

`app/src/domains/mutations/`

Use repo conventions.

Each `MutationKind` must define:
- explicit kind
- target domain
- deterministic validation
- entity resolution where necessary
- current-state description
- before/after preview
- explicit canonical apply function
- optional `triggersReplan`
- revision/audit behavior

Unknown mutation kinds must fail closed.

There must be no:
- generic applyPatch
- generic writeTable
- arbitrary JSON-to-domain write
- arbitrary Tauri command executor
- model-selected command
- raw SQL mutation path from AI/Capture

Migrate/reuse the existing `intelligence/applyAdapters.ts` behavior through the shared registry rather than duplicating it.

Preserve all current V1 AI recommendation tests/behavior.

Minimum mutation kinds needed for the remaining V2 flow:
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

Only add kinds that can be backed by real canonical domain operations.

Phase C acceptance:
- existing AI recommendations still Apply correctly
- Capture can call the same registry
- unknown kind cannot Apply
- invalid params cannot Apply
- previews are deterministic
- revision/audit remains correct
- no second generic mutation path remains
- focused tests pass
- full build passes

Commit when coherent.

Suggested commit:
`refactor(v2): unify validated canonical mutation adapters`

Then continue automatically to Phase D.

# 3. PHASE D — NATURAL CAPTURE V2

Do not create a parallel Natural Capture store.

Evolve the existing:
`app/src/domains/capture/`

The existing V1 invariant remains:
> Capture owns unresolved raw input only. Canonical domains own the actual resulting entities.

Required behavior:

raw text persisted locally FIRST
→ deterministic local segmentation/classification
→ permission filtering
→ optional provider enhancement
→ entity resolution
→ duplicate/evidence checks
→ multiple Capture Proposals
→ review bundle
→ Accept / Modify / Reject
→ shared Mutation Registry
→ canonical Apply
→ revision/audit
→ optional separate Intelligence Recommendation

One raw Capture Inbox item may own multiple Phase-B `capture_proposals`.

Semantics:
- `fact` = “You said”
- `interpretation` = “PBOS interpreted”
- a “PBOS recommends…” output must not be stored as a Capture fact; create an Intelligence Recommendation instead
- confidence labels only: clear / needs-review / ambiguous
- no percentages

Entity resolution:
- resolve existing entities before creating new ones
- support Academic Course/Topic, Routine, Language Path, Action/System where appropriate, Assessment
- Money category must remain unknown unless explicitly available/stated
- ambiguous entity = ask/select, never guess

Duplicate detection:
- canonical PBOS evidence first
- matching Focus/session should trigger reuse-vs-separate handling, not duplicate by default

Privacy:
- do not send full mixed raw capture remotely before local segmentation
- only remote-enhance a safely routed segment with at least Read permission
- Money stays no-access by default
- unknown/unclassified/sensitive segment stays local

Provider unavailable:
- raw input durable
- deterministic proposals usable
- unclassified parts reviewable
- manual classification/retry works

UI:
- global accessible drawer/overlay from Today, Command Palette, shortcut, contextual Capture update
- evolve `/capture-inbox` for unresolved/history/proposals
- no chatbot bubbles, AI orb, purple/cyan AI aesthetic

Tests:
- one input → multiple proposals
- fact vs interpretation
- separate recommendation semantics
- ambiguity
- unknown remains unknown
- existing entity reuse
- duplicate Focus evidence detection
- selective Accept/Modify/Reject
- final selected bundle validation
- provider failure preserves raw
- no-access segment never sent remotely
- old V1 capture rows still load

Commit:
`feat(v2): evolve quick capture into natural capture`

Continue to Phase E.

# 4. PHASE E — ASSESSMENT SCOPE + ACADEMIC INTELLIGENCE

Use the Phase B `academic_assessment_topics` foundation.

Do not rebuild Academics.

Assessment Scope:
- wire Rust repo/commands, TS repo/store, types, Course Detail/assessment UI, Natural Capture mutation, tests
- expose safe APIs such as getAssessmentTopics / setAssessmentScope / add-remove scope
- reject cross-course scope
- unknown scope remains unknown

Academic intelligence:
- evolve existing `studyEngine.ts`
- preserve reason-coded deterministic logic
- add reasons: assessment upcoming, explicitly scoped, assessment weight context, professor covered/user behind, weak/no Knowledge evidence, review due, repeated weakness, recent study, user priority
- no hidden universal `priorityScore`
- use deterministic date/order comparisons

Modes:
Normal:
- maintain pace
- review due
- nearest relevant assessment risk
- covered/not studied
- weak/no evidence

Midterm/Final:
- explicitly scoped unresolved topics first
- then other relevant weak/review items
- never invent scope
- never assume final cumulative

Recovery:
- smallest useful restart
- no backlog punishment

Study Requirement:
- transient typed Study Requirement / Planning Candidate
- course/topic, reasons, requiredBefore, estimate/suggested duration, min block, linked Action, evidence state
- not a persisted task table
- “Plan this” routes through canonical Action + Planning

Course attention:
- derived Immediate / Watch / Stable
- never silently mutate stored Course.status

Tests:
- same-course scope
- cross-course rejection
- unknown scope not guessed
- scoped weak topic outranks irrelevant topic
- mode does not invent scope
- repeated weakness changes method reason
- grade math unchanged

Commit:
`feat(v2): add assessment scope and academic attention intelligence`

Continue to Phase F.

# 5. PHASE F — ADAPTIVE PLANNING

Preserve one canonical Planning store.

Use Phase B:
- action_scheduling_constraints
- planning_occurrence_exceptions
- planning_change_sets

Add a pure/testable concrete-date planning engine over ISO dates.

Do not ask an LLM to place timestamps.

PlanningCandidate is transient and can contain:
- source domain/entity
- actionId
- title
- estimate
- requiredBefore
- earliestDate
- preferredTimeWindow
- minimumBlockMinutes
- splittable
- reasons
- priority

Persistent scheduling intent belongs in Action + Action Scheduling Constraints.

Hard rules:
- no overlap
- daily capacity
- weekly capacity
- fixed not moved
- locked preserved
- manual preserved by default
- released manual may move
- generated flexible may adapt
- required-before
- earliest-date
- minimum duration
- split only if splittable
- preferred window when feasible
- minimize churn
- preserve buffer where equally valid
- Could Not Fit valid

Planning Diff typed changes:
- keep
- add
- move
- shorten
- defer
- drop-occurrence
- mark-occurrence-done
- mark-occurrence-skipped

Could Not Fit is explanation, not mutation.

Final selected diff validates as a complete state.
Apply coherently/transactionally.
Persist inverse changes for Undo.

Recurring correctness:
- skip one occurrence → exception only
- move one occurrence → original exception + date-pinned replacement
- edit recurring template → explicit recurring edit only
- never use template status for one week’s occurrence

Tests:
- concrete-date fit
- manual/locked preservation
- released-manual behavior
- required-before
- min duration
- split semantics
- daily/weekly capacity
- stability/change cost
- Could Not Fit
- micro/day/week
- final combined validation
- Apply/Undo
- recurring occurrence behavior

Commit:
`feat(v2): add adaptive planning diffs and occurrence control`

Continue to G.

# 6. PHASE G — ADAPTIVE TODAY + FOCUS EVIDENCE

Evolve existing `TodayPage`.

Create pure/testable Today derivation engine accepting `now` explicitly.

Derive:
- current fixed
- current planned
- next
- earlier
- linked live Action
- linked Focus actual minutes
- elapsed unresolved occurrence
- gap length
- remaining planned work
- capacity/fragility
- Low/Normal/High daily capacity
- protected/locked state
- contextual candidates

Follow Plan:
- when reality still matches, stay quiet

Adaptation Needed:
- elapsed unresolved
- remaining plan infeasible
- explicit capacity change
- important new assessment/deadline
- Focus completion changes reality
- explicit rework request

Precedence:
Fixed
> locked/protected user intent
> canonical evidence/completion
> explicit user instruction
> deterministic urgency/capacity
> AI-assisted prioritization
> generic recommendation

Time passing:
- elapsed does not mean missed

Daily capacity:
- Low/Normal/High
- default Normal
- not inferred
- does not rewrite Planner capacity

Buffer:
- free gap may remain empty

UI hierarchy:
PRIMARY NOW
SECONDARY TODAY timeline
CONDITIONAL ADAPTATION
Natural Capture input
TERTIARY metrics/state

Focus propagation:
- pass all known context from Today/Study/Planner
- reuse duration/session evidence
- never infer Action done, mastery, or personal-study percentage from elapsed time

Tests:
- valid plan no adaptation
- fixed wins
- gap fit
- buffer preserved
- elapsed unresolved
- capacity boundary
- linked Focus reuse
- no second schedule

Commit:
`feat(v2): make Today an adaptive execution surface`

Continue to H.

# 7. PHASE H — KNOWLEDGE + ROUTINE INTELLIGENCE

Knowledge:
- preserve evidence-derived mastery, review separation, Obsidian authority
- add contextual “Generate Recall”
- AI only when explicitly invoked, provider available, permission allows
- no note bodies in generic AI facts
- selected linked note preview may be used only in explicit scoped action
- reuse existing `mastery_checks`
- generated questions do not change mastery
- completed/evaluated governed check can create Knowledge Evidence
- no vector DB/RAG build

Routine:
- deterministic pattern candidates
- no structural recommendation with <6 comparable expected opportunities
- direct bucket comparison requires >=4 comparable opportunities each bucket
- thresholds centralized/tested
- rest/skipped/pending semantics preserved
- structural changes require explicit recommendation + Mutation Registry
- no streaks/gamification

Tests:
Knowledge:
- AI off honest state
- generated questions no mastery change
- completed check explicit evidence path
- note-body permission boundary

Routine:
- below threshold no recommendation
- qualifying pattern
- comparison threshold
- rest/skipped/pending
- structural change approval

Commit:
`feat(v2): add contextual knowledge and routine intelligence`

Continue to I.

# 8. PHASE I — AI COACH CONTEXTUAL INTEGRATION

Keep provider abstraction and permissions.

AI Coach becomes deep reasoning, alternatives, cross-domain trade-offs, explanation.

Domain surfaces answer routine domain questions directly.

Extend recommendation source types while preserving existing values.

Use deterministic derived facts.
Never ask AI to recompute mastery, SGPA/CGPA, conflicts, capacity, or schedule validity.

Keep Money no-access by default.

Provider failure leaves deterministic PBOS operational.

Move existing AI Apply behavior onto shared Mutation Registry if not fully done.

Refine hierarchy toward:
- Ask / Explore
- Context
- Active Proposals
- Decision History

No AI-dashboard spectacle.

Commit:
`feat(v2): evolve ai coach into contextual reasoning layer`

Continue to J.

# 9. PHASE J — WEEKLY REVIEW + SCREEN REFINEMENT + VISUAL QA

Evolve Weekly Review so factual state is pre-populated.

Ask user mainly for:
- reflection
- corrections
- missing events
- decisions

Do not re-ask PBOS-owned facts.

Then perform visual refinement only after behavior is correct.

Use DESIGN.md, Agent Browser, existing PBOS components, Impeccable refinement vocabulary only.

Audit:
- Today
- Natural Capture
- Capture Inbox
- Planner
- Calendar
- Academics
- Course Detail
- Normal Study
- Knowledge Topic
- Routine Detail
- AI Coach
- Weekly Review

Desktop:
- 1440×900
- 1280×800 sanity

Check hierarchy, overflow, long data, empty/error/loading, keyboard, focus, reduced motion, axe, status semantics.

Do not create a new visual language.

Commit:
`feat(v2): complete review flow and v2 interface integration`

# 10. PHASE K — FULL REGRESSION / REPORT

Run from `app/`:
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Then:
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --release --manifest-path src-tauri/Cargo.toml`

If schema/behavior is stable:
- `npm run tauri:build`

Run WDIO/Tauri E2E if appropriate, reporting documented renderer limitation honestly.

Use fake provider/test doubles only.

Update `PBOS-V2-IMPLEMENTATION-REPORT.md` with:
- commits
- test counts
- schema state
- screen state
- visual QA
- unfinished work
- deferred decisions
- final HEAD
- working tree state

# 11. SAFE STOP CONDITIONS

Do not stop merely because:
- the project is large
- one phase is substantial
- one test fails
- provider unavailable
- UI needs refinement

Diagnose and continue.

If context/tool/time becomes limiting:
1. finish current coherent phase
2. run targeted regression
3. commit
4. update implementation report
5. leave working tree clean
6. explicitly name next phase and first module to inspect

Do not leave half migrations, broken store wiring, partial schedule Apply, failing build, or ambiguous uncommitted architecture.

Use `V2 PARTIAL — SAFE CHECKPOINT` only for genuinely unfinished scope.
Use `V2 IMPLEMENTATION PASS` only when the original acceptance set is verified.

# 12. FINAL REMINDER

Do not re-plan the product.

The product decisions are already locked.

Resume engineering now:

**C shared mutations → D Natural Capture → E Academics → F Adaptive Planning → G Adaptive Today → H Knowledge/Routine → I AI Coach → J Review/UI → K regression.**
