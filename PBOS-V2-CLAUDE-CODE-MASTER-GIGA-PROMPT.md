# PERFORMANCE BUDDY OS V2 — MASTER AUTONOMOUS IMPLEMENTATION PROMPT

You are the implementation engineer for **Performance Buddy OS (PBOS)**.

This is a large, unattended engineering run. The product owner will be away. Work autonomously and carefully. Do not ask for routine confirmations. Use the repository, tests, locked docs, and this prompt to resolve normal implementation questions.

Your job is not to generate a mock V2, not to merely write documentation, and not to “make the screens look AI.” Your job is to evolve the working V1 RC2 codebase into the **V2 adaptive-intelligence foundation and primary end-to-end user flows** while preserving every trustworthy V1 invariant.

---

# 0. ABSOLUTE WORKING RULES

Follow `CLAUDE.md` exactly.

For frontend/UI work, read and follow `DESIGN.md` before modifying UI.

Default loop:

**inspect → understand → implement → test → diagnose → fix → retest**

Do not stop at the first error. Do not hide failures. Do not claim DONE without evidence.

Do not ask the user to run something you can run.

Only report BLOCKED when the blocker genuinely requires:
- credentials/account authorization
- administrator/UAC action
- paid service access
- an irreversible product choice that cannot safely be inferred
- an external dependency defect with no supported alternative

For ordinary ambiguity, choose the **smallest safe implementation consistent with the locked blueprint**, record the assumption in the implementation report, and continue.

Do not:
- reset or discard user work
- force push
- rewrite V1 release history
- create “V1 Batch 11”
- create a second Planner/Calendar store
- create a second Action/task system
- create duplicate mastery truth
- create a generic AI database write API
- silently loosen CSP/security/credential handling
- hard-code design hex values in components
- install a new framework
- tool-shop instead of building
- rebuild all screens from scratch
- change the release tag/version simply because V2 work is underway

Do not push to remote unless the user has explicitly authorized it elsewhere. Local coherent commits are fine.

---

# 1. REPOSITORY / SOURCE-OF-TRUTH ORDER

At the beginning, verify that these files/folders exist.

Read in this order:

1. `CLAUDE.md`
2. `DESIGN.md`
3. `docs/27 - V2 Adaptive Coach/V2 Master Blueprint - 2026-09-01/00 - README - Blueprint Status and Next Step.md`
4. Passes 1–6 in that same folder
5. current V1 domain types/engines/stores/tests relevant to the work
6. older `docs/27 - V2 Adaptive Coach/` documents only as supporting references

For V2 product behavior, the newly extracted `V2 Master Blueprint - 2026-09-01` folder supersedes older V2 notes when they conflict.

For visual language, `DESIGN.md` remains canonical.

For canonical persisted data, the running relational domain model and migration architecture remain authoritative unless this prompt explicitly adds a V2 field/table.

Before implementation, create this additional repo document if it is not already present:

`docs/27 - V2 Adaptive Coach/V2 Master Blueprint - 2026-09-01/07 - Consolidated V2 Master Blueprint.md`

Populate it with the consolidated architecture in **Section 4 through Section 19 of this prompt**. Do not re-interpret or expand scope while writing it.

---

# 2. BASELINE AND GIT SAFETY

Before editing code:

1. Run:
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse HEAD`
   - `git log -5 --oneline`

2. Preserve all existing/untracked user files, including the newly extracted V2 blueprint docs.

3. If the working tree is safe for a branch and you are on `main`, create:
   `v2/adaptive-intelligence-foundation`

   If branch creation would risk user work, stay on the current branch and document why. Never discard work merely to create a branch.

4. Record baseline results before changes:
   from `app/`
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - `npm run test:e2e`

   and:
   - `cargo test --manifest-path src-tauri/Cargo.toml`

If a baseline test already fails, diagnose it and record it separately. Do not silently attribute a pre-existing failure to V2.

Do not launch a native packaged app against the user's durable SQLite until the V2 migration is finalized. Browser/dev tests and Rust in-memory tests are preferred during schema iteration.

---

# 3. V2 PRODUCT MISSION

The central V2 success statement is:

> **I use PBOS more, but I operate PBOS less.**

Canonical operating loop:

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

The daily product flow should become:

**PBOS prepares → user lives → user captures reality once → PBOS structures it → PBOS adapts → user approves meaningful changes.**

Permanent semantic laws:

- ACTION ≠ PLANNING BLOCK ≠ COMPLETION.
- ACTIVITY ≠ OUTCOME ≠ MASTERY.
- PROFESSOR COVERAGE ≠ PERSONAL STUDY ≠ MASTERY.
- UNKNOWN ≠ ZERO.
- CORRELATION ≠ CAUSATION.
- AI SUGGESTION ≠ TRUTH.
- AI proposes.
- Deterministic rules validate.
- The user decides.
- Canonical domain systems apply.
- SQLite remains authoritative.

---

# 4. CONSOLIDATED V2 ARCHITECTURE — LOCK THIS BEFORE CODE

Implement exactly these semantic families.

## 4.1 Capture Proposal

Meaning:

> “PBOS thinks this is what the user told it happened.”

A Capture Proposal is tied to raw user input.

Persist Capture Proposal classes:
- `fact`
- `interpretation`

Do **not** store a system-generated recommendation as an applied Capture fact.

If Natural Capture reasoning goes beyond “what the user said” and proposes “what the user should do”, create a separate **Intelligence Recommendation**.

## 4.2 Intelligence Recommendation

Meaning:

> “PBOS thinks this change may help.”

Use/extend the existing durable Recommendation + DecisionEvent architecture.

It remains:
proposal → Accept/Modify/Reject → deterministic validation → allowlisted Apply.

## 4.3 Planning Diff

Meaning:

> “This is how the canonical plan would change.”

A Planning Diff is separate from an AI Recommendation and separate from Capture.

It contains typed schedule changes and inverse information.

It must support:
- review
- selective acceptance/modification where valid
- final whole-state validation
- Apply
- practical Undo

These three families may reuse shared UI primitives, but do not collapse them into one generic AI card/model.

---

# 5. SHARED EXPLICIT MUTATION ENGINE

The current repo already has allowlisted AI Apply adapters and V1 Quick Capture delegates directly to domain stores.

Consolidate these safely.

Create a shared explicit mutation layer, preferably under something like:

`app/src/domains/mutations/`

Use repository naming conventions after inspection.

The shared engine should expose an explicit `MutationKind` registry where every mutation has:

- kind
- domain
- deterministic `validate`
- entity resolution if needed
- `describeCurrent`
- `preview`
- `apply`
- optional `triggersReplan`
- canonical revision/audit behavior

Unknown mutation kind must be rejected.

There must be NO generic:
- `applyPatch`
- `writeTable`
- arbitrary model-provided Tauri command
- raw SQL selected by AI
- “update any entity” adapter

Migrate/reuse existing `intelligence/applyAdapters.ts` behavior through this registry instead of maintaining two diverging apply systems.

The registry should initially cover existing V1 recommendation mutations plus the V2 mutations required by implemented flows.

Minimum required kinds:

- `create-action`
- `create-expense`
- `routine-checkin`
- `set-professor-coverage`
- `set-personal-study`
- `create-assessment`
- `update-assessment-date`
- `update-assessment-scope`
- `create-language-session`
- `set-today-capacity`
- `schedule-block`
- `set-knowledge-review`
- `adjust-routine-cadence`
- `adjust-routine-window`
- `adjust-routine-duration`
- `adjust-routine-days`

Do not add a mutation kind unless it maps to a real canonical domain operation with deterministic validation.

Create focused tests for every mutation kind you add.

---

# 6. DATABASE MIGRATION — SCHEMA V11

Current schema is v10. Add one forward-only **v11** migration after fully designing it.

Do not rewrite migrations 1–10.

Migration v11 must be non-destructive and preserve existing user data.

Implement these additions unless inspection proves an equivalent canonical table already exists.

## 6.1 `academic_assessment_topics`

Explicit Assessment ↔ Academic Topic scope.

Columns:

- `assessment_id TEXT NOT NULL REFERENCES academic_assessments(id) ON DELETE CASCADE`
- `topic_id TEXT NOT NULL REFERENCES academic_topics(id) ON DELETE CASCADE`
- `source TEXT NOT NULL DEFAULT 'user'`
- `created_at TEXT NOT NULL`
- `PRIMARY KEY (assessment_id, topic_id)`

Add useful indexes.

TS/Rust validation must reject a topic that belongs to a different course from the assessment.

Do not infer scope merely because a topic exists in the course.

## 6.2 `capture_proposals`

One Capture Inbox row may own many reviewable proposals.

Columns:

- `id TEXT PRIMARY KEY NOT NULL`
- `capture_id TEXT NOT NULL REFERENCES capture_inbox(id) ON DELETE CASCADE`
- `proposal_class TEXT NOT NULL` (`fact` | `interpretation`)
- `domain TEXT NOT NULL`
- `mutation_kind TEXT NOT NULL`
- `title TEXT NOT NULL`
- `source_text TEXT NOT NULL DEFAULT ''`
- `confidence TEXT NOT NULL DEFAULT 'needs-review'`
- `ambiguity_reason TEXT`
- `rationale TEXT NOT NULL DEFAULT ''`
- `evidence_json TEXT NOT NULL DEFAULT '[]'`
- `original_params_json TEXT NOT NULL DEFAULT '{}'`
- `effective_params_json TEXT NOT NULL DEFAULT '{}'`
- `status TEXT NOT NULL DEFAULT 'proposed'`
- `validation_json TEXT`
- `applied_result_json TEXT`
- `created_at TEXT NOT NULL`
- `decided_at TEXT`
- `applied_at TEXT`

Allowed confidence labels:
- `clear`
- `needs-review`
- `ambiguous`

Allowed status:
- `proposed`
- `accepted`
- `modified`
- `rejected`
- `applied`
- `apply-failed`

Keep existing `capture_inbox` fields for compatibility. Do not drop V1 `proposed_type` / `parsed_payload`.

Write a backward-compatible/idempotent repository path for existing capture rows. Existing unresolved V1 captures must not disappear.

## 6.3 `action_scheduling_constraints`

Structured scheduling constraints attach to canonical Actions instead of creating another task list.

Columns:

- `action_id TEXT PRIMARY KEY NOT NULL REFERENCES actions(id) ON DELETE CASCADE`
- `required_before TEXT`
- `earliest_date TEXT`
- `preferred_time_window TEXT`
- `minimum_block_minutes INTEGER`
- `splittable INTEGER NOT NULL DEFAULT 0`
- `source TEXT NOT NULL DEFAULT 'user'`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Allowed preferred windows:
- morning
- day
- evening
- anytime

`Action.estMinutes` remains the total estimate. Do not duplicate estimate here.

Default `splittable = false` so the system never assumes work can be fragmented.

## 6.4 `planning_occurrence_exceptions`

A recurring weekly PlanningBlock must not be destroyed just because one occurrence changes.

Columns:

- `id TEXT PRIMARY KEY NOT NULL`
- `block_id TEXT NOT NULL REFERENCES planning_blocks(id) ON DELETE CASCADE`
- `occurrence_date TEXT NOT NULL`
- `state TEXT NOT NULL`
- `replacement_block_id TEXT REFERENCES planning_blocks(id) ON DELETE SET NULL`
- `source TEXT NOT NULL DEFAULT 'user'`
- `note TEXT NOT NULL DEFAULT ''`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `UNIQUE(block_id, occurrence_date)`

Allowed state:
- skipped
- done
- deferred

This table is an exception layer, NOT another Planner/Calendar database.

For a one-off move/defer of a recurring block:
- persist an exception for the original occurrence
- create a concrete date-pinned replacement block when applicable
- never rewrite the recurring template unless user explicitly edits the recurring template

## 6.5 `planning_change_sets`

Durable Planning Diff/audit/undo unit.

Columns:

- `id TEXT PRIMARY KEY NOT NULL`
- `scope TEXT NOT NULL`
- `status TEXT NOT NULL`
- `target_start_date TEXT`
- `target_end_date TEXT`
- `rationale TEXT NOT NULL DEFAULT ''`
- `reason_codes_json TEXT NOT NULL DEFAULT '[]'`
- `changes_json TEXT NOT NULL DEFAULT '[]'`
- `inverse_changes_json TEXT NOT NULL DEFAULT '[]'`
- `source TEXT NOT NULL DEFAULT 'adaptive-planning'`
- `created_at TEXT NOT NULL`
- `decided_at TEXT`
- `applied_at TEXT`
- `undone_at TEXT`

Allowed scope:
- micro
- day
- week

Allowed status:
- proposed
- applied
- rejected
- apply-failed
- undone

`changes_json` must be typed/validated at the TS boundary even if Rust stores opaque JSON.

Do not store another full canonical schedule in this table. Store only the proposed changes + inverse changes required to review/undo.

## 6.6 `today_operating_state`

Persist ONLY subjective daily operating capacity.

Columns:

- `date TEXT PRIMARY KEY NOT NULL`
- `capacity_level TEXT NOT NULL DEFAULT 'normal'`
- `source TEXT NOT NULL DEFAULT 'user'`
- `note TEXT NOT NULL DEFAULT ''`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Allowed capacity:
- low
- normal
- high

Allowed source:
- user
- capture-approved

Do not persist:
- current block
- next block
- gaps
- overload
- fragility
- “what to do now”

Those are derived.

## 6.7 Migration tests

Add Rust tests that prove:

- v10 DB migrates to v11
- migration is idempotent
- old rows remain
- FK delete/update behavior is correct
- same-course assessment-scope validator works
- capture proposal rows round-trip
- occurrence exception survives close/reopen
- planning change set survives close/reopen
- today capacity survives close/reopen
- exact schema version becomes 11

Do not run a packaged/native app against the user's durable DB until this migration is final and tests pass.

---

# 7. NATURAL CAPTURE — EVOLVE THE EXISTING CAPTURE DOMAIN

Important repo fact:

`app/src/domains/capture/` already contains a durable Quick Capture inbox with the correct “raw input owns nothing downstream” philosophy.

Evolve this. Do NOT create `natural-capture-v2` as a parallel store.

## 7.1 Flow

Implement:

raw text saved locally FIRST
→ deterministic local segmentation/classification
→ permission filtering
→ optional remote provider enhancement
→ entity resolution
→ duplicate/evidence resolution
→ multi-proposal bundle
→ user Accept/Modify/Reject
→ shared Mutation Engine validation
→ canonical Apply
→ revision/audit
→ optional separate Intelligence Recommendation(s)

## 7.2 Parser / proposal shape

A single capture may produce multiple `CaptureProposal`s.

Each proposal should visibly distinguish:

- **You said** = fact
- **PBOS interpreted** = interpretation

Do not store “PBOS recommends” as a Capture Proposal. Create an Intelligence Recommendation for that.

No fake numeric confidence.

## 7.3 Entity resolution

Resolve existing first.

Examples:
- “DSA” should resolve an existing Data Structures course if unambiguous.
- “German” should resolve an existing language path if unambiguous.
- routine text should match existing routine.

If ambiguous:
- surface selection
- do not guess

New canonical entity creation must be explicit/reviewable.

## 7.4 Duplicate evidence

If PBOS already recorded a matching Focus/session event and user says approximately the same thing, detect it.

Canonical PBOS event outranks approximate text.

Offer:
- reuse existing evidence
- record separately

Do not double-log by default.

## 7.5 Multi-domain examples to support

At minimum the architecture/tests should support combinations of:

- academic professor coverage
- assessment/date/scope
- personal study interpretation
- expense
- language session
- routine check-in
- Action/planning intent

Do not force every possible sentence into a mutation. Unclassifiable text remains safely in Capture Inbox.

## 7.6 Privacy / permission rule

This is non-negotiable.

Do NOT send a whole mixed capture to a remote provider when it may include a no-access domain.

Use local deterministic segmentation/classification first.

Only send a segment for remote enhancement if:
- a domain can be identified locally with sufficient safety
- that domain has at least Read permission

If a segment is unclassified or could contain no-access data:
- keep it local
- mark it for review/manual classification

Money remains `no-access` by default unless the user explicitly changes permission.

Do not put secrets into logs/tests/screenshots.

## 7.7 Provider failure

If remote parsing fails:
- raw capture remains durable
- deterministic proposals remain usable
- unparsed segments stay unprocessed
- user can retry
- user can manually classify

No data loss.

## 7.8 Natural Capture UI

Do not add Natural Capture as a major sidebar nav item.

Create a global, accessible drawer/overlay usable from:
- Today
- Command Palette
- keyboard shortcut
- contextual Capture update buttons

Keep `/capture-inbox` as the durable unresolved/history route and evolve its UI.

The drawer must support:
- idle
- typing
- parsing
- proposal ready
- clarification/ambiguity
- editing proposal
- validation error
- applying
- applied
- provider unavailable
- offline/local saved
- duplicate detected
- permission limited
- no meaningful structure

Avoid chatbot bubbles, AI orb graphics, neon/purple/cyan “AI” styling.

---

# 8. EVIDENCE PROPAGATION / FOCUS

Inspect `focus` types/store/repo before changes.

Preserve the existing links from Focus Session to:
- Action
- PlanningBlock
- Course
- Academic Topic
- Knowledge Topic

When Focus is started from Today/Study/Planner, pass all known context.

On completion:

- Focus duration is canonical activity evidence.
- Do not ask the user to re-enter duration.
- Do not mark an Action complete solely because Focus ended.
- Do not increase Knowledge mastery solely because time elapsed.
- Do not automatically increase Personal Study percentage from minutes alone.
- Today should derive planned-vs-actual from linked Focus sessions.
- A linked recurring Planning occurrence may be separately resolved by occurrence state, not by mutating the recurring template.

Post-study UI should ask only missing human truth:
- outcome/understanding if needed
- personal coverage update if desired
- mastery/recall check now/later

Do not create a duplicate activity table.

---

# 9. ASSESSMENT SCOPE + ACADEMIC INTELLIGENCE

Extend the current Academics domain rather than replacing it.

## 9.1 Assessment Scope

Update:
- types
- repo
- Rust commands
- store
- Course Detail / Assessment form UI
- tests

Add store APIs such as:
- getTopicsForAssessment
- setAssessmentScope / updateAssessmentScope
- assessment scope resolution

Scope editor must only allow topics in the same course.

Natural Capture may propose scope links.

Unknown scope remains unknown.

## 9.2 Academic study engine

Preserve current reason-code philosophy.

Add factual reason signals such as:
- assessment upcoming
- explicitly in nearest relevant assessment scope
- higher assessment weight as a tie-breaker/context
- professor-covered-not-studied
- weak Knowledge evidence
- no evidence
- review due
- repeated unresolved weakness
- recently studied

Do NOT create a universal `priorityScore: 87`.

Rank with inspectable deterministic comparators.

Use actual assessment dates directly rather than arbitrary hidden urgency weights.

Suggested ordering behavior:

### Normal
- due review / keeping pace
- nearest scoped assessment risk
- professor covered but not studied
- weak/no evidence
- in-progress/not-started

### Midterm/Final
- topics explicitly in the relevant upcoming assessment scope and unresolved
- then other taught weak/review items
- never assume all topics are in scope
- never assume a final is cumulative without scope data

### Recovery
- smallest useful restart among weak/covered/no-evidence items
- no backlog punishment

Where multiple options are similarly justified, expose alternatives rather than fake certainty.

## 9.3 Study Requirement

Create a transient typed `StudyRequirement` / `PlanningCandidate`, not another persisted task table.

It may contain:
- course/topic
- reasons
- requiredBefore
- estimate/suggested duration
- minimum block duration
- evidence state
- linked existing Action if found

If the user chooses “Plan this”:
- reuse an existing Action if appropriate
- otherwise propose/create a canonical Action
- attach Action scheduling constraints when needed
- send the candidate to deterministic Planning

Academic Intelligence must never write arbitrary timestamps.

## 9.4 Course-level attention

Derive attention states without mutating `Course.status`:

Immediate:
- upcoming assessment AND relevant unresolved prep signal

Watch:
- meaningful coverage/evidence/review gap but no immediate assessed pressure

Stable:
- no material current attention signal

Expose reasons.

## 9.5 Grades

Do not alter the strict academic arithmetic boundary.

- no AI SGPA/CGPA arithmetic authority
- no score→letter inference without verified policy
- no guessed repeat-course replacement
- incomplete weighting configuration limits conclusions

---

# 10. ADAPTIVE PLANNING

Keep the current Planning store as the ONE scheduled-block truth.

Do not add another CalendarEvent list.

## 10.1 Concrete-date adaptive engine

Keep existing deterministic conflict/capacity functions.

Add a V2 concrete-date candidate placement engine that works over a real ISO-date horizon.

Inputs:
- canonical blocks resolved per date
- occurrence exceptions
- capacity
- fixed/locked/manual protected blocks
- candidate constraints
- existing generated flexible blocks
- planning scope (micro/day/week)

One-off generated adaptive work should generally be date-pinned (`date != null`), not accidentally recurring weekly.

## 10.2 PlanningCandidate

Use a transient type such as:

- id
- sourceDomain
- sourceEntityType/id
- actionId nullable
- title
- context
- estMinutes
- requiredBefore
- earliestDate
- preferredTimeWindow
- minimumBlockMinutes
- splittable
- reasonCodes
- priority

Do not persist a generic WorkCandidate table.

Persistent user scheduling constraints belong on canonical Action through `action_scheduling_constraints`.

## 10.3 Placement rules

Deterministic rules:

1. no overlap
2. daily capacity must hold
3. weekly capacity must hold
4. fixed blocks are not moved by adaptive generation
5. locked blocks survive
6. manual blocks survive by default
7. only explicitly released manual flexible blocks are eligible for movement
8. generated flexible blocks are safest to reconsider
9. respect required-before
10. respect earliest date
11. honor minimum useful duration
12. split only when `splittable=true`
13. honor preferred time window when feasible
14. minimize plan churn
15. among equally valid plans, prefer healthier buffer/less fragility
16. Could Not Fit remains a valid result

Do not invent a hidden productivity score.

Use stable deterministic tie-breakers and test them.

## 10.4 Change cost

Do not move an existing valid block just because another equivalent slot exists.

Prefer stability.

## 10.5 Adaptation scopes

- micro = one block/gap/problem
- day = one date
- week = broad rebalance

Use smallest scope that resolves the issue.

## 10.6 Planning Diff

Create typed changes such as:

- keep
- add
- move
- shorten
- defer
- drop-occurrence
- mark-occurrence-done
- mark-occurrence-skipped

`Could Not Fit` is explanatory output, not a mutation.

Diff UI shows:
- What changed
- Why
- Protected items
- Could Not Fit items
- What accepting will do

User can select/modify when safe.

Then:
- build final candidate schedule
- validate all selected changes together
- only then Apply

Apply must be atomic enough that PBOS does not present a partially applied diff as success. Use a Rust transaction where multiple persisted schedule operations must succeed together, or implement an equivalent repository transaction command.

Persist inverse changes for practical Undo.

## 10.7 Recurring occurrence semantics

Do NOT use a recurring `PlanningBlock.status` to represent one week's completion.

Use `planning_occurrence_exceptions`.

Examples:

Skip this Tuesday only:
- create occurrence exception
- recurring template remains

Move this Tuesday only:
- defer/skip original occurrence exception
- create date-pinned replacement block
- link replacement in exception

Edit every Tuesday:
- user explicitly edits recurring template

Add tests for all three.

---

# 11. ADAPTIVE TODAY

Evolve existing `TodayPage.tsx`, do not replace Today with another dashboard.

Create a deterministic `todayEngine.ts` (or equivalent) that is pure/testable and accepts `now` explicitly.

Derive:

- current fixed commitment
- current planned block
- next planned block
- earlier blocks
- linked Action live state
- actual Focus minutes linked to planning block
- elapsed unresolved occurrences
- free gap
- remaining planned minutes
- day/weekly capacity state
- fragility/overload
- daily Low/Normal/High capacity
- protected/locked state
- relevant academic/knowledge/routine attention candidates

## 11.1 Follow Plan vs Adaptation Needed

FOLLOW PLAN when current intent remains valid.

Do not generate constant AI noise.

ADAPTATION NEEDED only for material divergence, e.g.:

- a block elapsed unresolved
- fixed commitment shifted/appeared through approved capture
- remaining plan cannot fit
- user capacity explicitly changed
- new assessment/deadline materially changes priorities
- Focus completion changes remaining work
- user explicitly asks to rework today

## 11.2 Precedence

Fixed commitment
> locked/protected user intent
> canonical completion/evidence
> explicit user instruction
> deterministic urgency/capacity
> AI-assisted prioritization
> generic recommendation

## 11.3 Time passing

Passing the block end time does NOT equal missed.

Derived occurrence states should include conceptually:
- planned
- active
- completed/done
- elapsed-unresolved
- skipped
- deferred

Unknown stays unknown.

## 11.4 Buffer

Do not automatically fill free time.

A valid Today answer may be:
“No urgent work needs this gap; keep the buffer.”

## 11.5 Daily capacity

Persist only:
- Low
- Normal
- High

Default Normal.

Never infer Low from clock time alone.

Natural Capture may propose Low/High from an explicit statement, but user confirms.

Do not rewrite persistent Planner capacity.

## 11.6 Today UI hierarchy

Follow DESIGN.md and preserve Primary → Secondary → Tertiary.

Primary:
### NOW
- exact current/best action
- duration/context
- Start/Continue Focus
- short reason only if adaptive

Secondary:
### TODAY
- earlier / now / next / later
- planned vs actual

Conditional:
### ADAPTATION
only when meaningful
- changed facts
- diff summary
- Review changes

Input:
### NATURAL CAPTURE
compact entry

Tertiary:
small metrics/state strip

Do not regress to equal stat cards.

---

# 12. KNOWLEDGE INTELLIGENCE

Preserve:
- mastery computed from Knowledge Evidence
- review date separate from mastery
- Obsidian note-body ownership

## 12.1 Generate Recall

Add a contextual Knowledge action:
“Generate Recall”

Use the existing AI provider only when:
- AI is enabled/available
- Knowledge has appropriate permission
- user explicitly invokes it

Generic AI context must NOT contain Obsidian note bodies.

If user selects a linked Obsidian note/source for this action, an on-demand preview may be included in this scoped request. Do not persist the preview as another note body.

Generate structured recall/practice items.

Reuse existing `mastery_checks` for the governed session instead of creating a permanent AI question bank table.

AI-generated questions alone do NOT create Knowledge Evidence or change mastery.

Only after the user completes/evaluates a governed check may the existing explicit evidence path create Knowledge Evidence.

Tests must prove this.

## 12.2 Contextual Knowledge intelligence

Surface:
- evidence gap
- review due
- method suggestion
- source suggestion

Keep AI explanation compact and evidence-based.

No vector database / heavy RAG system in this run.

---

# 13. ROUTINE INTELLIGENCE

Keep current schedule-aware streak-free consistency.

Create deterministic pattern candidate logic.

Conservative minimum evidence:

- no structural pattern recommendation with fewer than **6 comparable expected opportunities**
- direct bucket comparison (e.g. morning vs evening) requires at least **4 comparable opportunities in each bucket**

Keep these thresholds in one obvious constant/config module and cover them with tests.

Potential deterministic pattern facts:

- repeated missed/partial cluster in a time window
- consistent underperformance on specific scheduled days
- cadence appears too aggressive
- duration target repeatedly only partially completed

Remember:
- rest is excused
- skipped is excused
- pending today is not missed
- schedule passage is not completion

AI may explain a pattern and propose:
- cadence
- time window
- duration
- scheduled days
- pause

Every structural change requires:
Accept / Modify / Reject
and goes through explicit mutation validation.

No streaks, XP, badges or moral scoring.

---

# 14. AI COACH + CONTEXTUAL INTELLIGENCE

Keep the current provider abstraction and permission model.

AI Coach V2 role:

> deep reasoning / exploration / alternatives / cross-domain trade-offs

Do not make the user open AI Coach for ordinary domain intelligence.

Examples:

Academics should answer:
“What should I study next?”

Today should answer:
“What should I do now?”

Planner should answer:
“Where can this fit?”

Knowledge should answer:
“What needs review/evidence?”

Routine should answer:
“What pattern may need adjustment?”

AI Coach is for:
“Why?”
“Compare alternatives.”
“What happens if I protect X?”
“Rebalance with these constraints.”

## 14.1 Recommendation sources

Extend TypeScript source union as needed while preserving compatibility.

Reasonable new sources:
- contextual
- capture
- adaptive-today
- academic
- knowledge
- routine
- planning

Existing source values stay valid.

## 14.2 AI context

Feed AI deterministic derived facts where possible.

Good:
`AVL: evidence state learning; review due`

Bad:
send all raw evidence and ask the model to calculate mastery.

Good:
`Wednesday: 50 usable minutes before fixed class`

Bad:
ask model to calculate calendar overlap.

Do not put raw note bodies or unnecessary sensitive data in generic `domainFacts`.

## 14.3 Permissions

Maintain:
- no-access
- read
- read-recommend

Context is:
requested domains INTERSECT permitted domains.

Money remains no-access by default.

Do not broaden permission defaults merely to make Capture/AI work.

## 14.4 Provider failure

When provider unavailable:
- Today deterministic engine works
- Planning deterministic engine works
- Academics study engine works
- Knowledge evidence/review works
- Routine consistency/pattern facts work
- Natural Capture raw text persists and deterministic parsing works

Never make AI provider availability a core app availability condition.

---

# 15. SCREEN IMPACT / UI WORK

Do not rebuild every screen.

## Major evolution

- `TodayPage`
- `CaptureInboxPage`
- `PlannerPage`
- `AcademicsOverviewPage`
- `CourseDetailPage`
- `NormalStudyPage`
- `Knowledge/TopicDetailPage`
- `AICoachPage`
- `WeeklyReviewPage`

## Moderate evolution

- `CalendarWeekPage`
- `MasteryCheckPage`
- `KnowledgeOverviewPage`
- `NotesHubPage`
- `RoutinesOverviewPage`
- `RoutineDetailPage`
- `AICoachWorkspacePage`
- `AICoachPermissionsPage`
- `FocusPage`
- `AnalyticsOverviewPage`
- `PatternsPage`
- `SettingsPage`
- Command Palette/search surfaces

## Minor contextual integration

- Goals / Goal Detail
- Development
- Fitness
- Reading & Language
- Money
- Daily Routine Check-In
- SGPA/CGPA
- builder forms except Assessment scope changes
- Onboarding only if existing AI setup needs a tiny V2 text/permission adjustment

## Keep

Splash/startup behavior unless a real implementation requirement appears.

## 15.1 Reusable primitives

Search existing PBOS components first.

Add only if needed:

- `NaturalCaptureDrawer`
- `CaptureProposalBundle`
- `CaptureProposalItem`
- `ProposalOriginLabel`
- `ReasonList`
- `PlanningDiffReview`
- `PlanningDiffRow`
- `AdaptiveNowSurface`
- `ContextualInsight`
- `AttentionSignal`
- `ConfidenceLabel`
- `ChangePreview`

Use existing `Button`, `Card`, `Badge`, forms, dialogs/drawers, icons, etc. wherever possible.

External components:
existing PBOS → 21st.dev → Magic UI → Vengeance UI → UILora → DevUI

Only borrow interaction behavior when PBOS lacks it.
Remap to PBOS tokens.
Strip decorative effects/dependencies.
Do not redesign identity.

Use Agent Browser for interactive visual QA.
Use Impeccable only as refinement/audit vocabulary within DESIGN.md.

## 15.2 Visual locks

- matte black / graphite / gunmetal
- restrained steel blue-grey
- calm / engineered / premium
- primary-secondary-tertiary hierarchy
- fewer equal cards
- state glow only
- no gaming
- no cyberpunk
- no RGB
- no purple/cyan “AI”
- no giant AI orb
- no glass-everywhere
- no generic AI-dashboard aesthetic
- no raw hex values in components
- preserve reduced motion
- keyboard/focus accessible
- status never color-only

---

# 16. TESTING — DO NOT LEAVE THIS UNTIL THE VERY END

Test each phase as you complete it.

## 16.1 Natural Capture

Unit/component tests:

- one raw input → multiple proposals
- fact vs interpretation
- recommendation separated into AI Recommendation
- unknown field remains unknown
- ambiguous entity needs selection
- existing entity resolves without duplicate
- existing Focus/session evidence detected as possible duplicate
- selective Accept/Modify/Reject
- final selected bundle validation
- provider failure preserves raw capture
- no-access domain segment is not sent remotely
- unclassified segment remains local
- existing V1 capture row still loads

## 16.2 Academic

- same-course assessment scope allowed
- cross-course scope rejected
- unknown scope not guessed
- scoped weak topic receives explainable priority over irrelevant topic
- exam/final mode does not invent scope
- grade math unchanged
- repeated unresolved weakness creates method-change reason, not fake mastery change

## 16.3 Planning

- concrete date placement
- locked block preserved
- manual block preserved by default
- released manual block can be considered
- generated block can be reconsidered
- required-before enforced
- minimum duration enforced
- unsplittable task not fragmented
- splittable task can fragment only when explicitly true
- daily/weekly capacity enforced
- Could Not Fit reason
- stability/change-cost tie-breaker
- micro/day/week scope
- final selected diff validates together
- diff Apply and Undo
- recurring skip one occurrence does not alter template
- recurring defer creates replacement + exception
- edit recurring template remains explicit separate operation

## 16.4 Today

- valid plan → no unnecessary adaptation
- current fixed commitment wins
- current planned block shown when valid
- free-gap candidate fits
- buffer can remain empty intentionally
- elapsed without evidence → unresolved, not missed
- daily capacity defaults Normal and is never inferred
- Low capacity changes recommendation but not persistent Planner capacity
- linked Focus evidence appears without duplicate logging
- Today does not create second schedule

## 16.5 Knowledge

- Generate Recall with AI off has honest unavailable state
- generated questions alone leave mastery unchanged
- completed governed mastery check can create evidence through explicit action
- generic AI context never includes note bodies
- selected note preview is only sent for explicit permitted request

## 16.6 Routine

- fewer than 6 opportunities → no structural pattern recommendation
- qualifying data → explainable pattern
- comparison requires 4 per bucket
- rest/skipped excluded correctly
- pending today not missed
- structural change requires approved mutation

## 16.7 Shared mutation registry

- unknown kind rejected
- invalid params rejected
- permission/authority respected
- current/after preview correct
- canonical store method called
- revision event created where required
- no generic mutation entry point exists

## 16.8 Rust / Tauri boundary

For every new/changed Tauri command:
- add Rust unit test
- add TS repo test
- add exact IPC payload mock test where relevant

Remember the RC1 lesson:
TypeScript field names and Rust serde names are a real contract.

Explicitly test exact frontend JSON for every new wire shape.

Add at least one real SQLite close/reopen persistence test for each new persisted slice.

## 16.9 E2E

Create/update Playwright flows for at least:

1. Natural Capture mixed-domain text → proposal bundle → selective apply → reload
2. assessment scope → academic study recommendation
3. Adaptive Planning diff → apply → reload
4. recurring occurrence defer/skip → recurring template survives
5. Today follow-plan path
6. Today adaptation-needed path
7. AI provider unavailable → deterministic fallback
8. permissions keep disallowed domain out of AI context
9. Knowledge Generate Recall → explicit evidence path
10. Routine pattern → proposal → approved structure change

Use fake provider/deterministic fixtures for tests; never require a live paid AI service.

Run axe on materially changed major screens.

---

# 17. UI / VISUAL QA

After functional tests pass for major screens:

Use the existing dev build and Agent Browser.

Audit at minimum:
- Today
- Natural Capture drawer
- Capture Inbox
- Planner
- Calendar
- Academics Overview
- Course Detail
- Normal Study
- Knowledge Topic Detail
- Routine Detail
- AI Coach
- Weekly Review

Primary desktop viewport:
**1440×900**

Also sanity-check a smaller desktop window such as:
**1280×800**

This is a desktop app. Do not spend the session creating mobile redesigns.

Check:
- one obvious primary focus
- no equal-card regression
- copy is calm and precise
- no UI clipping/overflow
- long titles/data
- empty states
- loading/error states
- keyboard behavior
- focus visibility
- reduced motion
- accessible contrast
- AI proposal styling does not imply authority

Use Impeccable critique/layout/quieter/distill/polish/harden only after the product behavior is correct.

---

# 18. IMPLEMENTATION PHASE ORDER

Work in this order. Test after each phase.

## PHASE A — Baseline + docs

- inspect repo/status
- baseline tests
- write `07 - Consolidated V2 Master Blueprint.md`
- if safe, locally commit the newly extracted blueprint docs + consolidation

Suggested commit:
`docs(v2): lock consolidated master blueprint`

## PHASE B — Schema v11 + persistence/wire contracts

Implement migration/tables/repos/Rust commands/types/tests first.

No UI dependency should be necessary to prove persistence.

Suggested commit:
`feat(v2): add adaptive intelligence persistence foundation`

## PHASE C — Shared mutation engine

Refactor existing AI Apply adapters and Capture destinations onto explicit shared mutation registry without regressing V1 behavior.

Suggested commit:
`refactor(v2): unify validated canonical mutation adapters`

## PHASE D — Natural Capture V2

Evolve existing capture domain:
multi-proposal, ambiguity, duplicate resolution, permissions, optional provider enhancement, drawer, inbox.

Suggested commit:
`feat(v2): evolve quick capture into natural capture`

## PHASE E — Assessment Scope + Academic Intelligence

Schema/store/UI + study reason engine + planning candidate output.

Suggested commit:
`feat(v2): add assessment scope and academic attention intelligence`

## PHASE F — Adaptive Planning

Concrete-date candidate placement, constraints, occurrence exceptions, Planning Diff, Apply/Undo.

Suggested commit:
`feat(v2): add adaptive planning diffs and occurrence control`

## PHASE G — Adaptive Today + Focus evidence propagation

Pure Today engine + daily capacity + follow-plan/adapt UI + links to Planning Diff and Natural Capture.

Suggested commit:
`feat(v2): make Today an adaptive execution surface`

## PHASE H — Knowledge + Routine contextual intelligence

Generate Recall, governed mastery path, routine pattern engine/recommendations.

Suggested commit:
`feat(v2): add contextual knowledge and routine intelligence`

## PHASE I — AI Coach contextual integration

Use shared mutations, contextual recommendation sources, deep-reasoning role, permissions/fallback.

Suggested commit:
`feat(v2): evolve ai coach into contextual reasoning layer`

## PHASE J — Reviews / screen refinement / visual QA

Evolve Weekly Review to prepopulate factual state and surface only meaningful reflection/corrections/recommendations.

Polish major V2 screens within DESIGN.md.

Suggested commit:
`feat(v2): complete review flow and v2 interface integration`

## PHASE K — Full regression

Run all required tests/checks and fix failures.

Do not stop with “mostly passing.”

---

# 19. REQUIRED COMMANDS BEFORE FINAL REPORT

From `app/`:

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Then:

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --release --manifest-path src-tauri/Cargo.toml`

If those pass and migration v11 is finalized:

- `npm run tauri:build`

Native E2E:
- run `npm run test:e2e:tauri` if appropriate
- respect the known WDIO/Tauri renderer limitation documented in `CLAUDE.md`
- do not call that limitation a V2 product failure
- report the exact result

Do not use a live remote AI provider as acceptance evidence. Use fake provider/test doubles.

---

# 20. IMPLEMENTATION REPORT

Before ending, create at repo root:

`PBOS-V2-IMPLEMENTATION-REPORT.md`

It must include:

## Starting state
- starting commit
- branch
- baseline test results
- pre-existing failures if any

## Architecture delivered
- schema v11
- mutation registry
- Capture Proposal
- Intelligence Recommendation changes
- Planning Diff
- assessment scope
- Today engine
- Adaptive Planning
- Academic Intelligence
- Knowledge/Routine AI boundaries

## Data migration
- exact tables/columns added
- migration tests
- backward compatibility
- SQLite reopen verification

## Screen impact delivered
For each impacted screen:
- unchanged
- minor
- moderate
- major
- not reached

## Tests
Exact command and result for:
- Vitest
- lint
- build
- Playwright
- Cargo
- release check
- Tauri build
- WDIO if run
- accessibility

Never write “all good” without command evidence.

## Visual QA
- viewports
- screens inspected
- defects found
- fixes applied
- remaining visual debt

## Git
- commits created
- final HEAD
- files changed
- confirm no force push / no remote push unless explicitly authorized

## Remaining work
If anything is incomplete:
- exact unfinished item
- why
- priority
- safest next step

Do not hide partial completion.

---

# 21. AUTONOMOUS STOP CONDITIONS

Continue through phases as long as you can make safe progress.

Do NOT stop merely because:
- one test failed
- npm install/path issue
- a component needs refactoring
- a provider is unavailable
- a UI concept needs to be implemented with existing PBOS components
- an older V2 doc is vague

Diagnose and continue.

If time/tool budget prevents full completion:
1. leave repository in a passing/coherent state
2. do not leave half-applied migrations or broken main flows
3. finish the current coherent phase
4. run relevant tests
5. document exactly where to resume

If a true product-owner-only question appears:
- prefer the conservative V1-preserving behavior
- avoid irreversible mutation
- record it as `DECISION DEFERRED`
- continue independent work

---

# 22. DEFINITION OF DONE

Do not call the run DONE merely because V2 components exist.

The target is demonstrated end-to-end behavior:

- durable Natural Capture raw input
- multi-domain Capture Proposal review
- entity/ambiguity handling
- permission-aware provider use
- canonical mutation reuse
- no duplicate evidence
- explicit assessment scope
- explainable academic attention
- deterministic concrete-date planning
- Could Not Fit
- protected/manual/locked plan preservation
- occurrence-specific recurring block behavior
- Planning Diff review/apply/undo
- Adaptive Today follow-plan/adapt
- daily capacity boundary
- Focus evidence reuse
- Knowledge recall without fake mastery
- Routine pattern evidence threshold
- AI Coach contextual/deep-reasoning role
- provider failure fallback
- audit/revision trail
- schema v11 persistence
- exact Tauri wire tests
- regression tests/build/lint/E2E
- DESIGN.md visual integrity

If all are implemented and verified, report **V2 IMPLEMENTATION PASS**.

If not, report **V2 PARTIAL — SAFE CHECKPOINT** with exact remaining scope.

Begin now. Inspect first. Preserve V1. Build carefully.
